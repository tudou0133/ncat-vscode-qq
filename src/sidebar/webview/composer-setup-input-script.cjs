function renderComposerSetupInputScript() {
  return String.raw`
      function sendFromComposer() {
        if (sendBusy) {
          return;
        }

        const selected = getSelectedChat();
        if (!selected) {
          renderComposerState();
          return;
        }

        const input = document.getElementById('composerInput');
        const text = input.value.trim();
        if (!text && pendingImages.length === 0) {
          return;
        }

        sendBusy = true;
        forceScrollBottom = true;
        renderComposerState();
        vscode.postMessage({
          type: 'sendChatMessage',
          chatId: selected.id,
          text,
          replyToMessageId: String(pendingReply.messageId || ''),
          images: pendingImages.map((item) => ({
            name: item.name,
            dataUrl: item.dataUrl,
          })),
        });
      }

      document.getElementById('btnSend').addEventListener('click', () => {
        sendFromComposer();
      });

      document.getElementById('composerInput').addEventListener('keydown', (event) => {
        if (mentionState.open && mentionState.candidates.length > 0) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            mentionState.selectedIndex = (mentionState.selectedIndex + 1) % mentionState.candidates.length;
            renderMentionMenu();
            return;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            mentionState.selectedIndex =
              (mentionState.selectedIndex - 1 + mentionState.candidates.length) % mentionState.candidates.length;
            renderMentionMenu();
            return;
          }
          if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            applyMentionCandidate(mentionState.candidates[mentionState.selectedIndex]);
            return;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            closeMentionMenu();
            return;
          }
        }
        if (event.isComposing) {
          return;
        }
        if (uiPrefs.enterToSend) {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendFromComposer();
          }
          return;
        }
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          sendFromComposer();
        }
      });

      document.getElementById('composerInput').addEventListener('input', () => {
        const input = document.getElementById('composerInput');
        if (input) {
          composerSelection.start = Number(input.selectionStart || 0);
          composerSelection.end = Number(input.selectionEnd || composerSelection.start);
        }
        renderComposerState();
        updateMentionMenuFromInput();
      });

      document.getElementById('composerInput').addEventListener('click', () => {
        const input = document.getElementById('composerInput');
        if (input) {
          composerSelection.start = Number(input.selectionStart || 0);
          composerSelection.end = Number(input.selectionEnd || composerSelection.start);
        }
        updateMentionMenuFromInput();
      });

      document.getElementById('composerInput').addEventListener('blur', () => {
        const input = document.getElementById('composerInput');
        if (input) {
          composerSelection.start = Number(input.selectionStart || composerSelection.start || 0);
          composerSelection.end = Number(input.selectionEnd || composerSelection.start);
        }
        setTimeout(() => {
          closeMentionMenu();
        }, 80);
      });

      document.getElementById('composerInput').addEventListener('keyup', () => {
        const input = document.getElementById('composerInput');
        if (input) {
          composerSelection.start = Number(input.selectionStart || 0);
          composerSelection.end = Number(input.selectionEnd || composerSelection.start);
        }
        updateMentionMenuFromInput();
      });

      document.getElementById('composerInput').addEventListener('select', () => {
        const input = document.getElementById('composerInput');
        if (input) {
          composerSelection.start = Number(input.selectionStart || 0);
          composerSelection.end = Number(input.selectionEnd || composerSelection.start);
        }
      });
`;
}

module.exports = {
  renderComposerSetupInputScript,
};
