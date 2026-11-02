#!/bin/bash
# Resumable downloader: re-run safely any time; finished zips are skipped, partial ones continue.
# Needs env var RF (Roboflow private API key) for the Roboflow sets.
cd "$(dirname "$0")/raw"
dl() { # name url
  local out="$1.zip" url="$2"
  if unzip -tq "$out" >/dev/null 2>&1; then echo "$1 OK (already)"; return; fi
  for i in $(seq 1 40); do
    curl -sSL -C - --retry 5 --retry-all-errors --retry-delay 3 --connect-timeout 30 -o "$out" "$url" 2>/dev/null
    if unzip -tq "$out" >/dev/null 2>&1; then echo "$1 OK $(du -h "$out" | cut -f1)"; return; fi
    # a bad/oversized partial (e.g. expired link served an error page) restarts clean
    [ -f "$out" ] && [ "$(stat -c %s "$out")" -lt 2000 ] && rm -f "$out"
    sleep 5
  done
  echo "$1 FAILED"
}
rf() { # name slug version
  local link
  for i in 1 2 3 4 5; do
    link=$(curl -s "https://api.roboflow.com/$2/$3/yolov8?api_key=$RF" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).export.link||'')}catch(e){}})")
    [ -n "$link" ] && break; sleep 5
  done
  [ -z "$link" ] && { echo "$1 NO LINK"; return; }
  dl "$1" "$link"
}
dl pothole_ivcnz "https://github.com/jaygala24/pothole-detection/releases/download/v1.0.0/Pothole.Dataset.IVCNZ.zip"
rf ph_vehicles thesis-vdkcz/vehicle-classification-philippines 3
rf ph_tricycle_niluto umean/niluto1 1
rf open_manhole qassim-university-rgdar/open-manhole-image-dataset6 1
rf stairs_rf1 stairs-n9kkx/stairs-lusiz 1
rf stairs_rf2 tom-lai-8bp7n/stairs-i2yia 3
rf drainage su0401-hanyang-ac-kr/drainage-h5j8a 1
dl vip_navigation_bd "https://data.mendeley.com/public-api/zip/m68g3h7p87/download/1"
dl stairs_lines "https://data.mendeley.com/public-api/zip/3jjdm6rn96/download/3"
echo ALL_DONE
