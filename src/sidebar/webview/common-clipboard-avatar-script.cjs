function renderCommonClipboardAvatarScript() {
  return `
    async function copyToClipboard(text) {
      const content = String(text || '');
      if (!content.trim()) {
        return false;
      }
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(content);
          return true;
        }
      } catch {
        // Fallback to execCommand below.
      }

      const area = document.createElement('textarea');
      area.value = content;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      area.style.pointerEvents = 'none';
      document.body.appendChild(area);
      area.focus();
      area.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      } finally {
        document.body.removeChild(area);
      }
      return ok;
    }

    function getMessageImageUrls(msg) {
      const urls = [];
      const seen = new Set();
      const segments = Array.isArray(msg?.segments) ? msg.segments : [];
      for (const seg of segments) {
        if (!seg || seg.type !== 'image') {
          continue;
        }
        const url = String(seg.url || '').trim();
        if (!url || seen.has(url)) {
          continue;
        }
        seen.add(url);
        urls.push(url);
      }
      return urls;
    }

    function clipForLog(text, max = 120) {
      const value = String(text || '');
      if (value.length <= max) {
        return value;
      }
      return value.slice(0, max) + '...';
    }

    async function fetchImageBlobForClipboard(url) {
      const source = String(url || '').trim();
      if (!source) {
        return null;
      }
      try {
        const response = await fetch(source, {
          cache: 'no-store',
          credentials: 'omit',
          mode: 'cors',
          referrerPolicy: 'no-referrer',
        });
        if (!response.ok) {
          return null;
        }
        const blob = await response.blob();
        if (!blob || !String(blob.type || '').toLowerCase().startsWith('image/')) {
          return null;
        }
        return blob;
      } catch {
        return null;
      }
    }

    async function copyImageToClipboard(url) {
      const source = String(url || '').trim();
      if (!source) {
        return {
          ok: false,
          reason: 'empty-url',
        };
      }
      if (!navigator?.clipboard?.write || typeof ClipboardItem === 'undefined') {
        return {
          ok: false,
          reason: 'clipboard-image-api-unavailable',
        };
      }
      const blob = await fetchImageBlobForClipboard(source);
      if (!blob) {
        return {
          ok: false,
          reason: 'image-fetch-failed-or-blocked',
        };
      }
      const mime = String(blob.type || 'image/png').toLowerCase();
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            [mime]: blob,
          }),
        ]);
        return {
          ok: true,
          reason: '',
          mime,
        };
      } catch (error) {
        return {
          ok: false,
          reason: String(error?.message || error || 'clipboard-write-failed'),
        };
      }
    }

    function attachAvatarImage(container, options) {
      const url = String(options?.url || '').trim();
      const fallbackText = String(options?.fallbackText || '?');
      const imageClassName = String(options?.imageClassName || 'avatar-img');
      const onError = typeof options?.onError === 'function' ? options.onError : null;

      container.textContent = '';
      const fallback = document.createElement('span');
      fallback.textContent = fallbackText;
      container.appendChild(fallback);
      if (!url) {
        return;
      }

      const loader = new Image();
      loader.referrerPolicy = 'no-referrer';
      loader.onload = () => {
        const avatarImg = document.createElement('img');
        avatarImg.className = imageClassName;
        avatarImg.loading = 'lazy';
        avatarImg.referrerPolicy = 'no-referrer';
        avatarImg.alt = fallbackText;
        avatarImg.src = url;
        fallback.style.display = 'none';
        container.appendChild(avatarImg);
      };
      loader.onerror = () => {
        fallback.style.display = '';
        if (onError) {
          onError();
        }
      };
      loader.src = url;
    }

    function logAvatarIssue(kind, msg, detail) {
      const key = kind + ':' + String(msg?.id || '') + ':' + String(msg?.senderId || '');
      if (avatarLogKeys.has(key)) {
        return;
      }
      avatarLogKeys.add(key);
      const sender = String(msg?.senderName || msg?.senderId || 'unknown');
      const senderId = String(msg?.senderId || 'unknown');
      const message = 'avatar ' + kind + ': sender=' + sender + ', senderId=' + senderId + (detail ? ', ' + detail : '');
      vscode.postMessage({
        type: 'webLog',
        level: 'warn',
        message,
      });
    }
`;
}

module.exports = {
  renderCommonClipboardAvatarScript,
};
