function renderWebviewMessageRowStyles() {
  return `
    .msg-row {
      width: 100%;
      display: flex;
      align-items: flex-start;
      gap: 7px;
      padding: 0 2px;
      position: relative;
      z-index: 0;
    }

    .msg-row.out {
      justify-content: flex-end;
    }

    .msg-row:hover {
      z-index: 70;
    }

    .msg-row.jump-target .msg-bubble {
      border-color: #ff9f43;
      box-shadow: 0 0 0 1px rgba(255, 159, 67, 0.55), 0 0 26px rgba(255, 136, 0, 0.32);
      animation: jumpTargetPulse 0.68s ease 0s 4 both;
    }

    @keyframes jumpTargetPulse {
      0% {
        transform: scale(0.985);
        box-shadow: 0 0 0 0 rgba(255, 159, 67, 0.62);
      }
      35% {
        transform: scale(1.01);
        box-shadow: 0 0 0 7px rgba(255, 159, 67, 0.24);
      }
      70% {
        transform: scale(0.992);
        box-shadow: 0 0 0 0 rgba(255, 159, 67, 0.06);
      }
      100% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(255, 159, 67, 0);
      }
    }

    .msg-main {
      min-width: 0;
      max-width: calc(100% - 42px);
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }

    .msg-row.out .msg-main {
      align-items: flex-end;
    }

    .msg-meta {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      margin: 1px 1px 3px;
      color: var(--muted);
      font-size: 10px;
      line-height: 1.2;
    }

    .msg-row.out .msg-meta {
      justify-content: flex-end;
      color: rgba(222, 233, 249, .74);
    }

    .msg-sender {
      display: inline-block;
      min-width: 0;
      max-width: 170px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .msg-time {
      opacity: 0.88;
      flex-shrink: 0;
      font-size: 9px;
    }

    .msg-bubble {
      display: inline-block;
      align-self: flex-start;
      width: auto;
      width: fit-content;
      max-width: 100%;
      border-radius: 14px;
      border-top-left-radius: 6px;
      border: 1px solid rgba(92, 123, 163, 0.5);
      background: rgba(22, 37, 60, 0.92);
      padding: 7px 9px;
      font-size: 11px;
      line-height: 1.35;
      white-space: pre-wrap;
      word-break: break-word;
      box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04) inset;
    }

    .msg-bubble.out {
      align-self: flex-end;
      border-top-left-radius: 14px;
      border-top-right-radius: 6px;
      background: linear-gradient(165deg, #355778, #274361);
      color: #eef4ff;
      border-color: #3f5f83;
    }

    .msg-avatar {
      width: 30px;
      height: 30px;
      border-radius: 999px;
      background: linear-gradient(145deg, #5d84b3, #3f638e);
      color: #e5eefb;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.22);
      cursor: context-menu;
    }

    .msg-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .msg-system {
      width: 100%;
      text-align: center;
      font-size: 10px;
      line-height: 1.35;
      color: rgba(196, 210, 230, 0.86);
      padding: 2px 8px;
      user-select: text;
      word-break: break-word;
    }

`;
}

module.exports = {
  renderWebviewMessageRowStyles,
};
