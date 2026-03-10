const { renderListChatRenderScript } = require('./list-chat-render-script.cjs');
const { renderListForwardOverlayRenderScript } = require('./list-forward-overlay-render-script.cjs');

function renderListForwardRenderScript() {
  return String.raw`
${renderListChatRenderScript()}

${renderListForwardOverlayRenderScript()}
`;
}

module.exports = {
  renderListForwardRenderScript,
};
