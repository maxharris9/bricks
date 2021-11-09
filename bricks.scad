brickHeight = 0.75;
brickWidth = 1;
mortarThickness = 1 / 10;
brickLength = (2 * brickWidth) + mortarThickness;
bm = brickLength + mortarThickness;

w = (10 * bm) - mortarThickness;
d = (10 * bm) - mortarThickness;

simple = [[0, 0], [w, 0], [w, d], [0, d]];
complex = [[0, 0], [w, 0], [w, d], [0, d],
          [0, 8.5 * bm], [8.5 * bm, 8.5 * bm], [8.5 * bm, 4.95 * bm], [0, 4.95 * bm],
          [0, 3.5 * bm], [8.5 * bm, 3.5 * bm], [8.5 * bm, 1.45 * bm], [0, 1.45 * bm]];

// TODO: figure out how to generate convex hull from points such as `simple` directly
// maybe try `https://github.com/openscad/scad-utils/blob/master/hull.scad`?
// `h0 = convexhull2d(simple);`
h0 = [[0, 0], [w, 0], [w, d], [0, d]];

secondWythe = [[-0.1, -0.1], [-0.1, d + 0.1], [w + 0.1, d + 0.1], [w + 0.1, -0.1]];

dispv(complex);
for (i = [0 : 10]) {
    wallify(complex, i * (brickHeight + mortarThickness), i % 2, false);
}

//dispv(simple);
//for (i = [0 : 20]) {
//    wallify(simple, i * (brickHeight + mortarThickness), i % 2, false);
//    wallify(secondWythe, i * (brickHeight + mortarThickness), i % 2, true);
//}

module wallify (v, h, isCourseEven, insideOut) {
    length = len(v);
    for (i = [0 : length]) {
        // holy crap OpenSCAD is bad at searching a 2D array
        searchItem = [v[i + 1].x, v[i + 1].y];
        result = search(searchItem, h0);
        convexPoint = result[0] != [] && result[1] != [];

        if (i < length - 1) {
            start = concat(v[i], [h]);
            end = concat(v[i + 1], [h]);

            // TODO: figure out how to do this
            // inside = point_in_polygon(v[i], h0, nonzero=false, eps=EPSILON);

            course(start, end, isCourseEven, i % 2, insideOut);
        } else {
            course(concat(v[length - 1], [h]), concat(v[0], [h]), isCourseEven, true, insideOut);
        }
    }
}

module course(p1, p2, isCourseEven, isWallEven, insideOut) {
    // translate line to angles. why is this function not built-in to OpenSCAD?
    Xdist = p2[0] - p1[0];
    Ydist = p2[1] - p1[1];
    Zdist = p2[2] - p1[2];
    length = norm([Xdist, Ydist, Zdist]); // radial distance
    b = acos(Zdist / length); // inclination angle
    c = atan2(Ydist, Xdist); // azimuthal angle

    translate(p1) {
        rotate([0, b, c]) {
            if (!insideOut) {
                halfStepLength = (brickLength + mortarThickness) / 2;
                adjWallOffset = isWallEven
                    ? halfStepLength
                    : 0;

                offset = isCourseEven
                    ? ((brickLength - mortarThickness) / 2) + mortarThickness
                    : 0;

                if (isCourseEven) {
                    runningBondEx(length - offset, offset - adjWallOffset);
                } else {
                    runningBondEx(length - offset - adjWallOffset, offset + adjWallOffset);
                }
            } else {
                halfStepLength = (brickLength - mortarThickness) / 2;

                if (isCourseEven) {
                    runningBondEx(length - mortarThickness, !isWallEven ? - halfStepLength : mortarThickness);
                } else {
                    runningBondEx(length - mortarThickness, isWallEven ? - halfStepLength : mortarThickness);
                }
            }
        }
    }
}

module runningBondEx(length, offset) {
    delta = brickLength + mortarThickness;
    start = offset;

    for (i = [start : delta : length]) {
        translate([- brickHeight, 0, i]) {
            color("#8b4f39", 1.0) { cube([brickHeight, brickWidth, brickLength]); }
        }
    }
}

function angle (a1, a2, b1, b2) =
    let (dAx = a2.x - a1.x)
    let (dAy = a2.y - a1.y)
    let (dBx = b2.x - b1.x)
    let (dBy = b2.y - b1.y)
    atan2(dAx * dBy - dAy * dBx, dAx * dBx + dAy * dBy);

module dispv (v) {
    indi = [[for (i = [0: len(v) - 1]) i]];

    color("gray", 1.0) { translate([0, 0, -0.5]) {
        // hull()
        polygon(points = v, paths = indi);
    } }
}
