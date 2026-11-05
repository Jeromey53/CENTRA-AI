export class CameraEngine {
  private stream: MediaStream | null = null

  async start(video: HTMLVideoElement, facingMode: 'user' | 'environment', deviceId?: string) {
    this.stop()
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera access is not available in this browser. Open CENTRA over HTTPS or localhost.')
    }

    const videoConstraint: MediaTrackConstraints = deviceId
      ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
      : { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraint })
    video.muted = true
    video.playsInline = true
    video.srcObject = this.stream
    await video.play()
    return this.stream
  }

  async listCameras() {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((device) => device.kind === 'videoinput')
  }

  stop() {
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
  }
}