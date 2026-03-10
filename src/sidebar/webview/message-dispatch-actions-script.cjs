function renderMessageDispatchActionsScript() {
  return `
    function handleQuickActionResultMessage(msg) {
      if (msg.action === 'poke') {
        if (msg.ok) {
          logWeb('info', 'poke sent: target=' + String(msg.targetId || 'default'));
        } else {
          logWeb('warn', 'poke failed: ' + String(msg.error || 'unknown'));
        }
        return true;
      }
      if (msg.action === 'stickerSend') {
        if (msg.ok) {
          clearPendingReply();
          logWeb('info', 'sticker sent');
        } else {
          logWeb('warn', 'sticker send failed: ' + String(msg.error || 'unknown'));
        }
        return true;
      }
      if (msg.action === 'recall') {
        if (msg.ok) {
          logWeb('info', 'message recalled');
        } else {
          logWeb('warn', 'message recall failed: ' + String(msg.error || 'unknown'));
        }
        return true;
      }
      if (msg.action === 'jsonSend') {
        if (msg.ok) {
          clearPendingReply();
          logWeb('info', 'json message sent');
        } else {
          logWeb('warn', 'json send failed: ' + String(msg.error || 'unknown'));
        }
        return true;
      }
      if (msg.action === 'stickerDelete') {
        if (msg.ok) {
          logWeb('info', 'sticker deleted');
          if (stickerPanelState.open) {
            requestStickerPackList(true);
          }
        } else {
          logWeb('warn', 'sticker delete failed: ' + String(msg.error || 'unknown'));
        }
        return true;
      }
      if (msg.action === 'hideChat') {
        if (msg.ok) {
          logWeb('info', 'chat hidden: ' + String(msg.chatId || ''));
          closeAvatarMenu();
          closeBubbleMenu();
          if (typeof closeChatTitleMenu === 'function') {
            closeChatTitleMenu();
          }
        } else {
          logWeb('warn', 'hide chat failed: ' + String(msg.error || 'unknown'));
        }
        return true;
      }
      return false;
    }

    function handleAddToStickerPackResultMessage(msg) {
      const savedCount = Number(msg.savedCount || 0);
      const failedCount = Number(msg.failedCount || 0);
      const dir = String(msg.dir || '');
      if (msg.ok) {
        logWeb('info', 'sticker saved: count=' + String(savedCount) + ', failed=' + String(failedCount) + ', dir=' + dir);
        requestStickerPackList(true);
      } else {
        logWeb('warn', 'sticker save failed: ' + String(msg.error || 'unknown'));
      }
      return true;
    }

    function handleSettingsActionResultMessage(msg) {
      if (msg.action === 'clearCache' && msg.ok) {
        searchQuery = '';
        const searchInput = document.getElementById('chatSearch');
        if (searchInput) {
          searchInput.value = '';
        }
        vscode.postMessage({
          type: 'updateSearchQuery',
          query: '',
        });
        closeSettingsPanel();
        closeBubbleMenu();
        closeAvatarMenu();
        closeMentionMenu();
        clearPendingReply();
        logWeb('info', 'local cache cleared');
      }
      return true;
    }

    function handleSaveBackendSettingsResultMessage(msg) {
      if (msg.ok) {
        logWeb('info', 'backend settings saved');
      } else {
        logWeb('warn', 'backend settings save failed: ' + String(msg.error || 'unknown'));
      }
      return true;
    }

    function handleSaveHiddenSettingsResultMessage(msg) {
      if (msg.ok) {
        logWeb('info', 'hidden settings saved');
      } else {
        logWeb('warn', 'hidden settings save failed: ' + String(msg.error || 'unknown'));
      }
      return true;
    }
`;
}

module.exports = {
  renderMessageDispatchActionsScript,
};
