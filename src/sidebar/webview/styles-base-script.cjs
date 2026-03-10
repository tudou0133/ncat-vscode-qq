function renderWebviewBaseStyles() {
  return `
    html {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #081224;
    }

    :root {
      --bg: #081224;
      --surface: #13223b;
      --surface-soft: #1c3254;
      --line: #2e486b;
      --text: #f8fafc;
      --muted: #b9c7de;
      --accent: #6f97c6;
      --ok: #22c55e;
      --danger: #ef4444;
    }

    * { box-sizing: border-box; }

    body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0 !important;
      color: var(--text);
      font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
      background: radial-gradient(120% 120% at 0% 0%, #1a2d4d 0%, var(--bg) 60%, #030915 100%);
      overflow: hidden;
    }

    .stage {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 100%;
      overflow: hidden;
    }

    .page {
      position: absolute;
      inset: 0;
      width: 100%;
      min-width: 100%;
      display: flex;
      flex-direction: column;
      background: transparent;
    }

    .page-list {
      z-index: 1;
      transition: transform .22s ease, opacity .22s ease;
    }

    .page-detail {
      z-index: 3;
      transform: translateX(104%);
      transition: transform .25s ease;
      background: linear-gradient(180deg, rgba(8,14,26,.98), rgba(7,13,25,.99));
    }

    .stage.detail-open .page-detail { transform: translateX(0); }
    .stage.detail-open .page-list {
      transform: translateX(-10%);
      opacity: .68;
      pointer-events: none;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px;
      border-bottom: 1px solid var(--line);
      background: rgba(0, 0, 0, 0.28);
      backdrop-filter: blur(4px);
      position: sticky;
      top: 0;
      z-index: 2;
    }

    .account {
      display: inline-flex;
      align-items: center;
      min-width: 0;
      gap: 8px;
    }

    .account-avatar {
      width: 24px;
      height: 24px;
      border-radius: 999px;
      background: linear-gradient(145deg, #5d84b3, #3f638e);
      color: #e5eefb;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 700;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.22);
      flex-shrink: 0;
    }

    .account-meta {
      min-width: 0;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .account-name {
      min-width: 0;
      max-width: 120px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 12px;
      color: #e8f0fd;
      font-weight: 600;
    }

    .presence-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--danger);
      box-shadow: 0 0 0 1px rgba(255,255,255,.22) inset;
      flex-shrink: 0;
    }

    .presence-dot.online {
      background: var(--ok);
    }

    .presence-dot.paused {
      background: #3b82f6;
    }

    .btns { display: flex; gap: 6px; }

    .btn-runtime.stop {
      border-color: rgba(166, 70, 70, 0.72);
      background: rgba(72, 18, 18, 0.88);
      color: #ffd9d9;
    }

    button {
      border: 1px solid var(--line);
      background: #1f3457;
      color: var(--text);
      border-radius: 10px;
      padding: 4px 9px;
      font-size: 11px;
      cursor: pointer;
    }

    button:hover { border-color: var(--accent); }

    .title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px 8px;
      font-size: 13px;
      color: var(--muted);
      font-weight: 600;
    }

    .search-row {
      padding: 8px 8px 2px;
    }

    .search-input {
      width: 100%;
      height: 30px;
      border-radius: 8px;
      border: 1px solid var(--line);
      background: #122139;
      color: var(--text);
      font-size: 11px;
      padding: 0 9px;
      outline: none;
    }

    .search-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px rgba(111, 151, 198, 0.35);
    }

    .search-input::placeholder {
      color: #9bb0ce;
    }

    .cards {
      padding: 0 0 10px;
      overflow-y: scroll;
      scrollbar-gutter: stable;
      flex: 1;
    }

    .card {
      border: 1px solid var(--line);
      background: linear-gradient(170deg, #182a46, #112038);
      border-radius: 10px;
      padding: 7px 8px;
      margin: 0 0 5px;
      cursor: pointer;
      transition: transform .12s ease, border-color .12s ease;
    }

    .card:hover { transform: translateY(-1px); border-color: var(--accent); }
    .card.active { border-color: var(--accent); box-shadow: 0 0 0 1px rgba(111, 151, 198, .33) inset; }

    .head {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 3px;
    }

    .avatar {
      width: 24px;
      height: 24px;
      border-radius: 7px;
      background: linear-gradient(145deg, #5d84b3, #3f638e);
      color: #e5eefb;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 11px;
      overflow: hidden;
    }

    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .name {
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .meta {
      font-size: 10px;
      color: var(--muted);
      margin-top: 1px;
    }

    .preview {
      font-size: 11px;
      color: #e6edf9;
      line-height: 1.25;
      word-break: break-word;
    }

    .badge {
      margin-left: auto;
      min-width: 18px;
      padding: 1px 6px;
      text-align: center;
      border-radius: 99px;
      background: #ef4444;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
    }

    .detail-main {
      display: flex;
      align-items: center;
      min-width: 0;
      gap: 8px;
      flex: 1;
    }

    .back {
      border-radius: 9px;
      padding: 4px 10px;
      flex-shrink: 0;
      min-width: 52px;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .detail-title {
      font-size: 13px;
      font-weight: 700;
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      cursor: context-menu;
    }

    .messages {
      padding: 8px 0 12px;
      overflow-y: scroll;
      scrollbar-gutter: stable;
      display: flex;
      flex-direction: column;
      gap: 5px;
      flex: 1;
      overscroll-behavior: contain;
    }

    .cards,
    .messages {
      scrollbar-width: auto;
      scrollbar-color: #4b5f82 #142036;
    }

    .cards::-webkit-scrollbar,
    .messages::-webkit-scrollbar {
      width: 11px;
      height: 11px;
    }

    .cards::-webkit-scrollbar-track,
    .messages::-webkit-scrollbar-track {
      background: #142036;
      border-radius: 10px;
    }

    .cards::-webkit-scrollbar-thumb,
    .messages::-webkit-scrollbar-thumb {
      background: #4b5f82;
      border-radius: 10px;
      border: 2px solid #142036;
    }

    .cards::-webkit-scrollbar-thumb:hover,
    .messages::-webkit-scrollbar-thumb:hover {
      background: #6277a0;
    }

    .empty {
      margin: auto 10px;
      padding: 14px 12px;
      border-radius: 12px;
      border: 1px dashed rgba(111, 151, 198, 0.24);
      background: rgba(13, 23, 40, 0.42);
      color: #b9c7de;
      font-size: 12px;
      line-height: 1.45;
      text-align: center;
    }

    .runtime-empty {
      margin: auto 10px;
      padding: 18px 16px 16px;
      border-radius: 16px;
      border: 1px solid rgba(88, 127, 182, 0.3);
      background:
        radial-gradient(120% 120% at 50% 0%, rgba(70, 122, 189, 0.18) 0%, rgba(10, 18, 31, 0.95) 68%),
        rgba(10, 18, 31, 0.96);
      box-shadow:
        inset 0 1px 0 rgba(197, 219, 255, 0.06),
        0 10px 24px rgba(0, 0, 0, 0.18);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 9px;
      text-align: center;
    }

    .runtime-empty-status {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 20px;
      padding: 0 9px;
      border-radius: 999px;
      background: rgba(59, 130, 246, 0.16);
      border: 1px solid rgba(96, 165, 250, 0.26);
      color: #8fc5ff;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .04em;
    }

    .runtime-empty-icon {
      width: 40px;
      height: 40px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(180deg, rgba(45, 111, 191, 0.28), rgba(24, 57, 97, 0.2));
      border: 1px solid rgba(96, 165, 250, 0.34);
      color: #8cc2ff;
      font-size: 14px;
      line-height: 1;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
    }

    .runtime-empty-title {
      color: #eef5ff;
      font-size: 14px;
      font-weight: 700;
      line-height: 1.25;
    }

    .runtime-empty-text {
      color: #b4c3da;
      font-size: 11px;
      line-height: 1.55;
      max-width: 260px;
    }

    .runtime-empty-action {
      color: #dcecff;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.35;
      max-width: 270px;
      padding: 0;
      background: transparent;
      border: none;
    }

`;
}

module.exports = {
  renderWebviewBaseStyles,
};
