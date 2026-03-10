function renderMessageDispatchStateMediaScript() {
  return `
    function handleStateMessage(msg) {
      const payload = msg.payload && typeof msg.payload === 'object' ? msg.payload : null;
      if (!payload) {
        logWeb('warn', 'state update ignored: payload missing');
        return true;
      }
      if (!Array.isArray(payload.chats) || !Array.isArray(payload.selectedMessages)) {
        logWeb(
          'warn',
          'state update ignored: malformed arrays chats=' + String(Array.isArray(payload.chats)) +
            ', selectedMessages=' + String(Array.isArray(payload.selectedMessages))
        );
        return true;
      }
      const prevSelectedChatId = state.selectedChatId;
      state = {
        ...state,
        ...payload,
        chats: payload.chats,
        selectedMessages: payload.selectedMessages,
        directoryResults: Array.isArray(payload.directoryResults) ? payload.directoryResults : [],
        selectedMembers: Array.isArray(payload.selectedMembers) ? payload.selectedMembers : [],
        backend: payload.backend && typeof payload.backend === 'object'
          ? payload.backend
          : state.backend,
        hidden: payload.hidden && typeof payload.hidden === 'object'
          ? payload.hidden
          : state.hidden,
      };
      if (state.selectedChatId !== prevSelectedChatId) {
        clearPendingReply();
        closeMentionMenu();
        closeBubbleMenu();
        closeStickerPanel();
        closeJsonComposer();
      }
      if (state.selectedChatId && (state.selectedChatId !== prevSelectedChatId || state.selectedChatId === pendingOpenChatId)) {
        forceScrollBottom = true;
      }
      if (!state.isLoadingOlder) {
        olderLoadBusy = false;
      }
      renderAll();
      return true;
    }

    function handleSendResultMessage(msg) {
      sendBusy = false;
      const input = document.getElementById('composerInput');
      renderComposerState();

      if (msg.ok) {
        input.value = '';
        pendingImages = [];
        clearPendingReply();
        renderComposerAttachments();
        input.focus();
      }
      return true;
    }

    function handleResolveImageUrlResultMessage(msg) {
      const requestId = String(msg.requestId || '').trim();
      if (!requestId) {
        return true;
      }
      const pending = pendingResolveImageRequests.get(requestId);
      if (!pending) {
        logWeb('warn', 'resolveImageUrlResult ignored: unknown requestId=' + requestId);
        return true;
      }
      pendingResolveImageRequests.delete(requestId);
      clearTimeout(pending.timer);
      if (msg.ok) {
        logWeb('info', 'resolveImageUrlResult ok: id=' + requestId + ', mime=' + String(msg.mime || ''));
        pending.resolve({
          dataUrl: String(msg.dataUrl || ''),
          name: String(msg.name || 'image.png'),
          mime: String(msg.mime || ''),
        });
        return true;
      }
      logWeb('warn', 'resolveImageUrlResult failed: id=' + requestId + ', reason=' + String(msg.error || 'resolve failed'));
      pending.reject(new Error(String(msg.error || 'resolve failed')));
      return true;
    }

    function handleRetryMessageMediaResultMessage(msg) {
      const chatId = String(msg.chatId || '').trim();
      const messageId = String(msg.messageId || '').trim();
      const rawMessageId = String(msg.rawMessageId || '').trim();
      const noRetry = !!msg.noRetry || String(msg.error || '').includes('消息不存在');
      if (noRetry && rawMessageId) {
        mediaNoRetryRawMessageIds.add(rawMessageId);
      }
      if (msg.ok && msg.updated) {
        logWeb(
          'info',
          'media backend retry success: chat=' + chatId +
            ', messageId=' + (messageId || '(none)') +
            ', rawMessageId=' + (rawMessageId || '(none)')
        );
      } else {
        logWeb(
          'warn',
          'media backend retry failed: chat=' + chatId +
            ', messageId=' + (messageId || '(none)') +
            ', rawMessageId=' + (rawMessageId || '(none)') +
            ', reason=' + String(msg.error || 'unknown') +
            (noRetry ? ' (no-retry)' : '')
        );
      }
      return true;
    }

    function handleDownloadChatFilesResultMessage(msg) {
      if (msg.ok) {
        logWeb(
          'info',
          'download files success: saved=' + String(msg.savedCount || 0) +
            ', failed=' + String(msg.failedCount || 0) +
            ', dir=' + String(msg.dir || '')
        );
      } else {
        logWeb(
          'warn',
          'download files failed: saved=' + String(msg.savedCount || 0) +
            ', failed=' + String(msg.failedCount || 0) +
            ', reason=' + String(msg.error || 'unknown')
        );
      }
      return true;
    }

    function handleStickerPackListResultMessage(msg) {
      const items = Array.isArray(msg.items) ? msg.items : [];
      stickerPanelState.loading = false;
      stickerPanelState.error = msg.ok ? '' : String(msg.error || '加载失败');
      stickerPanelState.items = items
        .map((item, idx) => ({
          id: String(item?.id || ('sticker-' + idx)),
          name: String(item?.name || 'sticker'),
          dataUrl: String(item?.dataUrl || ''),
        }))
        .filter((item) => item.dataUrl.startsWith('data:image/'));
      stickerPanelState.dir = String(msg.dir || '');
      stickerPanelState.lastLoadedAt = Date.now();
      renderStickerPanel();
      return true;
    }

    function handleOlderResultMessage() {
      olderLoadBusy = false;
      return true;
    }
`;
}

module.exports = {
  renderMessageDispatchStateMediaScript,
};
