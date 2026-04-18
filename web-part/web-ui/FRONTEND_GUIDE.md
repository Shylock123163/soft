# Frontend Guide

## 1. 目标

本项目后续如果新增“智能机器人网页”或“3D 控制台网页”，前端默认遵循以下约束，避免技术栈来回切换、页面风格失控或重复造轮子。

## 2. 前端技术栈约定

### 2.1 3D 场景

- 3D 场景统一优先使用 `@react-three/fiber`
- 常用 3D 辅助能力优先使用 `@react-three/drei`
- 3D 后处理默认使用 `@react-three/postprocessing`
- 非必要不要直接用原生 `three.js` 手写整套场景
- 只有在 `react-three-fiber` 明显不适合时，才允许补充原生 `three.js`

### 2.2 普通页面 UI

- 普通控制面板、状态卡片、日志区、按钮区使用普通 React DOM
- 控制台视觉壳层默认优先使用 `Arwes`
- 不要把整页控制台都做成纯 3D UI
- 页面结构优先采用：
  - 状态栏
  - 控制面板
  - 3D 主视图区
  - 日志/传感器信息区

### 2.3 状态管理

- 全局状态优先使用 `zustand`
- 不要为简单状态引入过重状态管理方案

### 2.4 调试工具

- 参数调试优先考虑 `leva`
- 常见 3D 相机、灯光、轨道控制、网格、加载器优先从 `@react-three/drei` 中选
- 常见发光、景深、Bloom、Noise、Vignette、色调映射等视觉增强优先从 `@react-three/postprocessing` 中选

### 2.5 风格约束

- `Arwes` 用来做控制台框体、HUD、扫描线、科技感排版和交互外观
- 不直接照搬 `Arwes` 默认模板，要保留机器人控制台的信息密度和工程感
- `@react-three/postprocessing` 只用于增强 3D 主视图区，不允许把实时状态信息做得难读
- 后处理默认轻量，优先可读性，再考虑氛围感

## 3. 推荐前端结构

如果单独新建机器人网页前端，推荐结构如下：

```text
frontend/
├─ src/
│  ├─ app/
│  ├─ components/
│  │  ├─ layout/
│  │  ├─ control/
│  │  ├─ status/
│  │  ├─ hud/
│  │  └─ scene/
│  ├─ stores/
│  ├─ lib/
│  │  ├─ arwes/
│  │  └─ postprocessing/
│  ├─ hooks/
│  └─ types/
```

其中：

- `components/scene/`
  - 放 `react-three-fiber` 相关场景组件
- `components/control/`
  - 放按钮、参数控制、模式切换
- `components/status/`
  - 放传感器、串口、日志、任务状态
- `components/hud/`
  - 放 `Arwes` 风格的面板壳、标题条、边框、提示组件
- `stores/`
  - 放 `zustand` 状态
- `lib/postprocessing/`
  - 放 3D 后处理组合与效果预设

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

- 页面优先做成“机器人控制台”，不是普通官网
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
  - 用 `Arwes` 做有边界的科技感，而不是堆满荧光装饰

## 6. 推荐默认页面布局

推荐默认布局：

```text
Header
├─ 设备在线状态
├─ 当前模式
└─ 急停 / 启停

Left Panel
├─ 手动控制
├─ 参数调整
└─ 模式切换

Center
└─ 3D 场景（react-three-fiber）

Right Panel
├─ 传感器状态
├─ 串口状态
└─ AI/视觉判断结果

Bottom
└─ 日志 / 最近动作 / 调试信息
```

## 7. 默认开发原则

- 优先复用成熟开源 UI 壳子，不盲目从零写页面
- 3D 相关统一走 `react-three-fiber`
- 控制台壳层默认优先 `Arwes`
- 3D 视觉增强默认优先 `@react-three/postprocessing`
- 业务 UI 保持普通 React 组件化开发
- 后端接口先稳定，再叠加视觉效果
- 不为了“炫”而牺牲控制台可读性

## 8. 协作说明

如果后续由 AI 助手继续开发前端，默认按本文件执行：

- 优先使用 `@react-three/fiber`
- 优先使用 `Arwes` 做控制台风格层
- 优先使用 `@react-three/postprocessing` 做 3D 效果层
- 不擅自切换到其他 3D 主方案
- 不把全页面都做成三维交互
- 先保证控制台可用，再做视觉增强

## 9. 一句话约定

本项目的机器人网页前端默认策略是：

**普通控制台 UI 用 React + `Arwes`，3D 主视图区用 `react-three-fiber`，视觉增强优先 `@react-three/postprocessing`，状态管理优先 `zustand`，网页逻辑挂在上位机层，不直接侵入 STM32 固件层。**
