from __future__ import annotations

import argparse
import random
import shutil
from pathlib import Path


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
CLASS_NAMES = ("clean", "clutter")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Split clean/clutter raw images into train and val")
    parser.add_argument("--raw-root", type=Path, required=True, help="dataset/raw")
    parser.add_argument("--output-root", type=Path, required=True, help="dataset")
    parser.add_argument("--val-ratio", type=float, default=0.2, help="validation ratio")
    parser.add_argument("--seed", type=int, default=42, help="random seed")
    parser.add_argument("--clean", action="store_true", help="clear train/val first")
    return parser.parse_args()


def clear_dir(path: Path) -> None:
    if not path.exists():
        path.mkdir(parents=True, exist_ok=True)
        return
    for item in path.iterdir():
        if item.is_file():
            item.unlink()


def list_images(path: Path) -> list[Path]:
    return [p for p in sorted(path.iterdir()) if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES]


def copy_images(images: list[Path], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for image in images:
        shutil.copy2(image, out_dir / image.name)


def main() -> None:
    args = parse_args()
    random.seed(args.seed)

    for split in ("train", "val"):
        for cls_name in CLASS_NAMES:
            out_dir = args.output_root / split / cls_name
            out_dir.mkdir(parents=True, exist_ok=True)
            if args.clean:
                clear_dir(out_dir)

    for cls_name in CLASS_NAMES:
        cls_raw_dir = args.raw_root / cls_name
        images = list_images(cls_raw_dir)
        if not images:
            print(f"[warn] no images in {cls_raw_dir}")
            continue

        random.shuffle(images)
        val_count = max(1, int(len(images) * args.val_ratio)) if len(images) > 1 else 0
        val_images = images[:val_count]
        train_images = images[val_count:]

        copy_images(train_images, args.output_root / "train" / cls_name)
        copy_images(val_images, args.output_root / "val" / cls_name)
        print(f"[done] {cls_name}: train={len(train_images)} val={len(val_images)} total={len(images)}")


if __name__ == "__main__":
    main()
