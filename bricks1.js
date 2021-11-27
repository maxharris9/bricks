const jscad = require('@jscad/modeling')
const { polygon, line, cuboid } = jscad.primitives
const { translate, rotate } = jscad.transforms
const { offset } = jscad.expansions // TODO: replace this with something homegrown
const { extrudeLinear } = jscad.extrusions
const { subtract } = jscad.booleans
const { hull } = jscad.hulls

const classifyPoint = require('robust-point-in-polygon')

// from http://paulbourke.net/geometry/pointlineplane/
function intersect (line0, line1, enforceSegments = false) {
  const [x1, y1, x2, y2] = line0.points.flat()
  const [x3, y3, x4, y4] = line1.points.flat()
  // there is likely no intersection if either line is a point, so just bail
  if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) { return false }

  const denominator = ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1))

  // ensure that the lines are not parallel
  if (denominator === 0) { return false }

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator

  // is the intersection within the segment?
  if (enforceSegments && (ua < 0 || ua > 1 || ub < 0 || ub > 1)) { return false }

  return [x1 + ua * (x2 - x1), y1 + ua * (y2 - y1)]
}

function traceBounds ({ p0, c0, n0, winding, currentPointInside, nextPointInside }, { brickWidth, mortarThickness }) {
  const brickWithMortar = brickWidth + mortarThickness

  const p1 = offset({ delta: currentPointInside ? -brickWidth : -brickWithMortar, corners: 'edge' }, p0)
  const p2 = offset({ delta: currentPointInside ? mortarThickness : 0, corners: 'edge' }, p0)

  const c1 = offset({ delta: -brickWidth, corners: 'edge' }, c0)

  const n1 = offset({ delta: nextPointInside ? -brickWidth : -brickWithMortar, corners: 'edge' }, n0)
  const n2 = offset({ delta: nextPointInside ? mortarThickness : 0, corners: 'edge' }, n0)

  return winding
    ? [intersect(c1, p2), intersect(p2, c0), intersect(c0, n1), intersect(n1, c1)]
    : [intersect(p1, c1), intersect(c0, p1), intersect(n2, c0), intersect(c1, n2)]
}

function length (x, y, z) {
  return Math.sqrt(x * x + y * y + z * z)
}

function getAngle (p0, p1, p2) {
  const dAx = p1[0] - p0[0]
  const dAy = p1[1] - p0[1]
  const dBx = p2[0] - p1[0]
  const dBy = p2[1] - p1[1]
  return Math.atan2(dAx * dBy - dAy * dBx, dAx * dBx + dAy * dBy) * 180 / Math.PI
}

function iterateEdges (points, winding, brickInfo, showMortarSlices = false) {
  const shapes = []
  const len = points.length

  const convexPoints = hull(polygon({ points })).sides.map(item => item[0])
  const innerPoints = []
  for (let index = 0; index < len; index++) {
    const p = points[index]
    if (classifyPoint(convexPoints, p)) {
      innerPoints.push(index)
    }
  }
  for (let i = 0; i < len - 1; i++) {
    const prev = (i === 0) ? points[len - 1] : points[i - 1]
    const curr = (i === 0) ? points[0] : points[i]
    const next = (i === 0) ? points[1] : points[i + 1]
    const finl = (i === 0) ? points[2] : (i <= len - 3 ? points[i + 2] : points[0])

    const edgeLength = length(next[0] - curr[0], next[1] - curr[1], 0)
    const brickLimit = edgeLength / (brickInfo.brickLength + brickInfo.mortarThickness)

    const geometry = {
      p0: line([prev, curr]),
      c0: line([curr, next]),
      n0: line([next, finl]),
      winding,
      currentPointInside: innerPoints.find(tmp => tmp === i),
      nextPointInside: innerPoints.find(tmp => tmp === i + 1)
    }
    const blockOutline = traceBounds(geometry, brickInfo)
    const block = extrudeLinear({ height: brickInfo.brickHeight }, polygon({ points: blockOutline }))

    // blockOutline is always a quad of some kind, and we want to find the widest edge of it to guide our cuts:
    //
    //   0 /            \ 3
    //    /              \
    //   /                \
    // 1 ------------------ 2

    const angle = getAngle(blockOutline[0], blockOutline[1], blockOutline[2])
    const p0 = blockOutline[angle < 90 ? 1 : 0].concat(0)
    const p1 = blockOutline[angle < 90 ? 2 : 3].concat(0)

    // now lay mortar and subtract it from the block
    const mortar = []
    for (let j = 0; j < brickLimit; j++) {
      const mortarSlice = layOnLine(
        p0, p1,
        translate(
          [1, 1, (-j * (brickInfo.brickLength + brickInfo.mortarThickness)) + brickInfo.mortarThickness],
          zeroedCuboid(3, 3, brickInfo.mortarThickness) // height, depth, width
        )
      )

      if (showMortarSlices) {
        shapes.push(mortarSlice)
      } else {
        mortar.push(mortarSlice)
      }
    }

    let scratchBlock = block
    for (let k = 0; k < mortar.length; k++) {
      scratchBlock = subtract(scratchBlock, mortar[k])
    }

    shapes.push(scratchBlock)
  }

  return shapes
}

function layOnLine (p2, p1, geometry) {
  const deltaX = p2[0] - p1[0]
  const deltaY = p2[1] - p1[1]
  const deltaZ = p2[2] - p1[2]
  const radialDistance = length(deltaX, deltaY, deltaZ)
  const inclinationAngle = Math.acos(deltaZ * radialDistance)
  const azimuthalAngle = Math.atan2(deltaY, deltaX)
  return translate(p2, rotate([0, inclinationAngle, azimuthalAngle], geometry))
}

function zeroedCuboid (length, width, height) {
  return cuboid({ size: [length, width, height], center: [-length / 2, -width / 2, -height / 2] })
}

function makeBrickInfo (brickWidth, brickHeight, mortarThickness) {
  return {
    brickWidth,
    brickHeight,
    brickLength: (2 * brickWidth) + mortarThickness,
    mortarThickness
  }
}

function main () {
  const shapes = []

  const triangle = [[0, 0], [10, 10], [0, 10]]
  const box = [[0, 0], [9.8, 0], [9.8, 9.8], [0, 9.8]]
  const backwards = [[0, 9.8], [9.8, 9.8], [9.8, 0], [0, 0]]
  const pentagon = [[0, 0], [0, 6], [6, 10], [12, 6], [12, 0]]
  const mshape = [[12, 0], [12, 10], [7, 6], [3, 6], [0, 10], [0, 0]]
  const complex = [[0, 0], [7.2, 0], [14.2, 9.9], [18, 9.9], [19.8, 0], [29.6, 0], [29.6, 13.1], [0, 13.1]]
  const complex2 = [[0, 0], [7.2, 0], [14.2, -9.9], [18, -9.9], [19.8, 0], [29.6, 0], [29.6, 12.0], [0, 12.0]]

  const brickInfo = makeBrickInfo(1.0, 0.75, 1.0 / 10.0)

  const showMortarSlices = false
  for (let i = 0; i < 4; i++) {
    const winding = i % 2
    const h = i * (brickInfo.brickHeight + brickInfo.mortarThickness) + brickInfo.mortarThickness
    shapes.push(translate([-60, 0, h], iterateEdges(triangle, winding, brickInfo, showMortarSlices)))
    shapes.push(translate([-45, 0, h], iterateEdges(box, winding, brickInfo, showMortarSlices)))
    shapes.push(translate([-45, 20, h], iterateEdges(backwards, winding, brickInfo, showMortarSlices)))
    shapes.push(translate([-30, 0, h], iterateEdges(pentagon, winding, brickInfo, showMortarSlices)))
    shapes.push(translate([-30, 20, h], iterateEdges(mshape, winding, brickInfo, showMortarSlices)))
    shapes.push(translate([-10, 0, h], iterateEdges(complex, winding, brickInfo, showMortarSlices)))
    shapes.push(translate([25, 0, h], iterateEdges(complex2, winding, brickInfo, showMortarSlices)))
  }

  return rotate([-90, -90, 0], translate([-10, 0, 0], shapes))
}

module.exports = { main }
