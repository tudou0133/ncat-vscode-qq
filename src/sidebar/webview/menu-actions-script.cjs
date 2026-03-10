function renderMenuActionsScript() {
  return String.raw`
    function closeAvatarMenu() {
      avatarMenuState.open = false;
      avatarMenuState.senderId = '';
      avatarMenuState.senderName = '';
      avatarMenuState.chatId = '';
      const menu = document.getElementById('avatarMenu');
      if (menu) {
        menu.hidden = true;
      }
    }

    function closeChatTitleMenu() {
      chatTitleMenuState.open = false;
      chatTitleMenuState.chatId = '';
      chatTitleMenuState.chatType = '';
      chatTitleMenuState.targetId = '';
      chatTitleMenuState.title = '';
      const menu = document.getElementById('chatTitleMenu');
      if (menu) {
        menu.hidden = true;
      }
    }

    function openChatTitleMenu(chat, clientX, clientY) {
      const selected = chat || getSelectedChat();
      if (!selected) {
        return;
      }
      const chatId = String(selected.id || '').trim();
      const chatType = String(selected.type || '').trim();
      const targetId = String(selected.targetId || '').trim();
      if (!chatId || !chatType || !targetId) {
        return;
      }
      closeAvatarMenu();
      closeBubbleMenu();

      const menu = document.getElementById('chatTitleMenu');
      const copyBtn = document.getElementById('chatTitleMenuCopy');
      const hideBtn = document.getElementById('chatTitleMenuHide');
      if (!menu || !copyBtn || !hideBtn) {
        return;
      }

      chatTitleMenuState.open = true;
      chatTitleMenuState.chatId = chatId;
      chatTitleMenuState.chatType = chatType;
      chatTitleMenuState.targetId = targetId;
      chatTitleMenuState.title = String(selected.title || '').trim();

      const idLabel = chatType === 'group' ? '群号' : 'QQ号';
      copyBtn.textContent = '复制' + idLabel + ': ' + targetId;
      hideBtn.textContent = '在界面中隐藏';

      menu.hidden = false;
      const stage = document.getElementById('stage');
      const stageRect = stage ? stage.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      const viewportPadding = 8;
      const rect = menu.getBoundingClientRect();
      const left = Math.min(
        Math.max(viewportPadding, Number(clientX || 0) - stageRect.left),
        Math.max(viewportPadding, stageRect.width - rect.width - viewportPadding)
      );
      const top = Math.min(
        Math.max(viewportPadding, Number(clientY || 0) - stageRect.top),
        Math.max(viewportPadding, stageRect.height - rect.height - viewportPadding)
      );
      menu.style.left = String(Math.round(left)) + 'px';
      menu.style.top = String(Math.round(top)) + 'px';
    }

    function openAvatarMenu(payload, clientX, clientY) {
      const senderId = String(payload?.senderId || '').trim();
      if (!senderId) {
        return;
      }
      closeBubbleMenu();
      const selected = getSelectedChat();
      if (!selected) {
        return;
      }
      const menu = document.getElementById('avatarMenu');
      const atBtn = document.getElementById('avatarMenuAt');
      const pokeBtn = document.getElementById('avatarMenuPoke');
      const copyIdBtn = document.getElementById('avatarMenuCopyId');
      if (!menu || !atBtn || !pokeBtn || !copyIdBtn) {
        return;
      }

      avatarMenuState.open = true;
      avatarMenuState.senderId = senderId;
      avatarMenuState.senderName = String(payload?.senderName || '').trim() || senderId;
      avatarMenuState.chatId = selected.id;

      atBtn.textContent = 'AT ' + avatarMenuState.senderName;
      pokeBtn.textContent = '戳一戳 ' + avatarMenuState.senderName;
      copyIdBtn.textContent = '复制QQ号: ' + avatarMenuState.senderId;

      menu.hidden = false;
      const stage = document.getElementById('stage');
      const stageRect = stage ? stage.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      const viewportPadding = 8;
      const rect = menu.getBoundingClientRect();
      const left = Math.min(
        Math.max(viewportPadding, Number(clientX || 0) - stageRect.left),
        Math.max(viewportPadding, stageRect.width - rect.width - viewportPadding)
      );
      const top = Math.min(
        Math.max(viewportPadding, Number(clientY || 0) - stageRect.top),
        Math.max(viewportPadding, stageRect.height - rect.height - viewportPadding)
      );
      menu.style.left = String(Math.round(left)) + 'px';
      menu.style.top = String(Math.round(top)) + 'px';
    }

    function closeBubbleMenu() {
      bubbleMenuState.open = false;
      bubbleMenuState.messageId = '';
      bubbleMenuState.senderName = '';
      bubbleMenuState.rawMessageId = '';
      bubbleMenuState.text = '';
      bubbleMenuState.hasImage = false;
      bubbleMenuState.canRecall = false;
      bubbleMenuState.jumpTargetMessageId = '';
      bubbleMenuState.jumpTargetLabel = '';
      const menu = document.getElementById('bubbleMenu');
      if (menu) {
        menu.hidden = true;
      }
    }

    function extractBubbleJumpTarget(msg) {
      const segments = Array.isArray(msg?.segments) ? msg.segments : [];
      for (const seg of segments) {
        if (!seg || typeof seg !== 'object') {
          continue;
        }
        if (seg.type === 'reply') {
          const replyId = String(seg.replyId || '').trim();
          if (replyId) {
            return {
              rawMessageId: replyId,
              label: '引用消息',
            };
          }
        }
      }
      for (const seg of segments) {
        if (!seg || typeof seg !== 'object') {
          continue;
        }
        if (seg.type === 'recall_notice') {
          const recalledId = String(seg.recalledMessageId || '').trim();
          if (recalledId) {
            return {
              rawMessageId: recalledId,
              label: '被撤回消息',
            };
          }
        }
      }
      return null;
    }

    function extractForwardableJsonRaw(msg) {
      const segments = Array.isArray(msg?.segments) ? msg.segments : [];
      for (const seg of segments) {
        if (!seg || seg.type !== 'json') {
          continue;
        }
        const raw = String(seg.raw || '').trim();
        if (raw) {
          return raw;
        }
      }
      return '';
    }

    function extractCopyableRawJson(msg) {
      const segments = Array.isArray(msg?.segments) ? msg.segments : [];
      for (const seg of segments) {
        if (!seg || seg.type !== 'json') {
          continue;
        }
        const raw = String(seg.raw || '').trim();
        if (raw) {
          return raw;
        }
      }
      return '';
    }

    function extractDownloadableFiles(msg) {
      const segments = Array.isArray(msg?.segments) ? msg.segments : [];
      const out = [];
      const seen = new Set();
      for (const seg of segments) {
        if (!seg || seg.type !== 'file') {
          continue;
        }
        const url = String(seg.url || '').trim();
        if (!/^https?:\/\//i.test(url)) {
          continue;
        }
        if (seen.has(url)) {
          continue;
        }
        seen.add(url);
        out.push({
          url,
          name: String(seg.name || '').trim(),
        });
      }
      return out;
    }

    function buildForwardDraftFromMessage(msg) {
      if (!msg) {
        return null;
      }
      const jsonRaw = extractForwardableJsonRaw(msg);
      if (jsonRaw) {
        return {
          mode: 'json',
          rawJson: jsonRaw,
          summary: '转发 JSON 消息',
        };
      }
      const imageUrls = getMessageImageUrls(msg);
      const text = getMessageActionText(msg, {
        includeImagePlaceholder: false,
        includeVideoPlaceholder: true,
      });
      const sendText = String(text || '').trim();
      if (!sendText && imageUrls.length === 0) {
        return null;
      }
      return {
        mode: 'message',
        text: sendText,
        imageUrls,
        summary: sendText ? clipForLog(sendText, 60) : ('转发 ' + String(imageUrls.length) + ' 张图片'),
      };
    }

    function openBubbleMenu(payload, clientX, clientY) {
      const messageId = String(payload?.messageId || '').trim();
      if (!messageId) {
        return;
      }
      closeAvatarMenu();
      const menu = document.getElementById('bubbleMenu');
      const saveStickerBtn = document.getElementById('bubbleMenuSaveSticker');
      const recallBtn = document.getElementById('bubbleMenuRecall');
      const jumpBtn = document.getElementById('bubbleMenuJump');
      const forwardBtn = document.getElementById('bubbleMenuForward');
      const downloadBtn = document.getElementById('bubbleMenuDownload');
      if (!menu) {
        return;
      }

      const currentMsg = findMessageById(messageId);
      const jumpTarget = currentMsg ? extractBubbleJumpTarget(currentMsg) : null;
      const downloadableFiles = currentMsg ? extractDownloadableFiles(currentMsg) : [];

      bubbleMenuState.open = true;
      bubbleMenuState.messageId = messageId;
      bubbleMenuState.senderName = String(payload?.senderName || '').trim();
      bubbleMenuState.rawMessageId = String(payload?.rawMessageId || '').trim();
      bubbleMenuState.text = String(payload?.text || '');
      bubbleMenuState.hasImage = !!payload?.hasImage;
      bubbleMenuState.canRecall = !!payload?.canRecall;
      bubbleMenuState.jumpTargetMessageId = String(jumpTarget?.rawMessageId || '').trim();
      bubbleMenuState.jumpTargetLabel = String(jumpTarget?.label || '').trim();
      if (saveStickerBtn) {
        saveStickerBtn.hidden = !bubbleMenuState.hasImage;
      }
      if (recallBtn) {
        recallBtn.hidden = !bubbleMenuState.canRecall;
      }
      if (jumpBtn) {
        jumpBtn.hidden = !bubbleMenuState.jumpTargetMessageId;
        if (bubbleMenuState.jumpTargetLabel) {
          jumpBtn.textContent = '跳转到';
        }
      }
      if (forwardBtn) {
        forwardBtn.hidden = false;
      }
      if (downloadBtn) {
        downloadBtn.hidden = downloadableFiles.length === 0;
      }

      menu.hidden = false;
      const stage = document.getElementById('stage');
      const stageRect = stage ? stage.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      const viewportPadding = 8;
      const rect = menu.getBoundingClientRect();
      const left = Math.min(
        Math.max(viewportPadding, Number(clientX || 0) - stageRect.left),
        Math.max(viewportPadding, stageRect.width - rect.width - viewportPadding)
      );
      const top = Math.min(
        Math.max(viewportPadding, Number(clientY || 0) - stageRect.top),
        Math.max(viewportPadding, stageRect.height - rect.height - viewportPadding)
      );
      menu.style.left = String(Math.round(left)) + 'px';
      menu.style.top = String(Math.round(top)) + 'px';
    }

    function getMessageActionText(msg, options = {}) {
      const includeImagePlaceholder = options.includeImagePlaceholder !== false;
      const includeVideoPlaceholder = options.includeVideoPlaceholder !== false;
      const parts = [];
      const segments = Array.isArray(msg?.segments) ? msg.segments : [];
      for (const seg of segments) {
        if (!seg || typeof seg !== 'object') {
          continue;
        }
        if (seg.type === 'text') {
          const text = String(seg.text || '');
          if (text) {
            parts.push(text);
          }
          continue;
        }
        if (seg.type === 'mention' || seg.type === 'face' || seg.type === 'reply' || seg.type === 'forward' || seg.type === 'poke_notice' || seg.type === 'recall_notice') {
          const text = String(seg.text || '').trim();
          if (text) {
            parts.push(text);
          }
          continue;
        }
        if (seg.type === 'json') {
          const text = String(seg.summary || seg.title || seg.raw || '').trim();
          if (text) {
            parts.push(text);
          }
          continue;
        }
        if (seg.type === 'file') {
          const text = String(seg.text || seg.name || '[文件]').trim();
          if (text) {
            parts.push(text);
          }
          continue;
        }
        if (seg.type === 'image') {
          if (includeImagePlaceholder) {
            parts.push('[图片]');
          }
          continue;
        }
        if (seg.type === 'video') {
          if (includeVideoPlaceholder) {
            parts.push('[视频]');
          }
          continue;
        }
        if (typeof seg.text === 'string') {
          const text = String(seg.text || '').trim();
          if (text) {
            parts.push(text);
          }
        }
      }
      return parts.join('').trim();
    }

`;
}

module.exports = {
  renderMenuActionsScript,
};
