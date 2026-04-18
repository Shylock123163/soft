# 训练服务器工作区说明

这个目录现在按职责拆成 5 块：

- `source/`
  - 训练源码与说明文档
- `datasets/`
  - 原始数据、训练集、验证集、历史补充数据
- `artifacts/`
  - 训练运行产物
- `models/`
  - 当前保留的模型文件
- `packages/`
  - 直接上传包、精简包、发布包

如果你只是想在训练服务器上跑主流程，优先看：

- `source/server/`
- `source/docs/`
- `datasets/dataset/`

上传后建议放到:

```text
/home/pve-ubuntu/new_lable
```

训练:

```bash
conda activate yolov8
cd /home/pve-ubuntu/new_lable
pip install -r source/server/requirements.txt
python source/server/scripts/split_dataset.py --raw-root datasets/dataset/raw --output-root datasets/dataset --val-ratio 0.2 --clean
python source/server/scripts/check_dataset.py --dataset-root datasets/dataset
python source/server/scripts/train_clutter_cls.py --data datasets/dataset --epochs 50 --imgsz 224 --batch 16 --device 0
```

如果要在原来的模型基础上继续补几张图再训练，直接把新图片补到:

- `datasets/dataset/raw/clean/`
- `datasets/dataset/raw/clutter/`

然后在服务器执行:

```bash
conda activate yolov8
cd /home/pve-ubuntu/new_lable
python source/server/scripts/split_dataset.py --raw-root datasets/dataset/raw --output-root datasets/dataset --val-ratio 0.2 --clean
python source/server/scripts/check_dataset.py --dataset-root datasets/dataset
python source/server/scripts/train_clutter_cls.py --data datasets/dataset --resume-from models/test1.pt --epochs 20 --imgsz 224 --batch 16 --device 0 --name clutter_cls_test2 --save-as test2.pt --export-rknn
```

这样会直接得到:

```text
test2.pt
test2_rknn_model/
```
