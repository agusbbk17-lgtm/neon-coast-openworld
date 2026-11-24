# Sunset Syndicate

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/agusbbk17-lgtm/neon-coast-openworld/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/agusbbk17-lgtm/neon-coast-openworld/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original procedural third-person open-world crime game set in Solmar Bay:
eight vehicles, traffic, pedestrians, police, combat, three story missions,
HUD/minimap navigation, generative audio and golden-hour coastal rendering.
Developed in milestones; completion and verification are recorded below.
M1 includes the golden-hour coastal city,
articulated character, fixed-step locomotion, third-person camera presets,
collision, shoulder aim and procedural rendering.
M2 adds eight original vehicle classes, clearcoat paint and generated environment
reflections, engine/gears, drift/handbrake, suspension, OBB impulses, car entry
and exit arcs, speed-scaled chase framing and the permitted driver phone view.
M3 adds the HUD, rotating GPS minimap, clickable full map, main/pause/settings
menus, local autosave, a spline opening into the chase camera, cinematic vehicle
shots, gesture-started engine/footstep/wind/horn audio and three original
generative radio stations.
M4 adds 28 moving lane-following traffic cars, synchronized green/yellow/red
intersection lights, a connected sidewalk/crossing graph, 62 seeded walkers,
car/gunshot reactions, witness-call events, ejected carjack drivers and an
instanced articulated crowd. Sidewalk clearance and foot grounding were fixed.
M5 adds fists/bat, pistol/SMG/shotgun, grenades and an optional scoped precision
weapon; hitscan/spread/headshots/armor/reload, pooled flashes/tracers/smoke,
instanced wall decals, tyre/engine damage and explosions. Wanted 1–5 responds
with chasing/ramming cruisers, armed officers/SWAT and three-star roadblocks;
breaking line of sight starts a visible search timer. Cover/peek and
Wasted/Busted respawns are connected to gameplay.
M6 adds Mara Vale's three original stories, a reusable objective state machine,
GPS/markers, spline intro cameras, subtitles, checkpoints, retry, cash rewards
and results screens. Press J or use the pause menu to open Mara's board.

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
LMB fires or swings; RMB aims; R reloads; 1–5 select the main weapons;
mouse wheel also reaches grenades and the scoped Monarch. C crouches or takes
nearby wall cover; aim peeks, X swaps shoulders, sprint/move leaves cover.
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

M4: 24 unit tests passed. In a browser, all 28 traffic vehicles and 53 of 62
pedestrians moved during a ten-second fixed simulation; camera/drive/settings
regressions also passed. The genuine High render used 262 draw calls with
zero console errors, warnings and external requests. Traffic AI is time-sliced;
crowd geometry is instanced in two draws, with interpolated poses.

M5: 29 unit tests passed. Browser combat checks eliminated a rival with aimed
shots, consumed/reloaded ammo, verified first-person scope FOV 25, swung the
bat, threw a timed grenade, entered/exited collision-safe cover, exercised
Wasted/Busted recovery and spawned four cruisers plus a roadblock at three
stars. The combat screenshot used 434 High draw calls with zero errors or
warnings. The walking/driving/settings/traffic regression also passed.

```sh
LP_NUM_THREADS=1 LIBGL_ALWAYS_SOFTWARE=1 SOLMAR_TEST_GPU=mesa xvfb-run -a node scripts/combat-check.mjs
```

M6: five mission-state tests passed. The browser completed First Delivery using
the real driving physics, pursued and destroyed the Heat Wave rival, walked
around the parked car to the Exchange and held the Vault Run interaction,
which raised three stars. Both escape gates completed with an explicitly
supplied unseen-LOS fixture to the real wanted timer; this is **not** a manual
police-evasion playthrough. All three stories reached the completed state,
with zero console errors/warnings and no camera clipping on those routes.
The test caught and fixed an early-rival-destruction softlock. The real render
is `docs/verification/M6.jpg`; the report records the fixture limitation.

```sh
LP_NUM_THREADS=1 LIBGL_ALWAYS_SOFTWARE=1 SOLMAR_TEST_GPU=mesa xvfb-run -a node scripts/missions-check.mjs
```

M7: 52 unit tests passed, including quality adaptation, render bounds, vehicle
rotating-hull sweeps, vehicle pair impulses and AI scheduling. The browser smoke
test walked and drove the 30-second route through the Sunline tunnel, asserted
camera collision safety, auto-quality adaptation, retry recovery and context
restoration, and captured real foot/drive/live/restored renders. It reported
zero console errors, warnings and external requests; 332 maximum High draw
calls. The available Mesa llvmpipe software renderer cannot verify midrange
laptop FPS or the sub-five-second boot target.

```sh
LP_NUM_THREADS=1 LIBGL_ALWAYS_SOFTWARE=1 SOLMAR_TEST_GPU=mesa xvfb-run -a node scripts/smoke.mjs
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=df1f97fc&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

## License

MIT. See `LICENSE` and the separate vendored dependency notices.
