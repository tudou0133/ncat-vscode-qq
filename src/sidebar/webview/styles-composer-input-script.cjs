function renderWebviewComposerInputStyles() {
  return `
    .composer {
      border-top: 1px solid var(--line);
      background: rgba(8, 14, 25, 0.95);
      padding: 6px 8px 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      position: relative;
    }

    .composer-main {
      width: 100%;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .composer-row-main {
      width: 100%;
      display: flex;
      align-items: flex-end;
      gap: 6px;
    }

    .composer-row-tools {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 6px;
      padding-left: 1px;
    }

    .composer.dragover {
      box-shadow: inset 0 0 0 1px rgba(111, 151, 198, 0.45);
      background: rgba(11, 22, 40, 0.98);
    }

    .composer-attachments {
      display: none;
      flex-wrap: wrap;
      gap: 6px;
      min-height: 0;
    }

    .composer-attachments.has-items {
      display: flex;
    }

    .attach-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: 100%;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: rgba(21, 34, 56, 0.96);
      padding: 4px 6px 4px 4px;
    }

    .attach-thumb {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      object-fit: cover;
      background: #0f172a;
      flex-shrink: 0;
    }

    .attach-name {
      max-width: 120px;
      font-size: 10px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .attach-remove {
      width: 20px;
      height: 20px;
      padding: 0;
      border-radius: 999px;
      flex-shrink: 0;
      line-height: 1;
    }

    .composer-input {
      flex: 1;
      min-height: 30px;
      max-height: 72px;
      resize: vertical;
      border-radius: 8px;
      border: 1px solid var(--line);
      background: #122139;
      color: var(--text);
      font-size: 11px;
      line-height: 1.35;
      padding: 6px 8px;
      font-family: inherit;
      outline: none;
    }

    .composer-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px rgba(111, 151, 198, 0.35);
    }

    .composer-input:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }

    .composer-send {
      min-width: 50px;
      height: 30px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 11px;
    }

    .composer-tool {
      min-width: 44px;
      height: 28px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 10px;
      padding: 0 8px;
    }
`;
}

module.exports = {
  renderWebviewComposerInputStyles,
};
