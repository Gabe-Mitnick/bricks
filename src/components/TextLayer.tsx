import { ReactNode, useState, useEffect, useRef } from 'react'
import { Moment } from '../steps'
import styles from '../styles/textLayer.module.css'

interface Props {
  moments: Moment[]
  currentMoment: number
}

type AnimClass = 'enterFromRight' | 'enterFromLeft' | 'exitToLeft' | 'exitToRight' | null

interface Panel {
  stepMoment: number       // index of the step moment for this slide
  substepMoments: number[] // indices of active substeps, in order
  animClass: AnimClass
  key: number
}

// Returns the index of the step moment that begins the slide containing momentIndex
function getSlideStart(momentIndex: number, moments: Moment[]): number {
  for (let i = momentIndex; i >= 0; i--) {
    if (!moments[i].isSubstep) return i
  }
  return 0
}

// Returns the moment indices of all substeps from the slide start up to currentMoment
function getSubstepMoments(currentMoment: number, moments: Moment[]): number[] {
  const slideStart = getSlideStart(currentMoment, moments)
  const result: number[] = []
  for (let i = slideStart + 1; i <= currentMoment; i++) {
    if (moments[i].isSubstep) result.push(i)
  }
  return result
}

// Parses *text* into <em> elements
function renderText(text: string): ReactNode[] {
  return text.split(/\*([^*]+)\*/g).map((part, i) =>
    i % 2 === 1 ? <em key={i}>{part}</em> : part
  )
}

export default function TextLayer({ moments, currentMoment }: Props) {
  const panelKeyCounter = useRef(1)

  const [panels, setPanels] = useState<Panel[]>([
    { stepMoment: 0, substepMoments: [], animClass: null, key: 0 },
  ])

  const prevMoment = useRef(currentMoment)

  useEffect(() => {
    if (currentMoment === prevMoment.current) return

    const goingForward = currentMoment > prevMoment.current
    const prevSlideStart = getSlideStart(prevMoment.current, moments)
    const currSlideStart = getSlideStart(currentMoment, moments)

    if (currSlideStart !== prevSlideStart) {
      // Crossing a slide boundary — full slide transition
      const exitAnim: AnimClass = goingForward ? 'exitToLeft' : 'exitToRight'
      const enterAnim: AnimClass = goingForward ? 'enterFromRight' : 'enterFromLeft'

      setPanels((prev) => {
        const updated = prev.map((p) =>
          p.animClass?.startsWith('exit') ? p : { ...p, animClass: exitAnim }
        )
        return [...updated, {
          stepMoment: currSlideStart,
          substepMoments: getSubstepMoments(currentMoment, moments),
          animClass: enterAnim,
          key: panelKeyCounter.current++,
        }]
      })
    } else {
      // Within the same slide — update substep list without sliding
      const newSubstepMoments = getSubstepMoments(currentMoment, moments)
      setPanels((prev) => prev.map((p) =>
        p.animClass?.startsWith('exit') ? p : { ...p, substepMoments: newSubstepMoments }
      ))
    }

    prevMoment.current = currentMoment
  }, [currentMoment, moments])

  const handleAnimationEnd = (key: number, animClass: AnimClass) => {
    if (animClass?.startsWith('exit')) {
      setPanels((prev) => prev.filter((p) => p.key !== key))
    }
  }

  return (
    <>
      {panels.map((panel) => (
        <div
          key={panel.key}
          className={`${styles.panel}${panel.animClass ? ` ${styles[panel.animClass]}` : ''}`}
          onAnimationEnd={() => handleAnimationEnd(panel.key, panel.animClass)}
        >
          <p className={styles.text}>{renderText(moments[panel.stepMoment].text)}</p>
          {panel.substepMoments.map((idx) => (
            <p key={idx} className={`${styles.text} ${styles.substepText}`}>
              {renderText(moments[idx].text)}
            </p>
          ))}
        </div>
      ))}
    </>
  )
}
