from __future__ import annotations

import argparse
import threading
import time

import cv2
from flask import Flask, Response, jsonify, request
from ultralytics import YOLO


app = Flask(__name__)

camera_lock = threading.Lock()
latest_jpeg = None
latest_result = {
    "frame_ready": False,
    "label": "unknown",
    "confidence": 0.0,
    "camera_error": "",
    "raw_top1": "unknown",
    "raw_top1_conf": 0.0,
    "clutter_conf": 0.0,
}

roi_config = {"x1": 0.25, "y1": 0.20, "x2": 0.75, "y2": 0.95}
model = None
camera_index = 0
port = 5003


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Web realtime clutter classification")
    parser.add_argument("--weights", required=True, help="path to best.pt")
    parser.add_argument("--camera", type=int, default=0, help="camera index")
    parser.add_argument("--port", type=int, default=5003, help="web port")
    parser.add_argument("--imgsz", type=int, default=224, help="inference size")
    parser.add_argument("--threshold", type=float, default=0.55, help="clutter threshold")
    parser.add_argument("--width", type=int, default=640, help="camera width")
    parser.add_argument("--height", type=int, default=480, help="camera height")
    return parser.parse_args()


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def get_roi_pixels(width: int, height: int) -> tuple[int, int, int, int]:
    x1 = int(width * roi_config["x1"])
    y1 = int(height * roi_config["y1"])
    x2 = int(width * roi_config["x2"])
    y2 = int(height * roi_config["y2"])
    x1 = int(clamp(x1, 0, width - 1))
    y1 = int(clamp(y1, 0, height - 1))
    x2 = int(clamp(x2, x1 + 1, width))
    y2 = int(clamp(y2, y1 + 1, height))
    return x1, y1, x2, y2


def camera_loop(args: argparse.Namespace) -> None:
    global latest_jpeg
    cap = None

    while True:
        try:
            cap = cv2.VideoCapture(args.camera)
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)

            if not cap.isOpened():
                latest_result["camera_error"] = f"cannot open camera {args.camera}"
                time.sleep(2)
                continue

            latest_result["camera_error"] = ""

            while True:
                ok, frame = cap.read()
                if not ok:
                    latest_result["camera_error"] = "camera read failed"
                    break

                frame_height, frame_width = frame.shape[:2]
                roi_x1, roi_y1, roi_x2, roi_y2 = get_roi_pixels(frame_width, frame_height)
                roi_frame = frame[roi_y1:roi_y2, roi_x1:roi_x2]

                results = model.predict(source=roi_frame, imgsz=args.imgsz, verbose=False)
                probs = results[0].probs
                if probs is not None:
                    top_idx = int(probs.top1)
                    top_conf = float(probs.top1conf.item())
                    top_label = results[0].names[top_idx]

                    clutter_conf = 0.0
                    for idx, name in results[0].names.items():
                        if name == "clutter":
                            clutter_conf = float(probs.data[idx].item())
                            break

                    final_label = "clutter" if clutter_conf >= args.threshold else "clean"
                    final_conf = clutter_conf if final_label == "clutter" else 1.0 - clutter_conf
                else:
                    top_label = "unknown"
                    top_conf = 0.0
                    final_label = "unknown"
                    final_conf = 0.0
                    clutter_conf = 0.0

                preview = frame.copy()
                color = (0, 0, 255) if final_label == "clutter" else (0, 255, 0)
                cv2.putText(
                    preview,
                    f"{final_label} conf={final_conf:.2f} clutter={clutter_conf:.2f}",
                    (16, 36),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.9,
                    color,
                    2,
                )

                latest_result.update(
                    {
                        "frame_ready": True,
                        "label": final_label,
                        "confidence": round(final_conf, 4),
                        "raw_top1": top_label,
                        "raw_top1_conf": round(top_conf, 4),
                        "clutter_conf": round(clutter_conf, 4),
                        "roi": roi_config.copy(),
                    }
                )

                ok, buffer = cv2.imencode(".jpg", preview)
                if not ok:
                    continue
                with camera_lock:
                    latest_jpeg = buffer.tobytes()
        finally:
            if cap is not None:
                cap.release()
            time.sleep(1)


def generate_frames():
    while True:
        with camera_lock:
            frame = latest_jpeg
        if frame is None:
            time.sleep(0.05)
            continue
        yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"


@app.route("/")
def index():
    return """
    <html>
        <head>
            <meta charset="utf-8">
            <title>Bed Clutter Detect</title>
            <style>
                body { margin: 0; background: #0f172a; color: #e2e8f0; font-family: "Microsoft YaHei", sans-serif; }
                .wrap { width: min(980px, 96vw); margin: 24px auto; }
                .panel { background: #111827; border: 1px solid #334155; border-radius: 16px; padding: 18px; }
                .title { font-size: 28px; font-weight: 700; margin-bottom: 16px; }
                .video-wrap { position: relative; width: 100%; }
                .video { display: block; width: 100%; border-radius: 12px; border: 1px solid #475569; }
                .roi-overlay { position: absolute; z-index: 5; border: 3px solid #f59e0b; border-radius: 10px; box-sizing: border-box; cursor: move; background: rgba(245, 158, 11, 0.08); touch-action: none; }
                .roi-label { position: absolute; top: -28px; left: 0; background: #f59e0b; color: #111827; font-size: 13px; font-weight: 700; padding: 4px 8px; border-radius: 8px; }
                .roi-handle { position: absolute; width: 14px; height: 14px; background: #f59e0b; border: 2px solid #111827; border-radius: 50%; }
                .roi-handle.nw { top: -9px; left: -9px; cursor: nwse-resize; }
                .roi-handle.ne { top: -9px; right: -9px; cursor: nesw-resize; }
                .roi-handle.sw { bottom: -9px; left: -9px; cursor: nesw-resize; }
                .roi-handle.se { bottom: -9px; right: -9px; cursor: nwse-resize; }
                .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 16px; }
                .box { background: #1e293b; border-radius: 12px; padding: 14px; font-size: 18px; }
                .roi-panel { margin-top: 16px; background: #1e293b; border-radius: 12px; padding: 14px; }
                .roi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; align-items: end; }
                .roi-item label { display: block; margin-bottom: 6px; font-size: 14px; color: #cbd5e1; }
                .roi-item input { width: 100%; box-sizing: border-box; border: 1px solid #475569; border-radius: 8px; background: #0f172a; color: #e2e8f0; padding: 10px; font-size: 16px; }
                .btn { border: none; border-radius: 12px; padding: 14px 22px; font-size: 18px; font-weight: 700; cursor: pointer; background: #38bdf8; color: #082f49; }
            </style>
            <script>
                let roiDragging = null;

                function clamp01(value) {
                    return Math.max(0, Math.min(1, value));
                }

                function normalizeRoi(roi) {
                    const minSize = 0.05;
                    let x1 = clamp01(roi.x1);
                    let y1 = clamp01(roi.y1);
                    let x2 = clamp01(roi.x2);
                    let y2 = clamp01(roi.y2);
                    if (x2 < x1) [x1, x2] = [x2, x1];
                    if (y2 < y1) [y1, y2] = [y2, y1];
                    if (x2 - x1 < minSize) {
                        if (x1 + minSize <= 1) x2 = x1 + minSize;
                        else {
                            x2 = 1;
                            x1 = 1 - minSize;
                        }
                    }
                    if (y2 - y1 < minSize) {
                        if (y1 + minSize <= 1) y2 = y1 + minSize;
                        else {
                            y2 = 1;
                            y1 = 1 - minSize;
                        }
                    }
                    return { x1, y1, x2, y2 };
                }

                function roiInputsEditing() {
                    const active = document.activeElement;
                    if (!active) return false;
                    return ['roi-x1', 'roi-y1', 'roi-x2', 'roi-y2'].includes(active.id);
                }

                function getRoiFromInputs() {
                    return normalizeRoi({
                        x1: parseFloat(document.getElementById('roi-x1').value || '0.25'),
                        y1: parseFloat(document.getElementById('roi-y1').value || '0.20'),
                        x2: parseFloat(document.getElementById('roi-x2').value || '0.75'),
                        y2: parseFloat(document.getElementById('roi-y2').value || '0.95')
                    });
                }

                function setInputsFromRoi(roi) {
                    document.getElementById('roi-x1').value = roi.x1.toFixed(2);
                    document.getElementById('roi-y1').value = roi.y1.toFixed(2);
                    document.getElementById('roi-x2').value = roi.x2.toFixed(2);
                    document.getElementById('roi-y2').value = roi.y2.toFixed(2);
                }

                function renderRoiOverlay(roi) {
                    const overlay = document.getElementById('roi-overlay');
                    overlay.style.left = (roi.x1 * 100) + '%';
                    overlay.style.top = (roi.y1 * 100) + '%';
                    overlay.style.width = ((roi.x2 - roi.x1) * 100) + '%';
                    overlay.style.height = ((roi.y2 - roi.y1) * 100) + '%';
                }

                function syncOverlayFromInputs() {
                    renderRoiOverlay(getRoiFromInputs());
                }

                async function refreshStatus() {
                    const res = await fetch('/api/status');
                    const data = await res.json();
                    document.getElementById('label').textContent = data.label;
                    document.getElementById('conf').textContent = data.confidence;
                    document.getElementById('err').textContent = data.camera_error || '-';
                    document.getElementById('tip').textContent = '推理前会先裁剪 ROI，再做分类';
                    if (!roiInputsEditing() && !roiDragging) {
                        setInputsFromRoi(normalizeRoi(data.roi));
                        renderRoiOverlay(normalizeRoi(data.roi));
                    }
                }

                async function applyRoi() {
                    const payload = getRoiFromInputs();
                    const response = await fetch('/api/roi', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await response.json();
                    if (!response.ok) {
                        document.getElementById('tip').textContent = 'ROI 更新失败: ' + (data.error || 'unknown error');
                        return;
                    }
                    document.getElementById('tip').textContent = 'ROI 已更新';
                    refreshStatus();
                }

                function initRoiInteractions() {
                    const wrap = document.getElementById('video-wrap');
                    const overlay = document.getElementById('roi-overlay');
                    const inputs = ['roi-x1', 'roi-y1', 'roi-x2', 'roi-y2'].map((id) => document.getElementById(id));

                    inputs.forEach((input) => {
                        input.addEventListener('input', () => {
                            syncOverlayFromInputs();
                        });
                        input.addEventListener('change', () => {
                            syncOverlayFromInputs();
                        });
                    });

                    function startDrag(mode, event) {
                        event.preventDefault();
                        event.stopPropagation();
                        const rect = wrap.getBoundingClientRect();
                        roiDragging = {
                            mode,
                            rect,
                            startX: event.clientX,
                            startY: event.clientY,
                            startRoi: getRoiFromInputs()
                        };
                    }

                    overlay.addEventListener('pointerdown', (event) => {
                        if (event.target.classList.contains('roi-handle')) return;
                        startDrag('move', event);
                    });

                    document.querySelectorAll('.roi-handle').forEach((handle) => {
                        handle.addEventListener('pointerdown', (event) => {
                            startDrag(handle.dataset.handle, event);
                        });
                    });

                    window.addEventListener('pointermove', (event) => {
                        if (!roiDragging) return;
                        const dx = (event.clientX - roiDragging.startX) / roiDragging.rect.width;
                        const dy = (event.clientY - roiDragging.startY) / roiDragging.rect.height;
                        const start = roiDragging.startRoi;
                        let next = { ...start };

                        if (roiDragging.mode === 'move') {
                            const width = start.x2 - start.x1;
                            const height = start.y2 - start.y1;
                            next.x1 = clamp01(start.x1 + dx);
                            next.y1 = clamp01(start.y1 + dy);
                            next.x2 = clamp01(next.x1 + width);
                            next.y2 = clamp01(next.y1 + height);
                            if (next.x2 >= 1) {
                                next.x2 = 1;
                                next.x1 = 1 - width;
                            }
                            if (next.y2 >= 1) {
                                next.y2 = 1;
                                next.y1 = 1 - height;
                            }
                        } else if (roiDragging.mode === 'nw') {
                            next.x1 = start.x1 + dx;
                            next.y1 = start.y1 + dy;
                        } else if (roiDragging.mode === 'ne') {
                            next.x2 = start.x2 + dx;
                            next.y1 = start.y1 + dy;
                        } else if (roiDragging.mode === 'sw') {
                            next.x1 = start.x1 + dx;
                            next.y2 = start.y2 + dy;
                        } else if (roiDragging.mode === 'se') {
                            next.x2 = start.x2 + dx;
                            next.y2 = start.y2 + dy;
                        }

                        next = normalizeRoi(next);
                        setInputsFromRoi(next);
                        renderRoiOverlay(next);
                    });

                    window.addEventListener('pointerup', async () => {
                        if (!roiDragging) return;
                        roiDragging = null;
                        await applyRoi();
                    });
                }

                setInterval(refreshStatus, 400);
                window.onload = () => {
                    initRoiInteractions();
                    const initialRoi = getRoiFromInputs();
                    renderRoiOverlay(initialRoi);
                    refreshStatus();
                };
            </script>
        </head>
        <body>
            <div class="wrap">
                <div class="title">床底杂物实时检测</div>
                <div class="panel">
                    <div class="video-wrap" id="video-wrap">
                        <img class="video" src="/video_feed">
                        <div class="roi-overlay" id="roi-overlay">
                            <div class="roi-label">ROI</div>
                            <div class="roi-handle nw" data-handle="nw"></div>
                            <div class="roi-handle ne" data-handle="ne"></div>
                            <div class="roi-handle sw" data-handle="sw"></div>
                            <div class="roi-handle se" data-handle="se"></div>
                        </div>
                    </div>
                    <div class="grid">
                        <div class="box">结果: <span id="label">-</span></div>
                        <div class="box">置信度: <span id="conf">-</span></div>
                        <div class="box">摄像头: <span id="err">-</span></div>
                        <div class="box">提示: <span id="tip">-</span></div>
                    </div>
                    <div class="roi-panel">
                        <div style="font-size: 18px; font-weight: 700; margin-bottom: 12px;">ROI 参数</div>
                        <div class="roi-row">
                            <div class="roi-item">
                                <label>x1 左边界 0~1</label>
                                <input id="roi-x1" type="number" min="0" max="1" step="0.01">
                            </div>
                            <div class="roi-item">
                                <label>y1 上边界 0~1</label>
                                <input id="roi-y1" type="number" min="0" max="1" step="0.01">
                            </div>
                            <div class="roi-item">
                                <label>x2 右边界 0~1</label>
                                <input id="roi-x2" type="number" min="0" max="1" step="0.01">
                            </div>
                            <div class="roi-item">
                                <label>y2 下边界 0~1</label>
                                <input id="roi-y2" type="number" min="0" max="1" step="0.01">
                            </div>
                            <div class="roi-item">
                                <button class="btn" onclick="applyRoi()">更新 ROI</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </body>
    </html>
    """


@app.route("/video_feed")
def video_feed():
    return Response(generate_frames(), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/api/status")
def status():
    return jsonify({**latest_result, "roi": roi_config})


@app.route("/api/roi", methods=["POST"])
def update_roi():
    payload = request.get_json(silent=True) or {}
    try:
        x1 = float(payload.get("x1", roi_config["x1"]))
        y1 = float(payload.get("y1", roi_config["y1"]))
        x2 = float(payload.get("x2", roi_config["x2"]))
        y2 = float(payload.get("y2", roi_config["y2"]))
        x1 = clamp(x1, 0.0, 1.0)
        y1 = clamp(y1, 0.0, 1.0)
        x2 = clamp(x2, 0.0, 1.0)
        y2 = clamp(y2, 0.0, 1.0)
        if x2 <= x1 or y2 <= y1:
            raise ValueError("x2/y2 must be greater than x1/y1")
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400

    roi_config.update({"x1": x1, "y1": y1, "x2": x2, "y2": y2})
    return jsonify({"ok": True, "roi": roi_config})


def main() -> None:
    global model
    global camera_index
    global port

    args = parse_args()
    model = YOLO(args.weights)
    camera_index = args.camera
    port = args.port

    threading.Thread(target=camera_loop, args=(args,), daemon=True).start()
    app.run(host="0.0.0.0", port=args.port, threaded=True, debug=False, use_reloader=False)


if __name__ == "__main__":
    main()
