function renderListForwardBindingsScript() {
  return String.raw`
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
  renderListForwardBindingsScript,
};
