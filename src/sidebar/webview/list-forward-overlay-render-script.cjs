function renderListForwardOverlayRenderScript() {
  return String.raw`
    function renderMessageForwardPicker() {
      const overlay = document.getElementById('forwardPickerOverlay');
      const summaryNode = document.getElementById('forwardPickerSummary');
      const list = document.getElementById('forwardPickerList');
      const search = document.getElementById('forwardPickerSearch');
      if (!overlay || !summaryNode || !list || !search) {
        return;
      }

      overlay.classList.toggle('open', !!messageForwardPicker.open);
      overlay.setAttribute('aria-hidden', messageForwardPicker.open ? 'false' : 'true');
      summaryNode.textContent = String(messageForwardPicker.summary || '转发消息');

      if (!messageForwardPicker.open) {
        return;
      }

      if (search.value !== String(messageForwardPicker.query || '')) {
        search.value = String(messageForwardPicker.query || '');
      }

      list.innerHTML = '';
      const query = String(messageForwardPicker.query || '').trim();
      const chats = filterChatsByQuery(Array.isArray(state.chats) ? state.chats : [], query);

      if (!Array.isArray(chats) || chats.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.style.margin = 'auto 0';
        empty.textContent = query ? '没有匹配的会话。' : '当前没有可转发的会话。';
        list.appendChild(empty);
        return;
      }

      for (const chat of chats) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'forward-target-card' + (messageForwardPicker.sendingChatId === chat.id ? ' sending' : '');

        const avatar = document.createElement('div');
        avatar.className = 'forward-target-avatar';
        attachAvatarImage(avatar, {
          url: chat.avatarUrl,
          fallbackText: String(chat.title || '?').slice(0, 1),
          imageClassName: 'avatar-img',
        });

        const meta = document.createElement('div');
        meta.className = 'forward-target-meta';

        const name = document.createElement('div');
        name.className = 'forward-target-name';
        name.textContent = String(chat.title || chat.id || '会话');

        const sub = document.createElement('div');
        sub.className = 'forward-target-sub';
        sub.textContent = (chat.type === 'group' ? '群聊' : '私聊') + ' · ' + String(chat.targetId || '');

        meta.appendChild(name);
        meta.appendChild(sub);
        button.appendChild(avatar);
        button.appendChild(meta);

        button.addEventListener('click', () => {
          if (!messageForwardPicker.draft || messageForwardPicker.sendingChatId) {
            return;
          }
          if (chat.id === String(state.selectedChatId || '')) {
            forceScrollBottom = true;
          }
          messageForwardPicker.sendingChatId = chat.id;
          renderMessageForwardPicker();

          const draft = messageForwardPicker.draft;
          if (draft.mode === 'json') {
            vscode.postMessage({
              type: 'sendJsonMessage',
              chatId: chat.id,
              rawJson: String(draft.rawJson || ''),
              replyToMessageId: '',
            });
            closeMessageForwardPicker();
            return;
          }

          if (draft.mode === 'message') {
            (async () => {
              const imageUrls = Array.isArray(draft.imageUrls) ? draft.imageUrls : [];
              const images = [];
              for (const url of imageUrls) {
                try {
                  const directDataUrl = String(url || '').trim();
                  if (directDataUrl.startsWith('data:image/')) {
                    images.push({
                      name: 'image.png',
                      dataUrl: directDataUrl,
                    });
                    continue;
                  }
                  const resolved = await requestResolveImageUrl(url);
                  const dataUrl = String(resolved?.dataUrl || '').trim();
                  if (!dataUrl.startsWith('data:image/')) {
                    continue;
                  }
                  images.push({
                    name: String(resolved?.name || 'image.png'),
                    dataUrl,
                  });
                } catch (error) {
                  logWeb('warn', 'forward picker image resolve failed: url=' + clipForLog(url) + ', reason=' + String(error?.message || error));
                }
              }

              vscode.postMessage({
                type: 'sendChatMessage',
                chatId: chat.id,
                text: String(draft.text || ''),
                replyToMessageId: '',
                images,
              });
              closeMessageForwardPicker();
            })().catch((error) => {
              logWeb('warn', 'forward picker send failed: ' + String(error?.message || error));
              messageForwardPicker.sendingChatId = '';
              renderMessageForwardPicker();
            });
            return;
          }

          messageForwardPicker.sendingChatId = '';
          renderMessageForwardPicker();
        });

        list.appendChild(button);
      }
    }

    function renderForwardPreview() {
      const overlay = document.getElementById('forwardOverlay');
      const titleNode = document.getElementById('forwardTitle');
      const body = document.getElementById('forwardBody');
      const backButton = document.getElementById('btnBackForward');

      overlay.classList.toggle('open', !!forwardPreview.open);
      overlay.setAttribute('aria-hidden', forwardPreview.open ? 'false' : 'true');
      titleNode.textContent = forwardPreview.title || '合并转发';
      if (backButton) {
        backButton.hidden = !Array.isArray(forwardPreviewStack) || forwardPreviewStack.length === 0;
      }
      body.innerHTML = '';

      if (!forwardPreview.open) {
        return;
      }

      if (forwardPreview.loading) {
        const loading = document.createElement('div');
        loading.className = 'empty';
        loading.style.margin = 'auto 0';
        loading.textContent = '正在加载合并转发...';
        body.appendChild(loading);
        return;
      }

      if (forwardPreview.error) {
        const error = document.createElement('div');
        error.className = 'empty';
        error.style.margin = 'auto 0';
        error.textContent = '加载失败: ' + forwardPreview.error;
        body.appendChild(error);
        return;
      }

      if (!Array.isArray(forwardPreview.nodes) || forwardPreview.nodes.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.style.margin = 'auto 0';
        empty.textContent = '这条合并转发没有可显示内容。';
        body.appendChild(empty);
        return;
      }

      for (const node of forwardPreview.nodes) {
        const row = document.createElement('div');
        row.className = 'msg-row in';

        const avatar = document.createElement('span');
        avatar.className = 'msg-avatar';
        const sender = String(node.senderName || node.senderId || 'unknown');
        attachAvatarImage(avatar, {
          url: node.avatarUrl,
          fallbackText: sender.slice(0, 1),
          imageClassName: 'msg-avatar-img',
        });

        const main = document.createElement('div');
        main.className = 'msg-main';

        const meta = document.createElement('div');
        meta.className = 'msg-meta';

        const senderNode = document.createElement('span');
        senderNode.className = 'msg-sender';
        senderNode.textContent = sender;

        const timeNode = document.createElement('span');
        timeNode.className = 'msg-time';
        timeNode.textContent = fmtTime(node.timestamp);

        meta.appendChild(senderNode);
        meta.appendChild(timeNode);

        const content = document.createElement('div');
        content.className = 'msg-bubble';
        const segments = Array.isArray(node.segments) ? node.segments : [];
        const totalImages = segments.reduce((count, seg) => (seg && seg.type === 'image' ? count + 1 : count), 0);
        let imageIndex = 0;
        for (const seg of segments) {
          let segmentNode;
          if (seg && seg.type === 'image') {
            imageIndex += 1;
            segmentNode = buildSegment(seg, { index: imageIndex, total: totalImages });
          } else {
            segmentNode = buildSegment(seg, { index: 0, total: totalImages });
          }
          content.appendChild(segmentNode);
        }

        main.appendChild(meta);
        main.appendChild(content);

        row.appendChild(avatar);
        row.appendChild(main);
        body.appendChild(row);
      }
    }
`;
}

module.exports = {
  renderListForwardOverlayRenderScript,
};
