function renderWebviewComposerJsonStyles() {
  return `
    .json-overlay {
      position: absolute;
      inset: 0;
      z-index: 63;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(2, 8, 18, 0.62);
      padding: 12px;
    }

    .json-overlay.open {
      display: flex;
    }

    .json-panel {
      width: min(520px, 100%);
      max-height: min(80vh, 560px);
      display: flex;
      flex-direction: column;
      border: 1px solid rgba(73, 101, 138, 0.94);
      border-radius: 12px;
      background: linear-gradient(180deg, rgba(11, 20, 36, 0.98), rgba(8, 16, 30, 0.98));
      box-shadow: 0 18px 42px rgba(0, 0, 0, 0.45);
      overflow: hidden;
    }

    .json-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px;
      border-bottom: 1px solid var(--line);
      background: rgba(0, 0, 0, 0.28);
    }

    .json-title {
      font-size: 13px;
      font-weight: 700;
      color: #e9f0fb;
    }

    .json-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px;
    }

    .json-input {
      width: 100%;
      min-height: 220px;
      max-height: 48vh;
      resize: vertical;
      border-radius: 8px;
      border: 1px solid var(--line);
      background: #122139;
      color: var(--text);
      font-size: 11px;
      line-height: 1.35;
      padding: 8px;
      font-family: Consolas, 'Courier New', monospace;
      outline: none;
    }

    .json-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px rgba(111, 151, 198, 0.35);
    }

    .json-error {
      min-height: 16px;
      color: #ffd4d4;
      font-size: 10px;
      line-height: 1.3;
      word-break: break-word;
    }

    .json-actions {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
    }

    .json-action {
      min-width: 80px;
      height: 28px;
      border-radius: 8px;
      font-size: 11px;
    }

`;
}

module.exports = {
  renderWebviewComposerJsonStyles,
};
