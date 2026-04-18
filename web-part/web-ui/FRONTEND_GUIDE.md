# Frontend Guide

## 1. 目标

本项目后续如果新增”智能机器人网页”或”3D 控制台网页”，前端默认遵循以下约束，避免技术栈来回切换、页面风格失控或重复造轮子。

## 2. 前端技术栈约定

### 2.1 3D 场景

- 3D 场景统一优先使用 `@react-three/fiber`
- 常用 3D 辅助能力优先使用 `@react-three/drei`
- 非必要不要直接用原生 `three.js` 手写整套场景
- 只有在 `react-three-fiber` 明显不适合时，才允许补充原生 `three.js`
- 后处理（Bloom/ToneMapping 等）按需引入 `@react-three/postprocessing`，当前未安装

### 2.2 普通页面 UI

- 普通控制面板、状态卡片、日志区、按钮区使用普通 React DOM
- 控制台视觉风格使用自定义 CSS 设计系统（暗色毛玻璃 + 新拟态），灵感来源于游戏 HUD
- 两色系统：`rgba(0,0,0,0.6)` 暗透明 + `rgb(234,234,239)` 浅灰白
- 动画使用 `framer-motion`
- 图标使用 `lucide-react`
- 多页面路由使用 `react-router-dom`

### 2.3 状态管理

- 全局状态优先使用 `zustand`
- 不要为简单状态引入过重状态管理方案

### 2.4 风格约束

- 自定义 CSS 用来做控制台框体、毛玻璃面板、新拟态阴影和交互外观
- 不直接照搬任何模板默认样式，要保留机器人控制台的信息密度和工程感
- 后处理只用于增强 3D 主视图区，不允许把实时状态信息做得难读
- 后处理默认轻量，优先可读性，再考虑氛围感

## 3. 当前前端结构

```text
app/src/
├─ app/
│  ├─ App.tsx              (路由壳)
│  ├─ pages/
│  │  ├─ HomePage.tsx      (视差首页)
│  │  ├─ MonitorPage.tsx   (监控室)
│  │  ├─ ChatPage.tsx      (对话页)
│  │  ├─ LoginPage.tsx     (登录/注册)
│  │  └─ AboutPage.tsx     (关于)
│  ├─ components/
│  │  ├─ Navbar.tsx        (顶部导航 + 汉堡菜单)
│  │  ├─ FootNav.tsx       (浮动按钮)
│  │  ├─ ChatHistory.tsx   (对话记录)
│  │  └─ ScenePanel.tsx    (3D 场景容器)
│  ├─ hooks/
│  │  ├─ useOpenClawStatus.ts
│  │  └─ useOpenClawChat.ts
│  ├─ types.ts
│  └─ constants.ts
├─ components/
│  └─ scene/
│     └─ RobotScene.tsx    (3D 机器人模型)
├─ stores/
│  └─ robotStore.ts        (zustand)
├─ lib/
│  └─ api/
│     ├─ endpoints.ts
│     └─ openclaw.ts
├─ styles/
│  ├─ index.css            (全局 + CSS 变量)
│  ├─ navbar.css
│  ├─ home.css
│  ├─ monitor.css
│  ├─ chat.css
│  ├─ login.css
│  └─ about.css
└─ types/
   └─ global.d.ts
```

## 4. 与现有机器人系统的边界

当前仓库中：

- STM32 电控在 `soft/car/`
- 鲁班猫/上位机网页检测与串口桥接在 `soft/sweep_bushu (2)(2)/`
- 训练与模型导出在 `sweep_server/`、`sweep_rknn/`

后续新增智能网页时，默认遵循：

- 不直接把网页逻辑塞进 STM32 工程
- 网页逻辑优先挂在上位机/鲁班猫层
- STM32 继续只负责底层执行
- 网页与后端只通过接口或串口桥接层交互

## 5. 页面设计原则

- 页面优先做成”机器人控制台”，不是普通官网
- 重点突出：
  - 实时状态
  - 控制入口
  - 3D 可视化
  - 视频/传感器/日志
- 风格要求：
  - 工程化
  - 稳定
  - 信息密度适中
  - 避免花哨但无信息量的装饰
  - 用毛玻璃 + 新拟态做有边界的科技感，而不是堆满荧光装饰

## 6. 当前页面路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | HomePage | 视差滚动首页，功能入口卡片，3D 翻转卡片，旋转环入口 |
| `/monitor` | MonitorPage | 侧边栏设备选择 + 摄像头图传 + 3D 机器人 + 状态表格 |
| `/chat` | ChatPage | OpenClaw 对话 + 快捷任务侧栏 |
| `/login` | LoginPage | 3D 翻转登录/注册表单 |
| `/about` | AboutPage | 项目介绍、技术栈、架构说明 |

## 7. 当前依赖

| 包 | 用途 |
|---|------|
| `react` / `react-dom` | UI 框架 |
| `react-router-dom` | 多页面路由 |
| `three` / `@react-three/fiber` / `@react-three/drei` | 3D 场景 |
| `zustand` | 状态管理 |
| `framer-motion` | 动画 |
| `lucide-react` | 图标 |

## 8. 一句话约定

**普通控制台 UI 用 React + 自定义暗色毛玻璃 CSS，3D 主视图区用 `react-three-fiber`，动画用 `framer-motion`，图标用 `lucide-react`，状态管理用 `zustand`，多页面用 `react-router-dom`，网页逻辑挂在上位机层，不直接侵入 STM32 固件层。**
