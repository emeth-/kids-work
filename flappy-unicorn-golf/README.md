# Flappy Unicorn Golf

Plain HTML/CSS/JS with no build step and no dependencies. Open `index.html` in a browser (double-clicking works) and it runs fully offline.

## Publishing (GitHub Pages) + home-screen app

1. Push this folder to a GitHub repo.
2. Repo **Settings → Pages → Build and deployment**: Source "Deploy from a branch", branch `main`, folder `/ (root)`.
3. It appears at `https://<user>.github.io/<repo>/`. All paths are relative, so the `/<repo>/` prefix needs no config.

To install: on **iPhone/iPad**, open it in Safari, then Share → **Add to Home Screen**. On **Android/desktop Chrome**, use the install prompt or menu → Install app. It launches fullscreen with no browser chrome and works offline.

PWA pieces: `manifest.webmanifest`, `sw.js` (network-first offline cache, so pushes show up on next launch with no version bumping), `icons/`, and the `<meta>` tags at the top of `index.html`. If you add new files, add them to `SHELL` in `sw.js` so they're available offline from the very first launch (anything fetched while online gets cached anyway).

Icons are drawn from the game's own art by `tools/icon.html`: open it in a browser and click each canvas to download the PNG into `icons/`.

## Layout

| File | What's in it |
|---|---|
| `index.html` | Overlay markup (HUD, title, hole-complete card, scorecard) |
| `style.css` | All styling; palette variables at the top |
| `src/course.js` | **The holes.** Pure data with a field reference at the top. Start here to design levels |
| `src/game.js` | `class Game`: state machine, input, audio, physics, castle-interior walk/fly |
| `src/draw.js` | `class GameDrawing`: every canvas drawing routine (Game extends it) |
| `src/hud.js` | Syncs the overlay DOM from `game.hudState()` |
| `src/main.js` | Boot + event wiring; exposes `window.game` for console poking |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installable-app (PWA) bits |
| `tools/icon.html` | Regenerates the icons from the game's drawing code |
| `fonts/` | Fredoka (latin subset) + its OFL license |

Scripts are classic `<script>` tags, loaded in order, rather than ES modules, because browsers block modules on `file://`.

## Handy console tricks

```js
game.loadHole(4, false)        // jump to hole 5 (The Valley)
game.g.ball.x = 900            // teleport the unicorn
game.setState({ toast: 'hi' }) // poke the HUD
```

Best score and mute are stored in `localStorage` (`flappy-unicorn-golf-best`, `flappy-unicorn-muted`).
