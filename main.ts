// "The World in One Day" — Friday 27 November 2026 world news in one image.
// Draws a 1024x1024 morning front page entirely in code and writes it to
// /output/entry.png (or $MAKEFUN_OUTPUT_DIR/entry.png locally).
// Node 22 standard library only. No network. Fully deterministic: the same
// bytes are written on every run.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

// ---- palette (ivory morning front page) ----
const PAPER: [number, number, number] = [247, 242, 231];
const PAPER2: [number, number, number] = [238, 231, 214];
const INK: [number, number, number] = [30, 27, 22];
const CRIMSON: [number, number, number] = [166, 30, 34];
const CRIMSON_DK: [number, number, number] = [122, 20, 25];
const CHARCOAL: [number, number, number] = [38, 36, 33];
const GREY: [number, number, number] = [107, 101, 90];
const LINE: [number, number, number] = [196, 186, 166];
const TEAL: [number, number, number] = [15, 107, 107];
const AMBER: [number, number, number] = [201, 138, 27];
const NAVY: [number, number, number] = [31, 58, 95];
const SKY: [number, number, number] = [126, 164, 196];
const WHITE: [number, number, number] = [255, 255, 255];
const RED: [number, number, number] = [200, 40, 30];
const ORANGE: [number, number, number] = [232, 116, 30];
const GOLD: [number, number, number] = [226, 178, 44];
const GREEN: [number, number, number] = [46, 125, 62];

type RGB = [number, number, number];

// ---- framebuffer ----
const fb = new Uint8Array(W * H * 3);
let clipX0 = 0;
let clipY0 = 0;
let clipX1 = W;
let clipY1 = H;

function setClip(x: number, y: number, w: number, h: number): void {
  clipX0 = Math.max(0, x);
  clipY0 = Math.max(0, y);
  clipX1 = Math.min(W, x + w);
  clipY1 = Math.min(H, y + h);
}
function resetClip(): void {
  clipX0 = 0;
  clipY0 = 0;
  clipX1 = W;
  clipY1 = H;
}
function px(x: number, y: number, c: RGB): void {
  if (x < clipX0 || x >= clipX1 || y < clipY0 || y >= clipY1) return;
  const i = (y * W + x) * 3;
  fb[i] = c[0];
  fb[i + 1] = c[1];
  fb[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(clipX0, x);
  const y0 = Math.max(clipY0, y);
  const x1 = Math.min(clipX1, x + w);
  const y1 = Math.min(clipY1, y + h);
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      fb[i] = c[0];
      fb[i + 1] = c[1];
      fb[i + 2] = c[2];
      i += 3;
    }
  }
}
function hline(x: number, y: number, w: number, c: RGB): void {
  rect(x, y, w, 1, c);
}
function vline(x: number, y: number, h: number, c: RGB): void {
  rect(x, y, 1, h, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    px(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
function circle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const dx = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -dx; x <= dx; x++) px(cx + x, cy + y, c);
  }
}
function ring(cx: number, cy: number, r: number, c: RGB): void {
  for (let a = 0; a < 360; a += 2) {
    const t = (a * Math.PI) / 180;
    px(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), c);
  }
}
function poly(points: [number, number][], c: RGB): void {
  if (points.length < 3) return;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of points) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[(i + 1) % points.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) px(x, y, c);
    }
  }
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  poly([[x0, y0], [x1, y1], [x2, y2]], c);
}
function burst(cx: number, cy: number, r1: number, r2: number, spikes: number, c: RGB): void {
  const pts: [number, number][] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    const t = (i * Math.PI) / spikes;
    pts.push([Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t))]);
  }
  poly(pts, c);
}

// ---- 5x7 bitmap font (hand-defined, capitals + digits + punctuation) ----
// Each glyph is 7 rows of 5 bits, "1" = ink. All text is uppercased first.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "*": ["00000", "10101", "01110", "10101", "00000", "00000", "00000"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  "@": ["01110", "10001", "10111", "10101", "10110", "10000", "01110"],
  "\u00b7": ["00000", "00000", "00000", "01100", "01100", "00000", "00000"],
};

function glyph(ch: string): string[] {
  return FONT[ch] ?? FONT["?"];
}
function textWidth(s: string, scale: number): number {
  const up = s.toUpperCase();
  return up.length * 6 * scale - scale;
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  const up = s.toUpperCase();
  let cx = x;
  for (const ch of up) {
    const g = glyph(ch);
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "1") rect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 6 * scale;
  }
}
function drawTextCenter(x: number, y: number, w: number, s: string, scale: number, c: RGB): void {
  const tw = textWidth(s, scale);
  drawText(x + Math.max(0, Math.floor((w - tw) / 2)), y, s, scale, c);
}
// Greedy word wrap. Returns lines actually drawn.
function drawWrapped(x: number, y: number, maxW: number, s: string, scale: number, c: RGB, maxLines: number): number {
  const words = s.toUpperCase().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (textWidth(trial, scale) <= maxW || !cur) cur = trial;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, maxLines);
  const lh = 8 * scale + 2;
  shown.forEach((ln, i) => drawText(x, y + i * lh, ln, scale, c));
  return shown.length;
}
function chip(x: number, y: number, label: string, bg: RGB, fg: RGB): number {
  const w = textWidth(label, 1) + 10;
  rect(x, y, w, 13, bg);
  drawText(x + 5, y + 3, label, 1, fg);
  return w;
}

// ---- drawn scenes (flat vector illustrations, one per story) ----
function drawScene(id: string, x: number, y: number, w: number, h: number): void {
  setClip(x, y, w, h);
  const cx = x + Math.floor(w / 2);
  const cy = y + Math.floor(h / 2);
  switch (id) {
    case "storm": {
      // Rainy New York skyline, grounded red parade balloon, grey storm sky.
      rect(x, y, w, h, NAVY);
      rect(x, y + h - 26, w, 26, [22, 32, 52]);
      const towers = [0.05, 0.16, 0.3, 0.42, 0.55, 0.68, 0.8, 0.9];
      const ths = [0.55, 0.38, 0.62, 0.45, 0.7, 0.5, 0.58, 0.42];
      for (let i = 0; i < towers.length; i++) {
        const tw = Math.floor(w * 0.09);
        const tx = x + Math.floor(w * towers[i]);
        const th = Math.floor(h * ths[i]);
        rect(tx, y + h - 26 - th, tw, th, [52, 66, 92]);
        for (let wy = y + h - 22 - th; wy < y + h - 30; wy += 9) {
          for (let wx = tx + 3; wx < tx + tw - 3; wx += 8) px(wx, wy, GOLD);
        }
      }
      // grounded balloon, low and tilted, ropes slack, "100" badge
      circle(cx - 6, y + 34, 26, CRIMSON);
      circle(cx - 6, y + 34, 17, [196, 64, 64]);
      tri(cx - 32, y + 34, cx - 6, y + 8, cx + 18, y + 34, CRIMSON);
      drawText(cx - 15, y + 31, "100", 1, WHITE);
      rect(cx - 12, y + 62, 12, 8, [222, 196, 150]);
      line(cx - 30, y + 56, cx - 44, y + h - 30, WHITE);
      line(cx + 16, y + 56, cx + 34, y + h - 30, WHITE);
      // rain streaks
      for (let i = 0; i < 46; i++) {
        const rx = x + ((i * 37) % w);
        const ry = y + ((i * 53) % (h - 40));
        line(rx, ry, rx - 3, ry + 9, SKY);
      }
      break;
    }
    case "tariffs": {
      // Rising tariff bars over a globe, with a big percent mark.
      rect(x, y, w, h, PAPER2);
      circle(cx + 8, cy - 4, 26, TEAL);
      poly([[cx - 14, cy - 18], [cx - 2, cy - 10], [cx + 6, cy - 16], [cx + 14, cy - 6], [cx + 30, cy - 14], [cx + 30, cy + 20], [cx - 14, cy + 20]], [58, 138, 122]);
      const bars = [0.3, 0.45, 0.38, 0.62, 0.8];
      for (let i = 0; i < bars.length; i++) {
        const bw = Math.floor(w * 0.1);
        const bx = x + 12 + i * Math.floor(w * 0.17);
        const bh = Math.floor(h * bars[i]);
        rect(bx, y + h - 8 - bh, bw, bh, i === 4 ? CRIMSON : AMBER);
      }
      rect(x, y + h - 8, w, 2, INK);
      break;
    }
    case "tanker": {
      // Burning fuel tanker on a desert road at dusk.
      rect(x, y, w, h, [214, 176, 120]);
      circle(x + w - 18, y + 16, 12, GOLD);
      rect(x, y + h - 26, w, 26, [90, 74, 60]);
      rect(x, y + h - 16, w, 4, [60, 50, 42]);
      // tanker body
      rect(x + 14, y + h - 52, w - 60, 20, [196, 196, 190]);
      circle(x + 26, y + h - 32, 7, INK);
      circle(x + w - 58, y + h - 32, 7, INK);
      // flames
      burst(cx - 8, y + h - 56, 22, 11, 8, ORANGE);
      burst(cx - 8, y + h - 56, 13, 6, 8, GOLD);
      burst(cx + 26, y + h - 58, 14, 7, 7, ORANGE);
      // smoke
      circle(cx - 22, y + 18, 9, [80, 80, 80]);
      circle(cx - 6, y + 10, 12, [100, 100, 100]);
      circle(cx + 12, y + 18, 8, [80, 80, 80]);
      break;
    }
    case "refinery": {
      rect(x, y, w, h, [52, 58, 74]);
      rect(x + 10, y + 12, 12, h - 30, [120, 124, 132]);
      rect(x + 30, y + 22, 10, h - 40, [120, 124, 132]);
      rect(x + 48, y + 8, 16, h - 26, [140, 144, 152]);
      rect(x + 8, y + h - 18, w - 16, 4, [90, 94, 104]);
      burst(cx + 20, y + 22, 16, 8, 7, ORANGE);
      burst(cx + 20, y + 22, 9, 4, 7, GOLD);
      circle(cx - 14, y + 10, 7, [90, 90, 90]);
      circle(cx - 2, y + 6, 9, [110, 110, 110]);
      break;
    }
    case "nukes": {
      rect(x, y, w, h, [40, 46, 60]);
      // missile on a launcher, angled up
      line(cx - 26, cy + 18, cx + 22, cy - 22, [210, 210, 205]);
      line(cx - 22, cy + 22, cx + 26, cy - 18, [210, 210, 205]);
      tri(cx + 22, cy - 22, cx + 34, cy - 16, cx + 26, cy - 8, [210, 210, 205]);
      burst(cx - 28, cy + 20, 12, 6, 6, ORANGE);
      rect(x + 8, y + h - 12, w - 16, 6, [70, 76, 88]);
      circle(cx + 30, y + 14, 6, GOLD);
      circle(x + 16, y + 16, 4, GOLD);
      break;
    }
    case "kyiv": {
      rect(x, y, w, h, [58, 72, 96]);
      const ths = [0.5, 0.65, 0.42, 0.58, 0.36];
      for (let i = 0; i < 5; i++) {
        const tw = Math.floor(w * 0.14);
        const tx = x + 8 + i * Math.floor(w * 0.19);
        const th = Math.floor(h * ths[i]);
        rect(tx, y + h - 14 - th, tw, th, [36, 44, 62]);
      }
      // missile trail + blast
      line(x + 8, y + 8, cx + 6, cy - 6, WHITE);
      burst(cx + 8, cy - 4, 18, 9, 8, GOLD);
      burst(cx + 8, cy - 4, 10, 5, 8, ORANGE);
      circle(cx + 26, y + 12, 5, [90, 90, 90]);
      break;
    }
    case "intercept": {
      rect(x, y, w, h, [24, 34, 58]);
      line(x + 6, y + h - 10, cx, cy - 8, [232, 116, 30]);
      line(x + w - 6, y + h - 10, cx, cy - 8, [120, 180, 220]);
      burst(cx, cy - 10, 16, 8, 8, GOLD);
      burst(cx, cy - 10, 8, 4, 8, WHITE);
      circle(x + 14, y + 12, 3, WHITE);
      circle(x + w - 20, y + 16, 3, WHITE);
      circle(cx, y + 8, 2, WHITE);
      break;
    }
    case "budget": {
      rect(x, y, w, h, NAVY);
      // circle of stars
      for (let i = 0; i < 12; i++) {
        const t = (i * Math.PI) / 6;
        const sx = Math.round(cx - 14 + 22 * Math.cos(t));
        const sy = Math.round(cy - 4 + 22 * Math.sin(t));
        burst(sx, sy, 4, 2, 5, GOLD);
      }
      circle(cx - 14, cy - 4, 10, GOLD);
      drawText(cx - 18, cy - 7, "E", 1, NAVY);
      rect(x + w - 34, y + h - 26, 24, 16, GOLD);
      rect(x + w - 30, y + h - 22, 16, 8, [176, 132, 26]);
      break;
    }
    case "blackfriday": {
      rect(x, y, w, h, [30, 30, 34]);
      // shopping bag
      poly([[cx - 16, cy - 6], [cx + 16, cy - 6], [cx + 12, cy + 18], [cx - 12, cy + 18]], CRIMSON);
      line(cx - 8, cy - 6, cx - 8, cy - 14, WHITE);
      line(cx + 8, cy - 6, cx + 8, cy - 14, WHITE);
      line(cx - 8, cy - 14, cx + 8, cy - 14, WHITE);
      // percent tag
      circle(cx + 22, cy - 12, 10, GOLD);
      drawText(cx + 18, cy - 15, "%", 1, INK);
      break;
    }
    case "sinner": {
      rect(x, y, w, h, [58, 122, 72]);
      rect(x, y + 10, w, 2, WHITE);
      rect(x, y + h - 10, w, 2, WHITE);
      vline(cx, y + 10, h - 20, WHITE);
      circle(cx + 16, cy - 6, 7, [190, 230, 90]);
      line(cx - 22, cy + 12, cx - 6, cy - 10, [220, 220, 220]);
      circle(cx - 24, cy + 14, 5, [220, 220, 220]);
      break;
    }
    case "cricket": {
      rect(x, y, w, h, [74, 128, 66]);
      // stumps
      vline(cx + 18, cy - 4, 16, GOLD);
      vline(cx + 23, cy - 4, 16, GOLD);
      vline(cx + 28, cy - 4, 16, GOLD);
      hline(cx + 18, cy - 5, 12, GOLD);
      // bat + ball
      line(cx - 20, cy + 16, cx - 2, cy - 12, [222, 196, 150]);
      rect(cx - 6, cy - 16, 7, 10, [222, 196, 150]);
      circle(cx - 26, cy - 16, 6, CRIMSON);
      break;
    }
    case "fcc": {
      rect(x, y, w, h, PAPER2);
      rect(x + 10, y + 10, w - 20, h - 26, CHARCOAL);
      rect(x + 14, y + 14, w - 28, h - 34, [120, 170, 200]);
      drawText(cx - 10, cy - 8, "ABC", 2, WHITE);
      rect(cx - 16, y + h - 12, 32, 3, CHARCOAL);
      break;
    }
    default: {
      rect(x, y, w, h, PAPER2);
      break;
    }
  }
  resetClip();
}

// ---- story data ----
interface Card {
  scene: string;
  region: string;
  regionColor: RGB;
  headline: string;
  summary: string;
  source: string;
  status: string;
}
const REGION_COLORS: Record<string, RGB> = {
  "N. AMERICA": [31, 58, 95],
  EUROPE: [15, 107, 107],
  "MIDDLE EAST": [166, 30, 34],
  ASIA: [201, 138, 27],
  AFRICA: [122, 84, 20],
  OCEANIA: [46, 125, 62],
  WORLD: [90, 80, 110],
};

const GRID: Card[] = [
  { scene: "refinery", region: "ASIA", regionColor: REGION_COLORS.ASIA, headline: "Bangkok refinery blast injures nine", summary: "Fire at a Bangchak oil refinery sends smoke over the city; three are critical.", source: "BANGKOK POST", status: "CONFIRMED" },
  { scene: "nukes", region: "ASIA", regionColor: REGION_COLORS.ASIA, headline: "Kim vows more nuclear weapons", summary: "North Korea's leader pledges a bigger arsenal, ignoring Trump's overture.", source: "REUTERS", status: "REPORTED" },
  { scene: "kyiv", region: "EUROPE", regionColor: REGION_COLORS.EUROPE, headline: "Russian missiles hit Kyiv", summary: "Ballistic missiles strike the capital, the mayor says, as the war grinds on.", source: "KYIV MAYOR", status: "CONFIRMED" },
  { scene: "intercept", region: "MIDDLE EAST", regionColor: REGION_COLORS["MIDDLE EAST"], headline: "Saudi stops two Houthi missiles", summary: "Ballistic missiles fired toward Riyadh are intercepted in the sky.", source: "SAUDI PRESS", status: "CONFIRMED" },
  { scene: "budget", region: "EUROPE", regionColor: REGION_COLORS.EUROPE, headline: "EU weighs EUR 1.6 trillion budget", summary: "Leaders debate the 2028-2034 budget and fresh funding for Ukraine.", source: "EU COUNCIL", status: "ONGOING" },
  { scene: "blackfriday", region: "WORLD", regionColor: REGION_COLORS.WORLD, headline: "Black Friday: half the deals are not deals", summary: "One in three retailers raise sales, but half of tracked goods cost the same or more.", source: "CONSUMER NZ", status: "REPORTED" },
  { scene: "sinner", region: "OCEANIA", regionColor: REGION_COLORS.OCEANIA, headline: "Sinner out of Australian Open 2027", summary: "The world No. 1 withdraws with a knee injury, shaking up the first Slam.", source: "ATP", status: "CONFIRMED" },
  { scene: "cricket", region: "ASIA", regionColor: REGION_COLORS.ASIA, headline: "Sooryavanshi smashes 204 off 53 balls", summary: "India's 19-year-old makes history against the UAE in the Rising Stars Cup.", source: "ASIA CUP", status: "CONFIRMED" },
  { scene: "fcc", region: "N. AMERICA", regionColor: REGION_COLORS["N. AMERICA"], headline: "Judge: FCC violated ABC's free speech", summary: "A federal judge blocks Trump from challenging ABC's broadcast licences.", source: "NPR", status: "CONFIRMED" },
];

const ALSO: string[] = [
  "NZ coalition keeps slim 67/131 majority",
  "China: border with India 'stable'",
  "Ramaphosa wins impeachment court bid",
  "US Army hails Iowa explosives success",
  "New UK-EU treaty has 10-year clause",
  "Government to publish Mandelson papers",
  "SpaceX million-satellite plan approved",
  "UK signs GBP 8bn submarine deal",
  "Flipkart CEO Krishnamurthy steps down",
  "Indonesia mine rescue search goes on",
  "Karachi collapse kills 3, injures 14",
  "Fresh Gaza attacks raise ceasefire fears",
  "Yemen humanitarian crisis deepens",
  "Pakistan plans astronaut China trip",
  "India A v Sri Lanka A in Rising Stars",
  "Pankaj Advani wins Crucible Cup",
  "Hera spacecraft, Claude Opus 5.6",
  "Barrett to captain All Blacks first time",
];

const TIMELINE: [string, string][] = [
  ["00:00", "CAIRO TOLL AT 31"],
  ["04:30", "BANGKOK BLAST"],
  ["07:00", "PARADE MOVED"],
  ["12:00", "TARIFFS UNVEILED"],
  ["15:00", "EU BUDGET TALKS"],
  ["20:00", "KIM'S VOW"],
];

const STALE: string[] = [
  "COP31 ends without a pact (22 Nov)",
  "Democrats clinch 258 House seats (23 Nov)",
  "US-India tariff proposal (25 Nov)",
  "Pakistan astronaut boards Tiangong (25 Nov)",
  "Solomon Islands-Australia treaty (25 Nov)",
];

// ---- layout ----
function drawMasthead(): void {
  rect(0, 0, W, 8, CRIMSON);
  drawTextCenter(0, 20, W, "THE WORLD IN ONE DAY", 4, INK);
  rect(16, 58, W - 32, 2, CRIMSON);
  drawTextCenter(0, 66, W, "FRIDAY \u00b7 27 NOVEMBER 2026", 2, CRIMSON);
  drawText(W - 260, 66, "MORNING EDITION", 1, GREY);
  drawText(W - 260, 78, "30 STORIES", 1, GREY);
  rect(0, 86, W, 24, CHARCOAL);
  drawText(16, 94, "30 STORIES \u00b7 7 REGIONS \u00b7 20 SOURCES", 1, PAPER);
  drawText(560, 94, "EVERY STORY HERE WAS IN THE NEWS ON FRIDAY 27 NOVEMBER 2026.", 1, [200, 190, 170]);
}

function drawLead(): void {
  const lx = 16;
  const lw = 544;
  const rx = 576;
  const rw = 432;
  // left: big storm scene + headline + dek
  drawScene("storm", lx, 118, lw, 176);
  rect(lx, 294, lw, 2, CRIMSON);
  drawWrapped(lx, 304, lw, "Storm stops a century of parades", 2, INK, 2);
  drawWrapped(lx, 342, lw, "New York moves the 100th Macy's Thanksgiving Day Parade to Saturday - the first postponement in 100 years - as 60 mph gusts, heavy rain and coastal flooding sweep the US. More than 500,000 homes lose power and hundreds of flights are cancelled on the busiest travel day of the year.", 1, CHARCOAL, 4);
  chip(lx, 408, "N. AMERICA", REGION_COLORS["N. AMERICA"], WHITE);
  drawText(lx + 92, 411, "NPR \u00b7 CONFIRMED", 1, GREY);

  // right: two stacked secondary leads
  const leads: [string, string, string, string, string, string][] = [
    ["tariffs", "Trump unveils tariffs on 14 partners", "China up to 40%, Vietnam 35%, EU 20-25% under Section 301, after the Supreme Court struck down the earlier tariffs.", "NPR", "REPORTED", "N. AMERICA"],
    ["tanker", "Cairo tanker fire kills at least 31", "A fuel tanker overturns on the Ring Road and burns 27 vehicles; 21 are injured and the driver is detained.", "EGYPT HEALTH MINISTRY", "CONFIRMED", "AFRICA"],
  ];
  let y = 118;
  for (const [scene, head, sum, src, status, region] of leads) {
    rect(rx, y, rw, 146, PAPER2);
    rect(rx, y, rw, 1, LINE);
    drawScene(scene, rx + 8, y + 8, 130, 62);
    drawWrapped(rx + 146, y + 8, rw - 154, head, 2, INK, 2);
    drawWrapped(rx + 146, y + 44, rw - 154, sum, 1, CHARCOAL, 3);
    chip(rx + 8, y + 122, region, REGION_COLORS[region], WHITE);
    drawText(rx + 8 + textWidth(region, 1) + 16, y + 125, src + " \u00b7 " + status, 1, GREY);
    y += 154;
  }
}

function drawGrid(): void {
  const gx = 16;
  const gy = 424;
  const cw = 320;
  const ch = 88;
  const gap = 8;
  for (let i = 0; i < GRID.length; i++) {
    const c = GRID[i];
    const x = gx + (i % 3) * (cw + gap);
    const y = gy + Math.floor(i / 3) * (ch + gap);
    rect(x, y, cw, ch, PAPER2);
    rect(x, y, cw, 2, c.regionColor);
    drawScene(c.scene, x, y + 2, 92, 62);
    drawWrapped(x + 100, y + 6, cw - 108, c.headline, 1, INK, 2);
    drawText(x + 100, y + 26, c.source + " \u00b7 " + c.status, 1, GREY);
    drawWrapped(x + 100, y + 38, cw - 108, c.summary, 1, CHARCOAL, 3);
    chip(x, y + 68, c.region, c.regionColor, WHITE);
  }
}

function drawTimeline(): void {
  const y = 712;
  rect(0, y, W, 2, INK);
  rect(0, y + 2, W, 38, PAPER2);
  const slot = Math.floor(W / TIMELINE.length);
  for (let i = 0; i < TIMELINE.length; i++) {
    const [t, label] = TIMELINE[i];
    const x = i * slot;
    drawText(x + 16, y + 8, t, 1, CRIMSON);
    drawText(x + 16, y + 20, label, 1, INK);
    if (i > 0) vline(x, y + 6, 28, LINE);
  }
  rect(0, y + 40, W, 2, INK);
}

function drawMapAndAlso(): void {
  const y0 = 760;
  const y1 = 906;
  // map panel
  const mx = 16;
  const mw = 440;
  rect(mx, y0, mw, y1 - y0, [226, 236, 240]);
  rect(mx, y0, mw, 2, TEAL);
  drawText(mx + 10, y0 + 8, "WHERE IT HAPPENED", 1, TEAL);
  const continents: [number, number][][] = [
    [[0.02, 0.2], [0.1, 0.08], [0.22, 0.1], [0.26, 0.22], [0.2, 0.34], [0.14, 0.46], [0.08, 0.42], [0.03, 0.3]],
    [[0.24, 0.52], [0.3, 0.5], [0.33, 0.6], [0.3, 0.76], [0.26, 0.72], [0.23, 0.6]],
    [[0.46, 0.14], [0.52, 0.1], [0.56, 0.16], [0.54, 0.24], [0.48, 0.24], [0.45, 0.18]],
    [[0.47, 0.36], [0.55, 0.34], [0.58, 0.44], [0.55, 0.6], [0.5, 0.62], [0.47, 0.48]],
    [[0.56, 0.1], [0.72, 0.06], [0.88, 0.12], [0.92, 0.24], [0.85, 0.34], [0.72, 0.36], [0.62, 0.32], [0.56, 0.22]],
    [[0.82, 0.66], [0.9, 0.64], [0.93, 0.72], [0.88, 0.78], [0.83, 0.74]],
  ];
  const mapX = mx + 8;
  const mapY = y0 + 26;
  const mapW = mw - 16;
  const mapH = y1 - y0 - 32;
  for (const cont of continents) {
    poly(cont.map(([nx, ny]) => [Math.round(mapX + nx * mapW), Math.round(mapY + ny * mapH)] as [number, number]), [140, 158, 148]);
  }
  const pins: [number, number, string][] = [
    [0.21, 0.24, "1"], [0.19, 0.3, "2"], [0.52, 0.42, "3"], [0.76, 0.4, "4"],
    [0.86, 0.26, "5"], [0.55, 0.2, "6"], [0.6, 0.38, "7"], [0.48, 0.18, "8"], [0.89, 0.7, "9"],
  ];
  for (const [nx, ny, n] of pins) {
    const px0 = Math.round(mapX + nx * mapW);
    const py0 = Math.round(mapY + ny * mapH);
    circle(px0, py0, 8, CRIMSON);
    drawText(px0 - 2, py0 - 3, n, 1, WHITE);
  }
  drawText(mx + 10, y1 - 14, "1 NEW YORK  2 WASHINGTON  3 CAIRO  4 BANGKOK  5 PYONGYANG", 1, GREY);
  // and also list
  const ax = 472;
  const aw = 1024 - 16 - ax;
  rect(ax, y0, aw, 2, TEAL);
  drawText(ax, y0 + 8, "AND ALSO - STORIES 13-30", 1, TEAL);
  for (let i = 0; i < ALSO.length; i++) {
    const col = i < 9 ? 0 : 1;
    const row = i % 9;
    const x = ax + col * Math.floor(aw / 2);
    const y = y0 + 26 + row * 15;
    drawText(x, y, String(13 + i) + ".", 1, CRIMSON);
    drawWrapped(x + 20, y, Math.floor(aw / 2) - 24, ALSO[i], 1, CHARCOAL, 1);
  }
}

function drawDateCheck(): void {
  const y0 = 914;
  rect(16, y0, W - 32, 56, [250, 238, 232]);
  rect(16, y0, W - 32, 2, CRIMSON);
  rect(16, y0, 2, 56, CRIMSON);
  rect(W - 18, y0, 2, 56, CRIMSON);
  rect(16, y0 + 54, W - 32, 2, CRIMSON);
  drawText(26, y0 + 8, "DATE CHECK - THESE ARE NOT 27 NOVEMBER, SO THEY ARE NOT IN THIS PAPER:", 1, CRIMSON_DK);
  const per = Math.ceil(STALE.length / 2);
  for (let i = 0; i < STALE.length; i++) {
    const col = i < per ? 0 : 1;
    const row = i % per;
    drawText(26 + col * 480, y0 + 24 + row * 11, "\u00b7 " + STALE[i], 1, CHARCOAL);
  }
  drawTextCenter(0, 978, W, "SCENES ARE DRAWN ILLUSTRATIONS, NOT PHOTOGRAPHS. SOURCES ARE NAMED ON EACH STORY.", 1, GREY);
  drawTextCenter(0, 992, W, "THE WORLD IN ONE DAY \u00b7 FRIDAY 27 NOVEMBER 2026 \u00b7 MORNING EDITION", 1, GREY);
}

// ---- deterministic PNG encoder (no timestamps) ----
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, "ascii"), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}
function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter none
    raw.set(fb.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- main ----
function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  // Clear only the CONTENTS of the output dir, never the dir itself.
  mkdirSync(outDir, { recursive: true });
  for (const name of readdirSync(outDir)) {
    rmSync(outDir + "/" + name, { recursive: true, force: true });
  }
  rect(0, 0, W, H, PAPER);
  drawMasthead();
  drawLead();
  drawGrid();
  drawTimeline();
  drawMapAndAlso();
  drawDateCheck();
  const png = encodePNG();
  writeFileSync(outDir + "/entry.png", png);
}

main();
