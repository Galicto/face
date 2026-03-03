"""
FastAPI Face Recognition Dashboard
====================================
Real-time YOLO-based face detection & recognition with a modern web dashboard.
"""

import asyncio
import time
import cv2
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO
import uvicorn
import os

# ── App Setup ──────────────────────────────────────────────────────────────────
app = FastAPI(title="AI Face Recognition Dashboard")

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(STATIC_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# ── Model & Camera ────────────────────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), "best.pt")
model = YOLO(MODEL_PATH)
CLASS_NAMES = model.names  # e.g. {0: 'meraj', 1: 'raj', 2: 'pramit', 3: 'smaran'}

camera = None
camera_lock = asyncio.Lock()

# Shared metrics state (updated by the video stream generator)
latest_metrics = {
    "detections": {},      # { "name": count }
    "total_faces": 0,
    "fps": 0.0,
    "timestamp": 0,
    "class_names": list(CLASS_NAMES.values()),
}


def get_camera():
    """Lazily initialise the webcam."""
    global camera
    if camera is None or not camera.isOpened():
        camera = cv2.VideoCapture(0)
        camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    return camera


# ── Video Streaming ───────────────────────────────────────────────────────────
def generate_frames():
    """Yield MJPEG frames with YOLO annotations and update metrics."""
    global latest_metrics
    cam = get_camera()
    prev_time = time.time()

    while True:
        success, frame = cam.read()
        if not success:
            break

        # Run YOLO inference
        results = model(frame, conf=0.5, verbose=False)

        detections = {}
        total_faces = 0

        for r in results:
            for box in r.boxes:
                class_id = int(box.cls[0])
                label = CLASS_NAMES.get(class_id, f"unknown_{class_id}")
                detections[label] = detections.get(label, 0) + 1
                total_faces += 1

        # FPS calculation
        curr_time = time.time()
        fps = 1.0 / max(curr_time - prev_time, 1e-5)
        prev_time = curr_time

        latest_metrics = {
            "detections": detections,
            "total_faces": total_faces,
            "fps": round(fps, 1),
            "timestamp": int(curr_time * 1000),
            "class_names": list(CLASS_NAMES.values()),
        }

        # Draw annotated frame
        annotated = results[0].plot()

        ret, buffer = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if not ret:
            continue
        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"
        )


@app.get("/video_feed")
def video_feed():
    """MJPEG stream endpoint."""
    return StreamingResponse(
        generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame"
    )


# ── Metrics Endpoints ─────────────────────────────────────────────────────────
@app.get("/metrics")
def metrics():
    """Return latest detection metrics as JSON (polling fallback)."""
    return latest_metrics


@app.websocket("/ws/metrics")
async def ws_metrics(websocket: WebSocket):
    """Push metrics to connected clients every ~300ms."""
    await websocket.accept()
    try:
        while True:
            await websocket.send_json(latest_metrics)
            await asyncio.sleep(0.3)
    except WebSocketDisconnect:
        pass


# ── Frontend ──────────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
def root():
    """Serve the main dashboard page."""
    index_path = os.path.join(STATIC_DIR, "index.html")
    return FileResponse(index_path)


# ── Lifecycle ─────────────────────────────────────────────────────────────────
@app.on_event("shutdown")
def shutdown():
    global camera
    if camera is not None:
        camera.release()


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
