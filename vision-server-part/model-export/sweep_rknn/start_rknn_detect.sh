#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

python3 lubancat_rknn_web_detect.py --weights models/best_rknn_model --camera 0 --port 5006
