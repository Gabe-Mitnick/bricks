export type BondPattern = 'stretcher' | 'american' | 'english' | 'englishCross' | 'flemish' | 'monk'

export interface SceneState {
  bondPattern: BondPattern
  numWythes: 1 | 2
  rows: number
  cols: number
  wytheSeparation: number
}

export interface Moment {
  text: string
  scene: SceneState
  isSubstep: boolean
}

const S1: SceneState = { bondPattern: 'stretcher', numWythes: 1, rows: 5, cols: 6, wytheSeparation: 0 }
const S2: SceneState = { bondPattern: 'stretcher', numWythes: 2, rows: 5, cols: 6, wytheSeparation: 1.1 }
const S2_CLOSE: SceneState = { ...S2, wytheSeparation: 0 }
const AMERICAN: SceneState = { bondPattern: 'american', numWythes: 2, rows: 7, cols: 6, wytheSeparation: 0 }
const ENGLISH: SceneState = { bondPattern: 'english', numWythes: 2, rows: 6, cols: 6, wytheSeparation: 0 }
const ENGLISH_CROSS: SceneState = { bondPattern: 'englishCross', numWythes: 2, rows: 6, cols: 6, wytheSeparation: 0 }
const FLEMISH: SceneState = { bondPattern: 'flemish', numWythes: 2, rows: 6, cols: 6, wytheSeparation: 0 }
const MONK: SceneState = { bondPattern: 'monk', numWythes: 2, rows: 6, cols: 8, wytheSeparation: 0 }

export const moments: Moment[] = [
  { isSubstep: false, text: 'Imagine a brick wall.', scene: S1 },
  { isSubstep: true,  text: "You're probably picturing something like this:", scene: S1 },
  { isSubstep: false, text: 'Each *course*, or row, is made of bricks laid end-to-end.', scene: S1 },
  { isSubstep: true,  text: 'Each brick laid in this orientation is called a *stretcher*. Because of this, this pattern is called *stretcher bond*.', scene: S1 },
  { isSubstep: false, text: "Stretcher bond is often used in modern buildings as a facade. Behind the facade is a structural wall made of wood or reinforced concrete. That's what really holds the building up.", scene: S1 },
  { isSubstep: false, text: "In between the bricks and the structural wall, there's often a gap, sometimes filled with insulation or sometimes left empty. The gap provides moisture control and insulation. This is called a *cavity wall*.", scene: S1 },
  { isSubstep: true,  text: 'The bricks are connected to the structural wall with metal ties.', scene: S1 },
  { isSubstep: false, text: 'But in traditional masonry, there were no cavities, no ties, and no reinforced concrete. A brick wall was really a brick wall.', scene: S1 },
  { isSubstep: true,  text: 'And a stretcher bond wall like this is too thin to stand on its own.', scene: S1 },
  { isSubstep: false, text: 'To make a strong brick wall, you need multiple vertical layers, called *wythes*. You might start by building 2 wythes of stretchers right next to each other.', scene: S2_CLOSE },
  { isSubstep: true,  text: "But these 2 wythes are only held together by mortar, so they'll split apart.", scene: S2 },
  { isSubstep: false, text: "After a few courses of stretchers, we'll need something to bond the two wythes together.", scene: S2_CLOSE },
  { isSubstep: true,  text: "We can solve this problem with more bricks! Let's try rotating some of our bricks so they lay across the two wythes, with their heads visible on the faces of the wall. These bricks are called *headers*.", scene: ENGLISH },
  { isSubstep: false, text: 'Sometimes, when the bricks are being fired, the heads are glazed or burnt. That lets the headers stand out.', scene: ENGLISH },
  { isSubstep: false, text: 'There are different ways to arrange the headers that bond together the wythes.', scene: ENGLISH },
  { isSubstep: true,  text: "These different patterns are called *bonds*. Let's learn about some of them!", scene: ENGLISH },
  { isSubstep: false, text: "If a wall has a few courses of stretchers for each course of headers, it's called *American bond*. In America, this is also called *Common bond*.", scene: AMERICAN },
  { isSubstep: true,  text: "This pattern is easy to build, but it's not very pretty.", scene: AMERICAN },
  { isSubstep: false, text: "If there's just 1 course of stretchers for each course of headers, it's called *English bond*. In England, this is also called *Common bond*.", scene: ENGLISH },
  { isSubstep: true,  text: "People say this is one of the strongest bonds, but it looks very menacing to me.", scene: ENGLISH },
  { isSubstep: false, text: "Let's try offsetting every other course of stretchers by half a brick.", scene: ENGLISH_CROSS },
  { isSubstep: true,  text: 'Much prettier! Look how the mortar joints between the bricks form diagonal lines.', scene: ENGLISH_CROSS },
  { isSubstep: true,  text: 'This is called *English cross bond* or *Dutch bond*, depending on how the ends of the wall are finished.', scene: ENGLISH_CROSS },
  { isSubstep: false, text: "We don't have to use just stretchers or just headers in each course. What if we alternate them?", scene: FLEMISH },
  { isSubstep: true,  text: "This is called *Flemish bond*. It's my favorite!", scene: FLEMISH },
  { isSubstep: false, text: "If each course has 2 stretchers for each header, it's called *Monk bond*.", scene: MONK },
]
