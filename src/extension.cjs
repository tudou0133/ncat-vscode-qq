const vscode = require('vscode');
const { NCatSidebarProvider } = require('./sidebar/sidebar-provider.cjs');
const { NCatRuntime } = require('./runtime/ncat-runtime.cjs');
const { askForDigits, askForMessage, ensureConnectedWithPrompt } = require('./commands/prompt-utils.cjs');

/** @type {NCatRuntime | undefined} */
let runtime;

/** @type {NCatSidebarProvider | undefined} */
let sidebarProvider;

function activate(context) {
  runtime = new NCatRuntime(context);
  sidebarProvider = new NCatSidebarProvider(runtime);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('ncat.sidebarView', sidebarProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  const connect = vscode.commands.registerCommand('ncat.connect', async () => {
    await runtime.startPluginRuntime({
      silent: false,
      reason: 'command-connect',
    });
  });

  const disconnect = vscode.commands.registerCommand('ncat.disconnect', async () => {
    await runtime.stopPluginRuntime({
      trigger: 'command-disconnect',
    });
  });

  const bossKey = vscode.commands.registerCommand('ncat.bossKey', async () => {
    await vscode.commands.executeCommand('workbench.view.explorer');
  });

  const startBackend = vscode.commands.registerCommand('ncat.startBackend', async () => {
    const result = await runtime.startBackend({
      force: true,
      trigger: 'command-start-backend',
    });
    if (!result?.ok) {
      vscode.window.showWarningMessage(`NCat backend start failed: ${result?.reason || 'unknown error'}`);
      return;
    }
    vscode.window.setStatusBarMessage('NCat backend launch requested', 2500);
  });

  const sendPrivateMessage = vscode.commands.registerCommand('ncat.sendPrivateMessage', async () => {
    const ready = await ensureConnectedWithPrompt(runtime);
    if (!ready) {
      return;
    }

    const userId = await askForDigits('Target QQ number', 'Example: 2580453344');
    if (!userId) {
      return;
    }

    const message = await askForMessage();
    if (!message) {
      return;
    }

    try {
      const result = await runtime.sendPrivateMessage(userId, message);
      const messageId = result?.data?.message_id;
      runtime.log(messageId ? `send_private_msg success. message_id=${messageId}` : 'send_private_msg success.');
      vscode.window.showInformationMessage(
        messageId ? `Message sent successfully (id=${messageId}).` : 'Message sent successfully.'
      );
    } catch (error) {
      runtime.log(`send_private_msg failed: ${error?.message || String(error)}`);
      vscode.window.showErrorMessage(`Failed to send private message: ${error?.message || String(error)}`);
    }
  });

  const sendGroupMessage = vscode.commands.registerCommand('ncat.sendGroupMessage', async () => {
    const ready = await ensureConnectedWithPrompt(runtime);
    if (!ready) {
      return;
    }

    const groupId = await askForDigits('Target Group number', 'Example: 123456789');
    if (!groupId) {
      return;
    }

    const message = await askForMessage();
    if (!message) {
      return;
    }

    try {
      const result = await runtime.sendGroupMessage(groupId, message);
      const messageId = result?.data?.message_id;
      runtime.log(messageId ? `send_group_msg success. message_id=${messageId}` : 'send_group_msg success.');
      vscode.window.showInformationMessage(
        messageId ? `Group message sent (id=${messageId}).` : 'Group message sent successfully.'
      );
    } catch (error) {
      runtime.log(`send_group_msg failed: ${error?.message || String(error)}`);
      vscode.window.showErrorMessage(`Failed to send group message: ${error?.message || String(error)}`);
    }
  });

  const showLogs = vscode.commands.registerCommand('ncat.showLogs', () => {
    runtime.showLogs();
  });

  context.subscriptions.push(
    connect,
    disconnect,
    bossKey,
    startBackend,
    sendPrivateMessage,
    sendGroupMessage,
    showLogs,
    runtime,
    sidebarProvider
  );

  const config = vscode.workspace.getConfiguration();
  if (config.get('ncat.autoConnect', true)) {
    runtime.startPluginRuntime({
      silent: true,
      reason: 'auto-connect',
    });
  }
}

async function deactivate() {
  if (sidebarProvider) {
    sidebarProvider.dispose();
    sidebarProvider = undefined;
  }

  if (runtime) {
    await runtime.shutdownForDeactivate();
    runtime = undefined;
  }

}

module.exports = {
  activate,
  deactivate,
};
