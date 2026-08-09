/**
 * The 3D cube view: csTimer's virtual cube, driven from this trainer.
 *
 * js/twisty.js and js/twistynnn.js are csTimer's renderer, vendored unmodified. They have no
 * "set the cube to this state" call - a twisty is built solved and then moved - so this view is
 * driven by replaying the same algorithms the trainer applies to its own cube, and reset by
 * rebuilding. cube3dReset must therefore be called wherever cube.resetCube is.
 *
 * Depends on colourForFace from js/RubiksCube.js for the colour scheme.
 */
(function () {

    var scene = null;
    var container = null;
    var failed = false;
    var dimension = 0;
    var colours = "";

    //Turn a CSS colour - a name or #rrggbb, as the settings allow - into the number three wants.
    var swatch = document.createElement("canvas").getContext("2d");
    function colourNumber(css) {
        swatch.fillStyle = "#000000";
        swatch.fillStyle = css;
        return parseInt(swatch.fillStyle.slice(1), 16);
    }

    function faceColours() {
        //cubeOptions.faceColors is ordered U R F D L B, the same order colourForFace takes
        return ["U", "R", "F", "D", "L", "B"].map(function (face) {
            return colourNumber(colourForFace(face));
        });
    }

    function currentDimension() {
        return document.getElementById("cubeType").value == "2x2" ? 2 : 3;
    }

    //stickerWidth and scale are the values csTimer itself passes (see puzzlefactory.js), so the
    //cube is proportioned the same. allowDragging stays off, as it is in csTimer: moves come from
    //the keyboard and the smart cube, not from dragging the picture.
    function parameters() {
        return {
            type: "cube",
            dimension: currentDimension(),
            faceColors: faceColours(),
            stickerWidth: 1.7,
            scale: 0.9,
            allowDragging: false
        };
    }

    //Rebuild whenever something baked in at construction time changed
    function settingsFingerprint() {
        return currentDimension() + ":" + faceColours().join(",");
    }

    function build() {
        scene = new twistyjs.TwistyScene();
        container = scene.getDomElement();
        container.id = "cube3d";
        container.style.display = "none";
        //twisty.js renders into a square canvas sized to the smaller side; centre it in the space
        container.style.alignItems = "center";
        container.style.justifyContent = "center";
        document.getElementById("simcube").appendChild(container);
        reset();
    }

    function reset() {
        dimension = currentDimension();
        colours = settingsFingerprint();
        scene.initializeTwisty(parameters());

        //twisty.js always lays a table over the canvas to catch drag-to-turn. With dragging off it
        //does nothing, and as a second flex child it pushes the canvas off centre, so take it out
        //of the layout. It is rebuilt with the twisty, hence doing this on every reset.
        var touchCube = container.querySelector("table.touchcube");
        if (touchCube) {
            touchCube.style.display = "none";
        }
    }

    /**
     * This project's notation as csTimer move arrays: [firstLayer, lastLayer, face, quarters].
     * The shape comes from parseScramble in js/twistynnn.js - an outer turn is layer 1 to 1, a
     * wide turn reaches layer 2, a slice is layer 2 alone, and a whole-cube rotation is written as
     * every layer at once. Slices and rotations follow the face they parallel: M goes the way L
     * goes, E the way D goes, S the way F goes, and x y z follow R U F.
     */
    var WIDE = {r: "R", l: "L", u: "U", d: "D", f: "F", b: "B"};
    var SLICE = {M: "L", E: "D", S: "F"};
    var ROTATION = {x: "R", y: "U", z: "F"};

    function toMove(token) {
        var face = token.charAt(0);
        var quarters = token.indexOf("2") > -1 ? 2 : (token.indexOf("'") > -1 ? -1 : 1);

        if ("URFDLB".indexOf(face) > -1) {
            return [1, 1, face, quarters];
        }
        if (face in WIDE) {
            return [1, 2, WIDE[face], quarters];
        }
        if (face in SLICE) {
            return [2, 2, SLICE[face], quarters];
        }
        if (face in ROTATION) {
            return [1, 100, ROTATION[face], quarters];
        }
        return null;//not something the cube can turn, e.g. stray punctuation
    }

    function toMoves(algorithm) {
        var moves = [];
        var tokens = String(algorithm).trim().split(/\s+/);
        for (var i = 0; i < tokens.length; i++) {
            if (!tokens[i]) {
                continue;
            }
            var move = toMove(tokens[i]);
            if (move) {
                moves.push(move);
            }
        }
        return moves;
    }

    //--- the interface js/RubiksCube.js uses ----------------------------------------------------

    window.cube3dSetVisible = function (visible) {
        if (failed) {
            return;
        }
        if (!scene) {
            if (!visible) {
                return;
            }
            if (typeof twistyjs === "undefined") {
                console.error("csTimer's twisty did not load, so the 3D cube view is unavailable");
                failed = true;
                return;
            }
            build();
        }
        container.style.display = visible ? "flex" : "none";
    };

    window.cube3dReset = function () {
        if (!scene || failed) {
            return;
        }
        reset();
    };

    //Replay one algorithm. A single move is animated; scrambles and algorithms are applied at
    //once, the same distinction the gesture buffer makes in doAlg.
    window.cube3dApply = function (algorithm, animate) {
        if (!scene || failed) {
            return;
        }
        //The dimension and the colour scheme are fixed when the twisty is built
        if (settingsFingerprint() !== colours) {
            reset();
        }
        var moves = toMoves(algorithm);
        if (moves.length === 0) {
            return;
        }
        if (animate && moves.length === 1) {
            scene.addMoves(moves);
        } else {
            scene.applyMoves(moves);
        }
    };

    window.cube3dResize = function () {
        if (!scene || failed) {
            return;
        }
        scene.resize();
    };

    //For testing: csTimer's own facelet string for the cube as it currently stands.
    window.cube3dFacelets = function () {
        if (!scene || failed) {
            return null;
        }
        var twisty = scene.getTwisty();
        return twisty && twisty.getFacelet ? twisty.getFacelet(twisty) : null;
    };
})();
