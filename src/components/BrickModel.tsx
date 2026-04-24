import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SceneState } from '../steps'
import { TextureDebugConfig, generateBrickTextures, BrickTextures } from '../brickTextures'
import { makeBrickGeometry, BrickGeometryConfig } from '../brickGeometry'

interface Props {
	targetConfig: SceneState
	textureDebug: TextureDebugConfig
	geometryDebug: BrickGeometryConfig
}

// Standard UK brick dimensions in mm. Key property: BD + MORTAR = (BW + MORTAR) / 2,
// so 2 headers + 1 mortar joint = 1 stretcher + 1 mortar joint.
const BW = 215 // mm — stretcher length
const BH = 65 // mm — height
const BD = 102.5 // mm — header face width
const MORTAR = 10 // mm — joint thickness

// Z offset for stretcher wythes: includes mortar between wythes so front faces
// of stretchers align with front face of headers (both at z = ±BW/2 = ±107.5mm).
const WYTHE_Z = (BD + MORTAR) / 2 // 56.25mm

const ROW_STEP = BH + MORTAR // 75mm between row centres

const LERP = 0.05
const MAX_BRICKS = 200
const STASH_POS = new THREE.Vector3(0, -5000, 0)
const FALL_HEIGHT = 2000 // mm — how far above final position bricks start

const GRAVITY = 5000 // mm/s²
const DELTA_MAX = 0.1 // s — clamp delta against spike frames
const COLLAPSE_VX_RANGE = 420 // mm/s — horizontal X scatter (±210)
const COLLAPSE_VZ_RANGE = 420 // mm/s — depth scatter (±210)
const COLLAPSE_VY_MIN = -70 // mm/s — min initial Y (downward)
const COLLAPSE_VY_MAX = 140 // mm/s — max initial Y (brief upward puff)
const COLLAPSE_ROT_SPEED = Math.PI * 2.8 // rad/s — max tumble speed
const SPLIT_VZ_BASE = 385 // mm/s — Z velocity at top row (height-scaled)
const SPLIT_VZ_RANDOM = 84 // mm/s — per-brick Z noise (±42)
const SPLIT_VX_RANDOM = 70 // mm/s — per-brick X noise (±35)
const SPLIT_VY_RANDOM = 56 // mm/s — per-brick Y noise (±28)
const SPLIT_ROT_X_BASE = Math.PI * 0.56 // rad/s — coherent outward tipping per wythe
const SPLIT_ROT_X_NOISE = Math.PI * 0.28 // rad/s — per-brick variation
const SPLIT_ROT_Y_SPEED = Math.PI * 1.05 // rad/s — random Y tumble
const SPLIT_ROW_DELAY_MS = 120 // ms between each successive row launching (top first)

// Deterministic pseudo-random 0–1 from integer seed
function seededRand(seed: number): number {
	const x = Math.sin(seed + 1.618) * 10000
	return x - Math.floor(x)
}

const BASE_COLOR = new THREE.Color('#b4532a')
const HIGHLIGHT_COLOR = new THREE.Color('#e8a050')

const HEADER_LIGHTNESS_FACTOR = 0.6

const COLOR_HUE_VARIATION = 1 / 360 // ±1° in 0–1 HSL space
const COLOR_LIGHTNESS_VARIATION = 0.05 // ±5%

// Per-brick base and darkened-header colors — computed once at module load from deterministic seeds
const BRICK_BASE_COLORS: THREE.Color[] = []
const BRICK_DARKENED_COLORS: THREE.Color[] = []
{
	const hsl = { h: 0, s: 0, l: 0 }
	BASE_COLOR.getHSL(hsl)
	for (let i = 0; i < MAX_BRICKS; i++) {
		const h = ((hsl.h + (seededRand(i * 13 + 1) - 0.5) * 2 * COLOR_HUE_VARIATION) % 1 + 1) % 1
		const l = Math.max(0, Math.min(1, hsl.l + (seededRand(i * 17 + 3) - 0.5) * 2 * COLOR_LIGHTNESS_VARIATION))
		BRICK_BASE_COLORS.push(new THREE.Color().setHSL(h, hsl.s, l))
		BRICK_DARKENED_COLORS.push(new THREE.Color().setHSL(h, hsl.s, l * HEADER_LIGHTNESS_FACTOR))
	}
}

const HEADER_WAVE_DURATION_MS = 1500

// Pulse timing: STEP = ms between adjacent pulse starts, WIDTH = ms for one bell (> STEP → overlap)
// PAUSE must satisfy: (numSlots-1)*STEP + WIDTH + PAUSE > numSlots*STEP, i.e. PAUSE > WIDTH - STEP
// This prevents the last slot's tail from wrapping into the next cycle.
const COURSE_PULSE_STEP_MS = 400
const COURSE_PULSE_WIDTH_MS = 700
const COURSE_PULSE_PAUSE_MS = 600 // > WIDTH - STEP (300ms); also adds a gap before loop restarts
const COL_PULSE_STEP_MS = 200
const COL_PULSE_WIDTH_MS = 400
const COL_PULSE_PAUSE_MS = 600 // > WIDTH - STEP (200ms)

// Cascade fall animation timing
const ROW_DELAY_MS = 150 // ms between each row starting to fall
const COL_DELAY_MS = 40 // ms between each column within a row
const FALL_DURATION_MS = 350 // ms for one brick to travel FALL_HEIGHT to rest
const FALL_BUFFER_MS = 50 // extra ms after last brick lands before handing off to lerp

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
		defs.push({ x: stretcherX(col, offset), y, z: WYTHE_Z, rotY: 0 })
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
		const offset = ((row % 2) * (BW + MORTAR)) / 2
		for (let col = 0; col < cols; col++) {
			defs.push({ x: stretcherX(col, offset), y: rowY(row), z: 0, rotY: 0 })
		}
	}
	return defs
}

function twoWytheStretcher(rows: number, cols: number, wytheSep: number): BrickDef[] {
	const front = stretcherBond(rows, cols).map((d) => ({ ...d, z: -wytheSep / 2 }))
	const back = stretcherBond(rows, cols).map((d) => ({ ...d, z: wytheSep / 2 }))
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
			addStretcherCourse(defs, cols, y, ((row % 2) * (BW + MORTAR)) / 2)
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
			addStretcherCourse(defs, cols, y, ((stretcherCourseIdx % 2) * (BW + MORTAR)) / 2)
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
			defs.push({ x, y, z: WYTHE_Z, rotY: 0 })
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
			defs.push({ x, y, z: WYTHE_Z, rotY: 0 })
			// stretcher 2
			const x2 = x + BW + MORTAR
			defs.push({ x: x2, y, z: -WYTHE_Z, rotY: 0 })
			defs.push({ x: x2, y, z: WYTHE_Z, rotY: 0 })
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
			case 'stretcher':
				defs = twoWytheStretcher(rows, cols, wytheSeparation)
				break
			case 'american':
				defs = americanBond(rows, cols)
				break
			case 'english':
				defs = englishBond(rows, cols)
				break
			case 'englishCross':
				defs = englishCrossBond(rows, cols)
				break
			case 'flemish':
				defs = flemishBond(rows, cols)
				break
			case 'monk':
				defs = monkBond(rows, cols)
				break
		}
	}

	let minX = Infinity,
		maxX = -Infinity,
		minY = Infinity,
		maxY = -Infinity
	for (const d of defs) {
		if (d.x < minX) minX = d.x
		if (d.x > maxX) maxX = d.x
		if (d.y < minY) minY = d.y
		if (d.y > maxY) maxY = d.y
	}
	const cx = (minX + maxX) / 2
	const cy = (minY + maxY) / 2
	return defs.map((d) => ({ ...d, x: d.x - cx, y: d.y - cy }))
}

// Convert a centered brick Y position back to a 0-based row index.
// Row Y values after centering are evenly spaced at ROW_STEP apart.
function rowFromY(y: number, rows: number): number {
	const minY = (-(rows - 1) * ROW_STEP) / 2
	return Math.round((y - minY) / ROW_STEP)
}

function approxColFromX(x: number, xRange: { min: number; max: number }, cols: number): number {
	if (xRange.max <= xRange.min) return 0
	const frac = (x - xRange.min) / (xRange.max - xRange.min)
	return Math.round(frac * (cols - 1))
}

function easeIn(t: number): number {
	return t * t
}

function cascadeProgress(elapsed: number, row: number, col: number): number {
	const delay = row * ROW_DELAY_MS + col * COL_DELAY_MS
	return Math.min(Math.max((elapsed - delay) / FALL_DURATION_MS, 0), 1)
}

// Returns 0–1 smooth bell (sin) for a looping pulse. elapsed and delay in ms.
function pulseIntensity(elapsed: number, delay: number, pulseWidth: number, period: number): number {
	const phase = (((elapsed - delay) % period) + period) % period
	if (phase >= pulseWidth) return 0
	return Math.sin((phase / pulseWidth) * Math.PI)
}

const NORMAL_SCALE = new THREE.Vector2(1, 1)

function makeMaterial(color: string | THREE.Color, normalMap: THREE.CanvasTexture): THREE.MeshStandardMaterial {
	return new THREE.MeshStandardMaterial({
		color,
		roughness: 1.0,
		metalness: 0.05,
		transparent: true,
		opacity: 1,
		normalMap,
		normalScale: NORMAL_SCALE,
	})
}

export default function BrickModel({ targetConfig, textureDebug, geometryDebug }: Props) {
	// useRef(expr) evaluates expr on every render even though the value is only used once.
	// Use lazy initialization (null check) so expensive one-time work only runs on first render.
	const textureRef = useRef<BrickTextures | null>(null)
	if (!textureRef.current) textureRef.current = generateBrickTextures(textureDebug)

	const geo = useRef<THREE.BufferGeometry | null>(null)
	if (!geo.current) geo.current = makeBrickGeometry(BW, BH, BD, geometryDebug)

	const brickMats = useRef<THREE.MeshStandardMaterial[] | null>(null)
	if (!brickMats.current) {
		brickMats.current = Array.from({ length: MAX_BRICKS }, (_, i) =>
			makeMaterial(BASE_COLOR, textureRef.current!.maps[i]),
		)
	}
	const endMats = useRef<THREE.MeshStandardMaterial[] | null>(null)
	if (!endMats.current) {
		endMats.current = Array.from({ length: MAX_BRICKS }, (_, i) =>
			makeMaterial(BASE_COLOR, textureRef.current!.maps[i]),
		)
	}
	// 6-element material array for header bricks: [right(+X), left(-X), top, bottom, front(+Z), back(-Z)]
	// After 90° Y-rotation, the ±X faces become the ±Z wall faces — the visible ends.
	const headerMatArrays = useRef<THREE.MeshStandardMaterial[][] | null>(null)
	if (!headerMatArrays.current) {
		headerMatArrays.current = Array.from({ length: MAX_BRICKS }, (_, i) => [
			endMats.current![i],
			endMats.current![i],
			brickMats.current![i],
			brickMats.current![i],
			brickMats.current![i],
			brickMats.current![i],
		])
	}
	const lastIsHeader = useRef<boolean[]>(Array(MAX_BRICKS).fill(false))

	const skipFirstTextureRegen = useRef(true)
	useEffect(() => {
		if (skipFirstTextureRegen.current) {
			skipFirstTextureRegen.current = false
			return
		}
		const oldTextures = textureRef.current
		const newTextures = generateBrickTextures(textureDebug)
		textureRef.current = newTextures
		for (let i = 0; i < MAX_BRICKS; i++) {
			brickMats.current[i].normalMap = newTextures.maps[i]
			brickMats.current[i].needsUpdate = true
			endMats.current[i].normalMap = newTextures.maps[i]
			endMats.current[i].needsUpdate = true
		}
		for (const map of oldTextures.maps) map.dispose()
		oldTextures.atlas.dispose()
	}, [textureDebug.noiseStrength, textureDebug.noiseFrequency, textureDebug.pitOffset])

	const skipFirstGeoRegen = useRef(true)
	useEffect(() => {
		if (skipFirstGeoRegen.current) {
			skipFirstGeoRegen.current = false
			return
		}
		const oldGeo = geo.current!
		const newGeo = makeBrickGeometry(BW, BH, BD, geometryDebug)
		geo.current = newGeo
		for (let i = 0; i < MAX_BRICKS; i++) {
			const mesh = meshRefs.current[i]
			if (mesh) mesh.geometry = newGeo
		}
		oldGeo.dispose()
	}, [geometryDebug.radius])

	useEffect(() => {
		return () => {
			for (const map of textureRef.current.maps) map.dispose()
			textureRef.current.atlas.dispose()
			geo.current?.dispose()
		}
	}, [])

	const defs = useMemo(() => getBrickDefs(targetConfig), [targetConfig])

	// X range of current defs, for the column-highlight wave
	const xRange = useMemo(() => {
		if (defs.length === 0) return { min: 0, max: 0 }
		let min = Infinity,
			max = -Infinity
		for (const d of defs) {
			if (d.x < min) min = d.x
			if (d.x > max) max = d.x
		}
		return { min, max }
	}, [defs])

	const meshRefs = useRef<(THREE.Mesh | null)[]>(Array(MAX_BRICKS).fill(null))
	const lerpedRotY = useRef<number[]>(Array(MAX_BRICKS).fill(0))

	const physVel = useRef<THREE.Vector3[]>(Array.from({ length: MAX_BRICKS }, () => new THREE.Vector3()))
	const physRotVelY = useRef<number[]>(Array(MAX_BRICKS).fill(0))
	const physRotVelX = useRef<number[]>(Array(MAX_BRICKS).fill(0))
	const physRotX = useRef<number[]>(Array(MAX_BRICKS).fill(0))
	const collapsePhysicsActive = useRef(false)
	const splitPhysicsActive = useRef(false)
	const splitWaveStart = useRef<number | null>(null)
	const splitBrickLaunched = useRef<boolean[]>(Array(MAX_BRICKS).fill(false))
	const prevCollapseProgress = useRef(targetConfig.collapseProgress)
	const prevSplitProgress = useRef(targetConfig.splitProgress)

	const prevHeaderDarkenProgress = useRef(targetConfig.headerDarkenProgress)
	const headerWaveStart = useRef<number | null>(null)
	const headerWaveInternalProgress = useRef(targetConfig.headerDarkenProgress > 0 ? 1 : 0)

	function snapBrick(i: number, d: BrickDef) {
		lerpedPos.current[i].set(d.x, d.y, d.z)
		lerpedRotY.current[i] = d.rotY
		physRotX.current[i] = 0
	}

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
		})(),
	)

	const lerpedOpacity = useRef(targetConfig.brickOpacity)
	const lastOpaqueMode = useRef(true)

	// Wave animation state — times are in ms from clock.getElapsedTime()*1000
	const courseWaveStart = useRef<number | null>(null)
	const colWaveStart = useRef<number | null>(null)
	const prevHighlightWave = useRef(targetConfig.highlightWaveActive)
	const prevColWave = useRef(targetConfig.highlightColWaveActive)

	// Cascade fall animation state
	const fallWaveStart = useRef<number | null>(null)
	const prevFallProgress = useRef(targetConfig.fallProgress)

	useFrame(({ clock }, delta) => {
		const dt = typeof delta === 'number' && delta > 0 ? Math.min(delta, DELTA_MAX) : 1 / 60
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

		// --- Collapse physics ---
		if (targetConfig.collapseProgress === 1 && prevCollapseProgress.current < 1) {
			collapsePhysicsActive.current = true
			for (let i = 0; i < defs.length; i++) {
				const d = defs[i]
				snapBrick(i, d)
				const v = physVel.current[i]
				v.x = (seededRand(i * 7 + 0) - 0.5) * COLLAPSE_VX_RANGE
				v.y = seededRand(i * 7 + 1) * (COLLAPSE_VY_MAX - COLLAPSE_VY_MIN) + COLLAPSE_VY_MIN
				v.z = (seededRand(i * 7 + 2) - 0.5) * COLLAPSE_VZ_RANGE
				physRotVelY.current[i] = (seededRand(i * 7 + 3) - 0.5) * COLLAPSE_ROT_SPEED
				physRotVelX.current[i] = (seededRand(i * 7 + 4) - 0.5) * COLLAPSE_ROT_SPEED
			}
		}
		if (targetConfig.collapseProgress === 0 && collapsePhysicsActive.current) {
			collapsePhysicsActive.current = false
			for (let i = 0; i < defs.length; i++) snapBrick(i, defs[i])
		}
		prevCollapseProgress.current = targetConfig.collapseProgress

		// --- Split physics ---
		if (targetConfig.splitProgress === 1 && prevSplitProgress.current < 1) {
			splitPhysicsActive.current = true
			splitWaveStart.current = now
			splitBrickLaunched.current.fill(false)
			const yMin = (-(targetConfig.rows - 1) * ROW_STEP) / 2
			const yRange = (targetConfig.rows - 1) * ROW_STEP // 0 for 1-row wall
			for (let i = 0; i < defs.length; i++) {
				const d = defs[i]
				snapBrick(i, d)
				const zSign = Math.abs(d.z) > 10 ? Math.sign(d.z) : 0
				// 0 at bottom row → 1 at top row
				const h = yRange > 0 ? (d.y - yMin) / yRange : 0.5
				const v = physVel.current[i]
				v.z = zSign * SPLIT_VZ_BASE * h + (seededRand(i * 7 + 5) - 0.5) * SPLIT_VZ_RANDOM
				v.x = (seededRand(i * 7 + 6) - 0.5) * SPLIT_VX_RANDOM
				v.y = (seededRand(i * 7 + 7) - 0.5) * SPLIT_VY_RANDOM
				// rotation.x positive → top tilts toward −z; front wythe (zSign=−1) tips outward → positive
				physRotVelX.current[i] = -zSign * SPLIT_ROT_X_BASE + (seededRand(i * 7 + 9) - 0.5) * SPLIT_ROT_X_NOISE
				physRotVelY.current[i] = (seededRand(i * 7 + 8) - 0.5) * SPLIT_ROT_Y_SPEED
			}
		}
		if (targetConfig.splitProgress === 0 && splitPhysicsActive.current) {
			splitPhysicsActive.current = false
			splitWaveStart.current = null
			splitBrickLaunched.current.fill(false)
			for (let i = 0; i < defs.length; i++) snapBrick(i, defs[i])
		}
		prevSplitProgress.current = targetConfig.splitProgress

		// --- Header darkening wave ---
		if (targetConfig.headerDarkenProgress > 0 && prevHeaderDarkenProgress.current === 0) {
			headerWaveStart.current = now
			headerWaveInternalProgress.current = 0
		}
		if (targetConfig.headerDarkenProgress === 0 && prevHeaderDarkenProgress.current > 0) {
			headerWaveStart.current = null
			headerWaveInternalProgress.current = 0
		}
		prevHeaderDarkenProgress.current = targetConfig.headerDarkenProgress

		if (headerWaveStart.current !== null) {
			headerWaveInternalProgress.current = Math.min((now - headerWaveStart.current) / HEADER_WAVE_DURATION_MS, 1)
		} else if (targetConfig.headerDarkenProgress > 0) {
			headerWaveInternalProgress.current = 1
		}

		// --- Static course highlight set (no wave logic here) ---
		const highlightedRows = new Set<number>(targetConfig.highlightedCourses)

		// --- Lerp global opacity ---
		lerpedOpacity.current += (targetConfig.brickOpacity - lerpedOpacity.current) * LERP

		// --- Switch material mode at opacity threshold ---
		const isOpaque = lerpedOpacity.current > 0.99
		if (isOpaque !== lastOpaqueMode.current) {
			lastOpaqueMode.current = isOpaque
			for (const mat of brickMats.current) {
				mat.depthWrite = isOpaque
				mat.side = isOpaque ? THREE.FrontSide : THREE.DoubleSide
				mat.needsUpdate = true
			}
			for (const mat of endMats.current) {
				mat.depthWrite = isOpaque
				mat.side = isOpaque ? THREE.FrontSide : THREE.DoubleSide
				mat.needsUpdate = true
			}
		}

		// --- Auto-clear cascade once all bricks have landed ---
		// Buffer absorbs frame-timing jitter: without it, the cascade clears ~1 frame early,
		// leaving the last brick ~180mm above its target and creating a visible slow LERP drift.
		const totalCascadeDur =
			(targetConfig.rows - 1) * ROW_DELAY_MS +
			(targetConfig.cols - 1) * COL_DELAY_MS +
			FALL_DURATION_MS +
			FALL_BUFFER_MS
		if (fallWaveStart.current !== null && now - fallWaveStart.current > totalCascadeDur) {
			fallWaveStart.current = null
		}

		// Hoist wave threshold out of the per-brick loop — it's constant for the whole frame
		const waveThreshold = xRange.min + headerWaveInternalProgress.current * (xRange.max - xRange.min)

		// --- Update each brick ---
		for (let i = 0; i < MAX_BRICKS; i++) {
			const mesh = meshRefs.current[i]
			if (!mesh) continue

			const target = i < defs.length ? defs[i] : null
			const lp = lerpedPos.current[i]
			const row = target ? rowFromY(target.y, targetConfig.rows) : -1
			const col = target ? approxColFromX(target.x, xRange, targetConfig.cols) : -1

			const tx = target?.x ?? STASH_POS.x
			const tz = target?.z ?? STASH_POS.z
			const trotY = target?.rotY ?? 0

			let ty: number
			let directY = false

			if (target && fallWaveStart.current !== null) {
				const elapsed = now - fallWaveStart.current
				const progress = cascadeProgress(elapsed, row, col)
				ty = target.y + (1 - easeIn(progress)) * FALL_HEIGHT
				directY = true
			} else {
				const fallOffset = target ? (1 - targetConfig.fallProgress) * FALL_HEIGHT : 0
				ty = (target?.y ?? STASH_POS.y) + fallOffset
			}

			// Launch split bricks row-by-row from top down
			if (
				splitPhysicsActive.current &&
				splitWaveStart.current !== null &&
				target !== null &&
				!splitBrickLaunched.current[i]
			) {
				const delay = (targetConfig.rows - 1 - row) * SPLIT_ROW_DELAY_MS
				if (now - splitWaveStart.current >= delay) {
					splitBrickLaunched.current[i] = true
				}
			}

			const physicsActive =
				target !== null &&
				(collapsePhysicsActive.current || (splitPhysicsActive.current && splitBrickLaunched.current[i]))

			if (physicsActive) {
				physVel.current[i].y -= GRAVITY * dt
				lp.x += physVel.current[i].x * dt
				lp.y += physVel.current[i].y * dt
				lp.z += physVel.current[i].z * dt
				lerpedRotY.current[i] += physRotVelY.current[i] * dt
				physRotX.current[i] += physRotVelX.current[i] * dt
			} else {
				lp.x += (tx - lp.x) * LERP
				if (directY) lp.y = ty
				else lp.y += (ty - lp.y) * LERP
				lp.z += (tz - lp.z) * LERP
				lerpedRotY.current[i] += (trotY - lerpedRotY.current[i]) * LERP
				physRotX.current[i] += (0 - physRotX.current[i]) * LERP
			}

			mesh.position.copy(lp)
			mesh.rotation.y = lerpedRotY.current[i]
			mesh.rotation.x = physRotX.current[i]

			// Per-brick smooth highlight intensity

			// renderOrder layers: wall=0, ties=1, bottom-row bricks=2, top-row bricks=rows+1.
			// Upper rows render last (on top), guaranteeing correct visual layering for the
			// off-axis orthographic camera regardless of clip-space sort order.
			const newRenderOrder = target !== null ? row + 2 : 0
			if (mesh.renderOrder !== newRenderOrder) mesh.renderOrder = newRenderOrder

			let intensity = 0
			if (target !== null) {
				if (highlightedRows.has(row)) intensity = 1

				if (courseWaveStart.current !== null) {
					const elapsed = now - courseWaveStart.current
					const period = targetConfig.rows * COURSE_PULSE_STEP_MS + COURSE_PULSE_PAUSE_MS
					intensity = Math.max(
						intensity,
						pulseIntensity(elapsed, row * COURSE_PULSE_STEP_MS, COURSE_PULSE_WIDTH_MS, period),
					)
				}
				if (colWaveStart.current !== null) {
					const elapsed = now - colWaveStart.current
					const seqIndex = row * targetConfig.cols + col
					const totalSlots = targetConfig.rows * targetConfig.cols
					const period = totalSlots * COL_PULSE_STEP_MS + COL_PULSE_PAUSE_MS
					intensity = Math.max(
						intensity,
						pulseIntensity(elapsed, seqIndex * COL_PULSE_STEP_MS, COL_PULSE_WIDTH_MS, period),
					)
				}
			}

			// Switch between single-material (stretchers) and 6-material array (headers) as needed
			const isHeader = target !== null && Math.abs(target.rotY) > 0.1
			if (isHeader !== lastIsHeader.current[i]) {
				mesh.material = isHeader ? headerMatArrays.current[i] : brickMats.current[i]
				lastIsHeader.current[i] = isHeader
			}

			// Body faces always use normal brick color
			brickMats.current[i].color.copy(BRICK_BASE_COLORS[i]).lerp(HIGHLIGHT_COLOR, intensity)
			brickMats.current[i].opacity = lerpedOpacity.current

			// End faces: only updated for header bricks (non-headers never use endMats[i])
			if (isHeader) {
				const endBaseColor =
					targetConfig.headerDarkenProgress > 0 && target!.x <= waveThreshold
						? BRICK_DARKENED_COLORS[i]
						: BRICK_BASE_COLORS[i]
				endMats.current[i].color.copy(endBaseColor).lerp(HIGHLIGHT_COLOR, intensity)
				endMats.current[i].opacity = lerpedOpacity.current
			}
		}
	})

	return (
		<group>
			{Array.from({ length: MAX_BRICKS }, (_, i) => (
				<mesh
					key={i}
					ref={(el) => {
						meshRefs.current[i] = el
					}}
					geometry={geo.current!}
					material={brickMats.current[i]}
				/>
			))}
		</group>
	)
}
