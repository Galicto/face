# 👁️ AI Face Recognition Dashboard

Real-time face recognition dashboard powered by **YOLOv8** and **FastAPI**.

![Dashboard Screenshot](https://raw.githubusercontent.com/rajaryan/face/main/screenshots/dashboard.png)

## Features

- 🎥 **Live MJPEG video stream** with YOLOv8 detection overlays
- 🧑 **Per-identity cards** showing Present/Absent status for each known person
- 📊 **Detection Confidence Ring** — animated SVG gauge
- 📜 **Activity Log** — real-time arrival/departure events with timestamps
- 📈 **Session Stats** — unique people, peak faces, session timer, total detections
- ⚡ **WebSocket** for real-time data push (REST polling fallback)

## Quick Start

```bash
# Install dependencies
pip install fastapi uvicorn ultralytics opencv-python-headless websockets

# Place your YOLO model as best.pt in the project root

# Run
python app.py
# → Open http://localhost:8000
```

## Tech Stack

- **Backend**: FastAPI + Uvicorn
- **AI Model**: YOLOv8 (Ultralytics)
- **Frontend**: Vanilla HTML/CSS/JS with glassmorphic dark-mode design
- **Real-time**: WebSocket + MJPEG streaming

## Project Structure

```
face/
├── app.py              # FastAPI backend
├── best.pt             # YOLO model (not tracked in git)
├── main.py             # Original OpenCV script
└── static/
    ├── index.html      # Dashboard HTML
    ├── style.css       # Premium dark-mode CSS
    └── script.js       # WebSocket real-time updates
```

## License

MIT
