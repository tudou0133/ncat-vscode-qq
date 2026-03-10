const { renderWebviewComposerInputStyles } = require('./styles-composer-input-script.cjs');
const { renderWebviewComposerJsonStyles } = require('./styles-composer-json-script.cjs');
const { renderWebviewComposerPanelStyles } = require('./styles-composer-panel-script.cjs');
const { renderWebviewComposerReplyStyles } = require('./styles-composer-reply-script.cjs');

function renderWebviewComposerStyles() {
  return `
${renderWebviewComposerInputStyles()}
${renderWebviewComposerPanelStyles()}
${renderWebviewComposerJsonStyles()}
${renderWebviewComposerReplyStyles()}
`;
}

module.exports = {
  renderWebviewComposerStyles,
};
