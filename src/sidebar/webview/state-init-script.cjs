function renderStateInitScript() {
  return `
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
      jumpTargetMessageId: '',
      jumpTargetLabel: '',
    };
    let forwardPreview = {
      open: false,
      loading: false,
      forwardId: '',
      title: '合并转发',
      nodes: [],
      error: '',
    };
    let messageForwardPicker = {
      open: false,
      query: '',
      summary: '',
      draft: null,
      sendingChatId: '',
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
    const mediaNoRetryRawMessageIds = new Set();
    const SHOW_INVITE_OPEN_ACTION = false;
    let jumpHighlightState = {
      messageId: '',
      rawMessageId: '',
      until: 0,
      clearTimer: null,
    };
`;
}

module.exports = {
  renderStateInitScript,
};
