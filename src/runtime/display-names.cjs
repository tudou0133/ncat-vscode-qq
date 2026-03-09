async function resolveDisplayName(runtime, userId, groupId = '') {
  const uid = String(userId || '').trim();
  if (!uid) {
    return '';
  }

  const cached = getDisplayName(runtime, uid, groupId);
  if (cached) {
    return cached;
  }

  const key = groupId ? `g:${groupId}:${uid}` : `u:${uid}`;
  if (runtime.pendingNameLookups.has(key)) {
    return runtime.pendingNameLookups.get(key);
  }

  const lookup = (async () => {
    try {
      if (groupId) {
        const resp = await runtime.callApi('get_group_member_info', {
          group_id: Number(groupId),
          user_id: Number(uid),
          no_cache: false,
        });
        const data = resp?.data || {};
        const name = String(data.card || data.nickname || '').trim();
        if (name) {
          rememberDisplayName(runtime, uid, name, groupId);
          return name;
        }
      }

      const resp = await runtime.callApi('get_stranger_info', {
        user_id: Number(uid),
        no_cache: false,
      });
      const data = resp?.data || {};
      const name = String(data.nickname || '').trim();
      if (name) {
        rememberDisplayName(runtime, uid, name);
        return name;
      }
    } catch {
      // Ignore lookup failures, fallback to id.
    }
    return '';
  })();

  runtime.pendingNameLookups.set(key, lookup);
  try {
    return await lookup;
  } finally {
    runtime.pendingNameLookups.delete(key);
  }
}

function rememberDisplayName(runtime, userId, name, groupId = '') {
  const uid = String(userId || '').trim();
  const n = String(name || '').trim();
  if (!uid || !n) {
    return;
  }
  runtime.userDisplayNameCache.set(uid, n);
  if (groupId) {
    runtime.groupMemberNameCache.set(`${String(groupId)}:${uid}`, n);
  }
}

function getDisplayName(runtime, userId, groupId = '') {
  const uid = String(userId || '').trim();
  if (!uid) {
    return '';
  }
  if (groupId) {
    const key = `${String(groupId)}:${uid}`;
    if (runtime.groupMemberNameCache.has(key)) {
      return runtime.groupMemberNameCache.get(key);
    }
  }
  return runtime.userDisplayNameCache.get(uid) || '';
}

module.exports = {
  getDisplayName,
  rememberDisplayName,
  resolveDisplayName,
};
