const { getPrivateAvatarUrl, getGroupAvatarUrl } = require('../core/avatar-utils.cjs');
const { normalizeSegments, toMsTime } = require('../core/message-utils.cjs');

function parseRecentContacts(runtime, response) {
  const data = response?.data;
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.list)
      ? data.list
      : Array.isArray(data?.records)
        ? data.records
        : [];

  const out = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const peerUin = String(item.peerUin || item.peer_uin || item.user_id || item.group_id || '');
    if (!peerUin) {
      continue;
    }

    const chatTypeRaw = String(item.chatType ?? item.chat_type ?? '');
    const type = chatTypeRaw === '2' || chatTypeRaw === 'group' ? 'group' : 'private';
    const title = String(item.remark || item.peerName || item.nickname || (type === 'group' ? `群 ${peerUin}` : `QQ ${peerUin}`));
    if (type === 'private') {
      runtime.rememberDisplayName(peerUin, title);
    }

    out.push({
      type,
      targetId: peerUin,
      title,
      avatarUrl: type === 'group' ? getGroupAvatarUrl(peerUin) : getPrivateAvatarUrl(peerUin),
    });
  }

  return out;
}

function extractHistoryMessages(response) {
  const data = response?.data;
  if (Array.isArray(data?.messages)) {
    return data.messages;
  }
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.list)) {
    return data.list;
  }
  return [];
}

async function ingestHistoryMessage(runtime, item, contact, cutoffTs, ingestEpoch = Number(runtime.historyIngestEpoch || 0)) {
  if (Number(runtime.historyIngestEpoch || 0) !== Number(ingestEpoch)) {
    return false;
  }
  const messageType = contact.type === 'group' ? 'group' : 'private';
  const isGroup = messageType === 'group';
  const targetId = String(contact.targetId || (isGroup ? item?.group_id || '' : item?.user_id || ''));
  if (!targetId) {
    return;
  }

  const ts = toMsTime(item?.time);
  if (ts < cutoffTs) {
    return;
  }

  const senderId = String(item?.sender?.user_id || item?.user_id || '');
  const senderName = String(item?.sender?.card || item?.sender?.nickname || senderId || 'unknown');
  runtime.rememberDisplayName(senderId, senderName, isGroup ? targetId : '');
  const direction = runtime.selfUserId && senderId === runtime.selfUserId ? 'out' : 'in';

  const chatId = `${messageType}:${targetId}`;
  const segments = await runtime.decorateSegmentsForDisplay(normalizeSegments(item), {
    chatType: messageType,
    targetId,
    chatId,
    allowRemoteLookup: false,
  });
  if (segments.length === 0) {
    segments.push({ type: 'text', text: '[空消息]' });
  }

  return runtime.appendMessageToSession({
    chatId,
    type: messageType,
    targetId,
    title: String(contact.title || (isGroup ? `群 ${targetId}` : `QQ ${targetId}`)),
    avatarUrl: String(contact.avatarUrl || (isGroup ? getGroupAvatarUrl(targetId) : getPrivateAvatarUrl(targetId))),
    direction,
    senderId,
    senderName,
    senderAvatarUrl: getPrivateAvatarUrl(senderId),
    segments,
    timestamp: ts,
    messageId: item?.message_id ? String(item.message_id) : '',
    rawMessageId: item?.message_id ? String(item.message_id) : '',
    countUnread: false,
  });
}

async function loadHistoryForContact(runtime, contact, cutoffTs, countOverride = 80, ingestEpoch = Number(runtime.historyIngestEpoch || 0)) {
  if (Number(runtime.historyIngestEpoch || 0) !== Number(ingestEpoch)) {
    return;
  }
  const count = Math.max(20, Math.min(800, Number(countOverride || 80)));
  if (contact.type === 'group') {
    const response = await runtime.callApi('get_group_msg_history', {
      group_id: Number(contact.targetId),
      count,
    });
    const rows = extractHistoryMessages(response);
    for (const item of rows.sort((a, b) => Number(a?.time || 0) - Number(b?.time || 0))) {
      if (Number(runtime.historyIngestEpoch || 0) !== Number(ingestEpoch)) {
        return;
      }
      await ingestHistoryMessage(runtime, item, contact, cutoffTs, ingestEpoch);
    }
    return;
  }

  const response = await runtime.callApi('get_friend_msg_history', {
    user_id: String(contact.targetId),
    count,
    reverseOrder: false,
    message_seq: '0',
  });
  const rows = extractHistoryMessages(response);
  for (const item of rows.sort((a, b) => Number(a?.time || 0) - Number(b?.time || 0))) {
    if (Number(runtime.historyIngestEpoch || 0) !== Number(ingestEpoch)) {
      return;
    }
    await ingestHistoryMessage(runtime, item, contact, cutoffTs, ingestEpoch);
  }
}

async function loadRecentHistoryOneDay(runtime) {
  if (runtime.historyLoadInFlight) {
    return runtime.historyLoadInFlight;
  }

  runtime.historyLoadInFlight = (async () => {
    const ingestEpoch = Number(runtime.historyIngestEpoch || 0);
    if (!runtime.isConnected()) {
      return;
    }

    const cutoffTs = runtime.getHistoryCutoff();
    const recentResp = await runtime.callApi('get_recent_contact', { count: 30 });
    const contacts = parseRecentContacts(runtime, recentResp).slice(0, 20);
    runtime.log(`History preload start: contacts=${contacts.length}`);

    for (const contact of contacts) {
      if (Number(runtime.historyIngestEpoch || 0) !== ingestEpoch) {
        runtime.log(`History preload aborted: ingestEpoch changed (${ingestEpoch} -> ${runtime.historyIngestEpoch}).`);
        return;
      }
      try {
        await loadHistoryForContact(runtime, contact, cutoffTs, 80, ingestEpoch);
        const session = runtime.chatSessions.get(`${contact.type}:${contact.targetId}`);
        if (session) {
          session.historyCount = Math.max(Number(session.historyCount || 80), 80);
        }
      } catch (error) {
        runtime.log(`History preload skipped: ${contact.type}:${contact.targetId}, reason=${error?.message || String(error)}`);
      }
    }

    if (Number(runtime.historyIngestEpoch || 0) === ingestEpoch) {
      runtime.pruneAllSessions();
      runtime.emitUiUpdate();
      runtime.schedulePersistCache();
      runtime.log('History preload finished.');
    } else {
      runtime.log(`History preload ignored: ingestEpoch changed (${ingestEpoch} -> ${runtime.historyIngestEpoch}).`);
    }
  })();

  try {
    await runtime.historyLoadInFlight;
  } finally {
    runtime.historyLoadInFlight = null;
  }
}

async function loadOlderMessagesForChat(runtime, chatId) {
  const key = String(chatId || '');
  if (!key) {
    return 0;
  }

  const session = runtime.chatSessions.get(key);
  if (!session) {
    return 0;
  }

  if (session.loadingOlder) {
    return 0;
  }

  const contact = {
    type: session.type,
    targetId: session.targetId,
    title: session.title,
    avatarUrl: session.avatarUrl || '',
  };

  session.loadingOlder = true;
  runtime.emitUiUpdate();

  const beforeCount = session.messages.length;
  const ingestEpoch = Number(runtime.historyIngestEpoch || 0);
  try {
    session.historyCount = Math.min(800, Number(session.historyCount || 80) + 80);
    await loadHistoryForContact(runtime, contact, runtime.getHistoryCutoff(), session.historyCount, ingestEpoch);
    if (Number(runtime.historyIngestEpoch || 0) !== ingestEpoch) {
      runtime.log(`loadOlderMessagesForChat aborted by clear cache: ${key}`);
      return 0;
    }
    runtime.pruneSessionMessages(session);
    runtime.emitUiUpdate();
    runtime.schedulePersistCache();
    const added = Math.max(0, session.messages.length - beforeCount);
    runtime.log(`loadOlderMessagesForChat: ${key}, added=${added}, historyCount=${session.historyCount}`);
    return added;
  } finally {
    session.loadingOlder = false;
    runtime.emitUiUpdate();
  }
}

module.exports = {
  extractHistoryMessages,
  ingestHistoryMessage,
  loadHistoryForContact,
  loadOlderMessagesForChat,
  loadRecentHistoryOneDay,
  parseRecentContacts,
};
