# NCat 前期验证（零基础可执行）

更新时间：2026-03-05

## 目标
在不写 VSCode 插件前，先验证两件事：
1. NCat 仍在维护并可连接。
2. 本地程序能收到 QQ 消息事件。

## 今天已核验的信息
1. QQ 机器人官方文档仍在维护，接入方式是机器人凭证（`appid + secret`）。
2. NCat 仓库仍在更新，`releases/latest` 显示最新版本为 `v4.17.25`（发布时间 2026-02-22）。

参考：
- https://bot.q.qq.com/wiki/
- https://bot.q.qq.com/wiki/business/
- https://github.com/NapNeko/NapCatQQ/releases/latest

## 步骤 0：本地环境检查
在当前目录执行：

```bash
npm run doctor
```

通过标准：输出 `Environment looks good`。

## 步骤 1：安装并登录 NCat（手工）
1. 到 `NapNeko/NapCatQQ` 的 release 页面下载最新稳定版。
2. 使用测试 QQ 小号登录（不要先用主号）。
3. 打开 NCat 管理界面。

通过标准：NCat 状态显示在线。

## 步骤 2：开启 OneBot WebSocket
在 NCat 网络配置里：
1. 启用 OneBot11 WebSocket 服务端（或 NCat 文档推荐的 WS 方式）。
2. 记录端口（示例 `3001`）。
3. 若启用了 token，也记录 token。

通过标准：NCat 面板显示 WS 服务已监听。

## 步骤 3：运行本地烟雾测试
### 无 token

```bash
NCAT_WS_URL='ws://127.0.0.1:3001' npm run smoke
```

### 有 token

```bash
NCAT_WS_URL='ws://127.0.0.1:3001' NCAT_TOKEN='你的token' npm run smoke
```

通过标准：终端出现类似输出：
- `Connected. Sending get_login_info...`
- `login_info ok: nickname=...`

## 步骤 4：消息联通验证
1. 用另一个 QQ 号给测试号发一条文本消息。
2. 看终端是否打印：

```text
[smoke] message from ...: 你好
```

通过标准：能稳定收到消息事件，至少连续 10 分钟不断线。

## 常见失败处理
1. `Connection closed`：先检查 WS 地址和端口是否一致。
2. 一连上就断：多半是 token 不匹配。
3. 一直连不上：NCat 未在线或 WS 服务未启动。

## 下一阶段（验证通过后）
1. 把这个脚本迁移到 VSCode 插件的 Extension Host 里。
2. 加一个命令：`NCat: Connect`。
3. 在 VSCode 状态栏显示“在线/离线 + 最近一条消息”。
