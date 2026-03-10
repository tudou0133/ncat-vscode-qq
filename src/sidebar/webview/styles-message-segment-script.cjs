function renderWebviewMessageSegmentStyles() {
  return `
    .seg-mention {
      color: #a8c4e6;
      font-weight: 600;
      margin-right: 3px;
    }

    .seg-reply {
      display: block;
      width: fit-content;
      max-width: 100%;
      color: #c9d8ef;
      background: rgba(11, 24, 44, 0.75);
      border-left: 2px solid rgba(111, 151, 198, 0.65);
      border-radius: 6px;
      padding: 2px 6px;
      margin: 0 0 4px;
      font-size: 10px;
      line-height: 1.35;
      word-break: break-word;
      overflow: visible;
    }

    .seg-reply-title {
      display: block;
      font-size: 10px;
      line-height: 1.32;
      color: #d3e1f4;
    }

    .seg-reply-source {
      display: block;
      font-size: 9px;
      line-height: 1.2;
      color: rgba(188, 206, 232, 0.9);
      margin-bottom: 2px;
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .seg-reply-preview {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 3px;
      margin-top: 2px;
      max-width: 100%;
    }

    .seg-reply-preview > span {
      font-size: 10px;
      line-height: 1.25;
    }

    .seg-reply .seg-image,
    .seg-reply .seg-video,
    .seg-reply .seg-file {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      margin: 1px 3px 1px 0;
    }

    .seg-reply .seg-file {
      width: auto;
      max-width: 120px;
      min-height: 30px;
      padding: 2px 0;
      gap: 5px;
    }

    .seg-reply .seg-file-icon {
      width: 18px;
      height: 18px;
    }

    .seg-reply .seg-file-folder {
      width: 16px;
      height: 12px;
    }

    .seg-reply .seg-file-name {
      font-size: 10px;
      line-height: 1.2;
    }

    .seg-reply .seg-file-size {
      font-size: 9px;
    }

    .seg-reply .seg-image-thumb,
    .seg-reply .seg-video-thumb {
      border-radius: 7px;
    }

    .seg-reply .seg-video-playmark {
      width: 14px;
      height: 14px;
      font-size: 8px;
    }

    .seg-reply-more {
      opacity: 0.86;
    }

    .seg-forward {
      display: inline-flex;
      align-items: center;
      border: 1px solid rgba(111, 151, 198, 0.38);
      border-radius: 8px;
      background: rgba(18, 33, 57, 0.82);
      color: #d9e7fb;
      padding: 3px 8px;
      margin: 2px 4px 2px 0;
      font-size: 10px;
    }

    .seg-red-packet {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: min(300px, 72vw);
      padding: 2px 0;
      margin: 1px 0;
      border-radius: 0;
      background: transparent;
      border: none;
      color: #ffd8ce;
      vertical-align: top;
    }

    .seg-red-packet-mark {
      flex: 0 0 auto;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(180deg, rgba(191, 46, 38, 0.95) 0%, rgba(146, 27, 22, 0.95) 100%);
      color: #ffd79b;
      font-size: 10px;
      line-height: 1;
      box-shadow: inset 0 1px 0 rgba(255, 213, 179, 0.14);
    }

    .seg-red-packet-text {
      min-width: 0;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.3;
      word-break: break-word;
      color: #ffb2a1;
    }

    .seg-json {
      display: inline-flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 3px;
      max-width: 240px;
      user-select: text;
      cursor: text;
    }

    .seg-json-actions {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      margin-top: 2px;
    }

    .seg-json-action {
      border: 1px solid rgba(120, 155, 197, 0.42);
      border-radius: 7px;
      background: rgba(20, 36, 58, 0.88);
      color: #dceafe;
      padding: 1px 6px;
      font-size: 10px;
      line-height: 1.4;
      cursor: pointer;
      user-select: none;
    }

    .seg-json-action:hover {
      border-color: rgba(149, 184, 225, 0.82);
      background: rgba(28, 49, 78, 0.96);
    }

    .seg-file {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      max-width: min(320px, 72vw);
      padding: 2px 0;
      margin: 1px 0;
      border-radius: 0;
      background: transparent;
      border: none;
      color: #eef5ff;
      vertical-align: top;
    }

    .seg-file-icon {
      flex: 0 0 auto;
      width: 22px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .seg-file-folder {
      position: relative;
      width: 20px;
      height: 15px;
      display: inline-block;
    }

    .seg-file-folder::before {
      content: '';
      position: absolute;
      left: 1px;
      top: 1px;
      width: 8px;
      height: 4px;
      border-radius: 4px 4px 0 0;
      background: rgba(255, 194, 93, 0.92);
      box-shadow: 0 0 0 1px rgba(120, 78, 18, 0.08) inset;
    }

    .seg-file-folder::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 11px;
      border-radius: 4px;
      background: linear-gradient(180deg, rgba(255, 205, 116, 0.98) 0%, rgba(243, 169, 58, 0.98) 100%);
      box-shadow:
        0 1px 0 rgba(255, 235, 183, 0.22) inset,
        0 0 0 1px rgba(129, 83, 14, 0.14) inset;
    }

    .seg-file-meta {
      min-width: 0;
      display: inline-flex;
      flex-direction: column;
      gap: 2px;
    }

    .seg-file-name {
      font-size: 12px;
      font-weight: 600;
      line-height: 1.25;
      word-break: break-all;
    }

    .seg-file-size {
      font-size: 10px;
      opacity: 0.75;
    }

    .seg-forward.clickable {
      cursor: pointer;
      transition: border-color .12s ease, background .12s ease, transform .12s ease;
    }

    .seg-forward.clickable:hover {
      border-color: rgba(149, 184, 225, 0.78);
      background: rgba(26, 45, 74, 0.96);
      transform: translateY(-1px);
    }

`;
}

module.exports = {
  renderWebviewMessageSegmentStyles,
};
