#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_NAME="sweep-bushu.service"
SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}"
SERVICE_TEMPLATE="${SCRIPT_DIR}/sweep-bushu.service"
RUN_USER="$(whoami)"

if [ ! -f "$SERVICE_TEMPLATE" ]; then
  echo "service template not found: $SERVICE_TEMPLATE"
  exit 1
fi

mkdir -p "${SCRIPT_DIR}/logs"
chmod +x "${SCRIPT_DIR}/start_web_detect.sh"

sed \
  -e "s|__RUN_USER__|${RUN_USER}|g" \
  -e "s|__WORKDIR__|${SCRIPT_DIR}|g" \
  "$SERVICE_TEMPLATE" | sudo tee "$SERVICE_PATH" >/dev/null

sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}"
sudo systemctl restart "${SERVICE_NAME}"
sudo systemctl status "${SERVICE_NAME}" --no-pager
