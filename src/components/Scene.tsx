import { useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import { SceneState } from '../steps'
import { CameraConfig } from '../App'
import { TextureDebugConfig } from '../brickTextures'
import { BrickGeometryConfig } from '../brickGeometry'
import BrickModel from './BrickModel'
import StructuralWall from './StructuralWall'
import MetalTies from './MetalTies'

const CAMERA_BASE_POSITION: [number, number, number] = [-500, 500, 1000] // mm
const CAMERA_BASE_DIST = Math.sqrt(CAMERA_BASE_POSITION.reduce((s, v) => s + v * v, 0))
const CAMERA_DIR: [number, number, number] = CAMERA_BASE_POSITION.map((v) => v / CAMERA_BASE_DIST) as [
	number,
	number,
	number,
]

const LERP = 0.05

function DynamicCamera({ config, targetOrbit }: { config: CameraConfig; targetOrbit: number }) {
	const { size } = useThree()
	const lerpedOrbit = useRef(targetOrbit)

	useFrame(({ camera }) => {
		lerpedOrbit.current += (targetOrbit - lerpedOrbit.current) * LERP
		const orbit = lerpedOrbit.current
		const cos = Math.cos(orbit),
			sin = Math.sin(orbit)
		// Rotate CAMERA_DIR around world Y axis by orbit angle
		const rx = CAMERA_DIR[0] * cos + CAMERA_DIR[2] * sin
		const rz = -CAMERA_DIR[0] * sin + CAMERA_DIR[2] * cos
		const d =
			config.fov === 0 ? CAMERA_BASE_DIST : size.height / (2 * config.zoom) / Math.tan((config.fov * Math.PI) / 180 / 2)
		camera.position.set(rx * d, CAMERA_DIR[1] * d, rz * d)
		camera.lookAt(0, 0, 0)
	})

	if (config.fov === 0) {
		return <OrthographicCamera makeDefault position={CAMERA_BASE_POSITION} zoom={config.zoom} />
	}
	const d = size.height / (2 * config.zoom) / Math.tan((config.fov * Math.PI) / 180 / 2)
	const pos: [number, number, number] = CAMERA_DIR.map((v) => v * d) as [number, number, number]
	return <PerspectiveCamera makeDefault position={pos} fov={config.fov} />
}

interface Props {
	targetConfig: SceneState
	cameraConfig: CameraConfig
	textureDebug: TextureDebugConfig
	geometryDebug: BrickGeometryConfig
}

export default function Scene({ targetConfig, cameraConfig, textureDebug, geometryDebug }: Props) {
	return (
		<Canvas style={{ background: 'transparent' }}>
			<DynamicCamera config={cameraConfig} targetOrbit={targetConfig.cameraOrbit} />
			<ambientLight intensity={0.4} />
			<directionalLight position={[500, 1000, 500]} intensity={1.2} castShadow />
			<directionalLight position={[-300, -200, -400]} intensity={0.3} color="#7090c0" />
			<group rotation={[0, 0.3, 0]}>
				<BrickModel targetConfig={targetConfig} textureDebug={textureDebug} geometryDebug={geometryDebug} />
				<StructuralWall targetOpacity={targetConfig.structuralWallOpacity} />
				<MetalTies targetOpacity={targetConfig.metalTiesOpacity} />
			</group>
		</Canvas>
	)
}
