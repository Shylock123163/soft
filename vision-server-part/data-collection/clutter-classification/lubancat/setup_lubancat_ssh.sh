#!/bin/bash
set -e

echo "[1/4] install openssh-server"
sudo apt-get update
sudo apt-get install -y openssh-server

echo "[2/4] enable ssh service"
sudo systemctl enable ssh

echo "[3/4] restart ssh service"
sudo systemctl restart ssh

echo "[4/4] ssh status"
sudo systemctl --no-pager --full status ssh | head -n 20

echo
echo "LubanCat IP:"
hostname -I
echo
echo "PC connect example:"
echo "ssh cat@<LUBANCAT_IP>"
