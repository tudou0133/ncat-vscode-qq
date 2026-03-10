const { renderMessageDispatchStateMediaScript } = require('./message-dispatch-state-media-script.cjs');
const { renderMessageDispatchActionsScript } = require('./message-dispatch-actions-script.cjs');
const { renderMessageDispatchForwardScript } = require('./message-dispatch-forward-script.cjs');

function renderMessageDispatchScript() {
  return `
${renderMessageDispatchStateMediaScript()}

${renderMessageDispatchActionsScript()}

${renderMessageDispatchForwardScript()}

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'state') return void handleStateMessage(msg);
      if (msg.type === 'sendResult') return void handleSendResultMessage(msg);
      if (msg.type === 'resolveImageUrlResult') return void handleResolveImageUrlResultMessage(msg);
      if (msg.type === 'retryMessageMediaResult') return void handleRetryMessageMediaResultMessage(msg);
      if (msg.type === 'downloadChatFilesResult') return void handleDownloadChatFilesResultMessage(msg);
      if (msg.type === 'stickerPackListResult') return void handleStickerPackListResultMessage(msg);
      if (msg.type === 'olderResult') return void handleOlderResultMessage(msg);
      if (msg.type === 'quickActionResult') return void handleQuickActionResultMessage(msg);
      if (msg.type === 'addToStickerPackResult') return void handleAddToStickerPackResultMessage(msg);
      if (msg.type === 'settingsActionResult') return void handleSettingsActionResultMessage(msg);
      if (msg.type === 'saveBackendSettingsResult') return void handleSaveBackendSettingsResultMessage(msg);
      if (msg.type === 'saveHiddenSettingsResult') return void handleSaveHiddenSettingsResultMessage(msg);
      if (msg.type === 'forwardPreview') return void handleForwardPreviewMessage(msg);
    });
`;
}

module.exports = {
  renderMessageDispatchScript,
};
