from __future__ import annotations

import argparse
from pathlib import Path


CLASS_NAMES = ("clean", "clutter")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check classification dataset counts")
    parser.add_argument("--dataset-root", type=Path, required=True, help="dataset root")
    return parser.parse_args()


def count_files(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(1 for p in path.iterdir() if p.is_file())


def main() -> None:
    args = parse_args()
    total = 0
    for split in ("train", "val"):
        for cls_name in CLASS_NAMES:
            count = count_files(args.dataset_root / split / cls_name)
            total += count
            print(f"{split}/{cls_name}: {count}")
    print(f"total: {total}")


if __name__ == "__main__":
    main()
