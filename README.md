# Sunset Syndicate

An original procedural third-person open-world game set in Solmar Bay.
Built in eight verified milestones. M1 includes the golden-hour coastal city,
articulated character, fixed-step locomotion, third-person camera presets,
collision, shoulder aim and procedural rendering.
M2 adds eight original vehicle classes, clearcoat paint and generated environment
reflections, engine/gears, drift/handbrake, suspension, OBB impulses, car entry
and exit arcs, speed-scaled chase framing and the permitted driver phone view.
M3 adds the HUD, rotating GPS minimap, clickable full map, main/pause/settings
menus, local autosave, a spline opening into the chase camera, cinematic vehicle
shots, gesture-started engine/footstep/wind/horn audio and three original
generative radio stations.

## Run locally

Requires Node.js 22.18 or newer and a desktop browser with WebGL 2.

```sh
node serve.ts
# Open http://127.0.0.1:8080/?seed=solmar-26&quality=high
npm test
```

No install or build step. Every runtime module is under `game/`; no external
fonts, models, textures, sound files, CDN or telemetry are loaded at runtime.

## Controls

WASD move; click for mouse look; Shift sprint; Space jump; C crouch;
V cycles Near/Medium/Far; right mouse aims; X swaps shoulders;
hold Left Alt while standing still to inspect.
E/F enters or exits a nearby vehicle; WASD drives; Space is the handbrake;
hold B looks behind; T toggles the driver's phone camera; H horns (sound in M3).
Q cycles Sunline / Backlot / Tidepool / Off; M opens the map; Esc pauses.
Hold V in a vehicle toggles cinematic shots. Camera, FOV, sensitivity, quality,
automatic adaptation, volumes and reduce motion are configurable in Settings.

Controller: left stick moves/steers, right stick looks, A jumps/handbrakes,
Y enters/exits, X reloads, B crouches, Start pauses, Back opens the map.
On foot LT aims and RT fires; D-pad Down cycles the camera. In vehicles LT
brakes and RT accelerates, LB/RB aim/fire, D-pad Left cycles the camera,
D-pad Up opens the phone and D-pad Right changes radio. L3 sprints/horns.
Menus support D-pad navigation and A, with Left/Right adjusting settings.

## Rendering and authorship

Three.js 0.164.1 is the only game dependency, vendored as its unchanged minified
ES module. The kit packaging SDK remains unchanged. All application code and
all geometry, canvas textures, shaders, signage and characters are authored
here. Assets are generated from `?seed=`; system fonts only.

`?quality=low|med|high|ultra`, `?debug`, and `window.__game` expose configuration
and diagnostics. The target is 60 FPS on a midrange laptop; software-rendered
browser testing does not measure that hardware target.

## Verification

M1: seven Node unit tests passed. A Chromium 159 browser integration check
exercised the real fixed-step movement, three camera presets, aim and wall
collision, then rendered a genuine screenshot: zero console errors, warnings
or external requests, 118 draw calls on Low. The available GPU is Mesa
llvmpipe (software) under Xvfb; headless SwiftShader crashes even on a single
PBR cube in this environment. Boot generation measured 7.07 s there, not a
midrange-laptop measurement. Hardware FPS and sub-five-second boot remain
unverified targets. The deterministic browser test does not measure live FPS.

```sh
LP_NUM_THREADS=1 LIBGL_ALWAYS_SOFTWARE=1 SOLMAR_TEST_GPU=mesa xvfb-run -a node scripts/milestone.mjs M1
```

Submission has not yet been made; a local check is not a remote acceptance.

M2: 12 unit tests passed (including acceleration/braking, drift, OBB separation
and building sweeps). Browser checks entered the sports car through the eased
arc, drove eight simulated seconds, verified speed-scaled FOV and collision,
used the driver phone view and exited. A genuine High render used 195 draw
calls, with zero console errors, warnings or external requests. See
`docs/verification/M2.jpg`. These deterministic checks do not measure live FPS.

M3: 20 unit tests passed, including waypoint routing, director spline endpoints,
controller trigger separation and save corruption/denied-storage handling.
Browser checks covered settings, map clicks, save, camera presets, cinematic
mode, entry/exit and the opening sweep. WebAudio stayed uncreated until a real
gesture, then ran the engine at 83.75 Hz at 4,057 RPM, applied volume changes
and suspended on pause. Every browser check reported zero errors/warnings and
no external requests. Audio output hardware and a physical controller were
not available for subjective/hardware verification.

```sh
LP_NUM_THREADS=1 LIBGL_ALWAYS_SOFTWARE=1 SOLMAR_TEST_GPU=mesa xvfb-run -a node scripts/audio-check.mjs
LP_NUM_THREADS=1 LIBGL_ALWAYS_SOFTWARE=1 SOLMAR_TEST_GPU=mesa xvfb-run -a node scripts/ui-check.mjs
```

## License

MIT. See `LICENSE` and the separate vendored dependency notices.
