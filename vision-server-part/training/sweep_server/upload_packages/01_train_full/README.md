# 服务器上传包说明

这个上传包只给训练服务器用。

包含:

- `server/`
- `dataset/raw/`
- `dataset/train/`
- `dataset/val/`
- `runs/`
- `docs/SERVER_TRAIN_README.md`
- `docs/STEPS.md`

上传后建议放到:

```text
/home/pve-ubuntu/new_lable
```

训练:

```bash
conda activate yolov8
cd /home/pve-ubuntu/new_lable
pip install -r server/requirements.txt
python server/scripts/split_dataset.py --raw-root dataset/raw --output-root dataset --val-ratio 0.2 --clean
python server/scripts/check_dataset.py --dataset-root dataset
python server/scripts/train_clutter_cls.py --data dataset --epochs 50 --imgsz 224 --batch 16 --device 0
```

如果要在原来的模型基础上继续补几张图再训练，直接把新图片补到:

- `dataset/raw/clean/`
- `dataset/raw/clutter/`

然后在服务器执行:

```bash
conda activate yolov8
cd /home/pve-ubuntu/new_lable
python server/scripts/split_dataset.py --raw-root dataset/raw --output-root dataset --val-ratio 0.2 --clean
python server/scripts/check_dataset.py --dataset-root dataset
python server/scripts/train_clutter_cls.py --data dataset --resume-from test1.pt --epochs 20 --imgsz 224 --batch 16 --device 0 --name clutter_cls_test2 --save-as test2.pt --export-rknn
```

这样会直接得到:

```text
test2.pt
test2_rknn_model/
```
