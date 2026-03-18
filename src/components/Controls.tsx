import styles from '../styles/controls.module.css'

interface Props {
  currentStep: number
  totalSteps: number
  onPrev: () => void
  onNext: () => void
}

const Chevron = ({ mirrored = false }: { mirrored?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"
       style={mirrored ? { transform: 'scaleX(-1)' } : undefined}>
    <path d="M13 4L6 10L13 16" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function Controls({ currentStep, totalSteps, onPrev, onNext }: Props) {
  const isFirst = currentStep === 0
  const isLast  = currentStep === totalSteps - 1

  return (
    <div className={styles.controls}>
      <button
        className={`${styles.btn} ${isFirst ? styles.hidden : ''}`}
        onClick={onPrev}
        aria-label="Previous"
        tabIndex={isFirst ? -1 : 0}
      >
        <Chevron />
      </button>
      <button
        className={`${styles.btn} ${isLast ? styles.hidden : ''}`}
        onClick={onNext}
        aria-label="Next"
        tabIndex={isLast ? -1 : 0}
      >
        <Chevron mirrored />
      </button>
    </div>
  )
}
