/**
 * Keyboard controls editor.
 *
 * Builds its own markup inside the container it is given and keeps every reference local, so it
 * can sit in the settings panel alongside the gesture editor without their ids or globals
 * colliding. Saving writes localStorage["keymaps"]; updateControls() in js/RubiksCube.js polls
 * that and re-registers the bindings, so edits apply without a reload.
 */
window.initControlsEditor = function(container) {

    let currentKeymap = getKeyMaps();
    let isChanging = false;

    container.innerHTML = "";
    container.className = "editor";

    let hint = document.createElement("p");
    hint.className = "editor-hint";
    hint.innerText = "Click a binding to change it. The Move column is the move made on that key combo.";
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
    ["Key", "Move", ""].forEach(function(text){
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
        changedDiv.hidden = JSON.stringify(currentKeymap) === JSON.stringify(getKeyMaps());
    }

    function editField(i) {
        if (isChanging) {
            rerender();
            return;
        }
        isChanging = true;

        let [k, v] = currentKeymap[i];
        let tr = body.children[i];
        let key = tr.children[0];
        let move = tr.children[1];
        let buttonsTd = tr.children[2];

        let newKc = k;

        key.innerHTML = "";
        let keyField = document.createElement("input");
        keyField.value = k.toString();
        key.appendChild(keyField);

        keyField.addEventListener("keydown", e => {
            e.preventDefault();
            let kc = keyEventToKeyCombo(e, true);
            newKc = keyEventToKeyCombo(e, false) || newKc;
            keyField.value = kc.toString();
        });

        move.innerHTML = "";
        let moveField = document.createElement("input");
        moveField.value = v;
        move.appendChild(moveField);

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
            currentKeymap[i] = [newKc, moveField.value];
            rerender();
        };
        buttonsTd.appendChild(acceptButton);

        let removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.innerText = "🗑";
        removeButton.onclick = _e => {
            currentKeymap.splice(i, 1);
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

        for (let i = 0; i < currentKeymap.length; i++) {
            let [k, v] = currentKeymap[i];
            let key = document.createElement("td");
            key.innerText = k.toString();
            let move = document.createElement("td");
            move.innerText = v;

            let tr = document.createElement("tr");
            tr.appendChild(key);
            tr.appendChild(move);
            tr.appendChild(document.createElement("td"));

            body.appendChild(tr);
            tr.onclick = _e => editField(i);
        }
    }

    addButton.onclick = _ => {
        currentKeymap.push([new KeyCombo(""), "alg"]);
        rerender(true);
        editField(currentKeymap.length - 1);
    };

    resetButton.onclick = _ => {
        currentKeymap = JSON.parse(JSON.stringify(defaultKeymaps));
        //Plain objects come back from the clone, so give them their KeyCombo behaviour again
        for (let i = 0; i < currentKeymap.length; i++) {
            let kc = new KeyCombo("");
            Object.assign(kc, currentKeymap[i][0]);
            currentKeymap[i][0] = kc;
        }
        rerender(false);
    };

    saveButton.onclick = _ => {
        localStorage.setItem("keymaps", JSON.stringify(currentKeymap));
        rerender();
    };

    undoButton.onclick = _ => {
        currentKeymap = getKeyMaps();
        rerender();
    };

    rerender();
};
