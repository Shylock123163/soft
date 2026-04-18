# Deployment Architecture

## 当前目标

`sr/web-ui` 这套网页，部署架构直接对齐你之前的 `robot_web`：

- `VPS`
  - 托管网页静态产物
  - 托管轻量后端与 `OpenClaw` 服务
  - 托管 GitHub webhook 自动更新
- `Cloudflare Worker + R2`
  - 托管图片、视频、模型等资产文件 API
- `外部模型 API`
  - 托管 AI 推理，不把大模型放在 VPS 本机

## 推荐实际分层

```text
浏览器
    -> VPS nginx
        -> /            旧蝴蝶网页
        -> /sr/         新智能巡拢家居机器人网页
        -> /api/openclaw/*    旧项目 OpenClaw
        -> /api/sr/openclaw/* 新项目 OpenClaw
        -> /sr-webhook        新项目 webhook

浏览器 / OpenClaw
    -> Cloudflare Worker
        -> R2 资产桶
```

## 对应目录

- 前端主工程
  - `web-ui/app/`
- VPS 自动更新服务
  - `web-ui/webhook.js`
- OpenClaw 任务后端
  - `web-ui/openclaw-server.js`
- Cloudflare Worker / R2
  - `web-ui/workers/r2-assets.js`
  - `web-ui/wrangler.toml`

## 和 robot_web 的一致点

这套结构和你之前蝴蝶网页保持一致：

1. 网页主站放 VPS
2. webhook 放 VPS
3. 资产文件不压 VPS 磁盘，走 R2
4. Worker 作为文件 API 中转层
5. `OpenClaw` 走 VPS 轻后端，不在本机跑大模型

## 和 robot_web 的不同点

这次为了避免冲突，`sr` 项目单独拆了自己的路径和端口：

- 新 OpenClaw 服务
  - `127.0.0.1:9012`
- 新 webhook 服务
  - `127.0.0.1:9010`
- 新 webhook 路径
  - `/sr-webhook`

## 推荐脚本

在 `web-ui/app/` 下：

```bash
npm run dev       # 本地开发
npm run build     # 生产构建
npm run preview   # 预览构建产物
```

在 `web-ui/` 下：

```bash
node openclaw-server.js                          # 启动 OpenClaw 后端
node webhook.js                                  # 启动 webhook
npx wrangler deploy --config wrangler.toml       # 部署 Cloudflare Worker
```

或通过 PM2：

```bash
pm2 start pm2.ecosystem.config.cjs
```

## 建议 nginx 路由

### 旧站

- `/`
  - 保留给之前蝴蝶网页

### 新站

- `/sr/`
  - 指向 `web-ui/app/dist`

### OpenClaw 接口

- `/api/openclaw/`
  - 旧项目接口
- `/api/sr/openclaw/`
  - 新项目接口
  - 反向代理到新项目自己的 `sr-openclaw`

### webhook

- `/sr-webhook`
  - 反向代理到 `web-ui/webhook.js`

## 一句话结论

**这套网页后续按 `robot_web` 同款结构推进，但通过 nginx 路径拆分避免与旧站冲突：旧站继续占 `/`，新站挂到 `/sr/`，接口走 `/api/sr/openclaw/`，自动部署走 `/sr-webhook`，VPS 负责网页和轻后端，Cloudflare Worker + R2 负责资产文件。**
