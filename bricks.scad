brickHeight = 0.75;
brickWidth = 1;
mortarThickness = 1 / 10;
brickLength = (2 * brickWidth) + mortarThickness;

translate([0, 0, 0]) {
    complexDemo2();
}

translate ([25, 0, 0]) {
    complexDemo();
}
translate ([50, 0, 0]) {
    squareDemo();
}

module complexDemo2 () {
    bm = brickLength + mortarThickness;

    w = (10 * bm) - mortarThickness;
    d = (10 * bm) - mortarThickness;

    complex = [[0, 0], [w, 0], [w, d], [0, d],
              [0, 8.5 * bm], [8.5 * bm, 8.5 * bm], [8.5 * bm, 6.45 * bm], [0, 6.45 * bm],
              [0, 3.5 * bm], [8.5 * bm, 3.5 * bm], [8.5 * bm, 1.45 * bm], [0, 1.45 * bm]];
    c1 = [4, 5, 8, 9];
    c2 = [5, 6, 9, 10];
    c3 = [11];
    c4 = [7];

    dispv(complex);
    for (i = [0 : 10]) {
        setCourse(complex, i * (brickHeight + mortarThickness), i % 2, c1, c2, c3, c4);
    }
}

module complexDemo () {
    bm = brickLength + mortarThickness;

    w = (10 * bm) - mortarThickness;
    d = (10 * bm) - mortarThickness;

    complex = [[0, 0], [w, 0], [w, d], [0, d],
              [0, 8.5 * bm], [8.5 * bm, 8.5 * bm], [8.5 * bm, 4.95 * bm], [0, 4.95 * bm],
              [0, 3.5 * bm], [8.5 * bm, 3.5 * bm], [8.5 * bm, 1.45 * bm], [0, 1.45 * bm]];
    c1 = [4, 6, 8];
    c2 = [5, 6, 9, 10];
    c3 = [11];

    dispv(complex);
    for (i = [0 : 10]) {
        setCourse(complex, i * (brickHeight + mortarThickness), i % 2, c1, c2, c3);
    }
}

module squareDemo () {
    bm = brickLength + mortarThickness;

    w = (10 * bm) - mortarThickness;
    d = (10 * bm) - mortarThickness;

    simple = [[0, 0], [w, 0], [w, d], [0, d]];
    bwm = (brickWidth + mortarThickness);
    secondWythe = [[w - bwm, d - bwm], [bwm, d - bwm], [bwm, bwm], [w - bwm, bwm]];

    dispv(simple);
    for (i = [0 : 10]) {
        setCourse(simple, i * (brickHeight + mortarThickness), i % 2);
        setCourse(secondWythe, i * (brickHeight + mortarThickness), i % 2);
    }
}

module setCourse (v, h, isCourseEven, c1 = [], c2 = [], c3 = [], c4 = []) {
    // lay the edge connecting first and last elements
    length = len(v) - 1;
    course(
        concat(v[length], [h]),
        concat(v[0], [h]),
        find(length, c3) ? !isCourseEven : isCourseEven,
        length % 2,
        false
    );

    for (i = [0 : length - 1]) {
        course(
            concat(v[i], [h]),
            concat(v[i + 1], [h]),
            find(i, c4) ? !isCourseEven : isCourseEven,
            i % 2 || find(i, c1),
            find(i, c2)
        );
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
            if (insideOut) {
                if (isCourseEven) {
                    layBricks(
                        length - mortarThickness - brickWidth,
                        !isWallEven ? - brickWidth : mortarThickness
                    );
                } else {
                    layBricks(
                        length - mortarThickness - brickWidth,
                        isWallEven ? - brickWidth : mortarThickness
                    );
                }
            } else {
                if (isCourseEven) {
                    layBricks(
                        length - brickWidth - mortarThickness,
                        !isWallEven ? brickWidth + mortarThickness : 0
                    );
                } else {
                    layBricks(
                        length - (isWallEven ? brickWidth + mortarThickness : 0),
                        isWallEven ? brickWidth + mortarThickness : 0
                    );
                }
            }
        }
    }
}

module layBricks(length, offset) {
    delta = brickLength + mortarThickness;
    start = offset;

    for (i = [start : delta : length]) {
        translate([- brickHeight, 0, i]) {
            color("#8b4f39", 1.0) { cube([brickHeight, brickWidth, brickLength]); }
        }
    }
}

function findIndex(needle, haystack, i = 0) =
    i < len(haystack)
        ? needle == haystack[i]
            ? i
            : findIndex(needle, haystack, i + 1)
        : -1;

function find(needle, haystack) = findIndex(needle, haystack) > -1;

module dispv (v) {
    indi = [[for (i = [0: len(v) - 1]) i]];

    color("gray", 1.0) {
        translate([0, 0, -0.5]) {
            // hull()
            polygon(points = v, paths = indi);
        }
    }
}
