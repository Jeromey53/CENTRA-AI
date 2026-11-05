import { FaceDetector, FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

export type TrackingBox = { x: number; y: number; width: number; height: number }
export type TrackingOptions = { face: boolean; body: boolean }

const visionWasm = `${import.meta.env.BASE_URL}mediapipe`
const faceModel = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'
const poseModel = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

async function createWithFallback<T>(factory: (delegate: 'GPU' | 'CPU') => Promise<T>) {
  try {
    return await factory('GPU')
  } catch {
    return factory('CPU')
  }
}

export class AITrackingEngine {
  private face: FaceDetector
  private pose: PoseLandmarker

  private constructor(face: FaceDetector, pose: PoseLandmarker) {
    this.face = face
    this.pose = pose
  }

  static async create() {
    const files = await FilesetResolver.forVisionTasks(visionWasm)
    const [face, pose] = await Promise.all([
      createWithFallback((delegate) => FaceDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: faceModel, delegate },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.45,
        minSuppressionThreshold: 0.3,
      })),
      createWithFallback((delegate) => PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: poseModel, delegate },
        runningMode: 'VIDEO',
        numPoses: 4,
        minPoseDetectionConfidence: 0.35,
        minTrackingConfidence: 0.35,
        outputSegmentationMasks: false,
      })),
    ])
    return new AITrackingEngine(face, pose)
  }

  detect(video: HTMLVideoElement, timestamp: number, options: TrackingOptions): TrackingBox | null {
    const boxes: TrackingBox[] = []
    if (options.face) {
      const detections = this.face.detectForVideo(video, timestamp).detections
      for (const detection of detections) {
        const bounds = detection.boundingBox
        if (bounds) boxes.push({
          x: bounds.originX / video.videoWidth,
          y: bounds.originY / video.videoHeight,
          width: bounds.width / video.videoWidth,
          height: bounds.height / video.videoHeight,
        })
      }
    }
    if (options.body) {
      const poses = this.pose.detectForVideo(video, timestamp).landmarks
      for (const landmarks of poses) {
        const visible = landmarks.filter((point) => (point.visibility ?? 1) > 0.25)
        if (visible.length < 4) continue
        const xs = visible.map((point) => point.x)
        const ys = visible.map((point) => point.y)
        const left = Math.max(0, Math.min(...xs))
        const top = Math.max(0, Math.min(...ys))
        const right = Math.min(1, Math.max(...xs))
        const bottom = Math.min(1, Math.max(...ys))
        if (right > left && bottom > top) boxes.push({ x: left, y: top, width: right - left, height: bottom - top })
      }
    }
    if (!boxes.length) return null
    const left = Math.min(...boxes.map((box) => box.x))
    const top = Math.min(...boxes.map((box) => box.y))
    const right = Math.max(...boxes.map((box) => box.x + box.width))
    const bottom = Math.max(...boxes.map((box) => box.y + box.height))
    return { x: left, y: top, width: right - left, height: bottom - top }
  }

  close() {
    this.face.close()
    this.pose.close()
  }
}