const { renderComposerJsonPanelScript } = require('./composer-json-panel-script.cjs');
const { renderComposerStickerPanelScript } = require('./composer-sticker-panel-script.cjs');

function renderComposerPanelScript() {
  return `
${renderComposerJsonPanelScript()}

${renderComposerStickerPanelScript()}

    function enqueueImageDataUrl(dataUrl, name, source) {
      const value = String(dataUrl || '').trim();
      if (!value || !value.startsWith('data:image/')) {
        logWeb('warn', 'enqueueImageDataUrl ignored: invalid dataUrl, source=' + String(source || 'unknown'));
        return false;
      }
      pendingImages.push({
        id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8),
        name: String(name || (String(source || 'image') + '.png')),
        dataUrl: value,
      });
      return true;
    }

    function isResolvableImageUrl(url) {
      const value = String(url || '').trim().toLowerCase();
      if (!value) {
        return false;
      }
      if (!(value.startsWith('http://') || value.startsWith('https://'))) {
        return false;
      }
      if (isLikelyImageUrl(value)) {
        return true;
      }
      if (value.includes('multimedia.nt.qq.com.cn/download')) {
        return true;
      }
      return false;
    }

    function extractResolvableImageUrls(text) {
      const all = collectHttpUrls(text);
      if (all.length === 0) {
        return [];
      }
      const out = [];
      const seen = new Set();
      for (const raw of all) {
        const url = String(raw || '').trim();
        if (!isResolvableImageUrl(url)) {
          continue;
        }
        if (seen.has(url)) {
          continue;
        }
        seen.add(url);
        out.push(url);
      }
      return out;
    }

    function requestResolveImageUrl(url) {
      const raw = String(url || '').trim();
      if (!raw) {
        return Promise.reject(new Error('empty image url'));
      }
      const requestId = 'img-' + String(Date.now()) + '-' + String(++resolveImageReqSeq);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pendingResolveImageRequests.delete(requestId);
          reject(new Error('resolve timeout'));
        }, 15000);
        pendingResolveImageRequests.set(requestId, { resolve, reject, timer, url: raw });
        logWeb('info', 'resolveImageUrl request: id=' + requestId + ', url=' + clipForLog(raw));
        vscode.postMessage({
          type: 'resolveImageUrl',
          requestId,
          url: raw,
        });
      });
    }

    function logDragEvent(phase, dataTransfer, extra) {
      const now = Date.now();
      if (phase.indexOf('dragover') >= 0 && now - lastDragLogAt < 400) {
        return;
      }
      lastDragLogAt = now;
      logWeb('info', phase + ': ' + describeTransfer(dataTransfer) + (extra ? ', ' + extra : ''));
    }

    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('read file failed'));
        reader.readAsDataURL(file);
      });
    }

    async function enqueueImageFiles(files, source) {
      const imageFiles = Array.from(files || []).filter((file) => isImageLikeFile(file));
      if (imageFiles.length === 0) {
        return false;
      }

      for (const file of imageFiles) {
        try {
          const dataUrl = await readFileAsDataUrl(file);
          enqueueImageDataUrl(dataUrl, String(file.name || ''), source);
        } catch (error) {
          vscode.postMessage({
            type: 'webLog',
            level: 'warn',
            message: 'composer image enqueue failed: source=' + String(source || 'unknown') + ', reason=' + String(error?.message || error),
          });
        }
      }

      renderComposerAttachments();
      renderComposerState();
      return true;
    }

    function isImageLikeFile(file) {
      if (!file) {
        return false;
      }
      const mime = String(file.type || '').toLowerCase();
      if (mime.startsWith('image/')) {
        return true;
      }
      return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(String(file.name || ''));
    }

    function describeTransfer(dataTransfer) {
      const items = Array.from(dataTransfer?.items || []);
      const files = Array.from(dataTransfer?.files || []);
      return 'items=' + items.length
        + ', files=' + files.length
        + ', itemTypes=' + items.map((item) => String(item.type || item.kind || '?')).join('|')
        + ', fileNames=' + files.map((file) => String(file.name || '?')).join('|');
    }

    function transferHasImage(dataTransfer) {
      const items = Array.from(dataTransfer?.items || []);
      if (items.some((item) => String(item.type || '').toLowerCase().startsWith('image/'))) {
        return true;
      }
      const files = Array.from(dataTransfer?.files || []);
      return files.some((file) => isImageLikeFile(file));
    }

    function extractImageFilesFromTransfer(dataTransfer) {
      const itemFiles = Array.from(dataTransfer?.items || [])
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter(Boolean);
      const directFiles = Array.from(dataTransfer?.files || []).filter(Boolean);
      const merged = itemFiles.length > 0 ? itemFiles : directFiles;
      return merged.filter((file) => isImageLikeFile(file));
    }

    function renderComposerState() {
      const input = document.getElementById('composerInput');
      const sendBtn = document.getElementById('btnSend');
      const selected = getSelectedChat();
      const hasContent = !!input.value.trim() || pendingImages.length > 0;
      const canSend = !!selected && state.connectionState === 'online' && !sendBusy && hasContent;

      input.disabled = !selected || sendBusy;
      sendBtn.disabled = !canSend;
    }

    function renderComposerAttachments() {
      const root = document.getElementById('composerAttachments');
      root.innerHTML = '';
      root.classList.toggle('has-items', pendingImages.length > 0);

      for (const image of pendingImages) {
        const chip = document.createElement('div');
        chip.className = 'attach-chip';

        const thumb = document.createElement('img');
        thumb.className = 'attach-thumb';
        thumb.loading = 'lazy';
        thumb.src = image.dataUrl;
        thumb.alt = image.name || 'image';

        const name = document.createElement('div');
        name.className = 'attach-name';
        name.textContent = image.name || 'image';

        const remove = document.createElement('button');
        remove.className = 'attach-remove';
        remove.type = 'button';
        remove.textContent = 'x';
        remove.addEventListener('click', () => {
          pendingImages = pendingImages.filter((item) => item.id !== image.id);
          renderComposerAttachments();
          renderComposerState();
        });

        chip.appendChild(thumb);
        chip.appendChild(name);
        chip.appendChild(remove);
        root.appendChild(chip);
      }
    }
`;
}

module.exports = {
  renderComposerPanelScript,
};
