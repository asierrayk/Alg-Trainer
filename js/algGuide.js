//Guided execution of the solution, in the manner of csTimer's guided scramble: the moves you
//have already performed are dimmed, the next one is highlighted, and a turn that does not
//belong is shown in red along with what it takes to undo it.
//
//Progress is tracked by cube state rather than by matching move tokens, because the algs here
//are not limited to face turns:
//
//  - Rotations (y, x2) cannot be reported by a smart cube at all.
//  - A wide move r is physically L' plus an x rotation, so the cube reports L'.
//  - Undoing a turn should walk the pointer backwards.
//
//Comparing states modulo whole-cube rotation handles all three. The physical cube never
//relabels its own faces, so a rotation in the alg only changes which face the *user* calls R -
//the state stays rotation-equivalent to the prefix it belongs to, and the pointer steps over
//rotations by itself.
//
//Known limitation: a slice move (M, E, S) made on a real smart cube arrives as two separate
//face turns, or as nothing at all, depending on the cube. Mid-move the state matches no
//prefix, so the display flashes red; it recovers as soon as a matching state is reached.

//The 24 cube orientations, as algorithms taking the solved cube to each one.
var ALG_GUIDE_ROTATIONS = (function(){
    var rotations = [];
    var faces = ["", "x", "x2", "x'", "z", "z'"];
    var spins = ["", "y", "y2", "y'"];
    for (var i = 0; i < faces.length; i++){
        for (var j = 0; j < spins.length; j++){
            rotations.push((faces[i] + " " + spins[j]).trim());
        }
    }
    return rotations;
})();

//Null whenever no solution is on screen. See startAlgGuide for the shape.
var algGuide = null;

function startAlgGuide(algTest){
    var base = new RubiksCube();
    base.doAlgorithm(algTest.preorientation);
    base.doAlgorithm(algTest.scramble);
    var baseState = base.cubestate.slice();

    //facelet string -> [{alt, i}], so a state reached by more than one alternative, or more
    //than once within an alg, offers every reading and the pointer picks the nearest.
    var stateIndex = {};
    var alternatives = [];

    for (var a = 0; a < algTest.solutions.length; a++){
        var moves = gestureToMoves(algTest.solutions[a]);
        var walker = new RubiksCube();
        walker.cubestate = baseState.slice();

        for (var i = 0; i <= moves.length; i++){
            if (i > 0){
                walker.doAlgorithm(moves[i-1]);
            }
            var key = walker.toString();
            if (stateIndex[key] === undefined){
                stateIndex[key] = [];
            }
            stateIndex[key].push({alt: a, i: i});
        }

        alternatives.push(moves);
    }

    algGuide = {alternatives: alternatives,
                stateIndex: stateIndex,
                active: 0,
                pointer: 0,
                wrong: []};

    //The cube is usually sitting at the start of the alg, but the solution can also be brought
    //up part way through one, so take a reading before anything is drawn.
    algGuideMatch();
    renderAlgAlternatives();
}

function stopAlgGuide(){
    algGuide = null;
    renderAlgAlternatives();
}

//Every orientation of the live cube, as facelet strings.
function algGuideCanonicalStates(){
    var states = [];
    for (var i = 0; i < ALG_GUIDE_ROTATIONS.length; i++){
        var rotated = new RubiksCube();
        rotated.cubestate = cube.cubestate.slice();
        rotated.doAlgorithm(ALG_GUIDE_ROTATIONS[i]);
        states.push(rotated.toString());
    }
    return states;
}

//Prefer staying on the alg being guided, then the reading closest to where the pointer already
//is, then the deepest one - which is what carries the pointer over a rotation, whose prefix
//state is identical to the one before it.
function algGuideBestMatch(candidates){
    var best = null;
    for (var i = 0; i < candidates.length; i++){
        var candidate = candidates[i];
        var cost = Math.abs(candidate.i - algGuide.pointer)
                   + (candidate.alt === algGuide.active ? 0 : 1000);
        if (best === null || cost < best.cost || (cost === best.cost && candidate.i > best.candidate.i)){
            best = {cost: cost, candidate: candidate};
        }
    }
    return best === null ? null : best.candidate;
}

//Move the pointer to wherever the cube says the user is. Returns false if the cube is not in
//any state the alg passes through.
function algGuideMatch(){
    var states = algGuideCanonicalStates();
    var candidates = [];
    for (var i = 0; i < states.length; i++){
        var found = algGuide.stateIndex[states[i]];
        if (found !== undefined){
            candidates = candidates.concat(found);
        }
    }

    var match = algGuideBestMatch(candidates);
    if (match === null){
        return false;
    }

    algGuide.active = match.alt;
    algGuide.pointer = match.i;
    algGuide.wrong.length = 0;
    return true;
}

function algGuideIsRotation(move){
    return "xyz".indexOf(move.charAt(0)) !== -1;
}

function algGuideInverse(move){
    if (move.indexOf("2") !== -1){
        return move;
    }
    return move.indexOf("'") !== -1 ? move.replace("'", "") : move + "'";
}

function algGuideOnMove(notation){
    if (algGuide === null){
        return;
    }

    //A rotation leaves the cube in the same state as far as the guide can tell, so it can only
    //be taken on trust: if the user turns the very rotation the alg asks for, step over it. A
    //smart cube never reports one at all, and there the turn after it is what moves the
    //pointer on - both prefixes match, and the deeper one wins.
    var moves = algGuide.alternatives[algGuide.active];
    var expected = moves[algGuide.pointer];
    var previous = moves[algGuide.pointer - 1];
    if (algGuide.wrong.length === 0 && expected !== undefined
        && algGuideIsRotation(expected) && notation === expected){
        algGuide.pointer++;
    } else if (algGuide.wrong.length === 0 && previous !== undefined
               && algGuideIsRotation(previous) && notation === algGuideInverse(previous)){
        //...and rotating back out of one steps the pointer back with it
        algGuide.pointer--;
    }

    var wasActive = algGuide.active;
    if (!algGuideMatch()){
        algGuide.wrong.push(notation);
    }

    setAlgDisplay(renderAlgGuide());
    if (algGuide.active !== wasActive){
        //Following a different alg swaps which one is on the stage, so the list of the others
        //has to swap with it
        renderAlgAlternatives();
    }
}

function algGuideMoveSpan(move, className){
    return "<span class=\"algMove" + (className ? " " + className : "") + "\">" + move + "</span>";
}

//Only the alg being guided goes on the stage - the band it lives in is a fixed height, so that
//the cube below it never moves. The others are listed in the settings panel instead.
function renderAlgGuide(){
    if (algGuide === null){
        return "";
    }

    var moves = algGuide.alternatives[algGuide.active];

    //Wrong turns are shown where they happened, between what has been done and what is left,
    //so the alg still reads in order around them.
    var spans = [];
    for (var i = 0; i < algGuide.pointer; i++){
        spans.push(algGuideMoveSpan(moves[i], "done"));
    }
    for (var w = 0; w < algGuide.wrong.length; w++){
        spans.push(algGuideMoveSpan(algGuide.wrong[w], "wrong"));
    }
    for (var j = algGuide.pointer; j < moves.length; j++){
        var isNext = j === algGuide.pointer && algGuide.wrong.length === 0;
        spans.push(algGuideMoveSpan(moves[j], isNext ? "next" : ""));
    }

    var html = "<div class=\"algAlt active\">" + spans.join(" ") + "</div>";

    if (algGuide.wrong.length > 0){
        html += "<div class=\"algFix\">undo " + algGuideUndo() + "</div>";
    }

    return html;
}

//The algs for this case that are not the one being guided, for the settings panel.
function renderAlgAlternatives(){
    var box = document.getElementById("algAlternatives");
    if (!box){
        return;
    }

    if (algGuide === null){
        box.innerHTML = "";
        return;
    }

    var html = "";
    for (var a = 0; a < algGuide.alternatives.length; a++){
        if (a !== algGuide.active){
            html += "<div class=\"algAlt\">" + algGuide.alternatives[a].join(" ") + "</div>";
        }
    }
    box.innerHTML = html;
}

//What it takes to get back to the last state the alg passed through.
function algGuideUndo(){
    return alg.cube.simplify(alg.cube.invert(algGuide.wrong.join(" "))).trim();
}
