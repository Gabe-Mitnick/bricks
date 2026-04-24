import { useEffect, useRef, useState } from 'react'
import { CameraConfig } from '../App'
import { TextureDebugConfig } from '../brickTextures'
import { BrickGeometryConfig } from '../brickGeometry'
import styles from '../styles/debugMenu.module.css'

interface Props {
	cameraConfig: CameraConfig
	onCameraChange: (config: CameraConfig) => void
	textureDebug: TextureDebugConfig
	onTextureChange: (config: TextureDebugConfig) => void
	geometryDebug: BrickGeometryConfig
	onGeometryChange: (config: BrickGeometryConfig) => void
}

interface SliderRowProps {
	label: string
	value: string | number
	min: number
	max: number
	step: number
	current: number
	onSlide: (value: number) => void
}

function SliderRow({ label, value, min, max, step, current, onSlide }: SliderRowProps) {
	return (
		<div className={styles.row}>
			<div className={styles.label}>
				<span>{label}</span>
				<span className={styles.value}>{value}</span>
			</div>
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={current}
				onChange={(e) => onSlide(Number(e.target.value))}
				className={styles.slider}
			/>
		</div>
	)
}

export default function DebugMenu({ cameraConfig, onCameraChange, textureDebug, onTextureChange, geometryDebug, onGeometryChange }: Props) {
	const [open, setOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) return
		const onPointerDown = (e: PointerEvent) => {
			if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener('pointerdown', onPointerDown)
		return () => document.removeEventListener('pointerdown', onPointerDown)
	}, [open])

	return (
		<div className={styles.container} ref={containerRef}>
			<button className={styles.gearButton} onClick={() => setOpen((o) => !o)} title="Debug">
				⚙
			</button>
			{open && (
				<div className={styles.menu}>
					<div className={styles.title}>Debug</div>
					<SliderRow
						label="FOV"
						value={cameraConfig.fov === 0 ? 'Orthographic' : `${cameraConfig.fov}°`}
						min={0}
						max={90}
						step={1}
						current={cameraConfig.fov}
						onSlide={(fov) => onCameraChange({ ...cameraConfig, fov })}
					/>
					<SliderRow
						label="Zoom"
						value={cameraConfig.zoom}
						min={0.1}
						max={5}
						step={0.05}
						current={cameraConfig.zoom}
						onSlide={(zoom) => onCameraChange({ ...cameraConfig, zoom })}
					/>
					<div className={styles.sectionLabel}>Texture</div>
					<SliderRow
						label="Bump depth"
						value={textureDebug.noiseStrength.toFixed(1)}
						min={0.5}
						max={10}
						step={0.5}
						current={textureDebug.noiseStrength}
						onSlide={(noiseStrength) => onTextureChange({ ...textureDebug, noiseStrength })}
					/>
					<SliderRow
						label="Bump freq"
						value={textureDebug.noiseFrequency.toFixed(1)}
						min={1}
						max={50}
						step={0.5}
						current={textureDebug.noiseFrequency}
						onSlide={(noiseFrequency) => onTextureChange({ ...textureDebug, noiseFrequency })}
					/>
					<SliderRow
						label="Pit offset"
						value={textureDebug.pitOffset.toFixed(2)}
						min={0}
						max={1.5}
						step={0.05}
						current={textureDebug.pitOffset}
						onSlide={(pitOffset) => onTextureChange({ ...textureDebug, pitOffset })}
					/>
					<div className={styles.sectionLabel}>Geometry</div>
					<SliderRow
						label="Round radius"
						value={`${geometryDebug.radius.toFixed(1)} mm`}
						min={0}
						max={15}
						step={0.5}
						current={geometryDebug.radius}
						onSlide={(radius) => onGeometryChange({ ...geometryDebug, radius })}
					/>
				</div>
			)}
		</div>
	)
}
