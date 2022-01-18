const jscad = require('@jscad/modeling')
const { polygon, cuboid } = jscad.primitives
const { translate, rotate } = jscad.transforms
const { extrudeLinear } = jscad.extrusions
const { subtract } = jscad.booleans

function main () {
  const result = []

  const triangle = [[0, 0], [10, 10], [0, 10]]
  const box = [[0, 0], [9.8, 0], [9.8, 9.8], [0, 9.8]]
  const pentagon = [[12, 6], [6, 10], [0, 6], [0, 0], [12, 0]]
  const mshape = [[12, 0], [12, 20], [8, 6], [4, 6], [0, 20], [0, 5], [-2, 0]]
  const complex = [[0, 0], [7.2, 0], [14.2, 8.8], [18, 8.8], [19.8, 0], [29.4, 0], [29.6, 12.0], [0, 12.0]]
  const complex2 = [[0, 0], [7.2, 0], [10.2, -8.8], [18, -8.8], [19.8, 0], [29.6, 0], [29.6, 12.0], [0, 12.0]]
  const complex3 = [[0, 0], [7.2, 0], [10.2, -8.8], [18, -8.8], [19.8, 0], [29.6, 0], [29.6, 12.0], [25, 39], [20, 15], [10, 12.0], [10, 6.2], [5, 6.2], [5, 12.0], [0, 12.0]]

  const brickInfo = makeBrickInfo(1.0 * 1, 0.75 * 1, 1.0 / 20.0 * 1)

  const showMortarSlices = true
  for (let i = 0; i < 1; i++) {
    const winding = i % 2
    const h = i * (brickInfo.brickHeight + brickInfo.mortarThickness) + brickInfo.mortarThickness
    result.push(translate([-60, 0, h], iterateEdges(triangle, winding, brickInfo, showMortarSlices)))
    result.push(translate([-45, 0, h], iterateEdges(box, winding, brickInfo, showMortarSlices)))
    result.push(translate([-30, 0, h], iterateEdges(pentagon, winding, brickInfo, showMortarSlices)))
    result.push(translate([-30, 20, h], iterateEdges(mshape, winding, brickInfo, showMortarSlices)))
    result.push(translate([-10, 0, h], iterateEdges(complex, winding, brickInfo, showMortarSlices)))
    result.push(translate([25, 0, h], iterateEdges(complex2, winding, brickInfo, showMortarSlices)))
    result.push(translate([60, 0, h], iterateEdges(complex3, winding, brickInfo, showMortarSlices)))
  }

  return rotate([Math.PI / 2, 0, 0], translate([50, 0, 0], result))
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

function emitCutPoints (curr, next, brickInfo) {
  const result = []
  const length = len(curr, next)

  if (length <= brickInfo.brickLength) {
    return result
  }

  const halfway = length / 2

  const [x1, y1] = next
  const [x2, y2] = curr

  const mid = midPoint(curr, next)

  const steps = Math.floor(halfway / brickInfo.brickLength)
  const keystoneWidth = brickInfo.brickWidth

  const remainder = halfway - (steps * brickInfo.brickLength)
  const addMidPoint = (remainder > (brickInfo.brickLength / 2))

  const n = normalize([x2 - x1, y2 - y1]) // [xf - xi, yf - yi]

  for (let i = 0; i < steps + 1; i++) {
    if (i === steps && !addMidPoint) { // we're on the last cut on this half of the edge
      const xp = mid[0] - (keystoneWidth * n[0])
      const yp = mid[1] - (keystoneWidth * n[1])
      result.push([xp, yp])
    } else {
      const delta = i * (brickInfo.brickLength + brickInfo.mortarThickness)
      const xp = delta * n[0]
      const yp = delta * n[1]
      result.push([xp + x1, yp + y1])
    }
  }

  if (addMidPoint) {
    result.push(mid)
  }

  for (let i = steps; i > -1; i--) {
    if (i === steps && !addMidPoint) { // we're on the last cut on this half of the edge
      const xp = mid[0] + (keystoneWidth * n[0])
      const yp = mid[1] + (keystoneWidth * n[1])
      result.push([xp, yp])
    } else {
      const delta = i * (brickInfo.brickLength + brickInfo.mortarThickness)
      const x = delta * n[0]
      const y = delta * n[1]
      result.push([x2 - x, y2 - y])
    }
  }

  return result
}

function traceBetween (points) {
  const result = []
  for (let j = 0; j < points.length - 1; j++) {
    const curr = points[j]
    const next = points[j + 1]
    result.push(midPoint(curr, next))
  }

  return result
}

function zeroedCuboid (length, width, height) {
  return cuboid({ size: [length, width, height], center: [-length / 2, -width / 2, -height / 2] })
}

function layOnLine (p2, p1, geometry) {
  const deltaX = p2[0] - p1[0]
  const deltaY = p2[1] - p1[1]
  const inclinationAngle = Math.PI / 2
  const azimuthalAngle = Math.atan2(deltaY, deltaX)

  return translate(p2, rotate([0, inclinationAngle, azimuthalAngle], geometry))
}

function layOnLineLeft (p2, p1, geometry) {
  const deltaX = p1[0] - p2[0]
  const deltaY = p1[1] - p2[1]
  const inclinationAngle = Math.PI / 2
  const azimuthalAngle = Math.atan2(deltaY, deltaX)

  return translate(p2, rotate([0, inclinationAngle, azimuthalAngle], geometry))
}

function cutAcuteHeadJoints (iterations, brickInfo, a, b, d, nAB, normyAB, layFunc, result) {
  let miterLength = 0

  for (let j = 1; j < iterations; j++) {
    const cutDistance = (j * (
      brickInfo.brickLength +
      brickInfo.mortarThickness))
    const [xs, ys] = a

    const p1 = [xs + nAB[0] * cutDistance, ys + nAB[1] * cutDistance]
    const p2 = b
    const p1p = [p1[0] + normyAB[0], p1[1] + normyAB[1]]

    const res = intersect([...b, ...d], [...p1p, ...p1], false)
    if (res !== false) {
      if (j === iterations - 1) {
        miterLength = len(d, res)
      }
      result.push(layFunc(p1, p2, zeroedCuboid(brickInfo.brickHeight, len(p1, res), brickInfo.mortarThickness)))
    }
  }

  return miterLength
}

function cutAcuteJoints (a, b, c, d, brickInfo, winding, result) {
  const edgeLenA = len(a, b)
  const edgeLenB = len(c, b)
  const iterations = Math.ceil(Math.min(edgeLenA, edgeLenB) / brickInfo.brickLength)

  // cut mortar joints, finding the depth by intersecting with the diagonal along the way
  let miterLength = 0

  const deltaAB = [b[0] - a[0], b[1] - a[1]]
  const tmpAB = cutAcuteHeadJoints(iterations, brickInfo, a, b, d, normalize(deltaAB), normal(deltaAB, brickInfo.brickWidth), layOnLine, result)
  if (tmpAB > miterLength) {
    miterLength = tmpAB
  }

  const deltaCB = [b[0] - c[0], b[1] - c[1]]
  const tmpCB = cutAcuteHeadJoints(iterations, brickInfo, c, b, d, normalize(deltaCB), normal(deltaCB, brickInfo.brickWidth), layOnLineLeft, result)
  if (tmpCB > miterLength) {
    miterLength = tmpCB
  }

  if (miterLength === 0) { return }

  if (edgeLenA > edgeLenB) {
    result.push(layOnLine(d, b, zeroedCuboid(brickInfo.brickHeight, brickInfo.mortarThickness, miterLength)))
  } else {
    result.push(layOnLine(d, b, zeroedCuboid(brickInfo.brickHeight, brickInfo.mortarThickness, miterLength + brickInfo.mortarThickness)))
  }
}

function iterateEdges (points, winding, brickInfo, showMortarSlices = false) {
  const offsetPoints = traceOffset(points.slice(), brickInfo.brickWidth)
  const extrudedPolygon = extrudeLinear({ height: brickInfo.brickHeight }, polygon({ points: [points.slice(), offsetPoints.slice().reverse()] }))

  const result = []
  const cornerCuts = []

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]

    const c = offsetPoints[i]
    const d = offsetPoints[i + 1]

    const tmp = closestPointEx([a, b], c, true)
    cornerCuts.push(closestPointEx(tmp, d, false))
  }

  // convert to 3D geometry that jscad can render into STL
  for (let i = 0; i < cornerCuts.length - 1; i++) {
    const p = cornerCuts[i]
    const cp = emitCutPoints(p[1], p[0], brickInfo)
    const currentPoints = winding
      ? i % 2
          ? traceBetween(cp)
          : cp
      : i % 2
        ? cp
        : traceBetween(cp)

    const np = cornerCuts[i + 1]
    const cpp = emitCutPoints(np[1], np[0], brickInfo)
    const nextPoints = !winding
      ? i % 2
          ? traceBetween(cpp)
          : cpp
      : i % 2
        ? cpp
        : traceBetween(cpp)

    // console.log('currentPoints:', currentPoints)

    const a = currentPoints[currentPoints.length - 1]
    const b = points[i + 1]
    const c = nextPoints[0]
    const d = offsetPoints[i + 1]

    const angle = getAngle(c, b, a)
    if (angle < 90) {
      cutAcuteJoints(a, b, c, d, brickInfo, winding, result)
    }

    const [xi, yi] = p[0]
    const [xf, yf] = p[1]
    const n = normalize([xf - xi, yf - yi])

    for (let j = 0; j < currentPoints.length / 2; j++) {
      const [x1, y1] = currentPoints[j]
      result.push(layOnLine(currentPoints[j], [x1 + n[0], y1 + n[1]], zeroedCuboid(brickInfo.brickHeight, brickInfo.brickWidth, brickInfo.mortarThickness)))
    }

    for (let j = currentPoints.length - 1; j >= currentPoints.length / 2; j--) {
      const [x1, y1] = currentPoints[j]
      result.push(layOnLine(currentPoints[j], [x1 - n[1], y1 + n[0]], zeroedCuboid(brickInfo.brickHeight, brickInfo.mortarThickness, brickInfo.brickWidth)))
    }
  }

  return subtract(extrudedPolygon, result)
  // return result.concat(extrudedPolygon)
}

//
// | geometry
// v

// see http://paulbourke.net/geometry/pointlineplane/
function intersect ([x1, y1, x2, y2], [x3, y3, x4, y4], enforceSegments = false) {
  // console.log('x1, y1 -> x4, y4:', x1, y1, x2, y2, x3, y3, x4, y4)
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

function normalize (v) {
  const mag = Math.sqrt(v[0] * v[0] + v[1] * v[1])
  return [v[0] / mag, v[1] / mag]
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

function closestPointEx ([[x1, y1], [x2, y2]], [px, py], side) {
  const sqLineMag = sqLineMagnitude(x1, y1, x2, y2)
  if (sqLineMag < EPS_SQ) {
    return -1
  }

  const u = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / sqLineMag

  if ((u < EPS) || (u > 1)) { // closest point does not fall within the line segment
    return [[x1, y1], [x2, y2]]
  } else {
    const newPoint = [
      x1 + u * (x2 - x1),
      y1 + u * (y2 - y1)
    ]

    if (side) {
      return [newPoint, [x2, y2]]
    } else {
      return [[x1, y1], newPoint]
    }
  }
}

function getAngle (p0, p1, p2) {
  const dAx = p1[0] - p0[0]
  const dAy = p1[1] - p0[1]
  const dBx = p2[0] - p1[0]
  const dBy = p2[1] - p1[1]

  return 180 + (Math.atan2(dAx * dBy - dAy * dBx, dAx * dBx + dAy * dBy) * 180 / Math.PI)
}

module.exports = { main }
