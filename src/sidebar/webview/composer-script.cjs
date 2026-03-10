const { renderComposerPanelScript } = require('./composer-panel-script.cjs');
const { renderComposerBindingsScript } = require('./composer-bindings-script.cjs');

function renderComposerScript() {
  return String.raw`
${renderComposerPanelScript()}
${renderComposerBindingsScript()}
`;
}

module.exports = {
  renderComposerScript,
};
