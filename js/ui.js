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

    //Using a control on the top bar leaves it focused, and both the move keys (Listener.keydown)
    //and the space handlers only fire when focus is on the body. Hand the keyboard straight back.
    var stageBar = document.getElementById("stageBar");
    if (stageBar) {
        function releaseKeyboard(e) {
            if (e.target && e.target.blur) {
                e.target.blur();
            }
        }
        stageBar.addEventListener("click", releaseKeyboard);
        stageBar.addEventListener("change", releaseKeyboard);
    }

    //The stage buttons are gone, so touch drives the trainer: a tap shows the solution and a
    //swipe steps through the cases, the same actions the cube gestures bind to. Swiping right
    //past the newest case makes a new scramble - showNextCase already does that.
    var stage = document.getElementById("stage");
    if (stage) {
        var SWIPE = 40;//px across before it counts as a swipe rather than a tap
        var TAP = 10;  //px of slop allowed in a tap
        var TAP_MS = 500;
        var start = null;

        stage.addEventListener("pointerdown", function (e) {
            //The bar and the panel own their own clicks
            if (e.target.closest && e.target.closest("#stageBar, #settingsPanel")) {
                start = null;
                return;
            }
            start = {x: e.clientX, y: e.clientY, at: Date.now()};
        });

        stage.addEventListener("pointerup", function (e) {
            if (!start || typeof runGestureAction !== "function") {
                return;
            }
            var dx = e.clientX - start.x;
            var dy = e.clientY - start.y;
            var dt = Date.now() - start.at;
            start = null;

            if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy)) {
                runGestureAction(dx < 0 ? "nextCase" : "previousCase");
            } else if (Math.abs(dx) < TAP && Math.abs(dy) < TAP && dt < TAP_MS) {
                runGestureAction("showSolution");
            }
        });

        stage.addEventListener("pointercancel", function () { start = null; });
    }

    if (typeof initControlsEditor === "function") {
        initControlsEditor(document.getElementById("controlsEditor"));
    }
    if (typeof initGesturesEditor === "function") {
        initGesturesEditor(document.getElementById("gesturesEditor"));
    }
})();
