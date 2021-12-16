const jscad = require('@jscad/modeling')
const { polygon, sphere } = jscad.primitives
const { translate } = jscad.transforms
const { extrudeLinear } = jscad.extrusions
const { hull } = jscad.hulls

const classifyPoint = require('robust-point-in-polygon')

function main () {
  const shapes = []

  const triangle = [[0, 0], [10, 10], [0, 10]]
  const box = [[0, 0], [9.8, 0], [9.8, 9.8], [0, 9.8]]
  const pentagon = [[12, 6], [6, 10], [0, 6], [0, 0], [12, 0]]
  // const mshape = [[12, 0], [12, 10], [7, 6], [3, 6], [0, 10], [0, 0]]
  const complex = [[0, 0], [7.2, 0], [14.2, 8.8], [18, 8.8], [19.8, 0], [29.4, 0], [29.6, 12.0], [0, 12.0]]
  const complex2 = [[0, 0], [7.2, 0], [10.2, -8.8], [18, -8.8], [19.8, 0], [29.6, 0], [29.6, 12.0], [0, 12.0]]

  const brickInfo = makeBrickInfo(1.0, 0.75, 1.0 / 20.0)

  const showMortarSlices = true
  for (let i = 0; i < 2; i++) {
    const winding = i % 2
    const h = i * (brickInfo.brickHeight + brickInfo.mortarThickness) + brickInfo.mortarThickness
    shapes.push(translate([-60, 0, h], iterateEdges(triangle, winding, brickInfo, showMortarSlices)))
    shapes.push(translate([-45, 0, h], iterateEdges(box, winding, brickInfo, showMortarSlices)))
    shapes.push(translate([-30, 0, h], iterateEdges(pentagon, winding, brickInfo, showMortarSlices)))
    // shapes.push(translate([-30, 20, h], iterateEdges(mshape, winding, brickInfo, showMortarSlices)))
    shapes.push(translate([-10, 0, h], iterateEdges(complex, winding, brickInfo, showMortarSlices)))
    shapes.push(translate([25, 0, h], iterateEdges(complex2, winding, brickInfo, showMortarSlices)))
  }

  return shapes // rotate([-90, -90, 0], translate([50, 0, 0], shapes))
}

function len (curr, next) {
  const deltaX = next[0] - curr[0]
  const deltaY = next[1] - curr[1]

  return Math.sqrt(deltaX * deltaX + deltaY * deltaY)
}

function makeBrickInfo (brickWidth, brickHeight, mortarThickness) {
  return {
    brickWidth,
    brickHeight,
    brickLength: (2 * brickWidth) + mortarThickness,
    mortarThickness
  }
}

function midPoint (curr, next) {
  const midX = ((next[0] - curr[0]) / 2) + curr[0]
  const midY = ((next[1] - curr[1]) / 2) + curr[1]

  return [midX, midY]
}

function addSecondSlice (walls, brickInfo) {
  const result = []

  for (let i = 0; i < walls.length; i++) {
    const points = walls[i]
    const shapes = []

    const [xi, yi] = points[0]
    const [xf, yf] = points[points.length - 1]

    const angle = calcAngle(xi, yi, xf, yf)

    for (let j = 0; j < points.length / 2; j++) {
      const [x1, y1] = points[j]
      shapes.push([x1, y1])

      const x = brickInfo.mortarThickness * Math.cos(angle)
      const y = brickInfo.mortarThickness * Math.sin(angle)
      shapes.push([x1 + x, y1 + y])
    }

    for (let j = points.length - 1; j >= points.length / 2; j--) {
      const [x1, y1] = points[j]
      shapes.push([x1, y1])

      const x = brickInfo.mortarThickness * Math.cos(angle)
      const y = brickInfo.mortarThickness * Math.sin(angle)
      shapes.push([x1 - x, y1 - y])
    }

    result.push(shapes)
  }

  return result
}

function calcAngle (x1, y1, x2, y2) {
  const a = x2 - x1
  const b = y2 - y1

  const slope = b / a
  return Math.atan(slope)
}

function emitCutPoints (curr, next, brickInfo) {
  const result = []
  const length = len(curr, next)

  if (length <= brickInfo.brickLength) {
    return result
  }

  const halfway = length / 2

  const [x1, y1] = next
  const [x2, y2] = curr

  const angle = calcAngle(x1, y1, x2, y2)

  const mid = midPoint(curr, next)

  const steps = Math.floor(halfway / brickInfo.brickLength)
  const keystoneWidth = brickInfo.brickWidth

  const remainder = halfway - (steps * brickInfo.brickLength)
  const addMidPoint = (remainder > (brickInfo.brickLength / 2))

  for (let i = 0; i < steps + 1; i++) {
    if (i === steps && !addMidPoint) { // we're on the last cut on this half of the edge
      const xp = mid[0] - (keystoneWidth * Math.cos(angle))
      const yp = mid[1] - (keystoneWidth * Math.sin(angle))
      result.push([xp, yp])
    } else {
      const delta = i * (brickInfo.brickLength + brickInfo.mortarThickness)
      const xp = delta * Math.cos(angle)
      const yp = delta * Math.sin(angle)
      result.push([xp + x1, yp + y1])
    }
  }

  if (addMidPoint) {
    result.push(mid)
  }

  for (let i = steps; i > -1; i--) {
    if (i === steps && !addMidPoint) { // we're on the last cut on this half of the edge
      const xp = mid[0] + (keystoneWidth * Math.cos(angle))
      const yp = mid[1] + (keystoneWidth * Math.sin(angle))
      result.push([xp, yp])
    } else {
      const delta = i * (brickInfo.brickLength + brickInfo.mortarThickness)
      const x = delta * Math.cos(angle)
      const y = delta * Math.sin(angle)
      result.push([x2 - x, y2 - y])
    }
  }

  return result
}

function traceWalls (points, offsetPoints, innerPoints, brickInfo, opt) {
  const shapes = []

  const lastIndex = points.length - (2 - opt)
  for (let i = opt, ip = i + 1; i < points.length - 1 + opt; i += 2, ip += 2) {
    const ipp = i === points.length - 1 ? 0 : ip

    const l = [points[i], points[ipp]]
    const curr = innerPoints.includes(i) ? points[i] : closestPoint(l, offsetPoints[i])
    const next = innerPoints.includes(ipp) ? points[ipp] : closestPoint(l, offsetPoints[ipp])

    shapes.push(
      i === lastIndex
        ? emitCutPoints(curr, next, brickInfo)
        : emitCutPoints(next, curr, brickInfo)
    )
  }

  return shapes
}

function traceBetween (walls) {
  const result = []

  for (let i = 0; i < walls.length; i++) {
    const points = walls[i]
    const shapes = []
    for (let j = 0; j < points.length - 1; j++) {
      const curr = points[j]
      const next = points[j + 1]
      shapes.push(midPoint(curr, next))
    }
    result.push(shapes)
  }

  return result
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

  const offsetPoints = traceOffset(points.slice(), brickInfo.brickWidth)
  const extrudedPolygon = extrudeLinear({ height: 0.1 }, polygon({ points: [points.slice(), offsetPoints.slice().reverse()] }))

  if (winding) {
    shapes.push(...addSecondSlice(traceWalls(points, offsetPoints, innerPoints, brickInfo, 1), brickInfo))
    shapes.push(...addSecondSlice(traceBetween(traceWalls(points, offsetPoints, innerPoints, brickInfo, 0)), brickInfo))
  } else {
    shapes.push(...addSecondSlice(traceWalls(points, offsetPoints, innerPoints, brickInfo, 0), brickInfo))
    shapes.push(...addSecondSlice(traceBetween(traceWalls(points, offsetPoints, innerPoints, brickInfo, 1)), brickInfo))
  }

  // convert to 3D geometry that jscad can render into STL
  return shapes
    .map(side => side.filter(cp => !!cp)
      .map(cp => sphere({ center: cp.concat(0), segments: 4, radius: 0.125 }))
    )
    .concat(extrudedPolygon)
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

const EPS = 0.000001 // smallest positive value: less than that to be considered zero
const EPS_SQ = EPS * EPS

function sqLineMagnitude (x1, y1, x2, y2) {
  return (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)
}

function closestPoint ([[x1, y1], [x2, y2]], [px, py]) {
  const sqLineMag = sqLineMagnitude(x1, y1, x2, y2)
  if (sqLineMag < EPS_SQ) {
    return -1
  }

  const u = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / sqLineMag

  if ((u < EPS) || (u > 1)) { // closest point does not fall within the line segment, take the shorter distance to an endpoint
    return [
      sqLineMagnitude(px, py, x1, y1),
      sqLineMagnitude(px, py, x2, y2)
    ]
  } else { // if (u < EPS) || (u > 1) // intersecting point is on the line, use the formula
    return [
      x1 + u * (x2 - x1),
      y1 + u * (y2 - y1)
    ]
  } // else !(u < EPS) || !(u > 1)
}

module.exports = { main }
