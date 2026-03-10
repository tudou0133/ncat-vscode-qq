function renderMentionCoreScript() {
  return String.raw`
    function hasSelectedChat() {
      const selected = getSelectedChat();
      return !!selected;
    }

    function isMentionBoundaryChar(ch) {
      if (!ch) {
        return true;
      }
      if (String(ch).trim() === '') {
        return true;
      }
      const punctuation = ',.;:!?~!@#$%^&*()_+-=[]{}|<>/?，。；：！？、（）【】《》「」' + "'" + '"' + String.fromCharCode(92);
      return punctuation.includes(ch);
    }

    function closeMentionMenu() {
      mentionState.open = false;
      mentionState.start = -1;
      mentionState.end = -1;
      mentionState.query = '';
      mentionState.candidates = [];
      mentionState.selectedIndex = 0;
      const menu = document.getElementById('mentionMenu');
      if (menu) {
        menu.hidden = true;
        menu.innerHTML = '';
      }
    }

    function collectMentionCandidates(rawQuery) {
      if (!hasSelectedChat()) {
        return [];
      }
      const query = String(rawQuery || '').trim().toLowerCase();
      const seen = new Set();
      const entries = [];

      function addCandidate(userId, name, sourceRank) {
        const uid = String(userId || '').trim();
        if (!uid) {
          return;
        }
        const key = uid.toLowerCase();
        if (seen.has(key)) {
          return;
        }
        const display = String(name || '').trim() || ('QQ ' + uid);
        const haystack = (display + '\n' + uid).toLowerCase();
        if (query && !haystack.includes(query)) {
          return;
        }
        const rank = key === query ? 0 : display.toLowerCase().startsWith(query) ? 1 : haystack.includes(query) ? 2 : 3;
        seen.add(key);
        entries.push({
          userId: uid,
          displayName: display,
          sourceRank: Number(sourceRank || 9),
          rank,
        });
      }

      const selected = getSelectedChat();
      if (selected && selected.type === 'private' && /^\d+$/.test(String(selected.targetId || ''))) {
        addCandidate(String(selected.targetId), selected.title || '', 5);
      }
      if (selected && selected.type === 'group') {
        addCandidate('all', '全体成员', 0);
      }

      for (const member of Array.isArray(state.selectedMembers) ? state.selectedMembers : []) {
        addCandidate(member.userId, member.displayName || member.card || member.nickname || '', 1);
      }
      for (const msg of Array.isArray(state.selectedMessages) ? state.selectedMessages : []) {
        addCandidate(msg.senderId, msg.senderName || '', 2);
      }

      return entries
        .sort((a, b) =>
          a.rank - b.rank ||
          a.sourceRank - b.sourceRank ||
          a.displayName.localeCompare(b.displayName, 'zh-CN')
        )
        .slice(0, 30);
    }

    function findMentionContext(inputNode) {
      if (!inputNode) {
        return null;
      }
      const text = String(inputNode.value || '');
      const end = Number(inputNode.selectionStart || 0);
      const prefix = text.slice(0, end);
      const atIndex = Math.max(prefix.lastIndexOf('@'), prefix.lastIndexOf('＠'));
      if (atIndex < 0) {
        return null;
      }
      const before = atIndex > 0 ? prefix[atIndex - 1] : '';
      if (!isMentionBoundaryChar(before)) {
        return null;
      }
      const query = prefix.slice(atIndex + 1);
      if (!query && atIndex !== end - 1) {
        return null;
      }
      if (/\s/.test(query)) {
        return null;
      }
      return {
        start: atIndex,
        end,
        query,
      };
    }

    function positionMentionMenu() {
      const menu = document.getElementById('mentionMenu');
      const input = document.getElementById('composerInput');
      if (!menu || !input || menu.hidden) {
        return;
      }
      const stage = document.getElementById('stage');
      const stageRect = stage ? stage.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      const rect = input.getBoundingClientRect();
      const viewportPadding = 8;
      const menuHeight = Math.min(220, Math.max(80, menu.scrollHeight || 120));
      let top = rect.top - stageRect.top - menuHeight - 6;
      if (top < viewportPadding) {
        top = Math.min(stageRect.height - menuHeight - viewportPadding, rect.bottom - stageRect.top + 6);
      }
      const maxLeft = stageRect.width - Math.min(360, Math.max(220, menu.offsetWidth || 220)) - viewportPadding;
      const left = Math.max(viewportPadding, Math.min(rect.left - stageRect.left, maxLeft));
      menu.style.top = String(Math.round(top)) + 'px';
      menu.style.left = String(Math.round(left)) + 'px';
    }

    function applyMentionCandidate(candidate) {
      const input = document.getElementById('composerInput');
      if (!input || !candidate) {
        return;
      }
      const targetId = String(candidate.userId || '').trim();
      const token = '@' + targetId + ' ';
      if (!token.trim()) {
        return;
      }

      let start = mentionState.start;
      let end = mentionState.end;
      if (start < 0 || end < 0 || end < start) {
        const ctx = findMentionContext(input);
        if (!ctx) {
          return;
        }
        start = ctx.start;
        end = ctx.end;
      }

      const value = String(input.value || '');
      const next = value.slice(0, start) + token + value.slice(end);
      const cursor = start + token.length;
      input.value = next;
      input.focus();
      input.selectionStart = cursor;
      input.selectionEnd = cursor;
      closeMentionMenu();
      renderComposerState();
    }

    function renderMentionMenu() {
      const menu = document.getElementById('mentionMenu');
      if (!menu) {
        return;
      }
      if (!mentionState.open || mentionState.candidates.length === 0) {
        menu.hidden = true;
        menu.innerHTML = '';
        return;
      }
      menu.hidden = false;
      menu.innerHTML = '';

      mentionState.candidates.forEach((item, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mention-item' + (idx === mentionState.selectedIndex ? ' active' : '');
        btn.dataset.index = String(idx);

        const name = document.createElement('span');
        name.className = 'mention-name';
        name.textContent = item.displayName || ('QQ ' + item.userId);

        const id = document.createElement('span');
        id.className = 'mention-id';
        id.textContent = item.userId;

        btn.appendChild(name);
        btn.appendChild(id);
        btn.addEventListener('mousedown', (event) => {
          event.preventDefault();
          applyMentionCandidate(item);
        });
        menu.appendChild(btn);
      });

      positionMentionMenu();
    }

    function updateMentionMenuFromInput() {
      const input = document.getElementById('composerInput');
      if (!input || !hasSelectedChat()) {
        closeMentionMenu();
        return;
      }

      const ctx = findMentionContext(input);
      if (!ctx) {
        closeMentionMenu();
        return;
      }

      const candidates = collectMentionCandidates(ctx.query);
      if (candidates.length === 0) {
        closeMentionMenu();
        return;
      }

      mentionState.open = true;
      mentionState.start = ctx.start;
      mentionState.end = ctx.end;
      mentionState.query = ctx.query;
      mentionState.candidates = candidates;
      if (mentionState.selectedIndex >= candidates.length) {
        mentionState.selectedIndex = 0;
      }
      renderMentionMenu();
    }

    function insertMentionToken(userId) {
      const uid = String(userId || '').trim();
      if (!uid) {
        return;
      }
      const input = document.getElementById('composerInput');
      if (!input) {
        return;
      }
      const token = '@' + uid + ' ';
      const value = String(input.value || '');
      const hasLiveSelection =
        document.activeElement === input &&
        Number.isFinite(input.selectionStart) &&
        Number.isFinite(input.selectionEnd);
      const start = hasLiveSelection ? Number(input.selectionStart || 0) : Math.max(0, Math.min(value.length, Number(composerSelection.start || value.length)));
      const end = hasLiveSelection ? Number(input.selectionEnd || 0) : Math.max(start, Math.min(value.length, Number(composerSelection.end || value.length)));
      input.value = value.slice(0, start) + token + value.slice(end);
      const cursor = start + token.length;
      input.focus();
      input.selectionStart = cursor;
      input.selectionEnd = cursor;
      composerSelection.start = cursor;
      composerSelection.end = cursor;
      closeMentionMenu();
      renderComposerState();
    }

`;
}

module.exports = {
  renderMentionCoreScript,
};
