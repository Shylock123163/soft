# Image To 3D Integration

## 1. 当前结论

当前最适合你的接法是：

- 助手侧用 `Replicate MCP`
  - 方便让我或 Claude 帮你调模型、试工作流、查任务
- 项目侧用“你自己的后端接口”
  - 由后端去调第三方 3D 生成服务
  - 前端只跟你自己的接口通信

这两层不要混为一谈。

## 2. 两层分别起什么作用

### 2.1 MCP 层

MCP 的作用是：

- 让我帮你触发图转 3D
- 帮你检查生成结果
- 帮你整理生成流程
- 帮你调通网站接入方案

它更像“开发与调试工具层”。

### 2.2 项目运行层

你网页真正上线时，应该走你自己的服务：

```text
前端
    -> 你的后端
    -> Replicate / Meshy / Tripo
    -> 返回模型地址
    -> 前端显示 3D
```

它才是“生产运行层”。

## 3. 推荐系统结构

```text
web-ui/app
    -> 上传参考图
    -> 查询任务进度
    -> 预览 glb

sr 后端 / 新增资产服务
    -> 接收上传
    -> 保存原图
    -> 调第三方图片转 3D
    -> 保存返回的 glb / 预览图 / 元数据
    -> 对前端暴露统一接口

第三方 3D 服务
    -> 负责真正生成模型
```

## 4. 为什么不建议前端直连第三方

- token 会暴露
- 浏览器不适合管长任务
- 失败重试难做
- 模型文件缓存难做
- 后续更换供应商成本高

所以正确做法是：

- 前端不直接碰第三方密钥
- 前端只请求你自己的 `/api/assets/*`

## 5. 推荐接口约定

### 5.1 创建任务

`POST /api/assets/image-to-3d`

请求体建议：

```json
{
  "imageUrl": "/uploads/reference/butterfly-01.png",
  "name": "butterfly-body-test",
  "provider": "replicate",
  "options": {
    "style": "robot",
    "quality": "preview"
  }
}
```

返回建议：

```json
{
  "ok": true,
  "taskId": "task_20260418_001",
  "status": "queued"
}
```

### 5.2 查询任务

`GET /api/assets/tasks/:taskId`

返回建议：

```json
{
  "ok": true,
  "taskId": "task_20260418_001",
  "status": "processing",
  "progress": 56,
  "previewImage": null,
  "assetId": null
}
```

完成后：

```json
{
  "ok": true,
  "taskId": "task_20260418_001",
  "status": "succeeded",
  "progress": 100,
  "previewImage": "/assets/previews/butterfly-01.jpg",
  "assetId": "asset_butterfly_01"
}
```

### 5.3 获取模型信息

`GET /api/assets/models/:assetId`

返回建议：

```json
{
  "ok": true,
  "assetId": "asset_butterfly_01",
  "name": "butterfly-body-test",
  "modelUrl": "/assets/models/butterfly-01.glb",
  "previewImage": "/assets/previews/butterfly-01.jpg",
  "sourceImage": "/uploads/reference/butterfly-01.png",
  "provider": "replicate"
}
```

## 6. 前端落地方式

### 6.1 页面结构

建议在后续控制台里加一个独立区域：

- 上传图
- 生成按钮
- 当前任务状态
- 模型预览
- 载入场景按钮

### 6.2 3D 区职责

前端 3D 区只做：

- 加载 `glb`
- 模型旋转/缩放/居中
- 光照与阴影基础预览
- 切换当前机器人模型或场景模型
- 适度后处理增强，例如 `Bloom`、`ToneMapping`、`Vignette`

不要在第一版就做：

- 网页内复杂建模
- 顶点编辑
- 骨骼编辑
- 大型材质系统

## 7. 和当前 `sr` 项目的关系

它和当前控制链路的关系应该是：

- 控制链路
  - 实时、稳定、低延迟
- 资产链路
  - 异步、可缓存、可慢一点

图片转 3D 明显属于第二类。

所以后续即便 3D 生成功能出问题，也不应影响：

- 视频监控
- 机器人控制
- 状态展示
- 串口通信

## 8. 当前最合理的下一步

现在最合理的推进顺序是：

1. 先建立 `web-ui/app` 真正主工程
2. 先把控制台壳子和开屏跑起来
3. 预留 `Assets` 页面
4. 再补 `image-to-3d` 后端接口
5. 最后把 `glb` 加载到 `react-three-fiber` 场景里

## 9. 一句话方案

**Replicate MCP 用来辅助开发和调试，网站正式运行时走你自己的后端资产接口；图片转 3D 属于“资产生成链路”，应该挂到控制台里，但不应侵入机器人实时控制链路，界面风格层优先 `Arwes`，3D 预览增强优先 `@react-three/postprocessing`。**
