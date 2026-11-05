# CENTRA AI

CENTRA AI is a browser camera studio that reframes a live camera stream around detected faces and poses. Detection and video processing run on-device; camera footage is never sent to an application server.

## Run locally

Use Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Camera access requires HTTPS or `localhost`. The first studio launch downloads face and pose model files from Google MediaPipe model hosting; the WASM runtime is copied from the installed package into `public/mediapipe` before development and production builds.

## Architecture

- `CameraEngine` owns `getUserMedia`, camera selection, and stream cleanup.
- `AITrackingEngine` runs MediaPipe face and pose detection and combines subject bounds.
- `CameraStudio` schedules throttled detection, smooths and predicts crop movement, and renders the reframed stream to a canvas.
- `VideoRecorder` captures the canvas stream with the browser's supported `MediaRecorder` format.
- `LocalStore` persists camera preferences and recording blobs in IndexedDB.
- `HomePage` and `CameraStudio` provide the landing and camera interfaces.
- `public/manifest.webmanifest` and `public/sw.js` provide install metadata and the production app shell.

The canvas is the source for both preview and recording. Audio is intentionally not requested or recorded. The PWA shell is cached locally; camera models are currently fetched from MediaPipe hosting when the studio initializes.

## Verify and deploy

```sh
npm run lint
npm run build
npm run preview
```

Deploy the Vite output to Vercel or another static host with HTTPS enabled. On iPhone, open the HTTPS deployment in Safari and use **Add to Home Screen**. Browser support depends on that browser's `getUserMedia`, WebAssembly/WebGL, `canvas.captureStream`, and `MediaRecorder` implementations.