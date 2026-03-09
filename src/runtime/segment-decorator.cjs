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

function buildReplyRenderableSegments(segments) {
  const input = Array.isArray(segments) ? segments : [];
  const out = [];
  const MAX_SEGMENTS = 8;

  for (const seg of input) {
    if (!seg || typeof seg !== 'object') {
      continue;
    }
    if (out.length >= MAX_SEGMENTS) {
      break;
    }

    const type = String(seg.type || '').trim();
    if (!type) {
      continue;
    }

    if (type === 'image') {
      out.push({
        type: 'image',
        url: String(seg.url || '').trim(),
        label: String(seg.label || 'image').trim() || 'image',
      });
      continue;
    }

    if (type === 'video') {
      out.push({
        type: 'video',
        url: String(seg.url || '').trim(),
        coverUrl: String(seg.coverUrl || '').trim(),
        label: String(seg.label || 'video').trim() || 'video',
      });
      continue;
    }

    if (type === 'text') {
      const text = String(seg.text || '').trim();
      if (text) {
        out.push({
          type: 'text',
          text,
        });
      }
      continue;
    }

    if (type === 'mention') {
      out.push({
        type: 'mention',
        text: String(seg.text || '@某人').trim() || '@某人',
      });
      continue;
    }

    if (type === 'face') {
      out.push({
        type: 'face',
        text: String(seg.text || '🙂').trim() || '🙂',
        label: String(seg.label || '表情').trim() || '表情',
      });
      continue;
    }

    if (type === 'json') {
      const text = String(seg.title || seg.summary || seg.text || '[JSON消息]').trim();
      out.push({
        type: 'text',
        text: text || '[JSON消息]',
      });
      continue;
    }

    if (type === 'red_packet') {
      const text = String(seg.text || seg.title || '[红包]').trim();
      out.push({
        type: 'text',
        text: text || '[红包]',
      });
      continue;
    }

    if (type === 'forward') {
      out.push({
        type: 'text',
        text: String(seg.text || '[合并转发]').trim() || '[合并转发]',
      });
      continue;
    }

    if (type === 'reply') {
      out.push({
        type: 'text',
        text: String(seg.text || '[回复]').trim() || '[回复]',
      });
      continue;
    }

    const fallback = String(seg.text || `[${type}]`).trim();
    if (fallback) {
      out.push({
        type: 'text',
        text: fallback,
      });
    }
  }

  return out;
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
      let refSegments = [];
      if (replyId) {
        if (session && session.messageIdIndex && session.messageIdIndex.has(replyId)) {
          const refMsg = session.messageIdIndex.get(replyId);
          refName = String(refMsg?.senderName || refMsg?.senderId || '').trim();
          refSegments = Array.isArray(refMsg?.segments) ? refMsg.segments : [];
          refPreview = safeBriefFromSegments(refSegments);
        }

        if ((!refName || !refPreview || refSegments.length === 0) && allowRemoteLookup) {
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
            const normalizedReplySegments = normalizeSegments(resp?.data || {});
            if (refSegments.length === 0 && normalizedReplySegments.length > 0) {
              refSegments = normalizedReplySegments;
            }
            if (!refPreview) {
              refPreview = safeBriefFromSegments(normalizedReplySegments);
            }
          } catch {
            // Ignore.
          }
        }
      }

      const replySegments = buildReplyRenderableSegments(refSegments);
      out.push({
        ...seg,
        text: formatReplyLabel(replyId, refName, refPreview),
        replyName: refName,
        replyPreview: refPreview,
        replySegments,
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
