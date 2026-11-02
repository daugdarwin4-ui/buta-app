# Making the AI model file for the GuideAI app

The app loads one file: **`mobile/assets/models/guideai_yolo11n_320.tflite`**.

> ✅ **Current model (2026-10-09): GuideAI's own YOLO11n, 320 px, 25 classes**, trained on this PC with
> `model/train.py` on the merged dataset in `model/datasets/` (Philippine vehicles incl. tricycles and
> jeepneys, potholes, open manholes, stairs, sidewalk obstacles). Test-set results: mAP50 0.55 overall —
> strong on tricycle 0.92, jeepney 0.88, bus 0.96, person 0.85, car 0.84, stairs 0.75; weak on pothole
> 0.52, open drain 0.38, barrier 0.21 (more local photos needed). The ready-made COCO model is kept at
> `model/export/coco_yolo11n_float32.tflite`.
>
> The app picks the label list from the model's output shape (`labelsForOutputShape` in
> `mobile/src/services/detection/yolo/yoloLabels.ts`), so a new model with a different class list
> needs its list added there (same order as `data.yaml`).

## Retraining (e.g. after adding Dumaguete photos)

```bash
cd model
datasets/build_dataset.py, datasets/pseudo_label.py   # rebuild the merged dataset (see their headers)
train-venv/Scripts/python.exe train.py                # GPU training; resumes if interrupted
train-venv/Scripts/python.exe watch_training.py       # live progress
```
Then export (Windows: ONNX + onnx2tf, below), copy `*_float32.tflite` over the app's model file, and
publish an OTA update — no new APK needed.

---

## Step 1 — Ready-made model (no training)

This model already recognizes: person, bicycle, car, motorcycle, bus, truck, dog,
bench, traffic light, stop sign, and 70 other everyday objects.

1. Open https://colab.research.google.com and create a new notebook.
2. Run this in a cell:

   ```python
   !pip install ultralytics
   from ultralytics import YOLO

   model = YOLO("yolo11n.pt")  # downloads the ready-made model
   model.export(format="tflite", imgsz=320)  # 320 px input = fast enough for phones
   ```

3. In the Colab file panel (folder icon on the left), open
   `yolo11n_saved_model/` and download **`yolo11n_float32.tflite`**.
4. Put it in `mobile/assets/models/yolo11n_float32.tflite`.

What the app expects from this file (do not change these export settings):

| Setting | Value |
|---|---|
| Input | 320 × 320 RGB image, float32, values 0–1 (shape `[1, 320, 320, 3]`) |
| Output | `[1, 84, 2100]` — 4 box values + 80 class scores for 2100 candidate boxes |
| Box format | center x, center y, width, height, normalized 0–1 |

---

## Step 2 (optional, later) — Teach it Philippine street hazards

The ready-made model does **not** know potholes, open canals/drainage, stairs, or tricycles.
To add them, fine-tune on extra photos:

1. Collect labeled photos:
   - Free datasets on https://universe.roboflow.com (search "pothole", "stairs", "open manhole", "tricycle").
   - Your own photos around Dumaguete (aim for 100+ per hazard, different times of day).
2. Label your own photos in Roboflow (free), export in **YOLO** format.
3. In Colab:

   ```python
   !pip install ultralytics
   from ultralytics import YOLO

   model = YOLO("yolo11n.pt")
   model.train(data="/content/dataset/data.yaml", epochs=100, imgsz=320)
   model = YOLO("runs/detect/train/weights/best.pt")
   model.export(format="tflite", imgsz=320)
   ```

4. Tell the developer the **exact class list** from your `data.yaml`, because the app's label
   list (`YOLO_LABELS` in `mobile/src/services/detection/yolo/yoloLabels.ts`) must match
   it in the same order.

> Keep `imgsz=320` in both training and export so the app's input size stays the same.

---

## Exporting on Windows (no Colab)

Ultralytics' direct TFLite export only runs on Linux/macOS. On Windows, export to ONNX first and
convert with `onnx2tf` (this is how the bundled model was made):

```bash
pip install ultralytics onnx2tf tensorflow tf_keras onnx_graphsurgeon sng4onnx ai_edge_litert
yolo export model=best.pt format=onnx imgsz=320 opset=17 simplify=True
onnx2tf -i best.onnx -o tfl_out -nuo
```

Use `tfl_out/best_float32.tflite`, renamed to `yolo11n_float32.tflite` (or update `MODEL_ASSET` in
`mobile/src/services/detection/sources/cameraSource.ts`).

Expected model shape — the app checks against this:

| | Shape |
|---|---|
| Input | `[1, 320, 320, 3]` float32 |
| Output | `[1, 4 + number_of_classes, 2100]` float32 |

After replacing the model, also update the class list in
`mobile/src/services/detection/yolo/yoloLabels.ts` and add any new hazards you want announced to
`mobile/src/constants/hazards.ts` (labels must match exactly).
