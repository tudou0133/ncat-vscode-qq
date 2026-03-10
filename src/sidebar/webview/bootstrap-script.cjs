const { renderPageControllerScript } = require('./page-controller-script.cjs');
const { renderMessageDispatchScript } = require('./message-dispatch-script.cjs');

function renderBootstrapScript() {
  return `
    window.addEventListener('error', (event) => {
      const msg = String(event?.message || 'unknown');
      const src = String(event?.filename || '');
      const line = Number(event?.lineno || 0);
      const col = Number(event?.colno || 0);
      logWeb('error', 'window.error: ' + msg + ' @ ' + src + ':' + String(line) + ':' + String(col));
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event?.reason;
      const text = reason?.stack || reason?.message || String(reason || 'unknown');
      logWeb('error', 'unhandledrejection: ' + String(text));
    });

${renderPageControllerScript()}

${renderMessageDispatchScript()}
    document.getElementById('messages').addEventListener('scroll', (event) => {
      const root = event.currentTarget;
      if (!state.selectedChatId) {
        return;
      }
      if (olderLoadBusy || state.isLoadingOlder) {
        return;
      }
      if (root.scrollTop <= 10) {
        olderLoadBusy = true;
        vscode.postMessage({
          type: 'loadOlderMessages',
          chatId: state.selectedChatId,
        });
      }
    });

    setupComposer();
    setupSettingsUi();
    setupMentionAndMenus();
    setupListAndForwardUi();

    document.getElementById('composerReplyClear').addEventListener('click', () => {
      clearPendingReply();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && settingsOpen) {
        event.preventDefault();
        closeSettingsPanel();
      }
    });

    window.addEventListener('resize', () => {
      positionMentionMenu();
      closeAvatarMenu();
      if (typeof closeChatTitleMenu === 'function') {
        closeChatTitleMenu();
      }
      closeBubbleMenu();
      closeStickerPanel();
      renderSettingsPanel();
    });

    const prev = vscode.getState();
    // Avoid restoring second-level page directly on startup.
    // Stale cached selection can lock interaction in edge cases.
    state.selectedChatId = '';
    if (prev && typeof prev.searchQuery === 'string') {
      searchQuery = prev.searchQuery;
      const searchNode = document.getElementById('chatSearch');
      searchNode.value = searchQuery;
    }
    if (prev && prev.uiPrefs && typeof prev.uiPrefs === 'object') {
      uiPrefs.previewImages = prev.uiPrefs.previewImages !== false;
      uiPrefs.previewVideos = prev.uiPrefs.previewVideos !== false;
      uiPrefs.enterToSend = prev.uiPrefs.enterToSend !== false;
    }

    renderAll();
    logWeb('info', 'webview initialized');
    vscode.postMessage({ type: 'ready' });
    if (searchQuery.trim()) {
      vscode.postMessage({
        type: 'updateSearchQuery',
        query: searchQuery,
      });
    }
`;
}

module.exports = {
  renderBootstrapScript,
};
