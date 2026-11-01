// Flappy Unicorn Golf: all canvas drawing.
//
// Game (game.js) extends this class, so these methods read the same `this.g`,
// `this.HOLES`, `this.O` (outline color), `this.RAINBOW`, etc. that the game
// sets up in mount(). Nothing in here changes the simulation; draw() is called
// once per frame after update().

class GameDrawing {
  /* ---------- drawing ---------- */
  star(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
  }

  draw() {
    const ctx = this.ctx, g = this.g;
    if (!ctx || !g || !g.cam) return;
    const vw = this.viewW, vh = this.viewH, h = this.HOLES[g.hole];
    const cx = g.cam.x, cy = g.cam.y;
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    if (g.mode === 'holed' || g.mode === 'done') {
      this.drawInterior(ctx, vw, vh, g);
      const k = Math.min(1, g.insideT / 0.6);
      if (k < 1) this.iris(ctx, vw, vh, vw / 2, vh * 0.45, k * Math.hypot(vw, vh));
      return;
    }

    // sky
    if (!this.skyGrad) {
      const sg = ctx.createLinearGradient(0, 0, 0, vh);
      sg.addColorStop(0, '#6ec6ff'); sg.addColorStop(0.6, '#c3b1ff'); sg.addColorStop(1, '#ffc9e6');
      this.skyGrad = sg;
    }
    ctx.fillStyle = this.skyGrad;
    ctx.fillRect(0, 0, vw, vh);
    const sunX = vw * 0.8 - cx * 0.03, sunY = vh * 0.18 - cy * 0.05;
    ctx.fillStyle = 'rgba(255,245,200,0.35)'; ctx.beginPath(); ctx.arc(sunX, sunY, 70, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff4c7'; ctx.beginPath(); ctx.arc(sunX, sunY, 44, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (const s of this.bg.stars) {
      ctx.globalAlpha = 0.2 + 0.7 * Math.abs(Math.sin(g.t * 1.5 + s.p));
      this.star(ctx, s.x * vw, s.y * vh - cy * 0.05, s.r);
    }
    ctx.globalAlpha = 1;
    // rainbow arc (slow parallax, feet tucked behind the hills)
    this.rainbow(ctx, vw * 0.55 - cx * 0.08, 380 - cy * 0.3, Math.min(340, Math.max(220, vw * 0.36)), g.t);
    // parallax hills
    this.hills(ctx, vw, vh, 330 - cy * 0.35, 40, 0.008, cx * 0.25, '#b197fc');
    this.hills(ctx, vw, vh, 380 - cy * 0.6, 30, 0.014, cx * 0.5 + 400, '#f3a6d4');
    // parallax clouds
    for (const c of this.bg.clouds) {
      const span = 2600;
      const x = ((c.x - cx * 0.3 + g.t * 6) % span + span) % span - 200;
      if (x > vw + 50) continue;
      this.cloud(ctx, x, c.y - cy * 0.3, c.s, 'rgba(255,255,255,0.9)');
    }

    // world
    ctx.save();
    ctx.translate(-cx, -cy);
    this.drawWater(ctx, h);
    this.drawLand(ctx, h.ground, false);
    for (const o of h.obs) if (o.kind === 'wind') this.drawWind(ctx, o, g.t);
    for (const o of h.obs) {
      if (o.kind === 'island') this.drawLand(ctx, o.pts, true);
      else if (o.kind === 'cloud') { const p = this.cloudPos(o, g.t); this.cloudPlatform(ctx, { x: p.x, y: p.y, w: o.w, h: o.h }, g.t); }
      else if (o.kind === 'mushroom') this.drawMushroom(ctx, o, g.t);
      else if (o.kind === 'pinwheel') this.drawPinwheel(ctx, o, g.t);
      else if (o.kind === 'geyser') this.drawGeyser(ctx, o, g.t);
    }
    // tee
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = this.O; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect(h.tee[0] - 26, h.tee[1] - 4, 6, 10); ctx.rect(h.tee[0] + 20, h.tee[1] - 4, 6, 10); ctx.fill(); ctx.stroke();
    this.drawCastleBack(ctx, h.cup[0], h.cup[1], g.t, g.mode === 'play' || g.mode === 'intro');
    for (const p of g.particles) {
      const a = p.life / p.max;
      ctx.globalAlpha = Math.min(1, a * 1.4);
      ctx.fillStyle = p.c;
      this.star(ctx, p.x, p.y, p.r * (0.4 + 0.6 * a) + 0.5);
    }
    ctx.globalAlpha = 1;
    if (g.mode !== 'splash') {
      if (g.mode === 'sinking') ctx.globalAlpha = Math.max(0, Math.min(1, (g.sinkT - 0.2) / 0.6));
      this.drawUnicorn(ctx, g.ball.x, g.ball.y, g.rot, g.facing, g.wing, g.t);
      if (g.burn > 0) this.drawFlames(ctx, g.ball.x, g.ball.y, g.burn, g.t);
      ctx.globalAlpha = 1;
    }
    this.drawCastleFront(ctx, h.cup[0], h.cup[1], g.t);
    ctx.restore();
    if (g.mode === 'sinking' && g.sinkT < 0.5) {
      this.iris(ctx, vw, vh, h.cup[0] - cx, h.cup[1] - 40 - cy, Math.max(0, g.sinkT / 0.5) * Math.hypot(vw, vh));
    }

    // off-screen flag pointer
    if (g.mode === 'play' || g.mode === 'splash') this.flagPointer(ctx, h, cx, cy, vw, vh);
  }


  drawWind(ctx, o, t) {
    const len = Math.hypot(o.fx || 0, o.fy || 0) || 1, dx = (o.fx || 0) / len, dy = (o.fy || 0) / len;
    const k = 0.65 + 0.35 * Math.sin(t * 1.7 + o.x * 0.01);
    ctx.save();
    ctx.beginPath(); ctx.rect(o.x, o.y, o.w, o.h); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,' + (0.06 + 0.06 * k).toFixed(3) + ')';
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.lineCap = 'round';
    for (let i = 0; i < 22; i++) {
      const bx = (i * 53.7) % o.w, by = (i * 97.3) % o.h;
      const off = (t * 220 * k + i * 41) % 400;
      const px = o.x + (((bx + dx * off) % o.w) + o.w) % o.w;
      const py = o.y + (((by + dy * off) % o.h) + o.h) % o.h;
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = i % 3 ? 2 : 3;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - dx * 22 + dy * 3, py - dy * 22 - dx * 3); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
    const cxm = o.x + o.w / 2, cym = o.y + o.h / 2;
    for (let j = -1; j <= 1; j++) {
      const sh = ((t * 60) % 40) + j * 40;
      const px = cxm + dx * sh, py = cym + dy * sh;
      ctx.beginPath();
      ctx.moveTo(px - dx * 12 - dy * 14, py - dy * 12 + dx * 14);
      ctx.lineTo(px, py);
      ctx.lineTo(px - dx * 12 + dy * 14, py - dy * 12 - dx * 14);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawMushroom(ctx, o, t) {
    const O = this.O, x = o.x, gy = o.gy, cy = o.cy, rx = o.w / 2, sq = Math.max(0, o.sq || 0);
    const wob = sq * Math.cos(sq * 14);
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.fillStyle = '#fff4e6'; ctx.strokeStyle = O; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x - 10, cy); ctx.quadraticCurveTo(x - 13, gy - 4, x - 12, gy); ctx.lineTo(x + 12, gy); ctx.quadraticCurveTo(x + 13, gy - 4, x + 10, cy); ctx.closePath(); ctx.fill(); ctx.stroke();
    const fy = (cy + gy) / 2 + 2;
    ctx.fillStyle = O;
    ctx.beginPath(); ctx.arc(x - 4, fy - 2, 1.6, 0, Math.PI * 2); ctx.arc(x + 4, fy - 2, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, fy + 1, 3, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.translate(x, cy);
    ctx.scale(1 + 0.18 * wob, 1 - 0.3 * wob);
    ctx.fillStyle = '#ffd6e8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.82, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const cg = ctx.createLinearGradient(0, -24, 0, 0);
    cg.addColorStop(0, '#ff8fb8'); cg.addColorStop(1, '#f03e7a');
    ctx.fillStyle = cg; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, 24, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (const sp of [[-0.5, -0.45, 5], [0.05, -0.75, 6], [0.55, -0.4, 4.5], [-0.15, -0.25, 3.5]]) { ctx.beginPath(); ctx.arc(sp[0] * rx, sp[1] * 24, sp[2], 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  drawPinwheel(ctx, o, t) {
    const O = this.O, n = o.n || 4, cols = ['#ff6b9a', '#ffe066', '#4dabf7', '#69db7c', '#9775fa', '#ffa94d'];
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (o.gy > o.y) {
      ctx.strokeStyle = O; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x, o.gy); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x, o.gy); ctx.stroke();
      ctx.strokeStyle = '#ff8cc6'; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.moveTo(o.x, o.y + 8); ctx.lineTo(o.x, o.gy); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.translate(o.x, o.y);
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.rotate(t * o.spd + (i * Math.PI * 2) / n);
      const r = o.r;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(r * 0.45, -20, r, -9);
      ctx.quadraticCurveTo(r + 4, 0, r, 5);
      ctx.quadraticCurveTo(r * 0.55, 9, 0, 0);
      ctx.fillStyle = cols[i % cols.length]; ctx.fill();
      ctx.strokeStyle = O; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.moveTo(4, -2); ctx.quadraticCurveTo(r * 0.45, -14, r * 0.85, -7); ctx.quadraticCurveTo(r * 0.45, -8, 4, -2); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#ffd43b'; ctx.strokeStyle = O; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; this.star(ctx, 0, 0, 4);
    ctx.restore();
  }

  drawGeyser(ctx, o, t) {
    const O = this.O, x = o.x, gy = o.gy, st = this.geyserState(o, t), top = gy - 16;
    ctx.save(); ctx.lineJoin = 'round';
    if (st.on && st.height > 2) {
      const H = st.height, w0 = 13;
      const glow = ctx.createRadialGradient(x, top - H * 0.5, 4, x, top - H * 0.5, H * 0.6 + 30);
      glow.addColorStop(0, 'rgba(255,146,43,0.28)'); glow.addColorStop(1, 'rgba(255,146,43,0)');
      ctx.fillStyle = glow; ctx.fillRect(x - H * 0.6 - 30, top - H - 40, H * 1.2 + 60, H + 60);
      const lg = ctx.createLinearGradient(x - w0 - 6, 0, x + w0 + 6, 0);
      lg.addColorStop(0, '#e03131'); lg.addColorStop(0.3, '#ff922b'); lg.addColorStop(0.5, '#ffe066'); lg.addColorStop(0.7, '#ff922b'); lg.addColorStop(1, '#e03131');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(x - w0, top);
      for (let yy = 0; yy <= H; yy += 8) ctx.lineTo(x - w0 - Math.sin(yy * 0.08 - t * 18) * 3 - yy * 0.02, top - yy);
      for (let yy = Math.floor(H / 8) * 8; yy >= 0; yy -= 8) ctx.lineTo(x + w0 + Math.sin(yy * 0.08 - t * 18 + 1) * 3 + yy * 0.02, top - yy);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.stroke();
      const r = 14 + Math.sin(t * 20) * 2 + H * 0.02;
      ctx.fillStyle = '#ffd43b';
      ctx.beginPath(); ctx.arc(x - 8, top - H, r * 0.7, 0, Math.PI * 2); ctx.arc(x + 8, top - H + 2, r * 0.75, 0, Math.PI * 2); ctx.arc(x, top - H - 6, r * 0.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#7a6a96'; ctx.strokeStyle = O; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x - 24, gy + 2); ctx.quadraticCurveTo(x - 16, gy - 12, x - 8, top); ctx.lineTo(x + 8, top); ctx.quadraticCurveTo(x + 16, gy - 12, x + 24, gy + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.moveTo(x - 18, gy); ctx.quadraticCurveTo(x - 12, gy - 10, x - 7, top + 2); ctx.lineTo(x - 3, top + 2); ctx.quadraticCurveTo(x - 8, gy - 8, x - 12, gy); ctx.closePath(); ctx.fill();
    const hot = st.on ? 1 : st.warn ? 0.6 + 0.4 * Math.sin(t * 30) : 0.35;
    ctx.fillStyle = 'rgba(255,146,43,' + hot.toFixed(2) + ')';
    ctx.beginPath(); ctx.ellipse(x, top, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    if (st.warn) {
      ctx.fillStyle = '#ffa94d';
      for (let i = 0; i < 3; i++) { const ph = (t * 3 + i / 3) % 1; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.arc(x + (i - 1) * 5, top - ph * 18, 3 - ph * 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  rainbow(ctx, x, y, r, t) {
    const bands = ['#ff6b6b', '#ffa94d', '#ffe066', '#8ce99a', '#74c0fc', '#9775fa', '#e599f7'];
    const bw = 13;
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, r + 16, Math.PI, 0); ctx.arc(x, y, r - bands.length * bw - 16, 0, Math.PI, true); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.62 + Math.sin(t * 0.8) * 0.06;
    ctx.lineWidth = bw + 0.8;
    for (let i = 0; i < bands.length; i++) {
      ctx.strokeStyle = bands[i];
      ctx.beginPath(); ctx.arc(x, y, r - i * bw, Math.PI, 0); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + (i + 0.5) / 5 * Math.PI;
      const tw = Math.abs(Math.sin(t * 2 + i * 1.7));
      ctx.globalAlpha = 0.3 + 0.7 * tw;
      this.star(ctx, x + Math.cos(a) * (r + 22), y + Math.sin(a) * (r + 22), 3 + tw * 3);
    }
    ctx.restore();
  }

  hills(ctx, vw, vh, base, amp, freq, off, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, vh);
    for (let x = 0; x <= vw + 10; x += 10) {
      ctx.lineTo(x, base - amp * (0.6 * Math.sin((x + off) * freq) + 0.4 * Math.sin((x + off) * freq * 2.3 + 1)));
    }
    ctx.lineTo(vw, vh);
    ctx.closePath();
    ctx.fill();
  }

  cloud(ctx, x, y, s, fill) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(0, 8, 20, 0, Math.PI * 2);
    ctx.arc(24, -4, 26, 0, Math.PI * 2);
    ctx.arc(50, 4, 22, 0, Math.PI * 2);
    ctx.arc(70, 12, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(0, 8, 70, 18);
    ctx.restore();
  }

  drawWater(ctx, h) {
    const gr = h.ground;
    for (let i = 0; i < gr.length - 1; i++) {
      if (gr[i][2] === 'l') { this.drawLava(ctx, gr[i][0], gr[i + 1][0], gr[i][1]); continue; }
      if (gr[i][2] !== 'w') continue;
      const x1 = gr[i][0], x2 = gr[i + 1][0], y = gr[i][1], lvl = y - 22;
      ctx.fillStyle = '#5ec8f2';
      ctx.fillRect(x1 - 90, lvl, x2 - x1 + 180, y - lvl + 6);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = x1 - 90; x <= x2 + 90; x += 6) {
        const yy = lvl + Math.sin(x * 0.06 + this.g.t * 3) * 2;
        if (x === x1 - 90) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }

  drawLava(ctx, x1, x2, y) {
    const t = this.g.t, lvl = y - 16;
    const glow = ctx.createLinearGradient(0, lvl - 90, 0, lvl);
    glow.addColorStop(0, 'rgba(255,146,43,0)'); glow.addColorStop(1, 'rgba(255,146,43,0.35)');
    ctx.fillStyle = glow;
    ctx.fillRect(x1 - 20, lvl - 90, x2 - x1 + 40, 90);
    const lg = ctx.createLinearGradient(0, lvl, 0, y + 6);
    lg.addColorStop(0, '#ffb020'); lg.addColorStop(0.5, '#ff6b1a'); lg.addColorStop(1, '#e03131');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(x1 - 90, y + 6);
    for (let x = x1 - 90; x <= x2 + 90; x += 6) ctx.lineTo(x, lvl + Math.sin(x * 0.045 + t * 2) * 2.5);
    ctx.lineTo(x2 + 90, y + 6);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = x1 - 90; x <= x2 + 90; x += 6) {
      const yy = lvl + Math.sin(x * 0.045 + t * 2) * 2.5;
      if (x === x1 - 90) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
    // bubbles
    for (let i = 0; i < 7; i++) {
      const bx = x1 + ((i * 97 + 40) % Math.max(1, x2 - x1));
      const ph = (t * 0.7 + i * 0.37) % 1;
      const r = 2 + ph * 6;
      ctx.globalAlpha = 1 - ph;
      ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, lvl + 4 - ph * 6, r, Math.PI, 0); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawFlames(ctx, x, y, a, t) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, a);
    const cols = [['#f03e3e', 1.0], ['#ff922b', 0.72], ['#ffe066', 0.42]];
    for (const c of cols) {
      ctx.fillStyle = c[0];
      for (let i = 0; i < 4; i++) {
        const fx = x + (i - 1.5) * 8;
        const hgt = (20 + Math.sin(t * 18 + i * 1.9) * 5 + (i === 1 || i === 2 ? 6 : 0)) * c[1];
        const w = 7 * c[1] + 2;
        const base = y - 2;
        ctx.beginPath();
        ctx.moveTo(fx - w, base);
        ctx.quadraticCurveTo(fx - w, base - hgt * 0.55, fx + Math.sin(t * 12 + i) * 2, base - hgt);
        ctx.quadraticCurveTo(fx + w, base - hgt * 0.55, fx + w, base);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }

  drawLand(ctx, pts, closed) {
    const O = this.O;
    const bottom = this.maxY + 3000;
    ctx.beginPath();
    if (closed) { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
    else {
      ctx.moveTo(pts[0][0] - 400, bottom);
      ctx.lineTo(pts[0][0] - 400, pts[0][1]);
      for (const p of pts) ctx.lineTo(p[0], p[1]);
      const l = pts[pts.length - 1];
      ctx.lineTo(l[0] + 400, l[1]);
      ctx.lineTo(l[0] + 400, bottom);
      ctx.closePath();
    }
    ctx.fillStyle = '#f2c7a0';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(214,150,120,0.35)';
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      ctx.beginPath(); ctx.arc(p[0] + 30, p[1] + 60, 7, 0, Math.PI * 2); ctx.arc(p[0] - 40, p[1] + 110, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = '#74d68d'; ctx.lineWidth = 28;
    ctx.beginPath();
    const ext = closed ? pts.concat([pts[0]]) : [[pts[0][0] - 400, pts[0][1]]].concat(pts, [[pts[pts.length - 1][0] + 400, pts[pts.length - 1][1]]]);
    ctx.moveTo(ext[0][0], ext[0][1]);
    for (let i = 1; i < ext.length; i++) ctx.lineTo(ext[i][0], ext[i][1]);
    ctx.stroke();
    ctx.strokeStyle = '#a9ecba'; ctx.lineWidth = 8;
    ctx.stroke();
    ctx.lineCap = 'butt';
    for (let i = 0; i < pts.length - 1; i++) {
      if (pts[i][2] !== 's') continue;
      ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 34;
      ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
      ctx.fillStyle = '#f5c95c';
      for (let x = pts[i][0] + 12; x < pts[i + 1][0]; x += 26) { ctx.beginPath(); ctx.arc(x, pts[i][1] + 6 + (x % 3) * 2, 2, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
    ctx.strokeStyle = O; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < ext.length - 1; i++) {
      const a = ext[i], b = ext[i + 1];
      if (a[2] === 'w' || a[2] === 'l') continue;
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
  }

  cloudPlatform(ctx, o, t) {
    const O = this.O;
    ctx.save();
    const bob = Math.sin(t * 2) * 1.5;
    ctx.translate(0, bob);
    ctx.fillStyle = '#ffd6ec'; ctx.strokeStyle = O; ctx.lineWidth = 3;
    ctx.beginPath();
    const n = Math.max(3, Math.round(o.w / 30));
    for (let i = 0; i < n; i++) {
      const x = o.x + (i + 0.5) * (o.w / n);
      ctx.moveTo(x + o.h * 0.75, o.y + o.h * 0.45);
      ctx.arc(x, o.y + o.h * 0.45, o.h * 0.75, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = '#fff0f8';
    for (let i = 0; i < n; i++) {
      const x = o.x + (i + 0.5) * (o.w / n) - 4;
      ctx.beginPath(); ctx.arc(x, o.y + o.h * 0.25, o.h * 0.35, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    this.star(ctx, o.x + o.w * 0.3, o.y - 12 + Math.sin(t * 4) * 3, 4);
    this.star(ctx, o.x + o.w * 0.75, o.y - 18 + Math.cos(t * 4) * 3, 3);
    ctx.restore();
  }

  iris(ctx, vw, vh, x, y, r) {
    ctx.save();
    ctx.fillStyle = '#2b2146';
    ctx.beginPath();
    ctx.rect(-10, -10, vw + 20, vh + 20);
    ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    ctx.restore();
  }

  bricks(ctx, x, y, w, h) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = 'rgba(74,53,112,0.16)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    let row = 0;
    for (let yy = y + 16; yy < y + h; yy += 16, row++) {
      ctx.moveTo(x, yy); ctx.lineTo(x + w, yy);
      for (let xx = x + (row % 2 ? 10 : 22); xx < x + w; xx += 24) { ctx.moveTo(xx, yy - 16); ctx.lineTo(xx, yy); }
    }
    ctx.stroke();
    ctx.restore();
  }

  drawCastleBack(ctx, x, y, t, showArrow) {
    const O = this.O;
    // courtyard seen through the open top: inner wall, glowing doorway, carpet
    ctx.fillStyle = '#d8c6f2';
    ctx.fillRect(x - 46, y - 128, 92, 128);
    this.bricks(ctx, x - 46, y - 128, 92, 128);
    for (const mx of [x - 40, x - 18, x + 4, x + 26]) { ctx.fillStyle = '#d8c6f2'; ctx.fillRect(mx, y - 138, 14, 10); }
    const rg = ctx.createRadialGradient(x, y - 20, 4, x, y - 20, 90);
    rg.addColorStop(0, 'rgba(255,212,59,0.75)'); rg.addColorStop(1, 'rgba(255,212,59,0)');
    ctx.fillStyle = rg; ctx.fillRect(x - 46, y - 138, 92, 138);
    this.archWindow(ctx, x, y - 64, 36, 64, '#ffe066');
    ctx.fillStyle = '#ff5fa2'; ctx.fillRect(x - 46, y - 7, 92, 7);
    // rising sparkles
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) {
      const ph = (t * 0.45 + i / 6) % 1;
      ctx.globalAlpha = 1 - ph;
      this.star(ctx, x - 34 + ((i * 29) % 68), y - 10 - ph * 170, 3 + (i % 3));
    }
    ctx.globalAlpha = 1;
    // "drop in here" marker
    if (showArrow) {
      const by = y - 262 + Math.sin(t * 4) * 7;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const [col, lw] of [[O, 9], ['#ffd43b', 5]]) {
        ctx.strokeStyle = col; ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(x - 14, by - 10); ctx.lineTo(x, by + 4); ctx.lineTo(x + 14, by - 10);
        ctx.moveTo(x - 14, by + 6); ctx.lineTo(x, by + 20); ctx.lineTo(x + 14, by + 6);
        ctx.stroke();
      }
    }
  }

  castlePennant(ctx, x, y, colors, t, len) {
    const O = this.O, L = len || 30, n = colors.length;
    ctx.strokeStyle = O; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 26); ctx.stroke();
    const edge = (k, f) => {
      const wave = Math.sin(t * 6 - k * 5.6) * 2.5 * k;
      const top = y - 26 + k * 5, bot = y - 16 - k * 5;
      return top + (bot - top) * f + wave;
    };
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      for (let k = 0; k <= 8; k++) ctx.lineTo(x + 1 + L * k / 8, edge(k / 8, i / n));
      for (let k = 8; k >= 0; k--) ctx.lineTo(x + 1 + L * k / 8, edge(k / 8, (i + 1) / n));
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = O; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let k = 0; k <= 8; k++) ctx.lineTo(x + 1 + L * k / 8, edge(k / 8, 0));
    for (let k = 8; k >= 0; k--) ctx.lineTo(x + 1 + L * k / 8, edge(k / 8, 1));
    ctx.closePath(); ctx.stroke();
  }

  archWindow(ctx, x, y, w, h, fill) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y + h);
    ctx.lineTo(x - w / 2, y + w / 2);
    ctx.arc(x, y + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(x + w / 2, y + h);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = this.O; ctx.lineWidth = 2.5; ctx.stroke();
  }

  roof(ctx, x0, w, base, peak, t, pennant) {
    const O = this.O, mid = x0 + w / 2;
    const rg = ctx.createLinearGradient(0, peak, 0, base);
    rg.addColorStop(0, '#b197fc'); rg.addColorStop(1, '#ff8cc6');
    ctx.beginPath(); ctx.moveTo(x0 - 6, base); ctx.lineTo(x0 + w + 6, base); ctx.lineTo(mid, peak); ctx.closePath();
    ctx.fillStyle = rg; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(74,53,112,0.28)'; ctx.lineWidth = 1.5;
    for (let yy = base - 9, row = 0; yy > peak; yy -= 9, row++) {
      ctx.beginPath();
      for (let xx = x0 - 10 + (row % 2) * 5; xx < x0 + w + 10; xx += 10) { ctx.moveTo(xx + 10, yy); ctx.arc(xx + 5, yy, 5, 0, Math.PI); }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.moveTo(x0 + 2, base); ctx.lineTo(x0 + w * 0.3, base); ctx.lineTo(mid, peak + 4); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = O; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x0 - 6, base); ctx.lineTo(x0 + w + 6, base); ctx.lineTo(mid, peak); ctx.closePath(); ctx.stroke();
    // gold trim + finial
    ctx.fillStyle = '#ffd43b'; ctx.lineWidth = 2;
    ctx.fillRect(x0 - 6, base - 1, w + 12, 5); ctx.strokeRect(x0 - 6, base - 1, w + 12, 5);
    ctx.beginPath(); ctx.arc(mid, peak - 3, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (pennant) this.castlePennant(ctx, mid, peak - 6, pennant, t, w * 0.8);
  }

  towerBody(ctx, x0, w, top, y) {
    const O = this.O;
    const sg = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    sg.addColorStop(0, '#fffaff'); sg.addColorStop(0.6, '#f1e8ff'); sg.addColorStop(1, '#dccdf5');
    ctx.fillStyle = sg; ctx.fillRect(x0, top, w, y - top);
    this.bricks(ctx, x0, top, w, y - top);
    ctx.strokeStyle = O; ctx.lineWidth = 3; ctx.strokeRect(x0, top, w, y - top);
    // corbel scallops under the roof line
    ctx.fillStyle = '#e5d8fa'; ctx.lineWidth = 1.5;
    for (let xx = x0; xx < x0 + w - 1; xx += w / Math.max(2, Math.round(w / 11))) {
      const sw = w / Math.max(2, Math.round(w / 11));
      ctx.beginPath(); ctx.moveTo(xx, top + 4); ctx.arc(xx + sw / 2, top + 4, sw / 2, 0, Math.PI); ctx.fill(); ctx.stroke();
    }
  }

  drawCastleFront(ctx, x, y, t) {
    const O = this.O;
    const bunting = ['#ff6b9a', '#ffe066', '#69db7c', '#4dabf7', '#9775fa'];
    for (const side of [-1, 1]) {
      const tx0 = side < 0 ? x - 90 : x + 46;     // main tower
      const ux0 = side < 0 ? x - 118 : x + 90;    // side turret
      this.towerBody(ctx, ux0, 28, y - 100, y);
      this.towerBody(ctx, tx0, 44, y - 160, y);
      // windows with pink shutters
      const wx = tx0 + 22;
      for (const wy of [y - 138, y - 84]) {
        ctx.fillStyle = '#ff9ec9'; ctx.strokeStyle = O; ctx.lineWidth = 1.5;
        ctx.fillRect(wx - 14, wy + 4, 5, 20); ctx.strokeRect(wx - 14, wy + 4, 5, 20);
        ctx.fillRect(wx + 9, wy + 4, 5, 20); ctx.strokeRect(wx + 9, wy + 4, 5, 20);
        this.archWindow(ctx, wx, wy, 14, 24, '#ffd43b');
      }
      this.archWindow(ctx, ux0 + 14, y - 76, 10, 18, '#ffd43b');
      // round rose window
      ctx.fillStyle = '#74c0fc'; ctx.strokeStyle = O; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(wx, y - 34, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wx - 8, y - 34); ctx.lineTo(wx + 8, y - 34); ctx.moveTo(wx, y - 42); ctx.lineTo(wx, y - 26); ctx.stroke();
      // roofs with rainbow pennants
      this.roof(ctx, ux0, 28, y - 100, y - 140, t, null);
      this.roof(ctx, tx0, 44, y - 160, y - 222, t, side < 0 ? ['#ff6b9a', '#ffe066'] : ['#4dabf7', '#9775fa']);
      // bunting from tower to turret
      const ax = side < 0 ? tx0 : tx0 + 44, bx = side < 0 ? ux0 + 4 : ux0 + 24;
      const ay = y - 150, byy = y - 96;
      ctx.strokeStyle = O; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2, (ay + byy) / 2 + 12, bx, byy); ctx.stroke();
      for (let i = 1; i < 5; i++) {
        const k = i / 5, px = ax + (bx - ax) * k, py = (1 - k) * (1 - k) * ay + 2 * (1 - k) * k * ((ay + byy) / 2 + 12) + k * k * byy;
        ctx.fillStyle = bunting[i % 5];
        ctx.beginPath(); ctx.moveTo(px - 4, py); ctx.lineTo(px + 4, py); ctx.lineTo(px, py + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // flowers at the base
      for (let i = 0; i < 5; i++) {
        const fx = (side < 0 ? x - 118 : x + 46) + 6 + i * 16 + (i % 2) * 3;
        ctx.fillStyle = '#69db7c'; ctx.strokeStyle = O; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(fx, y - 3, 6, Math.PI, 0); ctx.fill(); ctx.stroke();
        ctx.fillStyle = i % 2 ? '#ffe066' : '#ff8cc6';
        ctx.beginPath(); ctx.arc(fx + 2, y - 9, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
    // gold heart crests
    for (const hx of [x - 68, x + 68]) {
      const hy = y - 58;
      ctx.fillStyle = '#ff5fa2'; ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx, hy + 7);
      ctx.bezierCurveTo(hx - 11, hy, hx - 7, hy - 9, hx, hy - 3);
      ctx.bezierCurveTo(hx + 7, hy - 9, hx + 11, hy, hx, hy + 7);
      ctx.fill(); ctx.stroke();
    }
    // twinkles
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = Math.max(0, Math.sin(t * 2.2 + i * 1.6));
      this.star(ctx, x + [-100, -60, 62, 104][i], y - [180, 236, 238, 150][i], 4);
    }
    ctx.globalAlpha = 1;
  }

  heart(ctx, x, y, s, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x, y + 9 * s);
    ctx.bezierCurveTo(x - 15 * s, y, x - 9 * s, y - 12 * s, x, y - 4 * s);
    ctx.bezierCurveTo(x + 9 * s, y - 12 * s, x + 15 * s, y, x, y + 9 * s);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }

  drawTrapDoor(ctx, x, y, open, t) {
    const O = this.O, w = 92, h = 32;
    ctx.save();
    ctx.lineJoin = 'round';
    if (open <= 0) {
      const wg = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
      wg.addColorStop(0, '#c9936a'); wg.addColorStop(1, '#a8734d');
      ctx.fillStyle = wg;
      ctx.beginPath(); ctx.rect(x - w / 2, y - h / 2, w, h); ctx.fill();
      ctx.strokeStyle = 'rgba(74,53,112,0.35)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); for (let i = 1; i < 5; i++) { ctx.moveTo(x - w / 2 + (w / 5) * i, y - h / 2); ctx.lineTo(x - w / 2 + (w / 5) * i, y + h / 2); } ctx.stroke();
      ctx.fillStyle = '#6c5b8a';
      ctx.fillRect(x - w / 2, y - h / 2 + 5, w, 4); ctx.fillRect(x - w / 2, y + h / 2 - 9, w, 4);
      ctx.fillStyle = '#ffd43b';
      for (const bx of [x - w / 2 + 6, x + w / 2 - 6]) for (const by of [y - h / 2 + 7, y + h / 2 - 7]) { ctx.beginPath(); ctx.arc(bx, by, 1.8, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = O; ctx.lineWidth = 2.5; ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(x, y + 4, 6, 4, 0, 0, Math.PI * 2); ctx.stroke();
      // a rare glint hints at the secret
      const ph = (t % 5) / 5;
      if (ph < 0.12) {
        ctx.fillStyle = '#ffffff'; ctx.globalAlpha = Math.sin((ph / 0.12) * Math.PI);
        this.star(ctx, x + w / 2 - 8, y - h / 2 + 2, 6);
      }
    } else {
      ctx.fillStyle = '#1c1238';
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.save();
      ctx.beginPath(); ctx.rect(x - w / 2, y - h / 2, w, h); ctx.clip();
      const RB = ['#ff6b6b', '#ffa94d', '#ffe066', '#8ce99a', '#74c0fc', '#9775fa'];
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = RB[i]; ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.ellipse(x, y + 4, 40 - i * 6, 12 - i * 1.8, t * 3 + i, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = O; ctx.lineWidth = 2.5; ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      if (open < 1) this.drawTrapLid(ctx, x, y, open);
    }
    ctx.restore();
  }

  drawTrapLid(ctx, x, y, open) {
    const O = this.O, w = 92, h = 32;
    const k = open == null ? 1 : open;
    const lh = h * (1 - k) + 40 * k;
    ctx.save();
    ctx.fillStyle = '#b8835b'; ctx.strokeStyle = O; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.rect(x - w / 2, y - h / 2 - lh * k, w, lh * k + (1 - k) * h); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(74,53,112,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); for (let i = 1; i < 5; i++) { ctx.moveTo(x - w / 2 + (w / 5) * i, y - h / 2 - lh * k); ctx.lineTo(x - w / 2 + (w / 5) * i, y - h / 2 + (1 - k) * h); } ctx.stroke();
    ctx.restore();
  }

  drawPrincess(ctx, x, tb, t, lookX) {
    const O = this.O, skin = '#f5c7a9', hair = '#7a4b3a';
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // long hair behind
    ctx.fillStyle = hair; ctx.strokeStyle = O; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 15, tb - 118);
    ctx.quadraticCurveTo(x - 24, tb - 96, x - 20, tb - 74);
    ctx.quadraticCurveTo(x, tb - 70, x + 20, tb - 74);
    ctx.quadraticCurveTo(x + 24, tb - 96, x + 15, tb - 118);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // ball-gown skirt over the seat
    const sg = ctx.createLinearGradient(0, tb - 72, 0, tb - 6);
    sg.addColorStop(0, '#ffa8d2'); sg.addColorStop(1, '#f06595');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(x - 13, tb - 72);
    ctx.quadraticCurveTo(x - 30, tb - 50, x - 46, tb - 9);
    for (let i = 0; i < 8; i++) {
      const x0 = x - 46 + i * 11.5;
      ctx.quadraticCurveTo(x0 + 5.75, tb - 2, x0 + 11.5, tb - 9);
    }
    ctx.quadraticCurveTo(x + 30, tb - 50, x + 13, tb - 72);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(74,53,112,0.25)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const fx of [-24, -8, 8, 24]) { ctx.moveTo(x + fx * 0.3, tb - 66); ctx.quadraticCurveTo(x + fx * 0.8, tb - 40, x + fx, tb - 12); }
    ctx.stroke();
    ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x - 42, tb - 16); ctx.quadraticCurveTo(x, tb - 11, x + 42, tb - 16); ctx.stroke();
    ctx.fillStyle = '#ffd43b';
    for (const fx of [-30, -10, 10, 30]) this.star(ctx, x + fx, tb - 28 + Math.abs(fx) * 0.12, 2.5);
    // shoes
    ctx.fillStyle = '#ffd43b'; ctx.strokeStyle = O; ctx.lineWidth = 1.5;
    for (const fx of [-9, 9]) { ctx.beginPath(); ctx.ellipse(x + fx, tb - 3, 6, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    // bodice + belt
    ctx.fillStyle = '#ff8cc6'; ctx.strokeStyle = O; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 12, tb - 93); ctx.lineTo(x + 12, tb - 93); ctx.lineTo(x + 11, tb - 70); ctx.lineTo(x - 11, tb - 70); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd43b'; ctx.fillRect(x - 12, tb - 75, 24, 5); ctx.strokeRect(x - 12, tb - 75, 24, 5);
    ctx.fillStyle = '#ffffff'; this.heart(ctx, x, tb - 84, 0.35, '#ffffff', null);
    // resting arm
    const arm = (pts) => {
      ctx.strokeStyle = O; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]); ctx.stroke();
      ctx.strokeStyle = skin; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]); ctx.stroke();
      const h = pts[pts.length - 1];
      ctx.fillStyle = skin; ctx.strokeStyle = O; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(h[0], h[1], 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    };
    arm([[x - 15, tb - 86], [x - 19, tb - 72], [x - 6, tb - 62]]);
    // waving arm
    const a = -1.95 + Math.sin(t * 6) * 0.4;
    const ex = x + 27, ey = tb - 78;
    arm([[x + 15, tb - 86], [ex, ey], [ex + Math.cos(a) * 15, ey + Math.sin(a) * 15]]);
    // puffy sleeves
    ctx.fillStyle = '#ffd1e8'; ctx.strokeStyle = O; ctx.lineWidth = 2;
    for (const fx of [-15, 15]) { ctx.beginPath(); ctx.arc(x + fx, tb - 89, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    // neck + head
    ctx.fillStyle = skin;
    ctx.fillRect(x - 3.5, tb - 101, 7, 9); ctx.strokeRect(x - 3.5, tb - 101, 7, 9);
    ctx.beginPath(); ctx.arc(x, tb - 112, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // face: eyes follow the unicorn, blink now and then
    const look = Math.max(-1.6, Math.min(1.6, (lookX - x) / 60));
    ctx.fillStyle = O;
    if ((t % 3.6) < 0.12) {
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x - 7 + look, tb - 112); ctx.lineTo(x - 3 + look, tb - 112); ctx.moveTo(x + 3 + look, tb - 112); ctx.lineTo(x + 7 + look, tb - 112); ctx.stroke();
    } else {
      for (const fx of [-5, 5]) {
        ctx.fillStyle = O; ctx.beginPath(); ctx.ellipse(x + fx + look, tb - 112, 1.9, 2.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + fx + look + 0.7, tb - 113, 0.7, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(255,120,160,0.45)';
    for (const fx of [-8.5, 8.5]) { ctx.beginPath(); ctx.ellipse(x + fx, tb - 107, 3, 1.8, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = O; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x + look * 0.5, tb - 107.5, 3.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    // bangs
    ctx.fillStyle = hair; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 15, tb - 108);
    ctx.quadraticCurveTo(x - 16, tb - 128, x, tb - 127);
    ctx.quadraticCurveTo(x + 16, tb - 128, x + 15, tb - 108);
    ctx.quadraticCurveTo(x + 10, tb - 120, x + 2, tb - 117);
    ctx.quadraticCurveTo(x - 7, tb - 122, x - 15, tb - 108);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // tiara
    ctx.fillStyle = '#ffd43b'; ctx.strokeStyle = O; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - 10, tb - 124); ctx.lineTo(x - 9, tb - 132); ctx.lineTo(x - 4.5, tb - 127.5); ctx.lineTo(x, tb - 137);
    ctx.lineTo(x + 4.5, tb - 127.5); ctx.lineTo(x + 9, tb - 132); ctx.lineTo(x + 10, tb - 124);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff5fa2'; ctx.beginPath(); ctx.arc(x, tb - 129, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = Math.abs(Math.sin(t * 3));
    this.star(ctx, x + 6, tb - 138, 3);
    ctx.restore();
  }

  drawInterior(ctx, vw, vh, g) {
    const O = this.O, t = g.t, RB = ['#ff6b6b', '#ffa94d', '#ffe066', '#8ce99a', '#74c0fc', '#9775fa'];
    const L = this.innerLayout(vw, vh), mid = L.mid, sw = L.sceneW, floorY = L.floorY;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // wall
    const wg = ctx.createLinearGradient(0, 0, 0, floorY);
    wg.addColorStop(0, '#dccbfa'); wg.addColorStop(1, '#fbe3f1');
    ctx.fillStyle = wg; ctx.fillRect(0, 0, vw, floorY);
    ctx.strokeStyle = 'rgba(74,53,112,0.07)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = 30, row = 0; y < floorY; y += 30, row++) {
      ctx.moveTo(0, y); ctx.lineTo(vw, y);
      for (let x = row % 2 ? 0 : 30; x < vw; x += 60) { ctx.moveTo(x, y - 30); ctx.lineTo(x, y); }
    }
    ctx.stroke();

    // rose window + rainbow light beams
    const rR = Math.max(30, Math.min(56, floorY * 0.12)), rY = 26 + rR + floorY * 0.03;
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const sh = 0.07 + 0.04 * Math.sin(t * 1.3 + i);
      ctx.fillStyle = RB[i]; ctx.globalAlpha = sh;
      const a = -rR * 0.7 + i * rR * 0.28;
      ctx.beginPath();
      ctx.moveTo(mid + a, rY); ctx.lineTo(mid + a + rR * 0.28, rY);
      ctx.lineTo(mid + a * 3.2 + 40, floorY + 60); ctx.lineTo(mid + a * 3.2 - 10, floorY + 60);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    const glow = ctx.createRadialGradient(mid, rY, rR * 0.5, mid, rY, rR * 2.2);
    glow.addColorStop(0, 'rgba(255,255,255,0.6)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(mid, rY, rR * 2.2, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = RB[i % 6];
      ctx.beginPath(); ctx.moveTo(mid, rY);
      ctx.arc(mid, rY, rR, (i / 12) * Math.PI * 2 + t * 0.1, ((i + 1) / 12) * Math.PI * 2 + t * 0.1);
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = O; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + t * 0.1; ctx.moveTo(mid, rY); ctx.lineTo(mid + Math.cos(a) * rR, rY + Math.sin(a) * rR); }
    ctx.stroke();
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath(); ctx.arc(mid, rY, rR * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    this.heart(ctx, mid, rY, rR * 0.017, '#ff5fa2', null);
    ctx.lineWidth = 7; ctx.strokeStyle = '#ffd43b';
    ctx.beginPath(); ctx.arc(mid, rY, rR + 3, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.strokeStyle = O;
    ctx.beginPath(); ctx.arc(mid, rY, rR + 7, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(mid, rY, rR - 1, 0, Math.PI * 2); ctx.stroke();

    // tall windows with drapes
    const wh = Math.max(90, Math.min(190, floorY * 0.52)), wy = Math.max(40, floorY - 70 - wh), ww = 64;
    for (const side of [-1, 1]) {
      const x = mid + side * sw * 0.36;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x - ww / 2, wy + wh); ctx.lineTo(x - ww / 2, wy + ww / 2); ctx.arc(x, wy + ww / 2, ww / 2, Math.PI, 0); ctx.lineTo(x + ww / 2, wy + wh); ctx.closePath();
      const sg = ctx.createLinearGradient(0, wy, 0, wy + wh);
      sg.addColorStop(0, '#6ec6ff'); sg.addColorStop(1, '#ffc9e6');
      ctx.fillStyle = sg; ctx.fill(); ctx.clip();
      ctx.lineWidth = 5; ctx.globalAlpha = 0.85;
      for (let i = 0; i < 6; i++) { ctx.strokeStyle = RB[i]; ctx.beginPath(); ctx.arc(x + 6, wy + wh + 12, 58 - i * 5, Math.PI, 0); ctx.stroke(); }
      ctx.globalAlpha = 1;
      this.cloud(ctx, x - 26 + Math.sin(t * 0.4 + side) * 8, wy + wh * 0.35, 0.35, '#ffffff');
      ctx.restore();
      ctx.strokeStyle = O; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - ww / 2, wy + wh); ctx.lineTo(x - ww / 2, wy + ww / 2); ctx.arc(x, wy + ww / 2, ww / 2, Math.PI, 0); ctx.lineTo(x + ww / 2, wy + wh); ctx.closePath();
      ctx.moveTo(x, wy); ctx.lineTo(x, wy + wh); ctx.moveTo(x - ww / 2, wy + wh * 0.55); ctx.lineTo(x + ww / 2, wy + wh * 0.55);
      ctx.stroke();
      ctx.fillStyle = '#e5d8fa'; ctx.fillRect(x - ww / 2 - 8, wy + wh, ww + 16, 10);
      ctx.lineWidth = 2.5; ctx.strokeRect(x - ww / 2 - 8, wy + wh, ww + 16, 10);
      // curtain rod + drapes
      ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x - ww / 2 - 26, wy - 8); ctx.lineTo(x + ww / 2 + 26, wy - 8); ctx.stroke();
      ctx.fillStyle = '#ffd43b'; ctx.strokeStyle = O; ctx.lineWidth = 2;
      for (const ex of [x - ww / 2 - 28, x + ww / 2 + 28]) { ctx.beginPath(); ctx.arc(ex, wy - 8, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      for (const cs of [-1, 1]) {
        const ox = x + cs * (ww / 2 + 22), ix = x + cs * (ww / 2 - 4);
        const sway = Math.sin(t * 1.2 + cs) * 2;
        ctx.fillStyle = '#ff8cc6'; ctx.strokeStyle = O; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ox, wy - 6); ctx.lineTo(ix, wy - 6);
        ctx.quadraticCurveTo(ix + cs * 4, wy + wh * 0.35, ox - cs * 2 + sway, wy + wh * 0.55);
        ctx.quadraticCurveTo(ox - cs * 10, wy + wh * 0.8, ox + cs * 4 + sway, wy + wh + 26);
        ctx.lineTo(ox + cs * 10, wy + wh + 26);
        ctx.quadraticCurveTo(ox + cs * 6, wy + wh * 0.5, ox, wy - 6);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(74,53,112,0.3)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(ox - cs * 6, wy); ctx.quadraticCurveTo(ox - cs * 4, wy + wh * 0.3, ox - cs * 2, wy + wh * 0.5); ctx.stroke();
        ctx.fillStyle = '#ffd43b'; ctx.strokeStyle = O; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(ox - cs * 2 + sway, wy + wh * 0.55, 6, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }

    // wainscot
    const wtop = floorY - 56;
    ctx.fillStyle = '#e2d0f7'; ctx.fillRect(0, wtop, vw, 56);
    ctx.strokeStyle = 'rgba(74,53,112,0.25)'; ctx.lineWidth = 2;
    for (let x = 12; x < vw; x += 64) ctx.strokeRect(x, wtop + 12, 48, 34);
    ctx.fillStyle = '#ffd43b'; ctx.fillRect(0, wtop - 3, vw, 6);
    ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, wtop - 3); ctx.lineTo(vw, wtop - 3); ctx.moveTo(0, wtop + 3); ctx.lineTo(vw, wtop + 3); ctx.stroke();

    // pillars with candle sconces
    const px = [mid - sw * 0.2, mid + sw * 0.2];
    for (const x of px) {
      const pg = ctx.createLinearGradient(x - 16, 0, x + 16, 0);
      pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.5, '#f3ecff'); pg.addColorStop(1, '#d8c6f2');
      ctx.fillStyle = pg; ctx.fillRect(x - 15, 16, 30, floorY - 16);
      ctx.strokeStyle = 'rgba(74,53,112,0.2)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); for (const fx of [-7, 0, 7]) { ctx.moveTo(x + fx, 36); ctx.lineTo(x + fx, floorY - 22); } ctx.stroke();
      ctx.strokeStyle = O; ctx.lineWidth = 2.5; ctx.strokeRect(x - 15, 16, 30, floorY - 16);
      ctx.fillStyle = '#ffd43b';
      ctx.fillRect(x - 22, 14, 44, 14); ctx.strokeRect(x - 22, 14, 44, 14);
      ctx.beginPath(); ctx.arc(x - 16, 30, 5, 0, Math.PI * 2); ctx.arc(x + 16, 30, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillRect(x - 21, floorY - 16, 42, 16); ctx.strokeRect(x - 21, floorY - 16, 42, 16);
      // sconce
      const sy = Math.max(70, floorY - 150);
      const lg = ctx.createRadialGradient(x, sy - 16, 2, x, sy - 16, 55);
      lg.addColorStop(0, 'rgba(255,212,59,0.5)'); lg.addColorStop(1, 'rgba(255,212,59,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(x, sy - 16, 55, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - 16, sy - 6); ctx.quadraticCurveTo(x, sy + 12, x + 16, sy - 6); ctx.stroke();
      for (const cx2 of [x - 16, x, x + 16]) {
        const cy2 = cx2 === x ? sy - 2 : sy - 8;
        ctx.fillStyle = '#fff4e6'; ctx.strokeStyle = O; ctx.lineWidth = 1.5;
        ctx.fillRect(cx2 - 3, cy2 - 14, 6, 14); ctx.strokeRect(cx2 - 3, cy2 - 14, 6, 14);
        const fl = 5 + Math.sin(t * 14 + cx2) * 1.5;
        ctx.fillStyle = '#ffa94d'; ctx.beginPath(); ctx.ellipse(cx2, cy2 - 18, 3, fl, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.ellipse(cx2, cy2 - 17, 1.6, fl * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    // flower garland across the top
    const gA = mid - sw * 0.2, gB = mid + sw * 0.2;
    for (const [a, b] of [[gA, mid - rR - 12], [mid + rR + 12, gB], [mid - sw * 0.5, gA], [gB, mid + sw * 0.5]]) {
      if (b - a < 20) continue;
      const sag = Math.min(34, (b - a) * 0.25);
      ctx.strokeStyle = '#69db7c'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(a, 32); ctx.quadraticCurveTo((a + b) / 2, 32 + sag * 2, b, 32); ctx.stroke();
      for (let k = 0.1; k < 0.95; k += 0.16) {
        const fx = (1 - k) * (1 - k) * a + 2 * (1 - k) * k * ((a + b) / 2) + k * k * b;
        const fy = (1 - k) * (1 - k) * 32 + 2 * (1 - k) * k * (32 + sag * 2) + k * k * 32;
        ctx.fillStyle = Math.round(k * 10) % 2 ? '#ff8cc6' : '#ffe066'; ctx.strokeStyle = O; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(fx, fy, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
    // gold cornice
    ctx.fillStyle = '#ffd43b'; ctx.fillRect(0, 0, vw, 12);
    ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(vw, 12); ctx.stroke();
    ctx.fillStyle = '#f7c948';
    ctx.beginPath(); for (let x = 0; x < vw; x += 18) { ctx.moveTo(x + 18, 12); ctx.arc(x + 9, 12, 9, 0, Math.PI); } ctx.fill(); ctx.stroke();

    // glossy floor
    const fg = ctx.createLinearGradient(0, floorY, 0, vh);
    fg.addColorStop(0, '#dcc8f6'); fg.addColorStop(1, '#b89ce3');
    ctx.fillStyle = fg; ctx.fillRect(0, floorY, vw, vh - floorY);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let y = floorY, r2 = 0; y < vh; y += 34, r2++) for (let x = (r2 % 2) * 44 - 44; x < vw; x += 88) ctx.fillRect(x, y, 44, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(0, floorY, vw, 10);
    ctx.strokeStyle = O; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(vw, floorY); ctx.stroke();

    // carpet with hearts
    const cg = ctx.createLinearGradient(0, floorY, 0, vh);
    cg.addColorStop(0, '#ff7eb6'); cg.addColorStop(1, '#e64980');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.moveTo(mid - 62, floorY + 8); ctx.lineTo(mid + 62, floorY + 8); ctx.lineTo(mid + 160, vh + 2); ctx.lineTo(mid - 160, vh + 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(mid - 52, floorY + 8); ctx.lineTo(mid - 140, vh); ctx.moveTo(mid + 52, floorY + 8); ctx.lineTo(mid + 140, vh); ctx.stroke();
    for (let y = floorY + 40, i = 0; y < vh; y += 42, i++) this.heart(ctx, mid, y, 0.5 + i * 0.12, 'rgba(255,224,102,0.8)', null);

    // dais + throne
    const ty = floorY + 8;
    ctx.fillStyle = '#efe4fd'; ctx.strokeStyle = O; ctx.lineWidth = 2.5;
    ctx.fillRect(mid - 92, ty - 8, 184, 12); ctx.strokeRect(mid - 92, ty - 8, 184, 12);
    ctx.fillRect(mid - 76, ty - 18, 152, 10); ctx.strokeRect(mid - 76, ty - 18, 152, 10);
    ctx.fillStyle = '#ffd43b'; ctx.fillRect(mid - 92, ty - 9, 184, 3); ctx.fillRect(mid - 76, ty - 19, 152, 3);
    const tb = ty - 18;
    ctx.fillStyle = '#ffd43b'; ctx.strokeStyle = O; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mid - 50, tb - 30); ctx.lineTo(mid - 50, tb - 140);
    ctx.quadraticCurveTo(mid - 50, tb - 168, mid - 30, tb - 160);
    ctx.quadraticCurveTo(mid - 18, tb - 196, mid, tb - 186);
    ctx.quadraticCurveTo(mid + 18, tb - 196, mid + 30, tb - 160);
    ctx.quadraticCurveTo(mid + 50, tb - 168, mid + 50, tb - 140);
    ctx.lineTo(mid + 50, tb - 30); ctx.closePath(); ctx.fill(); ctx.stroke();
    const vg = ctx.createLinearGradient(0, tb - 170, 0, tb - 40);
    vg.addColorStop(0, '#b197fc'); vg.addColorStop(1, '#7048e8');
    ctx.fillStyle = vg;
    ctx.beginPath();
    ctx.moveTo(mid - 34, tb - 40); ctx.lineTo(mid - 34, tb - 136);
    ctx.quadraticCurveTo(mid - 34, tb - 156, mid - 20, tb - 152);
    ctx.quadraticCurveTo(mid, tb - 180, mid + 20, tb - 152);
    ctx.quadraticCurveTo(mid + 34, tb - 156, mid + 34, tb - 136);
    ctx.lineTo(mid + 34, tb - 40); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = -1; k <= 1; k++) for (let j = 0; j < 3; j++) { ctx.moveTo(mid + k * 16, tb - 130 + j * 28); ctx.lineTo(mid + k * 16, tb - 118 + j * 28); }
    ctx.stroke();
    this.heart(ctx, mid, tb - 104, 0.9, '#ff5fa2', '#ffd43b');
    ctx.fillStyle = '#ffd43b'; ctx.strokeStyle = O; ctx.lineWidth = 2.5;
    ctx.fillRect(mid - 62, tb - 46, 124, 18); ctx.strokeRect(mid - 62, tb - 46, 124, 18);
    ctx.fillStyle = '#9775fa'; ctx.fillRect(mid - 50, tb - 54, 100, 9); ctx.strokeRect(mid - 50, tb - 54, 100, 9);
    ctx.fillStyle = '#ffd43b';
    ctx.fillRect(mid - 60, tb - 28, 12, 28); ctx.strokeRect(mid - 60, tb - 28, 12, 28);
    ctx.fillRect(mid + 48, tb - 28, 12, 28); ctx.strokeRect(mid + 48, tb - 28, 12, 28);
    for (const ax of [mid - 58, mid + 58]) { ctx.beginPath(); ctx.arc(ax, tb - 50, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    for (const [gx, gy2, gc] of [[mid, tb - 192, '#ff5fa2'], [mid - 30, tb - 164, '#74c0fc'], [mid + 30, tb - 164, '#8ce99a']]) {
      ctx.fillStyle = gc; ctx.beginPath(); ctx.arc(gx, gy2, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    this.drawPrincess(ctx, mid, tb, t, g.inn ? g.inn.x : mid);

    // flower vases
    for (const side of [-1, 1]) {
      const vx = mid + side * 118, vy = floorY + 2;
      ctx.strokeStyle = '#51cf66'; ctx.lineWidth = 2.5;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(vx, vy - 30); ctx.quadraticCurveTo(vx + i * 6, vy - 50, vx + i * 11, vy - 62 + Math.abs(i) * 5); ctx.stroke(); }
      for (let i = -2; i <= 2; i++) {
        ctx.fillStyle = RB[(i + 2 + (side > 0 ? 3 : 0)) % 6]; ctx.strokeStyle = O; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(vx + i * 11, vy - 64 + Math.abs(i) * 5, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff4c7'; ctx.beginPath(); ctx.arc(vx + i * 11, vy - 64 + Math.abs(i) * 5, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#74c0fc'; ctx.strokeStyle = O; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(vx - 8, vy - 34); ctx.lineTo(vx + 8, vy - 34);
      ctx.quadraticCurveTo(vx + 20, vy - 14, vx + 9, vy); ctx.lineTo(vx - 9, vy);
      ctx.quadraticCurveTo(vx - 20, vy - 14, vx - 8, vy - 34);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd43b'; ctx.fillRect(vx - 10, vy - 36, 20, 4); ctx.strokeRect(vx - 10, vy - 36, 20, 4);
    }

    // floating hearts
    for (let i = 0; i < 7; i++) {
      const ph = (t * 0.12 + i / 7) % 1;
      const hx = (i * 137) % Math.max(1, sw - 40) + 20 + Math.sin(t + i) * 12;
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.7;
      this.heart(ctx, hx, floorY - ph * (floorY - 30), 0.6, '#ff8cc6', null);
    }
    ctx.globalAlpha = 1;

    // the unicorn: walks and flies when the player takes control, prances otherwise
    const u = g.inn || { x: null, z: 0.3, h: 0, vx: 0, facing: 1, wing: t * 16, walkT: 0, controlled: false };
    if (u.x == null) u.x = mid + Math.min(160, sw * 0.3);
    if (u.z == null) u.z = 0.3;
    const open = u.falling ? Math.min(1, u.fallT / 0.25) : 0;
    const dY = L.groundY(L.trapZ);
    this.drawTrapDoor(ctx, mid, dY, open, t);
    const gy = L.groundY(u.z), us = L.scale(u.z);
    let bob, wing = u.wing, facing = u.facing;
    if (!u.controlled) { bob = Math.abs(Math.sin(t * 5)) * 18; wing = t * 16; facing = u.x > mid ? -1 : 1; }
    else if (u.h > 0) bob = 0;
    else bob = Math.abs(u.vx) > 20 ? Math.abs(Math.sin(u.walkT)) * 7 : Math.abs(Math.sin(t * 2.5)) * 2;
    let lift = u.h + bob;
    if (u.falling) lift = -Math.max(0, u.fallT - 0.2) * Math.max(0, u.fallT - 0.2) * 260;
    if (!u.falling) {
      ctx.fillStyle = 'rgba(74,53,112,0.2)';
      ctx.beginPath(); ctx.ellipse(u.x, gy, Math.max(14, 21 * us - lift * 0.25), Math.max(3, 4 * us - lift * 0.03), 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save();
    if (u.falling) {
      ctx.beginPath();
      ctx.rect(-10, -10, this.viewW + 20, dY - 16 + 10);
      ctx.rect(mid - 46, dY - 16, 92, 32);
      ctx.clip();
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, u.fallT - 0.5) / 0.4);
    }
    ctx.translate(u.x, gy - 14 * us - lift);
    ctx.scale(us, us);
    const tilt = u.controlled ? (u.h > 0 ? Math.max(-0.35, Math.min(0.35, -u.vh / 1200)) : Math.sin(u.walkT) * 0.05) : Math.sin(t * 5) * 0.08;
    this.drawUnicorn(ctx, 0, 0, tilt, facing, wing, t, g.crown);
    ctx.restore();
    if (u.falling && open >= 1) this.drawTrapLid(ctx, mid, dY);

    // sparkles + confetti
    ctx.fillStyle = '#ffffff';
    if (!u.falling) for (let i = 0; i < 8; i++) {
      const a = t * 0.8 + i * 0.785;
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + i));
      this.star(ctx, u.x + Math.cos(a) * 40 * us, gy - 28 * us - lift + Math.sin(a) * 18 * us, 4);
    }
    ctx.globalAlpha = 1;
    for (const c of g.confetti || []) {
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r);
      ctx.fillStyle = c.c; ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    }
  }

  flagPointer(ctx, h, cx, cy, vw, vh) {
    const fx = h.cup[0] - cx, fy = h.cup[1] - 60 - cy;
    if (fx > 10 && fx < vw - 10 && fy > 10 && fy < vh - 10) return;
    const px = Math.max(44, Math.min(vw - 44, fx)), py = Math.max(96, Math.min(vh - 150, fy));
    const ang = Math.atan2(fy - py, fx - px);
    const dist = Math.round(Math.abs(h.cup[0] - this.g.ball.x) / 10);
    ctx.save();
    ctx.translate(px, py);
    ctx.save();
    ctx.rotate(ang);
    ctx.fillStyle = '#ff5fa2'; ctx.strokeStyle = this.O; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(26, -9); ctx.lineTo(26, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = this.O;
    ctx.font = '700 13px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(dist + 'yd', 0, 1);
    ctx.restore();
  }

  drawWing(ctx, px, py, phase, fill, s) {
    const O = this.O;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.12);
    const sy = Math.cos(phase) * 0.9 + 0.1;
    ctx.scale(s, s * sy);
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.bezierCurveTo(8, -18, 2, -32, -10, -40);
    ctx.quadraticCurveTo(-13, -31, -19, -31);
    ctx.quadraticCurveTo(-20, -23, -27, -22);
    ctx.quadraticCurveTo(-27, -14, -32, -11);
    ctx.quadraticCurveTo(-25, -1, -12, 2);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineJoin = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = O; ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-1, -6); ctx.quadraticCurveTo(-6, -18, -10, -29);
    ctx.moveTo(-4, -3); ctx.quadraticCurveTo(-13, -10, -21, -18);
    ctx.stroke();
    ctx.restore();
  }

  drawUnicorn(ctx, x, y, rot, facing, wing, t, crown) {
    const O = this.O, R = this.RAINBOW;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing < 0 ? -1 : 1, 1);
    ctx.rotate(rot);
    ctx.scale(0.7, 0.7);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    this.drawWing(ctx, 2, -10, wing + 0.5, '#d6c6f7', 0.82);
    for (let i = 0; i < 6; i++) {
      const w = Math.sin(t * 9 + i * 0.6) * 3;
      ctx.strokeStyle = R[i]; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-17, -6 + i * 1.6);
      ctx.bezierCurveTo(-26, -12 + i * 2 + w, -30, 2 + i * 2 - w, -38, -4 + i * 2.6 + w);
      ctx.stroke();
    }
    const legs = [[-12, 8, -14, 19], [-5, 10, -6, 20], [8, 9, 9, 20], [13, 7, 15, 19]];
    for (const l of legs) {
      ctx.strokeStyle = O; ctx.lineWidth = 7.5;
      ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke();
      ctx.strokeStyle = '#fffafc'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke();
      ctx.fillStyle = '#ff9ec9'; ctx.strokeStyle = O; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(l[2], l[3], 2.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#fffafc'; ctx.strokeStyle = O; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, 21, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(200,170,240,0.35)';
    ctx.beginPath(); ctx.ellipse(-1, 6, 15, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    const mane = [[13, -24], [8, -22], [4, -18], [1, -13], [-1, -7]];
    for (let i = 0; i < mane.length; i++) {
      ctx.fillStyle = R[i % 6]; ctx.strokeStyle = O; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mane[i][0], mane[i][1] + Math.sin(t * 8 + i) * 0.8, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#fffafc'; ctx.strokeStyle = O; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(10, -19); ctx.lineTo(11, -29); ctx.lineTo(16, -21); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(17, -13, 11.5, 10.5, -0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffe0ee';
    ctx.beginPath(); ctx.ellipse(26, -8, 8, 6.5, -0.15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = O;
    ctx.beginPath(); ctx.arc(30, -9.5, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,120,180,0.55)';
    ctx.beginPath(); ctx.ellipse(18, -7, 3.2, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = O;
    ctx.beginPath(); ctx.ellipse(19, -14.5, 2.5, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(19.8, -15.8, 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = R[0]; ctx.strokeStyle = O; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(12, -22, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (crown) {
      ctx.fillStyle = '#ffd43b'; ctx.strokeStyle = O; ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(6, -21); ctx.lineTo(5, -31); ctx.lineTo(9.5, -26.5); ctx.lineTo(13, -34); ctx.lineTo(16.5, -26.5); ctx.lineTo(21, -31); ctx.lineTo(20, -21);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff5fa2';
      ctx.beginPath(); ctx.arc(13, -24, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    const hg = ctx.createLinearGradient(16, -20, 26, -40);
    hg.addColorStop(0, '#fab005'); hg.addColorStop(1, '#fff3bf');
    ctx.fillStyle = hg; ctx.strokeStyle = O; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(14.5, -21.5); ctx.lineTo(21, -20); ctx.lineTo(25, -40); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(16.2, -25.5); ctx.lineTo(21.6, -24.5);
    ctx.moveTo(18.2, -30.5); ctx.lineTo(22.6, -29.5);
    ctx.moveTo(20.2, -35); ctx.lineTo(23.6, -34.4);
    ctx.stroke();
    this.drawWing(ctx, -3, -8, wing, '#f6efff', 1);
    ctx.restore();
  }
}
