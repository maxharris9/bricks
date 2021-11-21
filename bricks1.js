const jscad = require('@jscad/modeling')
const { polygon } = jscad.primitives
const { line } = jscad.primitives
const { translate } = jscad.transforms
const { colorize, colorNameToRgb } = jscad.colors
const { offset } = jscad.expansions // TODO: replace this with something homegrown

function traceBounds (prev, curr, next, finl, winding) {
  const p = line([prev, curr])
  const c = line([curr, next])
  const n = line([next, finl])

  const offsetOptions = { delta: -1.0, corners: 'edge' }
  const pp = colorize(colorNameToRgb('goldenrod'), offset(offsetOptions, p))
  const cp = colorize(colorNameToRgb('orange'), offset(offsetOptions, c))
  const np = colorize(colorNameToRgb('red'), offset(offsetOptions, n))

  return colorize(
    colorNameToRgb('green'),
    polygon({
      points: winding
        ? [
            intersect(c.points.flat(), np.points.flat(), false),
            intersect(np.points.flat(), cp.points.flat(), false),
            intersect(cp.points.flat(), p.points.flat(), false),
            intersect(p.points.flat(), c.points.flat(), false)
          ]
        : [
            intersect(cp.points.flat(), n.points.flat(), false),
            intersect(n.points.flat(), c.points.flat(), false),
            intersect(c.points.flat(), pp.points.flat(), false),
            intersect(pp.points.flat(), cp.points.flat(), false)
          ]
    })
  )
}

function iterateEdges (points, winding, edgeInfo) {
  const shapes = []
  const len = points.length
  for (let i = 0; i < len - 1; i++) {
    // const brickLimit = edgeInfo[i].l
    const prev = (i === 0) ? points[len - 1] : points[i - 1]
    const curr = (i === 0) ? points[0] : points[i]
    const next = (i === 0) ? points[1] : points[i + 1]
    const finl = (i === 0) ? points[2] : (i <= len - 3 ? points[i + 2] : points[0])
    shapes.push(traceBounds(prev, curr, next, finl, winding))
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

function main () {
  const shapes = []

  const triangle = [[0, 0], [10, 10], [0, 10]]
  const box = [[0, 0], [9.8, 0], [9.8, 9.8], [0, 9.8]]
  const backwards = [[0, 9.8], [9.8, 9.8], [9.8, 0], [0, 0]]
  const pentagon = [[0, 0], [0, 6], [6, 10], [12, 6], [12, 0]]
  const complex = [[0, 0], [7.2, 0], [14.2, 9.9], [18, 9.9], [19.8, 0], [29.6, 0], [29.6, 13.1], [0, 13.1]]
  const complex2 = [[0, 0], [7.2, 0], [14.2, -9.9], [18, -9.9], [19.8, 0], [29.6, 0], [29.6, 13.1], [0, 13.1]]
  // const edgeInfo = [{ l: 6 }, { l: 5 }, { l: 3 }, { l: 4 }, { l: 4 }, { l: 6 }, { l: 13 }, { l: 6 }, { l: 5 }]

  for (let i = 0; i < 10; i++) {
    shapes.push(translate([-60, 0, i], iterateEdges(triangle, i % 2)))
    shapes.push(translate([-45, 0, i], iterateEdges(box, i % 2)))
    shapes.push(translate([-45, 20, i], iterateEdges(backwards, i % 2)))
    shapes.push(translate([-30, 0, i], iterateEdges(pentagon, i % 2)))
    shapes.push(translate([-10, 0, i], iterateEdges(complex, i % 2)))
    shapes.push(translate([25, 0, i], iterateEdges(complex2, i % 2)))
  }

  return shapes // translate([0, 0, 0], shapes)
}

module.exports = { main }
