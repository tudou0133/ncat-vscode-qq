const { getPrivateAvatarUrl, getGroupAvatarUrl } = require('../core/avatar-utils.cjs');

function searchDirectoryEntries(contactDirectory, queryText, limit = 30) {
  const q = String(queryText || '').trim().toLowerCase();
  if (!q) {
    return [];
  }

  const results = [];
  for (const item of contactDirectory.values()) {
    const haystack = String(item.searchText || '').toLowerCase();
    if (!haystack.includes(q)) {
      continue;
    }

    const title = String(item.title || '').toLowerCase();
    const targetId = String(item.targetId || '').toLowerCase();
    const score = targetId === q ? 0 : title.startsWith(q) ? 1 : title.includes(q) ? 2 : 3;
    results.push({
      ...item,
      score,
    });
  }

  return results
    .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title, 'zh-CN'))
    .slice(0, Math.max(1, Math.min(100, Number(limit || 30))))
    .map(({ score, ...item }) => item);
}

async function refreshContactDirectory(runtime, force = false) {
  if (!runtime.isConnected()) {
    return;
  }
  if (!force && runtime.contactDirectoryLoaded) {
    return;
  }
  if (runtime.contactDirectoryLoading) {
    return runtime.contactDirectoryLoading;
  }

  runtime.contactDirectoryLoading = (async () => {
    try {
      const [friendResult, groupResult] = await Promise.allSettled([
        runtime.callApi('get_friend_list', {}),
        runtime.callApi('get_group_list', {}),
      ]);

      const next = new Map();
      const friendResp = friendResult.status === 'fulfilled' ? friendResult.value : null;
      const groupResp = groupResult.status === 'fulfilled' ? groupResult.value : null;
      if (friendResult.status === 'rejected') {
        runtime.log(`refreshContactDirectory friend list failed: ${friendResult.reason?.message || String(friendResult.reason)}`);
      }
      if (groupResult.status === 'rejected') {
        runtime.log(`refreshContactDirectory group list failed: ${groupResult.reason?.message || String(groupResult.reason)}`);
      }

      const friendRows = Array.isArray(friendResp?.data)
        ? friendResp.data
        : Array.isArray(friendResp?.data?.list)
          ? friendResp.data.list
          : [];
      const groupRows = Array.isArray(groupResp?.data)
        ? groupResp.data
        : Array.isArray(groupResp?.data?.list)
          ? groupResp.data.list
          : [];

      for (const item of friendRows) {
        const userId = String(item?.user_id || item?.uin || '');
        if (!userId) {
          continue;
        }
        const nickname = String(item?.nickname || '').trim();
        const remark = String(item?.remark || item?.card || '').trim();
        const title = remark || nickname || `QQ ${userId}`;
        if (title) {
          runtime.rememberDisplayName(userId, title);
        }
        next.set(`private:${userId}`, {
          id: `private:${userId}`,
          source: 'directory',
          type: 'private',
          targetId: userId,
          title,
          avatarUrl: getPrivateAvatarUrl(userId),
          preview: `好友 · QQ ${userId}`,
          searchText: [title, nickname, remark, userId].filter(Boolean).join('\n'),
        });
      }

      for (const item of groupRows) {
        const groupId = String(item?.group_id || item?.groupId || '');
        if (!groupId) {
          continue;
        }
        const groupName = String(item?.group_name || item?.groupName || item?.name || '').trim();
        const title = groupName || `群 ${groupId}`;
        next.set(`group:${groupId}`, {
          id: `group:${groupId}`,
          source: 'directory',
          type: 'group',
          targetId: groupId,
          title,
          avatarUrl: getGroupAvatarUrl(groupId),
          preview: `群聊 · 群号 ${groupId}`,
          searchText: [title, groupName, groupId].filter(Boolean).join('\n'),
        });
      }

      runtime.contactDirectory = next;
      runtime.contactDirectoryLoaded = true;
      runtime.log(`Contact directory refreshed: friends+groups=${runtime.contactDirectory.size}`);
      runtime.emitUiUpdate();
    } catch (error) {
      runtime.log(`refreshContactDirectory failed: ${error?.message || String(error)}`);
    } finally {
      runtime.contactDirectoryLoading = null;
    }
  })();

  return runtime.contactDirectoryLoading;
}

async function ensureChatSession(runtime, contact) {
  const type = String(contact?.type || '');
  const targetId = String(contact?.targetId || '');
  if ((type !== 'private' && type !== 'group') || !targetId) {
    throw new Error('Invalid chat target.');
  }

  const chatId = `${type}:${targetId}`;
  const session = runtime.upsertSession({
    chatId,
    type,
    targetId,
    title: String(contact?.title || (type === 'group' ? `群 ${targetId}` : `QQ ${targetId}`)),
    avatarUrl: String(contact?.avatarUrl || (type === 'group' ? getGroupAvatarUrl(targetId) : getPrivateAvatarUrl(targetId))),
  });

  if (session.messages.length === 0 && runtime.isConnected()) {
    try {
      await runtime.loadHistoryForContact({
        type,
        targetId,
        title: session.title,
        avatarUrl: session.avatarUrl || '',
      }, runtime.getHistoryCutoff(), session.historyCount || 80);
      runtime.pruneSessionMessages(session);
    } catch (error) {
      runtime.log(`ensureChatSession history load failed: chatId=${chatId}, reason=${error?.message || String(error)}`);
    }
  }

  runtime.emitUiUpdate();
  runtime.schedulePersistCache();
  return session;
}

module.exports = {
  ensureChatSession,
  refreshContactDirectory,
  searchDirectoryEntries,
};
