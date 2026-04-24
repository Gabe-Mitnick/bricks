import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { BufferGeometry } from 'three'

// Arc segments for rounded edges — 4 gives smooth curves without excess polygons
const ROUND_SEGMENTS = 4

export interface BrickGeometryConfig {
	radius: number // mm — edge rounding radius
}

export const DEFAULT_BRICK_GEOMETRY: BrickGeometryConfig = {
	radius: 4,
}

export function makeBrickGeometry(w: number, h: number, d: number, config: BrickGeometryConfig): BufferGeometry {
	const r = Math.min(config.radius, Math.min(w, h, d) / 2 - 0.1)
	return new RoundedBoxGeometry(w, h, d, ROUND_SEGMENTS, r)
}
