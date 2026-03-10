function renderMessageMediaViewerScript() {
  return `
    let mediaViewerOverlay = null;
    let mediaViewerBody = null;
    let mediaViewerTitle = null;
    let mediaViewerCloseButton = null;
    let mediaViewerControls = null;
    let mediaViewerZoomOutButton = null;
    let mediaViewerZoomResetButton = null;
    let mediaViewerZoomInButton = null;
    let mediaViewerContent = null;
    let mediaViewerStage = null;
    let mediaViewerMode = '';
    let mediaViewerImageNode = null;
    let mediaViewerImageNaturalWidth = 0;
    let mediaViewerImageNaturalHeight = 0;
    let mediaViewerFitScale = 1;
    let mediaViewerScale = 1;
    let mediaViewerDragState = null;

    function ensureMediaViewer() {
      if (mediaViewerOverlay) {
        return mediaViewerOverlay;
      }

      mediaViewerOverlay = document.createElement('div');
      mediaViewerOverlay.className = 'media-viewer-overlay';
      mediaViewerOverlay.setAttribute('aria-hidden', 'true');

      mediaViewerBody = document.createElement('div');
      mediaViewerBody.className = 'media-viewer-body';

      const topbar = document.createElement('div');
      topbar.className = 'media-viewer-topbar';

      mediaViewerTitle = document.createElement('div');
      mediaViewerTitle.className = 'media-viewer-title';
      mediaViewerTitle.textContent = '';

      mediaViewerCloseButton = document.createElement('button');
      mediaViewerCloseButton.type = 'button';
      mediaViewerCloseButton.className = 'media-viewer-close';
      mediaViewerCloseButton.textContent = '关闭';

      mediaViewerControls = document.createElement('div');
      mediaViewerControls.className = 'media-viewer-controls';

      mediaViewerZoomOutButton = document.createElement('button');
      mediaViewerZoomOutButton.type = 'button';
      mediaViewerZoomOutButton.className = 'media-viewer-action';
      mediaViewerZoomOutButton.textContent = '-';

      mediaViewerZoomResetButton = document.createElement('button');
      mediaViewerZoomResetButton.type = 'button';
      mediaViewerZoomResetButton.className = 'media-viewer-action';
      mediaViewerZoomResetButton.textContent = '适应';

      mediaViewerZoomInButton = document.createElement('button');
      mediaViewerZoomInButton.type = 'button';
      mediaViewerZoomInButton.className = 'media-viewer-action';
      mediaViewerZoomInButton.textContent = '+';

      mediaViewerControls.appendChild(mediaViewerZoomOutButton);
      mediaViewerControls.appendChild(mediaViewerZoomResetButton);
      mediaViewerControls.appendChild(mediaViewerZoomInButton);

      mediaViewerContent = document.createElement('div');
      mediaViewerContent.className = 'media-viewer-content';

      mediaViewerStage = document.createElement('div');
      mediaViewerStage.className = 'media-viewer-stage';
      mediaViewerContent.appendChild(mediaViewerStage);

      topbar.appendChild(mediaViewerTitle);
      topbar.appendChild(mediaViewerControls);
      topbar.appendChild(mediaViewerCloseButton);
      mediaViewerBody.appendChild(topbar);
      mediaViewerBody.appendChild(mediaViewerContent);
      mediaViewerOverlay.appendChild(mediaViewerBody);
      document.body.appendChild(mediaViewerOverlay);

      mediaViewerOverlay.addEventListener('click', (event) => {
        if (event.target === mediaViewerOverlay) {
          closeMediaViewer();
        }
      });
      mediaViewerCloseButton.addEventListener('click', () => {
        closeMediaViewer();
      });
      mediaViewerZoomOutButton.addEventListener('click', () => {
        adjustMediaViewerZoom(-1);
      });
      mediaViewerZoomResetButton.addEventListener('click', () => {
        resetMediaViewerZoom();
      });
      mediaViewerZoomInButton.addEventListener('click', () => {
        adjustMediaViewerZoom(1);
      });
      mediaViewerContent.addEventListener('mousedown', handleMediaViewerDragStart);
      mediaViewerContent.addEventListener('mousemove', handleMediaViewerDragMove);
      mediaViewerContent.addEventListener('mouseleave', handleMediaViewerDragEnd);
      mediaViewerContent.addEventListener('mouseup', handleMediaViewerDragEnd);
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && mediaViewerOverlay && mediaViewerOverlay.classList.contains('open')) {
          closeMediaViewer();
        }
      });

      return mediaViewerOverlay;
    }

    function closeMediaViewer() {
      if (!mediaViewerOverlay) {
        return;
      }
      mediaViewerMode = '';
      mediaViewerImageNode = null;
      mediaViewerImageNaturalWidth = 0;
      mediaViewerImageNaturalHeight = 0;
      mediaViewerFitScale = 1;
      mediaViewerScale = 1;
      mediaViewerDragState = null;
      mediaViewerOverlay.classList.remove('open');
      mediaViewerOverlay.setAttribute('aria-hidden', 'true');
      if (mediaViewerContent) {
        mediaViewerContent.scrollLeft = 0;
        mediaViewerContent.scrollTop = 0;
        mediaViewerContent.classList.remove('is-draggable');
      }
      if (mediaViewerStage) {
        mediaViewerStage.innerHTML = '';
      }
      if (mediaViewerTitle) {
        mediaViewerTitle.textContent = '';
      }
      updateMediaViewerControls();
    }

    function updateMediaViewerControls() {
      if (!mediaViewerControls) {
        return;
      }
      const isImage = mediaViewerMode === 'image';
      mediaViewerControls.style.display = isImage ? 'inline-flex' : 'none';
      if (!isImage) {
        return;
      }
      const minScale = Math.max(0.05, mediaViewerFitScale * 0.35);
      const maxScale = Math.max(1, mediaViewerFitScale * 8);
      mediaViewerZoomOutButton.disabled = mediaViewerScale <= minScale + 0.001;
      mediaViewerZoomInButton.disabled = mediaViewerScale >= maxScale - 0.001;
      mediaViewerZoomResetButton.disabled = Math.abs(mediaViewerScale - mediaViewerFitScale) < 0.001;
      const canDrag = !!(
        mediaViewerImageNode &&
        (
          mediaViewerImageNode.scrollWidth > mediaViewerContent.clientWidth + 4 ||
          mediaViewerImageNode.scrollHeight > mediaViewerContent.clientHeight + 4
        )
      );
      mediaViewerContent.classList.toggle('is-draggable', canDrag);
    }

    function clampMediaViewerScale(nextScale) {
      const minScale = Math.max(0.05, mediaViewerFitScale * 0.35);
      const maxScale = Math.max(1, mediaViewerFitScale * 8);
      return Math.min(maxScale, Math.max(minScale, nextScale));
    }

    function applyMediaViewerImageScale(keepCenter = true) {
      if (!mediaViewerImageNode || !mediaViewerContent) {
        return;
      }
      const beforeCenterX = mediaViewerContent.scrollLeft + mediaViewerContent.clientWidth / 2;
      const beforeCenterY = mediaViewerContent.scrollTop + mediaViewerContent.clientHeight / 2;
      const prevWidth = mediaViewerImageNode.offsetWidth || 1;
      const prevHeight = mediaViewerImageNode.offsetHeight || 1;
      mediaViewerImageNode.style.width = Math.max(1, Math.round(mediaViewerImageNaturalWidth * mediaViewerScale)) + 'px';
      mediaViewerImageNode.style.height = Math.max(1, Math.round(mediaViewerImageNaturalHeight * mediaViewerScale)) + 'px';

      if (keepCenter) {
        requestAnimationFrame(() => {
          const nextWidth = mediaViewerImageNode.offsetWidth || prevWidth;
          const nextHeight = mediaViewerImageNode.offsetHeight || prevHeight;
          const widthRatio = nextWidth / prevWidth;
          const heightRatio = nextHeight / prevHeight;
          mediaViewerContent.scrollLeft = Math.max(0, beforeCenterX * widthRatio - mediaViewerContent.clientWidth / 2);
          mediaViewerContent.scrollTop = Math.max(0, beforeCenterY * heightRatio - mediaViewerContent.clientHeight / 2);
          updateMediaViewerControls();
        });
      } else {
        requestAnimationFrame(() => {
          updateMediaViewerControls();
        });
      }
    }

    function fitMediaViewerImage() {
      if (!mediaViewerImageNode || !mediaViewerContent || !mediaViewerImageNaturalWidth || !mediaViewerImageNaturalHeight) {
        return;
      }
      const availableWidth = Math.max(120, mediaViewerContent.clientWidth - 16);
      const availableHeight = Math.max(120, mediaViewerContent.clientHeight - 16);
      mediaViewerFitScale = Math.min(
        availableWidth / mediaViewerImageNaturalWidth,
        availableHeight / mediaViewerImageNaturalHeight,
        1
      );
      mediaViewerScale = mediaViewerFitScale;
      applyMediaViewerImageScale(false);
      requestAnimationFrame(() => {
        mediaViewerContent.scrollLeft = 0;
        mediaViewerContent.scrollTop = 0;
      });
    }

    function adjustMediaViewerZoom(step) {
      if (mediaViewerMode !== 'image' || !mediaViewerImageNode) {
        return;
      }
      const factor = step > 0 ? 1.25 : 0.8;
      mediaViewerScale = clampMediaViewerScale(mediaViewerScale * factor);
      applyMediaViewerImageScale(true);
    }

    function resetMediaViewerZoom() {
      if (mediaViewerMode !== 'image' || !mediaViewerImageNode) {
        return;
      }
      mediaViewerScale = mediaViewerFitScale;
      applyMediaViewerImageScale(false);
      requestAnimationFrame(() => {
        mediaViewerContent.scrollLeft = 0;
        mediaViewerContent.scrollTop = 0;
      });
    }

    function handleMediaViewerDragStart(event) {
      if (mediaViewerMode !== 'image' || !mediaViewerImageNode || event.button !== 0) {
        return;
      }
      if (mediaViewerContent.scrollWidth <= mediaViewerContent.clientWidth && mediaViewerContent.scrollHeight <= mediaViewerContent.clientHeight) {
        return;
      }
      mediaViewerDragState = {
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: mediaViewerContent.scrollLeft,
        scrollTop: mediaViewerContent.scrollTop,
      };
      mediaViewerContent.classList.add('dragging');
      event.preventDefault();
    }

    function handleMediaViewerDragMove(event) {
      if (!mediaViewerDragState || mediaViewerMode !== 'image') {
        return;
      }
      const dx = event.clientX - mediaViewerDragState.startX;
      const dy = event.clientY - mediaViewerDragState.startY;
      mediaViewerContent.scrollLeft = mediaViewerDragState.scrollLeft - dx;
      mediaViewerContent.scrollTop = mediaViewerDragState.scrollTop - dy;
      event.preventDefault();
    }

    function handleMediaViewerDragEnd() {
      if (!mediaViewerContent) {
        return;
      }
      mediaViewerDragState = null;
      mediaViewerContent.classList.remove('dragging');
    }

    function openMediaViewer(payload) {
      const kind = String(payload?.kind || '').trim();
      const sourceUrl = String(payload?.url || '').trim();
      if (!kind || !sourceUrl) {
        return;
      }

      ensureMediaViewer();
      mediaViewerMode = kind;
      mediaViewerStage.innerHTML = '';
      mediaViewerContent.scrollLeft = 0;
      mediaViewerContent.scrollTop = 0;
      mediaViewerTitle.textContent = String(payload?.title || '').trim();

      let node = null;
      if (kind === 'image') {
        node = document.createElement('img');
        node.className = 'media-viewer-image';
        node.referrerPolicy = 'no-referrer';
        node.src = sourceUrl;
        node.alt = mediaViewerTitle.textContent || 'image';
        node.addEventListener('load', () => {
          mediaViewerImageNaturalWidth = Number(node.naturalWidth || 0);
          mediaViewerImageNaturalHeight = Number(node.naturalHeight || 0);
          fitMediaViewerImage();
        });
        mediaViewerImageNode = node;
      } else if (kind === 'video') {
        node = document.createElement('video');
        node.className = 'media-viewer-video';
        node.src = sourceUrl;
        node.controls = true;
        node.autoplay = false;
        node.loop = false;
        node.playsInline = true;
        node.defaultMuted = true;
        node.muted = true;
        node.volume = 0;
        node.setAttribute('muted', '');
        node.addEventListener('volumechange', () => {
          if (!node.muted || node.volume !== 0) {
            node.muted = true;
            node.volume = 0;
          }
        });
        if (payload?.poster) {
          node.poster = String(payload.poster);
        }
      }

      if (!node) {
        return;
      }

      mediaViewerStage.appendChild(node);
      updateMediaViewerControls();
      mediaViewerOverlay.classList.add('open');
      mediaViewerOverlay.setAttribute('aria-hidden', 'false');
    }
`;
}

module.exports = {
  renderMessageMediaViewerScript,
};
