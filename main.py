import cv2
from ultralytics import YOLO

# 1. Load your trained model
# Make sure 'best.pt' is in the same folder as this script
model = YOLO('best.pt') 

# 2. Open the video source
# Use 0 for the default webcam, or 'video.mp4' for a file
cap = cv2.VideoCapture(0)

print("Press 'q' to quit the application")

while cap.isOpened():
    success, frame = cap.read()
    if not success:
        break

    # 3. Run YOLOv8 inference on the frame
    # conf=0.5 helps filter out weak/uncertain detections
    results = model(frame, conf=0.5)

    # Initialize counters for this frame
    focused_count = 0
    distracted_count = 0

    # 4. Process results and extract counts
    for r in results:
        for box in r.boxes:
            # Get the class name (focused or distracted)
            class_id = int(box.cls[0])
            label = model.names[class_id]
            
            if label == 'focused':
                focused_count += 1
            else:
                distracted_count += 1

    # 5. Visualize the detections on the frame
    annotated_frame = results[0].plot()

    # 6. Overlay the "Engagement Score" on the screen
    total = focused_count + distracted_count
    if total > 0:
        focus_percent = (focused_count / total) * 100
        cv2.putText(annotated_frame, f"Class Focus: {focus_percent:.1f}%", (10, 30), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        cv2.putText(annotated_frame, f"Present: {total}", (10, 70), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

    # 7. Display the frame
    cv2.imshow("AI Classroom Monitor", annotated_frame)

    # Break the loop if 'q' is pressed
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Clean up
cap.release()
cv2.destroyAllWindows()