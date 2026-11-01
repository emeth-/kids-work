// Flappy Unicorn Golf: boot + DOM event wiring.

(function () {
  const root = document.getElementById('game');
  const canvas = document.getElementById('canvas');
  const hud = new Hud(root);
  const game = new Game(root, canvas, (v) => hud.render(v));

  // buttons with data-action="..." call these
  const actions = {
    startRound: () => game.startRound(),
    nextHole: () => game.nextHole(),
    retryHole: () => game.retryHole(),
    toggleMute: () => game.toggleMute()
  };
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn && actions[btn.dataset.action]) actions[btn.dataset.action]();
  });

  // on-screen flap buttons: flap on pointerdown for responsiveness; the click
  // handler only covers keyboard activation (Enter/Space give detail === 0)
  for (const btn of root.querySelectorAll('[data-flap]')) {
    const dir = Number(btn.dataset.flap);
    btn.addEventListener('pointerdown', (e) => { if (e.cancelable) e.preventDefault(); game.flap(dir); });
    btn.addEventListener('click', (e) => { if (e.detail === 0) game.flap(dir); });
  }

  // tapping anywhere else: left/right half flaps; inside the castle, walk/fly
  root.addEventListener('pointerdown', (e) => game.onPointer(e));
  root.addEventListener('keydown', (e) => game.onKey(e));
  root.addEventListener('keyup', (e) => { if (game.keys) game.keys[e.code || e.key] = false; });

  hud.render(game.hudState());
  game.mount();
  game.focusRoot(); // so arrow keys work without clicking first

  window.game = game; // handy for poking at state from the dev console

  // offline support for the installed app (service workers need http(s), not file://)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('service worker:', err));
  }
})();
