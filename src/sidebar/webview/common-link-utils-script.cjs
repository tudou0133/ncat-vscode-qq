function renderCommonLinkUtilsScript() {
  return `
    function normalizeExternalUrl(rawValue) {
      const raw = String(rawValue || '')
        .split('\\\\/').join('/')
        .trim()
        .replace(/^['"]+|['"]+$/g, '')
        .replace(/[",]+$/g, '');
      if (!raw) {
        return '';
      }
      const lower = raw.toLowerCase();
      if (lower.startsWith('mqqapi://') || lower.startsWith('mqqopensdkapi://') || lower.startsWith('tencent.mobileqq://')) {
        return raw;
      }
      const firstSlash = raw.indexOf('/');
      const hostPart = firstSlash >= 0 ? raw.slice(0, firstSlash) : raw;
      if (hostPart.includes('.') && !hostPart.includes(' ') && !hostPart.includes(':')) {
        return 'https://' + raw;
      }
      if (lower.startsWith('http://') || lower.startsWith('https://')) {
        return raw;
      }
      if (raw.startsWith('//')) {
        return 'https:' + raw;
      }
      if (lower.startsWith('www.')) {
        return 'https://' + raw;
      }
      return '';
    }

    function collectHttpUrls(text) {
      const source = String(text || '').split('\\\\/').join('/');
      const lower = source.toLowerCase();
      const stopChars = [' ', '\\n', '\\r', '\\t', '"', "'", '<', '>'];
      const out = [];
      let cursor = 0;

      while (cursor < source.length) {
        const idxHttps = lower.indexOf('https://', cursor);
        const idxHttp = lower.indexOf('http://', cursor);
        const idxMqq = lower.indexOf('mqqapi://', cursor);
        const idxOpen = lower.indexOf('mqqopensdkapi://', cursor);
        const idxMobile = lower.indexOf('tencent.mobileqq://', cursor);

        const candidates = [idxHttps, idxHttp, idxMqq, idxOpen, idxMobile].filter((idx) => idx >= 0);
        let start = -1;
        if (candidates.length > 0) {
          start = Math.min(...candidates);
        }
        if (start < 0) {
          break;
        }

        let end = source.length;
        for (const stop of stopChars) {
          const idx = source.indexOf(stop, start);
          if (idx >= 0 && idx < end) {
            end = idx;
          }
        }
        const normalized = normalizeExternalUrl(source.slice(start, end));
        if (normalized) {
          out.push(normalized);
        }
        cursor = Math.max(start + 8, end);
      }

      return out;
    }

    function extractFirstHttpUrl(text) {
      const all = collectHttpUrls(text);
      if (all.length === 0) {
        return '';
      }
      const nonImage = all.find((item) => !isLikelyImageUrl(item));
      return nonImage || all[0];
    }

    function safeJsonParse(raw) {
      const text = String(raw || '');
      if (!text.trim()) {
        return null;
      }
      const decoded = text
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/&amp;/g, '&')
        .split('\\\\/').join('/');
      try {
        return JSON.parse(decoded);
      } catch {
        return null;
      }
    }

    function getByPath(obj, path) {
      const keys = String(path || '').split('.');
      let cur = obj;
      for (const key of keys) {
        if (!cur || typeof cur !== 'object' || !(key in cur)) {
          return '';
        }
        cur = cur[key];
      }
      return cur;
    }

    function resolveJsonSegmentUrl(seg) {
      const parsed = safeJsonParse(seg?.raw || '');
      if (parsed && typeof parsed === 'object') {
        const preferredPaths = [
          'meta.detail_1.qqdocurl',
          'meta.detail_1.jumpUrl',
          'meta.detail_1.targetUrl',
          'meta.detail_1.link',
          'meta.detail_1.href',
          'meta.news.jumpUrl',
          'meta.news.targetUrl',
          'meta.news.link',
          'meta.news.href',
          'meta.detail_1.url',
        ];
        for (const path of preferredPaths) {
          const value = normalizeExternalUrl(getByPath(parsed, path));
          if (value && !isLikelyImageUrl(value)) {
            return value;
          }
        }
      }
      const direct = normalizeExternalUrl(seg?.url || '');
      if (direct && !isLikelyImageUrl(direct)) {
        return direct;
      }
      const fromRaw = extractFirstHttpUrl(seg?.raw || '');
      if (fromRaw && !isLikelyImageUrl(fromRaw)) {
        return fromRaw;
      }
      const fromSummary = extractFirstHttpUrl(seg?.summary || '');
      if (fromSummary && !isLikelyImageUrl(fromSummary)) {
        return fromSummary;
      }
      return extractFirstHttpUrl(seg?.title || '');
    }

    function isInviteJson(seg, url) {
      const lowerUrl = String(url || '').toLowerCase();
      if (lowerUrl.includes('invite_join') || lowerUrl.includes('group/invite')) {
        return true;
      }
      const raw = String(seg?.raw || '').toLowerCase();
      if (raw.includes('qun.invite') || raw.includes('invite_join') || raw.includes('邀请你加入群聊')) {
        return true;
      }
      const title = String(seg?.title || '').toLowerCase();
      const summary = String(seg?.summary || '').toLowerCase();
      return title.includes('邀请') || summary.includes('邀请');
    }

    function setupHoverPopupPosition(chip, pop, kind) {
      const prefix = kind === 'video' ? '--video-pop-' : '--img-pop-';
      const maxVar = prefix + 'max-h';
      const shiftXVar = prefix + 'shift-x';
      const shiftYVar = prefix + 'shift-y';

      chip.addEventListener('mouseenter', () => {
        const viewportPadding = 8;
        const rect = chip.getBoundingClientRect();
        const spaceAbove = rect.top - viewportPadding;
        const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
        const preferDown = spaceBelow > 140 && spaceBelow >= spaceAbove;

        chip.style.setProperty(shiftXVar, '0px');
        chip.style.setProperty(shiftYVar, '0px');

        if (preferDown) {
          chip.classList.add('preview-down');
        } else {
          chip.classList.remove('preview-down');
        }

        const maxHeight = Math.max(120, Math.min(300, (preferDown ? spaceBelow : spaceAbove) - 10));
        chip.style.setProperty(maxVar, String(Math.round(maxHeight)) + 'px');

        requestAnimationFrame(() => {
          const popRect = pop.getBoundingClientRect();
          let shiftX = 0;
          let shiftY = 0;

          if (popRect.left < viewportPadding) {
            shiftX = viewportPadding - popRect.left;
          } else if (popRect.right > window.innerWidth - viewportPadding) {
            shiftX = (window.innerWidth - viewportPadding) - popRect.right;
          }

          if (!chip.classList.contains('preview-down') && popRect.top < viewportPadding) {
            if (spaceBelow > spaceAbove) {
              chip.classList.add('preview-down');
            } else {
              shiftY = viewportPadding - popRect.top;
            }
          } else if (chip.classList.contains('preview-down') && popRect.bottom > window.innerHeight - viewportPadding) {
            if (spaceAbove >= spaceBelow) {
              chip.classList.remove('preview-down');
            } else {
              shiftY = (window.innerHeight - viewportPadding) - popRect.bottom;
            }
          }

          chip.style.setProperty(shiftXVar, String(Math.round(shiftX)) + 'px');
          chip.style.setProperty(shiftYVar, String(Math.round(shiftY)) + 'px');
        });
      });

      chip.addEventListener('mouseleave', () => {
        chip.classList.remove('preview-down');
        chip.style.setProperty(shiftXVar, '0px');
        chip.style.setProperty(shiftYVar, '0px');
        chip.style.setProperty(maxVar, '250px');
      });
    }

    function isLikelyImageUrl(url) {
      const value = String(url || '').toLowerCase();
      if (!value) {
        return false;
      }
      return (
        value.includes('.png') ||
        value.includes('.jpg') ||
        value.includes('.jpeg') ||
        value.includes('.gif') ||
        value.includes('.webp') ||
        value.includes('.bmp') ||
        value.includes('.svg') ||
        value.includes('/logo/') ||
        value.includes('/avatar/') ||
        value.includes('/thumb/') ||
        value.includes('/cover/') ||
        value.includes('open.gtimg.cn/open/app_icon/') ||
        value.includes('qq.ugcimg.cn/') ||
        value.includes('multimedia.nt.qq.com.cn/download')
      );
    }
`;
}

module.exports = {
  renderCommonLinkUtilsScript,
};
