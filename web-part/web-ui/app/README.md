# Smart Gathering Robot Web

## 当前状态

这是 `sr/web-ui` 下的第一版主前端骨架。

定位不是官网，而是：

- OpenClaw 上层任务入口
- 机器人状态台
- 3D 主视图区
- 调试与比赛演示页面

## 当前技术栈

- React
- TypeScript
- Vite
- `@arwes/react`
- `@react-three/fiber`
- `@react-three/drei`
- `@react-three/postprocessing`
- `zustand`

上层部署结构与 `C:\Users\zbl\Desktop\robot_web` 对齐：

- VPS 托管前端静态产物
- VPS 托管 webhook / OpenClaw 轻后端
- Cloudflare Worker + R2 托管资产文件

## 入口文件

- `src/app/App.tsx`
- `src/components/scene/RobotScene.tsx`
- `src/stores/robotStore.ts`

## 本地运行

```bash
npm install
npm run dev
```

## 上层目录配套

在 `web-ui/` 根目录还补了：

- `package.json`
- `webhook.js`
- `wrangler.toml`
- `workers/r2-assets.js`
- `DEPLOYMENT_ARCHITECTURE.md`

这部分用于和之前蝴蝶网页保持一致的部署方式。

## 当前已落地内容

- 首页主视觉直接使用 `public/robot.jpg`
- OpenClaw 任务输入区
- 决策解释区
- 设备状态区
- 日志区
- 一个简化的机器人 3D 主视图区

## 下一步

1. 安装依赖并跑通 Vite。
2. 把静态状态替换成真实后端接口。
3. 把 OpenClaw 对话/任务接口接进任务输入区。
4. 再做开屏模块与主控制台切换。
