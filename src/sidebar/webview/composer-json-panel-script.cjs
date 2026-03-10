function renderComposerJsonPanelScript() {
  return `
    const JSON_MESSAGE_SAMPLE = '{"app":"com.tencent.tuwen.lua","view":"news","meta":{"news":{"title":"标题","desc":"描述","jumpUrl":"https://example.com"}}}';
    let jsonComposerDraft = JSON_MESSAGE_SAMPLE;

    function closeJsonComposer() {
      const overlay = document.getElementById('jsonComposerOverlay');
      const errorNode = document.getElementById('jsonComposerError');
      if (overlay) {
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
      }
      if (errorNode) {
        errorNode.textContent = '';
      }
    }

    function openJsonComposer() {
      const overlay = document.getElementById('jsonComposerOverlay');
      const input = document.getElementById('jsonComposerInput');
      const errorNode = document.getElementById('jsonComposerError');
      if (!overlay || !input) {
        return;
      }
      input.value = jsonComposerDraft || JSON_MESSAGE_SAMPLE;
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      if (errorNode) {
        errorNode.textContent = '';
      }
      requestAnimationFrame(() => {
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
      });
    }

    function submitJsonComposer() {
      if (sendBusy) {
        return;
      }
      const selected = getSelectedChat();
      if (!selected) {
        logWeb('warn', 'json send ignored: no selected chat');
        closeJsonComposer();
        return;
      }
      const input = document.getElementById('jsonComposerInput');
      const errorNode = document.getElementById('jsonComposerError');
      const raw = String(input?.value || '').trim();
      jsonComposerDraft = raw || jsonComposerDraft;
      if (!raw) {
        if (errorNode) {
          errorNode.textContent = 'JSON 不能为空。';
        }
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
          if (errorNode) {
            errorNode.textContent = 'JSON 根节点必须是对象。';
          }
          return;
        }
        vscode.postMessage({
          type: 'sendJsonMessage',
          chatId: selected.id,
          rawJson: JSON.stringify(parsed),
          replyToMessageId: String(pendingReply.messageId || ''),
        });
        closeJsonComposer();
      } catch (error) {
        if (errorNode) {
          errorNode.textContent = 'JSON 格式错误: ' + String(error?.message || error);
        }
      }
    }
`;
}

module.exports = {
  renderComposerJsonPanelScript,
};
