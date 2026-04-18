#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

exec python3 "$SCRIPT_DIR/collect_wall_distance_web.py" \
  --camera 0 \
  --port 5005 \
  --save-root "$SCRIPT_DIR/../dataset/raw"
