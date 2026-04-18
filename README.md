# 智能巡拢家居机器人仓库

这个仓库现在按 3 条主线整理：

- `stm32-part/`
  - 下位机电控、传感器、串口与状态机
- `vision-server-part/`
  - 鲁班猫部署、服务器训练、RKNN 导出、数据采集
- `web-part/`
  - 网页前端、Cloudflare Worker、Webhook、部署文档

补充资料放在 `docs/`：

- `docs/第一版.pdf`
- `docs/VL53L0X_NOTES.txt`
- `docs/CLAUDE_TEMPLATE.md`

## 目录入口

### 1. STM32 部分

主目录：

- `stm32-part/car/`

职责：

- 电机/舵机控制
- 传感器读取
- 串口协议对接视觉端
- 机器人底层状态机

### 2. 鲁班猫与服务器视觉部分

主目录：

- `vision-server-part/deploy/lubancat-deploy/`
- `vision-server-part/training/sweep_server/`
- `vision-server-part/model-export/sweep_rknn/`
- `vision-server-part/data-collection/clutter-classification/`
- `vision-server-part/data-collection/wall-line-distance/`

职责：

- 鲁班猫网页检测与串口下发
- 训练服务器数据集整理、训练、导出
- `pt -> RKNN` 模型转换
- 杂物分类与墙边距离数据采集

### 3. 网页部分

主目录：

- `web-part/web-ui/`

职责：

- 机器人网页展示与交互
- 3D/开屏/控制台前端
- Cloudflare Worker 文件上传接口
- GitHub Webhook 自动部署

## 当前推荐阅读顺序

1. `web-part/web-ui/WEB_UI_SUMMARY.md`
2. `vision-server-part/deploy/lubancat-deploy/README.md`
3. `vision-server-part/training/sweep_server/README.md`
4. `vision-server-part/training/sweep_server/source/docs/STEPS.md`
5. `stm32-part/car/VISION_SERIAL_INTEGRATION.md`
