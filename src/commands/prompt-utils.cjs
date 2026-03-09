const vscode = require('vscode');

async function ensureConnectedWithPrompt(runtimeInstance) {
  if (runtimeInstance.isConnected()) {
    return true;
  }

  const answer = await vscode.window.showWarningMessage('NCat is offline. Connect now?', 'Connect');
  if (answer !== 'Connect') {
    return false;
  }

  const connected = await runtimeInstance.ensureConnected();
  if (!connected) {
    runtimeInstance.log('send command aborted: ensureConnected failed.');
    vscode.window.showErrorMessage('NCat connection did not become ready.');
    return false;
  }

  return true;
}

async function askForDigits(prompt, placeHolder) {
  return vscode.window.showInputBox({
    prompt,
    placeHolder,
    ignoreFocusOut: true,
    validateInput: (value) => (/^\d+$/.test(value) ? null : 'Value must be digits only.'),
  });
}

async function askForMessage() {
  return vscode.window.showInputBox({
    prompt: 'Message to send',
    placeHolder: 'Type your message',
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim() ? null : 'Message cannot be empty.'),
  });
}

module.exports = {
  askForDigits,
  askForMessage,
  ensureConnectedWithPrompt,
};
