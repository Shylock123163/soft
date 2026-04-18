from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export classification model to RKNN")
    parser.add_argument("--weights", type=Path, required=True, help="path to .pt weights, e.g. test2.pt")
    parser.add_argument("--target", default="rk3588", help="RKNN target platform")
    parser.add_argument("--imgsz", type=int, default=224, help="export image size")
    parser.add_argument("--half", action="store_true", help="use half precision when supported")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.weights.is_file():
        raise FileNotFoundError(f"weights not found: {args.weights}")

    model = YOLO(str(args.weights))
    output = model.export(format="rknn", name=args.target, imgsz=args.imgsz, half=args.half)
    print(f"[export] weights={args.weights}")
    print(f"[export] output={output}")


if __name__ == "__main__":
    main()
