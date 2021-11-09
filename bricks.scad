brickHeight = 0.75;
brickWidth = 1;
mortarThickness = 1 / 10;
brickLength = (2 * brickWidth) + mortarThickness;
bm = brickLength + mortarThickness;

w = (5 * bm) - mortarThickness;
d = (5 * bm) - mortarThickness;

v0 = [
         [0, 0], [w, 0], [w, d], [0, d],
//         [0, 8.5 * bm], [8.5 * bm, 8.5 * bm], [8.5 * bm, 4.95 * bm], [0, 4.95 * bm],
//         [0, 3.5 * bm], [8.5 * bm, 3.5 * bm], [8.5 * bm, 1.45 * bm], [0, 1.45 * bm]
     ];
h0 = [ // TODO: figure out how to generate convex hull from points such as v0 directly
         [0, 0], [w, 0], [w, d], [0, d]
     ];
v1 = [
[-0.1, d + 0.1],[w + 0.1, d + 0.1],[w + 0.1, -0.1], [-0.1, -0.1]];

// TODO: try https://github.com/openscad/scad-utils/blob/master/hull.scad
//h0 = convexhull2d(v0);

dispv(v0);

for (i = [0 : 10]) {
    wallify(v0, i * (brickHeight + mortarThickness), i % 2, false);
}

translate([0, 10.9, 0]) {
    rotate([0, 0, -90]) {
        for (i = [0 : 10]) {
            wallify(v1, i * (brickHeight + mortarThickness), i % 2, true);
        }
        dispv(v0);
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
    Xdist = p2[0] - p1[0];
    Ydist = p2[1] - p1[1];
    Zdist = p2[2] - p1[2];

    length = norm([Xdist, Ydist, Zdist]); // radial distance
    b = acos(Zdist / length); // inclination angle
    c = atan2(Ydist, Xdist); // azimuthal angle

    translate(p1) {
        rotate([0, b, c]) {
            if (!insideOut) {
                offsetLength = ((brickLength - mortarThickness) / 2);
                halfStepLength = (brickLength + mortarThickness) / 2;
                adjWallOffset = isWallEven
                    ? halfStepLength
                    : 0;
    
                offset = isCourseEven
                    ? ((brickLength - mortarThickness) / 2)
                    : 0;
                
                offset2 = offset > 0 ? offset + mortarThickness : offset;
    
                if (isWallEven && !isCourseEven) {
                    runningBondEx(length - offset2 - adjWallOffset, adjWallOffset + offset2);
                } else {
                    runningBondEx(length - offset2, offset2 - adjWallOffset);
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
