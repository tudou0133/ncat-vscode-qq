function renderWebviewComposerPanelStyles() {
  return `
    .sticker-panel {
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: 72px;
      z-index: 78;
      border: 1px solid rgba(123, 154, 194, 0.56);
      border-radius: 10px;
      background: rgba(8, 15, 27, 0.98);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.42);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      max-height: 240px;
    }

    .sticker-panel[hidden] {
      display: none;
    }

    .sticker-panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 6px 8px;
      border-bottom: 1px solid rgba(62, 86, 120, 0.76);
      background: rgba(11, 21, 38, 0.96);
      flex-shrink: 0;
    }

    .sticker-panel-title {
      font-size: 10px;
      color: #dce8f8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    .sticker-panel-actions {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .sticker-panel-action {
      min-width: 34px;
      height: 22px;
      border-radius: 7px;
      font-size: 10px;
      padding: 0 6px;
    }

    .sticker-panel-body {
      padding: 6px;
      overflow-y: auto;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
      gap: 6px;
      min-height: 56px;
    }

    .sticker-panel-empty {
      grid-column: 1 / -1;
      font-size: 10px;
      color: var(--muted);
      text-align: center;
      padding: 8px 6px;
      border: 1px dashed rgba(73, 97, 130, 0.62);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.02);
      line-height: 1.4;
    }

    .sticker-item {
      width: 100%;
      border: 1px solid rgba(77, 102, 136, 0.56);
      border-radius: 8px;
      background: rgba(16, 29, 48, 0.92);
      padding: 2px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 52px;
    }

    .sticker-item:hover {
      border-color: rgba(130, 164, 208, 0.78);
      background: rgba(24, 40, 65, 0.96);
    }

    .sticker-thumb {
      width: 100%;
      height: 48px;
      object-fit: cover;
      border-radius: 6px;
      display: block;
      background: #060f1e;
    }

    .mention-menu {
      position: absolute;
      z-index: 40;
      min-width: 220px;
      max-width: min(360px, calc(100vw - 24px));
      max-height: 220px;
      overflow-y: auto;
      border: 1px solid rgba(123, 154, 194, 0.52);
      border-radius: 10px;
      background: rgba(9, 17, 31, 0.98);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.4);
      padding: 4px;
    }

    .mention-menu[hidden] {
      display: none;
    }

    .mention-item {
      width: 100%;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--text);
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      text-align: left;
      padding: 6px 8px;
      font-size: 11px;
      cursor: pointer;
    }

    .mention-item:hover,
    .mention-item.active {
      background: rgba(80, 116, 161, 0.28);
    }

    .mention-name {
      min-width: 0;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mention-id {
      flex-shrink: 0;
      font-size: 10px;
      color: var(--muted);
      opacity: 0.86;
    }

    .avatar-menu {
      position: absolute;
      z-index: 44;
      min-width: 130px;
      border: 1px solid rgba(123, 154, 194, 0.56);
      border-radius: 10px;
      background: rgba(9, 17, 31, 0.98);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.42);
      padding: 4px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .avatar-menu[hidden] {
      display: none;
    }

    .avatar-menu-item {
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--text);
      text-align: left;
      font-size: 11px;
      line-height: 1.2;
      padding: 7px 8px;
      cursor: pointer;
    }

    .avatar-menu-item:hover {
      background: rgba(80, 116, 161, 0.28);
    }

    .bubble-menu {
      position: absolute;
      z-index: 45;
      min-width: 140px;
      border: 1px solid rgba(123, 154, 194, 0.56);
      border-radius: 10px;
      background: rgba(9, 17, 31, 0.98);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.42);
      padding: 4px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .bubble-menu[hidden] {
      display: none;
    }

    .bubble-menu-item {
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--text);
      text-align: left;
      font-size: 11px;
      line-height: 1.2;
      padding: 7px 8px;
      cursor: pointer;
    }

    .bubble-menu-item:hover {
      background: rgba(80, 116, 161, 0.28);
    }

    .sticker-item-menu {
      position: absolute;
      z-index: 79;
      min-width: 146px;
      border: 1px solid rgba(123, 154, 194, 0.56);
      border-radius: 10px;
      background: rgba(9, 17, 31, 0.98);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.42);
      padding: 4px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .sticker-item-menu[hidden] {
      display: none;
    }

    .sticker-item-menu-item {
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--text);
      text-align: left;
      font-size: 11px;
      line-height: 1.2;
      padding: 7px 8px;
      cursor: pointer;
    }

    .sticker-item-menu-item:hover {
      background: rgba(80, 116, 161, 0.28);
    }

    .sticker-item-menu-item.danger {
      color: #ffd4d4;
    }
`;
}

module.exports = {
  renderWebviewComposerPanelStyles,
};
