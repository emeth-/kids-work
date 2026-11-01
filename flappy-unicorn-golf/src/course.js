// Course layout for Flappy Unicorn Golf.
//
// This is plain data: edit it to add, remove, or reshape holes. The game makes a
// fresh copy of it every time it loads (the engine scribbles cached values such
// as `gy`/`cy`/`sq` onto obstacle objects at runtime).
//
// Coordinates are world units. +x is right, +y is DOWN (canvas convention), so
// a smaller y is higher up. The unicorn ball has radius 14.
//
// Hole fields
//   name   label shown in banner and scorecard
//   par    par flaps
//   w      world width (the ball is walled in at 0..w)
//   tee    [x, y]  start position (ball sits just above this point)
//   cup    [x, y]  castle base center; drop in through the open top between
//                  the two towers (|x - cup.x| < 46) to sink the hole
//   tip    optional hint shown in the hole intro banner
//   ground polyline of [x, y, type?] points. `type` applies to the segment that
//          starts at that point:
//            (none) grass   's' sand (sticky, high friction)
//            'l' lava (drains the 60 s fire timer; +1 flap at 0)
//            'w' water (splash: +1 penalty flap, back to last safe spot)
//   obs    obstacles, see below
//
// Obstacle kinds
//   mushroom { x, w, hgt }                   bouncy cap sitting on the ground at x
//   pinwheel { x, y, r, spd, n? }            spinning blades (n defaults to 4; spd<0 = counter-clockwise)
//   island   { pts: [[x,y], ...] }           extra closed grass polygon
//   geyser   { x, h, period, off?, base? }   erupts for 1.3 s every `period` s, launches you up;
//                                            `base` overrides the ground y it sits on
//   cloud    { x, y, w, h, dx?, dy?, spd }   bouncy moving platform, oscillates by dx/dy
//   wind     { x, y, w, h, fx?, fy? }        rectangular force field (fy<0 = updraft)

const COURSE = [
  { name: 'Warm-up', par: 3, w: 1300, tee: [120, 400], cup: [1050, 400], tip: 'Bounce on mushrooms for a big boost!',
    obs: [{ kind: 'mushroom', x: 490, w: 72, hgt: 32 }, { kind: 'mushroom', x: 860, w: 72, hgt: 30 }],
    ground: [[0, 400], [260, 400], [420, 330], [560, 330], [720, 400], [1300, 400]] },
  { name: 'Sand Trap', par: 5, w: 1400, tee: [110, 380], cup: [1180, 300], tip: 'Mind the spinning pinwheel over the sand!',
    obs: [{ kind: 'pinwheel', x: 520, y: 320, r: 62, spd: 1.6 }],
    ground: [[0, 380], [300, 380], [380, 420], [400, 440, 's'], [640, 440], [680, 420], [720, 380], [900, 300], [1400, 300]] },
  { name: 'Molten Lake', par: 6, w: 1700, tee: [120, 400], cup: [1500, 380], tip: 'Ride the drifting cloud, or the island geyser!',
    obs: [{ kind: 'island', pts: [[640, 360], [790, 360], [770, 392], [715, 406], [660, 392]] },
      { kind: 'geyser', x: 715, base: 360, h: 210, period: 3.2 },
      { kind: 'cloud', x: 500, y: 410, w: 100, h: 24, dx: 60, spd: 0.9 }],
    ground: [[0, 400], [380, 400], [420, 480], [440, 500, 'l'], [980, 500], [1020, 470], [1060, 400], [1300, 380], [1700, 380]] },
  { name: 'Cloud Hop', par: 6, w: 1500, tee: [120, 420], cup: [1180, 240], tip: 'Step into the updraft to float up the cliff.',
    obs: [{ kind: 'cloud', x: 300, y: 300, w: 120, h: 28, dy: 40, spd: 1.1 },
      { kind: 'wind', x: 470, y: 40, w: 80, h: 385, fx: 0, fy: -1150 }],
    ground: [[0, 420], [560, 420], [590, 240], [1000, 240], [1340, 240], [1370, 420], [1500, 420]] },
  { name: 'The Valley', par: 7, w: 2200, tee: [110, 300], cup: [2000, 350], tip: 'Mushroom, geyser, then ride the tailwind!',
    obs: [{ kind: 'mushroom', x: 600, w: 76, hgt: 30 },
      { kind: 'geyser', x: 1325, h: 200, period: 3.6, off: 1.2 },
      { kind: 'wind', x: 1440, y: 180, w: 300, h: 270, fx: 520 }],
    ground: [[0, 300], [250, 300], [500, 520], [700, 540], [900, 470], [980, 470, 's'], [1150, 470], [1250, 380], [1400, 380], [1440, 440], [1460, 460, 'l'], [1700, 460], [1740, 400], [1780, 350], [2200, 350]] },
  { name: 'Up and Over', par: 6, w: 1500, tee: [120, 420], cup: [1232, 420], tip: 'Use the mushroom to leap the wall.',
    obs: [{ kind: 'mushroom', x: 390, w: 78, hgt: 34 }, { kind: 'pinwheel', x: 975, y: 330, r: 58, spd: -2.2 }],
    ground: [[0, 420], [480, 420], [560, 150], [680, 150], [760, 420], [880, 420, 's'], [1060, 420], [1120, 420], [1350, 420], [1380, 300], [1500, 300]] },
  { name: 'Lava Lane', par: 6, w: 1800, tee: [120, 400], cup: [1560, 300], tip: 'Hop the cloud ferry. Geysers launch you!',
    obs: [{ kind: 'cloud', x: 520, y: 380, w: 120, h: 26, dx: 140, spd: 0.7 },
      { kind: 'geyser', x: 840, h: 240, period: 2.8 },
      { kind: 'geyser', x: 1065, h: 200, period: 3, off: 1.5 }],
    ground: [[0, 400], [300, 400], [340, 470], [360, 490, 'l'], [920, 490], [960, 460], [1000, 400], [1120, 400], [1160, 300], [1800, 300]] },
  { name: 'Pinwheel Park', par: 6, w: 1700, tee: [120, 400], cup: [1420, 400], tip: 'Time your flaps between the spinning blades.',
    obs: [{ kind: 'mushroom', x: 220, w: 70, hgt: 30 },
      { kind: 'pinwheel', x: 520, y: 250, r: 72, spd: 1.5 },
      { kind: 'pinwheel', x: 830, y: 300, r: 60, spd: -2.3 },
      { kind: 'pinwheel', x: 1150, y: 270, r: 70, spd: 1.9, n: 3 }],
    ground: [[0, 400], [320, 400], [360, 360], [700, 360], [740, 420], [760, 440, 's'], [900, 440], [940, 400], [1700, 400]] },
  { name: 'Geyser Gulch', par: 7, w: 2000, tee: [120, 420], cup: [1700, 260], tip: 'Ride the geysers up the gulch!',
    obs: [{ kind: 'geyser', x: 455, h: 230, period: 3 },
      { kind: 'geyser', x: 650, h: 220, period: 3.4, off: 1 },
      { kind: 'cloud', x: 1000, y: 390, w: 110, h: 24, dx: 70, spd: 1 },
      { kind: 'wind', x: 930, y: 150, w: 300, h: 300, fx: 420 },
      { kind: 'geyser', x: 1265, h: 260, period: 3.2, off: 2 }],
    ground: [[0, 420], [300, 420], [330, 470], [350, 490, 'l'], [560, 490], [580, 470], [600, 420], [700, 420], [730, 300], [900, 300], [930, 470], [950, 490, 'l'], [1200, 490], [1230, 420], [1300, 420], [1330, 260], [2000, 260]] }
];
