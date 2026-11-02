// node rf_download.js  (reads ROBOFLOW key from env RF) — downloads YOLO-format zips next to this script's raw/ folder
const fs = require('fs');
const key = process.env.RF;
const sets = [
  ['thesis-vdkcz/vehicle-classification-philippines', 3, 'ph_vehicles'],
  ['umean/niluto1', 1, 'ph_tricycle_niluto'],
  ['qassim-university-rgdar/open-manhole-image-dataset6', 1, 'open_manhole'],
  ['stairs-n9kkx/stairs-lusiz', 1, 'stairs_rf1'],
  ['tom-lai-8bp7n/stairs-i2yia', 3, 'stairs_rf2'],
  ['su0401-hanyang-ac-kr/drainage-h5j8a', 1, 'drainage'],
];
(async () => {
  for (const [slug, ver, name] of sets) {
    const out = `raw/${name}.zip`;
    if (fs.existsSync(out) && fs.statSync(out).size > 1e5) { console.log(name, 'already downloaded'); continue; }
    const meta = await (await fetch(`https://api.roboflow.com/${slug}/${ver}/yolov8?api_key=${key}`)).json();
    const link = meta.export && meta.export.link;
    if (!link) { console.log(name, 'NO LINK', JSON.stringify(meta).slice(0, 200)); continue; }
    const res = await fetch(link);
    fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    console.log(name, (fs.statSync(out).size / 1e6).toFixed(0) + 'MB');
  }
})();
