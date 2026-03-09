function renderComposerScript() {
  return String.raw`
    const JSON_MESSAGE_SAMPLE = '{"app":"com.tencent.tuwen.lua","view":"news","meta":{"news":{"title":"标题","desc":"描述","jumpUrl":"https://example.com"}}}';
    let jsonComposerDraft = JSON_MESSAGE_SAMPLE;
    let stickerItemMenuState = {
      open: false,
      id: '',
      name: '',
    };

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

    function closeStickerItemMenu() {
      stickerItemMenuState.open = false;
      stickerItemMenuState.id = '';
      stickerItemMenuState.name = '';
      const menu = document.getElementById('stickerItemMenu');
      if (menu) {
        menu.hidden = true;
      }
    }

    function openStickerItemMenu(item, clientX, clientY) {
      const menu = document.getElementById('stickerItemMenu');
      if (!menu || !item) {
        return;
      }
      stickerItemMenuState.open = true;
      stickerItemMenuState.id = String(item.id || '').trim();
      stickerItemMenuState.name = String(item.name || '').trim();
      menu.hidden = false;

      const stage = document.getElementById('stage');
      const stageRect = stage ? stage.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      const viewportPadding = 8;
      const rect = menu.getBoundingClientRect();
      const left = Math.min(
        Math.max(viewportPadding, Number(clientX || 0) - stageRect.left),
        Math.max(viewportPadding, stageRect.width - rect.width - viewportPadding)
      );
      const top = Math.min(
        Math.max(viewportPadding, Number(clientY || 0) - stageRect.top),
        Math.max(viewportPadding, stageRect.height - rect.height - viewportPadding)
      );
      menu.style.left = String(Math.round(left)) + 'px';
      menu.style.top = String(Math.round(top)) + 'px';
    }

    function closeJsonComposer() {
      const overlay = document.getElementById('jsonComposerOverlay');
      const errorNode = document.getElementById('jsonComposerError');
      if (overlay) {
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
      }
      if (errorNode) {
        errorNode.textContent = '';
      }
    }

    function openJsonComposer() {
      const overlay = document.getElementById('jsonComposerOverlay');
      const input = document.getElementById('jsonComposerInput');
      const errorNode = document.getElementById('jsonComposerError');
      if (!overlay || !input) {
        return;
      }
      input.value = jsonComposerDraft || JSON_MESSAGE_SAMPLE;
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      if (errorNode) {
        errorNode.textContent = '';
      }
      requestAnimationFrame(() => {
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
      });
    }

    function submitJsonComposer() {
      if (sendBusy) {
        return;
      }
      const selected = getSelectedChat();
      if (!selected) {
        logWeb('warn', 'json send ignored: no selected chat');
        closeJsonComposer();
        return;
      }
      const input = document.getElementById('jsonComposerInput');
      const errorNode = document.getElementById('jsonComposerError');
      const raw = String(input?.value || '').trim();
      jsonComposerDraft = raw || jsonComposerDraft;
      if (!raw) {
        if (errorNode) {
          errorNode.textContent = 'JSON 不能为空。';
        }
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
          if (errorNode) {
            errorNode.textContent = 'JSON 根节点必须是对象。';
          }
          return;
        }
        vscode.postMessage({
          type: 'sendJsonMessage',
          chatId: selected.id,
          rawJson: JSON.stringify(parsed),
          replyToMessageId: String(pendingReply.messageId || ''),
        });
        closeJsonComposer();
      } catch (error) {
        if (errorNode) {
          errorNode.textContent = 'JSON 格式错误: ' + String(error?.message || error);
        }
      }
    }

    function closeStickerPanel() {
      stickerPanelState.open = false;
      const panel = document.getElementById('stickerPanel');
      if (panel) {
        panel.hidden = true;
      }
      closeStickerItemMenu();
    }

    function renderStickerPanel() {
      const panel = document.getElementById('stickerPanel');
      const body = document.getElementById('stickerPanelBody');
      const title = document.getElementById('stickerPanelTitle');
      if (!panel || !body || !title) {
        return;
      }
      panel.hidden = !stickerPanelState.open;
      if (!stickerPanelState.open) {
        return;
      }
      title.textContent = stickerPanelState.dir
        ? ('表情包 · ' + stickerPanelState.items.length + ' 张')
        : ('表情包 · ' + stickerPanelState.items.length + ' 张');

      body.innerHTML = '';
      if (stickerPanelState.loading) {
        const loading = document.createElement('div');
        loading.className = 'sticker-panel-empty';
        loading.textContent = '正在加载表情包...';
        body.appendChild(loading);
        return;
      }

      if (stickerPanelState.error) {
        const failed = document.createElement('div');
        failed.className = 'sticker-panel-empty';
        failed.textContent = '加载失败: ' + stickerPanelState.error;
        body.appendChild(failed);
        return;
      }

      if (!Array.isArray(stickerPanelState.items) || stickerPanelState.items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'sticker-panel-empty';
        empty.textContent = '还没有收藏表情。先在消息气泡右键里“添加到表情包”。';
        body.appendChild(empty);
        return;
      }

      for (const item of stickerPanelState.items) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sticker-item';
        btn.title = item.name || 'sticker';

        const img = document.createElement('img');
        img.className = 'sticker-thumb';
        img.loading = 'lazy';
        img.alt = item.name || 'sticker';
        img.src = item.dataUrl;
        btn.appendChild(img);

        btn.addEventListener('click', () => {
          const selected = getSelectedChat();
          if (!selected) {
            logWeb('warn', 'sticker send ignored: no selected chat');
            return;
          }
          if (!String(item.dataUrl || '').startsWith('data:image/')) {
            logWeb('warn', 'sticker send ignored: invalid data url');
            return;
          }
          forceScrollBottom = true;
          vscode.postMessage({
            type: 'sendStickerQuick',
            chatId: selected.id,
            name: item.name || 'sticker.png',
            dataUrl: item.dataUrl,
            replyToMessageId: String(pendingReply.messageId || ''),
          });
        });

        btn.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
          openStickerItemMenu(item, event.clientX, event.clientY);
        });

        body.appendChild(btn);
      }
    }

    function requestStickerPackList(force = false) {
      stickerPanelState.loading = true;
      if (force) {
        stickerPanelState.error = '';
      }
      renderStickerPanel();
      vscode.postMessage({
        type: 'listStickerPack',
        force: !!force,
      });
    }

    function setupComposer() {
      const composerNode = document.querySelector('.composer');
      const composerInput = document.getElementById('composerInput');
      const composerFilePicker = document.getElementById('composerFilePicker');
      const stickerImportPicker = document.getElementById('stickerImportPicker');
      const stickerPanel = document.getElementById('stickerPanel');
      const stickerBtn = document.getElementById('btnStickerPack');

      composerInput.addEventListener('paste', async (event) => {
        const items = Array.from(event.clipboardData?.items || []);
        const files = items
          .filter((item) => item.kind === 'file' && String(item.type || '').startsWith('image/'))
          .map((item) => item.getAsFile())
          .filter(Boolean);
        if (files.length > 0) {
          event.preventDefault();
          await enqueueImageFiles(files, 'paste');
          return;
        }

        const plainText = String(event.clipboardData?.getData('text/plain') || '').trim();
        if (!plainText) {
          return;
        }
        const imageUrls = extractResolvableImageUrls(plainText);
        if (imageUrls.length === 0) {
          return;
        }

        event.preventDefault();
        let resolvedCount = 0;
        for (const url of imageUrls) {
          try {
            const resolved = await requestResolveImageUrl(url);
            const ok = enqueueImageDataUrl(resolved?.dataUrl || '', resolved?.name || 'image.png', 'paste-url');
            if (ok) {
              resolvedCount += 1;
            }
          } catch (error) {
            logWeb('warn', 'paste image url resolve failed: url=' + clipForLog(url) + ', reason=' + String(error?.message || error));
          }
        }
        if (resolvedCount > 0) {
          renderComposerAttachments();
          renderComposerState();
          logWeb('info', 'paste image url resolved: urls=' + String(imageUrls.length) + ', success=' + String(resolvedCount));
        } else {
          logWeb('warn', 'paste image url ignored: resolve failed for all urls, count=' + String(imageUrls.length));
        }
      });

      document.getElementById('btnPickImage').addEventListener('click', () => {
        composerFilePicker.click();
      });

      document.getElementById('btnSendJson').addEventListener('click', () => {
        openJsonComposer();
      });

      document.getElementById('btnCloseJsonComposer').addEventListener('click', () => {
        closeJsonComposer();
      });

      document.getElementById('btnCancelJsonComposer').addEventListener('click', () => {
        closeJsonComposer();
      });

      document.getElementById('btnSendJsonComposer').addEventListener('click', () => {
        submitJsonComposer();
      });

      document.getElementById('jsonComposerInput').addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          submitJsonComposer();
        }
      });

      document.getElementById('stickerItemMenuAdd').addEventListener('click', () => {
        closeStickerItemMenu();
        if (stickerImportPicker) {
          stickerImportPicker.click();
        }
      });

      document.getElementById('stickerItemMenuDelete').addEventListener('click', () => {
        const stickerId = String(stickerItemMenuState.id || '').trim();
        if (!stickerId) {
          closeStickerItemMenu();
          return;
        }
        vscode.postMessage({
          type: 'removeFromStickerPack',
          id: stickerId,
        });
        closeStickerItemMenu();
      });

      stickerBtn.addEventListener('click', () => {
        if (stickerPanelState.open) {
          closeStickerPanel();
          return;
        }
        stickerPanelState.open = true;
        renderStickerPanel();
        const stale = (Date.now() - Number(stickerPanelState.lastLoadedAt || 0)) > 30_000;
        if (stale || !Array.isArray(stickerPanelState.items) || stickerPanelState.items.length === 0) {
          requestStickerPackList(true);
        }
      });

      composerFilePicker.addEventListener('change', async (event) => {
        const files = Array.from(event.target?.files || []);
        if (files.length === 0) {
          return;
        }
        await enqueueImageFiles(files, 'picker');
        composerFilePicker.value = '';
      });

      stickerImportPicker?.addEventListener('change', async (event) => {
        const files = Array.from(event.target?.files || []);
        if (files.length === 0) {
          return;
        }
        const images = [];
        for (const file of files) {
          if (!isImageLikeFile(file)) {
            continue;
          }
          try {
            const dataUrl = await readFileAsDataUrl(file);
            if (String(dataUrl || '').startsWith('data:image/')) {
              images.push({
                name: String(file.name || 'sticker.png'),
                dataUrl,
              });
            }
          } catch (error) {
            logWeb('warn', 'sticker import read failed: ' + String(error?.message || error));
          }
        }
        if (images.length > 0) {
          vscode.postMessage({
            type: 'addImagesToStickerPack',
            images,
          });
        } else {
          logWeb('warn', 'sticker import ignored: no readable images');
        }
        if (stickerImportPicker) {
          stickerImportPicker.value = '';
        }
      });

      function handleComposerDragOver(event) {
        const files = extractImageFilesFromTransfer(event.dataTransfer);
        const hasImage = transferHasImage(event.dataTransfer);
        logDragEvent('composer dragover', event.dataTransfer, 'hasImage=' + hasImage + ', imageFiles=' + files.length);
        if (!hasImage) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'copy';
        }
        composerNode.classList.add('dragover');
      }

      async function handleComposerDrop(event) {
        const files = extractImageFilesFromTransfer(event.dataTransfer);
        const hasImage = transferHasImage(event.dataTransfer);
        logDragEvent('composer drop', event.dataTransfer, 'hasImage=' + hasImage + ', imageFiles=' + files.length);
        composerNode.classList.remove('dragover');
        if (!hasImage) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const accepted = await enqueueImageFiles(files, 'drop');
        if (!accepted) {
          logWeb('warn', 'composer drop ignored after extraction: no readable image file');
        }
      }

      document.addEventListener('dragenter', (event) => {
        const hasImage = transferHasImage(event.dataTransfer);
        logDragEvent('document dragenter', event.dataTransfer, 'hasImage=' + hasImage);
        if (hasImage) {
          event.preventDefault();
        }
      }, true);

      document.addEventListener('dragover', (event) => {
        const hasImage = transferHasImage(event.dataTransfer);
        if (!hasImage) {
          return;
        }
        logDragEvent('document dragover', event.dataTransfer, 'hasImage=' + hasImage);
        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'copy';
        }
      }, true);

      document.addEventListener('drop', async (event) => {
        const files = extractImageFilesFromTransfer(event.dataTransfer);
        const hasImage = transferHasImage(event.dataTransfer);
        logDragEvent('document drop', event.dataTransfer, 'hasImage=' + hasImage + ', imageFiles=' + files.length);
        if (!hasImage) {
          return;
        }
        event.preventDefault();
        composerNode.classList.remove('dragover');
        const accepted = await enqueueImageFiles(files, 'document-drop');
        if (!accepted) {
          logWeb('warn', 'document drop ignored after extraction: no readable image file');
        }
      }, true);

      window.addEventListener('dragenter', (event) => {
        const hasImage = transferHasImage(event.dataTransfer);
        logDragEvent('window dragenter', event.dataTransfer, 'hasImage=' + hasImage);
        if (hasImage) {
          event.preventDefault();
        }
      });

      window.addEventListener('dragover', (event) => {
        const hasImage = transferHasImage(event.dataTransfer);
        if (hasImage) {
          logDragEvent('window dragover', event.dataTransfer, 'hasImage=' + hasImage);
          event.preventDefault();
          if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
          }
        }
      });

      window.addEventListener('drop', async (event) => {
        const files = extractImageFilesFromTransfer(event.dataTransfer);
        const hasImage = transferHasImage(event.dataTransfer);
        logDragEvent('window drop', event.dataTransfer, 'hasImage=' + hasImage + ', imageFiles=' + files.length);
        if (hasImage) {
          event.preventDefault();
          const accepted = await enqueueImageFiles(files, 'window-drop');
          if (!accepted) {
            logWeb('warn', 'window drop ignored after extraction: no readable image file');
          }
        }
      });

      composerNode.addEventListener('dragenter', handleComposerDragOver);
      composerNode.addEventListener('dragover', handleComposerDragOver);
      composerInput.addEventListener('dragenter', handleComposerDragOver);
      composerInput.addEventListener('dragover', handleComposerDragOver);

      composerNode.addEventListener('dragleave', (event) => {
        if (event.currentTarget === event.target || !composerNode.contains(event.relatedTarget)) {
          composerNode.classList.remove('dragover');
        }
      });

      composerNode.addEventListener('drop', handleComposerDrop);
      composerInput.addEventListener('drop', handleComposerDrop);

      function sendFromComposer() {
        if (sendBusy) {
          return;
        }

        const selected = getSelectedChat();
        if (!selected) {
          renderComposerState();
          return;
        }

        const input = document.getElementById('composerInput');
        const text = input.value.trim();
        if (!text && pendingImages.length === 0) {
          return;
        }

        sendBusy = true;
        forceScrollBottom = true;
        renderComposerState();
        vscode.postMessage({
          type: 'sendChatMessage',
          chatId: selected.id,
          text,
          replyToMessageId: String(pendingReply.messageId || ''),
          images: pendingImages.map((item) => ({
            name: item.name,
            dataUrl: item.dataUrl,
          })),
        });
      }

      document.getElementById('btnSend').addEventListener('click', () => {
        sendFromComposer();
      });

      document.getElementById('composerInput').addEventListener('keydown', (event) => {
        if (mentionState.open && mentionState.candidates.length > 0) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            mentionState.selectedIndex = (mentionState.selectedIndex + 1) % mentionState.candidates.length;
            renderMentionMenu();
            return;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            mentionState.selectedIndex =
              (mentionState.selectedIndex - 1 + mentionState.candidates.length) % mentionState.candidates.length;
            renderMentionMenu();
            return;
          }
          if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            applyMentionCandidate(mentionState.candidates[mentionState.selectedIndex]);
            return;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            closeMentionMenu();
            return;
          }
        }
        if (event.isComposing) {
          return;
        }
        if (uiPrefs.enterToSend) {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendFromComposer();
          }
          return;
        }
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          sendFromComposer();
        }
      });

      document.getElementById('composerInput').addEventListener('input', () => {
        const input = document.getElementById('composerInput');
        if (input) {
          composerSelection.start = Number(input.selectionStart || 0);
          composerSelection.end = Number(input.selectionEnd || composerSelection.start);
        }
        renderComposerState();
        updateMentionMenuFromInput();
      });

      document.getElementById('composerInput').addEventListener('click', () => {
        const input = document.getElementById('composerInput');
        if (input) {
          composerSelection.start = Number(input.selectionStart || 0);
          composerSelection.end = Number(input.selectionEnd || composerSelection.start);
        }
        updateMentionMenuFromInput();
      });

      document.getElementById('composerInput').addEventListener('blur', () => {
        const input = document.getElementById('composerInput');
        if (input) {
          composerSelection.start = Number(input.selectionStart || composerSelection.start || 0);
          composerSelection.end = Number(input.selectionEnd || composerSelection.start);
        }
        setTimeout(() => {
          closeMentionMenu();
        }, 80);
      });

      document.getElementById('composerInput').addEventListener('keyup', () => {
        const input = document.getElementById('composerInput');
        if (input) {
          composerSelection.start = Number(input.selectionStart || 0);
          composerSelection.end = Number(input.selectionEnd || composerSelection.start);
        }
        updateMentionMenuFromInput();
      });

      document.getElementById('composerInput').addEventListener('select', () => {
        const input = document.getElementById('composerInput');
        if (input) {
          composerSelection.start = Number(input.selectionStart || 0);
          composerSelection.end = Number(input.selectionEnd || composerSelection.start);
        }
      });

      document.addEventListener('mousedown', (event) => {
        const jsonOverlay = document.getElementById('jsonComposerOverlay');
        const jsonPanel = document.getElementById('jsonComposerPanel');
        if (jsonOverlay && jsonOverlay.classList.contains('open')) {
          if (!jsonPanel || !jsonPanel.contains(event.target)) {
            closeJsonComposer();
          }
          return;
        }

        const stickerItemMenu = document.getElementById('stickerItemMenu');
        if (stickerItemMenu && !stickerItemMenu.hidden) {
          if (!stickerItemMenu.contains(event.target)) {
            closeStickerItemMenu();
          } else {
            return;
          }
        }

        if (!stickerPanelState.open) {
          return;
        }
        if (stickerPanel && stickerPanel.contains(event.target)) {
          return;
        }
        if (stickerBtn && stickerBtn.contains(event.target)) {
          return;
        }
        closeStickerPanel();
      });

      document.addEventListener('contextmenu', (event) => {
        const stickerItemMenu = document.getElementById('stickerItemMenu');
        if (stickerItemMenu && !stickerItemMenu.hidden && !stickerItemMenu.contains(event.target)) {
          closeStickerItemMenu();
        }
      });

      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') {
          return;
        }
        const jsonOverlay = document.getElementById('jsonComposerOverlay');
        if (jsonOverlay && jsonOverlay.classList.contains('open')) {
          event.preventDefault();
          closeJsonComposer();
          return;
        }
        const stickerItemMenu = document.getElementById('stickerItemMenu');
        if (stickerItemMenu && !stickerItemMenu.hidden) {
          event.preventDefault();
          closeStickerItemMenu();
        }
      });
    }
  `;
}

module.exports = {
  renderComposerScript,
};
