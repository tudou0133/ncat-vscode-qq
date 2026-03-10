function renderWebviewMessageMediaStyles() {
  return `
    .seg-image {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      position: relative;
      z-index: 1;
      --img-pop-shift-x: 0px;
      --img-pop-shift-y: 0px;
      --img-pop-max-h: 250px;
      width: 42px;
      height: 42px;
      border: 1px solid rgba(120, 150, 190, 0.42);
      border-radius: 9px;
      padding: 0;
      margin: 2px 4px 2px 0;
      font-size: 9px;
      opacity: .96;
      cursor: default;
      overflow: visible;
      background: rgba(11, 22, 40, 0.92);
      vertical-align: middle;
    }

    .seg-video {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      position: relative;
      z-index: 1;
      --video-pop-shift-x: 0px;
      --video-pop-shift-y: 0px;
      --video-pop-max-h: 250px;
      width: 42px;
      height: 42px;
      border: 1px solid rgba(120, 150, 190, 0.42);
      border-radius: 9px;
      padding: 0;
      margin: 2px 4px 2px 0;
      font-size: 9px;
      opacity: .96;
      cursor: default;
      overflow: visible;
      background: rgba(11, 22, 40, 0.92);
      vertical-align: middle;
    }

    .seg-image-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      background: #020617;
      border-radius: 8px;
    }

    .seg-video-thumb {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      background: #020617;
      border-radius: 8px;
    }

    .seg-image-fallback {
      color: #d3e0f2;
      font-size: 9px;
      letter-spacing: .2px;
      padding: 0 4px;
      text-align: center;
      line-height: 1.15;
    }

    .seg-image-count {
      position: absolute;
      right: 3px;
      bottom: 3px;
      min-width: 16px;
      height: 14px;
      padding: 0 4px;
      border-radius: 999px;
      background: rgba(2, 6, 23, 0.84);
      color: #e8f0fb;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
      line-height: 1;
      border: 1px solid rgba(148, 163, 184, 0.28);
      z-index: 1;
    }

    .seg-video-fallback {
      color: #d3e0f2;
      font-size: 9px;
      letter-spacing: .2px;
      padding: 0 4px;
      text-align: center;
      line-height: 1.15;
    }

    .seg-video-playmark {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: rgba(2, 6, 23, 0.78);
      border: 1px solid rgba(148, 163, 184, 0.42);
      color: #e2ecfb;
      font-size: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 1;
    }

    .seg-face {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      height: 24px;
      padding: 0 4px;
      margin: 2px 4px 2px 0;
      border-radius: 8px;
      background: rgba(18, 33, 57, 0.82);
      border: 1px solid rgba(111, 151, 198, 0.24);
      font-size: 16px;
      line-height: 1;
      vertical-align: middle;
    }

    .img-pop {
      display: none;
      position: absolute;
      left: 0;
      bottom: calc(100% + 6px);
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 4px;
      z-index: 120;
      min-width: 80px;
      box-shadow: 0 8px 28px rgba(0,0,0,.45);
      transform: translate(var(--img-pop-shift-x), var(--img-pop-shift-y));
    }

    .video-pop {
      display: none;
      position: absolute;
      left: 0;
      bottom: calc(100% + 6px);
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 4px;
      z-index: 120;
      min-width: 80px;
      box-shadow: 0 8px 28px rgba(0,0,0,.45);
      transform: translate(var(--video-pop-shift-x), var(--video-pop-shift-y));
    }

    .img-pop img {
      display: block;
      max-width: 220px;
      max-height: var(--img-pop-max-h);
      border-radius: 6px;
      object-fit: contain;
      background: #020617;
    }

    .video-pop video {
      display: block;
      max-width: 260px;
      max-height: var(--video-pop-max-h);
      border-radius: 6px;
      object-fit: contain;
      background: #020617;
    }

    .seg-image:hover .img-pop { display: block; }
    .seg-video:hover .video-pop { display: block; }
    .seg-image:hover { z-index: 120; }
    .seg-video:hover { z-index: 120; }
    .seg-image,
    .seg-video {
      cursor: zoom-in;
    }

    .seg-image.preview-down .img-pop {
      bottom: auto;
      top: calc(100% + 6px);
    }

    .seg-video.preview-down .video-pop {
      bottom: auto;
      top: calc(100% + 6px);
    }

    .media-viewer-overlay {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(2, 6, 23, 0.88);
      backdrop-filter: blur(6px);
      padding: 20px;
      box-sizing: border-box;
    }

    .media-viewer-overlay.open {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .media-viewer-body {
      width: min(96vw, 1800px);
      height: min(94vh, 1200px);
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px;
      border-radius: 16px;
      border: 1px solid rgba(100, 116, 139, 0.42);
      background: rgba(15, 23, 42, 0.98);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
    }

    .media-viewer-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 28px;
    }

    .media-viewer-title {
      flex: 1;
      min-width: 0;
      color: #dbeafe;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .media-viewer-controls {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
    }

    .media-viewer-action,
    .media-viewer-close {
      border: 1px solid rgba(100, 116, 139, 0.4);
      background: rgba(30, 41, 59, 0.92);
      color: #dbeafe;
      border-radius: 10px;
      padding: 6px 10px;
      cursor: pointer;
    }

    .media-viewer-action[disabled] {
      opacity: 0.45;
      cursor: default;
    }

    .media-viewer-content {
      flex: 1;
      min-height: 0;
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      overflow: auto;
      border-radius: 12px;
      background: rgba(2, 6, 23, 0.94);
      cursor: default;
      user-select: none;
      padding: 8px;
      box-sizing: border-box;
      scrollbar-gutter: stable both-edges;
    }

    .media-viewer-content.is-draggable {
      cursor: grab;
    }

    .media-viewer-content.dragging {
      cursor: grabbing;
    }

    .media-viewer-stage {
      display: inline-flex;
      align-items: flex-start;
      justify-content: flex-start;
      min-width: 100%;
      min-height: 100%;
    }

    .media-viewer-image,
    .media-viewer-video {
      display: block;
      max-width: none;
      max-height: none;
      width: auto;
      height: auto;
      object-fit: contain;
      background: #020617;
      border-radius: 10px;
    }

    .media-viewer-image {
      flex: 0 0 auto;
      align-self: flex-start;
    }

    .media-viewer-video {
      max-width: min(96vw, 1800px);
      max-height: calc(min(94vh, 1200px) - 72px);
    }

`;
}

module.exports = {
  renderWebviewMessageMediaStyles,
};
