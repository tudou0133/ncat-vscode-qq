const { renderMentionBindingsMenuScript } = require('./mention-bindings-menu-script.cjs');
const { renderMentionBindingsBubbleScript } = require('./mention-bindings-bubble-script.cjs');
const { renderMentionBindingsDismissScript } = require('./mention-bindings-dismiss-script.cjs');

function renderMentionBindingsScript() {
  return String.raw`
    function setupMentionAndMenus() {
${renderMentionBindingsMenuScript()}

${renderMentionBindingsBubbleScript()}

${renderMentionBindingsDismissScript()}
    }
`;
}

module.exports = {
  renderMentionBindingsScript,
};
