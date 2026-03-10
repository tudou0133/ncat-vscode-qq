function renderComposerSetupPanelsScript() {
  return String.raw`
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
`;
}

module.exports = {
  renderComposerSetupPanelsScript,
};
