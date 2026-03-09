const { getPrivateAvatarUrl } = require('../core/avatar-utils.cjs');
const { normalizeSegments, toMsTime } = require('../core/message-utils.cjs');

function extractForwardNodes(response) {
  const data = response?.data;
  if (Array.isArray(data?.messages)) {
    return data.messages;
  }
  if (Array.isArray(data?.message)) {
    return data.message;
  }
  if (Array.isArray(data?.list)) {
    return data.list;
  }
  if (Array.isArray(data)) {
    return data;
  }
  return [];
}

function extractForwardTitle(response, forwardId) {
  const data = response?.data || {};
  const title = String(
    data.title || data.summary || data.prompt || data.name || data.desc || data.brief || ''
  ).trim();
  return title || (forwardId ? `合并转发 #${forwardId}` : '合并转发');
}

function extractNodePayload(item) {
  if (!item || typeof item !== 'object') {
    return {};
  }
  if (item.type === 'node' && item.data && typeof item.data === 'object') {
    return item.data;
  }
  return item;
}

function extractNodeContent(payload) {
  if (Array.isArray(payload?.message)) {
    return { message: payload.message };
  }
  if (Array.isArray(payload?.content)) {
    return { message: payload.content };
  }
  if (Array.isArray(payload?.data?.message)) {
    return { message: payload.data.message };
  }
  if (Array.isArray(payload?.data?.content)) {
    return { message: payload.data.content };
  }
  if (typeof payload?.message === 'string') {
    return { raw_message: payload.message };
  }
  if (typeof payload?.content === 'string') {
    return { raw_message: payload.content };
  }
  if (typeof payload?.raw_message === 'string') {
    return { raw_message: payload.raw_message };
  }
  if (typeof payload?.data?.message === 'string') {
    return { raw_message: payload.data.message };
  }
  if (typeof payload?.data?.content === 'string') {
    return { raw_message: payload.data.content };
  }
  return {};
}

async function callGetForwardMsg(runtime, forwardId) {
  const value = String(forwardId || '').trim();
  const numericValue = Number(value);
  const attempts = [{ label: 'id:string', params: { id: value } }];

  attempts.push({ label: 'message_id:string', params: { message_id: value } });
  if (Number.isSafeInteger(numericValue) && value) {
    attempts.push({ label: 'message_id:number', params: { message_id: numericValue } });
  }

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const response = await runtime.callApi('get_forward_msg', attempt.params);
      const nodes = extractForwardNodes(response);
      runtime.log(`get_forward_msg success: forwardId=${value}, via=${attempt.label}, nodes=${nodes.length}`);
      if (nodes.length > 0 || response?.status === 'ok') {
        return response;
      }
    } catch (error) {
      lastError = error;
      runtime.log(`get_forward_msg failed: forwardId=${value}, via=${attempt.label}, reason=${error?.message || String(error)}`);
    }
  }

  throw lastError || new Error('get_forward_msg returned no data.');
}

async function getForwardPreview(runtime, forwardId, context = {}) {
  const value = String(forwardId || '').trim();
  if (!value) {
    throw new Error('Forward ID is empty.');
  }

  const ok = await runtime.ensureConnected();
  if (!ok) {
    throw new Error('NCat is not connected.');
  }

  const response = await callGetForwardMsg(runtime, value);
  const rawNodes = extractForwardNodes(response);
  const title = extractForwardTitle(response, value);
  const chatType = String(context.chatType || '');
  const targetId = String(context.targetId || '');
  const chatId = String(context.chatId || '');

  const nodes = [];
  for (const [index, item] of rawNodes.entries()) {
    const payload = extractNodePayload(item);
    const sender = payload.sender && typeof payload.sender === 'object' ? payload.sender : {};
    const senderId = String(
      payload.user_id || payload.sender_id || sender.user_id || payload.uin || payload.qq || ''
    ).trim();
    const senderName = String(
      payload.nickname || payload.name || payload.title || sender.card || sender.nickname || senderId || 'unknown'
    ).trim();
    if (senderId && senderName) {
      runtime.rememberDisplayName(senderId, senderName, chatType === 'group' ? targetId : '');
    }

    const contentPayload = extractNodeContent(payload);
    let segments = normalizeSegments(contentPayload);
    segments = await runtime.decorateSegmentsForDisplay(segments, {
      chatType,
      targetId,
      chatId,
      allowRemoteLookup: false,
    });

    if (segments.length === 0) {
      segments = [{ type: 'text', text: '[空消息]' }];
    }

    nodes.push({
      id: String(payload.id || payload.message_id || `${value}-${index}`),
      senderId,
      senderName: senderName || senderId || 'unknown',
      avatarUrl: senderId ? getPrivateAvatarUrl(senderId) : '',
      timestamp: toMsTime(payload.time || payload.timestamp || payload.send_time || 0),
      segments,
    });
  }

  if (nodes.length === 0) {
    const data = response?.data;
    const shape = data && typeof data === 'object' ? Object.keys(data).join('|') : typeof data;
    runtime.log(`getForwardPreview empty: forwardId=${value}, dataKeys=${shape}`);
  }

  return {
    forwardId: value,
    title,
    nodes,
  };
}

module.exports = {
  getForwardPreview,
};
