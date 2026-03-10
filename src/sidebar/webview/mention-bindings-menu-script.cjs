function renderMentionBindingsMenuScript() {
  return String.raw`
      document.getElementById('avatarMenuAt').addEventListener('click', () => {
        if (!avatarMenuState.senderId) {
          return;
        }
        insertMentionToken(avatarMenuState.senderId);
        closeAvatarMenu();
      });

      document.getElementById('avatarMenuPoke').addEventListener('click', () => {
        const selected = getSelectedChat();
        if (!selected || !avatarMenuState.senderId) {
          return;
        }
        vscode.postMessage({
          type: 'sendPoke',
          chatId: selected.id,
          targetId: avatarMenuState.senderId,
        });
        closeAvatarMenu();
      });

      document.getElementById('avatarMenuCopyId').addEventListener('click', async () => {
        if (!avatarMenuState.senderId) {
          return;
        }
        const copied = await copyToClipboard(avatarMenuState.senderId);
        if (copied) {
          logWeb('info', 'qq copied: ' + avatarMenuState.senderId);
        } else {
          logWeb('warn', 'qq copy failed: ' + avatarMenuState.senderId);
        }
        closeAvatarMenu();
      });

      document.getElementById('chatTitleMenuCopy').addEventListener('click', async () => {
        if (!chatTitleMenuState.targetId) {
          return;
        }
        const copied = await copyToClipboard(chatTitleMenuState.targetId);
        if (copied) {
          logWeb('info', 'chat target copied: ' + chatTitleMenuState.chatId);
        } else {
          logWeb('warn', 'chat target copy failed: ' + chatTitleMenuState.chatId);
        }
        closeChatTitleMenu();
      });

      document.getElementById('chatTitleMenuHide').addEventListener('click', () => {
        if (!chatTitleMenuState.chatId) {
          return;
        }
        vscode.postMessage({
          type: 'hideChat',
          chatId: chatTitleMenuState.chatId,
        });
        closeChatTitleMenu();
      });
`;
}

module.exports = {
  renderMentionBindingsMenuScript,
};
