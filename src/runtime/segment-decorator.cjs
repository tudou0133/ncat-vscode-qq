const { normalizeSegments } = require('../core/message-utils.cjs');

function buildReplyPreviewFromSegments(segments) {
  const list = Array.isArray(segments) ? segments : [];
  const parts = [];
  for (const seg of list) {
    if (!seg || typeof seg !== 'object') {
      continue;
    }
    if (seg.type === 'text') {
      const text = String(seg.text || '').trim();
      if (text) {
        parts.push(text);
      }
      continue;
    }
    if (seg.type === 'mention' || seg.type === 'face' || seg.type === 'reply' || seg.type === 'forward' || seg.type === 'poke_notice' || seg.type === 'recall_notice') {
      const text = String(seg.text || '').trim();
      if (text) {
        parts.push(text);
      }
      continue;
    }
    if (seg.type === 'json') {
      const text = String(seg.summary || seg.title || seg.raw || '').trim();
      if (text) {
        parts.push(text);
      }
      continue;
    }
    if (seg.type === 'red_packet') {
      const text = String(seg.text || seg.title || '[红包]').trim();
      if (text) {
        parts.push(text);
      }
      continue;
    }
    if (seg.type === 'image') {
      parts.push('[图片]');
      continue;
    }
    if (seg.type === 'video') {
      parts.push('[视频]');
      continue;
    }
    parts.push(`[${String(seg.type || '消息')}]`);
  }
  return parts.join(' ').trim();
}

function safeBriefFromSegments(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return '';
  }
  const brief = buildReplyPreviewFromSegments(segments);
  if (!brief || brief === '[空消息]') {
    return '';
  }
  return brief;
}

function safeBriefFromMessagePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }
  const normalized = normalizeSegments(payload);
  return safeBriefFromSegments(normalized);
}

function formatReplyLabel(replyId, refName, refPreview) {
  const name = String(refName || '').trim();
  const preview = String(refPreview || '').trim();
  if (name && preview) {
    return `[回复 ${name}: ${preview}]`;
  }
  if (preview) {
    return `[回复: ${preview}]`;
  }
  if (name) {
    return `[回复 ${name}]`;
  }
  return replyId ? `[回复 #${replyId}]` : '[回复]';
}

async function decorateSegmentsForDisplay(runtime, segments, context = {}) {
  const out = [];
  const groupId = context.chatType === 'group' ? String(context.targetId || '') : '';
  const session = context.chatId ? runtime.chatSessions.get(String(context.chatId)) : null;
  const allowRemoteLookup = context.allowRemoteLookup !== false;

  for (const seg of segments) {
    if (!seg || typeof seg !== 'object') {
      continue;
    }

    if (seg.type === 'mention') {
      const target = String(seg.targetId || '').trim();
      if (!target || target === 'all') {
        out.push({ ...seg, text: '@全体成员' });
        continue;
      }

      let display = runtime.getDisplayName(target, groupId);
      if (!display && allowRemoteLookup) {
        display = await runtime.resolveDisplayName(target, groupId);
      }
      out.push({
        ...seg,
        text: `@${display || target}`,
      });
      continue;
    }

    if (seg.type === 'reply') {
      const replyId = String(seg.replyId || '').trim();
      let refName = '';
      let refPreview = '';
      if (replyId) {
        if (session && session.messageIdIndex && session.messageIdIndex.has(replyId)) {
          const refMsg = session.messageIdIndex.get(replyId);
          refName = String(refMsg?.senderName || refMsg?.senderId || '').trim();
          refPreview = safeBriefFromSegments(refMsg?.segments || []);
        }

        if ((!refName || !refPreview) && allowRemoteLookup) {
          try {
            const resp = await runtime.callApi('get_msg', { message_id: Number(replyId) || replyId });
            const sender = resp?.data?.sender || {};
            if (!refName) {
              refName = String(sender.card || sender.nickname || sender.user_id || '').trim();
            }
            const sid = String(sender.user_id || '').trim();
            if (sid && refName) {
              runtime.rememberDisplayName(sid, refName, groupId);
            }
            if (!refPreview) {
              refPreview = safeBriefFromMessagePayload(resp?.data || {});
            }
          } catch {
            // Ignore.
          }
        }
      }

      out.push({
        ...seg,
        text: formatReplyLabel(replyId, refName, refPreview),
        replyName: refName,
        replyPreview: refPreview,
      });
      continue;
    }

    out.push(seg);
  }

  return out;
}

module.exports = {
  decorateSegmentsForDisplay,
};
