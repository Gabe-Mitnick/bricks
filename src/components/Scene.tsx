import { Canvas } from '@react-three/fiber'
import { BrickConfig } from '../steps'
import BrickModel from './BrickModel'

interface Props {
  targetConfig: BrickConfig
}

export default function Scene({ targetConfig }: Props) {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 45 }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-3, -2, -4]} intensity={0.3} color="#7090c0" />
      <BrickModel targetConfig={targetConfig} />
    </Canvas>
  )
}
