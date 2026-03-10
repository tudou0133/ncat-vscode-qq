const { renderMentionCoreScript } = require('./mention-core-script.cjs');
const { renderMenuActionsScript } = require('./menu-actions-script.cjs');
const { renderMentionBindingsScript } = require('./mention-bindings-script.cjs');

function renderMentionMenuScript() {
  return String.raw`
${renderMentionCoreScript()}
${renderMenuActionsScript()}
${renderMentionBindingsScript()}
`;
}

module.exports = {
  renderMentionMenuScript,
};
