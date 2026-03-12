function renderMessageListScript() {
  return String.raw`
    function renderMessages() {
      const root = document.getElementById('messages');
      const prevBottomDistance = Math.max(0, root.scrollHeight - root.scrollTop - root.clientHeight);
      const wasNearBottom = prevBottomDistance <= 56;
      const fragment = document.createDocumentFragment();
      root.innerHTML = '';

      if (!isPluginRunning()) {
        const empty = document.createElement('div');
        empty.className = 'runtime-empty';
        const status = document.createElement('div');
        status.className = 'runtime-empty-status';
        status.textContent = '已停止';
        const icon = document.createElement('div');
        icon.className = 'runtime-empty-icon';
        icon.textContent = '■';
        const title = document.createElement('div');
        title.className = 'runtime-empty-title';
        title.textContent = '插件未运行';
        const text = document.createElement('div');
        text.className = 'runtime-empty-text';
        text.textContent = '当前会话视图已暂停。';
        const action = document.createElement('div');
        action.className = 'runtime-empty-action';
        action.textContent = '点击右上角“启动插件”开始运行';
        empty.appendChild(status);
        empty.appendChild(icon);
        empty.appendChild(title);
        empty.appendChild(text);
        empty.appendChild(action);
        fragment.appendChild(empty);
        root.replaceChildren(fragment);
        lastRenderedChatId = '';
        lastRenderedMessageCount = 0;
        forceScrollBottom = false;
        return;
      }

      const selected = getSelectedChat();
      const detailNotice = document.getElementById('detailNotice');
      if (!selected) {
        if (detailNotice) {
          detailNotice.hidden = true;
          detailNotice.textContent = '';
        }
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '在一级页面点开一个会话后，这里会覆盖显示二级消息页。';
        fragment.appendChild(empty);
        root.replaceChildren(fragment);
        lastRenderedChatId = '';
        lastRenderedMessageCount = 0;
        forceScrollBottom = false;
        return;
      }

      if (!state.selectedMessages || state.selectedMessages.length === 0) {
        if (detailNotice) {
          if (selected.type === 'private' && !state.selectedChatIsFriend) {
            detailNotice.hidden = false;
            detailNotice.textContent = '当前对象不在好友列表中。这是临时私聊会话，目前仅支持聊天查看与发送；主动加好友请在 QQ 客户端中操作。';
          } else {
            detailNotice.hidden = true;
            detailNotice.textContent = '';
          }
        }
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '当前会话还没有缓存消息。';
        fragment.appendChild(empty);
        root.replaceChildren(fragment);
        lastRenderedChatId = selected.id;
        lastRenderedMessageCount = 0;
        forceScrollBottom = false;
        return;
      }

      const sortedMessages = [...state.selectedMessages].sort((a, b) => {
        const t1 = Number(a.timestamp || 0);
        const t2 = Number(b.timestamp || 0);
        return t1 - t2;
      });

      if (detailNotice) {
        if (selected.type === 'private' && !state.selectedChatIsFriend) {
          detailNotice.hidden = false;
          detailNotice.textContent = '当前对象不在好友列表中。这是临时私聊会话，目前仅支持聊天查看与发送；主动加好友请在 QQ 客户端中操作。';
        } else {
          detailNotice.hidden = true;
          detailNotice.textContent = '';
        }
      }

      if (state.isLoadingOlder) {
        const loading = document.createElement('div');
        loading.className = 'empty';
        loading.style.margin = '0 auto 6px';
        loading.style.padding = '6px 10px';
        loading.style.fontSize = '11px';
        loading.textContent = '正在加载更早消息...';
        fragment.appendChild(loading);
      }

      for (const msg of sortedMessages) {
        if (isSystemLineMessage(msg)) {
          const line = document.createElement('div');
          line.className = 'msg-system';
          const lineText = getMessageActionText(msg) || '[系统消息]';
          line.textContent = lineText;
          line.title = lineText;
          fragment.appendChild(line);
          continue;
        }

        const isOut = msg.direction === 'out';
        const row = document.createElement('div');
        row.className = 'msg-row ' + (isOut ? 'out' : 'in');
        row.dataset.messageId = String(msg.id || '');
        row.dataset.rawMessageId = String(msg.rawMessageId || '');
        if (jumpHighlightState && Number(jumpHighlightState.until || 0) > Date.now()) {
          const activeMessageId = String(jumpHighlightState.messageId || '').trim();
          const activeRawMessageId = String(jumpHighlightState.rawMessageId || '').trim();
          if (
            (activeMessageId && activeMessageId === String(msg.id || '')) ||
            (activeRawMessageId && activeRawMessageId === String(msg.rawMessageId || ''))
          ) {
            row.classList.add('jump-target');
          }
        }

        const sender = msg.senderName || msg.senderId || 'unknown';
        const avatar = document.createElement('span');
        avatar.className = 'msg-avatar';
        const senderFallbackText = sender.slice(0, 1);

        const senderId = String(msg.senderId || '').trim();
        const resolvedAvatarUrl =
          String(msg.avatarUrl || '').trim() ||
          (senderId ? ('https://q1.qlogo.cn/g?b=qq&nk=' + encodeURIComponent(senderId) + '&s=100') : '');

        if (!resolvedAvatarUrl) {
          avatar.textContent = senderFallbackText;
          logAvatarIssue('missing_url', msg, 'reason=no-avatar-url-and-sender-id');
        } else {
          attachAvatarImage(avatar, {
            url: resolvedAvatarUrl,
            fallbackText: senderFallbackText,
            imageClassName: 'msg-avatar-img',
            onError: () => {
              logAvatarIssue('load_error', msg, 'url=' + resolvedAvatarUrl);
            },
          });
        }

        if (senderId) {
          avatar.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            event.stopPropagation();
            openAvatarMenu(
              {
                senderId,
                senderName: sender,
              },
              event.clientX,
              event.clientY
            );
          }, true);
          avatar.addEventListener('dblclick', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (String(senderId) === String(state.selfUserId || '')) {
              return;
            }
            vscode.postMessage({
              type: 'openPrivateChatFromAvatar',
              targetId: senderId,
              title: sender,
            });
          }, true);
        }

        const main = document.createElement('div');
        main.className = 'msg-main';

        const meta = document.createElement('div');
        meta.className = 'msg-meta';

        const senderName = document.createElement('span');
        senderName.className = 'msg-sender';
        senderName.textContent = sender;

        const timeNode = document.createElement('span');
        timeNode.className = 'msg-time';
        timeNode.textContent = fmtTime(msg.timestamp);

        meta.appendChild(senderName);
        meta.appendChild(timeNode);

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble' + (isOut ? ' out' : '');
        const bubbleText = getMessageActionText(msg);
        if (bubbleText) {
          bubble.title = bubbleText;
        }

        const segments = Array.isArray(msg.segments) ? msg.segments : [];
        const totalImages = segments.reduce((count, seg) => (seg && seg.type === 'image' ? count + 1 : count), 0);
        let imageIndex = 0;
        const messageMeta = {
          chatId: String(selected.id || ''),
          messageId: String(msg.id || ''),
          rawMessageId: String(msg.rawMessageId || ''),
        };

        for (const seg of segments) {
          let node;
          if (seg && seg.type === 'image') {
            imageIndex += 1;
            node = buildSegment(seg, { index: imageIndex, total: totalImages }, messageMeta);
          } else {
            node = buildSegment(seg, { index: 0, total: totalImages }, messageMeta);
          }
          bubble.appendChild(node);
        }

        bubble.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
          openBubbleMenu(
            {
              messageId: String(msg.id || ''),
              senderName: sender,
              rawMessageId: String(msg.rawMessageId || ''),
              text: bubbleText,
              hasImage: totalImages > 0,
              canRecall: isOut && !!String(msg.rawMessageId || '').trim(),
            },
            event.clientX,
            event.clientY
          );
        });

        main.appendChild(meta);
        main.appendChild(bubble);

        if (isOut) {
          row.appendChild(main);
          row.appendChild(avatar);
        } else {
          row.appendChild(avatar);
          row.appendChild(main);
        }

        fragment.appendChild(row);
      }

      root.replaceChildren(fragment);

      const currentChatId = selected.id;
      const currentCount = sortedMessages.length;
      const chatChanged = currentChatId !== lastRenderedChatId;
      const openingSelectedChat = !!pendingOpenChatId && currentChatId === pendingOpenChatId;
      const appended = !chatChanged && currentCount > lastRenderedMessageCount;
      const shouldAutoBottom = openingSelectedChat || forceScrollBottom || chatChanged || (appended && wasNearBottom);

      requestAnimationFrame(() => {
        if (shouldAutoBottom) {
          root.scrollTop = root.scrollHeight;
        } else {
          const targetTop = root.scrollHeight - root.clientHeight - prevBottomDistance;
          root.scrollTop = Math.max(0, targetTop);
        }
        if (openingSelectedChat) {
          pendingOpenChatId = '';
        }
        forceScrollBottom = false;
        lastRenderedChatId = currentChatId;
        lastRenderedMessageCount = currentCount;
      });
    }
`;
}

module.exports = {
  renderMessageListScript,
};
