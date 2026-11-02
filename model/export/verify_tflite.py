import glob, json, numpy as np, random
from PIL import Image
from ai_edge_litert.interpreter import Interpreter
names = json.load(open('../datasets/merged/classes.json'))
it = Interpreter(model_path='tfl_out/guideai_float32.tflite'); it.allocate_tensors()
i, o = it.get_input_details()[0], it.get_output_details()[0]
print('input', i['shape'].tolist(), i['dtype'].__name__, '| output', o['shape'].tolist(), '| classes', len(names))
def letterbox(img):
    w, h = img.size; s = min(320 / w, 320 / h); nw, nh = round(w * s), round(h * s)
    c = Image.new('RGB', (320, 320), (114, 114, 114)); c.paste(img.resize((nw, nh), Image.BILINEAR), ((320 - nw) // 2, (320 - nh) // 2)); return c
def detect(path):
    x = np.asarray(letterbox(Image.open(path).convert('RGB')), np.float32)[None] / 255
    it.set_tensor(i['index'], x); it.invoke(); y = it.get_tensor(o['index'])[0]
    sc = y[4:]; cls = sc.argmax(0); conf = sc.max(0); keep = conf > 0.4
    found = sorted({(names[c], round(float(conf[k]), 2)) for k, c in enumerate(cls) if keep[k]}, key=lambda t: -t[1])
    seen = {}
    for n, cf in found: seen.setdefault(n, cf)
    return seen
def truth(path):
    lp = path.replace('images', 'labels').rsplit('.', 1)[0] + '.txt'
    return sorted({names[int(l.split()[0])] for l in open(lp) if l.strip()})
random.seed(1)
tests = glob.glob('../datasets/merged/images/test/*.jpg')
picks = []
for src in ['ph_vehicles', 'stairs_rf1', 'pothole_ivcnz', 'open_manhole', 'vip_navigation_bd']:
    picks += random.sample([t for t in tests if src in t], 2)
for p in picks:
    print(p.split('/')[-1][:32].ljust(33), 'truth:', truth(p), '\n'.ljust(35), 'tflite:', detect(p))
