/**
 * Class labels in the exact order of each model's outputs.
 *
 * The app picks the list from the model's output size (labelsForOutputShape), so a model file
 * and its labels can never get out of step: e.g. an older install still running the ready-made
 * model keeps announcing correct names until the GuideAI model reaches it.
 */

/** 80 COCO classes of the ready-made YOLO11n model */
export const YOLO_LABELS: string[] = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
  'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
  'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
  'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
  'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
  'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator',
  'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush',
];

/**
 * GuideAI's own model (model/train.py), trained on Philippine streets: tricycles, jeepneys,
 * potholes, open drains, stairs… Same order as model/datasets/merged/data.yaml.
 */
export const GUIDEAI_LABELS: string[] = [
  'person', 'bicycle', 'car', 'motorcycle', 'tricycle', 'jeepney', 'bus', 'truck', 'dog', 'cat',
  'cow', 'horse', 'pothole', 'open_drainage', 'stairs', 'pole', 'barrier', 'bump',
  'cart', 'bench', 'chair', 'fire hydrant', 'potted plant', 'traffic light', 'stop sign',
];

/**
 * GuideAI v3 (model/colab/GuideAI_train_v3.ipynb): the 25 classes above, unchanged and in the same
 * order, plus 20 everyday indoor classes. Same order as model/datasets/merged_v3/data.yaml.
 */
export const GUIDEAI_V3_LABELS: string[] = [
  ...GUIDEAI_LABELS,
  'table', 'sofa', 'bed', 'toilet', 'tv', 'laptop', 'keyboard', 'cell phone', 'refrigerator',
  'microwave', 'oven', 'sink', 'bottle', 'cup', 'backpack', 'handbag', 'suitcase', 'umbrella',
  'bird', 'sheep',
];

const KNOWN_LABEL_SETS = [YOLO_LABELS, GUIDEAI_LABELS, GUIDEAI_V3_LABELS];

/**
 * Labels matching a YOLO output shape ([1, 4 + classes, N] or [1, N, 4 + classes]).
 * Unknown models get no names (detections become "class_N" and are never announced) rather
 * than wrong names, which would make the app announce the wrong hazard.
 */
export function labelsForOutputShape(shape: number[]): string[] {
  const dims = shape.slice(1);
  return KNOWN_LABEL_SETS.find((labels) => dims.includes(labels.length + 4)) ?? [];
}
