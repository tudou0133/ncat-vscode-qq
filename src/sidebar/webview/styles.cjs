const { renderWebviewBaseStyles } = require('./styles-base-script.cjs');
const { renderWebviewComposerStyles } = require('./styles-composer-script.cjs');
const { renderWebviewMessageStyles } = require('./styles-message-script.cjs');
const { renderWebviewOverlayStyles } = require('./styles-overlay-script.cjs');

function renderWebviewStyles() {
  return `
${renderWebviewBaseStyles()}
${renderWebviewComposerStyles()}
${renderWebviewMessageStyles()}
${renderWebviewOverlayStyles()}
`;
}

module.exports = {
  renderWebviewStyles,
};
