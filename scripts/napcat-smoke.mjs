#!/usr/bin/env node
import process from 'node:process';

const rawUrl = process.env.NCAT_WS_URL || 'ws://127.0.0.1:3001';
const token = process.env.NCAT_TOKEN || '';

let wsUrl;
try {
  const url = new URL(rawUrl);
  if (token && !url.searchParams.has('access_token')) {
    url.searchParams.set('access_token', token);
  }
  wsUrl = url.toString();
} catch (error) {
  console.error('[smoke] Invalid NCAT_WS_URL:', rawUrl);
  process.exit(1);
}

console.log(`[smoke] Connecting to ${wsUrl}`);
console.log('[smoke] Press Ctrl+C to stop.');

let seq = 0;
const pendingEcho = new Set();
const ws = new WebSocket(wsUrl);

function sendGetLoginInfo() {
  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }

  const echo = `smoke-login-${++seq}`;
  pendingEcho.add(echo);

  ws.send(
    JSON.stringify({
      action: 'get_login_info',
      params: {},
      echo,
    })
  );
}

ws.addEventListener('open', () => {
  console.log('[smoke] Connected. Sending get_login_info every 20s.');
  sendGetLoginInfo();
  setInterval(sendGetLoginInfo, 20_000);
});

ws.addEventListener('message', (event) => {
  try {
    const data = JSON.parse(event.data.toString());

    if (data.echo && pendingEcho.has(data.echo)) {
      pendingEcho.delete(data.echo);
      const nickname = data?.data?.nickname || 'unknown';
      const userId = data?.data?.user_id || 'unknown';
      console.log(`[smoke] login_info ok: nickname=${nickname}, user_id=${userId}`);
      return;
    }

    if (data.post_type === 'message') {
      const userId = data.user_id ?? 'unknown';
      const message = typeof data.raw_message === 'string' ? data.raw_message : '[non-text message]';
      console.log(`[smoke] message from ${userId}: ${message}`);
      return;
    }

    if (data.post_type === 'meta_event' && data.meta_event_type === 'heartbeat') {
      return;
    }

    if (data.post_type === 'notice') {
      console.log(`[smoke] notice: ${data.notice_type || 'unknown'}`);
      return;
    }
  } catch {
    console.log('[smoke] non-json frame:', String(event.data).slice(0, 120));
  }
});

ws.addEventListener('error', (event) => {
  console.error('[smoke] WebSocket error. Check URL/token/NCat status.', event?.message || '');
});

ws.addEventListener('close', (event) => {
  console.error(`[smoke] Connection closed: code=${event.code}, reason=${event.reason || 'n/a'}`);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n[smoke] Stopping...');
  ws.close(1000, 'manual stop');
  process.exit(0);
});
