# Allowed vendored dependencies

Three.js 0.164.1 is pinned in `three.min.js`, the unchanged official minified
ES-module distribution, MIT licensed (see `THREE-LICENSE.txt`). Its SHA-256 is
`6c2bfdf07626404916f34aef8cf57992926d849526bc6eb4556da96a3ba4e78c`.
It is a rendering dependency, not authored application code. No examples or
addons are used. All game geometry, textures, shaders, audio and music are
written procedurally in this repository.

The root `vendor/makefun-game.ts` is the competition's unchanged packaging
library, used only by Node, never by the browser game.
