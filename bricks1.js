const jscad = require('@jscad/modeling')
const { polygon, line, cuboid } = jscad.primitives
const { translate, rotate } = jscad.transforms
const { colorize, colorNameToRgb } = jscad.colors
const { offset } = jscad.expansions // TODO: replace this with something homegrown
const { extrudeLinear } = jscad.extrusions
const { subtract } = jscad.booleans
const { hull } = jscad.hulls

const classifyPoint = require('robust-point-in-polygon')

function traceBounds (prev, curr, next, finl, winding, isCurrentNonHullPoint, isNextNonHullPoint) {
  const p = line([prev, curr])
  const c = line([curr, next])
  const n = line([next, finl])

  const offsetOptions = { delta: -1.0, corners: 'edge' }

  const cp = colorize(colorNameToRgb('orange'), offset(offsetOptions, c))
  const ppp = offset(Object.assign({}, offsetOptions, { delta: isCurrentNonHullPoint ? -1.0 : -1.1 }), p)
  const s_np = offset(Object.assign({}, offsetOptions, { delta: mortarThickness }), n)
  const np = colorize(colorNameToRgb('red'), offset(offsetOptions, n))

  if (isNextNonHullPoint) {
    const s_pp = offset(Object.assign({}, offsetOptions, { delta: isCurrentNonHullPoint ? mortarThickness : 0 }), p)
    return winding
      ? [
          intersect(cp.points.flat(), s_pp.points.flat(), false), // SW
          intersect(s_pp.points.flat(), c.points.flat(), false), // SE
          intersect(c.points.flat(), np.points.flat(), false), // NE
          intersect(np.points.flat(), cp.points.flat(), false) // NW
        ]
      : [
          intersect(ppp.points.flat(), cp.points.flat(), false), // left start
          intersect(c.points.flat(), ppp.points.flat(), false), // right start
          intersect(s_np.points.flat(), c.points.flat(), false), // right end
          intersect(cp.points.flat(), s_np.points.flat(), false) // left end
        ]
  } else {
    const special_p = offset(Object.assign({}, offsetOptions, { delta: isCurrentNonHullPoint ? mortarThickness : 0 }), p)
    const a_npp = offset(Object.assign({}, offsetOptions, { delta: isNextNonHullPoint ? -1.0 : -1.1 }), n)
    return winding
      ? [
          intersect(cp.points.flat(), special_p.points.flat(), false),
          intersect(special_p.points.flat(), c.points.flat(), false),
          intersect(c.points.flat(), a_npp.points.flat(), false),
          intersect(a_npp.points.flat(), cp.points.flat(), false)
        ]
      : [
          intersect(ppp.points.flat(), cp.points.flat(), false), // left start
          intersect(c.points.flat(), ppp.points.flat(), false), // right start
          intersect(n.points.flat(), c.points.flat(), false), // right end
          intersect(cp.points.flat(), n.points.flat(), false) // left end
        ]
  }
}

function length (x, y, z) {
  return Math.sqrt(x * x + y * y + z * z)
}

function iterateEdges (points, winding, showMortarSlices = false) {
  const shapes = []
  const len = points.length

  const convexPoints = hull(polygon({ points: points })).sides.map(item => item[0])
  const nonHullPoints = [] // [2, 3] for complex or [1, 4] for complex2
  for (let index = 0; index < points.length; index++) {
    const p = points[index]
    if (classifyPoint(convexPoints, p)) {
      nonHullPoints.push(index)
    }
  }
  for (let i = 0; i < len - 1; i++) {
    const prev = (i === 0) ? points[len - 1] : points[i - 1]
    const curr = (i === 0) ? points[0] : points[i]
    const next = (i === 0) ? points[1] : points[i + 1]
    const finl = (i === 0) ? points[2] : (i <= len - 3 ? points[i + 2] : points[0])

    const edgeLength = length(next[0] - curr[0], next[1] - curr[1], 0)
    const brickLimit = edgeLength / (brickLength + mortarThickness)

    const blockOutline = traceBounds(prev, curr, next, finl, winding, nonHullPoints.find(tmp => tmp === i), nonHullPoints.find(tmp => tmp === i + 1))

    const color = i % 2 ? colorNameToRgb('orange') : colorNameToRgb('green')

    const block = colorize(color, extrudeLinear({ height: brickHeight }, polygon({ points: blockOutline })))

    // shapes.push(
    //   colorize(colorNameToRgb('goldenrod'), path2.fromPoints({}, [blockOutline[0], blockOutline[1]])) )
    // shapes.push(
    //   colorize(colorNameToRgb('green'), path2.fromPoints({}, [blockOutline[1], blockOutline[2]])) )
    // shapes.push(
    //   colorize(colorNameToRgb('blue'), path2.fromPoints({}, [blockOutline[2], blockOutline[3]])) )
    // shapes.push(
    //   colorize(colorNameToRgb('red'), path2.fromPoints({}, [blockOutline[3], blockOutline[0]])) )

    // now lay mortar and subtract it from the block
    const mortar = []
    for (let j = 0; j < brickLimit; j++) {
      const mortarSlice = layOnLine(curr.concat(0), next.concat(0),
        translate(
          [1, 1, (-j * (brickLength + mortarThickness)) - (winding ? brickWidth + mortarThickness : 0)],
          brick(3, 3, mortarThickness) // height, depth, width
        )
      )

      if (showMortarSlices) {
        // shapes.push(colorize(colorNameToRgb('gray'), mortarSlice))
      } else {
        mortar.push(colorize(colorNameToRgb('gray'), mortarSlice))
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

// from http://paulbourke.net/geometry/pointlineplane/
function intersect ([x1, y1, x2, y2], [x3, y3, x4, y4], enforceSegments) {
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

const brickHeight = 0.75
const brickWidth = 1
const mortarThickness = 1 / 10
const brickLength = (2 * brickWidth) + mortarThickness

function layOnLine (p2, p1, geometry) {
  const deltaX = p2[0] - p1[0]
  const deltaY = p2[1] - p1[1]
  const deltaZ = p2[2] - p1[2]
  const radialDistance = length(deltaX, deltaY, deltaZ)
  const inclinationAngle = Math.acos(deltaZ * radialDistance)
  const azimuthalAngle = Math.atan2(deltaY, deltaX)
  return translate(p2, rotate([0, inclinationAngle, azimuthalAngle], geometry))
}

function brick (brickLength, brickWidth, brickHeight) {
  return cuboid({ size: [brickLength, brickWidth, brickHeight], center: [-brickLength / 2, -brickWidth / 2, -brickHeight / 2] })
}

function main () {
  const shapes = []

  const triangle = [[0, 0], [10, 10], [0, 10]]
  const box = [[0, 0], [9.8, 0], [9.8, 9.8], [0, 9.8]]
  const backwards = [[0, 9.8], [9.8, 9.8], [9.8, 0], [0, 0]]
  const pentagon = [[0, 0], [0, 6], [6, 10], [12, 6], [12, 0]]
  const mshape = [[12, 0], [12, 10], [7, 6], [3, 6], [0, 10], [0, 0]]
  const complex = [[0, 0], [7.2, 0], [14.2, 9.9], [18, 9.9], [19.8, 0], [29.6, 0], [29.6, 13.1], [0, 13.1]]
  const complex2 = [[0, 0], [7.2, 0], [14.2, -9.9], [18, -9.9], [19.8, 0], [29.6, 0], [29.6, 13.1], [0, 13.1]]

  for (let i = 0; i < 2; i++) {
    const winding = i % 2
    const h = i * (brickHeight + mortarThickness)
    shapes.push(translate([-60, 0, h], iterateEdges(triangle, winding, true)))
    shapes.push(translate([-45, 0, h], iterateEdges(box, winding, true)))
    shapes.push(translate([-45, 20, h], iterateEdges(backwards, winding, true)))
    shapes.push(translate([-30, 0, h], iterateEdges(pentagon, winding, true)))
    shapes.push(translate([-30, 20, h], iterateEdges(mshape, winding, false)))
    shapes.push(translate([-10, 0, h], iterateEdges(complex, winding, true)))
    shapes.push(translate([25, 0, h], iterateEdges(complex2, winding, true)))
  }

  return translate([-10, 0, 0], shapes)
}

module.exports = { main }
