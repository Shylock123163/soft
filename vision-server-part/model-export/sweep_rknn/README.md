# Sweep RKNN

这个文件夹专门放:

- `best.pt -> RKNN` 导出
- 鲁班猫端 `RKNN` 网页实时检测

## 目录

```text
sweep_rknn/
├─ export_to_rknn.py
├─ lubancat_rknn_web_detect.py
├─ start_rknn_detect.sh
├─ requirements_pc.txt
├─ requirements_lubancat.txt
└─ models/
   ├─ .gitkeep
   ├─ best.pt
   └─ best_rknn_model/
```

## 1. PC / 服务器端导出 RKNN

先把训练好的模型放到:

```text
models/best.pt
```

导出:

```bash
python export_to_rknn.py --weights models/best.pt --target rk3588 --imgsz 224
```

导出成功后会得到类似:

```text
models/best_rknn_model/
```

## 2. 鲁班猫端运行 RKNN 检测

把整个 `sweep_rknn` 文件夹传到鲁班猫，例如:

```text
/home/cat/sweep_rknn
```

安装依赖:

```bash
cd /home/cat/sweep_rknn
python3 -m pip install -r requirements_lubancat.txt
```

启动:

```bash
bash start_rknn_detect.sh
```

浏览器打开:

```text
http://鲁班猫IP:5006
```

## 说明

- 推理前先裁剪 ROI
- 页面可拖动 ROI
- 也可以改 `x1 y1 x2 y2`
- 当前脚本默认读取:

```text
models/best_rknn_model
```

如果你的导出结果是 `.rknn` 单文件，也可以把 `--weights` 改成对应文件路径。
