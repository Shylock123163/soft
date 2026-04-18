from __future__ import annotations

import argparse
import shutil
from pathlib import Path
from typing import Any

from ultralytics import YOLO


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train bed clutter classification model")
    parser.add_argument("--data", type=Path, required=True, help="dataset root with train/val folders")
    parser.add_argument("--weights", default="yolo11n-cls.pt", help="base classification model")
    parser.add_argument(
        "--resume-from",
        type=Path,
        default=None,
        help="existing .pt model to continue fine-tuning from",
    )
    parser.add_argument("--epochs", type=int, default=50, help="training epochs")
    parser.add_argument("--imgsz", type=int, default=224, help="image size")
    parser.add_argument("--batch", type=int, default=16, help="batch size")
    parser.add_argument("--device", default="cpu", help="device such as cpu or 0")
    parser.add_argument("--workers", type=int, default=8, help="dataloader workers")
    parser.add_argument("--patience", type=int, default=20, help="early stopping patience")
    parser.add_argument("--project", type=Path, default=Path("runs"), help="output project dir")
    parser.add_argument("--name", default="clutter_cls", help="run name")
    parser.add_argument("--exist-ok", action="store_true", help="reuse existing run directory")
    parser.add_argument("--save-as", type=Path, default=None, help="copy trained best.pt to this path, e.g. test2.pt")
    parser.add_argument("--export-rknn", action="store_true", help="export trained weights to RKNN after training")
    parser.add_argument("--rknn-target", default="rk3588", help="RKNN target platform")
    parser.add_argument("--rknn-imgsz", type=int, default=None, help="RKNN export image size, defaults to --imgsz")
    parser.add_argument("--rknn-half", action="store_true", help="use half precision when exporting RKNN")
    return parser.parse_args()


def resolve_weights(args: argparse.Namespace) -> str:
    if args.resume_from is None:
        return args.weights
    if not args.resume_from.is_file():
        raise FileNotFoundError(f"resume model not found: {args.resume_from}")
    return str(args.resume_from)


def check_dataset_dirs(data_root: Path) -> None:
    required_dirs = [
        data_root / "train" / "clean",
        data_root / "train" / "clutter",
        data_root / "val" / "clean",
        data_root / "val" / "clutter",
    ]
    missing_dirs = [path for path in required_dirs if not path.exists()]
    if missing_dirs:
        missing_text = "\n".join(str(path) for path in missing_dirs)
        raise FileNotFoundError(f"dataset folders missing:\n{missing_text}")


def resolve_best_weights_path(model: YOLO, args: argparse.Namespace) -> Path:
    trainer = getattr(model, "trainer", None)
    if trainer is not None:
        best_path = getattr(trainer, "best", None)
        if best_path:
            best_path = Path(best_path)
            if best_path.exists():
                return best_path

        save_dir = getattr(trainer, "save_dir", None)
        if save_dir is not None:
            best_path = Path(save_dir) / "weights" / "best.pt"
            if best_path.exists():
                return best_path

    fallback = args.project / args.name / "weights" / "best.pt"
    if fallback.exists():
        return fallback

    raise FileNotFoundError("cannot find trained best.pt after training")


def copy_weights(source: Path, target: Path) -> Path:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    return target


def normalize_export_path(export_result: Any, weights_path: Path) -> Path:
    candidates: list[Path] = []

    if isinstance(export_result, (str, Path)):
        candidates.append(Path(export_result))
    elif isinstance(export_result, (list, tuple)):
        for item in export_result:
            if isinstance(item, (str, Path)):
                candidates.append(Path(item))

    candidates.extend(
        [
            weights_path.with_name(f"{weights_path.stem}_rknn_model"),
            weights_path.with_name(f"{weights_path.stem}_rknn_model.rknn"),
            weights_path.with_suffix(".rknn"),
        ]
    )

    for candidate in candidates:
        if candidate.exists():
            return candidate

    if candidates:
        return candidates[0]
    raise FileNotFoundError("cannot determine RKNN export output path")


def export_rknn(weights_path: Path, args: argparse.Namespace) -> Path:
    export_imgsz = args.rknn_imgsz or args.imgsz
    print(f"[export] RKNN source={weights_path}")
    print(f"[export] RKNN target={args.rknn_target} imgsz={export_imgsz}")

    export_model = YOLO(str(weights_path))
    export_result = export_model.export(
        format="rknn",
        name=args.rknn_target,
        imgsz=export_imgsz,
        half=args.rknn_half,
    )
    return normalize_export_path(export_result, weights_path)


def main() -> None:
    args = parse_args()
    check_dataset_dirs(args.data)
    args.project.mkdir(parents=True, exist_ok=True)

    model_source = resolve_weights(args)
    print(f"[train] data={args.data}")
    print(f"[train] weights={model_source}")
    model = YOLO(model_source)
    model.train(
        data=str(args.data),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        workers=args.workers,
        patience=args.patience,
        project=str(args.project),
        name=args.name,
        exist_ok=args.exist_ok,
    )

    best_weights = resolve_best_weights_path(model, args)
    print(f"[train] best={best_weights}")

    final_weights = best_weights
    if args.save_as is not None:
        final_weights = copy_weights(best_weights, args.save_as)
        print(f"[train] copied best weights to {final_weights}")

    if args.export_rknn:
        rknn_output = export_rknn(final_weights, args)
        print(f"[export] RKNN output={rknn_output}")


if __name__ == "__main__":
    main()
