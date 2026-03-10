const crypto = require('node:crypto');
const { renderComposerScript } = require('./webview/composer-script.cjs');
const { renderListForwardScript } = require('./webview/list-forward-script.cjs');
const { renderMessageScript } = require('./webview/message-script.cjs');
const { renderMentionMenuScript } = require('./webview/mention-menu-script.cjs');
const { renderSettingsScript } = require('./webview/settings-script.cjs');
const { renderWebviewStyles } = require('./webview/styles.cjs');
const { renderShellMarkup } = require('./webview/shell-markup.cjs');
const { renderStateInitScript } = require('./webview/state-init-script.cjs');
const { renderCommonUtilsScript } = require('./webview/common-utils-script.cjs');
const { renderBootstrapScript } = require('./webview/bootstrap-script.cjs');

function renderHtml(webview) {
  const nonce = crypto.randomBytes(16).toString('base64');
  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} https: http: data:`,
    `media-src ${webview.cspSource} https: http: data: blob:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NCat Chats</title>
  <style>
${renderWebviewStyles()}
  </style>
</head>
<body>
${renderShellMarkup()}

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

${renderStateInitScript()}

${renderCommonUtilsScript()}

${renderComposerScript()}

${renderSettingsScript()}

${renderMentionMenuScript()}

${renderListForwardScript()}

${renderMessageScript()}

${renderBootstrapScript()}
  </script>
</body>
</html>`;
}

module.exports = {
  renderHtml,
};
