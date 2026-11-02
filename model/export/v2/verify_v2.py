"""
Check the converted v2 TFLite model against the original PyTorch weights: same input/output shape
as the app expects, and the same per-class scores on real test images (letterboxed like the app).
"""
import glob
import numpy as np
from PIL import Image
from ai_edge_litert.interpreter import Interpreter


def letterbox(img, size=320):
    w, h = img.size
    s = min(size / w, size / h)
    nw, nh = round(w * s), round(h * s)
    canvas = Image.new('RGB', (size, size), (114, 114, 114))
    canvas.paste(img.resize((nw, nh), Image.BILINEAR), ((size - nw) // 2, (size - nh) // 2))
    return canvas


def main():
    from ultralytics import YOLO
    it = Interpreter(model_path='tfl_out/guideai_v2_float32.tflite')
    it.allocate_tensors()
    i, o = it.get_input_details()[0], it.get_output_details()[0]
    print('input', i['shape'].tolist(), i['dtype'].__name__, '| output', o['shape'].tolist())
    assert i['shape'].tolist() == [1, 320, 320, 3], 'app expects a 1x320x320x3 input'
    assert o['shape'].tolist() == [1, 29, 2100], 'app expects a 1x29x2100 output (4 box + 25 classes)'

    pt = YOLO('../../runs/guideai_v2/weights/best.pt')
    paths = sorted(glob.glob('../../datasets/merged/images/test/*.jpg'))[::10]
    diffs, agree, total = [], 0, 0
    for p in paths:
        lb = letterbox(Image.open(p).convert('RGB'))
        x = np.asarray(lb, np.float32)[None] / 255.0
        it.set_tensor(i['index'], x)
        it.invoke()
        y = it.get_tensor(o['index'])[0]          # [29, 2100]
        tfl_best = y[4:].max(axis=1)              # best score per class
        r = pt.predict(lb, imgsz=320, conf=0.01, device=0, verbose=False)[0]
        pt_best = np.zeros(25)
        for c, cf in zip(r.boxes.cls.tolist(), r.boxes.conf.tolist()):
            pt_best[int(c)] = max(pt_best[int(c)], cf)
        for c in range(25):
            if max(tfl_best[c], pt_best[c]) >= 0.25:
                diffs.append(abs(tfl_best[c] - pt_best[c]))
                total += 1
                agree += (tfl_best[c] >= 0.35) == (pt_best[c] >= 0.35)
    diffs = np.array(diffs)
    print(f'{len(paths)} test images, {total} class detections compared')
    print(f'score difference: median {np.median(diffs):.4f}, 95th percentile {np.percentile(diffs, 95):.4f}')
    print(f'same decision at 0.35: {agree}/{total}')


if __name__ == '__main__':
    main()
