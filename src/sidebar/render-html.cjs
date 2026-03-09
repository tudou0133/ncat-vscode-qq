const crypto = require('node:crypto');
const { renderComposerScript } = require('./webview/composer-script.cjs');
const { renderListForwardScript } = require('./webview/list-forward-script.cjs');
const { renderMessageScript } = require('./webview/message-script.cjs');
const { renderMentionMenuScript } = require('./webview/mention-menu-script.cjs');
const { renderSettingsScript } = require('./webview/settings-script.cjs');

function renderHtml(webview) {
  const nonce = crypto.randomBytes(16).toString('base64');
  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} https: http: data:`,
    `media-src ${webview.cspSource} https: http: data: blob:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NCat Chats</title>
  <style>
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

    .composer-reply {
      display: none;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(18, 33, 57, 0.86);
      padding: 4px 6px;
      min-width: 0;
    }

    .composer-reply.active {
      display: flex;
    }

    .composer-reply-text {
      min-width: 0;
      font-size: 10px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .composer-reply-clear {
      width: 20px;
      height: 20px;
      padding: 0;
      border-radius: 999px;
      flex-shrink: 0;
      line-height: 1;
    }

    .empty {
      margin: auto;
      color: var(--muted);
      text-align: center;
      font-size: 12px;
      line-height: 1.6;
      border: 1px dashed var(--line);
      border-radius: 14px;
      padding: 18px;
      background: rgba(255,255,255,.02);
    }

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

    .seg-image.preview-down .img-pop {
      bottom: auto;
      top: calc(100% + 6px);
    }

    .seg-video.preview-down .video-pop {
      bottom: auto;
      top: calc(100% + 6px);
    }

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

    .seg-forward.clickable {
      cursor: pointer;
      transition: border-color .12s ease, background .12s ease, transform .12s ease;
    }

    .seg-forward.clickable:hover {
      border-color: rgba(149, 184, 225, 0.78);
      background: rgba(26, 45, 74, 0.96);
      transform: translateY(-1px);
    }

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

    .forward-title {
      min-width: 0;
      font-size: 12px;
      font-weight: 700;
      color: #e9f0fb;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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
  </style>
</head>
<body>
  <div id="stage" class="stage">
    <section class="page page-list">
      <div class="topbar">
        <div id="account" class="account">
          <span id="accountAvatar" class="account-avatar">N</span>
          <span class="account-meta">
            <span id="accountName" class="account-name">NCat</span>
            <span id="accountDot" class="presence-dot"></span>
          </span>
        </div>
        <div class="btns">
          <button id="btnRuntime" class="btn-runtime" type="button">停止插件</button>
          <button id="btnSettings" type="button">设置</button>
        </div>
      </div>
      <div class="search-row">
        <input id="chatSearch" class="search-input" type="text" placeholder="搜索群名 / 昵称 / 群号 / QQ号" />
      </div>
      <div class="title-row">
        <span>会话</span>
        <span id="chatCount">0</span>
      </div>
      <div id="cards" class="cards"></div>
    </section>

    <section class="page page-detail">
      <div class="topbar">
        <div class="detail-main">
          <button id="btnBack" class="back" type="button">返回</button>
          <div id="detailTitle" class="detail-title">消息</div>
        </div>
        <div class="btns">
          <button id="btnRuntime2" class="btn-runtime" type="button">停止插件</button>
          <button id="btnSettings2" type="button">设置</button>
        </div>
      </div>
      <div id="messages" class="messages"></div>
      <div class="composer">
        <input id="composerFilePicker" type="file" accept="image/*" multiple style="display:none" />
        <input id="stickerImportPicker" type="file" accept="image/*" multiple style="display:none" />
        <div class="composer-main">
          <div id="composerReply" class="composer-reply">
            <span id="composerReplyText" class="composer-reply-text"></span>
            <button id="composerReplyClear" class="composer-reply-clear" type="button">x</button>
          </div>
          <div id="composerAttachments" class="composer-attachments"></div>
          <div class="composer-row-main">
            <textarea id="composerInput" class="composer-input" rows="1" placeholder="输入消息，Enter 发送"></textarea>
            <button id="btnSend" class="composer-send" type="button">发送</button>
          </div>
          <div class="composer-row-tools">
            <button id="btnPickImage" class="composer-tool" type="button">图片</button>
            <button id="btnStickerPack" class="composer-tool" type="button">表情包</button>
            <button id="btnSendJson" class="composer-tool" type="button">JSON</button>
          </div>
        </div>
        <div id="stickerPanel" class="sticker-panel" hidden>
          <div class="sticker-panel-head">
            <span id="stickerPanelTitle" class="sticker-panel-title">表情包</span>
          </div>
          <div id="stickerPanelBody" class="sticker-panel-body"></div>
        </div>
      </div>
      <div id="mentionMenu" class="mention-menu" hidden></div>
    </section>
  </div>
  <div id="forwardOverlay" class="forward-overlay" aria-hidden="true">
    <div class="forward-panel">
      <div class="forward-topbar">
        <div id="forwardTitle" class="forward-title">合并转发</div>
        <button id="btnCloseForward" type="button">关闭</button>
      </div>
      <div id="forwardBody" class="forward-body"></div>
    </div>
  </div>
  <div id="avatarMenu" class="avatar-menu" hidden>
    <button id="avatarMenuAt" class="avatar-menu-item" type="button">AT 他</button>
    <button id="avatarMenuPoke" class="avatar-menu-item" type="button">戳一戳</button>
    <button id="avatarMenuCopyId" class="avatar-menu-item" type="button">复制QQ号</button>
  </div>
  <div id="chatTitleMenu" class="avatar-menu" hidden>
    <button id="chatTitleMenuCopy" class="avatar-menu-item" type="button">复制会话ID</button>
    <button id="chatTitleMenuHide" class="avatar-menu-item" type="button">在界面中隐藏</button>
  </div>
  <div id="bubbleMenu" class="bubble-menu" hidden>
    <button id="bubbleMenuReply" class="bubble-menu-item" type="button">回复这条消息</button>
    <button id="bubbleMenuCopy" class="bubble-menu-item" type="button">复制这条消息</button>
    <button id="bubbleMenuCopyRaw" class="bubble-menu-item" type="button">复制原始消息(JSON)</button>
    <button id="bubbleMenuRecall" class="bubble-menu-item" type="button" hidden>撤回这条消息</button>
    <button id="bubbleMenuSaveSticker" class="bubble-menu-item" type="button">添加到表情包</button>
    <button id="bubbleMenuPlusOne" class="bubble-menu-item" type="button">直接 +1 发送</button>
  </div>
  <div id="stickerItemMenu" class="sticker-item-menu" hidden>
    <button id="stickerItemMenuAdd" class="sticker-item-menu-item" type="button">添加本地图片到表情包</button>
    <button id="stickerItemMenuDelete" class="sticker-item-menu-item danger" type="button">删除表情包</button>
  </div>
  <div id="settingsOverlay" class="settings-overlay" aria-hidden="true">
    <div class="settings-panel">
      <div class="settings-topbar">
        <div class="settings-title">设置</div>
        <button id="btnCloseSettings" type="button">关闭</button>
      </div>
      <div class="settings-body">
        <div class="settings-group">
          <div class="settings-group-title">常用</div>
          <button id="settingOpenLogs" class="settings-action" type="button">打开日志</button>
          <button id="settingOpenExt" class="settings-action" type="button">打开扩展设置</button>
          <button id="settingOpenNapcatReleases" class="settings-action" type="button">打开NCat发布页面</button>
        </div>
        <div class="settings-group">
          <div class="settings-group-title">NCat 后端</div>
          <input id="settingRootDir" class="settings-input" type="text" placeholder="NCat 根目录（例如 D:\\NCat）" />
          <input id="settingTokenFile" class="settings-input" type="text" placeholder="Token 文件（可选，支持相对根目录）" />
          <input id="settingQuickLoginUin" class="settings-input" type="text" placeholder="快速登录 QQ 号（可选，如 2580453344）" />
          <div id="settingBackendHint" class="settings-help"></div>
          <div class="settings-inline-actions">
            <button id="settingBackendToggle" class="settings-action" type="button">启动后端</button>
            <button id="settingOpenBackendWeb" class="settings-action" type="button">打开后端 WebUI</button>
          </div>
        </div>
        <div class="settings-group">
          <div class="settings-group-title">会话隐藏</div>
          <input id="settingHiddenPrivateIds" class="settings-input" type="text" placeholder="隐藏私聊 QQ 号（逗号分隔）" />
          <input id="settingHiddenGroupIds" class="settings-input" type="text" placeholder="隐藏群号（逗号分隔）" />
          <div class="settings-help">隐藏后会话不会出现在主列表和搜索结果中。</div>
        </div>
        <div class="settings-group">
          <div class="settings-group-title">预览</div>
          <label class="settings-toggle"><input id="settingPreviewImages" type="checkbox" /> 图片悬停大图</label>
          <label class="settings-toggle"><input id="settingPreviewVideos" type="checkbox" /> 视频悬停播放（静音）</label>
        </div>
        <div class="settings-group">
          <div class="settings-group-title">发送键</div>
          <label class="settings-toggle"><input id="settingEnterToSend" type="checkbox" /> Enter 发送（关闭后 Ctrl/Cmd+Enter 发送）</label>
        </div>
        <div class="settings-group">
          <div class="settings-group-title">缓存</div>
          <button id="settingClearCache" class="settings-action danger" type="button">清空本地会话缓存</button>
        </div>
      </div>
    </div>
  </div>
  <div id="jsonComposerOverlay" class="json-overlay" aria-hidden="true">
    <div id="jsonComposerPanel" class="json-panel">
      <div class="json-topbar">
        <div class="json-title">发送 JSON 消息</div>
        <button id="btnCloseJsonComposer" type="button">关闭</button>
      </div>
      <div class="json-body">
        <textarea id="jsonComposerInput" class="json-input" placeholder='{"app":"com.tencent.tuwen.lua","view":"news","meta":{...}}'></textarea>
        <div id="jsonComposerError" class="json-error"></div>
        <div class="json-actions">
          <button id="btnCancelJsonComposer" class="json-action" type="button">取消</button>
          <button id="btnSendJsonComposer" class="json-action" type="button">发送 JSON</button>
        </div>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    let state = {
      connectionState: 'offline',
      runtimeActive: true,
      runtimeBlockedByOther: false,
      runtimeBlockedOwnerPid: 0,
      selfUserId: '',
      selfNickname: 'NCat',
      selfAvatarUrl: '',
      chats: [],
      directoryResults: [],
      directorySearchPending: false,
      selectedChatId: '',
      selectedChatType: '',
      selectedTargetId: '',
      selectedMembers: [],
      selectedMessages: [],
      isLoadingOlder: false,
      backend: {
        rootDir: '',
        tokenFile: '',
        quickLoginUin: '',
        webResolvedUrl: '',
        backendProcessRunning: false,
        backendManagedActive: false,
        backendManualMode: false,
        backendLastLaunchFile: '',
      },
      hidden: {
        privateIds: [],
        groupIds: [],
        privateText: '',
        groupText: '',
      }
    };
    let sendBusy = false;
    let lastRenderedChatId = '';
    let lastRenderedMessageCount = 0;
    let forceScrollBottom = false;
    let pendingOpenChatId = '';
    let olderLoadBusy = false;
    let searchQuery = '';
    let pendingImages = [];
    let resolveImageReqSeq = 0;
    const pendingResolveImageRequests = new Map();
    let composerSelection = {
      start: 0,
      end: 0,
    };
    let pendingReply = {
      messageId: '',
      senderName: '',
      preview: '',
    };
    let uiPrefs = {
      previewImages: true,
      previewVideos: true,
      enterToSend: true,
    };
    let settingsOpen = false;
    let backendSaveTimer = null;
    let hiddenSaveTimer = null;
    let mentionState = {
      open: false,
      start: -1,
      end: -1,
      query: '',
      candidates: [],
      selectedIndex: 0,
    };
    let avatarMenuState = {
      open: false,
      senderId: '',
      senderName: '',
      chatId: '',
    };
    let chatTitleMenuState = {
      open: false,
      chatId: '',
      chatType: '',
      targetId: '',
      title: '',
    };
    let bubbleMenuState = {
      open: false,
      messageId: '',
      senderName: '',
      rawMessageId: '',
      text: '',
      hasImage: false,
      canRecall: false,
    };
    let forwardPreview = {
      open: false,
      loading: false,
      forwardId: '',
      title: '合并转发',
      nodes: [],
      error: '',
    };
    let stickerPanelState = {
      open: false,
      loading: false,
      items: [],
      error: '',
      dir: '',
      lastLoadedAt: 0,
    };
    let lastDragLogAt = 0;
    const avatarLogKeys = new Set();
    const SHOW_INVITE_OPEN_ACTION = false;

    function fmtTime(ms) {
      if (!ms) return '';
      const d = new Date(ms);
      const now = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const timeText = hh + ':' + mm;
      const sameDay =
        d.getFullYear() === now.getFullYear()
        && d.getMonth() === now.getMonth()
        && d.getDate() === now.getDate();
      if (sameDay) {
        return timeText;
      }
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return month + '-' + day + ' ' + timeText;
    }

    function getSelectedChat() {
      if (!state.selectedChatId) return null;
      return state.chats.find((item) => item.id === state.selectedChatId) || null;
    }

    function isPluginRunning() {
      return !!state.runtimeActive;
    }

    function filterChatsByQuery(chats, queryText) {
      const q = String(queryText || '').trim().toLowerCase();
      if (!q) {
        return chats;
      }

      return chats.filter((chat) => {
        const title = String(chat.title || '').toLowerCase();
        const targetId = String(chat.targetId || '').toLowerCase();
        const id = String(chat.id || '').toLowerCase();
        return title.includes(q) || targetId.includes(q) || id.includes(q);
      });
    }

    function normalizeExternalUrl(rawValue) {
      const raw = String(rawValue || '')
        .split('\\\\/').join('/')
        .trim()
        .replace(/^['"]+|['"]+$/g, '')
        .replace(/[",]+$/g, '');
      if (!raw) {
        return '';
      }
      const lower = raw.toLowerCase();
      if (lower.startsWith('mqqapi://') || lower.startsWith('mqqopensdkapi://') || lower.startsWith('tencent.mobileqq://')) {
        return raw;
      }
      const firstSlash = raw.indexOf('/');
      const hostPart = firstSlash >= 0 ? raw.slice(0, firstSlash) : raw;
      if (hostPart.includes('.') && !hostPart.includes(' ') && !hostPart.includes(':')) {
        return 'https://' + raw;
      }
      if (lower.startsWith('http://') || lower.startsWith('https://')) {
        return raw;
      }
      if (raw.startsWith('//')) {
        return 'https:' + raw;
      }
      if (lower.startsWith('www.')) {
        return 'https://' + raw;
      }
      return '';
    }

    function collectHttpUrls(text) {
      const source = String(text || '').split('\\\\/').join('/');
      const lower = source.toLowerCase();
      const stopChars = [' ', '\\n', '\\r', '\\t', '"', "'", '<', '>'];
      const out = [];
      let cursor = 0;

      while (cursor < source.length) {
        const idxHttps = lower.indexOf('https://', cursor);
        const idxHttp = lower.indexOf('http://', cursor);
        const idxMqq = lower.indexOf('mqqapi://', cursor);
        const idxOpen = lower.indexOf('mqqopensdkapi://', cursor);
        const idxMobile = lower.indexOf('tencent.mobileqq://', cursor);

        const candidates = [idxHttps, idxHttp, idxMqq, idxOpen, idxMobile].filter((idx) => idx >= 0);
        let start = -1;
        if (candidates.length > 0) {
          start = Math.min(...candidates);
        }
        if (start < 0) {
          break;
        }

        let end = source.length;
        for (const stop of stopChars) {
          const idx = source.indexOf(stop, start);
          if (idx >= 0 && idx < end) {
            end = idx;
          }
        }
        const normalized = normalizeExternalUrl(source.slice(start, end));
        if (normalized) {
          out.push(normalized);
        }
        cursor = Math.max(start + 8, end);
      }

      return out;
    }

    function extractFirstHttpUrl(text) {
      const all = collectHttpUrls(text);
      if (all.length === 0) {
        return '';
      }
      const nonImage = all.find((item) => !isLikelyImageUrl(item));
      return nonImage || all[0];
    }

    function safeJsonParse(raw) {
      const text = String(raw || '');
      if (!text.trim()) {
        return null;
      }
      const decoded = text
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/&amp;/g, '&')
        .split('\\\\/').join('/');
      try {
        return JSON.parse(decoded);
      } catch {
        return null;
      }
    }

    function getByPath(obj, path) {
      const keys = String(path || '').split('.');
      let cur = obj;
      for (const key of keys) {
        if (!cur || typeof cur !== 'object' || !(key in cur)) {
          return '';
        }
        cur = cur[key];
      }
      return cur;
    }

    function resolveJsonSegmentUrl(seg) {
      const parsed = safeJsonParse(seg?.raw || '');
      if (parsed && typeof parsed === 'object') {
        const preferredPaths = [
          'meta.detail_1.qqdocurl',
          'meta.detail_1.jumpUrl',
          'meta.detail_1.targetUrl',
          'meta.detail_1.link',
          'meta.detail_1.href',
          'meta.news.jumpUrl',
          'meta.news.targetUrl',
          'meta.news.link',
          'meta.news.href',
          'meta.detail_1.url',
        ];
        for (const path of preferredPaths) {
          const value = normalizeExternalUrl(getByPath(parsed, path));
          if (value && !isLikelyImageUrl(value)) {
            return value;
          }
        }
      }
      const direct = normalizeExternalUrl(seg?.url || '');
      if (direct && !isLikelyImageUrl(direct)) {
        return direct;
      }
      const fromRaw = extractFirstHttpUrl(seg?.raw || '');
      if (fromRaw && !isLikelyImageUrl(fromRaw)) {
        return fromRaw;
      }
      const fromSummary = extractFirstHttpUrl(seg?.summary || '');
      if (fromSummary && !isLikelyImageUrl(fromSummary)) {
        return fromSummary;
      }
      return extractFirstHttpUrl(seg?.title || '');
    }

    function isInviteJson(seg, url) {
      const lowerUrl = String(url || '').toLowerCase();
      if (lowerUrl.includes('invite_join') || lowerUrl.includes('group/invite')) {
        return true;
      }
      const raw = String(seg?.raw || '').toLowerCase();
      if (raw.includes('qun.invite') || raw.includes('invite_join') || raw.includes('邀请你加入群聊')) {
        return true;
      }
      const title = String(seg?.title || '').toLowerCase();
      const summary = String(seg?.summary || '').toLowerCase();
      return title.includes('邀请') || summary.includes('邀请');
    }

    function setupHoverPopupPosition(chip, pop, kind) {
      const prefix = kind === 'video' ? '--video-pop-' : '--img-pop-';
      const maxVar = prefix + 'max-h';
      const shiftXVar = prefix + 'shift-x';
      const shiftYVar = prefix + 'shift-y';

      chip.addEventListener('mouseenter', () => {
        const viewportPadding = 8;
        const rect = chip.getBoundingClientRect();
        const spaceAbove = rect.top - viewportPadding;
        const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
        const preferDown = spaceBelow > 140 && spaceBelow >= spaceAbove;

        chip.style.setProperty(shiftXVar, '0px');
        chip.style.setProperty(shiftYVar, '0px');

        if (preferDown) {
          chip.classList.add('preview-down');
        } else {
          chip.classList.remove('preview-down');
        }

        const maxHeight = Math.max(120, Math.min(300, (preferDown ? spaceBelow : spaceAbove) - 10));
        chip.style.setProperty(maxVar, String(Math.round(maxHeight)) + 'px');

        requestAnimationFrame(() => {
          const popRect = pop.getBoundingClientRect();
          let shiftX = 0;
          let shiftY = 0;

          if (popRect.left < viewportPadding) {
            shiftX = viewportPadding - popRect.left;
          } else if (popRect.right > window.innerWidth - viewportPadding) {
            shiftX = (window.innerWidth - viewportPadding) - popRect.right;
          }

          if (!chip.classList.contains('preview-down') && popRect.top < viewportPadding) {
            if (spaceBelow > spaceAbove) {
              chip.classList.add('preview-down');
            } else {
              shiftY = viewportPadding - popRect.top;
            }
          } else if (chip.classList.contains('preview-down') && popRect.bottom > window.innerHeight - viewportPadding) {
            if (spaceAbove >= spaceBelow) {
              chip.classList.remove('preview-down');
            } else {
              shiftY = (window.innerHeight - viewportPadding) - popRect.bottom;
            }
          }

          chip.style.setProperty(shiftXVar, String(Math.round(shiftX)) + 'px');
          chip.style.setProperty(shiftYVar, String(Math.round(shiftY)) + 'px');
        });
      });

      chip.addEventListener('mouseleave', () => {
        chip.classList.remove('preview-down');
        chip.style.setProperty(shiftXVar, '0px');
        chip.style.setProperty(shiftYVar, '0px');
        chip.style.setProperty(maxVar, '250px');
      });
    }

    function isLikelyImageUrl(url) {
      const value = String(url || '').toLowerCase();
      if (!value) {
        return false;
      }
      return (
        value.includes('.png') ||
        value.includes('.jpg') ||
        value.includes('.jpeg') ||
        value.includes('.gif') ||
        value.includes('.webp') ||
        value.includes('.bmp') ||
        value.includes('.svg') ||
        value.includes('/logo/') ||
        value.includes('/avatar/') ||
        value.includes('/thumb/') ||
        value.includes('/cover/') ||
        value.includes('open.gtimg.cn/open/app_icon/') ||
        value.includes('qq.ugcimg.cn/') ||
        value.includes('multimedia.nt.qq.com.cn/download')
      );
    }

    async function copyToClipboard(text) {
      const content = String(text || '');
      if (!content.trim()) {
        return false;
      }
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(content);
          return true;
        }
      } catch {
        // Fallback to execCommand below.
      }

      const area = document.createElement('textarea');
      area.value = content;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      area.style.pointerEvents = 'none';
      document.body.appendChild(area);
      area.focus();
      area.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      } finally {
        document.body.removeChild(area);
      }
      return ok;
    }

    function getMessageImageUrls(msg) {
      const urls = [];
      const seen = new Set();
      const segments = Array.isArray(msg?.segments) ? msg.segments : [];
      for (const seg of segments) {
        if (!seg || seg.type !== 'image') {
          continue;
        }
        const url = String(seg.url || '').trim();
        if (!url || seen.has(url)) {
          continue;
        }
        seen.add(url);
        urls.push(url);
      }
      return urls;
    }

    function clipForLog(text, max = 120) {
      const value = String(text || '');
      if (value.length <= max) {
        return value;
      }
      return value.slice(0, max) + '...';
    }

    async function fetchImageBlobForClipboard(url) {
      const source = String(url || '').trim();
      if (!source) {
        return null;
      }
      try {
        const response = await fetch(source, {
          cache: 'no-store',
          credentials: 'omit',
          mode: 'cors',
          referrerPolicy: 'no-referrer',
        });
        if (!response.ok) {
          return null;
        }
        const blob = await response.blob();
        if (!blob || !String(blob.type || '').toLowerCase().startsWith('image/')) {
          return null;
        }
        return blob;
      } catch {
        return null;
      }
    }

    async function copyImageToClipboard(url) {
      const source = String(url || '').trim();
      if (!source) {
        return {
          ok: false,
          reason: 'empty-url',
        };
      }
      if (!navigator?.clipboard?.write || typeof ClipboardItem === 'undefined') {
        return {
          ok: false,
          reason: 'clipboard-image-api-unavailable',
        };
      }
      const blob = await fetchImageBlobForClipboard(source);
      if (!blob) {
        return {
          ok: false,
          reason: 'image-fetch-failed-or-blocked',
        };
      }
      const mime = String(blob.type || 'image/png').toLowerCase();
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            [mime]: blob,
          }),
        ]);
        return {
          ok: true,
          reason: '',
          mime,
        };
      } catch (error) {
        return {
          ok: false,
          reason: String(error?.message || error || 'clipboard-write-failed'),
        };
      }
    }

    function attachAvatarImage(container, options) {
      const url = String(options?.url || '').trim();
      const fallbackText = String(options?.fallbackText || '?');
      const imageClassName = String(options?.imageClassName || 'avatar-img');
      const onError = typeof options?.onError === 'function' ? options.onError : null;

      container.textContent = '';
      const fallback = document.createElement('span');
      fallback.textContent = fallbackText;
      container.appendChild(fallback);
      if (!url) {
        return;
      }

      const loader = new Image();
      loader.referrerPolicy = 'no-referrer';
      loader.onload = () => {
        const avatarImg = document.createElement('img');
        avatarImg.className = imageClassName;
        avatarImg.loading = 'lazy';
        avatarImg.referrerPolicy = 'no-referrer';
        avatarImg.alt = fallbackText;
        avatarImg.src = url;
        fallback.style.display = 'none';
        container.appendChild(avatarImg);
      };
      loader.onerror = () => {
        fallback.style.display = '';
        if (onError) {
          onError();
        }
      };
      loader.src = url;
    }

    function logAvatarIssue(kind, msg, detail) {
      const key = kind + ':' + String(msg?.id || '') + ':' + String(msg?.senderId || '');
      if (avatarLogKeys.has(key)) {
        return;
      }
      avatarLogKeys.add(key);
      const sender = String(msg?.senderName || msg?.senderId || 'unknown');
      const senderId = String(msg?.senderId || 'unknown');
      const message = 'avatar ' + kind + ': sender=' + sender + ', senderId=' + senderId + (detail ? ', ' + detail : '');
      vscode.postMessage({
        type: 'webLog',
        level: 'warn',
        message,
      });
    }

    function logWeb(level, message) {
      const text = String(message || '').trim();
      if (!text) {
        return;
      }
      vscode.postMessage({
        type: 'webLog',
        level: String(level || 'info'),
        message: text,
      });
    }

${renderComposerScript()}

${renderSettingsScript()}

${renderMentionMenuScript()}

${renderListForwardScript()}

${renderMessageScript()}

    window.addEventListener('error', (event) => {
      const msg = String(event?.message || 'unknown');
      const src = String(event?.filename || '');
      const line = Number(event?.lineno || 0);
      const col = Number(event?.colno || 0);
      logWeb('error', 'window.error: ' + msg + ' @ ' + src + ':' + String(line) + ':' + String(col));
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event?.reason;
      const text = reason?.stack || reason?.message || String(reason || 'unknown');
      logWeb('error', 'unhandledrejection: ' + String(text));
    });


    function setPendingReply(data) {
      pendingReply = {
        messageId: String(data?.messageId || '').trim(),
        senderName: String(data?.senderName || '').trim(),
        preview: String(data?.preview || '').trim(),
      };
      renderComposerReply();
      const input = document.getElementById('composerInput');
      if (input) {
        input.focus();
      }
      renderComposerState();
    }

    function clearPendingReply() {
      pendingReply = {
        messageId: '',
        senderName: '',
        preview: '',
      };
      renderComposerReply();
      renderComposerState();
    }

    function renderComposerReply() {
      const root = document.getElementById('composerReply');
      const text = document.getElementById('composerReplyText');
      if (!root || !text) {
        return;
      }
      if (!pendingReply.messageId) {
        root.classList.remove('active');
        text.textContent = '';
        return;
      }
      root.classList.add('active');
      const name = pendingReply.senderName || '某人';
      const preview = pendingReply.preview ? ('：' + pendingReply.preview) : '';
      text.textContent = '回复 ' + name + preview;
      root.title = 'message_id=' + pendingReply.messageId;
    }

    function findMessageById(messageId) {
      const id = String(messageId || '').trim();
      if (!id) {
        return null;
      }
      return (Array.isArray(state.selectedMessages) ? state.selectedMessages : []).find((item) => String(item?.id || '') === id) || null;
    }

    function sendQuickText(text) {
      const selected = getSelectedChat();
      const value = String(text || '').trim();
      if (!selected || !value || sendBusy) {
        return;
      }
      sendBusy = true;
      forceScrollBottom = true;
      renderComposerState();
      vscode.postMessage({
        type: 'sendChatMessage',
        chatId: selected.id,
        text: value,
        replyToMessageId: '',
        images: [],
      });
    }

    function renderAccountHeader() {
      const avatarNode = document.getElementById('accountAvatar');
      const nameNode = document.getElementById('accountName');
      const dotNode = document.getElementById('accountDot');
      const nickname = String(state.selfNickname || 'NCat');
      const uid = String(state.selfUserId || '').trim();
      const avatarUrl = String(state.selfAvatarUrl || '').trim() || (uid ? ('https://q1.qlogo.cn/g?b=qq&nk=' + encodeURIComponent(uid) + '&s=100') : '');
      nameNode.textContent = nickname;
      attachAvatarImage(avatarNode, {
        url: avatarUrl,
        fallbackText: (nickname || 'N').slice(0, 1),
        imageClassName: 'msg-avatar-img',
      });
      dotNode.classList.remove('online');
      dotNode.classList.remove('paused');
      if (!isPluginRunning()) {
        dotNode.classList.add('paused');
      } else if (state.connectionState === 'online') {
        dotNode.classList.add('online');
      }
      const stateLabel = !isPluginRunning()
        ? '未运行'
        : (state.connectionState === 'online' ? '在线' : '离线');
      nameNode.title = uid ? (nickname + ' (' + uid + ') · ' + stateLabel) : (nickname + ' · ' + stateLabel);
      renderRuntimeButtons();
    }

    function renderRuntimeButtons() {
      const running = isPluginRunning();
      const buttons = [document.getElementById('btnRuntime'), document.getElementById('btnRuntime2')];
      for (const button of buttons) {
        if (!button) {
          continue;
        }
        button.textContent = running ? '停止插件' : '启动插件';
        button.classList.toggle('stop', running);
      }
    }


    function renderAll() {
      try {
        renderAccountHeader();
        renderPageState();
        renderCards();
        renderMessages();
        renderForwardPreview();
        renderComposerAttachments();
        renderComposerReply();
        renderComposerState();
        if (mentionState.open) {
          updateMentionMenuFromInput();
        }
        renderSettingsPanel();
        vscode.setState({
          selectedChatId: state.selectedChatId,
          searchQuery,
          uiPrefs,
        });
      } catch (error) {
        logWeb('error', 'renderAll failed: ' + String(error?.stack || error?.message || error));
      }
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'state') {
        const payload = msg.payload && typeof msg.payload === 'object' ? msg.payload : null;
        if (!payload) {
          logWeb('warn', 'state update ignored: payload missing');
          return;
        }
        if (!Array.isArray(payload.chats) || !Array.isArray(payload.selectedMessages)) {
          logWeb(
            'warn',
            'state update ignored: malformed arrays chats=' + String(Array.isArray(payload.chats)) +
              ', selectedMessages=' + String(Array.isArray(payload.selectedMessages))
          );
          return;
        }
        const prevSelectedChatId = state.selectedChatId;
        state = {
          ...state,
          ...payload,
          chats: payload.chats,
          selectedMessages: payload.selectedMessages,
          directoryResults: Array.isArray(payload.directoryResults) ? payload.directoryResults : [],
          selectedMembers: Array.isArray(payload.selectedMembers) ? payload.selectedMembers : [],
          backend: payload.backend && typeof payload.backend === 'object'
            ? payload.backend
            : state.backend,
          hidden: payload.hidden && typeof payload.hidden === 'object'
            ? payload.hidden
            : state.hidden,
        };
        if (state.selectedChatId !== prevSelectedChatId) {
          clearPendingReply();
          closeMentionMenu();
          closeBubbleMenu();
          closeStickerPanel();
          closeJsonComposer();
        }
        if (state.selectedChatId && (state.selectedChatId !== prevSelectedChatId || state.selectedChatId === pendingOpenChatId)) {
          forceScrollBottom = true;
        }
        if (!state.isLoadingOlder) {
          olderLoadBusy = false;
        }
        renderAll();
        return;
      }

      if (msg.type === 'sendResult') {
        sendBusy = false;
        const input = document.getElementById('composerInput');
        renderComposerState();

        if (msg.ok) {
          input.value = '';
          pendingImages = [];
          clearPendingReply();
          renderComposerAttachments();
          input.focus();
        }
        return;
      }

      if (msg.type === 'resolveImageUrlResult') {
        const requestId = String(msg.requestId || '').trim();
        if (!requestId) {
          return;
        }
        const pending = pendingResolveImageRequests.get(requestId);
        if (!pending) {
          logWeb('warn', 'resolveImageUrlResult ignored: unknown requestId=' + requestId);
          return;
        }
        pendingResolveImageRequests.delete(requestId);
        clearTimeout(pending.timer);
        if (msg.ok) {
          logWeb('info', 'resolveImageUrlResult ok: id=' + requestId + ', mime=' + String(msg.mime || ''));
          pending.resolve({
            dataUrl: String(msg.dataUrl || ''),
            name: String(msg.name || 'image.png'),
            mime: String(msg.mime || ''),
          });
          return;
        }
        logWeb('warn', 'resolveImageUrlResult failed: id=' + requestId + ', reason=' + String(msg.error || 'resolve failed'));
        pending.reject(new Error(String(msg.error || 'resolve failed')));
        return;
      }

      if (msg.type === 'stickerPackListResult') {
        const items = Array.isArray(msg.items) ? msg.items : [];
        stickerPanelState.loading = false;
        stickerPanelState.error = msg.ok ? '' : String(msg.error || '加载失败');
        stickerPanelState.items = items
          .map((item, idx) => ({
            id: String(item?.id || ('sticker-' + idx)),
            name: String(item?.name || 'sticker'),
            dataUrl: String(item?.dataUrl || ''),
          }))
          .filter((item) => item.dataUrl.startsWith('data:image/'));
        stickerPanelState.dir = String(msg.dir || '');
        stickerPanelState.lastLoadedAt = Date.now();
        renderStickerPanel();
        return;
      }

      if (msg.type === 'olderResult') {
        olderLoadBusy = false;
        return;
      }

      if (msg.type === 'quickActionResult') {
        if (msg.action === 'poke') {
          if (msg.ok) {
            logWeb('info', 'poke sent: target=' + String(msg.targetId || 'default'));
          } else {
            logWeb('warn', 'poke failed: ' + String(msg.error || 'unknown'));
          }
          return;
        }
        if (msg.action === 'stickerSend') {
          if (msg.ok) {
            clearPendingReply();
            logWeb('info', 'sticker sent');
          } else {
            logWeb('warn', 'sticker send failed: ' + String(msg.error || 'unknown'));
          }
          return;
        }
        if (msg.action === 'recall') {
          if (msg.ok) {
            logWeb('info', 'message recalled');
          } else {
            logWeb('warn', 'message recall failed: ' + String(msg.error || 'unknown'));
          }
          return;
        }
        if (msg.action === 'jsonSend') {
          if (msg.ok) {
            clearPendingReply();
            logWeb('info', 'json message sent');
          } else {
            logWeb('warn', 'json send failed: ' + String(msg.error || 'unknown'));
          }
          return;
        }
        if (msg.action === 'stickerDelete') {
          if (msg.ok) {
            logWeb('info', 'sticker deleted');
            if (stickerPanelState.open) {
              requestStickerPackList(true);
            }
          } else {
            logWeb('warn', 'sticker delete failed: ' + String(msg.error || 'unknown'));
          }
          return;
        }
        if (msg.action === 'hideChat') {
          if (msg.ok) {
            logWeb('info', 'chat hidden: ' + String(msg.chatId || ''));
            closeAvatarMenu();
            closeBubbleMenu();
            if (typeof closeChatTitleMenu === 'function') {
              closeChatTitleMenu();
            }
          } else {
            logWeb('warn', 'hide chat failed: ' + String(msg.error || 'unknown'));
          }
        }
        return;
      }

      if (msg.type === 'addToStickerPackResult') {
        const savedCount = Number(msg.savedCount || 0);
        const failedCount = Number(msg.failedCount || 0);
        const dir = String(msg.dir || '');
        if (msg.ok) {
          logWeb('info', 'sticker saved: count=' + String(savedCount) + ', failed=' + String(failedCount) + ', dir=' + dir);
          requestStickerPackList(true);
        } else {
          logWeb('warn', 'sticker save failed: ' + String(msg.error || 'unknown'));
        }
        return;
      }

      if (msg.type === 'settingsActionResult') {
        if (msg.action === 'clearCache' && msg.ok) {
          closeSettingsPanel();
          closeBubbleMenu();
          closeAvatarMenu();
          closeMentionMenu();
          clearPendingReply();
          logWeb('info', 'local cache cleared');
        }
        return;
      }

      if (msg.type === 'saveBackendSettingsResult') {
        if (msg.ok) {
          logWeb('info', 'backend settings saved');
        } else {
          logWeb('warn', 'backend settings save failed: ' + String(msg.error || 'unknown'));
        }
        return;
      }

      if (msg.type === 'saveHiddenSettingsResult') {
        if (msg.ok) {
          logWeb('info', 'hidden settings saved');
        } else {
          logWeb('warn', 'hidden settings save failed: ' + String(msg.error || 'unknown'));
        }
        return;
      }

      if (msg.type === 'forwardPreview') {
        if (msg.loading) {
          forwardPreview = {
            open: true,
            loading: true,
            forwardId: String(msg.forwardId || forwardPreview.forwardId || ''),
            title: forwardPreview.title || '合并转发',
            nodes: [],
            error: '',
          };
          renderForwardPreview();
          return;
        }

        if (msg.ok && msg.payload) {
          forwardPreview = {
            open: true,
            loading: false,
            forwardId: String(msg.payload.forwardId || ''),
            title: String(msg.payload.title || '合并转发'),
            nodes: Array.isArray(msg.payload.nodes) ? msg.payload.nodes : [],
            error: '',
          };
          renderForwardPreview();
          return;
        }

        forwardPreview = {
          open: true,
          loading: false,
          forwardId: String(msg.forwardId || forwardPreview.forwardId || ''),
          title: forwardPreview.title || '合并转发',
          nodes: [],
          error: String(msg.error || '未知错误'),
        };
        renderForwardPreview();
      }
    });
    document.getElementById('messages').addEventListener('scroll', (event) => {
      const root = event.currentTarget;
      if (!state.selectedChatId) {
        return;
      }
      if (olderLoadBusy || state.isLoadingOlder) {
        return;
      }
      if (root.scrollTop <= 10) {
        olderLoadBusy = true;
        vscode.postMessage({
          type: 'loadOlderMessages',
          chatId: state.selectedChatId,
        });
      }
    });

    setupComposer();
    setupSettingsUi();
    setupMentionAndMenus();
    setupListAndForwardUi();

    document.getElementById('composerReplyClear').addEventListener('click', () => {
      clearPendingReply();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && settingsOpen) {
        event.preventDefault();
        closeSettingsPanel();
      }
    });

    window.addEventListener('resize', () => {
      positionMentionMenu();
      closeAvatarMenu();
      if (typeof closeChatTitleMenu === 'function') {
        closeChatTitleMenu();
      }
      closeBubbleMenu();
      closeStickerPanel();
      renderSettingsPanel();
    });

    const prev = vscode.getState();
    // Avoid restoring second-level page directly on startup.
    // Stale cached selection can lock interaction in edge cases.
    state.selectedChatId = '';
    if (prev && typeof prev.searchQuery === 'string') {
      searchQuery = prev.searchQuery;
      const searchNode = document.getElementById('chatSearch');
      searchNode.value = searchQuery;
    }
    if (prev && prev.uiPrefs && typeof prev.uiPrefs === 'object') {
      uiPrefs.previewImages = prev.uiPrefs.previewImages !== false;
      uiPrefs.previewVideos = prev.uiPrefs.previewVideos !== false;
      uiPrefs.enterToSend = prev.uiPrefs.enterToSend !== false;
    }

    renderAll();
    logWeb('info', 'webview initialized');
    vscode.postMessage({ type: 'ready' });
    if (searchQuery.trim()) {
      vscode.postMessage({
        type: 'updateSearchQuery',
        query: searchQuery,
      });
    }
  </script>
</body>
</html>`;
}

module.exports = {
  renderHtml,
};
