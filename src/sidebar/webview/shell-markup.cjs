function renderShellMarkup() {
  return `
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
  <div id="forwardPickerOverlay" class="forward-overlay" aria-hidden="true">
    <div class="forward-panel">
      <div class="forward-topbar">
        <div id="forwardPickerTitle" class="forward-title">转发到</div>
        <button id="btnCloseForwardPicker" type="button">关闭</button>
      </div>
      <div class="forward-picker-head">
        <div id="forwardPickerSummary" class="forward-picker-summary"></div>
        <input id="forwardPickerSearch" class="forward-picker-search" type="text" placeholder="搜索会话名 / 群号 / QQ号" />
      </div>
      <div id="forwardPickerList" class="forward-target-list"></div>
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
    <button id="bubbleMenuReply" class="bubble-menu-item" type="button">回复</button>
    <button id="bubbleMenuJump" class="bubble-menu-item" type="button" hidden>跳转到</button>
    <button id="bubbleMenuForward" class="bubble-menu-item" type="button">转发</button>
    <button id="bubbleMenuDownload" class="bubble-menu-item" type="button" hidden>下载</button>
    <button id="bubbleMenuCopy" class="bubble-menu-item" type="button">复制</button>
    <button id="bubbleMenuCopyRaw" class="bubble-menu-item" type="button">复制JSON</button>
    <button id="bubbleMenuRecall" class="bubble-menu-item" type="button" hidden>撤回</button>
    <button id="bubbleMenuSaveSticker" class="bubble-menu-item" type="button">添加到表情包</button>
    <button id="bubbleMenuPlusOne" class="bubble-menu-item" type="button">+1</button>
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
          <div class="settings-action-grid">
            <button id="settingOpenLogs" class="settings-action" type="button">打开日志</button>
            <button id="settingOpenDownloads" class="settings-action" type="button">打开下载文件夹</button>
            <button id="settingOpenExt" class="settings-action" type="button">打开扩展设置</button>
            <button id="settingOpenNapcatReleases" class="settings-action" type="button">打开NCat发布页面</button>
          </div>
        </div>
        <div class="settings-group">
          <div class="settings-group-title">NCat 后端</div>
          <input id="settingRootDir" class="settings-input" type="text" placeholder="NCat 根目录（例如 D:\\NCat）" />
          <input id="settingTokenFile" class="settings-input" type="text" placeholder="Token 文件（可选，支持相对根目录）" />
          <input id="settingQuickLoginUin" class="settings-input" type="text" placeholder="快速登录 QQ 号（可选，如 2580453344）" />
          <label class="settings-toggle"><input id="settingRawWsLogEnabled" type="checkbox" /> 原始 WS 日志（调试用）</label>
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

`;
}

module.exports = {
  renderShellMarkup,
};
