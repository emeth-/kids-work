// Flappy Unicorn Golf: game state, flow, input, audio, and physics.
//
// Rendering lives in draw.js (Game extends GameDrawing) and the DOM overlay in
// hud.js. `this.g` holds the per-frame simulation state; `this.state` holds
// the small bag of values the HUD shows. Call setState() to change those, and
// the HUD re-renders on the next microtask.
//
// g.mode, the simulation's state machine:
//   idle -> intro -> play <-> splash -> sinking -> holed -> (next hole) intro ...
//                                                       -> done (after last hole)
// state.phase, what the overlay shows: 'title' | 'play' | 'holed' | 'done'

class Game extends GameDrawing {
  constructor(root, canvas, onStateChange) {
    super();
    this.root = root;
    this.canvas = canvas;
    this.state = {};
    this._onStateChange = onStateChange || (() => {});
    this._renderQueued = false;
  }

  setState(patch) {
    Object.assign(this.state, patch);
    if (this._renderQueued) return;
    this._renderQueued = true;
    queueMicrotask(() => { this._renderQueued = false; this._onStateChange(this.hudState()); });
  }

  /** Everything the HUD overlay needs, derived from this.state. */
  hudState() {
    const s = this.state;
    const phase = s.phase || 'title';
    const holes = this.HOLES || this.buildHoles();
    const idx = s.hole || 0;
    const h = holes[idx] || holes[0];
    const res = s.result || null;
    const heatSec = s.heatSec == null ? 60 : s.heatSec;
    return {
      phase: phase,
      isTitle: phase === 'title',
      isPlay: phase === 'play',
      isHoled: phase === 'holed',
      isDone: phase === 'done',
      showHud: phase === 'play' || phase === 'holed',
      holeNum: idx + 1,
      holeCount: holes.length,
      holeName: h.name,
      par: h.par,
      coursePar: holes.reduce((a, x) => a + x.par, 0),
      strokes: s.strokes || 0,
      hasLava: h.ground.some((p) => p[2] === 'l') || h.obs.some((o) => o.kind === 'geyser'),
      holeTip: h.tip || '',
      heatSec: heatSec,
      heatPct: Math.round((heatSec / 60) * 100),
      heatColor: heatSec > 20 ? '#ff922b' : '#e03131',
      banner: !!s.banner,
      toast: s.toast || '',
      resultLabel: res ? res.label : '',
      stars: res ? res.stars : 0,
      nextLabel: idx >= holes.length - 1 ? 'See scorecard' : 'Next hole',
      card: s.card || [],
      total: s.total || 0,
      vsPar: s.vsPar || '',
      newBest: !!s.newBest,
      bestTotal: s.bestTotal || 0,
      muted: !!s.muted
    };
  }

  /* ---------- course ---------- */
  buildHoles() {
    // deep copy so runtime caches on obstacles never leak back into COURSE
    this.HOLES = JSON.parse(JSON.stringify(COURSE));
    return this.HOLES;
  }

  buildSegs(h) {
    const segs = [];
    const g = h.ground;
    for (let i = 0; i < g.length - 1; i++) segs.push({ ax: g[i][0], ay: g[i][1], bx: g[i + 1][0], by: g[i + 1][1], t: g[i][2] || 'g' });
    const seg = (a, b, t, o) => segs.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], t: t, o: o });
    for (const o of h.obs) {
      if (o.kind === 'island') {
        for (let i = 0; i < o.pts.length; i++) seg(o.pts[i], o.pts[(i + 1) % o.pts.length], 'g');
        continue;
      }
      // clouds and pinwheels move, so their edges are rebuilt every frame (dynSegs)
      if (o.kind === 'mushroom' || o.kind === 'geyser' || o.kind === 'pinwheel') o.gy = o.base != null ? o.base : this.groundAt(h, o.x);
      if (o.kind === 'mushroom') {
        o.cy = o.gy - o.hgt; o.sq = 0;
        const rx = o.w / 2, dome = [];
        for (let i = 0; i <= 10; i++) { const a = Math.PI + (Math.PI * i) / 10; dome.push([o.x + Math.cos(a) * rx, o.cy + Math.sin(a) * 24]); }
        for (let i = 0; i < dome.length - 1; i++) seg(dome[i], dome[i + 1], 'm', o);
        seg([o.x + rx, o.cy], [o.x - rx, o.cy], 'g');
        seg([o.x - 10, o.cy], [o.x - 10, o.gy], 'g');
        seg([o.x + 10, o.gy], [o.x + 10, o.cy], 'g');
      }
    }
    const cx = h.cup[0], cy = h.cup[1];
    const castle = [
      [[cx - 118, cy], [cx - 118, cy - 100], [cx - 104, cy - 140], [cx - 90, cy - 100], [cx - 90, cy - 160], [cx - 68, cy - 222], [cx - 46, cy - 160], [cx - 46, cy]],
      [[cx + 46, cy], [cx + 46, cy - 160], [cx + 68, cy - 222], [cx + 90, cy - 160], [cx + 90, cy - 100], [cx + 104, cy - 140], [cx + 118, cy - 100], [cx + 118, cy]]
    ];
    for (const pts of castle) {
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        segs.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], t: 'k' });
      }
    }
    this.segs = segs;
    let maxY = 0;
    for (const p of g) maxY = Math.max(maxY, p[1]);
    this.maxY = maxY + 40;
  }

  /* ---------- lifecycle ---------- */
  mount() {
    this.O = '#4a3570';
    this.R = 14;
    this.RAINBOW = ['#ff6b9a', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa'];
    this.buildHoles();
    this.timers = [];
    this.bestTotal = 0;
    try { this.bestTotal = parseInt(localStorage.getItem('flappy-unicorn-golf-best') || '0', 10) || 0; } catch (e) {}
    this.muted = false;
    try { this.muted = localStorage.getItem('flappy-unicorn-muted') === '1'; } catch (e) {}
    this.bg = { clouds: [], stars: [] };
    for (let i = 0; i < 9; i++) this.bg.clouds.push({ x: Math.random() * 2400, y: -260 + Math.random() * 380, s: 0.6 + Math.random() * 0.7 });
    for (let i = 0; i < 16; i++) this.bg.stars.push({ x: Math.random(), y: Math.random() * 0.45, r: 1.8 + Math.random() * 2.2, p: Math.random() * 6.28 });
    this.g = { t: 0, card: [], particles: [], hole: 0 };
    this.loadHole(0, true);
    this.g.mode = 'idle';
    this.setState({ phase: 'title', hole: 0, strokes: 0, muted: this.muted, bestTotal: this.bestTotal });
    this.resize();
    if (typeof ResizeObserver !== 'undefined' && this.root) {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.root);
    }
    this._onWinResize = () => this.resize();
    window.addEventListener('resize', this._onWinResize);
    this.last = performance.now();
    const loop = (now) => {
      this.raf = requestAnimationFrame(loop);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (!(dt > 0)) dt = 0;
      if (dt > 1 / 30) dt = 1 / 30;
      this.update(dt);
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }

  unmount() {
    cancelAnimationFrame(this.raf);
    if (this.ro) this.ro.disconnect();
    window.removeEventListener('resize', this._onWinResize);
    (this.timers || []).forEach((t) => clearTimeout(t));
    if (this.ac) { try { this.ac.close(); } catch (e) {} }
  }

  later(fn, ms) { this.timers.push(setTimeout(fn, ms)); }

  resize() {
    if (!this.root || !this.canvas || !this.O) return;
    const cw = Math.max(1, this.root.clientWidth || 800), ch = Math.max(1, this.root.clientHeight || 600);
    const s = Math.min(cw / 460, ch / 560);
    this.vs = s; this.viewW = cw / s; this.viewH = ch / s;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    this.k = (this.canvas.width / cw) * s;
    this.ctx = this.canvas.getContext('2d');
    this.skyGrad = null;
    if (this.g && this.g.ball) { this.snapCamera(); this.draw(); }
  }

  /* ---------- flow ---------- */
  loadHole(i, quiet) {
    const g = this.g, h = this.HOLES[i];
    g.hole = i;
    this.buildSegs(h);
    g.ball = { x: h.tee[0], y: h.tee[1] - this.R - 0.5, vx: 0, vy: 0, rest: true };
    g.safe = { x: g.ball.x, y: g.ball.y };
    g.facing = 1; g.strokes = 0; g.wing = 1.1; g.boost = 0; g.restT = 0; g.rot = 0;
    g.grounded = true; g.nx = 0; g.ny = -1; g.particles = [];
    g.heat = 60; g.heatShown = 60; g.burn = 0; g.inLava = false;
    g.mode = quiet ? 'idle' : 'intro';
    g.intro = quiet ? 0 : 1.9;
    g.cam = null;
    if (this.viewW) this.snapCamera();
    if (!quiet) {
      if (this.bannerTimer) clearTimeout(this.bannerTimer);
      this.setState({ phase: 'play', hole: i, strokes: 0, banner: true, toast: '', heatSec: 60 });
      this.bannerTimer = setTimeout(() => this.setState({ banner: false }), 3600);
      this.timers.push(this.bannerTimer);
    }
  }

  startRound() {
    this.ensureAudio();
    this.g.card = [];
    this.setState({ result: null, card: [], newBest: false });
    this.loadHole(0, false);
    this.focusRoot();
  }

  retryHole() {
    const g = this.g;
    if (g.mode === 'holed' || g.mode === 'sinking' || g.mode === 'done') return;
    this.loadHole(g.hole, false);
    g.intro = 0; g.mode = 'play';
    this.focusRoot();
  }

  nextHole() {
    const g = this.g;
    if (g.mode !== 'holed') return;
    if (g.hole < this.HOLES.length - 1) { this.loadHole(g.hole + 1, false); this.focusRoot(); return; }
    const total = g.card.reduce((a, c) => a + c.strokes, 0);
    const totalPar = this.HOLES.reduce((a, h) => a + h.par, 0);
    const d = total - totalPar;
    const newBest = !this.bestTotal || total < this.bestTotal;
    if (newBest) { this.bestTotal = total; try { localStorage.setItem('flappy-unicorn-golf-best', String(total)); } catch (e) {} }
    g.mode = 'done';
    g.crown = total <= totalPar;
    this.setState({
      phase: 'done', total: total, bestTotal: this.bestTotal, newBest: newBest,
      vsPar: d === 0 ? 'Even par' : (d < 0 ? (-d) + ' under par' : d + ' over par'),
      card: g.card.map((c, i) => ({ n: i + 1, name: this.HOLES[i].name, par: this.HOLES[i].par, strokes: c.strokes,
        color: c.strokes < this.HOLES[i].par ? '#2b8a3e' : (c.strokes > this.HOLES[i].par ? '#c92a2a' : '#4a3570') }))
    });
    this.focusRoot();
  }

  resultFor(strokes, par) {
    const d = strokes - par;
    let label;
    if (strokes === 1) label = 'Hole in one!';
    else if (d <= -3) label = 'Albatross!';
    else if (d === -2) label = 'Eagle!';
    else if (d === -1) label = 'Birdie!';
    else if (d === 0) label = 'Par';
    else if (d === 1) label = 'Bogey';
    else if (d === 2) label = 'Double bogey';
    else label = '+' + d;
    const stars = d < 0 ? 3 : d === 0 ? 2 : d <= 2 ? 1 : 0;
    return { label: label, stars: stars };
  }

  focusRoot() { if (this.root) { try { this.root.focus({ preventScroll: true }); } catch (e) {} } }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('flappy-unicorn-muted', this.muted ? '1' : '0'); } catch (e) {}
    this.setState({ muted: this.muted });
  }

  toastMsg(msg) {
    this.setState({ toast: '' });
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.later(() => this.setState({ toast: msg }), 16);
    this.toastTimer = setTimeout(() => this.setState({ toast: '' }), 2000);
    this.timers.push(this.toastTimer);
  }

  /* ---------- input ---------- */
  flap(dir) {
    const g = this.g, b = g.ball;
    if (g.mode !== 'play' && g.mode !== 'intro') return;
    this.ensureAudio();
    if (g.mode === 'intro') { g.mode = 'play'; g.intro = 0; }
    b.vy = -320;
    b.vx = Math.max(-380, Math.min(380, b.vx * 0.65 + dir * 210));
    b.rest = false;
    g.restT = 0; g.facing = dir; g.boost = 0.3; g.strokes++;
    this.sfx('flap');
    for (let i = 0; i < 6; i++) this.spawn(b.x - dir * 10, b.y + 6, -dir * (40 + Math.random() * 60), 30 + Math.random() * 80, '#ffffff', 0.45, 3);
    this.setState({ strokes: g.strokes });
  }

  onPointer(e) {
    if (e.target && e.target.closest && e.target.closest('button')) return;
    if (typeof e.button === 'number' && e.button > 0) return;
    if (e.cancelable) e.preventDefault();
    this.focusRoot();
    const g = this.g;
    const r = this.root.getBoundingClientRect();
    if (g.mode === 'play' || g.mode === 'intro') {
      this.flap(e.clientX < r.left + r.width / 2 ? -1 : 1);
    } else if ((g.mode === 'holed' || g.mode === 'done') && g.inn && this.vs) {
      const u = g.inn, L = this.innerLayout(this.viewW, this.viewH);
      const tx = (e.clientX - r.left) / this.vs, ty = (e.clientY - r.top) / this.vs;
      if (u.falling) return;
      u.controlled = true;
      if (ty >= L.floorY + 10) {
        u.target = tx;
        u.targetZ = Math.max(0, Math.min(1, (ty - L.backY) / (L.frontY - L.backY)));
      } else { u.target = tx; u.targetZ = null; this.innerFlap(); }
    }
  }

  innerFlap() {
    const u = this.g.inn; if (!u || u.falling) return;
    this.ensureAudio();
    u.controlled = true;
    u.vh = 430; u.boost = 0.3;
    this.sfx('flap');
  }

  onKey(e) {
    if (e.target && e.target.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
    const k = e.code || e.key;
    const g = this.g;
    if (!this.keys) this.keys = {};
    if (g.mode === 'holed' || g.mode === 'done') {
      if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD', 'ArrowUp', 'KeyW', 'ArrowDown', 'KeyS'].indexOf(k) >= 0) {
        e.preventDefault(); this.keys[k] = true;
        if (g.inn) { g.inn.controlled = true; g.inn.target = null; g.inn.targetZ = null; }
        return;
      }
      if (k === 'Space' || e.key === ' ') { e.preventDefault(); if (!e.repeat) this.innerFlap(); return; }
    }
    if (k === 'ArrowLeft' || k === 'KeyA') { e.preventDefault(); if (!e.repeat) this.flap(-1); }
    else if (k === 'ArrowRight' || k === 'KeyD') { e.preventDefault(); if (!e.repeat) this.flap(1); }
    else if (k === 'Space' || e.key === ' ' || k === 'ArrowUp' || k === 'KeyW') { e.preventDefault(); if (!e.repeat) this.flap(g.facing || 1); }
    else if (k === 'Enter') {
      e.preventDefault();
      if (g.mode === 'idle' || g.mode === 'done') this.startRound();
      else if (g.mode === 'holed') this.nextHole();
    }
    else if (k === 'KeyR') this.retryHole();
    else if (k === 'KeyM') this.toggleMute();
  }

  /* ---------- audio ---------- */
  ensureAudio() {
    if (!this.ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { try { this.ac = new AC(); } catch (e) { this.ac = null; } }
    }
    if (this.ac && this.ac.state === 'suspended') { try { this.ac.resume(); } catch (e) {} }
  }

  tone(f1, f2, dur, type, vol, delay) {
    const ac = this.ac; if (!ac) return;
    const t0 = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), gn = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t0);
    o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(gn); gn.connect(ac.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  sfx(name) {
    if (this.muted || !this.ac) return;
    try {
      if (name === 'flap') this.tone(480, 820, 0.09, 'sine', 0.12);
      else if (name === 'boing') this.tone(260, 820, 0.22, 'sine', 0.16);
      else if (name === 'splash') { this.tone(900, 120, 0.45, 'triangle', 0.1); this.tone(200, 60, 0.3, 'sine', 0.18); }
      else if (name === 'sizzle') { this.tone(1400, 300, 0.3, 'sawtooth', 0.04); this.tone(180, 90, 0.25, 'sine', 0.1); }
      else if (name === 'trap') { this.tone(700, 90, 0.7, 'sine', 0.16); [1320, 990, 660].forEach((f, i) => this.tone(f, f * 0.8, 0.14, 'triangle', 0.08, 0.25 + i * 0.1)); }
      else if (name === 'mushroom') { this.tone(200, 900, 0.25, 'sine', 0.18); this.tone(400, 1300, 0.15, 'triangle', 0.06); }
      else if (name === 'whack') { this.tone(320, 140, 0.1, 'square', 0.07); this.tone(900, 600, 0.06, 'triangle', 0.06); }
      else if (name === 'geyser') { this.tone(110, 420, 0.5, 'sawtooth', 0.035); this.tone(80, 55, 0.5, 'sine', 0.14); }
      else if (name === 'thud') this.tone(160, 70, 0.08, 'sine', 0.12);
      else if (name === 'sink') { [660, 880, 1100, 1320].forEach((f, i) => this.tone(f, f, 0.16, 'triangle', 0.11, i * 0.09)); }
    } catch (e) {}
  }

  /* ---------- simulation ---------- */
  spawn(x, y, vx, vy, c, life, r) {
    const ps = this.g.particles;
    if (ps.length > 260) ps.shift();
    ps.push({ x: x, y: y, vx: vx, vy: vy, c: c, life: life, max: life, r: r });
  }

  snapCamera() {
    const t = this.camTarget(this.g.ball.x, this.g.ball.y);
    this.g.cam = { x: t.x, y: t.y };
  }

  camTarget(px, py) {
    const h = this.HOLES[this.g.hole], vw = this.viewW, vh = this.viewH;
    let x = px - vw * 0.5 + (this.g.facing || 1) * vw * 0.08;
    if (vw >= h.w + 80) x = (h.w - vw) / 2;
    else x = Math.max(-40, Math.min(h.w - vw + 40, x));
    let y = py - vh * 0.55;
    y = Math.max(-760, Math.min(this.maxY + 90 - vh, y));
    return { x: x, y: y };
  }

  update(dt) {
    const g = this.g; if (!g || !g.ball || !this.viewW) return;
    g.t += dt;
    const b = g.ball, h = this.HOLES[g.hole], R = this.R;

    if (g.mode === 'play') g.inGeyser = false;
    if (g.mode === 'play' && b.rest && this.shouldWake(h, b, g.t)) { b.rest = false; g.restT = 0; }
    const dyn = g.mode === 'play' && !b.rest ? this.dynSegs(h, g.t) : [];
    if (g.mode === 'play' && !b.rest) {
      const N = 5, hs = dt / N;
      let grounded = false, gnx = 0, gny = -1, water = false, lava = false;
      for (let n = 0; n < N && !water; n++) {
        b.vy += 700 * hs;
        this.applyFields(h, b, hs, g.t);
        b.vx *= (1 - 0.12 * hs);
        b.x += b.vx * hs; b.y += b.vy * hs;
        if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * 0.4; }
        if (b.x > h.w - R) { b.x = h.w - R; b.vx = -Math.abs(b.vx) * 0.4; }
        if (b.y < -900) { b.y = -900; b.vy = Math.max(0, b.vy); }
        const all = dyn.length ? this.segs.concat(dyn) : this.segs;
        for (const s of all) {
          const ex = s.bx - s.ax, ey = s.by - s.ay;
          const l2 = ex * ex + ey * ey; if (!l2) continue;
          let t = ((b.x - s.ax) * ex + (b.y - s.ay) * ey) / l2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const qx = s.ax + t * ex, qy = s.ay + t * ey;
          const dx = b.x - qx, dy = b.y - qy, d2 = dx * dx + dy * dy;
          const RR = s.t === 'p' ? R + 5 : R;
          if (d2 >= RR * RR || d2 < 1e-6) continue;
          if (s.t === 'w') { water = true; break; }
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
          b.x += nx * (RR - d); b.y += ny * (RR - d);
          // moving surfaces (drifting clouds, spinning blades) push with their own velocity
          let svx = 0, svy = 0;
          if (s.sv) { svx = s.sv.vx; svy = s.sv.vy; }
          else if (s.t === 'p') { svx = -s.w * (qy - s.cy); svy = s.w * (qx - s.cx); }
          const vn = (b.vx - svx) * nx + (b.vy - svy) * ny;
          if (s.t === 'm') {
            if (vn < 0) {
              const out = Math.max(-vn * 1.05, 620);
              b.vx += (out - vn) * nx; b.vy += (out - vn) * ny;
              if (s.o) s.o.sq = 1;
              this.sfx('mushroom');
              for (let i = 0; i < 8; i++) this.spawn(b.x, b.y + 12, (Math.random() - 0.5) * 160, -Math.random() * 80, i % 2 ? '#ffffff' : '#ff8fb8', 0.6, 3.5);
            }
            continue;
          }
          if (s.t === 'p') {
            if (vn < 0) {
              const out = Math.max(-vn * 0.7, 260);
              b.vx += (out - vn) * nx; b.vy += (out - vn) * ny;
              this.sfx('whack');
              for (let i = 0; i < 5; i++) this.spawn(qx, qy, (Math.random() - 0.5) * 140, (Math.random() - 0.5) * 140, this.RAINBOW[i], 0.4, 3);
            }
            continue;
          }
          if (s.t === 'c') {
            if (vn < 0) {
              const out = Math.max(-vn * 0.9, 430);
              b.vx += (out - vn) * nx; b.vy += (out - vn) * ny;
              this.sfx('boing');
              for (let i = 0; i < 6; i++) this.spawn(b.x, b.y + 10, (Math.random() - 0.5) * 120, Math.random() * 60, '#ffd6ec', 0.5, 4);
            }
            continue;
          }
          if (s.t === 'l') lava = true;
          if (vn < 0) {
            const e = (s.t === 's' || s.t === 'l') ? 0.05 : (vn < -80 ? 0.35 : 0);
            if (vn < -220) this.sfx('thud');
            b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
          }
          const tx = -ny, ty = nx;
          const vt = b.vx * tx + b.vy * ty;
          const fr = s.t === 's' ? 14 : s.t === 'l' ? 10 : 1.9;
          const nvt = vt * Math.max(0, 1 - fr * hs);
          b.vx += (nvt - vt) * tx; b.vy += (nvt - vt) * ty;
          if (ny < -0.3) { grounded = true; if (ny < gny) { gnx = nx; gny = ny; } else if (gny === -1 && gnx === 0) { gnx = nx; gny = ny; } }
        }
      }
      g.grounded = grounded; if (grounded) { g.nx = gnx; g.ny = gny; }
      if (lava && !g.inLava) {
        this.sfx('sizzle');
        for (let i = 0; i < 12; i++) this.spawn(b.x, b.y + 8, (Math.random() - 0.5) * 160, -80 - Math.random() * 160, i % 2 ? '#ffd43b' : '#ff6b1a', 0.7, 4);
      }
      g.inLava = lava;
      if (g.inGeyser && !g.wasGeyser) {
        this.sfx('sizzle');
        for (let i = 0; i < 10; i++) this.spawn(b.x, b.y + 8, (Math.random() - 0.5) * 160, -80 - Math.random() * 160, i % 2 ? '#ffd43b' : '#ff6b1a', 0.7, 4);
      }
      g.wasGeyser = g.inGeyser;

      if (water) { this.splash(); }
      else if (b.x > h.cup[0] - 46 && b.x < h.cup[0] + 46 && b.y > h.cup[1] - 120) { this.sink(); }
      else {
        const sp = Math.hypot(b.vx, b.vy);
        if (grounded && sp < 16) g.restT += dt; else if (grounded && sp < 28) g.restT += dt * 0.3; else g.restT = 0;
        if (g.restT > 0.35) {
          b.rest = true; b.vx = 0; b.vy = 0; g.restT = 0;
          if (!g.inLava) g.safe = { x: b.x, y: b.y };
        }
      }
    } else if (g.mode === 'intro') {
      g.intro -= dt;
      if (g.intro <= 0) { g.mode = 'play'; }
    } else if (g.mode === 'splash') {
      g.splashT -= dt;
      if (g.splashT <= 0) {
        b.x = g.safe.x; b.y = g.safe.y; b.vx = 0; b.vy = 0; b.rest = true; g.inLava = false;
        g.mode = 'play';
      }
    } else if (g.mode === 'sinking') {
      g.sinkT -= dt;
      g.facing = 1;
      b.x += (h.cup[0] - b.x) * Math.min(1, dt * 6);
      b.y += (h.cup[1] - this.R - b.y) * Math.min(1, dt * 6);
      if (Math.random() < 0.6) this.spawn(h.cup[0] + (Math.random() - 0.5) * 80, h.cup[1] - 170, (Math.random() - 0.5) * 200, -150 - Math.random() * 200, this.RAINBOW[Math.floor(Math.random() * 6)], 1.1, 4.5);
      if (g.sinkT <= 0) {
        g.mode = 'holed';
        g.insideT = 0; g.confetti = [];
        g.inn = { x: null, z: 0.3, h: 0, vx: 0, vh: 0, facing: 1, target: null, wing: 1.15, boost: 0, walkT: 0, controlled: false };
        g.crown = g.strokes <= h.par;
        const res = this.resultFor(g.strokes, h.par);
        g.card[g.hole] = { strokes: g.strokes };
        this.setState({ phase: 'holed', result: res, strokes: g.strokes, banner: false, toast: '' });
      }
    }

    if (g.mode === 'holed' || g.mode === 'done') {
      g.insideT = (g.insideT || 0) + dt;
      this.updateInner(dt);
      const cf = g.confetti || (g.confetti = []);
      if (cf.length < 160 && Math.random() < 0.8) {
        cf.push({ x: Math.random() * this.viewW, y: -10, vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 80,
          r: Math.random() * 6, vr: (Math.random() - 0.5) * 8, c: this.RAINBOW[Math.floor(Math.random() * 6)], w: 5 + Math.random() * 4, h: 3 + Math.random() * 3 });
      }
      for (let i = cf.length - 1; i >= 0; i--) {
        const c = cf[i];
        c.x += (c.vx + Math.sin(g.t * 3 + i) * 20) * dt; c.y += c.vy * dt; c.r += c.vr * dt;
        if (c.y > this.viewH + 20) cf.splice(i, 1);
      }
    }

    // lava heat: a per-hole 60 s budget that only drains while in lava
    if (g.mode === 'play' && (g.inLava || g.inGeyser)) {
      g.burn = 1.5;
      g.heat -= dt;
      const sec = Math.max(0, Math.ceil(g.heat));
      if (sec !== g.heatShown) { g.heatShown = sec; this.setState({ heatSec: sec }); }
      if (g.heat <= 0) this.burnout();
    } else if (g.burn > 0) g.burn -= dt;
    if (g.burn > 0 && g.mode !== 'splash') {
      g.fireEmit = (g.fireEmit || 0) + dt;
      while (g.fireEmit > 0.04) {
        g.fireEmit -= 0.04;
        const c = Math.random() < 0.5 ? '#ffd43b' : (Math.random() < 0.5 ? '#ff922b' : '#f03e3e');
        this.spawn(b.x + (Math.random() - 0.5) * 22, b.y - 6, (Math.random() - 0.5) * 40, -120 - Math.random() * 80, c, 0.45, 3.5);
      }
    }

    // obstacle animation: mushroom wobble, geyser spray + rumble
    if (g.mode !== 'holed' && g.mode !== 'done') {
      for (const o of h.obs) {
        if (o.kind === 'mushroom' && o.sq > 0) o.sq = Math.max(0, o.sq - dt * 2.2);
        else if (o.kind === 'geyser' && o.gy != null) {
          const st = this.geyserState(o, g.t);
          if (st.on && Math.random() < 0.6) this.spawn(o.x + (Math.random() - 0.5) * 20, o.gy - 16 - st.height, (Math.random() - 0.5) * 160, -60 - Math.random() * 120, Math.random() < 0.5 ? '#ffd43b' : '#ff922b', 0.6, 3.5);
          if (st.on && !o.was && g.cam && Math.abs(o.x - (g.cam.x + this.viewW / 2)) < this.viewW * 0.7) this.sfx('geyser');
          o.was = st.on;
        }
      }
    }

    // wings + pose
    g.boost -= dt;
    if (g.boost > 0) g.wing += dt * 30;
    else if (g.mode === 'play' && !b.rest && !g.grounded) g.wing += dt * 9;
    else g.wing += (1.15 + Math.sin(g.t * 2) * 0.06 - (g.wing % (Math.PI * 2))) * Math.min(1, dt * 8);
    let target;
    if (b.rest || g.grounded) target = Math.atan2(g.nx, -g.ny) * g.facing;
    else target = Math.max(-0.4, Math.min(0.5, b.vy / 700));
    g.rot += (target - g.rot) * Math.min(1, dt * 10);

    // trail
    if (g.mode === 'play' && !b.rest && !g.grounded) {
      g.emit = (g.emit || 0) + dt;
      while (g.emit > 0.035) {
        g.emit -= 0.035;
        g.hue = ((g.hue || 0) + 1) % 6;
        this.spawn(b.x - g.facing * 18, b.y + (Math.random() - 0.5) * 8, -g.facing * 30 - b.vx * 0.2, (Math.random() - 0.5) * 30, this.RAINBOW[g.hue], 0.6, 3.2);
      }
    }
    const ps = g.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps.splice(i, 1); continue; }
      p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }

    // camera
    if (!g.cam) this.snapCamera();
    let tgt;
    if (g.mode === 'intro') {
      const k = Math.max(0, Math.min(1, (1.9 - g.intro) / 1.5));
      const e = k * k * (3 - 2 * k);
      const a = this.camTarget(h.cup[0], h.cup[1]), z = this.camTarget(b.x, b.y);
      tgt = { x: a.x + (z.x - a.x) * e, y: a.y + (z.y - a.y) * e };
      g.cam.x = tgt.x; g.cam.y = tgt.y;
    } else {
      tgt = this.camTarget(b.x, b.y);
      const f = Math.min(1, dt * 4);
      g.cam.x += (tgt.x - g.cam.x) * f; g.cam.y += (tgt.y - g.cam.y) * f;
    }
  }

  innerLayout(vw, vh) {
    const vs = this.vs || 1;
    const land = vw > vh * 1.05;
    let sceneW = vw, floorY;
    let frontY;
    if (land) { sceneW = Math.max(vw * 0.55, vw - 340 / vs); floorY = vh * 0.56; frontY = vh - 30; }
    else {
      floorY = Math.max(vh * 0.35, Math.min(vh * 0.55, vh - 330 / vs - 170));
      frontY = Math.max(floorY + 110, vh - 330 / vs - 14);
    }
    const backY = floorY + 40;
    return { mid: sceneW / 2, sceneW: sceneW, floorY: floorY, land: land, backY: backY, frontY: frontY,
      groundY: (z) => backY + (frontY - backY) * z, scale: (z) => 1.5 + z * 0.8, trapZ: 0.84 };
  }

  updateInner(dt) {
    const g = this.g, u = g.inn;
    if (!u || !this.viewW) return;
    const L = this.innerLayout(this.viewW, this.viewH);
    if (u.x == null) u.x = L.mid + Math.min(160, L.sceneW * 0.3);
    if (u.z == null) u.z = 0.3;
    if (u.falling) {
      // dropping through the secret trap door
      u.fallT += dt;
      u.x += (L.mid - u.x) * Math.min(1, dt * 12);
      u.z += (L.trapZ - u.z) * Math.min(1, dt * 12);
      u.vx = 0; u.h = 0;
      u.wing += dt * 30;
      if (u.fallT > 1.0 && !u.advanced) {
        u.advanced = true;
        if (g.mode === 'holed') this.nextHole(); else if (g.mode === 'done') this.startRound();
      }
      return;
    }
    const keys = this.keys || {};
    let dir = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    let dz = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
    if (dir || dz) { u.target = null; u.targetZ = null; }
    else {
      if (u.target != null) {
        const d = u.target - u.x;
        if (Math.abs(d) < 8) u.target = null; else dir = d > 0 ? 1 : -1;
      }
      if (u.targetZ != null) {
        const d = u.targetZ - u.z;
        if (Math.abs(d) < 0.03) u.targetZ = null; else dz = d > 0 ? 1 : -1;
      }
    }
    u.vx += (dir * 210 - u.vx) * Math.min(1, dt * 10);
    u.vz = (u.vz || 0) + (dz * 1.1 - (u.vz || 0)) * Math.min(1, dt * 10);
    if (dir) u.facing = dir;
    u.x = Math.max(60, Math.min(this.viewW - 60, u.x + u.vx * dt));
    u.z = Math.max(0, Math.min(1, u.z + u.vz * dt));
    u.vh -= 1100 * dt;
    u.h += u.vh * dt;
    const ceil = Math.max(40, L.floorY - 90);
    if (u.h > ceil) { u.h = ceil; u.vh = Math.min(0, u.vh); }
    if (u.h <= 0) { u.h = 0; u.vh = 0; }
    u.boost -= dt;
    if (u.boost > 0) u.wing += dt * 30;
    else if (u.h > 0) u.wing += dt * 10;
    else u.wing += (1.15 - (u.wing % (Math.PI * 2))) * Math.min(1, dt * 8);
    u.walkT += dt * (Math.abs(u.vx) / 30 + Math.abs(u.vz) * 7);
    if (u.h === 0 && Math.abs(u.x - L.mid) < 34 && Math.abs(u.z - L.trapZ) < 0.09) {
      u.falling = true; u.fallT = 0; u.advanced = false;
      u.target = null; u.targetZ = null;
      this.keys = {};
      this.sfx('trap');
    }
  }

  splash() {
    const g = this.g, b = g.ball;
    g.mode = 'splash'; g.splashT = 0.9;
    g.strokes++;
    this.sfx('splash');
    for (let i = 0; i < 24; i++) this.spawn(b.x, b.y, (Math.random() - 0.5) * 220, -150 - Math.random() * 250, i % 2 ? '#4dabf7' : '#d0ebff', 0.9, 4);
    this.setState({ strokes: g.strokes });
    this.toastMsg('Splash! +1 penalty flap');
  }

  burnout() {
    const g = this.g, b = g.ball;
    g.mode = 'splash'; g.splashT = 0.9;
    g.strokes++;
    g.heat = 60; g.heatShown = 60; g.burn = 0; g.inLava = false;
    this.sfx('sizzle');
    for (let i = 0; i < 28; i++) this.spawn(b.x, b.y, (Math.random() - 0.5) * 240, -150 - Math.random() * 260, i % 3 ? '#ff922b' : '#495057', 1, 4.5);
    this.setState({ strokes: g.strokes, heatSec: 60 });
    this.toastMsg('Burnt out! +1 penalty flap');
  }

  sink() {
    const g = this.g;
    g.mode = 'sinking'; g.sinkT = 1.3;
    g.ball.vx = 0; g.ball.vy = 0;
    this.sfx('sink');
  }

  /* ---------- course gadgets: mushrooms, pinwheels, geysers, wind, drifting clouds ---------- */
  groundAt(h, x) {
    const g = h.ground;
    for (let i = 0; i < g.length - 1; i++) {
      const a = g[i], b = g[i + 1];
      if (b[0] > a[0] && x >= a[0] && x <= b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
    }
    return g[g.length - 1][1];
  }

  cloudPos(o, t) {
    const w = o.spd || 0.8, ph = t * w + (o.ph || 0);
    const s = Math.sin(ph), c = Math.cos(ph);
    return { x: o.x + (o.dx || 0) * s, y: o.y + (o.dy || 0) * s, vx: (o.dx || 0) * c * w, vy: (o.dy || 0) * c * w };
  }

  geyserState(o, t) {
    const P = o.period || 3.4, E = 1.3, W = 0.8;
    const ph = ((t + (o.off || 0)) % P + P) % P;
    if (ph > P - E) {
      const k = ph - (P - E);
      const up = Math.min(1, k / 0.2), down = k > E - 0.3 ? Math.max(0, (E - k) / 0.3) : 1;
      return { on: true, warn: false, height: (o.h || 220) * up * down };
    }
    return { on: false, warn: ph > P - E - W, height: 0 };
  }

  dynSegs(h, t) {
    const out = [];
    for (const o of h.obs) {
      if (o.kind === 'cloud') {
        const p = this.cloudPos(o, t), sv = { vx: p.vx, vy: p.vy };
        const pts = [[p.x, p.y], [p.x + o.w, p.y], [p.x + o.w, p.y + o.h], [p.x, p.y + o.h]];
        for (let i = 0; i < 4; i++) { const a = pts[i], c = pts[(i + 1) % 4]; out.push({ ax: a[0], ay: a[1], bx: c[0], by: c[1], t: 'c', sv: sv }); }
      } else if (o.kind === 'pinwheel') {
        const n = o.n || 4;
        for (let i = 0; i < n; i++) {
          const a = t * o.spd + (i * Math.PI * 2) / n;
          out.push({ ax: o.x, ay: o.y, bx: o.x + Math.cos(a) * o.r, by: o.y + Math.sin(a) * o.r, t: 'p', cx: o.x, cy: o.y, w: o.spd });
        }
      }
    }
    return out;
  }

  inGeyserColumn(o, b, t) {
    const st = this.geyserState(o, t), R = this.R;
    return st.on && Math.abs(b.x - o.x) < 16 + R * 0.6 && b.y > o.gy - 16 - st.height - R && b.y < o.gy + 6;
  }

  applyFields(h, b, hs, t) {
    for (const o of h.obs) {
      if (o.kind === 'wind') {
        if (b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) {
          const k = 0.65 + 0.35 * Math.sin(t * 1.7 + o.x * 0.01);
          b.vx += (o.fx || 0) * k * hs;
          if (o.fy && !(o.fy < 0 && b.vy < -380)) b.vy += o.fy * k * hs;
        }
      } else if (o.kind === 'geyser' && this.inGeyserColumn(o, b, t)) {
        b.vy = Math.min(b.vy, -600);
        this.g.inGeyser = true;
      }
    }
  }

  shouldWake(h, b, t) {
    const R = this.R;
    for (const o of h.obs) {
      if (o.kind === 'wind' && b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) return true;
      if (o.kind === 'geyser' && this.inGeyserColumn(o, b, t)) return true;
    }
    for (const s of this.dynSegs(h, t)) {
      const ex = s.bx - s.ax, ey = s.by - s.ay, l2 = ex * ex + ey * ey;
      if (!l2) continue;
      let k = ((b.x - s.ax) * ex + (b.y - s.ay) * ey) / l2; k = k < 0 ? 0 : k > 1 ? 1 : k;
      if (Math.hypot(b.x - s.ax - k * ex, b.y - s.ay - k * ey) < R + 8) return true;
    }
    return false;
  }
}
