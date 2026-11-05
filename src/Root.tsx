import { useState } from 'react'
import CameraStudio from './components/CameraStudio'
import HomePage from './components/HomePage'

function Root() {
  const [studio, setStudio] = useState(false)
  return studio
    ? <CameraStudio onExit={() => setStudio(false)} />
    : <HomePage onLaunch={() => setStudio(true)} />
}

export default Root