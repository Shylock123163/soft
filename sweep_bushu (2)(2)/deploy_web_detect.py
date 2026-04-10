from __future__ import annotations

import argparse
import glob
import math
import queue
import threading
import time
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import serial
import yaml
from flask import Flask, Response, jsonify
from rknnlite.api import RKNNLite


APP = Flask(__name__)


class Kalman1D:
    def __init__(self, initial_value: float, process_noise: float, measurement_noise: float) -> None:
        self.x = float(initial_value)
        self.p = 1.0
        self.q = float(process_noise)
        self.r = float(measurement_noise)

    def update(self, measurement: float) -> float:
        self.p = self.p + self.q
        gain = self.p / (self.p + self.r)
        self.x = self.x + gain * (measurement - self.x)
        self.p = (1.0 - gain) * self.p
        return self.x


class ClassifierRuntime:
    def __init__(self, config: dict[str, Any], base_dir: Path) -> None:
        model_cfg = config["model"]
        self.weights = (base_dir / str(model_cfg["path"])).resolve()
        if not self.weights.exists():
            raise FileNotFoundError(f"model file not found: {self.weights}")

        self.imgsz = int(model_cfg.get("imgsz", 224))
        self.input_size = (self.imgsz, self.imgsz)
        self.clutter_class_name = str(model_cfg.get("clutter_class_name", "clutter"))
        self.class_names = [str(x) for x in model_cfg.get("class_names", ["clean", "clutter"])]
        self.threshold_on = float(model_cfg.get("threshold_on", 0.60))
        self.threshold_off = float(model_cfg.get("threshold_off", 0.40))
        self.model_backend = "RKNNLite"
        self.stable_state = "unknown"
        self.quick_state = "unknown"

        filter_cfg = config["filter"]
        self.filter_enabled = bool(filter_cfg.get("enabled", True))
        self.filter = Kalman1D(
            initial_value=float(filter_cfg.get("initial_value", 0.50)),
            process_noise=float(filter_cfg.get("process_noise", 0.008)),
            measurement_noise=float(filter_cfg.get("measurement_noise", 0.08)),
        )

        fast_cfg = config.get("fast_control", {})
        self.fast_enabled = bool(fast_cfg.get("enabled", True))
        self.raw_threshold_on = float(fast_cfg.get("raw_threshold_on", 0.42))
        self.raw_threshold_off = float(fast_cfg.get("raw_threshold_off", 0.24))
        self.min_consecutive_on = max(int(fast_cfg.get("min_consecutive_on", 1)), 1)
        self.hold_s = max(float(fast_cfg.get("hold_ms", 180)) / 1000.0, 0.0)
        self.raw_on_counter = 0
        self.fast_hold_until = 0.0

        self.rknn = RKNNLite()
        ret = self.rknn.load_rknn(str(self.weights))
        if ret != 0:
            raise RuntimeError(f"load_rknn failed: {ret}")

        ret = self.rknn.init_runtime()
        if ret != 0:
            raise RuntimeError(f"init_runtime failed: {ret}")

    def close(self) -> None:
        try:
            self.rknn.release()
        except Exception:
            pass

    def _preprocess(self, image: np.ndarray) -> np.ndarray:
        resized = cv2.resize(image, self.input_size, interpolation=cv2.INTER_LINEAR)
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        return np.expand_dims(rgb, axis=0)

    def _softmax(self, logits: np.ndarray) -> np.ndarray:
        logits = logits.astype(np.float32).reshape(-1)
        max_v = float(np.max(logits))
        exp_v = np.exp(logits - max_v)
        denom = float(np.sum(exp_v))
        if denom <= 0:
            return np.zeros_like(exp_v, dtype=np.float32)
        return exp_v / denom

    def _resolve_clutter_index(self, num_classes: int) -> int:
        for idx, name in enumerate(self.class_names):
            if name == self.clutter_class_name and idx < num_classes:
                return idx
        return min(1, max(0, num_classes - 1))

    def predict(self, image: np.ndarray) -> dict[str, Any]:
        input_tensor = self._preprocess(image)
        outputs = self.rknn.inference(inputs=[input_tensor])
        if not outputs:
            return {
                "state": "unknown",
                "stable_state": "unknown",
                "quick_state": "unknown",
                "display_text": "状态未知",
                "overlay_text": "unknown",
                "clutter_raw": 0.0,
                "clutter_smooth": 0.0,
                "decision_confidence": 0.0,
            }

        logits = np.array(outputs[0]).reshape(-1)
        probs = self._softmax(logits)
        clutter_idx = self._resolve_clutter_index(len(probs))
        clutter_raw = float(probs[clutter_idx]) if len(probs) > 0 else 0.0
        clutter_smooth = self.filter.update(clutter_raw) if self.filter_enabled else clutter_raw
        now = time.time()

        if self.stable_state == "clutter":
            if clutter_smooth <= self.threshold_off:
                self.stable_state = "clean"
        elif self.stable_state == "clean":
            if clutter_smooth >= self.threshold_on:
                self.stable_state = "clutter"
        else:
            midpoint = (self.threshold_on + self.threshold_off) / 2.0
            self.stable_state = "clutter" if clutter_smooth >= midpoint else "clean"

        if self.fast_enabled:
            if clutter_raw >= self.raw_threshold_on:
                self.raw_on_counter += 1
            else:
                self.raw_on_counter = 0

            if self.quick_state == "clutter":
                if clutter_raw <= self.raw_threshold_off and now >= self.fast_hold_until:
                    self.quick_state = "clean"
            else:
                if self.raw_on_counter >= self.min_consecutive_on:
                    self.quick_state = "clutter"
                    self.fast_hold_until = now + self.hold_s

            if self.quick_state == "clutter" and clutter_raw >= self.raw_threshold_on:
                self.fast_hold_until = now + self.hold_s
        else:
            self.quick_state = self.stable_state

        control_state = self.stable_state
        serial_state = self.quick_state if self.fast_enabled else control_state
        if serial_state == "clutter":
            control_score = max(clutter_raw, clutter_smooth)
        else:
            control_score = 1.0 - min(clutter_raw, clutter_smooth)
        decision_confidence = float(max(0.0, min(1.0, control_score)))
        display_text = "正前方有杂物" if control_state == "clutter" else "正前方无杂物"
        overlay_text = "front clutter" if control_state == "clutter" else "front clean"
        return {
            "state": control_state,
            "stable_state": self.stable_state,
            "quick_state": self.quick_state,
            "display_text": display_text,
            "overlay_text": overlay_text,
            "clutter_raw": round(clutter_raw, 4),
            "clutter_smooth": round(clutter_smooth, 4),
            "decision_confidence": round(decision_confidence, 4),
        }


class SerialSender:
    def __init__(self, config: dict[str, Any], tx_queue: "queue.Queue[dict[str, Any]]") -> None:
        serial_cfg = config["serial"]
        self.enabled = bool(serial_cfg.get("enabled", False))
        self.port = str(serial_cfg.get("port", "auto"))
        self.auto_candidates = [str(item) for item in serial_cfg.get("auto_candidates", [])]
        self.baud = int(serial_cfg.get("baud", 115200))
        self.timeout = float(serial_cfg.get("timeout", 0.2))
        self.reconnect_interval_s = float(serial_cfg.get("reconnect_interval_s", 2.0))
        self.send_interval_s = max(float(serial_cfg.get("send_interval_ms", 100)) / 1000.0, 0.02)
        self.heartbeat_interval_s = max(float(serial_cfg.get("heartbeat_interval_ms", 500)) / 1000.0, self.send_interval_s)
        self.queue_poll_s = max(float(serial_cfg.get("queue_poll_ms", 10)) / 1000.0, 0.005)
        self.send_on_change = bool(serial_cfg.get("send_on_change", True))
        self.immediate_state_change = bool(serial_cfg.get("immediate_state_change", True))
        self.prefer_quick_state = bool(serial_cfg.get("prefer_quick_state", False))
        self.prefix = str(serial_cfg.get("prefix", "$SWEEP"))
        self.target_uart = str(serial_cfg.get("target_uart", "USART3")).upper()
        self.mcu_timeout_s = max(float(serial_cfg.get("mcu_timeout_ms", 1200)) / 1000.0, 0.2)
        self.tx_queue = tx_queue

        self.ser: serial.Serial | None = None
        self.connected_port = ""
        self.last_payload: bytes | None = None
        self.last_snapshot: dict[str, Any] | None = None
        self.last_sent_serial_state = "unknown"
        self.last_send_ts = 0.0
        self.sent_packets = 0
        self.last_tx_text = ""
        self.last_rx_text = ""
        self.last_rx_ts = 0.0
        self.last_ok_ts = 0.0
        self.mcu_online = False
        self.mcu_last_event = "-"
        self.mcu_last_vision = "-"
        self.mcu_rx_count = 0
        self.rx_buffer = bytearray()

    def resolve_port(self) -> str:
        if self.port != "auto":
            return self.port

        for candidate in self.auto_candidates:
            if any(ch in candidate for ch in "*?[]"):
                matches = sorted(glob.glob(candidate))
                if matches:
                    return matches[0]
            elif Path(candidate).exists():
                return candidate

        for pattern in ("/dev/ttyUSB0", "/dev/ttyS3", "/dev/ttyAMA3", "/dev/ttyTHS3", "/dev/ttyFIQ0", "/dev/ttyACM0"):
            matches = sorted(glob.glob(pattern))
            if matches:
                return matches[0]
        raise RuntimeError("no serial port found")

    def open(self) -> None:
        port = self.resolve_port()
        self.ser = serial.Serial(port=port, baudrate=self.baud, timeout=self.timeout)
        self.connected_port = port
        update_status(
            {
                "serial_enabled": True,
                "serial_connected": True,
                "serial_port": port,
                "serial_error": "",
                "serial_target_uart": self.target_uart,
                "mcu_link_state": "UNKNOWN",
            }
        )

    def close(self) -> None:
        if self.ser is not None:
            try:
                self.ser.close()
            except Exception:
                pass
        self.ser = None
        self.connected_port = ""
        self.mcu_online = False
        self.rx_buffer.clear()

    def select_serial_state(self, snapshot: dict[str, Any]) -> str:
        if self.prefer_quick_state:
            quick_state = str(snapshot.get("quick_state", "unknown")).lower()
            if quick_state in ("clutter", "clean"):
                return quick_state
        return str(snapshot.get("state", "unknown")).lower()

    def build_payload(self, snapshot: dict[str, Any]) -> bytes:
        serial_state = self.select_serial_state(snapshot)
        clutter_flag = 1 if serial_state == "clutter" else 0
        smooth = int(max(0.0, min(1.0, float(snapshot.get("clutter_smooth", 0.0)))) * 1000)
        raw = int(max(0.0, min(1.0, float(snapshot.get("clutter_raw", 0.0)))) * 1000)
        decision = int(max(0.0, min(1.0, float(snapshot.get("decision_confidence", 0.0)))) * 1000)
        state_name = serial_state.upper()
        return f"{self.prefix},{clutter_flag},{smooth},{raw},{decision},{state_name}\r\n".encode("ascii")

    def maybe_send(self, snapshot: dict[str, Any]) -> None:
        now = time.time()
        payload = self.build_payload(snapshot)
        changed = payload != self.last_payload
        interval_ready = (now - self.last_send_ts) >= self.send_interval_s
        heartbeat_ready = (now - self.last_send_ts) >= self.heartbeat_interval_s
        serial_state = self.select_serial_state(snapshot)
        state_changed = serial_state != self.last_sent_serial_state

        if self.last_send_ts == 0.0:
            should_send = True
        elif self.immediate_state_change and state_changed:
            should_send = True
        elif self.send_on_change:
            should_send = (changed and interval_ready) or heartbeat_ready
        else:
            should_send = interval_ready

        if not should_send:
            return

        if self.ser is None:
            self.open()

        assert self.ser is not None
        self.ser.write(payload)
        self.ser.flush()

        self.last_payload = payload
        self.last_sent_serial_state = serial_state
        self.last_send_ts = now
        self.sent_packets += 1
        self.last_tx_text = payload.decode("ascii", errors="ignore").strip()
        update_status(
            {
                "serial_enabled": True,
                "serial_connected": True,
                "serial_port": self.connected_port,
                "serial_error": "",
                "serial_target_uart": self.target_uart,
                "serial_packets": self.sent_packets,
                "serial_last_tx": self.last_tx_text,
            }
        )

    def send_safe_idle(self) -> None:
        idle_snapshot = {
            "state": "clean",
            "quick_state": "clean",
            "clutter_raw": 0.0,
            "clutter_smooth": 0.0,
            "decision_confidence": 0.0,
        }
        self.last_snapshot = idle_snapshot
        self.last_payload = None
        self.last_sent_serial_state = "unknown"
        self.maybe_send(idle_snapshot)

    def handle_mcu_line(self, line: str) -> None:
        now = time.time()
        code = line.strip()
        if not code:
            return

        self.last_rx_text = code
        self.last_rx_ts = now
        self.mcu_rx_count += 1

        if code in ("MCU_ACK", "MCU_RX_OK"):
            self.mcu_online = True
            self.last_ok_ts = now

        if code == "MCU_VISION_TIMEOUT":
            self.mcu_online = False

        if code == "MCU_VISION_ON":
            self.mcu_last_vision = "ON"
        elif code == "MCU_VISION_OFF":
            self.mcu_last_vision = "OFF"

        age_ms = int((now - self.last_ok_ts) * 1000) if self.last_ok_ts > 0 else -1
        self.mcu_last_event = code
        update_status(
            {
                "serial_enabled": True,
                "serial_connected": True,
                "serial_port": self.connected_port,
                "mcu_link_state": "ONLINE" if self.mcu_online else "OFFLINE",
                "mcu_last_event": self.mcu_last_event,
                "mcu_last_rx": self.last_rx_text,
                "mcu_last_vision": self.mcu_last_vision,
                "mcu_rx_count": self.mcu_rx_count,
                "mcu_last_ok_age_ms": age_ms,
            }
        )

    def feed_mcu_bytes(self, raw: bytes) -> None:
        if not raw:
            return

        self.rx_buffer.extend(raw)
        while True:
            newline_pos = self.rx_buffer.find(b"\n")
            if newline_pos < 0:
                if len(self.rx_buffer) > 512:
                    self.rx_buffer = self.rx_buffer[-256:]
                break

            line = self.rx_buffer[:newline_pos]
            del self.rx_buffer[: newline_pos + 1]
            text = line.decode("utf-8", errors="ignore").strip()
            if text:
                self.handle_mcu_line(text)

    def poll_mcu_feedback(self) -> None:
        if self.ser is None:
            return

        while True:
            waiting = int(getattr(self.ser, "in_waiting", 0) or 0)
            if waiting <= 0:
                break
            raw = self.ser.read(waiting)
            if not raw:
                break
            self.feed_mcu_bytes(raw)

        if self.last_ok_ts > 0:
            age_s = time.time() - self.last_ok_ts
            age_ms = int(age_s * 1000)
            if age_s > self.mcu_timeout_s:
                self.mcu_online = False
            update_status(
                {
                    "mcu_link_state": "ONLINE" if self.mcu_online else "OFFLINE",
                    "mcu_last_ok_age_ms": age_ms,
                }
            )

    def loop(self) -> None:
        if not self.enabled:
            update_status({"serial_enabled": False, "serial_target_uart": self.target_uart})
            return

        update_status({"serial_enabled": True, "serial_target_uart": self.target_uart})
        while True:
            try:
                try:
                    snapshot = self.tx_queue.get(timeout=self.queue_poll_s)
                    self.last_snapshot = snapshot
                except queue.Empty:
                    snapshot = self.last_snapshot

                latest_snapshot, latest_snapshot_ts = get_latest_result()
                now = time.time()
                result_fresh = (latest_snapshot is not None) and ((now - latest_snapshot_ts) <= RESULT_STALE_TIMEOUT_S)

                if snapshot is None and result_fresh:
                    snapshot = latest_snapshot
                    self.last_snapshot = snapshot

                if snapshot is None:
                    if self.ser is not None:
                        self.send_safe_idle()
                        self.poll_mcu_feedback()
                    else:
                        update_status(
                            {
                                "serial_enabled": True,
                                "serial_connected": False,
                                "serial_error": "waiting for first valid detection result",
                                "serial_target_uart": self.target_uart,
                            }
                        )
                    time.sleep(self.queue_poll_s)
                    continue

                if not result_fresh and latest_snapshot is not None:
                    self.send_safe_idle()
                    self.poll_mcu_feedback()
                    time.sleep(self.queue_poll_s)
                    continue

                self.maybe_send(snapshot)
                self.poll_mcu_feedback()
            except Exception as exc:
                self.close()
                update_status(
                    {
                        "serial_enabled": True,
                        "serial_connected": False,
                        "serial_error": str(exc),
                        "serial_target_uart": self.target_uart,
                        "mcu_link_state": "OFFLINE",
                    }
                )
                time.sleep(self.reconnect_interval_s)


frame_lock = threading.Lock()
status_lock = threading.Lock()
result_lock = threading.Lock()
serial_tx_queue: "queue.Queue[dict[str, Any]]" = queue.Queue(maxsize=1)
latest_jpeg: bytes | None = None
latest_frame_ts = 0.0
FRAME_STALE_TIMEOUT_S = 2.0
RESULT_STALE_TIMEOUT_S = 2.0
latest_result: dict[str, Any] | None = None
latest_result_ts = 0.0
latest_status: dict[str, Any] = {
    "frame_ready": False,
    "camera_error": "",
    "state": "unknown",
    "stable_state": "unknown",
    "quick_state": "unknown",
    "display_text": "等待画面",
    "model_backend": "",
    "model_path": "",
    "decision_confidence": 0.0,
    "clutter_raw": 0.0,
    "clutter_smooth": 0.0,
    "serial_enabled": False,
    "serial_connected": False,
    "serial_target_uart": "USART3",
    "serial_port": "",
    "serial_error": "",
    "serial_packets": 0,
    "serial_last_tx": "",
    "mcu_link_state": "UNKNOWN",
    "mcu_last_event": "-",
    "mcu_last_rx": "-",
    "mcu_last_vision": "-",
    "mcu_rx_count": 0,
    "mcu_last_ok_age_ms": -1,
}
app_config: dict[str, Any] = {}
runtime: ClassifierRuntime | None = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Front clutter detector with RKNNLite and serial output")
    parser.add_argument("--config", default="config.yaml", help="path to YAML config")
    return parser.parse_args()


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def load_config(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def update_status(payload: dict[str, Any]) -> None:
    with status_lock:
        latest_status.update(payload)


def update_latest_result(snapshot: dict[str, Any]) -> None:
    global latest_result, latest_result_ts
    with result_lock:
        latest_result = snapshot.copy()
        latest_result_ts = time.time()


def get_latest_result() -> tuple[dict[str, Any] | None, float]:
    with result_lock:
        if latest_result is None:
            return None, 0.0
        return latest_result.copy(), latest_result_ts


def publish_serial_snapshot(snapshot: dict[str, Any]) -> None:
    try:
        while True:
            serial_tx_queue.get_nowait()
    except queue.Empty:
        pass
    try:
        serial_tx_queue.put_nowait(snapshot)
    except queue.Full:
        pass


def get_roi_pixels(width: int, height: int) -> tuple[int, int, int, int]:
    roi = app_config["roi"]
    x1 = int(width * float(roi["x1"]))
    y1 = int(height * float(roi["y1"]))
    x2 = int(width * float(roi["x2"]))
    y2 = int(height * float(roi["y2"]))
    x1 = int(clamp(x1, 0, width - 1))
    y1 = int(clamp(y1, 0, height - 1))
    x2 = int(clamp(x2, x1 + 1, width))
    y2 = int(clamp(y2, y1 + 1, height))
    return x1, y1, x2, y2


def open_camera(camera_cfg: dict[str, Any]):
    source = camera_cfg.get("source", 0)
    if isinstance(source, str) and source.isdigit():
        source = int(source)

    backends: list[int | None] = []
    if isinstance(source, str) and source.startswith("/dev/"):
        backends = [None, cv2.CAP_V4L2]
    else:
        backends = [cv2.CAP_V4L2, None]

    cap = None
    for backend in backends:
        if cap is not None:
            try:
                cap.release()
            except Exception:
                pass

        cap = cv2.VideoCapture(source) if backend is None else cv2.VideoCapture(source, backend)
        if not cap.isOpened():
            continue

        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, int(camera_cfg.get("width", 640)))
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, int(camera_cfg.get("height", 480)))
        cap.set(cv2.CAP_PROP_FPS, int(camera_cfg.get("fps", 30)))

        fourcc = str(camera_cfg.get("fourcc", "")).strip()
        if len(fourcc) == 4:
            cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*fourcc))
        return cap

    return cap if cap is not None else cv2.VideoCapture(source)


def encode_preview(frame: np.ndarray) -> bytes | None:
    jpeg_quality = int(app_config["display"].get("jpeg_quality", 80))
    ok, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality])
    return buffer.tobytes() if ok else None


def clear_latest_frame() -> None:
    global latest_jpeg, latest_frame_ts
    with frame_lock:
        latest_jpeg = None
        latest_frame_ts = 0.0


def update_latest_frame(payload: bytes) -> None:
    global latest_jpeg, latest_frame_ts
    with frame_lock:
        latest_jpeg = payload
        latest_frame_ts = time.time()


def camera_loop() -> None:
    camera_cfg = app_config["camera"]
    infer_interval_s = max(float(app_config["runtime"].get("infer_interval_ms", 120)) / 1000.0, 0.02)
    cap = None
    last_infer_ts = 0.0
    last_eval = {
        "state": "unknown",
        "stable_state": "unknown",
        "quick_state": "unknown",
        "display_text": "等待画面",
        "overlay_text": "waiting",
        "clutter_raw": 0.0,
        "clutter_smooth": 0.0,
        "decision_confidence": 0.0,
    }

    while True:
        try:
            cap = open_camera(camera_cfg)
            if not cap.isOpened():
                clear_latest_frame()
                update_status({"camera_error": f"cannot open camera {camera_cfg.get('source', 0)}", "frame_ready": False})
                time.sleep(2)
                continue

            update_status({"camera_error": ""})

            while True:
                ok, frame = cap.read()
                if not ok or frame is None:
                    clear_latest_frame()
                    update_status({"camera_error": "camera read failed", "frame_ready": False})
                    break

                frame_h, frame_w = frame.shape[:2]
                roi_x1, roi_y1, roi_x2, roi_y2 = get_roi_pixels(frame_w, frame_h)
                roi_frame = frame[roi_y1:roi_y2, roi_x1:roi_x2]

                now = time.time()
                if roi_frame.size > 0 and (now - last_infer_ts) >= infer_interval_s:
                    assert runtime is not None
                    last_eval = runtime.predict(roi_frame)
                    last_infer_ts = now

                preview = frame.copy()
                color = (0, 0, 255) if last_eval["state"] == "clutter" else (0, 180, 0)
                cv2.rectangle(preview, (roi_x1, roi_y1), (roi_x2, roi_y2), (0, 191, 255), 2)
                cv2.putText(preview, last_eval["overlay_text"], (16, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.78, color, 2)
                cv2.putText(
                    preview,
                    f"conf={last_eval['decision_confidence']:.2f} raw={last_eval['clutter_raw']:.2f}",
                    (16, 58),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.68,
                    color,
                    2,
                )

                payload = encode_preview(preview)
                if payload is not None:
                    update_latest_frame(payload)

                update_status(
                    {
                        "frame_ready": True,
                        "camera_error": "",
                        "state": last_eval["state"],
                        "stable_state": last_eval["stable_state"],
                        "quick_state": last_eval["quick_state"],
                        "display_text": last_eval["display_text"],
                        "decision_confidence": last_eval["decision_confidence"],
                        "clutter_raw": last_eval["clutter_raw"],
                        "clutter_smooth": last_eval["clutter_smooth"],
                    }
                )
                update_latest_result(last_eval)
                publish_serial_snapshot(last_eval.copy())
        except Exception as exc:
            clear_latest_frame()
            update_status({"camera_error": f"runtime error: {exc}", "frame_ready": False})
            time.sleep(1)
        finally:
            if cap is not None:
                cap.release()
            time.sleep(1)


def generate_frames():
    while True:
        with frame_lock:
            frame = latest_jpeg
            frame_ts = latest_frame_ts
        if frame is None:
            time.sleep(0.05)
            continue
        if (time.time() - frame_ts) > FRAME_STALE_TIMEOUT_S:
            clear_latest_frame()
            update_status({"frame_ready": False})
            time.sleep(0.05)
            continue
        yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"


@APP.route("/")
def index():
    return """
    <html>
        <head>
            <meta charset="utf-8">
            <title>Sweep Bushu</title>
            <style>
                body { margin: 0; background: #0b1220; color: #e5eef8; font-family: "Microsoft YaHei", sans-serif; }
                .wrap { width: min(1100px, 96vw); margin: 24px auto; }
                .title { font-size: 28px; font-weight: 700; margin-bottom: 16px; }
                .panel { background: #101a2d; border: 1px solid #22324d; border-radius: 16px; padding: 16px; }
                .video-wrap { position: relative; width: 100%; }
                .video { display: block; width: 100%; border-radius: 12px; border: 1px solid #314562; }
                .badge {
                    position: absolute;
                    left: 18px;
                    top: 18px;
                    z-index: 5;
                    padding: 12px 18px;
                    border-radius: 12px;
                    font-size: 22px;
                    font-weight: 700;
                    background: rgba(15, 23, 42, 0.80);
                    border: 2px solid rgba(255,255,255,0.16);
                }
                .badge.clean { color: #4ade80; }
                .badge.clutter { color: #f87171; }
                .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 14px; }
                .box { background: #17233a; border-radius: 12px; padding: 12px; font-size: 16px; min-height: 48px; }
                .foot { margin-top: 14px; color: #9fb4d3; font-size: 14px; }
            </style>
            <script>
                async function refreshStatus() {
                    const data = await (await fetch('/api/status')).json();
                    const badge = document.getElementById('badge');
                    badge.textContent = data.display_text || '等待画面';
                    badge.className = 'badge ' + (data.state === 'clutter' ? 'clutter' : 'clean');
                    document.getElementById('decision').textContent = data.decision_confidence;
                    document.getElementById('raw').textContent = data.clutter_raw;
                    document.getElementById('smooth').textContent = data.clutter_smooth;
                    document.getElementById('quick-state').textContent = data.quick_state || '-';
                    document.getElementById('stable-state').textContent = data.stable_state || '-';
                    document.getElementById('backend').textContent = data.model_backend || '-';
                    document.getElementById('model-path').textContent = data.model_path || '-';
                    document.getElementById('serial-uart').textContent = data.serial_target_uart || '-';
                    document.getElementById('serial-port').textContent = data.serial_port || '-';
                    document.getElementById('serial-state').textContent = data.serial_connected ? 'CONNECTED' : (data.serial_enabled ? 'DISCONNECTED' : 'DISABLED');
                    document.getElementById('serial-last').textContent = data.serial_last_tx || '-';
                    document.getElementById('mcu-link').textContent = data.mcu_link_state || '-';
                    document.getElementById('mcu-event').textContent = data.mcu_last_event || '-';
                    document.getElementById('mcu-rx').textContent = data.mcu_last_rx || '-';
                    document.getElementById('mcu-vision').textContent = data.mcu_last_vision || '-';
                    document.getElementById('mcu-rx-count').textContent = data.mcu_rx_count ?? '-';
                    document.getElementById('mcu-age').textContent = (data.mcu_last_ok_age_ms >= 0) ? data.mcu_last_ok_age_ms : '-';
                    document.getElementById('foot').textContent =
                        data.camera_error ? ('摄像头异常: ' + data.camera_error) :
                        (data.serial_error ? ('串口异常: ' + data.serial_error) : ('MCU最近事件: ' + (data.mcu_last_event || '-')));
                }
                setInterval(refreshStatus, 300);
                window.onload = refreshStatus;
            </script>
        </head>
        <body>
            <div class="wrap">
                <div class="title">正前方杂物检测 + USART3 联动</div>
                <div class="panel">
                    <div class="video-wrap">
                        <img class="video" src="/video_feed">
                        <div class="badge clean" id="badge">等待画面</div>
                    </div>
                    <div class="grid">
                        <div class="box">当前置信度: <span id="decision">-</span></div>
                        <div class="box">原始 raw: <span id="raw">-</span></div>
                        <div class="box">滤波 smooth: <span id="smooth">-</span></div>
                        <div class="box">快速判定: <span id="quick-state">-</span></div>
                        <div class="box">稳定判定: <span id="stable-state">-</span></div>
                        <div class="box">推理后端: <span id="backend">-</span></div>
                        <div class="box">目标串口: <span id="serial-uart">-</span></div>
                        <div class="box">实际串口: <span id="serial-port">-</span></div>
                        <div class="box">串口状态: <span id="serial-state">-</span></div>
                        <div class="box">MCU链路: <span id="mcu-link">-</span></div>
                        <div class="box">MCU视觉: <span id="mcu-vision">-</span></div>
                        <div class="box">MCU回包数: <span id="mcu-rx-count">-</span></div>
                        <div class="box">距上次合法帧ms: <span id="mcu-age">-</span></div>
                        <div class="box" style="grid-column: span 3;">模型文件: <span id="model-path">-</span></div>
                        <div class="box" style="grid-column: span 4;">最后发送: <span id="serial-last">-</span></div>
                        <div class="box" style="grid-column: span 4;">MCU最近事件: <span id="mcu-event">-</span></div>
                        <div class="box" style="grid-column: span 4;">MCU最近回包: <span id="mcu-rx">-</span></div>
                    </div>
                    <div class="foot" id="foot">正在加载</div>
                </div>
            </div>
        </body>
    </html>
    """


@APP.route("/video_feed")
def video_feed():
    return Response(generate_frames(), mimetype="multipart/x-mixed-replace; boundary=frame")


@APP.route("/api/status")
def status():
    with status_lock:
        return jsonify(latest_status.copy())


def main() -> None:
    global app_config
    global runtime

    args = parse_args()
    config_path = Path(args.config).resolve()
    app_config = load_config(config_path)
    runtime = ClassifierRuntime(app_config, config_path.parent)

    update_status(
        {
            "serial_target_uart": str(app_config.get("serial", {}).get("target_uart", "USART3")).upper(),
            "model_backend": runtime.model_backend,
            "model_path": str(runtime.weights),
        }
    )

    threading.Thread(target=camera_loop, daemon=True).start()
    threading.Thread(target=SerialSender(app_config, serial_tx_queue).loop, daemon=True).start()

    server_cfg = app_config["server"]
    APP.run(
        host=str(server_cfg.get("host", "0.0.0.0")),
        port=int(server_cfg.get("port", 5007)),
        threaded=True,
        debug=False,
        use_reloader=False,
    )


if __name__ == "__main__":
    main()
