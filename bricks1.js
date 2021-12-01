const jscad = require('@jscad/modeling')
const { polygon, line, cuboid } = jscad.primitives
const { translate, rotate } = jscad.transforms
const { offset } = jscad.expansions // TODO: replace this with something homegrown
const { extrudeLinear } = jscad.extrusions
const { subtract } = jscad.booleans
const { hull } = jscad.hulls
const { normal, normalize, fromValues } = jscad.maths.vec2
const { path2, line2, geom2 } = jscad.geometries

const classifyPoint = require('robust-point-in-polygon')

// see http://paulbourke.net/geometry/pointlineplane/
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
  console.log('points upon iterateEdges():', points)

  const convexPoints = hull(polygon({ points })).sides.map(item => item[0])
  const innerPoints = []

  for (let index = 0; index < len; index++) {
    const p = points[index]
    if (classifyPoint(convexPoints, p)) {
      innerPoints.push(index)
    }
  }

  // first we preallocate a result array of 2 * n slots
  const result = []

  const offsetPoints = findOffset(points.slice().reverse(), -brickInfo.brickWidth)

  shapes.push(extrudeLinear({ height: brickInfo.brickHeight }, polygon({ points: [points, offsetPoints] })))

  // then we visit the points inside the hull, and calculate the green cut lines by
  // intersecting the corresponding offset line with a line normal to the current line
  // segment (in this case line 1-2)
  const specialPoints = points.slice()
  //   const specialPoints = winding ? points.slice() : points.slice().reverse()
  for (let i = 0; i < specialPoints.length - 1; i++) {
    if (!innerPoints.find(item => item === i)) { continue }
    const curr = specialPoints[i]
    const next = specialPoints[i + 1]

    const c3 = [curr[0], curr[1], 0]
    const n3 = [next[0], next[1], 0]

    const mortarSlice = layOnLine(
      c3,
      n3,
      translate(
        [1, 1, 0],
        zeroedCuboid(3, 3, brickInfo.mortarThickness) // height, depth, width
      )
    )

    shapes.push(mortarSlice)
  }

  // then we visit the offset points in the opposite order, as indicated in the diagram,
  // finding all the red cut lines. each cut line is placed in its slot in order
  // for (let i = 0; i < )

  // then we make one final pass over the combined loops, cutting out each block
  console.log('points.length:', points.length, 'offsetPoints.length:', offsetPoints.length, 'innerPoints:', innerPoints)
  console.log('points:', points, 'offsetPoints', offsetPoints)
  const specialOffsetPoints = offsetPoints.slice()
  //   const specialOffsetPoints = winding ? offsetPoints.slice() : offsetPoints.slice().reverse()
  for (let i = 0; i < specialOffsetPoints.length - 1; i++) {
    const inverseI = (specialOffsetPoints.length - 1) - i
    console.log('i:', i, 'inverseI:', inverseI)
    if (innerPoints.find(item => item === inverseI)) { continue }

    // const prev = (i === 0) ? offsetPoints[offsetPoints.length - 1] : points[i - 1]
    const curr = (i === 0) ? specialOffsetPoints[0] : specialOffsetPoints[i]
    const next = (i === 0) ? specialOffsetPoints[1] : specialOffsetPoints[i + 1]

    const mortarSlice = layOnLine(
      [curr[0], curr[1], 0],
      [next[0], next[1], 0],
      translate(
        [1, 1, 0],
        zeroedCuboid(3, 3, brickInfo.mortarThickness) // height, depth, width
      )
    )

    shapes.push(mortarSlice)
  }

  for (let i = 0; i < len - 1; i++) {
    const prev = (i === 0) ? points[len - 1] : points[i - 1]
    const curr = (i === 0) ? points[0] : points[i]
    const next = (i === 0) ? points[1] : points[i + 1]
    const finl = (i === 0) ? points[2] : (i <= len - 3 ? points[i + 2] : points[0])

    const edgeLength = length(next[0] - curr[0], next[1] - curr[1], 0)
    const brickLimit = Math.ceil(edgeLength / (brickInfo.brickLength + brickInfo.mortarThickness))

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
    const p0 = blockOutline[angle > 90 ? 1 : 0].concat(0)
    const p1 = blockOutline[angle > 90 ? 2 : 3].concat(0)

    // const finalEdgeLength = length(p1[0] - p0[0], p1[1] - p0[1], 0)

    // now lay mortar and subtract it from the block
    const mortar = []
    for (let j = 0; j < brickLimit; j++) {
      /*
      if (j == brickLimit - 1) { // do the last cut from the opposite edge
        const lastEdge = ((j - 1) * (brickInfo.brickLength + brickInfo.mortarThickness)) + brickInfo.mortarThickness
        if (lastEdge == brickInfo.mortarThickness) { continue }
        const finalLength = (finalEdgeLength - lastEdge + brickInfo.mortarThickness) / 2

        if (finalLength < brickInfo.brickWidth) { continue }

        const finalPosition = finalEdgeLength - finalLength

        const mortarSlice = layOnLine(
          p0, p1,
          translate(
            [1, 1, -finalPosition],
            zeroedCuboid(3, 3, brickInfo.mortarThickness) // height, depth, width
          )
        )

        if (showMortarSlices) {
          shapes.push(mortarSlice)
        } else {
          mortar.push(mortarSlice)
        }

        continue
      }
      */

      //       const mortarSlice = layOnLine(
      //         p0, p1,
      //         translate(
      //           [1, 1, (-j * (brickInfo.brickLength + brickInfo.mortarThickness)) + brickInfo.mortarThickness],
      //           zeroedCuboid(3, 3, brickInfo.mortarThickness) // height, depth, width
      //         )
      //       )

      //       if (showMortarSlices) {
      //         shapes.push(mortarSlice)
      //       } else {
      //         mortar.push(mortarSlice)
      //       }
    }

    let scratchBlock = block
    for (let k = 0; k < mortar.length; k++) {
      scratchBlock = subtract(scratchBlock, mortar[k])
    }

    //     shapes.push(scratchBlock)
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

// https://stackoverflow.com/a/54241014/53140
function findOffset (points, offset) {
  const pts = points.map(point => ({ x: point[0], y: point[1] })) // TODO: remove
  const newPoints = []
  for (let j = 0; j < pts.length; j++) {
    let i = (j - 1)
    if (i < 0) i += pts.length
    const k = (j + 1) % pts.length

    let v1 = [pts[j].x - pts[i].x, pts[j].y - pts[i].y]
    const mag1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1])
    v1 = [v1[0] / mag1, v1[1] / mag1]
    v1 = [v1[0] * offset, v1[1] * offset]
    const n1 = [-v1[1], v1[0]]
    const x1 = pts[i].x + n1[0]
    const y1 = pts[i].y + n1[1]
    const x2 = pts[j].x + n1[0]
    const y2 = pts[j].y + n1[1]

    let v2 = [pts[k].x - pts[j].x, pts[k].y - pts[j].y]
    const mag2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1])
    v2 = [v2[0] / mag2, v2[1] / mag2]
    v2 = [v2[0] * offset, v2[1] * offset]
    const n2 = [-v2[1], v2[0]]
    const x3 = pts[j].x + n2[0]
    const y3 = pts[j].y + n2[1]
    const x4 = pts[k].x + n2[0]
    const y4 = pts[k].y + n2[1]

    const den = ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1))
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / den
    const x = x1 + ua * (x2 - x1)
    const y = y1 + ua * (y2 - y1)

    newPoints.push([x, y])
  }

  return newPoints
}

function main () {
  const shapes = []

  // const triangle = [[0, 0], [10, 10], [0, 10]]
  // const box = [[0, 0], [9.8, 0], [9.8, 9.8], [0, 9.8]]
  // const backwards = [[0, 9.8], [9.8, 9.8], [9.8, 0], [0, 0]]
  // const pentagon = [[0, 0], [0, 6], [6, 10], [12, 6], [12, 0]]
  // const mshape = [[12, 0], [12, 10], [7, 6], [3, 6], [0, 10], [0, 0]]
  const complex = [[0, 0], [7.2, 0], [14.2, 8.8], [18, 8.8], [19.8, 0], [29.4, 0], [29.6, 12.0], [0, 12.0]]
  const complex2 = [[0, 0], [7.2, 0], [10.2, -8.8], [18, -8.8], [19.8, 0], [29.6, 0], [29.6, 12.0], [0, 12.0]]

  const brickInfo = makeBrickInfo(1.0, 0.75, 1.0 / 10.0)

  const showMortarSlices = true
  for (let i = 0; i < 1; i++) {
    const winding = i % 2
    const h = i * (brickInfo.brickHeight + brickInfo.mortarThickness) + brickInfo.mortarThickness
    // shapes.push(translate([-60, 0, h], iterateEdges(triangle, winding, brickInfo, showMortarSlices)))
    // shapes.push(translate([-45, 0, h], iterateEdges(box, winding, brickInfo, showMortarSlices)))
    // shapes.push(translate([-45, 20, h], iterateEdges(backwards, winding, brickInfo, showMortarSlices)))
    // shapes.push(translate([-30, 0, h], iterateEdges(pentagon, winding, brickInfo, showMortarSlices)))
    // shapes.push(translate([-30, 20, h], iterateEdges(mshape, winding, brickInfo, showMortarSlices)))
    shapes.push(translate([-10, 0, h], iterateEdges(complex, winding, brickInfo, showMortarSlices)))
    shapes.push(translate([25, 0, h], iterateEdges(complex2, winding, brickInfo, showMortarSlices)))
  }

  return rotate([-90, -90, 0], translate([50, 0, 0], shapes))
}

module.exports = { main }
