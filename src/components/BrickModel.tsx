import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SceneState } from '../steps'

interface Props {
  targetConfig: SceneState
}

// Standard UK brick dimensions in mm. Key property: BD + MORTAR = (BW + MORTAR) / 2,
// so 2 headers + 1 mortar joint = 1 stretcher + 1 mortar joint.
const BW = 215    // mm — stretcher length
const BH = 65     // mm — height
const BD = 102.5  // mm — header face width
const MORTAR = 10 // mm — joint thickness

// Z offset for stretcher wythes: includes mortar between wythes so front faces
// of stretchers align with front face of headers (both at z = ±BW/2 = ±107.5mm).
const WYTHE_Z = (BD + MORTAR) / 2  // 56.25mm

const ROW_STEP = BH + MORTAR  // 75mm between row centres

const LERP = 0.05
const MAX_BRICKS = 200
const STASH_POS = new THREE.Vector3(0, -5000, 0)
const FALL_HEIGHT = 2000 // mm — how far above final position bricks start

const BASE_COLOR      = new THREE.Color('#b45c2a')
const HIGHLIGHT_COLOR = new THREE.Color('#e8a050')

// Pulse timing: STEP = ms between adjacent pulse starts, WIDTH = ms for one bell (> STEP → overlap)
// PAUSE must satisfy: (numSlots-1)*STEP + WIDTH + PAUSE > numSlots*STEP, i.e. PAUSE > WIDTH - STEP
// This prevents the last slot's tail from wrapping into the next cycle.
const COURSE_PULSE_STEP_MS  = 400
const COURSE_PULSE_WIDTH_MS = 700
const COURSE_PULSE_PAUSE_MS = 600  // > WIDTH - STEP (300ms); also adds a gap before loop restarts
const COL_PULSE_STEP_MS     = 200
const COL_PULSE_WIDTH_MS    = 400
const COL_PULSE_PAUSE_MS    = 600  // > WIDTH - STEP (200ms)

// Cascade fall animation timing
const ROW_DELAY_MS = 150    // ms between each row starting to fall
const COL_DELAY_MS = 40     // ms between each column within a row
const FALL_DURATION_MS = 350 // ms for one brick to travel FALL_HEIGHT to rest

export interface BrickDef {
  x: number
  y: number
  z: number
  rotY: number
}

// A header brick is turned 90°, so its long axis runs Z instead of X.
const HEADER_ROT_Y = Math.PI / 2

function rowY(row: number): number {
  return row * ROW_STEP
}

function stretcherX(col: number, offset: number): number {
  return col * (BW + MORTAR) + offset
}

function headerX(col: number, offset: number): number {
  // BD + MORTAR = (BW + MORTAR) / 2 exactly, so header joints align with
  // stretcher centers and mortar-joint centers in adjacent courses
  return col * (BD + MORTAR) + offset
}

function addStretcherCourse(defs: BrickDef[], cols: number, y: number, offset: number): void {
  for (let col = 0; col < cols; col++) {
    defs.push({ x: stretcherX(col, offset), y, z: -WYTHE_Z, rotY: 0 })
    defs.push({ x: stretcherX(col, offset), y, z:  WYTHE_Z, rotY: 0 })
  }
}

function addHeaderCourse(defs: BrickDef[], cols: number, y: number): void {
  for (let col = 0; col < cols * 2; col++) {
    defs.push({ x: headerX(col, 0), y, z: 0, rotY: HEADER_ROT_Y })
  }
}

function stretcherBond(rows: number, cols: number): BrickDef[] {
  const defs: BrickDef[] = []
  for (let row = 0; row < rows; row++) {
    const offset = (row % 2) * (BW + MORTAR) / 2
    for (let col = 0; col < cols; col++) {
      defs.push({ x: stretcherX(col, offset), y: rowY(row), z: 0, rotY: 0 })
    }
  }
  return defs
}

function twoWytheStretcher(rows: number, cols: number, wytheSep: number): BrickDef[] {
  const front = stretcherBond(rows, cols).map(d => ({ ...d, z: -wytheSep / 2 }))
  const back  = stretcherBond(rows, cols).map(d => ({ ...d, z:  wytheSep / 2 }))
  return [...front, ...back]
}

// American bond: 6 stretcher courses then 1 header course, repeat
function americanBond(rows: number, cols: number): BrickDef[] {
  const defs: BrickDef[] = []
  const CYCLE = 7 // 6 stretcher + 1 header
  for (let row = 0; row < rows; row++) {
    const y = rowY(row)
    if (row % CYCLE === 0) {
      addHeaderCourse(defs, cols, y)
    } else {
      addStretcherCourse(defs, cols, y, (row % 2) * (BW + MORTAR) / 2)
    }
  }
  return defs
}

// English bond: alternating full stretcher courses / full header courses
function englishBond(rows: number, cols: number): BrickDef[] {
  const defs: BrickDef[] = []
  for (let row = 0; row < rows; row++) {
    const y = rowY(row)
    if (row % 2 === 0) {
      addStretcherCourse(defs, cols, y, 0)
    } else {
      addHeaderCourse(defs, cols, y)
    }
  }
  return defs
}

// English cross bond: English but every other stretcher course offset half-brick
function englishCrossBond(rows: number, cols: number): BrickDef[] {
  const defs: BrickDef[] = []
  let stretcherCourseIdx = 0
  for (let row = 0; row < rows; row++) {
    const y = rowY(row)
    if (row % 2 === 0) {
      addStretcherCourse(defs, cols, y, (stretcherCourseIdx % 2) * (BW + MORTAR) / 2)
      stretcherCourseIdx++
    } else {
      addHeaderCourse(defs, cols, y)
    }
  }
  return defs
}

// Flemish bond: each course alternates stretcher + header, offset by 1 header per row
function flemishBond(rows: number, cols: number): BrickDef[] {
  const defs: BrickDef[] = []
  const unitW = BW + BD + 2 * MORTAR // one stretcher + one header unit
  for (let row = 0; row < rows; row++) {
    const y = rowY(row)
    const offset = (row % 2) * (unitW / 2)
    // fill enough units to cover cols-worth of width
    const totalW = cols * (BW + MORTAR)
    let x = offset - unitW
    while (x < totalW + unitW) {
      // stretcher
      defs.push({ x, y, z: -WYTHE_Z, rotY: 0 })
      defs.push({ x, y, z:  WYTHE_Z, rotY: 0 })
      // header
      const hx = x + (BW + MORTAR) / 2 + (BD + MORTAR) / 2
      defs.push({ x: hx, y, z: 0, rotY: HEADER_ROT_Y })
      x += unitW
    }
  }
  return defs
}

// Monk bond: each course has stretcher + stretcher + header, repeat
function monkBond(rows: number, cols: number): BrickDef[] {
  const defs: BrickDef[] = []
  const unitW = 2 * BW + BD + 3 * MORTAR
  for (let row = 0; row < rows; row++) {
    const y = rowY(row)
    const offset = (row % 2) * (unitW / 2)
    const totalW = cols * (BW + MORTAR)
    let x = offset - unitW
    while (x < totalW + unitW) {
      // stretcher 1
      defs.push({ x, y, z: -WYTHE_Z, rotY: 0 })
      defs.push({ x, y, z:  WYTHE_Z, rotY: 0 })
      // stretcher 2
      const x2 = x + BW + MORTAR
      defs.push({ x: x2, y, z: -WYTHE_Z, rotY: 0 })
      defs.push({ x: x2, y, z:  WYTHE_Z, rotY: 0 })
      // header
      const hx = x2 + (BW + MORTAR) / 2 + (BD + MORTAR) / 2
      defs.push({ x: hx, y, z: 0, rotY: HEADER_ROT_Y })
      x += unitW
    }
  }
  return defs
}

export function getBrickDefs(scene: SceneState): BrickDef[] {
  const { bondPattern, numWythes, rows, cols, wytheSeparation } = scene
  let defs: BrickDef[]

  if (numWythes === 1) {
    defs = stretcherBond(rows, cols)
  } else {
    switch (bondPattern) {
      case 'stretcher':    defs = twoWytheStretcher(rows, cols, wytheSeparation); break
      case 'american':     defs = americanBond(rows, cols); break
      case 'english':      defs = englishBond(rows, cols); break
      case 'englishCross': defs = englishCrossBond(rows, cols); break
      case 'flemish':      defs = flemishBond(rows, cols); break
      case 'monk':         defs = monkBond(rows, cols); break
    }
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const d of defs) {
    if (d.x < minX) minX = d.x
    if (d.x > maxX) maxX = d.x
    if (d.y < minY) minY = d.y
    if (d.y > maxY) maxY = d.y
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return defs.map(d => ({ ...d, x: d.x - cx, y: d.y - cy }))
}

// Convert a centered brick Y position back to a 0-based row index.
// Row Y values after centering are evenly spaced at ROW_STEP apart.
function rowFromY(y: number, rows: number): number {
  const minY = -(rows - 1) * ROW_STEP / 2
  return Math.round((y - minY) / ROW_STEP)
}

function approxColFromX(x: number, xRange: { min: number; max: number }, cols: number): number {
  if (xRange.max <= xRange.min) return 0
  const frac = (x - xRange.min) / (xRange.max - xRange.min)
  return Math.round(frac * (cols - 1))
}

function easeIn(t: number): number { return t * t }

function cascadeProgress(elapsed: number, row: number, col: number): number {
  const delay = row * ROW_DELAY_MS + col * COL_DELAY_MS
  return Math.min(Math.max((elapsed - delay) / FALL_DURATION_MS, 0), 1)
}

// Returns 0–1 smooth bell (sin) for a looping pulse. elapsed and delay in ms.
function pulseIntensity(elapsed: number, delay: number, pulseWidth: number, period: number): number {
  const phase = ((elapsed - delay) % period + period) % period
  if (phase >= pulseWidth) return 0
  return Math.sin((phase / pulseWidth) * Math.PI)
}

function makeMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, transparent: true, opacity: 1 })
}

export default function BrickModel({ targetConfig }: Props) {
  const geo = useRef(new THREE.BoxGeometry(BW, BH, BD))
  const brickMats = useRef<THREE.MeshStandardMaterial[]>(
    Array.from({ length: MAX_BRICKS }, () => makeMaterial('#b45c2a'))
  )

  const defs = useMemo(() => getBrickDefs(targetConfig), [targetConfig])

  // X range of current defs, for the column-highlight wave
  const xRange = useMemo(() => {
    if (defs.length === 0) return { min: 0, max: 0 }
    let min = Infinity, max = -Infinity
    for (const d of defs) {
      if (d.x < min) min = d.x
      if (d.x > max) max = d.x
    }
    return { min, max }
  }, [defs])

  const meshRefs = useRef<(THREE.Mesh | null)[]>(Array(MAX_BRICKS).fill(null))
  const lerpedRotY = useRef<number[]>(Array(MAX_BRICKS).fill(0))

  // Start active bricks above their final positions if fallProgress < 1;
  // stash bricks always start at STASH_POS.
  const lerpedPos = useRef<THREE.Vector3[]>(
    (() => {
      const initialDefs = getBrickDefs(targetConfig)
      return Array.from({ length: MAX_BRICKS }, (_, i) => {
        if (targetConfig.fallProgress < 1 && i < initialDefs.length) {
          const d = initialDefs[i]
          return new THREE.Vector3(d.x, d.y + FALL_HEIGHT, d.z)
        }
        return STASH_POS.clone()
      })
    })()
  )

  const lerpedOpacity = useRef(targetConfig.brickOpacity)

  // Wave animation state — times are in ms from clock.getElapsedTime()*1000
  const courseWaveStart = useRef<number | null>(null)
  const colWaveStart = useRef<number | null>(null)
  const prevHighlightWave = useRef(targetConfig.highlightWaveActive)
  const prevColWave = useRef(targetConfig.highlightColWaveActive)

  // Cascade fall animation state
  const fallWaveStart = useRef<number | null>(null)
  const prevFallProgress = useRef(targetConfig.fallProgress)

  useFrame(({ clock }) => {
    const now = clock.getElapsedTime() * 1000

    // --- Detect rising edges to start / reset waves ---
    if (targetConfig.highlightWaveActive && !prevHighlightWave.current) {
      courseWaveStart.current = now
    }
    if (!targetConfig.highlightWaveActive) {
      courseWaveStart.current = null
    }
    prevHighlightWave.current = targetConfig.highlightWaveActive

    if (targetConfig.highlightColWaveActive && !prevColWave.current) {
      colWaveStart.current = now
    }
    if (!targetConfig.highlightColWaveActive) {
      colWaveStart.current = null
    }
    prevColWave.current = targetConfig.highlightColWaveActive

    // --- Fall cascade rising-edge detection ---
    if (targetConfig.fallProgress === 1 && prevFallProgress.current < 1) {
      fallWaveStart.current = now
    }
    if (targetConfig.fallProgress < 1) {
      fallWaveStart.current = null
    }
    prevFallProgress.current = targetConfig.fallProgress

    // --- Static course highlight set (no wave logic here) ---
    const highlightedRows = new Set<number>(targetConfig.highlightedCourses)

    // --- Lerp global opacity ---
    lerpedOpacity.current += (targetConfig.brickOpacity - lerpedOpacity.current) * LERP

    // --- Auto-clear cascade once all bricks have landed ---
    const totalCascadeDur =
      (targetConfig.rows - 1) * ROW_DELAY_MS +
      (targetConfig.cols - 1) * COL_DELAY_MS +
      FALL_DURATION_MS
    if (fallWaveStart.current !== null && now - fallWaveStart.current > totalCascadeDur) {
      fallWaveStart.current = null
    }

    // --- Update each brick ---
    for (let i = 0; i < MAX_BRICKS; i++) {
      const mesh = meshRefs.current[i]
      if (!mesh) continue

      const target = i < defs.length ? defs[i] : null
      const lp = lerpedPos.current[i]

      const tx = target?.x ?? STASH_POS.x
      const tz = target?.z ?? STASH_POS.z
      const trotY = target?.rotY ?? 0

      let ty: number
      let directY = false

      if (target && fallWaveStart.current !== null) {
        const elapsed = now - fallWaveStart.current
        const row = rowFromY(target.y, targetConfig.rows)
        const col = approxColFromX(target.x, xRange, targetConfig.cols)
        const progress = cascadeProgress(elapsed, row, col)
        ty = target.y + (1 - easeIn(progress)) * FALL_HEIGHT
        directY = true
      } else {
        const fallOffset = target ? (1 - targetConfig.fallProgress) * FALL_HEIGHT : 0
        ty = (target?.y ?? STASH_POS.y) + fallOffset
      }

      lp.x += (tx - lp.x) * LERP
      if (directY) lp.y = ty
      else         lp.y += (ty - lp.y) * LERP
      lp.z += (tz - lp.z) * LERP
      lerpedRotY.current[i] += (trotY - lerpedRotY.current[i]) * LERP

      mesh.position.copy(lp)
      mesh.rotation.y = lerpedRotY.current[i]

      // Per-brick smooth highlight intensity
      const row = target ? rowFromY(target.y, targetConfig.rows) : -1
      const col = target ? approxColFromX(target.x, xRange, targetConfig.cols) : -1

      let intensity = 0
      if (target !== null) {
        if (highlightedRows.has(row)) intensity = 1

        if (courseWaveStart.current !== null) {
          const elapsed = now - courseWaveStart.current
          const period = targetConfig.rows * COURSE_PULSE_STEP_MS + COURSE_PULSE_PAUSE_MS
          intensity = Math.max(intensity,
            pulseIntensity(elapsed, row * COURSE_PULSE_STEP_MS, COURSE_PULSE_WIDTH_MS, period))
        }
        if (colWaveStart.current !== null) {
          const elapsed = now - colWaveStart.current
          const seqIndex = row * targetConfig.cols + col
          const totalSlots = targetConfig.rows * targetConfig.cols
          const period = totalSlots * COL_PULSE_STEP_MS + COL_PULSE_PAUSE_MS
          intensity = Math.max(intensity,
            pulseIntensity(elapsed, seqIndex * COL_PULSE_STEP_MS, COL_PULSE_WIDTH_MS, period))
        }
      }

      brickMats.current[i].color.copy(BASE_COLOR).lerp(HIGHLIGHT_COLOR, intensity)
      brickMats.current[i].opacity = lerpedOpacity.current
    }
  })

  return (
    <group rotation={[0, 0.3, 0]}>
      {Array.from({ length: MAX_BRICKS }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => { meshRefs.current[i] = el }}
          geometry={geo.current}
          material={brickMats.current[i]}
        />
      ))}
    </group>
  )
}
