from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export classification model to RKNN")
    parser.add_argument("--weights", type=Path, required=True, help="path to best.pt")
    parser.add_argument("--target", default="rk3588", help="RKNN target platform")
    parser.add_argument("--imgsz", type=int, default=224, help="export image size")
    parser.add_argument("--half", action="store_true", help="use half precision when supported")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    model = YOLO(str(args.weights))
    model.export(format="rknn", name=args.target, imgsz=args.imgsz, half=args.half)


if __name__ == "__main__":
    main()
