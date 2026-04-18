#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if command -v conda >/dev/null 2>&1; then
  exec conda run -n ultralytics python lubancat/collect_dataset_web.py --camera 0 --port 5004 --save-root dataset/raw1 --weights lubancat/test1.pt
fi

exec python3 lubancat/collect_dataset_web.py --camera 0 --port 5004 --save-root dataset/raw1 --weights lubancat/test1.pt
