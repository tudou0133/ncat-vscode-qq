const { renderWebviewMessageMediaStyles } = require('./styles-message-media-script.cjs');
const { renderWebviewMessageRowStyles } = require('./styles-message-row-script.cjs');
const { renderWebviewMessageSegmentStyles } = require('./styles-message-segment-script.cjs');

function renderWebviewMessageStyles() {
  return `
${renderWebviewMessageRowStyles()}
${renderWebviewMessageMediaStyles()}
${renderWebviewMessageSegmentStyles()}
`;
}

module.exports = {
  renderWebviewMessageStyles,
};
