const { renderCommonClipboardAvatarScript } = require('./common-clipboard-avatar-script.cjs');
const { renderCommonLinkUtilsScript } = require('./common-link-utils-script.cjs');

function renderCommonUtilsScript() {
  return `
    function fmtTime(ms) {
      if (!ms) return '';
      const d = new Date(ms);
      const now = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const timeText = hh + ':' + mm;
      const sameDay =
        d.getFullYear() === now.getFullYear()
        && d.getMonth() === now.getMonth()
        && d.getDate() === now.getDate();
      if (sameDay) {
        return timeText;
      }
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return month + '-' + day + ' ' + timeText;
    }

    function getSelectedChat() {
      if (!state.selectedChatId) return null;
      return state.chats.find((item) => item.id === state.selectedChatId) || null;
    }

    function isPluginRunning() {
      return !!state.runtimeActive;
    }

    function filterChatsByQuery(chats, queryText) {
      const q = String(queryText || '').trim().toLowerCase();
      if (!q) {
        return chats;
      }

      return chats.filter((chat) => {
        const title = String(chat.title || '').toLowerCase();
        const targetId = String(chat.targetId || '').toLowerCase();
        const id = String(chat.id || '').toLowerCase();
        return title.includes(q) || targetId.includes(q) || id.includes(q);
      });
    }

${renderCommonLinkUtilsScript()}

${renderCommonClipboardAvatarScript()}

    function logWeb(level, message) {
      const text = String(message || '').trim();
      if (!text) {
        return;
      }
      vscode.postMessage({
        type: 'webLog',
        level: String(level || 'info'),
        message: text,
      });
    }
`;
}

module.exports = {
  renderCommonUtilsScript,
};
