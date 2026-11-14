/* trophies.js — 트로피 전시관용 도트 우승컵 (코드로 그리는 도트 스프라이트)
   리그 우승(은빛 컵) < MSI(황금 날개 컵) < 월드 챔피언십(왕관·지구본·대리석 단상)  순으로 더 크고 화려합니다.
   TrophyArt.url(kind) → 도트 PNG(dataURL), TrophyArt.size(kind) → {w,h} (도트 단위). kind: 'league' | 'msi' | 'worlds' */

const TrophyArt = (() => {
  const OUT = '#170d2b';
  const GOLD = ['#fffbd6', '#ffe47c', '#f3b82f', '#c1801a', '#7c4a0a'];
  const SILV = ['#ffffff', '#e2ecf8', '#b4c3d9', '#7d8ca8', '#47536f'];
  const MARB = ['#f6f2ff', '#d3cbee', '#a89fcb', '#7b71a5', '#4c4372'];
  const BLUE = ['#d8f3ff', '#7cc4ff', '#2b78d8', '#1b4aa0'];
  const RUBY = ['#ffd0d6', '#ff5a72', '#d01a3c', '#7d0a22'];
  const DIAM = ['#ffffff', '#b9f3ff', '#5fd0f2', '#2a8ab8'];
  const tone = (pal, u) => (u < 0.12 ? pal[0] : u < 0.36 ? pal[1] : u < 0.68 ? pal[2] : u < 0.88 ? pal[3] : pal[4]);

  const mk = (W, H) => ({ W, H, cx: (W - 1) / 2, p: Array.from({ length: H }, () => Array(W).fill(null)) });
  const put = (c, x, y, col) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < c.W && y >= 0 && y < c.H) c.p[y][x] = col; };
  const span = (c, y, half, pal, ox = 0) => {
    const x0 = Math.round(c.cx + ox - half), x1 = Math.round(c.cx + ox + half);
    for (let x = x0; x <= x1; x++) put(c, x, y, tone(pal, x1 === x0 ? 0.4 : (x - x0) / (x1 - x0)));
  };
  const rows = (c, y0, y1, fn, pal) => { for (let y = y0; y <= y1; y++) span(c, y, fn(y), pal); };
  const gem = (c, x, y, r, g) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const d = Math.abs(dx) + Math.abs(dy); if (d <= r) put(c, x + dx, y + dy, d >= r && r > 0 ? g[2] : (dx + dy <= -1 ? g[0] : dx + dy <= 0 ? g[1] : g[2])); } if (r > 0) put(c, x, y, g[1]); };
  const stamp = (c, x, y, s, pal) => { for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) put(c, x + i - (s >> 1), y + j - (s >> 1), tone(pal, (i + 0.5) / s)); };
  const sparkle = (c, x, y, big) => { put(c, x, y, '#ffffff'); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => put(c, x + a, y + b, '#fff3b0')); if (big) [[2, 0], [-2, 0], [0, 2], [0, -2]].forEach(([a, b]) => put(c, x + a, y + b, '#ffe27a')); };
  const outline = c => {
    const q = c.p.map(r => r.slice());
    for (let y = 0; y < c.H; y++) for (let x = 0; x < c.W; x++) if (!c.p[y][x]) {
      if ((y > 0 && c.p[y - 1][x]) || (y < c.H - 1 && c.p[y + 1][x]) || (x > 0 && c.p[y][x - 1]) || (x < c.W - 1 && c.p[y][x + 1])) q[y][x] = OUT;
    }
    c.p = q; return c;
  };
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const ring = (c, cx, cy, r0, r1, pal, keep) => { for (let y = Math.floor(cy - r1); y <= cy + r1; y++) for (let x = Math.floor(cx - r1); x <= cx + r1; x++) { const d = Math.hypot(x - cx, y - cy); if (d >= r0 && d <= r1 && (!keep || keep(x, y))) put(c, x, y, tone(pal, (x - (cx - r1)) / (2 * r1))); } };

  /* ---------- 리그 우승: 은빛 컵 ---------- */
  function league() {
    const c = mk(27, 33), cx = 13;
    rows(c, 28, 32, y => (y < 30 ? 10 : 11), MARB);                       // 대리석 받침
    rows(c, 26, 27, () => 8, MARB); rows(c, 25, 25, () => 6, GOLD);
    for (let x = cx - 4; x <= cx + 4; x++) put(c, x, 30, tone(GOLD, (x - cx + 4) / 8));   // 명판
    rows(c, 19, 24, y => (y === 21 ? 3 : 1), SILV);                        // 줄기 + 매듭
    rows(c, 17, 18, y => (y === 17 ? 4 : 3), SILV);
    rows(c, 4, 16, y => Math.round(9 - 5 * Math.pow((y - 4) / 12, 1.35)), SILV);   // 컵 몸통
    span(c, 2, 10, GOLD); span(c, 3, 10, GOLD);                             // 금 테두리
    for (let x = cx - 8; x <= cx + 8; x += 4) put(c, x, 3, BLUE[1]);
    [-1, 1].forEach(s => ring(c, cx + s * 10.5, 9, 2.4, 4.4, SILV, (x, y) => (s < 0 ? x <= cx - 9 : x >= cx + 9)));   // 손잡이
    gem(c, cx, 9, 3, BLUE); put(c, cx - 1, 8, '#ffffff');                   // 사파이어
    for (let y = 5; y <= 14; y++) put(c, cx - 7 + Math.round((y - 5) * 0.25), y, SILV[0]);   // 반사광
    sparkle(c, 4, 4, false); sparkle(c, 22, 14, false);
    return outline(c);
  }

  /* ---------- MSI: 황금 날개 컵 ---------- */
  function msi() {
    const c = mk(37, 43), cx = 18;
    rows(c, 38, 42, y => 17, MARB); rows(c, 34, 37, y => 14, MARB); rows(c, 31, 33, () => 11, MARB); rows(c, 29, 30, () => 7, GOLD);
    rows(c, 34, 34, () => 14, GOLD); rows(c, 38, 38, () => 17, GOLD);
    for (let x = cx - 12; x <= cx + 12; x += 6) gem(c, x, 36, 1, RUBY);
    for (let x = cx - 14; x <= cx + 14; x += 7) gem(c, x, 40, 1, BLUE);
    for (let x = cx - 5; x <= cx + 5; x++) put(c, x, 41, tone(GOLD, (x - cx + 5) / 10));
    rows(c, 24, 28, y => (y === 26 ? 5 : 2), GOLD);                         // 줄기 + 구슬 매듭
    rows(c, 8, 23, y => Math.round(11 - 5.5 * Math.pow((y - 8) / 15, 1.3)), GOLD);   // 컵 몸통
    rows(c, 5, 7, y => 5 + (y - 5) * 3, GOLD);                              // 뚜껑
    span(c, 7, 12, GOLD); span(c, 8, 12, GOLD);
    rows(c, 2, 4, y => y - 2, GOLD); gem(c, cx, 1, 1, RUBY);                // 꼭대기 장식
    for (let x = cx - 10; x <= cx + 10; x += 4) gem(c, x, 9, 1, RUBY);      // 테두리 루비
    gem(c, cx, 16, 4, RUBY); for (let a = -6; a <= 6; a++) { put(c, cx + a, 11, GOLD[4]); }   // 중앙 대형 루비
    put(c, cx - 2, 14, '#ffffff'); put(c, cx - 1, 14, '#ffd0d6');
    for (let y = 11; y <= 21; y++) { put(c, cx - 8 + Math.round((y - 11) * 0.3), y, GOLD[0]); }
    const feather = [1, 3, 4, 5, 6, 6, 5, 5, 4, 3, 2, 1];                  // 좌우 날개
    [-1, 1].forEach(s => feather.forEach((len, i) => { for (let k = 0; k < len; k++) put(c, cx + s * (12 + k), 11 + i, tone(GOLD, (i % 2 ? 0.3 : 0.6) + k * 0.06)); }));
    [-1, 1].forEach(s => ring(c, cx + s * 12, 18, 2.2, 3.8, GOLD, (x, y) => (s < 0 ? x <= cx - 12 : x >= cx + 12) && y >= 14));  // 손잡이
    sparkle(c, 4, 6, true); sparkle(c, 33, 10, false); sparkle(c, 31, 26, false); sparkle(c, 7, 24, false);
    return outline(c);
  }

  /* ---------- 월드 챔피언십: 왕관 · 지구본 · 대리석 단상 ---------- */
  function worlds() {
    const c = mk(49, 62), cx = 24;
    // 후광 빛줄기(점선)
    for (let a = 0; a < 16; a++) { const ang = a * Math.PI / 8 + 0.1; for (let r = 16; r < 29; r += 2) put(c, cx + Math.cos(ang) * r * 0.95, 26 + Math.sin(ang) * r * 0.9, r < 22 ? '#ffe27a' : '#fff3b0'); }
    // 단상
    rows(c, 55, 61, () => 23, MARB); rows(c, 53, 54, () => 19, GOLD);
    rows(c, 48, 52, () => 17, MARB); rows(c, 46, 47, () => 12, MARB); rows(c, 44, 45, () => 9, GOLD);
    rows(c, 55, 55, () => 23, GOLD); rows(c, 48, 48, () => 17, GOLD);
    for (let x = cx - 20; x <= cx + 20; x += 5) gem(c, x, 58, 1, x % 10 ? RUBY : BLUE);
    for (let x = cx - 14; x <= cx + 14; x += 7) gem(c, x, 50, 1, DIAM);
    for (let x = cx - 8; x <= cx + 8; x++) put(c, x, 60, tone(GOLD, (x - cx + 8) / 16));
    gem(c, cx, 57, 2, DIAM);
    // 기둥
    rows(c, 38, 43, y => (y === 40 ? 5 : 3), GOLD); gem(c, cx, 41, 1, DIAM);
    // 곡선 황금 팔 (지구본을 받침)
    [-1, 1].forEach(s => { for (let t = 0; t <= 1.001; t += 0.02) { const x = cx + s * (5 + 14 * Math.sin(t * Math.PI / 2)), y = 41 - 25 * t; stamp(c, x, y, 3, GOLD); } });
    // 지구본
    const gy = 22, R = 12.5;
    for (let y = gy - 14; y <= gy + 14; y++) for (let x = cx - 14; x <= cx + 14; x++) {
      const d = Math.hypot(x - cx, y - gy); if (d > R) continue;
      const lit = (x - cx) * -0.5 + (y - gy) * -0.6, land = hash(Math.floor(x / 3), Math.floor(y / 3)) > 0.52 && Math.hypot(x - cx, (y - gy) * 1.1) < 10.5;
      let col = land ? (lit > 3 ? '#7bdc6b' : lit > -3 ? '#3fb257' : '#1f7a3f') : (lit > 4 ? '#6cc0ff' : lit > -2 ? '#2f86e6' : lit > -6 ? '#1e56b4' : '#143a82');
      put(c, x, y, col);
    }
    ring(c, cx, gy, R - 0.4, R + 1.4, GOLD); for (let x = cx - 12; x <= cx + 12; x++) put(c, x, gy, tone(GOLD, (x - cx + 12) / 24));
    for (let y = gy - 12; y <= gy + 12; y++) { const x = Math.sqrt(Math.max(0, 1 - Math.pow((y - gy) / R, 2))) * 6; put(c, cx + x, y, GOLD[2]); put(c, cx - x, y, GOLD[1]); }
    [[-6, -7], [-5, -8], [-7, -6]].forEach(([a, b]) => put(c, cx + a, gy + b, '#ffffff'));
    // 왕관
    rows(c, 6, 7, () => 9, GOLD);
    [-8, -4, 0, 4, 8].forEach((x, i) => { const h = i === 2 ? 6 : i % 2 ? 3 : 5; for (let k = 0; k < h; k++) { span(c, 5 - k, k >= h - 2 ? 0 : 1, GOLD, x); } gem(c, cx + x, 5 - h + 1, 0, DIAM); });
    gem(c, cx, 7, 1, RUBY); gem(c, cx - 5, 7, 0, BLUE); gem(c, cx + 5, 7, 0, BLUE);
    sparkle(c, 5, 8, true); sparkle(c, 43, 6, true); sparkle(c, 8, 36, false); sparkle(c, 41, 34, false); sparkle(c, 24, 1, false);
    return outline(c);
  }

  const BUILD = { league, msi, worlds }, cache = {}, urls = {};
  const pixels = k => (cache[k] = cache[k] || BUILD[k]());
  function url(k) {
    if (urls[k]) return urls[k];
    const c = pixels(k), cv = document.createElement('canvas'); cv.width = c.W; cv.height = c.H;
    const cx = cv.getContext('2d'); c.p.forEach((r, y) => r.forEach((col, x) => { if (col) { cx.fillStyle = col; cx.fillRect(x, y, 1, 1); } }));
    return (urls[k] = cv.toDataURL());
  }
  const size = k => { const c = pixels(k); return { w: c.W, h: c.H }; };
  return { url, size, pixels };
})();
if (typeof module !== 'undefined') module.exports = TrophyArt;
