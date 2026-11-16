/* fighters3.js — 암살자 6명 (31 크러쉬 · 32 바이저 · 33 다크나이트 · 34 셰도 · 35 레드후드 · 36 사신)
   구조/수치 조절 방법은 fighters.js 와 동일합니다. (스킬 안의 b.raw(u, 기본, 공격력계수, 주문력계수) 값을 고치면 됩니다)
   새로 쓰는 엔진 기능
   - 상태이상 '출혈'(config.js) : 받는 피해 +8%.  b.cc(u, 대상, 'bleed', 초)
   - 은신(stealth) 플래그 : 적의 타게팅/범위 스킬 대상에서 제외, 본인은 정상 행동. (battle.js hidden())
   - pierce 옵션/상태 : 보호막·피해감소 효과를 무시. (battle.js deal())
   새 파이터를 추가하려면 맨 아래 NEW 배열에 id 만 넣으면 도감/밴픽/AI 에 자동 반영됩니다. */

(() => {
  const FD = CONFIG.fighters;

  /* ---------- 도우미 ---------- */
  const foeIn = (r, min) => (b, u, en) => { const t = b.nearest(u, en.filter(e => { const d = b.dist(u, e); return d <= r && d >= (min || 0); })); return t ? { t } : null; };
  const anyIn = r => (b, u, en) => (en.some(e => b.dist(u, e) <= r) ? {} : null);
  const hit = (b, u, e, type, raw, via, extra) => b.deal(u, e, { type, raw, via, skill: true, pierce: u.st.some(s => s.pierce), ...(extra || {}) });
  const cone = (b, u, t, range, half, color) => { const d = b.dir(u, t); b.emit({ type: 'cone', x: u.x, y: u.y, dir: Math.atan2(d.y, d.x), range, half, color }); };
  const ring = (b, x, y, r, color) => b.emit({ type: 'aoe', x, y, radius: r, color });
  const slash = (b, x1, y1, x2, y2, w, color) => b.emit({ type: 'beam', x1, y1, x2, y2, w, color });
  const dashTo = (b, u, t, maxDist, stopGap) => { const d = b.dir(u, t), go = Math.max(0, Math.min(maxDist, b.dist(u, t) - (stopGap || 0))); return b.clampPos(u.x + d.x * go, u.y + d.y * go); };
  const lock = (b, u, sec) => b.buff(u, 'channel', sec, { name: '시전 중', f: { channel: true }, quiet: true });
  const meleeBasic = { type: 'phys', atk: 1, ap: 0, proj: 'melee' };
  const bleeding = t => t.st.some(s => s.key === 'bleed');
  const bleed = (b, u, t, sec) => b.cc(u, t, 'bleed', sec);
  const missing = t => 1 - t.hp / t.maxHp;

  /* ================= 31. 크러쉬 ================= */
  FD.crush = {
    id: 'crush', name: '크러쉬', role: 'assassin', color: '#ef4444', title: '영혼을 수확하는 뼈톱 악마',
    concept: '"모가지를 따주마...큭큭"',
    stats: { hp: 860, mp: 240, aspd: 0.95, spd: 8.7, atk: 56, ap: 0, def: 29, res: 23, ten: 0.05, pen: 0.12, ls: 0.23, range: 6 },
    basic: meleeBasic, ai: { threat: 0.95 },
    tac: { act: ['rush', 'basic'], fight: ['solo', 'coop'], aim: ['weak', 'back'] },
    look: { pal: { b: '#e7e5e4', B: '#a8a29e', r: '#dc2626', h: '#7f1d1d', k: '#111827', e: '#fde047', s: '#cbd5e1', S: '#64748b' },
      rows: [
        '..hh........hh..',
        '..hhh.bbbb.hhh..',
        '...hhbbbbbbhh...',
        '....bbbbbbbb....',
        '....bkkbbkkb....',
        '....bkebbekb....',
        '....bbbkkbbb....',
        '.....bkbkbkb....',
        '......bbbb....S.',
        '...rbbbbbbbr..sS',
        '..rrbBbBbBbrr.sS',
        '..r.bBbBbBb.r.sS',
        '....bbbbbbb..sS.',
        '.....bbkbb..sS..',
        '....bb..bb.sS...',
        '....bb..bb..S...',
        '...bbb..bbb.....',
        '...kkk..kkk.....'],
      weapon: '' },
    passive: { name: '집념', desc: '최근 6초 안에 자신에게 피해를 준 적에게 주는 피해가 20% 증가합니다.',
      onHurt(b, u, src, res) { if (src && res.dealt > 0) (u.mem.grudge = u.mem.grudge || {})[src.id] = b.t + b.sec(6); },
      dmgMul(b, u, t) { const g = u.mem.grudge; return g && g[t.id] > b.t ? 1.2 : 1; } },
    skills: [
      { id: 'cu_s1', name: '찢기', cost: 35, cd: 6, range: 9, sfx: 'aoe', desc: '전방의 적을 베어 피해를 주고 출혈시킵니다(4초, 받는 피해 +8%). 이미 출혈 중인 적에게는 치명 피해(×1.5)를 줍니다.', plan: foeIn(9),
        cast(b, u, pl) {
          const t = pl.t; cone(b, u, t, 11, 0.95, '#ef4444');
          b.inCone(b.foes(u), u, t.x, t.y, 11, 0.95).forEach(e => { const bl = bleeding(e); hit(b, u, e, 'phys', b.raw(u, 29, 1.02) * (bl ? 1.5 : 1), '찢기', { splash: true, crit: bl }); bleed(b, u, e, 4); });
        } },
      { id: 'cu_s2', name: '혈의각인', cost: 45, cd: 10, range: 24, move: true, sfx: 'dash', desc: '앞의 적에게 뛰어들어 뼈톱을 찍고 출혈시킨 뒤(5초) 원래 자리로 돌아옵니다. 출혈 중인 적에게는 치명 피해(×1.5)를 줍니다.', plan: foeIn(24),
        cast(b, u, pl) {
          const t = pl.t, ox = u.x, oy = u.y, e = dashTo(b, u, t, 24, 3); b.slide(u, e.x, e.y); lock(b, u, 0.45);
          const bl = bleeding(t); ring(b, t.x, t.y, 5, '#ef4444');
          hit(b, u, t, 'phys', b.raw(u, 50, 1.26) * (bl ? 1.5 : 1), '혈의각인', { crit: bl }); bleed(b, u, t, 5);
          b.later(0.45, bb => { if (u.alive && !bb.gone(u)) bb.blink(u, ox, oy); });
        } }
    ],
    ult: { id: 'cu_ult', name: '필살격', cd: 36, range: 30, move: true, sfx: 'dash', desc: '지정한 방향으로 돌진하며 경로의 적을 벱니다. 체력이 40% 이하인 적에게는 2배의 피해를 줍니다.',
      plan: (b, u, en) => { const t = b.lowest(en.filter(e => b.dist(u, e) <= 30)); return t ? { t } : null; },
      cast(b, u, pl) {
        const ox = u.x, oy = u.y, e = dashTo(b, u, pl.t, 34, -7); b.slide(u, e.x, e.y); slash(b, ox, oy, u.x, u.y, 5, '#ef4444');
        b.inLine(b.foes(u), ox, oy, u.x, u.y, 3.5).forEach(x => { const low = x.hp < x.maxHp * 0.4; hit(b, u, x, 'phys', b.raw(u, 90, 1.56) * (low ? 2 : 1), '필살격', { path: true, crit: low }); });
      } }
  };

  /* ================= 32. 바이저 ================= */
  FD.viser = {
    id: 'viser', name: '바이저', role: 'assassin', color: '#84cc16', title: '낫을 휘두르는 가시 괴생명체',
    concept: '"키야야아악!!!"',
    stats: { hp: 790, mp: 220, aspd: 1.0, spd: 9.0, atk: 50, ap: 0, def: 24, res: 20, ten: 0, pen: 0.12, ls: 0.21, range: 7 },
    basic: meleeBasic, ai: { threat: 0.9 },
    tac: { act: ['rush', 'basic'], fight: ['solo'], aim: ['weak', 'carry'] },
    look: { pal: { g: '#65a30d', G: '#365314', l: '#bef264', y: '#fde047', k: '#0a0f08', w: '#e2e8f0', s: '#94a3b8', t: '#d9f99d' },
      rows: [
        '......GGGG......',
        '.....GggggG.....',
        '....GggggggG....',
        '....gyyggyygg...',
        '....gggkkggg....',
        '.....gkwkwkg....',
        '..t...gggg...t..',
        'w.t.GggggggG.t.w',
        'ww.tGgGggGgGt.ww',
        '.ww.gggggggg.ww.',
        '..ws.GggggG.sw..',
        '...s..gggggg..s.',
        '......gGggGg....',
        '.....gg....gg...',
        '.....gg....gg...',
        '....tgg....ggt..',
        '....ggg....ggg..',
        '...GGGG....GGGG.'],
      weapon: '' },
    passive: { name: '경고', desc: '주변(20)의 적이 적을수록 주는 피해가 늘어납니다. 1명: +20% / 2명: +10% / 3명 이상: 없음.',
      dmgMul(b, u, t) { const n = b.foes(u).filter(e => b.dist(u, e) <= 20).length; return n <= 1 ? 1.2 : n === 2 ? 1.1 : 1; },
      tick(b, u) { if (u.role.range !== u.f.stats.range && !u.st.some(s => s.key === 'vz_ult')) { u.role.range = u.f.stats.range; u.glow = null; } } },
    skills: [
      { id: 'vz_s1', name: '브레이크크루', cost: 35, cd: 6, range: 9, sfx: 'aoe', desc: '전방을 베어 피해를 줍니다. 대상이 잃은 체력에 비례해 피해가 최대 +90% 증가합니다.', plan: foeIn(9),
        cast(b, u, pl) {
          const t = pl.t; cone(b, u, t, 11, 1.0, '#a3e635');
          b.inCone(b.foes(u), u, t.x, t.y, 11, 1.0).forEach(e => hit(b, u, e, 'phys', b.raw(u, 26, 1.02) * (1 + 0.9 * missing(e)), '브레이크크루', { splash: true, crit: missing(e) > 0.6 }));
        } },
      { id: 'vz_s2', name: '무자비', cost: 45, cd: 10, range: 28, move: true, sfx: 'dash', desc: '주변에서 체력 비율이 가장 낮은 적에게 도약해 피해를 줍니다(잃은 체력 비례 최대 +70%). 착지 지점 주변의 적도 피해를 입습니다.',
        plan: (b, u, en) => { const t = b.lowest(en.filter(e => b.dist(u, e) <= 28)); return t ? { t } : null; },
        cast(b, u, pl) {
          const t = pl.t, ox = u.x, oy = u.y, e = dashTo(b, u, t, 28, 2.5); b.slide(u, e.x, e.y); slash(b, ox, oy, u.x, u.y, 4, '#a3e635'); ring(b, u.x, u.y, 7, '#a3e635');
          hit(b, u, t, 'phys', b.raw(u, 48, 1.2) * (1 + 0.7 * missing(t)), '무자비');
          b.inCircle(b.foes(u), u.x, u.y, 7).filter(x => x !== t).forEach(x => hit(b, u, x, 'phys', b.raw(u, 24, 0.6), '무자비', { splash: true }));
        } }
    ],
    ult: { id: 'vz_ult', name: '학살', cd: 38, range: 14, sfx: 'buff', desc: '7초간 사거리가 늘어나고 공격력·공격속도가 30% 증가합니다. 이 동안 모든 공격이 보호막과 피해감소 효과를 무시합니다.', plan: anyIn(14),
      cast(b, u) {
        u.role.range = u.f.stats.range + 4; u.glow = '#a3e635'; ring(b, u.x, u.y, 12, '#a3e635');
        b.buff(u, 'vz_ult', 7, { name: '학살', mul: { atk: 1.3, aspd: 1.3 }, f: { pierce: true, onEnd(bb, uu) { uu.role.range = uu.f.stats.range; uu.glow = null; } } });
      } }
  };

  /* ================= 33. 다크나이트 ================= */
  const wound = t => { const s = t.st.find(x => x.key === 'dk_wound'); return s ? s.stacks : 0; };
  FD.darkknight = {
    id: 'darkknight', name: '다크나이트', role: 'assassin', color: '#818cf8', title: '어둠에 잠식된 칼날',
    concept: '"인과를 끊어내겠어..."',
    stats: { hp: 920, mp: 250, aspd: 0.95, spd: 8.6, atk: 60, ap: 0, def: 32, res: 26, ten: 0.08, pen: 0.12, ls: 0.18, range: 6 },
    basic: meleeBasic, ai: { threat: 1.0 },
    tac: { act: ['rush', 'basic'], fight: ['solo', 'coop'], aim: ['back', 'carry'] },
    look: { pal: { a: '#1e1b4b', A: '#312e81', p: '#6366f1', P: '#a5b4fc', k: '#05030d', e: '#f43f5e', s: '#4f46e5', S: '#c7d2fe' },
      rows: [
        '......aaaa......',
        '.....aAAAAa.....',
        '.....aAAAAa.....',
        '.....akeekak....',
        '.....aaaaaaa....',
        '....pAaaaaaAp...',
        '..ppAaaaaaaApp.S',
        '..pAaaAAAAaaAp.s',
        '...kaaAPPAaak.sS',
        '....aaaAAaaa.sS.',
        '....kaaaaaak.sS.',
        '.....aaaaaa..S..',
        '.....aa..aa..s..',
        '.....aa..aa.....',
        '....aAa..aAa....',
        '....aAa..aAa....',
        '...aaAa..aAaa...',
        '...kkkk..kkkk...'],
      weapon: '' },
    passive: { name: '어둠의상처', desc: '기본 공격이 적에게 상처를 1중첩 남깁니다(최대 5, 8초). 상처 5중첩인 적에게 스킬이 적중하면 상처를 모두 소모하고 적을 1초간 경직시킵니다.',
      onDealt(b, u, t, res, o) {
        if (o.noPassive || !t.alive) return;
        if (o.basic) { const n = Math.min(5, wound(t) + 1); b.buff(t, 'dk_wound', 8, { name: n >= 5 ? '상처 MAX' : '상처 ' + n, good: false, src: u, quiet: n < 5, f: { stacks: n } }); }
        else if (o.skill && wound(t) >= 5) { t.st = t.st.filter(s => s.key !== 'dk_wound'); b.cc(u, t, 'stagger', 1.0); }
      } },
    skills: [
      { id: 'dk3_s1', stack: { fn: wound, min: 5 }, name: '흑.참', cost: 40, cd: 6, range: 10, sfx: 'aoe', desc: '전방의 넓은 범위를 베어 피해를 줍니다. 적의 보호막과 피해감소 효과를 무시합니다.', plan: foeIn(10),
        cast(b, u, pl) {
          const t = pl.t; cone(b, u, t, 13, 1.3, '#6366f1');
          b.inCone(b.foes(u), u, t.x, t.y, 13, 1.3).forEach(e => hit(b, u, e, 'phys', b.raw(u, 39, 1.21), '흑.참', { splash: true, pierce: true }));
        } },
      { id: 'dk3_s2', stack: { fn: wound, min: 5 }, name: '흑.운', cost: 35, cd: 8, range: 26, move: true, sfx: 'dash', desc: '지정한 방향으로 빠르게 이동하며 경로의 적을 베어 피해를 줍니다.', plan: foeIn(26),
        cast(b, u, pl) {
          const ox = u.x, oy = u.y, e = dashTo(b, u, pl.t, 22, -5); b.slide(u, e.x, e.y); slash(b, ox, oy, u.x, u.y, 4, '#6366f1');
          b.inLine(b.foes(u), ox, oy, u.x, u.y, 3).forEach(x => hit(b, u, x, 'phys', b.raw(u, 41, 1.09), '흑.운', { path: true }));
        } }
    ],
    ult: { id: 'dk3_ult', name: '강제처형', cd: 36, range: 16, move: true, sfx: 'nuke', desc: '일정 거리의 적에게 달려들어 1.1초간 제압한 뒤 참수해 큰 피해를 주고 출혈시킵니다(5초). 제압 중 경직·기절·침묵당하면 처형이 취소됩니다. 체력 35% 이하 적에게는 ×1.3.', plan: foeIn(16),
      cast(b, u, pl) {
        const t = pl.t; if (b.dist(u, t) > 5) { const e = dashTo(b, u, t, 16, 3); b.slide(u, e.x, e.y); }
        b.cc(u, t, 'stun', 1.1); lock(b, u, 1.1); ring(b, t.x, t.y, 6, '#6366f1');
        b.later(1.1, bb => {
          if (!u.alive || !t.alive || u.st.some(s => s.stun || s.stagger || s.silence || s.knock)) return;
          const low = t.hp < t.maxHp * 0.35; ring(bb, t.x, t.y, 8, '#f43f5e');
          hit(bb, u, t, 'phys', bb.raw(u, 126, 1.84) * (low ? 1.3 : 1), '강제처형', { pierce: true, crit: true }); bleed(bb, u, t, 5);
        });
      } }
  };

  /* ================= 34. 셰도 ================= */
  const isStealth = u => u.st.some(s => s.stealth);
  const inJam = (b, u) => b.zones.some(z => z.tag === 'jam' && z.owner === u && Math.hypot(u.x - z.x, u.y - z.y) <= z.r);
  const goStealth = (b, u, key, dur, quiet) => b.buff(u, key, dur, { name: '은신', f: { stealth: true }, quiet });
  const reveal = (b, u) => {
    if (!isStealth(u)) return;
    u.st = u.st.filter(s => !s.stealth); u.mem.moved = 0; u.mem.revT = b.t;
    if (inJam(b, u)) u.mem.jamBack = b.t + b.sec(1.1);      // 재머 안에서는 잠깐 보였다가 다시 은신
  };
  const blade = (b, u, t, k) => {
    const ox = u.x, oy = u.y, e = dashTo(b, u, t, 26, 2.5); b.slide(u, e.x, e.y); slash(b, ox, oy, u.x, u.y, 3, '#94a3b8');
    hit(b, u, t, 'phys', b.raw(u, 43, 1.14) * k, '어둠칼날');
  };
  const STEALTH_CHARGE = 26;
  FD.shadow = {
    id: 'shadow', name: '셰도', role: 'assassin', color: '#94a3b8', title: '그림자 단도의 청년',
    concept: '"더이상 약했던 내가 아니야."',
    stats: { hp: 760, mp: 260, aspd: 1.0, spd: 9.6, atk: 56, ap: 0, def: 22, res: 20, ten: 0, pen: 0.16, ls: 0.15, range: 6 },
    basic: meleeBasic, ai: { threat: 0.8 },
    tac: { act: ['rush', 'basic'], fight: ['solo'], aim: ['back', 'weak'] },
    look: { pal: { h: '#1f2937', H: '#374151', s: '#cbd5e1', k: '#030712', e: '#38bdf8', c: '#64748b', d: '#e2e8f0', D: '#94a3b8' },
      rows: [
        '.....hhhhh......',
        '....hHHHHHh.....',
        '...hHHHHHHHh....',
        '...hHsssssHh....',
        '...hHsessesHh...',
        '...hHsssssHh....',
        '....hcccccch....',
        '...hhHcccchHh...',
        'd.hHhHhhhhHhH..d',
        'D.hhHhhhhhhHh..D',
        'dss.hhhhhhhh.ssd',
        '.d..hhhhhhhh..d.',
        '....hhHhhHhh....',
        '.....hhh.hhh....',
        '.....hh...hh....',
        '.....hh...hh....',
        '....Hhh...hhH...',
        '....kkk...kkk...'],
      weapon: '' },
    passive: { name: '그림자단도', desc: '일정 거리(26)를 움직이면 은신합니다. 은신 중에는 적에게 감지되지 않고 첫 공격 피해가 25% 증가합니다. 공격하거나 공격받으면 해제되며, 적이 5 이내로 다가오면 들킵니다.',
      dmgMul(b, u) { return isStealth(u) ? 1.25 : 1; },
      onDealt(b, u) { reveal(b, u); },
      onHurt(b, u) { reveal(b, u); },
      onSkill(b, u, sk) { if (sk.id === 'sh_s1' && b.has(u, 'sh_pact')) u.mp = Math.min(u.mpMax, u.mp + sk.cost); },
      tick(b, u) {
        const m = u.mem; if (m.lx === undefined) { m.lx = u.x; m.ly = u.y; m.moved = 0; }
        const d = Math.hypot(u.x - m.lx, u.y - m.ly); m.lx = u.x; m.ly = u.y;
        if (!isStealth(u)) {
          m.moved += d;
          if (m.moved >= STEALTH_CHARGE && b.t - (m.revT || -1e9) > b.sec(2.5) && !u.st.some(s => s.stun || s.knock)) { m.moved = 0; goStealth(b, u, 'sh_stealth', 600, false); }
        } else if (!inJam(b, u) && b.units.some(e => e.team !== u.team && e.alive && !b.gone(e) && b.dist(u, e) <= 5)) reveal(b, u);
        if (b.has(u, 'sh_pact')) { if (u.cds.sh_s1 > 0) u.cds.sh_s1 = Math.max(0, u.cds.sh_s1 - 2); if (u.mp < 35) u.mp = 35; }       // 계약: 어둠칼날 쿨 3배 빠르게, 마나 소모 없음
        u.gauge = { label: isStealth(u) ? '은신' : '은신 충전', val: isStealth(u) ? STEALTH_CHARGE : Math.min(STEALTH_CHARGE, m.moved), max: STEALTH_CHARGE, color: '#94a3b8' };
      } },
    skills: [
      { id: 'sh_s1', name: '어둠칼날', cost: 35, cd: 7, range: 26, move: true, sfx: 'dash', desc: '지정한 적에게 돌진해 피해를 줍니다. 은신 상태에서 시전해 적중하면 4초 안에 한 번 더 사용할 수 있습니다.', plan: foeIn(26),
        cast(b, u, pl) { const st = isStealth(u); blade(b, u, pl.t, 1); return st ? { recast: 4 } : {}; },
        recast: { move: true, plan: foeIn(26), cast(b, u, pl) { blade(b, u, pl.t, 0.9); } } },
      { id: 'sh_s2', name: '셰도재머', cost: 50, cd: 13, range: 24, sfx: 'aoe', desc: '6초간 어둠 영역을 만듭니다. 영역 안에서 셰도는 계속 은신하며, 공격하거나 공격받으면 잠깐 보였다가 다시 은신합니다.', plan: anyIn(24),
        cast(b, u) {
          ring(b, u.x, u.y, 9, '#475569'); u.mem.jamBack = 0; goStealth(b, u, 'sh_zone', 0.6, true);
          b.zone({ x: u.x, y: u.y, r: 9, dur: 6, owner: u, kind: 'fog', color: '#475569', tag: 'jam', every: 0.25,
            onTick(z, bb) { const o = z.owner; if (!o.alive || Math.hypot(o.x - z.x, o.y - z.y) > z.r || bb.t < (o.mem.jamBack || 0)) return; goStealth(bb, o, 'sh_zone', 0.6, true); } });
        } }
    ],
    ult: { id: 'sh_ult', name: '어둠과계약', cd: 34, range: 30, sfx: 'buff', desc: '8초간 어둠칼날의 재사용 대기시간이 크게 줄고(약 1/3) 마나를 소모하지 않습니다. 시전 즉시 어둠칼날이 준비됩니다.',
      plan: (b, u, en) => (en.some(e => b.dist(u, e) <= 30) ? {} : null),
      cast(b, u) { b.buff(u, 'sh_pact', 8, { name: '어둠과 계약' }); u.cds.sh_s1 = 0; ring(b, u.x, u.y, 8, '#94a3b8'); } }
  };

  /* ================= 35. 레드후드 ================= */
  const behind = (u, t) => (u.x - t.x) * (t.facing || 1) < 0;                 // 대상이 바라보는 방향의 반대편 = 후방
  const ccd = t => t.st.some(s => s.cc || s.stun || s.knock);
  FD.redhood = {
    id: 'redhood', name: '레드후드', role: 'assassin', color: '#e11d48', title: '총검을 쓰는 암살 용병',
    concept: '"실전은 연습처럼, 연습도 연습처럼"',
    stats: { hp: 800, mp: 250, aspd: 1.0, spd: 9.2, atk: 55, ap: 0, def: 24, res: 21, ten: 0, pen: 0.14, ls: 0.21, range: 6 },
    basic: meleeBasic, ai: { threat: 0.9 },
    tac: { act: ['rush', 'basic'], fight: ['solo', 'coop'], aim: ['back', 'weak'] },
    look: { pal: { r: '#b91c1c', R: '#7f1d1d', s: '#e5c9a8', k: '#111827', e: '#fde047', g: '#374151', G: '#1f2937', m: '#cbd5e1', M: '#64748b', y: '#f59e0b', w: '#e5e7eb' },
      rows: [
        '......rrrr......',
        '.....rRRRRr.....',
        '....rRRRRRRr....',
        '....rRssssRr....',
        '....rRsesseRr...',
        '....rRwwwwRr....',
        '...rrRggggRrr...',
        '..rrggggggggrr..',
        '.sggyggggggygg.m',
        '.sgggggGGgggg.mM',
        '..gyggGGGGgygsmM',
        '...gggGGGGggg.M.',
        '....gggggggg....',
        '....ggg..ggg....',
        '....GGG..GGG....',
        '....GGG..GGG....',
        '...GGGG..GGGG...',
        '...kkkk..kkkk...'],
      weapon: '' },
    passive: { name: '특수암살기술', desc: '적의 후방을 공격하면 피해가 20% 증가하고, 둔화·기절 등 CC에 걸린 적에게도 20% 증가합니다. 둘 다 해당하면 35% 증가합니다.',
      dmgMul(b, u, t) { const a = behind(u, t), c = ccd(t); return a && c ? 1.35 : (a || c) ? 1.2 : 1; } },
    skills: [
      { id: 'rh_s1', name: '급습', cost: 35, cd: 9, range: 26, move: true, sfx: 'dash', desc: '지정한 방향으로 신속하게 이동합니다. 3초 안에 다시 시전하면 칼로 돌진해 경로의 적에게 피해를 주고 출혈시킵니다(4초).', plan: foeIn(26),
        cast(b, u, pl) { const ox = u.x, oy = u.y, e = dashTo(b, u, pl.t, 12, 4); b.slide(u, e.x, e.y); slash(b, ox, oy, u.x, u.y, 3, '#e11d48'); return { recast: 3 }; },
        recast: { move: true, plan: foeIn(26),
          cast(b, u, pl) {
            const ox = u.x, oy = u.y, e = dashTo(b, u, pl.t, 24, -4); b.slide(u, e.x, e.y); slash(b, ox, oy, u.x, u.y, 5, '#e11d48');
            b.inLine(b.foes(u), ox, oy, u.x, u.y, 3.2).forEach(x => { hit(b, u, x, 'phys', b.raw(u, 50, 1.2), '급습', { path: true }); bleed(b, u, x, 4); });
          } } },
      { id: 'rh_s2', name: '전술폭파', cost: 40, cd: 11, range: 18, move: true, sfx: 'aoe', desc: '뒤로 물러나며 전방으로 폭탄을 던져 작은 범위에 피해를 주고 기절시킵니다(0.8초). 4초 안에 다시 시전하면 전방의 적을 총으로 사격해 피해를 줍니다.', plan: foeIn(18),
        cast(b, u, pl) {
          const t = pl.t, c = { x: t.x, y: t.y }, d = b.dir(u, t); b.slide(u, u.x - d.x * 9, u.y - d.y * 9);
          ring(b, c.x, c.y, 5.5, '#f97316'); b.emit({ type: 'star', x: c.x, y: c.y });
          b.inCircle(b.foes(u), c.x, c.y, 5.5).forEach(e => { hit(b, u, e, 'phys', b.raw(u, 41, 0.96), '전술폭파', { splash: true }); b.cc(u, e, 'stun', 0.8); });
          return { recast: 4 };
        },
        recast: { plan: foeIn(18),
          cast(b, u, pl) { const t = pl.t; cone(b, u, t, 18, 0.5, '#fbbf24'); b.inCone(b.foes(u), u, t.x, t.y, 18, 0.5).forEach(e => hit(b, u, e, 'phys', b.raw(u, 34, 1.08), '총격', { splash: true })); } } }
    ],
    ult: { id: 'rh_ult', name: '의뢰완료', cd: 34, range: 26, move: true, sfx: 'dash', desc: '적을 지정해 순식간에 등 뒤로 이동합니다. 6초 안의 다음 기본 공격에 치명 피해가 더해집니다.',
      plan: (b, u, en) => { const t = b.lowest(en.filter(e => b.dist(u, e) <= 26)); return t ? { t } : null; },
      cast(b, u, pl) {
        const t = pl.t; b.blink(u, t.x - (t.facing || 1) * 3.5, t.y); ring(b, t.x, t.y, 6, '#e11d48'); u.target = t; u.cd = Math.max(u.cd, 1);
        u.bm.push({ until: b.t + b.sec(6), once: true, fn(bb, uu, tt) { hit(bb, uu, tt, 'phys', bb.raw(uu, 114, 1.56), '의뢰완료', { crit: true }); ring(bb, tt.x, tt.y, 5, '#e11d48'); } });
      } }
  };

  /* ================= 36. 사신 ================= */
  const HF_MAX = 8;
  const addHF = (b, u, n) => { u.mem.hf = Math.min(HF_MAX, (u.mem.hf || 0) + n); u.mem.hfT = b.t + b.sec(8); };
  FD.reaper = {
    id: 'reaper', name: '사신', role: 'assassin', color: '#a21caf', title: '마법의 낫을 쓰는 지옥의 사신',
    concept: '"다음 희생자는 누구인가?"',
    stats: { hp: 780, mp: 300, aspd: 0.9, spd: 8.6, atk: 30, ap: 70, def: 22, res: 28, ten: 0, pen: 0.12, ls: 0.2, range: 6 },
    basic: { type: 'magic', atk: 0.4, ap: 0.6, proj: 'melee' }, ai: { threat: 0.9 },
    tac: { act: ['rush', 'basic'], fight: ['solo', 'coop'], aim: ['carry', 'back'] },
    look: { pal: { h: '#2d1b3d', H: '#4c1d95', r: '#dc2626', f: '#fb923c', k: '#0b0220', e: '#f43f5e', b: '#e7e5e4', s: '#78350f', m: '#cbd5e1', M: '#64748b' },
      rows: [
        '.....hhhh.mmmmm.',
        '...hhHHHHhh..Mm.',
        '...hHHHHHHh...s.',
        '...hHkkkkHh...s.',
        '...hHkeekHh...s.',
        '...hHkbbkHh...s.',
        '....hHbkbkHh..s.',
        '...hhHHHHHHhh.s.',
        '..hhHrHHHHrHhhbs',
        '..hHHHrHHrHHHhbs',
        '.hhHHHHHHHHHHh.s',
        '.hHHfHHHHHHfHh.s',
        'hhHfffHHHHfffHhs',
        '.hHffHHHHHHffHhs',
        '..hHfHHHHHHfHh.s',
        '...hfHHHHHHfh..s',
        '....hffHHffh...s',
        '.....ff.ff.....s'],
      weapon: '' },
    passive: { name: '지옥기력', desc: '기본 공격이 적중할 때마다 주문력이 6% 상승합니다(최대 8중첩, 최대 +48%). 8초 동안 쌓지 못하면 서서히 줄어듭니다.',
      stat(b, u, k, v) { return k === 'ap' ? v * (1 + 0.06 * (u.mem.hf || 0)) : v; },
      onDealt(b, u, t, res, o) { if (o.basic && !o.noPassive) addHF(b, u, 1); },
      tick(b, u) {
        const m = u.mem; if (m.hf > 0 && b.t >= m.hfT) { m.hf--; m.hfT = b.t + b.sec(1.5); }
        u.gauge = { label: '지옥기력', val: m.hf || 0, max: HF_MAX, color: '#c026d3' };
      } },
    skills: [
      { id: 'rp_s1', name: '지옥가시', cost: 40, cd: 7, range: 26, sfx: 'aoe', desc: '지정한 위치에 잠시 뒤 어둠가시를 솟아내 범위 안의 적에게 피해를 줍니다. 적중하면 지옥기력이 2중첩 쌓입니다.', plan: foeIn(26),
        cast(b, u, pl) {
          const c = { x: pl.t.x, y: pl.t.y }; b.zone({ x: c.x, y: c.y, r: 6, dur: 0.6, owner: u, kind: 'warn', color: '#a21caf' });
          b.later(0.6, bb => {
            if (!u.alive) return; ring(bb, c.x, c.y, 6, '#a21caf'); bb.emit({ type: 'star', x: c.x, y: c.y });
            const list = bb.inCircle(bb.foes(u), c.x, c.y, 6); list.forEach(e => hit(bb, u, e, 'magic', bb.raw(u, 48, 0, 1.14), '지옥가시', { splash: true }));
            if (list.length) addHF(bb, u, 2);
          });
        } },
      { id: 'rp_s2', name: '마풍벽', cost: 35, cd: 10, range: 10, sfx: 'shield', desc: '주변의 적에게 피해를 주고 2.5초간 날아오는 투사체(원거리 기본 공격·광선형 스킬)를 막아냅니다.', plan: anyIn(10),
        cast(b, u) {
          ring(b, u.x, u.y, 10, '#c026d3'); b.inCircle(b.foes(u), u.x, u.y, 10).forEach(e => hit(b, u, e, 'magic', b.raw(u, 34, 0, 0.72), '마풍벽', { splash: true }));
          b.buff(u, 'rp_wall', 2.5, { name: '마풍벽', f: { projBlock: true } });
        } }
    ],
    ult: { id: 'rp_ult', name: '데스사이드', cd: 36, range: 40, move: true, sfx: 'dash', desc: '지정한 방향으로 지형과 적을 모두 통과해 날아가, 처음 맞은 적에게 큰 피해를 주고 그 앞에서 멈춥니다.',
      plan: foeIn(40),
      cast(b, u, pl) {
        const A = b.cfg.arena, ox = u.x, oy = u.y, d = b.dir(u, pl.t), L = 42, ex = ox + d.x * L, ey = oy + d.y * L;
        const first = b.inLine(b.foes(u), ox, oy, ex, ey, 2.5).sort((p, q) => b.dist(u, p) - b.dist(u, q))[0];
        const go = first ? Math.max(0, b.dist(u, first) - 3) : L;
        let nx = Math.max(2, Math.min(A.w - 2, ox + d.x * go)), ny = Math.max(5, Math.min(A.h - 2, oy + d.y * go));
        const p = b.pushOut(nx, ny); u.x = p.x; u.y = p.y;
        b.emit({ type: 'move', src: u, x1: ox, y1: oy, x2: u.x, y2: u.y, color: u.f.color }); slash(b, ox, oy, u.x, u.y, 6, '#c026d3');
        if (first) { ring(b, first.x, first.y, 7, '#c026d3'); hit(b, u, first, 'magic', b.raw(u, 102, 0.36, 1.5), '데스사이드', { crit: true }); }
      } }
  };


  /* ================= 37~40. 사냥꾼 (프레스 · 제이드 · 다크 · 바이오머신) =================
     새 엔진 기능: 치명타(stats.crit / critDmg, 기본 공격 자동 판정 · 스킬은 rollCrit:true), disarm 플래그(기본 공격 불가 = 재장전) */
  const beamU = (b, u, x2, y2, w, color) => slash(b, u.x, u.y, x2, y2, w, color);
  const lineEnd = (b, u, t, len) => { const d = b.dir(u, t); return b.clampPos(u.x + d.x * len, u.y + d.y * len); };
  const rangedBasic = { type: 'phys', atk: 1, ap: 0, proj: 'bolt' };
  /* 탄환: u.mem.ammo / ammoMax, 0 이 되면 재장전(기본 공격 불가) 후 가득 참 */
  const ammoInit = (u, max, reload) => { u.mem.ammo = max; u.mem.ammoMax = max; u.mem.reloadSec = reload; };
  const reloading = (b, u) => u.st.some(s => s.key === 'reload');
  const useAmmo = (b, u, n) => {
    u.mem.ammo = Math.max(0, u.mem.ammo - n);
    if (u.mem.ammo <= 0 && !reloading(b, u)) { u.mem.rlEnd = b.t + b.sec(u.mem.reloadSec); b.buff(u, 'reload', u.mem.reloadSec, { name: '재장전', f: { disarm: true, onEnd: (bb, uu) => { uu.mem.ammo = uu.mem.ammoMax; } } }); }
  };
  const ammoGauge = (b, u, color) => { u.gauge = reloading(b, u) ? { label: '재장전', val: u.mem.reloadSec * 20 - Math.max(0, u.mem.rlEnd - b.t), max: u.mem.reloadSec * 20, color: '#94a3b8' } : { label: '탄환', val: u.mem.ammo, max: u.mem.ammoMax, color }; };

  /* ---------- 37. 프레스 ---------- */
  FD.press = {
    id: 'press', name: '프레스', role: 'hunter', color: '#fde047', title: '빛의 포를 쓰는 천계전사',
    concept: '"신성한 빛! 어둠 척결!"',
    stats: { hp: 710, mp: 300, aspd: 0.95, spd: 8.2, atk: 54, ap: 40, def: 16, res: 17, ten: 0.05, pen: 0.10, ls: 0, range: 22, crit: 0.10, critDmg: 1.5 },
    basic: { type: 'phys', atk: 0.8, ap: 0.4, proj: 'bolt' }, ai: { backline: true, kite: 12, threat: 0.9 },
    tac: { act: ['basic', 'retreat'], fight: ['coop'], pos: ['none', 'cover'], aim: ['carry', 'near'] },
  look: { res: 2, pal: { w: '#f8fafc', W: '#cbd5e1', v: '#94a3b8', l: '#fef9c3', y: '#fde047', Y: '#f59e0b', G: '#b45309', g: '#fbbf24', h: '#fde68a', H: '#eab308', s: '#f2c9a0', S: '#c98f5f', a: '#fde1c4', c: '#67e8f9', C: '#0891b2', k: '#475569', b: '#92400e', K: '#1e293b' },
  rows: [
    '..........yyyyyyyyyyyy..........',
    '........yy............yy........',
    '..........YYYYYYYYYYYY..........',
    '.........h.hhhhhhhhhh.h.........',
    '..wg.....hhhhhhhhhhhhhh.....gw..',
    '.wwlg....hhhhHhhhhHhhhh....glww.',
    '.wwwlw...hhhhsssssshhhh...wlwww.',
    '.wwwlww..hhsbbbssbbbshh..wwlwww.',
    'wWwwwlww.hhsccwsswccshh.wwlwwwWw',
    'wwWwwwlwghhsssssssssshhgwlwwwWww',
    'wwwWlwlww.hsssSSSSsssh.wwlwlWwww',
    'wwwwWlwlwg.hssssssssh.gwlwlWwwww',
    'llwyWwlwlw...ssssss...wlwlwWywll',
    'Wwllyyggggg..SSSSSS..gggggyyllwW',
    'wWWggwlwwwggggggggggggwwwlwggWWw',
    'wwwgwlllwwgWWWWwwWWWWgwwlllwgwww',
    'wwwgwwlcwgwwwwlcclwwwwgwclwwgwww',
    'wwwgwwwwwgwWWwwCCwwWWwgwwwwwgwww',
    'wwwwgwwwwwgwwWWwwWWwwgwwwwwgwwww',
    'WWWWSsaswWgwwwwwwwwwwgWwsasSWWWW',
    '.wwwSSasWW.gggwwwwggg.WWsaSSwww.',
    '.wwwSsasWW....gggg....WWsasSwww.',
    '.wwwSsaswSsaaasSSsaaasSwsaslwwwl',
    '.wwWSsssWSSSSSSSSSSSSSSWsssSkkk.',
    '..WwggggwSsaaasSSsaaawwwwwwwkkcc',
    '..wwWwcwWSSSSSSccSSSYgggYYYYkklw',
    '..wwWwwwWgggggcwwcggYgccYYYYkkcw',
    '...wggggWGGGGGccccGGYgggYYYYkklw',
    '...WsssswgggggwccwgggGGssssGkkcc',
    '....SSSS.wwwWwwccwwWwwwSSSSSkkk.',
    '.....wW...wwWwwccwwWww.Ssss....l',
    '..........gggggccggggg..........',
    '..........Sssas..sassS..........',
    '..........Sssss..ssssS..........',
    '..........Ygggg..ggggY..........',
    '..........WWWWW..WWWWW..........'],
  weapon: '' },
    passive: { name: '광명성', desc: '스킬이 적중하면 3초간 공격속도가 25% 상승합니다.',
      onDealt(b, u, t, res, o) { if (o.skill && !o.noPassive) b.buff(u, 'lightstar', 3, { name: '광명성', mul: { aspd: 1.25 }, quiet: true }); } },
    skills: [
      { id: 'pr_s1', name: '빛의움직임', cost: 35, cd: 7, range: 20, move: true, sfx: 'dash', desc: '짧은 거리를 이동하고, 주변 범위 안의 적(최대 3명)을 자동으로 공격하는 빛을 발사합니다.', plan: foeIn(20),
        cast(b, u, pl) {
          const n = pl.t, away = b.dist(u, n) < 10, d = b.dir(u, n), k = away ? -9 : 5, p = b.clampPos(u.x + d.x * k, u.y + d.y * k); b.slide(u, p.x, p.y);
          b.foes(u).filter(e => b.dist(u, e) <= 22).sort((p1, p2) => b.dist(u, p1) - b.dist(u, p2)).slice(0, 3).forEach(e => { beamU(b, u, e.x, e.y, 2, '#fde047'); hit(b, u, e, 'magic', b.raw(u, 26, 0.5, 0.5), '빛의움직임'); });
        } },
      { id: 'pr_s2', name: '광명탄', cost: 30, cd: 6, range: 30, sfx: 'nuke', desc: '빛을 쏘아 직선상의 적에게 피해를 줍니다. 적중시키면 기본스킬 쿨타임이 1.2초 감소합니다.', plan: foeIn(30),
        cast(b, u, pl) {
          const e = lineEnd(b, u, pl.t, 32); beamU(b, u, e.x, e.y, 3, '#fde047');
          const hs = b.inLine(b.foes(u), u.x, u.y, e.x, e.y, 3); hs.forEach(x => hit(b, u, x, 'magic', b.raw(u, 38, 0.8, 0.45), '광명탄', { path: true }));
          if (hs.length) for (const k of ['pr_s1', 'pr_s2']) u.cds[k] = Math.max(0, (u.cds[k] || 0) - b.sec(1.2));
        } }
    ],
    ult: { id: 'pr_ult', name: '광명포', cd: 36, range: 55, sfx: 'nuke', desc: '빛을 잠시 모았다가 발사합니다. 긴 거리를 날아가며 지나가는 모든 적에게 큰 피해를 줍니다.', plan: foeIn(55),
      cast(b, u, pl) {
        lock(b, u, 0.9); const t = pl.t; ring(b, u.x, u.y, 6, '#fde047');
        b.later(0.9, bb => {
          if (!u.alive || bb.stunned(u)) return; const tg = t.alive ? t : bb.nearest(u, bb.foes(u)); if (!tg) return;
          const e = lineEnd(bb, u, tg, 64); beamU(bb, u, e.x, e.y, 6, '#fef08a');
          bb.inLine(bb.foes(u), u.x, u.y, e.x, e.y, 5.5).forEach(x => hit(bb, u, x, 'magic', bb.raw(u, 95, 0.9, 0.9), '광명포', { path: true }));
        });
      } }
  };

  /* ---------- 38. 제이드 ---------- */
  FD.jade = {
    id: 'jade', name: '제이드', role: 'hunter', color: '#22d3ee', title: '사이버네틱 진압대',
    concept: '"제이드 진압기동 출격대기."',
    stats: { hp: 690, mp: 200, aspd: 1.15, spd: 7.8, atk: 52, ap: 0, def: 14, res: 18, ten: 0.05, pen: 0.12, ls: 0, range: 22, crit: 0.15, critDmg: 1.5 },
    basic: rangedBasic, ai: { backline: true, kite: 12, threat: 0.95 },
    tac: { act: ['basic', 'retreat'], fight: ['coop'], pos: ['none', 'cover'], aim: ['carry'] },
    look: { res: 2,
      pal: { D: '#2b303b', M: '#59616e', T: '#9aa4b2', Q: '#ffd0c4', O: '#ff9a3c', C: '#22d3ee', G: '#34d399', N: '#4ade80', S: '#d9a47c', s: '#b07f5c' },
      rows: [
        '..........DDDDDDDDDDDD..........',
        '.........DMMMTTTTTTMMMD.........',
        '........DMMMMTMMMMTMMMMD........',
        '........DMMDDDDDDDDDDMMD........',
        '.......DMDKRRRQQQQRRRKDMD.......',
        '.......DMDKKRRRRRRRRKKDMD.......',
        '........DMDSSSSSSSSSSDMD........',
        '........DDSSSSssssSSSSDD........',
        '.........DMSSSKKKKSSSMD.........',
        '..........DMMMMMMMMMMD..........',
        '...........KCKKGGKKCK...........',
        '....DMMMMDDMKCCGGCCKMDDMMMMD....',
        '...DMTTMMDDDMMMMMMMMDDDMMTTMD...',
        '...DMTMMMDDMMMTTTTMMMDDMMMTMD...',
        '...DMMMMMDDMMTMMMMTMMDDMKKMMD...',
        '...DMCNMDDMMMTTTTTTMMMDDNCMMD...',
        '...DCNCNDDMMDMMMMMMDMMDDMMMMD...',
        '...DCNNCDDMMMMMMMMMMMMDDMMMMD...',
        '..KKKKXXXXXXXXXXXXRXXXXXXXXXXK..',
        '..KMMMXXXXXXXXOOOXXXXXXXXXXXXXK..',
        '..KKKMMMXXXXXXXXKKKKKKKXXXXXXX..',
        '...DMMMMDDKKDMMMMMMDKKDDMMMMD...',
        '......DD..DKKKKKKYYKKKKD..DD....',
        '.....DKKKKDKKMMMMMMKKDKKKKD.....',
        '.....DKKKKDKKKDDDDKKKDKKKKD.....',
        '.......DMMMMMMMDDMMMMMMMD.......',
        '.......DMMTMMMMDDMMMMTMMD.......',
        '.......DMCNMMMMDDMMMMNCMD.......',
        '.......DTTTTTTTDDTTTTTTTD.......',
        '.......DMMMMMMMDDMMMMMMMD.......',
        '.......DMMGGMMMDDMMMGGMMD.......',
        '.......DMMMMMMMDDMMMMMMMD.......',
        '......DKKKKKKKKDDKKKKKKKKD......',
        '....DKKKKKKKKKKDDKKKKKKKKKKD....',
        '....DDDDDDDDDDDDDDDDDDDDDDDD....'],
      weapon: '' },
    passive: { name: '정밀조준경', desc: '기본 공격 시 30% 확률로 추가 피해를 줍니다. 탄환 25발을 쓰며(기본 공격 1발), 모두 쓰면 3.5초간 재장전합니다.',
      init(b, u) { ammoInit(u, 25, 3.5); },
      onBasic(b, u, t) {
        useAmmo(b, u, 1);
        if (t.alive && Math.random() < 0.3) { ring(b, t.x, t.y, 3, '#22d3ee'); b.deal(u, t, { type: 'phys', raw: b.raw(u, 30, 0.7), via: '정밀조준경', noPassive: true, pierce: u.st.some(s => s.pierce) }); }
      },
      tick(b, u) { ammoGauge(b, u, '#22d3ee'); } },
    skills: [
      { id: 'jd_s1', name: '천공탄환', cost: 30, cd: 8, range: 36, sfx: 'pierce', avail: (b, u) => u.mem.ammo >= 12, desc: '탄환 12발을 소모해 강력한 한 발을 발사합니다. 사거리 안의 적들을 모두 관통합니다.', plan: foeIn(36),
        cast(b, u, pl) {
          useAmmo(b, u, 12); const e = lineEnd(b, u, pl.t, 38); beamU(b, u, e.x, e.y, 3.5, '#67e8f9');
          b.inLine(b.foes(u), u.x, u.y, e.x, e.y, 3.5).forEach(x => hit(b, u, x, 'phys', b.raw(u, 70, 1.7), '천공탄환', { path: true, rollCrit: true }));
        } },
      { id: 'jd_s2', name: '생체복구', cost: 30, cd: 10, range: 28, sfx: 'buff', desc: '3초 동안 이동속도가 30% 증가하고 체력을 지속 회복합니다.',
        plan: (b, u, en) => (en.some(e => b.dist(u, e) <= 28) && (u.hp < u.maxHp * 0.9 || en.some(e => b.dist(u, e) <= 10)) ? {} : null),
        cast(b, u) { b.buff(u, 'biorecover', 3, { name: '생체복구', mul: { spd: 1.3 }, f: { regen: 0.08 } }); ring(b, u.x, u.y, 5, '#34d399'); } }
    ],
    ult: { id: 'jd_ult', name: '초정밀타격', cd: 34, range: 30, sfx: 'buff', desc: '8초 동안 기본 공격 피해(+25%)와 치명타 확률(+20%p)·치명타 피해(+50%p)가 상승합니다.', plan: anyIn(30),
      cast(b, u) { b.buff(u, 'precision', 8, { name: '초정밀타격', mul: { atk: 1.25 }, add: { crit: 0.2, critDmg: 0.5 } }); ring(b, u.x, u.y, 6, '#22d3ee'); } }
  };

  /* ---------- 39. 다크 ---------- */
  const clearAll = (b, e) => {
    const keep = ['revive', 'hero_air', 'bossarmor'];
    e.st.filter(s => !keep.includes(s.key)).forEach(s => { if (s.onEnd) s.onEnd(b, e, s); });
    e.st = e.st.filter(s => keep.includes(s.key));
  };
  FD.dark = {
    id: 'dark', name: '다크', role: 'hunter', color: '#ef4444', title: '어둠의 리볼버 싸이코 범죄자',
    concept: '"결국 모든 진실을 밝혀질거야."',
    stats: { hp: 700, mp: 180, aspd: 0.8, spd: 8.0, atk: 62, ap: 0, def: 17, res: 16, ten: 0, pen: 0.10, ls: 0, range: 24, crit: 0.30, critDmg: 1.5 },
    basic: rangedBasic, ai: { backline: true, kite: 13, threat: 1.0 },
    tac: { act: ['basic', 'retreat'], fight: ['solo'], pos: ['cover', 'none'], aim: ['weak', 'carry'] },
        look: { res: 2,
      pal: { D: '#07060d', j: '#2a2230', J: '#3d3346', L: '#5a4c66', m: '#6b5a4a', w: '#e7e5e4', k: '#0b0b12', r: '#ef4444', R: '#7f1d1d', h: '#1a1822', H: '#3b3b55',
            p: '#1f1d2b', P: '#2d2a3d', b: '#111018', B: '#2b2733', y: '#facc15', g: '#6b7280', x: '#8b95a5', X: '#374151', v: '#7c3aed', V: '#4c1d95', u: '#c084fc', s: '#d6c0a8' },
      rows: [
        '...........h..h..h..h...........',
        '..........hhhhhhhhhhhh..........',
        '........hhhhHhhmmhHhhhhh........',
        '........hhhhhmgmmgmhhhhh........',
        '........hhhgmwwmmwwmghhh........',
        '.......hhh.mwwwmmwwwm.hhh.......',
        '........hh.kRkwwwwkRk.hh........',
        '...........krkwwwwkrk...........',
        '...........kkkwkkwkkk.......u...',
        '...V.......mwwwkkwwwm.....V.....',
        '............wkwkwkwk....v.....v.',
        '............mmmmmmmm..V.........',
        '.......jjJJJJkkkkkkJJJJjj.......',
        '.....JjjjgLjjJJkkJJjjgjj........',
        '.....JjjjLLjJJjgkjJJjjgj........',
        '.....JjjjjgjJJjkkjJJjjjj........',
        '.....JjjjjjjJJjgkjJJjjj.........',
        '.....JjjjjjjJjjkkjJjJjj.........',
        '.....JjjjjjjRRjgkjjjjjj.........',
        '.....Jjjj.jjRjjkkjjjjj........V.',
        '.....Jjjj.JJJjjgkjjjjj..........',
        '.....Jjjj.JJJjjkkjjjjj.......u..',
        '.....kkkk..jjjjgkjjjj...V.......',
        '.....kkkk..jjjjkkjjjj......v....',
        '......kkk.kkkkykkykkkk..........',
        '......kkk.kkkkykkykkkk..........',
        '......kkk.pppppppppppp..........',
        '......s.g.pppppppppppp..........',
        '........g.pPPppppppppp..V.......',
        '....V...g.pPPpppppPPPp..........',
        '........g.pPPpp..pPPPp....v.....',
        '.....V....ppppp..pPPPp..........',
        '..........ppppp..ppppp..........',
        '...v.....bbbbbbbbbbbbbb....V....',
        '.........BBBBBBBBBBBBBB.........',
        '.........DbbbbbbbbbbbbD.........'],
      weapon: '10,7,X;11,7,X;12,7,X;25,7,v;26,7,v;27,7,v;28,7,V;10,8,X;11,8,X;12,8,X;13,8,g;20,8,j;21,8,j;22,8,j;24,8,V;25,8,u;26,8,v;27,8,u;28,8,u;11,9,X;12,9,X;13,9,X;20,9,j;21,9,j;22,9,j;23,9,V;24,9,y;25,9,y;26,9,v;27,9,V;28,9,v;11,10,X;12,10,X;13,10,X;14,10,X;15,10,x;16,10,x;17,10,x;18,10,x;19,10,x;20,10,x;21,10,g;22,10,g;23,10,g;24,10,g;25,10,g;26,10,g;27,10,g;28,10,g;29,10,k;11,11,X;12,11,X;13,11,X;14,11,x;15,11,k;16,11,k;17,11,x;18,11,x;19,11,k;20,11,k;21,11,x;22,11,x;23,11,x;24,11,x;25,11,x;26,11,x;27,11,x;28,11,u;29,11,k;13,12,X;14,12,g;15,12,k;16,12,k;17,12,x;18,12,x;19,12,k;20,12,k;21,12,x;22,12,x;23,12,x;24,12,x;25,12,x;26,12,x;27,12,x;28,12,v;29,12,k;13,13,x;14,13,x;15,13,x;16,13,x;17,13,V;18,13,v;19,13,x;20,13,x;21,13,X;22,13,X;23,13,X;24,13,X;25,13,X;26,13,X;27,13,X;28,13,X;29,13,k;13,14,x;14,14,k;15,14,k;16,14,x;17,14,v;18,14,V;19,14,x;20,14,k;21,14,k;22,14,x;23,14,j;24,14,j;13,15,X;14,15,g;15,15,k;16,15,x;17,15,x;18,15,x;19,15,x;20,15,k;21,15,g;22,15,X;23,15,j;24,15,j;13,16,X;14,16,x;15,16,k;16,16,k;17,16,x;18,16,x;19,16,k;20,16,k;21,16,x;22,16,X;23,16,j;24,16,j;13,17,X;14,17,X;15,17,X;16,17,k;17,17,x;18,17,x;19,17,k;20,17,k;21,17,X;22,17,X;23,17,j;13,18,X;14,18,y;15,18,X;17,18,k;18,18,k;19,18,k;20,18,k;21,18,j;13,19,X;14,19,X;15,19,X;16,19,X;17,19,X;18,19,X;19,19,X;20,19,k;16,20,X;17,20,x;18,20,x;19,20,X;16,21,X;17,21,x;18,21,x;19,21,X;16,22,X;17,22,x;18,22,x;19,22,X;16,23,g;17,23,X;18,23,X;19,23,X' },
    passive: { name: '추적자의 총', desc: '치명타 피해량이 대폭(+70%p) 상승합니다. 탄환 6발을 쓰며(기본 공격 1발), 모두 쓰면 2.8초간 재장전합니다.',
      init(b, u) { ammoInit(u, 6, 2.8); },
      stat(b, u, k, v) { return k === 'critDmg' ? v + 0.7 : v; },
      onBasic(b, u) { useAmmo(b, u, 1); },
      tick(b, u) { ammoGauge(b, u, '#ef4444'); } },
    skills: [
      { id: 'dk_r1', name: '복수의 한발', cost: 40, cd: 7, range: 30, sfx: 'nuke', avail: (b, u) => u.mem.ammo >= 1, desc: '정신을 집중(0.7초)해 강력한 한 발을 쏩니다. 치명타로 적중할 수 있으며, 치명타라면 피해량이 대폭 상승합니다.', plan: foeIn(30),
        cast(b, u, pl) {
          lock(b, u, 0.7); useAmmo(b, u, 1); const t = pl.t;
          b.later(0.7, bb => {
            if (!u.alive || bb.stunned(u)) return; const tg = t.alive ? t : bb.nearest(u, bb.foes(u)); if (!tg) return;
            const crit = Math.random() < Math.min(1, bb.eff(u, 'crit') + 0.2); beamU(bb, u, tg.x, tg.y, 3, crit ? '#fde047' : '#ef4444');
            hit(bb, u, tg, 'phys', bb.raw(u, 90, 1.5) * (crit ? bb.eff(u, 'critDmg') * 1.35 : 1), '복수의 한발', { crit });
          });
        } },
      { id: 'dk_r2', name: '암흑이동', cost: 30, cd: 9, range: 30, move: true, sfx: 'dash', desc: '지정한 위치로 순간이동하고 탄환을 즉시 재장전합니다. (적이 가까우면 멀어지는 쪽으로)', plan: (b, u, en) => { const t = b.nearest(u, en.filter(e => b.dist(u, e) <= 30)); return t ? { t } : null; },
        cast(b, u, pl) {
          const t = pl.t, d = b.dir(u, t), close = b.dist(u, t) < 10, k = close ? -16 : Math.max(0, b.dist(u, t) - 14);
          b.blink(u, u.x + d.x * k, u.y + d.y * k); u.st = u.st.filter(s => s.key !== 'reload'); u.mem.ammo = u.mem.ammoMax; ring(b, u.x, u.y, 5, '#ef4444');
        } }
    ],
    ult: { id: 'da_ult', name: '클리어월드', cd: 38, range: 16, sfx: 'debuff', desc: '탄환을 쏘아 주변 범위 안의 모든 유닛(아군·적 모두, 자신 제외)의 버프와 디버프를 해제하고 잠시(1.5초) 멈추게 합니다.',
      plan: (b, u, en, al, strict) => { const n = en.filter(e => b.dist(u, e) <= 16).length; return n >= (strict ? 2 : 1) ? {} : null; },
      cast(b, u) {
        ring(b, u.x, u.y, 16, '#e5e7eb');
        b.units.filter(e => e !== u && e.team < 2 && e.alive && !b.gone(e) && b.dist(u, e) <= 16).forEach(e => { clearAll(b, e); b.cc(u, e, 'stun', 1.5); });
      } }
  };

  /* ---------- 40. 바이오머신 ---------- */
  const fpAdd = (u, v) => { u.mem.fp = Math.min(100, (u.mem.fp || 0) + v); if (u.mem.fp >= 100) u.mem.charged = true; };
  FD.biomachine = {
    id: 'biomachine', name: '바이오머신', role: 'hunter', color: '#f97316', title: '비밀기업 전투개체',
    concept: '"살상모드 가동."',
    stats: { hp: 850, mp: 200, aspd: 1.0, spd: 8.0, atk: 56, ap: 20, def: 20, res: 21, ten: 0.10, pen: 0.08, ls: 0.15, range: 13, crit: 0.05, critDmg: 1.5 },
    basic: rangedBasic, ai: { kite: 5, threat: 1.1 },
    tac: { act: ['basic', 'rush'], fight: ['coop'], pos: ['front', 'none'] },
    look: { pal: { o: '#ea580c', O: '#9a3412', g: '#64748b', G: '#334155', r: '#ef4444', k: '#0f172a', y: '#facc15', w: '#e2e8f0' },
      rows: [
        '......GGGG......',
        '....GGggggGG....',
        '...GggGGGGggG...',
        '..GggkkGGkkggG..',
        '..GgrrkGGkrrgG..',
        '..GggkkGGkkggG..',
        '...GGGGGGGGGG...',
        '.GGooooooooooGG.',
        'GggOoyyooyyoOggG',
        'GgGOoyryyryoOGgG',
        'GgGoOoyyyyoOoGgG',
        'kkGoooOOOOoooGkk',
        '.kGoooOOOOoooGk.',
        '..GgGggggggGgG..',
        '..GGg..GG..gGG..',
        '..GGg..GG..gGG..',
        '.GGGg..GG..gGGG.',
        '.kkkk..kk..kkkk.'],
      weapon: '' },
    passive: { name: '전투기계', desc: '이동, 기본 공격, 스킬 사용 시 화력이 충전됩니다. 화력이 가득 차면 다음 기본스킬이 강화되어 나가고, 그 뒤 화력을 모두 소모합니다.',
      init(b, u) { u.mem.fp = 0; u.mem.charged = false; },
      onBasic(b, u) { fpAdd(u, 4); },
      onSkill(b, u) { if (u.mem.just) { u.mem.just = false; return; } fpAdd(u, 8); },
      tick(b, u) {
        const m = u.mem; if (m.lx !== undefined && Math.hypot(u.x - m.lx, u.y - m.ly) > 0.15) fpAdd(u, 0.45); m.lx = u.x; m.ly = u.y;
        u.gauge = { label: m.charged ? '강화 준비' : '화력', val: m.fp || 0, max: 100, color: m.charged ? '#fde047' : '#f97316' }; u.glow = m.charged ? '#f97316' : null;
      } },
    skills: [
      { id: 'bm_s1', name: '스매쉬샷', cost: 30, cd: 6, range: 12, sfx: 'nuke', desc: '샷건을 두 발 발사해 전방 범위에 피해를 줍니다. 강화: 범위 상승 및 적 넉백.', plan: foeIn(13),
        cast(b, u, pl) {
          const en = !!u.mem.charged, R = en ? 17 : 12, half = en ? 0.85 : 0.55; if (en) { u.mem.charged = false; u.mem.fp = 0; u.mem.just = true; }
          cone(b, u, pl.t, R, half, en ? '#fde047' : '#f97316');
          b.inCone(b.foes(u), u, pl.t.x, pl.t.y, R, half).forEach(e => { for (let i = 0; i < 2; i++) hit(b, u, e, 'phys', b.raw(u, 22, 0.55) * (en ? 1.25 : 1), '스매쉬샷', { splash: true }); if (en) b.knock(u, e, 8); });
        } },
      { id: 'bm_s2', name: '전술용특수무기', cost: 35, cd: 8, range: 26, sfx: 'nuke', desc: '무작위로 1개를 발사합니다. ① 전기포: 피해 및 기절 ② 화염방사: 전방 지속 피해 및 화상 ③ 냉각포: 맞은 적 빙결, 주변 둔화. 강화: 피해량 상승.', plan: foeIn(26),
        cast(b, u, pl) {
          const en = !!u.mem.charged, k = en ? 1.4 : 1, t = pl.t, w = Math.floor(Math.random() * 3); if (en) { u.mem.charged = false; u.mem.fp = 0; u.mem.just = true; }
          if (w === 0) {
            const e = lineEnd(b, u, t, 28); beamU(b, u, e.x, e.y, 3.5, '#facc15');
            b.inLine(b.foes(u), u.x, u.y, e.x, e.y, 3.5).forEach(x => { hit(b, u, x, 'phys', b.raw(u, 45, 0.8) * k, '전기포', { path: true }); b.cc(u, x, 'stun', en ? 1.5 : 1.0); });
          } else if (w === 1) {
            lock(b, u, 1.6); const d = b.dir(u, t), tx = u.x + d.x * 10, ty = u.y + d.y * 10;
            for (let i = 0; i < 8; i++) b.later(i * 0.2, bb => { if (!u.alive || bb.stunned(u)) return; cone(bb, u, { x: tx, y: ty }, 14, 0.5, '#fb923c'); bb.inCone(bb.foes(u), u, tx, ty, 14, 0.5).forEach(x => { hit(bb, u, x, 'magic', bb.raw(u, 8, 0.2, 0.3) * k, '화염방사', { splash: true, dot: true }); bb.cc(u, x, 'burn', 3, { quiet: true }); }); });
          } else {
            beamU(b, u, t.x, t.y, 3, '#7dd3fc'); hit(b, u, t, 'magic', b.raw(u, 40, 0.5, 0.6) * k, '냉각포'); b.cc(u, t, 'freeze', 1.4);
            ring(b, t.x, t.y, 9, '#7dd3fc'); b.inCircle(b.foes(u), t.x, t.y, 9).filter(x => x !== t).forEach(x => { hit(b, u, x, 'magic', b.raw(u, 18, 0.25, 0.3) * k, '냉각포', { splash: true }); b.cc(u, x, 'slow', 2.5, { amt: 0.4 }); });
          }
        } }
    ],
    ult: { id: 'bm_ult', name: '무차별요격', cd: 36, range: 30, sfx: 'aoe', desc: '자신 주변으로 미사일 여러 발을 날립니다. 주변 적을 나누어 공격하고, 적이 한 명뿐이면 모두 그 한 명에게 날아갑니다.', plan: anyIn(30),
      cast(b, u) {
        const fs = b.foes(u).filter(e => b.dist(u, e) <= 30); if (!fs.length) return;
        for (let i = 0; i < 8; i++) b.later(i * 0.12, bb => { if (!u.alive) return; const t = fs.filter(e => e.alive)[i % Math.max(1, fs.filter(e => e.alive).length)]; if (!t) return; beamU(bb, u, t.x, t.y, 2, '#fb923c'); ring(bb, t.x, t.y, 3, '#fb923c'); hit(bb, u, t, 'phys', bb.raw(u, 18, 0.4, 0.2), '무차별요격', { splash: true }); });
      } }
  };

  /* ================= 사냥꾼 41~43 ================= */
  const segD = (px, py, x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy || 1; let t = ((px - x1) * dx + (py - y1) * dy) / l; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - x1 - dx * t, py - y1 - dy * t); };
  const firstInLine = (b, u, x2, y2, w) => b.inLine(b.foes(u), u.x, u.y, x2, y2, w).sort((p, q) => b.dist(u, p) - b.dist(u, q))[0];

  /* ---------- 41. 프로스트 ---------- */
  FD.frost = {
    id: 'frost', name: '프로스트', role: 'hunter', color: '#67e8f9', title: '얼음 결정의 사수',
    concept: '"더이상 우리를 괴롭히지 마!!"',
    stats: { hp: 700, mp: 260, aspd: 1.0, spd: 7.8, atk: 47, ap: 20, def: 12, res: 11, ten: 0, pen: 0.08, ls: 0, range: 14, crit: 0.05, critDmg: 1.5 },
    basic: rangedBasic, ai: { backline: true, kite: 12, threat: 1.0 },
    tac: { act: ['basic', 'retreat'], fight: ['coop'], pos: ['cover'], aim: ['near', 'weak'] },
    look: {
  res: 2,
  pal: {
    B: '#1e5a9e', b: '#123a6b', A: '#7dd3fc',                  // 재킷 / 재킷 음영 / 하늘색 포인트
    N: '#e8f4ff', F: '#cfe1ef', f: '#93b5cf',                  // 목도리 / 모피 단 / 모피 음영
    H: '#e0f2fe', h: '#8fc9ee',                                // 머리 / 머리 음영
    S: '#ffe0c8', s: '#e8b894', E: '#101428', I: '#38bdf8',   // 피부 / 피부 음영 / 눈 / 홍채
    p: '#ffb3c7', P: '#e87fa0',                                // 볼터치 / 입
    G: '#2b4f7a',                                              // 장갑
    L: '#2a3f66', l: '#1b2a47', D: '#0f2338',                  // 바지 / 바지 음영 / 부츠
    Q: '#f0ffff', C: '#a5f3fc', c: '#22a6d6'                   // 결정 하이라이트 / 본체 / 음영
  },
  rows: [
    '.......H..H.H..................',
    '......HHhHHhHH..................',
    '.....hHHHHHHHHh.................',
    '.....HHHhHHhHHH.................',
    '.....HHSSSSSSHH.................',
    '.....HhSESSEShH.................',
    '.....HhSISSIShH.................',
    '......hpSSSSph..................',
    '......hSSPPSSh..................',
    '........sSSs........QQ..........',
    '......NNANNANN.....cQQc..QQ.....',
    '.....NANNNNNNAN.....QQ..cQQc....',
    '...bBBNNBBBBBBBBB......cCQQCc.A.',
    '...bBBNABAABBBBBBAGG..cCCQQCCc..',
    '...bBBNNBAABBBBBBAGG..cCCQQCCc..',
    '...bBBBBBAABBBB........cCQQCc...',
    '...bBBBBBAABBBB.....QQ..cQQc....',
    '...GGAAAAQQAAAA....cQQc..QQ.....',
    '...GGFFfFFFFfFF.....QQ..........',
    '......LLl..lLL..................',
    '......LLl..lLL..................',
    '......LLl..lLL..................',
    '......LLl..lLL..................',
    '......LLl..lLL..................',
    '.....FFFF..FFFF.................',
    '.....DDDD..DDDD.................',
    '.....DDDD..DDDD.................',
    '....DDDDD..DDDDD................'
  ]
},
    passive: { name: '얼음덩어리', desc: '기본 공격이 적을 1.5초간 15% 둔화시킵니다. 얼음지대 위에서는 이동속도가 크게 늘어납니다.',
      onBasic(b, u, t) { if (t.alive) b.cc(u, t, 'slow', 1.5, { amt: 0.15, quiet: true }); },
      tick(b, u) {
        const z = u.mem.ice; if (!z || z.until <= b.t || b.t % 5) return;
        if (segD(u.x, u.y, z.x1, z.y1, z.x2, z.y2) <= 3.6) b.buff(u, 'fr_haste', 0.4, { name: '얼음질주', mul: { spd: 1.4 }, quiet: true });
        b.foes(u).forEach(e => { if (segD(e.x, e.y, z.x1, z.y1, z.x2, z.y2) <= 3.6) b.cc(u, e, 'slow', 0.6, { amt: 0.3, quiet: true }); });
      } },
    skills: [
      { id: 'fr_s1', name: '얼음지대', cost: 35, cd: 9, range: 22, sfx: 'aoe', desc: '전방 일직선으로 얼음지대를 만들어 피해를 주고 적을 둔화시킵니다. 5초간 유지되며, 그 안에서 적은 계속 둔화되고 프로스트는 이동속도가 40% 증가합니다.', plan: foeIn(22),
        cast(b, u, pl) {
          const e = lineEnd(b, u, pl.t, 22), x1 = u.x, y1 = u.y; u.mem.ice = { x1, y1, x2: e.x, y2: e.y, until: b.t + b.sec(5) };
          beamU(b, u, e.x, e.y, 5, '#7dd3fc');
          [0.25, 0.55, 0.85].forEach(k => b.zone({ x: x1 + (e.x - x1) * k, y: y1 + (e.y - y1) * k, r: 4.2, dur: 5, owner: u, kind: 'fog', color: '#7dd3fc' }));
          b.inLine(b.foes(u), x1, y1, e.x, e.y, 3.6).forEach(x => { hit(b, u, x, 'magic', b.raw(u, 28, 0.3, 0.6), '얼음지대', { path: true }); b.cc(u, x, 'slow', 3, { amt: 0.35 }); });
        } },
      { id: 'fr_s2', name: '얼음난사', cost: 40, cd: 8, range: 26, sfx: 'nuke', desc: '얼음 조각 8발을 연달아 난사합니다. 한 적이 4발 이상 맞으면 1.3초간 빙결됩니다.', plan: foeIn(26),
        cast(b, u, pl) {
          const t0 = pl.t, cnt = new Map();
          for (let i = 0; i < 8; i++) b.later(i * 0.12, bb => {
            if (!u.alive || bb.stunned(u)) return;
            const x = t0.alive && !bb.hidden(t0) ? t0 : bb.nearest(u, bb.foes(u).filter(e => bb.dist(u, e) <= 28)); if (!x) return;
            beamU(bb, u, x.x, x.y, 1.6, '#a5f3fc'); hit(bb, u, x, 'magic', bb.raw(u, 9, 0.35, 0.3), '얼음난사', { splash: true });
            const n = (cnt.get(x) || 0) + 1; cnt.set(x, n); if (n === 4) bb.cc(u, x, 'freeze', 1.3);
          });
        } }
    ],
    ult: { id: 'fr_ult', name: '아이스애로우', cd: 36, range: 44, sfx: 'nuke', desc: '멀리 거대한 얼음 화살을 날려 처음 맞은 적에게 큰 피해를 주고 1.6초간 기절시킵니다.', plan: foeIn(44),
      cast(b, u, pl) {
        const e = lineEnd(b, u, pl.t, 46), f = firstInLine(b, u, e.x, e.y, 2.5);
        beamU(b, u, f ? f.x : e.x, f ? f.y : e.y, 4, '#67e8f9');
        if (f) { ring(b, f.x, f.y, 7, '#67e8f9'); hit(b, u, f, 'magic', b.raw(u, 85, 0.4, 0.9), '아이스애로우', { crit: true }); b.cc(u, f, 'stun', 1.6); }
      } }
  };

  /* ---------- 42. 샤이닝 ---------- */
  const imgN = t => { const s = t.st.find(x => x.key === 'sn_img'); return s ? s.stacks : 0; };
  const addImg = (b, u, t, n) => { if (!t.alive) return; const k = Math.min(8, imgN(t) + n); b.buff(t, 'sn_img', 8, { name: '잔상 ' + k, good: false, src: u, quiet: true, f: { stacks: k } }); };
  FD.shining = {
    id: 'shining', name: '샤이닝', role: 'hunter', color: '#fde047', title: '빛을 다루는 천계의 고위천사',
    concept: '"감히 누가 이 위대한 힘에 대적하는가?"',
    stats: { hp: 700, mp: 300, aspd: 1.0, spd: 8.0, atk: 40, ap: 56, def: 14, res: 22, ten: 0, pen: 0.08, ls: 0, range: 13, crit: 0.05, critDmg: 1.5 },
    basic: { type: 'magic', atk: 0.3, ap: 0.7, proj: 'bolt' }, ai: { backline: true, kite: 11, threat: 1.0 },
    tac: { act: ['basic', 'retreat'], fight: ['coop'], pos: ['cover'], aim: ['carry', 'near'] },
    look: { pal: { g: '#fcd34d', G: '#f59e0b', w: '#f8fafc', W: '#cbd5e1', s: '#fde4d0', y: '#fef08a', e: '#38bdf8' },
      rows: [
        '.....gggggg.....',
        '....yyyyyyyy....',
        '...yyyyyyyyyy...',
        '...yyssssssyy...',
        '...ysesssesyy...',
        '....ssssssss....',
        'ww..wwgwwgww..ww',
        'WWw.wwwwwwww.wWW',
        'WWwwwgwwwwgwwWWW',
        '.WWwwwwwwwwwwWW.',
        '..WWsGwwwwGsWW..',
        '...Wwwwwwwwwww..',
        '....wwwGGwww....',
        '....wwwwwwww....',
        '....www..www....',
        '....www..www....',
        '...gggg..gggg...',
        '...gGgg..ggGg...'],
      weapon: '' },
    passive: { name: '잔상', desc: '기본 공격이 적에게 잔상을 1중첩 남깁니다(최대 8, 8초). 잔상이 있는 적에게 스킬이 적중하면 중첩만큼 방어를 무시하는 추가 피해를 주고 잔상이 사라집니다.',
      onBasic(b, u, t) { addImg(b, u, t, 1); },
      onDealt(b, u, t, res, o) {
        if (o.noPassive || !o.skill || !t.alive) return; const n = imgN(t); if (!n) return;
        t.st = t.st.filter(s => s.key !== 'sn_img'); ring(b, t.x, t.y, 3, '#fde047');
        b.deal(u, t, { type: 'true', raw: b.raw(u, 7, 0, 0.24) * n, via: '잔상', skill: true, splash: true, noPassive: true });
      } },
    skills: [
      { id: 'sn_s1', stack: { fn: imgN, min: 3 }, name: '신의위광', cost: 40, cd: 7, range: 28, sfx: 'nuke', desc: '지정한 위치에 잠시 뒤 땅에서 빛을 쏟아내 범위 안의 적에게 피해를 줍니다.', plan: foeIn(28),
        cast(b, u, pl) {
          const c = { x: pl.t.x, y: pl.t.y }; b.zone({ x: c.x, y: c.y, r: 7, dur: 0.7, owner: u, kind: 'warn', color: '#fde047' });
          b.later(0.7, bb => { if (!u.alive) return; ring(bb, c.x, c.y, 7, '#fde047'); bb.emit({ type: 'star', x: c.x, y: c.y }); bb.inCircle(bb.foes(u), c.x, c.y, 7).forEach(e => hit(bb, u, e, 'magic', bb.raw(u, 45, 0.1, 0.95), '신의위광', { splash: true })); });
        } },
      { id: 'sn_s2', name: '광신화', cost: 35, cd: 14, range: 12, sfx: 'buff', desc: '시전 즉시 주변 적을 2.5초간 실명(기본 공격이 빗나감)시키고, 4초간 이동속도와 공격속도가 25% 증가합니다.', plan: anyIn(12),
        cast(b, u) {
          ring(b, u.x, u.y, 12, '#fde047'); b.inCircle(b.foes(u), u.x, u.y, 12).forEach(e => b.cc(u, e, 'blind', 2.5));
          b.buff(u, 'sn_haste', 4, { name: '광신화', mul: { spd: 1.25, aspd: 1.25 } }); u.glow = '#fde047'; b.later(4, () => { u.glow = null; });
        } }
    ],
    ult: { id: 'sn_ult', name: '라이트닝보텍스', cd: 34, range: 30, sfx: 'nuke', desc: '빛을 10발 발사해 주변 적들을 맞춥니다. 맞은 적에게는 잔상이 1중첩씩 쌓입니다(이 스킬은 잔상을 터뜨리지 않습니다).', plan: anyIn(30),
      cast(b, u) {
        const fs = b.foes(u).filter(e => b.dist(u, e) <= 30); if (!fs.length) return; ring(b, u.x, u.y, 10, '#fde047');
        for (let i = 0; i < 10; i++) b.later(i * 0.12, bb => {
          if (!u.alive || bb.stunned(u)) return; const l = fs.filter(e => e.alive && !bb.hidden(e)), t = l[i % Math.max(1, l.length)]; if (!t) return;
          beamU(bb, u, t.x, t.y, 2, '#fde047'); ring(bb, t.x, t.y, 3, '#fde047'); hit(bb, u, t, 'magic', bb.raw(u, 12, 0.1, 0.32), '라이트닝보텍스', { splash: true, noPassive: true }); addImg(bb, u, t, 1);
        });
      } }
  };

  /* ---------- 43. 스팀맨 (건샷모드 ↔ 펀치모드) ---------- */
  const SM_PAL = { h: '#44403c', s: '#d6b08c', c: '#78350f', C: '#451a03', m: '#94a3b8', M: '#475569', o: '#fb923c', y: '#d97706', k: '#1c1917', g: '#e2e8f0' };
  const smFx = (b, u, t) => { u.mem.mvT = 0; if (t.alive) { ring(b, t.x, t.y, 4, '#fb923c'); hit(b, u, t, 'phys', b.raw(u, 26, 0.7), '전투기동', { noPassive: true }); } };
  FD.steamman = {
    id: 'steamman', name: '스팀맨', role: 'hunter', color: '#fb923c', title: '기계팔의 방랑전사',
    concept: '"도시의 정의는 나야."',
    stats: { hp: 820, mp: 220, aspd: 0.95, spd: 8.0, atk: 51, ap: 0, def: 28, res: 22, ten: 0.05, pen: 0.10, ls: 0.08, range: 18, crit: 0.05, critDmg: 1.5 },
    basic: rangedBasic, ai: { backline: true, kite: 10, threat: 1.05 }, form0: 'gun',
    tac: { act: ['basic', 'rush'], fight: ['coop', 'solo'], pos: ['none'], aim: ['carry', 'near'] },
    look: { res: 2,
      pal: { D: '#1a120a', h: '#5b3f24', Y: '#d4a04a', y: '#8a5a1a', H: '#3a2a1a', s: '#e0b48a', S: '#b98c63', g: '#67e8f9', x: '#94a3b8', X: '#475569',
            w: '#e5e7eb', K: '#2a1b10', r: '#b91c1c', c: '#6b4423', C: '#3f2a14', p: '#7c8f4a', k: '#2a1b10', o: '#fb923c' },
      rows: [
        '.......DhhhhhhhD................',
        '.......DHhHhHhhD................',
        '.......DhhhhhhhD................',
        '.......DhhhhhhhD................',
        '.....DDDYYYYYYYDDD..............',
        '....DhhhhhhhhhhhhhD.............',
        '.....DDDDDDDDDDDDD..............',
        '.....DHsssssssssHD..............',
        '...w.DHxwgxxxwgxHD..............',
        '....wDHxggsssggxHD..............',
        '...w..DssssKssssD.....w..w......',
        '...Dw.DSSSKKKSSSDD..w.....w.....',
        '..DYXDrrrrrrrrrrrrD..w...w......',
        '...DXDrrrrrrrrrrrXxxwx...XX.....',
        '..DcccccccCCCCcccxYYxx...XX.....',
        '..DcccccccCYYCcccxYYx....XX..XXX',
        '..DcccccccCCCCcccxyyyyyyyyyyyXXo',
        '..DcccccccCYYCccccYYYyYYyYYyYXXD',
        '..DcccccppCCCCccccYYYyYYyYYyYXoD',
        '..DcccccppCYYCccccYYYyYYyYYyYXoD',
        '..DYYYccccCCCCccccYYYyYYyYYyYXXD',
        '..DxxxccccCYYCppccyyyyyyyyyyyXXo',
        '..DxxxCCCcCCCCppcssxxxx......XXw',
        '..DxxxkkkkYYYYkkkssxxxx.......w.',
        '..DsssCCCcCCCCcccccD............',
        '..DsssccccCCCCcccccD............',
        '...DDDDCCCCCDCCCCCD.............',
        '......DCCCCCDCCCCCD.............',
        '......DCpppCDCCCCCD.............',
        '......DCpppCDCCCCCD.............',
        '......DCCCCCDCCCCCD.............',
        '......DCCCCCDCCCCCD.............',
        '.....DkkkkkkDkkkkkkD............',
        '.....DkkkkkkDkkkkkkD............',
        '.....DyykkkkDkkkkyyD............'],
      weapon: '' },
    looks: { punch: { res: 2,
      pal: { D: '#1a120a', h: '#5b3f24', Y: '#d4a04a', y: '#8a5a1a', H: '#3a2a1a', s: '#e0b48a', S: '#b98c63', g: '#67e8f9', x: '#94a3b8', X: '#475569',
            w: '#e5e7eb', K: '#2a1b10', r: '#b91c1c', c: '#6b4423', C: '#3f2a14', p: '#7c8f4a', k: '#2a1b10', o: '#fb923c' },
      rows: [
        '.......DhhhhhhhD................',
        '.......DHhHhHhhD................',
        '.......DhhhhhhhD................',
        '.......DhhhhhhhD................',
        '.....DDDYYYYYYYDDD..............',
        '....DhhhhhhhhhhhhhD.............',
        '.....DDDDDDDDDDDDD..............',
        '.....DHsssssssssHD..............',
        '...w.DHxwgxxxwgxHD..............',
        '....wDHxggsssggxHD..............',
        '...w..DssssKssssD......w........',
        '...Dw.DSSSKKKSSSDD...w..........',
        '..DYXDrrrrrrrrrrrrD...w..w......',
        '...DXDrrrrrrrrrrrxxxxw.w........',
        '..DcccccccCCCCcccxYYx...w.XXXXXX',
        '..DcccccccCYYCcccxYYxyyyy.XxxxyY',
        '..DcccccccCCCCcccxYYXYXYXYXXXXyy',
        '..DcccccccCYYCcccxxxXYXYXYXxxxyY',
        '..DcccccppCCCCcccccDXYXYXYXXXXyy',
        '..DcccccppCYYCcccccDXYXYXYXxxxyY',
        '..DYYYccccCCCCcccccD.yyyy.XXXXyy',
        '..DxxxccccCYYCppcccD..w...XXXXXX',
        '..DxxxCCCcCCCCppcccD.w.w........',
        '..DxxxkkkkYYYYkkkkcD....w.......',
        '..DsssCCCcCCCCcccccD............',
        '..DsssccccCCCCcccccD............',
        '...DDDDCCCCCDCCCCCD.............',
        '......DCCCCCDCCCCCD.............',
        '......DCpppCDCCCCCD.............',
        '......DCpppCDCCCCCD.............',
        '......DCCCCCDCCCCCD.............',
        '......DCCCCCDCCCCCD.............',
        '.....DkkkkkkDkkkkkkD............',
        '.....DkkkkkkDkkkkkkD............',
        '.....DyykkkkDkkkkyyD............'],
      weapon: '' } },
    passive: { name: '전투기동', desc: '스킬을 사용하면 6초 안의 다음 기본 공격이 추가 피해를 줍니다. 펀치 모드에서는 방어력이 25% 증가합니다.',
      stat(b, u, k, v) { return u.form === 'punch' && k === 'def' ? v * 1.25 : v; },
      onSkill(b, u, sk) { if (sk.id !== 'sm_ult') u.mem.mvT = b.t + b.sec(6); },
      onBasic(b, u, t) { if ((u.mem.mvT || 0) > b.t) smFx(b, u, t); },
      onHurt(b, u, src, res) { if (u.st.some(s => s.key === 'sm_guard')) u.mem.stored = (u.mem.stored || 0) + (res.dealt || 0); },
      tick(b, u) { u.gauge = { label: u.form === 'punch' ? '펀치 모드' : '건샷 모드', val: (u.mem.mvT || 0) > b.t ? 1 : 0, max: 1, color: u.form === 'punch' ? '#fbbf24' : '#fb923c' }; },
      onForm(b, u, form) {
        if (form === 'punch') { u.role.range = 6; u.role.kite = 0; u.role.backline = false; u.role.front = true; u.glow = '#fbbf24'; }
        else { u.role.range = u.f.stats.range; u.role.kite = 10; u.role.backline = true; u.role.front = false; u.glow = null; }
      } },
    forms: {
      gun: [
        { id: 'sm_g1', name: '섬광포', cost: 35, cd: 7, range: 34, sfx: 'nuke', desc: '[건샷] 전방 멀리 포를 쏘아 직선상의 적 모두에게 피해를 줍니다.', plan: foeIn(34),
          cast(b, u, pl) { const e = lineEnd(b, u, pl.t, 36); beamU(b, u, e.x, e.y, 4, '#fb923c'); b.inLine(b.foes(u), u.x, u.y, e.x, e.y, 3.5).forEach(x => hit(b, u, x, 'phys', b.raw(u, 42, 0.9), '섬광포', { path: true })); } },
        { id: 'sm_g2', name: '스나이핑', cost: 40, cd: 10, range: 44, sfx: 'nuke', desc: '[건샷] 멀리 있는 적을 정밀 저격해 큰 피해를 줍니다. 치명타가 터질 수 있습니다.',
          plan: (b, u, en) => { const t = b.lowest(en.filter(e => b.dist(u, e) <= 44)); return t ? { t } : null; },
          cast(b, u, pl) { const t = pl.t; beamU(b, u, t.x, t.y, 2, '#fde047'); ring(b, t.x, t.y, 3, '#fde047'); hit(b, u, t, 'phys', b.raw(u, 64, 1.25), '스나이핑', { rollCrit: true }); } }
      ],
      punch: [
        { id: 'sm_p1', name: '대쉬펀치', cost: 35, cd: 8, range: 20, move: true, sfx: 'dash', desc: '[펀치] 전방으로 돌진해 경로의 적에게 피해를 주고 경직시킵니다.', plan: foeIn(20),
          cast(b, u, pl) {
            const ox = u.x, oy = u.y, e = dashTo(b, u, pl.t, 20, -3); b.slide(u, e.x, e.y); slash(b, ox, oy, u.x, u.y, 4, '#fbbf24');
            b.inLine(b.foes(u), ox, oy, u.x, u.y, 3.4).forEach(x => { hit(b, u, x, 'phys', b.raw(u, 44, 1.0), '대쉬펀치', { path: true }); b.cc(u, x, 'stagger', 0.8); });
          } },
        { id: 'sm_p2', name: '프로텍트', cost: 30, cd: 11, range: 12, sfx: 'shield', desc: '[펀치] 2.5초간 받는 피해를 50% 줄이며 피해를 비축합니다. 끝나면 비축한 피해만큼 전방 범위를 펀치해 피해를 줍니다.', plan: anyIn(14),
          cast(b, u) {
            u.mem.stored = 0; ring(b, u.x, u.y, 6, '#fbbf24');
            b.buff(u, 'sm_guard', 2.5, { name: '프로텍트', f: { dmgIn: 0.5, onEnd(bb, uu) {
              const st = uu.mem.stored || 0; uu.mem.stored = 0; if (!uu.alive) return;
              const t = bb.nearest(uu, bb.foes(uu).filter(e => bb.dist(uu, e) <= 14)); ring(bb, uu.x, uu.y, 6, '#fbbf24'); if (!t) return;
              cone(bb, uu, t, 13, 0.9, '#fbbf24');
              bb.inCone(bb.foes(uu), uu, t.x, t.y, 13, 0.9).forEach(e => { hit(bb, uu, e, 'phys', bb.raw(uu, 28, 0.6) + st * 1.2, '프로텍트', { splash: true }); });
            } } });
          } }
      ]
    },
    ult: { id: 'sm_ult', name: '모드변환', cd: 6.5, timed: true, range: 60, sfx: 'buff', desc: '전투 모드를 변환합니다. 건샷 모드: 원거리 사격 / 펀치 모드: 근접 돌진·방어력 +25%. 재사용 대기시간이 짧습니다.',
      plan: (b, u, en, al, strict) => {
        const n = b.nearest(u, en); if (!n) return null; const d = b.dist(u, n), to = u.form === 'gun' ? 'punch' : 'gun';
        if (!strict) return { to };
        if (u.form === 'gun') return d < 10 && u.hp > u.maxHp * 0.45 ? { to } : null;
        return d > 22 || (u.hp < u.maxHp * 0.35 && d < 14) ? { to } : null;
      },
      cast(b, u, pl) { b.setForm(u, pl.to); ring(b, u.x, u.y, 8, pl.to === 'punch' ? '#fbbf24' : '#fb923c'); } }
  };

  /* ---------- 44. 이트레인 ---------- */
  const eyePos = (b, u, i) => { const a = b.t * 0.09 + i * 2.094; return { x: u.x + Math.cos(a) * 4, y: u.y + Math.sin(a) * 4 }; };
  const supOn = (b, u) => !!(u.mem.sup && u.mem.sup.until > b.t && u.mem.sup.a.alive);
  const eyesN = (b, u) => (supOn(b, u) ? 1 : 3);
  const eyeShot = (b, u, t, n, from) => {
    if (!t || !t.alive || b.hidden(t)) return;
    for (let i = 0; i < n; i++) { const p = from || eyePos(b, u, i); slash(b, p.x, p.y, t.x, t.y, 1.2, '#22d3ee'); hit(b, u, t, 'magic', b.raw(u, 3, 0.05, 0.1), '공허의 눈', { noPassive: true, splash: true }); }
  };
  FD.itrain = {
    id: 'itrain', name: '이트레인', role: 'hunter', color: '#22d3ee', title: '외계 전투구체',
    concept: '"공허가 부른다..."',
    stats: { hp: 740, mp: 280, aspd: 1.0, spd: 7.5, atk: 48, ap: 40, def: 20, res: 14, ten: 0, pen: 0.08, ls: 0, range: 15, crit: 0.05, critDmg: 1.5 },
    basic: { type: 'magic', atk: 0.5, ap: 0.5, proj: 'bolt' }, ai: { backline: true, kite: 11, threat: 1.0 },
    tac: { act: ['basic', 'retreat'], fight: ['support', 'coop'], pos: ['cover'], aim: ['near', 'carry'] },
    look: { pal: { m: '#475569', M: '#1e293b', p: '#7c3aed', P: '#a78bfa', e: '#22d3ee', E: '#ecfeff', g: '#4ade80' },
      rows: [
        '................',
        '..e..........e..',
        '.eEe...MMMM.eEe.',
        '..e...MMmmMM.e..',
        '.....MmmmmmM....',
        '....MmmPPmmmM...',
        '...MmmPPPPmmmM..',
        '...MmPPeeePmmM..',
        '...MmPeEEEPmmM..',
        '...MmPPeeePmmM..',
        '...MmmPPPPmmmM..',
        '....MmmmmmmmM...',
        '.....MMmmmmMM...',
        '......MMMMMM....',
        '.....g.gg.g.....',
        '......g....g....',
        '................',
        '................'],
      weapon: '' },
    passive: { name: '공허의눈', desc: '주변에 공허의 눈 3개가 떠다니며, 기본 공격과 분광포를 쓸 때 같은 대상에게 함께 발사합니다. 지원으로 아군을 도울 때는 눈이 1개만 남습니다.',
      onBasic(b, u, t) { eyeShot(b, u, t, eyesN(b, u)); },
      tick(b, u) {
        if (b.t % 6 === 0) for (let i = 0; i < eyesN(b, u); i++) { const p = eyePos(b, u, i); slash(b, p.x, p.y, p.x + 0.05, p.y, 1.8, '#22d3ee'); }      // 소리가 나지 않는 'beam' 점으로 눈을 표현 ('aoe' 이벤트는 폭발음이 재생됨)
        if (supOn(b, u) && b.t % 10 === 0) { const a = u.mem.sup.a, t = a.target; if (t && t.alive && !b.hidden(t)) eyeShot(b, u, t, 2, { x: a.x, y: a.y - 3 }); }
        u.gauge = { label: supOn(b, u) ? '지원 중' : '공허의 눈', val: eyesN(b, u), max: 3, color: '#22d3ee' };
      } },
    skills: [
      { id: 'it_s1', name: '분광포', cost: 35, cd: 7, range: 24, sfx: 'nuke', desc: '레이저를 뿜어 직선상의 적에게 피해를 주고 5초간 부식시킵니다(방어력·저항력 20% 감소). 공허의 눈도 함께 발사합니다.', plan: foeIn(24),
        cast(b, u, pl) {
          const e = lineEnd(b, u, pl.t, 26); beamU(b, u, e.x, e.y, 3.5, '#22d3ee');
          b.inLine(b.foes(u), u.x, u.y, e.x, e.y, 3.2).forEach(x => { hit(b, u, x, 'magic', b.raw(u, 34, 0.2, 0.7), '분광포', { path: true }); b.buff(x, 'it_corr', 5, { name: '부식', good: false, src: u, mul: { def: 0.8, res: 0.8 } }); });
          eyeShot(b, u, pl.t, eyesN(b, u));
        } },
      { id: 'it_s2', name: '지원', cost: 30, cd: 12, range: 30, sfx: 'buff', desc: '아군에게 시전하면 6초간 공허의 눈 2개를 보내 그 아군이 공격하는 대상을 자동으로 공격합니다. 자신에게 시전하면 보호막을 생성합니다.',
        plan: (b, u, en, al) => {
          const c = (al || []).filter(a => a !== u && a.alive && b.dist(u, a) <= 30 && a.target && a.target.alive && !(u.mem.sup && u.mem.sup.until > b.t));
          if (c.length) return { a: c[0] };
          return en.some(e => b.dist(u, e) <= 20) ? { a: u } : null;
        },
        cast(b, u, pl) {
          const a = pl.a || u;
          if (a === u) { ring(b, u.x, u.y, 6, '#22d3ee'); b.buff(u, 'it_shield', 5, { name: '공허 보호막', f: { shield: b.raw(u, 55, 0, 0.7) } }); return; }
          u.mem.sup = { a, until: b.t + b.sec(6) }; ring(b, a.x, a.y, 6, '#22d3ee'); b.buff(a, 'it_eye', 6, { name: '공허의 눈 지원', src: u });
        } }
    ],
    ult: { id: 'it_ult', name: '알파머신건모드', cd: 38, range: 22, sfx: 'buff', desc: '4.5초간 이동할 수 없게 되는 대신 공격속도가 2.6배로 증가합니다.', plan: anyIn(22),
      cast(b, u) { ring(b, u.x, u.y, 8, '#22d3ee'); b.buff(u, 'it_gun', 4.5, { name: '알파머신건', mul: { aspd: 2.6 }, f: { root: true, onEnd(bb, uu) { uu.glow = null; } } }); u.glow = '#22d3ee'; } }
  };

  /* ---------- 45. 그레인져 (화살 자원 AI 포함) ---------- */
  const AR_MAX = 5, AR_REGEN = 1.4, EMP_COST = 3;
  const arN = u => (u.mem.ar === undefined ? AR_MAX : u.mem.ar);
  FD.grainger = {
    id: 'grainger', name: '그레인져', role: 'hunter', color: '#a855f7', title: '어둠에 잠식된 궁수',
    concept: '"모든것을 끝내고 돌아갈게..."',
    stats: { hp: 730, mp: 230, aspd: 1.05, spd: 8.2, atk: 60, ap: 0, def: 15, res: 15, ten: 0, pen: 0.15, ls: 0.06, range: 19, crit: 0.12, critDmg: 1.6 },
    basic: rangedBasic, ai: { backline: true, kite: 12, threat: 1.05 },
    tac: { act: ['basic', 'retreat'], fight: ['coop', 'solo'], pos: ['cover'], aim: ['carry', 'weak'] },
    look: { pal: { h: '#1f1b2e', H: '#3b2a5a', s: '#cbd5e1', e: '#a855f7', b: '#4c1d95', B: '#7c3aed', t: '#e9d5ff', k: '#0a0612', c: '#2e1065', C: '#4c1d95' },
      rows: [
        '.....hhhhh......',
        '....hhHHHhh.....',
        '...hhHHHHHhh....',
        '...hHssssssh....',
        '...hHsessesHh.bB',
        '...hHssssssHh.bt',
        '....hcccccch.Bt.',
        '...hhcccCcchhBt.',
        '.shcccccccccc.sB',
        '.shccccCCcccc.sB',
        '..hcccCCCCccc.Bt',
        '..hhcccccccch.Bt',
        '...hccccccch..bB',
        '....cccccccc....',
        '....ccc..ccc....',
        '....CCC..CCC....',
        '...kkkk..kkkk...',
        '...kkkk..kkkk...'],
      weapon: '' },
    passive: { name: '어둠의화살', desc: '기본 공격은 화살을 1개 소모합니다(최대 5개, 1.4초마다 1개 충전). 화살이 없으면 기본 공격을 할 수 없습니다. AI는 흑.영이 준비되어 있으면 화살을 3개까지 모은 뒤 스킬을 사용합니다.',
      init(b, u) { u.mem.ar = AR_MAX; u.mem.arT = 0; },
      onBasic(b, u) {
        if (u.mem.emp) {                                                  // 흑.영 강화 기본 공격: 화살 3개 소모, 관통 + 추가 피해
          u.mem.emp = false; u.mem.ar = Math.max(0, arN(u) - (EMP_COST - 1)); u.st = u.st.filter(s => s.key !== 'gr_emp'); u.role.range = u.f.stats.range;
          const t = u.target; if (!t || !t.alive) return; const d = b.dir(u, t), ex = u.x + d.x * (u.f.stats.range + 12), ey = u.y + d.y * (u.f.stats.range + 12);
          slash(b, u.x, u.y, ex, ey, 3.5, '#a855f7');
          b.inLine(b.foes(u), u.x, u.y, ex, ey, 2.6).forEach(x => hit(b, u, x, 'phys', b.raw(u, 28, 0.7), '흑.영', { path: true, pierce: true, noPassive: true }));
        }
        u.mem.ar = Math.max(0, arN(u) - 1);
      },
      tick(b, u) {
        const m = u.mem; if (m.ar === undefined) m.ar = AR_MAX;
        if (m.ar < AR_MAX && ++m.arT >= b.sec(AR_REGEN)) { m.arT = 0; m.ar++; }
        if (m.emp && !u.st.some(s => s.key === 'gr_emp')) { m.emp = false; u.role.range = u.f.stats.range; }
        const skillReady = !m.emp && (u.cds.gr_s1 || 0) <= 0 && u.mp >= 40;
        // 자원 AI: 화살이 없거나, 흑.영이 준비됐는데 화살이 3개 미만이면 기본 공격을 아끼고 모읍니다 (화살이 가득 차 낭비될 때는 쏨)
        const hold = m.ar <= 0 || (skillReady && m.ar < EMP_COST && !u.st.some(s => s.key === 'gr_burst'));
        if (hold) b.buff(u, 'gr_hold', 0.15, { name: '조준', f: { disarm: true }, quiet: true });
        u.gauge = { label: m.emp ? '흑.영 준비' : '화살', val: m.ar, max: AR_MAX, color: m.emp ? '#e9d5ff' : '#a855f7' }; u.glow = m.emp ? '#a855f7' : null;
      } },
    skills: [
      { id: 'gr_s1', name: '흑.영', cost: 40, cd: 8, range: 17, sfx: 'buff', desc: '다음 기본 공격을 강화합니다. 강화된 기본 공격은 화살을 3개 소모하며 사거리가 늘고, 적들을 관통하고, 방어효과(보호막·피해감소)를 무시하며 추가 피해를 줍니다. 화살이 3개 이상 필요합니다.',
        avail: (b, u) => arN(u) >= EMP_COST, plan: foeIn(18),
        cast(b, u) { u.mem.emp = true; u.role.range = u.f.stats.range + 6; ring(b, u.x, u.y, 5, '#a855f7'); b.buff(u, 'gr_emp', 8, { name: '흑.영', f: { pierce: true } }); } },
      { id: 'gr_s2', name: '어둠발산', cost: 35, cd: 9, range: 16, sfx: 'aoe', desc: '자신 주변으로 어둠의 화살 10발을 생성해 사방으로 발사합니다. 화살은 소모하지 않습니다.', plan: foeIn(18),
        cast(b, u) {
          ring(b, u.x, u.y, 4, '#a855f7');
          for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 + 0.2, e = b.clampPos(u.x + Math.cos(a) * 19, u.y + Math.sin(a) * 19); slash(b, u.x, u.y, e.x, e.y, 1.8, '#a855f7'); b.inLine(b.foes(u), u.x, u.y, e.x, e.y, 2.0).forEach(x => hit(b, u, x, 'phys', b.raw(u, 10, 0.4), '어둠발산', { path: true })); }
        } }
    ],
    ult: { id: 'gr_ult', name: '암흑찢기', cd: 36, range: 24, sfx: 'nuke', desc: '화살을 순간적으로 5개 모두 충전한 뒤 연속으로 빠르게 난사합니다. 모든 화살이 치명타로 적용됩니다.',
      plan: (b, u, en, al, strict) => { const t = b.nearest(u, en.filter(e => b.dist(u, e) <= 24)); if (!t) return null; return !strict || arN(u) <= 2 || t.hp < t.maxHp * 0.5 ? { t } : null; },
      cast(b, u, pl) {
        u.mem.ar = AR_MAX; lock(b, u, 0.8); b.buff(u, 'gr_burst', 1.2, { name: '암흑찢기', quiet: true }); u.glow = '#a855f7';
        for (let i = 0; i < 5; i++) b.later(i * 0.14, bb => {
          if (!u.alive || bb.stunned(u)) return; let t = pl.t.alive && !bb.hidden(pl.t) ? pl.t : bb.nearest(u, bb.foes(u).filter(e => bb.dist(u, e) <= 26)); if (!t) return;
          slash(bb, u.x, u.y, t.x, t.y, 2.2, '#e9d5ff'); ring(bb, t.x, t.y, 2.5, '#a855f7');
          bb.deal(u, t, { type: 'phys', raw: bb.raw(u, 14, 1.05) * bb.eff(u, 'critDmg'), via: '암흑찢기', skill: true, crit: true, proj: 'bolt', pierce: u.st.some(s => s.pierce) });
          u.mem.ar = Math.max(0, arN(u) - 1);
        });
        b.later(0.8, () => { u.glow = null; });
      } }
  };

  const air = (b, u, e, sec) => {
    if (!e.alive || e.st.some(s => s.ccImmune || s.invuln)) return;
    const d = sec * (1 - Math.min(0.85, b.eff(e, 'ten'))); if (d < 0.08) return;
    b.buff(e, 'airborne', d, { name: '에어본', good: false, f: { stun: true, cc: true }, src: u });
  };
  const amStk = t => { const s = t.st.find(x => x.key === 'antimatter'); return s ? (s.stk || 0) : 0; };
  const hardCC = u => u.st.some(s => s.stun || s.knock || s.stagger || s.fear || s.key === 'freeze');

  FD.angel = {
    id: 'angel', name: '엔젤', role: 'mage', color: '#fde68a', title: '천계의 여신',
    concept: '\"길을 잃은 자여, 빛 아래로 오라\"',
    stats: { hp: 680, mp: 340, aspd: 0.85, spd: 8.0, atk: 28, ap: 72, def: 10, res: 8, ten: 0.05, pen: 0.05, ls: 0, range: 22 },
    basic: { type: 'magic', atk: 0.3, ap: 0.7, proj: 'bolt' }, ai: { backline: true, kite: 12, threat: 0.7 },
    tac: { act: ['basic', 'retreat'], fight: ['support', 'coop'], pos: ['cover', 'none'], aim: ['carry', 'near'] },
    look: { res: 2, pal: { w: '#f8fafc', W: '#cbd5e1', v: '#94a3b8', l: '#fef9c3', y: '#fde047', Y: '#f59e0b', h: '#fde68a', H: '#eab308', s: '#fde5cf', S: '#f1c4a0', e: '#3b82f6', k: '#92400e', p: '#fda4af', m: '#e11d48', d: '#fff7ed', D: '#e2d6c4', c: '#38bdf8', C: '#0284c7', g: '#fbbf24', G: '#b45309' },
  rows: [
    '..........yyyyyyyyyyyy..........',
    '.....l..yy............yy..l.....',
    '..........YYYYYYYYYYYY..........',
    '............hhhhhhhh............',
    '........l.hhhhhhhhhhhh.l........',
    '..l......hhhhhhhhhhhhhh......l..',
    '.lll....hhhhhhhhhhhhhhhh....lll.',
    '.wlll..hhhhhhHhhhhHhhhhhh..lllw.',
    'wwwwlw.hhhhhhhsssshhhhhhh.wlwwww',
    'wWwwlwwhhhhskksssskkshhhhwwlwwWw',
    'wlWwwlhhhhsseesssseesshhhhlwwWlw',
    'wwlWwwhhhhspsssssssspshhhhwwWlww',
    'wwwlWwhhhhsssssmmssssshhhhwWlwww',
    'WwwwwWhhhhhSssssssssShhhhhWwwwwW',
    'lWWwwwhHhhhHSSssssSSHhhhHhwwwWWl',
    'wwlWlwhHhhHHHSSssSSHHHhhHhwlWlww',
    'wwwwWWlWlddddSSSSSSddddlWlWWwwww',
    'wwlwwwWWddggddddddddggddWWwwwwww',
    'WWWwwwwddddggddddddggddddwwwwWWW',
    '.wwWWWdddddggddddddggdddddWWWww.',
    '.wwwwwDdddddggddddggdddddDwwwlw.',
    '.wwwwdDdDdddggddddggdddDdDdwwww.',
    '.wwWWdDdDddDdDgddgDdDddDdDdWWww.',
    '..WwwdDdDddDdDgddgDdDddDdDdwwW..',
    '..wwdDdDdddggggggggggdddDdDdww..',
    '..wwdDdDdddgggCccCgggdddDdDdww..',
    '...wWDgwdddDdDCllCDdDdddwgDWw...',
    '...WwsssddDdDdCccCdDdDddssswW...',
    '....sssssdDdDdCCCCdDdDdsssss....',
    '.....SssddDdDddddddDdDddssS.....',
    '......WdggggggggggggggggdW......',
    '.......wGGGGGGGGGGGGGGGGw.......',
    '...........ssss..ssss...........',
    '...........ssss..ssss...........',
    '...........gyyggggyyg...........',
    '...........gggggggggg...........'],
  weapon: '' },
    passive: { name: '은총', desc: '엔젤 근처(18)의 아군이 받는 회복량과 보호막 수치가 15% 증가합니다.', healAura: { r: 18, mul: 1.15 } },
    skills: [
      { id: 'an_s1', name: '치유의바람', cost: 40, cd: 8, range: 16, sfx: 'buff', desc: '주변으로 빛을 펼쳐 범위 안의 아군(자신 포함)을 회복시킵니다.',
        plan: (b, u, en, al) => (al.some(a => b.dist(u, a) <= 16 && a.hp < a.maxHp * 0.85) ? {} : null),
        cast(b, u) { ring(b, u.x, u.y, 16, '#fde68a'); b.inCircle(b.friends(u), u.x, u.y, 16).forEach(a => b.heal(u, a, b.raw(u, 45, 0, 0.75), '치유의바람')); } },
      { id: 'an_s2', name: '구원자', cost: 45, cd: 10, range: 28, move: true, sfx: 'shield', desc: '아군 쪽으로 이동해 자신과 주변 아군에게 보호막을 부여합니다.',
        plan: (b, u, en, al) => { const a = b.lowest(al.filter(x => x !== u && x.alive && b.dist(u, x) <= 28 && b.dist(u, x) > 4)); return a ? { a } : null; },
        cast(b, u, pl) {
          const a = pl.a; if (!a.alive) return;
          const e = dashTo(b, u, a, 28, 3); b.slide(u, e.x, e.y); ring(b, a.x, a.y, 9, '#fde68a');
          b.inCircle(b.friends(u), a.x, a.y, 9).forEach(x => b.shield(u, x, b.raw(u, 55, 0, 0.6), 3.5, '구원자'));
          b.shield(u, u, b.raw(u, 55, 0, 0.6), 3.5, '구원자');
        } }
    ],
    ult: { id: 'an_ult', name: '성역', cd: 40, range: 24, sfx: 'shield', desc: '자신 주변에 넓은 성역을 펼쳐 범위 안의 모든 아군에게 보호막을 부여합니다.',
      plan: (b, u, en, al, strict) => {
        const n = al.filter(a => b.dist(u, a) <= 24); if (!n.length) return null;
        if (strict && !(n.length >= 2 && en.some(e => b.dist(u, e) <= 34)) && !n.some(a => a.hp < a.maxHp * 0.5)) return null;
        return {};
      },
      cast(b, u) {
        ring(b, u.x, u.y, 24, '#fef9c3'); ring(b, u.x, u.y, 14, '#fde68a');
        b.inCircle(b.friends(u), u.x, u.y, 24).forEach(a => b.shield(u, a, b.raw(u, 130, 0, 1.0), 5, '성역'));
      } }
  };

  FD.oba = {
    id: 'oba', name: '오바', role: 'warrior', color: '#f97316', title: '무적무패의 프로레슬러',
    concept: '\"내 앞에서 무릎 꿇어라!\"',
    stats: { hp: 1000, mp: 220, aspd: 0.9, spd: 7.8, atk: 65, ap: 0, def: 34, res: 24, ten: 0.12, pen: 0.05, ls: 0.36, range: 6 },
    basic: meleeBasic, ai: { front: true, threat: 1.0 },
    tac: { act: ['rush', 'basic'], fight: ['solo', 'coop'], aim: ['near', 'weak'] },
    look: { res: 2, pal: { h: '#111827', s: '#6b4423', a: '#8a5a33', S: '#3f2614', e: '#f8fafc', k: '#0b0f19', o: '#f97316', O: '#fde047', g: '#fbbf24', G: '#b45309', t: '#ea580c', T: '#9a3412', r: '#dc2626', b: '#1f2937', B: '#4b5563', m: '#7f1d1d' },
  rows: [
    '...........hhhhhhhhhh...........',
    '..........hhhhhhhhhhhh..........',
    '.........hhhhhhhhhhhhhh.........',
    '.........hhsssssssssshh.........',
    '.........sskkkksskkkkss.........',
    '.........sskeeksskeekss.........',
    '.........ssssssssssssss.........',
    '.........sssssSSSSsssss.........',
    '.........ssssSssssSssss.........',
    '.........sssshhhhhhssss.........',
    '.........sssssmmmmsssss.........',
    '..........ssshhhhhhsss..........',
    '..........sssssSSsssss..........',
    '......sssssssssSSsssssssss......',
    '....saaasssssss..sssssssaaas....',
    '...saaaassaaaaaSSaaaaassaaaas...',
    '...saaaasaaaaaaSSaaaaaasaaaas...',
    '...ssssasaaaaaaSSaaaaaasassss...',
    '...aaaassaaaaaaSSaaaaaassaaaa...',
    '..saaaassSSSSSSSSSSSSSSssaaaas..',
    '..saaaassSSSSSSSSSSSSSSssaaaas..',
    '..saaaassSsaaaaSSaaaasSssaaaas..',
    '..sssssssSsssssSSsssssSsssssss..',
    '..sssssssSsaaaaSSaaaasSsssssss..',
    '..sssssSsSsssssSSsssssSsSsssss..',
    '..sSsas.sSsaggggggggasSs.sasSs..',
    '..sSsss.ggggOrrrrrrOgggg.sssSs..',
    '..sSsss.ggggOrrrrrrOgggg.sssSs..',
    '..OOOOO.GGGGOrrrrrrOGGGG.OOOOO..',
    '..ggggg.oooooooTTooooooo.ggggg..',
    '..GGGGG.OttTtttTTtttTttO.GGGGG..',
    '..sssss.OttTtttTTtttTttO.sssss..',
    '..SsssS..OOOOOO..OOOOOO..SsssS..',
    '.........TTTTTT..TTTTTT.........',
    '.........oBBBBo..oBBBBo.........',
    '.........kkkkkk..kkkkkk.........'],
  weapon: '' },
    passive: { name: '오바에너지', desc: '아군이 지고 있을수록, 자신의 체력이 낮을수록, 주변에 아군이 없을수록 공격력·방어력·저항력·이동속도가 상승합니다. (최대 +50%)',
      stat(b, u, k, v) {
        if (k !== 'atk' && k !== 'def' && k !== 'res' && k !== 'spd') return v;
        const sc = b.score || [0, 0], behind = Math.max(0, Math.min(1, (sc[1 - u.team] - sc[u.team]) / 30));
        const lost = 1 - u.hp / u.maxHp, alone = b.units.some(a => a !== u && a.team === u.team && a.alive && !a.struct && Math.hypot(a.x - u.x, a.y - u.y) <= 25) ? 0 : 1;
        const bonus = 0.15 * behind + 0.2 * lost + 0.15 * alone;
        return k === 'spd' ? v * (1 + bonus * 0.4) : v * (1 + bonus);
      } },
    skills: [
      { id: 'ob_s1', name: '라이징어퍼컷', cost: 35, cd: 8, range: 16, move: true, sfx: 'dash', desc: '달려가면서 어퍼컷을 날려 적중한 적에게 피해를 주고 공중으로 띄웁니다(에어본).', plan: foeIn(16),
        cast(b, u, pl) {
          const ox = u.x, oy = u.y, e = dashTo(b, u, pl.t, 16, -2); b.slide(u, e.x, e.y); slash(b, ox, oy, u.x, u.y, 4, '#f97316');
          b.inLine(b.foes(u), ox, oy, u.x, u.y, 3.5).forEach(x => { hit(b, u, x, 'phys', b.raw(u, 38, 1.2), '라이징어퍼컷', { path: true }); air(b, u, x, 1.0); });
        } },
      { id: 'ob_s2', name: '피자토스', cost: 45, cd: 11, range: 10, sfx: 'nuke', desc: '전방의 단일 적을 제압해 멀리 날려버립니다. 적이 날아간 후 땅에 떨어지면 피해를 줍니다.', plan: foeIn(10),
        cast(b, u, pl) {
          const t = pl.t; lock(b, u, 0.3); ring(b, t.x, t.y, 5, '#f97316');
          b.knock(u, t, 36, u);
          b.later(0.45, bb => { if (!t.alive) return; ring(bb, t.x, t.y, 6, '#f97316'); hit(bb, u, t, 'phys', bb.raw(u, 100, 1.2), '피자토스'); bb.cc(u, t, 'stagger', 0.5); });
        } }
    ],
    ult: { id: 'ob_ult', name: '폴프롬그레이스', cd: 38, range: 12, sfx: 'nuke', desc: '전방의 단일 적을 제압해 높이 들어 올린 뒤 땅에 내리꽂아 큰 피해를 줍니다.', plan: foeIn(12),
      cast(b, u, pl) {
        const t = pl.t; lock(b, u, 0.9); ring(b, t.x, t.y, 5, '#fde047'); air(b, u, t, 1.0);
        b.later(0.85, bb => {
          if (!u.alive || bb.stunned(u)) return; const tg = t.alive ? t : null; if (!tg) return;
          ring(bb, tg.x, tg.y, 9, '#ef4444'); hit(bb, u, tg, 'phys', bb.raw(u, 170, 1.7), '폴프롬그레이스'); bb.cc(u, tg, 'stun', 1.0);
        });
      } }
  };

  FD.stardust = {
    id: 'stardust', name: '스타더스트', role: 'assassin', color: '#a78bfa', title: '별의 기운으로 적을 녹이는 어둠의 형체',
    concept: '\"별은 빛나기 위해 죽는다\"',
    stats: { hp: 800, mp: 260, aspd: 1.0, spd: 9.2, atk: 30, ap: 64, def: 24, res: 24, ten: 0, pen: 0.12, ls: 0.28, range: 6 },
    basic: { type: 'magic', atk: 0.5, ap: 0.6, proj: 'melee' }, ai: { threat: 0.95 },
    tac: { act: ['rush', 'basic'], fight: ['solo', 'coop'], aim: ['weak', 'back'] },
    look: { res: 2, pal: { n: '#120b3a', N: '#2a1f6e', u: '#3f2f9c', U: '#5b46c9', v: '#7c3aed', p: '#c084fc', m: '#f0abfc', w: '#ffffff', y: '#fde047', c: '#67e8f9', C: '#0891b2', V: '#4c1d95' },
  rows: [
    '......c.........................',
    '...........v..v..v..v....w......',
    '........v..vvvp..pvvv..v........',
    '.w......vv.vvvp..pvvv.vv........',
    '.........vvpvpp..ppvpvv.........',
    '.........vvNNNNNNNNNNvv.......y.',
    '......vvvvvNnnnnnnnnNvvvvv......',
    '.......vvvpcwwcnncwwcpvvv.......',
    '........vppCwwCnnCwwCppv........',
    '.........vpNnnnnnnnnNpv.........',
    '....v.....vNcwnnnnwcNv.....v....',
    '....vv.....NnnVVVVnnN.....vv....',
    '.....vv....NNNNNNNNNN....vv.....',
    '..vvppvvUUUUUUUNNUUUUyUUvvppvv..',
    '....pwvvUUUUUUU..UUUUUUUvvwp....',
    '.....vvvUUUUUUUccUUUUUUUvvv.....',
    '....vvv.UUUUwUUccUUUUUUU.vvv....',
    '...vNuuuuyuuuuyppyuuuuyuuuuNv...',
    'y...NUuuNNppuppccppuppNNuuUN....',
    '....NUuuNNuuyuuccuuyuuNNuuUN....',
    '....NUuuNNupuuuccuuupuNNuuUN....',
    '....NpuuNNupuuuccuuwpuNNuupN....',
    '....NwuuNNyuuuwccuuuuyNNuuUN...c',
    '....NUuuNNuppuuccuuppuNNuuUN....',
    '....NUuuNNNNNyNccNyNNNNNuuUN....',
    '....vvvvNNNNNNNyyNNNNNNNvvvv....',
    '....vvvvppppppywwyppppppvvvv....',
    '....ccc.VNcuuuNyyNuuuuNV.ccc....',
    '...cwwcc.NUUUUNyyNUUUUN.ccwwc...',
    '...cwwwc.NuuuuN..NuuuuN.cwwwc...',
    '.w.ccwcc.NuuuuN..NuuyuN.ccwcc...',
    '....ccc..wuuuuN..NuuuuN..ccc....',
    '.........NNNNNN..NNNNNN.........',
    '.........yVVVVN..NVVVVy.......y.',
    '.......p..p..c....c..p..c.......',
    '...........yp.w..w.py...........'],
  weapon: '' },
    passive: { name: '반물질', desc: '스타더스트에게 피해를 입은 적에게 반물질 스택(최대 8, 8초)이 쌓입니다. 스택 하나당 방어력과 저항력이 4% 감소합니다.',
      onDealt(b, u, t, res, o) {
        if (!(res.dealt > 0) || t.struct) return;
        const m = (u.mem.am = u.mem.am || {}); if (m[t.id] > b.t) return; m[t.id] = b.t + b.sec(0.4);
        const n = Math.min(8, amStk(t) + 1), k = 1 - 0.04 * n;
        b.buff(t, 'antimatter', 8, { name: '반물질 ×' + n, good: false, mul: { def: k, res: k }, f: { stk: n }, src: u });
      } },
    skills: [
      { id: 'sd_s1', name: '스타쉽페인', cost: 40, cd: 9, range: 40, move: true, sfx: 'pierce', desc: '전방 아주 긴 거리를 순식간에 돌진하며 지나친 적들에게 피해를 줍니다.', plan: foeIn(40),
        cast(b, u, pl) {
          const ox = u.x, oy = u.y, e = dashTo(b, u, pl.t, 48, -14); b.slide(u, e.x, e.y); slash(b, ox, oy, u.x, u.y, 5, '#a78bfa');
          b.inLine(b.foes(u), ox, oy, u.x, u.y, 3.5).forEach(x => hit(b, u, x, 'magic', b.raw(u, 45, 0.38, 0.94), '스타쉽페인', { path: true }));
        } },
      { id: 'sd_s2', name: '더스트스톰', cost: 40, cd: 10, range: 9, sfx: 'aoe', desc: '잠시 멈춰 회전하며 주변 범위의 적에게 매 틱 피해를 줍니다. 도중에 군중 제어를 받으면 중단됩니다.', plan: foeIn(9),
        cast(b, u) {
          b.buff(u, 'sd_spin', 1.6, { name: '더스트스톰', quiet: true, f: { channel: true } }); ring(b, u.x, u.y, 9, '#a78bfa');
          let stop = false;
          for (let i = 1; i <= 8; i++) b.later(0.2 * i, bb => {
            if (stop || !u.alive) return;
            if (hardCC(u)) { stop = true; u.st = u.st.filter(s => s.key !== 'sd_spin'); return; }
            ring(bb, u.x, u.y, 9, '#c084fc');
            bb.inCircle(bb.foes(u), u.x, u.y, 9).forEach(x => hit(bb, u, x, 'magic', bb.raw(u, 15, 0.19, 0.5), '더스트스톰', { splash: true }));
            if (i === 8) u.st = u.st.filter(s => s.key !== 'sd_spin');
          });
        } }
    ],
    ult: { id: 'sd_ult', stack: { fn: amStk, min: 4 }, name: '중성자폭발', cd: 38, range: 28, sfx: 'nuke', desc: '전방의 둥근 범위를 폭발시켜 피해를 줍니다. 적이 가진 반물질 스택 하나당 추가 피해를 줍니다.', plan: foeIn(28),
      cast(b, u, pl) {
        const d = b.dir(u, pl.t), l = Math.min(b.dist(u, pl.t), 22), c = b.clampPos(u.x + d.x * l, u.y + d.y * l);
        lock(b, u, 0.6); ring(b, c.x, c.y, 11, '#c4b5fd');
        b.later(0.6, bb => {
          if (!u.alive || bb.stunned(u)) return; ring(bb, c.x, c.y, 11, '#a78bfa'); ring(bb, c.x, c.y, 6, '#ffffff');
          bb.inCircle(bb.foes(u), c.x, c.y, 11).forEach(x => { const n = amStk(x); hit(bb, u, x, 'magic', bb.raw(u, 100 + 28 * n, 0.25, 1.12 + 0.15 * n), '중성자폭발', { splash: true }); });
        });
      } }
  };

  const RN_MAX = 8, CC_MAX = 12;
  const rnSync = (b, u) => { u.role.range = u.f.stats.range + (u.mem.rn || 0) * 0.4 + (u.form === 'fallen' ? 1.5 : 0) + (b.has(u, 'rn_blade') ? 1 : 0); };
  const ccPain = (b, u) => {
    const m = u.mem; if (b.t - (m.pT || -99) < b.sec(0.25)) return;
    m.pT = b.t; m.pn = (m.pn || 0) + 1;
    if (m.pn < CC_MAX) return;
    m.pn = 0; ring(b, u.x, u.y, 11, '#f43f5e'); ring(b, u.x, u.y, 6, '#fecdd3');
    b.inCircle(b.foes(u), u.x, u.y, 11).forEach(e => hit(b, u, e, 'magic', b.raw(u, 55, 0.3, 0.5), '고통의환희', { splash: true }));
    b.heal(u, u, 60 + u.maxHp * 0.07, '고통의환희');
  };

  /* ================= 48. 레니게이드 ================= */
  FD.renegade = {
    id: 'renegade', name: '레니게이드', role: 'mage', color: '#a78bfa', title: '마법의 칼을 벼리는 타락천사',
    concept: '\"신이 버린 게 아니다, 내가 버린 것이다\"',
    stats: { hp: 840, mp: 300, aspd: 0.92, spd: 8.2, atk: 24, ap: 66, def: 26, res: 24, ten: 0.06, pen: 0.10, ls: 0.10, range: 6.5 },
    basic: { type: 'magic', atk: 0.3, ap: 0.7, proj: 'melee' }, ai: { threat: 1.0 },
    tac: { act: ['rush', 'basic'], fight: ['solo', 'coop'], aim: ['weak', 'near'] },
    look: { res: 2, pal: { n: '#0c0814', N: '#241a3c', V: '#4c1d95', v: '#a78bfa', h: '#f4d36a', H: '#fff3b0', s: '#f6d9bd', S: '#d9a87c', w: '#f8fafc', W: '#cbd5e1', y: '#fbbf24', Y: '#fff7c2', p: '#8b5cf6', k: '#0b0818', r: '#ef4444', m: '#9a3412' },
      rows: [
        '............yy.yYy.yy...........',
        '..............yhhhy.............',
        '.VV..........hHhhhHh............',
        '.VV.........HhHhHhHhh...........',
        '.VnVV......hhhhhhhhhhh..........',
        '.VVNnV.....hhhhhhhhhhh..........',
        '..VnNVV...hhhhhhhhhhhhh.........',
        '..VnnNNV..hhhhsssshhhh..........',
        '..VnnnNV..hhsSssssSshh..........',
        '..VNNnnNV.h.skrssrkshh..........',
        '.VnnnNNnV.h.SssssssS.h..........',
        'VnnnnnNnnVh.sssmmSss.h..........',
        'VNNNnnnNNNh.sssssssshh....V.....',
        'VnnnNNNNnNV..ssssss.....N.......',
        'VnnnnnYnNyyyyyyyyyyyyyyN.Y......',
        '.VnnnnNwwwwwwwwyywwwwwwww.......',
        '.VnNNNNwwwwwWwwyywwWw.wwwN......',
        '.VNnnnNwwwwwWwwyywwWw.www.......',
        '.VnnnnNwwwwwWwwyywwWw.www.......',
        '.VnnNNnwwwwwWwwyywwWw.www..V....',
        'VnnNnnnwwwwwWwwyywwWw.www.......',
        'VNNnnnNwwwwwWwwyywwWw.www.v.....',
        'VnnnnNNwwwpppppYYpppppwww.vp....',
        '.VnnnVnyyyppppppppppppyyy.vp....',
        '.VVnVVnyyywwwwwyywwwwwyyy.vp....',
        '..VnV.VssswWwwwyywwwWwsss.vp....',
        '...V...ssswWwwwyywwwWwsss.vp....',
        '.......V.wwWwwwyywwwWww...vp....',
        '.........wwWwwwyywwwWwww..v.....',
        '....N....wwWwwwyywwwWwww..V.....',
        '.........wwWwwwyywwwWwww........',
        '........yyyyyyyyyyyyyyyyy.......',
        '...........kkkk..kkkk...........',
        '...........kkkk..kkkk...........'],
      weapon: '' },
    looks: { fallen: { res: 2, pal: { n: '#05030c', N: '#1a1030', V: '#7c3aed', v: '#c084fc', a: '#2e1065', d: '#8a6a1e', D: '#d9b34a', g: '#8b7aa8', u: '#1b1233', r: '#ef4444', R: '#fecaca', k: '#05030c', m: '#7f1d1d' },
      rows: [
        'VV.........rr..r.r.rr.........VV',
        'VNV..........r.dddr...........VV',
        'VnVV.........ddddddd........VVnV',
        'VnNnV.......DddDddDdd......VnNnV',
        'VVnNVV.....ddddddddddd....VVNnV.',
        '.VnnNNV....ddddddddddd...VNNnnV.',
        '.VnnnNV...ddddddddddddd..VNnnnV.',
        '.VnnnnNV..ddddggggdddd..VNnnnnV.',
        '.VNNnnnNV.ddgrggggrgdd.VNnnnNNV.',
        'VVnnNNnnV.darRRggRRgddaVnnNNnnVV',
        'VnnnnnNnnadaggggggrgadaanNnnnnnV',
        'VNNnnnnNaadagrgkkkggadaaannnnNNV',
        'VnnNNNNNaadaggggggggddaaaNNNNnnV',
        'VnnnnnnaaadaaggggggaadaaaannnnnV',
        'VnnnnnnaaVVVVVVVVVVVVVVaaannnnnV',
        'VnnnnNNuuuuuuuuVVuuuuVuuuaNnnnnV',
        'VnNNNnnuuuuuuruVVuuuuauuuanNNNnV',
        'VNnnnnNuuuuuuuuVVuruuauuuannnnNV',
        'VnnnnvauuuuuuruVVuuuuauuuavnnnnV',
        'VnnnnvnuuuuuuuuVVuruuauuuavnnnnV',
        'VnnNNvnuuuuuuruVVuuuuauuuavNNnnV',
        'VnNnnvNuuuuuuuuVVuruuauuuavnnNnV',
        'VNnnnvNuuuNNNNNNNNNNNNuuuavnnnNV',
        'VnnnnvNuuuNNNNNNNNNNNNuuuavnnnnV',
        '.Vnnnvnuuuuuuuuuuuuuuuuuunvnnna.',
        '.VVnVvnggguuuuuuuuuuuugggnvNnVV.',
        '.aVnVvVgrgruuuuuuuuuuugrgVvVVV..',
        '...V.vVggguuuuuuuuuruugggVv.V...',
        '.....RVruuuuuuruuuuuuuuurVR.....',
        '.......Vuuuuuuuuuuuuuuuuu....a..',
        '..a....Vuruuuuuuuuuuuuruu.......',
        '...............VV...............',
        '.....a.....kkkk..kkkk.....a.....',
        '...........kkkk..kkkk...........'],
      weapon: '' } },
    passive: { name: '변절의검', desc: '자신이 적을 처치하거나 처치에 관여할 때마다 공격 속도(+4.5%)와 사거리(+0.4)가 증가합니다. (최대 8중첩, 사망 시 초기화)',
      init(b, u) { u.mem.rn = 0; u.mem.rh = {}; u.mem.ki = b.rec.kills.length; },
      onDealt(b, u, t, res) { if (res.dealt > 0 && !t.struct) (u.mem.rh = u.mem.rh || {})[t.id] = b.t; },
      stat(b, u, k, v) { return k === 'aspd' ? v * (1 + 0.045 * (u.mem ? u.mem.rn || 0 : 0)) : v; },
      onForm(b, u, form) { if (form === 'fallen') { u.scale = 1.3; u.glow = '#7c3aed'; } else { u.scale = 1; u.glow = b.has(u, 'rn_blade') ? '#a78bfa' : null; } },
      tick(b, u) {
        const m = u.mem, ks = b.rec.kills; if (m.ki === undefined || m.ki > ks.length) m.ki = ks.length;
        for (; m.ki < ks.length; m.ki++) {
          const K = ks[m.ki]; if (K.kt !== u.team) continue;
          const h = m.rh && m.rh[K.v];
          if (K.k === u.id || (h && b.t - h <= b.sec(6))) m.rn = Math.min(RN_MAX, (m.rn || 0) + 1);
        }
        rnSync(b, u);
        u.gauge = { label: '변절', val: m.rn || 0, max: RN_MAX, color: '#a78bfa' };
      } },
    skills: [
      { id: 'rn_s1', name: '이단의칼날', cost: 40, cd: 12, range: 10, sfx: 'buff', desc: '6초 동안 마법대검을 소환해 싸웁니다. 기본 공격이 적중할 때마다 추가 고정 피해를 줍니다.', plan: anyIn(10),
        cast(b, u) {
          b.buff(u, 'rn_blade', 6, { name: '마법대검', f: { onEnd(bb, uu) { if (uu.form !== 'fallen') uu.glow = null; } } });
          if (u.form !== 'fallen') u.glow = '#a78bfa'; ring(b, u.x, u.y, 6, '#a78bfa');
          u.bm.push({ until: b.t + b.sec(6), fn(bb, uu, tt) { hit(bb, uu, tt, 'true', bb.raw(uu, 22, 0, 0.3), '이단의칼날', { noLeech: true }); ring(bb, tt.x, tt.y, 3, '#c4b5fd'); } });
        } },
      { id: 'rn_s2', name: '찢어진성약', cost: 50, cd: 11, range: 12, sfx: 'aoe', desc: '양손에 마법검을 소환해 전방을 X자로 그어 피해를 주고 체력을 회복합니다. 두 칼날이 교차하는 지점의 적에게는 치명 피해(×1.7)를 줍니다.', plan: foeIn(12),
        cast(b, u, pl) {
          const d = b.dir(u, pl.t), p = { x: -d.y, y: d.x }, cx = u.x + d.x * 8, cy = u.y + d.y * 8, fs = b.foes(u);
          const a1 = [cx - d.x * 8 - p.x * 8, cy - d.y * 8 - p.y * 8, cx + d.x * 8 + p.x * 8, cy + d.y * 8 + p.y * 8];
          const a2 = [cx - d.x * 8 + p.x * 8, cy - d.y * 8 + p.y * 8, cx + d.x * 8 - p.x * 8, cy + d.y * 8 - p.y * 8];
          slash(b, ...a1, 4, '#a78bfa'); slash(b, ...a2, 4, '#c4b5fd'); ring(b, cx, cy, 5, '#ede9fe');
          const h1 = b.inLine(fs, ...a1, 2.6), h2 = b.inLine(fs, ...a2, 2.6), all = [...new Set([...h1, ...h2])];
          all.forEach(e => { const x = (h1.includes(e) && h2.includes(e)) || Math.hypot(e.x - cx, e.y - cy) <= 4.8; hit(b, u, e, 'magic', b.raw(u, 50, 0, 0.78) * (x ? 1.7 : 1), '찢어진성약', { splash: true, crit: x }); });
          b.heal(u, u, b.raw(u, 28, 0, 0.3) + Math.min(3, all.length) * 14, '찢어진성약');
        } }
    ],
    ult: { id: 'rn_ult', name: '완전타락', cd: 46, range: 14, sfx: 'nuke', desc: '9초 동안 완전한 타락천사로 현현합니다. 시전 즉시 주변 적에게 피해를 주고 공포에 빠뜨리며, 지속 시간 동안 생명력 흡수가 크게 오르고 방어력·저항력·공격 속도가 증가합니다.',
      plan: (b, u, en, al, strict) => {
        const n = en.filter(e => b.dist(u, e) <= 14); if (!n.length) return null;
        if (strict && !(n.length >= 2 || u.hp < u.maxHp * 0.6 || n.some(e => e.hp < e.maxHp * 0.45))) return null;
        return {};
      },
      cast(b, u) {
        b.setForm(u, 'fallen'); ring(b, u.x, u.y, 13, '#7c3aed'); ring(b, u.x, u.y, 7, '#0c0814');
        b.inCircle(b.foes(u), u.x, u.y, 13).forEach(e => { hit(b, u, e, 'magic', b.raw(u, 70, 0, 0.8), '완전타락', { splash: true }); b.cc(u, e, 'fear', 1.6); });
        b.buff(u, 'rn_fall', 9, { name: '완전타락', add: { ls: 0.34 }, mul: { def: 1.12, res: 1.12, aspd: 1.1 }, f: { onEnd(bb, uu) { bb.setForm(uu, 'normal'); } } });
      } }
  };

  /* ================= 49. 카르세르 ================= */
  FD.carcer = {
    id: 'carcer', name: '카르세르', role: 'guardian', color: '#94a3b8', title: '우주감옥의 흉악범',
    concept: '\"고통이야말로 내가 살아있다는 증거지\"',
    stats: { hp: 1160, mp: 220, aspd: 0.75, spd: 7.2, atk: 54, ap: 34, def: 40, res: 36, ten: 0.22, pen: 0.06, ls: 0, range: 7 },
    basic: meleeBasic, ai: { front: true, threat: 1.3 },
    tac: { act: ['basic'], fight: ['coop'], pos: ['front'] },
    look: { res: 2, pal: { s: '#c7a58c', S: '#8f6e5a', w: '#e5e7eb', W: '#9ca3af', n: '#1f2a44', y: '#fbbf24', m: '#94a3b8', M: '#475569', X: '#334155', k: '#0b1020', e: '#f8fafc', R: '#b91c1c' },
      rows: [
        '................s...............',
        '.............sssssss............',
        '............sssssssRs...........',
        '............sssssssRs...........',
        '...........ssSSssSSRRs..........',
        '...........skkkkkkkkRs..........',
        '...........SseksskesSs..........',
        '...........sssssssssss..........',
        '............ssekkesss...........',
        '............sskkkksss...........',
        '............ssssssss............',
        '...........SSSSSsSSSS...........',
        '.....sss...SSSSSSSSSS...sss.....',
        '....sSssswwwnnnnnnnnwwwsssSs....',
        '...ssSsssswwnnnnnnnnwwssssSss...',
        '...sSSssssywwwwnnwwwwyssssSSs...',
        '...ssSsssswnnnwnnwnnnwssssSss...',
        '...ssSsSsswwwwnnnnwwwwssSsSss...',
        '...ssSsssswwwwwyywwwwwssssSss...',
        '....sSsssWwwwwnnnnwwwwWsssSs....',
        '...WWWWWWWWwwwwwwwwwwWWWWWWWW...',
        '...wnnwwwwwwwwywwywwwwwwwwnnw...',
        '...wnnwwwwwnnnnnnnnnnwwwwwnnw...',
        '...wwwwwwwwnnnnyynnnnwwwwwwww...',
        '...mmm..nnnnnnnyynnnnnnn........',
        '...mmm....nnnnnn.nnnnnn.........',
        '....M.....nnnnnn.nnnnnn.........',
        '...m......nnnnnn.nnnnnn.........',
        '...m......mmmmmm.mmmmmm....XWX..',
        '..M.....M.mmmmmm.mmmmmmm..XWXXX.',
        '.m.....m.MMMMMMM.MMMMMM.M.XXXXX.',
        '.M....M...nnnnnn.nnnnnn..mXXXXX.',
        '.........kkkkkkkkkkkkkk....XXX..',
        '.........kkkkkkkkkkkkkk...kkkkk.'],
      weapon: '' },
    passive: { name: '고통의환희', desc: '피해를 받을 때마다 고통이 중첩됩니다. 12중첩이 되면 주변 적에게 피해를 주고 자신의 체력을 회복한 뒤 초기화됩니다.',
      onHurt(b, u, src, res) { if (res.dealt > 0) ccPain(b, u); },
      tick(b, u) {
        const m = u.mem, s = m.soak;
        if (s) b.friends(u).forEach(a => {
          if (a === u || !a.st.some(x => x.key === 'cs_link')) return;
          const cur = a.taken || 0, prev = s.last[a.id]; s.last[a.id] = cur;
          if (prev === undefined || cur <= prev) return;
          const x = (cur - prev) * 0.25; u.hp = Math.max(1, u.hp - x); u.taken = (u.taken || 0) + x; s.total += x; ccPain(b, u);
        });
        u.gauge = s ? { label: '흡수', val: Math.min(300, Math.round(s.total)), max: 300, color: '#38bdf8' } : { label: '고통', val: m.pn || 0, max: CC_MAX, color: '#f43f5e' };
      } },
    skills: [
      { id: 'cs_s1', name: '에너지흡수', cost: 50, cd: 14, range: 14, sfx: 'shield', desc: '4.5초 동안 주변(14) 아군이 받는 피해가 20% 감소하고, 그 일부를 카르세르가 대신 받습니다. 끝나면 대신 받은 피해에 비례한 피해를 주변 적에게 줍니다.',
        plan: (b, u, en, al) => (al.some(a => a !== u && b.dist(u, a) <= 14) && en.some(e => b.dist(u, e) <= 22) ? {} : null),
        cast(b, u) {
          const s = u.mem.soak = { last: {}, total: 0 }; ring(b, u.x, u.y, 14, '#38bdf8');
          b.inCircle(b.friends(u), u.x, u.y, 14).forEach(a => { if (a === u) return; s.last[a.id] = a.taken || 0; b.buff(a, 'cs_link', 4.5, { name: '에너지 연결', f: { dmgIn: 0.8 }, src: u }); });
          b.buff(u, 'cs_main', 4.5, { name: '에너지흡수', f: { onEnd(bb, uu) {
            const t = uu.mem.soak; uu.mem.soak = null; if (!t || !uu.alive) return;
            const dmg = Math.min(420, 40 + t.total * 1.4); ring(bb, uu.x, uu.y, 12, '#38bdf8'); ring(bb, uu.x, uu.y, 6, '#e0f2fe');
            bb.inCircle(bb.foes(uu), uu.x, uu.y, 12).forEach(e => hit(bb, uu, e, 'magic', dmg, '에너지흡수', { splash: true }));
          } } });
        } },
      { id: 'cs_s2', name: '벽부수기', cost: 45, cd: 13, range: 32, move: true, sfx: 'dash', desc: '1초 동안 멈춰 에너지를 모으며(받는 피해 45% 감소) 지정한 위치로 돌진해 경로의 적에게 피해를 주고 기절시킵니다.', plan: foeIn(32, 8),
        cast(b, u, pl) {
          const cx = pl.t.x, cy = pl.t.y; lock(b, u, 1.0);
          b.buff(u, 'cs_brace', 1.0, { name: '에너지 응축', f: { dmgIn: 0.55 } });
          slash(b, u.x, u.y, cx, cy, 4, '#94a3b8'); ring(b, u.x, u.y, 6, '#94a3b8');
          b.later(1.0, bb => {
            if (!u.alive || bb.stunned(u)) return;
            const ox = u.x, oy = u.y, e = dashTo(bb, u, { x: cx, y: cy }, 36, -4); bb.slide(u, e.x, e.y); slash(bb, ox, oy, u.x, u.y, 5, '#cbd5e1');
            bb.inLine(bb.foes(u), ox, oy, u.x, u.y, 3.6).forEach(x => { hit(bb, u, x, 'phys', bb.raw(u, 48, 0.9, 0.3), '벽부수기', { path: true }); bb.cc(u, x, 'stun', 1.3); });
          });
        } }
    ],
    ult: { id: 'cs_ult', name: '끝없는굶주림', cd: 44, range: 24, sfx: 'buff', desc: '7초 동안 최대 체력의 약 52%에 달하는 체력을 지속적으로 회복합니다.',
      plan: (b, u, en) => (u.hp < u.maxHp * 0.65 && en.some(e => b.dist(u, e) <= 24) ? {} : null),
      cast(b, u) {
        b.buff(u, 'cs_hunger', 7, { name: '끝없는 굶주림', f: { regen: 0.075, onEnd(bb, uu) { uu.glow = null; } } });
        u.glow = '#f43f5e'; ring(b, u.x, u.y, 9, '#f43f5e');
      } }
  };

  /* ================= 50. 펙 ================= */
  FD.peg = {
    id: 'peg', name: '펙', role: 'hunter', color: '#f472b6', title: '펩맨의 자칭 사이드킥',
    concept: '\"펩맨 님! 제가 도와드릴게요!\"',
    stats: { hp: 760, mp: 280, aspd: 1.0, spd: 8.4, atk: 46, ap: 38, def: 16, res: 16, ten: 0, pen: 0.08, ls: 0, range: 20, crit: 0.08, critDmg: 1.5 },
    basic: rangedBasic, ai: { backline: true, kite: 11, threat: 0.9 },
    tac: { act: ['basic', 'retreat'], fight: ['coop', 'support'], pos: ['cover'], aim: ['carry', 'near'] },
    look: { res: 2, pal: { h: '#2a1a14', H: '#5b3a2e', s: '#f6d9bd', S: '#e0b896', M: '#dc2626', N: '#7f1d1d', e: '#f8fafc', m: '#e11d48', b: '#0f766e', B: '#14b8a6', w: '#f8fafc', W: '#99f6e4', p: '#f472b6', g: '#64748b', X: '#cbd5e1', y: '#fde047', k: '#111827' },
      rows: [
        '................................',
        '................h...............',
        '............HhHhHhHh............',
        '............hhhhhhhhh...........',
        '.........hhhhhhhhhhhhh..........',
        '.........hhhhhhhhhhhhhh.........',
        '.........hhhhhhhhhhhhhh.........',
        '.........hhMMMMMMMMMMhh.........',
        '........HhMMMeeMMeeMMMhH........',
        '.........hhMNMMMMMMNMhh.........',
        '........hhhhsssssssshhhh........',
        '........HhhhsssmmssshhhH........',
        '........hhhhhsssssshhhhh........',
        '........hh....SSSS...hhh........',
        '.......hHhBBBBBBBBBBBBhH........',
        '.......hbbbBBWBBBBWBBbbbh.......',
        '...XXXXXXbb.bbbppbbb.bbXXXXXX...',
        'Wyyygggggbb..bpbbpb..bbgggggyyyW',
        '...ggggggb...bbppbb..hbgggggg...',
        '.....kbbbb...bbppb...hbbbbk.....',
        '......ssHh..wwwwwwww.hhHss......',
        '......sshh...bbbbbb..hhhss......',
        '.......hhh..bbbbbbb..hhhh.......',
        '.......hHh.wwwwwwwwwwhhHh.......',
        '.......hhhhBbbb..bbbBhhhh.......',
        '.......hh..Bbbb..bbbB..hh.......',
        '...........Bbbb..bbbB...........',
        '...........Bbbb..bbbB...........',
        '...........Bbbb..bbbB...........',
        '...........wwww..wwww...........',
        '...........Bbbb..bbbB...........',
        '...........kkkk..kkkk...........',
        '...........kkkk..kkkk...........',
        '...........kkkk..kkkk...........'],
      weapon: '' },
    passive: { name: '팬심', desc: '근처(22)의 가장 가까운 아군을 자동으로 지정합니다. 지정된 아군과 같은 목표를 공격하면 주는 피해가 15% 증가합니다. 아군이 멀어지거나(30) 쓰러지면 해제되며 8초 뒤 다시 지정합니다.',
      init(b, u) { u.mem.fan = null; u.mem.fanCd = 0; },
      dmgMul(b, u, t) { const f = u.mem.fan; return f && f.alive && f.target === t ? 1.15 : 1; },
      tick(b, u) {
        const m = u.mem; let f = m.fan;
        if (f && (!f.alive || b.dist(u, f) > 30)) { m.fan = f = null; m.fanCd = b.t + b.sec(8); }
        if (!f && b.t >= (m.fanCd || 0)) { const a = b.nearest(u, b.friends(u).filter(x => x !== u && b.dist(u, x) <= 22)); if (a) { m.fan = f = a; } }
        u.gauge = f ? { label: '팬심 ♥ ' + f.f.name, val: 1, max: 1, color: '#f472b6' } : { label: '팬심', val: Math.max(0, 1 - ((m.fanCd || 0) - b.t) / b.sec(8)), max: 1, color: '#64748b' };
      } },
    skills: [
      { id: 'pg_s1', name: '찌릿찌릿', cost: 40, cd: 9, range: 22, sfx: 'pierce', desc: '다용도 석궁에서 볼트를 발사해 적에게 피해를 주고 1.1초 동안 기절시킵니다.', plan: foeIn(22),
        cast(b, u, pl) {
          const t = pl.t; slash(b, u.x, u.y, t.x, t.y, 2.4, '#fde047'); ring(b, t.x, t.y, 4, '#fde047');
          hit(b, u, t, 'phys', b.raw(u, 38, 0.85, 0.25), '찌릿찌릿'); b.cc(u, t, 'stun', 1.1);
        } },
      { id: 'pg_s2', name: '위기탈출', cost: 45, cd: 13, range: 20, move: true, sfx: 'dash', desc: '즉시 체력을 회복하고 지정 위치로 굴러 이동합니다. 도착한 곳 주변(9)의 아군의 체력을 회복시키며, 팬심으로 지정된 아군은 회복량이 더 높습니다.',
        plan: (b, u, en, al) => {
          const n = b.nearest(u, en.filter(e => b.dist(u, e) <= 15)), a = b.lowest(al.filter(x => x !== u && x.alive && b.dist(u, x) <= 26 && x.hp < x.maxHp * 0.7));
          if (!n && !a && u.hp > u.maxHp * 0.8) return null;
          if (a && (!n || u.hp > u.maxHp * 0.45)) { const d = b.dir(u, a), g = Math.min(20, Math.max(0, b.dist(u, a) - 3)); return { x: u.x + d.x * g, y: u.y + d.y * g }; }
          if (n) { const d = b.dir(n, u); return { x: u.x + d.x * 18, y: u.y + d.y * 18 }; }
          return null;
        },
        cast(b, u, pl) {
          b.heal(u, u, b.raw(u, 55, 0, 0.8), '위기탈출'); lock(b, u, 0.3);
          const ox = u.x, oy = u.y, p = b.clampPos(pl.x, pl.y); b.slide(u, p.x, p.y); slash(b, ox, oy, u.x, u.y, 3, '#5eead4'); ring(b, u.x, u.y, 9, '#5eead4');
          const fan = u.mem.fan;
          b.inCircle(b.friends(u), u.x, u.y, 9).forEach(a => { if (a !== u) b.heal(u, a, b.raw(u, 50, 0, 0.7) * (a === fan ? 1.5 : 1), '위기탈출'); });
        } }
    ],
    ult: { id: 'pg_ult', name: '힐팩난사', cd: 40, range: 14, sfx: 'buff', desc: '8초 동안 공격 속도가 45% 증가하고, 기본 공격이 적중할 때마다 주변(12)으로 힐파동이 퍼져 맞은 아군의 체력을 회복합니다. 팬심 대상은 회복량이 더 높습니다.',
      plan: (b, u, en, al, strict) => {
        const n = al.filter(a => a !== u && b.dist(u, a) <= 14); if (!n.length || !en.some(e => b.dist(u, e) <= u.role.range + 8)) return null;
        if (strict && !n.some(a => a.hp < a.maxHp * 0.75)) return null;
        return {};
      },
      cast(b, u) {
        b.buff(u, 'pg_heal', 8, { name: '힐팩난사', mul: { aspd: 1.45 }, f: { onEnd(bb, uu) { uu.glow = null; } } });
        u.glow = '#f472b6'; ring(b, u.x, u.y, 8, '#f472b6');
        u.bm.push({ until: b.t + b.sec(8), always: true, fn(bb, uu) {
          ring(bb, uu.x, uu.y, 12, '#f9a8d4');
          bb.inCircle(bb.friends(uu), uu.x, uu.y, 12).forEach(a => { if (a !== uu) bb.heal(uu, a, bb.raw(uu, 14, 0, 0.3) * (a === uu.mem.fan ? 1.3 : 1), '힐팩난사'); });
        } });
      } }
  };


  const NEW = ['crush', 'viser', 'darkknight', 'shadow', 'redhood', 'reaper', 'press', 'jade', 'dark', 'biomachine', 'frost', 'shining', 'steamman', 'itrain', 'grainger', 'angel', 'oba', 'stardust', 'renegade', 'carcer', 'peg'];
  NEW.forEach(id => { CONFIG.fighterOrder.push(id); const f = FD[id], R = CONFIG.roles[f.role]; f.icon = R.icon; f.roleName = R.name; });
  Object.values(FD).forEach(f => { if (f.stats.crit === undefined) f.stats.crit = 0; if (f.stats.critDmg === undefined) f.stats.critDmg = 1.5; });     // 도감 표시용 기본값
})();
