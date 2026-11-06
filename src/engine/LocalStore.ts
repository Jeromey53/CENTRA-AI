import type { Recording } from './VideoRecorder'

export type CameraPreferences = {
  trackingOn: boolean
  faceOn: boolean
  bodyOn: boolean
  mirror: boolean
  sensitivity: number
  zoom: number
  autoZoom?: boolean
  autoRotate?: boolean
}

let databasePromise: Promise<IDBDatabase> | null = null

function database() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB is unavailable.'))
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('centra-ai-local', 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' })
        if (!db.objectStoreNames.contains('recordings')) db.createObjectStore('recordings', { keyPath: 'id' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  return databasePromise
}

export async function readPreferences() {
  const db = await database()
  return new Promise<CameraPreferences | undefined>((resolve, reject) => {
    const request = db.transaction('settings', 'readonly').objectStore('settings').get('camera')
    request.onsuccess = () => resolve(request.result?.value as CameraPreferences | undefined)
    request.onerror = () => reject(request.error)
  })
}

export async function writePreferences(value: CameraPreferences) {
  const db = await database()
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction('settings', 'readwrite').objectStore('settings').put({ key: 'camera', value })
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function saveRecording(recording: Recording) {
  const db = await database()
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction('recordings', 'readwrite').objectStore('recordings').put({
      id: crypto.randomUUID(),
      blob: recording.blob,
      mimeType: recording.mimeType,
      createdAt: Date.now(),
    })
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}