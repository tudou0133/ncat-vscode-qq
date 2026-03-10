const { renderComposerSetupInputScript } = require('./composer-setup-input-script.cjs');
const { renderComposerSetupPanelsScript } = require('./composer-setup-panels-script.cjs');

function renderComposerBindingsScript() {
  return String.raw`
    function setupComposer() {
      const composerNode = document.querySelector('.composer');
      const composerInput = document.getElementById('composerInput');
      const composerFilePicker = document.getElementById('composerFilePicker');
      const stickerImportPicker = document.getElementById('stickerImportPicker');
      const stickerPanel = document.getElementById('stickerPanel');
      const stickerBtn = document.getElementById('btnStickerPack');

${renderComposerSetupPanelsScript()}

${renderComposerSetupInputScript()}
    }
`;
}

module.exports = {
  renderComposerBindingsScript,
};
