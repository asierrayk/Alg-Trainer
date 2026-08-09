var currentRotation = "";
var cube = new RubiksCube();
var gestures;//See js/gestures.js
var longestGesture;
var moveBuffer = [];//The most recent moves, for matching against gestures

//Pick up gesture bindings edited in the settings panel, without a reload - a reload would drop a
//connected smart cube, which is the whole reason the editor lives in the panel.
function reloadGestures(){
    gestures = getGestures();
    longestGesture = Math.max(1, ...gestures.map(gesture => gestureToMoves(gesture[0]).length));
}
reloadGestures();
var currentAlgorithm = "";//After an alg gets tested for the first time, it becomes the currentAlgorithm.
var currentScramble = "";
var algArr;//This is the array of alternatives to currentAlgorithm
var canvas = document.getElementById("cube");
var ctx = canvas.getContext("2d");
var stickerSize = canvas.width/9;//Recomputed by resizeCube once the layout is known

//Each view has its own grid of cells - see cubeLayout - so fit the biggest such grid into
//whatever space the stage gives us, and draw at device resolution so it stays sharp on a phone.
function resizeCube(){
    var box = document.getElementById("simcube");
    if (!box || !box.clientWidth || !box.clientHeight){
        return;
    }

    if (currentCubeView() === "3d"){
        cube3dResize(box.clientWidth, box.clientHeight);
        cube3dSetState(cube.cubestate);
        return;
    }

    var layout = activeCubeLayout();
    var dpr = window.devicePixelRatio || 1;
    var cell = Math.min(box.clientWidth / layout.cols, box.clientHeight / layout.rows);
    if (cell < 1){
        return;
    }

    canvas.style.width = (cell * layout.cols) + "px";
    canvas.style.height = (cell * layout.rows) + "px";
    canvas.width = Math.round(cell * layout.cols * dpr);
    canvas.height = Math.round(cell * layout.rows * dpr);
    stickerSize = cell * dpr;

    drawCube(cube.cubestate);
}

//Only one renderer is on screen at a time.
function applyCubeView(){
    var is3d = currentCubeView() === "3d";
    canvas.style.display = is3d ? "none" : "block";
    cube3dSetVisible(is3d);
    resizeCube();
}
var currentAlgIndex = 0;
var algorithmHistory = [];
var shouldRecalculateStatistics = true;

createAlgsetPicker();

window.onbeforeunload = function () {
    window.scrollTo(0, 0);
}
Cube.initSolver();

var connectGiiker = document.getElementById("connectGiiker");
connectGiiker.addEventListener('click', async () => {

    connectGiiker.disabled = true;
    setConnectButton('Connecting...', false);
    try {
        const smartCube = await connect();
        setConnectButton('Connected', true);
        setVirtualCube(true);
        smartCube.on('move', (move) => {
            doAlg(remapSmartCubeMove(move.notation, smartCube.nativeOrientation));
        });

        smartCube.on('disconnected', () => {
            alert("Smart cube disconnected");
            setConnectButton('Connect Cube', false);
            connectGiiker.disabled = false;
        })

    } catch(e) {
        console.error(e);
        setConnectButton('Connect Cube', false);
        connectGiiker.disabled = false;
    }
});

//The button sits on the stage next to the settings gear, so it stays reachable mid-session.
//Green means a cube is on the other end.
function setConnectButton(label, connected){
    connectGiiker.textContent = label;
    connectGiiker.classList.toggle('connected', connected);
    connectGiiker.title = connected ? 'Smart cube connected' : 'Connect a smart cube over bluetooth';
}

document.getElementById("loader").style.display = "none";
var myVar = setTimeout(showPage, 1);
function showPage(){
    document.getElementById("page").style.display = "block";
}

var defaults = {"useVirtual":true,
                "hideTimer":true,
                "showScramble":true,
                "realScrambles":false,
                "randAUF":false,
                "prescramble":true,
                "goInOrder":false,
                "goToNextCase":false,
                "mirrorAllAlgs":false,
                "cubeOrientationF":"green",
                "cubeOrientationU":"yellow",
                "colourneutrality1":"",
                "colourneutrality2":"",
                "colourneutrality3":"",
                "userDefined":false,
                "userDefinedAlgs":"",
                "fullCN":false,
                "cubeType":"3x3",
                "cubeView":"qcube-extended",
                "algsetpicker":document.getElementById("algsetpicker").options[0].value,
                "useCustomColourScheme":false,
                "customColourU":"white",
                "customColourD":"yellow",
                "customColourF":"green",
                "customColourB":"blue",
                "customColourR":"red",
                "customColourL":"orange",
                "visualCubeView":"plan"
               };

//The custom colour scheme used to be a z2 relabelling, to match a restickered cube. That job now
//belongs to the cube orientation setting, so clear the old values once and let them reseed.
var SETTINGS_VERSION = "2";
if (localStorage.getItem("settingsVersion") !== SETTINGS_VERSION){
    var staleSettings = ["useCustomColourScheme", "customColourU", "customColourD",
                         "customColourR", "customColourL"];
    for (var i = 0; i < staleSettings.length; i++){
        localStorage.removeItem(staleSettings[i]);
    }
    localStorage.setItem("settingsVersion", SETTINGS_VERSION);
}

for (var setting in defaults){
// If no previous setting exists, use default and update localStorage. Otherwise, set to previous setting
    if (typeof(defaults[setting]) === "boolean"){
        var previousSetting = localStorage.getItem(setting);
        if (previousSetting == null){
            document.getElementById(setting).checked = defaults[setting];
            localStorage.setItem(setting, defaults[setting]);
        }
        else {
            document.getElementById(setting).checked = previousSetting == "true"? true : false;
        }
    }
    else {
        var previousSetting = localStorage.getItem(setting);
        if (previousSetting == null){
            var element = document.getElementById(setting)
            if (element != null){
                element.value = defaults[setting];
            }
            localStorage.setItem(setting, defaults[setting]);
        }
        else {
            var element = document.getElementById(setting)
            if (element != null){
                element.value = previousSetting;
            }
        }
    }
}

setTimerDisplay(!document.getElementById("hideTimer").checked);
if (document.getElementById("userDefined").checked){
    document.getElementById("userDefinedAlgs").style.display = "block";
}

//Each view has its own grid shape, so switching resizes the canvas as well as redrawing.
document.getElementById("cubeView").addEventListener("change", function(){
    localStorage.setItem("cubeView", this.value);
    applyCubeView();
});

//Changing how you hold the cube re-orients the case you are on, so the trainer keeps
//matching the cube in your hands.
var cubeOrientations = [document.getElementById("cubeOrientationF"),
                        document.getElementById("cubeOrientationU")];

for (var i = 0; i < cubeOrientations.length; i++) {
    cubeOrientations[i].addEventListener("change", function(){
        localStorage.setItem(this.id, this.value);
        practiceOrientation();//Warns and falls back if the pair is not a real orientation
        //Like the algset picker, this takes effect from the next case onwards
        nextScramble();
    });
}

var useCustomColourScheme = document.getElementById("useCustomColourScheme");
useCustomColourScheme.addEventListener("click", function(){
    localStorage.setItem("useCustomColourScheme", this.checked);

    var algTest = algorithmHistory[historyIndex];
    updateVisualCube(algTest ? algTest.preorientation+algTest.scramble : "");

    drawCube(cube.cubestate);    
});

var customColourU = document.getElementById("customColourU");
var customColourD = document.getElementById("customColourD");
var customColourF = document.getElementById("customColourF");
var customColourB = document.getElementById("customColourB");
var customColourR = document.getElementById("customColourR");
var customColourL = document.getElementById("customColourL");

var customColours = [customColourU, customColourD, customColourF,
                     customColourB, customColourR, customColourL];

for (var i = 0; i < customColours.length; i++) {
    customColours[i].addEventListener("change", function(){
        this.value = this.value.trim();
        localStorage.setItem(this.id, this.value);

        var algTest = algorithmHistory[historyIndex];
        updateVisualCube(algTest ? algTest.preorientation+algTest.scramble : "");

        drawCube(cube.cubestate);
    });
}

var resetCustomColourScheme = document.getElementById("resetCustomColourScheme");
resetCustomColourScheme.addEventListener("click", function(){
    if (confirm("Reset custom colour scheme?")){
        for (var setting in defaults){
            if (setting.indexOf( "customColour" ) > -1){
                document.getElementById(setting).value = defaults[setting];
                localStorage.setItem(setting, defaults[setting]);
            }
        }

        var algTest = algorithmHistory[historyIndex];
        updateVisualCube(algTest ? algTest.preorientation+algTest.scramble : "");

        drawCube(cube.cubestate);                
    }
});

//Sticker values as used by fillWithIndex: 1=U 2=R 3=F 4=D 5=L 6=B on the standard scheme.
//Centre positions in cubestate: u=4 r=13 f=22 d=31 l=40 b=49 (see wcaOrient)
var stickerColours = {1:"white", 2:"red", 3:"green", 4:"yellow", 5:"orange", 6:"blue"};
var centreIndices = {"U":4, "R":13, "F":22, "D":31, "L":40, "B":49};

//Every rotation of the cube, reached the same way generateOrientation does for full CN below.
function eachOrientation(callback){
    var firstRotation = ["", "x", "x'", "x2", "y", "y'"];
    var secondRotation = ["", "z", "z'", "z2"];
    for (var i = 0; i < firstRotation.length; i++){
        for (var j = 0; j < secondRotation.length; j++){
            var rotation = firstRotation[i] + secondRotation[j];
            if (rotation == "x2z2"){
                rotation = "y2";
            }
            var probe = new RubiksCube();
            probe.doAlgorithm(rotation);
            callback(rotation, probe);
        }
    }
}

//"green|yellow" -> the rotation reaching that orientation from white top, green front.
var orientationRotations = (function(){
    var table = {};
    eachOrientation(function(rotation, probe){
        var key = stickerColours[probe.cubestate[centreIndices["F"]]] + "|" +
                  stickerColours[probe.cubestate[centreIndices["U"]]];
        if (!(key in table)){
            table[key] = rotation;
        }
    });
    return table;
})();

//Which face each face ends up as under a rotation. "z2" -> {U:"D", R:"L", F:"F", D:"U", L:"R", B:"B"}
function faceMapForRotation(rotation){
    var probe = new RubiksCube();
    probe.doAlgorithm(rotation);
    var map = {};
    for (var face in centreIndices){
        //The sticker now sitting on `face` started on the face named by its value, so the
        //face it started on has moved here.
        var startedOn;
        switch (probe.cubestate[centreIndices[face]]){
            case 1: startedOn = "U"; break;
            case 2: startedOn = "R"; break;
            case 3: startedOn = "F"; break;
            case 4: startedOn = "D"; break;
            case 5: startedOn = "L"; break;
            case 6: startedOn = "B"; break;
        }
        map[startedOn] = face;
    }
    return map;
}

//The orientation the user holds the cube in, as a rotation from white top, green front.
function practiceOrientation(){
    var front = document.getElementById("cubeOrientationF").value;
    var top = document.getElementById("cubeOrientationU").value;
    var rotation = orientationRotations[front + "|" + top];
    if (rotation === undefined){
        //Equal or opposite colours describe no real orientation
        alert("A cube cannot have " + front + " in front and " + top + " on top. Using " +
              defaults["cubeOrientationF"] + " front, " + defaults["cubeOrientationU"] + " top.");
        document.getElementById("cubeOrientationF").value = defaults["cubeOrientationF"];
        document.getElementById("cubeOrientationU").value = defaults["cubeOrientationU"];
        localStorage.setItem("cubeOrientationF", defaults["cubeOrientationF"]);
        localStorage.setItem("cubeOrientationU", defaults["cubeOrientationU"]);
        rotation = orientationRotations[defaults["cubeOrientationF"] + "|" + defaults["cubeOrientationU"]];
    }
    return rotation;
}

//A smart cube names its faces in its own frame, which is fixed by how it is stickered. Held in a
//different orientation, the face the user turns is not the face the cube reports, so relabel it.
var smartCubeFaceMaps = {};

function remapSmartCubeMove(notation, nativeOrientation){
    var practice = practiceOrientation();
    var native = orientationRotations[nativeOrientation];
    if (native === undefined){
        //Unknown cube - assume it is held the way it is stickered
        return notation;
    }

    var key = nativeOrientation + "->" + practice;
    if (!(key in smartCubeFaceMaps)){
        //Undo the cube's own orientation, then take up the user's
        smartCubeFaceMaps[key] = faceMapForRotation(alg.cube.invert(native) + practice);
    }

    var face = notation.charAt(0);
    var remapped = smartCubeFaceMaps[key][face];
    return remapped === undefined ? notation : remapped + notation.slice(1);
}

setVirtualCube(document.getElementById("useVirtual").checked);
createCheckboxes();
//The cube starts in the orientation the user holds it in, the same as every generated case.
//Bypass doAlg here: this is not a move the user made, so it should not feed the gestures.
var initialOrientation = practiceOrientation();
cube.doAlgorithm(initialOrientation);
applyCubeView();//Sets up whichever renderer the saved view asks for, then draws
updateVisualCube(initialOrientation);

//#page is still hidden at this point, so #simcube has no size yet and resizeCube would bail.
//The observer fires as soon as showPage() reveals it, and on every later layout change.
if (window.ResizeObserver){
    new ResizeObserver(function(){ resizeCube(); }).observe(document.getElementById("simcube"));
} else {
    window.addEventListener("resize", resizeCube);
}
window.addEventListener("orientationchange", resizeCube);

var useVirtual = document.getElementById("useVirtual");
useVirtual.addEventListener("click", function(){
    setVirtualCube(this.checked);
    localStorage.setItem("useVirtual", this.checked);
    stopTimer(false);
    document.getElementById("timer").innerHTML = "0.00";
});

var hideTimer = document.getElementById("hideTimer");
hideTimer.addEventListener("click", function(){
    setTimerDisplay(!this.checked);
    localStorage.setItem("hideTimer", this.checked);
    stopTimer(false);
    document.getElementById("timer").innerHTML = "0.00";

});

var visualCube = document.getElementById("visualcube");
visualCube.addEventListener("click", function(){
    var currentView = localStorage.getItem("visualCubeView")
    var newView = currentView == ""? "plan": "";
    localStorage.setItem("visualCubeView", newView);
    var algTest = algorithmHistory[historyIndex];
    updateVisualCube(algTest ? algTest.preorientation+algTest.scramble : "");
});


var showScramble = document.getElementById("showScramble");
showScramble.addEventListener("click", function(){
    localStorage.setItem("showScramble", this.checked);
});

var realScrambles = document.getElementById("realScrambles");
realScrambles.addEventListener("click", function(){
    localStorage.setItem("realScrambles", this.checked);
});

var randAUF = document.getElementById("randAUF");
randAUF.addEventListener("click", function(){
    localStorage.setItem("randAUF", this.checked);
});

var prescramble = document.getElementById("prescramble");
prescramble.addEventListener("click", function(){
    localStorage.setItem("prescramble", this.checked);
});

var goInOrder = document.getElementById("goInOrder");
goInOrder.addEventListener("click", function(){
    localStorage.setItem("goInOrder", this.checked);
    currentAlgIndex=0;
});

var goToNextCase = document.getElementById("goToNextCase");
goToNextCase.addEventListener("click", function(){
    if (isUsingVirtualCube()){
        alert("Note: This option has no effect when using the virtual cube.")
    }
    localStorage.setItem("goToNextCase", this.checked);
});

var mirrorAllAlgs = document.getElementById("mirrorAllAlgs");
mirrorAllAlgs.addEventListener("click", function(){
    localStorage.setItem("mirrorAllAlgs", this.checked);
});

var userDefined = document.getElementById("userDefined");
userDefined.addEventListener("click", function(){
    document.getElementById("userDefinedAlgs").style.display = this.checked? "block":"none";
    localStorage.setItem("userDefined", this.checked);
});

var fullCN = document.getElementById("fullCN");
fullCN.addEventListener("click", function(){
    localStorage.setItem("fullCN", this.checked);
});

var cubeType = document.getElementById("cubeType");
cubeType.addEventListener("change", function(){
    localStorage.setItem("cubeType", this.value);
    resizeCube();//The grid is 9 wide for a 3x3 but only 5 for a 2x2, so the cell size changes
    updateVisualCube("");
});

var algsetpicker = document.getElementById("algsetpicker");
algsetpicker.addEventListener("change", function(){
    createCheckboxes();
	shouldRecalculateStatistics = true;
    localStorage.setItem("algsetpicker", this.value);
});

var clearTimes = document.getElementById("clearTimes");
clearTimes.addEventListener("click", function(){

    if (confirm("Clear all times?")){
        timeArray = [];
        updateTimeList();
        updateStats();
    }

});

var deleteLast = document.getElementById("deleteLast");
deleteLast.addEventListener("click", function(){
    timeArray.pop();
    algorithmHistory.pop();
    updateTimeList();
    updateStats();
});

var addSelected = document.getElementById("addSelected");
addSelected.addEventListener("click", function(){

    algList = createAlgList(true);
    for (let i = 0; i < algList.length; i++){
        algList[i] = algList[i].split("/")[0]
    }
    document.getElementById("userDefinedAlgs").value += "\n" + algList.join("\n");
});

//The gap that separates one sticker from the next, as a fraction of a cell. Replaces the old
//outline setting: the black background showing through is what tells stickers apart.
var STICKER_GAP = 0.06;

function fillSticker(x, y, colour, w, h) {
    w = (w === undefined ? 1 : w);
    h = (h === undefined ? 1 : h);
    var inset = stickerSize * STICKER_GAP / 2;
    ctx.fillStyle = colour;
    ctx.fillRect(stickerSize * x + inset, stickerSize * y + inset,
                 stickerSize * w - inset * 2, stickerSize * h - inset * 2);
}

//cubestate holds 54 stickers as face values 1-6, nine per face in the order U R F D L B.
var faceOffsets = {"u": 0, "r": 9, "f": 18, "d": 27, "l": 36, "b": 45};
var faceOfSticker = {1: "U", 2: "R", 3: "F", 4: "D", 5: "L", 6: "B"};

//The colour a face is painted in: the custom scheme when it is switched on, the standard one
//otherwise. Shared by the flat views, the 3D cube and the VisualCube image url.
function colourForFace(face) {
    if (useCustomColourScheme.checked) {
        return document.getElementById("customColour" + face).value;
    }
    return defaults["customColour" + face];
}

function fillWithIndex(x, y, face, index, cubeArray, shouldBeCleared = false, w, h) {
    var sticker = cubeArray[faceOffsets[face] + index - 1];
    fillSticker(x, y, shouldBeCleared ? "black" : colourForFace(faceOfSticker[sticker]), w, h);
}

//---- Cube views -------------------------------------------------------------------------------
//
// Two flat layouts, both modelled on csTimer's qcube: the U face above the F face with a gap
// between them, and the L and R faces hinged outward into vertical bars. Each bar is the face row
// touching U plus the face column touching F, joined by the corner sticker they share, which is
// drawn tall enough to span the gap. "extended" adds the four extra stickers per side that show
// more of L and R.
//
// A layout is plain data - a grid size in cells and a list of placements - so one loop draws it
// and resizeCube can ask how big the grid is.

var BLOCK_GAP = 0.35;//cells between the U block and the F block

//The app models a 2x2 as a 3x3 holding only corners, so a 2x2 view reads the corner stickers.
function stickerIndex(n, row, col){
    return n === 2 ? [1, 3, 7, 9][row * 2 + col] : row * 3 + col + 1;
}

function cubeLayout(n, extended){
    var stickers = [];
    var side = extended ? 2 : 0;//extra columns outside each bar
    var left = side;            //x of the left bar
    var faceX = left + 1;
    var right = faceX + n;      //x of the right bar
    var fY = n + BLOCK_GAP;     //y of the F block

    for (var row = 0; row < n; row++){
        for (var col = 0; col < n; col++){
            stickers.push({x: faceX + col, y: row, face: "u", index: stickerIndex(n, row, col)});
            stickers.push({x: faceX + col, y: fY + row, face: "f", index: stickerIndex(n, row, col)});
        }
    }

    //L: the row touching U runs down the bar, then the column touching F continues it.
    //The shared corner is L's top right, drawn across the gap.
    for (var i = 0; i < n - 1; i++){
        stickers.push({x: left, y: i, face: "l", index: stickerIndex(n, 0, i)});
        stickers.push({x: right, y: i, face: "r", index: stickerIndex(n, 0, n - 1 - i)});
    }
    stickers.push({x: left, y: n - 1, h: 1 + BLOCK_GAP + 1, face: "l", index: stickerIndex(n, 0, n - 1)});
    stickers.push({x: right, y: n - 1, h: 1 + BLOCK_GAP + 1, face: "r", index: stickerIndex(n, 0, 0)});
    for (var i = 1; i < n; i++){
        stickers.push({x: left, y: fY + i, face: "l", index: stickerIndex(n, i, n - 1)});
        stickers.push({x: right, y: fY + i, face: "r", index: stickerIndex(n, i, 0)});
    }

    //The extension shows the rest of L and R alongside the lower rows of F.
    if (extended){
        for (var row = 1; row < n; row++){
            for (var col = 0; col < n - 1; col++){
                stickers.push({x: col, y: fY + row, face: "l", index: stickerIndex(n, row, col)});
                stickers.push({x: right + 1 + col, y: fY + row, face: "r", index: stickerIndex(n, row, col + 1)});
            }
        }
    }

    return {cols: n + 2 + side * 2, rows: 2 * n + BLOCK_GAP, stickers: stickers};
}

function currentCubeView(){
    var view = document.getElementById("cubeView");
    return view ? view.value : "qcube-extended";
}

function activeCubeLayout(){
    var n = document.getElementById("cubeType").value == "2x2" ? 2 : 3;
    return cubeLayout(n, currentCubeView() !== "qcube");
}

function drawCube(cubeArray) {
    if (currentCubeView() === "3d"){
        cube3dSetState(cubeArray);
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var layout = activeCubeLayout();
    for (var i = 0; i < layout.stickers.length; i++){
        var s = layout.stickers[i];
        fillWithIndex(s.x, s.y, s.face, s.index, cubeArray, false, s.w, s.h);
    }
}

function runGestureAction(action){
    switch (action){
        case "showSolution":
            stopTimer();
            displayAlgorithmForPreviousTest();
            break;
        case "nextCase":
            showNextCase();
            break;
        case "previousCase":
            showPreviousCase();
            break;
        case "nextScramble":
            nextScramble();
            break;
    }
}

//Fire the first gesture whose move sequence matches the end of the buffer.
function checkGestures(){
    for (var i = 0; i < gestures.length; i++){
        var moves = gestureToMoves(gestures[i][0]);
        if (moves.length === 0 || moves.length > moveBuffer.length){
            continue;
        }
        var tail = moveBuffer.slice(-moves.length);
        if (tail.every((move, j) => move === moves[j])){
            //Clear before acting: the action turns the cube itself, which re-enters doAlg
            moveBuffer.length = 0;
            runGestureAction(gestures[i][1]);
            return;
        }
    }
}

function doAlg(algorithm){
    //Only moves the user actually made count towards a gesture. doAlg is also
    //called with whole scrambles and algorithms, which reset the buffer instead.
    var isSingleMove = gestureToMoves(algorithm).length === 1;
    if (isSingleMove){
        moveBuffer.push(algorithm.trim());
        while (moveBuffer.length > longestGesture){
            moveBuffer.shift();
        }
    } else {
        moveBuffer.length = 0;
    }

    //The 3D view animates a single move, so it needs the state on both sides of it. Scrambles and
    //algorithms snap, the same distinction the gesture buffer makes above.
    var animate3d = isSingleMove && currentCubeView() === "3d";
    var before = animate3d ? cube.cubestate.slice() : null;

    cube.doAlgorithm(algorithm);

    if (animate3d){
        cube3dTurn(algorithm.trim(), before, cube.cubestate);
    } else {
        drawCube(cube.cubestate);
    }

    checkGestures();

    if (timerIsRunning && cube.isSolved() && isUsingVirtualCube()){
        stopTimer();
        nextScramble();
        moveBuffer.length = 0;
    }
}


function getRandAuf(letter){
    var rand = Math.floor(Math.random()*4);//pick 0,1,2 or 3
    var aufs = [letter + " ", letter +"' ",letter + "2 ", ""];
    return aufs[rand];
}

// Returns a random sequence of quarter turns of the specified length. Quarter turns are used to break OLL. Two consecutive moves may not be on the same axis.
function getPremoves(length) {
    var previous = "U"; // prevents first move from being U or D
    var moveset = ['U', 'R', 'F', 'D', 'L', 'B'];
    var amts = [" ","' "];
    var randmove = "";
    var sequence = "";
    for (let i=0; i<length; i++) {
        do {
            randmove = moveset[Math.floor(Math.random()*moveset.length)];
        } while (previous != "" && (randmove === previous || Math.abs(moveset.indexOf(randmove) - moveset.indexOf(previous)) === 3))
        previous = randmove;
        sequence += randmove;
        sequence += amts[Math.floor(Math.random()*amts.length)];
    }
    return sequence;
}

/*

This will return an algorithm that has the same effect as algorithm, but with different moves.
This requires https://github.com/ldez/cubejs to work. The Cube.initSolver(); part takes a long time, so I removed it for the time being. 

Generate the 3 premoves
Start with a solved cube
Do (the inverse of the premoves + the scramble algorithm) on the cube
Find the solution to the cubestate
Return the premoves + the inverse of the solution, canceling any redundant moves
If the solution it finds is under 16 moves, it scraps that solution, then starts from scratch,
but with 4 random premoves. Then if that solution is still under 16 moves, 
then it starts from scratch again but with 5 random premoves. And so on...

B U F' B2 F2 D' L2 F2 U2 B2 R2 U2 F2 D' F' U' B2 U B U2
L' U' R L2 R2 D F2 D' R2 U B2 R2 F2 D' L2 R' D' L' B2 R F2 R U2


*/
function obfusticate(algorithm, numPremoves=3, minLength=16){

    //Cube.initSolver();
    var premoves = getPremoves(numPremoves);
    var rc = new RubiksCube();
    rc.doAlgorithm(alg.cube.invert(premoves) + algorithm);
    orient = alg.cube.invert(rc.wcaOrient());
    var solution = alg.cube.simplify(premoves + (alg.cube.invert(rc.solution())) + orient).replace(/2'/g, "2");
    return solution.split(" ").length >= minLength ? solution : obfusticate(algorithm, numPremoves+1, minLength);

}


function addAUFs(algArr){

    var rand1 = getRandAuf("U");
    var rand2 = getRandAuf("U");
    //algorithm = getRandAuf() + algorithm + " " +  getRandAuf()
    var i = 0;
    for (;i<algArr.length;i++){
        algArr[i] = alg.cube.simplify(rand1 + algArr[i] + " " + rand2); 
    }
    return algArr;
}

function generateAlgScramble(raw_alg,set,obfusticateAlg,shouldPrescramble){
    
    if (set == "F3L" && !document.getElementById("userDefined").checked){
        return Cube.random().solve();
    }
    if (!obfusticateAlg){
        return alg.cube.invert(raw_alg);
    } else if (!shouldPrescramble){//if realscrambles not checked but should not prescramble, just obfusticate the inverse
        return obfusticate(alg.cube.invert(raw_alg));
    }

    switch(set){
        case "ZBLS (Chad Batten, Tao Yu)":
        case "VHLS (Chad Batten)":
        case "ZBLSE (John McWilliams)":
            return generatePreScramble(raw_alg, "RBR'FRB'R'F',RUR'URU2R',U,R'U'RU'R'U2R,F2U'R'LF2L'RU'F2", 1000, true);//ZBLLscramble

        case "OLL":
        case "OLL (Feliks Zemdegs - Cubeskills)":
        case "VLS":
        case "WVLS":
        case "OH OLL":
        case "CLS (Justin Taylor)":
        case "VLS (Jayden McNeill)":
		case "ZZ OLS (Egide Hirwa)":
            return generatePreScramble(raw_alg, "R'FR'B2'RF'R'B2'R2,F2U'R'LF2RL'U'F2,U", 100, true);//PLL scramble

        case "ELS (FR) (Justin Taylor)":
            return generatePreScramble(raw_alg, "R'FR'B2'RF'R'B2'R2,F2U'R'LF2RL'U'F2,U,R' D' R U R' D R,R F' L F R' F' L' F,R2 U R2' U R2 U2' R2',R U' R' U R U2' R' U R U' R'", 100, true);//CLS FR scramble
        case "ELS (BR) (Justin Taylor)":
            return generatePreScramble(raw_alg, "R'FR'B2'RF'R'B2'R2,F2U'R'LF2RL'U'F2,U,R2' U' R2 U' R2 U2' R2,R' U2 R U' R' U' R,R' U R U2' R' U R,R' U R U' R' U2' R U' R' U R", 100, true);//CLS FR scramble

        case "OLLCP":
        case "OLLCP (Cale Schoon)":
        case "OLLCP (Justin Taylor, WIP)":
        case "COLL":
        case "COLL (Tao Yu)":
        case "CP solved OLLCP":
        case "Briggs-Taylor Reduction COLL":
            return generatePreScramble(raw_alg, "F2U'R'LF2RL'U'F2,U", 5000, true);//EPLL scramble

        case "CMLL":
        case "OH CMLL":
            return generatePreScramble(raw_alg, "M2,MUM,MUM',MU'M,MU'M',MU2M,MU2M',M'UM,M'UM',M'U'M,M'U'M',M'U2M,M'U2M'", 100, true);//LSE scramble

        case "3x3 CLL (Justin Taylor)":
            return generatePreScramble(raw_alg, "F2 U' R' L F2 L' R U' F2, R' U2' R2 U R' U' R' U2' r U R U' r', U", 100, true);//ELL scramble

        case "42 (Shadowslice)":
            return generatePreScramble(raw_alg, "M'UM, M'U'M, MUM', MU'M',M2, RUMU'R'M", 500, true);//L7E scramble

        case "OL5C (SqAree)":
            return generatePreScramble(raw_alg, "R2,U,D", 100, true);//<U, D, R2> scramble

        case "TOLS (Justin Taylor)":
        case "TSLE":
            return generatePreScramble(raw_alg, "R2 U2' R2' U' R2 U' R2,R'FR'B2'RF'R'B2'R2,F2U'R'LF2RL'U'F2,U", 100, true); //TTLL scramble

        case "F2L":
            return generatePreScramble(raw_alg, "FRUR'U'F',RBR'FRB'R'F',RUR'URU2R',U", 100, true);

        case "Ortega OLL":
            return generatePreScramble(raw_alg, "R F' R B2 R' F R B2 R2,R'FR'B2'RF'R'B2'R2,U,D", 100, true);
        case "CPLS (Arc)":
        case "CPEOLL":
            return generatePreScramble(raw_alg, "R U R' U R U2' R', U, L' U' L U' L' U2 L", 100, true);//2GLL scramble

        case "Pseudo2GLL (no algs)":
            return generatePreScramble(raw_alg, "R U R' U R U2' R', U, L' U' L U' L' U2 L, F R' F' M F R F' M'", 10000, true);
        case "Ribbon Multislotting":
            return generatePreScramble(raw_alg, "R2 U2' R2' U' R2 U' R2,R'FR'B2'RF'R'B2'R2,F2U'R'LF2RL'U'F2,U,R U' R' U2 R U' R' ,R U2' R' U R U R' ,R U R' U R U2' R' ,R U2 R' U' R U' R' ", 10000, true);
        case "TDR (Trangium, Yash Mehta)":
            return generatePreScramble(raw_alg, "RBR'FRB'R'F',RUR'URU2R',U,R'U'RU'R'U2R,F2U'R'LF2L'RU'F2", 1000, true, getRandAuf("D")); // ZBLL-ABF scramble
        default:  
            return obfusticate(alg.cube.invert(raw_alg));
    }

}



function generatePreScramble(raw_alg, generator, times, obfusticateAlg, premoves=""){

    var genArray = generator.split(",");

    var scramble = premoves;
    var i = 0;

    for (; i<times; i++){
        var rand = Math.floor(Math.random()*genArray.length);
        scramble += genArray[rand];
    }
    scramble += alg.cube.invert(raw_alg);

    if (obfusticateAlg){
        return obfusticate(scramble);
    }
    else {
        return scramble;
    }

}
function generateOrientation(){

    //How the user holds the cube. Everything else is stacked on top of this.
    var base = practiceOrientation();

    var cn1 = document.getElementById("colourneutrality1").value;
    if (document.getElementById("fullCN").checked){
        var firstRotation = ["", "x", "x'", "x2", "y", "y'"]
        // each one of these first rotations puts a differnt color face on F
        var secondRotation = ["", "z", "z'", "z2"]
        // each second rotation puts a different edge on UF
        // each unique combination of a first and second rotation 
        // must result in a unique orientation because a different color is on F
        // and a different edge is on UF. Hence all 6x4=24 rotations are reached.

        var rand1 = Math.floor(Math.random()*6);
        var rand2 = Math.floor(Math.random()*4);
        var randomPart = firstRotation[rand1] + secondRotation[rand2];
        if (randomPart == "x2z2"){
            randomPart = "y2";
        }
        var fullOrientation = base + cn1 + randomPart; // Preorientation to perform starting from white top green front
        return [fullOrientation, randomPart];
    }
    var cn2 = document.getElementById("colourneutrality2").value;
    var cn3 = document.getElementById("colourneutrality3").value;

    //todo: warn if user enters invalid strings

    localStorage.setItem("colourneutrality1", cn1);
    localStorage.setItem("colourneutrality2", cn2);
    localStorage.setItem("colourneutrality3", cn3);

    var rand1 = Math.floor(Math.random()*4);
    var rand2 = Math.floor(Math.random()*4);

    //console.log(cn1 + cn2.repeat(rand1) + cn3.repeat(rand2));
    var randomPart = cn2.repeat(rand1) + cn3.repeat(rand2); // Random part of the orientation
    var fullOrientation = base + cn1 + randomPart; // Preorientation to perform starting from white top green front
    return [fullOrientation, randomPart];
}

class AlgTest {
    constructor(rawAlgs, scramble, solutions, preorientation, solveTime, time, set, visualCubeView, cubeType, orientRandPart) {
        this.rawAlgs = rawAlgs;
        this.scramble = scramble;
        this.solutions = solutions;
        this.preorientation = preorientation;
        this.solveTime = solveTime;
        this.time = time;
        this.set = set;
        this.visualCubeView = visualCubeView;
        this.cubeType = cubeType;
        this.orientRandPart = orientRandPart;
    }
}

// Adds extra rotations to the end of an alg to reorient
function correctRotation(alg) {
    var rc = new RubiksCube();
    rc.doAlgorithm(alg);
    var ori = rc.wcaOrient();
	
    return alg + " " + ori;
}

function generateAlgTest(){

    var set = document.getElementById("algsetpicker").value;
    var obfusticateAlg = document.getElementById("realScrambles").checked;
    var shouldPrescramble = document.getElementById("prescramble").checked;
    var randAUF = document.getElementById("randAUF").checked;

    var algList = createAlgList()
    if (shouldRecalculateStatistics){
        updateAlgsetStatistics(algList);
        shouldRecalculateStatistics = false;
    }
    var rawAlgStr = randomFromList(algList);
    var rawAlgs = rawAlgStr.split("/");
    rawAlgs = fixAlgorithms(rawAlgs);
    if (mirrorAllAlgs.checked){
        rawAlgs = mirrorAlgsAcrossM(rawAlgs);
    }
    var solutions;
    if (randAUF){
        solutions = addAUFs(rawAlgs);
    } else {
        solutions = rawAlgs;
    }

    var scramble = generateAlgScramble(correctRotation(solutions[0]),set,obfusticateAlg,shouldPrescramble);
    if (set == "F3L"){
        solutions = [alg.cube.invert(scramble).replace(/2'/g, "2")];
    }
    var [preorientation, orientRandPart] = generateOrientation();
    orientRandPart = alg.cube.simplify(orientRandPart);

    var cubeType = document.getElementById("cubeType");

    var solveTime = null;
    var time = Date.now();
    var visualCubeView = "plan";

    var algTest = new AlgTest(rawAlgs, scramble, solutions, preorientation, solveTime, time, set, visualCubeView, cubeType, orientRandPart);
    return algTest;
}
function testAlg(algTest, addToHistory=true){

    var scramble = document.getElementById("scramble");

    if (document.getElementById("showScramble").checked){
        scramble.innerHTML = "<span style=\"color: #90f182\">" + algTest.orientRandPart + "</span>" + " " + algTest.scramble;
    } else{
        scramble.innerHTML = "&nbsp;";
    }

    document.getElementById("algdisp").innerHTML = "";

    cube.resetCube();
    doAlg(algTest.preorientation);
    doAlg(algTest.scramble);
    drawCube(cube.cubestate)

    updateVisualCube(algTest.preorientation + algTest.scramble);

    if (addToHistory){
        algorithmHistory.push(algTest);
    }
    console.log(algTest);

}

function updateAlgsetStatistics(algList){
    if (document.getElementById("algsetpicker").value == "F3L"){
        var stats = {"Number of algs": "43,252,003,274,489,856,000"};
    }
    else {
        var stats = {"STM": averageMovecount(algList, "btm", false).toFixed(3),
                 "SQTM": averageMovecount(algList, "bqtm", false).toFixed(3),
                 "STM (including AUF)": averageMovecount(algList, "btm", true).toFixed(3),
                 "SQTM (including AUF)": averageMovecount(algList, "bqtm", true).toFixed(3),
                 "Number of algs": algList.length};
    }
    var table = document.getElementById("algsetStatistics");
    table.innerHTML = "";
    var th = document.createElement("th");
    th.appendChild(document.createTextNode("Algset Statistics"));
    table.appendChild(th);
    for (var key in stats){
        var tr = document.createElement("tr");
        var description = document.createElement("td");
        var value = document.createElement("td");
        description.appendChild(document.createTextNode(key));
        value.appendChild(document.createTextNode(stats[key]));
        tr.appendChild(description);
        tr.appendChild(value);
        table.appendChild(tr);
    }

}

function reTestAlg(){

    var lastTest = algorithmHistory[algorithmHistory.length-1];
    if (lastTest==undefined){
        return;
    }
    cube.resetCube();
    doAlg(lastTest.preorientation);
    doAlg(lastTest.scramble);
    drawCube(cube.cubestate);

}

function updateTrainer(scramble, solutions, algorithm, timer){
    if (scramble!=null){
        document.getElementById("scramble").innerHTML = scramble;
    }
    if (solutions!=null){
        document.getElementById("algdisp").innerHTML = solutions;
    }

    if (algorithm!=null){
        cube.resetCube();
        doAlg(algorithm);
        updateVisualCube(algorithm);
    }

    if (timer!=null){
        document.getElementById("timer").innerHTML = timer;
    }
}
function fixAlgorithms(algorithms){
    //for now this just removes brackets
    var i = 0;
    for (;i<algorithms.length;i++){
        algorithms[i] = alg.cube.simplify(algorithms[i].replace(/\[|\]|\)|\(/g, ""));
    }
    return algorithms;
    //TODO Allow commutators

}

function validTextColour(stringToTest) {
    if (stringToTest === "") { return false; }
    if (stringToTest === "inherit") { return false; }
    if (stringToTest === "transparent") { return false; }

    var visualCubeColoursArray = ['black', 'dgrey', 'grey', 'silver', 'white', 'yellow', 
                                  'red', 'orange', 'blue', 'green', 'purple', 'pink'];

    if (stringToTest[0] !== '#') {
        return visualCubeColoursArray.indexOf(stringToTest) > -1;
    } else {
        return /^#[0-9A-F]{6}$/i.test(stringToTest)
    }
}

function validateCustomColourScheme(){
    var invalidColours = [];

    for (var i = 0; i < customColours.length; i++) {
        if (!validTextColour(customColours[i].value)) {
            invalidColours.push(customColours[i].value);
            customColours[i].value = defaults[customColours[i].id];
            localStorage.setItem(customColours[i].id, customColours[i].value);
        }
    }

    if (invalidColours.length > 0) {
        alert("The following custom colours are not supported and were reset to default:\n" + 
              invalidColours.join(", ") + "\n\n" +
              "Either use #RRGGBB, or one of the following colour names:\n" +
              "black, dgrey, grey, silver, white, yellow, red, orange, blue, green, purple, pink."
             );
    }
}

function stripLeadingHashtag(colour){
    if (colour[0] == '#'){
        return colour.substring(1);
    }

    return colour;
}

function updateVisualCube(algorithm){

    switch (document.getElementById("cubeType").value){
        case "2x2":
            var pzl = "2";
            break;
        case "3x3":
            var pzl = "3";
            break;
    }

    var view = localStorage.getItem("visualCubeView");

    //VisualCube's own scheme is yellow top, green front, orange right, which is this app's
    //reference orientation turned by z2 - so undo that before the algorithm runs. The &sch=
    //ordering below (D,R,B,U,L,F) is the matching relabelling for that same z2.
    var imgsrc = "https://www.cubing.net/api/visualcube/?fmt=svg&size=300&view=" + view + "&bg=black&pzl=" + pzl + "&alg=z2" + algorithm;

    if (useCustomColourScheme.checked){
        validateCustomColourScheme();

        imgsrc += "&sch=" + ["D", "R", "B", "U", "L", "F"].map(function(face){
            return stripLeadingHashtag(colourForFace(face));
        }).join(",");
    }

    document.getElementById("visualcube").src = imgsrc;
}

function displayAlgorithm(algTest, reTest=true){    

    //If reTest is true, the scramble will also be setup on the virtual cube
    if (reTest){
        reTestAlg();
    }

    updateTrainer(algTest.scramble, algTest.solutions.join("<br><br>"), null, null);

    scramble.style.color = '#e6e6e6';
}

function displayAlgorithmFromHistory(index){    

    var algTest = algorithmHistory[index];

    console.log( algTest );

    var timerText;
    if (algTest.solveTime == null){
        timerText = 'n/a'
    } else {
        timerText = algTest.solveTime.toString()
    }

    updateTrainer("<span style=\"color: #90f182\">" + algTest.orientRandPart + "</span>" + " "+ algTest.scramble, algTest.solutions.join("<br><br>"), algTest.preorientation+algTest.scramble, timerText);

    scramble.style.color = '#e6e6e6';
}

function displayAlgorithmForPreviousTest(reTest=true){//not a great name

    var lastTest = algorithmHistory[algorithmHistory.length-1];
    if (lastTest==undefined){
        return;
    }
    //If reTest is true, the scramble will also be setup on the virtual cube
    if (reTest){
        reTestAlg();
    }

    updateTrainer("<span style=\"color: #90f182\">" + lastTest.orientRandPart + "</span>" + " "+ lastTest.scramble, lastTest.solutions.join("<br><br>"), null, null);

    scramble.style.color = '#e6e6e6';
}

function randomFromList(set){

    if (document.getElementById("goInOrder").checked){
        return set[currentAlgIndex++%set.length];
    }   

    size = set.length;
    rand = Math.floor(Math.random()*size);

    return set[rand];

}
var starttime;
var timerUpdateInterval;
var timerIsRunning = false;
function startTimer(){

    if (timerIsRunning){
        return;
    }

    if (document.getElementById("timer").style.display == 'none'){
        //don't do anything if timer is hidden
        return;
    }
    starttime = Date.now();
    timerUpdateInterval = setInterval(updateTimer, 1);
    timerIsRunning = true;
}

function stopTimer(logTime=true){

    if (!timerIsRunning){
        return;
    }

    if (document.getElementById("timer").style.display == 'none'){
        //don't do anything if timer is hidden
        return;
    }


    clearInterval(timerUpdateInterval);
    timerIsRunning = false;

    var time = parseFloat(document.getElementById("timer").innerHTML);
    if (isNaN(time)){
        return NaN;
    }


    if (logTime){
        var lastTest = algorithmHistory[algorithmHistory.length-1];
        var solveTime = new SolveTime(time,'');
        lastTest.solveTime = solveTime;
        timeArray.push(solveTime);
        console.log(timeArray);
        updateTimeList();
    }

    updateStats();
    return time;
}

function updateTimer(){
    document.getElementById("timer").innerHTML = ((Date.now()-starttime)/1000).toFixed(2);
}
var timeArray = [];

function getMean(timeArray){
    var i;
    var total = 0;
    for(i=0;i<timeArray.length;i++){
        total += timeArray[i].timeValue();
    }

    return total/timeArray.length;
}

function updateStats(){
    var statistics = document.getElementById("statistics");

    statistics.innerHTML = "&nbsp";

    if (timeArray.length!=0){
        statistics.innerHTML += "Mean of " + timeArray.length + ": " + getMean(timeArray).toFixed(2) + "<br>";
    }

}



function updateTimeList(){
    var i;
    var timeList = document.getElementById("timeList");
    timeList.innerHTML = "&nbsp";
    for (i=0; i<timeArray.length;i++){
        timeList.innerHTML += timeArray[i].toString();
        timeList.innerHTML += " ";
    }
}

//Create Checkboxes for each subset
//Each subset has id of subset name, and is followed by text of subset name.

function createAlgsetPicker(){
    var algsetPicker = document.getElementById("algsetpicker")
    for (var set in window.algs){
        var option = document.createElement("option")
        option.text = set;
        algsetPicker.add(option);

    }
    //algsetPicker.size = Object.keys(window.algs).length
}



function createCheckboxes(){

    var set = document.getElementById("algsetpicker").value;


    var full_set = window.algs[set];

    if (!full_set){
        set = document.getElementById("algsetpicker").options[0].value;
        document.getElementById("algsetpicker").value = set;
        full_set = window.algs[set]
    }
    var subsets = Object.keys(full_set);

    var myDiv = document.getElementById("cboxes");

    myDiv.innerHTML = "";

    for (var i = 0; i < subsets.length; i++) {
        var checkBox = document.createElement("input");
        var label = document.createElement("label");
        checkBox.type = "checkbox";
        checkBox.value = subsets[i];
        checkBox.onclick = function(){
            currentAlgIndex = 0;
            shouldRecalculateStatistics=true; 
            //Every time a checkbox is pressed, the algset statistics should be updated.
        }
        checkBox.setAttribute("id", set.toLowerCase() +  subsets[i]);

        myDiv.appendChild(checkBox);
        myDiv.appendChild(label);
        label.appendChild(document.createTextNode(subsets[i]));
    }
}

function clearSelectedAlgsets(){
    var elements = document.getElementById("algsetpicker").options;
    for(var i = 0; i < elements.length; i++){
        elements[i].selected = false;
    }
}

function findMistakesInUserAlgs(userAlgs){
    var errorMessage = "";
    var newList = [];
    var newListDisplay = [] // contains all valid algs + commented algs
    for (var i = 0; i < userAlgs.length; i++){
        if (userAlgs[i].trim().startsWith("#")){
            // Allow 'commenting' of algs with #, like python
            newListDisplay.push(userAlgs[i]);
            continue;
        }
        userAlgs[i] = userAlgs[i].replace(/[\u2018\u0060\u2019\u00B4]/g, "'"); 
        //replace astrophe like characters with '
        try {
            alg.cube.simplify(userAlgs[i]);
            if (userAlgs[i].trim()!="" ){
                newList.push(userAlgs[i]);
                newListDisplay.push(userAlgs[i]);
            }
        }
        catch(err){
            errorMessage += "\"" + userAlgs[i] + "\"" + " is an invalid alg and has been removed\n";
        }
    }

    if (errorMessage!=""){
        alert(errorMessage);
    }

    document.getElementById("userDefinedAlgs").value = newListDisplay.join("\n");
    localStorage.setItem("userDefinedAlgs", newList.join("\n"));
    return newList;
}

function createAlgList(overrideUserDefined=false){

    if (!overrideUserDefined){
        // Sometimes we want to ignore that the userdefined box is checked, and 
        // retrieve whatever is selected from the trainer itself
        if (document.getElementById("userDefined").checked){
            algList = findMistakesInUserAlgs(document.getElementById("userDefinedAlgs").value.split("\n"));
            if (algList.length==0){
                alert("Please enter some algs into the User Defined Algs box.");
            }
            return algList;
        }
    }
    var algList = [];

    var set = document.getElementById("algsetpicker").value;

    if (set == ""){
        return ["R U R' U' R' F R2 U' R' U' R U R' F'"];
    }

    for (var subset in window.algs[set]){

        if(document.getElementById(set.toLowerCase() + subset).checked){
            algList = algList.concat(window.algs[set][subset]);
        }
    }

    if(algList.length < 1){ //if nothing checked, test on the whole subset
        for (var subset in window.algs[set]){
            algList = algList.concat(window.algs[set][subset]);
        }
        console.log(algList.length + " algs in list");
        return algList;
    }
    console.log(algList.length + " algs in list");

    return algList;
}

function mirrorAlgsAcrossM(algList){
    algList = fixAlgorithms(algList);
    return algList.map(x => alg.cube.mirrorAcrossM(x));
}

function averageMovecount(algList, metric, includeAUF){

    var totalmoves = 0;
    var i = 0;
    for (; i<algList.length; i++){
        var topAlg = algList[i].split("/")[0];
        topAlg = topAlg.replace(/\[|\]|\)|\(/g, "");

        var moves = alg.cube.simplify(alg.cube.expand(alg.cube.fromString(topAlg)));
        
        if (!includeAUF){
            while (moves[0].base === "U" || moves[0].base === "y") {
                moves.splice(0, 1)
            }
            while (moves[moves.length - 1].base === "U" || moves[moves.length - 1].base === "y") {
                moves.splice(moves.length - 1)
            }
        }
        totalmoves += alg.cube.countMoves(moves, {"metric": metric});
    }

    return totalmoves/algList.length;
}

function toggleVirtualCube(){
    var sim = document.getElementById("simcube");

    if (sim.style.display == 'none'){
        sim.style.display = 'flex';//#simcube centres the canvas with flexbox; anything but 'none' counts as in use
    }
    else {
        sim.style.display = 'none';
    }
}

function setVirtualCube(setting){
    var sim = document.getElementById("simcube");
    if (setting){
        sim.style.display = 'flex';//#simcube centres the canvas with flexbox; anything but 'none' counts as in use
    } else {
        sim.style.display = 'none';
        document.getElementById("timer").style.display = 'block'; //timer has to be shown when simulator cube is not used
        document.getElementById("hideTimer").checked = false;
    }
}

function setTimerDisplay(setting){
    var timer = document.getElementById("timer");
    if (!isUsingVirtualCube()){
        alert("The timer can only be hidden when using the simulator cube.");
        document.getElementById("hideTimer").checked = false;
    }
    else if (setting){
        timer.style.display = 'block';
    } else {
        timer.style.display = 'none';
    }
}

function isUsingVirtualCube(){
    var sim = document.getElementById("simcube")

    if (sim.style.display == 'none'){
        return false;
    }
    else {
        return true;
    }
}


var listener = new Listener();

lastKeyMap = null;

function updateControls() {
    let keymaps = getKeyMaps();

    if (JSON.stringify(keymaps) === JSON.stringify(lastKeyMap)) {
        return false;
    }

    lastKeyMap = keymaps;

    listener.reset();

    keymaps.forEach(function(keymap){
        listener.register(keymap[0], function() {  doAlg(keymap[1]) });
    });
    listener.register(new KeyCombo("Backspace"), function() { displayAlgorithmForPreviousTest();});
    listener.register(new KeyCombo("Escape"), function() {
        if (isUsingVirtualCube()){
            stopTimer(false);
        }
        reTestAlg();
        document.getElementById("scramble").innerHTML = "&nbsp;";
        document.getElementById("algdisp").innerHTML = "";
    });
    listener.register(new KeyCombo("Enter"), function() {
        nextScramble();
        doNothingNextTimeSpaceIsPressed = false;
    });
    listener.register(new KeyCombo("Tab"), function() {
        nextScramble();
        doNothingNextTimeSpaceIsPressed = false;
    });
    listener.register(new KeyCombo("ArrowLeft"), showPreviousCase);
    listener.register(new KeyCombo("ArrowRight"), showNextCase);
}

//Step back through the solve log. Also bound to a cube gesture, see js/gestures.js
function showPreviousCase(){
    if (algorithmHistory.length<=1 || timerIsRunning){
        return;
    }
    historyIndex--;

    if (historyIndex<0){
        alert('Reached end of solve log');
        historyIndex = 0;
    }
    displayAlgorithmFromHistory(historyIndex);
}

//Step forward through the solve log, generating a new case once past the end.
function showNextCase(){
    if (timerIsRunning){
        return;
    }
    historyIndex++;
    if (historyIndex>=algorithmHistory.length){
        nextScramble();
        doNothingNextTimeSpaceIsPressed = false;
        return;
    }

    displayAlgorithmFromHistory(historyIndex);
}

setInterval(updateControls, 300);


function nextScramble(displayReady=true){
    document.getElementById("scramble").style.color = "white";
    stopTimer(false);
    if (displayReady){
        document.getElementById("timer").innerHTML = 'Ready';
    };
    if (isUsingVirtualCube() ){
        testAlg(generateAlgTest());
        startTimer();
    }
    else {
        testAlg(generateAlgTest());
    }
    historyIndex = algorithmHistory.length - 1;
}

var historyIndex;

//The settings panel owns the keyboard while it is open: space belongs to the checkbox or the text
//field the user is in, not to the timer. js/ui.js defines these once the panel exists.
function trainerKeysAreLive(){
    if (typeof settingsPanelIsOpen === "function" && settingsPanelIsOpen()){
        return false;
    }
    return document.activeElement === null || document.activeElement === document.body;
}

document.onkeyup = function(event) {
    if (event.keyCode == 32) { //space

        if (!trainerKeysAreLive()){
            return;
        }
        document.getElementById("timer").style.color = "white"; //Timer should never be any color other than white when space is not pressed down
        if (!isUsingVirtualCube()){
            if (document.getElementById("algdisp").innerHTML == ""){
                //Right after a new scramble is displayed, space starts the timer


                if (doNothingNextTimeSpaceIsPressed){
                    doNothingNextTimeSpaceIsPressed = false;
                }
                else {
                    startTimer(); 
                }
            }
        }
    }
};

var doNothingNextTimeSpaceIsPressed = true;
document.onkeydown = function(event) { //Stops the screen from scrolling down when you press space

    if (event.keyCode == 32) { //space
        if (!trainerKeysAreLive()){
            return;
        }
        event.preventDefault();
        if (!event.repeat){
            if (isUsingVirtualCube()){
                if (timerIsRunning){
                    stopTimer();
                    displayAlgorithmForPreviousTest();//put false here if you don't want the cube to retest.
                    //window.setTimeout(function (){reTestAlg();}, 250);
                }
                else {
                    displayAlgorithmForPreviousTest();
                }

            }
            else { //If not using virtual cube
                if (timerIsRunning){//If timer is running, stop timer
                    var time = stopTimer();
                    doNothingNextTimeSpaceIsPressed = true;
                    if (document.getElementById("goToNextCase").checked){
                        nextScramble(false);

                        //document.getElementById("timer").innerHTML = time;
                    } else {
                        displayAlgorithmForPreviousTest();
                    }

                }
                else if (document.getElementById("algdisp").innerHTML != ""){
                    nextScramble(); //If the solutions are currently displayed, space should test on the next alg.

                    doNothingNextTimeSpaceIsPressed = true;
                }

                else if (document.getElementById("timer").innerHTML == "Ready"){
                    document.getElementById("timer").style.color = "green";
                }
            }
        }
    }

};

class SolveTime {
    constructor(time, penalty) {
        this.time = time;
        this.penalty = penalty;
    }

    toString(decimals=2) {
        var timeString = this.time.toFixed(decimals)
        switch (this.penalty) {
            case '+2':
                return (this.time + 2).toFixed(decimals) + '+';
            case 'DNF':
                return 'DNF' + "(" + timeString + ")";
            default:
                return timeString;
        }
    }

    timeValue() {

        switch (this.penalty) {
            case '+2':
                return this.time + 2;
            case 'DNF':
                return Infinity;
            default:
                return this.time;
        }
    }

}







//CUBE OBJECT
function RubiksCube() {
    this.cubestate = [1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6];

    this.resetCube = function(){
        this.cubestate = [1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6];
    }
    this.solution = function(){
        var gcube = Cube.fromString(this.toString());
        return gcube.solve();
    }

    this.isSolved = function(){
        for (var i = 0; i<6;i++){
            var colour1 = this.cubestate[9*i];
            for (var j = 0; j<8; j++){
                if (this.cubestate[9*i + j + 1]!=colour1){
                    return false;
                }
            }
        }
        return true;
    }
    this.wcaOrient = function() {
        // u-r--f--d--l--b
        // 4 13 22 31 40 49
        //
        var moves = "";

        if (this.cubestate[13]==1) {//R face
            this.doAlgorithm("z'");
            moves +="z'";
        } else if (this.cubestate[22]==1) {//on F face
            this.doAlgorithm("x");
            moves+="x";
        } else if (this.cubestate[31]==1) {//on D face
            this.doAlgorithm("x2");
            moves+="x2";
        } else if (this.cubestate[40]==1) {//on L face
            this.doAlgorithm("z");
            moves+="z";
        } else if (this.cubestate[49]==1) {//on B face
            this.doAlgorithm("x'");
            moves+="x'";
        }

        if (this.cubestate[13]==3) {//R face
            this.doAlgorithm("y");
            moves+="y";
        } else if (this.cubestate[40]==3) {//on L face
            this.doAlgorithm("y'");
            moves+="y'";
        } else if (this.cubestate[49]==3) {//on B face
            this.doAlgorithm("y2");
            moves+="y2";
        }

        return moves;
    }
    this.toString = function(){
        var str = "";
        var i;
        var sides = ["U","R","F","D","L","B"]
        for(i=0;i<this.cubestate.length;i++){
            str+=sides[this.cubestate[i]-1];
        }
        return str;

    }


    this.test = function(alg){
        this.doAlgorithm(alg);
        drawCube(this.cubestate);
    }

    this.doAlgorithm = function(alg) {
        if (alg == "") return;

        var moveArr = alg.split(/(?=[A-Za-z])/);
        var i;

        for (i = 0;i<moveArr.length;i++) {
            var move = moveArr[i];
            var myRegexp = /([RUFBLDrufbldxyzEMS])(\d*)('?)/g;
            var match = myRegexp.exec(move.trim());


            if (match!=null) {

                var side = match[1];

                var times = 1;
                if (!match[2]=="") {
                    times = match[2] % 4;
                }

                if (match[3]=="'") {
                    times = (4 - times) % 4;
                }

                switch (side) {
                    case "R":
                        this.doR(times);
                        break;
                    case "U":
                        this.doU(times);
                        break;
                    case "F":
                        this.doF(times);
                        break;
                    case "B":
                        this.doB(times);
                        break;
                    case "L":
                        this.doL(times);
                        break;
                    case "D":
                        this.doD(times);
                        break;
                    case "r":
                        this.doRw(times);
                        break;
                    case "u":
                        this.doUw(times);
                        break;
                    case "f":
                        this.doFw(times);
                        break;
                    case "b":
                        this.doBw(times);
                        break;
                    case "l":
                        this.doLw(times);
                        break;
                    case "d":
                        this.doDw(times);
                        break;
                    case "x":
                        this.doX(times);
                        break;
                    case "y":
                        this.doY(times);
                        break;
                    case "z":
                        this.doZ(times);
                        break;
                    case "E":
                        this.doE(times);
                        break;
                    case "M":
                        this.doM(times);
                        break;
                    case "S":
                        this.doS(times);
                        break;

                }
            } else {

                console.log("Invalid alg, or no alg specified:" + alg + "|");

            }

        }

    }

    this.solveNoRotate = function(){
        //Center sticker indexes: 4, 13, 22, 31, 40, 49
        cubestate = this.cubestate;
        this.cubestate = [cubestate[4],cubestate[4],cubestate[4],cubestate[4],cubestate[4],cubestate[4],cubestate[4],cubestate[4],cubestate[4],
                          cubestate[13],cubestate[13],cubestate[13],cubestate[13],cubestate[13],cubestate[13],cubestate[13],cubestate[13],cubestate[13],
                          cubestate[22],cubestate[22],cubestate[22],cubestate[22],cubestate[22],cubestate[22],cubestate[22],cubestate[22],cubestate[22],
                          cubestate[31],cubestate[31],cubestate[31],cubestate[31],cubestate[31],cubestate[31],cubestate[31],cubestate[31],cubestate[31],
                          cubestate[40],cubestate[40],cubestate[40],cubestate[40],cubestate[40],cubestate[40],cubestate[40],cubestate[40],cubestate[40],
                          cubestate[49],cubestate[49],cubestate[49],cubestate[49],cubestate[49],cubestate[49],cubestate[49],cubestate[49],cubestate[49]];
    }

    this.doU = function(times) {
        var i;
        for (i = 0; i < times; i++) {
            cubestate = this.cubestate;
            this.cubestate = [cubestate[6], cubestate[3], cubestate[0], cubestate[7], cubestate[4], cubestate[1], cubestate[8], cubestate[5], cubestate[2], cubestate[45], cubestate[46], cubestate[47], cubestate[12], cubestate[13], cubestate[14], cubestate[15], cubestate[16], cubestate[17], cubestate[9], cubestate[10], cubestate[11], cubestate[21], cubestate[22], cubestate[23], cubestate[24], cubestate[25], cubestate[26], cubestate[27], cubestate[28], cubestate[29], cubestate[30], cubestate[31], cubestate[32], cubestate[33], cubestate[34], cubestate[35], cubestate[18], cubestate[19], cubestate[20], cubestate[39], cubestate[40], cubestate[41], cubestate[42], cubestate[43], cubestate[44], cubestate[36], cubestate[37], cubestate[38], cubestate[48], cubestate[49], cubestate[50], cubestate[51], cubestate[52], cubestate[53]];
        }

    }

    this.doR = function(times) {
        var i;
        for (i = 0; i < times; i++) {
            cubestate = this.cubestate;

            this.cubestate = [cubestate[0], cubestate[1], cubestate[20], cubestate[3], cubestate[4], cubestate[23], cubestate[6], cubestate[7], cubestate[26], cubestate[15], cubestate[12], cubestate[9], cubestate[16], cubestate[13], cubestate[10], cubestate[17], cubestate[14], cubestate[11], cubestate[18], cubestate[19], cubestate[29], cubestate[21], cubestate[22], cubestate[32], cubestate[24], cubestate[25], cubestate[35], cubestate[27], cubestate[28], cubestate[51], cubestate[30], cubestate[31], cubestate[48], cubestate[33], cubestate[34], cubestate[45], cubestate[36], cubestate[37], cubestate[38], cubestate[39], cubestate[40], cubestate[41], cubestate[42], cubestate[43], cubestate[44], cubestate[8], cubestate[46], cubestate[47], cubestate[5], cubestate[49], cubestate[50], cubestate[2], cubestate[52], cubestate[53]]
        }

    }

    this.doF = function(times) {
        var i;
        for (i = 0; i < times; i++) {
            cubestate = this.cubestate;
            this.cubestate = [cubestate[0], cubestate[1], cubestate[2], cubestate[3], cubestate[4], cubestate[5], cubestate[44], cubestate[41], cubestate[38], cubestate[6], cubestate[10], cubestate[11], cubestate[7], cubestate[13], cubestate[14], cubestate[8], cubestate[16], cubestate[17], cubestate[24], cubestate[21], cubestate[18], cubestate[25], cubestate[22], cubestate[19], cubestate[26], cubestate[23], cubestate[20], cubestate[15], cubestate[12], cubestate[9], cubestate[30], cubestate[31], cubestate[32], cubestate[33], cubestate[34], cubestate[35], cubestate[36], cubestate[37], cubestate[27], cubestate[39], cubestate[40], cubestate[28], cubestate[42], cubestate[43], cubestate[29], cubestate[45], cubestate[46], cubestate[47], cubestate[48], cubestate[49], cubestate[50], cubestate[51], cubestate[52], cubestate[53]];
        }

    }

    this.doD = function(times) {
        var i;
        for (i = 0; i < times; i++) {
            cubestate = this.cubestate;
            this.cubestate = [cubestate[0], cubestate[1], cubestate[2], cubestate[3], cubestate[4], cubestate[5], cubestate[6], cubestate[7], cubestate[8], cubestate[9], cubestate[10], cubestate[11], cubestate[12], cubestate[13], cubestate[14], cubestate[24], cubestate[25], cubestate[26], cubestate[18], cubestate[19], cubestate[20], cubestate[21], cubestate[22], cubestate[23], cubestate[42], cubestate[43], cubestate[44], cubestate[33], cubestate[30], cubestate[27], cubestate[34], cubestate[31], cubestate[28], cubestate[35], cubestate[32], cubestate[29], cubestate[36], cubestate[37], cubestate[38], cubestate[39], cubestate[40], cubestate[41], cubestate[51], cubestate[52], cubestate[53], cubestate[45], cubestate[46], cubestate[47], cubestate[48], cubestate[49], cubestate[50], cubestate[15], cubestate[16], cubestate[17]];
        }

    }

    this.doL = function(times) {
        var i;
        for (i = 0; i < times; i++) {
            cubestate = this.cubestate;
            this.cubestate = [cubestate[53], cubestate[1], cubestate[2], cubestate[50], cubestate[4], cubestate[5], cubestate[47], cubestate[7], cubestate[8], cubestate[9], cubestate[10], cubestate[11], cubestate[12], cubestate[13], cubestate[14], cubestate[15], cubestate[16], cubestate[17], cubestate[0], cubestate[19], cubestate[20], cubestate[3], cubestate[22], cubestate[23], cubestate[6], cubestate[25], cubestate[26], cubestate[18], cubestate[28], cubestate[29], cubestate[21], cubestate[31], cubestate[32], cubestate[24], cubestate[34], cubestate[35], cubestate[42], cubestate[39], cubestate[36], cubestate[43], cubestate[40], cubestate[37], cubestate[44], cubestate[41], cubestate[38], cubestate[45], cubestate[46], cubestate[33], cubestate[48], cubestate[49], cubestate[30], cubestate[51], cubestate[52], cubestate[27]];
        }

    }

    this.doB = function(times) {
        var i;
        for (i = 0; i < times; i++) {
            cubestate = this.cubestate;
            this.cubestate = [cubestate[11], cubestate[14], cubestate[17], cubestate[3], cubestate[4], cubestate[5], cubestate[6], cubestate[7], cubestate[8], cubestate[9], cubestate[10], cubestate[35], cubestate[12], cubestate[13], cubestate[34], cubestate[15], cubestate[16], cubestate[33], cubestate[18], cubestate[19], cubestate[20], cubestate[21], cubestate[22], cubestate[23], cubestate[24], cubestate[25], cubestate[26], cubestate[27], cubestate[28], cubestate[29], cubestate[30], cubestate[31], cubestate[32], cubestate[36], cubestate[39], cubestate[42], cubestate[2], cubestate[37], cubestate[38], cubestate[1], cubestate[40], cubestate[41], cubestate[0], cubestate[43], cubestate[44], cubestate[51], cubestate[48], cubestate[45], cubestate[52], cubestate[49], cubestate[46], cubestate[53], cubestate[50], cubestate[47]];
        }

    }

    this.doE = function(times) {
        var i;
        for (i = 0; i < times; i++) {
            cubestate = this.cubestate;
            this.cubestate = [cubestate[0], cubestate[1], cubestate[2], cubestate[3], cubestate[4], cubestate[5], cubestate[6], cubestate[7], cubestate[8], cubestate[9], cubestate[10], cubestate[11], cubestate[21], cubestate[22], cubestate[23], cubestate[15], cubestate[16], cubestate[17], cubestate[18], cubestate[19], cubestate[20], cubestate[39], cubestate[40], cubestate[41], cubestate[24], cubestate[25], cubestate[26], cubestate[27], cubestate[28], cubestate[29], cubestate[30], cubestate[31], cubestate[32], cubestate[33], cubestate[34], cubestate[35], cubestate[36], cubestate[37], cubestate[38], cubestate[48], cubestate[49], cubestate[50], cubestate[42], cubestate[43], cubestate[44], cubestate[45], cubestate[46], cubestate[47], cubestate[12], cubestate[13], cubestate[14], cubestate[51], cubestate[52], cubestate[53]];
        }

    }

    this.doM = function(times) {
        var i;
        for (i = 0; i < times; i++) {
            cubestate = this.cubestate;
            this.cubestate = [cubestate[0], cubestate[52], cubestate[2], cubestate[3], cubestate[49], cubestate[5], cubestate[6], cubestate[46], cubestate[8], cubestate[9], cubestate[10], cubestate[11], cubestate[12], cubestate[13], cubestate[14], cubestate[15], cubestate[16], cubestate[17], cubestate[18], cubestate[1], cubestate[20], cubestate[21], cubestate[4], cubestate[23], cubestate[24], cubestate[7], cubestate[26], cubestate[27], cubestate[19], cubestate[29], cubestate[30], cubestate[22], cubestate[32], cubestate[33], cubestate[25], cubestate[35], cubestate[36], cubestate[37], cubestate[38], cubestate[39], cubestate[40], cubestate[41], cubestate[42], cubestate[43], cubestate[44], cubestate[45], cubestate[34], cubestate[47], cubestate[48], cubestate[31], cubestate[50], cubestate[51], cubestate[28], cubestate[53]];
        }

    }

    this.doS = function(times) {
        var i;
        for (i = 0; i < times; i++) {
            cubestate = this.cubestate;
            this.cubestate = [cubestate[0], cubestate[1], cubestate[2], cubestate[43], cubestate[40], cubestate[37], cubestate[6], cubestate[7], cubestate[8], cubestate[9], cubestate[3], cubestate[11], cubestate[12], cubestate[4], cubestate[14], cubestate[15], cubestate[5], cubestate[17], cubestate[18], cubestate[19], cubestate[20], cubestate[21], cubestate[22], cubestate[23], cubestate[24], cubestate[25], cubestate[26], cubestate[27], cubestate[28], cubestate[29], cubestate[16], cubestate[13], cubestate[10], cubestate[33], cubestate[34], cubestate[35], cubestate[36], cubestate[30], cubestate[38], cubestate[39], cubestate[31], cubestate[41], cubestate[42], cubestate[32], cubestate[44], cubestate[45], cubestate[46], cubestate[47], cubestate[48], cubestate[49], cubestate[50], cubestate[51], cubestate[52], cubestate[53]];
        }

    }

    this.doX = function(times) {
        var i;
        for (i = 0; i < times; i++) {
            cubestate = this.cubestate;
            this.doR(1);
            this.doM(3);
            this.doL(3);
        }
    }

    this.doY = function(times) {
        var i;
        for (i = 0; i < times; i++) {
            cubestate = this.cubestate;

            this.doU(1);
            this.doE(3);
            this.doD(3);
        }
    }

    this.doZ = function(times) {
        var i;
        for (i = 0; i < times; i++) {
            cubestate = this.cubestate;

            this.doF(1);
            this.doS(1);
            this.doB(3);
        }
    }

    this.doUw = function(times) {
        var i;
        for (i = 0; i < times; i++) {
            cubestate = this.cubestate;
            this.doE(3);
            this.doU(1);

        }

    }

    this.doRw = function(times) {
        var i;
        for (i = 0; i < times; i++) {
            cubestate = this.cubestate;
            this.doM(3);
            this.doR(1);
        }

    }

    this.doFw = function(times) {
        var i;
        for (i = 0; i < times; i++) {
            cubestate = this.cubestate;
            this.doS(1);
            this.doF(1);
        }

    }

    this.doDw = function(times) {
        var i;
        for (i = 0; i < times; i++) {
            cubestate = this.cubestate;
            this.doE(1);
            this.doD(1);
        }

    }

    this.doLw = function(times) {
        var i;
        for (i = 0; i < times; i++) {
            cubestate = this.cubestate;
            this.doM(1);
            this.doL(1);
        }

    }

    this.doBw = function(times) {
        var i;
        for (i = 0; i < times; i++) {
            cubestate = this.cubestate;
            this.doS(3);
            this.doB(1);
        }

    }
}
