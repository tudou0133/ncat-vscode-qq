function renderMessageMediaRecoveryScript() {
  return `
    const mediaResolveCache = new Map();
    const mediaResolveInFlight = new Map();
    const mediaResolveFailCache = new Map();
    const mediaBackendRetrySent = new Set();
    const MEDIA_RESOLVE_RETRY_COOLDOWN_MS = 90 * 1000;

    async function resolveMediaUrlToDataUrl(rawUrl) {
      const source = String(rawUrl || '').trim();
      if (!source || source.startsWith('data:image/')) {
        return source;
      }
      if (!isResolvableImageUrl(source)) {
        return '';
      }
      if (mediaResolveCache.has(source)) {
        return mediaResolveCache.get(source);
      }
      const failState = mediaResolveFailCache.get(source);
      if (failState && Number(failState.until || 0) > Date.now()) {
        return '';
      }
      if (mediaResolveInFlight.has(source)) {
        return mediaResolveInFlight.get(source);
      }
      const task = requestResolveImageUrl(source)
        .then((resolved) => {
          const dataUrl = String(resolved?.dataUrl || '').trim();
          if (dataUrl.startsWith('data:image/')) {
            mediaResolveCache.set(source, dataUrl);
            mediaResolveFailCache.delete(source);
            return dataUrl;
          }
          mediaResolveFailCache.set(source, {
            until: Date.now() + MEDIA_RESOLVE_RETRY_COOLDOWN_MS,
            reason: 'empty-data-url',
          });
          return '';
        })
        .catch((error) => {
          mediaResolveFailCache.set(source, {
            until: Date.now() + MEDIA_RESOLVE_RETRY_COOLDOWN_MS,
            reason: String(error?.message || error || 'resolve-failed'),
          });
          return '';
        })
        .finally(() => {
          mediaResolveInFlight.delete(source);
        });
      mediaResolveInFlight.set(source, task);
      return task;
    }

    function requestBackendRetryForMessageMedia(messageMeta, rawUrl, reason) {
      const chatId = String(messageMeta?.chatId || '').trim();
      const messageId = String(messageMeta?.messageId || '').trim();
      const rawMessageId = String(messageMeta?.rawMessageId || '').trim();
      const sourceUrl = String(rawUrl || '').trim();
      if (!chatId || (!messageId && !rawMessageId)) {
        return;
      }
      if (!isPluginRunning() || String(state.connectionState || '') !== 'online') {
        return;
      }
      if (rawMessageId && mediaNoRetryRawMessageIds.has(rawMessageId)) {
        return;
      }
      const key = [chatId, messageId || '-', rawMessageId || '-', sourceUrl || '-'].join('|');
      if (mediaBackendRetrySent.has(key)) {
        return;
      }
      mediaBackendRetrySent.add(key);
      logWeb(
        'info',
        'media backend retry request: chat=' + chatId +
          ', messageId=' + (messageId || '(none)') +
          ', rawMessageId=' + (rawMessageId || '(none)') +
          ', reason=' + String(reason || 'unknown')
      );
      vscode.postMessage({
        type: 'retryMessageMedia',
        chatId,
        messageId,
        rawMessageId,
        sourceUrl,
        reason: String(reason || ''),
      });
    }

    function attachImageAutoRecovery({ thumbNode, popupImageNode, rawUrl, messageMeta, reasonTag }) {
      const source = String(rawUrl || '').trim();
      if (!source) {
        return;
      }
      let resolving = false;
      thumbNode.addEventListener('error', () => {
        if (resolving) {
          return;
        }
        const currentSrc = String(thumbNode.getAttribute('src') || thumbNode.src || '').trim();
        if (currentSrc.startsWith('data:image/')) {
          requestBackendRetryForMessageMedia(messageMeta, source, reasonTag + '-resolved-still-failed');
          return;
        }
        resolving = true;
        resolveMediaUrlToDataUrl(source)
          .then((nextUrl) => {
            if (nextUrl && nextUrl !== currentSrc) {
              thumbNode.src = nextUrl;
              if (popupImageNode) {
                popupImageNode.src = nextUrl;
              }
              logWeb('info', 'media resolve retry success: type=' + String(reasonTag || 'image') + ', url=' + clipForLog(source));
              return;
            }
            requestBackendRetryForMessageMedia(messageMeta, source, reasonTag + '-resolve-empty');
          })
          .catch((error) => {
            logWeb(
              'warn',
              'media resolve retry failed: type=' + String(reasonTag || 'image') +
                ', url=' + clipForLog(source) +
                ', reason=' + String(error?.message || error)
            );
            requestBackendRetryForMessageMedia(messageMeta, source, reasonTag + '-resolve-failed');
          })
          .finally(() => {
            resolving = false;
          });
      });
    }
`;
}

module.exports = {
  renderMessageMediaRecoveryScript,
};
