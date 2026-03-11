function renderListChatRenderScript() {
  return String.raw`
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

    function renderCards() {
      const root = document.getElementById('cards');
      const count = document.getElementById('chatCount');
      const fragment = document.createDocumentFragment();
      root.innerHTML = '';
      if (!isPluginRunning()) {
        count.textContent = '0';
        const empty = document.createElement('div');
        empty.className = 'runtime-empty';
        const status = document.createElement('div');
        status.className = 'runtime-empty-status';
        status.textContent = state.runtimeBlockedByOther ? '已被占用' : '已停止';
        const icon = document.createElement('div');
        icon.className = 'runtime-empty-icon';
        icon.textContent = '■';
        const title = document.createElement('div');
        title.className = 'runtime-empty-title';
        title.textContent = '插件未运行';
        const text = document.createElement('div');
        text.className = 'runtime-empty-text';
        const action = document.createElement('div');
        action.className = 'runtime-empty-action';
        const ownerPid = Number(state.runtimeBlockedOwnerPid || 0);
        if (state.runtimeBlockedByOther) {
          text.textContent = ownerPid > 0
            ? ('另一个窗口正在运行（PID ' + ownerPid + '），当前窗口无法启动。')
            : '另一个窗口正在运行，当前窗口无法启动。';
          action.textContent = '请先关闭另一个窗口中的插件实例';
        } else {
          text.textContent = '消息列表和历史记录已暂停展示。';
          action.textContent = '点击右上角“启动插件”开始运行';
        }
        empty.appendChild(status);
        empty.appendChild(icon);
        empty.appendChild(title);
        empty.appendChild(text);
        empty.appendChild(action);
        fragment.appendChild(empty);
        root.replaceChildren(fragment);
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
        fragment.appendChild(empty);
        root.replaceChildren(fragment);
        return;
      }

      if (useDirectoryResults && state.directorySearchPending) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '当前会话未命中，正在搜索好友列表和群列表...';
        fragment.appendChild(empty);
        root.replaceChildren(fragment);
        return;
      }

      if (entries.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = searchQuery.trim()
          ? '当前会话、好友列表、群列表都没有命中。'
          : '未找到匹配会话，换个关键词试试。';
        fragment.appendChild(empty);
        root.replaceChildren(fragment);
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
        fragment.appendChild(card);
      }
      root.replaceChildren(fragment);
    }
`;
}

module.exports = {
  renderListChatRenderScript,
};
