# `sr` 项目现状与智能网页接入总结

## 1. 仓库大致结构

当前 `sr` 不是单一工程，而是一个"机器人控制 + 视觉采集/训练 + 鲁班猫部署 + 网页前端"的组合仓库：

- `soft/car/`
  - STM32 小车/机器人底层电控工程
  - 负责电机、舵机、串口、FreeRTOS 状态机等
- `soft/sweep_bushu (2)(2)/`
  - 鲁班猫部署包
  - 已经具备"网页实时检测 + 串口发给 STM32"的完整链路
- `web-part/web-ui/`
  - 独立网页前端工作区
  - React 18 + Vite 5 + TypeScript 多页面控制台
  - OpenClaw 轻后端 + webhook + Cloudflare Worker
- `sweep_server/`
  - 训练服务器上传包
- `sweep_rknn/`
  - `pt -> RKNN` 导出与鲁班猫端 RKNN 网页检测
- `sweep_cat/`
  - 杂物分类数据采集工程
- `wall_line_cat/`
  - 墙地交界线距离分类数据采集工程

## 2. 当前网页前端（web-part/web-ui/app）

### 2.1 技术栈

| 包 | 用途 |
|---|------|
| `react` / `react-dom` | UI 框架 |
| `react-router-dom` | 多页面路由（basename="/sr"） |
| `three` / `@react-three/fiber` / `@react-three/drei` | 3D 场景 |
| `zustand` | 状态管理 |
| `framer-motion` | 动画 |
| `lucide-react` | 图标 |

### 2.2 页面路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | HomePage | 视差滚动首页，功能入口卡片，3D 翻转卡片，旋转环入口 |
| `/monitor` | MonitorPage | 侧边栏设备选择 + 摄像头图传 + 3D 机器人 + 状态表格 |
| `/chat` | ChatPage | OpenClaw 对话 + 快捷任务侧栏 |
| `/login` | LoginPage | 3D 翻转登录/注册表单 |
| `/about` | AboutPage | 项目介绍、技术栈、架构说明 |

### 2.3 视觉风格

- 暗色毛玻璃 + 新拟态（灵感来源于游戏 HUD）
- 两色系统：`rgba(0,0,0,0.6)` 暗透明 + `rgb(234,234,239)` 浅灰白
- `backdrop-filter: blur(8px) saturate(160%)`
- 统一圆角 `10px`、新拟态 `box-shadow` 组合
- 视差滚动背景、3D 翻转卡片、汉堡菜单侧边栏

### 2.4 目录结构

```text
app/src/
├─ app/
│  ├─ App.tsx              (路由壳)
│  ├─ pages/               (5 个页面组件)
│  ├─ components/          (Navbar, FootNav, ChatHistory, ScenePanel)
│  ├─ hooks/               (useOpenClawStatus, useOpenClawChat)
│  ├─ types.ts
│  └─ constants.ts
├─ components/scene/       (RobotScene 3D 模型)
├─ stores/                 (zustand robotStore)
├─ lib/api/                (endpoints, openclaw)
├─ styles/                 (index/navbar/home/monitor/chat/login/about.css)
└─ types/                  (global.d.ts)
```

## 3. 后端服务

### 3.1 OpenClaw 轻后端

- 文件：`openclaw-server.js`
- 端口：`127.0.0.1:9012`
- 职责：任务理解、NLP 意图检测、设备命令队列
- 接口：`/api/openclaw/status`、`/chat`、`/recommend`、`/execute`、`/session/reset`、`/device/*`

### 3.2 Webhook 自动部署

- 文件：`webhook.js`
- 端口：`127.0.0.1:9010`
- 路径：`/sr-webhook`

### 3.3 Cloudflare Worker + R2

- 文件：`workers/r2-assets.js`
- 配置：`wrangler.toml`
- 职责：图片/视频/模型等资产文件 API

## 4. 当前机器人链路

```text
摄像头 / 鲁班猫视觉
    -> Python 检测程序（deploy_web_detect.py）
    -> 串口协议 $SWEEP,...
    -> STM32 USART3
    -> 电控状态机执行

网页前端
    -> OpenClaw 后端（任务理解/策略生成）
    -> 命令队列
    -> 设备轮询执行
```

## 5. 部署架构

```text
浏览器
    -> VPS nginx
        -> /            旧蝴蝶网页
        -> /sr/         新智能巡拢家居机器人网页（app/dist）
        -> /api/sr/openclaw/*    新项目 OpenClaw
        -> /sr-webhook           新项目 webhook

浏览器 / OpenClaw
    -> Cloudflare Worker -> R2 资产桶
```

## 6. 当前进度

- ✅ 前端主工程建立（React + Vite + TypeScript）
- ✅ 5 页面路由架构完成
- ✅ 3D 机器人场景
- ✅ OpenClaw 对话接口对接
- ✅ 监控室（设备选择 + 摄像头图传 + 状态表格）
- ✅ OpenClaw 轻后端 + webhook + Worker
- 待做：接入真实视频流（当前用占位视频）
- 待做：接入真实设备状态
- 待做：开屏动画模块
- 待做：图片转 3D 资产链路

## 7. 一句话结论

**`web-part/web-ui/` 已经是一套完整的 React 多页面机器人控制台，具备 3D 可视化、OpenClaw 对话、设备监控、摄像头图传等核心功能；下一步重点是接入真实后端数据源和完善资产链路。**
