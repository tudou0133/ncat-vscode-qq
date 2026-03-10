const { renderListForwardBindingsScript } = require('./list-forward-bindings-script.cjs');
const { renderListForwardRenderScript } = require('./list-forward-render-script.cjs');

function renderListForwardScript() {
  return String.raw`
    let lastDetailOpenState = false;

${renderListForwardRenderScript()}

    function closeForwardPreview() {
      forwardPreview = {
        open: false,
        loading: false,
        forwardId: '',
        title: '合并转发',
        nodes: [],
        error: '',
      };
      renderForwardPreview();
    }

    function openForwardPreview(forwardId, fallbackTitle) {
      const value = String(forwardId || '').trim();
      if (!value) {
        return;
      }
      forwardPreview = {
        open: true,
        loading: true,
        forwardId: value,
        title: String(fallbackTitle || ('合并转发 #' + value)),
        nodes: [],
        error: '',
      };
      renderForwardPreview();
      vscode.postMessage({
        type: 'openForward',
        forwardId: value,
      });
    }

    function closeMessageForwardPicker() {
      messageForwardPicker = {
        open: false,
        query: '',
        summary: '',
        draft: null,
        sendingChatId: '',
      };
      renderMessageForwardPicker();
    }

    function openMessageForwardPicker(draft) {
      const payload = draft && typeof draft === 'object' ? draft : null;
      if (!payload) {
        return;
      }
      messageForwardPicker = {
        open: true,
        query: '',
        summary: String(payload.summary || '转发消息').trim(),
        draft: payload,
        sendingChatId: '',
      };
      renderMessageForwardPicker();
      const search = document.getElementById('forwardPickerSearch');
      if (search) {
        search.value = '';
        search.focus();
      }
    }

${renderListForwardBindingsScript()}
`;
}

module.exports = {
  renderListForwardScript,
};
