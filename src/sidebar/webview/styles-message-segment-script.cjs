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

    .seg-reply .seg-forward {
      max-width: 180px;
      padding: 1px 0 1px 6px;
      margin: 1px 0;
      gap: 2px;
      border-left-width: 2px;
    }

    .seg-reply .seg-forward-title,
    .seg-reply .seg-forward-preview-line {
      font-size: 9px;
      line-height: 1.2;
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
      flex-direction: column;
      align-items: flex-start;
      gap: 3px;
      border: none;
      border-left: 2px solid rgba(111, 151, 198, 0.56);
      border-radius: 0;
      background: transparent;
      color: #d9e7fb;
      padding: 1px 0 1px 8px;
      margin: 2px 0;
      font-size: 10px;
      text-align: left;
      max-width: min(320px, 72vw);
    }

    .seg-forward-title {
      display: block;
      font-size: 10px;
      font-weight: 700;
      line-height: 1.3;
    }

    .seg-forward-preview {
      display: flex;
      flex-direction: column;
      gap: 2px;
      width: 100%;
      min-width: 0;
      opacity: 0.92;
      padding-top: 2px;
    }

    .seg-forward-preview-line {
      display: block;
      min-width: 0;
      font-size: 10px;
      line-height: 1.25;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: rgba(212, 226, 245, 0.88);
    }

    .seg-forward.clickable:hover {
      border-left-color: rgba(149, 184, 225, 0.9);
      background: rgba(255, 255, 255, 0.02);
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

    .seg-file-badge {
      min-width: 22px;
      height: 18px;
      padding: 0 4px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
      font-weight: 800;
      line-height: 1;
      letter-spacing: 0.02em;
      box-sizing: border-box;
      color: #f8fbff;
      border: 1px solid rgba(255, 255, 255, 0.14);
      text-transform: uppercase;
      gap: 3px;
    }

    .seg-file-badge-emblem {
      position: relative;
      width: 8px;
      height: 8px;
      flex: 0 0 auto;
      display: none;
    }

    .seg-file-badge-label {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 0;
    }

    .seg-file-badge-image-png {
      background: linear-gradient(180deg, rgba(44, 164, 114, 0.98) 0%, rgba(26, 121, 81, 0.98) 100%);
    }

    .seg-file-badge-image-jpg {
      background: linear-gradient(180deg, rgba(54, 144, 209, 0.98) 0%, rgba(32, 101, 162, 0.98) 100%);
    }

    .seg-file-badge-image-gif {
      background: linear-gradient(180deg, rgba(180, 96, 214, 0.98) 0%, rgba(128, 60, 165, 0.98) 100%);
    }

    .seg-file-badge-image-other {
      background: linear-gradient(180deg, rgba(47, 151, 101, 0.98) 0%, rgba(28, 111, 72, 0.98) 100%);
    }

    .seg-file-badge-video-mp4 {
      background: linear-gradient(180deg, rgba(56, 128, 231, 0.98) 0%, rgba(35, 91, 179, 0.98) 100%);
    }

    .seg-file-badge-video-other {
      background: linear-gradient(180deg, rgba(62, 125, 214, 0.98) 0%, rgba(40, 88, 163, 0.98) 100%);
    }

    .seg-file-badge-audio-mp3 {
      background: linear-gradient(180deg, rgba(157, 92, 220, 0.98) 0%, rgba(111, 58, 171, 0.98) 100%);
    }

    .seg-file-badge-audio-other {
      background: linear-gradient(180deg, rgba(138, 91, 219, 0.98) 0%, rgba(101, 60, 172, 0.98) 100%);
    }

    .seg-file-badge-archive-zip {
      background: linear-gradient(180deg, rgba(223, 145, 51, 0.98) 0%, rgba(170, 96, 24, 0.98) 100%);
    }

    .seg-file-badge-archive-other {
      background: linear-gradient(180deg, rgba(210, 126, 42, 0.98) 0%, rgba(160, 88, 19, 0.98) 100%);
    }

    .seg-file-badge-pdf {
      background: linear-gradient(180deg, rgba(199, 63, 59, 0.98) 0%, rgba(150, 34, 32, 0.98) 100%);
    }

    .seg-file-badge-doc-word {
      background: linear-gradient(180deg, rgba(67, 122, 230, 0.98) 0%, rgba(41, 84, 176, 0.98) 100%);
    }

    .seg-file-badge-doc-sheet {
      background: linear-gradient(180deg, rgba(54, 161, 97, 0.98) 0%, rgba(29, 115, 63, 0.98) 100%);
    }

    .seg-file-badge-doc-slide {
      background: linear-gradient(180deg, rgba(224, 116, 56, 0.98) 0%, rgba(180, 77, 24, 0.98) 100%);
    }

    .seg-file-badge-text {
      background: linear-gradient(180deg, rgba(107, 119, 138, 0.98) 0%, rgba(72, 81, 96, 0.98) 100%);
    }

    .seg-file-badge-code {
      background: linear-gradient(180deg, rgba(78, 135, 228, 0.98) 0%, rgba(48, 92, 173, 0.98) 100%);
    }

    .seg-file-badge-image-png .seg-file-badge-emblem,
    .seg-file-badge-image-jpg .seg-file-badge-emblem,
    .seg-file-badge-image-gif .seg-file-badge-emblem,
    .seg-file-badge-image-other .seg-file-badge-emblem {
      display: inline-block;
      width: 9px;
      height: 7px;
      border-radius: 2px;
      border: 1px solid rgba(255, 255, 255, 0.92);
      box-sizing: border-box;
    }

    .seg-file-badge-image-png .seg-file-badge-emblem::before,
    .seg-file-badge-image-jpg .seg-file-badge-emblem::before,
    .seg-file-badge-image-gif .seg-file-badge-emblem::before,
    .seg-file-badge-image-other .seg-file-badge-emblem::before {
      content: '';
      position: absolute;
      left: 1px;
      bottom: 1px;
      width: 4px;
      height: 3px;
      background: rgba(255, 255, 255, 0.95);
      clip-path: polygon(0 100%, 45% 20%, 70% 58%, 100% 0, 100% 100%);
      opacity: 0.95;
    }

    .seg-file-badge-image-png .seg-file-badge-emblem::after,
    .seg-file-badge-image-jpg .seg-file-badge-emblem::after,
    .seg-file-badge-image-gif .seg-file-badge-emblem::after,
    .seg-file-badge-image-other .seg-file-badge-emblem::after {
      content: '';
      position: absolute;
      right: 1px;
      top: 1px;
      width: 2px;
      height: 2px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.95);
    }

    .seg-file-badge-image-png .seg-file-badge-label,
    .seg-file-badge-image-jpg .seg-file-badge-label,
    .seg-file-badge-image-gif .seg-file-badge-label,
    .seg-file-badge-image-other .seg-file-badge-label {
      display: none;
    }

    .seg-file-badge-video-mp4 .seg-file-badge-emblem,
    .seg-file-badge-video-other .seg-file-badge-emblem {
      display: inline-block;
      width: 0;
      height: 0;
      border-top: 4px solid transparent;
      border-bottom: 4px solid transparent;
      border-left: 6px solid rgba(255, 255, 255, 0.96);
      margin-left: 1px;
    }

    .seg-file-badge-video-mp4 .seg-file-badge-label,
    .seg-file-badge-video-other .seg-file-badge-label {
      display: none;
    }

    .seg-file-badge-audio-mp3 .seg-file-badge-emblem,
    .seg-file-badge-audio-other .seg-file-badge-emblem {
      display: inline-block;
      width: 9px;
      height: 8px;
    }

    .seg-file-badge-audio-mp3 .seg-file-badge-emblem::before,
    .seg-file-badge-audio-other .seg-file-badge-emblem::before {
      content: '';
      position: absolute;
      left: 4px;
      top: 0;
      width: 2px;
      height: 6px;
      background: rgba(255, 255, 255, 0.96);
      border-radius: 1px;
    }

    .seg-file-badge-audio-mp3 .seg-file-badge-emblem::after,
    .seg-file-badge-audio-other .seg-file-badge-emblem::after {
      content: '';
      position: absolute;
      left: 0;
      bottom: 0;
      width: 6px;
      height: 6px;
      border: 2px solid rgba(255, 255, 255, 0.96);
      border-top: none;
      border-right: none;
      border-radius: 0 0 0 6px;
      box-sizing: border-box;
      transform: rotate(-12deg);
    }

    .seg-file-badge-audio-mp3 .seg-file-badge-label,
    .seg-file-badge-audio-other .seg-file-badge-label,
    .seg-file-badge-pdf .seg-file-badge-label,
    .seg-file-badge-archive-zip .seg-file-badge-label,
    .seg-file-badge-archive-other .seg-file-badge-label,
    .seg-file-badge-doc-word .seg-file-badge-label,
    .seg-file-badge-doc-sheet .seg-file-badge-label,
    .seg-file-badge-doc-slide .seg-file-badge-label,
    .seg-file-badge-text .seg-file-badge-label,
    .seg-file-badge-code .seg-file-badge-label {
      display: none;
    }

    .seg-file-badge-pdf .seg-file-badge-emblem,
    .seg-file-badge-doc-word .seg-file-badge-emblem,
    .seg-file-badge-doc-sheet .seg-file-badge-emblem,
    .seg-file-badge-doc-slide .seg-file-badge-emblem,
    .seg-file-badge-text .seg-file-badge-emblem,
    .seg-file-badge-code .seg-file-badge-emblem {
      display: inline-block;
      width: 9px;
      height: 11px;
      border-radius: 2px;
      border: 1px solid rgba(255, 255, 255, 0.94);
      box-sizing: border-box;
    }

    .seg-file-badge-pdf .seg-file-badge-emblem::before,
    .seg-file-badge-doc-word .seg-file-badge-emblem::before,
    .seg-file-badge-doc-sheet .seg-file-badge-emblem::before,
    .seg-file-badge-doc-slide .seg-file-badge-emblem::before,
    .seg-file-badge-text .seg-file-badge-emblem::before,
    .seg-file-badge-code .seg-file-badge-emblem::before {
      content: '';
      position: absolute;
      top: -1px;
      right: -1px;
      width: 4px;
      height: 4px;
      background: rgba(255, 255, 255, 0.96);
      clip-path: polygon(0 0, 100% 0, 100% 100%);
      opacity: 0.95;
    }

    .seg-file-badge-pdf .seg-file-badge-emblem::after {
      content: '';
      position: absolute;
      left: 2px;
      top: 4px;
      width: 4px;
      height: 4px;
      border-radius: 999px 999px 0 0;
      border: 1.5px solid rgba(255, 255, 255, 0.96);
      border-bottom: none;
      box-sizing: border-box;
    }

    .seg-file-badge-doc-word .seg-file-badge-emblem::after {
      content: '';
      position: absolute;
      left: 1px;
      bottom: 1px;
      width: 5px;
      height: 3px;
      border-left: 1.5px solid rgba(255, 255, 255, 0.96);
      border-right: 1.5px solid rgba(255, 255, 255, 0.96);
      border-bottom: 1.5px solid rgba(255, 255, 255, 0.96);
      clip-path: polygon(0 0, 20% 100%, 50% 45%, 80% 100%, 100% 0, 84% 0, 62% 56%, 50% 28%, 38% 56%, 16% 0);
      box-sizing: border-box;
    }

    .seg-file-badge-doc-sheet .seg-file-badge-emblem::after {
      content: '';
      position: absolute;
      left: 2px;
      top: 4px;
      width: 5px;
      height: 4px;
      border: 1px solid rgba(255, 255, 255, 0.96);
      box-sizing: border-box;
      background:
        linear-gradient(to right, transparent 32%, rgba(255,255,255,0.96) 32%, rgba(255,255,255,0.96) 40%, transparent 40%, transparent 66%, rgba(255,255,255,0.96) 66%, rgba(255,255,255,0.96) 74%, transparent 74%),
        linear-gradient(to bottom, transparent 45%, rgba(255,255,255,0.96) 45%, rgba(255,255,255,0.96) 55%, transparent 55%);
    }

    .seg-file-badge-doc-slide .seg-file-badge-emblem::after {
      content: '';
      position: absolute;
      left: 2px;
      top: 4px;
      width: 5px;
      height: 4px;
      border: 1px solid rgba(255, 255, 255, 0.96);
      box-sizing: border-box;
    }

    .seg-file-badge-text .seg-file-badge-emblem::after,
    .seg-file-badge-code .seg-file-badge-emblem::after {
      content: '';
      position: absolute;
      left: 2px;
      top: 4px;
      width: 4px;
      height: 4px;
      background:
        linear-gradient(to bottom,
          rgba(255,255,255,0.96) 0 1px,
          transparent 1px 2px,
          rgba(255,255,255,0.96) 2px 3px,
          transparent 3px 4px);
    }

    .seg-file-badge-code .seg-file-badge-emblem {
      width: 10px;
      height: 10px;
      border: none;
      border-radius: 0;
    }

    .seg-file-badge-code .seg-file-badge-emblem::before {
      content: '';
      position: absolute;
      left: 0;
      top: 2px;
      width: 3px;
      height: 3px;
      border-left: 1.5px solid rgba(255,255,255,0.96);
      border-bottom: 1.5px solid rgba(255,255,255,0.96);
      transform: rotate(45deg);
      background: transparent;
    }

    .seg-file-badge-code .seg-file-badge-emblem::after {
      content: '';
      position: absolute;
      right: 0;
      top: 2px;
      width: 3px;
      height: 3px;
      border-right: 1.5px solid rgba(255,255,255,0.96);
      border-top: 1.5px solid rgba(255,255,255,0.96);
      transform: rotate(45deg);
      background: transparent;
    }

    .seg-file-badge-archive-zip .seg-file-badge-emblem,
    .seg-file-badge-archive-other .seg-file-badge-emblem {
      display: inline-block;
      width: 8px;
      height: 10px;
      border-radius: 2px;
      border: 1px solid rgba(255,255,255,0.94);
      box-sizing: border-box;
      background:
        linear-gradient(to bottom,
          transparent 0 1px,
          rgba(255,255,255,0.96) 1px 2px,
          transparent 2px 3px,
          rgba(255,255,255,0.96) 3px 4px,
          transparent 4px 5px,
          rgba(255,255,255,0.96) 5px 6px,
          transparent 6px 10px);
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
