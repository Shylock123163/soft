# Smart Robot OpenClaw Backend

这套网页现在使用独立的 `OpenClaw` 轻后端：

- 文件：`openclaw-server.js`
- 默认监听：`127.0.0.1:9012`
- 对外 nginx 路径：`/api/sr/openclaw/`

## 已提供接口

- `GET /api/openclaw/status`
- `POST /api/openclaw/chat`
- `POST /api/openclaw/recommend`
- `POST /api/openclaw/execute`
- `POST /api/openclaw/session/reset`
- `POST /api/openclaw/device/telemetry`
- `GET /api/openclaw/device/next`
- `GET /api/openclaw/device/status`

前端当前使用的接口：`/status` 和 `/chat`（通过 `app/src/lib/api/openclaw.ts`）。

## 默认定位

它不再是蝴蝶调参后端，而是：

- 智能巡拢家居机器人的任务理解层
- 寻物 / 推拢 / 夹取 / 退出 / 回到用户的高层策略层
- 设备命令队列与设备状态汇总层

## 内置 NLP 常量

服务端内置了基于正则的意图检测，包含以下硬编码列表：

- `TARGETS`：遥控器、钥匙、拖鞋、玩具、袜子、充电器、笔、硬币等
- `ZONES`：沙发底、床底、柜底、桌底、墙角等
- `RETURNS`：用户脚边、充电桩、回收区、原位等

## 会话管理

- 会话 TTL：12 小时（`SESSION_TTL_MS`）
- 内存存储，重启后丢失
- `pruneSessions()` 在每次请求时清理过期会话

## 当前命令风格

后端现在先输出高层命令预览，方便网页链路和设备端解耦推进，例如：

```text
MODE AUTO
TASK SEARCH
ZONE sofa_under
TARGET 遥控器
TASK GRAB
TASK EXIT
TASK RETURN user_feet
```

## 启动方式

```bash
cd /home/deploy/sr/web-part/web-ui
node openclaw-server.js
```

或：

```bash
pm2 start openclaw-server.js --name sr-openclaw
```

## 关键环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OPENCLAW_PORT` | `9012` | 监听端口 |
| `OPENCLAW_PROVIDER` | `openai` | 上游 AI 提供商 |
| `OPENCLAW_ENDPOINT` | `https://api.openai.com/v1` | 上游 API 地址 |
| `OPENCLAW_MODEL` | `gpt-5.4` | 上游模型 |
| `OPENCLAW_API_KEY` | - | 上游 API 密钥 |
| `OPENCLAW_EXECUTOR_MODE` | `queue` | 执行模式 |
| `OPENCLAW_DEFAULT_CHAT_MODE` | `assistant` | 默认对话模式（assistant/control） |
| `OPENCLAW_AUTO_EXECUTE` | `true` | 是否自动下发命令到设备队列 |
| `OPENCLAW_DEVICE_ID` | `sr-robot-01` | 设备标识 |
| `OPENCLAW_DEVICE_TOKEN` | - | 设备轮询鉴权 token |
| `DEVICE_API_URL` | - | 外部设备 API 地址 |
| `DEVICE_API_TOKEN` | - | 外部设备 API 鉴权 |

完整示例见：`server.env.example`

## 当前设备执行模式

默认是 `queue`：

```text
网页 -> sr-openclaw -> 命令队列 -> 设备轮询 next -> 本地执行
```

这样先把网页和 OpenClaw 服务搭稳，不依赖你当前设备端已经完全打通。
