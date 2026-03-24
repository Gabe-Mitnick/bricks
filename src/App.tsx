import { useState, useCallback, useEffect } from 'react'
import Scene from './components/Scene'
import TextLayer from './components/TextLayer'
import Controls from './components/Controls'
import DebugMenu from './components/DebugMenu'
import { moments } from './steps'
import styles from './styles/app.module.css'

export interface CameraConfig {
  fov: number   // 0 = orthographic, >0 = perspective (degrees)
  zoom: number  // orthographic zoom level
}

const DEFAULT_CAMERA: CameraConfig = { fov: 0, zoom: 50 }


export default function App() {
  const [currentMoment, setCurrentMoment] = useState(0)
  const [cameraConfig, setCameraConfig] = useState<CameraConfig>(DEFAULT_CAMERA)

  const goNext = useCallback(() => setCurrentMoment((s) => Math.min(s + 1, moments.length - 1)), [])
  const goPrev = useCallback(() => setCurrentMoment((s) => Math.max(s - 1, 0)), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  return (
    <div className={styles.container}>
      <div className={styles.canvasLayer}>
        <Scene targetConfig={moments[currentMoment].scene} cameraConfig={cameraConfig} />
      </div>
      <div className={styles.textLayer}>
        <TextLayer moments={moments} currentMoment={currentMoment} />
      </div>
      <div className={styles.controlsLayer}>
        <Controls
          currentStep={currentMoment}
          totalSteps={moments.length}
          onPrev={goPrev}
          onNext={goNext}
        />
      </div>
      {import.meta.env.DEV && (
        <DebugMenu config={cameraConfig} onChange={setCameraConfig} />
      )}
    </div>
  )
}
