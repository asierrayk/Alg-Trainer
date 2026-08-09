/**
 * Everything csTimer's twisty.js and twistynnn.js expect from the rest of csTimer.
 *
 * Those two files are vendored unmodified, so the adapting happens here instead. They reach for
 * four things this project does not otherwise have: Math.TAU, a sliver of jQuery, csTimer's
 * settings object (kernel) and a couple of cubeutil helpers.
 *
 * The jQuery surface is deliberately only what twisty.js actually calls with dragging switched
 * off - see js/cstimerCube.js, which passes allowDragging: false because moves come from the
 * keyboard and the smart cube here, not from dragging the picture. The methods only the drag
 * handlers use throw rather than silently doing nothing, so turning dragging on later fails
 * loudly instead of misbehaving.
 */
(function () {

    if (typeof Math.TAU !== "number") {
        Math.TAU = Math.PI * 2;
    }

    //csTimer's name for it, used by the animation loop in twisty.js
    if (!window.requestAnimFrame) {
        window.requestAnimFrame = window.requestAnimationFrame.bind(window);
    }

    function Nodes(nodes) {
        this.nodes = nodes;
        this.length = nodes.length;
        for (var i = 0; i < nodes.length; i++) {
            this[i] = nodes[i];
        }
    }

    Nodes.prototype.each = function (fn) {
        for (var i = 0; i < this.nodes.length; i++) {
            fn(this.nodes[i], i);
        }
        return this;
    };

    //css("name", value) or css({name: value, ...}); numbers get px, as jQuery does
    Nodes.prototype.css = function (name, value) {
        var styles = name;
        if (typeof name === "string") {
            styles = {};
            styles[name] = value;
        }
        return this.each(function (node) {
            for (var property in styles) {
                var v = styles[property];
                node.style.setProperty(property, typeof v === "number" ? v + "px" : v);
            }
        });
    };

    Nodes.prototype.empty = function () {
        return this.each(function (node) {
            while (node.firstChild) {
                node.removeChild(node.firstChild);
            }
        });
    };

    Nodes.prototype.width = function () {
        return this.nodes[0] ? this.nodes[0].clientWidth : 0;
    };

    Nodes.prototype.height = function () {
        return this.nodes[0] ? this.nodes[0].clientHeight : 0;
    };

    Nodes.prototype.append = function (html) {
        return this.each(function (node) {
            node.insertAdjacentHTML("beforeend", html);
        });
    };

    Nodes.prototype.appendTo = function (target) {
        var parent = target instanceof Nodes ? target.nodes[0] : target;
        this.each(function (node) {
            parent.appendChild(node);
        });
        return this;
    };

    //Only the drag-to-turn handlers need these, and those are never bound here.
    ["on", "addClass", "removeClass", "find", "attr", "html"].forEach(function (name) {
        Nodes.prototype[name] = function () {
            throw new Error("twistyshim: $()." + name + " is only needed for drag-to-turn, " +
                            "which js/cstimerCube.js switches off. Implement it before enabling.");
        };
    });

    function shim(selector) {
        if (selector instanceof Nodes) {
            return selector;
        }
        if (typeof selector === "string") {
            var holder = document.createElement("div");
            holder.innerHTML = selector.replace("<div/>", "<div></div>");
            return new Nodes(Array.prototype.slice.call(holder.children));
        }
        return new Nodes(selector ? [selector] : []);
    }

    shim.now = Date.now;

    shim.map = function (array, fn) {
        return Array.prototype.map.call(array, function (item, i) { return fn(item, i); });
    };

    //Named debounce: the last call under a given name wins.
    var delayed = {};
    shim.delayExec = function (name, fn, ms) {
        clearTimeout(delayed[name]);
        delayed[name] = setTimeout(fn, ms);
    };

    if (!window.$) {
        window.$ = shim;
    }

    //csTimer's settings store. Returning the fallback gives csTimer's own defaults, which is what
    //"looks exactly like csTimer" needs: vrcSpeed 100, vrcOri '6,12', vrcAH '01'.
    if (!window.kernel) {
        window.kernel = {
            getProp: function (name, fallback) {
                return fallback;
            }
        };
    }

    //getProgress drives csTimer's multi-phase readout, which this project does not show.
    //parseScramble is unused: js/cstimerCube.js builds moves itself.
    if (!window.cubeutil) {
        window.cubeutil = {
            getProgress: function () { return ""; },
            parseScramble: function () { return []; }
        };
    }
})();
