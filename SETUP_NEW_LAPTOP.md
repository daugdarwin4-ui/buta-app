# Setting up GuideAI (BUTA APP) on another laptop

The project is stored in three places:

| What | Where |
|---|---|
| Code, trained models, Colab notebook, capstone paper, hardware docs | **Private GitHub repository** |
| Datasets (about 7 GB, too big for GitHub) | **Google Drive**, folder *My Drive/GuideAI* |
| Secrets: `mobile/.env` (Gemini API key) and `server/.env` | **Copy by hand** (USB or a private message), never GitHub |

Left out of GitHub and recreated below: `mobile/node_modules`, `server/node_modules`,
`model/train-venv`, `mobile/android`, `mobile/dist`, `mobile/.expo`.

## 0. Download the project

```bash
cd Desktop
git clone <your private repository URL> "BUTA APP"
```
Git asks you to sign in to GitHub in the browser the first time.

Then copy the two `.env` files into `BUTA APP/mobile/.env` and `BUTA APP/server/.env`.

**Datasets (only if you will retrain):** from *My Drive/GuideAI*, download
`guideai_v3_dataset.zip` (the 45-class training set) and, if you uploaded them, the raw dataset
downloads. Unzip `guideai_v3_dataset.zip` into `BUTA APP/model/datasets/` (it creates `merged_v3/`).
Training on Colab only needs the zip on Drive; nothing has to be downloaded.

---

## 1. Install the tools

| Tool | Version used | Get it from |
|---|---|---|
| Node.js | 24.x (LTS is fine) | https://nodejs.org |
| Git | any | https://git-scm.com |
| VS Code | any | https://code.visualstudio.com |
| Android Studio (for `adb` and the Android SDK) | latest | https://developer.android.com/studio |
| Python (only to train models on the laptop) | 3.12 | https://www.python.org |

## 3. Mobile app

```bash
cd "BUTA APP/mobile"
npm install
npx jest            # should report all tests passing
```

Publishing an update to the phones (same as before):

```bash
npx -y eas-cli@latest login          # account: tanex
npx -y eas-cli@latest update --branch preview --environment preview --platform android --message "..."
```

Building a new APK (only needed for native changes):

```bash
npx -y eas-cli@latest build -p android --profile preview
```

## 4. Server (optional backup SMS path, not hosted)

```bash
cd "BUTA APP/server"
npm install
```

## 5. Model training environment (only if you will train on this laptop)

```bash
cd "BUTA APP/model"
py -3.12 -m venv train-venv
train-venv\Scripts\python.exe -m pip install --upgrade pip
# NVIDIA GPU: install the CUDA build of PyTorch first (see https://pytorch.org for the right command), e.g.
train-venv\Scripts\python.exe -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
train-venv\Scripts\python.exe -m pip install -r requirements.txt
train-venv\Scripts\python.exe -m pip install onnx2tf tensorflow tf_keras ai_edge_litert onnxslim
```

No NVIDIA GPU? Train on Google Colab with `model/colab/GuideAI_train_v3.ipynb` instead (upload
`model/colab/guideai_v3_dataset.zip` and `model/colab/guideai_v2_best.pt` to *My Drive/GuideAI*).

Converting a trained `best.pt` to the app's model file (Colab's own TFLite export uses a layout the
app can't read — use this instead):

1. `train-venv\Scripts\python.exe -c "from ultralytics import YOLO; YOLO('best.pt').export(format='onnx', imgsz=320, simplify=True)"`
2. Copy `model/export/v2/calibration_image_sample_data_20x128x128x3_float32.npy` into the folder you run onnx2tf from.
3. `train-venv\Scripts\onnx2tf.exe -i best.onnx -o tfl_out -nuo`
4. Check it with `model/export/v3/verify_v3.py` (input must be `[1, 320, 320, 3]`).

## 6. Connect the phone

Turn on **USB debugging** on the phone (Settings → Developer options), plug it in, allow the
computer, then check:

```bash
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" devices
```
