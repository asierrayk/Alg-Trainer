/**
 * Cube gesture editor.
 *
 * Same shape as js/controlsEditor.js: builds its own markup inside the given container and keeps
 * everything local, so both editors can live in the settings panel at once. Saving writes
 * localStorage["gestures"] and calls reloadGestures() when the trainer is on the page, so a new
 * binding works immediately - no reload, and so no dropped smart cube connection.
 */
window.initGesturesEditor = function(container) {

    let currentGestures = getGestures();
    let isChanging = false;

    container.innerHTML = "";
    container.className = "editor";

    let hint = document.createElement("p");
    hint.className = "editor-hint";
    hint.innerText = "Perform one of these sequences on the cube - virtual, or a connected smart " +
        "cube - and the trainer does the thing in the Action column, no keyboard needed. Click a " +
        "row to change it. Write moves in ordinary notation separated by spaces, e.g. U U U' U'. " +
        "Pick sequences that leave the cube unchanged, otherwise using one wrecks the case you " +
        "are working on.";
    container.appendChild(hint);

    let changedDiv = document.createElement("div");
    changedDiv.className = "editor-changed";
    changedDiv.hidden = true;
    let saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.innerText = "Save";
    let undoButton = document.createElement("button");
    undoButton.type = "button";
    undoButton.innerText = "Go back";
    changedDiv.appendChild(saveButton);
    changedDiv.appendChild(undoButton);
    container.appendChild(changedDiv);

    let table = document.createElement("table");
    table.className = "editor-table";
    let head = document.createElement("tr");
    ["Moves", "Action", ""].forEach(function(text){
        let th = document.createElement("th");
        th.innerText = text;
        head.appendChild(th);
    });
    table.appendChild(head);
    let body = document.createElement("tbody");
    table.appendChild(body);
    container.appendChild(table);

    let addButton = document.createElement("button");
    addButton.type = "button";
    addButton.innerText = "Add another";
    container.appendChild(addButton);

    let resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.innerText = "Reset to default";
    container.appendChild(resetButton);

    function notifyChanged() {
        changedDiv.hidden = JSON.stringify(currentGestures) === JSON.stringify(getGestures());
    }

    function editField(i) {
        if (isChanging) {
            rerender();
            return;
        }
        isChanging = true;

        let [sequence, action] = currentGestures[i];
        let tr = body.children[i];
        let movesTd = tr.children[0];
        let actionTd = tr.children[1];
        let buttonsTd = tr.children[2];

        movesTd.innerHTML = "";
        let movesField = document.createElement("input");
        movesField.value = sequence;
        movesTd.appendChild(movesField);

        actionTd.innerHTML = "";
        let actionField = document.createElement("select");
        for (let id in gestureActions) {
            let option = document.createElement("option");
            option.value = id;
            option.text = gestureActions[id];
            actionField.add(option);
        }
        actionField.value = action;
        actionTd.appendChild(actionField);

        buttonsTd.innerHTML = "";

        let escapeButton = document.createElement("button");
        escapeButton.type = "button";
        escapeButton.innerText = "❌";
        escapeButton.onclick = _e => rerender();
        buttonsTd.appendChild(escapeButton);

        let acceptButton = document.createElement("button");
        acceptButton.type = "button";
        acceptButton.innerText = "✅";
        acceptButton.onclick = _e => {
            let moves = gestureToMoves(movesField.value);
            if (moves.length === 0) {
                alert("A gesture needs at least one move.");
                return;
            }
            currentGestures[i] = [moves.join(" "), actionField.value];
            rerender();
        };
        buttonsTd.appendChild(acceptButton);

        let removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.innerText = "🗑";
        removeButton.onclick = _e => {
            currentGestures.splice(i, 1);
            rerender();
        };
        buttonsTd.appendChild(removeButton);

        tr.onclick = null;
    }

    function rerender(quiet=false) {
        if (!quiet) {
            notifyChanged();
        }
        body.innerHTML = "";
        isChanging = false;

        for (let i = 0; i < currentGestures.length; i++) {
            let [sequence, action] = currentGestures[i];
            let movesTd = document.createElement("td");
            movesTd.innerText = sequence;
            let actionTd = document.createElement("td");
            actionTd.innerText = gestureActions[action] || action;

            let tr = document.createElement("tr");
            tr.appendChild(movesTd);
            tr.appendChild(actionTd);
            tr.appendChild(document.createElement("td"));

            body.appendChild(tr);
            tr.onclick = _e => editField(i);
        }
    }

    addButton.onclick = _ => {
        currentGestures.push(["", Object.keys(gestureActions)[0]]);
        rerender(true);
        editField(currentGestures.length - 1);
    };

    resetButton.onclick = _ => {
        currentGestures = JSON.parse(JSON.stringify(defaultGestures));
        rerender(false);
    };

    saveButton.onclick = _ => {
        localStorage.setItem("gestures", JSON.stringify(currentGestures));
        //Apply straight away, so editing a binding never costs a smart cube connection
        if (typeof reloadGestures === "function") {
            reloadGestures();
        }
        rerender();
    };

    undoButton.onclick = _ => {
        currentGestures = getGestures();
        rerender();
    };

    rerender();
};
