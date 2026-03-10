function renderSettingsScript() {
  return String.raw`
    function collectBackendSettingsFromInputs() {
      return {
        rootDir: String(document.getElementById('settingRootDir')?.value || '').trim(),
        tokenFile: String(document.getElementById('settingTokenFile')?.value || '').trim(),
        quickLoginUin: String(document.getElementById('settingQuickLoginUin')?.value || '').trim(),
      };
    }

    function collectHiddenSettingsFromInputs() {
      return {
        privateIds: String(document.getElementById('settingHiddenPrivateIds')?.value || '').trim(),
        groupIds: String(document.getElementById('settingHiddenGroupIds')?.value || '').trim(),
      };
    }

    function scheduleBackendSettingsSave(immediate = false) {
      if (backendSaveTimer) {
        clearTimeout(backendSaveTimer);
        backendSaveTimer = null;
      }
      const run = () => {
        const payload = collectBackendSettingsFromInputs();
        vscode.postMessage({
          type: 'saveBackendSettings',
          ...payload,
        });
      };
      if (immediate) {
        run();
        return;
      }
      backendSaveTimer = setTimeout(() => {
        backendSaveTimer = null;
        run();
      }, 320);
    }

    function scheduleHiddenSettingsSave(immediate = false) {
      if (hiddenSaveTimer) {
        clearTimeout(hiddenSaveTimer);
        hiddenSaveTimer = null;
      }
      const run = () => {
        const payload = collectHiddenSettingsFromInputs();
        vscode.postMessage({
          type: 'saveHiddenSettings',
          ...payload,
        });
      };
      if (immediate) {
        run();
        return;
      }
      hiddenSaveTimer = setTimeout(() => {
        hiddenSaveTimer = null;
        run();
      }, 320);
    }

    function renderSettingsPanel() {
      const overlay = document.getElementById('settingsOverlay');
      const imageToggle = document.getElementById('settingPreviewImages');
      const videoToggle = document.getElementById('settingPreviewVideos');
      const enterToggle = document.getElementById('settingEnterToSend');
      const rootDirInput = document.getElementById('settingRootDir');
      const tokenFileInput = document.getElementById('settingTokenFile');
      const quickLoginUinInput = document.getElementById('settingQuickLoginUin');
      const hiddenPrivateInput = document.getElementById('settingHiddenPrivateIds');
      const hiddenGroupInput = document.getElementById('settingHiddenGroupIds');
      const backendHint = document.getElementById('settingBackendHint');
      const backendToggleBtn = document.getElementById('settingBackendToggle');
      if (overlay) {
        overlay.classList.toggle('open', !!settingsOpen);
        overlay.setAttribute('aria-hidden', settingsOpen ? 'false' : 'true');
      }
      if (imageToggle) {
        imageToggle.checked = !!uiPrefs.previewImages;
      }
      if (videoToggle) {
        videoToggle.checked = !!uiPrefs.previewVideos;
      }
      if (enterToggle) {
        enterToggle.checked = !!uiPrefs.enterToSend;
      }
      if (rootDirInput && document.activeElement !== rootDirInput) {
        rootDirInput.value = String(state?.backend?.rootDir || '');
      }
      if (tokenFileInput && document.activeElement !== tokenFileInput) {
        tokenFileInput.value = String(state?.backend?.tokenFile || '');
      }
      if (quickLoginUinInput && document.activeElement !== quickLoginUinInput) {
        quickLoginUinInput.value = String(state?.backend?.quickLoginUin || '');
      }
      if (hiddenPrivateInput && document.activeElement !== hiddenPrivateInput) {
        hiddenPrivateInput.value = String(state?.hidden?.privateText || '');
      }
      if (hiddenGroupInput && document.activeElement !== hiddenGroupInput) {
        hiddenGroupInput.value = String(state?.hidden?.groupText || '');
      }
      if (backendHint) {
        const runtimeLabel = state?.runtimeActive ? '运行中' : '未运行';
        const blockedByOther = !!state?.runtimeBlockedByOther;
        const blockedOwnerPid = Number(state?.runtimeBlockedOwnerPid || 0);
        const runningLabel = state?.backend?.backendManagedActive
          ? '已启动'
          : (state?.backend?.backendProcessRunning ? '运行中' : '未启动');
        const modeLabel = state?.backend?.backendManualMode ? '手动模式（已停止自动重连）' : '自动托管模式';
        const launchScript = String(state?.backend?.backendLastLaunchFile || '').trim();
        const quickLoginUin = String(state?.backend?.quickLoginUin || '').trim();
        const quickLoginNote = quickLoginUin
          ? ('快速登录: 已配置 QQ ' + quickLoginUin)
          : '快速登录: 未配置（将走二维码登录）';
        const base = launchScript
          ? ('后端状态: ' + runningLabel + '，模式: ' + modeLabel + '，最近启动脚本: ' + launchScript)
          : ('后端状态: ' + runningLabel + '，模式: ' + modeLabel);
        const runtimeNote = blockedByOther
          ? (blockedOwnerPid > 0
              ? ('插件状态: 未运行（另一个窗口占用，PID ' + blockedOwnerPid + '）')
              : '插件状态: 未运行（另一个窗口占用）')
          : ('插件状态: ' + runtimeLabel);
        backendHint.textContent = runtimeNote + '，' + base + '，' + quickLoginNote;
      }
      if (backendToggleBtn) {
        const backendRunning = !!state?.backend?.backendManagedActive || !!state?.backend?.backendProcessRunning;
        backendToggleBtn.textContent = backendRunning ? '停止后端' : '启动后端';
      }
    }

    function openSettingsPanel() {
      settingsOpen = true;
      closeAvatarMenu();
      if (typeof closeChatTitleMenu === 'function') {
        closeChatTitleMenu();
      }
      closeBubbleMenu();
      closeMentionMenu();
      renderSettingsPanel();
    }

    function closeSettingsPanel() {
      settingsOpen = false;
      renderSettingsPanel();
    }

    function applyUiPref(key, value) {
      if (!(key in uiPrefs)) {
        return;
      }
      uiPrefs[key] = !!value;
      if (key === 'previewImages' || key === 'previewVideos') {
        renderMessages();
      }
      renderSettingsPanel();
    }

    function setupSettingsUi() {
      document.getElementById('btnSettings').addEventListener('click', () => {
        openSettingsPanel();
      });

      document.getElementById('btnSettings2').addEventListener('click', () => {
        openSettingsPanel();
      });

      document.getElementById('btnCloseSettings').addEventListener('click', () => {
        closeSettingsPanel();
      });

      document.getElementById('settingsOverlay').addEventListener('click', (event) => {
        if (event.target === event.currentTarget) {
          closeSettingsPanel();
        }
      });

      document.getElementById('settingOpenLogs').addEventListener('click', () => {
        vscode.postMessage({
          type: 'settingsAction',
          action: 'openLogs',
        });
      });

      document.getElementById('settingOpenDownloads').addEventListener('click', () => {
        vscode.postMessage({
          type: 'settingsAction',
          action: 'openDownloadFolder',
        });
      });

      document.getElementById('settingOpenExt').addEventListener('click', () => {
        vscode.postMessage({
          type: 'settingsAction',
          action: 'openExtensionSettings',
        });
      });

      document.getElementById('settingOpenNapcatReleases').addEventListener('click', () => {
        vscode.postMessage({
          type: 'settingsAction',
          action: 'openNapcatReleases',
        });
      });

      document.getElementById('settingBackendToggle').addEventListener('click', () => {
        const backendRunning = !!state?.backend?.backendManagedActive || !!state?.backend?.backendProcessRunning;
        if (backendRunning) {
          vscode.postMessage({
            type: 'settingsAction',
            action: 'stopBackend',
          });
          return;
        }
        vscode.postMessage({
          type: 'settingsAction',
          action: 'startBackend',
        });
      });

      document.getElementById('settingOpenBackendWeb').addEventListener('click', () => {
        scheduleBackendSettingsSave(true);
        vscode.postMessage({
          type: 'settingsAction',
          action: 'openBackendWeb',
        });
      });

      document.getElementById('settingRootDir').addEventListener('input', () => {
        scheduleBackendSettingsSave(false);
      });
      document.getElementById('settingTokenFile').addEventListener('input', () => {
        scheduleBackendSettingsSave(false);
      });
      document.getElementById('settingQuickLoginUin').addEventListener('input', () => {
        scheduleBackendSettingsSave(false);
      });
      document.getElementById('settingHiddenPrivateIds').addEventListener('input', () => {
        scheduleHiddenSettingsSave(false);
      });
      document.getElementById('settingHiddenGroupIds').addEventListener('input', () => {
        scheduleHiddenSettingsSave(false);
      });

      document.getElementById('settingPreviewImages').addEventListener('change', (event) => {
        applyUiPref('previewImages', !!event.target.checked);
      });

      document.getElementById('settingPreviewVideos').addEventListener('change', (event) => {
        applyUiPref('previewVideos', !!event.target.checked);
      });

      document.getElementById('settingEnterToSend').addEventListener('change', (event) => {
        applyUiPref('enterToSend', !!event.target.checked);
      });

      document.getElementById('settingClearCache').addEventListener('click', () => {
        logWeb('info', 'clear cache clicked');
        vscode.postMessage({
          type: 'settingsAction',
          action: 'clearCache',
        });
      });
    }
  `;
}

module.exports = {
  renderSettingsScript,
};
