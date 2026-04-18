上传包说明

1. 01_train_full
可直接上传到服务器继续训练，并导出 test2.pt 和 RKNN。
包含:
- server/
- docs/
- dataset/raw/
- README.md
- test1.pt

服务器执行:
conda activate yolov8
cd /home/pve-ubuntu/new_lable
python server/scripts/split_dataset.py --raw-root dataset/raw --output-root dataset --val-ratio 0.2 --clean
python server/scripts/check_dataset.py --dataset-root dataset
python server/scripts/train_clutter_cls.py --data dataset --resume-from test1.pt --epochs 20 --imgsz 224 --batch 16 --device 0 --name clutter_cls_test2 --save-as test2.pt --export-rknn

输出:
- test2.pt
- test2_rknn_model/

2. 02_code_docs_only
只更新脚本和说明，不带数据。

3. 03_model_only
只补传旧模型 test1.pt。

不建议直接上传这些原目录内容:
- dataset/train/
- dataset/val/
- dataset/dataset/raw1/
- dataset/raw.zip
- server/__pycache__/
