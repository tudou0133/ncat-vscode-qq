function renderMessageScript() {
  return String.raw`
    function buildSegment(seg, imageMeta) {
      if (seg.type === 'image') {
        const chip = document.createElement('span');
        chip.className = 'seg-image';
        const enableImagePreview = !!uiPrefs.previewImages;
        const total = Number(imageMeta?.total || 1);
        const index = Number(imageMeta?.index || 1);

        if (seg.url) {
          const thumb = document.createElement('img');
          thumb.className = 'seg-image-thumb';
          thumb.loading = 'lazy';
          thumb.src = seg.url;
          thumb.alt = seg.label || 'image';
          chip.appendChild(thumb);

          if (enableImagePreview) {
            const pop = document.createElement('span');
            pop.className = 'img-pop';
            const img = document.createElement('img');
            img.loading = 'lazy';
            img.src = seg.url;
            img.alt = seg.label || 'image';
            pop.appendChild(img);
            chip.appendChild(pop);
            setupHoverPopupPosition(chip, pop, 'image');
          }
        } else {
          const fallback = document.createElement('span');
          fallback.className = 'seg-image-fallback';
          fallback.textContent = '图片';
          chip.appendChild(fallback);
        }

        if (total > 1) {
          const count = document.createElement('span');
          count.className = 'seg-image-count';
          count.textContent = index + '/' + total;
          chip.appendChild(count);
        }

        return chip;
      }

      if (seg.type === 'video') {
        const chip = document.createElement('span');
        chip.className = 'seg-video';
        const enableVideoPreview = !!uiPrefs.previewVideos;
        const videoUrl = String(seg.url || '').trim();
        const hasUrl = videoUrl.length > 0;
        const coverUrl = String(seg.coverUrl || '').trim();

        if (coverUrl) {
          const thumb = document.createElement('img');
          thumb.className = 'seg-video-thumb';
          thumb.loading = 'lazy';
          thumb.src = coverUrl;
          thumb.alt = seg.label || 'video';
          thumb.addEventListener('error', () => {
            logWeb('warn', 'video cover load_error: url=' + coverUrl);
          });
          chip.appendChild(thumb);
        } else if (hasUrl) {
          // If no cover exists, use a muted paused video frame as thumbnail.
          const thumbVideo = document.createElement('video');
          thumbVideo.className = 'seg-video-thumb';
          thumbVideo.src = videoUrl;
          thumbVideo.preload = 'metadata';
          thumbVideo.defaultMuted = true;
          thumbVideo.muted = true;
          thumbVideo.volume = 0;
          thumbVideo.playsInline = true;
          thumbVideo.controls = false;
          thumbVideo.setAttribute('muted', '');
          thumbVideo.addEventListener('loadedmetadata', () => {
            const jump = Math.min(1.2, Math.max(0.08, Number(thumbVideo.duration || 0) * 0.12));
            try {
              thumbVideo.currentTime = jump;
            } catch {
              // Ignore seek failures.
            }
          });
          thumbVideo.addEventListener('seeked', () => {
            thumbVideo.pause();
          });
          thumbVideo.addEventListener('error', () => {
            const errCode = thumbVideo?.error?.code || 'unknown';
            logWeb('warn', 'video thumb load_error: code=' + String(errCode) + ', url=' + videoUrl);
          });
          chip.appendChild(thumbVideo);
        } else {
          const fallback = document.createElement('span');
          fallback.className = 'seg-video-fallback';
          fallback.textContent = '视频';
          chip.appendChild(fallback);
        }

        if (hasUrl) {
          const mark = document.createElement('span');
          mark.className = 'seg-video-playmark';
          mark.textContent = '▶';
          chip.appendChild(mark);
        }

        if (hasUrl && enableVideoPreview) {
          const pop = document.createElement('span');
          pop.className = 'video-pop';
          const video = document.createElement('video');
          video.src = videoUrl;
          video.preload = 'metadata';
          video.defaultMuted = true;
          video.muted = true;
          video.volume = 0;
          video.playsInline = true;
          video.loop = true;
          video.controls = false;
          video.setAttribute('muted', '');
          video.addEventListener('error', () => {
            const errCode = video?.error?.code || 'unknown';
            logWeb('warn', 'video preview load_error: code=' + String(errCode) + ', url=' + videoUrl);
          });
          video.addEventListener('volumechange', () => {
            if (!video.muted || video.volume !== 0) {
              video.muted = true;
              video.volume = 0;
            }
          });
          pop.appendChild(video);
          chip.appendChild(pop);
          setupHoverPopupPosition(chip, pop, 'video');

          chip.addEventListener('mouseenter', () => {
            video.muted = true;
            video.defaultMuted = true;
            video.volume = 0;
            video.play().catch((error) => {
              logWeb('warn', 'video preview play failed: ' + String(error?.message || error));
            });
          });
          chip.addEventListener('mouseleave', () => {
            video.pause();
            try {
              video.currentTime = 0;
            } catch {
              // Ignore seek failure.
            }
          });
        }

        return chip;
      }

      if (seg.type === 'poke_notice') {
        const text = document.createElement('span');
        text.textContent = String(seg.text || '[戳一戳]');
        return text;
      }

      if (seg.type === 'mention') {
        const mention = document.createElement('span');
        mention.className = 'seg-mention';
        mention.textContent = seg.text || '@某人';
        return mention;
      }

      if (seg.type === 'face') {
        const face = document.createElement('span');
        face.className = 'seg-face';
        face.textContent = seg.text || '🙂';
        face.title = seg.label || '表情';
        return face;
      }

      if (seg.type === 'json') {
        const url = resolveJsonSegmentUrl(seg);
        const lowerUrl = String(url || '').toLowerCase();
        const isHttp = lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://');
        const isQqScheme = lowerUrl.startsWith('mqqapi://') || lowerUrl.startsWith('mqqopensdkapi://') || lowerUrl.startsWith('tencent.mobileqq://');
        const isInvite = isInviteJson(seg, url);
        const clickable = ((isHttp && !isLikelyImageUrl(url)) || isQqScheme) && (!isInvite || SHOW_INVITE_OPEN_ACTION);
        const json = document.createElement('span');
        json.className = 'seg-forward seg-json';

        const title = document.createElement('span');
        title.style.fontWeight = '700';
        title.style.fontSize = '10px';
        title.textContent = seg.title || 'JSON消息';
        json.appendChild(title);

        if (seg.summary) {
          const summary = document.createElement('span');
          summary.style.fontSize = '10px';
          summary.style.opacity = '0.88';
          summary.textContent = seg.summary;
          json.appendChild(summary);
        }

        const actions = document.createElement('span');
        actions.className = 'seg-json-actions';

        if (clickable) {
          const openBtn = document.createElement('button');
          openBtn.type = 'button';
          openBtn.className = 'seg-json-action';
          openBtn.textContent = isInvite ? '打开邀请' : '打开链接';
          openBtn.title = url;
          openBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            vscode.postMessage({
              type: 'openExternalLink',
              url,
            });
          });
          actions.appendChild(openBtn);
        }

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'seg-json-action';
        copyBtn.textContent = '复制内容';
        copyBtn.addEventListener('click', async (event) => {
          event.preventDefault();
          event.stopPropagation();
          const copied = await copyToClipboard(seg.raw || seg.summary || seg.title || '');
          if (copied) {
            logWeb('info', 'json copied');
          } else {
            logWeb('warn', 'json copy failed');
          }
        });
        actions.appendChild(copyBtn);
        json.appendChild(actions);

        if (seg.raw) {
          json.title = seg.raw;
        }
        return json;
      }

      if (seg.type === 'reply') {
        const reply = document.createElement('div');
        reply.className = 'seg-reply';
        const replyName = String(seg.replyName || '').trim();

        if (replyName) {
          const source = document.createElement('span');
          source.className = 'seg-reply-source';
          source.textContent = replyName;
          reply.appendChild(source);
        }

        const replySegments = Array.isArray(seg.replySegments) ? seg.replySegments : [];
        if (replySegments.length > 0) {
          const preview = document.createElement('span');
          preview.className = 'seg-reply-preview';

          const hasMedia = replySegments.some((item) => item && (item.type === 'image' || item.type === 'video'));
          const MAX_PREVIEW_SEGMENTS = 6;
          const previewSource = hasMedia
            ? replySegments.filter((item) => item && (item.type === 'image' || item.type === 'video'))
            : replySegments;
          const displaySegments = previewSource.slice(0, MAX_PREVIEW_SEGMENTS);
          const totalImages = displaySegments.reduce((count, item) => (item && item.type === 'image' ? count + 1 : count), 0);
          let imageIndex = 0;

          for (const item of displaySegments) {
            let node;
            if (item && item.type === 'image') {
              imageIndex += 1;
              node = buildSegment(item, { index: imageIndex, total: totalImages });
            } else {
              node = buildSegment(item || { type: 'text', text: '' }, { index: 0, total: totalImages });
            }
            if (!node) {
              continue;
            }
            if (item && (item.type === 'image' || item.type === 'video')) {
              node.classList.add('seg-reply-media');
            }
            preview.appendChild(node);
          }

          if (previewSource.length > displaySegments.length) {
            const more = document.createElement('span');
            more.className = 'seg-reply-more';
            more.textContent = '...';
            preview.appendChild(more);
          }

          reply.appendChild(preview);
          return reply;
        }

        const fallbackText = String(seg.replyPreview || seg.text || '[回复]').trim();
        const fallback = document.createElement('span');
        fallback.className = 'seg-reply-title';
        fallback.textContent = fallbackText || '[回复]';
        reply.appendChild(fallback);
        return reply;
      }

      if (seg.type === 'forward') {
        const clickable = !!String(seg.forwardId || '').trim();
        const forward = document.createElement(clickable ? 'button' : 'span');
        forward.className = 'seg-forward' + (clickable ? ' clickable' : '');
        if (clickable) {
          forward.type = 'button';
          forward.title = '点击查看合并转发';
          forward.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            openForwardPreview(seg.forwardId, seg.text || '[合并转发]');
          });
        }
        forward.textContent = seg.text || '[合并转发]';
        return forward;
      }

      const text = document.createElement('span');
      text.textContent = seg.text || '';
      return text;
    }

    function isSystemLineMessage(msg) {
      if (!msg || typeof msg !== 'object') {
        return false;
      }
      if (String(msg.displayStyle || '') === 'system') {
        return true;
      }
      const segments = Array.isArray(msg.segments) ? msg.segments : [];
      return segments.some((seg) => seg && seg.type === 'poke_notice');
    }

    function renderMessages() {
      const root = document.getElementById('messages');
      const prevBottomDistance = Math.max(0, root.scrollHeight - root.scrollTop - root.clientHeight);
      const wasNearBottom = prevBottomDistance <= 56;
      root.innerHTML = '';

      if (!isPluginRunning()) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '插件未运行。点击右上角“启动插件”开始运行。';
        root.appendChild(empty);
        lastRenderedChatId = '';
        lastRenderedMessageCount = 0;
        forceScrollBottom = false;
        return;
      }

      const selected = getSelectedChat();
      if (!selected) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '在一级页面点开一个会话后，这里会覆盖显示二级消息页。';
        root.appendChild(empty);
        lastRenderedChatId = '';
        lastRenderedMessageCount = 0;
        forceScrollBottom = false;
        return;
      }

      if (!state.selectedMessages || state.selectedMessages.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '当前会话还没有缓存消息。';
        root.appendChild(empty);
        lastRenderedChatId = selected.id;
        lastRenderedMessageCount = 0;
        forceScrollBottom = false;
        return;
      }

      const sortedMessages = [...state.selectedMessages].sort((a, b) => {
        const t1 = Number(a.timestamp || 0);
        const t2 = Number(b.timestamp || 0);
        return t1 - t2;
      });

      if (state.isLoadingOlder) {
        const loading = document.createElement('div');
        loading.className = 'empty';
        loading.style.margin = '0 auto 6px';
        loading.style.padding = '6px 10px';
        loading.style.fontSize = '11px';
        loading.textContent = '正在加载更早消息...';
        root.appendChild(loading);
      }

      for (const msg of sortedMessages) {
        if (isSystemLineMessage(msg)) {
          const line = document.createElement('div');
          line.className = 'msg-system';
          const lineText = getMessageActionText(msg) || '[系统消息]';
          line.textContent = lineText;
          line.title = lineText;
          root.appendChild(line);
          continue;
        }

        const isOut = msg.direction === 'out';
        const row = document.createElement('div');
        row.className = 'msg-row ' + (isOut ? 'out' : 'in');

        const sender = msg.senderName || msg.senderId || 'unknown';
        const avatar = document.createElement('span');
        avatar.className = 'msg-avatar';
        const senderFallbackText = sender.slice(0, 1);

        const senderId = String(msg.senderId || '').trim();
        const resolvedAvatarUrl =
          String(msg.avatarUrl || '').trim() ||
          (senderId ? ('https://q1.qlogo.cn/g?b=qq&nk=' + encodeURIComponent(senderId) + '&s=100') : '');

        if (!resolvedAvatarUrl) {
          avatar.textContent = senderFallbackText;
          logAvatarIssue('missing_url', msg, 'reason=no-avatar-url-and-sender-id');
        } else {
          attachAvatarImage(avatar, {
            url: resolvedAvatarUrl,
            fallbackText: senderFallbackText,
            imageClassName: 'msg-avatar-img',
            onError: () => {
              logAvatarIssue('load_error', msg, 'url=' + resolvedAvatarUrl);
            },
          });
        }

        if (senderId) {
          avatar.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            event.stopPropagation();
            openAvatarMenu(
              {
                senderId,
                senderName: sender,
              },
              event.clientX,
              event.clientY
            );
          }, true);
        }

        const main = document.createElement('div');
        main.className = 'msg-main';

        const meta = document.createElement('div');
        meta.className = 'msg-meta';

        const senderName = document.createElement('span');
        senderName.className = 'msg-sender';
        senderName.textContent = sender;

        const timeNode = document.createElement('span');
        timeNode.className = 'msg-time';
        timeNode.textContent = fmtTime(msg.timestamp);

        meta.appendChild(senderName);
        meta.appendChild(timeNode);

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble' + (isOut ? ' out' : '');
        const bubbleText = getMessageActionText(msg);
        if (bubbleText) {
          bubble.title = bubbleText;
        }

        const segments = Array.isArray(msg.segments) ? msg.segments : [];
        const totalImages = segments.reduce((count, seg) => (seg && seg.type === 'image' ? count + 1 : count), 0);
        let imageIndex = 0;

        for (const seg of segments) {
          let node;
          if (seg && seg.type === 'image') {
            imageIndex += 1;
            node = buildSegment(seg, { index: imageIndex, total: totalImages });
          } else {
            node = buildSegment(seg, { index: 0, total: totalImages });
          }
          bubble.appendChild(node);
        }

        bubble.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
          openBubbleMenu(
            {
              messageId: String(msg.id || ''),
              senderName: sender,
              rawMessageId: String(msg.rawMessageId || ''),
              text: bubbleText,
              hasImage: totalImages > 0,
              canRecall: isOut && !!String(msg.rawMessageId || '').trim(),
            },
            event.clientX,
            event.clientY
          );
        });

        main.appendChild(meta);
        main.appendChild(bubble);

        if (isOut) {
          row.appendChild(main);
          row.appendChild(avatar);
        } else {
          row.appendChild(avatar);
          row.appendChild(main);
        }

        root.appendChild(row);
      }

      const currentChatId = selected.id;
      const currentCount = sortedMessages.length;
      const chatChanged = currentChatId !== lastRenderedChatId;
      const openingSelectedChat = !!pendingOpenChatId && currentChatId === pendingOpenChatId;
      const appended = !chatChanged && currentCount > lastRenderedMessageCount;
      const shouldAutoBottom = openingSelectedChat || forceScrollBottom || chatChanged || (appended && wasNearBottom);

      requestAnimationFrame(() => {
        if (shouldAutoBottom) {
          root.scrollTop = root.scrollHeight;
        } else {
          const targetTop = root.scrollHeight - root.clientHeight - prevBottomDistance;
          root.scrollTop = Math.max(0, targetTop);
        }
        if (openingSelectedChat) {
          pendingOpenChatId = '';
        }
        forceScrollBottom = false;
        lastRenderedChatId = currentChatId;
        lastRenderedMessageCount = currentCount;
      });
    }
`;
}

module.exports = {
  renderMessageScript,
};
