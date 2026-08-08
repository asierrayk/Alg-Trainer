//Cube gestures: sequences of moves that drive the trainer instead of the keyboard.
//Every default sequence leaves the cube exactly as it found it, so performing one
//on a real (or virtual) cube costs you nothing but the turns.

//The actions a gesture can be bound to. id -> label shown in gestures.html
var gestureActions = {
    "showSolution": "Show solution",
    "nextCase": "Next case",
    "previousCase": "Previous case",
    "nextScramble": "Next scramble"
};

var defaultGestures = [
    ["U U U' U'", "showSolution"],
    ["U U U U", "nextCase"],
    ["U' U' U' U'", "previousCase"],
    ["R' R' R R", "nextScramble"]];

function getGestures() {
    if (localStorage.getItem("gestures") === null) {
        localStorage.setItem("gestures", JSON.stringify(defaultGestures));
    }
    return JSON.parse(localStorage.getItem("gestures"));
}

//"U U U' U'" -> ["U", "U", "U'", "U'"]
function gestureToMoves(sequence) {
    return sequence.trim().split(/\s+/).filter(move => move.length > 0);
}
