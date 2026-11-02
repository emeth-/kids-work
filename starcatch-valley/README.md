# Starcatch Valley

A 3D math-facts flying race (three.js). Plain HTML/CSS/JS with no build step. Every dependency is bundled locally, so it runs fully offline: open `index.html` in a browser (double-clicking works).

## Publishing (GitHub Pages) + home-screen app

1. Push this folder to a GitHub repo.
2. Repo **Settings → Pages → Build and deployment**: Source "Deploy from a branch", branch `main`, folder `/ (root)`.
3. It appears at `https://<user>.github.io/<repo>/`. All paths are relative, so the `/<repo>/` prefix needs no config.

To install: on **iPhone/iPad**, open it in Safari, then Share → **Add to Home Screen**. On **Android/desktop Chrome**, use the install prompt or menu → Install app. It launches fullscreen and works offline.

PWA pieces: `manifest.webmanifest`, `sw.js` (network-first offline cache, so pushes show up on next launch with no version bumping), `icons/`, and the `<meta>` tags at the top of `index.html`. If you add files, list them in `SHELL` in `sw.js` so they're available offline from the very first launch.

## Layout

| File | What's in it |
|---|---|
| `index.html` | HUD markup (question card, score, race bar); the setup/results panels are built by game.js |
| `style.css` | All styling; colour variables in `:root` |
| `src/tuning.js` | **Knobs:** race length, speeds, boost, think time per difficulty, CPU birds (names, colours, accuracy), bird emoji, operation labels |
| `src/questions.js` | **Math facts:** number ranges per operation × difficulty, and how wrong-answer choices are picked |
| `src/util.js` | Small helpers (clamp, random int, shuffle, escaping) + value noise for the terrain |
| `src/game.js` | Everything else: terrain, scene, gates, birds, race flow, panels, input, main loop |
| `src/pwa.js` | Registers the service worker |
| `vendor/three.min.js` | three.js r128 (MIT), byte-identical to the cdnjs copy the original used |
| `fonts/` | Fredoka + Karla (latin subsets) and their OFL license |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installable-app (PWA) bits |
| `tools/icon.html` | Redraws the icons: open it in a browser and click each one to download the PNG |

The scripts are classic `<script>` tags loaded in order (ES modules are blocked on `file://`). `tuning.js`, `util.js`, and `questions.js` define globals that `game.js` uses.

Records (flights, wins, best per mode) are stored in `localStorage` under `starcatch.sky.v1`.
