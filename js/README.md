| File                                    | From Repository                                        | License            |
|-----------------------------------------|--------------------------------------------------------|--------------------|
| cube.js and solve.js                    | [ldez/cubejs](https://github.com/ldez/cubejs)          | MIT                |
| alg.js and alg_jison.js (older version) | [cubing/alg.js](https://github.com/cubing/alg.js)      | MIT                |
| giiker.js (renamed and modified)        | [hakatashi/giiker](https://github.com/hakatashi/giiker)| MIT                |
| aes.js                                  | [ricmoo/aes-js](https://github.com/ricmoo/aes-js)      | MIT                |
| threemin.js                             | [mrdoob/three.js](https://github.com/mrdoob/three.js) via [cs0x7f/cstimer](https://github.com/cs0x7f/cstimer) | MIT |
| pnltri.js                               | [jahting/pnltri.js](https://github.com/jahting/pnltri.js) via [cs0x7f/cstimer](https://github.com/cs0x7f/cstimer) | MIT |
| twisty.js and twistynnn.js              | [cs0x7f/cstimer](https://github.com/cs0x7f/cstimer), from [cubing/twisty.js](https://github.com/cubing/twisty.js) | **GPL-3.0 / MPL** |

`twisty.js` and `twistynnn.js` are the virtual cube renderer taken from csTimer, which is
GPL-3.0 licensed. They are used unmodified, and everything they need that this project does not
already provide lives in `twistyshim.js` and `cstimerCube.js` rather than in the vendored files.

**Because those two files are GPL, a distribution of this project as a whole is effectively
GPL-3.0, not MIT.** The rest of the repository remains MIT and can be used as such on its own.
