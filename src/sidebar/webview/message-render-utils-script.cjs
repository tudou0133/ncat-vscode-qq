function renderMessageRenderUtilsScript() {
  return String.raw`
    function truncateFileNameKeepExt(name, maxBytes = 64) {
      const raw = String(name || '').trim();
      if (!raw) {
        return '文件';
      }
      const encoder = new TextEncoder();
      if (encoder.encode(raw).length <= maxBytes) {
        return raw;
      }

      const dot = raw.lastIndexOf('.');
      const hasExt = dot > 0 && dot < raw.length - 1;
      const ext = hasExt ? raw.slice(dot) : '';
      const base = hasExt ? raw.slice(0, dot) : raw;
      const ellipsis = '...';
      const extBytes = encoder.encode(ext).length;
      const ellipsisBytes = encoder.encode(ellipsis).length;
      let budget = maxBytes - ellipsisBytes - extBytes;

      if (budget <= 0) {
        let compact = '';
        let used = 0;
        for (const ch of raw) {
          const bytes = encoder.encode(ch).length;
          if (used + bytes + ellipsisBytes > maxBytes) {
            break;
          }
          compact += ch;
          used += bytes;
        }
        return compact ? (compact + ellipsis) : raw;
      }

      let clipped = '';
      let used = 0;
      for (const ch of base) {
        const bytes = encoder.encode(ch).length;
        if (used + bytes > budget) {
          break;
        }
        clipped += ch;
        used += bytes;
      }
      return (clipped || base.slice(0, 1)) + ellipsis + ext;
    }

    function isSystemLineMessage(msg) {
      if (!msg || typeof msg !== 'object') {
        return false;
      }
      if (String(msg.displayStyle || '') === 'system') {
        return true;
      }
      const segments = Array.isArray(msg.segments) ? msg.segments : [];
      return segments.some((seg) => seg && seg.type === 'poke_notice');
    }
`;
}

module.exports = {
  renderMessageRenderUtilsScript,
};
