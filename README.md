# [tao-yu.github.io/Alg-Trainer/](https://tao-yu.github.io/Alg-Trainer/)

Alg Trainer is a website that makes it easy to memorize Rubik's Cube algorithms. 

In July 2017, I used this trainer to memorize full ZBLL (493 algorithms) in only 58 days, a feat which I describe in [this video](https://www.youtube.com/watch?v=5TEtHB5eoZw). 

## Features

- [Smart Rubik's Cube support](https://www.youtube.com/watch?v=2PWErrApqWQ) - Giiker i3S/i3SE, and MoYu cubes using the WCU_MY32 protocol such as the Weilong V10 AI
- Three cube views - **qcube**, the compact layout csTimer uses, with the U and F faces stacked and the L and R faces hinged out into side bars; **qcube extended**, the same with four more stickers showing on each side; and a **3D virtual cube** you can drag to turn, which animates each move as you make it. Pick one under Cube view in the settings.
- Full screen cube - the cube fills the window at whatever size it is, with just the scramble, timer and solution around it. Everything else lives in a settings panel that slides over the top, including the keyboard and gesture binding editors. Nothing navigates away from the page, so **a connected smart cube stays connected while you change settings**. Works on a phone in both orientations.
- Cube gestures - turn the cube itself to show the solution, change case, or get a new scramble, so you never have to put it down to reach the keyboard. The four defaults (`U U U' U'`, `U U U U`, `U' U' U' U'`, `R' R' R R`) all leave the cube untouched, and they can be rebound from the settings panel, taking effect immediately.
- Cube orientation - tell the trainer which colours you hold in front and on top, and every case is oriented to match, so the virtual cube looks like the one in your hands. A connected smart cube names its faces in its own frame, so its moves are relabelled into your orientation too - which means a restickered cube and a standard one both behave correctly without changing how you hold either.
- Supports PLL, OLL, F2L, COLL, WV, ZBLL, 2GLL, ZZLL, ZBLS, CLS, TTLL, CMLL, TOLS, CLL, CPEOLL, OLLCP, blindfolded 3-style (corners, edges, parity, floating pieces), and much, much more. 
- Train algsets by their subsets - for example, you can train the T, U, L, Pi, H, S and AS subsets of ZBLL separately.
- Features a timer for timing your algorithms.
- Real scrambles - scrambles are not just the reverse of the algorithm. It won't be possible to guess the algorithm just by looking at the scramble!
- Pressing spacebar shows you the algorithm you should use. No more searching for algs in pdf documents!
- Virtual cube. Learning algs with a virtual cube saves a ton of time because you don't need to scramble your cube. I used this when I was learning full ZBLL.
- Customizable controls: The default keyboard controls for turning the virtual cube are based on a ergonomic layout designed by Ryan Heise. However it is possible to customize the controls to whatever you want! 
- User defined algset - Have a list of algs you want to train? No problem, just paste them into the "User defined algset" box.

## Licence

This project is MIT licensed, **except** for `js/twisty.js` and `js/twistynnn.js`, the virtual cube
renderer taken unmodified from [csTimer](https://github.com/cs0x7f/cstimer), which is GPL-3.0. As a
result a distribution of the project as a whole is effectively GPL-3.0. See `js/README.md` for the
licence of every vendored file.
