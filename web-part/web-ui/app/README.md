# Smart Gathering Robot Web

## 当前状态

`sr/web-part/web-ui/app` — 智能巡拢家居机器人前端主工程。

定位不是官网，而是：

- OpenClaw 上层任务入口
- 机器人状态监控台
- 3D 主视图区
- 调试与比赛演示页面

## 技术栈

- React 18 + TypeScript + Vite 5
- `react-router-dom`（多页面路由，basename="/sr"）
- `@react-three/fiber` + `@react-three/drei`（3D 场景）
- `zustand`（状态管理）
- `framer-motion`（动画）
- `lucide-react`（图标）

## 页面路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | HomePage | 视差滚动首页 |
| `/monitor` | MonitorPage | 设备监控 + 摄像头 + 3D |
| `/chat` | ChatPage | OpenClaw 对话 |
| `/login` | LoginPage | 登录/注册 |
| `/about` | AboutPage | 项目介绍 |

## 本地运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

产物输出到 `dist/`，部署到 VPS nginx `/sr/` 路径。

## 上层目录配套

在 `web-ui/` 根目录：

- `openclaw-server.js` — OpenClaw 轻后端（端口 9012）
- `webhook.js` — GitHub webhook 自动部署（端口 9010）
- `workers/r2-assets.js` — Cloudflare Worker 资产 API
- `wrangler.toml` — Worker 配置
- `pm2.ecosystem.config.cjs` — PM2 进程管理
