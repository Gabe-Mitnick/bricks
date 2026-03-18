import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BrickConfig } from '../steps'

interface Props {
  targetConfig: BrickConfig
}

// Standard brick proportions (normalised)
const BW = 2.25  // width (stretcher face)
const BH = 0.75  // height
const BD = 1.0   // depth
const MORTAR = 0.1
const COLS = 5
const ROWS = 4
const TOTAL = ROWS * COLS

const LERP = 0.05

interface LerpedState {
  rowOffset: number
  rotX: number
  rotY: number
  rotZ: number
  groupY: number
}

function makeBrickGeometry() {
  return new THREE.BoxGeometry(BW, BH, BD)
}

function makeBrickMaterial() {
  return new THREE.MeshStandardMaterial({ color: '#b45c2a', roughness: 0.85, metalness: 0.05 })
}

export default function BrickModel({ targetConfig }: Props) {
  const groupRef = useRef<THREE.Group>(null)

  // Shared geometry + material for all bricks
  const geo = useRef(makeBrickGeometry())
  const mat = useRef(makeBrickMaterial())

  // Individual mesh refs
  const meshRefs = useRef<(THREE.Mesh | null)[]>(Array(TOTAL).fill(null))

  const state = useRef<LerpedState>({
    rowOffset: targetConfig.rowOffset,
    rotX: targetConfig.rotation[0],
    rotY: targetConfig.rotation[1],
    rotZ: targetConfig.rotation[2],
    groupY: targetConfig.groupY,
  })

  useFrame(() => {
    const s = state.current
    const tgt = targetConfig

    s.rowOffset += (tgt.rowOffset - s.rowOffset) * LERP
    s.rotX     += (tgt.rotation[0] - s.rotX)    * LERP
    s.rotY     += (tgt.rotation[1] - s.rotY)    * LERP
    s.rotZ     += (tgt.rotation[2] - s.rotZ)    * LERP
    s.groupY   += (tgt.groupY - s.groupY)       * LERP

    // Update group rotation
    if (groupRef.current) {
      groupRef.current.rotation.set(s.rotX, s.rotY + s.groupY, s.rotZ)
    }

    // Update each brick position
    const totalW = COLS * (BW + MORTAR)
    const totalH = ROWS * (BH + MORTAR)
    let idx = 0
    for (let row = 0; row < ROWS; row++) {
      const offset = (row % 2) * s.rowOffset * (BW + MORTAR)
      for (let col = 0; col < COLS; col++) {
        const mesh = meshRefs.current[idx]
        if (mesh) {
          mesh.position.set(
            col * (BW + MORTAR) + offset - totalW / 2,
            row * (BH + MORTAR) - totalH / 2,
            0,
          )
        }
        idx++
      }
    }
  })

  return (
    <group ref={groupRef}>
      {Array.from({ length: TOTAL }, (_, i) => (
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
