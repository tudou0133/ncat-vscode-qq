function renderMessageDispatchForwardScript() {
  return `
    function handleForwardPreviewMessage(msg) {
      if (msg.loading) {
        forwardPreview = {
          open: true,
          loading: true,
          forwardId: String(msg.forwardId || forwardPreview.forwardId || ''),
          title: forwardPreview.title || '合并转发',
          nodes: [],
          error: '',
        };
        renderForwardPreview();
        return true;
      }

      if (msg.ok && msg.payload) {
        forwardPreview = {
          open: true,
          loading: false,
          forwardId: String(msg.payload.forwardId || ''),
          title: String(msg.payload.title || '合并转发'),
          nodes: Array.isArray(msg.payload.nodes) ? msg.payload.nodes : [],
          error: '',
        };
        renderForwardPreview();
        return true;
      }

      forwardPreview = {
        open: true,
        loading: false,
        forwardId: String(msg.forwardId || forwardPreview.forwardId || ''),
        title: forwardPreview.title || '合并转发',
        nodes: [],
        error: String(msg.error || '未知错误'),
      };
      renderForwardPreview();
      return true;
    }
`;
}

module.exports = {
  renderMessageDispatchForwardScript,
};
