import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SceneState } from '../steps'

interface Props {
  targetConfig: SceneState
}

// Standard brick proportions (normalised)
const BW = 2.25  // width (stretcher face)
const BH = 0.75  // height
const BD = 1.0   // depth (header face)
const MORTAR = 0.1

const LERP = 0.05
const MAX_BRICKS = 200
const STASH_POS = new THREE.Vector3(0, -50, 0)

export interface BrickDef {
  x: number
  y: number
  z: number
  rotY: number
}

// A header brick is turned 90°, so its long axis runs Z instead of X.
// Stretcher: length=BW along X, depth=BD along Z
// Header:    length=BD along X (face), depth=BW along Z (full length into wall)
const HEADER_ROT_Y = Math.PI / 2

function rowY(row: number): number {
  return row * (BH + MORTAR)
}

function stretcherX(col: number, offset: number): number {
  return col * (BW + MORTAR) + offset
}

function headerX(col: number, offset: number): number {
  // headers are BD wide on the face
  return col * (BD + MORTAR) + offset
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
    const posInCycle = row % CYCLE
    const y = rowY(row)
    if (posInCycle === 0) {
      // header course — headers span both wythes
      const headerCount = Math.floor(cols * (BW + MORTAR) / (BD + MORTAR))
      for (let col = 0; col < headerCount; col++) {
        defs.push({ x: headerX(col, 0), y, z: 0, rotY: HEADER_ROT_Y })
      }
    } else {
      // stretcher course — 2 wythes
      const offset = (row % 2) * (BW + MORTAR) / 2
      for (let col = 0; col < cols; col++) {
        defs.push({ x: stretcherX(col, offset), y, z: -BD / 2, rotY: 0 })
        defs.push({ x: stretcherX(col, offset), y, z:  BD / 2, rotY: 0 })
      }
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
      // stretcher course
      const offset = 0
      for (let col = 0; col < cols; col++) {
        defs.push({ x: stretcherX(col, offset), y, z: -BD / 2, rotY: 0 })
        defs.push({ x: stretcherX(col, offset), y, z:  BD / 2, rotY: 0 })
      }
    } else {
      // header course
      const headerCount = Math.floor(cols * (BW + MORTAR) / (BD + MORTAR))
      for (let col = 0; col < headerCount; col++) {
        defs.push({ x: headerX(col, 0), y, z: 0, rotY: HEADER_ROT_Y })
      }
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
      // stretcher course — offset every other one
      const offset = (stretcherCourseIdx % 2) * (BW + MORTAR) / 2
      for (let col = 0; col < cols; col++) {
        defs.push({ x: stretcherX(col, offset), y, z: -BD / 2, rotY: 0 })
        defs.push({ x: stretcherX(col, offset), y, z:  BD / 2, rotY: 0 })
      }
      stretcherCourseIdx++
    } else {
      // header course
      const headerCount = Math.floor(cols * (BW + MORTAR) / (BD + MORTAR))
      for (let col = 0; col < headerCount; col++) {
        defs.push({ x: headerX(col, 0), y, z: 0, rotY: HEADER_ROT_Y })
      }
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
      defs.push({ x, y, z: -BD / 2, rotY: 0 })
      defs.push({ x, y, z:  BD / 2, rotY: 0 })
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
      defs.push({ x, y, z: -BD / 2, rotY: 0 })
      defs.push({ x, y, z:  BD / 2, rotY: 0 })
      // stretcher 2
      const x2 = x + BW + MORTAR
      defs.push({ x: x2, y, z: -BD / 2, rotY: 0 })
      defs.push({ x: x2, y, z:  BD / 2, rotY: 0 })
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

  // Centre the wall
  const xs = defs.map(d => d.x)
  const ys = defs.map(d => d.y)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  return defs.map(d => ({ ...d, x: d.x - cx, y: d.y - cy }))
}

function makeBrickMaterial() {
  return new THREE.MeshStandardMaterial({ color: '#b45c2a', roughness: 0.85, metalness: 0.05 })
}

export default function BrickModel({ targetConfig }: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const geo = useRef(new THREE.BoxGeometry(BW, BH, BD))
  const mat = useRef(makeBrickMaterial())

  const meshRefs = useRef<(THREE.Mesh | null)[]>(Array(MAX_BRICKS).fill(null))
  // Current lerped positions for each slot
  const lerpedPos = useRef<THREE.Vector3[]>(
    Array.from({ length: MAX_BRICKS }, () => STASH_POS.clone())
  )
  const lerpedRotY = useRef<number[]>(Array(MAX_BRICKS).fill(0))

  useFrame(() => {
    const defs = getBrickDefs(targetConfig)

    for (let i = 0; i < MAX_BRICKS; i++) {
      const mesh = meshRefs.current[i]
      if (!mesh) continue

      const target = i < defs.length ? defs[i] : null
      const lp = lerpedPos.current[i]

      const tx = target?.x ?? STASH_POS.x
      const ty = target?.y ?? STASH_POS.y
      const tz = target?.z ?? STASH_POS.z
      const trotY = target?.rotY ?? 0

      lp.x += (tx - lp.x) * LERP
      lp.y += (ty - lp.y) * LERP
      lp.z += (tz - lp.z) * LERP
      lerpedRotY.current[i] += (trotY - lerpedRotY.current[i]) * LERP

      mesh.position.copy(lp)
      mesh.rotation.y = lerpedRotY.current[i]
    }
  })

  return (
    <group ref={groupRef} rotation={[0, 0.3, 0]}>
      {Array.from({ length: MAX_BRICKS }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => { meshRefs.current[i] = el }}
          geometry={geo.current}
          material={mat.current}
        />
      ))}
    </group>
  )
}
