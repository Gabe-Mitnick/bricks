import { useState, useEffect, useRef } from 'react'
import { Step } from '../steps'
import styles from '../styles/textLayer.module.css'

interface Props {
  steps: Step[]
  currentStep: number
}

type Position = 'center' | 'off-left' | 'off-right'

interface Panel {
  step: Step
  position: Position
  exiting: boolean
  key: number
}

export default function TextLayer({ steps, currentStep }: Props) {
  const [panels, setPanels] = useState<Panel[]>([
    { step: steps[0], position: 'center', exiting: false, key: 0 },
  ])
  const prevStep = useRef(currentStep)

  useEffect(() => {
    if (currentStep === prevStep.current) return

    const goingForward = currentStep > prevStep.current
    const exitTo: Position  = goingForward ? 'off-left'  : 'off-right'
    const enterFrom: Position = goingForward ? 'off-right' : 'off-left'
    const keyVal = currentStep

    setPanels((prev) => {
      const updated = prev.map((p) =>
        p.position === 'center' ? { ...p, position: exitTo, exiting: true } : p,
      )
      return [...updated, { step: steps[currentStep], position: enterFrom, exiting: false, key: keyVal }]
    })

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPanels((prev) =>
          prev.map((p) => (p.key === keyVal ? { ...p, position: 'center' } : p)),
        )
      })
    })

    prevStep.current = currentStep
  }, [currentStep, steps])

  const handleTransitionEnd = (key: number, exiting: boolean) => {
    if (exiting) {
      setPanels((prev) => prev.filter((p) => p.key !== key))
    }
  }

  return (
    <>
      {panels.map((panel) => (
        <div
          key={panel.key}
          className={`${styles.panel} ${styles[panel.position]}`}
          onTransitionEnd={() => handleTransitionEnd(panel.key, panel.exiting)}
        >
          <h2 className={styles.title}>{panel.step.title}</h2>
          <p className={styles.text}>{panel.step.text}</p>
        </div>
      ))}
    </>
  )
}
