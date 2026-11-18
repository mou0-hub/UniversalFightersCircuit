/* facility.js — 구장 꾸미기 (G.club.facilities = { shop: 2, ... }) */

const Facility = (() => {
  const FC = () => CONFIG.facility, money = n => Pros.money(n);
  const lv = (g, id) => ((g && g.club && g.club.facilities) || {})[id] || 0;
  const diff = g => g.difficulty || (League.lgOf(g) || {}).diff || 'normal';
  const costOf = (g, id) => { const d = FC().defs[id], l = lv(g, id); return l >= d.max ? null : Math.round(d.cost[l] * (FC().costScale || 1) * (FC().costMul[diff(g)] || 1) / 10) * 10; };

  /* ---------- 효과 ---------- */
  const ZERO = { inc: 0, fan: 0, tix: 0, form: 0, formFloor: 0, mental: 0, mentalFloor: 0, trouble: 0, recover: 0, chem: 0, grow: 0 };
  function fx(g) {
    const o = { ...ZERO, sk: {} }, m = (MG()[mgState(g).cur - 1] || {}).fx || {};
    FC().order.forEach(id => { const l = lv(g, id), c = FC().defs[id].fx; Object.keys(c).forEach(k => { o[k] += c[k] * l; }); });
    Object.keys(m).forEach(k => { if (k === 'sk') Object.assign(o.sk, m.sk); else o[k] = (o[k] || 0) + m[k]; });
    return o;
  }
  const troubleMul = g => Math.max(FC().troubleMin, 1 - fx(g).trouble);
  const B0 = () => ({ form: 55, mental: 70, ...FC().base });
  const shift = (g, b0) => {
    const b1 = base(g), df = b1.form - b0.form, dm = b1.mental - b0.mental; if (!df && !dm) return;
    ((g.club && g.club.roster) || []).forEach(id => { const p = Pros.get(g, id); if (!p) return; p.form = Math.max(0, Math.min(100, (p.form ?? 55) + df)); p.mental = Math.max(0, Math.min(100, (p.mental ?? 70) + dm)); p.fxb = 1; });
  };
  const clean = p => { const b = B0(); p.form = Math.min(p.form ?? b.form, b.form); p.mental = Math.min(p.mental ?? b.mental, b.mental); delete p.fxb; };
  const base = g => { const x = fx(g), b = B0(); return { form: Math.min(100, Math.round(b.form + x.form)), mental: Math.min(100, Math.round(b.mental + x.mental)) }; };
  function eff(g, p) {
    const x = fx(g), B = FC().base, sk = Pros.skills(p);
    const up = (v, add, fl) => Math.round(Math.min(100, Math.max(v, fl) + add));
    return {
      form: up(p.form ?? 55, 0, x.formFloor ? B.formFloor + x.formFloor : 0),
      mental: up(p.mental ?? 70, 0, x.mentalFloor ? B.mentalFloor + x.mentalFloor : 0),
      trouble: Math.round((p.trouble ?? 0) * troubleMul(g)),
      sk: (() => { const s = { ...sk }; if (x.chem) s.team = Math.min(99, (s.team || 0) + x.chem); Object.keys(x.sk).forEach(k => { s[k] = Math.min(99, (s[k] || 0) + x.sk[k]); }); return s; })()
    };
  }
  const matchIncome = (g, ticket) => Math.round(ticket.income * fx(g).inc / 10) * 10;

  function buy(g, id) {
    const d = FC().defs[id]; if (!d || !g.club) return { ok: false, msg: '시설 정보를 찾을 수 없습니다.' };
    const c = costOf(g, id);
    if (c == null) return { ok: false, msg: `${d.name}은(는) 이미 최대 레벨입니다.` };
    if (g.club.funds < c) return { ok: false, msg: `자금이 부족합니다. (필요 ${money(c)})` };
    const b0 = base(g); g.club.funds -= c; const f = g.club.facilities = g.club.facilities || {}; f[id] = (f[id] || 0) + 1; pop = id; shift(g, b0);
    return { ok: true, msg: `${d.name} ${f[id] === 1 ? '건설' : 'Lv.' + f[id] + ' 업그레이드'} 완료 (−${money(c)})` };
  }

  /* ---------- 아이소메트릭 도트 ---------- */
  const N = 14, W = 240, H = 190, OX = 120, OY = 48;
  const LOT = { shop: [5, .5], goods: [8, .5], cafe: [11, .5], training: [.5, 4], dorm: [.5, 7.5], fanzone: [11.5, 4], lounge: [11.5, 7.5], medical: [5, 11.5] };
  const shade = (hex, a) => { const n = parseInt(hex.slice(1), 16), f = a < 0 ? 255 : 0, q = Math.abs(a), m = v => Math.round((f - v) * q + v); return '#' + ((1 << 24) + (m(n >> 16 & 255) << 16) + (m(n >> 8 & 255) << 8) + m(n & 255)).toString(16).slice(1); };
  const tri = c => [shade(c, -.16), c, shade(c, .24)];
  const rng = s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const sp = (gx, gy, z = 0) => [Math.round(OX + (gx - gy) * 8), Math.round(OY + (gx + gy) * 4 - z)];

  function ctx2d(w, h, ox, oy) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d');
    const P = (gx, gy, z = 0) => [Math.round(ox + (gx - gy) * 8), Math.round(oy + (gx + gy) * 4 - z)];
    const px = (a, b, pw, ph, c) => { x.fillStyle = c; x.fillRect(a, b, pw, ph); };
    const poly = (pts, c) => {
      x.fillStyle = c;
      const ys = pts.map(p => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
      for (let y = y0; y < y1; y++) {
        const yy = y + .5; let lo = 1e9, hi = -1e9;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) { const xx = a[0] + (yy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]); lo = Math.min(lo, xx); hi = Math.max(hi, xx); }
        }
        if (hi >= lo) { const l = Math.round(lo); x.fillRect(l, y, Math.max(1, Math.round(hi) - l), 1); }
      }
    };
    const line = (a, b, c) => {
      let [x0, y0] = a; const [x1, y1] = b, dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
      x.fillStyle = c;
      for (;;) { x.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
    };
    const tile = (gx, gy, tw, td, z, c) => poly([P(gx, gy, z), P(gx + tw, gy, z), P(gx + tw, gy + td, z), P(gx, gy + td, z)], c);
    const box = (gx, gy, bw, bd, z0, bh, c) => {
      poly([P(gx, gy + bd, z0), P(gx + bw, gy + bd, z0), P(gx + bw, gy + bd, z0 + bh), P(gx, gy + bd, z0 + bh)], c[1]);
      poly([P(gx + bw, gy, z0), P(gx + bw, gy + bd, z0), P(gx + bw, gy + bd, z0 + bh), P(gx + bw, gy, z0 + bh)], c[2]);
      poly([P(gx, gy, z0 + bh), P(gx + bw, gy, z0 + bh), P(gx + bw, gy + bd, z0 + bh), P(gx, gy + bd, z0 + bh)], c[0]);
      if (bh > 1) { const hi = shade(c[0], -.22); line(P(gx, gy + bd, z0 + bh), P(gx + bw, gy + bd, z0 + bh), hi); line(P(gx + bw, gy, z0 + bh), P(gx + bw, gy + bd, z0 + bh), hi); }
    };
    const diamond = (cx, cy, r, c) => poly([[cx, cy - (r >> 1)], [cx + r, cy], [cx, cy + (r >> 1)], [cx - r, cy]], c);
    return { cv, x, P, px, poly, line, tile, box, diamond };
  }

  /* ----- 시설 건물 ----- */
  function shell(S, o, l, mx) {
    const i = Math.round((l - 1) * 4 / Math.max(1, mx - 1)), f = [.9, 1.1, 1.35, 1.6, 1.85][i], fl = [1, 1, 2, 2, 3][i], fh = 7;
    const m = (2 - f) / 2, hgt = fl * fh, top = 1 + hgt;
    const L = (t, z) => S.P(m + t * f, m + f, z), R = (t, z) => S.P(m + f, m + t * f, z);
    S.box(0, 0, 2, 2, 0, 1, tri(o.pad || '#4a5393'));
    S.box(m, m, f, f, 1, hgt, tri(o.wall));
    for (let k = 1; k < fl; k++) { S.line(L(0, 1 + k * fh), L(1, 1 + k * fh), shade(o.wall, .3)); S.line(R(0, 1 + k * fh), R(1, 1 + k * fh), shade(o.wall, .45)); }
    const nc = Math.max(2, Math.round(f * 2.2));
    for (let k = 0; k < fl; k++) for (let c = 0; c < nc; c++) {
      const t = (c + .5) / nc;
      if (!(k === 0 && Math.abs(t - .5) < .2)) { const p = L(t, 1 + k * fh + 3.5); S.px(p[0] - 1, p[1] - 1, 2, 3, o.win); }
      const q = R(t, 1 + k * fh + 3.5); S.px(q[0] - 1, q[1] - 1, 2, 3, shade(o.win, .3));
    }
    const d = L(.5, 1); S.px(d[0] - 2, d[1] - 5, 4, 5, '#10162e'); S.px(d[0] - 1, d[1] - 4, 2, 4, '#27346a');
    S.box(m - .08, m - .08, f + .16, f + .16, top, 2, tri(o.roof)); S.box(m + .2, m + .2, f - .4, f - .4, top + 2, 3, tri(shade(o.roof, .1)));
    return { m, f, fl, fh, top, L, R };
  }
  const awn = (S, g, cols) => { const n = Math.max(3, Math.round(g.f * 5)); for (let c = 0; c < n; c++) { const t = (c + .5) / n, p = g.L(t, g.fh), q = g.R(t, g.fh), col = cols[c % 2]; S.px(p[0] - 1, p[1], 2, 3, col); S.px(q[0] - 1, q[1], 2, 3, shade(col, .25)); } };
  const sign = (S, g, c, z) => S.box(g.m + .25, g.m + g.f * .45, g.f - .5, .12, z == null ? g.top + 5 : z, 4, tri(c));
  const spark = (S, pts) => pts.forEach(([a, b, c]) => { S.px(a, b, 1, 1, c); S.px(a - 1, b, 3, 1, c); S.px(a, b - 1, 1, 3, c); });

  const ART = {
    shop: (S, l, mx) => {
      const g = shell(S, { wall: '#ffe0b2', roof: '#e8590c', win: '#7dd3fc' }, l, mx);
      awn(S, g, ['#ef4444', '#fff']);
      if (l >= 2) S.box(g.m + g.f + .05, g.m + g.f - .4, .3, .3, 1, 3, tri('#c2410c'));
      if (l >= 3) sign(S, g, '#fde047');
      if (l >= 4) S.box(g.m + g.f - .05, g.m + g.f + .02, .12, .12, 1, 13, tri('#f472b6'));
      if (l >= 5) { S.box(g.m + .3, g.m + .3, .08, .08, g.top + 5, 9, tri('#9ca3af')); S.box(g.m + .38, g.m + .3, .5, .04, g.top + 10, 4, tri('#ef4444')); }
    },
    goods: (S, l, mx) => {
      const g = shell(S, { wall: '#d8c7ff', roof: '#7c3aed', win: '#fde68a', pad: '#5b3fa8' }, l, mx);
      awn(S, g, ['#f472b6', '#fff']);
      for (let k = 0; k < Math.min(l, 4); k++) { const p = g.R(.15 + k * .22, g.fh + 1.5 + (g.fl > 1 ? g.fh : 0)); S.px(p[0], p[1], 2, 4, ['#ef4444', '#38bdf8', '#fde047', '#34d399'][k]); }
      if (l >= 3) sign(S, g, '#f472b6');
      if (l >= 4) [[g.m - .15, g.m + g.f, '#f472b6'], [g.m + g.f + .1, g.m + g.f - .3, '#38bdf8']].forEach(([a, b, c]) => { const p = S.P(a, b, 13); S.px(p[0] - 1, p[1] - 2, 3, 3, c); S.px(p[0], p[1] + 1, 1, 8, '#e5e7eb'); });
      if (l >= 5) spark(S, [[10, 12, '#fff'], [52, 16, '#fde047'], [24, 4, '#f9a8d4'], [44, 30, '#fff']]);
    },
    cafe: (S, l, mx) => {
      const g = shell(S, { wall: '#e0b890', roof: '#8a3b12', win: '#fff7ed', pad: '#6b4f3a' }, l, mx);
      awn(S, g, ['#2f855a', '#fff']);
      if (l >= 2 && g.f < 1.5) { S.box(1.55, 1.55, .25, .25, 1, 3, tri('#78350f')); S.box(1.45, 1.45, .45, .45, 5, 1, tri('#ef4444')); }
      if (l >= 3) { S.box(g.m + g.f - .45, g.m + .15, .25, .25, g.top + 2, 6, tri('#92400e')); const p = S.P(g.m + g.f - .35, g.m + .25, g.top + 10); S.px(p[0], p[1], 1, 1, '#e5e7eb'); S.px(p[0] + 1, p[1] - 2, 1, 1, '#e5e7eb'); }
      if (l >= 4) for (let k = 0; k < 7; k++) { const p = g.L(k / 6, g.fh + 2); S.px(p[0], p[1], 1, 1, k % 2 ? '#fde047' : '#f472b6'); }
    },
    fanzone: (S, l) => {
      S.box(0, 0, 2, 2, 0, 1, tri('#5b3fa8'));
      if (l <= 1) { S.box(.4, .4, 1.2, 1.2, 1, 5, tri('#f472b6')); S.box(.3, .3, 1.4, 1.4, 6, 2, tri('#fde047')); S.box(.6, .6, .8, .8, 8, 2, tri('#f472b6')); S.box(.95, .95, .08, .08, 10, 7, tri('#9ca3af')); return; }
      S.box(.2, .15, 1.6, .8, 1, 3, tri('#312e81'));
      [[.2, .15], [1.72, .15], [.2, .87], [1.72, .87]].forEach(([a, b]) => S.box(a, b, .08, .08, 4, 11, tri('#9ca3af')));
      S.box(.2, .15, 1.6, .08, 15, 1, tri('#9ca3af'));
      for (let k = 0; k < 5; k++) { const p = S.P(.3 + k * .35, .96, 14); S.px(p[0], p[1], 2, 2, ['#f472b6', '#38bdf8', '#fde047', '#34d399', '#ef4444'][k]); }
      if (l >= 3) { S.box(.45, .2, 1.1, .06, 4, 9, tri('#0b1230')); S.box(.5, .27, 1.0, .02, 5, 7, tri('#38bdf8')); }
      if (l >= 4) { S.box(.15, 1.25, .5, .5, 1, 3, tri('#f472b6')); S.box(1.35, 1.25, .5, .5, 1, 3, tri('#fde047')); S.box(.1, 1.2, .6, .6, 4, 1, tri('#ef4444')); S.box(1.3, 1.2, .6, .6, 4, 1, tri('#38bdf8')); }
      for (let k = 0; k < l * 3; k++) { const p = S.P(.5 + (k * 37 % 11) / 8, 1.1 + (k * 53 % 7) / 12, 1); S.px(p[0], p[1] - 3, 2, 3, ['#f87171', '#60a5fa', '#fbbf24', '#e5e7eb', '#34d399'][k % 5]); }
      if (l >= 5) spark(S, [[14, 6, '#fff'], [50, 8, '#f9a8d4'], [32, 2, '#fde047']]);
    },
    training: (S, l) => {
      S.box(0, 0, 2, 2, 0, 1, tri('#2f7d57'));
      for (let i = 0; i < 4; i++) S.tile(0, i * .5, 2, .5, 1, i % 2 ? '#3fa070' : '#349262');
      const ln = (a, b, c, d) => S.line(S.P(a, b, 1), S.P(c, d, 1), '#d6fff0');
      ln(.1, .1, 1.9, .1); ln(1.9, .1, 1.9, 1.9); ln(1.9, 1.9, .1, 1.9); ln(.1, 1.9, .1, .1); ln(1, .1, 1, 1.9);
      [[.3, 1.6], [.7, 1.7], [1.4, 1.5]].forEach(([a, b]) => S.box(a, b, .12, .12, 1, 2, tri('#f97316')));
      if (l >= 2) { [[1.78, .55], [1.78, 1.35]].forEach(([a, b]) => S.box(a, b, .07, .07, 1, 7, tri('#e5e7eb'))); S.box(1.78, .55, .07, .87, 7, 1, tri('#e5e7eb')); }
      if (l >= 3) { S.box(.08, .08, .85, .85, 1, 9, tri('#5b6b8c')); S.box(.04, .04, .93, .93, 10, 2, tri('#38bdf8')); const d = S.P(.5, .93, 1); S.px(d[0] - 2, d[1] - 5, 4, 5, '#10162e'); }
      if (l >= 4) [[.05, 1.9], [1.9, .05]].forEach(([a, b]) => { S.box(a, b, .08, .08, 1, 16, tri('#9ca3af')); S.box(a - .08, b - .08, .24, .24, 17, 2, tri('#fef08a')); });
      if (l >= 5) { S.box(0, 0, 1, 1, 12, 2, tri('#7dd3fc')); S.box(.12, .12, .76, .76, 14, 2, tri('#a5e8ff')); S.box(.26, .26, .48, .48, 16, 2, tri('#d6f6ff')); }
    },
    dorm: (S, l, mx) => {
      const g = shell(S, { wall: '#9fb3d1', roof: '#475569', win: '#ffe58a', pad: '#3f4b78' }, l, mx);
      for (let k = 1; k < g.fl; k++) S.line(g.L(0, 1 + k * g.fh + 1), g.L(1, 1 + k * g.fh + 1), '#e5e7eb');
      if (l >= 3) S.box(g.m + g.f - .45, g.m + .15, .25, .25, g.top + 2, 6, tri('#64748b'));
      if (l >= 4) { S.box(g.m + .3, g.m + .3, .05, .05, g.top + 5, 10, tri('#9ca3af')); const p = S.P(g.m + .3, g.m + .3, g.top + 16); S.px(p[0], p[1], 1, 1, '#ef4444'); }
      if (l >= 5) S.box(g.m + .7, g.m + .7, .4, .4, g.top + 5, 4, tri('#38bdf8'));
    },
    medical: (S, l, mx) => {
      const g = shell(S, { wall: '#f4f8fb', roof: '#cbd5e1', win: '#8cc8ff', pad: '#4b5f86' }, l, mx);
      let z = g.top + 5, gy = g.m + g.f * .45;
      if (l >= 4) { S.box(g.m + .1, g.m + .1, g.f - .2, g.f - .2, z, 1, tri('#64748b')); const c = S.P(g.m + g.f / 2, g.m + g.f / 2 + .15, z + 1); S.px(c[0] - 2, c[1] - 1, 1, 3, '#fff'); S.px(c[0] + 1, c[1] - 1, 1, 3, '#fff'); S.px(c[0] - 1, c[1], 2, 1, '#fff'); z += 1; gy = g.m + .25; }
      S.box(g.m + .3, gy, g.f - .6, .12, z, 6, tri('#ffffff'));
      const c = S.P(g.m + .3 + (g.f - .6) / 2, gy + .12, z + 3); S.px(c[0] - 1, c[1] - 2, 3, 5, '#ef4444'); S.px(c[0] - 2, c[1] - 1, 5, 3, '#ef4444');
      if (l >= 3) { S.box(2.05, .9, .5, .3, 0, 3, tri('#ffffff')); S.box(2.04, .89, .52, .32, 1, 1, tri('#ef4444')); }
    },
    lounge: (S, l, mx) => {
      const g = shell(S, { wall: '#1f6f78', roof: '#0f4c5c', win: '#ffd166', pad: '#2b3b6b' }, l, mx);
      S.line(g.L(0, g.fh - .5), g.L(1, g.fh - .5), '#22d3ee'); S.line(g.R(0, g.fh - .5), g.R(1, g.fh - .5), '#0ea5b7');
      if (l >= 3) { S.box(g.m + .1, g.m + .1, g.f - .2, g.f - .2, g.top + 5, 1, tri('#334155')); S.box(g.m + .2, g.m + .25, .5, .2, g.top + 6, 2, tri('#f472b6')); S.box(g.m + g.f - .7, g.m + .55, .2, .5, g.top + 6, 2, tri('#a78bfa')); }
      if (l >= 4) for (let k = 0; k < 3; k++) S.box(g.m + .2 + k * .4, g.m + g.f - .45, .3, .3, g.top + 6, 3, tri('#22c55e'));
      if (l >= 5) { const p = S.P(g.m - .2, g.m + g.f, 0); S.px(p[0] - 1, p[1] - 12, 2, 12, '#78350f'); S.diamond(p[0], p[1] - 14, 7, '#22c55e'); S.diamond(p[0], p[1] - 17, 4, '#86efac'); }
    }
  };

  function site(S) {
    S.box(0, 0, 2, 2, 0, 1, tri('#6b5b45'));
    S.box(.3, .4, .5, .5, 1, 4, tri('#c2410c')); S.box(.45, .5, .3, .3, 5, 3, tri('#ea580c')); S.box(1.2, .35, .35, .35, 1, 3, tri('#9ca3af'));
    S.box(1.5, 1.4, .15, .15, 1, 24, tri('#facc15'));
    S.line(S.P(1.55, 1.45, 25), S.P(.5, .7, 23), '#facc15'); S.line(S.P(.9, 1.0, 23), S.P(.9, 1.0, 16), '#e5e7eb'); S.box(.82, .92, .16, .16, 14, 2, tri('#ef4444'));
    [[.1, .1], [1.9, .1], [1.9, 1.9], [.1, 1.9]].forEach(([a, b]) => S.box(a - .05, b - .05, .1, .1, 1, 5, tri('#facc15')));
    [[[.1, 1.9], [1.9, 1.9]], [[1.9, .1], [1.9, 1.9]]].forEach(([a, b]) => {
      const p = S.P(a[0], a[1], 5), q = S.P(b[0], b[1], 5); S.line(p, q, '#fde047');
      for (let t = 0; t < 1; t += .12) S.px(Math.round(p[0] + (q[0] - p[0]) * t), Math.round(p[1] + (q[1] - p[1]) * t), 2, 1, '#10162e');
    });
  }

  const spriteCv = new Map();
  const facCanvas = (id, l) => { const k = id + ':' + l; if (!spriteCv.has(k)) { const S = ctx2d(64, 80, 32, 52); if (l) ART[id](S, l, FC().defs[id].max); else site(S); spriteCv.set(k, S.cv); } return spriteCv.get(k); };
  const spriteUrl = (id, l) => facCanvas(id, l).toDataURL();

  /* ----- 씬 ----- */
  const inLot = (gx, gy, pad) => Object.values(LOT).some(([a, b]) => gx >= a - pad && gx <= a + 2 + pad && gy >= b - pad && gy <= b + 2 + pad);
  const CROWD = ['#f87171', '#60a5fa', '#fbbf24', '#e5e7eb', '#34d399', '#f472b6'];

  function drawSpace(S, R) {
    ['#070a24', '#0a0e2e', '#0e1338', '#131944', '#181f50', '#1d255a'].forEach((c, i) => S.px(0, i * 32, W, 32, c));
    [[44, 150, 'rgba(168,85,247,.10)'], [200, 40, 'rgba(34,211,238,.09)'], [196, 150, 'rgba(236,72,153,.08)'], [120, 20, 'rgba(99,102,241,.08)']].forEach(([cx, cy, c]) => { for (let i = 0; i < 70; i++) S.px(cx + Math.floor((R() - .5) * 70), cy + Math.floor((R() - .5) * 32), 3 + Math.floor(R() * 7), 2 + Math.floor(R() * 3), c); });
    for (let i = 0; i < 100; i++) S.px(Math.floor(R() * W), Math.floor(R() * H), 1, 1, R() < .2 ? '#fff' : '#8ea0ff');
    const cx = 30, cy = 30;
    for (let dy = -12; dy <= 12; dy++) { const h = Math.floor(Math.sqrt(144 - dy * dy)); S.px(cx - h, cy + dy, h * 2 + 1, 1, dy < -4 ? '#f0abfc' : dy < 4 ? '#c084fc' : '#7c3aed'); }
    for (let a = 0; a < 6.3; a += .08) { const x = Math.round(cx + Math.cos(a) * 20), y = Math.round(cy + Math.sin(a) * 5); if (Math.sin(a) > 0 || Math.abs(x - cx) > 12) S.px(x, y, 1, 1, '#fde68a'); }
  }

  function drawPeople(S, R, n) {
    const out = [];
    for (let t = 0; t < 400 && out.length < n; t++) {
      const gx = 1.6 + R() * 11, gy = 1.6 + R() * 11, inRing = (gx >= 2 && gx <= 3 || gx >= 11 && gx <= 12) && gy >= 2 && gy <= 12 || (gy >= 2 && gy <= 3 || gy >= 11 && gy <= 12) && gx >= 2 && gx <= 12;
      if (!inRing || inLot(gx, gy, .3)) continue;
      const c = CROWD[Math.floor(R() * CROWD.length)];
      out.push({ k: gx + gy, f: () => { const p = S.P(gx, gy); S.px(p[0], p[1] - 4, 2, 1, '#f5cfa3'); S.px(p[0], p[1] - 3, 2, 2, c); S.px(p[0], p[1] - 1, 2, 1, '#1f2937'); } });
    }
    return out;
  }

  const sceneCache = new Map();
  function scene(levels, sel, fb) {
    const key = levels.join('.') + '|' + sel + '|' + fb;
    if (sceneCache.has(key)) return sceneCache.get(key);
    const S = ctx2d(W, H, OX, OY), R = rng(21), ids = FC().order;
    drawSpace(S, rng(11));
    const a = S.P(0, N), b = S.P(N, N), c = S.P(N, 0), T = 10, ap = b[1] + T + 18;
    S.poly([[a[0], a[1] + T], [b[0], b[1] + T], [OX, ap]], '#161b45'); S.poly([[b[0], b[1] + T], [c[0], c[1] + T], [OX, ap]], '#10143a');
    S.poly([a, b, [b[0], b[1] + T], [a[0], a[1] + T]], '#1b2150'); S.poly([b, c, [c[0], c[1] + T], [b[0], b[1] + T]], '#12163a');
    S.line(a, b, '#38bdf8'); S.line(b, c, '#38bdf8'); S.line([a[0], a[1] + T], [b[0], b[1] + T], '#6d44c9'); S.line([b[0], b[1] + T], [c[0], c[1] + T], '#4c2f94');
    for (let i = 0; i < 9; i++) S.px(OX - 24 + Math.floor(R() * 48), b[1] + T + 2 + Math.floor(R() * 12), 1, 2, i % 2 ? '#22d3ee' : '#c084fc');
    for (let gx = 0; gx < N; gx++) for (let gy = 0; gy < N; gy++) {
      const path = ((gx === 2 || gx === 11) && gy >= 2 && gy <= 11) || ((gy === 2 || gy === 11) && gx >= 2 && gx <= 11);
      S.tile(gx, gy, 1, 1, 0, path ? ((gx + gy) % 2 ? '#4c5799' : '#46508f') : ((gx + gy) % 2 ? '#2a3366' : '#252d5c'));
    }
    S.poly([S.P(3, 11, 0), S.P(11, 11, 0), S.P(11, 11, 2), S.P(3, 11, 2)], '#2b3157'); S.poly([S.P(11, 3, 0), S.P(11, 11, 0), S.P(11, 11, 2), S.P(11, 3, 2)], '#1e2347');
    for (let gx = 3; gx < 11; gx++) for (let gy = 3; gy < 11; gy++) S.tile(gx, gy, 1, 1, 2, (gx + gy) % 2 ? '#6a74b8' : '#5f69ab');
    for (let gx = 5; gx < 10; gx++) S.tile(gx, 5, 1, 4, 2, gx % 2 ? '#1fb37f' : '#19a06f');
    const ln = (p, q, r, s) => S.line(S.P(p, q, 2), S.P(r, s, 2), '#d6fff0');
    ln(5.2, 5.2, 9.8, 5.2); ln(9.8, 5.2, 9.8, 8.8); ln(9.8, 8.8, 5.2, 8.8); ln(5.2, 8.8, 5.2, 5.2); ln(7.5, 5.2, 7.5, 8.8);
    ln(5.2, 6, 6.2, 6); ln(6.2, 6, 6.2, 8); ln(6.2, 8, 5.2, 8); ln(9.8, 6, 8.8, 6); ln(8.8, 6, 8.8, 8); ln(8.8, 8, 9.8, 8);
    for (let t = 0, pr = null; t <= 6.4; t += .25) { const p = S.P(7.5 + Math.cos(t) * .9, 7 + Math.sin(t) * .9, 2); if (pr) S.line(pr, p, '#d6fff0'); pr = p; }

    const objs = [], dens = 2 + fb;
    const stand = (gx, gy, h, col) => objs.push({ k: gx + gy + 2, f: () => {
      S.box(gx, gy, 1, 1, 2, h, tri(col));
      const r = rng(gx * 31 + gy * 7);
      for (let i = 0; i < dens; i++) { const p = S.P(gx + .15 + r() * .7, gy + .15 + r() * .7, 2 + h); S.px(p[0] - 1, p[1] - 1, 2, 2, CROWD[Math.floor(r() * CROWD.length)]); }
    } });
    for (let gx = 4; gx <= 9; gx++) stand(gx, 4, 5, '#8b5cf6');
    for (let gx = 3; gx <= 10; gx++) stand(gx, 3, 10, '#6d44c9');
    for (let gy = 5; gy <= 8; gy++) stand(4, gy, 5, '#8b5cf6');
    for (let gy = 4; gy <= 9; gy++) stand(3, gy, 10, '#6d44c9');
    for (let gx = 5; gx <= 9; gx++) stand(gx, 9, 3, '#e879f9');
    for (let gy = 5; gy <= 8; gy++) stand(10, gy, 3, '#e879f9');
    objs.push({ k: 12.2, f: () => {
      S.box(5, 3, 4, .15, 12, 9, tri('#2a1e6a'));
      const pt = (t, z) => S.P(5 + t * 4, 3.15, z);
      S.poly([pt(.04, 13), pt(.5, 13), pt(.5, 20), pt(.04, 20)], '#d946ef'); S.poly([pt(.5, 13), pt(.96, 13), pt(.96, 20), pt(.5, 20)], '#22d3ee');
      const s = pt(.5, 16.5); S.px(s[0] - 1, s[1] - 1, 3, 3, '#fff'); S.px(s[0], s[1] - 2, 1, 5, '#fff');
    } });
    [[2.6, 2.6], [11.3, 2.6], [2.6, 11.3], [11.3, 11.3]].forEach(([gx, gy]) => objs.push({ k: gx + gy + .3, f: () => { S.box(gx, gy, .2, .2, 0, 28, tri('#9ca3af')); S.box(gx - .15, gy - .15, .5, .5, 28, 3, tri('#fef9c3')); } }));
    [5.05, 9.85].forEach(gx => objs.push({ k: gx + 7.5, f: () => { S.box(gx, 6.7, .1, .6, 2, 3, tri('#f1f5f9')); } }));
    drawPeople(S, rng(5), 18 + fb * 6).forEach(o => objs.push(o));
    const tr = rng(9); let placed = 0;
    for (let t = 0; t < 300 && placed < 14; t++) {
      const gx = .4 + tr() * 13.2, gy = .4 + tr() * 13.2;
      if (inLot(gx, gy, .7) || (gx > 1.7 && gx < 12.3 && gy > 1.7 && gy < 12.3)) continue;
      const kind = tr() < .4; placed++;
      objs.push({ k: gx + gy, f: () => {
        const p = S.P(gx, gy), cc = kind ? ['#3b2a7a', '#5b3fa8', '#8b5cf6'] : ['#14532d', '#15803d', '#22c55e'];
        S.px(p[0] - 3, p[1] - 1, 6, 2, 'rgba(0,0,0,.25)'); S.px(p[0] - 1, p[1] - 4, 2, 4, '#5b3a1e');
        S.diamond(p[0], p[1] - 6, 7, cc[0]); S.diamond(p[0], p[1] - 10, 5, cc[1]); S.diamond(p[0], p[1] - 13, 3, cc[2]);
      } });
    }
    ids.forEach((id, i) => { const [gx, gy] = LOT[id], p = S.P(gx, gy); objs.push({ k: gx + gy + 4, f: () => S.x.drawImage(facCanvas(id, levels[i]), p[0] - 32, p[1] - 52) }); });
    objs.sort((p, q) => p.k - q.k).forEach(o => o.f());
    if (sel && LOT[sel]) {
      const [gx, gy] = LOT[sel], q = [[gx, gy], [gx + 2, gy], [gx + 2, gy + 2], [gx, gy + 2]].map(([u, v]) => S.P(u, v, 1));
      for (let k = 0; k < 4; k++) { S.line(q[k], q[(k + 1) % 4], '#6ee7ff'); S.line([q[k][0], q[k][1] + 1], [q[(k + 1) % 4][0], q[(k + 1) % 4][1] + 1], 'rgba(110,231,255,.5)'); }
    }
    const url = S.cv.toDataURL();
    if (sceneCache.size > 12) sceneCache.clear();
    sceneCache.set(key, url);
    return url;
  }

  /* ---------- 화면 ---------- */
  const pct = v => Math.round(v * 100), n1 = v => +v.toFixed(1);
  const LBL = {
    inc: v => `부가 수입 +${pct(v)}%`, fan: v => `팬 증가 +${pct(v)}%`, tix: v => `티켓 수입 +${pct(v)}%`,
    form: v => `기본 폼 +${n1(v)}`, formFloor: v => `폼 하한 +${n1(v)}`, mental: v => `기본 멘탈 +${n1(v)}`, mentalFloor: v => `멘탈 하한 +${n1(v)}`,
    trouble: v => `트러블 −${pct(v)}%`, recover: v => `회복 +${n1(v)}`, chem: v => `팀워크 +${n1(v)}`, grow: v => `육성 성장 +${pct(v)}%`
  };
  const fxText = (c, l) => Object.keys(c).map(k => LBL[k](c[k] * l)).join(' · ');
  let sel = 'shop', pop = null, mgPos = -1;
  const FIX = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

  const buyBtn = (g, id) => {
    const c = costOf(g, id), l = lv(g, id);
    if (c == null) return '<button class="btn dis" disabled>최대 레벨</button>';
    return `<button class="btn ${g.club.funds >= c ? 'primary' : 'dis'}" data-act="facBuy" data-id="${id}">${l ? '업그레이드' : '건설'} · ${money(c)}</button>`;
  };
  const MG = () => FC().managers.list;
  const MC = () => FC().managers, MN = () => MG().length;
  const mgState = g => (g.mgr = g.mgr || { have: [1], cur: 1 });
  const mgImg = n => MC().img.replace('{n}', n);
  const mgPic = n => mgImg((MG()[n - 1] || {}).pic || n);
  const mgName = n => (MG()[n - 1] || {}).name || `매니저 ${n}`;
  const mgCost = (g, n) => Math.round(MG()[n - 1].cost * (MC().costScale || 1) * (FC().costMul[diff(g)] || 1) / 10) * 10;
  const skName = k => (CONFIG.pro.skills.find(s => s.id === k) || { name: k }).name;
  const mgFxText = f => [...Object.keys(f).filter(k => k !== 'sk').map(k => (LBL[k] ? LBL[k](f[k]) : `${k} +${f[k]}`)), ...Object.keys(f.sk || {}).map(k => `${skName(k)} +${f.sk[k]}`)].join(' · ');
  const TRO = { league: '리그 우승', msi: 'MSI 우승', worlds: '월드 챔피언십 우승', intl: '국제대회(MSI·월드) 우승' };
  function condOf(g, c) {
    const T = g.trophies || [], tot = g.totals || {}, fl = FC().order.reduce((s, id) => s + lv(g, id), 0);
    const cur = { trophy: () => T.filter(t => (c.t === 'intl' ? t.k === 'msi' || t.k === 'worlds' : t.k === c.t)).length, wins: () => tot.wins || 0, games: () => tot.games || 0, streak: () => g.bestStreak || 0, season: () => g.season || 1, rep: () => Math.max((g.rep && g.rep.peak) || 0, (g.rep && g.rep.v) || 0), fac: () => lv(g, c.id), facSum: () => fl, fans: () => (g.club && g.club.fans) || 0 }[c.k]();
    const text = { trophy: `${TRO[c.t]} ${c.n}회`, wins: `통산 ${c.n}승`, games: `통산 ${c.n}경기`, streak: `최다 연승 ${c.n}`, season: `${c.n}시즌째`, rep: `감독 평판 ${c.n} 이상`, fac: `${FC().defs[c.id] ? FC().defs[c.id].name : c.id} Lv.${c.n}`, facSum: `시설 레벨 합 ${c.n}`, fans: `팬 ${c.n.toLocaleString('ko-KR')}명` }[c.k];
    return { ok: cur >= c.n, cur: Math.min(cur, c.n), need: c.n, text };
  }
  const mgConds = (g, n) => (MG()[n - 1].cond || []).map(c => condOf(g, c));
  function unlockMgr(g, n) {
    const s = mgState(g), c = mgCost(g, n);
    if (s.have.includes(n)) return { ok: false, msg: '이미 해금한 매니저입니다.' };
    if (mgConds(g, n).some(x => !x.ok)) return { ok: false, msg: '해금 조건을 아직 달성하지 못했습니다.' };
    if (g.club.funds < c) return { ok: false, msg: `자금이 부족합니다. (필요 ${money(c)})` };
    const b0 = base(g); g.club.funds -= c; s.have.push(n); s.cur = n; shift(g, b0);
    return { ok: true, msg: `${mgName(n)} 해금! (−${money(c)})` };
  }
  const mgrPopup = (g, n) => {
    const m = MG()[n - 1], cs = mgConds(g, n), ready = cs.every(x => x.ok) && g.club.funds >= mgCost(g, n);
    return `<div class="fac-mgr-pop"><img src="${mgPic(n)}" alt="" onerror="this.hidden=true"><b>${m.name}</b><small>${m.role}</small><em>${mgFxText(m.fx)}</em></div>
      <ul class="fac-cond">${cs.map(x => `<li class="${x.ok ? 'ok' : ''}"><span>${x.ok ? '✔' : '✖'} ${x.text}</span><small>${x.cur.toLocaleString('ko-KR')} / ${x.need.toLocaleString('ko-KR')}</small></li>`).join('') || '<li class="ok"><span>✔ 조건 없음</span></li>'}</ul>
      <div class="fac-pop-foot"><small>보유 ${money(g.club.funds)}</small><button class="btn ${ready ? 'primary' : 'dis'}" data-act="mgrBuy" data-n="${n}">해금 · ${money(mgCost(g, n))}</button></div>`;
  };
  const nick = () => { try { return localStorage.getItem('cosmic_manager') || ''; } catch (e) { return ''; } };

  function popup(g, id) {
    const d = FC().defs[id], l = lv(g, id), c = costOf(g, id);
    return `<div class="fac-pop-head"><img class="px" src="${spriteUrl(id, l)}" alt=""><div><b>${d.icon} ${d.name}</b><small>Lv.${l} / ${d.max}</small><i class="fac-pips">${Array.from({ length: d.max }, (_, i) => `<u class="${i < l ? 'on' : ''}"></u>`).join('')}</i></div></div>
      <p class="fac-pop-desc">${d.desc}</p>
      <dl class="fac-pop-fx"><div><dt>현재</dt><dd>${l ? fxText(d.fx, l) : '효과 없음'}</dd></div>${l < d.max ? `<div class="next"><dt>Lv.${l + 1}</dt><dd>${fxText(d.fx, l + 1)}</dd></div>` : ''}</dl>
      <div class="fac-pop-foot"><small>보유 ${money(g.club.funds)}${c != null ? ` · 필요 ${money(c)}` : ''}</small>${buyBtn(g, id)}</div>`;
  }

  function screen() {
    const lt = document.querySelector('.fac-mgr-list'); if (lt) mgPos = lt.scrollLeft;
    const g = Game.G, c = g && g.club;
    if (!c) return '<section class="glass panel"><p class="empty">구단 정보가 없습니다.</p></section>';
    const ids = FC().order, defs = FC().defs, x = fx(g), bs = base(g), lu = Club.lineup(g).filter(Boolean);
    const avg = f => (lu.length ? Math.round(lu.reduce((s, p) => s + f(p), 0) / lu.length) : null);
    const chip = (k, v) => `<span class="fac-chip"><small>${k}</small><b>${v}</b></span>`;
    const pair = (k, a, b) => (a == null ? '' : chip(k, a === b ? a : `${a} → ${b}`));
    const chips = [
      chip('폼 기본값', bs.form === B0().form ? bs.form : `${B0().form} → ${bs.form}`),
      chip('멘탈 기본값', bs.mental === B0().mental ? bs.mental : `${B0().mental} → ${bs.mental}`),
      pair('트러블', avg(p => p.trouble ?? 0), avg(p => eff(g, p).trouble)),
      x.inc ? chip('부가 수입', `+${pct(x.inc)}%`) : '', x.tix ? chip('티켓 수입', `+${pct(x.tix)}%`) : '', x.fan ? chip('팬 증가', `+${pct(x.fan)}%`) : '',
      x.recover ? chip('컨디션 회복', `+${n1(x.recover)}`) : '', x.chem ? chip('팀워크', `+${n1(x.chem)}`) : '', x.grow ? chip('육성 성장', `+${pct(x.grow)}%`) : '',
      ...Object.keys(x.sk).map(k => chip(skName(k), `+${x.sk[k]}`))
    ].join('');
    const order = ids.slice().sort((p, q) => LOT[p][0] + LOT[p][1] - LOT[q][0] - LOT[q][1]);
    const spots = order.map(id => {
      const l = lv(g, id), [gx, gy] = LOT[id], p = sp(gx + 1, gy + 1);
      return `<button class="fac-spot ${sel === id ? 'on' : ''} ${l ? '' : 'empty'}" style="left:${((p[0] - 18) / W * 100).toFixed(2)}%;top:${((p[1] - 38) / H * 100).toFixed(2)}%;width:${(36 / W * 100).toFixed(2)}%;height:${(48 / H * 100).toFixed(2)}%" data-act="facSel" data-id="${id}" title="${defs[id].name}"><b class="fac-lv">${l ? 'Lv.' + l : defs[id].name}</b></button>`;
    }).join('');
    const drop = pop && lv(g, pop) ? (() => { const [gx, gy] = LOT[pop], p0 = sp(gx, gy); return `<img class="fac-drop" src="${spriteUrl(pop, lv(g, pop))}" style="left:${((p0[0] - 32) / W * 100).toFixed(2)}%;top:${((p0[1] - 52) / H * 100).toFixed(2)}%;width:${(64 / W * 100).toFixed(2)}%" alt="">`; })() : '';
    const sc = scene(ids.map(id => lv(g, id)), sel, Math.min(6, Math.floor((c.fans || 0) / 2000)));
    const ms = mgState(g), cm = MG()[ms.cur - 1], flip = !!(cm.alt && (ms.alt || {})[ms.cur]), ths = Array.from({ length: MN() }, (_, i) => i + 1).map(n => `<button class="fac-th ${ms.cur === n ? 'on' : ''} ${ms.have.includes(n) ? '' : 'lock'}" data-act="mgrSel" data-n="${n}" title="${mgName(n)}"><img src="${mgPic(n)}" alt="" onerror="this.hidden=true">${ms.have.includes(n) ? '' : '<i>🔒</i>'}</button>`).join('');
    pop = null;
    return `<section class="fac-view"><div class="glass panel team-head"><div><h2>🏟 구장 꾸미기</h2><p>시설을 눌러 건설하고 업그레이드하세요.</p></div><button class="btn" data-act="nav" data-view="club">← 구단 관리</button></div>
      <div class="fac-layout">
        <aside class="glass fac-mgr"><div class="fac-mgr-img ${cm.alt ? 'has-alt' : ''} ${flip ? 'flip' : ''}" ${cm.alt ? 'data-act="mgrAlt"' : ''}><img src="${mgPic(ms.cur)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>🧑‍💼</span>${cm.alt ? `<img class="fac-mgr-alt" src="${mgImg(cm.alt)}" alt="" onerror="this.hidden=true">` : ''}</div><div class="fac-mgr-slide"><button class="fac-mgr-arrow" data-act="mgrNav" data-dir="-1">‹</button><div class="fac-mgr-list">${ths}</div><button class="fac-mgr-arrow" data-act="mgrNav" data-dir="1">›</button><img class="fac-mgr-fix" src="${FIX}" alt="" onload="var t=this.parentNode.querySelector('.fac-mgr-list'),c=t.querySelector('.on');t.scrollLeft=${mgPos}>=0?${mgPos}:(c?c.offsetLeft-(t.clientWidth-c.offsetWidth)/2:0);this.remove()"></div><div class="fac-mgr-info"><b>${mgName(ms.cur)}</b><small>${cm.role}</small><span class="fac-mgr-fx">${mgFxText(cm.fx)}</span><small>${nick() ? nick() + ' 감독 · ' : ''}${g.teamName || ''}</small><em>💰 ${money(c.funds)}</em></div></aside>
        <div class="fac-right"><div class="fac-effects">${chips || '<span class="fac-none">적용 중인 효과가 없습니다.</span>'}</div><div class="fac-scene"><img class="fac-bg" src="${sc}" alt="">${drop}${spots}</div></div>
      </div></section>`;
  }

  const done = r => {
    if (r && r.msg) UI.toast(r.msg, r.ok ? 'good' : 'warn');
    Game.save(); UI.refresh();
    const box = document.querySelector('#modal .fac-modal'); if (box) box.innerHTML = popup(Game.G, sel);
  };
  const actions = {
    facSel(el) { sel = el.dataset.id; UI.refresh(); UI.modal(popup(Game.G, sel), 'fac-modal'); },
    facBuy(el) { sel = el.dataset.id; done(buy(Game.G, sel)); },
    mgrSel(el) { const g = Game.G, n = +el.dataset.n, s = mgState(g); if (s.have.includes(n)) { const b0 = base(g); s.cur = n; shift(g, b0); Game.save(); UI.refresh(); } else UI.modal(mgrPopup(g, n), 'fac-modal'); },
    mgrNav(el) { const t = el.parentNode.querySelector('.fac-mgr-list'); t.scrollBy({ left: +el.dataset.dir * t.clientWidth * .8, behavior: 'smooth' }); },
    mgrAlt(el) { const s = mgState(Game.G); s.alt = s.alt || {}; s.alt[s.cur] = !s.alt[s.cur]; el.classList.toggle('flip', !!s.alt[s.cur]); Game.save(); },
    mgrBuy(el) { const r = unlockMgr(Game.G, +el.dataset.n); UI.toast(r.msg, r.ok ? 'good' : 'warn'); if (r.ok) { Game.save(); UI.closeModal(); UI.refresh(); } }
  };

  UI.addView('facility', screen);
  return { lv, fx, eff, base, clean, mgrFx: g => (MG()[mgState(g).cur - 1] || {}).fx || {}, troubleMul, matchIncome, costOf, buy, actions };
})();
