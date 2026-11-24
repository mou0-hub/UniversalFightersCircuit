/* sprites.js — 파이터별 도트 스프라이트 생성 (look 의 색/오버레이를 기본 체형 위에 합성)
   look: { hair, skin, body, acc, hairStyle, feat, weapon }  — 오버레이 문자열은 "x,y,색코드;..." 형식
   look.rows(+pal) 가 있으면 인간 체형 대신 그 도트 그리드(16열)를 그대로 사용합니다.
   색코드: H머리 S피부 B옷 A포인트 L다리 W금속 X강철 K검정 Y금색 P분홍 E눈 R빨강
   파이터에 looks:{폼이름:{...}} 가 있으면 폼이 바뀔 때 해당 외형을 사용합니다 (슈퍼 에일리언, 공중 모드 등). */

const Sprites = (() => {
  const W = 16, H = 20, OX = 2, OY = 4;
  const BASE = [
    '....HHHH....',
    '...HHHHHH...',
    '...HSSSSH...',
    '...SESSES...',
    '...SSSSSS...',
    '....SSSS....',
    '..BBBBBBBB..',
    '.SBBAAAABBS.',
    '.SBBBBBBBBS.',
    '..BBBBBBBB..',
    '..BBB..BBB..',
    '..LL....LL..',
    '..LL....LL..',
    '.LLL....LLL.'
  ];
  const PAL = { W: '#dfe9f5', X: '#8a9bb2', K: '#151a2b', Y: '#ffd166', P: '#ff7aa8', E: '#101428', R: '#ef4444' };
  const OUT = '#0b0f1f';
  const cache = new Map(), urls = new Map(), flashes = new Map();

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((f - r) * p + r); g = Math.round((f - g) * p + g); b = Math.round((f - b) * p + b);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  const parse = s => (s || '').split(';').filter(Boolean).map(t => { const [x, y, c] = t.split(','); return { x: +x, y: +y, c: c.trim() }; });
  const lookOf = (ch, form) => (form && ch.looks && ch.looks[form]) || ch.look;
  const key = (ch, form) => ch.id + ':' + ((form && ch.looks && ch.looks[form]) ? form : '');

  function build(ch, form) {
    const L = lookOf(ch, form);
    const grid = !!L.rows, map = grid ? L.pal : { H: L.hair, S: L.skin, B: L.body, A: L.acc, L: shade(L.body, -0.4) };
    const color = c => map[c] || PAL[c];
    const s = (grid && L.res) || 1, GW = W * s, GH = H * s;
    const g = Array.from({ length: GH }, () => Array(GW).fill(null));
    const put = (x, y, c) => { const gx = x + OX, gy = y + OY; if (gx >= 0 && gx < GW && gy >= 0 && gy < GH && color(c)) g[gy][gx] = color(c); };
    if (grid) {                                   // 파이터 전용 도트 그리드(16열, look.res=2 면 32열): 맨 아랫줄이 발 위치에 오도록 배치
      const oy = (H - 2) * s - L.rows.length;
      L.rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.' && color(c) && g[y + oy] && x < GW) g[y + oy][x] = color(c); }));
      parse(L.weapon).forEach(p => put(p.x, p.y, p.c));
    } else {
      BASE.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') put(x, y, c); }));
      [L.hairStyle, L.feat, L.weapon].forEach(str => parse(str).forEach(p => put(p.x, p.y, p.c)));
    }
    const out = g.map(r => r.slice());
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      if (g[y][x]) continue;
      if ((y > 0 && g[y - 1][x]) || (y < GH - 1 && g[y + 1][x]) || (x > 0 && g[y][x - 1]) || (x < GW - 1 && g[y][x + 1])) out[y][x] = OUT;
    }
    const cv = document.createElement('canvas'); cv.width = GW; cv.height = GH;
    const cx = cv.getContext('2d');
    out.forEach((row, y) => row.forEach((c, x) => { if (c) { cx.fillStyle = c; cx.fillRect(x, y, 1, 1); } }));
    return cv;
  }
  const canvas = (ch, form) => { const k = key(ch, form); if (!cache.has(k)) cache.set(k, build(ch, form)); return cache.get(k); };
  function flash(ch, form) {
    const k = key(ch, form);
    if (!flashes.has(k)) {
      const src = canvas(ch, form), cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
      const cx = cv.getContext('2d'); cx.drawImage(src, 0, 0); cx.globalCompositeOperation = 'source-in'; cx.fillStyle = '#fff'; cx.fillRect(0, 0, src.width, src.height);
      flashes.set(k, cv);
    }
    return flashes.get(k);
  }
  function url(ch, form) {
    const k = key(ch, form);
    if (!urls.has(k)) {
      const cv = document.createElement('canvas'); cv.width = W * 6; cv.height = H * 6;
      const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false; cx.drawImage(canvas(ch, form), 0, 0, cv.width, cv.height);
      urls.set(k, cv.toDataURL());
    }
    return urls.get(k);
  }
  return { W, H, canvas, flash, url };
})();
