# 第一次运行 VSCode 插件（NCat 版）

更新时间：2026-03-05

## 你现在已有的内容
1. `scripts/napcat-smoke.mjs`：终端联通验证脚本（你已跑通）。
2. `extension.cjs`：VSCode 插件主程序。
3. `package.json`：已加入 VSCode 插件清单和命令。
4. `.vscode/launch.json`：按 F5 可直接启动扩展开发宿主。

## 第 1 步：安装依赖
在项目根目录执行：

```powershell
npm install
```

成功标志：生成 `node_modules`，且无报错。

## 第 2 步：在 VSCode 打开项目
确保打开目录：
`D:\work\my_python_project_test\vscode_extension\NCatVSC`

## 第 3 步：配置插件参数
打开 VSCode 设置（`Ctrl+,`），搜索 `ncat`，设置：
1. `Napcat: Ws Url` = `ws://127.0.0.1:3001`
2. `Napcat: Token` 为空（推荐）
3. `Napcat: Token Env Var` = `NCAT_TOKEN`
4. `Napcat: Auto Connect` = `true`
5. `Napcat: Auto Reconnect` = `true`

然后在启动 VSCode 前设置环境变量（PowerShell）：

```powershell
$env:NCAT_TOKEN="你的网络配置token"
code .
```

## 第 4 步：启动扩展开发宿主
1. 在 VSCode 按 `F5`。
2. 会弹出第二个 VSCode 窗口（Extension Development Host）。

成功标志：
- 左下角状态栏出现 `NCat` 状态文字；
- 初始会显示 `Connecting`，成功后显示昵称或在线状态；
- 左侧 Activity Bar 出现 `NCat` 图标。

## 第 5 步：查看左侧会话瀑布流
1. 点击左侧 `NCat` 图标。
2. 打开 `Chats` 视图，一级页面会全屏显示会话卡片（昵称/群名 + 最新消息预览，新的在上面）。
3. 点击任一卡片，会进入二级页面覆盖一级页面；点顶部 `返回` 回到一级页面。
4. 二级页面消息按时间流展示，最新消息在最下面。
5. 图片消息默认只显示 `图片（悬停预览）`，鼠标悬停时向上弹出预览，避免遮挡下方内容。
6. 二级页面底部可直接输入并发送消息：`Enter` 发送，`Shift+Enter` 换行。
7. 重新打开扩展时会恢复本地缓存，并尝试回填最近一天历史消息。
8. `@` 与 `回复` 段会优先显示昵称（失败时回退 QQ 号），并单独高亮显示。
9. 二级页滚动可手动上拉查看历史，不会被频繁强制回到底部；拉到顶部会自动尝试加载更早消息。

## 第 6 步：手工触发连接/断开/发送
在第二个窗口按 `Ctrl+Shift+P`，运行：
1. `NCat: Connect`
2. `NCat: Disconnect`
3. `NCat: Send Private Message`（输入 QQ 号和消息，直接发送）
4. `NCat: Send Group Message`（输入群号和消息，直接发送）
5. `NCat: Show Logs`（打开输出日志面板，定位连接/发送问题）

## 你应看到的现象
1. 连接后状态栏从 Offline -> Connected -> 你的昵称。
2. 收到消息后，NCat 侧栏会话卡片自动更新预览与未读数。
3. 点击会话后，消息流里可看到文字逐条展示，图片悬停预览。

## 常见问题
1. 只显示 Error：
   - 检查 `Ws Url` 和 `Token` 是否与 NCat WebUI 一致。
2. F5 后没有第二个窗口：
   - 确认打开的是本项目根目录，并且有 `.vscode/launch.json`。
3. 第二窗口在线但无消息：
   - 先用另一个 QQ 号发一条纯文本消息测试。
