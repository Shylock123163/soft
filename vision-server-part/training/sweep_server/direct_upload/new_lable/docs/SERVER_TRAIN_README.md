# 服务器训练说明

## 训练环境

服务器直接使用:

```bash
conda activate yolov8
```

已确认环境包含:

- Python `3.12.9`
- torch `2.6.0+cu124`
- CUDA 可用
- ultralytics `8.3.89`

## 需要上传到服务器的内容

至少上传:

- `dataset/raw/`
- `server/`
- `docs/`

## 训练步骤

```bash
conda activate yolov8
cd ~/new_lable
pip install -r server/requirements.txt
python server/scripts/split_dataset.py --raw-root dataset/raw --output-root dataset --val-ratio 0.2 --clean
python server/scripts/check_dataset.py --dataset-root dataset
python server/scripts/train_clutter_cls.py --data dataset --epochs 50 --imgsz 224 --batch 16 --device 0
```

## 原模型继续补图训练

如果你已经有旧模型，比如根目录下的 `test1.pt`，想在它的基础上继续训练少量新增图片，按这个流程做:

1. 把新图片放进:
   - `dataset/raw/clean/`
   - `dataset/raw/clutter/`
2. 重新切分训练集和验证集:

```bash
python server/scripts/split_dataset.py --raw-root dataset/raw --output-root dataset --val-ratio 0.2 --clean
python server/scripts/check_dataset.py --dataset-root dataset
```

3. 用旧模型继续训练:

```bash
python server/scripts/train_clutter_cls.py --data dataset --resume-from test1.pt --epochs 20 --imgsz 224 --batch 16 --device 0 --name clutter_cls_test2 --save-as test2.pt --export-rknn
```

说明:

- `--resume-from test1.pt` 表示从已有模型继续微调，不是从 `yolo11n-cls.pt` 重新开始。
- `--epochs 20` 适合少量补图，先跑一版，不够再加。
- `--save-as test2.pt` 会把训练得到的 `best.pt` 额外复制成根目录下的 `test2.pt`。
- `--export-rknn` 会在训练完成后继续导出 RKNN，默认目标是 `rk3588`。
- 最终你会得到 `test2.pt` 和 `test2_rknn_model/`。
- 部署网页检测时，把权重改成新的 `test2.pt` 或 `runs/clutter_cls_test2/weights/best.pt`。

## 只导出 RKNN

如果你已经有 `test2.pt`，不想重新训练，只想单独导出 RKNN:

```bash
python server/scripts/export_to_rknn.py --weights test2.pt --target rk3588 --imgsz 224
```

## 训练结果

输出目录:

```text
runs/clutter_cls/
runs/clutter_cls_test2/
```

模型文件:

```text
runs/clutter_cls/weights/best.pt
runs/clutter_cls_test2/weights/best.pt
test2.pt
test2_rknn_model/
```

## 网页实时检测

```bash
python server/web_detect.py --weights runs/clutter_cls/weights/best.pt --camera 0 --port 5003
```

如果用了补图后的新模型，命令改成:

```bash
python server/web_detect.py --weights test2.pt --camera 0 --port 5003
```

浏览器打开:

```text
http://服务器IP:5003
```
