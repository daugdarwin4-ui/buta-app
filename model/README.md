# GuideAI — YOLO Object Detection Model & Pipeline

This directory contains the machine learning dataset definitions, training scripts, and export utilities for the GuideAI visual assistance model.

---

## 🎯 Target Philippine Hazard Classes

The model is trained on standard COCO classes with a focus on typical Philippine urban pedestrian obstacles:

| Class Index | Label | Risk Level | Description |
|---|---|---|---|
| 0 | `person` | Info | Pedestrians in path |
| 1 | `bicycle` | Info | Bicycles and pushcarts |
| 2 | `car` | Warning | Motor vehicles / parked cars |
| 3 | `motorcycle` | Critical | High-speed motorcycles, tricycles |
| 5 | `bus` | Critical | Public utility buses |
| 7 | `truck` | Critical | Delivery trucks / large vehicles |
| 9 | `traffic light` | Info | Pedestrian crossing signals |
| 11 | `stop sign` | Warning | Stop markers |
| 12 | `parking meter` | Warning | Metal street poles |
| 13 | `bench` | Warning | Sidewalk benches |
| 14 | `dog` | Warning | Stray animals |
| 90 | `pole` | Warning | Utility poles / electric posts |
| 91 | `pothole` | Critical | Sidewalk holes / open drainage |
| 92 | `stairs` | Critical | Up/down stairs, curbs |
| 93 | `construction` | Critical | Scaffolding, barriers, road work |

---

## 🚀 Training & ONNX Export

### 1. Training with Ultralytics YOLOv11
```bash
pip install ultralytics onnx

yolo train \
  model=yolo11n.pt \
  data=dataset.yaml \
  epochs=100 \
  imgsz=640 \
  device=0
```

### 2. Exporting to ONNX for Mobile
```bash
yolo export \
  model=runs/detect/train/weights/best.pt \
  format=onnx \
  opset=12 \
  simplify=True \
  dynamic=False \
  imgsz=640
```

### 3. Deploying to App
Copy the exported `.onnx` model into the mobile assets directory:
```bash
cp runs/detect/train/weights/best.onnx ../mobile/assets/models/yolov11n.onnx
```
