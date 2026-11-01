// Flappy Unicorn Golf: DOM overlay (HUD chips, banners, menus, scorecard).
//
// render(v) takes the object from Game#hudState() and syncs the markup in
// index.html using the data-show / data-hide / data-text attributes, plus a
// few hand-wired bits (heat bar, stars, scorecard rows, mute label).

const STAR_PATH = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z';
const SVG_NS = 'http://www.w3.org/2000/svg';

class Hud {
  constructor(root) {
    this.root = root;
    this.shows = Array.from(root.querySelectorAll('[data-show]'));
    this.hides = Array.from(root.querySelectorAll('[data-hide]'));
    this.texts = Array.from(root.querySelectorAll('[data-text]'));
    this.heat = root.querySelector('#heat');
    this.heatFill = root.querySelector('#heat-fill');
    this.muteBtn = root.querySelector('#mute-btn');
    this.toastEl = root.querySelector('#toast');
    this.scoreRows = root.querySelector('#score-rows');
    this.stars = [];
    const starBox = root.querySelector('#stars');
    for (let i = 0; i < 3; i++) {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('stroke', '#4a3570');
      svg.setAttribute('stroke-width', '1.6');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', STAR_PATH);
      svg.appendChild(path);
      starBox.appendChild(svg);
      this.stars.push(svg);
    }
    this.prev = {};
  }

  render(v) {
    for (const el of this.shows) setVisible(el, !!v[el.dataset.show]);
    for (const el of this.hides) setVisible(el, !v[el.dataset.hide]);
    for (const el of this.texts) {
      const t = String(v[el.dataset.text] ?? '');
      if (el.textContent !== t) el.textContent = t;
    }

    // fire timer
    this.heat.setAttribute('aria-label', 'Fire time left: ' + v.heatSec + ' seconds');
    this.heatFill.style.width = v.heatPct + '%';
    this.heatFill.style.background = v.heatColor;

    this.muteBtn.setAttribute('aria-label', v.muted ? 'Turn sound on' : 'Turn sound off');
    this.stars.forEach((s, i) => s.classList.toggle('on', i < v.stars));

    // a new toast message replays its drop-in animation
    if (v.toast && v.toast !== this.prev.toast) restartAnimations(this.toastEl);

    if (v.card !== this.prev.card) this.renderScorecard(v.card);
    this.prev = v;
  }

  renderScorecard(card) {
    this.scoreRows.replaceChildren(...card.map((row) => {
      const el = document.createElement('div');
      el.className = 'score-row';
      const name = cell('name', row.n + '. ' + row.name);
      const par = cell('par', row.par);
      const flaps = cell('flaps', row.strokes);
      flaps.style.color = row.color;
      el.append(name, par, flaps);
      return el;
    }));
  }
}

function cell(cls, text) {
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = String(text);
  return d;
}

function setVisible(el, on) {
  // attribute (not el.hidden) so this works on <svg> elements too
  if (el.hasAttribute('hidden') === !on) return;
  el.toggleAttribute('hidden', !on);
  // replay CSS entrance animations (fade/pop/drop) each time it appears
  if (on) restartAnimations(el);
}

function restartAnimations(el) {
  if (!el.getAnimations) return;
  for (const a of el.getAnimations({ subtree: true })) {
    if (a instanceof CSSAnimation) { a.cancel(); a.play(); }
  }
}
