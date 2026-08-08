/**
 * Shell behaviour: the settings panel, and mounting the two binding editors inside it.
 *
 * Loaded after js/RubiksCube.js so reloadGestures() exists by the time the gesture editor can
 * call it. The whole point of editing bindings in a panel rather than on a separate page is that
 * the page never unloads, so a connected smart cube stays connected.
 */
(function () {

    var panel = document.getElementById("settingsPanel");
    var scrim = document.getElementById("panelScrim");
    var openButton = document.getElementById("openSettings");
    var closeButton = document.getElementById("closeSettings");

    if (!panel) {
        return;
    }

    function setPanel(open) {
        panel.hidden = !open;
        scrim.hidden = !open;
        if (!open) {
            //Give the keys back to the cube
            document.activeElement && document.activeElement.blur();
        }
    }

    //Used by the key handlers in js/RubiksCube.js: while the panel has the user's attention,
    //space must not start the timer and Escape must not reset the case.
    window.settingsPanelIsOpen = function () {
        return !panel.hidden;
    };

    window.settingsPanelHasFocus = function () {
        return !panel.hidden && panel.contains(document.activeElement);
    };

    openButton.addEventListener("click", function () { setPanel(true); });
    closeButton.addEventListener("click", function () { setPanel(false); });
    scrim.addEventListener("click", function () { setPanel(false); });

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !panel.hidden) {
            setPanel(false);
            e.stopPropagation();
        }
    }, true);

    //Clicking a HUD button leaves it focused, and both the move keys (Listener.keydown) and the
    //space handlers only fire when focus is on the body. Hand the keyboard straight back.
    var controls = document.getElementById("controls");
    if (controls) {
        controls.addEventListener("click", function (e) {
            if (e.target && e.target.blur) {
                e.target.blur();
            }
        });
    }

    if (typeof initControlsEditor === "function") {
        initControlsEditor(document.getElementById("controlsEditor"));
    }
    if (typeof initGesturesEditor === "function") {
        initGesturesEditor(document.getElementById("gesturesEditor"));
    }
})();
