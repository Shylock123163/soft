from __future__ import annotations

import argparse
import threading
import time
from datetime import datetime
from pathlib import Path

import cv2
from flask import Flask, Response, jsonify, request


APP = Flask(__name__)
SCRIPT_DIR = Path(__file__).resolve().parent
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
LABELS = ("near", "mid", "far")

camera_lock = threading.Lock()
latest_frame = None
latest_jpeg = None
camera_error = ""
save_root: Path | None = None
capture_counts = {"near": 0, "mid": 0, "far": 0}
roi = {"x1": 0.15, "y1": 0.35, "x2": 0.85, "y2": 0.92}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Wall distance data collector")
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--port", type=int, default=5005)
    parser.add_argument("--save-root", type=Path, default=Path("dataset/raw"))
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=480)
    return parser.parse_args()


def clamp(v: float, low: float, high: float) -> float:
    return max(low, min(high, v))


def ensure_dirs(root: Path) -> None:
    for label in LABELS:
        (root / label).mkdir(parents=True, exist_ok=True)


def count_images(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(1 for item in path.iterdir() if item.is_file() and item.suffix.lower() in IMAGE_SUFFIXES)


def init_counts(root: Path) -> None:
    for label in LABELS:
        capture_counts[label] = count_images(root / label)


def roi_pixels(width: int, height: int) -> tuple[int, int, int, int]:
    x1 = int(width * roi["x1"])
    y1 = int(height * roi["y1"])
    x2 = int(width * roi["x2"])
    y2 = int(height * roi["y2"])
    x1 = int(clamp(x1, 0, width - 1))
    y1 = int(clamp(y1, 0, height - 1))
    x2 = int(clamp(x2, x1 + 1, width))
    y2 = int(clamp(y2, y1 + 1, height))
    return x1, y1, x2, y2


def save_frame(label: str) -> Path:
    if label not in LABELS:
        raise ValueError(f"label must be one of: {', '.join(LABELS)}")

    with camera_lock:
        if latest_frame is None:
            raise RuntimeError("no frame available")
        frame = latest_frame.copy()

    h, w = frame.shape[:2]
    x1, y1, x2, y2 = roi_pixels(w, h)
    crop = frame[y1:y2, x1:x2]

    capture_counts[label] += 1
    ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    out = save_root / label / f"{label}_{ts}_{capture_counts[label]:04d}.jpg"
    if not cv2.imwrite(str(out), crop):
        raise RuntimeError(f"failed to save image: {out}")
    return out


def save_batch(label: str, count: int, interval: float) -> list[Path]:
    outs = []
    for index in range(count):
        outs.append(save_frame(label))
        if index != count - 1:
            time.sleep(interval)
    return outs


def camera_loop(args: argparse.Namespace) -> None:
    global latest_frame, latest_jpeg, camera_error
    cap = None

    while True:
        try:
            cap = cv2.VideoCapture(args.camera)
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)

            if not cap.isOpened():
                camera_error = f"cannot open camera {args.camera}"
                time.sleep(2)
                continue

            camera_error = ""
            while True:
                ok, frame = cap.read()
                if not ok:
                    camera_error = "camera read failed"
                    break

                h, w = frame.shape[:2]
                x1, y1, x2, y2 = roi_pixels(w, h)
                preview = frame.copy()
                cv2.rectangle(preview, (x1, y1), (x2, y2), (0, 191, 255), 2)
                cv2.putText(preview, "wall-line roi", (14, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.72, (0, 200, 255), 2)
                cv2.putText(
                    preview,
                    f"near={capture_counts['near']} mid={capture_counts['mid']} far={capture_counts['far']}",
                    (14, 58),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.64,
                    (0, 255, 255),
                    2,
                )

                ok, buffer = cv2.imencode(".jpg", preview)
                if ok:
                    with camera_lock:
                        latest_frame = frame
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


@APP.route("/")
def index():
    return """
    <html><head><meta charset="utf-8"><title>墙距采集</title>
    <style>
    body{margin:0;background:#0f172a;color:#e2e8f0;font-family:"Microsoft YaHei",sans-serif}
    .wrap{width:min(1040px,96vw);margin:24px auto}.panel{background:#111827;border:1px solid #334155;border-radius:16px;padding:18px}
    .title{font-size:28px;font-weight:700;margin-bottom:16px}.video-wrap{position:relative;width:100%}
    .video{display:block;width:100%;border-radius:12px;border:1px solid #475569}.roi-overlay{position:absolute;z-index:5;border:3px solid #f59e0b;border-radius:10px;box-sizing:border-box;cursor:move;background:rgba(245,158,11,.08);touch-action:none}
    .roi-label{position:absolute;top:-28px;left:0;background:#f59e0b;color:#111827;font-size:13px;font-weight:700;padding:4px 8px;border-radius:8px}
    .roi-handle{position:absolute;width:14px;height:14px;background:#f59e0b;border:2px solid #111827;border-radius:50%}
    .roi-handle.nw{top:-9px;left:-9px;cursor:nwse-resize}.roi-handle.ne{top:-9px;right:-9px;cursor:nesw-resize}.roi-handle.sw{bottom:-9px;left:-9px;cursor:nesw-resize}.roi-handle.se{bottom:-9px;right:-9px;cursor:nwse-resize}
    .toolbar{display:flex;gap:12px;margin-top:16px;flex-wrap:wrap}.btn{border:none;border-radius:12px;padding:14px 22px;font-size:18px;font-weight:700;cursor:pointer}
    .btn-near{background:#ef4444;color:#fff}.btn-mid{background:#f59e0b;color:#111827}.btn-far{background:#22c55e;color:#03140a}.btn-fast{background:#38bdf8;color:#082f49}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:16px}.box{background:#1e293b;border-radius:12px;padding:14px;font-size:17px}
    .roi-panel{margin-top:16px;background:#1e293b;border-radius:12px;padding:14px}.roi-row{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;align-items:end}
    .roi-item label{display:block;margin-bottom:6px;font-size:14px;color:#cbd5e1}.roi-item input{width:100%;box-sizing:border-box;border:1px solid #475569;border-radius:8px;background:#0f172a;color:#e2e8f0;padding:10px;font-size:16px}
    .status{margin-top:14px;font-size:18px;color:#93c5fd}
    </style>
    <script>
    let roiDragging=null;
    function clamp01(v){return Math.max(0,Math.min(1,v))}
    function normalizeRoi(r){const m=.05;let{x1,y1,x2,y2}=r;x1=clamp01(x1);y1=clamp01(y1);x2=clamp01(x2);y2=clamp01(y2);if(x2<x1)[x1,x2]=[x2,x1];if(y2<y1)[y1,y2]=[y2,y1];if(x2-x1<m){if(x1+m<=1)x2=x1+m;else{x2=1;x1=1-m}}if(y2-y1<m){if(y1+m<=1)y2=y1+m;else{y2=1;y1=1-m}}return{x1,y1,x2,y2}}
    function getRoi(){return normalizeRoi({x1:parseFloat(document.getElementById('roi-x1').value||'0.15'),y1:parseFloat(document.getElementById('roi-y1').value||'0.35'),x2:parseFloat(document.getElementById('roi-x2').value||'0.85'),y2:parseFloat(document.getElementById('roi-y2').value||'0.92')})}
    function setRoi(r){document.getElementById('roi-x1').value=r.x1.toFixed(2);document.getElementById('roi-y1').value=r.y1.toFixed(2);document.getElementById('roi-x2').value=r.x2.toFixed(2);document.getElementById('roi-y2').value=r.y2.toFixed(2)}
    function renderRoi(r){const o=document.getElementById('roi-overlay');o.style.left=(r.x1*100)+'%';o.style.top=(r.y1*100)+'%';o.style.width=((r.x2-r.x1)*100)+'%';o.style.height=((r.y2-r.y1)*100)+'%'}
    async function refresh(){const d=await (await fetch('/api/status')).json();document.getElementById('near-count').textContent=d.near_count;document.getElementById('mid-count').textContent=d.mid_count;document.getElementById('far-count').textContent=d.far_count;document.getElementById('camera-err').textContent=d.camera_error||'-';if(!roiDragging){setRoi(normalizeRoi(d.roi));renderRoi(normalizeRoi(d.roi))}}
    async function saveLabel(label){const s=document.getElementById('status');s.textContent='正在保存到 '+label+' ...';const r=await fetch('/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({label})});const d=await r.json();s.textContent=r.ok?('已保存: '+d.filename):('保存失败: '+(d.error||'unknown error'));refresh()}
    async function saveBatch(label,count){const s=document.getElementById('status');s.textContent='正在连拍 '+label+' x'+count+' ...';const r=await fetch('/capture_batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({label,count,interval:0.25})});const d=await r.json();s.textContent=r.ok?('已连拍: '+label+' x'+d.saved_count):('连拍失败: '+(d.error||'unknown error'));refresh()}
    async function applyRoi(){const s=document.getElementById('status');const r=await fetch('/api/roi',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(getRoi())});const d=await r.json();s.textContent=r.ok?'ROI 已更新':('ROI 更新失败: '+(d.error||'unknown error'));refresh()}
    function initRoi(){const wrap=document.getElementById('video-wrap');const overlay=document.getElementById('roi-overlay');['roi-x1','roi-y1','roi-x2','roi-y2'].forEach(id=>{document.getElementById(id).addEventListener('input',()=>renderRoi(getRoi()))});function start(mode,e){e.preventDefault();e.stopPropagation();const rect=wrap.getBoundingClientRect();roiDragging={mode,rect,startX:e.clientX,startY:e.clientY,startRoi:getRoi()}}overlay.addEventListener('pointerdown',e=>{if(e.target.classList.contains('roi-handle'))return;start('move',e)});document.querySelectorAll('.roi-handle').forEach(h=>h.addEventListener('pointerdown',e=>start(h.dataset.handle,e)));window.addEventListener('pointermove',e=>{if(!roiDragging)return;const dx=(e.clientX-roiDragging.startX)/roiDragging.rect.width;const dy=(e.clientY-roiDragging.startY)/roiDragging.rect.height;const s=roiDragging.startRoi;let n={...s};if(roiDragging.mode==='move'){const w=s.x2-s.x1,h=s.y2-s.y1;n.x1=clamp01(s.x1+dx);n.y1=clamp01(s.y1+dy);n.x2=clamp01(n.x1+w);n.y2=clamp01(n.y1+h);if(n.x2>=1){n.x2=1;n.x1=1-w}if(n.y2>=1){n.y2=1;n.y1=1-h}}else if(roiDragging.mode==='nw'){n.x1=s.x1+dx;n.y1=s.y1+dy}else if(roiDragging.mode==='ne'){n.x2=s.x2+dx;n.y1=s.y1+dy}else if(roiDragging.mode==='sw'){n.x1=s.x1+dx;n.y2=s.y2+dy}else if(roiDragging.mode==='se'){n.x2=s.x2+dx;n.y2=s.y2+dy}n=normalizeRoi(n);setRoi(n);renderRoi(n)});window.addEventListener('pointerup',async()=>{if(!roiDragging)return;roiDragging=null;await applyRoi()})}
    setInterval(refresh,400);window.onload=()=>{initRoi();renderRoi(getRoi());refresh()}
    </script></head>
    <body><div class="wrap"><div class="title">墙地交界线距离采集</div><div class="panel">
    <div class="video-wrap" id="video-wrap"><img class="video" src="/video_feed"><div class="roi-overlay" id="roi-overlay"><div class="roi-label">ROI</div><div class="roi-handle nw" data-handle="nw"></div><div class="roi-handle ne" data-handle="ne"></div><div class="roi-handle sw" data-handle="sw"></div><div class="roi-handle se" data-handle="se"></div></div></div>
    <div class="toolbar"><button class="btn btn-near" onclick="saveLabel('near')">距离近 -> 存到 near</button><button class="btn btn-mid" onclick="saveLabel('mid')">中间距离 -> 存到 mid</button><button class="btn btn-far" onclick="saveLabel('far')">距离远 -> 存到 far</button><button class="btn btn-fast" onclick="saveBatch('near',10)">near 连拍10张</button><button class="btn btn-fast" onclick="saveBatch('mid',10)">mid 连拍10张</button><button class="btn btn-fast" onclick="saveBatch('far',10)">far 连拍10张</button><button class="btn btn-fast" onclick="saveBatch('near',30)">near 连拍30张</button><button class="btn btn-fast" onclick="saveBatch('mid',30)">mid 连拍30张</button><button class="btn btn-fast" onclick="saveBatch('far',30)">far 连拍30张</button></div>
    <div class="grid"><div class="box">near 数量: <span id="near-count">0</span></div><div class="box">mid 数量: <span id="mid-count">0</span></div><div class="box">far 数量: <span id="far-count">0</span></div><div class="box">摄像头状态: <span id="camera-err">-</span></div><div class="box">采集目标: 墙地交界线</div><div class="box">建议标签: near / mid / far</div><div class="box">保存目录: dataset/raw</div><div class="box">保存内容: 仅保存 ROI 裁剪图</div></div>
    <div class="roi-panel"><div style="font-size:18px;font-weight:700;margin-bottom:12px;">ROI 参数</div><div class="roi-row"><div class="roi-item"><label>x1</label><input id="roi-x1" type="number" min="0" max="1" step="0.01"></div><div class="roi-item"><label>y1</label><input id="roi-y1" type="number" min="0" max="1" step="0.01"></div><div class="roi-item"><label>x2</label><input id="roi-x2" type="number" min="0" max="1" step="0.01"></div><div class="roi-item"><label>y2</label><input id="roi-y2" type="number" min="0" max="1" step="0.01"></div><div class="roi-item"><button class="btn btn-fast" onclick="applyRoi()">更新 ROI</button></div></div><div style="margin-top:10px;color:#cbd5e1;">尽量只框住墙地交界线区域，不要把太多车体和杂物框进去。</div></div>
    <div class="status" id="status">等待操作</div></div></div></body></html>
    """


@APP.route("/video_feed")
def video_feed():
    return Response(generate_frames(), mimetype="multipart/x-mixed-replace; boundary=frame")


@APP.route("/capture", methods=["POST"])
def capture():
    label = (request.get_json(silent=True) or {}).get("label", "")
    try:
        output = save_frame(label)
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500
    return jsonify({"ok": True, "filename": output.name})


@APP.route("/capture_batch", methods=["POST"])
def capture_batch():
    data = request.get_json(silent=True) or {}
    try:
        outs = save_batch(data.get("label", ""), int(data.get("count", 10)), float(data.get("interval", 0.25)))
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500
    return jsonify({"ok": True, "saved_count": len(outs)})


@APP.route("/api/status")
def status():
    return jsonify(
        {
            "near_count": capture_counts["near"],
            "mid_count": capture_counts["mid"],
            "far_count": capture_counts["far"],
            "camera_error": camera_error,
            "roi": roi,
        }
    )


@APP.route("/api/roi", methods=["POST"])
def update_roi():
    data = request.get_json(silent=True) or {}
    try:
        x1 = clamp(float(data.get("x1", roi["x1"])), 0.0, 1.0)
        y1 = clamp(float(data.get("y1", roi["y1"])), 0.0, 1.0)
        x2 = clamp(float(data.get("x2", roi["x2"])), 0.0, 1.0)
        y2 = clamp(float(data.get("y2", roi["y2"])), 0.0, 1.0)
        if x2 <= x1 or y2 <= y1:
            raise ValueError("x2/y2 must be greater than x1/y1")
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400
    roi.update({"x1": x1, "y1": y1, "x2": x2, "y2": y2})
    return jsonify({"ok": True, "roi": roi})


def main() -> None:
    global save_root
    args = parse_args()
    save_root = args.save_root
    ensure_dirs(save_root)
    init_counts(save_root)

    threading.Thread(target=camera_loop, args=(args,), daemon=True).start()
    APP.run(host="0.0.0.0", port=args.port, threaded=True, debug=False, use_reloader=False)


if __name__ == "__main__":
    main()
