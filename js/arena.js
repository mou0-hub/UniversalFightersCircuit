/* arena.js — 캔버스 경기장 렌더링 / 이펙트 / 틱 루프 / 로그 포맷 */

const Arena = (() => {
  const SC = 6, SPS = 3;               // 유닛 1칸 = 6px, 도트 1칸 = 3px
  let cv, ctx, staticCv = null, battle = null, fx = [], raf = 0, last = 0, acc = 0, speed = 1;
  let running = false, paused = false, fast = false, hooks = {}, names = [], hudT = 0, endT = 0;
  const now = () => performance.now();
  const tcol = t => CONFIG.ui.teamColors[t] || '#fbbf24';      // 2 = 중립(보스)
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const vsp = () => Math.sqrt(Math.max(1, speed));
  const STK = ['freeze', 'stun', 'burn', 'poison', 'bleed', 'root', 'silence', 'fear', 'blind', 'slow', 'stagger', 'knock'];
  const STC = { freeze: '#bae6fd', stun: '#fde047', burn: '#fb923c', poison: '#84cc16', bleed: '#ef4444', root: '#a3e635', silence: '#c084fc', fear: '#e879f9', blind: '#94a3b8', slow: '#38bdf8', stagger: '#fbbf24', knock: '#f87171' };
  function kindOf(s) {
    if (s.stun) return 'stun'; if (s.knock) return 'knock'; if (s.root) return 'root'; if (s.silence) return 'silence'; if (s.fear) return 'fear';
    if (s.stagger) return 'stagger'; if (s.blind) return 'blind'; if (s.bleed) return 'bleed'; if (STC[s.key]) return s.key; if (s.slow) return 'slow'; return null;
  }
  const tcv = document.createElement('canvas'), tcx = tcv.getContext('2d'); tcx.imageSmoothingEnabled = false;
  let slots = [];

  function mount(canvas) {
    cv = canvas; const A = CONFIG.battle.arena;
    cv.width = A.w * SC + PAD.l + PAD.r; cv.height = A.h * SC + PAD.t + PAD.b; staticCv = null;
    ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const hit = e => { const r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) * cv.width / r.width, my = (e.clientY - r.top) * cv.height / r.height; return slots.find(q => q.mine && mx >= q.x && mx <= q.x + q.w && my >= q.y && my <= q.y + q.h); };
    cv.onclick = e => { const q = hit(e); if (q && running && hooks.ult) hooks.ult(q.id); };
    cv.onmousemove = e => { const q = hit(e); cv.style.cursor = q && q.rdy ? 'pointer' : ''; };
    cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop);
  }
  function unmount() { if (cv) { cv.onclick = null; cv.onmousemove = null; } slots = []; cancelAnimationFrame(raf); clearTimeout(endT); battle = null; running = false; fx = []; }

  /* 경기 준비(유닛 배치만) → start() 로 시작 */
  function prepare(teams, rule, h, opts) {
    names = teams.map(t => t.name); staticCv = null; hooks = h || {}; fx = []; acc = 0; running = false; paused = false; fast = false;
    battle = new Battle(teams, rule, onEvent, opts);
    if (hooks.hud) hooks.hud(battle);
  }
  function start() {
    if (!battle || running) return;
    running = true; paused = false;
    if (hooks.log) hooks.log({ cat: 'sys', html: '<span class="lt">0.0s</span> 경기 시작' });
  }
  const setSpeed = s => { speed = s; };
  const setPaused = p => { paused = p; };
  function skip() {
    if (!battle || !running) return;
    battle.manual = [false, false];      // 건너뛰기 시 궁극기는 자동 사용
    battle.autoCmd = battle.autoCmd.map(c => c || 'normal');      // 지휘도 자동으로 맡김
    fast = true; let n = 0;
    while (!battle.over && n++ < 20000) battle.tick();
    fast = false;
  }

  /* ---------- 로그 포맷 ---------- */
  const nm = u => `<b style="color:${tcol(u.team)}">${u.ch.name}</b>`;
  const DT = { phys: '물리', magic: '마법', true: '고정' };
  function fmt(ev) {
    const sec = `<span class="lt">${(ev.t * CONFIG.battle.tickMs / 1000).toFixed(1)}s</span> `;
    const via = ev.via ? ` <i class="via">${ev.via}</i>` : '';
    if (ev.type === 'attack') {
      if (ev.immune) return { cat: 'buff', html: `${sec}${nm(ev.dst)} <i class="adv">무적</i>${via}` };
      if (ev.blocked) return { cat: 'buff', html: `${sec}${nm(ev.dst)} <i class="adv">막아냄</i>${via}` };
      const tags = (ev.crit ? ' <i class="crit">치명타</i>' : '') + (ev.splash ? ' <i class="spl">광역</i>' : '') + (ev.path ? ' <i class="spl">관통</i>' : '')
        + (ev.execute ? ' <i class="crit">처형</i>' : '') + (ev.kill ? ' <i class="ko">쓰러짐</i>' : '');
      const dmg = ev.dmg > 0 ? `<em>-${ev.dmg}</em> <small>${DT[ev.dtype] || ''}</small>` : '<em class="hl">보호막 흡수</em>';
      return { cat: ev.kill ? 'ko' : ev.crit ? 'crit' : ev.via ? 'skill' : 'atk', html: `${sec}${nm(ev.src)} → ${nm(ev.dst)}${via} ${dmg}${tags}` };
    }
    if (ev.type === 'heal') return { cat: 'heal', html: `${sec}${nm(ev.src)} ${ev.drain ? '흡혈' : '치유'}${via} <em class="hl">+${ev.amt}</em>${ev.drain || ev.src === ev.dst ? '' : ' → ' + nm(ev.dst)}${ev.reduced ? ' <i class="dis">감소</i>' : ''}` };
    if (ev.type === 'skill') return { cat: 'skill', html: `${sec}${nm(ev.src)} <i class="sk-${ev.slot}">${ev.slot === 'ult' ? '궁극기' : '스킬'}</i> <b>${ev.name}</b> 발동` };
    if (ev.type === 'order') return { cat: 'sys', html: `${sec}<b style="color:${tcol(ev.team)}">${names[ev.team]}</b> 지시 <i class="crit">${ev.name}</i>${ev.unit ? ' → ' + nm(ev.unit) : ''}` };
    if (ev.type === 'ace') return { cat: 'sys', html: `${sec}<b style="color:${tcol(ev.team)}">${names[ev.team]}</b> 상대 전멸!` };
    if (ev.type === 'sudden') return { cat: 'sys', html: `${sec}<b>서든데스</b> — 전원 체력이 줄고, 먼저 코어를 제출하는 팀이 승리합니다! <i class="crit">SUDDEN DEATH</i>` };
    if (ev.type === 'boss') {
      if (ev.phase === 'warn') return { cat: 'sys', html: `${sec}<b>${CONFIG.bossDefs[ev.plan.def].name}</b> 출현 예고 — ${ev.plan.warn}초 뒤 중앙 구덩이에 나타납니다! (처치 시 코어 ${CONFIG.battle.map.core.boss[ev.plan.kind === 'late' ? 'late' : 'first']}개 드랍 + 팀 버프)` };
      if (ev.phase === 'spawn') return { cat: 'sys', html: `${sec}<b>${ev.unit.ch.name}</b> 등장! 막타를 치는 팀이 <i class="crit">코어 ${CONFIG.battle.map.core.boss[ev.unit.bossDef.kind === 'late' ? 'late' : 'first']}개</i>와 팀 버프를 얻습니다` };
      if (ev.phase === 'gone') return { cat: 'sys', html: `${sec}<b>${ev.unit.ch.name}</b> 퇴장 — 서든데스에서는 보스가 없습니다` };
      return { cat: 'sys', html: `${sec}<b style="color:${tcol(ev.team)}">${names[ev.team]}</b> <b>${ev.unit.ch.name}</b> 처치! <i class="crit">${ev.n}개 코어 드랍, 버프 발동</i>${ev.next ? ` · ${ev.next}초 뒤 다음 보스` : ''}` };
    }
    if (ev.type === 'deposit') return { cat: 'sys', html: `${sec}${nm(ev.unit)} <i class="crit">${ev.pts}점 제출</i>` };
    if (ev.type === 'drop') return { cat: 'sys', html: `${sec}${nm(ev.unit)} 코어 ${ev.n}개 드랍` };
    if (ev.type === 'respawn') return { cat: 'sys', html: `${sec}${nm(ev.unit)} 재출격` };
    if (ev.type === 'status') return { cat: 'buff', html: `${sec}${nm(ev.dst)} <i class="${ev.good ? 'adv' : 'dis'}">${ev.name}</i>` };
    return null;
  }

  /* ---------- 이벤트 → 로그 + 연출 ---------- */
  const DCOL = { phys: '#ffffff', magic: '#d8b4fe', true: '#fde047' };
  function onEvent(ev) {
    if (ev.type === 'end') return;
    const line = fmt(ev); if (line && hooks.log) hooks.log(line);
    const t = now();
    const prj = ev.type === 'attack' && ev.proj && ev.proj !== 'melee' && ev.proj !== 'none' && !ev.immune && !ev.blocked && ev.src && ev.dst;
    const pd = prj ? clamp(Math.hypot(ev.dst.x - ev.src.x, ev.dst.y - ev.src.y) * SC / 0.7, 300, 720) / vsp() : 0, dly = fast ? 0 : pd;
    if (ev.type === 'attack') {
      ev.src.fxAtk = t;
      if (ev.hit && ev.dmg > 0) { ev.dst.fxHit = t + dly; }
      if (ev.kill) ev.dst.fxDead = fast ? -1e9 : t + dly;
    }
    if (fast) return;
    if (ev.type === 'sudden') { Sound.play('ult'); fx.push({ k: 'aoe', t0: t, dur: 1400, x: CONFIG.battle.arena.w / 2 * SC, y: CONFIG.battle.arena.h / 2 * SC, r: 34 * SC, color: '#f43f5e' }); return; }
    if (ev.type === 'boss') {
      if (ev.phase === 'spawn') { Sound.play('ult'); fx.push({ k: 'aoe', t0: t, dur: 1200, x: ev.unit.x * SC, y: ev.unit.y * SC, r: 12 * SC, color: ev.unit.f.color }); }
      else if (ev.phase === 'gone') return;
      else if (ev.phase === 'down') { Sound.play('coin'); fx.push({ k: 'aoe', t0: t, dur: 1200, x: ev.unit.x * SC, y: ev.unit.y * SC, r: 14 * SC, color: tcol(ev.team) }); fx.push({ k: 'shard', t0: t, dur: 1400, n: 36, d: 110, s: 4, x: ev.unit.x * SC, y: ev.unit.y * SC - 20, color: '#fde047' }); fx.push({ k: 'shard', t0: t, dur: 1100, n: 24, d: 70, s: 3, x: ev.unit.x * SC, y: ev.unit.y * SC - 20, color: tcol(ev.team) }); fx.push({ k: 'wave', t0: t, dur: 1400, x: ev.unit.x * SC, y: ev.unit.y * SC, r: 30 * SC, color: tcol(ev.team) }); }
      return;
    }
    if (ev.type === 'deposit') { Sound.play('coin'); fx.push({ k: 'wave', t0: t, dur: 1100, x: ev.x * SC, y: ev.y * SC, r: ev.zone.r * SC, color: tcol(ev.team) }); fx.push({ k: 'num', t0: t, dur: 1300, x: ev.x * SC, y: ev.y * SC - 24, text: '+' + ev.pts, color: tcol(ev.team), size: 22 }); return; }
    if (ev.type === 'drop') { fx.push({ k: 'shard', t0: t, dur: 800, n: 8 + ev.n * 2, d: 34, s: 3, x: ev.x * SC, y: ev.y * SC - 14, color: '#fde047' }); return; }
    if (ev.type === 'ace' || ev.type === 'pod' || ev.type === 'respawn' || ev.type === 'struct' || ev.type === 'pick') return;
    Sound.fromEvent({ ...ev, ev: 0, miss: false });
    const px = u => lerp(u.px, u.x, 1) * SC, py = u => u.y * SC - 30;
    if (ev.type === 'skill') {
      fx.push({ k: 'num', t0: t, dur: 1300, x: px(ev.src), y: py(ev.src) - 40, text: ev.name, color: ev.color, size: ev.slot === 'ult' ? 19 : 15 });
      fx.push({ k: 'ring', t0: t, dur: ev.slot === 'ult' ? 1000 : 650, x: px(ev.src), y: ev.src.y * SC, color: ev.color, big: ev.slot === 'ult' });
      if (ev.tgt && ev.tgt !== ev.src) fx.push({ k: 'lock', t0: t, dur: ev.slot === 'ult' ? 1300 : 950, a: ev.src, b: ev.tgt, color: ev.color || '#fff' });
      return;
    }
    if (ev.type === 'move') {
      const d = Math.hypot(ev.x2 - ev.x1, ev.y2 - ev.y1) * SC; if (d < 4) return;
      ev.src.vis = { x1: ev.x1, y1: ev.y1, x2: ev.x2, y2: ev.y2, t0: t, dur: clamp(d / 0.8, 260, 520) / vsp(), kind: ev.kind || 'slide' };
      fx.push({ k: 'dash', t0: t, dur: 900, x1: ev.x1 * SC, y1: ev.y1 * SC - 20, x2: ev.x2 * SC, y2: ev.y2 * SC - 20, color: ev.color, kind: ev.kind || 'slide' }); return;
    }
    if (ev.type === 'aoe') { fx.push({ k: 'aoe', t0: t, dur: 1000, x: ev.x * SC, y: ev.y * SC, r: ev.radius * SC, color: ev.color }); return; }
    if (ev.type === 'beam') { fx.push({ k: 'beam', t0: t, dur: 800, x1: ev.x1 * SC, y1: ev.y1 * SC - 14, x2: ev.x2 * SC, y2: ev.y2 * SC - 14, color: ev.color, w: ev.w ? 2 * (ev.w + 1.2) * SC : 18 }); return; }
    if (ev.type === 'cone') { fx.push({ k: 'cone', t0: t, dur: 900, x: ev.x * SC, y: ev.y * SC - 14, dir: ev.dir, r: ev.range * SC, half: ev.half, color: ev.color }); return; }
    if (ev.type === 'bolt') { fx.push({ k: 'bolt', t0: t, dur: 600, x: ev.x * SC, y: ev.y * SC }); return; }
    if (ev.type === 'star') { fx.push({ k: 'star', t0: t, dur: 900, x: ev.x * SC, y: ev.y * SC }); return; }
    if (ev.type === 'status') { fx.push({ k: 'num', t0: t, dur: 1100, x: px(ev.dst), y: py(ev.dst) - 6, text: ev.name, color: ev.good ? '#86efac' : '#fda4af', size: 12 }); return; }
    if (ev.type === 'attack') {
      if (ev.immune || ev.blocked) { fx.push({ k: 'num', t0: t, dur: 700, x: px(ev.dst), y: py(ev.dst), text: ev.immune ? '무적' : '막음', color: '#7dd3fc', size: 13 }); return; }
      const ec = ev.dtype === 'magic' ? '#c084fc' : ev.dtype === 'true' ? '#fde047' : (ev.src.f.color || '#fff'), ht = t + dly;
      if (prj) fx.push({ k: 'proj', t0: t, dur: pd, x1: px(ev.src), y1: py(ev.src), x2: px(ev.dst), y2: py(ev.dst), color: ec, kind: ev.proj });
      if (ev.via) fx.push({ k: 'mark', t0: ht, dur: 700, b: ev.dst, color: ec });
      if (ev.dmg > 0) {
        fx.push({ k: 'burst', t0: ht, dur: 380, x: px(ev.dst), y: py(ev.dst), color: ec, big: ev.crit || ev.execute });
        fx.push({ k: 'num', t0: ht, dur: 900, x: px(ev.dst) + (Math.random() * 14 - 7), y: py(ev.dst) - 14, text: String(ev.dmg), color: ev.crit ? '#ffd166' : DCOL[ev.dtype] || '#fff', size: ev.crit || ev.execute ? 22 : ev.basic ? 13 : 16 });
      } else fx.push({ k: 'num', t0: ht, dur: 700, x: px(ev.dst), y: py(ev.dst), text: '흡수', color: '#7dd3fc', size: 12 });
    } else if (ev.type === 'heal') {
      fx.push({ k: 'ring', t0: t, dur: 600, x: px(ev.dst), y: ev.dst.y * SC, color: '#34d399' });
      fx.push({ k: 'num', t0: t, dur: 900, x: px(ev.dst), y: py(ev.dst) - 14, text: '+' + ev.amt, color: '#4ade80', size: 15 });
    }
  }

  /* ---------- 렌더 ---------- */
  /* ---------- 사이버펑크 옥상 시가지 ----------
     정적인 부분(바닥·도로·보스 플랫폼·진영 패드·외곽 도시)은 한 번만 그려 캐시하고,
     제출 지점·코어·회복팩·보스 예고처럼 상태가 있는 것만 매 프레임 그립니다. */
  const PAD = { l: 72, r: 72, t: 30, b: 66 };      // 경기장 둘레 도시 테두리(px). 전체 가로:세로가 3:2 로 유지되도록 맞춘 값
  const NEON = ['#22d3ee', '#f472b6', '#a3e635', '#fbbf24', '#c084fc'];
  const COOL = ['#22d3ee', '#38bdf8', '#818cf8', '#2dd4bf'], WARM = ['#f472b6', '#fb7185', '#fbbf24', '#f97316'];
  const HASH = (a, b) => { let h = (Math.floor(a * 7) * 374761393 + Math.floor(b * 7) * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const mix = (a, b, k) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
  const spawnC = t => { const sp = CONFIG.battle.map.spawns[t], ps = sp.pts || sp.ys.map(y => [sp.x, y]); return [ps.reduce((a, p) => a + p[0], 0) / ps.length, ps.reduce((a, p) => a + p[1], 0) / ps.length]; };
  const coreC = () => { const z = (CONFIG.battle.map.zones || []).find(q => q.hub) || { x: CONFIG.battle.arena.w / 2, y: CONFIG.battle.arena.h / 2 }; return { x: z.x, y: z.y }; };      // 중앙 보스 구덩이 위치
  const sideT = (x, y) => { const a = spawnC(0), b = spawnC(1), dx = b[0] - a[0], dy = b[1] - a[1]; return Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy))); };      // 0 = 팀0 진영, 1 = 팀1 진영
  function hexPath(x, y, r) { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.62); } ctx.closePath(); }
  function hexReg(x, y, r, rot) { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + (rot || 0); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); }
  function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function chip(x, y, a, b, col) {      // 홀로그램 명패
    ctx.save(); ctx.font = '800 14px Orbitron, "Noto Sans KR", sans-serif'; const w1 = ctx.measureText(a).width;
    ctx.font = '700 11px "Noto Sans KR", sans-serif'; const w2 = b ? ctx.measureText(b).width : 0, w = Math.max(w1, w2) + 30, h = b ? 40 : 26;
    rrect(x - w / 2, y, w, h, 4); ctx.fillStyle = 'rgba(6,10,28,.82)'; ctx.fill(); ctx.shadowColor = col; ctx.shadowBlur = 8; ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.font = '800 14px Orbitron, "Noto Sans KR", sans-serif'; ctx.fillText(a, x, y + (b ? 13 : h / 2 + 1));
    if (b) { ctx.fillStyle = col; ctx.font = '700 11px "Noto Sans KR", sans-serif'; ctx.fillText(b, x, y + 29); }
    ctx.restore();
  }

  /* ----- 외곽 도시 (캔버스 테두리 영역) ----- */
  function tower(x, y, w, h, seed, pal) {
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#121a42'); g.addColorStop(1, '#070a1e'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    const nc = pal[Math.floor(HASH(seed, 3) * pal.length)];
    ctx.fillStyle = nc + 'cc'; ctx.fillRect(x, y, w, 2); ctx.fillStyle = nc + '55'; ctx.fillRect(x, y, 2, h);
    for (let wy = y + 8; wy < y + h - 8; wy += 11) for (let wx = x + 6; wx < x + w - 8; wx += 10) {
      const q = HASH(wx + seed, wy);
      ctx.fillStyle = q > 0.5 ? (q > 0.82 ? pal[1] + 'cc' : q > 0.68 ? pal[0] + 'cc' : '#fcd34dbb') : '#0f1538'; ctx.fillRect(wx, wy, 5, 6);
    }
    if (HASH(seed, 9) > 0.55 && w > 26) { ctx.save(); ctx.shadowColor = nc; ctx.shadowBlur = 8; ctx.fillStyle = nc; ctx.fillRect(x + 6 + HASH(seed, 5) * (w - 20), y + 14 + HASH(seed, 6) * h * 0.3, 4, 26 + HASH(seed, 7) * 30); ctx.restore(); }
  }
  function drawCity() {
    const A = CONFIG.battle.arena, w = cv.width, h = cv.height, fx = PAD.l, fy = PAD.t, fw = A.w * SC, fh = A.h * SC, by = fy + fh;
    const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#040614'); sky.addColorStop(1, '#0d0a26'); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    [[0.08, 0.3, '#22d3ee'], [0.92, 0.7, '#ec4899']].forEach(([a, b, c]) => { const rg = ctx.createRadialGradient(w * a, h * b, 0, w * a, h * b, w * 0.3); rg.addColorStop(0, c + '26'); rg.addColorStop(1, 'transparent'); ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h); });
    for (let x = -10, i = 0; x < w; i++) { const bw = 22 + HASH(i, 11) * 34, bh = 10 + HASH(i, 12) * 18; tower(x, fy - bh, bw, bh + 6, i + 100, HASH(i, 1) < 0.5 ? COOL : WARM); x += bw + 3; }      // 위쪽 먼 스카이라인
    [[0, fx, COOL, 1], [fx + fw, w, WARM, 2]].forEach(([x0, x1, pal, sd]) => {      // 좌(파랑 계열)·우(붉은 계열) 도시 열
      for (let y = -30, i = 0; y < h; i++) { const bh = 80 + HASH(i, sd * 7) * 120, bw = (x1 - x0) * (0.62 + HASH(sd, i) * 0.38); tower(x0 + (x1 - x0 - bw) * HASH(i, 3 + sd), y, bw, bh - 4, i * 3 + sd, pal); y += bh; }
    });
    for (let x = 0, i = 0; x < w; i++) { const bw = 40 + HASH(i, 21) * 60, bh = 24 + HASH(i, 22) * 14, top = by + 34 + (38 - bh); tower(x, top, bw, h - top + 2, i + 300, HASH(i, 2) < 0.5 ? COOL : WARM); x += bw + 4; }      // 앞쪽 건물
    ctx.fillStyle = '#080c1e'; ctx.fillRect(fx - 10, fy, 10, fh + 34); ctx.fillRect(fx + fw, fy, 10, fh + 34);      // 옥상 슬래브 측면
    const sf = ctx.createLinearGradient(0, by, 0, by + 34); sf.addColorStop(0, '#28365f'); sf.addColorStop(0.25, '#16203f'); sf.addColorStop(1, '#080c1c'); ctx.fillStyle = sf; ctx.fillRect(fx - 10, by, fw + 20, 34);      // 슬래브 정면
    ctx.fillStyle = 'rgba(125,211,252,.35)'; ctx.fillRect(fx - 10, by, fw + 20, 2);
    for (let x = fx + 60; x < fx + fw; x += 90) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x, by + 2, 2, 32); ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(x + 2, by + 2, 1, 32); }
    const nf = ctx.createLinearGradient(fx, 0, fx + fw, 0); nf.addColorStop(0, tcol(0)); nf.addColorStop(0.5, '#a78bfa'); nf.addColorStop(1, tcol(1));
    ctx.save(); ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 10; ctx.fillStyle = nf; ctx.globalAlpha = 0.85; ctx.fillRect(fx - 10, by + 24, fw + 20, 3); ctx.restore();
  }

  /* ----- 바닥 ----- */
  function drawFloor() {
    const A = CONFIG.battle.arena, W = A.w * SC, H = A.h * SC, T = 15 * SC, M = CONFIG.battle.map;
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1b2846'); g.addColorStop(0.5, '#141e38'); g.addColorStop(1, '#101a34'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let x = 0, i = 0; x < W; x += T, i++) for (let y = 0, j = 0; y < H; y += T, j++) {      // 바닥 판(15유닛) + 볼트
      ctx.fillStyle = `rgba(255,255,255,${0.012 + HASH(i * 3 + 1, j * 5 + 2) * 0.03})`; ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
      ctx.fillStyle = 'rgba(150,180,230,.22)'; [[x + 5, y + 5], [x + T - 6, y + 5], [x + 5, y + T - 6], [x + T - 6, y + T - 6]].forEach(p => ctx.fillRect(p[0], p[1], 2, 2));
    }
    ctx.strokeStyle = 'rgba(2,6,18,.8)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = 0; x <= W; x += T) { ctx.moveTo(x, 0); ctx.lineTo(x, H); } for (let y = 0; y <= H; y += T) { ctx.moveTo(0, y); ctx.lineTo(W, y); } ctx.stroke();
    [0, 1].forEach(t => { const c = spawnC(t), rg = ctx.createRadialGradient(c[0] * SC, c[1] * SC, 0, c[0] * SC, c[1] * SC, 50 * SC); rg.addColorStop(0, tcol(t) + '30'); rg.addColorStop(1, 'transparent'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H); });
    const l = coreC(); if (l) { const rg = ctx.createRadialGradient(l.x * SC, l.y * SC, 0, l.x * SC, l.y * SC, 38 * SC); rg.addColorStop(0, '#f59e0b30'); rg.addColorStop(1, 'transparent'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H); }
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72); vg.addColorStop(0, 'transparent'); vg.addColorStop(1, 'rgba(0,0,8,.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }
  function drawRim() {      // 옥상 난간 + 네온 테두리 (모든 정적 요소 위)
    const A = CONFIG.battle.arena, W = A.w * SC, H = A.h * SC;
    ctx.fillStyle = '#060a18'; ctx.fillRect(0, 0, W, 9); ctx.fillRect(0, H - 9, W, 9); ctx.fillRect(0, 0, 9, H); ctx.fillRect(W - 9, 0, 9, H);
    const eg = ctx.createLinearGradient(0, 0, W, H); eg.addColorStop(0, tcol(0)); eg.addColorStop(0.5, '#a78bfa'); eg.addColorStop(1, tcol(1));
    ctx.save(); ctx.strokeStyle = eg; ctx.globalAlpha = 0.85; ctx.lineWidth = 2; ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 10; ctx.strokeRect(9.5, 9.5, W - 19, H - 19); ctx.restore();
  }
  function drawParks() {      // 옥상 정원 (밟고 지나갈 수 있는 장식)
    (CONFIG.battle.map.parks || []).forEach((p, n) => {
      const x = p.x * SC, y = p.y * SC, w = p.w * SC, h = p.h * SC;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + 4, y + 5, w, h);
      ctx.fillStyle = '#2a3a52'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
      const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#1f6b3a'); g.addColorStop(1, '#14452a'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      for (let i = 0; i < Math.round(w * h / 90); i++) { ctx.fillStyle = HASH(i, n + 5) > 0.5 ? '#2f9e57' : '#0f3a22'; ctx.fillRect(x + 3 + HASH(n, i) * (w - 8), y + 3 + HASH(i, n + 9) * (h - 8), 3, 3); }
      for (let i = 0; i < Math.max(2, Math.round(w / 34)); i++) {      // 나무·덤불
        const bx = x + w * (0.18 + 0.64 * HASH(i, n + 2)), by = y + h * (0.3 + 0.4 * HASH(n + 3, i)), br = 9 + HASH(i, n) * 7;
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(bx + 3, by + br * 0.7, br, br * 0.5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#166534'; ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill(); ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.arc(bx - br * 0.25, by - br * 0.3, br * 0.62, 0, 7); ctx.fill();
      }
    });
  }

  /* ----- 도로(네온 라인) ----- */
  function drawLanes() {
    const M = CONFIG.battle.map, ls = M.lanes || [], a = spawnC(0), b = spawnC(1);
    const path = pts => { ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(p[0] * SC, p[1] * SC) : ctx.moveTo(p[0] * SC, p[1] * SC))); };
    const gr = ctx.createLinearGradient(a[0] * SC, a[1] * SC, b[0] * SC, b[1] * SC); gr.addColorStop(0.3, tcol(0)); gr.addColorStop(0.5, mix(tcol(0), tcol(1), 0.5)); gr.addColorStop(0.7, tcol(1));
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ls.forEach(l => { path(l.pts); ctx.strokeStyle = gr; ctx.globalAlpha = 0.7; ctx.lineWidth = (l.w || 12) * SC + 6; ctx.shadowColor = '#7dd3fc'; ctx.shadowBlur = 12; ctx.stroke(); });      // 네온 연석
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    ls.forEach(l => { path(l.pts); ctx.strokeStyle = '#0a1024'; ctx.lineWidth = (l.w || 12) * SC - 2; ctx.stroke(); path(l.pts); ctx.strokeStyle = 'rgba(148,163,255,.05)'; ctx.lineWidth = (l.w || 12) * SC * 0.55; ctx.stroke(); });      // 아스팔트
    ls.forEach(l => { path(l.pts); ctx.strokeStyle = gr; ctx.globalAlpha = 0.45; ctx.lineWidth = 2; ctx.setLineDash([18, 14]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; });      // 중앙선
    ls.forEach(l => l.pts.slice(1, -1).forEach(p => {      // 육각 거점 표시
      const x = p[0] * SC, y = p[1] * SC, c = mix(tcol(0), tcol(1), sideT(p[0], p[1]));
      hexReg(x, y, 3.2 * SC, Math.PI / 6); ctx.fillStyle = '#0a1128'; ctx.fill(); ctx.shadowColor = c; ctx.shadowBlur = 10; ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.stroke(); ctx.shadowBlur = 0;
      hexReg(x, y, 1.9 * SC, Math.PI / 6); ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
    }));
    ctx.restore();
  }

  /* ----- 중앙 보스 플랫폼 ----- */
  function drawCore() {
    const l = coreC();
    const cx = l.x * SC, cy = l.y * SC, R = 26 * SC, oct = k => { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 4 * i + Math.PI / 8; ctx.lineTo(cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k); } ctx.closePath(); };
    ctx.save();
    oct(1.12); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fill();
    oct(1); const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, 'rgba(244,63,94,.5)'); g.addColorStop(0.55, 'rgba(159,18,57,.26)'); g.addColorStop(1, 'rgba(50,8,22,.55)'); ctx.fillStyle = g; ctx.fill();
    ctx.save(); oct(0.97); ctx.clip(); const hr = 6.4 * SC, hw = Math.sqrt(3) * hr;      // 벌집 타일
    ctx.strokeStyle = 'rgba(253,164,175,.4)'; ctx.lineWidth = 1.8;
    for (let row = -6; row <= 6; row++) for (let col = -5; col <= 5; col++) { const x = cx + col * hw + (row & 1 ? hw / 2 : 0), y = cy + row * hr * 1.5; hexReg(x, y, hr * 0.96, Math.PI / 6); ctx.stroke(); }
    hexReg(cx, cy, hr * 0.96, Math.PI / 6); ctx.fillStyle = 'rgba(253,164,175,.22)'; ctx.fill();
    ctx.restore();
    ctx.shadowColor = '#fb7185'; ctx.shadowBlur = 16; ctx.strokeStyle = '#fb7185'; ctx.lineWidth = 4; oct(1); ctx.stroke();
    ctx.shadowBlur = 0; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.55; oct(0.93); ctx.stroke(); ctx.restore();
  }

  /* ----- 진영 시작 패드 ----- */
  function drawSpawns() {
    [0, 1].forEach(t => {
      const sp = CONFIG.battle.map.spawns[t], pts = sp.pts || sp.ys.map(y => [sp.x, y]), c = spawnC(t), cx = c[0] * SC, cy = c[1] * SC, R = 11 * SC, col = tcol(t);
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.arc(cx + 4, cy + 6, R, 0, 7); ctx.fill();
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, '#16224a'); g.addColorStop(1, '#0a1128'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
      ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.lineWidth = 2; ctx.globalAlpha = 0.6; ctx.setLineDash([8, 7]); ctx.beginPath(); ctx.arc(cx, cy, R * 0.82, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 0.5; pts.forEach(p => { hexReg(p[0] * SC, p[1] * SC + 3, 3.4 * SC, Math.PI / 6); ctx.stroke(); }); ctx.globalAlpha = 1;
      ctx.translate(cx, cy); ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.strokeStyle = col; ctx.fillStyle = col + '22'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-26, -30); ctx.lineTo(26, -30); ctx.lineTo(26, 4); ctx.lineTo(0, 34); ctx.lineTo(-26, 4); ctx.closePath(); ctx.fill(); ctx.stroke();      // 방패 문장
      ctx.shadowBlur = 8; ctx.fillStyle = col; ctx.font = '800 36px Orbitron, "Noto Sans KR", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t ? 'Ω' : 'A', 0, -4);
      ctx.restore();
      chip(cx, cy + R + 10, (names[t] || (t ? 'RED' : 'BLUE')) + ' 진영', t ? 'Ω-SPAWN' : 'A-SPAWN', col);
    });
  }

  function buildStatic() {
    const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
    const real = ctx; ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    try {
      drawCity();
      ctx.save(); ctx.translate(PAD.l, PAD.t); drawFloor(); drawParks(); drawLanes(); drawCore(); drawSpawns(); drawRim(); ctx.restore();
    } finally { ctx = real; }
    return c;
  }

  /* ----- 상태가 있는 맵 요소: 제출 지점 · 코어 · 회복 장치 · 보스 예고 ----- */
  function drawMapGround(t) {
    const M = battle.map, pulse = 0.5 + 0.5 * Math.sin(t * 0.006);
    const pit = M.zones.find(z => z.hub), boss = battle.units.find(u => u.team === 2 && u.alive);
    if (pit) {
      const x = pit.x * SC, y = pit.y * SC, r = pit.r * SC, hot = !!boss;
      ctx.save(); ctx.globalAlpha = hot ? 0.5 + 0.35 * pulse : 0.3; ctx.strokeStyle = hot ? '#ef4444' : '#fb7185'; ctx.lineWidth = 3; ctx.setLineDash([16, 12]); ctx.lineDashOffset = -t * 0.02;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.restore();
      chip(x, y + r + 8, 'THE PIT', hot ? 'BOSS' : '보스 구덩이', hot ? '#ef4444' : '#fb7185');
    }
    for (const pl of battle.bossPlan) {
      if (pl.spawned || pl.atTick == null) continue;
      const left = pl.atTick - battle.t; if (left > pl.warn * 20) continue;
      const d = CONFIG.bossDefs[pl.def], x = pl.lair.x * SC, y = pl.lair.y * SC;
      ctx.save(); ctx.strokeStyle = d.color; ctx.fillStyle = d.color; ctx.globalAlpha = 0.35 + 0.35 * pulse; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 0.03;
      ctx.beginPath(); ctx.arc(x, y, 8 * SC, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 0.9; ctx.textAlign = 'center'; ctx.font = '700 12px "Noto Sans KR", sans-serif';
      ctx.fillText(d.name + ' ' + Math.ceil(left / 20) + '초 후', x, y - 8 * SC - 8); ctx.restore();
    }
    for (const z of M.zones) if (z.deposit) {
      const x = z.x * SC, y = z.y * SC, r = z.r * SC, ch = battle.units.filter(u => u.alive && u.depProg > 0 && u.depAt === z.id);
      ctx.save();
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(103,232,249,.28)'); g.addColorStop(1, 'rgba(103,232,249,.04)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.55 + 0.3 * pulse; ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 3; ctx.shadowColor = '#67e8f9'; ctx.shadowBlur = 12; ctx.setLineDash([14, 10]); ctx.lineDashOffset = t * 0.02; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 0.8; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, 7); ctx.stroke();
      ch.forEach(u => { ctx.globalAlpha = 0.9; ctx.strokeStyle = tcol(u.team); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r + 5 + u.team * 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, u.depProg)); ctx.stroke(); });
      const bob = 3 * Math.sin(t * 0.004 + z.x); ctx.globalAlpha = 1; ctx.shadowBlur = 16; ctx.fillStyle = '#67e8f9'; hexReg(x, y - 12 - bob, 10, t * 0.001); ctx.fill(); ctx.fillStyle = '#ecfeff'; hexReg(x, y - 12 - bob, 4.5, -t * 0.001); ctx.fill();
      ctx.restore();
      chip(x, y + r + 8, 'DEPOSIT', z.name, '#67e8f9');
    }
    for (const c of battle.cores) {
      const x = c.x * SC, y = c.y * SC, big = c.type === 'big', locked = c.lockUntil > battle.t, bob = 2.5 * Math.sin(t * 0.004 + c.id), R = big ? 11 : 6, col = big ? '#fb923c' : '#fde047';
      ctx.save(); ctx.globalAlpha = locked ? 0.35 + 0.25 * Math.sin(t * 0.03) : 1;
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ell(x, y + 3, R * 1.3, R * 0.5); ctx.fill();
      const g = ctx.createRadialGradient(x, y - 8 - bob, 0, x, y - 8 - bob, R * 2.6); g.addColorStop(0, big ? 'rgba(251,146,60,.55)' : 'rgba(253,224,71,.5)'); g.addColorStop(1, 'rgba(253,224,71,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 8 - bob, R * 2.6, 0, 7); ctx.fill();
      ctx.shadowColor = col; ctx.shadowBlur = big ? 18 : 10; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y - 8 - bob, R, 0, 7); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.globalAlpha *= 0.85; ctx.beginPath(); ctx.arc(x - R * 0.25, y - 8 - bob - R * 0.25, R * 0.38, 0, 7); ctx.fill();
      if (big) { ctx.globalAlpha = locked ? 0.35 + 0.25 * Math.sin(t * 0.03) : 0.6 + 0.4 * pulse; ctx.strokeStyle = '#fff7ed'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 8 - bob, R + 5, 0, 7); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; hexReg(x, y - 8 - bob, R + 10, t * 0.0008); ctx.stroke(); }
      ctx.restore();
    }
    for (const p of M.pods) {      // 홀로그램 메디팩
      const x = p.x * SC, y = p.y * SC, ready = battle.t >= p.readyAt, rs = p.big ? 14 : 10, rx = rs + 14, ry = rx * 0.6, bob = ready ? 3 * Math.sin(t * 0.004 + p.x) : 0;
      ctx.save(); ctx.globalAlpha = ready ? 1 : 0.5;
      ctx.fillStyle = '#081426'; ctx.beginPath(); ctx.ellipse(x, y + 6, rx, ry, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = ready ? '#34d399' : '#64748b'; ctx.lineWidth = 3; ctx.shadowColor = '#34d399'; ctx.shadowBlur = ready ? 10 + 8 * pulse : 0; ctx.beginPath(); ctx.ellipse(x, y + 6, rx, ry, 0, 0, 7); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.ellipse(x, y + 6, rx * 0.68, ry * 0.68, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      if (ready) { const bg = ctx.createLinearGradient(0, y + 4, 0, y - 34); bg.addColorStop(0, 'rgba(52,211,153,.30)'); bg.addColorStop(1, 'rgba(52,211,153,0)'); ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(x - rx * 0.6, y + 6); ctx.lineTo(x - rs * 0.5, y - 34); ctx.lineTo(x + rs * 0.5, y - 34); ctx.lineTo(x + rx * 0.6, y + 6); ctx.closePath(); ctx.fill(); }
      const cy = y - 16 - bob; ctx.fillStyle = ready ? '#6ee7b7' : '#94a3b8'; ctx.shadowColor = '#34d399'; ctx.shadowBlur = ready ? 12 : 0;
      ctx.fillRect(x - rs / 4, cy - rs * 0.55, rs / 2, rs * 1.1); ctx.fillRect(x - rs * 0.55, cy - rs / 4, rs * 1.1, rs / 2); ctx.shadowBlur = 0;
      if (!ready) { const k = 1 - (p.readyAt - battle.t) / (p.cd * 20); ctx.strokeStyle = '#6ee7b7'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y + 6, rx + 5, ry + 3, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, k)); ctx.stroke(); }
      ctx.restore();
    }
  }
  const OH = 14;      // 장애물 기본 높이(px)
  const obsSprites = new Map();
  /* 건물·기둥은 창문/네온이 많아 매 프레임 그리면 무거우므로, 구조물마다 한 번만 그려 스프라이트로 재사용합니다 */
  function obsSprite(o) {
    let sp = obsSprites.get(o); if (sp) return sp;
    const z = o.z || OH, pad = 14, R = HASH(o.x, o.y), st = sideT(o.t === 'c' ? o.x : o.x + o.w / 2, o.t === 'c' ? o.y : o.y + o.h / 2), pal = st < 0.42 ? COOL : st > 0.58 ? WARM : NEON, neon = pal[Math.floor(R * pal.length)];      // 진영 쪽에 따라 파랑/빨강 네온
    const c = document.createElement('canvas'), g = c.getContext('2d');
    if (o.t === 'c') {
      const r = o.r * SC, W = r * 2 + pad * 2, H = pad + 18 + z + r * 0.7 + pad, cx = pad + r, top = pad + 18, base = top + z;
      c.width = W; c.height = H;
      g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(cx + 3, base + 3, r, r * 0.7, 0, 0, 7); g.fill();
      g.fillStyle = '#10153a'; g.fillRect(cx - r, top, r * 2, z); g.beginPath(); g.ellipse(cx, base, r, r * 0.7, 0, 0, Math.PI); g.fill();
      g.fillStyle = neon + '55'; g.fillRect(cx - r, top + z * 0.45, r * 2, 2);
      g.fillStyle = '#1d2456'; g.beginPath(); g.ellipse(cx, top, r, r * 0.7, 0, 0, 7); g.fill();
      g.shadowColor = neon; g.shadowBlur = 10; g.strokeStyle = neon; g.lineWidth = 2; g.stroke();
      g.fillStyle = neon + 'aa'; g.beginPath(); g.ellipse(cx, top, r * 0.45, r * 0.3, 0, 0, 7); g.fill();
      g.strokeStyle = neon; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, top); g.lineTo(cx, top - 14); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, top - 14, 2.5, 0, 7); g.fill();
      sp = { c, ox: cx, oy: base };
    } else {
      const w = o.w * SC, h = o.h * SC, W = w + pad * 2, H = pad + 16 + h + z + pad, ty = pad + 16, fy = ty + h;      // ty: 옥상 윗면 시작, fy: 정면 시작
      c.width = W; c.height = H;
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(pad + 4, ty + z + 4, w, h);
      g.fillStyle = '#0a0e28'; g.fillRect(pad, fy, w, z);                                           // 정면
      if (z >= 16) {
        for (let wx = pad + 4; wx < pad + w - 6; wx += 9) for (let wy = fy + 4; wy < fy + z - 5; wy += 8) {
          const q = HASH(wx + o.x, wy + o.y);
          g.fillStyle = q > 0.55 ? (q > 0.85 ? (st < 0.5 ? '#67e8f9cc' : '#f9a8d4cc') : q > 0.7 ? '#fdba74cc' : '#fde68acc') : '#151a40'; g.fillRect(wx, wy, 6, 4);
        }
      } else {                                                                                      // 낮은 방벽: 경고 줄무늬
        g.fillStyle = '#1b1f4a'; g.fillRect(pad, fy, w, z); g.fillStyle = '#fbbf2455';
        for (let sx = pad - z; sx < pad + w; sx += 10) { g.beginPath(); g.moveTo(sx, fy + z); g.lineTo(sx + 5, fy + z); g.lineTo(sx + 5 + z, fy); g.lineTo(sx + z, fy); g.closePath(); g.fill(); }
      }
      g.fillStyle = neon + 'cc'; g.fillRect(pad, fy, w, 2);                                       // 간판 네온 띠
      g.fillStyle = '#1a1f4d'; g.fillRect(pad, ty, w, h);                                           // 옥상
      g.fillStyle = '#262d6b'; g.fillRect(pad + 3, ty + 3, Math.max(0, w * 0.35), Math.max(0, h * 0.4));      // 환풍기
      g.save(); g.shadowColor = neon; g.shadowBlur = 8; g.strokeStyle = neon; g.lineWidth = 2; g.strokeRect(pad + 1, ty + 1, w - 2, h - 2); g.restore();
      if (z >= 22 && R > 0.35) { g.strokeStyle = '#94a3b8'; g.lineWidth = 2; g.beginPath(); g.moveTo(pad + w * 0.8, ty); g.lineTo(pad + w * 0.8, ty - 13); g.stroke(); g.fillStyle = '#f87171'; g.beginPath(); g.arc(pad + w * 0.8, ty - 13, 2.2, 0, 7); g.fill(); }
      sp = { c, ox: pad, oy: ty + z };
    }
    obsSprites.set(o, sp); return sp;
  }
  function drawObstacle(o) {
    ctx.save();
    if (o.obe) {                      // 쿰의 오벨리스크
      const x = o.x * SC, y = o.y * SC, w = 11;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x + 3, y + 2, 13, 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#a98543'; ctx.fillRect(x - w, y - 42, w * 2, 42); ctx.fillStyle = '#d6b36a'; ctx.fillRect(x - w, y - 42, w, 42);
      ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.moveTo(x - w, y - 42); ctx.lineTo(x, y - 56); ctx.lineTo(x + w, y - 42); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3b2a12'; ctx.fillRect(x - 2, y - 34, 4, 16); ctx.fillRect(x - 6, y - 28, 12, 3);
      const su = o.unit; if (su && su.alive) { const bw = 36, k = Math.max(0, su.hp / su.maxHp); ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(x - bw / 2 - 1, y - 66, bw + 2, 7); ctx.fillStyle = tcol(su.team); ctx.fillRect(x - bw / 2, y - 65, bw * k, 5); }
    } else {
      const sp = obsSprite(o); ctx.drawImage(sp.c, o.x * SC - sp.ox, o.y * SC - sp.oy);
    }
    ctx.restore();
  }
  function drawScore() {
    const w = cv.width, h = cv.height, cx = w / 2, y = 10, boss = battle.units.find(u => u.team === 2 && u.alive);
    ctx.save();
    if (battle.sudden) { ctx.fillStyle = 'rgba(244,63,94,.07)'; ctx.fillRect(0, 0, w, h); }
    ctx.fillStyle = 'rgba(8,12,32,.8)'; ctx.fillRect(cx - 170, y - 4, 340, 64);
    ctx.textBaseline = 'middle';
    [0, 1].forEach(t => {
      ctx.textAlign = t ? 'left' : 'right'; ctx.fillStyle = tcol(t); ctx.font = '800 36px Orbitron, "Noto Sans KR", sans-serif';
      ctx.fillText(String(Math.round(battle.score[t])), cx + (t ? 74 : -74), y + 24);
      ctx.font = '700 10px "Noto Sans KR", sans-serif'; ctx.fillStyle = '#cbd5e1'; const bf = battle.units.reduce((m, u) => (u.team === t && u.alive ? Math.max(m, ...u.st.filter(s => s.key === 'bossbuff').map(s => s.dur)) : m), 0); ctx.fillText(bf > 0 ? '버프 ' + Math.ceil(bf / 20) + '초' : '보스 ' + battle.bossKills[t], cx + (t ? 74 : -74), y + 48);
    });
    ctx.textAlign = 'center'; ctx.fillStyle = battle.sudden ? '#fb7185' : '#fff'; ctx.font = '800 24px Orbitron, "Noto Sans KR", sans-serif'; ctx.fillText(battle.clockText(), cx, y + 22);
    ctx.fillStyle = '#ffd166'; ctx.font = '700 11px "Noto Sans KR", sans-serif';
    let sub = '';
    if (battle.sudden) sub = '먼저 코어를 제출하는 팀 승리';
    else if (!boss) { const pl = battle.bossPlan.find(p => !p.spawned); sub = pl ? (pl.atTick != null ? '보스 ' + Math.max(0, Math.ceil((pl.atTick - battle.t) / 20)) + '초 후' : '보스 처치 후 다음 보스 등장') : '보스 없음'; }
    else sub = boss.ch.name + ' (코어 ' + CONFIG.battle.map.core.boss[boss.bossDef.kind === 'late' ? 'late' : 'first'] + '개 + 버프)';
    ctx.fillText(sub, cx, y + 46);
    if (boss) {
      ctx.fillStyle = 'rgba(8,12,32,.7)'; ctx.fillRect(cx - 130, y + 66, 260, 12);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(cx - 124, y + 70, 248, 5);
      ctx.fillStyle = boss.f.color; ctx.fillRect(cx - 124, y + 70, 248 * Math.max(0, boss.hp / boss.maxHp), 5);
    }
    ctx.restore();
  }

  /* ---------- 유닛 렌더 ---------- */
  const UNIT_PX = 48;                      // 스프라이트 높이(px, 크기 1 기준). 캐릭터가 너무 크거나 작아 보이면 이 값만 조절하세요
  const imgCache = new Map();
  function spriteOf(u) {
    const key = u.f.id + '|' + (u.form || '');
    let im = imgCache.get(key);
    if (im === undefined) {
      try { im = new Image(); im.src = Sprites.url(u.f, u.form || undefined); } catch (e) { im = null; }
      imgCache.set(key, im);
    }
    return im && im.complete && im.naturalWidth ? im : null;
  }
  const ell = (x, y, rx, ry) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); };

  function tintOver(im, w, H, col, a) {
    const W = Math.ceil(w), Hh = Math.ceil(H); if (tcv.width !== W || tcv.height !== Hh) { tcv.width = W; tcv.height = Hh; tcx.imageSmoothingEnabled = false; }
    tcx.globalCompositeOperation = 'source-over'; tcx.clearRect(0, 0, W, Hh); tcx.drawImage(im, 0, 0, W, Hh);
    tcx.globalCompositeOperation = 'source-atop'; tcx.fillStyle = col; tcx.fillRect(0, 0, W, Hh);
    const ga = ctx.globalAlpha; ctx.globalAlpha = ga * a; ctx.drawImage(tcv, -w / 2, -H, w, H); ctx.globalAlpha = ga;
  }
  const brk = (cx, cy, hw, hh, l) => { ctx.beginPath(); [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => { ctx.moveTo(cx + sx * hw, cy + sy * (hh - l)); ctx.lineTo(cx + sx * hw, cy + sy * hh); ctx.lineTo(cx + sx * (hw - l), cy + sy * hh); }); ctx.stroke(); };

  function drawUnit(u, alpha, t) {
    if (u.struct || battle.gone(u)) return;
    let fade = 1;
    if (!u.alive) { const k = (t - u.fxDead) / 600; if (k >= 1 || (k < 0 && u.fxDead - t > 1500)) return; fade = k < 0 ? 1 : 1 - k; }
    const sc = u.scale || 1, face = u.facing < 0 ? -1 : 1;
    let x = lerp(u.px, u.x, alpha) * SC, y = lerp(u.py, u.y, alpha) * SC, V = u.vis, ve = 1;
    if (V) {
      const k = (t - V.t0) / V.dur;
      if (k >= 1) { u.vis = null; V = null; }
      else {
        const vk = Math.max(0, k);
        if (V.kind === 'blink') { ve = vk < 0.5 ? 0 : 1; fade *= 0.2 + 0.8 * Math.abs(vk - 0.5) * 2; }
        else ve = 1 - Math.pow(1 - vk, 3);
        x = lerp(V.x1, V.x2, ve) * SC; y = lerp(V.y1, V.y2, ve) * SC;
      }
    }
    const moving = Math.hypot(u.x - u.px, u.y - u.py) > 0.01;
    const bob = u.alive && moving ? Math.abs(Math.sin(t * 0.02)) * 2 : 0;
    const dA = t - u.fxAtk, lunge = dA >= 0 && dA < 140 ? Math.sin(dA / 140 * Math.PI) * 5 * face : 0;
    const dH = t - u.fxHit, flash = dH >= 0 && dH < 120 ? 1 - dH / 120 : 0;
    const col = u.team === 2 ? (u.f.color || '#fbbf24') : tcol(u.team);
    const H = UNIT_PX * sc;
    const deb = u.alive ? u.st.filter(s => s.good === false && s.dur < 9000) : [], ks = deb.map(kindOf), main = STK.find(k => ks.includes(k)) || null, tcl = main ? STC[main] : null;
    const shk = main === 'fear' || main === 'stagger' ? Math.sin(t * 0.09) * 2.5 : 0;
    const vis = battle.hidden(u) ? 0.35 : 1;

    ctx.save();
    ctx.globalAlpha = fade * vis;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ell(x, y + 2, 12 * sc, 4.5 * sc); ctx.fill();
    ctx.strokeStyle = tcl || col; ctx.lineWidth = 2; ctx.globalAlpha *= 0.85; ell(x, y + 2, 14 * sc, 5.5 * sc); ctx.stroke();
    ctx.globalAlpha = fade * vis;
    if (u.alive && u.st.some(s => s.key === 'bossbuff')) {
      ctx.save(); ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 16; ctx.lineWidth = 3; ctx.globalAlpha = (0.55 + 0.3 * Math.sin(t * 0.008)) * fade * vis; ell(x, y + 2, (19 + 2 * Math.sin(t * 0.008)) * sc, 7.5 * sc); ctx.stroke();
      ctx.fillStyle = col; for (let i = 0; i < 5; i++) { const ph = (t * 0.001 + i * 0.2) % 1; ctx.globalAlpha = (1 - ph) * 0.8 * fade * vis; ctx.beginPath(); ctx.arc(x + Math.cos(i * 2.4) * 14 * sc, y + 2 - ph * H * 0.8, 2.5, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    ctx.globalAlpha = fade * vis;

    const im = spriteOf(u);
    const body = (bx, by, a, tint) => {
      ctx.save(); ctx.globalAlpha = a; ctx.translate(bx + lunge + shk, by + 2 - bob);
      if (typeof u.glow === 'string') { ctx.shadowColor = u.glow; ctx.shadowBlur = 14; }
      if (tint && main === 'freeze') { ctx.shadowColor = '#7dd3fc'; ctx.shadowBlur = 16; }
      if (im) {
        const w = H * im.naturalWidth / im.naturalHeight;
        ctx.scale(face, 1); ctx.drawImage(im, -w / 2, -H, w, H);
        if (tint && tcl) tintOver(im, w, H, tcl, main === 'blind' ? 0.55 : 0.4 + 0.12 * Math.sin(t * 0.012));
        if (tint && flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= flash * 0.7; ctx.drawImage(im, -w / 2, -H, w, H); }
      } else {
        ctx.fillStyle = tint && tcl ? tcl : col; ctx.beginPath(); ctx.arc(0, -H / 2, H * 0.3, 0, 7); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '700 ' + Math.round(H * 0.3) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(u.f.icon || '?', 0, -H / 2);
      }
      ctx.restore();
    };
    if (V && V.kind !== 'blink') for (let i = 3; i >= 1; i--) { const ge = Math.max(0, ve - 0.14 * i); if (ge < ve) body(lerp(V.x1, V.x2, ge) * SC, lerp(V.y1, V.y2, ge) * SC, fade * vis * (0.32 - i * 0.07), false); }
    body(x, y, fade * vis, true);

    if (u.alive) {
      const ty = y + 2 - H - bob, tk = t * 0.001, bodyY = y + 2 - H / 2;
      if (u.st.some(s => s.invuln)) { ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ell(x, y + 2, 17 * sc, 7 * sc); ctx.stroke(); ctx.setLineDash([]); }
      if (ks.includes('stun')) { ctx.font = '800 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = STC.stun; for (let i = 0; i < 3; i++) { const a = t * 0.008 + i * 2.094; ctx.fillText('★', x + Math.cos(a) * 14 * sc, ty + 4 + Math.sin(a) * 4); } }
      if (ks.includes('freeze')) { ctx.strokeStyle = '#e0f2fe'; ctx.fillStyle = 'rgba(186,230,253,.22)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; ctx.lineTo(x + Math.cos(a) * H * 0.42, bodyY + Math.sin(a) * H * 0.55); } ctx.closePath(); ctx.fill(); ctx.stroke(); }
      if (ks.includes('burn')) for (let i = 0; i < 5; i++) { const ph = (tk * 1.6 + i * 0.21) % 1; ctx.globalAlpha = (1 - ph) * 0.9 * fade; ctx.fillStyle = i % 2 ? '#fb923c' : '#fde047'; ctx.beginPath(); ctx.arc(x + (i - 2) * 5 + Math.sin(ph * 7 + i) * 3, y + 2 - ph * H, (1 - ph) * 4 + 1.5, 0, 7); ctx.fill(); }
      if (ks.includes('poison')) for (let i = 0; i < 4; i++) { const ph = (tk * 0.9 + i * 0.27) % 1; ctx.globalAlpha = (1 - ph) * 0.9 * fade; ctx.strokeStyle = '#84cc16'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + (i - 1.5) * 7 + Math.sin(ph * 6 + i) * 3, y + 2 - ph * H * 0.9, 2 + (i % 2) * 1.5, 0, 7); ctx.stroke(); }
      if (ks.includes('bleed')) for (let i = 0; i < 4; i++) { const ph = (tk * 1.2 + i * 0.25) % 1; ctx.globalAlpha = (1 - ph) * fade; ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.ellipse(x + (i - 1.5) * 6, bodyY - H * 0.2 + ph * H * 0.7, 1.6, 3, 0, 0, 7); ctx.fill(); }
      ctx.globalAlpha = fade * vis;
      if (ks.includes('root')) { ctx.strokeStyle = STC.root; ctx.lineWidth = 3; ell(x, y + 2, 17 * sc, 7 * sc); ctx.stroke(); ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; ctx.moveTo(x + Math.cos(a) * 15 * sc, y + 2 + Math.sin(a) * 6 * sc); ctx.lineTo(x + Math.cos(a) * 17 * sc, y + 2 + Math.sin(a) * 7 * sc - 8); } ctx.stroke(); }
      if (ks.includes('silence')) { const cx = x + 18 * sc, cy = ty + 6; ctx.strokeStyle = STC.silence; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 7); ctx.moveTo(cx - 4, cy + 4); ctx.lineTo(cx + 4, cy - 4); ctx.stroke(); }
      if (ks.includes('blind')) { ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x - H * 0.22, y + 2 - H * 0.8, H * 0.44, H * 0.1); }
      if (ks.includes('slow')) { ctx.font = '800 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = STC.slow; ctx.globalAlpha = (0.5 + 0.5 * Math.sin(t * 0.01)) * fade; ctx.fillText('▼', x - 12 * sc, y + 10 + Math.sin(t * 0.01) * 2); ctx.fillText('▼', x + 12 * sc, y + 10 + Math.sin(t * 0.01) * 2); ctx.globalAlpha = fade * vis; }
      if (ks.includes('stagger') || ks.includes('knock')) { ctx.strokeStyle = STC[ks.includes('knock') ? 'knock' : 'stagger']; ctx.lineWidth = 2.5; ctx.beginPath(); for (let i = 0; i < 2; i++) { const sx = x + (i ? 1 : -1) * 18 * sc; ctx.moveTo(sx, bodyY - 10); ctx.lineTo(sx + 4, bodyY - 2); ctx.lineTo(sx - 4, bodyY + 4); ctx.lineTo(sx, bodyY + 12); } ctx.stroke(); }
      if (ks.includes('fear')) { ctx.font = '800 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = STC.fear; ctx.fillText('!!', x - 18 * sc, ty + 8 + Math.sin(t * 0.03) * 2); }

      const bw = 34 * Math.min(sc, 1.6), bx = x - bw / 2, by = ty - 10;
      const k = Math.max(0, Math.min(1, u.hp / u.maxHp));
      const shield = u.st.reduce((a, s) => a + (s.shield > 0 ? s.shield : 0), 0);
      ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(bx - 1, by - 1, bw + 2, 7);
      ctx.fillStyle = k > 0.5 ? col : k > 0.25 ? '#fbbf24' : '#f43f5e'; ctx.fillRect(bx, by, bw * k, 5);
      if (shield > 0) { ctx.fillStyle = 'rgba(125,211,252,.9)'; const sw = Math.min(bw, bw * shield / u.maxHp); ctx.fillRect(bx, by, sw, 2); }
      if (u.team < 2) { ctx.font = '700 10px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(u.ch.name, x, ty - 12); ctx.fillStyle = col; ctx.fillText(u.ch.name, x, ty - 12); }
      if (u.carry && u.carry.length) {
        const n = battle.coreSlots(u); ctx.shadowBlur = 0; ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,.85)';
        for (let i = 0; i < n; i++) { ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(bx + bw + 6 + i * 7, by + 2.5, 3, 0, 7); ctx.fill(); ctx.stroke(); }
      }
      if (u.depProg > 0) {
        const cx = x, cy = ty - 30; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(8,12,32,.85)'; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, 7); ctx.stroke();
        ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(cx, cy, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, u.depProg)); ctx.stroke(); ctx.shadowBlur = 0;
      }
      const lb = deb.filter(s => s.name).slice(0, 3);
      ctx.font = '800 11px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      lb.forEach((s, i) => {
        const c = STC[kindOf(s)] || '#fda4af', tx = s.name + ' ' + (s.dur * CONFIG.battle.tickMs / 1000).toFixed(1), w = ctx.measureText(tx).width + 12, ly = ty - 32 - i * 16;
        ctx.fillStyle = 'rgba(8,12,32,.82)'; rrect(x - w / 2, ly - 7, w, 14, 4); ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = c; ctx.fillText(tx, x, ly + 0.5);
      });
    }
    ctx.restore();
  }

  /* ---------- 좌우 선수 패널 ---------- */
  function nickOf(u) {
    const sl = Number(u.id.split('-')[1]) || 0, tm = battle.teams[u.team], md = tm && tm.moods && tm.moods[sl];
    if (md && md.nick) return md.nick;
    const M = typeof Game !== 'undefined' ? Game.match : null;
    if (M && u.team === M.pIdx && Game.G && Game.G.club && Game.G.club.lineup) { const id = Game.G.club.lineup.filter(Boolean)[sl], p = id && Pros.get(Game.G, id); if (p && p.nick) return p.nick; }
    return '';
  }
  function fitText(str, maxW, size, weight) {
    let sz = size; ctx.font = weight + ' ' + sz + 'px "Noto Sans KR", sans-serif';
    while (sz > 8 && ctx.measureText(str).width > maxW) { sz--; ctx.font = weight + ' ' + sz + 'px "Noto Sans KR", sans-serif'; }
    while (str.length > 1 && ctx.measureText(str + '…').width > maxW && ctx.measureText(str).width > maxW) str = str.slice(0, -1);
    return str;
  }
  function drawSide(t) {
    slots = [];
    const A = CONFIG.battle.arena, H0 = A.h * SC, bw = PAD.l - 8, bh = 90, fz = bw - 10;
    [0, 1].forEach(team => {
      const us = battle.units.filter(u => u.team === team && !u.struct).sort((a, b) => (a.id < b.id ? -1 : 1));
      us.forEach((u, i) => {
        if (u._nk === undefined) u._nk = nickOf(u);
        const bx = team ? cv.width - PAD.r + 4 : 4, by = PAD.t + (i + 0.5) * H0 / us.length - bh / 2 + 12, col = tcol(team), mine = !!battle.manual[team], dead = !u.alive;
        const rdy = mine && running && battle.ultReady(u); if (rdy && !u._rd) Sound.play('ultReady'); u._rd = !!rdy;
        ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        const main = u._nk || u.ch.name; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.fillStyle = dead ? '#94a3b8' : col;
        const mt = fitText(main, bw, 12, 800), ny = u._nk ? by - 13 : by - 5;
        ctx.strokeText(mt, bx + bw / 2, ny); ctx.fillText(mt, bx + bw / 2, ny);
        if (u._nk) { ctx.fillStyle = '#cbd5e1'; ctx.font = '700 9px "Noto Sans KR", sans-serif'; ctx.strokeText(u.ch.name, bx + bw / 2, by - 3); ctx.fillText(u.ch.name, bx + bw / 2, by - 3); }
        ctx.globalAlpha = dead ? 0.5 : 1;
        if (rdy) { ctx.shadowColor = '#fde047'; ctx.shadowBlur = 8 + 6 * Math.sin(t * 0.012); }
        ctx.fillStyle = 'rgba(8,12,32,.9)'; rrect(bx, by, bw, bh, 5); ctx.fill();
        ctx.strokeStyle = rdy ? '#fde047' : col; ctx.lineWidth = rdy ? 2.5 : 1.5; ctx.stroke(); ctx.shadowBlur = 0;
        const im = spriteOf(u);
        if (im) { const sh = 32, sw = sh * im.naturalWidth / im.naturalHeight; ctx.drawImage(im, bx + bw / 2 - sw / 2, by + 3, sw, sh); }
        if (mine) { ctx.fillStyle = rdy ? '#fde047' : '#64748b'; ctx.font = '800 9px Orbitron, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(String(i + 1), bx + 4, by + 12); ctx.textAlign = 'center'; }
        const kx = bx + 5, hy = by + 40, k = clamp(u.hp / u.maxHp, 0, 1), shield = u.st.reduce((a, s) => a + (s.shield > 0 ? s.shield : 0), 0);
        ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(kx, hy, fz, 11);
        ctx.fillStyle = k > 0.5 ? col : k > 0.25 ? '#fbbf24' : '#f43f5e'; ctx.fillRect(kx, hy, fz * k, 11);
        if (shield > 0) { ctx.fillStyle = 'rgba(125,211,252,.9)'; ctx.fillRect(kx, hy, Math.min(fz, fz * shield / u.maxHp), 3); }
        ctx.font = '700 9px Orbitron, sans-serif'; ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.fillStyle = '#fff'; ctx.strokeText(String(Math.ceil(u.hp)), bx + bw / 2, hy + 9); ctx.fillText(String(Math.ceil(u.hp)), bx + bw / 2, hy + 9);
        ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(kx, by + 54, fz, 6);
        ctx.fillStyle = '#38bdf8'; ctx.fillRect(kx, by + 54, fz * clamp(u.mp / u.mpMax, 0, 1), 6);
        const up = clamp(1 - u.ultCd / (u.f.ult.cd * 1000 / CONFIG.battle.tickMs), 0, 1);
        ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(kx, by + 63, fz, 8);
        ctx.fillStyle = rdy || up >= 1 ? '#fde047' : '#a78bfa'; ctx.fillRect(kx, by + 63, fz * up, 8);
        ctx.font = '800 7px "Noto Sans KR", sans-serif'; ctx.lineWidth = 2; ctx.fillStyle = '#fff'; ctx.strokeText(up >= 1 ? '궁극기 준비' : '궁극기', bx + bw / 2, by + 70); ctx.fillText(up >= 1 ? '궁극기 준비' : '궁극기', bx + bw / 2, by + 70);
        if (u.gauge && u.gauge.max) { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(kx, by + 75, fz, 6); ctx.fillStyle = u.gauge.color || '#fbbf24'; ctx.fillRect(kx, by + 75, fz * clamp(u.gauge.val / u.gauge.max, 0, 1), 6); }
        if (dead) { ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(8,12,32,.7)'; rrect(bx, by, bw, bh, 5); ctx.fill(); ctx.fillStyle = '#fda4af'; ctx.font = '800 10px "Noto Sans KR", sans-serif'; ctx.fillText('재출격', bx + bw / 2, by + bh / 2 - 2); ctx.fillText(Math.max(0, Math.ceil((u.respawnAt - battle.t) * CONFIG.battle.tickMs / 1000)) + '초', bx + bw / 2, by + bh / 2 + 11); }
        ctx.restore();
        slots.push({ id: u.id, x: bx, y: by - 20, w: bw, h: bh + 20, mine, rdy });
      });
    });
  }

  /* ---------- 이펙트 렌더 ---------- */
  function drawFx(t) {
    fx = fx.filter(f => t - f.t0 < f.dur);
    for (const f of fx) {
      if (t < f.t0) continue;
      const k = Math.max(0, Math.min(1, (t - f.t0) / f.dur)), ease = 1 - (1 - k) * (1 - k), fa = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4, C = f.color || '#fff';
      ctx.save();
      if (f.k === 'num') {
        ctx.globalAlpha = 1 - k * k; ctx.font = '800 ' + f.size + 'px Orbitron, "Noto Sans KR", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const y = f.y - ease * 30; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(f.text, f.x, y); ctx.fillStyle = C; ctx.fillText(f.text, f.x, y);
      } else if (f.k === 'ring') {
        const r = (f.big ? 52 : 30) * ease + 6; ctx.globalAlpha = 1 - k; ctx.strokeStyle = C; ctx.lineWidth = f.big ? 5 : 3.5; ctx.shadowColor = C; ctx.shadowBlur = 12; ell(f.x, f.y, r, r * 0.6); ctx.stroke();
      } else if (f.k === 'dash') {
        const dx = f.x2 - f.x1, dy = f.y2 - f.y1, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, a = k < 0.4 ? 1 : 1 - (k - 0.4) / 0.6;
        ctx.strokeStyle = C; ctx.fillStyle = C; ctx.shadowColor = C; ctx.shadowBlur = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (f.kind === 'blink') {
          ctx.globalAlpha = a * 0.8; ctx.lineWidth = 3; ell(f.x1, f.y1 + 20, 22 * (1 - k * 0.6), 9 * (1 - k * 0.6)); ctx.stroke(); ell(f.x2, f.y2 + 20, 10 + 22 * ease, 4 + 9 * ease); ctx.stroke();
          ctx.setLineDash([4, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
        } else {
          ctx.globalAlpha = a * 0.28; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
          ctx.globalAlpha = a * 0.9; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
          const n = Math.max(1, Math.floor(d / 34)); ctx.lineWidth = 3.5; ctx.beginPath();
          for (let i = 1; i <= n; i++) { const p = d * i / (n + 1), cx = f.x1 + ux * p, cy = f.y1 + uy * p; ctx.moveTo(cx - ux * 8 - uy * 7, cy - uy * 8 + ux * 7); ctx.lineTo(cx, cy); ctx.lineTo(cx - ux * 8 + uy * 7, cy - uy * 8 - ux * 7); }
          ctx.stroke(); ctx.lineWidth = 3; ell(f.x1, f.y1 + 20, 16, 6); ctx.stroke(); ctx.globalAlpha = a * 0.7; ell(f.x2, f.y2 + 20, 10 + 20 * ease, 4 + 8 * ease); ctx.stroke();
        }
      } else if (f.k === 'beam') {
        const len = Math.hypot(f.x2 - f.x1, f.y2 - f.y1), ang = Math.atan2(f.y2 - f.y1, f.x2 - f.x1);
        ctx.translate(f.x1, f.y1); ctx.rotate(ang);
        ctx.globalAlpha = 0.26 * fa; ctx.fillStyle = C; ctx.fillRect(0, -f.w / 2, len, f.w);
        ctx.globalAlpha = 0.95 * fa; ctx.strokeStyle = C; ctx.lineWidth = 2.5; ctx.shadowColor = C; ctx.shadowBlur = 10; ctx.setLineDash([12, 7]); ctx.lineDashOffset = -t * 0.04; ctx.strokeRect(0, -f.w / 2, len, f.w); ctx.setLineDash([]);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len * Math.min(1, k * 4), 0); ctx.stroke();
      } else if (f.k === 'lock') {
        const a = f.a, b = f.b, x1 = a.x * SC, y1 = a.y * SC - 20, x2 = b.x * SC, y2 = b.y * SC - 20, sb = b.scale || 1;
        ctx.globalAlpha = fa * 0.9; ctx.strokeStyle = C; ctx.fillStyle = C; ctx.shadowColor = C; ctx.shadowBlur = 10; ctx.lineWidth = 2.5;
        ctx.setLineDash([9, 6]); ctx.lineDashOffset = -k * 120; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
        ctx.lineWidth = 3; const rs = 1.5 - 0.5 * Math.min(1, k * 3); brk(x2, y2 - 4, 18 * sb * rs, 26 * sb * rs, 8);
        ell(x2, b.y * SC + 2, 20 * sb * rs, 8 * sb * rs); ctx.stroke(); ctx.beginPath(); ctx.arc(x2, y2 - 4, 3, 0, 7); ctx.fill();
      } else if (f.k === 'mark') {
        const b = f.b, sb = b.scale || 1, s2 = 1.4 - 0.4 * ease; ctx.globalAlpha = 1 - k; ctx.strokeStyle = C; ctx.shadowColor = C; ctx.shadowBlur = 10; ctx.lineWidth = 3;
        brk(b.x * SC, b.y * SC - 24, 17 * sb * s2, 25 * sb * s2, 7);
      } else if (f.k === 'trail') {
        ctx.globalAlpha = 0.9 * (1 - k); ctx.strokeStyle = C; ctx.lineWidth = (f.w || 4) * (1 - k * 0.5); ctx.lineCap = 'round'; ctx.shadowColor = C; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
      } else if (f.k === 'aoe') {
        const r = f.r;
        ctx.fillStyle = C; ctx.globalAlpha = 0.22 * fa; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.95 * fa; ctx.strokeStyle = C; ctx.lineWidth = 3.5; ctx.shadowColor = C; ctx.shadowBlur = 14; ctx.setLineDash([12, 7]); ctx.lineDashOffset = -t * 0.03; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha = 0.6 * (1 - k); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, r * ease, 0, 7); ctx.stroke();
      } else if (f.k === 'cone') {
        ctx.fillStyle = C; ctx.globalAlpha = 0.3 * fa; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.arc(f.x, f.y, f.r, f.dir - f.half, f.dir + f.half); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 0.95 * fa; ctx.strokeStyle = C; ctx.lineWidth = 3; ctx.shadowColor = C; ctx.shadowBlur = 12; ctx.stroke();
        ctx.globalAlpha = 0.6 * (1 - k); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * ease, f.dir - f.half, f.dir + f.half); ctx.stroke();
      } else if (f.k === 'bolt') {
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.shadowColor = '#facc15'; ctx.shadowBlur = 16;
        ctx.beginPath(); let bx = f.x, by = f.y - 140; ctx.moveTo(bx, by);
        for (let i = 1; i <= 7; i++) { bx = f.x + (HASH(i + f.x, f.t0 % 97) - 0.5) * 24 * (i < 7 ? 1 : 0); by = f.y - 140 + i * 20; ctx.lineTo(bx, by); }
        ctx.stroke(); ctx.fillStyle = '#fef9c3'; ctx.globalAlpha = 0.5 * (1 - k); ctx.beginPath(); ctx.arc(f.x, f.y, 22 * ease + 6, 0, 7); ctx.fill();
      } else if (f.k === 'star') {
        const R = 30 * (1 - k * 0.3), r = R * 0.28; ctx.globalAlpha = 1 - k; ctx.fillStyle = '#fde047'; ctx.shadowColor = '#fde047'; ctx.shadowBlur = 14;
        ctx.translate(f.x, f.y); ctx.rotate(k * 1.4); ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = Math.PI / 4 * i, rr = i % 2 ? r : R; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill();
      } else if (f.k === 'proj') {
        const x = lerp(f.x1, f.x2, k), y = lerp(f.y1, f.y2, k), ang = Math.atan2(f.y2 - f.y1, f.x2 - f.x1), ca = Math.cos(ang), sa = Math.sin(ang);
        ctx.strokeStyle = C; ctx.fillStyle = C; ctx.shadowColor = C; ctx.shadowBlur = 16; ctx.lineCap = 'round';
        if (/arrow|bolt|dart|needle|beam/.test(f.kind)) {
          ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - ca * 22, y - sa * 22); ctx.lineTo(x, y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + ca * 5, y + sa * 5); ctx.lineTo(x - ca * 5 - sa * 5, y - sa * 5 + ca * 5); ctx.lineTo(x - ca * 5 + sa * 5, y - sa * 5 - ca * 5); ctx.closePath(); ctx.fill();
        } else {
          for (let i = 1; i <= 5; i++) { ctx.globalAlpha = 0.5 / i; ctx.beginPath(); ctx.arc(x - ca * i * 8, y - sa * i * 8, Math.max(1.5, 7 - i), 0, 7); ctx.fill(); }
          ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
        }
      } else if (f.k === 'shard') {
        ctx.fillStyle = C; ctx.shadowColor = C; ctx.shadowBlur = 8; ctx.globalAlpha = 1 - k;
        for (let i = 0; i < f.n; i++) { const a = HASH(i, f.t0 % 97) * 6.283, d = f.d * (0.35 + 0.65 * HASH(i + 5, f.t0 % 89)) * ease; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.6 - Math.sin(k * Math.PI) * 14, (1 - k) * f.s + 1.5, 0, 7); ctx.fill(); }
      } else if (f.k === 'wave') {
        const r = f.r * (0.3 + 0.7 * ease); ctx.fillStyle = C; ctx.globalAlpha = 0.28 * (1 - k); ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.9 * (1 - k); ctx.strokeStyle = C; ctx.lineWidth = 4; ctx.shadowColor = C; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.stroke();
      } else if (f.k === 'burst') {
        const n = f.big ? 10 : 6, r0 = (f.big ? 8 : 5) + 4 * ease, r1 = (f.big ? 26 : 16) * ease + r0;
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = C; ctx.lineWidth = f.big ? 3 : 2; ctx.lineCap = 'round'; ctx.shadowColor = C; ctx.shadowBlur = 8; ctx.beginPath();
        for (let i = 0; i < n; i++) { const a = Math.PI * 2 / n * i + f.t0 * 0.001; ctx.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0); ctx.lineTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1); }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function render(alpha, t) {
    if (!staticCv) staticCv = buildStatic();
    ctx.drawImage(staticCv, 0, 0);
    if (!battle) return;
    ctx.save(); ctx.translate(PAD.l, PAD.t);
    drawMapGround(t);
    const items = battle.units.map(u => ({ y: u.y * SC, draw: () => drawUnit(u, alpha, t) }));
    battle.map.obstacles.forEach(o => items.push({ y: (o.t === 'c' ? o.y : o.y + o.h) * SC, draw: () => drawObstacle(o) }));
    items.sort((a, b) => a.y - b.y).forEach(i => i.draw());
    drawFx(t);
    ctx.restore();
    drawScore();
    drawSide(t);
  }

  function loop(ts) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(100, ts - last); last = ts;
    const tick = CONFIG.battle.tickMs;
    if (battle && running && !paused && !battle.over) {
      acc += dt * speed; let n = 0;
      while (acc >= tick && !battle.over && n++ < 24) { battle.tick(); acc -= tick; }
      if (n >= 24) acc = 0;
    }
    render(battle && running && !battle.over ? Math.min(1, acc / tick) : 1, now());
    hudT += dt;
    if (hudT > 100) { hudT = 0; if (battle && hooks.hud) hooks.hud(battle); }
    if (battle && battle.over && running) {
      running = false;
      if (hooks.hud) hooks.hud(battle);
      endT = setTimeout(() => { if (hooks.end && battle) hooks.end(battle.res); }, fast ? 0 : 1100);
    }
  }

  return { mount, unmount, prepare, start, setSpeed, setPaused, skip, castUlt: id => (battle && running && !paused ? battle.castUlt(id) : { ok: false, msg: '경기 진행 중에만 사용할 수 있습니다.' }), get battle() { return battle; }, get running() { return running; } };
})();
