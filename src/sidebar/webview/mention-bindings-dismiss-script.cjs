function renderMentionBindingsDismissScript() {
  return String.raw`
      document.addEventListener('mousedown', (event) => {
        const settingsOverlay = document.getElementById('settingsOverlay');
        if (settingsOverlay && settingsOverlay.classList.contains('open')) {
          return;
        }
        const mentionMenu = document.getElementById('mentionMenu');
        if (mentionMenu && !mentionMenu.hidden && !mentionMenu.contains(event.target)) {
          closeMentionMenu();
        }

        const avatarMenu = document.getElementById('avatarMenu');
        if (avatarMenu && !avatarMenu.hidden && !avatarMenu.contains(event.target)) {
          closeAvatarMenu();
        }

        const chatTitleMenu = document.getElementById('chatTitleMenu');
        if (chatTitleMenu && !chatTitleMenu.hidden && !chatTitleMenu.contains(event.target)) {
          closeChatTitleMenu();
        }

        const bubbleMenu = document.getElementById('bubbleMenu');
        if (bubbleMenu && !bubbleMenu.hidden && !bubbleMenu.contains(event.target)) {
          closeBubbleMenu();
        }
      });

      document.addEventListener('contextmenu', (event) => {
        const avatarMenu = document.getElementById('avatarMenu');
        if (avatarMenu && !avatarMenu.hidden && !avatarMenu.contains(event.target)) {
          closeAvatarMenu();
        }
        const chatTitleMenu = document.getElementById('chatTitleMenu');
        if (chatTitleMenu && !chatTitleMenu.hidden && !chatTitleMenu.contains(event.target)) {
          closeChatTitleMenu();
        }
        const bubbleMenu = document.getElementById('bubbleMenu');
        if (bubbleMenu && !bubbleMenu.hidden && !bubbleMenu.contains(event.target)) {
          closeBubbleMenu();
        }
      });

      document.getElementById('messages').addEventListener('scroll', () => {
        closeAvatarMenu();
        closeChatTitleMenu();
        closeBubbleMenu();
      });
`;
}

module.exports = {
  renderMentionBindingsDismissScript,
};
