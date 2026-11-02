// Starcatch Valley: tuning knobs and game content.
//
// Plain constants read by src/game.js. Distances are world units along the
// course; the player cruises at BASE units/second.
"use strict";

const RACE_LEN = 3600;
const BASE = 36;
const CRUISE_Y = 24;
const LIM_X = 15, LIM_Y = 10;
const MAXV_X = 22, MAXV_Y = 17;
const STAR_R = 4.6;
const SLOTS = [[-8.5, 6], [8.5, 6], [-8.5, -6], [8.5, -6]];   // up-left, up-right, down-left, down-right
const BOOST_MULT = 1.75, BOOST_T = 3.0;
const SLOW_MULT = 0.7,  SLOW_T = 1.3;
const PER_STAR = 10;
const THINK = {easy:7.6, normal:6.2, hard:5.0};
const FEEDBACK = 0.9;           // seconds the right/wrong marks stay before the next question shows
const CPU_START = 40;
const CPU_ACC = {easy:[.70,.60,.54,.45], normal:[.80,.72,.65,.56], hard:[.87,.80,.74,.64]};
const CPU_DEF = [
  {name:"Zephyr", emoji:"🦅", base:.985, body:0x4A3220, wing:0x36241A, head:0xF0ECE2, beak:0xF2C230, lane:-12},
  {name:"Pip",    emoji:"🐦", base:.972, body:0x3F6FC8, wing:0x2A52A0, head:0x4A7AD2, beak:0x2A2A2A, lane:-4},
  {name:"Sunny",  emoji:"🦜", base:.962, body:0x2FAE4A, wing:0xD4342C, head:0xF0CF3A, beak:0x2A2A2A, lane:4},
  {name:"Hoot",   emoji:"🦉", base:.950, body:0x9C7A55, wing:0x6E5236, head:0xAA8862, beak:0x4A3A2A, lane:12}
];
const BIRDS = ["🕊️","🦢","🦩","🦆","🦚","🐤","🐦‍⬛"];
const OPS = {
  add:{label:"Adding", sym:"+"}, sub:{label:"Subtracting", sym:"−"},
  mul:{label:"Multiplying", sym:"×"}, div:{label:"Dividing", sym:"÷"}
};
const DIFF_NOTES = {
  add:{easy:"Sums inside 20.", normal:"Two-digit sums with regrouping.", hard:"Three-digit plus two-digit."},
  sub:{easy:"Differences inside 20.", normal:"Two-digit take-away, no negatives.", hard:"Three-digit take-away."},
  mul:{easy:"Times tables through 5.", normal:"The full grid to 12 × 12.", hard:"Two-digit × one-digit."},
  div:{easy:"Facts from the 2s to 5s.", normal:"Facts to 144 ÷ 12.", hard:"Quotients past 12."}
};
const TIME_NOTES = {easy:"About 7–9 seconds per question.", normal:"About 5–7 seconds per question.", hard:"About 4–6 seconds per question."};
const RAINBOW = ["#FF3B6B","#FF9F1C","#FFE66D","#4BD9A0","#3A86FF","#B15CFF","#FF6FD8"];
const STORE_KEY = "starcatch.sky.v1";
