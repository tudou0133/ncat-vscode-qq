function renderMentionBindingsBubbleScript() {
  return String.raw`
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

      document.getElementById('bubbleMenuJump').addEventListener('click', () => {
        const rawId = String(bubbleMenuState.jumpTargetMessageId || '').trim();
        if (!rawId) {
          closeBubbleMenu();
          return;
        }
        const targetMsg = findMessageByRawMessageId(rawId);
        const jumped = jumpToMessage(String(targetMsg?.id || ''), rawId);
        if (!jumped) {
          logWeb('warn', 'jump original message failed: rawMessageId=' + rawId);
        }
        closeBubbleMenu();
      });

      document.getElementById('bubbleMenuForward').addEventListener('click', () => {
        const msg = findMessageById(bubbleMenuState.messageId);
        closeBubbleMenu();
        if (!msg) {
          logWeb('warn', 'forward ignored: message not found');
          return;
        }
        const draft = buildForwardDraftFromMessage(msg);
        if (!draft) {
          logWeb('warn', 'forward ignored: no forwardable content');
          return;
        }
        openMessageForwardPicker(draft);
      });

      document.getElementById('bubbleMenuDownload').addEventListener('click', () => {
        const msg = findMessageById(bubbleMenuState.messageId);
        if (!msg) {
          logWeb('warn', 'download file ignored: message not found');
          closeBubbleMenu();
          return;
        }
        const files = extractDownloadableFiles(msg);
        if (files.length === 0) {
          logWeb('warn', 'download file ignored: no downloadable file url');
          closeBubbleMenu();
          return;
        }
        vscode.postMessage({
          type: 'downloadChatFiles',
          chatId: String(state.selectedChatId || ''),
          messageId: String(msg.id || ''),
          files,
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
        const rawJson = extractCopyableRawJson(msg);
        if (rawJson) {
          const copiedRawJson = await copyToClipboard(rawJson);
          if (copiedRawJson) {
            logWeb('info', 'raw card json copied');
          } else {
            logWeb('warn', 'raw card json copy failed');
          }
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
`;
}

module.exports = {
  renderMentionBindingsBubbleScript,
};
