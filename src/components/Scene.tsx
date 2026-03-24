import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import { SceneState } from '../steps'
import { CameraConfig } from '../App'
import BrickModel from './BrickModel'

const CAMERA_BASE_POSITION: [number, number, number] = [-5, 5, 10]
const CAMERA_BASE_DIST = Math.sqrt(150) // ≈ 12.25
const CAMERA_DIR: [number, number, number] = CAMERA_BASE_POSITION.map(
  (v) => v / CAMERA_BASE_DIST
) as [number, number, number]

function DynamicCamera({ config }: { config: CameraConfig }) {
  const { size } = useThree()
  useFrame(({ camera }) => camera.lookAt(0, 0, 0))

  if (config.fov === 0) {
    return <OrthographicCamera makeDefault position={CAMERA_BASE_POSITION} zoom={config.zoom} />
  }

  const d = (size.height / (2 * config.zoom)) / Math.tan((config.fov * Math.PI / 180) / 2)
  const pos: [number, number, number] = CAMERA_DIR.map((v) => v * d) as [number, number, number]
  return <PerspectiveCamera makeDefault position={pos} fov={config.fov} />
}

interface Props {
  targetConfig: SceneState
  cameraConfig: CameraConfig
}

export default function Scene({ targetConfig, cameraConfig }: Props) {
  return (
    <Canvas style={{ background: 'transparent' }}>
      <DynamicCamera config={cameraConfig} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-3, -2, -4]} intensity={0.3} color="#7090c0" />
      <BrickModel targetConfig={targetConfig} />
    </Canvas>
  )
}
