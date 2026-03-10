const vscode = require('vscode');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { renderHtml } = require('./render-html.cjs');

function toSafeExternalUrl(value) {
  const raw = String(value || '')
    .replace(/\\\//g, '/')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/[",]+$/g, '');
  if (!raw) {
    return '';
  }
  const lower = raw.toLowerCase();
  if (lower.startsWith('mqqapi://') || lower.startsWith('mqqopensdkapi://') || lower.startsWith('tencent.mobileqq://')) {
    return raw;
  }
  try {
    const parsed = new URL(raw);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === 'http:' || protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // Ignore invalid URL.
  }
  return '';
}

function parsePokeCommand(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    return null;
  }
  const match = raw.match(/^\/poke(?:\s+(\d+))?\s*$/i);
  if (!match) {
    return null;
  }
  return {
    targetId: String(match[1] || '').trim(),
  };
}

function isHttpUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return false;
  }
  try {
    const parsed = new URL(raw);
    const protocol = String(parsed.protocol || '').toLowerCase();
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function extFromMime(mime) {
  const value = String(mime || '').toLowerCase().trim();
  if (value === 'image/png') return 'png';
  if (value === 'image/jpeg' || value === 'image/jpg') return 'jpg';
  if (value === 'image/gif') return 'gif';
  if (value === 'image/webp') return 'webp';
  if (value === 'image/bmp') return 'bmp';
  if (value === 'image/x-icon' || value === 'image/vnd.microsoft.icon') return 'ico';
  return 'png';
}

function sanitizeFileStem(value) {
  const text = String(value || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) {
    return 'sticker';
  }
  return text.slice(0, 64);
}

function decodeDataUrlImage(dataUrl) {
  const raw = String(dataUrl || '').trim();
  const match = raw.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) {
    return null;
  }
  const mime = String(match[1] || '').toLowerCase().trim();
  const base64 = String(match[2] || '').trim();
  if (!mime.startsWith('image/') || !base64) {
    return null;
  }
  try {
    return {
      mime,
      buffer: Buffer.from(base64, 'base64'),
    };
  } catch {
    return null;
  }
}

function isStickerImageFileName(fileName) {
  return /\.(png|jpe?g|gif|webp|bmp|ico)$/i.test(String(fileName || ''));
}

function mimeFromStickerFileName(fileName) {
  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  return 'application/octet-stream';
}

class NCatSidebarProvider {
  constructor(runtime) {
    this.runtime = runtime;
    this.view = null;
    this.selectedChatId = '';
    this.searchQuery = '';
    this.stickerItemPathById = new Map();
    this.disposable = runtime.onUiState(() => {
      this.pushState();
    });
  }

  resolveWebviewView(webviewView) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.runtime.context.extensionUri],
    };
    webviewView.webview.html = renderHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (!msg || typeof msg !== 'object') {
        return;
      }

      if (msg.type === 'ready') {
        this.ensureGroupMembersForChat(this.selectedChatId);
        this.pushState();
        return;
      }

      if (msg.type === 'updateSearchQuery') {
        this.searchQuery = String(msg.query || '');
        this.pushState();
        return;
      }

      if (msg.type === 'selectChat') {
        const previousChatId = this.selectedChatId;
        const chatId = String(msg.chatId || '');
        if (previousChatId) {
          this.runtime.markChatRead(previousChatId);
        }
        this.selectedChatId = chatId;
        if (chatId) {
          this.runtime.markChatRead(chatId);
          this.ensureGroupMembersForChat(chatId);
        }
        this.pushState();
        return;
      }

      if (msg.type === 'openSearchResult') {
        const type = String(msg.chatType || '');
        const targetId = String(msg.targetId || '');
        if (!type || !targetId) {
          return;
        }

        const chatId = `${type}:${targetId}`;
        try {
          await this.runtime.ensureChatSession({
            type,
            targetId,
            title: String(msg.title || ''),
            avatarUrl: String(msg.avatarUrl || ''),
          });
          this.selectedChatId = chatId;
          this.runtime.markChatRead(chatId);
          this.ensureGroupMembersForChat(chatId);
          this.pushState();
        } catch (error) {
          const reason = error?.message || String(error);
          this.runtime.log(`openSearchResult failed: chatId=${chatId}, reason=${reason}`);
          vscode.window.showErrorMessage(`打开会话失败: ${reason}`);
        }
        return;
      }

      if (msg.type === 'connect') {
        await this.runtime.startPluginRuntime({
          silent: false,
          reason: 'sidebar-connect',
        });
        return;
      }

      if (msg.type === 'toggleRuntime') {
        const action = String(msg.action || '').trim();
        if (action === 'start') {
          await this.runtime.startPluginRuntime({
            silent: false,
            reason: 'sidebar-runtime-start',
          });
          this.pushState();
          return;
        }
        if (action === 'stop') {
          const result = await this.runtime.stopPluginRuntime({
            trigger: 'sidebar-runtime-stop',
          });
          if (!result?.ok && result?.reason) {
            vscode.window.showWarningMessage(`停止插件运行: ${result.reason}`);
          }
          this.selectedChatId = '';
          this.pushState();
          return;
        }
        return;
      }

      if (msg.type === 'showLogs') {
        this.runtime.showLogs();
        return;
      }

      if (msg.type === 'settingsAction') {
        const action = String(msg.action || '').trim();
        if (!action) {
          return;
        }
        if (action === 'openLogs') {
          this.runtime.showLogs();
          return;
        }
        if (action === 'openDownloadFolder') {
          const dir = String(this.runtime.resolveDownloadDir?.() || '').trim();
          if (!dir) {
            vscode.window.showWarningMessage('下载目录未就绪。');
            return;
          }
          try {
            fs.mkdirSync(dir, { recursive: true });
            const opened = await vscode.env.openExternal(vscode.Uri.file(dir));
            if (!opened) {
              vscode.window.showWarningMessage('下载文件夹打开失败，请稍后重试。');
            }
          } catch (error) {
            vscode.window.showWarningMessage(`下载文件夹打开失败: ${error?.message || String(error)}`);
          }
          return;
        }
        if (action === 'connect') {
          await this.runtime.startPluginRuntime({
            silent: false,
            reason: 'settings-connect',
          });
          return;
        }
        if (action === 'disconnect') {
          await this.runtime.stopPluginRuntime({
            trigger: 'settings-runtime-stop',
          });
          this.selectedChatId = '';
          this.pushState();
          return;
        }
        if (action === 'startBackend') {
          const result = await this.runtime.startBackend({
            force: true,
            trigger: 'settings-start-backend',
          });
          if (!result?.ok) {
            vscode.window.showWarningMessage(`启动 NCat 后端失败: ${result?.reason || '未知错误'}`);
          } else {
            vscode.window.setStatusBarMessage('NCat 后端启动请求已发送', 2400);
          }
          this.pushState();
          return;
        }
        if (action === 'stopBackend') {
          const result = await this.runtime.stopBackend({
            trigger: 'settings-stop-backend',
            enterManualMode: true,
            disconnectSocket: true,
          });
          if (!result?.ok) {
            vscode.window.showWarningMessage(`停止 NCat 后端: ${result?.reason || '未确认成功'}`);
          } else {
            vscode.window.setStatusBarMessage('NCat 后端已停止', 2400);
          }
          this.pushState();
          return;
        }
        if (action === 'reconnect') {
          this.runtime.disconnect();
          await this.runtime.connect({
            silent: false,
            reason: 'settings-reconnect',
          });
          this.pushState();
          return;
        }
        if (action === 'openExtensionSettings') {
          await vscode.commands.executeCommand('workbench.action.openSettings', 'ncat');
          return;
        }
        if (action === 'openNapcatReleases') {
          const target = 'https://github.com/NapNeko/NapCatQQ/releases';
          const opened = await vscode.env.openExternal(vscode.Uri.parse(target));
          if (!opened) {
            vscode.window.showWarningMessage('NCat 发布页打开失败，请稍后重试。');
          }
          return;
        }
        if (action === 'openBackendWeb') {
          const config = vscode.workspace.getConfiguration();
          const backendWeb = this.runtime.resolveBackendWebAccess(config);
          const externalUrl = toSafeExternalUrl(backendWeb.resolvedUrl);
          if (!externalUrl) {
            vscode.window.showWarningMessage('后端 WebUI 地址未就绪，请先启动后端并等待日志输出。');
            return;
          }
          this.runtime.log(
            `openBackendWeb: resolved=${externalUrl}, token=${backendWeb.webToken ? '(present)' : '(missing)'}`
          );
          const opened = await vscode.env.openExternal(vscode.Uri.parse(externalUrl));
          if (!opened) {
            vscode.window.showWarningMessage('后端 WebUI 打开失败，请稍后重试。');
          }
          return;
        }
        if (action === 'clearCache') {
          this.runtime.clearChatCache();
          this.selectedChatId = '';
          this.searchQuery = '';
          this.pushState();
          this.view?.webview.postMessage({
            type: 'settingsActionResult',
            action,
            ok: true,
          });
          return;
        }
        this.runtime.log(`Unknown settingsAction: ${action}`);
        return;
      }

      if (msg.type === 'saveBackendSettings') {
        const result = await this.saveBackendSettings(msg);
        this.pushState();
        this.view?.webview.postMessage({
          type: 'saveBackendSettingsResult',
          ok: result.ok,
          error: result.error || '',
        });
        if (!result.ok) {
          vscode.window.showErrorMessage(`保存后端设置失败: ${result.error || '未知错误'}`);
        }
        return;
      }

      if (msg.type === 'saveHiddenSettings') {
        try {
          const privateIds = String(msg.privateIds || '').trim();
          const groupIds = String(msg.groupIds || '').trim();
          this.runtime.setHiddenTargetsFromText(privateIds, groupIds, 'settings');
          if (this.selectedChatId) {
            const session = this.runtime.chatSessions.get(this.selectedChatId);
            if (session && this.runtime.isChatHidden(session.type, session.targetId)) {
              this.selectedChatId = '';
            }
          }
          this.pushState();
          this.view?.webview.postMessage({
            type: 'saveHiddenSettingsResult',
            ok: true,
            error: '',
          });
        } catch (error) {
          const reason = error?.message || String(error);
          this.runtime.log(`saveHiddenSettings failed: ${reason}`);
          this.view?.webview.postMessage({
            type: 'saveHiddenSettingsResult',
            ok: false,
            error: reason,
          });
        }
        return;
      }

      if (msg.type === 'hideChat') {
        const chatId = String(msg.chatId || '').trim();
        const result = this.runtime.hideChatById(chatId, 'title-menu');
        if (!result?.ok) {
          this.view?.webview.postMessage({
            type: 'quickActionResult',
            action: 'hideChat',
            ok: false,
            error: String(result?.reason || 'hide failed'),
          });
          return;
        }
        if (this.selectedChatId === chatId) {
          this.selectedChatId = '';
        }
        this.pushState();
        this.view?.webview.postMessage({
          type: 'quickActionResult',
          action: 'hideChat',
          ok: true,
          chatId,
        });
        return;
      }

      if (msg.type === 'openExternalLink') {
        const externalUrl = toSafeExternalUrl(msg.url);
        if (!externalUrl) {
          const reason = `invalid url: ${String(msg.url || '')}`;
          this.runtime.log(`openExternalLink ignored: ${reason}`);
          return;
        }
        try {
          const opened = await vscode.env.openExternal(vscode.Uri.parse(externalUrl));
          if (!opened) {
            this.runtime.log(`openExternalLink failed: url=${externalUrl}`);
            vscode.window.showWarningMessage('链接打开失败，请稍后重试。');
          }
        } catch (error) {
          const reason = error?.message || String(error);
          this.runtime.log(`openExternalLink error: url=${externalUrl}, reason=${reason}`);
          vscode.window.showWarningMessage(`链接打开失败: ${reason}`);
        }
        return;
      }

      if (msg.type === 'webLog') {
        const level = String(msg.level || 'info');
        const message = String(msg.message || '').trim();
        if (message) {
          this.runtime.log(`[web:${level}] ${message}`);
        }
        return;
      }

      if (msg.type === 'resolveImageUrl') {
        const requestId = String(msg.requestId || '').trim();
        const rawUrl = String(msg.url || '').trim();
        if (!requestId || !rawUrl) {
          this.view?.webview.postMessage({
            type: 'resolveImageUrlResult',
            requestId,
            ok: false,
            error: 'invalid request',
            dataUrl: '',
            name: '',
          });
          return;
        }
        try {
          const resolved = await this.runtime.resolveImageUrlToDataUrl(rawUrl);
          this.view?.webview.postMessage({
            type: 'resolveImageUrlResult',
            requestId,
            ok: true,
            dataUrl: String(resolved?.dataUrl || ''),
            name: String(resolved?.name || 'image.png'),
            mime: String(resolved?.mime || ''),
          });
        } catch (error) {
          const reason = error?.message || String(error);
          this.view?.webview.postMessage({
            type: 'resolveImageUrlResult',
            requestId,
            ok: false,
            error: reason,
            dataUrl: '',
            name: '',
          });
        }
        return;
      }

      if (msg.type === 'retryMessageMedia') {
        const chatId = String(msg.chatId || '').trim();
        const messageId = String(msg.messageId || '').trim();
        const rawMessageId = String(msg.rawMessageId || '').trim();
        const sourceUrl = String(msg.sourceUrl || '').trim();
        const reason = String(msg.reason || '').trim();
        if (!chatId || (!messageId && !rawMessageId)) {
          this.view?.webview.postMessage({
            type: 'retryMessageMediaResult',
            ok: false,
            chatId,
            messageId,
            rawMessageId,
            error: 'invalid retry payload',
          });
          return;
        }
        try {
          const result = await this.runtime.refreshMessageMediaForChat(chatId, {
            localMessageId: messageId,
            rawMessageId,
            sourceUrl,
            trigger: reason || 'web-media-retry',
          });
          this.view?.webview.postMessage({
            type: 'retryMessageMediaResult',
            ok: Boolean(result?.ok),
            updated: Boolean(result?.updated),
            chatId,
            messageId,
            rawMessageId: String(result?.rawMessageId || rawMessageId),
            noRetry: Boolean(result?.noRetry),
            error: String(result?.error || ''),
          });
        } catch (error) {
          const errText = error?.message || String(error);
          this.runtime.log(`retryMessageMedia failed: chatId=${chatId}, messageId=${messageId}, rawMessageId=${rawMessageId}, reason=${errText}`);
          this.view?.webview.postMessage({
            type: 'retryMessageMediaResult',
            ok: false,
            updated: false,
            chatId,
            messageId,
            rawMessageId,
            error: errText,
          });
        }
        return;
      }

      if (msg.type === 'addToStickerPack') {
        const rawUrls = Array.isArray(msg.urls) ? msg.urls : [];
        const uniqUrls = [];
        const seen = new Set();
        for (const item of rawUrls) {
          const normalized = toSafeExternalUrl(item);
          if (!isHttpUrl(normalized)) {
            continue;
          }
          if (seen.has(normalized)) {
            continue;
          }
          seen.add(normalized);
          uniqUrls.push(normalized);
        }

        if (uniqUrls.length === 0) {
          this.view?.webview.postMessage({
            type: 'addToStickerPackResult',
            ok: false,
            savedCount: 0,
            failedCount: 0,
            dir: '',
            error: '消息里没有可保存的图片',
          });
          return;
        }

        const result = await this.saveImagesToStickerPack(uniqUrls);
        this.view?.webview.postMessage({
          type: 'addToStickerPackResult',
          ok: result.ok,
          savedCount: result.savedCount,
          failedCount: result.failedCount,
          dir: result.dir,
          error: result.error || '',
        });
        if (result.ok) {
          vscode.window.setStatusBarMessage(
            `已添加到表情包: ${result.savedCount} 张${result.failedCount > 0 ? `（失败 ${result.failedCount}）` : ''}`,
            2600
          );
        } else {
          vscode.window.showWarningMessage(`添加到表情包失败: ${result.error || '未知错误'}`);
        }
        return;
      }

      if (msg.type === 'downloadChatFiles') {
        const entries = Array.isArray(msg.files) ? msg.files : [];
        const normalizedFiles = [];
        const seen = new Set();
        for (const item of entries) {
          const url = toSafeExternalUrl(item?.url || '');
          if (!isHttpUrl(url)) {
            continue;
          }
          if (seen.has(url)) {
            continue;
          }
          seen.add(url);
          normalizedFiles.push({
            url,
            name: String(item?.name || '').trim(),
          });
        }
        if (normalizedFiles.length === 0) {
          this.view?.webview.postMessage({
            type: 'downloadChatFilesResult',
            ok: false,
            savedCount: 0,
            failedCount: 0,
            error: '没有可下载的文件链接',
            dir: String(this.runtime.resolveDownloadDir?.() || ''),
          });
          vscode.window.showWarningMessage('这条文件消息没有可下载的链接。');
          return;
        }

        const results = [];
        let savedCount = 0;
        let failedCount = 0;
        let dir = '';
        for (const item of normalizedFiles) {
          try {
            const saved = await this.runtime.downloadFileFromUrl(item.url, item.name);
            dir = String(saved?.dir || dir || '');
            results.push(saved);
            savedCount += 1;
          } catch (error) {
            failedCount += 1;
            this.runtime.log(`downloadChatFiles failed: url=${item.url}, reason=${error?.message || String(error)}`);
          }
        }

        const ok = savedCount > 0;
        this.view?.webview.postMessage({
          type: 'downloadChatFilesResult',
          ok,
          savedCount,
          failedCount,
          dir: dir || String(this.runtime.resolveDownloadDir?.() || ''),
          error: ok ? '' : '文件下载失败',
        });
        if (ok) {
          vscode.window.showInformationMessage(`文件已下载到: ${dir || this.runtime.resolveDownloadDir?.() || ''}`);
        } else {
          vscode.window.showWarningMessage('文件下载失败。');
        }
        return;
      }

      if (msg.type === 'listStickerPack') {
        const result = await this.listStickerPackItems();
        const safeItems = Array.isArray(result.items)
          ? result.items.map((item, idx) => ({
              id: String(item?.id || ('sticker-' + idx)),
              name: String(item?.name || 'sticker'),
              dataUrl: String(item?.dataUrl || ''),
              filePath: String(item?.filePath || ''),
            }))
          : [];
        this.stickerItemPathById.clear();
        for (const item of safeItems) {
          if (item.id && item.filePath) {
            this.stickerItemPathById.set(item.id, item.filePath);
          }
        }
        this.view?.webview.postMessage({
          type: 'stickerPackListResult',
          ok: result.ok,
          items: safeItems.map((item) => ({
            id: item.id,
            name: item.name,
            dataUrl: item.dataUrl,
          })),
          dir: result.dir,
          error: result.error || '',
        });
        return;
      }

      if (msg.type === 'addImagesToStickerPack') {
        const images = Array.isArray(msg.images) ? msg.images : [];
        const result = await this.saveDataUrlsToStickerPack(images);
        this.view?.webview.postMessage({
          type: 'addToStickerPackResult',
          ok: result.ok,
          savedCount: result.savedCount,
          failedCount: result.failedCount,
          dir: result.dir,
          error: result.error || '',
        });
        if (result.ok) {
          vscode.window.setStatusBarMessage(
            `已添加到表情包: ${result.savedCount} 张${result.failedCount > 0 ? `（失败 ${result.failedCount}）` : ''}`,
            2600
          );
        } else {
          vscode.window.showWarningMessage(`添加到表情包失败: ${result.error || '未知错误'}`);
        }
        return;
      }

      if (msg.type === 'removeFromStickerPack') {
        const stickerId = String(msg.id || '').trim();
        const targetPath = stickerId ? this.stickerItemPathById.get(stickerId) : '';
        if (!stickerId || !targetPath) {
          this.view?.webview.postMessage({
            type: 'quickActionResult',
            action: 'stickerDelete',
            ok: false,
            error: '未找到表情包项',
          });
          return;
        }
        try {
          fs.unlinkSync(targetPath);
          this.stickerItemPathById.delete(stickerId);
          this.runtime.log(`removeFromStickerPack success: id=${stickerId}, path=${targetPath}`);
          this.view?.webview.postMessage({
            type: 'quickActionResult',
            action: 'stickerDelete',
            ok: true,
            id: stickerId,
          });
        } catch (error) {
          const reason = error?.message || String(error);
          this.runtime.log(`removeFromStickerPack failed: id=${stickerId}, path=${targetPath}, reason=${reason}`);
          this.view?.webview.postMessage({
            type: 'quickActionResult',
            action: 'stickerDelete',
            ok: false,
            error: reason,
            id: stickerId,
          });
        }
        return;
      }

      if (msg.type === 'sendChatMessage') {
        const chatId = String(msg.chatId || this.selectedChatId || '');
        const text = String(msg.text || '');
        const replyToMessageId = String(msg.replyToMessageId || '').trim();
        const images = Array.isArray(msg.images) ? msg.images : [];
        if (!chatId || (!text.trim() && images.length === 0)) {
          return;
        }

        try {
          const pokeCommand = images.length === 0 ? parsePokeCommand(text) : null;
          if (pokeCommand) {
            await this.runtime.sendPokeToChat(chatId, pokeCommand.targetId);
          } else {
            await this.runtime.sendMessageToChat(chatId, {
              text,
              images,
              replyToMessageId,
            });
          }
          this.pushState();
          this.view?.webview.postMessage({
            type: 'sendResult',
            ok: true,
            chatId,
          });
        } catch (error) {
          const reason = error?.message || String(error);
          this.runtime.log(`send_chat_message failed: chatId=${chatId}, reason=${reason}`);
          vscode.window.showErrorMessage(`发送失败: ${reason}`);
          this.view?.webview.postMessage({
            type: 'sendResult',
            ok: false,
            chatId,
            error: reason,
          });
        }
        return;
      }

      if (msg.type === 'sendStickerQuick') {
        const chatId = String(msg.chatId || this.selectedChatId || '');
        const dataUrl = String(msg.dataUrl || '').trim();
        const name = String(msg.name || 'sticker.png');
        const replyToMessageId = String(msg.replyToMessageId || '').trim();
        if (!chatId || !dataUrl.startsWith('data:image/')) {
          this.view?.webview.postMessage({
            type: 'quickActionResult',
            action: 'stickerSend',
            ok: false,
            error: 'invalid sticker payload',
          });
          return;
        }

        try {
          await this.runtime.sendMessageToChat(chatId, {
            text: '',
            replyToMessageId,
            images: [{ name, dataUrl }],
          });
          this.pushState();
          this.view?.webview.postMessage({
            type: 'quickActionResult',
            action: 'stickerSend',
            ok: true,
          });
        } catch (error) {
          const reason = error?.message || String(error);
          this.runtime.log(`send_sticker_quick failed: chatId=${chatId}, reason=${reason}`);
          vscode.window.showErrorMessage(`发送表情包失败: ${reason}`);
          this.view?.webview.postMessage({
            type: 'quickActionResult',
            action: 'stickerSend',
            ok: false,
            error: reason,
          });
        }
        return;
      }

      if (msg.type === 'sendJsonMessage') {
        const chatId = String(msg.chatId || this.selectedChatId || '').trim();
        const rawJson = String(msg.rawJson || '').trim();
        const replyToMessageId = String(msg.replyToMessageId || '').trim();
        if (!chatId || !rawJson) {
          this.view?.webview.postMessage({
            type: 'quickActionResult',
            action: 'jsonSend',
            ok: false,
            error: 'invalid json payload',
          });
          return;
        }

        try {
          await this.runtime.sendJsonMessageToChat(chatId, rawJson, replyToMessageId);
          this.pushState();
          this.view?.webview.postMessage({
            type: 'quickActionResult',
            action: 'jsonSend',
            ok: true,
          });
        } catch (error) {
          const reason = error?.message || String(error);
          this.runtime.log(`send_json_message failed: chatId=${chatId}, reason=${reason}`);
          vscode.window.showErrorMessage(`发送 JSON 失败: ${reason}`);
          this.view?.webview.postMessage({
            type: 'quickActionResult',
            action: 'jsonSend',
            ok: false,
            error: reason,
          });
        }
        return;
      }

      if (msg.type === 'recallChatMessage') {
        const chatId = String(msg.chatId || this.selectedChatId || '').trim();
        const rawMessageId = String(msg.rawMessageId || '').trim();
        const messageId = String(msg.messageId || '').trim();
        if (!chatId || !rawMessageId) {
          this.view?.webview.postMessage({
            type: 'quickActionResult',
            action: 'recall',
            ok: false,
            error: 'invalid recall payload',
          });
          return;
        }

        try {
          await this.runtime.recallMessageFromChat(chatId, rawMessageId, messageId);
          this.pushState();
          this.view?.webview.postMessage({
            type: 'quickActionResult',
            action: 'recall',
            ok: true,
          });
        } catch (error) {
          const reason = error?.message || String(error);
          this.runtime.log(`recall_chat_message failed: chatId=${chatId}, rawMessageId=${rawMessageId}, reason=${reason}`);
          vscode.window.showErrorMessage(`撤回失败: ${reason}`);
          this.view?.webview.postMessage({
            type: 'quickActionResult',
            action: 'recall',
            ok: false,
            error: reason,
          });
        }
        return;
      }

      if (msg.type === 'sendPoke') {
        const chatId = String(msg.chatId || this.selectedChatId || '');
        const targetId = String(msg.targetId || '').trim();
        if (!chatId) {
          return;
        }
        try {
          await this.runtime.sendPokeToChat(chatId, targetId);
          this.pushState();
          this.view?.webview.postMessage({
            type: 'quickActionResult',
            action: 'poke',
            ok: true,
            targetId,
          });
        } catch (error) {
          const reason = error?.message || String(error);
          this.runtime.log(`sendPoke failed: chatId=${chatId}, targetId=${targetId || 'default'}, reason=${reason}`);
          vscode.window.showErrorMessage(`戳一戳失败: ${reason}`);
          this.view?.webview.postMessage({
            type: 'quickActionResult',
            action: 'poke',
            ok: false,
            targetId,
            error: reason,
          });
        }
        return;
      }

      if (msg.type === 'loadOlderMessages') {
        const chatId = String(msg.chatId || this.selectedChatId || '');
        if (!chatId) {
          return;
        }
        let added = 0;
        try {
          added = await this.runtime.loadOlderMessagesForChat(chatId);
        } catch (error) {
          this.runtime.log(`loadOlderMessages failed: ${error?.message || String(error)}`);
        }
        this.pushState();
        this.view?.webview.postMessage({
          type: 'olderResult',
          chatId,
          added,
        });
        return;
      }

      if (msg.type === 'openForward') {
        const forwardId = String(msg.forwardId || '');
        if (!forwardId) {
          return;
        }

        const session = this.selectedChatId ? this.runtime.chatSessions.get(this.selectedChatId) : null;
        this.view?.webview.postMessage({
          type: 'forwardPreview',
          loading: true,
          forwardId,
        });

        try {
          const preview = await this.runtime.getForwardPreview(forwardId, {
            chatId: this.selectedChatId,
            chatType: session?.type || '',
            targetId: session?.targetId || '',
          });
          this.view?.webview.postMessage({
            type: 'forwardPreview',
            ok: true,
            loading: false,
            payload: preview,
          });
        } catch (error) {
          const reason = error?.message || String(error);
          this.runtime.log(`openForward failed: forwardId=${forwardId}, reason=${reason}`);
          this.view?.webview.postMessage({
            type: 'forwardPreview',
            ok: false,
            loading: false,
            forwardId,
            error: reason,
          });
        }
      }
    });

    this.pushState();
  }

  resolveStickerPackDir() {
    const config = vscode.workspace.getConfiguration();
    const ncatRoot = String(this.runtime?.resolveNCatRootDir?.(config) || '').trim();
    if (ncatRoot) {
      return path.join(ncatRoot, 'vscode-sticker-pack');
    }
    const globalStorage = String(this.runtime?.context?.globalStorageUri?.fsPath || '').trim();
    if (globalStorage) {
      return path.join(globalStorage, 'sticker-pack');
    }
    const workspaceRoot = String(this.runtime?.getWorkspaceRoot?.() || '').trim();
    if (workspaceRoot) {
      return path.join(workspaceRoot, '.ncat-sticker-pack');
    }
    return path.join(os.homedir(), 'NCatVSC', 'sticker-pack');
  }

  async saveImagesToStickerPack(urls) {
    const targetDir = this.resolveStickerPackDir();
    try {
      fs.mkdirSync(targetDir, { recursive: true });
    } catch (error) {
      return {
        ok: false,
        savedCount: 0,
        failedCount: urls.length,
        dir: targetDir,
        error: `创建目录失败: ${error?.message || String(error)}`,
      };
    }

    let savedCount = 0;
    let failedCount = 0;
    const failures = [];

    for (let i = 0; i < urls.length; i += 1) {
      const url = String(urls[i] || '').trim();
      try {
        const resolved = await this.runtime.resolveImageUrlToDataUrl(url);
        const decoded = decodeDataUrlImage(resolved?.dataUrl || '');
        if (!decoded || !decoded.buffer || decoded.buffer.length === 0) {
          throw new Error('invalid image payload');
        }
        const rawName = String(resolved?.name || 'sticker').trim() || 'sticker';
        const parsed = path.parse(rawName);
        const stem = sanitizeFileStem(parsed.name || 'sticker');
        const ext = parsed.ext
          ? String(parsed.ext).replace(/^\./, '').toLowerCase()
          : extFromMime(decoded.mime || resolved?.mime || '');
        const fileName = `${stem}-${Date.now()}-${String(i + 1).padStart(2, '0')}.${ext || 'png'}`;
        const filePath = path.join(targetDir, fileName);
        fs.writeFileSync(filePath, decoded.buffer);
        savedCount += 1;
      } catch (error) {
        failedCount += 1;
        failures.push(error?.message || String(error));
        this.runtime.log(`saveImagesToStickerPack failed: url=${url}, reason=${error?.message || String(error)}`);
      }
    }

    if (savedCount === 0) {
      return {
        ok: false,
        savedCount,
        failedCount,
        dir: targetDir,
        error: failures[0] || '全部图片保存失败',
      };
    }

    this.runtime.log(`saveImagesToStickerPack success: saved=${savedCount}, failed=${failedCount}, dir=${targetDir}`);
    return {
      ok: true,
      savedCount,
      failedCount,
      dir: targetDir,
      error: failures[0] || '',
    };
  }

  async saveDataUrlsToStickerPack(images) {
    const targetDir = this.resolveStickerPackDir();
    try {
      fs.mkdirSync(targetDir, { recursive: true });
    } catch (error) {
      return {
        ok: false,
        savedCount: 0,
        failedCount: Array.isArray(images) ? images.length : 0,
        dir: targetDir,
        error: `创建目录失败: ${error?.message || String(error)}`,
      };
    }

    const rows = Array.isArray(images) ? images : [];
    let savedCount = 0;
    let failedCount = 0;
    const failures = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] || {};
      const dataUrl = String(row.dataUrl || '').trim();
      const decoded = decodeDataUrlImage(dataUrl);
      if (!decoded || !decoded.buffer || decoded.buffer.length === 0) {
        failedCount += 1;
        failures.push('invalid image payload');
        continue;
      }
      try {
        const rawName = String(row.name || 'sticker').trim() || 'sticker';
        const parsed = path.parse(rawName);
        const stem = sanitizeFileStem(parsed.name || 'sticker');
        const ext = parsed.ext
          ? String(parsed.ext).replace(/^\./, '').toLowerCase()
          : extFromMime(decoded.mime || '');
        const fileName = `${stem}-${Date.now()}-${String(i + 1).padStart(2, '0')}.${ext || 'png'}`;
        const filePath = path.join(targetDir, fileName);
        fs.writeFileSync(filePath, decoded.buffer);
        savedCount += 1;
      } catch (error) {
        failedCount += 1;
        failures.push(error?.message || String(error));
      }
    }

    if (savedCount === 0) {
      return {
        ok: false,
        savedCount,
        failedCount,
        dir: targetDir,
        error: failures[0] || '全部图片保存失败',
      };
    }

    this.runtime.log(`saveDataUrlsToStickerPack success: saved=${savedCount}, failed=${failedCount}, dir=${targetDir}`);
    return {
      ok: true,
      savedCount,
      failedCount,
      dir: targetDir,
      error: failures[0] || '',
    };
  }

  async listStickerPackItems() {
    const targetDir = this.resolveStickerPackDir();
    try {
      fs.mkdirSync(targetDir, { recursive: true });
    } catch (error) {
      return {
        ok: false,
        items: [],
        dir: targetDir,
        error: `创建目录失败: ${error?.message || String(error)}`,
      };
    }

    let entries = [];
    try {
      entries = fs.readdirSync(targetDir, { withFileTypes: true });
    } catch (error) {
      return {
        ok: false,
        items: [],
        dir: targetDir,
        error: `读取目录失败: ${error?.message || String(error)}`,
      };
    }

    const files = [];
    for (const entry of entries) {
      if (!entry?.isFile?.()) {
        continue;
      }
      if (!isStickerImageFileName(entry.name)) {
        continue;
      }
      const fullPath = path.join(targetDir, entry.name);
      let mtimeMs = 0;
      try {
        const stat = fs.statSync(fullPath);
        mtimeMs = Number(stat.mtimeMs || 0);
      } catch {
        mtimeMs = 0;
      }
      files.push({
        fullPath,
        name: entry.name,
        mtimeMs,
      });
    }

    files.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const limited = files.slice(0, 180);
    const items = [];
    for (let i = 0; i < limited.length; i += 1) {
      const file = limited[i];
      try {
        const buffer = fs.readFileSync(file.fullPath);
        if (!buffer || buffer.length === 0) {
          continue;
        }
        if (buffer.length > 8 * 1024 * 1024) {
          continue;
        }
        const mime = mimeFromStickerFileName(file.name);
        if (!mime.startsWith('image/')) {
          continue;
        }
        items.push({
          id: file.name + ':' + String(file.mtimeMs || 0),
          name: file.name,
          filePath: file.fullPath,
          dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
        });
      } catch (error) {
        this.runtime.log(`listStickerPackItems skip: file=${file.fullPath}, reason=${error?.message || String(error)}`);
      }
    }

    return {
      ok: true,
      items,
      dir: targetDir,
      error: '',
    };
  }

  pushState() {
    if (!this.view) {
      return;
    }

    if (this.selectedChatId) {
      this.runtime.markChatRead(this.selectedChatId);
    }
    const nextState = this.runtime.getUiState(this.selectedChatId, this.searchQuery);
    this.selectedChatId = nextState.selectedChatId;
    this.view.webview.postMessage({
      type: 'state',
      payload: nextState,
    });
  }

  async ensureGroupMembersForChat(chatId) {
    const full = String(chatId || '').trim();
    if (!full) {
      return;
    }

    const splitAt = full.indexOf(':');
    if (splitAt <= 0 || splitAt === full.length - 1) {
      return;
    }
    const chatType = full.slice(0, splitAt);
    const targetId = full.slice(splitAt + 1);

    if (chatType === 'group' && targetId) {
      try {
        await this.runtime.ensureGroupMembers(targetId, false);
      } catch (error) {
        this.runtime.log(`ensureGroupMembersForChat failed: chat=${full}, reason=${error?.message || String(error)}`);
      }
    }

    try {
      await this.runtime.refreshChatSenderNames(full, {
        reason: 'sidebar-open-chat',
      });
    } catch (error) {
      this.runtime.log(`refreshChatSenderNames failed: chat=${full}, reason=${error?.message || String(error)}`);
      return;
    }
  }

  async saveBackendSettings(msg) {
    const rootDir = String(msg?.rootDir || '').trim();
    const tokenFile = String(msg?.tokenFile || '').trim();
    const quickLoginUin = String(msg?.quickLoginUin || '').trim();

    const config = vscode.workspace.getConfiguration();
    const hasWorkspace = Array.isArray(vscode.workspace.workspaceFolders) && vscode.workspace.workspaceFolders.length > 0;
    const target = hasWorkspace ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
    const targetName = hasWorkspace ? 'workspace' : 'global';
    try {
      await config.update('ncat.rootDir', rootDir, target);
      await config.update('ncat.tokenFile', tokenFile, target);
      await config.update('ncat.quickLoginUin', quickLoginUin, target);
      this.runtime.log(
        `Backend settings saved: target=${targetName}, rootDir=${rootDir || '(empty)'}, quickLoginUin=${quickLoginUin || '(empty)'}`
      );
      return {
        ok: true,
      };
    } catch (error) {
      const reason = error?.message || String(error);
      this.runtime.log(`saveBackendSettings failed: ${reason}`);
      return {
        ok: false,
        error: reason,
      };
    }
  }

  dispose() {
    if (this.disposable) {
      this.disposable.dispose();
      this.disposable = null;
    }
    this.view = null;
  }
}

module.exports = {
  NCatSidebarProvider,
};
