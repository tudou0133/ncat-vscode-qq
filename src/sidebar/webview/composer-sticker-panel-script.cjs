function renderComposerStickerPanelScript() {
  return `
    let stickerItemMenuState = {
      open: false,
      id: '',
      name: '',
    };

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
`;
}

module.exports = {
  renderComposerStickerPanelScript,
};
