const { renderMessageMediaScript } = require('./message-media-script.cjs');
const { renderMessageListScript } = require('./message-list-script.cjs');
const { renderMessageRenderCoreScript } = require('./message-render-core-script.cjs');

function renderMessageScript() {
  return String.raw`
${renderMessageMediaScript()}
${renderMessageRenderCoreScript()}
${renderMessageListScript()}
`;
}

module.exports = {
  renderMessageScript,
};
