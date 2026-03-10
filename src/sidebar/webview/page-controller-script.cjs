function renderPageControllerScript() {
  return `
    function setPendingReply(data) {
      pendingReply = {
        messageId: String(data?.messageId || '').trim(),
        senderName: String(data?.senderName || '').trim(),
        preview: String(data?.preview || '').trim(),
      };
      renderComposerReply();
      const input = document.getElementById('composerInput');
      if (input) {
        input.focus();
      }
      renderComposerState();
    }

    function clearPendingReply() {
      pendingReply = {
        messageId: '',
        senderName: '',
        preview: '',
      };
      renderComposerReply();
      renderComposerState();
    }

    function renderComposerReply() {
      const root = document.getElementById('composerReply');
      const text = document.getElementById('composerReplyText');
      if (!root || !text) {
        return;
      }
      if (!pendingReply.messageId) {
        root.classList.remove('active');
        text.textContent = '';
        return;
      }
      root.classList.add('active');
      const name = pendingReply.senderName || '某人';
      const preview = pendingReply.preview ? ('：' + pendingReply.preview) : '';
      text.textContent = '回复 ' + name + preview;
      root.title = 'message_id=' + pendingReply.messageId;
    }

    function findMessageById(messageId) {
      const id = String(messageId || '').trim();
      if (!id) {
        return null;
      }
      return (Array.isArray(state.selectedMessages) ? state.selectedMessages : []).find((item) => String(item?.id || '') === id) || null;
    }

    function findMessageByRawMessageId(rawMessageId) {
      const rawId = String(rawMessageId || '').trim();
      if (!rawId) {
        return null;
      }
      return (Array.isArray(state.selectedMessages) ? state.selectedMessages : []).find((item) => String(item?.rawMessageId || '') === rawId) || null;
    }

    function findRenderedMessageRow(messageId, rawMessageId) {
      const root = document.getElementById('messages');
      if (!root) {
        return null;
      }
      const localId = String(messageId || '').trim();
      const rawId = String(rawMessageId || '').trim();
      const rows = Array.from(root.querySelectorAll('.msg-row'));
      return rows.find((row) => {
        if (!(row instanceof HTMLElement)) {
          return false;
        }
        if (localId && String(row.dataset.messageId || '') === localId) {
          return true;
        }
        if (rawId && String(row.dataset.rawMessageId || '') === rawId) {
          return true;
        }
        return false;
      }) || null;
    }

    function jumpToMessage(targetMessageId, targetRawMessageId) {
      const row = findRenderedMessageRow(targetMessageId, targetRawMessageId);
      const localId = String(targetMessageId || '').trim();
      const rawId = String(targetRawMessageId || '').trim();
      jumpHighlightState.messageId = localId;
      jumpHighlightState.rawMessageId = rawId;
      jumpHighlightState.until = Date.now() + 3200;
      if (jumpHighlightState.clearTimer) {
        clearTimeout(jumpHighlightState.clearTimer);
      }
      jumpHighlightState.clearTimer = setTimeout(() => {
        jumpHighlightState.messageId = '';
        jumpHighlightState.rawMessageId = '';
        jumpHighlightState.until = 0;
        jumpHighlightState.clearTimer = null;
        renderAll();
      }, 3250);
      if (!row) {
        logWeb(
          'warn',
          'jump target not found: messageId=' + String(localId || '(none)') +
            ', rawMessageId=' + String(rawId || '(none)')
        );
        renderAll();
        return false;
      }
      row.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      row.classList.remove('jump-target');
      void row.offsetWidth;
      row.classList.add('jump-target');
      return true;
    }

    function sendQuickText(text) {
      const selected = getSelectedChat();
      const value = String(text || '').trim();
      if (!selected || !value || sendBusy) {
        return;
      }
      sendBusy = true;
      forceScrollBottom = true;
      renderComposerState();
      vscode.postMessage({
        type: 'sendChatMessage',
        chatId: selected.id,
        text: value,
        replyToMessageId: '',
        images: [],
      });
    }

    function renderAccountHeader() {
      const avatarNode = document.getElementById('accountAvatar');
      const nameNode = document.getElementById('accountName');
      const dotNode = document.getElementById('accountDot');
      const nickname = String(state.selfNickname || 'NCat');
      const uid = String(state.selfUserId || '').trim();
      const avatarUrl = String(state.selfAvatarUrl || '').trim() || (uid ? ('https://q1.qlogo.cn/g?b=qq&nk=' + encodeURIComponent(uid) + '&s=100') : '');
      nameNode.textContent = nickname;
      attachAvatarImage(avatarNode, {
        url: avatarUrl,
        fallbackText: (nickname || 'N').slice(0, 1),
        imageClassName: 'msg-avatar-img',
      });
      dotNode.classList.remove('online');
      dotNode.classList.remove('paused');
      if (!isPluginRunning()) {
        dotNode.classList.add('paused');
      } else if (state.connectionState === 'online') {
        dotNode.classList.add('online');
      }
      const stateLabel = !isPluginRunning()
        ? '未运行'
        : (state.connectionState === 'online' ? '在线' : '离线');
      nameNode.title = uid ? (nickname + ' (' + uid + ') · ' + stateLabel) : (nickname + ' · ' + stateLabel);
      renderRuntimeButtons();
    }

    function renderRuntimeButtons() {
      const running = isPluginRunning();
      const buttons = [document.getElementById('btnRuntime'), document.getElementById('btnRuntime2')];
      for (const button of buttons) {
        if (!button) {
          continue;
        }
        button.textContent = running ? '停止插件' : '启动插件';
        button.classList.toggle('stop', running);
      }
    }


    function renderAll() {
      try {
        renderAccountHeader();
        renderPageState();
        renderCards();
        renderMessages();
        renderForwardPreview();
        renderMessageForwardPicker();
        renderComposerAttachments();
        renderComposerReply();
        renderComposerState();
        if (mentionState.open) {
          updateMentionMenuFromInput();
        }
        renderSettingsPanel();
        vscode.setState({
          selectedChatId: state.selectedChatId,
          searchQuery,
          uiPrefs,
        });
      } catch (error) {
        logWeb('error', 'renderAll failed: ' + String(error?.stack || error?.message || error));
      }
    }
`;
}

module.exports = {
  renderPageControllerScript,
};
