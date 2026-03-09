function toMsTime(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return Date.now();
  }
  if (value > 1000000000000) {
    return Math.floor(value);
  }
  return Math.floor(value * 1000);
}

function clipText(text, max = 26) {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}...`;
}

function decodeCQText(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#44;/g, ',')
    .replace(/&#91;/g, '[')
    .replace(/&#93;/g, ']');
}

const QQ_FACE_MAP = new Map([
  ['0', { emoji: '😮', label: '惊讶' }],
  ['1', { emoji: '😒', label: '撇嘴' }],
  ['2', { emoji: '😍', label: '色' }],
  ['3', { emoji: '😳', label: '发呆' }],
  ['4', { emoji: '😏', label: '得意' }],
  ['5', { emoji: '😢', label: '流泪' }],
  ['6', { emoji: '😊', label: '害羞' }],
  ['7', { emoji: '🤐', label: '闭嘴' }],
  ['8', { emoji: '😴', label: '睡' }],
  ['9', { emoji: '😭', label: '大哭' }],
  ['10', { emoji: '😅', label: '尴尬' }],
  ['11', { emoji: '😠', label: '发怒' }],
  ['12', { emoji: '😜', label: '调皮' }],
  ['13', { emoji: '😁', label: '呲牙' }],
  ['14', { emoji: '🙂', label: '微笑' }],
  ['15', { emoji: '🙁', label: '难过' }],
  ['16', { emoji: '😎', label: '酷' }],
  ['18', { emoji: '😫', label: '抓狂' }],
  ['20', { emoji: '🤭', label: '偷笑' }],
  ['21', { emoji: '🥰', label: '可爱' }],
  ['22', { emoji: '🙄', label: '白眼' }],
  ['23', { emoji: '😤', label: '傲慢' }],
  ['25', { emoji: '😪', label: '困' }],
  ['26', { emoji: '😱', label: '惊恐' }],
  ['27', { emoji: '😓', label: '流汗' }],
  ['28', { emoji: '😄', label: '憨笑' }],
  ['29', { emoji: '😌', label: '悠闲' }],
  ['30', { emoji: '💪', label: '奋斗' }],
  ['32', { emoji: '❓', label: '疑问' }],
  ['33', { emoji: '🤫', label: '嘘' }],
  ['34', { emoji: '😵', label: '晕' }],
  ['35', { emoji: '😥', label: '折磨' }],
  ['36', { emoji: '😓', label: '衰' }],
  ['37', { emoji: '💀', label: '骷髅' }],
  ['38', { emoji: '👊', label: '敲打' }],
  ['39', { emoji: '👋', label: '再见' }],
  ['41', { emoji: '😋', label: '发馋' }],
  ['42', { emoji: '🥱', label: '哈欠' }],
  ['43', { emoji: '🤗', label: '抱抱' }],
  ['49', { emoji: '🤫', label: '右哼哼' }],
  ['50', { emoji: '😏', label: '鄙视' }],
  ['51', { emoji: '😩', label: '委屈' }],
  ['53', { emoji: '💋', label: '亲亲' }],
  ['54', { emoji: '😨', label: '吓' }],
  ['55', { emoji: '😣', label: '可怜' }],
  ['56', { emoji: '🔪', label: '菜刀' }],
  ['57', { emoji: '🍉', label: '西瓜' }],
  ['59', { emoji: '🏀', label: '篮球' }],
  ['60', { emoji: '⚽', label: '足球' }],
  ['61', { emoji: '☕', label: '咖啡' }],
  ['63', { emoji: '🌹', label: '玫瑰' }],
  ['64', { emoji: '🥀', label: '凋谢' }],
  ['66', { emoji: '💔', label: '心碎' }],
  ['67', { emoji: '❤️', label: '爱心' }],
  ['69', { emoji: '🎁', label: '礼物' }],
  ['74', { emoji: '🌞', label: '太阳' }],
  ['75', { emoji: '🌙', label: '月亮' }],
  ['76', { emoji: '👍', label: '赞' }],
  ['77', { emoji: '👎', label: '踩' }],
  ['78', { emoji: '🤝', label: '握手' }],
  ['79', { emoji: '✌️', label: '胜利' }],
  ['85', { emoji: '🙌', label: '飞吻' }],
  ['89', { emoji: '🍜', label: '下面' }],
  ['96', { emoji: '🥳', label: '庆祝' }],
  ['97', { emoji: '🎉', label: '鞭炮' }],
  ['98', { emoji: '💥', label: '炸弹' }],
  ['99', { emoji: '🔪', label: '刀' }],
  ['100', { emoji: '⚽', label: '足球' }],
  ['101', { emoji: '🐷', label: '猪头' }],
  ['102', { emoji: '🍰', label: '蛋糕' }],
]);

function toFaceSegment(faceId, fallbackText = '') {
  const id = String(faceId || '').trim();
  const known = QQ_FACE_MAP.get(id);
  if (known) {
    return {
      type: 'face',
      faceId: id,
      text: known.emoji,
      label: known.label,
    };
  }
  const fallback = String(fallbackText || '').trim();
  return {
    type: 'face',
    faceId: id,
    text: fallback || '🙂',
    label: fallback || (id ? `表情 #${id}` : '表情'),
  };
}

function extractCQParams(raw) {
  const out = {};
  for (const piece of raw.split(',')) {
    const idx = piece.indexOf('=');
    if (idx <= 0) {
      continue;
    }
    const key = piece.slice(0, idx).trim();
    const value = piece.slice(idx + 1).trim();
    out[key] = decodeCQText(value);
  }
  return out;
}

function extractCQParamValue(raw, key) {
  const source = String(raw || '');
  const marker = `${String(key || '').trim()}=`;
  const idx = source.indexOf(marker);
  if (idx < 0) {
    return '';
  }
  return decodeCQText(source.slice(idx + marker.length));
}

function safeJsonParse(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeHttpUrl(value) {
  const raw = decodeCQText(String(value || ''))
    .replace(/\\\//g, '/')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/[",]+$/g, '');
  if (!raw) {
    return '';
  }
  if (/^mqqapi:\/\//i.test(raw) || /^mqqopensdkapi:\/\//i.test(raw) || /^tencent.mobileqq:\/\//i.test(raw)) {
    return raw;
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/|$)/i.test(raw)) {
    return `https://${raw}`;
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  if (raw.startsWith('//')) {
    return `https:${raw}`;
  }
  if (/^www\./i.test(raw)) {
    return `https://${raw}`;
  }
  return '';
}

function extractFirstHttpUrlFromText(text) {
  const source = decodeCQText(String(text || '')).replace(/\\\//g, '/');
  const matches = source.match(/(?:https?:\/\/|mqqapi:\/\/|mqqopensdkapi:\/\/|tencent\.mobileqq:\/\/)[^\s"'<>]+/ig) || [];
  if (matches.length === 0) {
    return '';
  }
  const normalized = matches
    .map((item) => normalizeHttpUrl(item))
    .filter(Boolean);
  if (normalized.length === 0) {
    return '';
  }
  const nonImage = normalized.find((item) => !isLikelyImageUrl(item));
  return nonImage || normalized[0];
}

function isLikelyImageUrl(url) {
  const value = String(url || '').toLowerCase();
  if (!value) {
    return false;
  }
  if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(value)) {
    return true;
  }
  if (/(\/image\/|\/img\/|\/avatar\/|\/logo\/|\/thumb\/|\/cover\/)/i.test(value)) {
    return true;
  }
  if (value.includes('open.gtimg.cn/open/app_icon/') || value.includes('qq.ugcimg.cn/')) {
    return true;
  }
  return false;
}

function scoreUrlCandidate(url, pathHint = '') {
  const path = String(pathHint || '').toLowerCase();
  let score = 0;

  if (/(jump|target|link|href|qqdoc|docurl|article|news)/i.test(path)) {
    score += 120;
  }
  if (/(\.|^)(url|uri)$/.test(path)) {
    score += 60;
  }
  if (/(icon|img|image|pic|thumb|preview|avatar|head|logo|cover)/i.test(path)) {
    score -= 120;
  }
  if (isLikelyImageUrl(url)) {
    score -= 100;
  }

  return score;
}

function collectHttpUrlsInObject(value, out, depth = 0, pathHint = '') {
  if (depth > 5 || value == null) {
    return;
  }

  if (typeof value === 'string') {
    const direct = normalizeHttpUrl(value);
    if (direct) {
      out.push({
        url: direct,
        score: scoreUrlCandidate(direct, pathHint),
      });
      return;
    }
    const fromText = extractFirstHttpUrlFromText(value);
    if (fromText) {
      out.push({
        url: fromText,
        score: scoreUrlCandidate(fromText, pathHint) - 20,
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      collectHttpUrlsInObject(value[i], out, depth + 1, `${pathHint}[${i}]`);
    }
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  for (const key of Object.keys(value)) {
    collectHttpUrlsInObject(value[key], out, depth + 1, pathHint ? `${pathHint}.${key}` : key);
  }
}

function findBestHttpUrlInObject(value) {
  const candidates = [];
  collectHttpUrlsInObject(value, candidates, 0, '');
  if (candidates.length === 0) {
    return '';
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].url;
}

function summarizeJsonPayload(rawJson) {
  const raw = typeof rawJson === 'string'
    ? rawJson.trim()
    : (rawJson && typeof rawJson === 'object' ? JSON.stringify(rawJson) : String(rawJson || '').trim());
  const parsed = (rawJson && typeof rawJson === 'object')
    ? rawJson
    : (safeJsonParse(raw) || safeJsonParse(decodeCQText(raw).replace(/\\\//g, '/')));
  if (!parsed || typeof parsed !== 'object') {
    return {
      type: 'json',
      title: 'JSON消息',
      summary: raw ? clipText(raw, 72) : '',
      text: '[JSON消息]',
      url: extractFirstHttpUrlFromText(raw),
      raw,
    };
  }

  const detail = parsed.meta?.detail_1 || parsed.meta?.detail || {};
  const news = parsed.meta?.news || {};
  const contact = parsed.meta?.contact || {};
  const notify = parsed.meta?.notify || {};
  const prompt = String(parsed.prompt || parsed.desc || detail.desc || news.desc || notify.title || '').trim();
  const title = String(
    detail.title ||
    news.title ||
    contact.nickname ||
    contact.title ||
    parsed.title ||
    prompt ||
    'JSON消息'
  ).trim();
  const summary = String(
    detail.desc ||
    detail.preview ||
    news.desc ||
    contact.remark ||
    parsed.text ||
    parsed.desc ||
    prompt
  ).trim();
  const url = findBestHttpUrlInObject(parsed) || extractFirstHttpUrlFromText(raw);

  return {
    type: 'json',
    title: title || 'JSON消息',
    summary: summary || '',
    text: title ? `[${clipText(title, 24)}]` : '[JSON消息]',
    url,
    raw,
  };
}

function toRedPacketSegment(data = {}, fallbackType = '红包') {
  const title = String(
    data.title ||
    data.desc ||
    data.text ||
    data.prompt ||
    data.name ||
    data.summary ||
    ''
  ).trim();
  const hint = String(data.type || data.kind || fallbackType || '红包').trim();
  const prefix = hint ? `[${hint}]` : '[红包]';
  const suffix = title ? ` ${clipText(title, 56)}` : '';
  return {
    type: 'red_packet',
    title: title || hint || '红包',
    text: `${prefix}${suffix}`,
  };
}

function extractElementType(seg) {
  const candidates = [
    seg?.elementType,
    seg?.ElementType,
    seg?.element_type,
    seg?.data?.elementType,
    seg?.data?.ElementType,
    seg?.data?.element_type,
    seg?.data?.elemType,
    seg?.data?.element,
  ];
  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num)) {
      return num;
    }
  }
  return NaN;
}

function isRedPacketLikeSegment(seg, segType = '', elementType = NaN) {
  if (Number.isFinite(elementType) && elementType === 9) {
    return true;
  }
  const typeText = String(segType || '').toLowerCase();
  if (typeText === 'redbag' || typeText === 'red_packet' || typeText === 'hongbao' || typeText === 'wallet' || typeText === 'qqwallet') {
    return true;
  }
  const raw = JSON.stringify(seg || {}).toLowerCase();
  if (raw.includes('elementtype') && raw.includes('9')) {
    return true;
  }
  return raw.includes('红包') || raw.includes('redbag') || raw.includes('red_packet') || raw.includes('hongbao') || raw.includes('qqwallet');
}

function isRedPacketLikePayload(payload) {
  const raw = JSON.stringify(payload || {}).toLowerCase();
  if (!raw || raw === '{}') {
    return false;
  }
  if (/elementtype[^0-9]*9/.test(raw) || /elementtype\s*[:=]\s*9/.test(raw)) {
    return true;
  }
  return (
    raw.includes('红包') ||
    raw.includes('redbag') ||
    raw.includes('red_packet') ||
    raw.includes('hongbao') ||
    raw.includes('qqwallet') ||
    raw.includes('wallet')
  );
}

function parseRawMessage(rawMessage) {
  const text = String(rawMessage || '');
  if (!text) {
    return [];
  }

  const segments = [];
  const regex = /\[CQ:([a-zA-Z0-9_]+)(?:,([^\]]*))?\]/g;
  let lastIndex = 0;
  let match = regex.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        text: text.slice(lastIndex, match.index),
      });
    }

    const cqType = match[1];
    const params = extractCQParams(match[2] || '');
    if (cqType === 'image') {
      segments.push({
        type: 'image',
        url: params.url || params.file || params.path || '',
        label: params.summary || params.file || 'image',
      });
    } else if (cqType === 'video') {
      segments.push({
        type: 'video',
        url: params.url || params.file || params.path || '',
        coverUrl: params.cover || params.thumb || params.poster || '',
        label: params.summary || params.file || 'video',
      });
    } else if (cqType === 'json') {
      segments.push(summarizeJsonPayload(extractCQParamValue(match[2] || '', 'data')));
    } else if (cqType === 'face') {
      segments.push(toFaceSegment(params.id || params.face_id || params.emoji_id, params.text || params.summary || ''));
    } else if (cqType === 'at') {
      const target = String(params.qq || params.uid || '');
      segments.push({
        type: 'mention',
        targetId: target,
        text: target === 'all' ? '@全体成员' : (target ? `@${target}` : '@某人'),
      });
    } else if (cqType === 'reply') {
      const replyId = String(params.id || params.message_id || params.msg_id || '');
      segments.push({
        type: 'reply',
        replyId,
        text: replyId ? `[回复 #${replyId}]` : '[回复]',
      });
    } else if (cqType === 'forward') {
      const forwardId = String(params.id || params.resid || params.m_resid || '');
      segments.push({
        type: 'forward',
        forwardId,
        text: forwardId ? `[合并转发 #${forwardId}]` : '[合并转发]',
      });
    } else if (cqType === 'node') {
      segments.push({
        type: 'forward',
        forwardId: '',
        text: '[合并转发]',
      });
    } else if (cqType === 'redbag' || cqType === 'red_packet' || cqType === 'hongbao' || cqType === 'wallet' || cqType === 'qqwallet') {
      segments.push(toRedPacketSegment(params, '红包'));
    } else {
      segments.push({
        type: 'text',
        text: `[${cqType}]`,
      });
    }

    lastIndex = match.index + match[0].length;
    match = regex.exec(text);
  }

  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      text: text.slice(lastIndex),
    });
  }

  return segments;
}

function normalizeSegments(payload) {
  if (Array.isArray(payload?.message)) {
    const out = [];
    for (const seg of payload.message) {
      if (!seg || typeof seg !== 'object') {
        continue;
      }
      const segType = String(seg.type || seg?.data?.type || '').trim();
      const elementType = extractElementType(seg);
      if (isRedPacketLikeSegment(seg, segType, elementType)) {
        out.push(toRedPacketSegment(seg?.data || seg, '红包'));
      } else if (segType === 'text') {
        out.push({
          type: 'text',
          text: String(seg?.data?.text || ''),
        });
      } else if (segType === 'image') {
        out.push({
          type: 'image',
          url: String(seg?.data?.url || seg?.data?.file || seg?.data?.path || ''),
          label: String(seg?.data?.summary || seg?.data?.file || 'image'),
        });
      } else if (segType === 'video') {
        out.push({
          type: 'video',
          url: String(seg?.data?.url || seg?.data?.file || seg?.data?.path || ''),
          coverUrl: String(seg?.data?.cover || seg?.data?.thumb || seg?.data?.poster || ''),
          label: String(seg?.data?.summary || seg?.data?.file || 'video'),
        });
      } else if (segType === 'face') {
        out.push(
          toFaceSegment(
            seg?.data?.id || seg?.data?.face_id || seg?.data?.emoji_id,
            seg?.data?.text || seg?.data?.summary || seg?.data?.result || seg?.data?.name || ''
          )
        );
      } else if (segType === 'json') {
        out.push(summarizeJsonPayload(seg?.data?.data || seg?.data?.json || seg?.data?.content || seg?.data?.raw || ''));
      } else if (segType === 'at') {
        const target = String(seg?.data?.qq || seg?.data?.uid || '');
        out.push({
          type: 'mention',
          targetId: target,
          text: target === 'all' ? '@全体成员' : (target ? `@${target}` : '@某人'),
        });
      } else if (segType === 'reply') {
        const replyId = String(seg?.data?.id || seg?.data?.message_id || seg?.data?.msg_id || '');
        out.push({
          type: 'reply',
          replyId,
          text: replyId ? `[回复 #${replyId}]` : '[回复]',
        });
      } else if (segType === 'forward') {
        const forwardId = String(seg?.data?.id || seg?.data?.resid || seg?.data?.m_resid || '');
        out.push({
          type: 'forward',
          forwardId,
          text: forwardId ? `[合并转发 #${forwardId}]` : '[合并转发]',
        });
      } else if (segType === 'node' || segType === 'longmsg') {
        out.push({
          type: 'forward',
          forwardId: '',
          text: segType === 'longmsg' ? '[长消息]' : '[合并转发]',
        });
      } else if (
        segType === 'redbag' ||
        segType === 'red_packet' ||
        segType === 'hongbao' ||
        segType === 'wallet' ||
        segType === 'qqwallet'
      ) {
        out.push(toRedPacketSegment(seg?.data || {}, '红包'));
      } else {
        const fallbackText = String(seg?.data?.text || seg?.data?.content || seg?.data?.summary || '').trim();
        if (fallbackText) {
          out.push({
            type: 'text',
            text: fallbackText,
          });
        } else if (segType) {
          out.push({
            type: 'text',
            text: `[${segType}]`,
          });
        }
      }
    }
    const hasMeaningful = out.some((seg) => {
      if (!seg || typeof seg !== 'object') {
        return false;
      }
      if (seg.type === 'text') {
        return !!String(seg.text || '').trim();
      }
      return true;
    });
    if (out.length > 0 && hasMeaningful) {
      return out;
    }
  }

  // Some clients send red-packet events outside `message` segments (e.g. ElementType=9 only in payload object).
  if (isRedPacketLikePayload(payload)) {
    return [toRedPacketSegment(payload?.data || payload || {}, '红包')];
  }

  const rawMessage = String(payload?.raw_message || payload?.rawMessage || payload?.message || '');
  return parseRawMessage(rawMessage);
}

function toBrief(segments) {
  const parts = [];
  for (const seg of segments) {
    if (seg.type === 'image') {
      parts.push('[图片]');
    } else if (seg.type === 'video') {
      parts.push('[视频]');
    } else if (seg.type === 'face') {
      parts.push(seg.text || `[${seg.label || '表情'}]`);
    } else if (seg.type === 'json') {
      parts.push(seg.title || seg.summary || '[JSON消息]');
    } else if (seg.type === 'forward') {
      parts.push('[合并转发]');
    } else if (seg.type === 'red_packet') {
      parts.push(seg.text || '[红包]');
    } else if (typeof seg.text === 'string') {
      const value = seg.text.trim();
      if (value) {
        parts.push(value);
      }
    }

    if (parts.join(' ').length > 40) {
      break;
    }
  }

  if (parts.length === 0) {
    return '[空消息]';
  }

  return clipText(parts.join(' '), 40);
}

module.exports = {
  clipText,
  decodeCQText,
  normalizeSegments,
  parseRawMessage,
  toBrief,
  toMsTime,
};
