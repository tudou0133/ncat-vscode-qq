# NCat 安装与登录（Windows 一键包，手把手）

更新时间：2026-03-05

适用人群：第一次接触 NCat、第一次做 QQ 机器人联调。

## 先说结论（今天可直接做）
1. 先走 Windows 一键包（`NapCat.Shell.Windows.OneKey.zip`），它对新手最省事。
2. 用 QQ 小号先登录跑通，不要先用主号。
3. 先让 WebUI 打开并拿到 token，再开 OneBot 的 WS 服务端。
4. 最后用本项目的 `npm run smoke` 做连通性验证。

## 第 0 步：准备
1. 你需要一台 Windows 电脑（你当前是 WSL 开发环境，NCat 本体请在 Windows 里运行）。
2. 准备一个测试 QQ 号（建议新号或小号）。
3. 保证网络能访问 GitHub releases 页面。

成功标志：你可以在 Windows 浏览器里打开 NCat release 页面。

## 第 1 步：下载一键包
1. 打开：`https://github.com/NapNeko/NapCatQQ/releases/latest`
2. 在 Assets 里下载：`NapCat.Shell.Windows.OneKey.zip`
3. 解压到一个纯英文路径，比如：`D:\NCat`（避免中文/空格路径引发兼容问题）。

成功标志：解压后能看到 `NapCatInstaller.exe`。

## 第 2 步：安装一键包
1. 双击运行 `NapCatInstaller.exe`。
2. 等待自动化配置完成。
3. 完成后进入生成的 `NCat.XXXX.Shell` 目录。
4. 双击 `napcat.bat` 启动。

成功标志：弹出控制台窗口，持续输出 NCat 启动日志，没有立刻闪退。

## 第 3 步：登录 QQ（关键）
1. 打开日志中显示的 WebUI 地址（默认常见是 `http://127.0.0.1:6099/webui?token=xxxx`）。
2. 进入 QQ 登录页面后，选择 `QRCode` 扫码登录。
3. 登录后 token 会刷新：
   - 到 NCat 控制台日志里看新 token；或
   - 到该 QQ 号“自己给自己”的私聊消息里看 token。
4. 用新 token 再次进入 WebUI。
5. 首次登录后按提示修改密码（不改会限制功能）。

成功标志：进入 WebUI 后台页面，可看到“网络配置”等菜单。

## 第 4 步：配置 OneBot WebSocket 服务端
1. 在 WebUI 打开“网络配置”。
2. 点击“新建”。
3. 选择 `WebSocket 服务端`（正向 WS）。
4. 建议参数：
   - `host`: `127.0.0.1`（只本机访问更安全）
   - `port`: `3001`
   - `token`: 先设一个简单测试值，例如 `test1234`
   - 勾选“保存时启用”
5. 保存。

成功标志：配置列表里该 WS 项目状态为“已启用”。

## 第 5 步：回到当前项目做连通测试
在当前项目目录（WSL 终端）执行：

```bash
cd /mnt/d/work/my_python_project_test/vscode_extension/NCatVSC
NCAT_WS_URL='ws://127.0.0.1:3001' NCAT_TOKEN='test1234' npm run smoke
```

成功标志：终端出现：
- `Connected. Sending get_login_info...`
- `login_info ok: nickname=..., user_id=...`

再让另一个 QQ 号发你一条消息，终端会看到：

```text
[smoke] message from ...: 你好
```

## 常见问题排查
1. 一连上就断开：
   - 90% 是 `NCAT_TOKEN` 与 WebUI 里配置的不一致。
2. 根本连不上（ECONNREFUSED）：
   - NCat 没启动，或 WS 端口不是 `3001`。
3. WebUI 打不开：
   - 看启动日志中的实际端口，默认 6099 端口被占用时会自动 +1。
4. 扫码后频繁掉线：
   - 换测试号，避免与常用号在同设备/同 IP 混用。

## 我们下一步会做什么
当你完成上面 5 步并拿到 smoke 成功日志后，我会带你做：
1. 初始化 VSCode 插件工程；
2. 在插件里接入这个 WS；
3. 在状态栏显示在线状态和最近一条消息。
