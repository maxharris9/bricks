const jscad = require('@jscad/modeling')
const { polygon, cuboid } = jscad.primitives
const { translate, rotate } = jscad.transforms
const { extrudeLinear } = jscad.extrusions
const { subtract } = jscad.booleans
const { hull } = jscad.hulls

const classifyPoint = require('robust-point-in-polygon')

function main () {
  const shapes = []

  const triangle = [[0, 0], [10, 10], [0, 10]]
  const box = [[0, 0], [9.8, 0], [9.8, 9.8], [0, 9.8]]
  const pentagon = [[12, 6], [6, 10], [0, 6], [0, 0], [12, 0]]
  const mshape = [[12, 0], [12, 10], [7, 6], [3, 6], [0, 10], [0, 0]]
  const complex = [[0, 0], [7.2, 0], [14.2, 8.8], [18, 8.8], [19.8, 0], [29.4, 0], [29.6, 12.0], [0, 12.0]]
  const complex2 = [[0, 0], [7.2, 0], [10.2, -8.8], [18, -8.8], [19.8, 0], [29.6, 0], [29.6, 12.0], [0, 12.0]]

  const brickInfo = makeBrickInfo(1.5, 0.75, 1.0 / 10.0)

  const showMortarSlices = true
  for (let i = 0; i < 2; i++) {
    const winding = i % 2
    const h = i * (brickInfo.brickHeight + brickInfo.mortarThickness) + brickInfo.mortarThickness
    shapes.push(translate([-60, 0, h], iterateEdges(triangle, winding, brickInfo, showMortarSlices)))
    shapes.push(translate([-45, 0, h], iterateEdges(box, winding, brickInfo, showMortarSlices)))
    shapes.push(translate([-30, 0, h], iterateEdges(pentagon, winding, brickInfo, showMortarSlices)))
    shapes.push(translate([-30, 20, h], iterateEdges(mshape, winding, brickInfo, showMortarSlices)))
    shapes.push(translate([-10, 0, h], iterateEdges(complex, winding, brickInfo, showMortarSlices)))
    shapes.push(translate([25, 0, h], iterateEdges(complex2, winding, brickInfo, showMortarSlices)))
  }

  return shapes // rotate([-90, -90, 0], translate([50, 0, 0], shapes))
}

function makeBrickInfo (brickWidth, brickHeight, mortarThickness) {
  return {
    brickWidth,
    brickHeight,
    brickLength: (2 * brickWidth) + mortarThickness,
    mortarThickness
  }
}

function iterateEdges (points, winding, brickInfo, showMortarSlices = false) {
  const shapes = []

  const convexPoints = hull(polygon({ points })).sides.map(item => item[0])
  const innerPoints = []

  for (let index = 0; index < points.length; index++) {
    if (classifyPoint(convexPoints, points[index]) === -1) {
      innerPoints.push(index)
    }
  }

  const offsetPoints = traceOffset(points.slice().reverse(), -brickInfo.brickWidth)
  const cuttingPlanes = new Array(offsetPoints.length)

  // find the last joint first
  const first = offsetPoints.length - 1
  const last = winding ? 0 : offsetPoints.length - 2
  cuttingPlanes[0] = cutWall(brickInfo, offsetPoints[first], offsetPoints[last], !winding)

  // then we visit the points inside the hull, and calculate the green cut lines by
  // intersecting the corresponding offset line with a line normal to the current line
  // segment
  for (let i = 0; i < innerPoints.length; i++) {
    const innerIndex = innerPoints[i]
    cuttingPlanes[innerIndex] = cutAlongPoints(points, innerIndex, winding, brickInfo)
  }

  // then we visit the offset points in the opposite order finding all the red cut lines.
  // each cut line is placed in its slot in order
  const limit = offsetPoints.length - 1 // cutAlongPoints needs a slot to wrap around the last corner
  for (let i = 0; i < limit; i++) {
    const inverseI = limit - i
    if (innerPoints.includes(inverseI)) { continue }
    cuttingPlanes[inverseI] = cutAlongPoints(offsetPoints, i, winding, brickInfo)
  }

  let extrudedPolygon = extrudeLinear({ height: brickInfo.brickHeight }, polygon({ points: [points, offsetPoints] }))
  for (let k = 0; k < cuttingPlanes.length; k++) {
    extrudedPolygon = subtract(extrudedPolygon, cuttingPlanes[k])
  }

  shapes.push(extrudedPolygon)

  return shapes
}

function cutAlongPoints (points, i, winding, brickInfo) {
  const next = winding
    ? i === 0
        ? points[points.length - 1]
        : points[i - 1]
    : points[i + 1]
  return cutWall(brickInfo, points[i], next, winding)
}

function cutWall (brickInfo, curr, next, translateY) {
  return layOnLine(curr, next,
    translate([0, translateY ? brickInfo.brickWidth : 0, 0],
      zeroedCuboid(brickInfo.brickHeight, brickInfo.brickWidth, brickInfo.mortarThickness) // height, depth, width
    )
  )
}

function layOnLine (p2, p1, geometry) {
  const deltaX = p2[0] - p1[0]
  const deltaY = p2[1] - p1[1]
  const inclinationAngle = Math.PI / 2
  const azimuthalAngle = Math.atan2(deltaY, deltaX)

  return translate(p2, rotate([0, inclinationAngle, azimuthalAngle], geometry))
}

function zeroedCuboid (length, width, height) {
  return cuboid({ size: [length, width, height], center: [-length / 2, -width / 2, -height / 2] })
}

//
// | geometry
// v

// see http://paulbourke.net/geometry/pointlineplane/
function intersect ([x1, y1, x2, y2], [x3, y3, x4, y4], enforceSegments = false) {
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

function normal (v, offset) {
  const mag = Math.sqrt(v[0] * v[0] + v[1] * v[1])
  const tmp = [v[0] / mag * offset, v[1] / mag * offset]
  return [-tmp[1], tmp[0]]
}

function traceOffset (points, offset) {
  const result = []
  for (let j = 0; j < points.length; j++) {
    let i = (j - 1)
    if (i < 0) { i += points.length }
    const k = (j + 1) % points.length

    const v1 = [points[j][0] - points[i][0], points[j][1] - points[i][1]]
    const n1 = normal(v1, offset)

    const line1 = [
      points[i][0] + n1[0],
      points[i][1] + n1[1],
      points[j][0] + n1[0],
      points[j][1] + n1[1]
    ]

    const v2 = [points[k][0] - points[j][0], points[k][1] - points[j][1]]
    const n2 = normal(v2, offset)

    const line2 = [
      points[j][0] + n2[0],
      points[j][1] + n2[1],
      points[k][0] + n2[0],
      points[k][1] + n2[1]
    ]

    result.push(intersect(line1, line2, false))
  }

  return result
}

module.exports = { main }
