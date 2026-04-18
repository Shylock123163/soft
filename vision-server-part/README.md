# 鲁班猫与服务器视觉部分

这个目录现在按职责拆成 4 块：

- `deploy/`
  - 鲁班猫端运行与上线部署
- `training/`
  - 训练服务器、数据集、导出包
- `data-collection/`
  - 数据采集网页与采集脚本
- `model-export/`
  - `pt -> RKNN` 转换与鲁班猫端推理脚本

## 具体入口

- `deploy/lubancat-deploy/`
  - 鲁班猫网页检测、串口下发、自启动脚本
- `training/sweep_server/`
  - 训练服务器代码、数据集、上传包、模型文件
- `data-collection/clutter-classification/`
  - 杂物分类采集
- `data-collection/wall-line-distance/`
  - 墙边距离采集
- `model-export/sweep_rknn/`
  - RKNN 导出与推理脚本

推荐先看：

1. `deploy/lubancat-deploy/README.md`
2. `training/sweep_server/README.md`
3. `training/sweep_server/source/docs/STEPS.md`
