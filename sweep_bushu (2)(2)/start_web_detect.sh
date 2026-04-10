#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

mkdir -p "$SCRIPT_DIR/logs"

CONDA_SH=""
for candidate in \
  "$HOME/miniconda3/etc/profile.d/conda.sh" \
  "$HOME/anaconda3/etc/profile.d/conda.sh" \
  "/home/cat/miniconda3/etc/profile.d/conda.sh" \
  "/home/cat/anaconda3/etc/profile.d/conda.sh"
do
  if [ -f "$candidate" ]; then
    CONDA_SH="$candidate"
    break
  fi
done

if [ -n "$CONDA_SH" ]; then
  # systemd is non-interactive; conda must be sourced explicitly.
  # shellcheck disable=SC1090
  source "$CONDA_SH"
  conda activate ultralytics
fi

exec python "$SCRIPT_DIR/deploy_web_detect.py" --config "$SCRIPT_DIR/config.yaml"
