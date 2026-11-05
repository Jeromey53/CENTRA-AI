export type Recording = { blob: Blob; url: string; mimeType: string }

export class VideoRecorder {
  private recorder: MediaRecorder | null = null
  private chunks: BlobPart[] = []

  start(canvas: HTMLCanvasElement, onComplete: (recording: Recording) => void) {
    if (!('MediaRecorder' in window) || typeof canvas.captureStream !== 'function') {
      throw new Error('Canvas recording is not supported by this browser.')
    }
    const mimeType = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/mp4;codecs=h264', 'video/webm']
      .find((type) => MediaRecorder.isTypeSupported(type))
    if (!mimeType) throw new Error('Video recording is not supported by this browser.')
    const stream = canvas.captureStream(30)
    this.chunks = []
    this.recorder = new MediaRecorder(stream, { mimeType })
    this.recorder.ondataavailable = (event) => {
      if (event.data.size) this.chunks.push(event.data)
    }
    this.recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop())
      const blob = new Blob(this.chunks, { type: mimeType })
      onComplete({ blob, url: URL.createObjectURL(blob), mimeType })
      this.chunks = []
    }
    this.recorder.start()
  }

  stop() {
    if (this.recorder?.state === 'recording') this.recorder.stop()
  }

  get recording() {
    return this.recorder?.state === 'recording'
  }
}