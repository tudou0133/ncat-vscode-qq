const { renderMessageRenderMediaSegmentsScript } = require('./message-render-media-segments-script.cjs');
const { renderMessageRenderUtilsScript } = require('./message-render-utils-script.cjs');

function renderMessageRenderCoreScript() {
  return String.raw`
${renderMessageRenderUtilsScript()}
${renderMessageRenderMediaSegmentsScript()}

    function buildSegment(seg, imageMeta, messageMeta) {
      const mediaNode = buildMediaSegment(seg, imageMeta, messageMeta);
      if (mediaNode) {
        return mediaNode;
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
              node = buildSegment(item, { index: imageIndex, total: totalImages }, null);
            } else {
              node = buildSegment(item || { type: 'text', text: '' }, { index: 0, total: totalImages }, null);
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

      if (seg.type === 'red_packet') {
        const packet = document.createElement('span');
        packet.className = 'seg-red-packet';

        const mark = document.createElement('span');
        mark.className = 'seg-red-packet-mark';
        mark.textContent = '¥';

        const text = document.createElement('span');
        text.className = 'seg-red-packet-text';
        text.textContent = String(seg.text || seg.title || '[红包]').trim() || '[红包]';

        packet.appendChild(mark);
        packet.appendChild(text);
        return packet;
      }

      const text = document.createElement('span');
      text.textContent = seg.text || '';
      return text;
    }
`;
}

module.exports = {
  renderMessageRenderCoreScript,
};
