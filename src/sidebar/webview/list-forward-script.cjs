function renderListForwardScript() {
  return String.raw`
    let lastDetailOpenState = false;

    function renderPageState() {
      const stage = document.getElementById('stage');
      const selected = isPluginRunning() ? getSelectedChat() : null;
      const title = document.getElementById('detailTitle');
      const detailOpen = !!selected;
      if (selected) {
        stage.classList.add('detail-open');
        title.textContent = selected.title || '消息';
      } else {
        stage.classList.remove('detail-open');
        title.textContent = '消息';
        closeMentionMenu();
      }
      if (detailOpen !== lastDetailOpenState) {
        closeAvatarMenu();
        if (typeof closeChatTitleMenu === 'function') {
          closeChatTitleMenu();
        }
        closeBubbleMenu();
      }
      lastDetailOpenState = detailOpen;
    }

    function closeForwardPreview() {
      forwardPreview = {
        open: false,
        loading: false,
        forwardId: '',
        title: '合并转发',
        nodes: [],
        error: '',
      };
      renderForwardPreview();
    }

    function openForwardPreview(forwardId, fallbackTitle) {
      const value = String(forwardId || '').trim();
      if (!value) {
        return;
      }
      forwardPreview = {
        open: true,
        loading: true,
        forwardId: value,
        title: String(fallbackTitle || ('合并转发 #' + value)),
        nodes: [],
        error: '',
      };
      renderForwardPreview();
      vscode.postMessage({
        type: 'openForward',
        forwardId: value,
      });
    }

    function closeMessageForwardPicker() {
      messageForwardPicker = {
        open: false,
        query: '',
        summary: '',
        draft: null,
        sendingChatId: '',
      };
      renderMessageForwardPicker();
    }

    function openMessageForwardPicker(draft) {
      const payload = draft && typeof draft === 'object' ? draft : null;
      if (!payload) {
        return;
      }
      messageForwardPicker = {
        open: true,
        query: '',
        summary: String(payload.summary || '转发消息').trim(),
        draft: payload,
        sendingChatId: '',
      };
      renderMessageForwardPicker();
      const search = document.getElementById('forwardPickerSearch');
      if (search) {
        search.value = '';
        search.focus();
      }
    }

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

    function renderCards() {
      const root = document.getElementById('cards');
      const count = document.getElementById('chatCount');
      root.innerHTML = '';
      if (!isPluginRunning()) {
        count.textContent = '0';
        const empty = document.createElement('div');
        empty.className = 'empty';
        const ownerPid = Number(state.runtimeBlockedOwnerPid || 0);
        if (state.runtimeBlockedByOther) {
          empty.textContent = ownerPid > 0
            ? ('插件未运行。另一个窗口正在运行（PID ' + ownerPid + '），当前窗口无法启动。')
            : '插件未运行。另一个窗口正在运行，当前窗口无法启动。';
        } else {
          empty.textContent = '插件未运行。点击右上角“启动插件”开始运行。';
        }
        root.appendChild(empty);
        return;
      }
      const filteredChats = filterChatsByQuery(state.chats, searchQuery);
      const useDirectoryResults = searchQuery.trim() && filteredChats.length === 0;
      const entries = useDirectoryResults ? state.directoryResults : filteredChats;
      count.textContent = searchQuery.trim()
        ? (useDirectoryResults ? String(entries.length) : (String(entries.length) + '/' + String(state.chats.length)))
        : String(state.chats.length);

      if (!searchQuery.trim() && state.chats.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '暂无会话。先让 NCat 收到一条私聊或群消息。';
        root.appendChild(empty);
        return;
      }

      if (useDirectoryResults && state.directorySearchPending) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '当前会话未命中，正在搜索好友列表和群列表...';
        root.appendChild(empty);
        return;
      }

      if (entries.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = searchQuery.trim()
          ? '当前会话、好友列表、群列表都没有命中。'
          : '未找到匹配会话，换个关键词试试。';
        root.appendChild(empty);
        return;
      }

      for (const chat of entries) {
        const card = document.createElement('div');
        card.className = 'card' + (chat.id === state.selectedChatId ? ' active' : '');
        card.addEventListener('click', () => {
          if (chat.source === 'directory') {
            pendingOpenChatId = chat.type + ':' + String(chat.targetId || '');
            vscode.postMessage({
              type: 'openSearchResult',
              chatType: chat.type,
              targetId: chat.targetId,
              title: chat.title,
              avatarUrl: chat.avatarUrl || '',
            });
            return;
          }

          state.selectedChatId = chat.id;
          pendingOpenChatId = chat.id;
          forceScrollBottom = true;
          vscode.postMessage({ type: 'selectChat', chatId: chat.id });
          renderPageState();
          renderCards();
          renderMessages();
        });

        const head = document.createElement('div');
        head.className = 'head';

        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        const avatarText = (chat.title || '?').slice(0, 1);
        attachAvatarImage(avatar, {
          url: chat.avatarUrl,
          fallbackText: avatarText,
          imageClassName: 'avatar-img',
          onError: () => {
            vscode.postMessage({
              type: 'webLog',
              level: 'warn',
              message: 'card avatar load_error: title=' + String(chat.title || '?') + ', targetId=' + String(chat.targetId || '') + ', url=' + String(chat.avatarUrl || ''),
            });
          },
        });

        const textWrap = document.createElement('div');
        textWrap.style.minWidth = '0';
        textWrap.style.flex = '1';

        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = chat.title;

        const meta = document.createElement('div');
        meta.className = 'meta';
        const typeName = chat.type === 'group' ? '群聊' : '私聊';
        if (chat.source === 'directory') {
          meta.textContent = typeName + ' · ' + String(chat.targetId || '');
        } else {
          meta.textContent = typeName + ' · ' + fmtTime(chat.lastTs);
        }

        textWrap.appendChild(name);
        textWrap.appendChild(meta);

        head.appendChild(avatar);
        head.appendChild(textWrap);

        if (chat.unread > 0) {
          const badge = document.createElement('div');
          badge.className = 'badge';
          badge.textContent = String(chat.unread > 99 ? '99+' : chat.unread);
          head.appendChild(badge);
        }

        const preview = document.createElement('div');
        preview.className = 'preview';
        if (chat.source === 'directory') {
          preview.textContent = chat.preview || '来自好友列表/群列表，点击打开会话';
        } else {
          const bodyText = String(chat.preview || '[空消息]');
          const senderText = String(chat.previewSender || '').trim();
          preview.textContent = senderText ? (senderText + ': ' + bodyText) : bodyText;
        }

        card.appendChild(head);
        card.appendChild(preview);
        root.appendChild(card);
      }
    }

    function renderForwardPreview() {
      const overlay = document.getElementById('forwardOverlay');
      const titleNode = document.getElementById('forwardTitle');
      const body = document.getElementById('forwardBody');

      overlay.classList.toggle('open', !!forwardPreview.open);
      overlay.setAttribute('aria-hidden', forwardPreview.open ? 'false' : 'true');
      titleNode.textContent = forwardPreview.title || '合并转发';
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

    function setupListAndForwardUi() {
      const onToggleRuntime = () => {
        vscode.postMessage({
          type: 'toggleRuntime',
          action: isPluginRunning() ? 'stop' : 'start',
        });
      };
      document.getElementById('btnRuntime').addEventListener('click', onToggleRuntime);
      document.getElementById('btnRuntime2').addEventListener('click', onToggleRuntime);

      document.getElementById('chatSearch').addEventListener('input', (event) => {
        searchQuery = String(event?.target?.value || '');
        state.directoryResults = [];
        state.directorySearchPending = !!searchQuery.trim();
        renderCards();
        vscode.postMessage({
          type: 'updateSearchQuery',
          query: searchQuery,
        });
      });

      document.getElementById('btnBack').addEventListener('click', () => {
        closeForwardPreview();
        clearPendingReply();
        closeAvatarMenu();
        if (typeof closeChatTitleMenu === 'function') {
          closeChatTitleMenu();
        }
        closeBubbleMenu();
        closeSettingsPanel();
        closeMessageForwardPicker();
        pendingOpenChatId = '';
        state.selectedChatId = '';
        vscode.postMessage({ type: 'selectChat', chatId: '' });
        renderAll();
      });

      document.getElementById('detailTitle').addEventListener('contextmenu', (event) => {
        const selected = getSelectedChat();
        if (!selected) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (typeof openChatTitleMenu === 'function') {
          openChatTitleMenu(selected, event.clientX, event.clientY);
        }
      });

      document.getElementById('btnCloseForward').addEventListener('click', () => {
        closeForwardPreview();
      });

      document.getElementById('forwardOverlay').addEventListener('click', (event) => {
        if (event.target === event.currentTarget) {
          closeForwardPreview();
        }
      });

      document.getElementById('btnCloseForwardPicker').addEventListener('click', () => {
        closeMessageForwardPicker();
      });

      document.getElementById('forwardPickerOverlay').addEventListener('click', (event) => {
        if (event.target === event.currentTarget) {
          closeMessageForwardPicker();
        }
      });

      document.getElementById('forwardPickerSearch').addEventListener('input', (event) => {
        messageForwardPicker.query = String(event?.target?.value || '');
        renderMessageForwardPicker();
      });
    }
  `;
}

module.exports = {
  renderListForwardScript,
};
