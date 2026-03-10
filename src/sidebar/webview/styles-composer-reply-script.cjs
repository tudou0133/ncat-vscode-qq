function renderWebviewComposerReplyStyles() {
  return `
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
`;
}

module.exports = {
  renderWebviewComposerReplyStyles,
};
