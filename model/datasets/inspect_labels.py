import os, glob, collections, sys
root = 'src'
for name in sorted(os.listdir(root)):
    base = os.path.join(root, name)
    imgs = [p for p in glob.glob(base + '/**/*', recursive=True) if p.lower().endswith(('.jpg', '.jpeg', '.png'))]
    labels = [p for p in glob.glob(base + '/**/*.txt', recursive=True) if '/labels/' in p.replace(chr(92), '/')]
    lens = collections.Counter(); cls = collections.Counter(); empty = 0
    for p in labels:
        lines = [l.split() for l in open(p, encoding='utf-8', errors='ignore') if l.strip()]
        if not lines: empty += 1
        for l in lines:
            lens[len(l)] += 1; cls[l[0]] += 1
    print(f'== {name}: {len(imgs)} images, {len(labels)} label files ({empty} empty)')
    print('   values per line:', dict(lens.most_common(5)))
    print('   class ids:', dict(sorted(cls.items(), key=lambda kv: -kv[1])[:25]))
