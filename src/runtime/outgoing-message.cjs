function normalizeOutgoingRequest(input) {
  if (typeof input === 'string') {
    return {
      text: input,
      images: [],
      replyToMessageId: '',
    };
  }

  const text = String(input?.text || '');
  const replyToMessageId = String(input?.replyToMessageId || '').trim();
  const images = Array.isArray(input?.images)
    ? input.images
        .map((item) => ({
          dataUrl: String(item?.dataUrl || '').trim(),
          name: String(item?.name || 'image').trim() || 'image',
        }))
        .filter((item) => item.dataUrl)
    : [];

  return {
    text,
    images,
    replyToMessageId,
  };
}

function isMentionBoundaryChar(ch) {
  if (!ch) {
    return true;
  }
  return /[\s,.;:!?'"`~!@#$%^&*()_+\-=[\]{}\\|<>/?，。；：！？、（）【】《》「」]/.test(ch);
}

function parseTextSegmentsForOneBot(text) {
  const source = String(text || '');
  if (!source) {
    return [];
  }

  const out = [];
  const regex = /@(?:all|\d{5,12})/gi;
  let cursor = 0;
  let match = regex.exec(source);
  while (match) {
    const raw = String(match[0] || '');
    const start = match.index;
    const end = start + raw.length;
    const prevChar = start > 0 ? source[start - 1] : '';
    const nextChar = end < source.length ? source[end] : '';

    if (!isMentionBoundaryChar(prevChar) || !isMentionBoundaryChar(nextChar)) {
      match = regex.exec(source);
      continue;
    }

    if (start > cursor) {
      const plain = source.slice(cursor, start);
      if (plain) {
        out.push({
          type: 'text',
          data: {
            text: plain,
          },
        });
      }
    }

    const target = raw.slice(1).toLowerCase();
    out.push({
      type: 'at',
      data: {
        qq: target === 'all' ? 'all' : target,
      },
    });
    cursor = end;
    match = regex.exec(source);
  }

  if (cursor < source.length) {
    const tail = source.slice(cursor);
    if (tail) {
      out.push({
        type: 'text',
        data: {
          text: tail,
        },
      });
    }
  }

  if (out.length === 0) {
    out.push({
      type: 'text',
      data: {
        text: source,
      },
    });
  }

  return out;
}

function dataUrlToBase64Payload(dataUrl) {
  const value = String(dataUrl || '').trim();
  const marker = 'base64,';
  const idx = value.indexOf(marker);
  if (idx >= 0) {
    return value.slice(idx + marker.length);
  }
  return value.replace(/^base64:\/\//, '');
}

function buildOneBotMessage(composed) {
  const normalized = normalizeOutgoingRequest(composed);
  const segments = [];
  if (normalized.replyToMessageId) {
    segments.push({
      type: 'reply',
      data: {
        id: normalized.replyToMessageId,
      },
    });
  }
  const text = normalized.text;
  if (text) {
    const parsedTextSegments = parseTextSegmentsForOneBot(text);
    for (const seg of parsedTextSegments) {
      segments.push(seg);
    }
  }

  for (const image of normalized.images) {
    const payload = dataUrlToBase64Payload(image.dataUrl);
    if (!payload) {
      continue;
    }
    segments.push({
      type: 'image',
      data: {
        file: `base64://${payload}`,
      },
    });
  }

  return segments;
}

function buildLocalEchoSegments(composed) {
  const normalized = normalizeOutgoingRequest(composed);
  const segments = [];
  if (normalized.replyToMessageId) {
    segments.push({
      type: 'reply',
      replyId: normalized.replyToMessageId,
      text: `[回复 #${normalized.replyToMessageId}]`,
    });
  }
  if (normalized.text) {
    const parsedTextSegments = parseTextSegmentsForOneBot(normalized.text);
    for (const seg of parsedTextSegments) {
      if (seg.type === 'at') {
        const target = String(seg?.data?.qq || '').trim();
        segments.push({
          type: 'mention',
          targetId: target,
          text: target === 'all' ? '@全体成员' : (target ? `@${target}` : '@某人'),
        });
      } else {
        segments.push({
          type: 'text',
          text: String(seg?.data?.text || ''),
        });
      }
    }
  }

  for (const image of normalized.images) {
    segments.push({
      type: 'image',
      url: image.dataUrl,
      label: image.name || 'image',
    });
  }

  if (segments.length === 0) {
    segments.push({
      type: 'text',
      text: '[空消息]',
    });
  }

  return segments;
}

module.exports = {
  buildLocalEchoSegments,
  buildOneBotMessage,
  normalizeOutgoingRequest,
};
