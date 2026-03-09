const { getPrivateAvatarUrl, getGroupAvatarUrl } = require('../core/avatar-utils.cjs');

function persistCacheNow(runtime, cacheStoreKey) {
  const sessions = [];
  for (const session of runtime.chatSessions.values()) {
    const messages = session.messages
      .filter((item) => Number(item.timestamp || 0) >= runtime.getHistoryCutoff())
      .map((item) => ({
        id: item.id,
        messageKey: item.messageKey,
        rawMessageId: item.rawMessageId || '',
        direction: item.direction,
        senderId: item.senderId,
        senderName: item.senderName,
        senderAvatarUrl: item.senderAvatarUrl || '',
        timestamp: item.timestamp,
        displayStyle: item.displayStyle || 'bubble',
        segments: item.segments,
      }));

    if (messages.length === 0) {
      continue;
    }

    sessions.push({
      id: session.id,
      type: session.type,
      targetId: session.targetId,
      title: session.title,
      avatarUrl: session.avatarUrl || '',
      preview: session.preview,
      lastTs: session.lastTs,
      unread: session.unread,
      historyCount: Number(session.historyCount || 80),
      messages,
    });
  }

  const payload = {
    version: 1,
    savedAt: Date.now(),
    selfUserId: runtime.selfUserId,
    selfNickname: runtime.selfNickname,
    sessions,
  };

  runtime.context.globalState
    .update(cacheStoreKey, payload)
    .catch((error) => runtime.log(`persist cache failed: ${error?.message || String(error)}`));
}

function restoreCachedSessions(runtime, cacheStoreKey) {
  const payload = runtime.context.globalState.get(cacheStoreKey);
  if (!payload || typeof payload !== 'object') {
    return;
  }

  if (payload.selfUserId) {
    runtime.selfUserId = String(payload.selfUserId);
  }
  if (payload.selfNickname) {
    runtime.selfNickname = String(payload.selfNickname);
  }

  const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
  for (const raw of sessions) {
    if (!raw || typeof raw !== 'object' || !raw.id) {
      continue;
    }

    const session = runtime.upsertSession({
      chatId: String(raw.id),
      type: String(raw.type || 'private'),
      targetId: String(raw.targetId || ''),
      title: String(raw.title || raw.id),
      avatarUrl: String(
        raw.avatarUrl ||
          (String(raw.type || 'private') === 'group'
            ? getGroupAvatarUrl(String(raw.targetId || ''))
            : getPrivateAvatarUrl(String(raw.targetId || '')))
      ),
    });
    session.historyCount = Number(raw.historyCount || 80);

    session.unread = Number(raw.unread || 0);
    session.messages = Array.isArray(raw.messages)
      ? raw.messages.map((item) => ({
          id: String(item.id || `${item.timestamp || Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
          messageKey: String(item.messageKey || item.id || ''),
          rawMessageId: String(item.rawMessageId || ''),
          direction: String(item.direction || 'in'),
          senderId: String(item.senderId || ''),
          senderName: String(item.senderName || ''),
          senderAvatarUrl: String(item.senderAvatarUrl || ''),
          timestamp: Number(item.timestamp || Date.now()),
          displayStyle: String(item.displayStyle || 'bubble'),
          segments: Array.isArray(item.segments) ? item.segments : [{ type: 'text', text: String(item.text || '') }],
        }))
      : [];

    runtime.pruneSessionMessages(session);
  }

  runtime.pruneAllSessions();
  runtime.emitUiUpdate();
  runtime.log(`Cached sessions restored: ${runtime.chatSessions.size}`);
}

module.exports = {
  persistCacheNow,
  restoreCachedSessions,
};
