function renderWebviewOverlayStyles() {
  return `
    .forward-overlay {
      position: absolute;
      inset: 0;
      z-index: 9;
      display: none;
      align-items: flex-end;
      justify-content: stretch;
      background: rgba(2, 8, 18, 0.58);
      padding: 12px 10px 10px;
    }

    .forward-overlay.open {
      display: flex;
    }

    .forward-panel {
      width: 100%;
      max-height: 82%;
      display: flex;
      flex-direction: column;
      border: 1px solid var(--line);
      border-radius: 14px;
      overflow: hidden;
      background: linear-gradient(180deg, #0c1729, #0a1323);
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.38);
    }

    .forward-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.02);
    }

    .forward-topbar-left {
      min-width: 0;
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .forward-title {
      min-width: 0;
      flex: 1;
      font-size: 12px;
      font-weight: 700;
      color: #e9f0fb;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .forward-nav-btn {
      height: 28px;
      border-radius: 9px;
      border: 1px solid rgba(86, 111, 150, 0.88);
      background: rgba(13, 24, 40, 0.96);
      color: #e8f1ff;
      padding: 0 10px;
      font-size: 11px;
      cursor: pointer;
      flex: 0 0 auto;
    }

    .forward-nav-btn:hover {
      border-color: rgba(126, 162, 213, 0.95);
      background: rgba(19, 34, 56, 0.98);
    }

    .forward-body {
      padding: 10px;
      overflow-y: scroll;
      scrollbar-gutter: stable;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 120px;
    }

    .forward-body::-webkit-scrollbar {
      width: 11px;
      height: 11px;
    }

    .forward-body::-webkit-scrollbar-track {
      background: #142036;
      border-radius: 10px;
    }

    .forward-body::-webkit-scrollbar-thumb {
      background: #4b5f82;
      border-radius: 10px;
      border: 2px solid #142036;
    }

    .forward-body::-webkit-scrollbar-thumb:hover {
      background: #6277a0;
    }

    .forward-node {
      border: 1px solid rgba(64, 89, 123, 0.95);
      border-radius: 10px;
      background: rgba(17, 29, 47, 0.92);
      padding: 8px 9px;
    }

    .forward-node-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;
      font-size: 10px;
      color: var(--muted);
    }

    .forward-node-left {
      display: inline-flex;
      align-items: center;
      min-width: 0;
      gap: 6px;
    }

    .forward-node-avatar {
      width: 16px;
      height: 16px;
      border-radius: 999px;
      background: linear-gradient(145deg, #5d84b3, #3f638e);
      color: #e5eefb;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 700;
      flex-shrink: 0;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.22);
    }

    .forward-node-body {
      font-size: 11px;
      line-height: 1.35;
      color: #eef4ff;
      word-break: break-word;
    }

    .forward-picker-head {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.02);
    }

    .forward-picker-summary {
      font-size: 11px;
      color: #dce8fb;
      line-height: 1.35;
      word-break: break-word;
      opacity: 0.92;
    }

    .forward-picker-search {
      width: 100%;
      height: 32px;
      border-radius: 10px;
      border: 1px solid rgba(73, 101, 138, 0.9);
      background: rgba(9, 17, 31, 0.98);
      color: #eaf2ff;
      font-size: 11px;
      padding: 0 10px;
      outline: none;
      box-sizing: border-box;
    }

    .forward-picker-search:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px rgba(111, 151, 198, 0.35);
    }

    .forward-target-list {
      padding: 10px;
      overflow-y: scroll;
      scrollbar-gutter: stable;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 120px;
    }

    .forward-target-list::-webkit-scrollbar {
      width: 11px;
      height: 11px;
    }

    .forward-target-list::-webkit-scrollbar-track {
      background: #142036;
      border-radius: 10px;
    }

    .forward-target-list::-webkit-scrollbar-thumb {
      background: #4b5f82;
      border-radius: 10px;
      border: 2px solid #142036;
    }

    .forward-target-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 11px;
      border-radius: 12px;
      border: 1px solid rgba(62, 88, 121, 0.88);
      background: rgba(15, 27, 45, 0.94);
      cursor: pointer;
      transition: transform .12s ease, border-color .12s ease, background .12s ease, box-shadow .12s ease;
    }

    .forward-target-card:hover {
      transform: translateY(-1px);
      border-color: rgba(120, 160, 214, 0.92);
      background: rgba(21, 37, 60, 0.98);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
    }

    .forward-target-card.sending {
      opacity: 0.7;
      pointer-events: none;
    }

    .forward-target-avatar {
      width: 34px;
      height: 34px;
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
    }

    .forward-target-meta {
      min-width: 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .forward-target-name {
      font-size: 12px;
      font-weight: 700;
      color: #eef4ff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .forward-target-sub {
      font-size: 10px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .settings-overlay {
      position: absolute;
      inset: 0;
      z-index: 62;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(2, 8, 18, 0.62);
      padding: 12px;
    }

    .settings-overlay.open {
      display: flex;
    }

    .settings-panel {
      width: min(460px, 100%);
      max-height: min(84vh, 620px);
      display: flex;
      flex-direction: column;
      border: 1px solid rgba(73, 101, 138, 0.94);
      border-radius: 12px;
      background: linear-gradient(180deg, rgba(11, 20, 36, 0.98), rgba(8, 16, 30, 0.98));
      box-shadow: 0 18px 42px rgba(0, 0, 0, 0.45);
      overflow: hidden;
    }

    .settings-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px;
      border-bottom: 1px solid var(--line);
      background: rgba(0, 0, 0, 0.28);
    }

    .settings-title {
      font-size: 13px;
      font-weight: 700;
      color: #e9f0fb;
    }

    .settings-body {
      padding: 10px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .settings-group {
      border: 1px solid rgba(56, 78, 108, 0.94);
      border-radius: 10px;
      background: rgba(16, 28, 46, 0.82);
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .settings-group-title {
      font-size: 11px;
      font-weight: 700;
      color: #d7e6fb;
      margin-bottom: 1px;
    }

    .settings-inline-actions {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .settings-action-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
    }

    .settings-action-grid .settings-action {
      width: 100%;
      min-width: 0;
    }

    .settings-action {
      width: fit-content;
      min-width: 92px;
      height: 28px;
      border-radius: 8px;
      font-size: 11px;
    }

    .settings-action.danger {
      border-color: rgba(166, 70, 70, 0.72);
      background: rgba(72, 18, 18, 0.88);
      color: #ffd9d9;
    }

    .settings-toggle {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 11px;
      color: #dce8fa;
      user-select: none;
      min-height: 24px;
    }

    .settings-input {
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

    .settings-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px rgba(111, 151, 198, 0.35);
    }

    .settings-help {
      font-size: 10px;
      color: var(--muted);
      line-height: 1.35;
    }
`;
}

module.exports = {
  renderWebviewOverlayStyles,
};
