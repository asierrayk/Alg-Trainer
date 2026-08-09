/**
 * The 3D cube view.
 *
 * 27 cubies sitting on a fixed lattice. They are never permuted - every repaint colours each
 * cubie's outward face straight from cubestate, so the model cannot drift out of step with the
 * trainer. A turn is animated by parenting the nine cubies of that layer to a pivot, spinning the
 * pivot, then unparenting and repainting from the state after the move.
 *
 * Depends on THREE (js/three.min.js) and on colourForFace/faceOfSticker from js/RubiksCube.js.
 */
(function () {

    var CUBIE = 0.92;      //leaves a black gap between cubies, the way the flat views have gaps
    var TURN_MS = 130;

    var scene, camera, renderer, world, canvas3d;
    var cubies = {};       //"x,y,z" -> Mesh
    var ready = false;
    var failed = false;
    //Tipped so the U layer - the one being trained - is the face you see most of, with F and R
    //below it. Drag to change it.
    var spin = {x: 0.5, y: -0.62};
    var animating = null;

    //cubestate holds nine stickers per face in the order U R F D L B, each read as rows of three
    //looking at that face. Map (row, col) to the lattice position of the cubie carrying it, and to
    //the BoxGeometry material slot facing outward - three's order is +X -X +Y -Y +Z -Z.
    var FACES = [
        {offset: 0,  material: 2, at: function (r, c) { return [c - 1, 1, r - 1]; }},   //U
        {offset: 9,  material: 0, at: function (r, c) { return [1, 1 - r, 1 - c]; }},   //R
        {offset: 18, material: 4, at: function (r, c) { return [c - 1, 1 - r, 1]; }},   //F
        {offset: 27, material: 3, at: function (r, c) { return [c - 1, -1, 1 - r]; }},  //D
        {offset: 36, material: 1, at: function (r, c) { return [-1, 1 - r, c - 1]; }},  //L
        {offset: 45, material: 5, at: function (r, c) { return [1 - c, 1 - r, -1]; }}   //B
    ];

    //Which layer a face turns, and how that layer spins. A clockwise turn seen from outside the
    //face is a negative rotation about the positive axis, so U, R and F are negative.
    var TURNS = {
        "U": {axis: "y", value: 1,  sign: -1},
        "D": {axis: "y", value: -1, sign: 1},
        "R": {axis: "x", value: 1,  sign: -1},
        "L": {axis: "x", value: -1, sign: 1},
        "F": {axis: "z", value: 1,  sign: -1},
        "B": {axis: "z", value: -1, sign: 1}
    };

    function key(x, y, z) {
        return x + "," + y + "," + z;
    }

    function build(container) {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
        camera.position.set(0, 0, 7.4);

        renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        canvas3d = renderer.domElement;
        canvas3d.id = "cube3d";
        canvas3d.style.display = "none";
        canvas3d.style.touchAction = "none";
        container.appendChild(canvas3d);

        world = new THREE.Group();
        scene.add(world);

        for (var x = -1; x <= 1; x++) {
            for (var y = -1; y <= 1; y++) {
                for (var z = -1; z <= 1; z++) {
                    var materials = [];
                    for (var m = 0; m < 6; m++) {
                        materials.push(new THREE.MeshBasicMaterial({color: 0x111111}));
                    }
                    var cubie = new THREE.Mesh(new THREE.BoxGeometry(CUBIE, CUBIE, CUBIE), materials);
                    cubie.position.set(x, y, z);
                    world.add(cubie);
                    cubies[key(x, y, z)] = cubie;
                }
            }
        }

        addOrbit();
        applySpin();
        ready = true;
    }

    function applySpin() {
        world.rotation.set(spin.x, spin.y, 0);
    }

    function addOrbit() {
        var dragging = false;
        var lastX = 0;
        var lastY = 0;

        canvas3d.addEventListener("pointerdown", function (e) {
            dragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            canvas3d.setPointerCapture(e.pointerId);
        });
        canvas3d.addEventListener("pointermove", function (e) {
            if (!dragging) {
                return;
            }
            spin.y += (e.clientX - lastX) * 0.01;
            spin.x += (e.clientY - lastY) * 0.01;
            spin.x = Math.max(-1.4, Math.min(1.4, spin.x));
            lastX = e.clientX;
            lastY = e.clientY;
            applySpin();
            render();
        });
        function stop(e) {
            dragging = false;
            if (e.pointerId !== undefined && canvas3d.hasPointerCapture(e.pointerId)) {
                canvas3d.releasePointerCapture(e.pointerId);
            }
        }
        canvas3d.addEventListener("pointerup", stop);
        canvas3d.addEventListener("pointercancel", stop);
    }

    function render() {
        if (ready) {
            renderer.render(scene, camera);
        }
    }

    function paint(cubeArray) {
        for (var f = 0; f < FACES.length; f++) {
            var face = FACES[f];
            for (var r = 0; r < 3; r++) {
                for (var c = 0; c < 3; c++) {
                    var at = face.at(r, c);
                    var cubie = cubies[key(at[0], at[1], at[2])];
                    var sticker = cubeArray[face.offset + r * 3 + c];
                    cubie.material[face.material].color.set(colourForFace(faceOfSticker[sticker]));
                }
            }
        }
    }

    //--- the interface js/RubiksCube.js uses ----------------------------------------------------

    //Exposed so the sticker-to-cubie mapping can be checked without a rendered image: the nine
    //positions of a face must lie on its plane, and stickers that meet on an edge must land on
    //the same cubie.
    window.cube3dFaceMap = FACES;

    window.cube3dSetVisible = function (visible) {
        if (failed) {
            return;
        }
        if (!ready) {
            if (!visible) {
                return;
            }
            if (typeof THREE === "undefined") {
                console.error("three.js did not load, so the 3D cube view is unavailable");
                failed = true;
                return;
            }
            build(document.getElementById("simcube"));
        }
        canvas3d.style.display = visible ? "block" : "none";
    };

    window.cube3dSetState = function (cubeArray) {
        if (!ready || failed) {
            return;
        }
        paint(cubeArray);
        render();
    };

    window.cube3dResize = function (width, height) {
        if (!ready || failed) {
            return;
        }
        var size = Math.max(1, Math.min(width, height));
        renderer.setSize(size, size);
        camera.aspect = 1;
        camera.updateProjectionMatrix();
        render();
    };

    //Animate one outer face turn. before/after are the cube states either side of it: the spin
    //shows the old colours and lands on the new ones. Anything that is not a plain face turn
    //(slices, rotations, whole algorithms) just snaps.
    window.cube3dTurn = function (notation, before, after) {
        if (!ready || failed) {
            return;
        }
        var turn = TURNS[notation.charAt(0)];
        if (!turn || animating) {
            window.cube3dSetState(after);
            return;
        }

        var quarters = notation.indexOf("2") > -1 ? 2 : 1;
        var direction = notation.indexOf("'") > -1 ? -1 : 1;
        var target = turn.sign * direction * quarters * Math.PI / 2;

        paint(before);

        var pivot = new THREE.Group();
        world.add(pivot);
        var moving = [];
        for (var k in cubies) {
            var cubie = cubies[k];
            if (Math.round(cubie.position[turn.axis]) === turn.value) {
                moving.push(cubie);
                pivot.attach(cubie);
            }
        }

        animating = true;
        var started = null;

        function step(now) {
            if (started === null) {
                started = now;
            }
            var t = Math.min(1, (now - started) / (TURN_MS * quarters));
            pivot.rotation[turn.axis] = target * (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
            render();

            if (t < 1) {
                requestAnimationFrame(step);
                return;
            }

            //Put the cubies back on their lattice and let the new state supply the colours
            for (var i = 0; i < moving.length; i++) {
                world.attach(moving[i]);
                moving[i].position.set(Math.round(moving[i].position.x),
                                       Math.round(moving[i].position.y),
                                       Math.round(moving[i].position.z));
                moving[i].rotation.set(0, 0, 0);
            }
            world.remove(pivot);
            animating = null;
            window.cube3dSetState(after);
        }

        requestAnimationFrame(step);
    };
})();
