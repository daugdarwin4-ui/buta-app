# Unattended retraining of the GuideAI model with everyday (COCO) photos added.
# Start detached:  Start-Process powershell -ArgumentList '-ExecutionPolicy','Bypass','-File','retrain_v2.ps1' -WindowStyle Hidden
# Progress:        retrain_v2.log   (training itself: train-venv\Scripts\python.exe watch_training.py)
# Safe to run again: finished steps are skipped and an interrupted training resumes.

Set-Location $PSScriptRoot
$py = ".\train-venv\Scripts\python.exe"
$log = "retrain_v2.log"
function Say($m) { "$(Get-Date -Format 'HH:mm:ss') $m" | Out-File -FilePath $log -Append -Encoding utf8 }

Say "waiting for the COCO download to finish"
while ($true) {
    # The zip's index is at its end, so it only opens once the download is complete
    & $py -c "import zipfile; zipfile.ZipFile(r'datasets\raw\coco_val2017.zip')" 2>$null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 30
}
Say "download complete"

if (-not (Test-Path "datasets\merged\coco_added.flag")) {
    Say "adding COCO photos to the merged dataset"
    & $py datasets\add_coco.py *>> $log
    if ($LASTEXITCODE -ne 0) { Say "FAILED: add_coco"; exit 1 }
    Say "teacher labeling the COCO photos"
    & $py datasets\pseudo_label.py coco_ *>> $log
    if ($LASTEXITCODE -ne 0) { Say "FAILED: pseudo_label"; exit 1 }
    "done" | Out-File "datasets\merged\coco_added.flag"
}

Say "training guideai_v2 (continues from the first model's best weights)"
& $py train.py --name guideai_v2 --base runs\guideai\weights\best.pt --epochs 45 *> train_v2.log
if ($LASTEXITCODE -ne 0) { Say "FAILED: training (see train_v2.log)"; exit 1 }
Say "TRAINING FINISHED"
