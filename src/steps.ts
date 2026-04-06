export type BondPattern = 'stretcher' | 'american' | 'english' | 'englishCross' | 'flemish' | 'monk'

export interface SceneState {
  bondPattern: BondPattern
  numWythes: 1 | 2
  rows: number
  cols: number
  wytheSeparation: number
  fallProgress: number            // 0 = bricks above screen, 1 = in final position
  brickOpacity: number            // 0–1, global brick transparency
  highlightedCourses: number[]    // rows lit with highlight material (static)
  highlightWaveActive: boolean    // auto-sequence course highlights on entry
  highlightColWaveActive: boolean // auto-sequence column highlights on entry
  structuralWallOpacity: number   // 0 = hidden, 1 = fully visible
  metalTiesOpacity: number        // 0 = hidden, 1 = fully visible
  cameraOrbit: number             // radians; rotates camera around Y to look behind wall
  collapseProgress: number        // 0 = standing, 1 = bricks scattered (collapsed)
  splitProgress: number           // 0 = wythes together, 1 = front/back wythes split apart
  headerDarkenProgress: number    // 0 = all headers normal, >0 = headers dark; rising edge triggers left-to-right wave
}

export interface Moment {
  text: string
  scene: SceneState
  isSubstep: boolean
}

// Default animation fields — spread into every SceneState constant
const BASE = {
  fallProgress: 1,
  brickOpacity: 1,
  highlightedCourses: [] as number[],
  highlightWaveActive: false,
  highlightColWaveActive: false,
  structuralWallOpacity: 0,
  metalTiesOpacity: 0,
  cameraOrbit: 0,
  collapseProgress: 0,
  splitProgress: 0,
  headerDarkenProgress: 0,
}

const S1: SceneState = { ...BASE, bondPattern: 'stretcher', numWythes: 1, rows: 5, cols: 6, wytheSeparation: 0 }
const S2: SceneState = { ...BASE, bondPattern: 'stretcher', numWythes: 2, rows: 5, cols: 6, wytheSeparation: 300 }
const S2_CLOSE: SceneState = { ...S2, wytheSeparation: 112.5 } // BD + MORTAR — wythes touching
const AMERICAN: SceneState = { ...BASE, bondPattern: 'american', numWythes: 2, rows: 7, cols: 6, wytheSeparation: 0 }
const ENGLISH: SceneState = { ...BASE, bondPattern: 'english', numWythes: 2, rows: 6, cols: 6, wytheSeparation: 0 }
const ENGLISH_CROSS: SceneState = { ...BASE, bondPattern: 'englishCross', numWythes: 2, rows: 6, cols: 6, wytheSeparation: 0 }
const FLEMISH: SceneState = { ...BASE, bondPattern: 'flemish', numWythes: 2, rows: 6, cols: 6, wytheSeparation: 0 }
const MONK: SceneState = { ...BASE, bondPattern: 'monk', numWythes: 2, rows: 6, cols: 8, wytheSeparation: 0 }

// Dark-header variants — used from the "headers are glazed" moment onward
const AMERICAN_DARK: SceneState     = { ...AMERICAN,     headerDarkenProgress: 1 }
const ENGLISH_DARK: SceneState      = { ...ENGLISH,      headerDarkenProgress: 1 }
const ENGLISH_CROSS_DARK: SceneState = { ...ENGLISH_CROSS, headerDarkenProgress: 1 }
const FLEMISH_DARK: SceneState      = { ...FLEMISH,      headerDarkenProgress: 1 }
const MONK_DARK: SceneState         = { ...MONK,         headerDarkenProgress: 1 }

export const moments: Moment[] = [
  // Moment 0: no bricks visible yet (fallProgress=0 puts them above screen)
  { isSubstep: false, text: 'Imagine a brick wall.', scene: { ...S1, fallProgress: 0 } },
  // Moment 1: bricks fall into stretcher bond
  { isSubstep: true,  text: "You're probably picturing something like this:", scene: S1 },
  // Moment 2: courses highlight one by one (auto-wave)
  { isSubstep: false, text: 'Each *course*, or row, is made of bricks laid end-to-end.', scene: { ...S1, highlightWaveActive: true } },
  // Moment 3: individual bricks highlight column by column (auto-wave)
  { isSubstep: true,  text: 'Each brick laid in this orientation is called a *stretcher*. Because of this, this pattern is called *stretcher bond*.', scene: { ...S1, highlightColWaveActive: true } },
  { isSubstep: false, text: "Stretcher bond is often used in modern buildings as a facade. Behind the facade is a structural wall made of wood or reinforced concrete. That's what really holds the building up.", scene: { ...S1, structuralWallOpacity: 1 } },
  // Moment 5–6: cavity wall — bricks become semi-transparent, structural wall visible from front
  { isSubstep: false, text: "In between the bricks and the structural wall, there's often a gap, sometimes filled with insulation or sometimes left empty. The gap provides moisture control and insulation. This is called a *cavity wall*.", scene: { ...S1, brickOpacity: 0.4, structuralWallOpacity: 1 } },
  { isSubstep: true,  text: 'The bricks are connected to the structural wall with metal ties.', scene: { ...S1, brickOpacity: 0.4, structuralWallOpacity: 1, metalTiesOpacity: 1 } },
  // Moment 7: restore opacity — traditional masonry, no modern aids
  { isSubstep: false, text: 'But in traditional masonry, there were no cavities, no ties, and no reinforced concrete. A brick wall was really a brick wall.', scene: S1 },
  { isSubstep: true,  text: 'And a stretcher bond wall like this is too thin to stand on its own.', scene: { ...S1, collapseProgress: 1 } },
  { isSubstep: false, text: 'To make a strong brick wall, you need multiple vertical layers, called *wythes*. You might start by building 2 wythes of stretchers right next to each other.', scene: S2_CLOSE },
  { isSubstep: true,  text: "But these 2 wythes are only held together by mortar, so they'll split apart.", scene: { ...S2_CLOSE, splitProgress: 1 } },
  { isSubstep: false, text: "After a few courses of stretchers, we'll need something to bond the two wythes together.", scene: S2_CLOSE },
  { isSubstep: true,  text: "We can solve this problem with more bricks! Let's try rotating some of our bricks so they lay across the two wythes, with their heads visible on the faces of the wall. These bricks are called *headers*.", scene: ENGLISH },
  { isSubstep: false, text: 'Sometimes, when the bricks are being fired, the heads are glazed or burnt. That lets the headers stand out.', scene: { ...ENGLISH, headerDarkenProgress: 1 } },
  { isSubstep: false, text: 'There are different ways to arrange the headers that bond together the wythes.', scene: ENGLISH_DARK },
  { isSubstep: true,  text: "These different patterns are called *bonds*. Let's learn about some of them!", scene: ENGLISH_DARK },
  { isSubstep: false, text: "If a wall has a few courses of stretchers for each course of headers, it's called *American bond*. In America, this is also called *Common bond*.", scene: AMERICAN_DARK },
  { isSubstep: true,  text: "This pattern is easy to build, but it's not very pretty.", scene: AMERICAN_DARK },
  { isSubstep: false, text: "If there's just 1 course of stretchers for each course of headers, it's called *English bond*. In England, this is also called *Common bond*.", scene: ENGLISH_DARK },
  { isSubstep: true,  text: "People say this is one of the strongest bonds, but it looks very menacing to me.", scene: ENGLISH_DARK },
  { isSubstep: false, text: "Let's try offsetting every other course of stretchers by half a brick.", scene: ENGLISH_CROSS_DARK },
  { isSubstep: true,  text: 'Much prettier! Look how the mortar joints between the bricks form diagonal lines.', scene: ENGLISH_CROSS_DARK },
  { isSubstep: true,  text: 'This is called *English cross bond* or *Dutch bond*, depending on how the ends of the wall are finished.', scene: ENGLISH_CROSS_DARK },
  { isSubstep: false, text: "We don't have to use just stretchers or just headers in each course. What if we alternate them?", scene: FLEMISH_DARK },
  { isSubstep: true,  text: "This is called *Flemish bond*. It's my favorite!", scene: FLEMISH_DARK },
  { isSubstep: false, text: "If each course has 2 stretchers for each header, it's called *Monk bond*.", scene: MONK_DARK },
]
