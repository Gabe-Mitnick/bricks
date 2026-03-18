import { useState, useCallback, useEffect } from 'react'
import Scene from './components/Scene'
import TextLayer from './components/TextLayer'
import Controls from './components/Controls'
import { steps } from './steps'
import styles from './styles/app.module.css'

export default function App() {
  const [currentStep, setCurrentStep] = useState(0)

  const goNext = useCallback(() => setCurrentStep((s) => Math.min(s + 1, steps.length - 1)), [])
  const goPrev = useCallback(() => setCurrentStep((s) => Math.max(s - 1, 0)), [])

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
        <Scene targetConfig={steps[currentStep].scene} />
      </div>
      <div className={styles.textLayer}>
        <TextLayer steps={steps} currentStep={currentStep} />
      </div>
      <div className={styles.controlsLayer}>
        <Controls
          currentStep={currentStep}
          totalSteps={steps.length}
          onPrev={goPrev}
          onNext={goNext}
        />
      </div>
    </div>
  )
}
