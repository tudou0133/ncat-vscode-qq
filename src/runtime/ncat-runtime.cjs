const vscode = require('vscode');
const WebSocket = require('ws');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { getPrivateAvatarUrl, getGroupAvatarUrl } = require('../core/avatar-utils.cjs');
const { clipText, normalizeSegments, toBrief, toMsTime } = require('../core/message-utils.cjs');
const { persistCacheNow, restoreCachedSessions } = require('./cache-store.cjs');
const { ensureChatSession, refreshContactDirectory, searchDirectoryEntries } = require('./contact-directory.cjs');
const { getDisplayName, rememberDisplayName, resolveDisplayName } = require('./display-names.cjs');
const {
  extractHistoryMessages,
  ingestHistoryMessage,
  loadHistoryForContact,
  loadOlderMessagesForChat,
  loadRecentHistoryOneDay,
  parseRecentContacts,
} = require('./history-loader.cjs');
const { buildLocalEchoSegments, buildOneBotMessage, normalizeOutgoingRequest } = require('./outgoing-message.cjs');
const { decorateSegmentsForDisplay } = require('./segment-decorator.cjs');
const { getForwardPreview } = require('./forward-preview.cjs');

const LOGIN_ECHO_PREFIX = 'vscode-login-';
const HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_STORE_KEY = 'ncat.chatCache.v1';
const BACKEND_START_COOLDOWN_MS = 20_000;
const BACKEND_BOOT_GRACE_MS = 45_000;
const AUTO_RECOVERY_MIN_ATTEMPT = 3;
const IMAGE_FETCH_TIMEOUT_MS = 12_000;
const IMAGE_FETCH_MAX_BYTES = 15 * 1024 * 1024;
const MAX_TOKEN_SCAN_DEPTH = 8;
const MAX_TOKEN_SCAN_FILES = 240;
const TOKEN_FILE_MAX_SIZE = 2 * 1024 * 1024;
const RUNTIME_LOCK_FILE = path.join(os.tmpdir(), 'ncat-vsc.runtime.lock.json');
const HIDDEN_TARGETS_STORE_KEY = 'ncat.hiddenTargets.v1';
const LEGACY_BACKEND_PREFIX = `n${'apcat'}`;
const LEGACY_CONFIG_PREFIX = LEGACY_BACKEND_PREFIX;
const LEGACY_QUICK_LOGIN_EXE = `Nap${'Cat'}WinBootMain.exe`;
const QUICK_LOGIN_EXE_CANDIDATES = [LEGACY_QUICK_LOGIN_EXE, 'NCatWinBootMain.exe'];
const BACKEND_SHELL_DIR_REGEX = new RegExp(`^(?:ncat|${LEGACY_BACKEND_PREFIX})\\..*\\.shell$`, 'i');
const WINDOWS_BACKEND_START_CANDIDATES = [
  `${LEGACY_BACKEND_PREFIX}.bat`,
  `${LEGACY_BACKEND_PREFIX}.quick.bat`,
  `bootmain/${LEGACY_BACKEND_PREFIX}.bat`,
  `bootmain/${LEGACY_BACKEND_PREFIX}.quick.bat`,
];
const UNIX_BACKEND_START_CANDIDATES = [
  `${LEGACY_BACKEND_PREFIX}.sh`,
  `bootmain/${LEGACY_BACKEND_PREFIX}.sh`,
];
const WINDOWS_BACKEND_STOP_CANDIDATES = [
  `${LEGACY_BACKEND_PREFIX}.kill.qq.bat`,
  `bootmain/${LEGACY_BACKEND_PREFIX}.kill.qq.bat`,
];
const UNIX_BACKEND_STOP_CANDIDATES = [
  `${LEGACY_BACKEND_PREFIX}.kill.qq.sh`,
  `bootmain/${LEGACY_BACKEND_PREFIX}.kill.qq.sh`,
];

function isPidAlive(pid) {
  const targetPid = Number(pid);
  if (!Number.isFinite(targetPid) || targetPid <= 0) {
    return false;
  }
  try {
    process.kill(targetPid, 0);
    return true;
  } catch {
    return false;
  }
}

function toActionId(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return raw;
}

function findQuickLoginExecutable(dir) {
  const baseDir = String(dir || '').trim();
  if (!baseDir) {
    return '';
  }
  for (const exeName of QUICK_LOGIN_EXE_CANDIDATES) {
    const fullPath = path.join(baseDir, exeName);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return '';
}

function legacyConfigKey(suffix) {
  return `${LEGACY_CONFIG_PREFIX}.${suffix}`;
}

function parseNumericIdText(rawValue) {
  const raw = String(rawValue || '');
  const seen = new Set();
  const out = [];
  const tokens = raw.split(/[\s,;|/\\]+/g);
  for (const token of tokens) {
    const value = String(token || '').trim();
    if (!/^\d{5,16}$/.test(value)) {
      continue;
    }
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}

function expandEnvPath(input) {
  const raw = String(input || '').trim();
  if (!raw) {
    return '';
  }

  const withWinEnv = raw.replace(/%([^%]+)%/g, (_all, name) => {
    const key = String(name || '').trim();
    if (!key) {
      return '';
    }
    return String(process.env[key] || '');
  });

  const withUnixEnv = withWinEnv.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_all, name) => {
    const key = String(name || '').trim();
    if (!key) {
      return '';
    }
    return String(process.env[key] || '');
  });

  if (withUnixEnv === '~') {
    return os.homedir();
  }
  if (withUnixEnv.startsWith('~/') || withUnixEnv.startsWith('~\\')) {
    return path.join(os.homedir(), withUnixEnv.slice(2));
  }
  return withUnixEnv;
}

function sanitizePotentialToken(value) {
  const token = String(value || '').trim().replace(/^['"]+|['"]+$/g, '');
  if (!token) {
    return '';
  }
  if (token.length < 4) {
    return '';
  }
  return token;
}

function extractTokenFromObject(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 8) {
    return '';
  }
  const directKeys = ['access_token', 'accessToken', 'token', 'accessToken'];
  for (const key of directKeys) {
    if (key in obj) {
      const token = sanitizePotentialToken(obj[key]);
      if (token) {
        return token;
      }
    }
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const token = extractTokenFromObject(item, depth + 1);
      if (token) {
        return token;
      }
    }
    return '';
  }

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value && typeof value === 'object') {
      const token = extractTokenFromObject(value, depth + 1);
      if (token) {
        return token;
      }
    } else if (/token/i.test(key)) {
      const token = sanitizePotentialToken(value);
      if (token) {
        return token;
      }
    }
  }
  return '';
}

function extractTokenFromText(content) {
  const text = String(content || '');
  if (!text.trim()) {
    return '';
  }

  try {
    const parsed = JSON.parse(text);
    const byJson = extractTokenFromObject(parsed);
    if (byJson) {
      return byJson;
    }
  } catch {
    // Ignore JSON parse error and continue with regex.
  }

  const regexList = [
    /"access_token"\s*:\s*"([^"]+)"/i,
    /"accessToken"\s*:\s*"([^"]+)"/i,
    /"token"\s*:\s*"([^"]+)"/i,
    /\baccess_token\s*[:=]\s*["']?([A-Za-z0-9._-]{4,})["']?/i,
    /\btoken\s*[:=]\s*["']?([A-Za-z0-9._-]{4,})["']?/i,
    /\baccess_token=([A-Za-z0-9._-]{4,})/i,
  ];
  for (const regex of regexList) {
    const match = text.match(regex);
    if (match && match[1]) {
      const token = sanitizePotentialToken(match[1]);
      if (token) {
        return token;
      }
    }
  }
  return '';
}

function normalizeHttpUrl(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) {
    return '';
  }
  let candidate = raw;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    candidate = `http://${candidate}`;
  }
  try {
    const parsed = new URL(candidate);
    const protocol = String(parsed.protocol || '').toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

function inferImageMimeFromBuffer(buffer) {
  if (!buffer || buffer.length < 4) {
    return '';
  }
  if (buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a) {
    return 'image/png';
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length >= 6) {
    const sig = buffer.slice(0, 6).toString('ascii');
    if (sig === 'GIF87a' || sig === 'GIF89a') {
      return 'image/gif';
    }
  }
  if (buffer.length >= 12) {
    const riff = buffer.slice(0, 4).toString('ascii');
    const webp = buffer.slice(8, 12).toString('ascii');
    if (riff === 'RIFF' && webp === 'WEBP') {
      return 'image/webp';
    }
  }
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return 'image/bmp';
  }
  if (buffer.length >= 4 && buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00) {
    return 'image/x-icon';
  }
  return '';
}

function fileExtForMime(mime) {
  const value = String(mime || '').toLowerCase().trim();
  if (value === 'image/png') {
    return 'png';
  }
  if (value === 'image/jpeg' || value === 'image/jpg') {
    return 'jpg';
  }
  if (value === 'image/gif') {
    return 'gif';
  }
  if (value === 'image/webp') {
    return 'webp';
  }
  if (value === 'image/bmp') {
    return 'bmp';
  }
  if (value === 'image/x-icon' || value === 'image/vnd.microsoft.icon') {
    return 'ico';
  }
  return 'png';
}

function buildImageFileNameFromUrl(rawUrl, mime) {
  const fallback = `image.${fileExtForMime(mime)}`;
  try {
    const parsed = new URL(String(rawUrl || ''));
    const base = String(parsed.pathname || '').split('/').filter(Boolean).pop() || '';
    const clean = base.replace(/[?#].*$/, '').replace(/[^A-Za-z0-9._-]/g, '_').trim();
    if (!clean) {
      return fallback;
    }
    if (/\.[A-Za-z0-9]{2,6}$/.test(clean)) {
      return clean;
    }
    return `${clean}.${fileExtForMime(mime)}`;
  } catch {
    return fallback;
  }
}

function findValueByKeyRegex(obj, keyRegex, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 8) {
    return '';
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const value = findValueByKeyRegex(item, keyRegex, depth + 1);
      if (value) {
        return value;
      }
    }
    return '';
  }
  for (const [key, value] of Object.entries(obj)) {
    if (keyRegex.test(String(key || ''))) {
      if (value && typeof value === 'object') {
        const nested = findValueByKeyRegex(value, keyRegex, depth + 1);
        if (nested) {
          return nested;
        }
      } else {
        const text = String(value ?? '').trim();
        if (text) {
          return text;
        }
      }
    }
    if (value && typeof value === 'object') {
      const nested = findValueByKeyRegex(value, keyRegex, depth + 1);
      if (nested) {
        return nested;
      }
    }
  }
  return '';
}

function extractBackendWebInfoFromText(content) {
  const text = String(content || '');
  const parsedResult = {
    webUrl: '',
    webToken: '',
  };

  if (!text.trim()) {
    return parsedResult;
  }

  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  if (parsed && typeof parsed === 'object') {
    const urlRaw = findValueByKeyRegex(parsed, /(web|panel|dashboard).*(url|addr|address)/i);
    const hostRaw = findValueByKeyRegex(parsed, /(web|panel|dashboard).*(host|ip)/i);
    const portRaw = findValueByKeyRegex(parsed, /(web|panel|dashboard).*(port|listen)/i);
    const tokenRaw = findValueByKeyRegex(parsed, /(web|panel|dashboard).*(token|passwd|password|auth)/i);

    const url = normalizeHttpUrl(urlRaw);
    if (url) {
      parsedResult.webUrl = url;
    } else if (portRaw) {
      const port = Number.parseInt(String(portRaw || '').trim(), 10);
      if (Number.isFinite(port) && port > 0 && port <= 65535) {
        const host = String(hostRaw || '').trim() || '127.0.0.1';
        parsedResult.webUrl = normalizeHttpUrl(`http://${host}:${port}`) || '';
      }
    }

    const token = sanitizePotentialToken(tokenRaw);
    if (token) {
      parsedResult.webToken = token;
    }
    if (parsedResult.webUrl || parsedResult.webToken) {
      return parsedResult;
    }
  }

  const urlRegexes = [
    /\b(?:web|panel|dashboard)[\w.-]{0,24}(?:url|addr|address)\b[^:=\n\r]*[:=]\s*["']?([^"'\s,\r\n]+)["']?/i,
    /\bhttps?:\/\/[^\s"'<>]+/i,
  ];
  for (const regex of urlRegexes) {
    const match = text.match(regex);
    if (match && match[1]) {
      const url = normalizeHttpUrl(match[1]);
      if (url) {
        parsedResult.webUrl = url;
        break;
      }
    } else if (match && match[0]) {
      const url = normalizeHttpUrl(match[0]);
      if (url) {
        parsedResult.webUrl = url;
        break;
      }
    }
  }

  if (!parsedResult.webUrl) {
    const portMatch = text.match(/\b(?:web|panel|dashboard)[\w.-]{0,24}(?:port|listen)\b[^:=\n\r]*[:=]\s*["']?(\d{2,5})["']?/i);
    if (portMatch && portMatch[1]) {
      const port = Number.parseInt(portMatch[1], 10);
      if (Number.isFinite(port) && port > 0 && port <= 65535) {
        parsedResult.webUrl = `http://127.0.0.1:${port}`;
      }
    }
  }

  const tokenMatch = text.match(/\b(?:web|panel|dashboard)[\w.-]{0,24}(?:token|passwd|password|auth)\b[^:=\n\r]*[:=]\s*["']?([A-Za-z0-9._-]{4,})["']?/i);
  if (tokenMatch && tokenMatch[1]) {
    const token = sanitizePotentialToken(tokenMatch[1]);
    if (token) {
      parsedResult.webToken = token;
    }
  }

  return parsedResult;
}

function extractBackendWebFromLogLine(line) {
  const text = String(line || '').trim();
  if (!text) {
    return {
      webUrl: '',
      webToken: '',
    };
  }
  const markerRegexes = [
    /WebUi\s+User\s+Panel\s+Url\s*:\s*(https?:\/\/[^\s]+)/i,
    /\bWebUi\b.*\bUrl\b\s*:\s*(https?:\/\/[^\s]+)/i,
    /\bwebui\b[^\n\r]*?(https?:\/\/[^\s]+)/i,
  ];
  for (const regex of markerRegexes) {
    const match = text.match(regex);
    if (!match || !match[1]) {
      continue;
    }
    try {
      const parsed = new URL(match[1]);
      const token = String(parsed.searchParams.get('token') || parsed.searchParams.get('access_token') || '').trim();
      parsed.searchParams.delete('token');
      parsed.searchParams.delete('access_token');
      return {
        webUrl: normalizeHttpUrl(parsed.toString()),
        webToken: sanitizePotentialToken(token),
      };
    } catch {
      return {
        webUrl: normalizeHttpUrl(match[1]),
        webToken: '',
      };
    }
  }
  return {
    webUrl: '',
    webToken: '',
  };
}

function backendWebUrlRank(urlText) {
  const normalized = normalizeHttpUrl(urlText);
  if (!normalized) {
    return 0;
  }
  try {
    const parsed = new URL(normalized);
    const host = String(parsed.hostname || '').toLowerCase();
    if (host === '127.0.0.1' || host === 'localhost') {
      return 4;
    }
    if (host === '::1') {
      return 3;
    }
    if (host === '::' || host === '[::]') {
      return 1;
    }
    return 2;
  } catch {
    return 0;
  }
}

function normalizeWebUrlForAccess(rawValue, fallbackPath = '/webui') {
  const normalized = normalizeHttpUrl(rawValue);
  if (!normalized) {
    return '';
  }
  try {
    const parsed = new URL(normalized);
    const pathName = String(parsed.pathname || '').trim();
    if (!pathName || pathName === '/') {
      parsed.pathname = fallbackPath;
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString();
    }
    return parsed.toString();
  } catch {
    return normalized;
  }
}

function extractListFromApiData(data) {
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.list)) {
    return data.list;
  }
  if (Array.isArray(data?.data)) {
    return data.data;
  }
  return [];
}

function resolveDisplayNameOrId(runtime, userId, groupId = '') {
  const uid = String(userId || '').trim();
  if (!uid) {
    return '';
  }
  if (uid === String(runtime.selfUserId || '').trim()) {
    return String(runtime.selfNickname || '你');
  }
  return runtime.getDisplayName(uid, groupId) || runtime.getDisplayName(uid) || `QQ ${uid}`;
}

function normalizePokeNotice(payload) {
  const noticeType = String(payload?.notice_type || '').toLowerCase();
  const subType = String(payload?.sub_type || '').toLowerCase();
  if (noticeType !== 'notify' || subType !== 'poke') {
    return null;
  }

  const groupId = String(payload?.group_id || payload?.groupId || '').trim();
  const actorId = String(payload?.operator_id || payload?.user_id || payload?.sender_id || '').trim();
  const targetId = String(payload?.target_id || payload?.targetId || '').trim();
  return {
    groupId,
    actorId,
    targetId,
    noticeType,
    subType,
  };
}

function normalizeRecallNotice(payload) {
  const noticeType = String(payload?.notice_type || '').toLowerCase();
  if (noticeType !== 'group_recall' && noticeType !== 'friend_recall') {
    return null;
  }

  const isGroup = noticeType === 'group_recall';
  const groupId = String(payload?.group_id || payload?.groupId || '').trim();
  const userId = String(payload?.user_id || payload?.sender_id || payload?.senderId || '').trim();
  const operatorId = String(payload?.operator_id || payload?.operatorId || userId).trim();
  const messageId = String(payload?.message_id || payload?.messageId || '').trim();
  const targetId = isGroup ? groupId : (userId || operatorId);
  return {
    noticeType,
    isGroup,
    groupId,
    userId,
    operatorId,
    messageId,
    targetId,
  };
}

function buildPokeDedupeKey(chatType, chatTargetId, actorId, targetId) {
  return [
    String(chatType || ''),
    String(chatTargetId || ''),
    String(actorId || ''),
    String(targetId || ''),
  ].join('|');
}

function sanitizeReplyPreviewText(text) {
  const value = String(text || '').trim();
  if (!value || value === '[空消息]') {
    return '';
  }
  return value;
}

function sanitizeRedPacketTitle(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) {
    return '';
  }
  if (value.length > 80) {
    return clipText(value, 80);
  }
  return value;
}

function normalizeAmountLabel(rawValue, keyName = '') {
  if (rawValue === null || rawValue === undefined) {
    return '';
  }
  const key = String(keyName || '').toLowerCase();
  const raw = String(rawValue).trim();
  if (!raw) {
    return '';
  }

  const numericMatch = raw.match(/-?\d+(?:\.\d+)?/);
  if (!numericMatch) {
    return '';
  }
  const numeric = Number(numericMatch[0]);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return '';
  }

  let amount = numeric;
  if ((key.includes('cent') || key.includes('fen')) && Number.isInteger(numeric)) {
    amount = numeric / 100;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return '';
  }
  return `￥${amount.toFixed(amount >= 100 ? 0 : 2).replace(/\.00$/, '')}`;
}

function extractRedPacketMetaFromObject(input, depth = 0) {
  if (!input || depth > 8) {
    return { title: '', amount: '' };
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      const nested = extractRedPacketMetaFromObject(item, depth + 1);
      if (nested.title || nested.amount) {
        return nested;
      }
    }
    return { title: '', amount: '' };
  }

  if (typeof input !== 'object') {
    return { title: '', amount: '' };
  }

  const titleKeyRegex = /(title|desc|summary|prompt|word|wishing|bless|remark|memo|content|text|name|caption|label|hint|tips|红包|口令)/i;
  const amountKeyRegex = /(amount|money|cash|fee|price|value|sum|total|红包金额|金额|cent|fen)/i;

  let title = '';
  let amount = '';
  for (const [key, value] of Object.entries(input)) {
    if (!title && typeof value === 'string' && titleKeyRegex.test(key)) {
      const candidate = sanitizeRedPacketTitle(value);
      if (candidate && !/^\[?未实现/i.test(candidate)) {
        title = candidate;
      }
    }
    if (!amount && (typeof value === 'string' || typeof value === 'number') && amountKeyRegex.test(key)) {
      amount = normalizeAmountLabel(value, key);
    }
  }
  if (title || amount) {
    return { title, amount };
  }

  for (const value of Object.values(input)) {
    if (!value || typeof value !== 'object') {
      continue;
    }
    const nested = extractRedPacketMetaFromObject(value, depth + 1);
    if (nested.title || nested.amount) {
      return nested;
    }
  }
  return { title: '', amount: '' };
}

function buildFallbackRedPacketSegment(payload, backendHint = null) {
  const fromPayload = extractRedPacketMetaFromObject(payload || {});
  const hintTitle = sanitizeRedPacketTitle(backendHint?.title || '');
  const hintAmount = normalizeAmountLabel(backendHint?.amount || '', 'amount');
  const title = fromPayload.title || hintTitle || '红包';
  const amount = fromPayload.amount || hintAmount || '';

  const textParts = ['[红包]'];
  if (title && title !== '红包') {
    textParts.push(clipText(title, 56));
  }
  if (amount) {
    textParts.push(amount);
  }
  return {
    type: 'red_packet',
    title,
    text: textParts.join(' ').trim(),
  };
}

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

function formatReplyLabel(replyId, refName, refPreview) {
  const name = String(refName || '').trim();
  const preview = sanitizeReplyPreviewText(refPreview);
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

class NCatRuntime {
  constructor(context) {
    this.context = context;
    this.ws = null;
    this.seq = 0;
    this.pollTimer = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.pendingRequests = new Map();
    this.connectionState = 'offline';
    this.manualDisconnect = false;
    this.disposed = false;
    this.selfUserId = '';
    this.selfNickname = 'Me';
    this.chatSessions = new Map();
    this.uiListeners = new Set();
    this.persistTimer = null;
    this.historyLoadInFlight = null;
    this.historyLoadedForConnection = false;
    this.historyIngestEpoch = 0;
    this.userDisplayNameCache = new Map();
    this.groupMemberNameCache = new Map();
    this.pendingNameLookups = new Map();
    this.contactDirectory = new Map();
    this.contactDirectoryLoaded = false;
    this.contactDirectoryLoading = null;
    this.groupMembersByGroupId = new Map();
    this.groupMembersLoading = new Map();
    this.hiddenPrivateTargets = new Set();
    this.hiddenGroupTargets = new Set();
    this.recentOutgoingPokes = [];
    this.backendProcess = null;
    this.backendLastLaunchAt = 0;
    this.backendStarting = null;
    this.backendLastLaunchFile = '';
    this.backendManagedActive = false;
    this.backendAttachedExisting = false;
    this.backendManualMode = false;
    this.backendLastWsReadyAt = 0;
    this.backendUnsupportedHints = new Map();
    this.mediaRetryNoRetryIds = new Set();
    this.detectedBackendWebUrl = '';
    this.detectedBackendWebToken = '';
    this.runtimeActive = true;
    this.runtimeBlockedByOther = false;
    this.runtimeBlockedOwnerPid = 0;
    this.runtimeLock = {
      filePath: RUNTIME_LOCK_FILE,
      token: '',
      acquired: false,
    };

    this.output = vscode.window.createOutputChannel('NCat VSC');
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBar.command = 'ncat.connect';
    this.statusBar.text = '$(plug) NCat: Offline';
    this.statusBar.tooltip = 'Click to connect NCat';
    this.statusBar.show();
    this.restoreHiddenTargets();
    this.log('Runtime initialized.');
    restoreCachedSessions(this, CACHE_STORE_KEY);
  }

  onUiState(listener) {
    this.uiListeners.add(listener);
    return new vscode.Disposable(() => {
      this.uiListeners.delete(listener);
    });
  }

  emitUiUpdate() {
    for (const listener of this.uiListeners) {
      try {
        listener();
      } catch (error) {
        this.log(`UI listener error: ${error?.message || String(error)}`);
      }
    }
  }

  buildRuntimeLockPayload() {
    return {
      pid: process.pid,
      token: `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
      createdAt: new Date().toISOString(),
    };
  }

  tryAcquireRuntimeLock() {
    if (this.runtimeLock.acquired && this.runtimeLock.token) {
      return {
        ok: true,
        skipped: true,
      };
    }

    const payload = this.buildRuntimeLockPayload();
    const writeLock = () => {
      const fd = fs.openSync(this.runtimeLock.filePath, 'wx');
      try {
        fs.writeFileSync(fd, JSON.stringify(payload), 'utf8');
      } finally {
        fs.closeSync(fd);
      }
      this.runtimeLock.token = payload.token;
      this.runtimeLock.acquired = true;
      return {
        ok: true,
      };
    };

    try {
      return writeLock();
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        return {
          ok: false,
          ownerPid: 0,
          reason: error?.message || String(error),
        };
      }
    }

    let existingPid = 0;
    try {
      const raw = fs.readFileSync(this.runtimeLock.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      existingPid = Number(parsed?.pid || 0);
    } catch {
      existingPid = 0;
    }

    if (existingPid > 0 && isPidAlive(existingPid)) {
      return {
        ok: false,
        ownerPid: existingPid,
        reason: 'runtime-lock-busy',
      };
    }

    try {
      fs.unlinkSync(this.runtimeLock.filePath);
    } catch {
      // Ignore stale lock cleanup errors.
    }

    try {
      return writeLock();
    } catch (error) {
      return {
        ok: false,
        ownerPid: existingPid,
        reason: error?.message || String(error),
      };
    }
  }

  releaseRuntimeLock() {
    if (!this.runtimeLock.acquired || !this.runtimeLock.token) {
      return;
    }
    try {
      if (fs.existsSync(this.runtimeLock.filePath)) {
        const content = fs.readFileSync(this.runtimeLock.filePath, 'utf8');
        let parsed = null;
        try {
          parsed = JSON.parse(content);
        } catch {
          parsed = null;
        }
        if (!parsed || parsed.token === this.runtimeLock.token) {
          fs.unlinkSync(this.runtimeLock.filePath);
        }
      }
    } catch {
      // Ignore runtime lock release errors.
    } finally {
      this.runtimeLock.token = '';
      this.runtimeLock.acquired = false;
    }
  }

  ensureRuntimeActive(options = {}) {
    const silent = options.silent === true;
    if (!this.runtimeActive) {
      return {
        ok: false,
        reason: 'runtime-stopped',
        ownerPid: 0,
      };
    }

    const lockResult = this.tryAcquireRuntimeLock();
    if (lockResult.ok) {
      if (this.runtimeBlockedByOther || this.runtimeBlockedOwnerPid) {
        this.runtimeBlockedByOther = false;
        this.runtimeBlockedOwnerPid = 0;
        this.emitUiUpdate();
      }
      return {
        ok: true,
        reason: lockResult.skipped ? 'lock-owned' : 'lock-acquired',
        ownerPid: 0,
      };
    }

    this.runtimeBlockedByOther = true;
    this.runtimeBlockedOwnerPid = Number(lockResult.ownerPid || 0);
    this.connectionState = 'offline';
    this.emitUiUpdate();
    const ownerText = this.runtimeBlockedOwnerPid ? `（PID ${this.runtimeBlockedOwnerPid}）` : '';
    this.log(`runtime start blocked: another window is running${ownerText}`);
    if (!silent) {
      vscode.window.showWarningMessage(`另一个 VS Code 窗口的 NCat 插件正在运行${ownerText}。当前窗口启动无效。`);
    }
    return {
      ok: false,
      reason: 'runtime-lock-busy',
      ownerPid: this.runtimeBlockedOwnerPid,
    };
  }

  async startPluginRuntime(options = {}) {
    const silent = options.silent === true;
    const reason = String(options.reason || 'runtime-start');
    this.runtimeActive = true;
    this.backendManualMode = false;
    this.manualDisconnect = false;

    const activeResult = this.ensureRuntimeActive({ silent });
    if (!activeResult.ok) {
      this.runtimeActive = false;
      this.statusBar.text = '$(circle-large-outline) NCat: Stopped';
      this.statusBar.tooltip = 'Plugin not running in current window';
      this.emitUiUpdate();
      return activeResult;
    }

    await this.connect({
      silent,
      reason,
    });
    return {
      ok: true,
      reason: 'started',
    };
  }

  async stopPluginRuntime(options = {}) {
    const trigger = String(options.trigger || 'runtime-stop');
    this.runtimeActive = false;
    this.runtimeBlockedByOther = false;
    this.runtimeBlockedOwnerPid = 0;

    const result = await this.stopBackend({
      trigger,
      disconnectSocket: true,
      enterManualMode: true,
      config: options.config,
    });
    this.releaseRuntimeLock();
    this.connectionState = 'offline';
    this.statusBar.text = '$(circle-large-outline) NCat: Stopped';
    this.statusBar.tooltip = 'Plugin not running in current window';
    this.emitUiUpdate();
    return result;
  }

  getMaxMessagesPerChat() {
    const config = vscode.workspace.getConfiguration();
    const value = Number(config.get('ncat.maxMessagesPerChat', 500));
    if (Number.isNaN(value)) {
      return 500;
    }
    return Math.max(50, Math.min(2000, Math.floor(value)));
  }

  getWorkspaceRoot() {
    const firstFolder = Array.isArray(vscode.workspace.workspaceFolders)
      ? vscode.workspace.workspaceFolders[0]
      : null;
    if (firstFolder?.uri?.fsPath) {
      return firstFolder.uri.fsPath;
    }
    return this.context?.extensionPath || process.cwd();
  }

  async maybeAutoStartBackendOnActivate() {
    if (this.disposed || this.backendManualMode || !this.runtimeActive) {
      return;
    }
    const config = vscode.workspace.getConfiguration();
    const rootDir = this.resolveNCatRootDir(config);
    if (!rootDir) {
      return;
    }
    const result = await this.startBackend({
      force: false,
      trigger: 'activate-auto-start',
      config,
    });
    if (!result?.ok) {
      this.log(`activate auto-start skipped: ${result?.reason || 'unknown reason'}`);
    }
  }

  resolveAbsolutePath(rawPath, baseDir = '') {
    const expanded = expandEnvPath(rawPath);
    if (!expanded) {
      return '';
    }
    if (path.isAbsolute(expanded)) {
      return path.normalize(expanded);
    }
    const base = baseDir || this.getWorkspaceRoot();
    return path.normalize(path.resolve(base, expanded));
  }

  resolveNCatRootDir(config) {
    const configured = String(config.get('ncat.rootDir', '') || '').trim()
      || String(config.get(legacyConfigKey('rootDir'), '') || '').trim();
    if (!configured) {
      return '';
    }
    return this.resolveAbsolutePath(configured, this.getWorkspaceRoot());
  }

  resolveTokenFilePath(config, rootDir) {
    const tokenFile = String(config.get('ncat.tokenFile', '') || '').trim()
      || String(config.get(legacyConfigKey('tokenFile'), '') || '').trim();
    if (!tokenFile) {
      return '';
    }
    return this.resolveAbsolutePath(tokenFile, rootDir || this.getWorkspaceRoot());
  }

  resolveQuickLoginUin(config) {
    const raw = String(config.get('ncat.quickLoginUin', '') || '').trim()
      || String(config.get(legacyConfigKey('quickLoginUin'), '') || '').trim();
    if (!raw) {
      return '';
    }
    const normalized = raw.replace(/\s+/g, '');
    if (!/^\d{5,16}$/.test(normalized)) {
      this.log(`Quick login UIN ignored: invalid value (${raw})`);
      return '';
    }
    return normalized;
  }

  safeReadTextFile(filePath) {
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) {
        return '';
      }
      if (stat.size > TOKEN_FILE_MAX_SIZE) {
        return '';
      }
      return fs.readFileSync(filePath, 'utf8');
    } catch {
      return '';
    }
  }

  listTokenCandidateFiles(rootDir) {
    const out = [];
    const seen = new Set();
    const pushFile = (filePath) => {
      const value = String(filePath || '').trim();
      if (!value || seen.has(value)) {
        return;
      }
      seen.add(value);
      out.push(value);
    };

    if (!rootDir || !fs.existsSync(rootDir)) {
      return out;
    }

    const known = [
      path.join(rootDir, 'config', 'onebot11.json'),
      path.join(rootDir, 'config', 'onebot11.yaml'),
      path.join(rootDir, 'config', 'onebot11.yml'),
      path.join(rootDir, 'config', 'ncat.json'),
      path.join(rootDir, 'config', `${LEGACY_CONFIG_PREFIX}.json`),
      path.join(rootDir, 'config', 'config.json'),
      path.join(rootDir, 'ncat.json'),
      path.join(rootDir, `${LEGACY_CONFIG_PREFIX}.json`),
      path.join(rootDir, 'config.json'),
    ];
    for (const filePath of known) {
      if (fs.existsSync(filePath)) {
        pushFile(filePath);
      }
    }

    const stack = [{ dir: rootDir, depth: 0 }];
    let scannedFiles = 0;
    while (stack.length > 0 && scannedFiles < MAX_TOKEN_SCAN_FILES) {
      const current = stack.pop();
      if (!current || current.depth > MAX_TOKEN_SCAN_DEPTH) {
        continue;
      }

      let entries;
      try {
        entries = fs.readdirSync(current.dir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (scannedFiles >= MAX_TOKEN_SCAN_FILES) {
          break;
        }
        const fullPath = path.join(current.dir, entry.name);
        if (entry.isDirectory()) {
          const lowerName = entry.name.toLowerCase();
          if (lowerName === 'node_modules' || lowerName === '.git') {
            continue;
          }
          stack.push({ dir: fullPath, depth: current.depth + 1 });
          continue;
        }
        if (!entry.isFile()) {
          continue;
        }

        const lowerPath = fullPath.toLowerCase();
        const matchedExt = /\.(json|ya?ml|toml|ini|conf|txt)$/.test(lowerPath);
        if (!matchedExt) {
          continue;
        }
        const tokenPathRegex = new RegExp(`(token|onebot|ncat|config|ws|${LEGACY_CONFIG_PREFIX})`);
        if (!tokenPathRegex.test(lowerPath)) {
          continue;
        }

        pushFile(fullPath);
        scannedFiles += 1;
      }
    }

    return out;
  }

  findTokenFromFile(filePath) {
    const fullPath = String(filePath || '').trim();
    if (!fullPath || !fs.existsSync(fullPath)) {
      return null;
    }
    const content = this.safeReadTextFile(fullPath);
    if (!content) {
      return null;
    }
    const token = extractTokenFromText(content);
    if (!token) {
      return null;
    }
    return {
      token,
      filePath: fullPath,
    };
  }

  findTokenFromRoot(config, rootDir) {
    const explicitTokenFile = this.resolveTokenFilePath(config, rootDir);
    if (explicitTokenFile) {
      const explicit = this.findTokenFromFile(explicitTokenFile);
      if (explicit) {
        this.log(`Token auto-read hit explicit token file: ${explicit.filePath}`);
        return explicit;
      }
      this.log(`Token auto-read: configured token file has no token (${explicitTokenFile}).`);
    }

    const candidates = this.listTokenCandidateFiles(rootDir);
    this.log(
      `Token auto-read scan: root=${rootDir}, explicitTokenFile=${explicitTokenFile || '(none)'}, candidates=${candidates.length}`
    );
    if (candidates.length > 0) {
      const preview = candidates.slice(0, 8).join(' | ');
      this.log(
        `Token auto-read candidates: ${preview}${candidates.length > 8 ? ' | ...' : ''}`
      );
    }
    for (const filePath of candidates) {
      const result = this.findTokenFromFile(filePath);
      if (result) {
        this.log(`Token auto-read hit: ${result.filePath}`);
        return result;
      }
    }
    this.log(`Token auto-read miss: no token found from ${candidates.length} candidate files.`);
    return null;
  }

  collectBackendLaunchCandidates(config, rootDir) {
    const candidates = [];
    const seen = new Set();
    const pushCandidate = (candidatePath) => {
      const full = String(candidatePath || '').trim();
      if (!full) {
        return;
      }
      const normalized = path.normalize(full);
      if (seen.has(normalized)) {
        return;
      }
      if (!fs.existsSync(normalized)) {
        return;
      }
      seen.add(normalized);
      candidates.push(normalized);
    };

    if (!rootDir || !fs.existsSync(rootDir)) {
      return candidates;
    }

    const directCandidates = process.platform === 'win32'
      ? WINDOWS_BACKEND_START_CANDIDATES
      : UNIX_BACKEND_START_CANDIDATES;
    for (const relativePath of directCandidates) {
      pushCandidate(path.join(rootDir, relativePath));
    }

    const rootBase = path.basename(rootDir);
    const maybeShellDir = BACKEND_SHELL_DIR_REGEX.test(rootBase);
    if (maybeShellDir) {
      const parent = path.dirname(rootDir);
      for (const relativePath of directCandidates) {
        pushCandidate(path.join(parent, relativePath));
      }
    }

    let entries = [];
    try {
      entries = fs.readdirSync(rootDir, { withFileTypes: true });
    } catch {
      return candidates;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (!BACKEND_SHELL_DIR_REGEX.test(entry.name)) {
        continue;
      }
      const shellDir = path.join(rootDir, entry.name);
      const shellCandidates = process.platform === 'win32'
        ? WINDOWS_BACKEND_START_CANDIDATES
        : UNIX_BACKEND_START_CANDIDATES;
      for (const relativePath of shellCandidates) {
        pushCandidate(path.join(shellDir, relativePath));
      }
    }

    return candidates;
  }

  collectQuickLaunchDirsFromScripts(scriptPaths) {
    const dirs = [];
    const seen = new Set();
    const list = Array.isArray(scriptPaths) ? scriptPaths : [];
    for (const scriptPath of list) {
      const dir = path.normalize(path.dirname(String(scriptPath || '').trim()));
      if (!dir || seen.has(dir)) {
        continue;
      }
      const bootMainExe = findQuickLoginExecutable(dir);
      if (!fs.existsSync(bootMainExe)) {
        continue;
      }
      seen.add(dir);
      dirs.push(dir);
    }
    return dirs;
  }

  detectExistingBackendProcess(rootDir, trigger = '') {
    if (process.platform !== 'win32') {
      return Promise.resolve({
        found: false,
        pid: 0,
        reason: 'unsupported-platform',
      });
    }

    const rootLower = String(path.normalize(rootDir || '') || '').toLowerCase().replace(/'/g, "''");
    const psScript = [
      `$root='${rootLower}';`,
      "$targets = Get-CimInstance Win32_Process -Filter \"Name='QQ.exe'\" | Where-Object {",
      "  $cl = [string]$_.CommandLine;",
      "  if (-not $cl) { return $false }",
      "  $lower = $cl.ToLowerInvariant();",
      "  if (-not $lower.Contains('--enable-logging')) { return $false }",
      "  if ($root -and -not $lower.Contains($root)) { return $false }",
      "  return $true;",
      "};",
      "$first = $targets | Select-Object -First 1;",
      "if ($first) { Write-Output $first.ProcessId }",
    ].join(' ');

    return new Promise((resolve) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
        windowsHide: true,
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdoutText = '';
      let stderrText = '';
      child.stdout?.on('data', (chunk) => {
        stdoutText += String(chunk || '');
      });
      child.stderr?.on('data', (chunk) => {
        stderrText += String(chunk || '');
      });

      child.once('error', (error) => {
        const reason = error?.message || String(error);
        this.log(`detect existing backend failed: trigger=${trigger}, reason=${reason}`);
        resolve({
          found: false,
          pid: 0,
          reason,
        });
      });

      child.once('exit', (code) => {
        if (code !== 0) {
          const reason = String(stderrText || `exit code ${code}`).trim();
          this.log(`detect existing backend warning: trigger=${trigger}, reason=${reason}`);
          resolve({
            found: false,
            pid: 0,
            reason,
          });
          return;
        }

        const match = String(stdoutText || '').match(/\b(\d{2,})\b/);
        const pid = match ? Number.parseInt(match[1], 10) : 0;
        if (Number.isFinite(pid) && pid > 0) {
          resolve({
            found: true,
            pid,
            reason: '',
          });
          return;
        }
        resolve({
          found: false,
          pid: 0,
          reason: '',
        });
      });
    });
  }

  collectBackendStopCandidates(config, rootDir) {
    const candidates = [];
    const seen = new Set();
    const pushCandidate = (candidatePath) => {
      const full = String(candidatePath || '').trim();
      if (!full) {
        return;
      }
      const normalized = path.normalize(full);
      if (seen.has(normalized)) {
        return;
      }
      if (!fs.existsSync(normalized)) {
        return;
      }
      seen.add(normalized);
      candidates.push(normalized);
    };

    const stopNames = process.platform === 'win32'
      ? WINDOWS_BACKEND_STOP_CANDIDATES
      : UNIX_BACKEND_STOP_CANDIDATES;

    const explicitStopScript = String(config.get('ncat.backendStopScript', '') || '').trim();
    if (explicitStopScript) {
      const explicitPath = this.resolveAbsolutePath(explicitStopScript, rootDir || this.getWorkspaceRoot());
      if (explicitPath && fs.existsSync(explicitPath)) {
        pushCandidate(explicitPath);
      } else {
        this.log(`Backend stop script not found: ${explicitPath || explicitStopScript}`);
      }
    }

    if (!rootDir || !fs.existsSync(rootDir)) {
      return candidates;
    }

    for (const relativePath of stopNames) {
      pushCandidate(path.join(rootDir, relativePath));
    }

    const rootBase = path.basename(rootDir);
    const maybeShellDir = BACKEND_SHELL_DIR_REGEX.test(rootBase);
    if (maybeShellDir) {
      const parent = path.dirname(rootDir);
      for (const relativePath of stopNames) {
        pushCandidate(path.join(parent, relativePath));
      }
    }

    let entries = [];
    try {
      entries = fs.readdirSync(rootDir, { withFileTypes: true });
    } catch {
      return candidates;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (!BACKEND_SHELL_DIR_REGEX.test(entry.name)) {
        continue;
      }
      const shellDir = path.join(rootDir, entry.name);
      for (const relativePath of stopNames) {
        pushCandidate(path.join(shellDir, relativePath));
      }
    }

    return candidates;
  }

  spawnBackendControlScript(scriptPath, trigger, label = 'backend-control', options = {}) {
    return new Promise((resolve) => {
      const done = (result) => {
        resolve(result);
      };

      const autoInputs = Array.isArray(options?.autoInputs)
        ? options.autoInputs.map((item) => String(item || '')).filter(Boolean)
        : [];
      let child;
      try {
        if (process.platform === 'win32' && /\.(bat|cmd)$/i.test(scriptPath)) {
          child = spawn(scriptPath, [], {
            cwd: path.dirname(scriptPath),
            windowsHide: true,
            detached: false,
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
        } else {
          child = spawn(scriptPath, [], {
            cwd: path.dirname(scriptPath),
            windowsHide: true,
            detached: false,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
        }
      } catch (error) {
        done({
          ok: false,
          reason: error?.message || String(error),
        });
        return;
      }

      this.log(`${label} requested: trigger=${trigger}, script=${scriptPath}, pid=${child.pid || 'unknown'}`);

      const logChunk = (kind, data) => {
        const text = String(data || '').trim();
        if (!text) {
          return;
        }
        const lines = text.split(/\r?\n/).slice(0, 4);
        for (const line of lines) {
          const value = String(line || '').trim();
          if (value) {
            this.log(`${label} ${kind}: ${value}`);
          }
        }
      };
      child.stdout?.on('data', (chunk) => logChunk('stdout', chunk.toString()));
      child.stderr?.on('data', (chunk) => logChunk('stderr', chunk.toString()));

      let settled = false;
      const finish = (result) => {
        if (settled) {
          return;
        }
        settled = true;
        done(result);
      };

      if (autoInputs.length > 0 && child.stdin) {
        let delay = 140;
        for (const input of autoInputs) {
          setTimeout(() => {
            if (settled || !child.stdin || child.stdin.destroyed || !child.stdin.writable) {
              return;
            }
            try {
              child.stdin.write(input);
              this.log(`${label} stdin: ${JSON.stringify(input)}`);
            } catch (error) {
              this.log(`${label} stdin write failed: ${error?.message || String(error)}`);
            }
          }, delay);
          delay += 360;
        }
        setTimeout(() => {
          if (settled || !child.stdin || child.stdin.destroyed) {
            return;
          }
          try {
            child.stdin.end();
          } catch {
            // Ignore.
          }
        }, delay + 220);
      }

      child.once('error', (error) => {
        finish({
          ok: false,
          reason: error?.message || String(error),
        });
      });

      child.once('exit', (code, signal) => {
        this.log(`${label} exit: script=${scriptPath}, code=${code ?? 'null'}, signal=${signal || ''}`);
        if (!settled) {
          if (code === 0 || code === null) {
            finish({
              ok: true,
            });
          } else {
            finish({
              ok: false,
              reason: `exit code ${code}`,
            });
          }
        }
      });

      setTimeout(() => {
        finish({
          ok: true,
        });
      }, 3000);
    });
  }

  async killResidualWindowsBatchWrappers(rootDir, trigger = '') {
    if (process.platform !== 'win32') {
      return {
        ok: false,
        skipped: true,
        killed: 0,
      };
    }

    const rootLower = String(path.normalize(rootDir || '') || '').toLowerCase().replace(/'/g, "''");
    const psScript = [
      `$root='${rootLower}';`,
      `$patterns=@('${LEGACY_BACKEND_PREFIX}.quick.bat','${LEGACY_BACKEND_PREFIX}.bat','${LEGACY_BACKEND_PREFIX}.kill.qq.bat');`,
      "$targets = Get-CimInstance Win32_Process -Filter \"Name='cmd.exe'\" | Where-Object {",
      "  $cl = [string]$_.CommandLine;",
      "  if (-not $cl) { return $false }",
      "  $lower = $cl.ToLowerInvariant();",
      "  $rootOk = ($root -eq '') -or $lower.Contains($root);",
      "  $patOk = ($patterns | Where-Object { $lower.Contains($_) } | Measure-Object).Count -gt 0;",
      "  return ($rootOk -and $patOk);",
      "};",
      "$k = 0;",
      "foreach ($p in $targets) {",
      "  try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; $k++; } catch {}",
      "}",
      "Write-Output $k;",
    ].join(' ');

    return new Promise((resolve) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
        windowsHide: true,
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdoutText = '';
      let stderrText = '';
      child.stdout?.on('data', (chunk) => {
        stdoutText += String(chunk || '');
      });
      child.stderr?.on('data', (chunk) => {
        stderrText += String(chunk || '');
      });

      child.once('error', (error) => {
        const reason = error?.message || String(error);
        this.log(`cleanup wrappers error: trigger=${trigger}, reason=${reason}`);
        resolve({
          ok: false,
          killed: 0,
          reason,
        });
      });

      child.once('exit', (code) => {
        const killed = Number.parseInt(String(stdoutText || '').trim(), 10);
        const killedCount = Number.isFinite(killed) ? killed : 0;
        if (code === 0) {
          this.log(`cleanup wrappers done: trigger=${trigger}, killed=${killedCount}`);
          resolve({
            ok: true,
            killed: killedCount,
            reason: '',
          });
          return;
        }
        const reason = String(stderrText || `exit code ${code}`).trim();
        this.log(`cleanup wrappers failed: trigger=${trigger}, reason=${reason}`);
        resolve({
          ok: false,
          killed: killedCount,
          reason,
        });
      });
    });
  }

  spawnBackendQuickLogin(launchDir, quickLoginUin, trigger) {
    return new Promise((resolve) => {
      const done = (result) => {
        resolve(result);
      };

      const uin = String(quickLoginUin || '').trim();
      if (!/^\d{5,16}$/.test(uin)) {
        done({
          ok: false,
          reason: `invalid quick login uin: ${quickLoginUin}`,
        });
        return;
      }

      const bootMainExe = path.join(launchDir, 'NapCatWinBootMain.exe');
      if (!fs.existsSync(bootMainExe)) {
        done({
          ok: false,
          reason: `NapCatWinBootMain.exe not found under ${launchDir}`,
        });
        return;
      }

      let child;
      try {
        child = spawn('cmd.exe', ['/d', '/s', '/c', `chcp 65001>nul & .\\NapCatWinBootMain.exe ${uin} & pause`], {
          cwd: launchDir,
          windowsHide: true,
          detached: false,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (error) {
        const reason = error?.message || String(error);
        this.log(`startBackend quick spawn failed: dir=${launchDir}, reason=${reason}`);
        done({
          ok: false,
          reason,
        });
        return;
      }

      this.backendProcess = child;
      this.backendLastLaunchAt = Date.now();
      this.backendLastLaunchFile = `${bootMainExe} ${uin}`;
      this.backendAttachedExisting = false;
      this.log(
        `NCat backend quick launch requested: trigger=${trigger}, uin=${uin}, dir=${launchDir}, pid=${child.pid || 'unknown'}`
      );

      const logChunk = (kind, data) => {
        const text = String(data || '').trim();
        if (!text) {
          return;
        }
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
          const value = String(line || '').trim();
          if (value) {
            this.ingestBackendWebLogLine(value);
          }
        }
        const previewLines = lines.slice(0, 4);
        for (const line of previewLines) {
          const value = String(line || '').trim();
          if (value) {
            this.log(`backend ${kind}: ${value}`);
          }
        }
      };

      if (child.stdout) {
        child.stdout.on('data', (chunk) => {
          logChunk('stdout', chunk.toString());
        });
      }
      if (child.stderr) {
        child.stderr.on('data', (chunk) => {
          logChunk('stderr', chunk.toString());
        });
      }

      let settled = false;
      const finish = (result) => {
        if (settled) {
          return;
        }
        settled = true;
        done(result);
      };

      child.once('error', (error) => {
        const reason = error?.message || String(error);
        this.log(`NCat backend quick process error: dir=${launchDir}, reason=${reason}`);
        if (this.backendProcess === child) {
          this.backendProcess = null;
        }
        finish({
          ok: false,
          reason,
        });
      });

      child.once('exit', (code, signal) => {
        if (this.backendProcess === child) {
          this.backendProcess = null;
        }
        this.log(`NCat backend quick process exit: dir=${launchDir}, code=${code ?? 'null'}, signal=${signal || ''}`);
        if (!settled) {
          if (code === 0 || code === null) {
            finish({
              ok: true,
              started: true,
              exitCode: code,
            });
          } else {
            finish({
              ok: false,
              reason: `exit code ${code}`,
              exitCode: code,
            });
          }
        }
      });

      setTimeout(() => {
        finish({
          ok: true,
          started: true,
        });
      }, 1500);
    });
  }

  spawnBackendScript(launchFile, trigger) {
    return new Promise((resolve) => {
      const done = (result) => {
        resolve(result);
      };

      let child;
      try {
        if (process.platform === 'win32' && /\.(bat|cmd)$/i.test(launchFile)) {
          child = spawn(launchFile, [], {
            cwd: path.dirname(launchFile),
            windowsHide: true,
            detached: false,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
          });
        } else {
          child = spawn(launchFile, [], {
            cwd: path.dirname(launchFile),
            windowsHide: true,
            detached: false,
            stdio: ['ignore', 'pipe', 'pipe'],
          });
        }
      } catch (error) {
        const reason = error?.message || String(error);
        this.log(`startBackend spawn failed: script=${launchFile}, reason=${reason}`);
        done({
          ok: false,
          reason,
        });
        return;
      }

      this.backendProcess = child;
      this.backendLastLaunchAt = Date.now();
      this.backendLastLaunchFile = launchFile;
      this.backendAttachedExisting = false;
      this.log(
        `NCat backend launch requested: trigger=${trigger}, script=${launchFile}, pid=${child.pid || 'unknown'}`
      );

      const logChunk = (kind, data) => {
        const text = String(data || '').trim();
        if (!text) {
          return;
        }
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
          const value = String(line || '').trim();
          if (value) {
            this.ingestBackendWebLogLine(value);
          }
        }
        const previewLines = lines.slice(0, 4);
        for (const line of previewLines) {
          const value = String(line || '').trim();
          if (value) {
            this.log(`backend ${kind}: ${value}`);
          }
        }
      };

      if (child.stdout) {
        child.stdout.on('data', (chunk) => {
          logChunk('stdout', chunk.toString());
        });
      }
      if (child.stderr) {
        child.stderr.on('data', (chunk) => {
          logChunk('stderr', chunk.toString());
        });
      }

      let settled = false;
      const finish = (result) => {
        if (settled) {
          return;
        }
        settled = true;
        done(result);
      };

      child.once('error', (error) => {
        const reason = error?.message || String(error);
        this.log(`NCat backend process error: script=${launchFile}, reason=${reason}`);
        if (this.backendProcess === child) {
          this.backendProcess = null;
        }
        finish({
          ok: false,
          reason,
        });
      });

      child.once('exit', (code, signal) => {
        if (this.backendProcess === child) {
          this.backendProcess = null;
        }
        this.log(`NCat backend process exit: script=${launchFile}, code=${code ?? 'null'}, signal=${signal || ''}`);
        if (!settled) {
          if (code === 0 || code === null) {
            finish({
              ok: true,
              started: true,
              exitCode: code,
            });
          } else {
            finish({
              ok: false,
              reason: `exit code ${code}`,
              exitCode: code,
            });
          }
        }
      });

      setTimeout(() => {
        finish({
          ok: true,
          started: true,
        });
      }, 1500);
    });
  }

  async startBackend(options = {}) {
    const force = options.force === true;
    const trigger = String(options.trigger || 'unknown');
    const config = options.config || vscode.workspace.getConfiguration();
    const rootDir = this.resolveNCatRootDir(config);
    if (!rootDir) {
      const msg = '未设置 ncat.rootDir，无法启动后端。';
      this.log(`startBackend skipped: ${msg}`);
      return {
        ok: false,
        reason: msg,
      };
    }
    if (!fs.existsSync(rootDir)) {
      const msg = `NCat 根目录不存在: ${rootDir}`;
      this.log(`startBackend skipped: ${msg}`);
      return {
        ok: false,
        reason: msg,
      };
    }

    if (this.backendProcess && !this.backendProcess.killed) {
      this.backendManagedActive = true;
      this.backendAttachedExisting = false;
      this.emitUiUpdate();
      return {
        ok: true,
        skipped: true,
        reason: 'already-running',
      };
    }

    const detectedExisting = await this.detectExistingBackendProcess(rootDir, trigger);
    if (detectedExisting.found) {
      this.backendManagedActive = true;
      this.backendLastLaunchAt = Date.now();
      this.backendLastLaunchFile = `[attached] QQ.exe pid=${detectedExisting.pid}`;
      this.backendAttachedExisting = true;
      this.refreshDetectedBackendWebInfo(config, rootDir);
      this.emitUiUpdate();
      this.log(
        `startBackend reused existing NCat process: trigger=${trigger}, pid=${detectedExisting.pid}`
      );
      return {
        ok: true,
        skipped: true,
        reason: 'existing-process',
        attached: true,
        pid: detectedExisting.pid,
      };
    }

    const now = Date.now();
    if (!force && this.backendManagedActive && now - this.backendLastLaunchAt < BACKEND_START_COOLDOWN_MS) {
      const remainMs = BACKEND_START_COOLDOWN_MS - (now - this.backendLastLaunchAt);
      this.log(`startBackend skipped by cooldown: remain=${remainMs}ms, trigger=${trigger}`);
      return {
        ok: true,
        skipped: true,
        reason: 'cooldown',
      };
    }

    if (this.backendStarting) {
      return this.backendStarting;
    }

    const launchCandidates = this.collectBackendLaunchCandidates(config, rootDir);
    const quickLoginUin = this.resolveQuickLoginUin(config);
    if (launchCandidates.length === 0) {
      const msg = `未找到启动脚本，请检查 ncat.rootDir。root=${rootDir}`;
      this.log(`startBackend failed: ${msg}`);
      return {
        ok: false,
        reason: msg,
      };
    }

    const startTask = new Promise((resolve) => {
      const done = (result) => {
        this.backendStarting = null;
        resolve(result);
      };
      (async () => {
        let lastFailure = '';
        if (process.platform === 'win32' && quickLoginUin) {
          const quickLaunchDirs = this.collectQuickLaunchDirsFromScripts(launchCandidates);
          for (let idx = 0; idx < quickLaunchDirs.length; idx += 1) {
            const launchDir = quickLaunchDirs[idx];
            const result = await this.spawnBackendQuickLogin(launchDir, quickLoginUin, `${trigger}#quick-${idx + 1}`);
            if (result?.ok) {
              this.backendManagedActive = true;
              this.refreshDetectedBackendWebInfo(config, rootDir);
              done({
                ok: true,
                started: true,
                script: `${path.join(launchDir, 'NapCatWinBootMain.exe')} ${quickLoginUin}`,
                quickLogin: true,
              });
              return;
            }
            lastFailure = String(result?.reason || 'unknown error');
            this.log(`Backend quick launch candidate failed: dir=${launchDir}, reason=${lastFailure}`);
          }
          if (quickLaunchDirs.length === 0) {
            this.log(`Quick login requested but no NapCatWinBootMain.exe found from root=${rootDir}`);
          }
        }

        for (let idx = 0; idx < launchCandidates.length; idx += 1) {
          const candidate = launchCandidates[idx];
          const result = await this.spawnBackendScript(candidate, `${trigger}#${idx + 1}`);
          if (result?.ok) {
            this.backendManagedActive = true;
            this.refreshDetectedBackendWebInfo(config, rootDir);
            done({
              ok: true,
              started: true,
              script: candidate,
            });
            return;
          }
          lastFailure = String(result?.reason || 'unknown error');
          this.log(`Backend launch candidate failed: script=${candidate}, reason=${lastFailure}`);
        }

        done({
          ok: false,
          reason: lastFailure || 'all candidates failed',
        });
      })().catch((error) => {
        done({
          ok: false,
          reason: error?.message || String(error),
        });
      });
    });

    this.backendStarting = startTask;
    return startTask;
  }

  async stopBackend(options = {}) {
    const trigger = String(options.trigger || 'manual-stop');
    const config = options.config || vscode.workspace.getConfiguration();
    const rootDir = this.resolveNCatRootDir(config);
    const disconnectSocket = options.disconnectSocket !== false;
    const enterManualMode = options.enterManualMode === true;

    if (enterManualMode) {
      this.backendManualMode = true;
    }

    if (disconnectSocket) {
      this.manualDisconnect = true;
      this.clearReconnectTimer();
      this.cleanupSocketOnly();
      this.connectionState = 'offline';
      if (this.runtimeActive) {
        this.statusBar.text = '$(plug) NCat: Offline';
        this.statusBar.tooltip = enterManualMode ? 'Backend stopped manually' : 'Disconnected manually';
      } else {
        this.statusBar.text = '$(circle-large-outline) NCat: Stopped';
        this.statusBar.tooltip = 'Plugin not running in current window';
      }
    }

    const stopCandidates = this.collectBackendStopCandidates(config, rootDir);
    let stopByScriptOk = false;
    let stopByScriptReason = '';
    for (let idx = 0; idx < stopCandidates.length; idx += 1) {
      const scriptPath = stopCandidates[idx];
      const result = await this.spawnBackendControlScript(
        scriptPath,
        `${trigger}#${idx + 1}`,
        'backend-stop',
        process.platform === 'win32'
          ? {
              autoInputs: ['0\r\n', '\r\n'],
            }
          : {}
      );
      if (result?.ok) {
        stopByScriptOk = true;
        break;
      }
      stopByScriptReason = String(result?.reason || 'unknown error');
      this.log(`backend-stop candidate failed: script=${scriptPath}, reason=${stopByScriptReason}`);
    }

    let stopByPidOk = false;
    if (this.backendProcess && this.backendProcess.pid) {
      const pid = Number(this.backendProcess.pid);
      if (Number.isFinite(pid) && pid > 0) {
        if (process.platform === 'win32') {
          const taskkillResult = await new Promise((resolve) => {
            const child = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
              windowsHide: true,
              detached: false,
              stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stderrText = '';
            child.stderr?.on('data', (chunk) => {
              stderrText += String(chunk || '');
            });
            child.once('exit', (code) => {
              resolve({
                ok: code === 0,
                reason: code === 0 ? '' : String(stderrText || `exit code ${code}`),
              });
            });
            child.once('error', (error) => {
              resolve({
                ok: false,
                reason: error?.message || String(error),
              });
            });
          });
          if (!taskkillResult.ok) {
            this.log(`taskkill failed: pid=${pid}, reason=${taskkillResult.reason}`);
          } else {
            this.log(`taskkill ok: pid=${pid}`);
            stopByPidOk = true;
          }
        } else {
          try {
            this.backendProcess.kill('SIGTERM');
            stopByPidOk = true;
          } catch (error) {
            this.log(`kill backend process failed: pid=${pid}, reason=${error?.message || String(error)}`);
          }
        }
      }
    }

    let stopByWrapperCleanupOk = false;
    const wrapperCleanup = await this.killResidualWindowsBatchWrappers(rootDir, trigger);
    if (wrapperCleanup?.ok && Number(wrapperCleanup.killed || 0) > 0) {
      stopByWrapperCleanupOk = true;
    }

    this.backendProcess = null;
    this.backendManagedActive = false;
    this.backendAttachedExisting = false;
    this.backendStarting = null;
    this.emitUiUpdate();

    if (stopByScriptOk || stopByPidOk || stopByWrapperCleanupOk) {
      this.log(
        `stopBackend success: trigger=${trigger}, byScript=${stopByScriptOk}, byPid=${stopByPidOk}, byCleanup=${stopByWrapperCleanupOk}`
      );
      return {
        ok: true,
      };
    }

    const reason = stopByScriptReason || '未找到可执行的停止脚本，也没有可杀的后端进程。';
    this.log(`stopBackend finished with warning: ${reason}`);
    return {
      ok: false,
      reason,
    };
  }

  rememberDisplayName(userId, name, groupId = '') {
    return rememberDisplayName(this, userId, name, groupId);
  }

  getDisplayName(userId, groupId = '') {
    return getDisplayName(this, userId, groupId);
  }

  async resolveDisplayName(userId, groupId = '') {
    return resolveDisplayName(this, userId, groupId);
  }

  getHistoryCutoff() {
    return Date.now() - HISTORY_RETENTION_MS;
  }

  pruneSessionMessages(session) {
    const cutoff = this.getHistoryCutoff();
    const max = this.getMaxMessagesPerChat();
    session.messages = session.messages
      .filter((item) => Number(item.timestamp || 0) >= cutoff)
      .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));

    if (session.messages.length > max) {
      session.messages.splice(0, session.messages.length - max);
    }

    session.seenKeys = new Set(session.messages.map((item) => String(item.messageKey || item.id)));
    session.messageIdIndex = new Map();
    for (const item of session.messages) {
      const rawId = String(item.rawMessageId || '').trim();
      if (rawId) {
        session.messageIdIndex.set(rawId, item);
      }
    }
    if (session.messages.length > 0) {
      const last = session.messages[session.messages.length - 1];
      session.lastTs = Number(last.timestamp || Date.now());
      session.preview = toBrief(Array.isArray(last.segments) ? last.segments : []);
    } else {
      session.lastTs = 0;
      session.preview = '';
      session.unread = 0;
    }
  }

  pruneAllSessions() {
    for (const [chatId, session] of this.chatSessions.entries()) {
      this.pruneSessionMessages(session);
      if (session.messages.length === 0) {
        this.chatSessions.delete(chatId);
      }
    }
  }

  schedulePersistCache() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      persistCacheNow(this, CACHE_STORE_KEY);
    }, 800);
  }

  persistCacheNow() {
    persistCacheNow(this, CACHE_STORE_KEY);
  }

  restoreCachedSessions() {
    restoreCachedSessions(this, CACHE_STORE_KEY);
  }

  clearChatCache() {
    const count = this.chatSessions.size;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.historyIngestEpoch += 1;
    this.historyLoadInFlight = null;
    this.chatSessions.clear();
    this.contactDirectory.clear();
    this.contactDirectoryLoaded = false;
    this.contactDirectoryLoading = null;
    this.groupMembersByGroupId.clear();
    this.groupMembersLoading.clear();
    this.pendingNameLookups.clear();
    this.backendUnsupportedHints.clear();
    this.mediaRetryNoRetryIds.clear();
    this.historyLoadedForConnection = true;
    this.recentOutgoingPokes = [];
    this.persistCacheNow();
    this.emitUiUpdate();
    this.log(
      `Local chat cache cleared: removed_sessions=${count}, historyPreloadBlockedForCurrentConnection=true, ingestEpoch=${this.historyIngestEpoch}`
    );
  }

  restoreHiddenTargets() {
    const stored = this.context?.workspaceState?.get(HIDDEN_TARGETS_STORE_KEY);
    const privateIds = parseNumericIdText(stored?.privateIds || '');
    const groupIds = parseNumericIdText(stored?.groupIds || '');
    this.hiddenPrivateTargets = new Set(privateIds);
    this.hiddenGroupTargets = new Set(groupIds);
    if (privateIds.length > 0 || groupIds.length > 0) {
      this.log(`Hidden targets restored: private=${privateIds.length}, group=${groupIds.length}`);
    }
  }

  persistHiddenTargets() {
    const payload = {
      privateIds: Array.from(this.hiddenPrivateTargets.values()),
      groupIds: Array.from(this.hiddenGroupTargets.values()),
      updatedAt: Date.now(),
    };
    this.context?.workspaceState?.update(HIDDEN_TARGETS_STORE_KEY, payload).then(
      () => {},
      (error) => {
        this.log(`persistHiddenTargets failed: ${error?.message || String(error)}`);
      }
    );
  }

  getHiddenTargetsSnapshot() {
    const privateIds = Array.from(this.hiddenPrivateTargets.values()).sort((a, b) => Number(a) - Number(b));
    const groupIds = Array.from(this.hiddenGroupTargets.values()).sort((a, b) => Number(a) - Number(b));
    return {
      privateIds,
      groupIds,
      privateText: privateIds.join(','),
      groupText: groupIds.join(','),
    };
  }

  setHiddenTargets({ privateIds = [], groupIds = [], source = 'unknown' }) {
    const nextPrivate = new Set(parseNumericIdText(Array.isArray(privateIds) ? privateIds.join(',') : privateIds));
    const nextGroup = new Set(parseNumericIdText(Array.isArray(groupIds) ? groupIds.join(',') : groupIds));
    this.hiddenPrivateTargets = nextPrivate;
    this.hiddenGroupTargets = nextGroup;
    this.persistHiddenTargets();
    this.emitUiUpdate();
    this.schedulePersistCache();
    this.log(`Hidden targets updated: source=${source}, private=${nextPrivate.size}, group=${nextGroup.size}`);
  }

  setHiddenTargetsFromText(privateText = '', groupText = '', source = 'settings') {
    this.setHiddenTargets({
      privateIds: parseNumericIdText(privateText),
      groupIds: parseNumericIdText(groupText),
      source,
    });
  }

  hideChatById(chatId, source = 'menu') {
    const full = String(chatId || '').trim();
    if (!full) {
      return {
        ok: false,
        reason: 'invalid chat id',
      };
    }
    const splitAt = full.indexOf(':');
    if (splitAt <= 0 || splitAt >= full.length - 1) {
      return {
        ok: false,
        reason: 'invalid chat id',
      };
    }
    const type = full.slice(0, splitAt);
    const targetId = full.slice(splitAt + 1).trim();
    if (!/^\d{5,16}$/.test(targetId)) {
      return {
        ok: false,
        reason: 'invalid target id',
      };
    }

    if (type === 'private') {
      this.hiddenPrivateTargets.add(targetId);
    } else if (type === 'group') {
      this.hiddenGroupTargets.add(targetId);
    } else {
      return {
        ok: false,
        reason: `unsupported chat type: ${type}`,
      };
    }

    this.persistHiddenTargets();
    this.emitUiUpdate();
    this.schedulePersistCache();
    this.log(`Chat hidden: source=${source}, chatId=${full}`);
    return {
      ok: true,
      type,
      targetId,
    };
  }

  isChatHidden(type, targetId) {
    const chatType = String(type || '').trim();
    const id = String(targetId || '').trim();
    if (!chatType || !id) {
      return false;
    }
    if (chatType === 'private') {
      return this.hiddenPrivateTargets.has(id);
    }
    if (chatType === 'group') {
      return this.hiddenGroupTargets.has(id);
    }
    return false;
  }

  upsertSession({ chatId, type, targetId, title, avatarUrl = '' }) {
    let session = this.chatSessions.get(chatId);
    if (!session) {
      session = {
        id: chatId,
        type,
        targetId,
        title,
        avatarUrl,
        preview: '',
        lastTs: 0,
        unread: 0,
        messages: [],
        seenKeys: new Set(),
        messageIdIndex: new Map(),
        historyCount: 80,
        loadingOlder: false,
      };
      this.chatSessions.set(chatId, session);
    } else if (title && (!session.title || /^群\s+\d+$/.test(session.title))) {
      session.title = title;
    }

    if (avatarUrl) {
      session.avatarUrl = avatarUrl;
    }
    if (!session.seenKeys) {
      session.seenKeys = new Set();
    }
    if (!session.messageIdIndex) {
      session.messageIdIndex = new Map();
    }
    if (!session.historyCount) {
      session.historyCount = 80;
    }
    if (typeof session.loadingOlder !== 'boolean') {
      session.loadingOlder = false;
    }

    return session;
  }

  markChatRead(chatId) {
    const session = this.chatSessions.get(chatId);
    if (!session) {
      return;
    }
    if (session.unread > 0) {
      session.unread = 0;
      this.emitUiUpdate();
      this.schedulePersistCache();
    }
  }

  searchDirectory(queryText, limit = 30) {
    const rows = searchDirectoryEntries(this.contactDirectory, queryText, limit);
    return rows.filter((item) => !this.isChatHidden(item?.type, item?.targetId));
  }

  async refreshContactDirectory(force = false) {
    return refreshContactDirectory(this, force);
  }

  async ensureChatSession(contact) {
    return ensureChatSession(this, contact);
  }

  getGroupMembers(groupId) {
    const key = String(groupId || '').trim();
    if (!key) {
      return [];
    }
    const rows = this.groupMembersByGroupId.get(key);
    return Array.isArray(rows) ? rows : [];
  }

  async ensureGroupMembers(groupId, force = false) {
    const key = String(groupId || '').trim();
    if (!key || !this.isConnected()) {
      return [];
    }

    if (!force && this.groupMembersByGroupId.has(key)) {
      return this.groupMembersByGroupId.get(key);
    }

    if (this.groupMembersLoading.has(key)) {
      return this.groupMembersLoading.get(key);
    }

    const loading = (async () => {
      try {
        const response = await this.callApi('get_group_member_list', {
          group_id: toActionId(key),
          no_cache: false,
        });
        const rows = extractListFromApiData(response?.data);
        const next = [];
        for (const item of rows) {
          const userId = String(item?.user_id || item?.uin || item?.qq || '').trim();
          if (!userId) {
            continue;
          }
          const card = String(item?.card || item?.group_card || '').trim();
          const nickname = String(item?.nickname || item?.nick || '').trim();
          const displayName = card || nickname || `QQ ${userId}`;
          this.rememberDisplayName(userId, displayName, key);
          if (nickname) {
            this.rememberDisplayName(userId, nickname);
          }
          next.push({
            userId,
            displayName,
            card,
            nickname,
          });
        }
        next.sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh-CN'));
        this.groupMembersByGroupId.set(key, next);
        this.log(`Group members refreshed: group_id=${key}, count=${next.length}`);
        this.emitUiUpdate();
        return next;
      } catch (error) {
        this.log(`ensureGroupMembers failed: group_id=${key}, reason=${error?.message || String(error)}`);
        throw error;
      } finally {
        this.groupMembersLoading.delete(key);
      }
    })();

    this.groupMembersLoading.set(key, loading);
    return loading;
  }

  getBackendUiConfig() {
    const config = vscode.workspace.getConfiguration();
    const rootDir = String(config.get('ncat.rootDir', '') || '');
    const tokenFile = String(config.get('ncat.tokenFile', '') || '');
    const quickLoginUin = String(config.get('ncat.quickLoginUin', '') || '').trim();
    const backendWeb = this.resolveBackendWebAccess(config);
    return {
      rootDir,
      tokenFile,
      quickLoginUin,
      webResolvedUrl: backendWeb.resolvedUrl,
      runtimeActive: Boolean(this.runtimeActive),
      runtimeBlockedByOther: Boolean(this.runtimeBlockedByOther),
      runtimeBlockedOwnerPid: Number(this.runtimeBlockedOwnerPid || 0),
      backendProcessRunning: Boolean(this.backendProcess && !this.backendProcess.killed),
      backendManagedActive: Boolean(this.backendManagedActive),
      backendManualMode: Boolean(this.backendManualMode),
      backendLastLaunchFile: String(this.backendLastLaunchFile || ''),
    };
  }

  refreshDetectedBackendWebInfo(config, rootDir = '') {
    const resolvedRoot = rootDir || this.resolveNCatRootDir(config);
    if (!resolvedRoot || !fs.existsSync(resolvedRoot)) {
      return {
        webUrl: '',
        webToken: '',
      };
    }

    let foundUrl = '';
    let foundToken = '';
    const candidates = this.listTokenCandidateFiles(resolvedRoot);
    for (const filePath of candidates) {
      const content = this.safeReadTextFile(filePath);
      if (!content) {
        continue;
      }
      const info = extractBackendWebInfoFromText(content);
      if (!foundUrl && info.webUrl) {
        foundUrl = info.webUrl;
      }
      if (!foundToken && info.webToken) {
        foundToken = info.webToken;
      }
      if (foundUrl && foundToken) {
        break;
      }
    }

    if (foundUrl) {
      this.detectedBackendWebUrl = foundUrl;
    }
    if (foundToken) {
      this.detectedBackendWebToken = foundToken;
    }
    if (foundUrl || foundToken) {
      this.log(
        `Backend web config detected: url=${foundUrl || '(none)'}, token=${foundToken ? '(detected)' : '(none)'}`
      );
    }
    return {
      webUrl: foundUrl,
      webToken: foundToken,
    };
  }

  resolveBackendWebAccess(config = vscode.workspace.getConfiguration()) {
    if (!this.detectedBackendWebUrl || !this.detectedBackendWebToken) {
      this.refreshDetectedBackendWebInfo(config);
    }

    const webUrl = normalizeWebUrlForAccess(this.detectedBackendWebUrl)
      || 'http://127.0.0.1:6099/webui';
    const webToken = this.detectedBackendWebToken || '';

    let resolvedUrl = webUrl;
    try {
      const parsed = new URL(webUrl);
      if (webToken && !parsed.searchParams.has('token') && !parsed.searchParams.has('access_token')) {
        parsed.searchParams.set('token', webToken);
      }
      resolvedUrl = parsed.toString();
    } catch {
      resolvedUrl = webUrl;
    }

    return {
      webUrl,
      webToken,
      resolvedUrl,
      autoDetected: true,
    };
  }

  ingestBackendWebLogLine(line) {
    const info = extractBackendWebFromLogLine(line);
    const rawLine = String(line || '');
    this.ingestBackendUnsupportedHintLine(rawLine);
    let changed = false;
    let urlUpdated = false;
    if (info.webUrl) {
      const currentRank = backendWebUrlRank(this.detectedBackendWebUrl);
      const nextRank = backendWebUrlRank(info.webUrl);
      if (!this.detectedBackendWebUrl || nextRank >= currentRank) {
        this.detectedBackendWebUrl = info.webUrl;
        changed = true;
        urlUpdated = true;
      }
    }
    let tokenUpdated = false;
    if (info.webToken) {
      this.detectedBackendWebToken = info.webToken;
      changed = true;
      tokenUpdated = true;
    }
    if (changed) {
      this.log(
        `Backend web info from startup log: chosenUrl=${this.detectedBackendWebUrl || '(none)'}, urlUpdated=${urlUpdated}, tokenUpdated=${tokenUpdated}`
      );
      this.emitUiUpdate();
    }

    if (/(WebSocket服务.*已启动|\[WebSocket Server\].*Server Started)/i.test(rawLine)) {
      this.handleBackendWsReadySignal(rawLine);
    }
  }

  ingestBackendUnsupportedHintLine(line) {
    const raw = String(line || '').trim();
    if (!raw) {
      return;
    }
    const mElement = raw.match(/ElementType\s*=\s*(\d+)/i);
    if (!mElement || !mElement[1]) {
      return;
    }
    const elementType = Number.parseInt(mElement[1], 10);
    if (!Number.isFinite(elementType)) {
      return;
    }

    let chatId = '';
    const privateMatch = raw.match(/接收\s*<-\s*私聊\s*\((\d{5,})\)/);
    if (privateMatch?.[1]) {
      chatId = `private:${privateMatch[1]}`;
    } else {
      const groupMatch = raw.match(/接收\s*<-\s*群聊[^\n\r]*?\((\d{5,})\)/);
      if (groupMatch?.[1]) {
        chatId = `group:${groupMatch[1]}`;
      }
    }
    if (!chatId) {
      return;
    }

    this.backendUnsupportedHints.set(chatId, {
      elementType,
      at: Date.now(),
    });
    if (this.backendUnsupportedHints.size > 200) {
      const expireBefore = Date.now() - 60_000;
      for (const [key, hint] of this.backendUnsupportedHints.entries()) {
        if (!hint || Number(hint.at || 0) < expireBefore) {
          this.backendUnsupportedHints.delete(key);
        }
      }
    }
    this.log(`backend unsupported hint: chat=${chatId}, elementType=${elementType}`);
  }

  consumeBackendUnsupportedHint(chatId, maxAgeMs = 12_000) {
    const key = String(chatId || '').trim();
    if (!key) {
      return null;
    }
    const hint = this.backendUnsupportedHints.get(key);
    if (!hint) {
      return null;
    }
    this.backendUnsupportedHints.delete(key);
    const age = Date.now() - Number(hint.at || 0);
    if (!Number.isFinite(age) || age < 0 || age > maxAgeMs) {
      return null;
    }
    return hint;
  }

  handleBackendWsReadySignal(rawLine) {
    const now = Date.now();
    if (now - this.backendLastWsReadyAt < 1800) {
      return;
    }
    this.backendLastWsReadyAt = now;
    this.log(`Backend websocket-ready signal: ${rawLine}`);

    if (this.disposed || this.manualDisconnect || this.backendManualMode || !this.runtimeActive) {
      return;
    }
    if (this.isConnected()) {
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.clearReconnectTimer();
    setTimeout(() => {
      if (this.disposed || this.manualDisconnect || this.backendManualMode || !this.runtimeActive) {
        return;
      }
      if (this.isConnected()) {
        return;
      }
      this.connect({
        silent: true,
        reason: 'backend-ws-ready',
      }).catch((error) => {
        this.log(`backend-ws-ready connect failed: ${error?.message || String(error)}`);
      });
    }, 120);
  }

  getUiState(preferredChatId = '', searchQuery = '') {
    const runtimeActive = Boolean(this.runtimeActive);
    const chats = Array.from(this.chatSessions.values()).sort((a, b) => b.lastTs - a.lastTs);
    const visibleChats = runtimeActive
      ? chats.filter((item) => !this.isChatHidden(item?.type, item?.targetId))
      : [];

    let selectedChatId = '';
    if (runtimeActive && preferredChatId && this.chatSessions.has(preferredChatId)) {
      const preferred = this.chatSessions.get(preferredChatId);
      if (!this.isChatHidden(preferred?.type, preferred?.targetId)) {
        selectedChatId = preferredChatId;
      }
    }
    if (!selectedChatId && runtimeActive && preferredChatId) {
      const preferred = this.chatSessions.get(preferredChatId);
      if (preferred && this.isChatHidden(preferred?.type, preferred?.targetId)) {
        this.log(`selected chat ignored because hidden: ${preferredChatId}`);
      }
    }

    const selectedSession = runtimeActive && selectedChatId ? this.chatSessions.get(selectedChatId) : null;
    const q = String(searchQuery || '').trim();
    const sessionMatches = q
      ? visibleChats.filter((item) => {
          const haystack = [item.title, item.targetId, item.id].filter(Boolean).join('\n').toLowerCase();
          return haystack.includes(q.toLowerCase());
        })
      : visibleChats;
    const shouldUseDirectory = runtimeActive && q && sessionMatches.length === 0;
    if (shouldUseDirectory && !this.contactDirectoryLoaded && !this.contactDirectoryLoading && this.isConnected()) {
      this.refreshContactDirectory(false).catch((error) => {
        this.log(`refreshContactDirectory kickoff failed: ${error?.message || String(error)}`);
      });
    }
    const directoryResults = shouldUseDirectory ? this.searchDirectory(q, 30) : [];
    const selectedChatType = selectedSession ? selectedSession.type : '';
    const selectedTargetId = selectedSession ? String(selectedSession.targetId || '') : '';
    const selectedMembers = selectedChatType === 'group'
      ? this.getGroupMembers(selectedTargetId).map((item) => ({
          userId: item.userId,
          displayName: item.displayName,
          card: item.card || '',
          nickname: item.nickname || '',
        }))
      : [];
    if (selectedChatType === 'group' && selectedTargetId && !this.groupMembersByGroupId.has(selectedTargetId) && !this.groupMembersLoading.has(selectedTargetId) && this.isConnected()) {
      this.ensureGroupMembers(selectedTargetId, false).catch(() => {});
    }

    return {
      connectionState: runtimeActive ? this.connectionState : 'offline',
      runtimeActive,
      runtimeBlockedByOther: Boolean(this.runtimeBlockedByOther),
      runtimeBlockedOwnerPid: Number(this.runtimeBlockedOwnerPid || 0),
      selfUserId: String(this.selfUserId || ''),
      selfNickname: String(this.selfNickname || 'NCat'),
      selfAvatarUrl: this.selfUserId ? getPrivateAvatarUrl(this.selfUserId) : '',
      chats: visibleChats.map((item) => {
        const list = Array.isArray(item.messages) ? item.messages : [];
        const last = list.length > 0 ? list[list.length - 1] : null;
        const senderId = String(last?.senderId || '').trim();
        const senderName = String(last?.senderName || '').trim();
        const isSystem = String(last?.displayStyle || '') === 'system';
        let previewSender = '';
        if (!isSystem && (senderName || senderId)) {
          previewSender = senderName || senderId;
          if (senderId && this.selfUserId && senderId === String(this.selfUserId)) {
            previewSender = '我';
          }
        }
        return {
          id: item.id,
          type: item.type,
          targetId: item.targetId,
          title: item.title,
          avatarUrl: item.avatarUrl || '',
          preview: item.preview,
          previewSender,
          unread: item.unread,
          lastTs: item.lastTs,
        };
      }),
      directoryResults,
      directorySearchPending: Boolean(shouldUseDirectory && this.contactDirectoryLoading),
      selectedChatId,
      selectedChatType,
      selectedTargetId,
      selectedMembers,
      selectedMessages: selectedSession
        ? selectedSession.messages.map((msg) => ({
            id: msg.id,
            rawMessageId: msg.rawMessageId || '',
            direction: msg.direction,
            displayStyle: msg.displayStyle || 'bubble',
            senderId: msg.senderId,
            senderName: msg.senderName,
            avatarUrl: msg.senderAvatarUrl || '',
            timestamp: msg.timestamp,
            segments: msg.segments,
          }))
        : [],
      isLoadingOlder: selectedSession ? Boolean(selectedSession.loadingOlder) : false,
      hidden: this.getHiddenTargetsSnapshot(),
      backend: this.getBackendUiConfig(),
    };
  }

  appendMessageToSession({
    chatId,
    type,
    targetId,
    title,
    avatarUrl = '',
    direction,
    senderId,
    senderName,
    senderAvatarUrl = '',
    segments,
    timestamp,
    messageId = '',
    rawMessageId = '',
    displayStyle = 'bubble',
    countUnread = direction === 'in',
  }) {
    const session = this.upsertSession({ chatId, type, targetId, title, avatarUrl });
    const ts = timestamp || Date.now();
    const preview = toBrief(segments);
    const messageKey = messageId
      ? `mid:${messageId}`
      : `ts:${ts}|dir:${direction}|from:${String(senderId || '')}|p:${preview}`;

    if (session.seenKeys.has(messageKey)) {
      return false;
    }

    session.seenKeys.add(messageKey);
    const message = {
      id: `${ts}-${Math.random().toString(36).slice(2, 8)}`,
      messageKey,
      rawMessageId: String(rawMessageId || messageId || ''),
      direction,
      senderId: String(senderId || ''),
      senderName: String(senderName || ''),
      senderAvatarUrl: String(senderAvatarUrl || ''),
      timestamp: ts,
      displayStyle: String(displayStyle || 'bubble'),
      segments,
    };

    session.messages.push(message);
    if (message.rawMessageId) {
      session.messageIdIndex.set(message.rawMessageId, message);
    }
    this.pruneSessionMessages(session);

    session.lastTs = Math.max(session.lastTs, ts);
    session.preview = preview;
    if (countUnread) {
      session.unread += 1;
    }

    this.emitUiUpdate();
    this.schedulePersistCache();
    return true;
  }

  async decorateSegmentsForDisplay(segments, context = {}) {
    return decorateSegmentsForDisplay(this, segments, context);
  }

  async ingestIncomingMessage(payload) {
    const messageType = payload?.message_type === 'group' ? 'group' : 'private';
    const isGroup = messageType === 'group';

    const targetId = String(isGroup ? payload?.group_id || '' : payload?.user_id || '');
    if (!targetId) {
      return;
    }

    const senderId = String(payload?.user_id || '');
    const senderName = String(payload?.sender?.card || payload?.sender?.nickname || senderId || 'unknown');
    this.rememberDisplayName(senderId, senderName, isGroup ? targetId : '');
    if (isGroup && senderId) {
      const cachedMembers = this.groupMembersByGroupId.get(targetId);
      if (Array.isArray(cachedMembers)) {
        const idx = cachedMembers.findIndex((item) => item.userId === senderId);
        const nextEntry = {
          userId: senderId,
          displayName: senderName || `QQ ${senderId}`,
          card: String(payload?.sender?.card || '').trim(),
          nickname: String(payload?.sender?.nickname || '').trim(),
        };
        if (idx >= 0) {
          cachedMembers[idx] = nextEntry;
        } else {
          cachedMembers.push(nextEntry);
        }
      }
    }
    const title = isGroup
      ? String(payload?.group_name || `群 ${targetId}`)
      : String(payload?.sender?.nickname || senderId || `QQ ${targetId}`);
    const avatarUrl = isGroup ? getGroupAvatarUrl(targetId) : getPrivateAvatarUrl(targetId);

    const chatId = `${messageType}:${targetId}`;
    const segments = await this.decorateSegmentsForDisplay(normalizeSegments(payload), {
      chatType: messageType,
      targetId,
      chatId,
    });
    if (segments.length === 0) {
      const rawMsg = String(payload?.raw_message || payload?.rawMessage || '').trim();
      const debugType = Array.isArray(payload?.message)
        ? payload.message
            .map((seg) => String(seg?.type || seg?.data?.type || seg?.elementType || seg?.data?.elementType || '?'))
            .join('|')
        : 'none';
      const hasElement9 = /elementtype[^0-9]*9/i.test(JSON.stringify(payload || {}));
      const backendHint = this.consumeBackendUnsupportedHint(chatId, 15_000);
      const backendHintType = Number(backendHint?.elementType);
      this.log(
        `incoming message empty segments: chat=${chatId}, raw_len=${rawMsg.length}, hasElement9=${hasElement9}, backendHint=${Number.isFinite(backendHintType) ? backendHintType : 'none'}, types=${debugType}`
      );
      if (hasElement9 || backendHintType === 9) {
        segments.push({
          type: 'red_packet',
          title: '红包',
          text: '[红包]',
        });
        this.log(`incoming message fallback -> red_packet: chat=${chatId}, by=${hasElement9 ? 'payload' : 'backend-hint'}`);
      }
    }
    if (segments.length === 0) {
      segments.push({
        type: 'text',
        text: '[空消息]',
      });
    }

    this.appendMessageToSession({
      chatId,
      type: messageType,
      targetId,
      title,
      avatarUrl,
      direction: 'in',
      senderId,
      senderName,
      senderAvatarUrl: getPrivateAvatarUrl(senderId),
      segments,
      timestamp: toMsTime(payload?.time),
      messageId: payload?.message_id ? String(payload.message_id) : '',
      rawMessageId: payload?.message_id ? String(payload.message_id) : '',
    });

    const brief = toBrief(segments);
    this.statusBar.text = `$(comment-discussion) ${clipText(brief, 24)}`;
    this.statusBar.tooltip = 'NCat latest message';
  }

  appendOutgoingPrivate(userId, message, messageId = '') {
    const targetId = String(userId);
    const sessionId = `private:${targetId}`;
    const session = this.chatSessions.get(sessionId);
    const displaySegments = this.decorateReplySegmentsWithSession(
      buildLocalEchoSegments(message),
      session
    );
    this.appendMessageToSession({
      chatId: sessionId,
      type: 'private',
      targetId,
      title: `QQ ${targetId}`,
      avatarUrl: getPrivateAvatarUrl(targetId),
      direction: 'out',
      senderId: this.selfUserId || '',
      senderName: this.selfNickname || 'Me',
      senderAvatarUrl: this.selfUserId ? getPrivateAvatarUrl(this.selfUserId) : '',
      segments: displaySegments,
      timestamp: Date.now(),
      messageId: messageId ? String(messageId) : '',
      countUnread: false,
    });
  }

  decorateReplySegmentsWithSession(segments, session) {
    const safeSegments = Array.isArray(segments) ? segments : [];
    return safeSegments.map((seg) => {
      if (!seg || seg.type !== 'reply') {
        return seg;
      }
      const replyId = String(seg.replyId || '').trim();
      if (!replyId || !session?.messageIdIndex?.has(replyId)) {
        return seg;
      }
      const refMsg = session.messageIdIndex.get(replyId);
      const refName = String(refMsg?.senderName || refMsg?.senderId || '').trim();
      const refPreview = buildReplyPreviewFromSegments(Array.isArray(refMsg?.segments) ? refMsg.segments : []);
      return {
        ...seg,
        text: formatReplyLabel(replyId, refName, refPreview),
      };
    });
  }

  appendOutgoingGroup(groupId, message, messageId = '') {
    const targetId = String(groupId);
    const sessionId = `group:${targetId}`;
    const session = this.chatSessions.get(sessionId);
    const baseSegments = buildLocalEchoSegments(message);
    const withReply = this.decorateReplySegmentsWithSession(baseSegments, session);
    const displaySegments = withReply.map((seg) => {
      if (!seg || seg.type !== 'mention') {
        return seg;
      }
      const uid = String(seg.targetId || '').trim();
      if (!uid || uid === 'all') {
        return seg;
      }
      const displayName = this.getDisplayName(uid, targetId) || this.getDisplayName(uid);
      if (!displayName) {
        return seg;
      }
      return {
        ...seg,
        text: `@${displayName}`,
      };
    });
    this.appendMessageToSession({
      chatId: sessionId,
      type: 'group',
      targetId,
      title: `群 ${targetId}`,
      avatarUrl: getGroupAvatarUrl(targetId),
      direction: 'out',
      senderId: this.selfUserId || '',
      senderName: this.selfNickname || 'Me',
      senderAvatarUrl: this.selfUserId ? getPrivateAvatarUrl(this.selfUserId) : '',
      segments: displaySegments,
      timestamp: Date.now(),
      messageId: messageId ? String(messageId) : '',
      countUnread: false,
    });
  }

  async connect(options = {}) {
    const silent = options.silent === true;
    const reason = options.reason || 'manual';

    if (this.disposed) {
      return;
    }

    if (!this.runtimeActive) {
      this.log(`connect() ignored: runtime is stopped (${reason}).`);
      if (!silent) {
        vscode.window.showWarningMessage('插件当前未运行，请先点击“启动插件”。');
      }
      return;
    }

    const lockResult = this.ensureRuntimeActive({ silent });
    if (!lockResult.ok) {
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.log(`connect() ignored: already connected (${reason}).`);
      if (!silent) {
        vscode.window.showInformationMessage('NCat is already connected.');
      }
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      this.log(`connect() ignored: connection already in progress (${reason}).`);
      return;
    }

    this.manualDisconnect = false;
    this.clearReconnectTimer();
    this.cleanupSocketOnly();

    const config = vscode.workspace.getConfiguration();
    const rawUrl = config.get('ncat.wsUrl', 'ws://127.0.0.1:3001');
    if (!this.backendManualMode) {
      const launchResult = await this.startBackend({
        force: false,
        trigger: `connect-${reason}`,
        config,
      });
      if (!launchResult?.ok) {
        this.log(`Backend auto-start failed: ${launchResult?.reason || 'unknown reason'}`);
      }
    }
    const tokenInfo = await this.resolveToken(config);

    let wsUrl;
    try {
      const url = new URL(rawUrl);
      if (tokenInfo.token && !url.searchParams.has('access_token')) {
        url.searchParams.set('access_token', tokenInfo.token);
      }
      wsUrl = url.toString();
    } catch {
      vscode.window.showErrorMessage(`Invalid ncat.wsUrl: ${rawUrl}`);
      this.log(`Invalid wsUrl: ${rawUrl}`);
      return;
    }

    this.connectionState = 'connecting';
    this.emitUiUpdate();
    this.statusBar.text = '$(sync~spin) NCat: Connecting';
    this.statusBar.tooltip = wsUrl;
    this.log(`Connecting (${reason}) to ${wsUrl}`);
    if (tokenInfo.source === 'env') {
      this.log(`Token source: env (${tokenInfo.envVarName})`);
    } else if (tokenInfo.source === 'settings') {
      this.log('Token source: settings (ncat.token)');
    } else if (tokenInfo.source === 'auto-file') {
      this.log(`Token source: auto file (${tokenInfo.filePath || 'unknown'})`);
    } else if (tokenInfo.source === 'backend-web') {
      this.log('Token source: backend startup log (web token fallback)');
    } else {
      this.log('Token source: none');
    }

    const ws = new WebSocket(wsUrl, {
      handshakeTimeout: 5000,
      perMessageDeflate: false,
    });

    this.ws = ws;

    ws.on('open', () => {
      if (this.disposed) {
        return;
      }

      this.connectionState = 'online';
      this.emitUiUpdate();
      this.reconnectAttempts = 0;
      this.historyLoadedForConnection = false;
      this.clearReconnectTimer();
      this.statusBar.text = '$(radio-tower) NCat: Connected';
      this.statusBar.tooltip = 'NCat connected';
      this.startPolling();
      setTimeout(() => this.sendGetLoginInfo(), 300);
      this.log('WebSocket open.');
      vscode.window.setStatusBarMessage('NCat connected', 3000);
    });

    ws.on('unexpected-response', (_req, response) => {
      this.log(`Handshake rejected: status=${response.statusCode || 'unknown'}`);
    });

    ws.on('message', (raw) => {
      this.handleMessage(raw);
    });

    ws.on('close', (code, reasonText) => {
      if (this.ws === ws) {
        this.ws = null;
      }

      this.rejectAllPending(new Error('NCat connection closed.'));
      this.stopPolling();
      this.connectionState = 'offline';
      this.historyLoadedForConnection = false;
      this.emitUiUpdate();
      this.statusBar.text = '$(plug) NCat: Offline';
      this.statusBar.tooltip = `Disconnected (${code}${reasonText ? `, ${reasonText}` : ''})`;
      this.log(`WebSocket closed. code=${code}, reason=${String(reasonText || '')}`);

      if (!this.manualDisconnect && !this.disposed) {
        this.scheduleReconnect(`close-${code}`);
      }
    });

    ws.on('error', (error) => {
      this.rejectAllPending(error);
      this.stopPolling();
      this.connectionState = 'offline';
      this.emitUiUpdate();
      this.statusBar.text = '$(error) NCat: Error';
      this.statusBar.tooltip = String(error?.message || error);
      this.log(`WebSocket error: ${error?.message || String(error)}`);
      if (!silent) {
        vscode.window.showErrorMessage(`NCat connection failed: ${error?.message || 'unknown error'}`);
      }
    });
  }

  async resolveToken(config) {
    const direct = String(config.get('ncat.token', '') || '').trim()
      || String(config.get(legacyConfigKey('token'), '') || '').trim();
    if (direct) {
      return {
        token: direct,
        source: 'settings',
        envVarName: '',
        filePath: '',
      };
    }

    const rootDir = this.resolveNCatRootDir(config);
    if (rootDir) {
      const tokenResult = this.findTokenFromRoot(config, rootDir);
      if (tokenResult?.token) {
        return {
          token: tokenResult.token,
          source: 'auto-file',
          envVarName: '',
          filePath: tokenResult.filePath,
        };
      }
      this.log(`Token auto-read miss under rootDir=${rootDir}`);
    } else {
      this.log('Token auto-read skipped: ncat.rootDir is empty.');
    }

    const backendDetectedToken = sanitizePotentialToken(this.detectedBackendWebToken || '');
    if (backendDetectedToken) {
      return {
        token: backendDetectedToken,
        source: 'backend-web',
        envVarName: '',
        filePath: '',
      };
    }

    const configuredEnvName = String(
      config.get('ncat.tokenEnvVar', String(config.get(legacyConfigKey('tokenEnvVar'), 'NCAT_TOKEN') || 'NCAT_TOKEN'))
        || 'NCAT_TOKEN'
    ).trim() || 'NCAT_TOKEN';
    const envCandidates = [
      configuredEnvName,
      `N${'APCAT_TOKEN'}`,
    ];
    let envVarName = configuredEnvName;
    let envToken = '';
    for (const candidate of envCandidates) {
      const value = String(process.env[candidate] || '').trim();
      if (!value) {
        continue;
      }
      envVarName = candidate;
      envToken = value;
      break;
    }
    if (envToken) {
      return {
        token: envToken,
        source: 'env',
        envVarName,
        filePath: '',
      };
    }

    return {
      token: '',
      source: 'none',
      envVarName,
      filePath: '',
    };
  }

  async resolveImageUrlToDataUrl(rawUrl) {
    const normalized = normalizeHttpUrl(rawUrl);
    if (!normalized) {
      throw new Error('invalid image url');
    }
    let parsed;
    try {
      parsed = new URL(normalized);
    } catch {
      throw new Error('invalid image url');
    }
    const protocol = String(parsed.protocol || '').toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      throw new Error(`unsupported protocol: ${protocol || 'unknown'}`);
    }

    const fetchImpl = globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new Error('global fetch is unavailable');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        // Ignore.
      }
    }, IMAGE_FETCH_TIMEOUT_MS);

    try {
      this.log(`resolveImageUrl start: url=${normalized}`);
      const response = await fetchImpl(normalized, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'NCatVSC/0.1',
          Accept: 'image/*,*/*;q=0.8',
        },
      });
      if (!response.ok) {
        throw new Error(`http status ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length === 0) {
        throw new Error('empty response body');
      }
      if (buffer.length > IMAGE_FETCH_MAX_BYTES) {
        throw new Error(`image too large (${buffer.length} bytes)`);
      }

      const headerMimeRaw = String(response.headers.get('content-type') || '')
        .split(';')[0]
        .trim()
        .toLowerCase();
      let mime = headerMimeRaw.startsWith('image/') ? headerMimeRaw : '';
      if (!mime) {
        mime = inferImageMimeFromBuffer(buffer);
      }
      if (!mime || !mime.startsWith('image/')) {
        throw new Error(`response is not image (content-type=${headerMimeRaw || 'unknown'})`);
      }

      const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
      const name = buildImageFileNameFromUrl(normalized, mime);
      this.log(`resolveImageUrl success: url=${normalized}, mime=${mime}, bytes=${buffer.length}`);
      return {
        dataUrl,
        mime,
        name,
        bytes: buffer.length,
        url: normalized,
      };
    } catch (error) {
      const reason = error?.message || String(error);
      this.log(`resolveImageUrl failed: url=${normalized}, reason=${reason}`);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  scheduleReconnect(trigger) {
    if (this.disposed || this.manualDisconnect || !this.runtimeActive) {
      return;
    }

    if (this.backendManualMode) {
      this.log(`Auto reconnect skipped in manual backend mode. trigger=${trigger}`);
      return;
    }

    const config = vscode.workspace.getConfiguration();
    if (!config.get('ncat.autoReconnect', true)) {
      this.log(`Auto reconnect disabled. trigger=${trigger}`);
      return;
    }

    if (this.reconnectTimer) {
      this.log(`Reconnect already scheduled. trigger=${trigger}`);
      return;
    }

    this.reconnectAttempts += 1;
    let delay = Math.min(15000, 1000 * Math.pow(2, Math.min(this.reconnectAttempts - 1, 4)));
    const sinceBackendLaunch = this.backendLastLaunchAt > 0
      ? (Date.now() - this.backendLastLaunchAt)
      : Number.POSITIVE_INFINITY;
    if (Number.isFinite(sinceBackendLaunch) && sinceBackendLaunch < BACKEND_BOOT_GRACE_MS) {
      delay = Math.min(delay, 1000);
    }

    this.connectionState = 'reconnecting';
    this.emitUiUpdate();
    this.statusBar.text = '$(sync~spin) NCat: Reconnecting';
    this.statusBar.tooltip = `Retry in ${delay}ms`;
    this.log(`Scheduling reconnect #${this.reconnectAttempts} in ${delay}ms (trigger=${trigger}).`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.disposed || this.manualDisconnect || this.backendManualMode) {
        this.log('Reconnect cancelled before execution.');
        return;
      }

      (async () => {
        const attempt = this.reconnectAttempts;
        const sinceBackendLaunch = this.backendLastLaunchAt > 0
          ? (Date.now() - this.backendLastLaunchAt)
          : Number.POSITIVE_INFINITY;
        let shouldAutoRecover = !this.backendManualMode;
        if (shouldAutoRecover && this.backendAttachedExisting) {
          shouldAutoRecover = false;
          this.log(`Auto recovery skipped: attached existing backend process (trigger=${trigger}, attempt=${attempt}).`);
        }
        if (shouldAutoRecover && Number.isFinite(sinceBackendLaunch) && sinceBackendLaunch < BACKEND_BOOT_GRACE_MS) {
          shouldAutoRecover = false;
          this.log(
            `Auto recovery skipped: backend still in boot grace (${sinceBackendLaunch}ms < ${BACKEND_BOOT_GRACE_MS}ms), trigger=${trigger}, attempt=${attempt}.`
          );
        }
        if (shouldAutoRecover && attempt < AUTO_RECOVERY_MIN_ATTEMPT) {
          shouldAutoRecover = false;
          this.log(
            `Auto recovery skipped: waiting for retry threshold (${attempt}/${AUTO_RECOVERY_MIN_ATTEMPT}), trigger=${trigger}.`
          );
        }

        if (shouldAutoRecover) {
          try {
            this.log(`Auto recovery start: trigger=${trigger}, attempt=${attempt}`);
            await this.stopBackend({
              trigger: `auto-recover-stop-${attempt}`,
              disconnectSocket: false,
              enterManualMode: false,
            });
            if (this.disposed || this.manualDisconnect || this.backendManualMode) {
              this.log('Auto recovery aborted before backend restart.');
              return;
            }
            await this.startBackend({
              force: true,
              trigger: `auto-recover-start-${attempt}`,
              config: vscode.workspace.getConfiguration(),
            });
          } catch (error) {
            this.log(`Auto recovery failed: ${error?.message || String(error)}`);
          }
        } else {
          this.log(`Auto recovery bypassed: reconnect websocket only. trigger=${trigger}, attempt=${attempt}.`);
        }

        if (this.disposed || this.manualDisconnect || this.backendManualMode) {
          this.log('Reconnect aborted after recovery.');
          return;
        }

        await this.connect({
          silent: true,
          reason: `auto-reconnect-${this.reconnectAttempts}`,
        });
      })().catch((error) => {
        this.log(`Reconnect task failed: ${error?.message || String(error)}`);
      });
    }, delay);
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  disconnect() {
    this.log('disconnect() called manually.');
    this.manualDisconnect = true;
    this.clearReconnectTimer();
    this.cleanupSocketOnly();
    this.connectionState = 'offline';
    this.emitUiUpdate();
    this.statusBar.text = '$(plug) NCat: Offline';
    this.statusBar.tooltip = 'Disconnected manually';
    vscode.window.setStatusBarMessage('NCat disconnected', 2000);
  }

  sendGetLoginInfo() {
    if (!this.isConnected()) {
      return;
    }

    const echo = `${LOGIN_ECHO_PREFIX}${++this.seq}`;
    this.ws.send(
      JSON.stringify({
        action: 'get_login_info',
        params: {},
        echo,
      })
    );
  }

  isConnected() {
    return this.connectionState === 'online' && !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  async sendPrivateMessage(userId, message) {
    const ok = await this.ensureConnected();
    if (!ok) {
      throw new Error('NCat is not connected.');
    }

    const composed = normalizeOutgoingRequest(message);
    if (!composed.text.trim() && composed.images.length === 0) {
      throw new Error('Message is empty.');
    }

    this.log(`send_private_msg -> user_id=${userId}, text_len=${composed.text.length}, images=${composed.images.length}`);
    const response = await this.callApi('send_private_msg', {
      user_id: Number(userId),
      message: buildOneBotMessage(composed),
    });

    if (response?.status !== 'ok') {
      throw new Error(response?.wording || response?.message || 'Unknown NCat error.');
    }

    this.appendOutgoingPrivate(userId, composed, response?.data?.message_id);
    return response;
  }

  async sendGroupMessage(groupId, message) {
    const ok = await this.ensureConnected();
    if (!ok) {
      throw new Error('NCat is not connected.');
    }

    const composed = normalizeOutgoingRequest(message);
    if (!composed.text.trim() && composed.images.length === 0) {
      throw new Error('Message is empty.');
    }

    this.log(`send_group_msg -> group_id=${groupId}, text_len=${composed.text.length}, images=${composed.images.length}`);
    const response = await this.callApi('send_group_msg', {
      group_id: Number(groupId),
      message: buildOneBotMessage(composed),
    });

    if (response?.status !== 'ok') {
      throw new Error(response?.wording || response?.message || 'Unknown NCat error.');
    }

    this.appendOutgoingGroup(groupId, composed, response?.data?.message_id);
    return response;
  }

  async sendMessageToChat(chatId, message) {
    const fullId = String(chatId || '');
    const composed = normalizeOutgoingRequest(message);
    if (!fullId || (!composed.text.trim() && composed.images.length === 0)) {
      throw new Error('Chat ID or message is empty.');
    }

    const splitAt = fullId.indexOf(':');
    if (splitAt <= 0 || splitAt === fullId.length - 1) {
      throw new Error(`Unsupported chat id: ${fullId}`);
    }

    const chatType = fullId.slice(0, splitAt);
    const targetId = fullId.slice(splitAt + 1);

    if (chatType === 'private') {
      return this.sendPrivateMessage(targetId, composed);
    }

    if (chatType === 'group') {
      return this.sendGroupMessage(targetId, composed);
    }

    throw new Error(`Unsupported chat type: ${chatType}`);
  }

  async sendJsonMessageToChat(chatId, rawJsonText, replyToMessageId = '') {
    const ok = await this.ensureConnected();
    if (!ok) {
      throw new Error('NCat is not connected.');
    }

    const fullId = String(chatId || '').trim();
    const raw = String(rawJsonText || '').trim();
    const replyId = String(replyToMessageId || '').trim();
    if (!fullId || !raw) {
      throw new Error('Chat ID or JSON is empty.');
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`JSON 解析失败: ${error?.message || String(error)}`);
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('JSON 根节点必须是对象。');
    }

    const splitAt = fullId.indexOf(':');
    if (splitAt <= 0 || splitAt === fullId.length - 1) {
      throw new Error(`Unsupported chat id: ${fullId}`);
    }

    const chatType = fullId.slice(0, splitAt);
    const targetId = fullId.slice(splitAt + 1);
    if (chatType !== 'private' && chatType !== 'group') {
      throw new Error(`Unsupported chat type: ${chatType}`);
    }

    const normalizedRaw = JSON.stringify(parsed);
    const onebotMessage = [];
    if (replyId) {
      onebotMessage.push({
        type: 'reply',
        data: {
          id: replyId,
        },
      });
    }
    onebotMessage.push({
      type: 'json',
      data: {
        data: normalizedRaw,
      },
    });

    const action = chatType === 'group' ? 'send_group_msg' : 'send_private_msg';
    const params = chatType === 'group'
      ? {
          group_id: toActionId(targetId),
          message: onebotMessage,
        }
      : {
          user_id: toActionId(targetId),
          message: onebotMessage,
        };

    this.log(`send_json_msg -> chat=${fullId}, json_len=${normalizedRaw.length}`);
    const response = await this.callApi(action, params);
    if (response?.status !== 'ok') {
      throw new Error(response?.wording || response?.message || 'Unknown NCat error.');
    }

    const sessionId = `${chatType}:${targetId}`;
    const session = this.chatSessions.get(sessionId);
    const title = chatType === 'group'
      ? String(session?.title || `群 ${targetId}`)
      : String(session?.title || `QQ ${targetId}`);
    const avatarUrl = chatType === 'group' ? getGroupAvatarUrl(targetId) : getPrivateAvatarUrl(targetId);
    let displaySegments = normalizeSegments({ message: onebotMessage });
    displaySegments = this.decorateReplySegmentsWithSession(displaySegments, session);

    this.appendMessageToSession({
      chatId: sessionId,
      type: chatType,
      targetId,
      title,
      avatarUrl,
      direction: 'out',
      senderId: this.selfUserId || '',
      senderName: this.selfNickname || 'Me',
      senderAvatarUrl: this.selfUserId ? getPrivateAvatarUrl(this.selfUserId) : '',
      segments: displaySegments,
      timestamp: Date.now(),
      messageId: response?.data?.message_id ? String(response.data.message_id) : '',
      rawMessageId: response?.data?.message_id ? String(response.data.message_id) : '',
      countUnread: false,
    });

    return response;
  }

  applyLocalRecall(chatId, rawMessageId, localMessageId = '') {
    const session = this.chatSessions.get(String(chatId || '').trim());
    if (!session) {
      return false;
    }

    const localId = String(localMessageId || '').trim();
    const rawId = String(rawMessageId || '').trim();
    let target = null;

    if (localId) {
      target = session.messages.find((item) => String(item?.id || '') === localId) || null;
    }
    if (!target && rawId && session.messageIdIndex instanceof Map) {
      target = session.messageIdIndex.get(rawId) || null;
    }
    if (!target) {
      return false;
    }

    target.displayStyle = 'system';
    target.segments = [
      {
        type: 'text',
        text: '你撤回了一条消息',
      },
    ];
    target.direction = 'out';
    if (this.selfUserId) {
      target.senderId = String(this.selfUserId);
    }
    if (this.selfNickname) {
      target.senderName = String(this.selfNickname);
    }
    target.senderAvatarUrl = this.selfUserId ? getPrivateAvatarUrl(this.selfUserId) : String(target.senderAvatarUrl || '');

    this.pruneSessionMessages(session);
    this.emitUiUpdate();
    this.schedulePersistCache();
    return true;
  }

  async recallMessageFromChat(chatId, rawMessageId, localMessageId = '') {
    const ok = await this.ensureConnected();
    if (!ok) {
      throw new Error('NCat is not connected.');
    }

    const fullId = String(chatId || '').trim();
    const rawId = String(rawMessageId || '').trim();
    if (!fullId || !rawId) {
      throw new Error('chatId or rawMessageId is empty.');
    }

    const splitAt = fullId.indexOf(':');
    if (splitAt <= 0 || splitAt === fullId.length - 1) {
      throw new Error(`Unsupported chat id: ${fullId}`);
    }

    const chatType = fullId.slice(0, splitAt);
    if (chatType !== 'private' && chatType !== 'group') {
      throw new Error(`Unsupported chat type: ${chatType}`);
    }

    this.log(`delete_msg -> chat=${fullId}, message_id=${rawId}`);
    const response = await this.callApi('delete_msg', {
      message_id: toActionId(rawId),
    });
    if (response?.status !== 'ok') {
      throw new Error(response?.wording || response?.message || 'Unknown NCat error.');
    }

    const updated = this.applyLocalRecall(fullId, rawId, localMessageId);
    this.log(`delete_msg success: chat=${fullId}, message_id=${rawId}, localUpdated=${updated}`);
    return response;
  }

  appendOutgoingPoke(chatType, chatTargetId, pokeTargetId, messageId = '') {
    const type = chatType === 'group' ? 'group' : 'private';
    const targetId = String(chatTargetId || '');
    const pokeId = String(pokeTargetId || '').trim();
    const groupId = type === 'group' ? targetId : '';
    const display = pokeId ? this.getDisplayName(pokeId, groupId) : '';
    const actorName = String(this.selfNickname || '你');
    const targetName = pokeId ? (display || `QQ ${pokeId}`) : '某人';
    this.recordOutgoingPoke(type, targetId, String(this.selfUserId || ''), pokeId);
    const segments = [{
      type: 'poke_notice',
      actorId: String(this.selfUserId || ''),
      targetId: pokeId,
      text: `${actorName} 戳了 ${targetName}`,
    }];

    this.appendMessageToSession({
      chatId: `${type}:${targetId}`,
      type,
      targetId,
      title: type === 'group' ? `群 ${targetId}` : `QQ ${targetId}`,
      avatarUrl: type === 'group' ? getGroupAvatarUrl(targetId) : getPrivateAvatarUrl(targetId),
      direction: 'out',
      senderId: this.selfUserId || '',
      senderName: this.selfNickname || 'Me',
      senderAvatarUrl: this.selfUserId ? getPrivateAvatarUrl(this.selfUserId) : '',
      segments,
      timestamp: Date.now(),
      messageId: messageId ? String(messageId) : '',
      displayStyle: 'system',
      countUnread: false,
    });
  }

  pruneRecentOutgoingPokes(now = Date.now()) {
    const cutoff = now - 15_000;
    this.recentOutgoingPokes = this.recentOutgoingPokes.filter((item) => Number(item?.ts || 0) >= cutoff);
  }

  recordOutgoingPoke(chatType, chatTargetId, actorId, targetId) {
    const key = buildPokeDedupeKey(chatType, chatTargetId, actorId, targetId);
    if (!key) {
      return;
    }
    const now = Date.now();
    this.pruneRecentOutgoingPokes(now);
    this.recentOutgoingPokes.push({
      key,
      ts: now,
    });
  }

  consumeOutgoingPoke(chatType, chatTargetId, actorId, targetId) {
    const key = buildPokeDedupeKey(chatType, chatTargetId, actorId, targetId);
    if (!key) {
      return false;
    }
    const now = Date.now();
    this.pruneRecentOutgoingPokes(now);
    const index = this.recentOutgoingPokes.findIndex((item) => item.key === key);
    if (index < 0) {
      return false;
    }
    this.recentOutgoingPokes.splice(index, 1);
    return true;
  }

  ingestPokeNotice(payload) {
    const poke = normalizePokeNotice(payload);
    if (!poke) {
      return false;
    }

    const selfId = String(this.selfUserId || '').trim();
    const groupId = String(poke.groupId || '').trim();
    const actorId = String(poke.actorId || '').trim();
    const targetId = String(poke.targetId || '').trim();

    if (!groupId && !actorId && !targetId) {
      return false;
    }

    const chatType = groupId ? 'group' : 'private';
    let chatTargetId = groupId;
    if (!chatTargetId) {
      if (actorId && actorId !== selfId) {
        chatTargetId = actorId;
      } else if (targetId && targetId !== selfId) {
        chatTargetId = targetId;
      } else {
        chatTargetId = actorId || targetId;
      }
    }
    if (!chatTargetId) {
      return false;
    }

    const chatId = `${chatType}:${chatTargetId}`;
    const session = this.chatSessions.get(chatId);
    const actorName = resolveDisplayNameOrId(this, actorId, groupId);
    const targetName = resolveDisplayNameOrId(this, targetId, groupId);

    if (groupId && actorId && actorName) {
      this.rememberDisplayName(actorId, actorName, groupId);
    }
    if (groupId && targetId && targetName) {
      this.rememberDisplayName(targetId, targetName, groupId);
    }

    const text = `${actorName || '有人'} 戳了 ${targetName || '某人'}`;
    const avatarUrl = chatType === 'group' ? getGroupAvatarUrl(chatTargetId) : getPrivateAvatarUrl(chatTargetId);
    const title = chatType === 'group'
      ? String(session?.title || `群 ${chatTargetId}`)
      : String(session?.title || targetName || actorName || `QQ ${chatTargetId}`);
    const direction = actorId && actorId === selfId ? 'out' : 'in';
    if (direction === 'out' && this.consumeOutgoingPoke(chatType, chatTargetId, actorId, targetId)) {
      return true;
    }
    const countUnread = direction !== 'out';
    const derivedMessageId = [
      'poke',
      groupId || 'private',
      actorId || 'na',
      targetId || 'na',
      String(payload?.time || ''),
      String(payload?.seq || payload?.id || ''),
    ].join(':');

    this.appendMessageToSession({
      chatId,
      type: chatType,
      targetId: chatTargetId,
      title,
      avatarUrl,
      direction,
      senderId: actorId || targetId || '',
      senderName: actorName || targetName || 'unknown',
      senderAvatarUrl: actorId ? getPrivateAvatarUrl(actorId) : '',
      segments: [{
        type: 'poke_notice',
        actorId,
        targetId,
        text,
      }],
      timestamp: toMsTime(payload?.time || Date.now()),
      messageId: derivedMessageId,
      rawMessageId: '',
      displayStyle: 'system',
      countUnread,
    });

    return true;
  }

  ingestRecallNotice(payload) {
    const recall = normalizeRecallNotice(payload);
    if (!recall) {
      return false;
    }

    const selfId = String(this.selfUserId || '').trim();
    if (recall.operatorId && selfId && recall.operatorId === selfId) {
      // 我自己撤回的提示由本地消息替换逻辑处理，避免重复系统行。
      return true;
    }

    const chatType = recall.isGroup ? 'group' : 'private';
    const chatTargetId = String(recall.targetId || '').trim();
    if (!chatTargetId) {
      return false;
    }

    const chatId = `${chatType}:${chatTargetId}`;
    const session = this.chatSessions.get(chatId);
    const actorId = String(recall.operatorId || recall.userId || '').trim();
    const ownerId = String(recall.userId || '').trim();
    const actorName = resolveDisplayNameOrId(this, actorId, recall.groupId || '');
    const ownerName = ownerId ? resolveDisplayNameOrId(this, ownerId, recall.groupId || '') : '';

    let recalledPreview = '';
    if (recall.messageId && session?.messageIdIndex?.has(recall.messageId)) {
      const ref = session.messageIdIndex.get(recall.messageId);
      recalledPreview = sanitizeReplyPreviewText(buildReplyPreviewFromSegments(Array.isArray(ref?.segments) ? ref.segments : []));
    }

    let text = `${actorName || '有人'} 尝试撤回一条消息`;
    if (recall.isGroup && ownerName && ownerName !== actorName) {
      text = `${actorName || '有人'} 尝试撤回 ${ownerName} 的一条消息`;
    }
    const recallSegments = [{
      type: 'recall_notice',
      actorId,
      ownerId,
      recalledMessageId: String(recall.messageId || ''),
      text,
    }];
    if (recalledPreview || recall.messageId) {
      recallSegments.push({
        type: 'reply',
        replyId: String(recall.messageId || ''),
        replyName: ownerName,
        replyPreview: recalledPreview,
        text: formatReplyLabel(String(recall.messageId || ''), ownerName, recalledPreview),
      });
    }

    const avatarUrl = chatType === 'group' ? getGroupAvatarUrl(chatTargetId) : getPrivateAvatarUrl(chatTargetId);
    const title = chatType === 'group'
      ? String(session?.title || `群 ${chatTargetId}`)
      : String(session?.title || actorName || ownerName || `QQ ${chatTargetId}`);
    const derivedMessageId = [
      'recall',
      recall.noticeType || chatType,
      chatTargetId,
      actorId || 'na',
      ownerId || 'na',
      recall.messageId || '',
      String(payload?.time || ''),
      String(payload?.seq || payload?.id || ''),
    ].join(':');

    this.appendMessageToSession({
      chatId,
      type: chatType,
      targetId: chatTargetId,
      title,
      avatarUrl,
      direction: 'in',
      senderId: actorId,
      senderName: actorName || ownerName || 'unknown',
      senderAvatarUrl: actorId ? getPrivateAvatarUrl(actorId) : '',
      segments: recallSegments,
      timestamp: toMsTime(payload?.time || Date.now()),
      messageId: derivedMessageId,
      rawMessageId: '',
      displayStyle: 'bubble',
      countUnread: true,
    });

    return true;
  }

  async callApiByAttempts(attempts, label) {
    let lastError = null;
    for (const attempt of attempts) {
      const action = String(attempt?.action || '').trim();
      if (!action) {
        continue;
      }

      try {
        const response = await this.callApi(action, attempt?.params || {});
        if (response?.status === 'ok') {
          return {
            response,
            action,
          };
        }
        const reason = response?.wording || response?.message || `status=${String(response?.status || 'unknown')}`;
        throw new Error(reason);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.log(`${label} attempt failed: action=${action}, reason=${lastError.message}`);
      }
    }

    throw lastError || new Error(`${label} failed.`);
  }

  async sendPokeToChat(chatId, pokeTargetId = '') {
    const ok = await this.ensureConnected();
    if (!ok) {
      throw new Error('NCat is not connected.');
    }

    const fullId = String(chatId || '').trim();
    const splitAt = fullId.indexOf(':');
    if (splitAt <= 0 || splitAt === fullId.length - 1) {
      throw new Error(`Unsupported chat id: ${fullId}`);
    }

    const chatType = fullId.slice(0, splitAt);
    const chatTargetId = fullId.slice(splitAt + 1);
    const pokeId = String(pokeTargetId || (chatType === 'private' ? chatTargetId : '')).trim();
    if (!/^\d+$/.test(pokeId)) {
      throw new Error('戳一戳目标 QQ 号无效（必须是纯数字）。');
    }

    if (chatType === 'group') {
      const groupActionId = toActionId(chatTargetId);
      const pokeActionId = toActionId(pokeId);
      const label = `send_group_poke group_id=${chatTargetId}, user_id=${pokeId}`;
      const result = await this.callApiByAttempts(
        [
          {
            action: 'group_poke',
            params: {
              group_id: groupActionId,
              user_id: pokeActionId,
            },
          },
          {
            action: 'group_poke',
            params: {
              group_id: groupActionId,
              qq: pokeActionId,
            },
          },
          {
            action: 'send_group_msg',
            params: {
              group_id: groupActionId,
              message: [
                {
                  type: 'poke',
                  data: {
                    qq: pokeId,
                  },
                },
              ],
            },
          },
        ],
        label
      );
      this.log(`${label} success: action=${result.action}`);
      this.appendOutgoingPoke('group', chatTargetId, pokeId, result?.response?.data?.message_id);
      return result.response;
    }

    if (chatType === 'private') {
      const userActionId = toActionId(chatTargetId);
      const pokeActionId = toActionId(pokeId);
      const label = `send_private_poke user_id=${chatTargetId}, target=${pokeId}`;
      const result = await this.callApiByAttempts(
        [
          {
            action: 'friend_poke',
            params: {
              user_id: pokeActionId,
            },
          },
          {
            action: 'friend_poke',
            params: {
              qq: pokeActionId,
            },
          },
          {
            action: 'send_private_msg',
            params: {
              user_id: userActionId,
              message: [
                {
                  type: 'poke',
                  data: {
                    qq: pokeId,
                  },
                },
              ],
            },
          },
        ],
        label
      );
      this.log(`${label} success: action=${result.action}`);
      this.appendOutgoingPoke('private', chatTargetId, pokeId, result?.response?.data?.message_id);
      return result.response;
    }

    throw new Error(`Unsupported chat type: ${chatType}`);
  }

  async refreshMessageMediaForChat(chatId, options = {}) {
    const fullId = String(chatId || '').trim();
    if (!fullId) {
      throw new Error('chatId is empty');
    }

    const session = this.chatSessions.get(fullId);
    if (!session) {
      throw new Error(`chat session not found: ${fullId}`);
    }

    const localMessageId = String(options?.localMessageId || '').trim();
    const rawMessageIdInput = String(options?.rawMessageId || '').trim();
    const sourceUrl = String(options?.sourceUrl || '').trim();
    const trigger = String(options?.trigger || 'manual').trim();

    let targetMessage = null;
    if (localMessageId) {
      targetMessage = session.messages.find((item) => String(item?.id || '') === localMessageId) || null;
    }

    let rawMessageId = rawMessageIdInput;
    if (!rawMessageId && targetMessage) {
      rawMessageId = String(targetMessage.rawMessageId || '').trim();
    }
    if (!targetMessage && rawMessageId && session.messageIdIndex instanceof Map) {
      targetMessage = session.messageIdIndex.get(rawMessageId) || null;
    }
    if (!rawMessageId) {
      throw new Error('rawMessageId is empty');
    }

    const splitAt = fullId.indexOf(':');
    if (splitAt <= 0 || splitAt === fullId.length - 1) {
      throw new Error(`Unsupported chat id: ${fullId}`);
    }
    const chatType = fullId.slice(0, splitAt);
    const targetId = fullId.slice(splitAt + 1);
    if (chatType !== 'private' && chatType !== 'group') {
      throw new Error(`Unsupported chat type: ${chatType}`);
    }

    const noRetryKey = `${fullId}|${rawMessageId}`;
    if (this.mediaRetryNoRetryIds.has(noRetryKey)) {
      return {
        ok: false,
        updated: false,
        rawMessageId,
        noRetry: true,
        error: '消息不存在',
      };
    }

    this.log(
      `refreshMessageMedia start: chat=${fullId}, localMessageId=${localMessageId || '(none)'}, rawMessageId=${rawMessageId}, trigger=${trigger}, sourceUrl=${sourceUrl || '(none)'}`
    );

    const response = await this.callApi('get_msg', {
      message_id: toActionId(rawMessageId),
    });
    if (response?.status !== 'ok') {
      const retcode = Number(response?.retcode);
      const errText = String(response?.wording || response?.message || 'get_msg failed');
      const isMissing = retcode === 1200 || errText.includes('消息不存在');
      if (isMissing) {
        this.mediaRetryNoRetryIds.add(noRetryKey);
        if (this.mediaRetryNoRetryIds.size > 2000) {
          const first = this.mediaRetryNoRetryIds.values().next();
          if (first && !first.done) {
            this.mediaRetryNoRetryIds.delete(first.value);
          }
        }
        this.log(`refreshMessageMedia no-retry: chat=${fullId}, rawMessageId=${rawMessageId}, reason=${errText}`);
        return {
          ok: false,
          updated: false,
          rawMessageId,
          noRetry: true,
          error: errText,
        };
      }
      throw new Error(errText);
    }

    const normalized = normalizeSegments(response?.data || {});
    if (!Array.isArray(normalized) || normalized.length === 0) {
      throw new Error('get_msg returned empty segments');
    }

    const refreshedSegments = await this.decorateSegmentsForDisplay(normalized, {
      chatType,
      targetId,
      chatId: fullId,
      allowRemoteLookup: false,
    });
    if (!Array.isArray(refreshedSegments) || refreshedSegments.length === 0) {
      throw new Error('decorate refreshed segments failed');
    }

    if (!targetMessage) {
      this.log(`refreshMessageMedia skipped update: message not found in cache, chat=${fullId}, rawMessageId=${rawMessageId}`);
      return {
        ok: false,
        updated: false,
        rawMessageId,
        error: 'message not found in local cache',
      };
    }

    targetMessage.segments = refreshedSegments;
    const sender = response?.data?.sender || {};
    const senderId = String(sender?.user_id || '').trim();
    const senderName = String(sender?.card || sender?.nickname || '').trim();
    if (senderId) {
      targetMessage.senderId = senderId;
    }
    if (senderName) {
      targetMessage.senderName = senderName;
    }
    if (senderId && senderName) {
      this.rememberDisplayName(senderId, senderName, chatType === 'group' ? targetId : '');
    }

    this.pruneSessionMessages(session);
    this.emitUiUpdate();
    this.schedulePersistCache();
    this.log(`refreshMessageMedia success: chat=${fullId}, rawMessageId=${rawMessageId}, segments=${refreshedSegments.length}`);
    return {
      ok: true,
      updated: true,
      rawMessageId,
      segmentCount: refreshedSegments.length,
    };
  }

  parseRecentContacts(response) {
    return parseRecentContacts(this, response);
  }

  extractHistoryMessages(response) {
    return extractHistoryMessages(response);
  }

  async ingestHistoryMessage(item, contact, cutoffTs) {
    return ingestHistoryMessage(this, item, contact, cutoffTs);
  }

  async loadHistoryForContact(contact, cutoffTs, countOverride = 80) {
    return loadHistoryForContact(this, contact, cutoffTs, countOverride);
  }

  async loadRecentHistoryOneDay() {
    return loadRecentHistoryOneDay(this);
  }

  async loadOlderMessagesForChat(chatId) {
    return loadOlderMessagesForChat(this, chatId);
  }

  async getForwardPreview(forwardId, context = {}) {
    return getForwardPreview(this, forwardId, context);
  }

  async ensureConnected(timeoutMs = 7000) {
    if (this.isConnected()) {
      return true;
    }

    const wasConnecting = !!this.ws && this.ws.readyState === WebSocket.CONNECTING;
    if (!wasConnecting) {
      await this.connect({
        silent: true,
        reason: 'ensureConnected',
      });
    }

    if (this.isConnected()) {
      return true;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.CONNECTING) {
      this.log('ensureConnected() failed: no active connecting socket.');
      return false;
    }

    const socket = this.ws;
    this.log('Waiting for WebSocket open...');

    return new Promise((resolve) => {
      const finish = (result) => {
        clearTimeout(timer);
        socket.off('open', onOpen);
        socket.off('close', onClose);
        socket.off('error', onError);
        resolve(result);
      };

      const onOpen = () => finish(true);
      const onClose = () => finish(false);
      const onError = () => finish(false);

      const timer = setTimeout(() => {
        this.log(`ensureConnected() timeout after ${timeoutMs}ms`);
        finish(this.isConnected());
      }, timeoutMs);

      socket.once('open', onOpen);
      socket.once('close', onClose);
      socket.once('error', onError);
    });
  }

  callApi(action, params) {
    if (!this.isConnected() || !this.ws) {
      return Promise.reject(new Error('NCat is not connected.'));
    }

    const echo = `req-${++this.seq}`;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(echo);
        this.log(`API timeout: ${action}, echo=${echo}`);
        reject(new Error(`NCat API timeout: ${action}`));
      }, 8000);

      this.pendingRequests.set(echo, {
        resolve,
        reject,
        timeoutId,
      });

      this.ws.send(
        JSON.stringify({
          action,
          params,
          echo,
        })
      );
      this.log(`API request sent: ${action}, echo=${echo}`);
    });
  }

  startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(() => this.sendGetLoginInfo(), 20_000);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  handleMessage(raw) {
    try {
      const payload = JSON.parse(raw.toString());

      if (typeof payload.echo === 'string' && this.pendingRequests.has(payload.echo)) {
        const pending = this.pendingRequests.get(payload.echo);
        this.pendingRequests.delete(payload.echo);
        clearTimeout(pending.timeoutId);
        this.log(
          `API response: echo=${payload.echo}, status=${payload?.status || 'unknown'}, retcode=${payload?.retcode ?? 'n/a'}`
        );
        pending.resolve(payload);
        return;
      }

      if (typeof payload.echo === 'string' && payload.echo.startsWith(LOGIN_ECHO_PREFIX)) {
        const nickname = payload?.data?.nickname || 'unknown';
        const userId = payload?.data?.user_id || 'unknown';
        const prevUserId = this.selfUserId;
        this.selfUserId = String(userId);
        this.selfNickname = String(nickname);
        this.rememberDisplayName(this.selfUserId, this.selfNickname);
        if (prevUserId && prevUserId !== this.selfUserId) {
          this.contactDirectory.clear();
          this.contactDirectoryLoaded = false;
        }
        this.statusBar.text = `$(account) NCat: ${nickname}`;
        this.statusBar.tooltip = `QQ ${userId}`;
        this.log(`Login info updated: nickname=${nickname}, user_id=${userId}`);
        this.emitUiUpdate();
        if (!this.contactDirectoryLoaded && !this.contactDirectoryLoading) {
          this.refreshContactDirectory(false).catch((error) => {
            this.log(`refreshContactDirectory failed: ${error?.message || String(error)}`);
          });
        }
        if (!this.historyLoadedForConnection) {
          this.historyLoadedForConnection = true;
          this.loadRecentHistoryOneDay().catch((error) => {
            this.log(`loadRecentHistoryOneDay failed: ${error?.message || String(error)}`);
          });
        }
        return;
      }

      if (payload.post_type === 'message') {
        this.ingestIncomingMessage(payload).catch((error) => {
          this.log(`ingestIncomingMessage failed: ${error?.message || String(error)}`);
        });
        return;
      }

      if (payload.post_type === 'notice') {
        if (this.ingestPokeNotice(payload)) {
          return;
        }
        if (this.ingestRecallNotice(payload)) {
          return;
        }
      }
    } catch {
      // Ignore non-JSON frames.
    }
  }

  cleanupSocketOnly() {
    this.stopPolling();
    this.rejectAllPending(new Error('NCat request cancelled.'));

    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.close();
      } catch {
        // Ignore close errors.
      }
      this.ws = null;
    }
  }

  rejectAllPending(error) {
    for (const [echo, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeoutId);
      pending.reject(error);
      this.pendingRequests.delete(echo);
    }
  }

  async shutdownForDeactivate() {
    try {
      await this.stopBackend({
        trigger: 'deactivate-stop-backend',
        disconnectSocket: true,
        enterManualMode: false,
      });
    } catch (error) {
      this.log(`shutdownForDeactivate stopBackend failed: ${error?.message || String(error)}`);
    }
    this.releaseRuntimeLock();
    this.dispose();
  }

  dispose() {
    if (this.disposed) {
      return;
    }
    this.manualDisconnect = true;
    this.disposed = true;
    this.backendManagedActive = false;
    this.backendAttachedExisting = false;
    this.backendManualMode = false;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.persistCacheNow();
    this.clearReconnectTimer();
    this.cleanupSocketOnly();
    this.releaseRuntimeLock();
    this.statusBar.dispose();
    this.output.dispose();
    this.uiListeners.clear();
  }

  showLogs() {
    this.output.show(true);
  }

  log(message) {
    const now = new Date().toISOString();
    this.output.appendLine(`[${now}] ${message}`);
  }
}

module.exports = {
  NCatRuntime,
};
