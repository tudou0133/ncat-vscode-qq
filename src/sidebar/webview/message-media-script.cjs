const { renderMessageMediaRecoveryScript } = require('./message-media-recovery-script.cjs');
const { renderMessageMediaViewerScript } = require('./message-media-viewer-script.cjs');

function renderMessageMediaScript() {
  return `
${renderMessageMediaRecoveryScript()}
${renderMessageMediaViewerScript()}
`;
}

module.exports = {
  renderMessageMediaScript,
};
