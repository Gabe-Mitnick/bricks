export interface BrickConfig {
  /** horizontal offset per row (running bond = 0.5, stack = 0, Flemish varies) */
  rowOffset: number
  /** rotation of the entire group in radians [x, y, z] */
  rotation: [number, number, number]
  /** camera-like elevation angle (Y rotation of group) */
  groupY: number
}

export interface Step {
  title: string
  text: string
  scene: BrickConfig
}

export const steps: Step[] = [
  {
    title: 'Stack Bond',
    text: 'In a stack bond, every brick is placed directly above the one below it. The vertical joints line up perfectly. This looks clean and modern, but provides little structural strength — the continuous vertical joints are a weak point.',
    scene: {
      rowOffset: 0,
      rotation: [0.3, 0.4, 0],
      groupY: 0,
    },
  },
  {
    title: 'Running Bond',
    text: 'The most common pattern in modern construction. Each row is offset by half a brick length, staggering the vertical joints. This interlocking action distributes loads across multiple bricks and gives the wall much greater strength.',
    scene: {
      rowOffset: 0.5,
      rotation: [0.3, 0.5, 0],
      groupY: 0.2,
    },
  },
  {
    title: 'Flemish Bond',
    text: 'An elegant pattern alternating headers (bricks laid end-on) and stretchers (bricks laid lengthwise) in each row. Every header is centred over a stretcher below. Originally used in load-bearing walls, it is prized today for its decorative richness.',
    scene: {
      rowOffset: 0.25,
      rotation: [0.3, 0.65, 0],
      groupY: 0.4,
    },
  },
]
