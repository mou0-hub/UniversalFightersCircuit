/* fighters2.js — 추가 파이터 13명 (마법사 6 · 수호자 7). 구조/수치 조절 방법은 fighters.js 와 동일합니다. */

(() => {
  const FD = CONFIG.fighters;

  const foeIn = (r, min) => (b, u, en) => b.skillPick(u, en, r, min || 0);
  const anyIn = r => (b, u, en) => (en.some(e => b.dist(u, e) <= r) ? {} : null);
  const clusterPick = (b, u, en, range, r) => {
    let best = null, bn = 0;
    for (const e of en) { if (b.dist(u, e) > range) continue; const n = en.filter(x => b.dist(x, e) <= r).length; if (n > bn || (n === bn && best && b.dist(u, e) < b.dist(u, best))) { best = e; bn = n; } }
    return best ? { t: best, n: bn } : null;
  };
  const hit = (b, u, e, type, raw, via, extra) => b.deal(u, e, { type, raw, via, skill: true, ...(extra || {}) });
  const beam = (b, u, x2, y2, w, color) => b.emit({ type: 'beam', x1: u.x, y1: u.y, x2, y2, w, color });
  const lineEnd = (b, u, t, len) => { const d = b.dir(u, t); return b.clampPos(u.x + d.x * len, u.y + d.y * len); };
  const cone = (b, u, t, range, half, color) => { const d = b.dir(u, t); b.emit({ type: 'cone', x: u.x, y: u.y, dir: Math.atan2(d.y, d.x), range, half, color }); };
  const ring = (b, x, y, r, color) => b.emit({ type: 'aoe', x, y, radius: r, color });
  const dashTo = (b, u, t, maxDist, stopGap) => { const d = b.dir(u, t), go = Math.max(0, Math.min(maxDist, b.dist(u, t) - (stopGap || 0))); return b.clampPos(u.x + d.x * go, u.y + d.y * go); };
  const air = (b, u, e, d) => { if (!e.alive || e.st.some(s => s.ccImmune || s.invuln)) return; b.buff(e, 'airborne', d, { name: '에어본', good: false, f: { stun: true }, src: u }); };
  const barrier = (b, u, x, y, r, hp, dur, color) => b.zone({ x, y, r, dur, owner: u, kind: 'barrier', color, hpS: hp });
  const hurtAlly = (b, u, al, r) => b.lowest(al.filter(a => a !== u && a.hp < a.maxHp * 0.6 && b.dist(u, a) <= r));
  const lock = (b, u, sec) => b.buff(u, 'channel', sec, { name: '시전 중', f: { channel: true }, quiet: true });
  const mageBasic = { type: 'magic', atk: 0.5, ap: 0.5, proj: 'bolt' };
  const meleeBasic = { type: 'phys', atk: 1, ap: 0, proj: 'melee' };

  /* ================= 15. 셀리맨더 ================= */
  const marked = (u, t) => t.st.some(s => s.key === 'sal_mark' && s.src === u);
  FD.salamander = {
    id: 'salamander', name: '셀리맨더', role: 'mage', color: '#fb923c', title: '화염정령',
    concept: '"어떻게 불태워줄까?"',
    stats: { hp: 800, mp: 330, aspd: 0.85, spd: 7.6, atk: 28, ap: 82, def: 20, res: 26, ten: 0, pen: 0.14, ls: 0, range: 24 },
    basic: mageBasic, ai: { backline: true, kite: 13, threat: 0.85 },
    tac: { act: ['basic', 'retreat'], fight: ['coop'], pos: ['none', 'cover'], aim: ['carry'] },
    look: { pal: { r: '#ef4444', R: '#991b1b', o: '#fb923c', y: '#fde047', w: '#ffffff', k: '#450a0a' },
      rows: [
        '......y.y.......',
        '....yoyoyoy.....',
        '...yoyRyoyoy....',
        '..oyrryoyyrryo..',
        '.orryoooooyrro..',
        'rRRroooooooorRRr',
        'RrRrrroooorrrRrR',
        '.RrrrrrrrrrrrR..',
        '..RRrrrrrrrrRR..',
        '...rRRRwwRRRr...',
        '....ooooooo.....',
        '...rr.R.R.rr....',
        '..rr..R.R..rr...',
        '..RRRkk.kkRRR...'],
      weapon: '' },
    passive: { name: '화염각인', desc: '스킬이 적에게 화염 표식을 남깁니다(8초). 표식이 있는 적은 셀리맨더에게 받는 피해가 15% 증가합니다.',
      onDealt(b, u, t, res, o) { if (o.skill && t.alive && !o.noPassive) b.buff(t, 'sal_mark', 8, { name: '화염 표식', good: false, src: u, quiet: true }); },
      dmgMul(b, u, t) { return marked(u, t) ? 1.15 : 1; } },
    skills: [
      { id: 'sl_s1', name: '불의 창', cost: 40, cd: 5, range: 30, sfx: 'nuke', desc: '전방으로 관통하는 불을 날려 직선상의 적에게 피해를 줍니다.', plan: foeIn(30),
        cast(b, u, pl) { const e = lineEnd(b, u, pl.t, 32); beam(b, u, e.x, e.y, 3, '#fb923c'); b.inLine(b.foes(u), u.x, u.y, e.x, e.y, 3).forEach(x => hit(b, u, x, 'magic', b.raw(u, 50, 0, 0.95), '불의 창', { path: true })); } },
      { id: 'sl_s2', name: '불의칼', cost: 35, cd: 8, range: 14, sfx: 'buff', desc: '다음 기본 공격의 사거리가 짧아지는 대신 피해가 대폭 강화됩니다. 표식이 있는 적에게는 저항력 일부를 무시합니다(피해 +30%).', plan: anyIn(14),
        cast(b, u) {
          const restore = () => { u.role.range = u.f.stats.range; u.role.kite = 13; };
          u.role.range = 8; u.role.kite = 0;
          b.buff(u, 'fireblade', 6, { name: '불의칼', f: { onEnd: restore } });
          u.bm.push({ until: b.t + b.sec(6), once: true, fn(bb, uu, t) { hit(bb, uu, t, 'magic', bb.raw(uu, 60, 0, 1.1) * (marked(uu, t) ? 1.3 : 1), '불의칼'); ring(bb, t.x, t.y, 5, '#fb923c'); uu.st = uu.st.filter(x => x.key !== 'fireblade'); restore(); } });
        } }
    ],
    ult: { id: 'sl_ult', name: '폭열', cd: 36, range: 45, move: true, sfx: 'dash', desc: '지정 위치로 불이 되어 날아가 피해를 줍니다. 적을 처치하면 한 번 더 사용할 수 있습니다.',
      plan: (b, u, en) => { const t = b.lowest(en.filter(e => b.dist(u, e) <= 45)); return t ? { t } : null; },
      cast(b, u, pl) { return boom(b, u, pl.t, 1); },
      recast: { move: true, plan: (b, u, en) => { const t = b.lowest(en.filter(e => b.dist(u, e) <= 45)); return t ? { t } : null; }, cast(b, u, pl) { boom(b, u, pl.t, 0.9); } } }
  };
  function boom(b, u, t, k) {
    b.blink(u, t.x, t.y + 3); ring(b, t.x, t.y, 9, '#fb923c'); let killed = false;
    b.inCircle(b.foes(u), t.x, t.y, 9).forEach(e => { const r = hit(b, u, e, 'magic', b.raw(u, 90, 0, 1.25) * k, '폭열', { splash: true }); if (r.kill) killed = true; });
    return killed ? { recast: 5 } : {};
  }

  /* ================= 16. 플라즈마 ================= */
  const shockN = (t, b) => ((t.mem.shockT || 0) > b.t ? (t.mem.shock || 0) : 0);
  FD.plasma = {
    id: 'plasma', name: '플라즈마', role: 'mage', color: '#38bdf8', title: '전격정령',
    concept: '"무한한 에너지..."',
    stats: { hp: 730, mp: 320, aspd: 1.0, spd: 7.8, atk: 30, ap: 72, def: 20, res: 28, ten: 0.05, pen: 0.10, ls: 0, range: 22 },
    basic: mageBasic, ai: { backline: true, kite: 11, threat: 0.9 },
    tac: { act: ['basic'], fight: ['coop'], pos: ['none'], aim: ['carry'] },
    look: { res: 2,
      pal: { w: '#ffffff', c: '#67e8f9', C: '#22d3ee', b: '#3b82f6', B: '#1e3a8a', p: '#8b5cf6', P: '#4c1d95', y: '#fde047', e: '#0c4a6e' },
      rows: [
        '......y....y.y.y....y...........',
        '........y...cwy...y.............',
        '.......c..ycwccwy..c............',
        '.........yccywcccy..............',
        '...........cwcwc................',
        '..........cPBBPbc...............',
        '..........cbbcpcc...............',
        '.........cwwBccwww..............',
        '.........ceBcBbPec..............',
        '.........wcbwBbbbc..............',
        '.y........cweeeBw...............',
        '..........cbbbbcc...........y...',
        '...c.cwww..cbbcc.wccc...y....c..',
        '....cbBccwcbBBpcccbbbc...cbbbb.y',
        '...cPpbcBcBcbbBccccbbbc.bCCCCCb.',
        'c.cwbbbcppBbBBBCcBBBBpBbCcccccCb',
        '.wwwbbbccBpBbcBbCCbBbbbbCcwwwcCw',
        '.ccbpBc.cbbbwwcpCBBwbbPbCcwwwcCc',
        '.wccBc..cbbbCcCbCCc.cccbCcwwwcCb',
        '.cbBBc..cbBbbccbBBc....yCcccccCb',
        '.cbbPc...wcBBccBPc......bCCCCCb.',
        '.cpPbw...cbcbcBPBc.......bbbbb.y',
        '..cBbw...cpcbbccBc......c....c..',
        '..cccc...cPbcbcPcw.........y....',
        '..ccwcc..cbbbcBPBc..............',
        '..ccwcc.cbbbBbccbc..............',
        '...ccc.ywbwbbbcPcw...y..........',
        '..y.....wwbBcccpbbc.............',
        '.......cbbBc..cbBBw........y....',
        '......ccbBBc..cbBBbc....c.......',
        '.......wbbbc...cBbPc............',
        '......cCBBc....wBBBBc.y.........',
        '......cCwbw.....cBBBc...........',
        '......cCbbc.....cPbbw...........',
        '......cCbc......wbCCc...........',
        '.....ccccccw.....wcwcccc........'],
      weapon: '' },
    passive: { name: '스턴건', desc: '기본 공격이 감전 표식을 남깁니다(최대 5). 표식이 5개인 적에게 스킬이 적중하면 적이 기절합니다.',
      onBasic(b, u, t) {
        t.mem.shock = Math.min(5, shockN(t, b) + 1); t.mem.shockT = b.t + b.sec(8);
        b.buff(t, 'pl_shock', 8, { name: '감전 ' + t.mem.shock, good: false, src: u, quiet: true });
      },
      onDealt(b, u, t, res, o) { if (o.skill && !o.noPassive && t.alive && shockN(t, b) >= 5) { t.mem.shock = 0; t.st = t.st.filter(x => x.key !== 'pl_shock'); b.cc(u, t, 'stun', 1.3); } } },
    skills: [
      { id: 'pl_s1', stack: { fn: (t, b) => shockN(t, b), min: 5 }, name: '충격파', cost: 40, cd: 6, range: 28, sfx: 'aoe', desc: '전방에 전류를 발사해 피해를 주고 둔화시키며 밀어냅니다.', plan: foeIn(28),
        cast(b, u, pl) { cone(b, u, pl.t, 28, 0.4, '#38bdf8'); b.inCone(b.foes(u), u, pl.t.x, pl.t.y, 28, 0.4).forEach(e => { hit(b, u, e, 'magic', b.raw(u, 38, 0, 0.7), '충격파', { splash: true }); b.cc(u, e, 'slow', 1.6, { amt: 0.35 }); b.knock(u, e, 6); }); } },
      { id: 'pl_s2', stack: { fn: (t, b) => shockN(t, b), min: 5 }, name: '전하의 창', cost: 35, cd: 6, range: 32, sfx: 'pierce', desc: '전방에 창을 만들어 찌릅니다. 기절 상태의 적에게는 치명 피해(×1.7)를 줍니다.', plan: foeIn(32),
        cast(b, u, pl) { const e = lineEnd(b, u, pl.t, 33); beam(b, u, e.x, e.y, 3, '#fde047'); b.inLine(b.foes(u), u.x, u.y, e.x, e.y, 3).forEach(x => { const st = x.st.some(s => s.stun); hit(b, u, x, 'magic', b.raw(u, 50, 0, 0.9) * (st ? 1.7 : 1), '전하의 창', { path: true, crit: st }); }); } }
    ],
    ult: { id: 'pl_ult', name: '재충전', cd: 38, range: 28, sfx: 'buff', desc: '잠시 저지불가 상태가 되어 체력과 마나를 회복하고, 다른 스킬의 쿨타임을 초기화합니다.',
      plan: (b, u, en, al, strict) => (en.some(e => b.dist(u, e) <= 28) && (!strict || u.hp < u.maxHp * 0.6 || u.mp < u.mpMax * 0.25) ? {} : null),
      cast(b, u) {
        u.st = u.st.filter(s => !s.cc && !s.knock); b.buff(u, 'unstop', 3, { name: '저지불가', f: { ccImmune: true } });
        b.heal(u, u, u.maxHp * 0.25, '재충전'); u.mp = u.mpMax; for (const k in u.cds) u.cds[k] = 0; ring(b, u.x, u.y, 8, '#38bdf8');
      } }
  };

  /* ================= 17. 네크로 ================= */
  const corroded = t => t.st.some(s => s.key === 'corrode');
  FD.necro = {
    id: 'necro', name: '네크로', role: 'mage', color: '#84cc16', title: '방사능 악령',
    concept: '"가루도 남지않게 모두 파괴시켜주마"',
    stats: { hp: 700, mp: 340, aspd: 0.8, spd: 7.2, atk: 26, ap: 72, def: 22, res: 30, ten: 0.05, pen: 0.10, ls: 0, range: 26 },
    basic: mageBasic, ai: { backline: true, kite: 14, threat: 0.85 },
    tac: { act: ['basic', 'retreat'], fight: ['coop'], pos: ['cover', 'none'], aim: ['carry'] },
    look: { pal: { k: '#0b1020', d: '#334155', m: '#64748b', M: '#94a3b8', g: '#a3e635', G: '#365314', w: '#f1f5f9', r: '#7f1d1d' },
      rows: [
        'k..............k',
        'kk............kk',
        'kkk..........kkk',
        '.kkk........kkk.',
        '..kddddddddddk..',
        '..kdMddddddMdk..',
        '..kggddddddggk..',
        '..kdGgddddgGdk..',
        '...kddddddddk...',
        '...kdwdwwdwdk...',
        '..mkkdkddkdkkm..',
        'mmddddMddMddddmm',
        'wmdmddMddMddmdmw',
        'w.ddmdmddmdmdd.w',
        '..ddmdMddMdmdd..',
        '..m.dmdmmdmd.m..',
        '.m..mdmddmdm..m.',
        'm....m.mm.m....m'],
      weapon: '' },
    passive: { name: '신비한 힘', desc: '네크로의 스킬에 맞은 적은 부식됩니다(최대 3중첩, 중첩당 방어·저항 7% 감소).',
      onDealt(b, u, t, res, o) {
        if (!o.skill || !t.alive || o.noPassive) return;
        const n = Math.min(3, (corroded(t) ? (t.mem.corN || 0) : 0) + 1); t.mem.corN = n;
        b.buff(t, 'corrode', 6, { name: '부식 ' + n, good: false, mul: { def: 1 - 0.07 * n, res: 1 - 0.07 * n }, src: u, quiet: n > 1 });
      } },
    skills: [
      { id: 'ne_s1', name: '파멸포', cost: 40, cd: 6, range: 30, sfx: 'nuke', desc: '에너지를 발사해 피해를 주고 경직시킵니다. 부식된 적에게는 치명 피해(×1.6)를 줍니다.', plan: foeIn(30),
        cast(b, u, pl) { const t = pl.t, c = corroded(t); beam(b, u, t.x, t.y, 4, '#a3e635'); hit(b, u, t, 'magic', b.raw(u, 50, 0, 0.95) * (c ? 1.6 : 1), '파멸포', { crit: c }); b.cc(u, t, 'stagger', 0.6); } },
      { id: 'ne_s2', name: '라디오액티브', cost: 45, cd: 9, range: 12, sfx: 'aoe', desc: '주변에 방사능을 발사합니다. 부식된 적은 더 큰 피해(×1.4)를 입습니다. 시전하는 순간 받는 공격을 막아냅니다.', plan: anyIn(12),
        cast(b, u) { b.buff(u, 'block', 0.9, { name: '방사능 방벽', f: { block: true } }); ring(b, u.x, u.y, 13, '#a3e635'); b.inCircle(b.foes(u), u.x, u.y, 13).forEach(e => hit(b, u, e, 'magic', b.raw(u, 36, 0, 0.7) * (corroded(e) ? 1.4 : 1), '라디오액티브', { splash: true })); } }
    ],
    ult: { id: 'ne_ult', name: '파멸요격', cd: 38, range: 45, sfx: 'aoe', desc: '잠시 정지한 채 하늘에서 운석을 떨어뜨려 넓은 범위에 큰 피해를 줍니다.', plan: (b, u, en) => clusterPick(b, u, en, 45, 12),
      cast(b, u, pl) {
        lock(b, u, 2.2); const c = { x: pl.t.x, y: pl.t.y };
        [0.3, 0.75, 1.2, 1.65].forEach((s, i) => b.later(s, bb => {
          if (!u.alive) return; const ex = bb.foes(u), tg = ex.length ? ex[i % ex.length] : null, x = tg ? tg.x : c.x, y = tg ? tg.y : c.y;
          bb.zone({ x, y, r: 12, dur: 0.5, owner: u, kind: 'warn', color: '#a3e635' });
          bb.later(0.5, b2 => { ring(b2, x, y, 12, '#a3e635'); b2.emit({ type: 'star', x, y }); b2.inCircle(b2.foes(u), x, y, 12).forEach(e => hit(b2, u, e, 'magic', b2.raw(u, 70, 0, 0.9), '파멸요격', { splash: true })); });
        }));
      } }
  };

  /* ================= 18. 러스엘러스터 ================= */
  FD.rusellaster = {
    id: 'rusellaster', name: '러스엘러스터', role: 'mage', color: '#6d28d9', title: '저주불꽃의 악령',
    concept: '"이유는 없어...저주는 그저 저주일뿐."',
    stats: { hp: 680, mp: 320, aspd: 0.85, spd: 7.4, atk: 28, ap: 46, def: 22, res: 32, ten: 0.08, pen: 0.08, ls: 0.0, range: 22 },
    basic: mageBasic, ai: { backline: true, kite: 11, threat: 0.85 },
    tac: { act: ['basic'], fight: ['solo', 'coop'], pos: ['none'], aim: ['near'] },
    look: { hair: '#c4b5fd', skin: '#a78bfa', body: '#2e1065', acc: '#a855f7', hairStyle: '3,-1,H;5,-2,H;6,-3,H;7,-2,H;8,-1,H', feat: '4,3,Y;7,3,Y;3,-1,A;8,-1,A', weapon: '11,2,A;11,3,A;12,3,A;11,4,K;11,5,K;11,6,K;11,7,K' },
    passive: { name: '죽음불꽃', desc: '같은 대상을 계속 공격하면 피해량이 점차 상승합니다(최대 +48%). 대상이 바뀌면 초기화됩니다.',
      onDealt(b, u, t, res, o) { if (o.noPassive) return; if (u.mem.last !== t) { u.mem.last = t; u.mem.n = 0; } else u.mem.n = Math.min(8, (u.mem.n || 0) + 1); },
      dmgMul(b, u, t) { return u.mem.last === t ? 1 + 0.06 * (u.mem.n || 0) : 1; },
      tick(b, u) { u.gauge = { label: '불꽃', val: u.mem.n || 0, max: 8, color: '#a855f7' }; } },
    skills: [
      { id: 'ru_s1', name: '영혼나누기', cost: 40, cd: 5, range: 28, sfx: 'nuke', desc: '적에게 시전하면 피해를 주고 자신이 회복합니다. 아군에게 시전하면 아군을 치유합니다.',
        plan: (b, u, en, al) => { const t = b.nearest(u, en.filter(e => b.dist(u, e) <= 28)); if (t) return { t }; const a = hurtAlly(b, u, al, 28); return a ? { t: a, ally: true } : null; },
        cast(b, u, pl) {
          if (pl.ally) { beam(b, u, pl.t.x, pl.t.y, 3, '#34d399'); b.heal(u, pl.t, b.raw(u, 50, 0, 1.0), '영혼나누기'); return; }
          beam(b, u, pl.t.x, pl.t.y, 3, '#a855f7'); const r = hit(b, u, pl.t, 'magic', b.raw(u, 45, 0, 0.8), '영혼나누기'); b.heal(u, u, r.dealt * 0.8 + 15, '영혼나누기');
        } },
      { id: 'ru_s2', name: '저주불꽃', cost: 40, cd: 8, range: 28, sfx: 'debuff', desc: '적에게 4초간 지속 피해를 주고 화상을 입힙니다. 이 동안 적이 받는 피해가 15% 상승합니다.', plan: foeIn(28),
        cast(b, u, pl) {
          const t = pl.t; b.cc(u, t, 'burn', 5); b.buff(t, 'curse', 5, { name: '저주불꽃', good: false, f: { dmgIn: 1.15 }, src: u });
          for (let i = 1; i <= 5; i++) b.later(i * 0.8, bb => { if (t.alive && u.alive) hit(bb, u, t, 'magic', bb.raw(u, 12, 0, 0.3), '저주불꽃', { dot: true }); });
        } }
    ],
    ult: { id: 'ru_ult', name: '황천길', cd: 38, range: 24, sfx: 'debuff', desc: '적을 제압(기절)하고 체력을 흡수합니다.', plan: foeIn(24),
      cast(b, u, pl) {
        const t = pl.t; b.cc(u, t, 'stun', 2.6); lock(b, u, 2.4);
        [0.6, 1.2, 1.8, 2.4].forEach(s => b.later(s, bb => { if (!u.alive || !t.alive) return; beam(bb, u, t.x, t.y, 3, '#a855f7'); const r = hit(bb, u, t, 'magic', bb.raw(u, 35, 0, 0.65), '황천길'); bb.heal(u, u, r.dealt, '황천길'); }));
      } }
  };

  /* ================= 19. 아오즈 ================= */
  FD.aozu = {
    id: 'aozu', name: '아오즈', role: 'mage', color: '#34d399', title: '미친 과학자',
    concept: '"미쳤어! 이건 내 걸작이야!"',
    stats: { hp: 960, mp: 260, aspd: 0.95, spd: 8.4, atk: 46, ap: 72, def: 34, res: 26, ten: 0.10, pen: 0.10, ls: 0, range: 6 },
    basic: { type: 'magic', atk: 0.6, ap: 0.5, proj: 'melee' }, ai: { front: true, threat: 1.0 },
    tac: { act: ['rush'], fight: ['solo'], pos: ['front'] },
        look: { res: 2,
      pal: { W: '#e5e7eb', w: '#cbd5e1', T: '#0f766e', s: '#fde5cf', S: '#e0b99a', h: '#f8fafc', H: '#cbd5e1', G: '#34d399', g: '#10b981', C: '#bbf7d0',
            Y: '#d4a85a', R: '#ef4444', x: '#334155', X: '#64748b', k: '#0b0b12', P: '#475569', b: '#1f2937', B: '#374151' },
      rows: [
        '..........hh.h.hhh.h............',
        '..........hHhhHhhHhhHh..........',
        '.........hhhhhhhhhhhhhh.........',
        '........hhhHHHHHHHHHHhhh........',
        '.......h.hhhhhhhhhhhhhh.h.......',
        '.......h.hhsssssssssshhh........',
        '.........hxxxxxxxxxxxxh.........',
        '.........hxCGGGYYCGGGxh.........',
        '..........xGGgGYYGGgGx..........',
        '..........xxxxxxxxxxxx..........',
        '...........SkwkwkwkkS...........',
        '............SSSSSSSS............',
        '......WWWWWWWWssssWWWWWWWW......',
        '......WwwwwwwwwwwwwwwwwwWW......',
        '......wwwwwWWwTYYTwWwwwwwW......',
        '.....wwwwwwWWwTTTTwWwwwwww......',
        '....wwwwwwwWWwTTTTwWwwwwwww.....',
        '...wwwwwwwWWWwTYYTwWWwwwwwww....',
        '...wwwwwwWWWWwTTTTwWWWwwwwww....',
        '...wwwwwWWWWWwTTTTwgggWwwwww....',
        '...wwwwWWWWWWwTYYTwgggWWwwww....',
        '...wwwwWWWwGwwTTTTwgggWWwwww....',
        '...wwswWWWwRwwTTTTwWgWWWwwsw....',
        '...wwwwWWWxxxxYYYYxxxxWWwwww....',
        '.......WWWwwwwTTTTwWWWWWW.......',
        '........WgWWWwTTTTwWWWWW........',
        '........WWgWWwTYYTwWWgWW........',
        '........WWWWWwTTTTwWWWgW........',
        '..........PPPPTTTTPPPP..........',
        '..........wPwPTTTTPwPw..........',
        '..........PPPPTTTTPPPP..........',
        '..........PPPPP..PPPPP..........',
        '..........PPPPP..PPPPP..........',
        '.........bbbbbbbbbbbbbb.........',
        '.........BBBBBBBBBBBBBB.........',
        '.........bbbbbbbbbbbbbb.........'],
      weapon: '0,9,W;2,9,W;4,9,W;23,9,W;25,9,W;27,9,W;0,10,W;2,10,W;4,10,W;23,10,W;25,10,W;27,10,W;0,11,W;2,11,W;4,11,W;23,11,W;25,11,W;27,11,W;-1,12,x;0,12,x;1,12,x;2,12,x;3,12,x;4,12,x;5,12,x;22,12,x;23,12,x;24,12,x;25,12,x;26,12,x;27,12,x;28,12,x;-1,13,x;0,13,Y;1,13,Y;2,13,Y;3,13,Y;4,13,Y;5,13,x;22,13,x;23,13,Y;24,13,Y;25,13,Y;26,13,Y;27,13,Y;28,13,x;-1,14,x;0,14,Y;1,14,Y;2,14,Y;3,14,Y;4,14,Y;5,14,x;22,14,x;23,14,Y;24,14,Y;25,14,Y;26,14,Y;27,14,Y;28,14,x;-1,15,x;0,15,Y;1,15,Y;2,15,Y;3,15,Y;4,15,Y;5,15,x;22,15,x;23,15,Y;24,15,Y;25,15,Y;26,15,Y;27,15,Y;28,15,x;-1,16,x;0,16,Y;1,16,X;2,16,X;3,16,X;4,16,Y;5,16,x;22,16,x;23,16,Y;24,16,X;25,16,X;26,16,X;27,16,Y;28,16,x;-1,17,x;0,17,k;1,17,G;2,17,G;3,17,G;4,17,k;5,17,x;22,17,x;23,17,k;24,17,G;25,17,G;26,17,G;27,17,k;28,17,x;-1,18,x;0,18,k;1,18,g;2,18,g;3,18,g;4,18,k;5,18,x;22,18,x;23,18,k;24,18,g;25,18,g;26,18,g;27,18,k;28,18,x;-1,19,x;0,19,X;1,19,X;2,19,Y;3,19,X;4,19,X;5,19,x;22,19,x;23,19,X;24,19,X;25,19,Y;26,19,X;27,19,X;28,19,x;-1,20,x;0,20,x;1,20,x;2,20,x;3,20,x;4,20,x;5,20,x;22,20,x;23,20,x;24,20,x;25,20,x;26,20,x;27,20,x;28,20,x;0,21,x;1,21,Y;2,21,Y;3,21,Y;4,21,x;23,21,x;24,21,Y;25,21,Y;26,21,Y;27,21,x;0,22,x;1,22,x;2,22,x;3,22,x;4,22,x;23,22,x;24,22,x;25,22,x;26,22,x;27,22,x' },
    passive: { name: '미치광이', desc: '스킬이 적중하면 3초간 이동속도가 상승합니다.',
      onDealt(b, u, t, res, o) { if (o.skill) b.buff(u, 'mad', 3, { name: '미치광이', mul: { spd: 1.25 }, quiet: true }); } },
    skills: [
      { id: 'az_s1', name: '빅볼', cost: 40, cd: 6, range: 28, sfx: 'nuke', desc: '에너지를 모아 발사합니다. 피해를 주고 둔화시킵니다.', plan: foeIn(28),
        cast(b, u, pl) { const e = lineEnd(b, u, pl.t, 30); beam(b, u, e.x, e.y, 4.5, '#34d399'); b.inLine(b.foes(u), u.x, u.y, e.x, e.y, 4).forEach(x => { hit(b, u, x, 'magic', b.raw(u, 50, 0, 0.95), '빅볼', { path: true }); b.cc(u, x, 'slow', 1.8, { amt: 0.35 }); }); } },
      { id: 'az_s2', name: '러프해머', cost: 35, cd: 8, range: 24, move: true, sfx: 'charge', desc: '적에게 돌진하며, 다음 기본 공격에 추가 피해를 주고 기절시킵니다.', plan: foeIn(24, 6),
        cast(b, u, pl) {
          const e = dashTo(b, u, pl.t, 18, 3); b.slide(u, e.x, e.y); b.buff(u, 'roughhammer', 5, { name: '러프해머 준비' });
          u.bm.push({ until: b.t + b.sec(5), once: true, fn(bb, uu, t) { ring(bb, t.x, t.y, 6, '#34d399'); hit(bb, uu, t, 'magic', bb.raw(uu, 45, 0.4, 0.7), '러프해머'); bb.cc(uu, t, 'stun', 1.0); uu.st = uu.st.filter(x => x.key !== 'roughhammer'); } });
        } }
    ],
    ult: { id: 'az_ult', name: '팻보이', cd: 34, range: 24, sfx: 'buff', desc: '잠시 멈춰 미사일을 장전합니다(최대 5발). 장전된 미사일은 기본 공격 때 함께 날아가 피해를 줍니다.', plan: anyIn(24),
      cast(b, u) {
        lock(b, u, 2.0); u.mem.mis = 0;
        [0.4, 0.8, 1.2, 1.6, 2.0].forEach(s => b.later(s, bb => { if (u.alive) u.mem.mis = Math.min(5, (u.mem.mis || 0) + 1); }));
        u.bm.push({ until: b.t + b.sec(32), fn(bb, uu, t) { if (!(uu.mem.mis > 0)) return; uu.mem.mis--; beam(bb, uu, t.x, t.y, 3, '#fde047'); ring(bb, t.x, t.y, 7, '#fde047'); bb.inCircle(bb.foes(uu), t.x, t.y, 7).forEach(e => hit(bb, uu, e, 'magic', bb.raw(uu, 40, 0, 0.7), '팻보이 미사일', { splash: true })); } });
      } },
    gauge: true
  };
  FD.aozu.passive.tick = (b, u) => { u.gauge = u.mem.mis > 0 ? { label: '미사일', val: u.mem.mis, max: 5, color: '#fde047' } : null; };

  /* ================= 20. 하비스트 ================= */
  FD.harvest = {
    id: 'harvest', name: '하비스트', role: 'mage', color: '#7c3aed', title: '저주악령',
    concept: '"가소로운것들."',
    stats: { hp: 800, mp: 320, aspd: 0.9, spd: 7.8, atk: 40, ap: 68, def: 22, res: 28, ten: 0.05, pen: 0.08, ls: 0.05, range: 24 },
    basic: mageBasic, ai: { backline: true, kite: 12, threat: 0.9 }, form0: 'mage',
    tac: { act: ['basic'], fight: ['coop'], pos: ['none'] },
    look: { res: 2, pal: { h: '#2e1065', H: '#6d28d9', s: '#ead7ff', c: '#c4a5e8', e: '#fb7185', r: '#fda4af', k: '#0f0a1f', l: '#be185d', n: '#e879f9', m: '#1f1235', M: '#8b5cf6', b: '#2a0f55', B: '#5b21b6', V: '#a78bfa', y: '#fbbf24', f: '#d8b4fe', o: '#a855f7', O: '#f5d0fe', W: '#ffffff', g: '#f59e0b', t: '#1c0f33', T: '#5b21b6', z: '#3b1a5a', w: '#e5e7eb' },
      rows: [
        '......Mm................mM......',
        '......mmM..............Mmm......',
        '........mm..hhhhhhhh..mm........',
        '.........MmhhHHhhHHhhmM.........',
        '.........hhhhhhhHhhhhhh.........',
        '........hhhhHhhnnhhHhhhh........',
        '........hhhhhhhhhsshhhhh........',
        '........hhhkkkksskkkkhhh........',
        '........hhhserrssrreshfh........',
        '.......hhhhssssccsssshhhhoooo.f.',
        '.......hHhhhsscllcsshhhHooOOoo..',
        '.......hhh.hsssccsssh.hhoWOOOo..',
        '.......hhh....ssss....hfoOOOOoo.',
        '.......hHh...kkyykk...hHoOOoOo..',
        '........hsssssssssssssshooOOoof.',
        '........sssVVVVssVVVVsss.oooo...',
        '........sshVBBbssbBBVhssss......',
        '........ss.bbbbssbbbbBBsss...f..',
        '.......VBBhbbbbbbbbbbhBBss......',
        '.......VBB.bbbbVVbbbb.hH........',
        '.......VBB..cssssssc..hh........',
        '.......VBBh.sssyysss.hhh........',
        '.......VVVV.cssssssc..hh........',
        '........ss.kkkkyykkkk.hh........',
        '........ssbbbbbbVbbbbb..........',
        '.........mbbVbbbbbVbbb..........',
        '........mbbbbbVbbbbbVbb.........',
        '.......m.BBBBBBBBBBBBBB.........',
        '......m..Bbb.B.B.B.B.B..........',
        '.....m....bbsss..sss............',
        '.....m...Bbbggy..ggy............',
        '....m.....fVVVV..VVVV...........',
        '....m......tttt..tttt...........',
        '...MMmM....tTtt..tTtt...........',
        '....MMMM...tTtt..tTtt...........',
        '.....M....tTttk.tTttk...........'],
      weapon: '' },
    looks: { battle: { res: 2, pal: { h: '#4a0d2e', H: '#be123c', s: '#ead7ff', c: '#c4a5e8', e: '#fde047', r: '#fef08a', k: '#0f0a1f', l: '#e11d48', n: '#fb7185', m: '#1f0a14', M: '#e11d48', b: '#3b0a1f', B: '#9f1239', V: '#fb7185', y: '#fbbf24', f: '#fb923c', o: '#ef4444', O: '#f5d0fe', W: '#ffffff', g: '#f59e0b', t: '#1f0a14', T: '#9f1239', z: '#3f1d38', w: '#e5e7eb' },
      rows: [
        '......Mm................mMW.....',
        '......mmM..............MmwWw....',
        '........mm..hhhhhhhh..mm.wWw....',
        '.........MmhhHHhhHHhhmM.wwwww...',
        '.........hhhhhhhHhhhhhh..www....',
        '........hhhhHhhnnhhHhhhh..w.....',
        '........hhhhhhhhhsshhhhho.w.o...',
        '........hhhkkkksskkkkhhh.ozo....',
        '........hhhserrssrreshhh..o.....',
        '.......hhhhssssccsssshhfh.z.....',
        '.......hHhhhsscllcsshhhHh.o..f..',
        '.......hhh.hsssccsssh.hhh.z.....',
        '.......hhh....ssss....hhh.o.....',
        '.......hHh...kkyykk...hHh.z.....',
        '........hssssssssssssssh..z.....',
        '........sssVVVVssVVVVsss..z.....',
        '........sshVBBbssbBBVhssssz.....',
        '........ss.bbbbssbbbbBBssss.....',
        '.......VBBhbbbbbbbbbbhBBsss.....',
        '.......VBB.bbbbVVbbbb.hH..z.....',
        '.......VBB..cssssssc..hh..z.....',
        '.......VBBh.sssyysss.hhh..z.....',
        '.......VVVV.cssssssc..hh..z..f..',
        '........ss.kkkkyykkkk.hh..z.....',
        '........ssbbbbbbVbbbbb....z.....',
        '.........mbbVbbbbbVbbb....z.....',
        '........mbbbbbVbbbbbVbbf..z.....',
        '.......m.BBBBBBBBBBBBBB...z.....',
        '......m..Bbb.B.B.B.B.B....z.....',
        '.....m....bbsss..sss......z.....',
        '.....m...Bbbggy..ggy......z.....',
        '....m.....fVVVV..VVVV.....z.....',
        '....m......tttt..tttt.....z.....',
        '...MMmM....tTtt..tTtt.....z.....',
        '....MMMM...tTtt..tTtt.....z.....',
        '.....M....tTttk.tTttk...........'],
      weapon: '' } },
    passive: { name: '악령강림', desc: '평시에는 원거리 마법태세. 적이 근접하면 창을 든 전투태세로 바뀌어 근접 전투를 하며, 전투태세에서는 생명력 흡수가 22%p 상승합니다.',
      stat(b, u, k, v) { return k === 'ls' && u.form === 'battle' ? v + 0.22 : v; },
      tick(b, u) { const n = b.nearest(u, b.foes(u)); if (!n) return; const d = b.dist(u, n); if (u.form === 'mage' && d < 9) b.setForm(u, 'battle'); else if (u.form === 'battle' && d > 16) b.setForm(u, 'mage'); u.gauge = { label: u.form === 'mage' ? '마법' : '전투', val: 1, max: 1, color: u.form === 'mage' ? '#a855f7' : '#ef4444' }; },
      onForm(b, u, form) { if (form === 'battle') { u.role.range = 7; u.role.kite = 0; u.role.backline = false; u.role.front = true; u.glow = '#ef4444'; } else { u.role.range = 24; u.role.kite = 12; u.role.backline = true; u.role.front = false; u.glow = null; } } },
    forms: {
      mage: [
        { id: 'hv_m1', name: '구속', cost: 40, cd: 6, range: 30, sfx: 'nuke', desc: '[마법태세] 멀리 에너지를 날려 적에게 피해를 주고 속박합니다.', plan: foeIn(30),
          cast(b, u, pl) { const t = pl.t; beam(b, u, t.x, t.y, 3, '#a855f7'); hit(b, u, t, 'magic', b.raw(u, 45, 0, 0.9), '구속'); b.cc(u, t, 'root', 1.5); } },
        { id: 'hv_m2', name: '차가운 공포', cost: 40, cd: 10, range: 16, move: true, sfx: 'dash', desc: '[마법태세] 잠시 사라졌다가 다시 나타납니다. 사라질 때 이동할 수 있습니다.', plan: anyIn(12),
          cast(b, u) { const n = b.nearest(u, b.foes(u)); if (n) { const d = b.dir(n, u); b.blink(u, u.x + d.x * 14, u.y + d.y * 14); } b.buff(u, 'fade', 0.9, { name: '은신', f: { hidden: true, invuln: true, stun: true } }); } }
      ],
      battle: [
        { id: 'hv_b1', name: '구속', cost: 40, cd: 6, range: 12, sfx: 'aoe', desc: '[전투태세] 주변 범위의 적에게 피해를 주고 속박합니다.', plan: anyIn(11),
          cast(b, u) { ring(b, u.x, u.y, 11, '#ef4444'); b.inCircle(b.foes(u), u.x, u.y, 11).forEach(e => { hit(b, u, e, 'magic', b.raw(u, 40, 0.2, 0.75), '구속', { splash: true }); b.cc(u, e, 'root', 1.3); }); } },
        { id: 'hv_b2', name: '차가운 공포', cost: 40, cd: 8, range: 24, move: true, sfx: 'pierce', desc: '[전투태세] 전방으로 돌진해 경로의 적에게 피해를 줍니다.', plan: foeIn(24, 6),
          cast(b, u, pl) { const ox = u.x, oy = u.y, e = dashTo(b, u, pl.t, 20, -2); b.slide(u, e.x, e.y); b.inLine(b.foes(u), ox, oy, u.x, u.y, 4).forEach(x => hit(b, u, x, 'phys', b.raw(u, 40, 0.9, 0.3), '차가운 공포', { path: true })); } }
      ]
    },
    ult: { id: 'hv_ult', name: '무한의 구속', cd: 36, range: 26, sfx: 'debuff', desc: '주변 적들에게 에너지 사슬을 발사합니다. 지속되는 동안 피해를 주며 생명력을 흡수합니다.', plan: anyIn(26),
      cast(b, u) {
        const hs = b.foes(u).filter(e => b.dist(u, e) <= 26); hs.forEach(e => b.cc(u, e, 'slow', 5, { amt: 0.3 }));
        for (let i = 1; i <= 8; i++) b.later(i * 0.6, bb => { if (!u.alive) return; hs.filter(e => e.alive && bb.dist(u, e) <= 34).forEach(e => { beam(bb, u, e.x, e.y, 2, '#a855f7'); const r = hit(bb, u, e, 'magic', bb.raw(u, 15, 0, 0.28), '무한의 구속', { dot: true }); bb.heal(u, u, r.dealt * 0.7, '무한의 구속'); }); });
      } }
  };

  /* ================= 21. 미노타우로스 ================= */
  FD.minotaur = {
    id: 'minotaur', name: '미노타우로스', role: 'guardian', color: '#b45309', title: '봉인된 날뛰는 괴수',
    concept: '"크오오오오오!!!"',
    stats: { hp: 1220, mp: 160, aspd: 0.8, spd: 7.8, atk: 54, ap: 0, def: 42, res: 32, ten: 0.20, pen: 0.06, ls: 0.05, range: 6.5 },
    basic: meleeBasic, ai: { front: true, threat: 1.6 },
    tac: { act: ['rush', 'basic'], fight: ['solo', 'coop'], pos: ['front'] },
    look: { pal: { w: '#fef3c7', W: '#d6c08a', b: '#a16207', B: '#78350f', n: '#f9a8d4', x: '#facc15', k: '#1c1917', r: '#ef4444', f: '#451a03' },
      rows: [
        'w..............w',
        'ww............ww',
        'Www.bbbbbbbb.wwW',
        '.WwbbbbbbbbbbwW.',
        '..bbbbbbbbbbbb..',
        '..bbrkbbbbkrbb..',
        '..bbbbbbbbbbbb..',
        '...bnnnnnnnnb...',
        '...bnxknnkxnb...',
        '....bbbbbbbb....',
        '.bbbBBBbbBBBbbb.',
        'bbbbBbbbbbbBbbbb',
        'bbbbBbbbbbbBbbbb',
        '.bbbBbbbbbbBbbb.',
        '..BBkkkkkkkkBB..',
        '..bb.bbbbbb.bb..',
        '..bb.bbbbbb.bb..',
        '..kk.kkkkkk.kk..'],
      weapon: '' },
    passive: { name: '야성', desc: '체력이 35% 이하가 되면 공격력이 35% 상승합니다.',
      stat(b, u, k, v) { return k === 'atk' && u.hp < u.maxHp * 0.35 ? v * 1.35 : v; } },
    skills: [
      { id: 'mt_s1', name: '물어뜯기', cost: 30, cd: 6, range: 8, sfx: 'nuke', desc: '전방의 적을 뜯어 피해를 주고 체력을 회복합니다.', plan: foeIn(8),
        cast(b, u, pl) { cone(b, u, pl.t, 8, 0.7, '#b45309'); b.inCone(b.foes(u), u, pl.t.x, pl.t.y, 8, 0.7).forEach(e => { const r = hit(b, u, e, 'phys', b.raw(u, 40, 1.0), '물어뜯기', { splash: true }); b.heal(u, u, r.dealt * 0.5 + 10, '물어뜯기'); }); } },
      { id: 'mt_s2', name: '부수기', cost: 40, cd: 9, range: 10, sfx: 'aoe', desc: '주변 범위에 피해를 주고 기절시킵니다.', plan: anyIn(10),
        cast(b, u) { ring(b, u.x, u.y, 10, '#b45309'); b.inCircle(b.foes(u), u.x, u.y, 10).forEach(e => { hit(b, u, e, 'phys', b.raw(u, 35, 0.8), '부수기', { splash: true }); b.cc(u, e, 'stun', 1.0); }); } }
    ],
    ult: { id: 'mt_ult', name: '불도저', cd: 34, range: 34, move: true, sfx: 'pierce', desc: '전방으로 돌진해 맞은 적을 에어본시키고 피해를 줍니다. 돌진하는 동안 CC에 면역입니다.', plan: foeIn(34, 6),
      cast(b, u, pl) {
        b.buff(u, 'unstop', 1.5, { name: '불도저', f: { ccImmune: true } });
        const ox = u.x, oy = u.y, e = dashTo(b, u, pl.t, 30, -4); b.slide(u, e.x, e.y);
        b.inLine(b.foes(u), ox, oy, u.x, u.y, 5.5).forEach(x => { hit(b, u, x, 'phys', b.raw(u, 70, 1.1), '불도저', { path: true }); air(b, u, x, 1.1); });
      } }
  };

  /* ================= 22. 레스큐 ================= */
  FD.rescue = {
    id: 'rescue', name: '레스큐', role: 'guardian', color: '#f87171', title: '사이버네틱 구조요원',
    concept: '"제가 왔습니다 안심하세요."',
    stats: { hp: 1140, mp: 300, aspd: 0.85, spd: 7.8, atk: 28, ap: 64, def: 34, res: 38, ten: 0.15, pen: 0.05, ls: 0, range: 20 },
    basic: mageBasic, ai: { backline: true, kite: 8, threat: 0.9 },
    tac: { act: ['basic'], fight: ['support'], pos: ['cover', 'none'], ult: ['clutch', 'normal'] },
    look: { hair: '#fecaca', skin: '#fde5cf', body: '#b91c1c', acc: '#ffffff', hairStyle: '3,-1,H;5,-1,H;7,-1,H;8,0,H;9,2,H;9,3,H', feat: '4,3,A;7,3,A;4,-1,W;5,-1,R;6,-1,W;5,7,W;6,7,W', weapon: '11,4,X;11,5,X;12,5,R;11,6,X;11,7,K' },
    passive: { name: '긴급구조', desc: '체력이 50% 미만인 아군이 있으면 이동속도가 25% 상승합니다.',
      stat(b, u, k, v) { return k === 'spd' && b.units.some(a => a.team === u.team && a.alive && a !== u && a.hp < a.maxHp * 0.5) ? v * 1.25 : v; } },
    skills: [
      { id: 'rs_s1', name: '셀방어막', cost: 45, cd: 10, range: 35, sfx: 'shield', desc: '전방에 보호막을 펼칩니다. 레스큐가 이동해도 그 자리에 남아, 파괴되기 전까지(최대 9초) 안쪽 아군의 피해를 대신 받습니다.', plan: foeIn(35),
        cast(b, u, pl) { const d = b.dir(u, pl.t), p = b.clampPos(u.x + d.x * 8, u.y + d.y * 8); barrier(b, u, p.x, p.y, 7, b.raw(u, 90, 0, 1.2), 9, '#f87171'); } },
      { id: 'rs_s2', name: '셀포', cost: 40, cd: 5, range: 28, sfx: 'nuke', desc: '포를 발사해 적에게 피해를 줍니다. 아군이 맞으면 체력을 회복합니다.',
        plan: (b, u, en, al) => { const t = b.nearest(u, en.filter(e => b.dist(u, e) <= 28)); if (t) return { t }; const a = hurtAlly(b, u, al, 28); return a ? { t: a } : null; },
        cast(b, u, pl) { const e = lineEnd(b, u, pl.t, 30); beam(b, u, e.x, e.y, 3.5, '#f87171'); b.inLine(b.foes(u), u.x, u.y, e.x, e.y, 3.5).forEach(x => hit(b, u, x, 'magic', b.raw(u, 40, 0, 0.8), '셀포', { path: true })); b.inLine(b.friends(u).filter(a => a !== u), u.x, u.y, e.x, e.y, 3.5).forEach(a => b.heal(u, a, b.raw(u, 45, 0, 0.9), '셀포')); } }
    ],
    ult: { id: 'rs_ult', name: '셀 파동', cd: 38, range: 30, sfx: 'shield', desc: '주변으로 파동을 퍼뜨려 아군의 체력을 회복하고, 잠시 CC에 면역이 되게 합니다.',
      plan: (b, u, en, al, strict) => (strict ? (al.some(a => a.hp < a.maxHp * 0.6 && b.dist(u, a) <= 22) ? {} : null) : (en.some(e => b.dist(u, e) <= 30) ? {} : null)),
      cast(b, u) { ring(b, u.x, u.y, 22, '#f87171'); b.inCircle(b.friends(u), u.x, u.y, 22).forEach(a => { b.heal(u, a, b.raw(u, 50, 0, 0.9), '셀 파동'); b.buff(a, 'unstop', 2.5, { name: 'CC 면역', f: { ccImmune: true } }); }); } }
  };

  /* ================= 23. 사이오닉 좀비 ================= */
  FD.zombie = {
    id: 'zombie', name: '사이오닉 좀비', role: 'guardian', color: '#a3e635', title: '사이버네틱 실험체',
    concept: '"끼기긱....끼익...."',
    stats: { hp: 1100, mp: 140, aspd: 0.75, spd: 7.2, atk: 52, ap: 0, def: 36, res: 30, ten: 0.20, pen: 0.06, ls: 0.25, range: 6.5 },
    basic: meleeBasic, ai: { front: true, threat: 1.5 },
    tac: { act: ['rush', 'basic'], fight: ['solo'], pos: ['front'] },
    look: {
      hair: '#a78bfa', skin: '#d6cfc0', body: '#8b5a3c', acc: '#8b5cf6', res: 2,
      pal: {
        T: '#d6cfc0', G: '#8f8878',                        // 해골 뼈 / 뼈 그림자
        M: '#8b5a3c', N: '#5a3a28', O: '#e08a4a',          // 녹 중간 / 어두운 녹 / 밝은 녹
        C: '#b45f2e',                                      // 구리 코일
        V: '#8b5cf6', U: '#e0e7ff'                         // 전류 / 전류 코어·눈
      },
      rows: [
        '.............TTTTTT.........W...',
        '............TTTTTTTT.......WXW..',
        '...........TTTTTGTTTT....WWXWXW.',
        '...........TKVVTTVVKT...WWXXXWX.',
        '...........TKVUTTUVKT...XXMMXXV.',
        '...........GTTTKKTTTG..MMXMMVMM.',
        '............TGTKKTGT...NMMOMNVM.',
        '............TUTUUTUT....MNMMNVN.',
        '.............GUUUUG.....NMVXMN..',
        '.....XXXXXXXXMXKKXMXXXXXNMMVNM..',
        '...XXWXXMMMMNMMUVMMNMMXXNMMMMVN.',
        '..XXMMNXMMMMMKVUUVKMMMMNXMMNMMN.',
        '.XXMMNNOMMMNMVUUUUVMNMMXXMMXXNN.',
        '.XMMNMMNMMNNKVVUUVVKNNMMNXNMMN..',
        '.XXMMNNMMNNNNKVUUVKNNNNMMNN.....',
        'XMMNOMMNN..NNMVUUVMNNNMMN.......',
        'XMCCNMNN....NNMVVMNN.NMN........',
        'XXXMCCNM....NMMVVMMN.NM.........',
        'WVWXMNN......CMVVMC..N..........',
        'XWXKXN.......CNUVNC.............',
        '.XXKXX..XXXMXMXOOXMXMXXX........',
        '..XXXX..NMMNMMKUUKMMNMMN........',
        '........NNMMNNKVVKNNMMNN........',
        '........NMCOCMNVVNMCOCMN........',
        '........NVCOCMNKVNMCOCVN........',
        '.......NMCOCMN....NMCOCMN.......',
        '.......XMCOCMX....XMCOCMX.......',
        '......XMKWKMX......XMKWKMX......',
        '......XXWKWXX......XXWKWXX......',
        '......NMWXMN........NMXWMN......',
        '......NCOCON........NCOCON......',
        '.....NMXWXMN........NMXWXMN.....',
        '.....NVXWXVN........NVXWXVN.....',
        '....XNMXWXMNX......XNMXWXMNX....',
        '...MNMMXWXMMNM....MNMMXWXMMNM...',
        '...NMNMMMMMNMN....NMNMMMMMNMN...'
      ]
    },
    passive: { name: '무한동력장치', desc: '체력이 줄어들수록 방어력과 저항력이 상승합니다(체력 0%일 때 최대 +80%).',
      stat(b, u, k, v) { return (k === 'def' || k === 'res') ? v * (1 + 0.8 * (1 - Math.max(0, u.hp) / u.maxHp)) : v; } },
    skills: [
      { id: 'zb_s1', name: '사이오닉 해머', cost: 30, cd: 7, range: 9, sfx: 'nuke', desc: '전방을 강타해 피해를 주고 기절시킵니다. 적중 시 체력을 회복합니다.', plan: foeIn(9),
        cast(b, u, pl) { cone(b, u, pl.t, 9, 0.7, '#a3e635'); b.inCone(b.foes(u), u, pl.t.x, pl.t.y, 9, 0.7).forEach(e => { const r = hit(b, u, e, 'phys', b.raw(u, 45, 1.0), '사이오닉 해머', { splash: true }); b.cc(u, e, 'stun', 0.8); b.heal(u, u, r.dealt * 0.4 + 10, '사이오닉 해머'); }); } },
      { id: 'zb_s2', name: '사이오닉버스터', cost: 35, cd: 8, range: 24, move: true, sfx: 'pierce', desc: '전방으로 돌진해 맞은 적에게 피해를 주고 경직시킵니다.', plan: foeIn(24, 6),
        cast(b, u, pl) { const ox = u.x, oy = u.y, e = dashTo(b, u, pl.t, 18, -2); b.slide(u, e.x, e.y); b.inLine(b.foes(u), ox, oy, u.x, u.y, 4.5).forEach(x => { hit(b, u, x, 'phys', b.raw(u, 40, 0.9), '사이오닉버스터', { path: true }); b.cc(u, x, 'stagger', 0.8); }); } }
    ],
    ult: { id: 'zb_ult', name: '자폭', cd: 40, range: 12, sfx: 'aoe', desc: '자폭하여 주변 범위에 피해를 줍니다. 시전 시 체력이 많을수록 피해가 큽니다. 잠시 후 절반의 체력으로 되살아나며, 되살아나는 동안 피해를 받고 일정 피해(최대 체력의 25%)를 받으면 사망합니다.',
      plan: (b, u, en, al, strict) => (en.some(e => b.dist(u, e) <= 12) && (!strict || u.hp < u.maxHp * 0.5) ? {} : null),
      cast(b, u) {
        const ratio = u.hp / u.maxHp; ring(b, u.x, u.y, 14, '#a3e635'); b.emit({ type: 'star', x: u.x, y: u.y });
        b.inCircle(b.foes(u), u.x, u.y, 14).forEach(e => hit(b, u, e, 'phys', b.raw(u, 50, 0.9) * (0.7 + 1.5 * ratio), '자폭', { splash: true }));
        u.st = u.st.filter(s => s.shield === undefined); u.hp = Math.max(1, u.maxHp * 0.25);
        b.buff(u, 'revive', 3, { name: '재생 중', f: { stun: true, onEnd: (bb, uu) => { if (uu.alive) { uu.hp = uu.maxHp * 0.5; bb.emit({ type: 'heal', src: uu, dst: uu, amt: Math.round(uu.maxHp * 0.5), via: '재생' }); } } } });
      } }
  };

  /* ================= 24. 알카바 ================= */
  FD.alcaba = {
    id: 'alcaba', name: '알카바', role: 'guardian', color: '#60a5fa', title: '전류동력 경찰로봇',
    concept: '"조사에 불응 시 즉시 체포합니다."',
    stats: { hp: 1200, mp: 240, aspd: 0.9, spd: 7.8, atk: 46, ap: 58, def: 38, res: 34, ten: 0.20, pen: 0.08, ls: 0, range: 10 },
    basic: { type: 'magic', atk: 0.6, ap: 0.5, proj: 'melee' }, ai: { front: true, threat: 1.3 },
    tac: { act: ['basic'], fight: ['support', 'coop'], pos: ['front', 'none'] },
    look: { hair: '#1e3a8a', skin: '#cbd5e1', body: '#1e40af', acc: '#facc15', hairStyle: '3,-1,B;4,-2,B;5,-2,Y;6,-2,B;7,-2,B;8,-1,B', feat: '4,3,Y;7,3,Y;1,6,X;10,6,X;5,7,Y;6,7,Y', weapon: '11,3,Y;11,4,K;11,5,K;12,5,Y;12,6,K;12,7,Y;11,7,K' },
    passive: { name: '배터리 충전', desc: '전기(마법) 공격을 받으면 3초간 이동속도가 30% 상승합니다.',
      onHurt(b, u, src, res) { if (res.type === 'magic') b.buff(u, 'battery', 3, { name: '배터리 충전', mul: { spd: 1.3 }, quiet: true }); } },
    skills: [
      { id: 'ac_s1', name: '홀로그램퍼즈', cost: 40, cd: 10, range: 30, sfx: 'debuff', desc: '지정한 적을 속박시킵니다.',
        plan: (b, u, en) => { const l = en.filter(e => b.dist(u, e) <= 30 && !e.st.some(s => s.root)); const bl = l.filter(e => e.role.backline); const t = b.nearest(u, bl.length ? bl : l); return t ? { t } : null; },
        cast(b, u, pl) { beam(b, u, pl.t.x, pl.t.y, 2, '#60a5fa'); b.cc(u, pl.t, 'root', 2.2); hit(b, u, pl.t, 'magic', b.raw(u, 20, 0, 0.3), '홀로그램퍼즈'); } },
      { id: 'ac_s2', name: '전기채찍', cost: 40, cd: 9, range: 14, sfx: 'aoe', desc: '전기를 휘둘러 피해를 주고, 그 자리에 전기를 잠시(6초) 남깁니다. 적이 밟으면 기절합니다.', plan: foeIn(14),
        cast(b, u, pl) {
          cone(b, u, pl.t, 12, 0.6, '#facc15'); b.inCone(b.foes(u), u, pl.t.x, pl.t.y, 12, 0.6).forEach(e => hit(b, u, e, 'magic', b.raw(u, 35, 0, 0.7), '전기채찍', { splash: true }));
          const d = b.dir(u, pl.t), p = b.clampPos(u.x + d.x * 9, u.y + d.y * 9);
          b.zone({ x: p.x, y: p.y, r: 7, dur: 6, owner: u, kind: 'trap', color: '#facc15', every: 0.1, used: {}, onTick(z, bb) { bb.inCircle(bb.foes(u), z.x, z.y, z.r).forEach(e => { if (z.used[e.id]) return; z.used[e.id] = 1; bb.cc(u, e, 'stun', 1.2); hit(bb, u, e, 'magic', bb.raw(u, 20, 0, 0.4), '전기채찍', { splash: true }); }); } });
        } }
    ],
    ult: { id: 'ac_ult', name: '방열살상포', cd: 36, range: 38, sfx: 'nuke', desc: '전방에 잠시(2.2초) 동안 강력한 에너지를 발사해 직선상의 적에게 계속 피해를 줍니다.', plan: foeIn(38),
      cast(b, u, pl) {
        lock(b, u, 2.2); const t = pl.t;
        for (let i = 1; i <= 11; i++) b.later(i * 0.2, bb => { if (!u.alive) return; const tg = t.alive ? t : bb.nearest(u, bb.foes(u)); if (!tg) return; const e = lineEnd(bb, u, tg, 40); beam(bb, u, e.x, e.y, 4.5, '#facc15'); bb.inLine(bb.foes(u), u.x, u.y, e.x, e.y, 4).forEach(x => hit(bb, u, x, 'magic', bb.raw(u, 24, 0, 0.36), '방열살상포', { path: true })); });
      } }
  };

  /* ================= 25. 아난타 ================= */
  FD.ananta = {
    id: 'ananta', name: '아난타', role: 'guardian', color: '#06b6d4', title: '심해의 괴수',
    concept: '"심해의 깊은 공포를 느껴라."',
    stats: { hp: 1140, mp: 260, aspd: 0.8, spd: 7.4, atk: 36, ap: 56, def: 40, res: 38, ten: 0.20, pen: 0.06, ls: 0, range: 7 },
    basic: { type: 'magic', atk: 0.6, ap: 0.5, proj: 'melee' }, ai: { front: true, threat: 1.4 },
    tac: { act: ['basic'], fight: ['support', 'coop'], pos: ['front'] },
        look: { res: 2,
      pal: { D: '#06141a', B: '#a07a45', b: '#6b4f2a', Y: '#d4a85a', S: '#2f5d5a', s: '#4b8a82', a: '#3a6b66', G: '#34d399', A: '#f59e0b', o: '#fb923c',
            w: '#f1f5f9', W: '#e8d9a8', c: '#22d3ee', C: '#a5f3fc', u: '#0e7490', T: '#1f3a44', t: '#35606b', q: '#8fb3b8' },
      rows: [
        '.........W.....YY.....W.........',
        '.........WW..BBYYBB..WW......W.W',
        '........W..BBBBbbBBBB..W....W.WW',
        '..........bbbbbbbbbbbb.....WsssW',
        '........a..BBBBbbBBBB..a...Wssss',
        '.......aa..SDooSSooDS..aa...ssss',
        '........a.BBSSSSSSSSBB.a..YYYY..',
        '..........BBSwDDDDwSBB...cBBAB..',
        '..........BBSDwwwwDSYYYYcYBBBB..',
        '....YYYYYYBBBSSSSSSBBBbbbbScuC..',
        '....YBbbbbbBBYYYYYYYBbbbbbcccuc.',
        '....BbbbbbbbBBbbbbBBBbbAAubCB.cu',
        '...BBbbGGbbbBBbCGbBABbbbCcccCcuC',
        '....BbbbbbbbBBbGGbBBBWWbbbuCuCcu',
        '....BBbbbbbBBBbbbbBBWBBBcuCc.ccc',
        '.....aaSSBBBbbbbbsssssWWucuccuCc',
        '.....aaSYYYYYYYYYsssss.W.Cccccc.',
        '.....aaSBbbbAbbbGsssssW.c.cCc.uu',
        '........BBBBBBBBBSSSss.W.c.cuc.c',
        '..........YYYYYGGYYYYW....Cccuc.',
        '..........bbbbbGGbbbbb........c.',
        '........tTababBBBBababTct.......',
        '.......TTTbabaBYYBbabaTTTc......',
        '.....TtTTTqbabBYYBabaqcTTTtT....',
        '....tTTTTTtabaBYYBbabtTTTTTTt...',
        '...TTTTT.qttttttttttttq..TTTTT..',
        '..tTTT..tttttqtttt.tttt....TTTt.',
        '.TTTT...qttttqttt..ttttq....TTTT',
        '.tTT....tttt..ttt...ttttt....TTt',
        '.TTT..tqttt..qttt....tttqtt..TTT',
        'tTT..TTtttt...qtt.....tttTTT..TT',
        '.TT....qtt...tttt..t..tttq....TT',
        'tTT....tttt..tqtttqt..tttt....TT',
        '.TTT...qtt...ttttttt...ttq...TTT',
        '.tTTTTTttttttttqttttttttttTTTTTt',
        '...tTTTTqtttttq.qtttqqttqTTTTt..'],
      weapon: '' },
    passive: { name: '수분흡수', desc: '스킬이 적중하면 일정량의 체력을 회복합니다(0.6초마다 최대 1회).',
      onDealt(b, u, t, res, o) { if (o.skill && (u.mem.hT || 0) <= b.t) { u.mem.hT = b.t + b.sec(0.6); b.heal(u, u, 22 + 0.2 * b.eff(u, 'ap'), '수분흡수'); } } },
    skills: [
      { id: 'an_s1', name: '파도', cost: 40, cd: 8, range: 16, sfx: 'aoe', desc: '전방에 물을 내보내 맞은 적들을 넉백시키고 피해를 줍니다.', plan: foeIn(16),
        cast(b, u, pl) { cone(b, u, pl.t, 17, 0.65, '#06b6d4'); b.inCone(b.foes(u), u, pl.t.x, pl.t.y, 17, 0.65).forEach(e => { hit(b, u, e, 'magic', b.raw(u, 38, 0, 0.7), '파도', { splash: true }); b.knock(u, e, 10); }); } },
      { id: 'an_s2', name: '방어륜', cost: 45, cd: 10, range: 24, sfx: 'shield', desc: '자신과 주변 아군에게 5초간 보호막을 제공합니다.',
        plan: (b, u, en) => (en.some(e => b.dist(u, e) <= 26) && !u.st.some(s => s.key === 'shield_방어륜' && s.shield > 0) ? {} : null),
        cast(b, u) { ring(b, u.x, u.y, 16, '#06b6d4'); b.inCircle(b.friends(u), u.x, u.y, 16).forEach(a => b.shield(u, a, b.raw(u, 70, 0, 0.8), 5, '방어륜')); } }
    ],
    ult: { id: 'an_ult', name: '수폭', cd: 36, range: 16, sfx: 'aoe', desc: '자신 주변에 피해를 줍니다. 방어륜 효과를 받고 있는 아군 주변에도 함께 피해를 줍니다.',
      plan: (b, u, en, al) => (en.some(e => b.dist(u, e) <= 16 || al.some(a => a !== u && a.st.some(s => s.key === 'shield_방어륜' && s.shield > 0) && b.dist(a, e) <= 12)) ? {} : null),
      cast(b, u) {
        const centers = [{ x: u.x, y: u.y, r: 16 }]; b.friends(u).filter(a => a !== u && a.st.some(s => s.key === 'shield_방어륜' && s.shield > 0)).forEach(a => centers.push({ x: a.x, y: a.y, r: 12 }));
        centers.forEach(c => { ring(b, c.x, c.y, c.r, '#06b6d4'); b.inCircle(b.foes(u), c.x, c.y, c.r).forEach(e => hit(b, u, e, 'magic', b.raw(u, 60, 0, 1.0), '수폭', { splash: true })); });
      } }
  };

  /* ================= 26. 자이언트 ================= */
  FD.giant = {
    id: 'giant', name: '자이언트', role: 'guardian', color: '#d97706', title: '묵직한 거인',
    concept: '"누구지? 나의 잠을 방해한 놈이."',
    stats: { hp: 1220, mp: 150, aspd: 0.7, spd: 6.8, atk: 44, ap: 0, def: 38, res: 32, ten: 0.25, pen: 0.06, ls: 0, range: 7.5 },
    basic: meleeBasic, ai: { front: true, threat: 1.8 },
    tac: { act: ['basic'], fight: ['coop'], pos: ['front'] },
        look: { res: 2,
      pal: { D: '#0f1210', K: '#23282a', M: '#4a5250', N: '#6b7570', T: '#9aa49b', G: '#4d6b3a', O: '#ffb02e', C: '#9a5a2c', c: '#d98a4a', z: '#8a8f98' },
      rows: [
        '...........DDDDDDDDDD...........',
        '..........DKMMMMMMMMKD..........',
        '..........DMTNNMMNNTMD..........',
        '..........DKKKKKKKKKKD..........',
        '..........DMOKMMMMKOMD..........',
        '..........DMMNMKKMNMMD..........',
        '...........DKKMKKMKKD...........',
        '..DDDDDDDDDKMKKKKKKMKDDDDDDDDD..',
        '.DccccCCCDDKMNMMMMNMKDDCCCccccD.',
        'DcCCCOCCCCDKMNNTTNNMKDCCCCOCCCcD',
        'DCCCCCCOCCDKMGNNNNGMKDCCOCCCCCCD',
        'DKCCOCCCCDKMMGMNNMGMMKDCCCCOCCKD',
        'DKKCCCCCDKMMNMGMMGMNMMKDCCCCCKKD',
        '.DKMMMMKDKMNNMGMMGMNNMKDKMMMMKD.',
        '.DKMNNMKDMNMGMNTTNMGMNMDKMNNMKD.',
        'DCCcCCCCDKMNMNMMMMNMNMKDCCCCcCCD',
        'DCzCCczCDKMMNGMNNMGNMMKDCzcCCzCD',
        'DCCOCCCCDKMNMNNMMNNMNMKDCCCCOCCD',
        '.DKMNNMKDCCcCCCCCCCCcCCDKMNNMKD.',
        '.DKMMNMKDCcCCCOOOOCCCcCDKMNMMKD.',
        '.DKMNMMKDCCCcCCCCCCcCCCDKMMNMKD.',
        'DKMNNMMDDcCzCcCDDCcCzCcDDMMNNMKD',
        'DKMNTNMDDCcCzCCDDCCzCcCDDMNTNMKD',
        'DKMNNMMDDKCzCCKDDKCCzCKDDMMNNMKD',
        'DKMTNNMDDKMGMNMDDMNMGMKDDMNNTMKD',
        'DKMNNMKDDKMNMMGDDGMMNMKDDKMNNMKD',
        'DDKMMKDDKMMNMGMDDMGMNMMKDDKMMKDD',
        '....DDDKMNCCCMMDDMMCCCNMKDDD....',
        '....DDKMMCOcCNMDDMNCcOCMMKDD....',
        '....DDKMNCCCcMMDDMMcCCCNMKDD....',
        '....DDKMMGMNMKKDDKKMNMGMMKDD....',
        '....DKMMNMGMNKKDDKKNMGMNMMKD....',
        '....DKKMNMMMGMKDDKMGMMMNMKKD....',
        '...DKGMMNMMGGMKDDKMGGMMNMMGKD...',
        '..DKGGMKKKKKKKKDDKKKKKKKKMGGKD..',
        '..DDDDDDDDDDDDDDDDDDDDDDDDDDDD..'],
      weapon: '' },
    passive: { name: '우직함', desc: '받는 디버프의 수치가 감소합니다(상태이상 지속시간 약 40% 감소, 둔화·치유감소 수치 절반).',
      stat(b, u, k, v) { return k === 'ten' ? 1 - (1 - v) * 0.6 : v; },
      tick(b, u) { for (const s of u.st) { if (s.slow && !s.softened) { s.slow *= 0.5; s.softened = true; } if (s.healMul !== undefined && s.healMul < 1 && !s.softened) { s.healMul = 1 - (1 - s.healMul) * 0.5; s.softened = true; } } } },
    skills: [
      { id: 'gi_s1', name: '용격', cost: 30, cd: 8, range: 10, sfx: 'buff', desc: '다음 두 번의 기본 공격이 적중하면 보호막을 생성하고 추가 피해를 줍니다.', plan: anyIn(10),
        cast(b, u) {
          u.mem.dg = 2; b.buff(u, 'dragonfist', 8, { name: '용격', f: { onEnd: (bb, uu) => { uu.mem.dg = 0; } } });
          u.bm.push({ until: b.t + b.sec(8), fn(bb, uu, t) { if (!(uu.mem.dg > 0)) return; uu.mem.dg--; ring(bb, t.x, t.y, 5, '#d97706'); hit(bb, uu, t, 'phys', bb.raw(uu, 35, 0.8), '용격'); bb.shield(uu, uu, 70 + 0.08 * uu.maxHp, 4, '용격'); if (uu.mem.dg <= 0) uu.st = uu.st.filter(x => x.key !== 'dragonfist'); } });
        } },
      { id: 'gi_s2', name: '장벽', cost: 45, cd: 11, range: 30, sfx: 'shield', desc: '전방에 큰 방어막을 생성합니다. 파괴되기 전까지(최대 8초) 안쪽 아군의 피해를 대신 받습니다.', plan: foeIn(30),
        cast(b, u, pl) { const d = b.dir(u, pl.t), p = b.clampPos(u.x + d.x * 9, u.y + d.y * 9); barrier(b, u, p.x, p.y, 10, 150 + 0.8 * b.eff(u, 'atk'), 8, '#d97706'); } }
    ],
    ult: { id: 'gi_ult', name: '핵타르', cd: 36, range: 14, sfx: 'aoe', desc: '땅을 내려쳐 주변에 피해를 주고 기절시킵니다.', plan: anyIn(14),
      cast(b, u) { ring(b, u.x, u.y, 15, '#d97706'); b.inCircle(b.foes(u), u.x, u.y, 15).forEach(e => { hit(b, u, e, 'phys', b.raw(u, 70, 1.1), '핵타르', { splash: true }); b.cc(u, e, 'stun', 1.5); }); } }
  };

  /* ================= 27. 에테크 ================= */
  FD.etech = {
    id: 'etech', name: '에테크', role: 'guardian', color: '#22c55e', title: '도시 자경단 사이보그',
    concept: '"진압해!!!"',
    stats: { hp: 1100, mp: 190, aspd: 0.95, spd: 8.4, atk: 60, ap: 0, def: 38, res: 30, ten: 0.15, pen: 0.06, ls: 0, range: 6 },
    basic: meleeBasic, ai: { front: true, threat: 1.3 },
    tac: { act: ['rush', 'basic'], fight: ['coop', 'support'], pos: ['front'] },
    look: { hair: '#1c1917', skin: '#e5c9a8', body: '#166534', acc: '#4ade80', hairStyle: '3,-1,H;5,-1,H;7,-1,H;8,0,H', feat: '3,3,X;4,3,X;5,3,X;6,3,X;7,3,X;8,3,X;1,6,X;10,6,X', weapon: '11,6,X;12,6,A;12,7,A;11,7,X;11,8,X' },
    passive: { name: '기초방어능력', desc: '적에게 스킬 피해를 주면 잠시 보호막이 생성됩니다. (쿨타임 6초)',
      onDealt(b, u, t, res, o) { if (o.skill && (u.mem.shT || 0) <= b.t) { u.mem.shT = b.t + b.sec(6); b.shield(u, u, b.raw(u, 60, 0.5), 3, '기초방어'); } } },
    skills: [
      { id: 'et_s1', name: '공습', cost: 35, cd: 8, range: 24, move: true, sfx: 'charge', desc: '도약해서 착지한 뒤 주변에 피해를 줍니다.', plan: foeIn(24, 6),
        cast(b, u, pl) { const e = dashTo(b, u, pl.t, 20, 3); b.slide(u, e.x, e.y); ring(b, u.x, u.y, 8, '#4ade80'); b.inCircle(b.foes(u), u.x, u.y, 8).forEach(x => hit(b, u, x, 'phys', b.raw(u, 40, 0.9), '공습', { splash: true })); } },
      { id: 'et_s2', name: '터보펀치', cost: 35, cd: 7, range: 22, move: true, sfx: 'pierce', desc: '돌진해서 타격 피해를 주고, 적의 보호막을 즉시 파괴합니다.', plan: foeIn(22, 3),
        cast(b, u, pl) { const t = pl.t, e = dashTo(b, u, t, 18, 3); b.slide(u, e.x, e.y); t.st = t.st.filter(s => s.shield === undefined); hit(b, u, t, 'phys', b.raw(u, 45, 1.0), '터보펀치'); ring(b, t.x, t.y, 5, '#4ade80'); } }
    ],
    ult: { id: 'et_ult', name: '부스터 버스터', cd: 36, range: 22, sfx: 'nuke', desc: '주먹에 기를 모아 넓은 전방 범위에 피해를 줍니다. 가까울수록 피해량이 상승합니다.', plan: foeIn(22),
      cast(b, u, pl) {
        lock(b, u, 0.8); const t = pl.t;
        b.later(0.8, bb => {
          if (!u.alive) return; const tg = t.alive ? t : bb.nearest(u, bb.foes(u)); if (!tg) return; cone(bb, u, tg, 26, 0.75, '#4ade80');
          bb.inCone(bb.foes(u), u, tg.x, tg.y, 26, 0.75).forEach(e => { const k = 1.7 - 1.0 * Math.min(1, bb.dist(u, e) / 26); hit(bb, u, e, 'phys', bb.raw(u, 60, 1.2) * k, '부스터 버스터', { splash: true }); });
        });
      } }
  };



  /* ================= 28. 디티 ================= */
  FD.dt = {
    id: 'dt', name: '디티', role: 'guardian', color: '#14b8a6', title: '외계 자이언트 골렘',
    concept: '"신기하고 작군...파괴해야겠어"',
    stats: { hp: 1180, mp: 220, aspd: 0.7, spd: 6.9, atk: 52, ap: 40, def: 44, res: 38, ten: 0.25, pen: 0.06, ls: 0, range: 7.5 },
    basic: meleeBasic, ai: { front: true, threat: 1.8 },
    tac: { act: ['basic'], fight: ['coop'], pos: ['front'] },
    look: { res: 2, pal: { m: '#2a2260', h: '#4d4199', n: '#14102f', l: '#9488e8', v: '#7c3aed', w: '#f3efff', e: '#fff7ed', o: '#fb923c', k: '#05040f' },
      rows: [
        '................................',
        '................................',
        '...........l......lllll.........',
        '......lllllmlllllnhnhnhnl.......',
        '....llmnmmwmmmmnlnhnhnhnm.......',
        '...lmmnmmmmnmmnlhnenenonml......',
        '..lmmnwhmmmnnvnlmmehehomom......',
        '.lmmmnnnmmhmmmnllhhehehoom......',
        '.lmnmnhvhmmvvmwhlmhehehhom......',
        '.lmnnhvvhvmmmmmnlmhhhhhmmh......',
        '.lmnhmmlmhhmmnmvhvllvkkhwn....lw',
        '.lnhmmmnnnhmmwmmhmhhhhhnllllll..',
        '..lhhnmmnnvmmmmmhmmmhhnlhmmvlllw',
        '..lmwnmvnhnmvmvmnmmnhhlhmhvhhl..',
        '..lmmnmmnhvmmnvvnwnhmvnmhhhhhll.',
        '.lmvmnmnhnnnnnnnnhhvmnhlvhvmmh.w',
        '.lmmmnn..lhhlhhwnmmmnmnlmmmmml..',
        '.lmmmmn..lnhmnmmnnvvmmmhhwhhlnl.',
        '.lmvmvn..lmvmmnnnnnnwmmmhhnmml.w',
        '.lmmmn....lmmmmnnmmmmmmn..lnn.w.',
        '.lmvml...lvmnvmnmmmnvmml........',
        '.lhmmn...lhhmmnnvnnmnmn.........',
        '.lmmmn..lmnhmnmmnnnmnhnl........',
        '.lhnmv..lvmwhnmmnhmmnnnhl.......',
        '.lvnnw.lmmmmhhhnnnnvvhhmn.......',
        '.llllllhmmlmnmn.lhhhmmwmml......',
        '.llhhhhlhvnmmn...lmnmmvnvvl.....',
        '.lhhhhhmhmmnmv....lmmvmvmmn.....',
        '.lhhhhmmhmmnn......lmvmmmmn.....',
        '.llhmhhmhwmv........nmvmnmn.....',
        '.lllmmmlnnnn.......lnnnnnn......',
        'l.l.llhlhhhh.....llhhhhhhh......',
        '..l.llmmlmhn.....lmmmmmmmml.....',
        '.l..lnnnlnnnl...lnnnnnnnnnn.....'],
      weapon: '' },
    passive: { name: '거대생명체', desc: '죽을 정도의 피해(현재 체력 이상)를 맞으면 그 피해를 65% 줄입니다. 한 번 발동하면 40초 동안 다시 발동하지 않습니다.',
      preHit(b, u, rest) {
        if (rest < u.hp || (u.mem.lethalT || 0) > b.t) return rest;
        u.mem.lethalT = b.t + b.sec(40); b.buff(u, 'giantvit', 1.2, { name: '거대생명체' }); ring(b, u.x, u.y, 8, '#14b8a6');
        return Math.max(1, Math.round(rest * 0.35));
      },
      tick(b, u) { const cd = Math.max(0, (u.mem.lethalT || 0) - b.t); u.gauge = { label: cd > 0 ? '재생 대기' : '거대생명체', val: cd > 0 ? b.sec(40) - cd : 1, max: cd > 0 ? b.sec(40) : 1, color: '#14b8a6' }; } },
    skills: [
      { id: 'dt_s1', name: '암해머', cost: 40, cd: 8, range: 14, sfx: 'aoe', desc: '땅을 찍어 피해를 주고 기절시킵니다. 오래 차징할수록 범위가 늘어납니다(주변 적이 많을수록 길게 차징).', plan: foeIn(14),
        cast(b, u, pl) {
          const cnt = b.foes(u).filter(e => b.dist(u, e) <= 18).length, charge = 0.5 + 0.35 * Math.min(3, cnt - 1), r = 7 + 8 * (charge / 1.55), d = b.dir(u, pl.t);
          lock(b, u, charge); b.zone({ x: u.x + d.x * 4, y: u.y + d.y * 4, r, dur: charge, owner: u, kind: 'warn', color: '#14b8a6' });
          b.later(charge, bb => {
            if (!u.alive || bb.stunned(u)) return; const cx = u.x + d.x * 4, cy = u.y + d.y * 4; ring(bb, cx, cy, r, '#14b8a6');
            bb.inCircle(bb.foes(u), cx, cy, r).forEach(e => { hit(bb, u, e, 'phys', bb.raw(u, 40 + 12 * charge, 0.95, 0.2), '암해머', { splash: true }); bb.cc(u, e, 'stun', 1.1); });
          });
        } },
      { id: 'dt_s2', name: '찌그러트리기', cost: 35, cd: 9, range: 9, sfx: 'nuke', desc: '적을 밀쳐 피해를 줍니다. 밀려난 적이 벽·장애물·다른 유닛에 부딪히면 추가 피해와 기절.', plan: foeIn(9),
        cast(b, u, pl) {
          const t = pl.t, d = b.dir(u, t), A = b.cfg.arena; let hitAt = 14, other = null;
          for (let i = 1; i <= 14 && !other; i++) {
            const px = t.x + d.x * i, py = t.y + d.y * i;
            if (b.inObs(px, py, 2.2) || px < 3 || px > A.w - 3 || py < 6 || py > A.h - 3) { hitAt = i; break; }
            other = b.units.find(e => e !== t && e !== u && e.alive && !b.hidden(e) && Math.hypot(e.x - px, e.y - py) < 3.4) || null; if (other) hitAt = i;
          }
          const collide = hitAt < 14; hit(b, u, t, 'phys', b.raw(u, 40, 0.9), '찌그러트리기'); b.knock(u, t, Math.max(2, hitAt - 1), u);
          if (collide) b.later(0.4, bb => { if (!t.alive) return; ring(bb, t.x, t.y, 6, '#14b8a6'); hit(bb, u, t, 'phys', bb.raw(u, 35, 0.8), '충돌', { crit: true }); bb.cc(u, t, 'stun', 1.2); if (other && other.alive) { hit(bb, u, other, 'phys', bb.raw(u, 25, 0.6), '충돌'); bb.cc(u, other, 'stun', 0.9); } });
        } }
    ],
    ult: { id: 'dt_ult', name: '러스터캐논', cd: 38, range: 34, sfx: 'nuke', desc: '캐논을 발사해 맞은 지점에 영역을 만듭니다. 영역 안의 적들을 중앙으로 끌어당기고, 지속시간 동안 초당 피해를 줍니다.', plan: (b, u, en) => clusterPick(b, u, en, 34, 13),
      cast(b, u, pl) {
        const c = { x: pl.t.x, y: pl.t.y }; beam(b, u, c.x, c.y, 5, '#f472b6'); ring(b, c.x, c.y, 13, '#f472b6');
        b.zone({ x: c.x, y: c.y, r: 13, dur: 4, owner: u, kind: 'gravity', color: '#f472b6', every: 0.25,
          onTick(z, bb) { bb.inCircle(bb.foes(u), z.x, z.y, z.r).forEach(e => {
            if (!e.st.some(s => s.ccImmune)) { const d = Math.hypot(z.x - e.x, z.y - e.y) || 1, m = Math.min(3.2, d), p = bb.clampPos(e.x + (z.x - e.x) / d * m, e.y + (z.y - e.y) / d * m); e.x = p.x; e.y = p.y; }
            hit(bb, u, e, 'magic', bb.raw(u, 10, 0.2, 0.4), '러스터캐논', { splash: true, dot: true }); }); } });
      } }
  };

  /* ================= 29. 쿰 ================= */
  const liveObs = (b, u) => (u.mem.obs = (u.mem.obs || []).filter(z => z.alive));      // 오벨리스크 = 체력을 가진 구조물 유닛
  FD.kum = {
    id: 'kum', name: '쿰', role: 'guardian', color: '#fbbf24', title: '고대석상',
    concept: '"여긴 들어갈 수 없다."',
    stats: { hp: 1100, mp: 220, aspd: 0.8, spd: 7.0, atk: 50, ap: 44, def: 42, res: 40, ten: 0.20, pen: 0.06, ls: 0, range: 7 },
    basic: meleeBasic, ai: { front: true, threat: 1.6 },
    tac: { act: ['basic'], fight: ['support', 'coop'], pos: ['front'] },
    look: { res: 2, pal: { s: '#b98f5c', l: '#e6d2a4', S: '#76593b', D: '#4a3724', k: '#241a12', g: '#f0c24f', e: '#9be4ff', E: '#38bdf8', t: '#a07c4f', T: '#d8c08e' },
      rows: [
        '.......T........................',
        '.......T.......TTTTTT...........',
        '......TtT.....TSSSSSS...........',
        '.....TttS......llllll...........',
        '.....TtttT....lSssssS...........',
        '.....TSSSST...lsssssSl..........',
        '.....lllllT...kkksskkk.gTg......',
        '....lsssSsgTTTDEeSSeEgTtttTgT...',
        '....lSssgsSTgSlssSSgsSTStttttT..',
        '....lssslsSTlTSSskkssSTSStSStg..',
        '....lSssssSDlTlsDDDDSTlllTtttST.',
        '.....lSSSSTSlTTSSSSSSlssslTtttS.',
        '.....lSTTTtSlTSlllgTlSsssSTtTS..',
        '....lSTDDSDDTllSSgkgTTlssSTtSS..',
        '....DDDTlllllTTDTTDtgtTlSTSSgs..',
        '...lDDDDsSsSslTDgtDtttglTglssD..',
        '...lssSlsssssSTDttDgttSlllSsSD..',
        '...lDDDlsSsssSTDgtDtSSSlsSsSSD..',
        '...lSsSlsssssSTDSSDglllssSsSSD..',
        '.....lS.lSSSSDlDllDlsSssSsSSSD..',
        '........TTgTTglsssssssssSsSSSD..',
        '........TtttttTlsssssssSlsSSSD..',
        '........TtDDSDDDDggDDDDDSlsSSD..',
        '........lTtttSSssssssslTTTTsSD..',
        '........lTtTtttTsSkSSDTttttTsD..',
        '.......lSTDDSDDSsSkDSDTtgtgtTs..',
        '.......lSTtgttgSsgkgSDTttttSS...',
        '.......lslTttStSsSkSSDTttgttS...',
        '.......lsSTDDtDDTsgSSDTtgtgSl...',
        '.......lsSTttSttSskSDDlTSSSlS...',
        '......lSSSTtttttSsDD..llllllll..',
        '....llllllTtDDtDD.....lssssssS..',
        '....lssssslTSgttgT....lsSsSsSsl.',
        '...lSSSSSSSTSSSSSS....lSSSSSSSS.'],
      weapon: '' },
    passive: { name: '사명감', desc: '자신의 오벨리스크 주변(12 이내)에서 방어력과 저항력이 35% 상승합니다.',
      stat(b, u, k, v) { return (k === 'def' || k === 'res') && liveObs(b, u).some(z => Math.hypot(u.x - z.x, u.y - z.y) <= 12) ? v * 1.35 : v; },
      tick(b, u) { u.gauge = { label: '오벨리스크', val: liveObs(b, u).length, max: 1, color: '#fbbf24' }; } },
    skills: [
      { id: 'ku_s1', name: '오벨리스크 소환', cost: 30, cd: 9, range: 26, sfx: 'aoe',
        desc: '오벨리스크 1개를 떨어뜨려 피해를 줍니다. 오벨리스크는 체력을 가진 구조물로(14초 유지), 적의 직선·부채꼴 공격과 원거리 기본 공격을 막아 뒤에 있는 아군을 지켜 줍니다. 적에게도 공격 대상이 되며, 필드에는 1개만 존재하고 새로 소환하면 기존 것은 사라집니다.', plan: foeIn(26),
        cast(b, u, pl) {
          const t = pl.t, d = b.dir(u, t), land = Math.max(6, Math.min(16, b.dist(u, t) - 3)), p = b.clampPos(u.x + d.x * land, u.y + d.y * land);
          ring(b, p.x, p.y, 6, '#fbbf24'); b.inCircle(b.foes(u), p.x, p.y, 6).forEach(e => hit(b, u, e, 'phys', b.raw(u, 40, 0.8, 0.3), '오벨리스크 소환', { splash: true }));
          let q = null;                                  // 다른 장애물·좁은 길목을 막지 않는 자리 찾기
          for (const rr of [0, 3, 6]) { for (let i = 0; i < 12 && !q; i++) { const an = i * Math.PI / 6, c = b.clampPos(p.x + Math.cos(an) * rr, p.y + Math.sin(an) * rr); if (!b.inObs(c.x, c.y, 6.5)) q = c; } if (q) break; }
          if (!q) return;
          const list = liveObs(b, u); list.forEach(o => { o.hp = 0; o.alive = false; b.onDeath(null, o); }); u.mem.obs = [];
          u.mem.obs.push(b.spawnStruct(u, { name: '오벨리스크', x: q.x, y: q.y, hp: 50 + 3 * b.eff(u, 'atk') + 2 * b.eff(u, 'ap'), life: 14, def: 0, res: 0 }));
        } },
      { id: 'ku_s2', name: '저지', cost: 35, cd: 8, range: 24, move: true, sfx: 'pierce', desc: '돌진하여 전방의 적을 밀쳐 피해를 줍니다. 체력이 줄었을 때 오벨리스크 쪽으로 돌진하면 체력을 회복합니다.',
        plan: (b, u, en) => {
          const t = b.nearest(u, en.filter(e => { const d = b.dist(u, e); return d <= 24 && d >= 3; })); if (!t) return null;
          const ob = u.hp < u.maxHp * 0.8 ? b.nearest(u, liveObs(b, u).filter(z => b.dist(u, z) > 6 && b.dist(u, z) <= 22)) : null; return { t, ob };
        },
        cast(b, u, pl) {
          const tg = pl.ob || pl.t, ox = u.x, oy = u.y, e = dashTo(b, u, tg, 20, pl.ob ? 4 : -2); b.slide(u, e.x, e.y);
          b.inLine(b.foes(u), ox, oy, u.x, u.y, 4.5).forEach(x => { hit(b, u, x, 'phys', b.raw(u, 40, 0.9), '저지', { path: true }); b.knock(u, x, 8, { x: ox, y: oy }); });
          if (pl.ob && b.dist(u, pl.ob) <= 8) { b.heal(u, u, u.maxHp * 0.14, '저지'); ring(b, u.x, u.y, 6, '#fbbf24'); }
        } }
    ],
    ult: { id: 'ku_ult', name: '철통방어', cd: 36, range: 24, sfx: 'shield', desc: '6초 동안 소환되어 있는 오벨리스크 주변(10 이내)의 아군들이 체력을 회복합니다. 시전 즉시 자신에게 보호막이 생깁니다.',
      plan: (b, u, en, al, strict) => (en.some(e => b.dist(u, e) <= 24) && (!strict || liveObs(b, u).length > 0) ? {} : null),
      cast(b, u) {
        b.shield(u, u, b.raw(u, 150, 0.8, 0.4), 6, '철통방어'); ring(b, u.x, u.y, 8, '#fbbf24');
        for (let i = 1; i <= 8; i++) b.later(i * 0.75, bb => { if (!u.alive) return; const obs = liveObs(bb, u); bb.friends(u).forEach(a => { if (obs.some(z => Math.hypot(a.x - z.x, a.y - z.y) <= 10)) bb.heal(u, a, a.maxHp * 0.045, '철통방어'); }); });
      } }
  };

  /* ================= 30. 가이아 ================= */
  const shard = (b, u, x, y) => {
    const p = b.clampPos(x, y), z = b.zone({ x: p.x, y: p.y, r: 2, dur: 14, owner: u, kind: 'shard', color: '#a8a29e' });
    const l = (u.mem.sh = (u.mem.sh || []).filter(s => s.until > b.t)); l.push(z); while (l.length > 10) l.shift().until = 0;
  };
  const shardsNear = (b, u, x, y, r) => (u.mem.sh || []).filter(s => s.until > b.t && Math.hypot(s.x - x, s.y - y) <= r);
  const burst = (b, u, s, r, raw, via) => { s.until = 0; ring(b, s.x, s.y, r, '#a8a29e'); b.inCircle(b.foes(u), s.x, s.y, r).forEach(e => hit(b, u, e, 'magic', raw, via, { splash: true })); };
  FD.gaia = {
    id: 'gaia', name: '가이아', role: 'guardian', color: '#84cc16', title: '땅의 정령',
    concept: '"신성한 대지의 힘으로..."',
    stats: { hp: 1100, mp: 240, aspd: 0.75, spd: 7.2, atk: 44, ap: 52, def: 40, res: 40, ten: 0.20, pen: 0.06, ls: 0, range: 7 },
    basic: { type: 'phys', atk: 0.8, ap: 0.3, proj: 'melee' }, ai: { front: true, threat: 1.5 },
    tac: { act: ['basic'], fight: ['coop'], pos: ['front', 'none'] },
    look: { res: 2, pal: { r: '#8a8178', R: '#4a433e', l: '#bdb5aa', k: '#1c1917', o: '#f97316', y: '#fde047', m: '#4d7c0f', g: '#a3e635', G: '#365314', s: '#b0937b', S: '#7c5f4a', b: '#6b5f55', B: '#a49888', K: '#2a2421', H: '#3b3430', w: '#92400e', W: '#5a3416' },
      rows: [
        '.........................lRl....',
        '........l..HHHHHHHH....llrrRl...',
        '..........HHHHHHHHHH...lrrrrrl..',
        '..R......HHHHHHHHHHHH.lryolrrR..',
        '.........HHkkksskkkHH..lrrooyR..',
        '.........HHoyksskyoHH..lrlrrry..',
        '.....lml.bbsssSSsssbb...lyrroRl.',
        'l....grglbbbskkkksbbb.....oryRR.',
        '...llrlrmbBbbkkkkbbBb.....lRoGR.',
        '...mgmrrrRbbBbkkbBbb...lmgmorrRl',
        '..lrRrrGrrbBbbbbbbBb..mgrrrrorRR',
        '.lrrrrrrrrrbBbBbBbblllrlGRrryRR.',
        '.llrrlrrrrRrbBbbbbrrRlRrrrrrRR.l',
        '.lrrrrrrrrrrrbbBbmgmrrryoRrrrR..',
        'RlrrrrrrrRyrrrbbrrmryGrrroooyR..',
        '.lrryrrrRrlorrRKrrrrorrRRRRRR...',
        '.lrrorrRRrrroRryrrrorrRR........',
        '.lrrroR.GmrrooyrRrrroRRR......r.',
        '.lWloR..RrryolroRroryRRR........',
        '.lrWyR..RKoKrrrryorKoKRR........',
        '.wmrWRw.RloyKKKKoKKyRo.R........',
        '.lmWRW..lRrloororrorrRl........y',
        'ylWrRRw.lwwwwwwwoowwwrR....R....',
        '..lWyW..lwwGwwGwyGwwGwR.......l.',
        '.lrRoRllrwWywwwwWwwywWR.........',
        '.lrrrolrrwwowWw.wwwowwR.........',
        '.lrrrrrrrwGwoww.lwowGRR.l.......',
        '.lRrrrRrrrrwoRw.lrowrrRl.......y',
        '..lRRR.lRrrRoRw.lrorrrrR........',
        '.r.....lryomoRR.lRoWmyRR........',
        '.......lRGRooR..lrroorGR....R...',
        '.y.....lrRryrR...loormRR.....y..',
        '.......lrRrlRR...lryrrR.........',
        '.......lryrrRR...lrryrR.........',
        ],
      weapon: '' },
    passive: { name: '가이아 파워', desc: '스킬을 시전할 때마다 주변에 바위 조각을 2개 생성합니다(최대 10개, 14초 유지).',
      onSkill(b, u) { for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28, r = 3 + Math.random() * 6; shard(b, u, u.x + Math.cos(a) * r, u.y + Math.sin(a) * r); } },
      tick(b, u) { u.gauge = { label: '바위조각', val: (u.mem.sh || []).filter(s => s.until > b.t).length, max: 10, color: '#a8a29e' }; } },
    skills: [
      { id: 'ga_s1', name: '지진파', cost: 40, cd: 8, range: 13, sfx: 'aoe', desc: '땅을 쳐서 피해를 주고 기절시킵니다. 근처에 바위 조각이 있으면 폭발해 추가 피해를 줍니다.', plan: foeIn(13),
        cast(b, u, pl) {
          const c = { x: pl.t.x, y: pl.t.y }; ring(b, c.x, c.y, 9, '#84cc16');
          b.inCircle(b.foes(u), c.x, c.y, 9).forEach(e => { hit(b, u, e, 'phys', b.raw(u, 35, 0.75, 0.3), '지진파', { splash: true }); b.cc(u, e, 'stun', 1.0); });
          shardsNear(b, u, c.x, c.y, 14).forEach(s => burst(b, u, s, 6, b.raw(u, 28, 0.3, 0.55), '바위 폭발'));
        } },
      { id: 'ga_s2', name: '땅고르기', cost: 35, cd: 7, range: 10, sfx: 'aoe', desc: '시전 즉시 주변에 피해를 줍니다. 바위 조각이 있으면 사방으로 퍼져 주변에 추가 피해를 줍니다.', plan: anyIn(10),
        cast(b, u) {
          ring(b, u.x, u.y, 10, '#84cc16'); b.inCircle(b.foes(u), u.x, u.y, 10).forEach(e => hit(b, u, e, 'phys', b.raw(u, 28, 0.6, 0.2), '땅고르기', { splash: true }));
          shardsNear(b, u, u.x, u.y, 18).forEach(s => burst(b, u, s, 7, b.raw(u, 22, 0.2, 0.5), '바위 파편'));
        } }
    ],
    ult: { id: 'ga_ult', name: '대지각성', cd: 38, range: 30, sfx: 'aoe', desc: '넓은 범위에 바위를 솟구치게 해 피해를 주고 기절시킵니다. 바위 조각을 대량으로 생성합니다.', plan: (b, u, en) => clusterPick(b, u, en, 30, 15),
      cast(b, u, pl) {
        const c = { x: pl.t.x, y: pl.t.y }; b.zone({ x: c.x, y: c.y, r: 15, dur: 0.9, owner: u, kind: 'warn', color: '#84cc16' });
        b.later(0.9, bb => {
          if (!u.alive) return; ring(bb, c.x, c.y, 15, '#84cc16'); bb.emit({ type: 'star', x: c.x, y: c.y });
          bb.inCircle(bb.foes(u), c.x, c.y, 15).forEach(e => { hit(bb, u, e, 'magic', bb.raw(u, 50, 0.7, 0.8), '대지각성', { splash: true }); bb.cc(u, e, 'stun', 1.4); });
          for (let i = 0; i < 7; i++) { const a = Math.random() * 6.28, r = 2 + Math.random() * 11; shard(bb, u, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r); }
        });
      } }
  };

  /* ================= 중립 보스 (밴픽/도감에는 나오지 않음) ================= */
  const dummyUlt = { id: 'boss_ult', name: '-', cd: 9999, desc: '', plan: () => null, cast() {} };
  CONFIG.bossDefs = {
    golem: { id: 'golem', name: '코스믹 골렘', role: 'guardian', color: '#67e8f9', icon: '💠', title: '중반 보스', boss: true, scale: 1.9, slam: { every: 6, r: 10, raw: 60, k: 0.9 },
      stats: { hp: 1100, mp: 100, aspd: 0.8, spd: 0, atk: 46, ap: 0, def: 26, res: 26, ten: 0, pen: 0, ls: 0, range: 9 },
      basic: { type: 'phys', atk: 1, ap: 0, proj: 'melee' }, ai: { front: true, threat: 0.7 }, skills: [], ult: dummyUlt,
      look: { pal: { s: '#6b7280', S: '#374151', l: '#9ca3af', c: '#67e8f9', C: '#0891b2', e: '#fde047', k: '#111827' },
        rows: [
        '......cccc......',
        '....ccCccCcc....',
        '..ssssllllssss..',
        '.ssllllllllllss.',
        '.slleslkklsells.',
        '.sllllkkkklllls.',
        '..sssSSkkSSsss..',
        '.sccsssSSsssccs.',
        'sCcssSsSSsSsscCs',
        'sslllsSSSSslllss',
        'slllcsSSSSscllls',
        'sslllsSSSSslllss',
        '.ssllsSSSSsllss.',
        '.sssssSSSSsssss.',
        '..sssSSSSSSsss..',
        '..ssSSSSSSSSss..',
        '.sssS..SS..Ssss.',
        '.kkks......skkk.'] } },
    titan: { id: 'titan', name: '공허의 군주', role: 'guardian', color: '#a855f7', icon: '👁', title: '후반 보스', boss: true, scale: 2.3, slam: { every: 6, r: 11, raw: 70, k: 0.9 },
      stats: { hp: 1300, mp: 100, aspd: 0.85, spd: 0, atk: 60, ap: 0, def: 30, res: 30, ten: 0, pen: 0.1, ls: 0, range: 10 },
      basic: { type: 'phys', atk: 1, ap: 0, proj: 'melee' }, ai: { front: true, threat: 0.7 }, skills: [], ult: dummyUlt,
      look: { pal: { v: '#4c1d95', V: '#2e1065', p: '#7c3aed', r: '#ef4444', R: '#7f1d1d', k: '#0b0220', h: '#e9d5ff', y: '#fde047' },
        rows: [
        'h..............h',
        'hh............hh',
        'hhv..........vhh',
        '.hvVVVVVVVVVVvh.',
        '..vppppVVppppv..',
        '..vprkrVVrkrpv..',
        '..vpppkVVkpppv..',
        '...vpkkkkkkpv...',
        'hh.VVVVVVVVVV.hh',
        'hvvVppppppppVvvh',
        'vppvprRppRrpvppv',
        'vpVpprRppRrppVpv',
        'vpVpppRppRpppVpv',
        '.vVpppRppRpppVv.',
        '..vVppppppppVv..',
        '..vVVppvvppVVv..',
        '.vvk.vvkkvv.kvv.',
        '.VVk.VVkkVV.kVV.'] } }
  };

  const NEW = ['salamander', 'plasma', 'necro', 'rusellaster', 'aozu', 'harvest', 'minotaur', 'rescue', 'zombie', 'alcaba', 'ananta', 'giant', 'etech', 'dt', 'kum', 'gaia'];
  NEW.forEach(id => { CONFIG.fighterOrder.push(id); const f = FD[id], R = CONFIG.roles[f.role]; f.icon = R.icon; f.roleName = R.name; });
})();
