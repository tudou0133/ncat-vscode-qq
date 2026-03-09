function renderMentionMenuScript() {
  return String.raw`
    function hasSelectedChat() {
      const selected = getSelectedChat();
      return !!selected;
    }

    function isMentionBoundaryChar(ch) {
      if (!ch) {
        return true;
      }
      if (String(ch).trim() === '') {
        return true;
      }
      const punctuation = ',.;:!?~!@#$%^&*()_+-=[]{}|<>/?，。；：！？、（）【】《》「」' + "'" + '"' + String.fromCharCode(92);
      return punctuation.includes(ch);
    }

    function closeMentionMenu() {
      mentionState.open = false;
      mentionState.start = -1;
      mentionState.end = -1;
      mentionState.query = '';
      mentionState.candidates = [];
      mentionState.selectedIndex = 0;
      const menu = document.getElementById('mentionMenu');
      if (menu) {
        menu.hidden = true;
        menu.innerHTML = '';
      }
    }

    function collectMentionCandidates(rawQuery) {
      if (!hasSelectedChat()) {
        return [];
      }
      const query = String(rawQuery || '').trim().toLowerCase();
      const seen = new Set();
      const entries = [];

      function addCandidate(userId, name, sourceRank) {
        const uid = String(userId || '').trim();
        if (!uid) {
          return;
        }
        const key = uid.toLowerCase();
        if (seen.has(key)) {
          return;
        }
        const display = String(name || '').trim() || ('QQ ' + uid);
        const haystack = (display + '\n' + uid).toLowerCase();
        if (query && !haystack.includes(query)) {
          return;
        }
        const rank = key === query ? 0 : display.toLowerCase().startsWith(query) ? 1 : haystack.includes(query) ? 2 : 3;
        seen.add(key);
        entries.push({
          userId: uid,
          displayName: display,
          sourceRank: Number(sourceRank || 9),
          rank,
        });
      }

      const selected = getSelectedChat();
      if (selected && selected.type === 'private' && /^\d+$/.test(String(selected.targetId || ''))) {
        addCandidate(String(selected.targetId), selected.title || '', 5);
      }
      if (selected && selected.type === 'group') {
        addCandidate('all', '全体成员', 0);
      }

      for (const member of Array.isArray(state.selectedMembers) ? state.selectedMembers : []) {
        addCandidate(member.userId, member.displayName || member.card || member.nickname || '', 1);
      }
      for (const msg of Array.isArray(state.selectedMessages) ? state.selectedMessages : []) {
        addCandidate(msg.senderId, msg.senderName || '', 2);
      }

      return entries
        .sort((a, b) =>
          a.rank - b.rank ||
          a.sourceRank - b.sourceRank ||
          a.displayName.localeCompare(b.displayName, 'zh-CN')
        )
        .slice(0, 30);
    }

    function findMentionContext(inputNode) {
      if (!inputNode) {
        return null;
      }
      const text = String(inputNode.value || '');
      const end = Number(inputNode.selectionStart || 0);
      const prefix = text.slice(0, end);
      const atIndex = Math.max(prefix.lastIndexOf('@'), prefix.lastIndexOf('＠'));
      if (atIndex < 0) {
        return null;
      }
      const before = atIndex > 0 ? prefix[atIndex - 1] : '';
      if (!isMentionBoundaryChar(before)) {
        return null;
      }
      const query = prefix.slice(atIndex + 1);
      if (!query && atIndex !== end - 1) {
        return null;
      }
      if (/\s/.test(query)) {
        return null;
      }
      return {
        start: atIndex,
        end,
        query,
      };
    }

    function positionMentionMenu() {
      const menu = document.getElementById('mentionMenu');
      const input = document.getElementById('composerInput');
      if (!menu || !input || menu.hidden) {
        return;
      }
      const stage = document.getElementById('stage');
      const stageRect = stage ? stage.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      const rect = input.getBoundingClientRect();
      const viewportPadding = 8;
      const menuHeight = Math.min(220, Math.max(80, menu.scrollHeight || 120));
      let top = rect.top - stageRect.top - menuHeight - 6;
      if (top < viewportPadding) {
        top = Math.min(stageRect.height - menuHeight - viewportPadding, rect.bottom - stageRect.top + 6);
      }
      const maxLeft = stageRect.width - Math.min(360, Math.max(220, menu.offsetWidth || 220)) - viewportPadding;
      const left = Math.max(viewportPadding, Math.min(rect.left - stageRect.left, maxLeft));
      menu.style.top = String(Math.round(top)) + 'px';
      menu.style.left = String(Math.round(left)) + 'px';
    }

    function applyMentionCandidate(candidate) {
      const input = document.getElementById('composerInput');
      if (!input || !candidate) {
        return;
      }
      const targetId = String(candidate.userId || '').trim();
      const token = '@' + targetId + ' ';
      if (!token.trim()) {
        return;
      }

      let start = mentionState.start;
      let end = mentionState.end;
      if (start < 0 || end < 0 || end < start) {
        const ctx = findMentionContext(input);
        if (!ctx) {
          return;
        }
        start = ctx.start;
        end = ctx.end;
      }

      const value = String(input.value || '');
      const next = value.slice(0, start) + token + value.slice(end);
      const cursor = start + token.length;
      input.value = next;
      input.focus();
      input.selectionStart = cursor;
      input.selectionEnd = cursor;
      closeMentionMenu();
      renderComposerState();
    }

    function renderMentionMenu() {
      const menu = document.getElementById('mentionMenu');
      if (!menu) {
        return;
      }
      if (!mentionState.open || mentionState.candidates.length === 0) {
        menu.hidden = true;
        menu.innerHTML = '';
        return;
      }
      menu.hidden = false;
      menu.innerHTML = '';

      mentionState.candidates.forEach((item, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mention-item' + (idx === mentionState.selectedIndex ? ' active' : '');
        btn.dataset.index = String(idx);

        const name = document.createElement('span');
        name.className = 'mention-name';
        name.textContent = item.displayName || ('QQ ' + item.userId);

        const id = document.createElement('span');
        id.className = 'mention-id';
        id.textContent = item.userId;

        btn.appendChild(name);
        btn.appendChild(id);
        btn.addEventListener('mousedown', (event) => {
          event.preventDefault();
          applyMentionCandidate(item);
        });
        menu.appendChild(btn);
      });

      positionMentionMenu();
    }

    function updateMentionMenuFromInput() {
      const input = document.getElementById('composerInput');
      if (!input || !hasSelectedChat()) {
        closeMentionMenu();
        return;
      }

      const ctx = findMentionContext(input);
      if (!ctx) {
        closeMentionMenu();
        return;
      }

      const candidates = collectMentionCandidates(ctx.query);
      if (candidates.length === 0) {
        closeMentionMenu();
        return;
      }

      mentionState.open = true;
      mentionState.start = ctx.start;
      mentionState.end = ctx.end;
      mentionState.query = ctx.query;
      mentionState.candidates = candidates;
      if (mentionState.selectedIndex >= candidates.length) {
        mentionState.selectedIndex = 0;
      }
      renderMentionMenu();
    }

    function insertMentionToken(userId) {
      const uid = String(userId || '').trim();
      if (!uid) {
        return;
      }
      const input = document.getElementById('composerInput');
      if (!input) {
        return;
      }
      const token = '@' + uid + ' ';
      const value = String(input.value || '');
      const hasLiveSelection =
        document.activeElement === input &&
        Number.isFinite(input.selectionStart) &&
        Number.isFinite(input.selectionEnd);
      const start = hasLiveSelection ? Number(input.selectionStart || 0) : Math.max(0, Math.min(value.length, Number(composerSelection.start || value.length)));
      const end = hasLiveSelection ? Number(input.selectionEnd || 0) : Math.max(start, Math.min(value.length, Number(composerSelection.end || value.length)));
      input.value = value.slice(0, start) + token + value.slice(end);
      const cursor = start + token.length;
      input.focus();
      input.selectionStart = cursor;
      input.selectionEnd = cursor;
      composerSelection.start = cursor;
      composerSelection.end = cursor;
      closeMentionMenu();
      renderComposerState();
    }

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
      const menu = document.getElementById('bubbleMenu');
      if (menu) {
        menu.hidden = true;
      }
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
      if (!menu) {
        return;
      }

      bubbleMenuState.open = true;
      bubbleMenuState.messageId = messageId;
      bubbleMenuState.senderName = String(payload?.senderName || '').trim();
      bubbleMenuState.rawMessageId = String(payload?.rawMessageId || '').trim();
      bubbleMenuState.text = String(payload?.text || '');
      bubbleMenuState.hasImage = !!payload?.hasImage;
      bubbleMenuState.canRecall = !!payload?.canRecall;
      if (saveStickerBtn) {
        saveStickerBtn.hidden = !bubbleMenuState.hasImage;
      }
      if (recallBtn) {
        recallBtn.hidden = !bubbleMenuState.canRecall;
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

    function setupMentionAndMenus() {
      document.getElementById('avatarMenuAt').addEventListener('click', () => {
        if (!avatarMenuState.senderId) {
          return;
        }
        insertMentionToken(avatarMenuState.senderId);
        closeAvatarMenu();
      });

      document.getElementById('avatarMenuPoke').addEventListener('click', () => {
        const selected = getSelectedChat();
        if (!selected || !avatarMenuState.senderId) {
          return;
        }
        vscode.postMessage({
          type: 'sendPoke',
          chatId: selected.id,
          targetId: avatarMenuState.senderId,
        });
        closeAvatarMenu();
      });

      document.getElementById('avatarMenuCopyId').addEventListener('click', async () => {
        if (!avatarMenuState.senderId) {
          return;
        }
        const copied = await copyToClipboard(avatarMenuState.senderId);
        if (copied) {
          logWeb('info', 'qq copied: ' + avatarMenuState.senderId);
        } else {
          logWeb('warn', 'qq copy failed: ' + avatarMenuState.senderId);
        }
        closeAvatarMenu();
      });

      document.getElementById('chatTitleMenuCopy').addEventListener('click', async () => {
        if (!chatTitleMenuState.targetId) {
          return;
        }
        const copied = await copyToClipboard(chatTitleMenuState.targetId);
        if (copied) {
          logWeb('info', 'chat target copied: ' + chatTitleMenuState.chatId);
        } else {
          logWeb('warn', 'chat target copy failed: ' + chatTitleMenuState.chatId);
        }
        closeChatTitleMenu();
      });

      document.getElementById('chatTitleMenuHide').addEventListener('click', () => {
        if (!chatTitleMenuState.chatId) {
          return;
        }
        vscode.postMessage({
          type: 'hideChat',
          chatId: chatTitleMenuState.chatId,
        });
        closeChatTitleMenu();
      });

      document.getElementById('bubbleMenuReply').addEventListener('click', () => {
        const msg = findMessageById(bubbleMenuState.messageId);
        if (!msg) {
          closeBubbleMenu();
          return;
        }
        const rawId = String(msg.rawMessageId || '').trim();
        if (!rawId) {
          logWeb('warn', 'reply ignored: missing rawMessageId for message=' + String(msg.id || ''));
          closeBubbleMenu();
          return;
        }
        const sender = String(msg.senderName || msg.senderId || '某人');
        const preview = getMessageActionText(msg).slice(0, 36);
        setPendingReply({
          messageId: rawId,
          senderName: sender,
          preview,
        });
        closeBubbleMenu();
      });

      document.getElementById('bubbleMenuCopy').addEventListener('click', async () => {
        const msg = findMessageById(bubbleMenuState.messageId);
        if (!msg) {
          logWeb('warn', 'copy message ignored: message not found');
          closeBubbleMenu();
          return;
        }
        const imageUrls = getMessageImageUrls(msg);
        if (imageUrls.length > 0) {
          const firstUrl = imageUrls[0];
          const imageCopy = await copyImageToClipboard(firstUrl);
          if (imageCopy.ok) {
            logWeb(
              'info',
              'message image copied: count=' + String(imageUrls.length) + ', mime=' + String(imageCopy.mime || '') + ', url=' + clipForLog(firstUrl)
            );
            closeBubbleMenu();
            return;
          }
          const fallbackText = imageUrls.join('\n');
          const fallbackCopied = await copyToClipboard(fallbackText);
          if (fallbackCopied) {
            logWeb(
              'warn',
              'message image binary copy failed, copied image url(s) instead: reason=' + String(imageCopy.reason || 'unknown') + ', first=' + clipForLog(firstUrl)
            );
            closeBubbleMenu();
            return;
          }
          logWeb(
            'warn',
            'message image copy failed: reason=' + String(imageCopy.reason || 'unknown') + ', first=' + clipForLog(firstUrl)
          );
          closeBubbleMenu();
          return;
        }
        const text = msg ? getMessageActionText(msg) : '';
        if (!text) {
          logWeb('warn', 'copy message ignored: empty text');
          closeBubbleMenu();
          return;
        }
        const copied = await copyToClipboard(text);
        if (copied) {
          logWeb('info', 'message copied');
        } else {
          logWeb('warn', 'message copy failed');
        }
        closeBubbleMenu();
      });

      document.getElementById('bubbleMenuCopyRaw').addEventListener('click', async () => {
        const msg = findMessageById(bubbleMenuState.messageId);
        if (!msg) {
          logWeb('warn', 'copy raw message ignored: message not found');
          closeBubbleMenu();
          return;
        }
        const payload = {
          id: String(msg.id || ''),
          rawMessageId: String(msg.rawMessageId || ''),
          direction: String(msg.direction || ''),
          displayStyle: String(msg.displayStyle || 'bubble'),
          senderId: String(msg.senderId || ''),
          senderName: String(msg.senderName || ''),
          timestamp: Number(msg.timestamp || 0),
          segments: Array.isArray(msg.segments) ? msg.segments : [],
        };
        const raw = JSON.stringify(payload, null, 2);
        const copied = await copyToClipboard(raw);
        if (copied) {
          logWeb('info', 'raw message json copied');
        } else {
          logWeb('warn', 'raw message json copy failed');
        }
        closeBubbleMenu();
      });

      document.getElementById('bubbleMenuRecall').addEventListener('click', () => {
        const selected = getSelectedChat();
        const msg = findMessageById(bubbleMenuState.messageId);
        if (!selected || !msg) {
          closeBubbleMenu();
          return;
        }
        const rawId = String(msg.rawMessageId || bubbleMenuState.rawMessageId || '').trim();
        if (!rawId) {
          logWeb('warn', 'recall ignored: missing rawMessageId');
          closeBubbleMenu();
          return;
        }
        vscode.postMessage({
          type: 'recallChatMessage',
          chatId: selected.id,
          messageId: String(msg.id || ''),
          rawMessageId: rawId,
        });
        closeBubbleMenu();
      });

      document.getElementById('bubbleMenuSaveSticker').addEventListener('click', () => {
        const msg = findMessageById(bubbleMenuState.messageId);
        if (!msg) {
          logWeb('warn', 'save sticker ignored: message not found');
          closeBubbleMenu();
          return;
        }
        const imageUrls = getMessageImageUrls(msg);
        if (imageUrls.length === 0) {
          logWeb('warn', 'save sticker ignored: no image in message');
          closeBubbleMenu();
          return;
        }
        vscode.postMessage({
          type: 'addToStickerPack',
          chatId: String(state.selectedChatId || ''),
          messageId: String(msg.id || ''),
          urls: imageUrls,
        });
        closeBubbleMenu();
      });

      document.getElementById('bubbleMenuPlusOne').addEventListener('click', () => {
        const selected = getSelectedChat();
        const msg = findMessageById(bubbleMenuState.messageId);
        if (!selected || !msg) {
          closeBubbleMenu();
          return;
        }
        if (sendBusy) {
          closeBubbleMenu();
          return;
        }
        const imageUrls = getMessageImageUrls(msg);
        const text = getMessageActionText(msg, {
          includeImagePlaceholder: false,
          includeVideoPlaceholder: true,
        });
        if (imageUrls.length === 0) {
          sendQuickText(text || '+1');
          closeBubbleMenu();
          return;
        }

        const sendText = String(text || '').trim();
        closeBubbleMenu();
        (async () => {
          sendBusy = true;
          forceScrollBottom = true;
          renderComposerState();
          const images = [];
          for (const url of imageUrls) {
            try {
              const resolved = await requestResolveImageUrl(url);
              const dataUrl = String(resolved?.dataUrl || '').trim();
              if (!dataUrl.startsWith('data:image/')) {
                continue;
              }
              images.push({
                name: String(resolved?.name || 'image.png'),
                dataUrl,
              });
            } catch (error) {
              logWeb('warn', 'plus one image resolve failed: url=' + clipForLog(url) + ', reason=' + String(error?.message || error));
            }
          }

          if (images.length === 0 && !sendText) {
            sendBusy = false;
            renderComposerState();
            logWeb('warn', 'plus one ignored: message has image but all image resolve failed');
            return;
          }

          vscode.postMessage({
            type: 'sendChatMessage',
            chatId: selected.id,
            text: sendText,
            replyToMessageId: '',
            images,
          });
        })().catch((error) => {
          sendBusy = false;
          renderComposerState();
          logWeb('warn', 'plus one failed: ' + String(error?.message || error));
        });
      });

      document.addEventListener('mousedown', (event) => {
        const settingsOverlay = document.getElementById('settingsOverlay');
        if (settingsOverlay && settingsOverlay.classList.contains('open')) {
          return;
        }
        const mentionMenu = document.getElementById('mentionMenu');
        if (mentionMenu && !mentionMenu.hidden && !mentionMenu.contains(event.target)) {
          closeMentionMenu();
        }

        const avatarMenu = document.getElementById('avatarMenu');
        if (avatarMenu && !avatarMenu.hidden && !avatarMenu.contains(event.target)) {
          closeAvatarMenu();
        }

        const chatTitleMenu = document.getElementById('chatTitleMenu');
        if (chatTitleMenu && !chatTitleMenu.hidden && !chatTitleMenu.contains(event.target)) {
          closeChatTitleMenu();
        }

        const bubbleMenu = document.getElementById('bubbleMenu');
        if (bubbleMenu && !bubbleMenu.hidden && !bubbleMenu.contains(event.target)) {
          closeBubbleMenu();
        }
      });

      document.addEventListener('contextmenu', (event) => {
        const avatarMenu = document.getElementById('avatarMenu');
        if (avatarMenu && !avatarMenu.hidden && !avatarMenu.contains(event.target)) {
          closeAvatarMenu();
        }
        const chatTitleMenu = document.getElementById('chatTitleMenu');
        if (chatTitleMenu && !chatTitleMenu.hidden && !chatTitleMenu.contains(event.target)) {
          closeChatTitleMenu();
        }
        const bubbleMenu = document.getElementById('bubbleMenu');
        if (bubbleMenu && !bubbleMenu.hidden && !bubbleMenu.contains(event.target)) {
          closeBubbleMenu();
        }
      });

      document.getElementById('messages').addEventListener('scroll', () => {
        closeAvatarMenu();
        closeChatTitleMenu();
        closeBubbleMenu();
      });
    }
  `;
}

module.exports = {
  renderMentionMenuScript,
};
