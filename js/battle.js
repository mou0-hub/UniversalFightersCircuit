/* battle.js — 틱 기반 자동 전투 엔진 (DOM 의존 없음: 화면 전투/백그라운드 시뮬 공용)
   파이터마다 고유 패시브/스킬/궁극기(fighters.js)를 가지며, 엔진은 아래 공용 API 를 제공합니다.
   b.deal / b.cc / b.buff / b.heal / b.shield / b.knock / b.blink / b.slide / b.zone / b.later / b.inCircle / b.inCone / b.inLine ...
   시간 단위는 API 에서 모두 "초", 내부 틱은 50ms(20틱=1초). */

const Battle = (() => {
  const TPS = 20;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const segDist = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1, k = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
    return Math.hypot(px - (x1 + dx * k), py - (y1 + dy * k));
  };
  const nearestOf = (u, list) => list.reduce((a, b) => (dist(u, a) <= dist(u, b) ? a : b));
  const lowestOf = list => list.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b));
  const ticks = s => Math.max(1, Math.round(s * TPS));
  const STRUCT_DEF = { id: 'obelisk', name: '오벨리스크', role: 'guardian', color: '#fbbf24', icon: '🗿', struct: true,
    stats: { hp: 1, mp: 0, aspd: 0.01, spd: 0, atk: 0, ap: 0, def: 30, res: 30, ten: 0, pen: 0, ls: 0, range: 0 },
    basic: { type: 'phys', atk: 0, ap: 0, proj: 'none' }, ai: { threat: 0.7 }, skills: [], ult: { id: 'struct_ult', name: '-', cd: 9999, desc: '', plan: () => null, cast() {} } };

  class Battle {
    /* teams: [{name, fighters:[id x3], tactics:[...]}, {...}]   opts.manual: [bool,bool] 해당 팀 궁극기를 수동 발동 */
    constructor(teams, rule, onEvent, opts) {
      this.cfg = CONFIG.battle; this.rule = rule || null; this.onEvent = onEvent || null;
      this.manual = (opts && opts.manual) || [false, false];
      this.t = 0; this.over = false; this.res = null; this.teams = teams; this.units = []; this.zones = []; this.timers = [];
      const MC = CONFIG.battle.map;
      this.map = {
        zones: MC.zones.map(z => ({ ...z })),
        pods: MC.pods.map(p => ({ ...p, readyAt: 0 })), obstacles: MC.obstacles.slice()
      };
      this.score = [0, 0]; this.capTime = [0, 0]; this.cores = []; this.coreSeq = 0; this.waveN = 0; this.nextWave = 0; this.suddenWinner = null; this.teamBuff = [null, null, null]; this.sudden = false; this.suddenAt = 0; this.suddenLoser = null; this.bossKills = [0, 0];
      this.rec = { kills: [], pts: [], boss: [], first: null, flips: [], lead: 0, suddenAt: 0, killVia: null, cores: [], orders: [] };   // 경기 후 분석용 기록(추가만, 전투에 영향 없음)
      this.strat = [0, 1].map(i => this.readStrat(teams[i].strategy)); this.cur = [null, null]; this.teamDir = ['auto', 'auto'];
      this.ord = [null, null]; this.cmdAt = [0, 0]; this.aiAt = [0, 0]; this.autoCmd = [0, 1].map(i => teams[i].cmd || (opts && opts.cmd && opts.cmd[i]) || null); this.cp = [0, 1].map(() => ({ v: CONFIG.orders.cpStart, prog: 0 }));
      this.aiInit();
      const lairs = MC.lairs.slice();
      this.initAxis(); this.initNav(); this.initCores();
      this.bossPlan = (MC.bosses || []).map((b, i) => ({ ...b, lair: lairs[i % lairs.length], unit: null, spawned: false, warned: false, atTick: b.at != null ? ticks(b.at) : null }));
      teams.forEach((tm, ti) => tm.fighters.forEach((id, i) => this.units.push(this.makeUnit(CONFIG.fighters[id], ti, i, tm.fighters.length, tm.tactics && tm.tactics[i], (tm.brains && tm.brains[i]) || tm.brain, tm.moods && tm.moods[i]))));
      for (const u of this.units) { const p = u.f.passive; if (p && p.init) p.init(this, u); }
    }

    makeUnit(F, team, i, n, tactic, brainId, mood) {
      const s = F.stats, ru = this.rule || {}, A = this.cfg.arena, role = { ...F.ai, range: s.range };
      const spp = this.spawnPt(team, i), x = spp.x, y = spp.y;
      /* 선수 폼/멘탈 — AI(brain) 행동에만 영향. 전투 능력치에는 반영하지 않음 */
      const BR = CONFIG.brain, SK = BR.stat, brainKey = BR.levels[brainId] ? brainId : BR.default, baseBr = BR.levels[brainKey];
      const psk = (mood && mood.sk) || Pros.typical(brainKey);           // 선수 세부 능력치 (없으면 등급 평균)
      const nz = id => clamp(((psk[id] != null ? psk[id] : SK.center) - SK.center) / SK.range, -1, 1);
      /* 클러치·침착성: 폼/멘탈/트러블/태업의 '나쁜 쪽' 영향을 AI 행동(brain)에서만 줄이거나 키웁니다. 능력치(공격·방어 등) 계산에는 쓰이지 않습니다 */
      const gk = SK.fx.clutch && SK.fx.clutch[0] ? SK.fx.clutch[0][2] : 0, guard = clamp(nz('clutch') * gk, SK.limits.moodGuard[0], SK.limits.moodGuard[1]), pen = 1 - guard;
      const form = mood && mood.form != null ? mood.form : 55;
      const mental = mood && mood.mental != null ? mood.mental : 70;
      const trouble = mood && mood.trouble != null ? mood.trouble : 0;
      const slack = mood && mood.slack != null ? mood.slack : 0;
      const fN0 = (form - 50) / 50, mN0 = (mental - 50) / 50, tN0 = trouble / 100, sN0 = slack / 100;
      let fN = fN0, mN = mN0; const tN = tN0 * pen, sN = sN0 * pen;                                        // AI 행동 보정용
      if (fN < 0) fN *= pen; if (mN < 0) mN *= pen;
      /* 전투 능력치는 폼/멘탈/트러블/태업에 영향받지 않음 (AI 판단만 보정) */
      const offMul = 1;
      const defMulM = 1;
      const spdMulM = 1;
      const aspdMulM = 1;
      const u = {
        id: team + '-' + i, f: F, ch: F, team, role, x, y, px: x, py: y,
        atk: s.atk * (ru.atkMul || 1) * offMul, ap: s.ap * (ru.apMul || 1) * offMul,
        def: s.def * (ru.defMul || 1) * defMulM, res: s.res * (ru.defMul || 1) * defMulM,
        spd: s.spd / TPS * (ru.spdMul || 1) * spdMulM, aspd: s.aspd / TPS * (ru.aspdMul || 1) * aspdMulM,
        ten: s.ten, pen: s.pen, ls: s.ls, crit: s.crit || 0, critDmg: s.critDmg || 1.5, mpMul: ru.mpMul || 1,
        cd: rnd(0.2, 0.8), target: null, retarget: 0, alive: true, facing: team === 0 ? 1 : -1, side: Math.random() < 0.5 ? 1 : -1,
        tac: this.readTac(tactic), hitT: -1e9, hurtT: -1e9, hitBy: null, form: F.form0 || null, scale: 1, glow: null, gauge: null,
        brainId: brainKey, brain: null, ignore: null, chase: null, caution: 0, cautionOff: 0, waitSince: 0,
        rdy: {}, fb: null, fbCd: 0, stuck: 0, actT: 0, forceGo: 0, detour: null, lastOff: 0, lastOffT: 0, intent: -1,
        st: [], cds: {}, rc: {}, bm: [], ultG: 0, ultCd: 0, mem: {}, deaths: 0, respawnAt: 0, regroupUntil: 0, goal: null, dmg: 0, healed: 0, kills: 0, fxHit: -1e9, fxAtk: -1e9, fxDead: 1e12,
        mood: { form, mental, trouble, slack }, taken: 0, skN: 0, ultN: 0, carry: [], depProg: 0, depAt: '', deliv: 0, coresIn: 0, dpts: 0
      };
      /* brain 은 공유 객체를 건드리지 않도록 복사 후 폼/멘탈/트러블 → 세부 능력치 순으로 보정 */
      u.brain = Object.assign({}, SK.defaults, baseBr);
      u.brain.skillPatience = Math.max(0.15, baseBr.skillPatience * (1 + fN * 0.22 + mN * 0.12 - tN * 0.25));
      u.brain.retreatHp = clamp((baseBr.retreatHp || 0.3) - mN * 0.06 + tN * 0.08 + (fN < 0 ? -fN * 0.03 : 0), 0.1, 0.55);
      u.brain.chaseT = Math.max(1.2, (baseBr.chaseT || 4) * (1 + tN * 0.4 - mN * 0.12 + (fN < 0 ? -fN * 0.1 : 0)));
      u.brain.leash = Math.max(18, (baseBr.leash || 32) * (1 + tN * 0.2 - mN * 0.08));
      u.brain.ratio = Math.max(1.05, (baseBr.ratio || 1.6) * (1 - tN * 0.28 + sN * 0.12));
      u.brain.recastHold = Math.max(0.2, baseBr.recastHold * (1 + fN * 0.15 + mN * 0.1 - tN * 0.2));
      for (const id in SK.fx) {
        const n = nz(id);
        for (const [k, mode, w] of SK.fx[id]) u.brain[k] = mode === 'mul' ? u.brain[k] * (1 + w * n) : u.brain[k] + w * n;
      }
      for (const k in SK.limits) u.brain[k] = clamp(u.brain[k], SK.limits[k][0], SK.limits[k][1]);
      const DG = SK.dg, jn = clamp(nz('judge') + (Math.min(0, mN) * 0.4 + Math.min(0, fN) * 0.2) * pen, -1, 1), cn = nz('clutch'), on = nz('obj'), tmn = nz('team'), pn = nz('posn');
      u.dg = { j: jn, reach: DG.reach * clamp(1 + DG.reachJ * jn + DG.reachO * on, 0.5, 1.6), team: tmn, posn: pn, bias: 0, biasAt: 0 };
      u.sn = { j: jn, c: cn, o: on, t: tmn, p: pn, r: nz('react'), u: nz('ult'), a: nz('aim'), f: nz('fight') };
      u.dgCore = null; u.dgUntil = 0; u.dgCd = 0;
      const obj = psk.obj != null ? psk.obj : SK.center;
      if (obj >= SK.objHi) u.brain.ensureBoss = true; else if (obj <= SK.objLo) u.brain.ensureBoss = false;
      if (mood && mood.fb && typeof Feedback !== 'undefined') Feedback.apply(u, mood.fb);
      u.hp = u.maxHp = u.hpShow = Math.round(s.hp * this.cfg.hpScale * (ru.hpMul || 1));
      u.mpMax = s.mp; u.mp = s.mp * this.cfg.mana.startRatio;
      const all = F.forms ? [].concat(...Object.values(F.forms)) : F.skills;
      all.forEach(k => { u.cds[k.id] = Math.round(k.cd * TPS * this.cfg.skillStartCdRatio); });
      this.setUlt(u, 100 * this.cfg.ultStart);
      return u;
    }
    /* 궁극기 게이지(0~100): 기본 공격·스킬 사용으로 충전(ult.timed 궁은 cd초마다 시간으로 충전 — 모드변환 궁). ultCd는 HUD·기존 판단식 호환용 남은량(0이면 준비 완료) */
    setUlt(u, g) { u.ultG = Math.max(0, Math.min(100, g)); u.ultCd = u.ultG >= 100 ? 0 : Math.max(1, Math.round((1 - u.ultG / 100) * ticks(u.f.ult.cd))); }
    ultGain(u, v) { if (u.f && u.f.ult && !u.f.ult.timed && u.alive) this.setUlt(u, u.ultG + v * this.cfg.ultRefCd / u.f.ult.cd * ((this.cfg.ultCharge && this.cfg.ultCharge[u.f.id]) || 1)); }      // 센 궁극기(cd 큼)일수록 천천히 충전 + 파이터별 배율(CONFIG.battle.ultCharge)
    skillsOf(u) { const F = u.f; return { list: F.forms ? F.forms[u.form] : F.skills, ult: F.ult }; }

    readTac(raw) {
      const o = {};
      for (const c of CONFIG.tactics.categories) {
        const v = (raw && raw[c.id]) || [c.neutral, 4], id = c.options.some(x => x.id === v[0]) ? v[0] : c.neutral;
        const lv = clamp(Math.round(v[1]) || 1, 1, CONFIG.tactics.maxLevel);
        o[c.id] = id === c.neutral ? null : id; o[c.id + 'L'] = lv; o[c.id + 'S'] = lv / CONFIG.tactics.maxLevel;
      }
      return o;
    }

    readStrat(raw) {
      const o = {};
      for (const c of CONFIG.tactics.team) {
        const v = (raw && raw[c.id]) || [c.neutral, 4], id = c.options.some(x => x.id === v[0]) ? v[0] : c.neutral;
        const lv = clamp(Math.round(v[1]) || 1, 1, CONFIG.tactics.maxLevel);
        o[c.id] = id; o[c.id + 'L'] = lv; o[c.id + 'S'] = lv / CONFIG.tactics.maxLevel;
      }
      return o;
    }

    emit(ev) { ev.t = this.t; if (this.onEvent) this.onEvent(ev); }

    /* ---------- 조회 도우미 (스킬 코드에서 사용) ---------- */
    sec(s) { return ticks(s); }
    dist(a, b) { return dist(a, b); }
    nearest(u, list) { return list.length ? nearestOf(u, list) : null; }
    lowest(list) { return list.length ? lowestOf(list) : null; }
    hidden(u) { return u.st.some(s => s.hidden || s.stealth); }
    gone(u) { return u.st.some(s => s.hidden); }          // 완전 사라짐(상승 등). 은신(stealth)은 행동·제출·충돌에 영향 없음
    foes(u) { return this.units.filter(e => e.team !== u.team && e.alive && !this.hidden(e)); }
    friends(u) { return this.units.filter(a => a.team === u.team && a.alive && !a.struct); }
    inCircle(list, x, y, r) { return list.filter(e => Math.hypot(e.x - x, e.y - y) <= r + 1); }
    inLine(list, x1, y1, x2, y2, w) {
      let hit = list.filter(e => segDist(e.x, e.y, x1, y1, x2, y2) <= w + 1.2);
      const ss = hit.filter(e => e.struct);                  // 적 구조물(오벨리스크)이 길을 막으면 그 뒤쪽은 맞지 않음
      if (ss.length) { const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1, k = e => ((e.x - x1) * dx + (e.y - y1) * dy) / l2, lim = Math.min(...ss.map(k)); hit = hit.filter(e => k(e) <= lim + 1e-6); }
      return hit;
    }
    inCone(list, u, tx, ty, range, half) {
      const a = Math.atan2(ty - u.y, tx - u.x);
      const out = list.filter(e => {
        const d = Math.hypot(e.x - u.x, e.y - u.y); if (d > range + 1) return false; if (d < 1.5) return true;
        let da = Math.atan2(e.y - u.y, e.x - u.x) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
        return Math.abs(da) <= half;
      });
      const ss = out.filter(e => e.struct); if (!ss.length) return out;     // 구조물 뒤에 있는 대상은 부채꼴 공격도 맞지 않음
      return out.filter(e => e.struct || !ss.some(s => Math.hypot(s.x - u.x, s.y - u.y) < Math.hypot(e.x - u.x, e.y - u.y) && segDist(s.x, s.y, u.x, u.y, e.x, e.y) <= 3.2));
    }
    dir(u, t) { const d = Math.hypot(t.x - u.x, t.y - u.y) || 1; return { x: (t.x - u.x) / d, y: (t.y - u.y) / d }; }
    has(u, key) { return u.st.some(s => s.key === key); }
    clampPos(x, y) { const A = this.cfg.arena, p = this.pushOut(clamp(x, 2, A.w - 2), clamp(y, 5, A.h - 2)); return { x: clamp(p.x, 2, A.w - 2), y: clamp(p.y, 5, A.h - 2) }; }
    /* ---------- 장애물 ---------- */
    inObs(x, y, pad) {
      pad = pad === undefined ? 1.8 : pad;
      for (const o of this.map.obstacles) {
        if (o.t === 'c') { if (Math.hypot(x - o.x, y - o.y) < o.r + pad) return o; }
        else if (x > o.x - pad && x < o.x + o.w + pad && y > o.y - pad && y < o.y + o.h + pad) return o;
      }
      return null;
    }
    pushOut(x, y) {
      for (let k = 0; k < 3; k++) {
        const o = this.inObs(x, y); if (!o) break;
        if (o.t === 'c') { const d = Math.hypot(x - o.x, y - o.y) || 0.01, r = o.r + 1.9; x = o.x + (x - o.x) / d * r; y = o.y + (y - o.y) / d * r; }
        else {
          const pad = 1.9, dl = x - (o.x - pad), dr = o.x + o.w + pad - x, dt = y - (o.y - pad), db = o.y + o.h + pad - y, m = Math.min(dl, dr, dt, db);
          if (m === dl) x = o.x - pad; else if (m === dr) x = o.x + o.w + pad; else if (m === dt) y = o.y - pad; else y = o.y + o.h + pad;
        }
      }
      return { x, y };
    }

    /* ---------- 유효 스탯 ---------- */
    eff(u, k) {
      let v = u[k]; const T = u.tac, p = u.f.passive;
      if (T.act === 'rush') { if (k === 'spd') v *= 1 + CONFIG.tactics.p.rushSpd * T.actL; else if (k === 'def') v *= 1 - CONFIG.tactics.p.rushDef * T.actL; }
      for (const s of u.st) { if (s.mul && s.mul[k]) v *= s.mul[k]; if (s.add && s.add[k]) v += s.add[k]; }
      const tb = this.teamBuff[u.team];
      if (tb && tb.until > this.t) { if (tb.mul && tb.mul[k]) v *= tb.mul[k]; if (tb.add && tb.add[k]) v += tb.add[k]; }
      if (p && p.stat) v = p.stat(this, u, k, v);
      if (k === 'spd') for (const s of u.st) if (s.slow) v *= 1 - s.slow;
      if (k === 'spd' && u.carry && u.carry.length && !u.st.some(s => s.noCarrySlow)) { const K = CONFIG.battle.map.core; v *= 1 - Math.min(K.slowMax, this.coreSlots(u) * K.slowPer); }
      return v;
    }
    gain(u, v) { u.mp = Math.min(u.mpMax, u.mp + v * (u.st.some(s => s.manaMul) ? CONFIG.statusFx.poison : 1)); }

    /* ---------- 상태이상 / 버프 ---------- */
    addStatus(src, t, st) {
      if (!t.alive) return null;
      const old = t.st.find(s => s.key === st.key);
      if (old && st.cc && old.dur > st.dur && (old.slow || 0) >= (st.slow || 0)) return old;
      t.st = t.st.filter(s => s.key !== st.key); t.st.push(st);
      if (!old && !st.quiet) this.emit({ type: 'status', src, dst: t, name: st.name, good: st.good !== false });
      return st;
    }
    /* cc: 상태이상(둔화/기절/속박/침묵/중독/화상/빙결/공포/경직). 강인함으로 지속시간 단축 */
    cc(src, t, key, dur, o) {
      o = o || {}; const def = CONFIG.status[key], F = CONFIG.statusFx;
      if (!t.alive || !def) return null;
      if (def.cc && t.st.some(x => x.ccImmune)) return null;
      if (def.cc) dur *= 1 - clamp(this.eff(t, 'ten'), 0, 0.85);
      if (dur < 0.08) return null;
      const st = { key, name: def.name, good: false, cc: def.cc, dur: ticks(dur), src, quiet: !!o.quiet };
      if (key === 'slow') st.slow = o.amt || F.slow;
      else if (key === 'freeze') { st.slow = F.freezeSlow; st.dmgOut = F.freezeDmg; }
      else if (key === 'poison') st.manaMul = F.poison;
      else if (key === 'burn') st.healMul = F.burn;
      else if (key === 'stun') st.stun = true;
      else if (key === 'root') st.root = true;
      else if (key === 'silence') st.silence = true;
      else if (key === 'fear') st.fear = true;
      else if (key === 'stagger') st.stagger = true;
      else if (key === 'bleed') { st.bleed = true; st.dmgIn = 1 + F.bleed; }
      else if (key === 'blind') st.blind = true;
      return this.addStatus(src, t, st);
    }
    /* buff: 임의 버프/디버프. o = {name, good, mul:{stat:배율}, add:{stat:가산}, f:{플래그...}, quiet, src} */
    buff(t, key, dur, o) {
      o = o || {};
      const st = Object.assign({ key, name: o.name || key, good: o.good !== false, dur: ticks(dur), mul: o.mul, add: o.add, quiet: o.quiet }, o.f || {});
      return this.addStatus(o.src || t, t, st);
    }
    stunned(u) { return u.st.some(s => s.stun || s.knock); }
    rooted(u) { return u.st.some(s => s.root || s.stagger || s.channel || s.stun || s.knock); }
    tickStatus(u) {
      for (const s of u.st) {
        s.dur--;
        if (s.knock) { const n = this.clampPos(u.x + s.vx, u.y + s.vy); u.x = n.x; u.y = n.y; }
        if (s.regen) this.recover(u, u.maxHp * s.regen / TPS);
      }
      const gone = u.st.filter(s => s.dur <= 0 || (s.shield !== undefined && s.shield <= 0));
      if (gone.length) { u.st = u.st.filter(s => !gone.includes(s)); gone.forEach(s => { if (s.onEnd) s.onEnd(this, u, s); }); }
    }

    /* ---------- 피해 ---------- */
    /* 원피해 계산: base + atk×계수 + ap×계수 (효과 스탯 기준) */
    raw(u, base, kAtk, kAp) { return (base || 0) + (kAtk || 0) * this.eff(u, 'atk') + (kAp || 0) * this.eff(u, 'ap'); }
    /* o: {type:'phys'|'magic'|'true', raw, via, skill, basic, splash, path, dot, proj, noLeech, noPassive} */
    deal(src, t, o) {
      if (!t.alive) return { dealt: 0, absorbed: 0, kill: false };
      const type = o.type || 'phys', cfg = this.cfg;
      let raw = o.raw * rnd(1 - cfg.damage.variance, 1 + cfg.damage.variance), didCrit = !!o.crit;      // o.crit 은 표시용(이미 배율 적용), 기본 공격/rollCrit 스킬은 치명타 확률로 판정
      if (!o.crit && (o.basic || o.rollCrit) && Math.random() < Math.min(1, this.eff(src, 'crit'))) { raw *= this.eff(src, 'critDmg'); didCrit = true; }
      const sp = src.f.passive;
      if (o.skill && sp && sp.skillMul) raw *= sp.skillMul(this, src, o);
      if (sp && sp.dmgMul) raw *= sp.dmgMul(this, src, t, o);
      for (const s of src.st) if (s.dmgOut) raw *= s.dmgOut;
      let dmg = raw;
      if (type !== 'true') {
        const pen = clamp(this.eff(src, 'pen'), 0, 0.9), armor = Math.max(0, this.eff(t, type === 'magic' ? 'res' : 'def') * (1 - pen));
        dmg = raw * 100 / (100 + armor);
      }
      const base = { type: 'attack', src, dst: t, hit: true, dtype: type, via: o.via, splash: o.splash, path: o.path, dot: o.dot, proj: o.proj || 'none', basic: o.basic, crit: didCrit };
      if (t.st.some(s => s.invuln)) { this.emit({ ...base, dmg: 0, immune: true }); return { dealt: 0, absorbed: 0, kill: false, immune: true }; }
      if (t.st.some(s => s.projBlock) && ((o.basic && o.proj && o.proj !== 'melee' && o.proj !== 'none') || o.path)) { this.emit({ ...base, dmg: 0, blocked: true }); return { dealt: 0, absorbed: 0, kill: false, blocked: true }; }     // 투사체 방어(마풍벽)
      if (t.st.some(s => s.block)) { this.emit({ ...base, dmg: 0, blocked: true }); return { dealt: 0, absorbed: 0, kill: false, blocked: true }; }
      for (const s of t.st) if (s.dmgIn && !(o.pierce && s.dmgIn < 1)) dmg *= s.dmgIn;     // pierce: 피해감소 효과 무시
      dmg = Math.max(1, Math.round(dmg));
      const bz = o.pierce ? null : this.zones.find(z => z.kind === 'barrier' && z.team === t.team && z.hpS > 0 && Math.hypot(t.x - z.x, t.y - z.y) <= z.r);
      if (bz) { const a = Math.min(bz.hpS, dmg); bz.hpS -= a; dmg -= a; if (bz.hpS <= 0) bz.until = 0; if (dmg <= 0) { this.emit({ ...base, dmg: 0, blocked: true }); return { dealt: 0, absorbed: a, kill: false, blocked: true }; } }
      let rest = dmg, absorbed = 0;
      for (const s of t.st) if (!o.pierce && s.shield > 0 && rest > 0) { const a = Math.min(s.shield, rest); s.shield -= a; rest -= a; absorbed += a; }
      const tpp = t.f.passive; if (tpp && tpp.preHit && rest > 0) rest = tpp.preHit(this, t, rest, src, o);
      t.hp -= rest; src.dmg += rest; t.taken = (t.taken || 0) + rest;
      if (rest > 0 && !t.struct) { const h = t.dmgHist || (t.dmgHist = []); h.push(this.t, rest); }      // 최근 피해 기록 (제출 이탈 판단용)
      if (src !== t) { t.hitT = this.t; t.hitBy = src; if (!o.dot) { t.hurtT = this.t; this.gain(src, cfg.mana.onHit); } }
      this.gain(t, cfg.mana.onHurt);
      let kill = false;
      if (t.hp <= 0) { t.hp = 0; t.alive = false; kill = true; if (!t.struct) src.kills++; }
      const res = { dealt: rest, absorbed, kill, raw: dmg, type };
      this.emit({ ...base, dmg: rest, kill, absorbed });
      if (kill) { this.rec.killVia = o.via || (o.basic ? '기본 공격' : ''); this.onDeath(src, t); }
      /* 생명력 흡수 */
      const ls = this.eff(src, 'ls');
      if (ls > 0 && rest > 0 && src.alive && !o.noLeech && !t.struct) {
        const amt = Math.round(this.recover(src, rest * ls * (o.basic ? 1 : 0.6)));
        if (amt > 0) { src.healed += amt; this.emit({ type: 'heal', src, dst: src, amt, drain: true }); }
      }
      if (!o.noPassive && !t.struct) {
        if (sp && sp.onDealt) sp.onDealt(this, src, t, res, o);
        const tp = t.f.passive; if (tp && tp.onHurt && t.alive) tp.onHurt(this, t, src, res, o);
      }
      return res;
    }
    /* 처형: 방어/보호막 무시하고 즉사 (무적/막기는 무효) */
    execute(src, t, via) {
      if (!t.alive) return { kill: false };
      if (t.team === 2) return this.deal(src, t, { type: 'true', raw: t.maxHp * 0.1, via, skill: true });     // 보스는 처형 면역(최대 체력 10% 고정 피해로 대체)
      if (t.st.some(s => s.invuln || s.block)) { this.emit({ type: 'attack', src, dst: t, hit: true, dmg: 0, immune: true, via }); return { kill: false }; }
      const d = t.hp; t.hp = 0; t.alive = false; src.dmg += d; src.kills++;
      this.emit({ type: 'attack', src, dst: t, hit: true, dmg: Math.round(d), dtype: 'true', via, kill: true, execute: true });
      this.rec.killVia = via || '';
      this.onDeath(src, t);
      return { kill: true, dealt: d };
    }

    /* ---------- 치유 / 보호막 ---------- */
    healFactor(a) { let f = 1; for (const s of a.st) if (s.healMul !== undefined) f *= s.healMul; return Math.max(0, f); }
    recover(a, amt) { const got = Math.min(amt * this.healFactor(a), a.maxHp - a.hp); if (got > 0) a.hp += got; return Math.max(0, got); }
    heal(src, a, amt, via) {
      if (!a.alive) return 0;
      const f = this.healFactor(a), got = Math.min(Math.round(amt * f), Math.round(a.maxHp - a.hp));
      if (got <= 0) return 0;
      a.hp = Math.min(a.maxHp, a.hp + got); src.healed += got;
      this.emit({ type: 'heal', src, dst: a, amt: got, via, reduced: f < 1 });
      return got;
    }
    shield(src, a, amt, dur, via) {
      if (!a.alive) return;
      this.addStatus(src, a, { key: 'shield_' + via, name: via + ' 보호막', good: true, dur: ticks(dur), shield: Math.round(amt) });
    }

    /* ---------- 이동 연출 ---------- */
    blink(u, x, y) {                       // 순간이동
      const ox = u.x, oy = u.y, p = this.clampPos(x, y); u.x = p.x; u.y = p.y; u.px = u.x; u.py = u.y;
      this.emit({ type: 'move', src: u, x1: ox, y1: oy, x2: u.x, y2: u.y, color: u.f.color });
    }
    slide(u, x, y) {                       // 빠르게 미끄러지는 이동 (장애물에 막히면 그 앞에서 멈춤)
      const ox = u.x, oy = u.y, dx = x - ox, dy = y - oy, n = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
      let nx = ox, ny = oy;
      for (let i = 1; i <= n; i++) { const qx = ox + dx * i / n, qy = oy + dy * i / n; if (this.inObs(qx, qy)) break; nx = qx; ny = qy; }
      const p = this.clampPos(nx, ny); u.x = p.x; u.y = p.y;
      this.emit({ type: 'move', src: u, x1: ox, y1: oy, x2: u.x, y2: u.y, color: u.f.color });
    }
    knock(src, t, d, from) {               // 넉백: 짧은 시간 밀려나며 행동 불가
      if (!t.alive || t.st.some(s => s.invuln || s.ccImmune)) return;
      const o = from || src, dd = Math.hypot(t.x - o.x, t.y - o.y) || 1, n = 7;
      const vx = (t.x - o.x) / dd * d / n, vy = (t.y - o.y) / dd * d / n;
      this.addStatus(src, t, { key: 'knock', name: '넉백', good: false, dur: n, knock: true, vx, vy, src });
    }
    later(sec, fn) { this.timers.push({ at: this.t + ticks(sec), fn }); }
    /* zone: {x,y,r,dur,owner,kind,color,every(초),onTick(z,b),follow} */
    zone(o) {
      const z = Object.assign({ team: o.owner ? o.owner.team : -1, t0: this.t, kind: 'fog', color: '#a35bff' }, o);
      z.until = this.t + ticks(o.dur); z.everyT = o.every ? ticks(o.every) : 0; this.zones.push(z); return z;
    }
    coreSlots(u) { return u.carry.reduce((s, c) => s + c.slots, 0); }
    coreValue(u) { return u.carry.reduce((s, c) => s + c.value, 0); }
    newCore(type, x, y, lockSec, known) {
      const d = CONFIG.battle.map.core[type];
      const c = { id: ++this.coreSeq, x, y, type, value: d.value, slots: d.slots, lockUntil: lockSec ? this.t + ticks(lockSec) : 0, known: known ? [true, true] : [false, false] };
      this.cores.push(c); return c;
    }
    spawnOk(x, y) {
      const C = CONFIG.battle.map.core.spawnClear, A = this.cfg.arena;
      if (x < 8 || x > A.w - 8 || y < 10 || y > A.h - 10 || this.inObs(x, y, C.obs)) return false;
      for (const a of this.axis.slice(0, 2)) if (Math.hypot(x - a.hx, y - a.hy) < C.base) return false;
      for (const z of this.map.zones) { const lim = z.hub ? C.pit : z.deposit ? C.deposit : 0; if (lim && Math.hypot(x - z.x, y - z.y) < lim) return false; }
      return true;
    }
    initCores() {
      const K = CONFIG.battle.map.core, A = this.cfg.arena, h = this.axis[0];
      this.nextWave = ticks(K.wave.every);
      for (let n = 0; n < K.startSmall; n++) for (let k = 0; k < 60; k++) {
        const a = rnd(0, Math.PI * 2), r = rnd(K.startRing[0], K.startRing[1]), x = h.hx + Math.cos(a) * r, y = h.hy + Math.sin(a) * r;
        if (this.spawnOk(x, y) && this.spawnOk(A.w - x, A.h - y)) { this.newCore('small', x, y, 0, false); this.newCore('small', A.w - x, A.h - y, 0, false); break; }
      }
    }
    waveTick(K) {
      const W = K.wave;
      if (this.t < this.nextWave) return;
      const final = (this.cfg.maxTicks - this.t) / TPS <= W.finalSec, A = this.cfg.arena;
      this.nextWave = this.t + ticks(W.every * (final ? W.finalEveryMul : 1));
      if (this.cores.length + W.count > W.max) return;
      this.waveN++;
      for (let n = 0; n < W.count; n += 2) {
        let p = null;
        for (let k = 0; k < 60 && !p; k++) {
          const x = rnd(10, A.w - 10), y = rnd(12, A.h - 12);
          if (this.spawnOk(x, y) && this.spawnOk(A.w - x, A.h - y)) p = { x, y };
        }
        if (!p) continue;
        this.newCore('small', p.x, p.y, 0, false);
        this.newCore('small', A.w - p.x, A.h - p.y, 0, false);
      }
    }
    dropCores(u) {
      const K = CONFIG.battle.map.core, n = u.carry.length;
      u.carry.forEach((c, i) => {
        const a = Math.PI * 2 * i / n + Math.random() * 0.8, r = n > 1 ? K.scatterR * (0.5 + Math.random() * 0.5) : 0, p = this.clampPos(u.x + Math.cos(a) * r, u.y + Math.sin(a) * r);
        c.x = p.x; c.y = p.y; c.lockUntil = this.t + ticks(K.lockSec); c.known = [true, true]; this.cores.push(c);
      });
      this.rec.cores.push({ t: this.t, kind: 'drop', team: u.team, n });
      this.emit({ type: 'drop', team: u.team, unit: u, n, x: u.x, y: u.y });
      u.carry = []; u.depProg = 0; u.depAt = ''; u.bail = null; u.bailN = 0;
    }
    tickCores() {
      const K = CONFIG.battle.map.core, us = this.units.filter(u => u.team < 2 && u.alive && !u.struct && !this.gone(u));
      if (!this.sudden) this.waveTick(K);
      if (this.t % 3 === 0) for (const c of this.cores) for (let i = 0; i < 2; i++) if (!c.known[i] && us.some(u => u.team === i && Math.hypot(u.x - c.x, u.y - c.y) <= K.senseR * (1 + CONFIG.brain.stat.dg.senseO * (u.sn ? u.sn.o : 0)))) c.known[i] = true;
      for (const c of this.cores.slice()) {
        if (c.lockUntil > this.t) continue;
        let best = null, bd = K.pickR;
        for (const u of us) { const d = Math.hypot(u.x - c.x, u.y - c.y); if (d <= bd && this.coreSlots(u) + c.slots <= K.carryCap) { bd = d; best = u; } }
        if (!best) continue;
        this.cores.splice(this.cores.indexOf(c), 1); best.carry.push(c);
        this.rec.cores.push({ t: this.t, kind: 'pick', team: best.team, n: 1 });
        this.emit({ type: 'pick', team: best.team, unit: best, core: c });
      }
      const deps = this.map.zones.filter(z => z.deposit);
      for (const u of us) {
        const z = u.carry.length && !this.stunned(u) ? deps.find(q => Math.hypot(u.x - q.x, u.y - q.y) <= q.r && !(u.bail && u.bail.zid === q.id && this.t < u.bail.retryAt)) : null;
        if (!z) { u.depProg = 0; u.depAt = ''; continue; }
        if (u.depAt !== z.id) { u.depAt = z.id; u.depProg = 0; }
        if (u.hurtT > (u.depSeen || -1e9)) { u.depSeen = u.hurtT; u.depProg *= K.deposit.hitKeep; }      // 제출 중 피격: 진행도 일부 손실
        u.depProg += 1 / ((K.deposit.channelSec + (K.deposit.perCoreSec || 0) * (u.carry.length - 1)) * TPS);
        if (u.depProg < 1) continue;
        const n = u.carry.length, pts = this.coreValue(u) + (n >= K.deposit.comboAt ? K.deposit.comboBonus : 0);
        u.carry = []; u.depProg = 0; u.depAt = ''; u.bail = null; u.bailN = 0; u.deliv++; u.coresIn += n; u.dpts += pts;
        this.scoreAdd(u.team, pts, 'deliver');
        this.rec.cores.push({ t: this.t, kind: 'deposit', team: u.team, n: pts, u: u.id });
        this.emit({ type: 'deposit', team: u.team, unit: u, pts, n, x: z.x, y: z.y, zone: z });
        if (this.sudden && this.suddenWinner == null) this.suddenWinner = u.team;
      }
    }
    tickZones() {
      for (const z of this.zones) {
        if (z.follow && z.owner) { if (!z.owner.alive) { z.until = 0; continue; } z.x = z.owner.x; z.y = z.owner.y; }
        if (z.onTick && z.everyT && (this.t - z.t0) % z.everyT === 0) z.onTick(z, this);
      }
      const ended = this.zones.filter(z => z.until <= this.t);
      if (ended.length) { this.zones = this.zones.filter(z => z.until > this.t); ended.forEach(z => { if (z.onEnd) z.onEnd(z, this); }); }
    }
    tickTimers() {
      if (!this.timers.length) return;
      const due = this.timers.filter(x => x.at <= this.t); if (!due.length) return;
      this.timers = this.timers.filter(x => x.at > this.t);
      due.forEach(x => x.fn(this));
    }
    setForm(u, form) { u.form = form; const p = u.f.passive; if (p && p.onForm) p.onForm(this, u, form); }

    /* ---------- 스킬 실행 ---------- */
    canCast(u, sk, slot) {
      if (u.st.some(s => s.stun || s.knock || s.silence || s.stagger || s.channel || s.hidden)) return false;
      if (sk.move && u.st.some(s => s.root || s.noDash)) return false;
      if (slot === 'ult') { if (u.ultCd > 0) return false; } else if ((u.cds[sk.id] || 0) > 0 || u.mp < sk.cost) return false;
      if (sk.avail && !sk.avail(this, u)) return false;
      return true;
    }
    exec(u, sk, pl, slot, label) {
      u.fxAtk = this.t;
      if (u.team < 2) { if (slot === 'ult') u.ultN = (u.ultN || 0) + 1; else u.skN = (u.skN || 0) + 1; }
      if (slot === 'ult' && u.team < 2) this.onUlt(u);
      this.emit({ type: 'skill', slot, src: u, name: label || sk.name, kind: sk.sfx || 'nuke', color: u.f.color });
      const r = sk.cast(this, u, pl) || {};
      const p = u.f.passive; if (p && p.onSkill) p.onSkill(this, u, sk, slot);
      return r;
    }
    /* 스킬을 '쿨타임 되자마자' 쓰지 않고 상황(교전 중, 다수/저체력 적, 아군 전투, 마나 여유)을 보고 씁니다. 오래 기다리면(참을성) 그냥 씁니다. */
    worth(u, sk, slot, pl, enemies, allies) {
      if (u.rdy[sk.id] === undefined) u.rdy[sk.id] = this.t;
      const waited = this.t - u.rdy[sk.id], kind = sk.sfx || 'nuke', hpR = u.hp / u.maxHp;
      if (waited >= (slot === 'ult' ? ticks(u.brain.ultWait) : sk.move ? ticks(u.brain.skillPatience * 1.5) : ticks(u.brain.skillPatience)) || hpR < 0.35) return true;
      const tg = (pl && pl.t) || u.target || (enemies.length ? nearestOf(u, enemies) : null);
      const near = enemies.filter(e => dist(u, e) <= 24);
      const engaged = (u.hitBy && u.hitBy.alive && this.t - u.hitT < 50) || (u.target && u.target.alive && dist(u, u.target) <= u.role.range + 4);
      const allyFight = allies.some(a => a !== u && (this.t - a.hitT < 50 || (tg && a.target === tg)));
      const crowd = tg ? enemies.filter(e => e !== tg && dist(e, tg) <= 10).length >= 1 : false;
      const lowT = !!tg && tg.hp < tg.maxHp * 0.55, mpRich = u.mp >= u.mpMax * 0.8;
      if (kind === 'shield') return near.length > 0 && (hpR < 0.8 || engaged || allies.some(a => a.hp < a.maxHp * 0.6));
      if (kind === 'buff') return near.length > 0 && (engaged || allyFight || near.length >= 2);
      if (slot === 'ult') return crowd || lowT || (engaged && allyFight) || allies.some(a => a.hp < a.maxHp * 0.4) || near.length >= 2;
      if (sk.move) { if (!tg) return false; return dist(u, tg) > u.role.range + 2 || lowT || near.length >= 2 || hpR < 0.5; }
      return (engaged || allyFight) && (lowT || crowd || mpRich || allyFight);
    }
    trySkill(u, sk, slot, enemies, allies, strict, gate) {
      if (!this.canCast(u, sk, slot)) return false;
      const pl = sk.plan(this, u, enemies, allies, strict);
      if (!pl) return false;
      if (gate && !this.worth(u, sk, slot, pl, enemies, allies)) return false;
      delete u.rdy[sk.id];
      if (slot === 'ult') this.setUlt(u, 0); else { u.mp -= sk.cost; u.cds[sk.id] = ticks(sk.cd); this.ultGain(u, this.cfg.ultSkill); }
      /* 스킬샷 정확도: 대상을 노리는 공격 스킬은 일정 확률로 빗나가 자원만 소모됩니다 (궁극기 제외) */
      if (slot !== 'ult' && pl.t && u.brain.whiff > 0 && CONFIG.brain.stat.whiffKinds.includes(sk.sfx || 'nuke') && Math.random() < u.brain.whiff) {
        u.fxAtk = this.t; u.skN = (u.skN || 0) + 1; this.emit({ type: 'skill', slot, src: u, name: sk.name + ' (빗나감)', kind: sk.sfx || 'nuke', color: u.f.color }); return true;
      }
      const r = this.exec(u, sk, pl, slot);
      if (r.cd !== undefined && slot !== 'ult') u.cds[sk.id] = ticks(r.cd);
      if (r.recast) u.rc[sk.id] = { until: this.t + ticks(r.recast), at: this.t };
      return true;
    }
    tryRecast(u, sk, slot, enemies, allies, gate) {
      const rc = u.rc[sk.id]; if (!rc) return false;
      if (rc.until <= this.t) { delete u.rc[sk.id]; return false; }
      if (!sk.recast || u.st.some(s => s.stun || s.knock || s.silence || s.stagger || s.channel || s.hidden)) return false;
      if (sk.recast.move && u.st.some(s => s.root || s.noDash)) return false;
      const pl = sk.recast.plan(this, u, enemies, allies); if (!pl) return false;
      if (gate) {                                  // 바로 다시 쓰지 않고, 처치/다수/접근 같은 좋은 순간이나 만료 직전에 사용
        const age = this.t - (rc.at || 0), left = rc.until - this.t, tg = pl.t || u.target;
        if (age < ticks(0.5)) return false;
        const good = u.hp < u.maxHp * 0.4 || (tg && (tg.hp < tg.maxHp * 0.5 || enemies.filter(e => dist(e, tg) <= 9).length >= 2 || (sk.recast.move && dist(u, tg) > u.role.range + 4)));
        if (!good && left > ticks(u.brain.recastHold)) return false;
      }
      delete u.rc[sk.id];
      u.fxAtk = this.t;
      this.emit({ type: 'skill', slot, src: u, name: sk.name + ' (재시전)', kind: sk.sfx || 'dash', color: u.f.color });
      sk.recast.cast(this, u, pl);
      return true;
    }
    ultReady(u) {
      if (!u.alive || this.over) return false;
      const ult = u.f.ult;
      if (u.rc[ult.id] && u.rc[ult.id].until > this.t) return !u.st.some(s => s.stun || s.knock || s.silence || s.hidden);
      return this.canCast(u, ult, 'ult');
    }
    /* 플레이어 수동 궁극기 */
    castUlt(uid) {
      const u = this.units.find(x => x.id === uid);
      if (!u || !u.alive || this.over) return { ok: false, msg: '사용할 수 없습니다.' };
      const ult = u.f.ult, enemies = this.foes(u), allies = this.friends(u);
      if (u.rc[ult.id] && u.rc[ult.id].until > this.t) { if (this.tryRecast(u, ult, 'ult', enemies, allies)) return { ok: true }; return { ok: false, msg: '지금은 쓸 대상이 없습니다.' }; }
      if (u.st.some(s => s.stun || s.knock)) return { ok: false, msg: '행동 불가 상태입니다.' };
      if (u.st.some(s => s.silence)) return { ok: false, msg: '침묵 상태입니다.' };
      if (u.ultCd > 0) return { ok: false, msg: '재사용 대기 중입니다.' };
      if (ult.avail && !ult.avail(this, u)) return { ok: false, msg: ult.availMsg || '지금은 사용할 수 없습니다.' };
      if (!this.canCast(u, ult, 'ult')) return { ok: false, msg: '지금은 사용할 수 없습니다.' };
      return this.trySkill(u, ult, 'ult', enemies, allies, false) ? { ok: true } : { ok: false, msg: '지금은 쓸 대상이 없습니다.' };
    }

    /* ---------- 이동 / 포지셔닝 ---------- */
    blocked(u, nx, ny) {
      if (this.inObs(nx, ny)) return true;
      const m = this.cfg.unitRadius * 2 * 0.98;
      for (const e of this.units) {
        if (!e.alive || e === u || e.struct || this.hidden(e)) continue;
        const d = Math.hypot(nx - e.x, ny - e.y);
        if (e.team === u.team) { if (d < m * 0.85 && d < dist(u, e)) return true; continue; }       // 아군끼리도 겹쳐 비비지 않도록 비켜 감
        if (d < m && d < dist(u, e)) return true;
      }
      return false;
    }
    step(u, tx, ty, maxStep, away) {
      if (this.rooted(u)) return;
      let spd = Math.min(this.eff(u, 'spd'), maxStep);
      if (spd <= 0) return;
      u.intent = this.t;
      const A = this.cfg.arena, base = Math.atan2(ty - u.y, tx - u.x) + (away ? Math.PI : 0) + (u.detour && u.detour.until > this.t ? u.detour.ang : 0);
      let seq = [0, 0.7, -0.7, 1.3, -1.3, 1.9, -1.9];
      if (u.lastOff && this.t - u.lastOffT < 14) seq = [u.lastOff, ...seq.filter(o => o !== u.lastOff)];       // 돌아가던 방향을 유지해 좌우로 떨지 않게
      for (const off of seq) {
        const a = base + off * u.side, nx = clamp(u.x + Math.cos(a) * spd, 2, A.w - 2), ny = clamp(u.y + Math.sin(a) * spd, 5, A.h - 2);
        if (!this.blocked(u, nx, ny)) { u.x = nx; u.y = ny; u.actT = this.t; if (off) { u.lastOff = off; u.lastOffT = this.t; } else u.lastOff = 0; return; }
      }
    }
    kite(u, th) {
      const A = this.cfg.arena;
      let ax = u.x - th.x, ay = u.y - th.y; const d = Math.hypot(ax, ay) || 1; ax /= d; ay /= d;
      if ((u.x < 9 && ax < 0) || (u.x > A.w - 9 && ax > 0)) { ax = 0; ay = u.y < th.y ? -1 : 1; if ((u.y < 8 && ay < 0) || (u.y > A.h - 6 && ay > 0)) ay = -ay; }
      else if ((u.y < 8 && ay < 0) || (u.y > A.h - 6 && ay > 0)) { ay = 0; ax = this.axis[u.team].fx >= 0 ? -1 : 1; }
      this.step(u, u.x + ax * 10, u.y + ay * 10, this.eff(u, 'spd'), false);
    }
    flee(u, src) {
      const A = this.cfg.arena, ax = u.x - src.x, ay = u.y - src.y, d = Math.hypot(ax, ay) || 1, spd = this.eff(u, 'spd');
      const nx = clamp(u.x + ax / d * spd, 2, A.w - 2), ny = clamp(u.y + ay / d * spd, 5, A.h - 2);
      if (!this.inObs(nx, ny)) { u.x = nx; u.y = ny; } else if (!this.inObs(nx, u.y)) u.x = nx; else if (!this.inObs(u.x, ny)) u.y = ny;
      u.facing = ax > 0 ? 1 : -1;
    }
    /* 재정비: 체력이 떨어졌거나 스킬이 모두 쿨타임인데 수적으로 밀릴 때 잠시 아군 쪽으로 물러납니다 (원거리는 물러나며 사격) */
    safePoint(u, allies, threats) {
      const A = this.cfg.arena, X = CONFIG.mind.retreat, ax = this.axis[u.team], rx = -ax.fx, ry = -ax.fy, cands = [];
      const cx = threats.length ? threats.reduce((a, e) => a + e.x, 0) / threats.length : u.x - rx * 10, cy = threats.length ? threats.reduce((a, e) => a + e.y, 0) / threats.length : u.y - ry * 10;
      const gap = this.retreatGap(threats), half = A.w / 2, depth = c => ((c.x - A.w / 2) * rx + (c.y - A.h / 2) * ry) / half;
      for (const a of allies) if (a !== u && a.alive && !this.gone(a) && a.hp > a.maxHp * 0.4) cands.push({ x: a.x + rx * 2, y: a.y + ry * 2, w: 1 });
      cands.push({ x: clamp(u.x + rx * X.step, 8, A.w - 8), y: clamp(u.y + ry * X.step + (A.h / 2 - u.y) * 0.2, 5, A.h - 5), w: 0.6 });
      if (u.hp < u.maxHp * 0.5) for (const p of this.map.pods) if (p.readyAt <= this.t + this.sec(u.brain.waitPod ? 10 : 3) && !threats.some(e => Math.hypot(e.x - p.x, e.y - p.y) < 14)) cands.push({ x: p.x, y: p.y, w: 1.3, pod: true });
      const pick = limit => {
        let best = null, bs = -1e9;
        for (const c of cands) {
          if (this.inObs(c.x, c.y, 2)) continue;
          if (limit && !c.pod && depth(c) > X.depthCap) continue;
          const sc = Math.min(gap, Math.hypot(c.x - cx, c.y - cy)) + c.w * 8 - Math.hypot(c.x - u.x, c.y - u.y) * 0.15;
          if (sc > bs) { bs = sc; best = c; }
        }
        return best;
      };
      return pick(u.hp > u.maxHp * X.deepHp) || pick(false);
    }
    retreatGap(threats) { const X = CONFIG.mind.retreat; return Math.max(X.gapMin, ...threats.map(e => (e.role.range || 6) + X.gapAdd)); }
    /* ---------- 두뇌 (AI 지능 단계 C~S) ----------
       추격 제한 / 회복·보스 우선 / 즉시 후퇴 / 수적 열세 시 대기 — 파라미터는 CONFIG.brain.levels */
    power(u) { return (u.atk + u.ap + 20) * Math.max(1, u.hp) / 1000; }
    assess(u, enemies, allies) {
      const D = u.dg, DG = CONFIG.brain.stat.dg, fr = 32 + (D ? DG.foeJ * Math.max(0, D.j) : 0), mr = 28 + (D ? DG.mateR * D.team : 0);
      const foes = enemies.filter(e => e.team < 2 && !e.struct && !this.hidden(e) && dist(u, e) <= fr);
      const mates = allies.filter(a => a === u || (a.alive && !this.gone(a) && dist(u, a) <= mr)); if (!mates.includes(u)) mates.push(u);
      if (D && this.t >= D.biasAt) { D.biasAt = this.t + ticks(DG.biasSec); D.bias = (Math.random() * 2 - 1) * DG.noise * (1 - D.j) / 2; }
      const fp = foes.reduce((x, e) => x + this.power(e), 0) * (1 + (D ? D.bias : 0)), mp = mates.reduce((x, a) => x + this.power(a), 0) || 1;
      return { ratio: fp / mp, foes, mates };
    }
    stayVal(u, enemies, reach0) {
      const foes0 = enemies.filter(e => !e.struct && e.team < 2 && dist(u, e) <= reach0); let v = 0;
      for (const e of foes0) { const d0 = dist(u, e); v += (e.hp < e.maxHp * 0.28 && d0 <= u.role.range + 4) ? 3.5 : (d0 <= u.role.range + 2 ? 1.6 : 0.7); }
      if (u.hp < u.maxHp * 0.28) v *= 0.4;
      return { v, foes0 };
    }
    coreCand(u, enemies, allies, fits) {
      const D = u.dg, X = CONFIG.brain.stat.dg, team = u.team; let best = null, bs = -1e9;
      const foes = enemies.filter(e => e.team < 2 && !e.struct && !this.hidden(e));
      for (const c of this.cores) {
        if (!c.known[team] || !fits(c)) continue;
        const d = dist(u, c); if (d > D.reach) continue;
        let fp = 0, mp = this.power(u), race = 1e9;
        for (const e of foes) { const de = Math.hypot(e.x - c.x, e.y - c.y); if (de <= X.guardR) fp += this.power(e); if (de < race) race = de; }
        for (const a of allies) if (a !== u && a.alive && !this.gone(a) && Math.hypot(a.x - c.x, a.y - c.y) <= X.guardR + 8) mp += this.power(a);
        const r = fp > 0 ? fp / mp * (1 + D.bias) : 0;
        if (fp > 0 && r > X.contest * (1 + (X.contestNeed || 0) * Math.max(0, this.sit[team].need))) continue;      // 점수가 뒤질수록 적이 있는 코어도 감수하고 노림
        if (fp === 0 && d > 12 && race < d * X.race) continue;
        const sc = c.value * X.val - d / X.dist - X.guardPen * r + (c === u.dgCore ? 0.5 : 0);
        if (sc > bs) { bs = sc; best = c; }
      }
      return best ? { c: best, sc: bs } : null;
    }
    /* 바로 근처(grabR) 코어는 다른 목표 중이어도 주워 갑니다. 적이 나보다 코어에 가까우면 제외 */
    grabNear(u, enemies) {
      const K = CONFIG.battle.map.core; if (!K.grabR || this.sudden) return false;
      const slots = this.coreSlots(u); if (slots >= K.carryCap) return false;
      let best = null, bd = K.grabR;
      for (const c of this.cores) {
        if (!c.known[u.team] || c.lockUntil > this.t || slots + c.slots > K.carryCap) continue;
        const d = dist(u, c); if (d > bd) continue;
        if (enemies.some(e => e.team < 2 && !e.struct && e.alive && !this.hidden(e) && Math.hypot(e.x - c.x, e.y - c.y) < d)) continue;
        bd = d; best = c;
      }
      if (!best) return false;
      u.goal = { type: 'core', c: best }; u.target = null; u.chase = null; this.objective(u, enemies); return true;
    }
    /* 교전 중 코어 판단: 점수 필요도·한타 창·국지 전력비·지시(기조/임무)를 한 점수로 비교해 싸울지 코어로 빠질지 정합니다 */
    dgStep(u, enemies, allies, aggro) {
      const D = u.dg, X = CONFIG.brain.stat.dg, K = CONFIG.battle.map.core;
      if (!D || this.sudden) return false;
      const team = u.team, Sit = this.sit[team], slots = this.coreSlots(u), fits = c => this.cores.includes(c) && c.lockUntil <= this.t && slots + c.slots <= K.carryCap;
      if (u.dgCore && u.dgUntil > this.t && fits(u.dgCore)) {
        if (this.t - u.hitT < ticks(X.hitSec) && this.assess(u, enemies, allies).ratio > X.holdOdds * (1 - 0.3 * D.j)) { u.dgCore = null; u.dgUntil = 0; u.dgCd = this.t + ticks(X.cool); return false; }
        u.goal = { type: 'core', c: u.dgCore }; u.target = null; u.chase = null; this.objective(u, enemies); return true;
      }
      u.dgCore = null;
      if (this.t < u.dgCd || slots >= K.carryCap) return false;
      const st = this.stayVal(u, enemies, Math.max(aggro, 28)); if (!st.foes0.length) return false;
      const A = this.assess(u, enemies, allies), cand = this.coreCand(u, enemies, allies, fits); if (!cand) return false;
      const cur = this.cur[team], ms = this.mission(u, cur), W = cur ? cur.W : null;
      let gain = clamp(X.gain0 + Sit.need * X.gainNeed, X.gainMin, X.gainMax), stay = st.v * clamp(1.5 - X.oddsStay * A.ratio, 0.5, 1.3);
      if (Sit.need > 0) stay *= 1 - X.stayNeed * Sit.need;      // 점수가 뒤질수록 싸움 가치를 낮춰 코어를 우선
      if (Sit.win === 'open') stay += X.openStay * (0.6 + 0.4 * u.sn.t); else if (Sit.win === 'avoid') stay -= X.avoidStay;
      if (W) gain *= clamp(W.core / Math.max(0.6, W.kill), 0.6, 1.8);
      if (ms === 'collect') gain *= 1.25; else if (ms === 'hunt' || ms === 'ambush') stay *= 1.25;
      if (X.base * gain + cand.sc <= stay + X.margin * (1 - X.marginJ * D.j)) return false;
      u.dgCore = cand.c; u.dgUntil = this.t + ticks(X.hold);
      u.goal = { type: 'core', c: cand.c }; u.target = null; u.chase = null; this.objective(u, enemies); return true;
    }
    retreatMove(u, allies, threats) {
      const R = u.role, t = u.target, p = this.safePoint(u, allies, threats);
      if (R.range >= 10 && t && t.alive && !this.hidden(t) && dist(u, t) <= R.range && u.cd >= 1 && !u.st.some(s => s.disarm)) { u.cd -= 1; u.fxAtk = this.t; u.actT = this.t; this.attack(u, t); return; }
      if (threats.length && threats.every(e => dist(u, e) >= this.retreatGap(threats)) && this.t - u.hitT > 20) { u.actT = this.t; return; }
      if (p) { if (Math.abs(p.x - u.x) > 0.5) u.facing = p.x > u.x ? 1 : -1; this.stepNav(u, p.x, p.y, this.eff(u, 'spd')); }
    }
    podRun(u, near, enemies) {
      const B = u.brain; if (!B.podRun || this.sudden || u.hp > u.maxHp * 0.6) return false;
      if (u.hitBy && u.hitBy.alive && this.t - u.hitT < 30) return false;
      if (near.some(e => e.team < 2 && !e.struct && e.hp < e.maxHp * 0.3 && dist(u, e) <= u.role.range + 3)) return false;
      const ps = this.map.pods.filter(p => p.readyAt <= this.t + this.sec(2) && dist(u, p) <= B.podRun && !enemies.some(e => e.team < 2 && !e.struct && Math.hypot(e.x - p.x, e.y - p.y) < 8));
      if (!ps.length) return false;
      u.goal = { type: 'pod', pod: ps.reduce((a, p) => (dist(u, a) <= dist(u, p) ? a : p)) }; this.objective(u, enemies); return true;
    }

    engagedAlly(a) { return this.t - a.hitT < CONFIG.tactics.p.assistWindow || !!(a.target && a.target.alive && !this.hidden(a.target) && dist(a, a.target) <= a.role.range + 8); }
    holdLimit(u, allies) {
      const T = u.tac, TP = CONFIG.tactics.p, others = allies.filter(a => a !== u && a.tac.pos !== 'cover');
      if (!others.length) return null;
      const most = Math.max(...others.map(a => this.ahead(a)));
      if (T.pos === 'cover') return most - (TP.coverBack + TP.coverStep * T.posL);
      if (T.entry === 'first' || T.entry === 'flank') return null;
      if (T.entry === 'support') return most - (TP.coverBack + TP.coverStep * 3);
      if (T.entry === 'late' && !allies.some(a => a !== u && a.alive && this.engagedAlly(a))) return most - (TP.coverBack + TP.coverStep * 3);
      if (!u.role.backline) return null;
      if ((T.act === 'rush' && T.actS >= 0.5) || T.pos === 'front' || (T.fight === 'solo' && T.fightS >= 0.6)) return null;
      const fr = others.filter(a => a.role.front);
      if (!fr.length) return null;
      const gap = this.roleGap(u);      // 역할 이동: 정도가 높을수록 전열 뒤 간격을 넓게
      return Math.max(...fr.map(a => this.ahead(a))) - gap;
    }
    posPoint(u, allies) {
      const T = u.tac, A = this.cfg.arena, TP = CONFIG.tactics.p, ax = this.axis[u.team];
      if (T.pos === 'front' || T.entry === 'first') { const fx = TP.frontBase + TP.frontStep * (T.posL - 1), k = ax.len * fx - this.ahead(u); return { x: u.x + ax.fx * k, y: u.y + ax.fy * k }; }
      if (T.pos === 'cover') {
        const lim = this.holdLimit(u, allies), k = lim == null ? 0 : lim - this.ahead(u), px = -ax.fy, py = ax.fx;
        const lat = (u.x - ax.hx) * px + (u.y - ax.hy) * py, sg = lat >= 0 ? 1 : -1;      // 중심 축의 어느 쪽 가장자리로 붙을지
        const d = Math.min(10, Math.max(0, A.h * 0.42 - Math.abs(lat)) * T.posS * 0.8);
        let pt = { x: u.x + ax.fx * k + px * sg * d, y: u.y + ax.fy * k + py * sg * d };
        const al = allies.filter(a => a !== u && a.alive && !this.gone(a));
        if (al.length) { const m = nearestOf(u, al), dd = Math.hypot(pt.x - m.x, pt.y - m.y); if (dd > 22) { const f = 22 / dd; pt = { x: m.x + (pt.x - m.x) * f, y: m.y + (pt.y - m.y) * f }; } }
        return { x: clamp(pt.x, 8, A.w - 8), y: clamp(pt.y, 8, A.h - 8) };
      }
      return null;
    }
    drift(u, allies) { const p = this.posPoint(u, allies); if (p && dist(u, p) > 3) this.step(u, p.x, p.y, dist(u, p), false); }
    helpTarget(u, enemies, allies, aggro) {
      const T = u.tac, TP = CONFIG.tactics.p;
      if (u.hp < u.maxHp * 0.45 || (u.goal && u.goal.type === 'pod' && u.hp < u.maxHp * 0.7)) return null;
      const reach = T.fight === 'support' || T.entry === 'support' ? 130 : T.fight === 'solo' ? 45 : 100;
      let best = null, bd = 1e9;
      for (const a of allies) {
        if (a === u || !a.alive || this.gone(a)) continue;
        const h = a.hitBy && a.hitBy.alive && !this.hidden(a.hitBy) && this.t - a.hitT < TP.assistWindow ? a.hitBy : null;
        const k = a.target && a.target.alive && !this.hidden(a.target) && dist(a, a.target) <= a.role.range + 6 ? a.target : null;
        const e = h || k;
        if (!e || e.team > 1 || e.struct) continue;
        const d = dist(u, e);
        if (d <= reach && d < bd) { bd = d; best = e; }
      }
      return best;
    }
    assistTarget(u, allies) {
      const TP = CONFIG.tactics.p;
      const list = allies.filter(a => a !== u && ((this.t - a.hitT < TP.assistWindow && a.hitBy && a.hitBy.alive) || a.hp < a.maxHp * 0.6));
      return list.length ? lowestOf(list) : null;
    }
    move(u, t, d, enemies, allies) {
      const R = u.role, T = u.tac, TP = CONFIG.tactics.p, A = this.cfg.arena;
      if ((T.fight === 'support' || T.entry === 'support') && d > R.range) {
        const a = this.assistTarget(u, allies);
        if (a && dist(u, a) > TP.assistBase + TP.assistStep * T.fightL) { this.stepNav(u, a.x, a.y, dist(u, a) - TP.assistBase); return; }
      }
      let kd = R.kite || 0;
      if (T.act === 'rush') kd *= 1 - T.actS;
      else if (T.act === 'retreat' && u.hp < u.maxHp * (TP.retreatHp0 + TP.retreatHpStep * T.actL)) kd = (R.kite || TP.retreatBase) * (1 + TP.retreatMul * T.actS) + TP.retreatAdd * T.actS;
      if (kd > 0) { const real = enemies.filter(e => !e.struct); if (real.length) { const th = nearestOf(u, real); if (dist(u, th) < kd) { this.kite(u, th); return; } } }
      let want = R.range * 0.9;
      if (T.act === 'rush') want = Math.max(3, R.range * (0.9 - 0.45 * T.actS));
      if (d <= want) { this.drift(u, allies); return; }
      const lim = this.holdLimit(u, allies);
      if (lim != null && this.ahead(u) >= lim && u.forceGo <= this.t) { this.drift(u, allies); return; }
      const fl = this.flankPoint(u, t, want);
      if (fl) { this.stepNav(u, fl.x, fl.y, Math.max(0.2, dist(u, fl))); return; }
      const ap = this.approach(u, t, allies, want);
      this.stepNav(u, ap.x, ap.y, ap === t ? d - want * 0.95 : Math.max(0.2, dist(u, ap)));
    }
    /* 같은 적을 노리는 근접 아군끼리 서로 다른 각도로 접근해 한 점에 몰려 비비지 않게 합니다 */
    approach(u, t, allies, want) {
      if (want > 12) return t;
      const mates = allies.filter(a => a !== u && a.alive && a.target === t && dist(a, t) < want + 9);
      if (!mates.length) return t;
      const ids = [u, ...mates].sort((a, b) => (a.id < b.id ? -1 : 1)), k = ids.indexOf(u), n = ids.length, home = Math.atan2(-this.axis[u.team].fy, -this.axis[u.team].fx);
      const ang = home + (k - (n - 1) / 2) * 0.95, r = Math.max(2.5, want * 0.9), p = this.pushOut(t.x + Math.cos(ang) * r, t.y + Math.sin(ang) * r);
      return { x: p.x, y: p.y };
    }

    pick(u, enemies, allies) {
      const T = u.tac, TP = CONFIG.tactics.p;
      const maxAtk = Math.max(...enemies.map(e => e.atk + e.ap)), fc = this.tp[u.team].focus, fcE = fc && fc.e.alive ? fc.e : null;
      let best = null, bs = Infinity;
      for (const e of enemies) {
        const thr = (e.role.threat || 1) / (e.tac.pos === 'cover' ? 1 + TP.coverHide * e.tac.posL : 1);
        let s = dist(u, e) / thr;
        if (e.team === 2) s *= u.goal && u.goal.type === 'boss' ? 0.75 : u.goal && u.goal.type === 'stage' ? 4 : 1.6;
        if (T.aim === 'weak') s *= 1 - TP.aimBias * T.aimS * (1 - e.hp / e.maxHp);
        else if (T.aim === 'back') { if (e.role.backline) s *= 1 - TP.aimBias * T.aimS; }
        else if (T.aim === 'carry') s *= 1 - TP.aimBias * T.aimS * ((e.atk + e.ap) / maxAtk);
        else if (T.aim === 'capper') { if (e.team < 2 && e.target && e.target.team === 2 && e.target.alive) s *= 1 - TP.capperBias * T.aimS; }
        if (u.brain.finish > 0) s *= 1 - u.brain.finish * (1 - e.hp / e.maxHp);                                                    // 교전 능력: 체력이 깎인 적을 마무리
        if (u.brain.assist > 0 && allies.some(a => a !== u && this.t - a.hitT < 40 && a.hitBy === e)) s *= 1 - u.brain.assist;         // 팀워크: 아군을 때린 적을 먼저 견제
        if (fcE && e === fcE) s *= Math.max(0.12, 1 - this.focusPull(u));
        if (T.fight === 'coop' && allies.some(a => a !== u && a.target === e)) s *= 1 - TP.coopBias * T.fightS;
        else if ((T.fight === 'support' || T.entry === 'support') && allies.some(a => a !== u && this.t - a.hitT < TP.assistWindow && a.hitBy === e)) s *= 1 - TP.supportBias * T.fightS;
        if (s < bs) { bs = s; best = e; }
      }
      if (best && !best.struct) { const blk = this.blocker(u, best); if (blk) return blk; }      // 대상으로 가는 길을 오벨리스크가 막고 있으면 먼저 부수러 감
      return best;
    }
    /* u 와 t 사이(직선)를 막고 있는 가장 가까운 적 구조물 */
    blocker(u, t) {
      let best = null, bd = 1e9; const dt = dist(u, t);
      for (const s of this.units) {
        if (!s.struct || !s.alive || s.team === u.team) continue;
        const ds = dist(u, s); if (ds >= dt) continue;
        if (segDist(s.x, s.y, u.x, u.y, t.x, t.y) <= 3.4 && ds < bd) { bd = ds; best = s; }
      }
      return best;
    }
    /* 구조물 생성: 체력을 가진 정지 유닛(+이동을 막는 원형 장애물). 적의 공격 대상이 되고, 직선/부채꼴 공격을 막아 줍니다. o: {name,x,y,hp,life(초),r,def,res} */
    spawnStruct(owner, o) {
      const u = this.makeUnit(STRUCT_DEF, owner.team, 0, 1, null);
      u.id = 'st' + (this.structN = (this.structN || 0) + 1); u.struct = true; u.owner = owner; u.ch = { ...STRUCT_DEF, name: o.name || STRUCT_DEF.name };
      u.x = u.px = o.x; u.y = u.py = o.y; u.maxHp = u.hp = Math.round(o.hp); u.def = o.def || 30; u.res = o.res || 30; u.facing = 1;
      u.st.push({ key: 'structarmor', name: '구조물', good: true, dur: 999999, ccImmune: true, quiet: true });
      const ob = { t: 'c', x: o.x, y: o.y, r: o.r || 2.4, obe: true, unit: u }; this.map.obstacles.push(ob); u.ob = ob;
      this.units.push(u); this.later(o.life || 14, bb => { if (u.alive) { u.hp = 0; u.alive = false; bb.onDeath(null, u); } });
      this.emit({ type: 'struct', phase: 'spawn', unit: u });
      return u;
    }

    /* ---------- 기본 공격 ---------- */
    attack(u, t) {
      const F = u.f, B = F.basic;
      this.ultGain(u, this.cfg.ultAtk);
      if (B.proj && B.proj !== 'melee' && B.proj !== 'none') { const blk = this.blocker(u, t); if (blk) t = blk; }      // 원거리 기본 공격은 구조물에 막힘
      if (u.st.some(s => s.blind)) { this.emit({ type: 'attack', src: u, dst: t, hit: false, miss: true, dmg: 0, dtype: B.type, proj: B.proj || 'none', basic: true }); return; }     // 실명: 기본 공격 빗나감
      const raw = this.raw(u, 0, B.atk, B.ap);
      const asSkill = u.st.some(s => s.basicAsSkill);
      const r = this.deal(u, t, { type: B.type, raw, basic: true, proj: B.proj, skill: asSkill, pierce: u.st.some(s => s.pierce) });
      const p = F.passive;
      if (p && p.onBasic) p.onBasic(this, u, t, r);
      if (u.bm.length) {
        const mods = u.bm.filter(m => m.until > this.t);
        u.bm = mods.filter(m => !m.once);
        mods.forEach(m => { if (t.alive || m.always) m.fn(this, u, t, r); });
      }
    }

    /* ---------- 길찾기: 장애물 격자 + A* (직선이 막혔을 때만 사용) ---------- */
    /* 팀 시작점(꼭짓점)과 '전진 방향' 축: 모든 앞/뒤·후퇴·진형 계산이 좌우 고정이 아니라 이 축을 기준으로 합니다 */
    spawnPt(team, i) {
      const sp = CONFIG.battle.map.spawns[team] || { x: 0, ys: [0] }, q = sp.pts ? sp.pts[i % sp.pts.length] : [sp.x, sp.ys[i % sp.ys.length]];
      return { x: q[0] + rnd(-1, 1), y: q[1] + rnd(-1, 1) };
    }
    initAxis() {
      const c = t => { const sp = CONFIG.battle.map.spawns[t], ps = sp.pts || sp.ys.map(y => [sp.x, y]); return { x: ps.reduce((a, p) => a + p[0], 0) / ps.length, y: ps.reduce((a, p) => a + p[1], 0) / ps.length }; };
      const h = [c(0), c(1)];
      this.axis = [0, 1].map(t => { const o = h[1 - t], dx = o.x - h[t].x, dy = o.y - h[t].y, len = Math.hypot(dx, dy) || 1; return { hx: h[t].x, hy: h[t].y, fx: dx / len, fy: dy / len, len }; });
      this.axis[2] = this.axis[0];      // 중립 유닛(보스·구조물)은 어느 쪽 축을 써도 상관없게 대비
    }
    ahead(u) { const a = this.axis[u.team] || this.axis[0]; return (u.x - a.hx) * a.fx + (u.y - a.hy) * a.fy; }      // 자기 진영에서 적 진영 쪽으로 얼마나 나아갔는지
    initNav() {
      const A = this.cfg.arena, cs = 3, nx = Math.ceil(A.w / cs), ny = Math.ceil(A.h / cs), blocked = new Uint8Array(nx * ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) blocked[j * nx + i] = this.inObs(i * cs + cs / 2, j * cs + cs / 2, 2.8) ? 1 : 0;
      this.nav = { cs, nx, ny, blocked };
    }
    clearLine(x1, y1, x2, y2) {
      const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 1.5));
      for (let i = 1; i <= n; i++) if (this.inObs(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, 2.3)) return false;
      return true;
    }
    astar(sx, sy, tx, ty) {
      const N = this.nav, cs = N.cs, nx = N.nx, ny = N.ny;
      const cell = (x, y) => Math.max(0, Math.min(ny - 1, Math.floor(y / cs))) * nx + Math.max(0, Math.min(nx - 1, Math.floor(x / cs)));
      const free = c => {            // 막힌 칸이면 가장 가까운 빈 칸으로
        if (!N.blocked[c]) return c;
        const cx = c % nx, cy = (c / nx) | 0;
        for (let r = 1; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const a = cx + dx, b = cy + dy; if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
          if (!N.blocked[b * nx + a]) return b * nx + a;
        }
        return c;
      };
      const start = free(cell(sx, sy)), goal = free(cell(tx, ty));
      if (start === goal) return [goal];
      const g = new Float32Array(nx * ny).fill(1e9), from = new Int32Array(nx * ny).fill(-1), closed = new Uint8Array(nx * ny);
      const gx = goal % nx, gy = (goal / nx) | 0, h = c => { const dx = Math.abs((c % nx) - gx), dy = Math.abs(((c / nx) | 0) - gy); return (dx + dy) + (1.414 - 2) * Math.min(dx, dy); };
      const heap = [[h(start), start]];
      const push = it => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
      g[start] = 0;
      while (heap.length) {
        const [, c] = pop(); if (closed[c]) continue; closed[c] = 1;
        if (c === goal) break;
        const cx = c % nx, cy = (c / nx) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue; const a = cx + dx, b = cy + dy; if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
          const n = b * nx + a; if (N.blocked[n] || closed[n]) continue;
          if (dx && dy && (N.blocked[cy * nx + a] || N.blocked[b * nx + cx])) continue;       // 대각선 모서리 통과 금지
          const ng = g[c] + (dx && dy ? 1.414 : 1);
          if (ng < g[n]) { g[n] = ng; from[n] = c; push([ng + h(n), n]); }
        }
      }
      if (from[goal] < 0) return null;
      const path = []; for (let c = goal; c !== -1; c = from[c]) path.push(c); path.reverse();
      return path;
    }
    /* 장애물이 가로막으면 경로의 "보이는 가장 먼 지점"을, 아니면 목표 지점을 반환 */
    navPoint(u, tx, ty) {
      if (this.clearLine(u.x, u.y, tx, ty)) { u.nav = null; return { x: tx, y: ty }; }
      const nv = u.nav;
      if (!nv || Math.hypot(nv.tx - tx, nv.ty - ty) > 6 || this.t - nv.t > 30) {
        const path = this.astar(u.x, u.y, tx, ty);
        u.nav = { tx, ty, t: this.t, path: path ? path.map(c => ({ x: (c % this.nav.nx + 0.5) * this.nav.cs, y: (((c / this.nav.nx) | 0) + 0.5) * this.nav.cs })) : null };
      }
      const pts = u.nav.path; if (!pts) return { x: tx, y: ty };
      for (let i = pts.length - 1; i >= 0; i--) if (this.clearLine(u.x, u.y, pts[i].x, pts[i].y)) return pts[i];
      return pts[0];
    }
    stepNav(u, tx, ty, maxStep) {
      const p = this.navPoint(u, tx, ty), d = Math.hypot(p.x - u.x, p.y - u.y);
      this.step(u, p.x, p.y, p.x === tx && p.y === ty ? maxStep : Math.min(maxStep, d), false);
    }

    /* ---------- 목표(코어·제출·회복) AI : 팀 전략 + 개인 지시 ---------- */
    /* 현재 운영 기조: 기본 기조 → 시간대 계획 → 앞섬/뒤처짐 규칙 → 상황 판단력(자동 조정) 순으로 덮어씁니다 */
    /* ---------- 팀 협동: 집결 후 진입 · 팀 포커스 · 궁 연계 · 역할 이동 · 회복팩 순환 ----------
       모든 항목의 중립값(각자 이동·각자 판단·연계 없음…)에서는 아래 로직이 아무것도 하지 않아 기존 동작과 같습니다. */
    teamUnits(team) { return this.units.filter(u => u.team === team && u.alive && !u.struct && !this.gone(u)); }
    /* ---------- 제출 중 이탈 ----------
       제출 채널 중 매 틱: 남은 제출 시간 동안 버틸 수 있는지(최근 피해량 기준)를 보고, 못 버티면 이탈 사유를 돌려줍니다 */
    recentDps(u, sec) {
      const h = u.dmgHist; if (!h || !h.length) return 0;
      const from = this.t - ticks(sec); while (h.length && h[0] < from) h.splice(0, 2);
      let s = 0; for (let i = 1; i < h.length; i += 2) s += h[i];
      return s / sec;
    }
    recentHits(u, sec) { const h = u.dmgHist; if (!h) return 0; const from = this.t - ticks(sec); let n = 0; for (let i = 0; i < h.length; i += 2) if (h[i] >= from) n++; return n; }
    /* 부활 직후 합류: 전술·목표보다 먼저 살아 있는 아군 중심으로 모입니다 (피격 시 act에서 해제) */
    regroupStep(u) {
      const o = this.teamUnits(u.team).filter(a => a !== u), p = o.length ? { x: o.reduce((s, a) => s + a.x, 0) / o.length, y: o.reduce((s, a) => s + a.y, 0) / o.length } : this.homeDep(u.team), d = dist(u, p);
      u.actT = this.t; if (d > 6) this.stepNav(u, p.x, p.y, Math.min(this.eff(u, 'spd'), d - 4));
      return true;
    }
    /* 탐색: 코어는 시야(senseR) 안에서만 알 수 있으므로, 맵을 격자 지점으로 나눠 가장 오래 못 본 곳을 순회 */
    scoutPick(team, us) {
      const A = this.cfg.arena, R = CONFIG.battle.map.core.senseR * 0.8;
      if (!this.scoutPts) { this.scoutPts = []; for (const fx of [0.17, 0.5, 0.83]) for (const fy of [0.2, 0.5, 0.8]) this.scoutPts.push(this.pushOut(A.w * fx, A.h * fy)); this.scoutAt = [0, 1].map(() => this.scoutPts.map(() => 0)); }
      const seen = this.scoutAt[team], cx = us.reduce((s, a) => s + a.x, 0) / us.length, cy = us.reduce((s, a) => s + a.y, 0) / us.length; let best = null, bs = -1e9;
      this.scoutPts.forEach((p, i) => {
        if (us.some(a => dist(a, p) <= R)) seen[i] = this.t;
        const sc = (this.t - seen[i]) / TPS - Math.hypot(p.x - cx, p.y - cy) * 0.15; if (sc > bs) { bs = sc; best = p; }
      });
      return best;
    }
    /* ---------- 경기 중 지휘(지시) ---------- */
    ordNow(team) { const o = this.ord[team]; return o && this.t >= o.applyAt && this.t < o.until ? o.id : 'auto'; }
    orderOf(u) { const o = u.ord; return o && this.t >= o.applyAt && this.t < o.until ? o : null; }
    bossSoon(sec) { return this.bossPlan.some(p => !p.spawned && p.atTick != null && p.atTick - this.t <= ticks(sec)); }
    forcedMission(u) { const d = this.ordNow(u.team); return d === 'ambush' ? 'ambush' : d === 'kill' ? 'hunt' : null; }
    orderBlock(team, id, isUnit, u, arg) {
      const bossUp = !this.sudden && (this.units.some(b => b.team === 2 && b.alive) || this.bossSoon(40)), seeFoe = this.units.some(e => e.team === 1 - team && e.alive && !e.struct && !this.hidden(e));
      const known = this.cores.some(c => c.known[team]);
      if (!isUnit) {
        if ((id === 'boss' || id === 'bossWait') && !bossUp) return '보스가 아직 멀었거나 나오지 않습니다.';
        if (id === 'wave' && !known) return '아는 코어가 없습니다.';
        if (id === 'kill' && !seeFoe) return '보이는 적이 없습니다.';
        return null;
      }
      if (id === 'core' && !known) return '아는 코어가 없습니다.';
      if (id === 'deposit' && !this.coreSlots(u)) return '들고 있는 코어가 없습니다.';
      if (id === 'escort') { const a = this.units.find(x => x.id === (arg && arg.target)); if (!a || !a.alive || a === u || a.team !== team) return '호위할 아군을 고르세요.'; }
      if (id === 'hunt') { const e = this.units.find(x => x.id === (arg && arg.target)); if (!e || !e.alive || e.team === team || e.team > 1 || this.hidden(e)) return '쫓을 적이 보이지 않습니다.'; }
      if (id === 'ultNow' && u.ultCd > 0) return '궁극기가 아직 준비되지 않았습니다.';
      return null;
    }
    /* order(팀, 'team', 지시id) · order(팀, 'unit', 지시id, { uid, target }) · id 'auto' 는 해제(무료) */
    order(team, scope, id, arg) {
      const OC = CONFIG.orders, fail = msg => ({ ok: false, msg }), isUnit = scope === 'unit';
      if (this.over || (team !== 0 && team !== 1)) return fail('지금은 지시할 수 없습니다.');
      const u = isUnit ? this.units.find(x => x.id === (arg && arg.uid)) : null;
      if (isUnit && (!u || u.team !== team || !u.alive)) return fail('지시할 수 없는 선수입니다.');
      if (id === 'auto') { if (isUnit) u.ord = null; else this.ord[team] = null; return { ok: true, free: true }; }
      const def = (isUnit ? OC.unit : OC.team).find(d => d.id === id); if (!def) return fail('알 수 없는 지시입니다.');
      const cur = isUnit ? u.ord : this.ord[team];
      if (cur && cur.id === id && this.t < cur.until && (!isUnit || cur.target === (arg && arg.target))) return fail('이미 진행 중인 지시입니다.');
      if (this.t < this.cmdAt[team]) return fail(`재지시 대기 중입니다 (${Math.ceil((this.cmdAt[team] - this.t) / TPS)}초).`);
      const cp = this.cp[team]; if (cp.v < def.cost) return fail('지휘 포인트가 부족합니다.');
      const why = this.orderBlock(team, id, isUnit, u, arg); if (why) return fail(why);
      cp.v -= def.cost; this.cmdAt[team] = this.t + ticks(OC.recallSec);
      const r = clamp(this.sit[team].r || 0, 0, 1), delay = OC.delay.max - (OC.delay.max - OC.delay.min) * r;
      const o = { id, since: this.t, applyAt: this.t + ticks(delay), until: this.t + ticks(delay + (isUnit ? OC.unitSec : OC.teamSec)), target: (arg && arg.target) || null };
      if (isUnit) u.ord = o; else this.ord[team] = o;
      this.rec.orders.push({ t: this.t, team, scope, id, lead: Math.round(this.score[team] - this.score[1 - team]), boss: this.units.some(x => x.team === 2 && x.alive), sudden: this.sudden });
      this.emit({ type: 'order', team, scope, id, name: def.name, unit: u });
      return { ok: true, delay };
    }
    setDir(team, d) { return this.order(team, 'team', d); }
    tickOrders() {
      const OC = CONFIG.orders;
      for (const t of [0, 1]) {
        const c = this.cp[t]; if (c.v >= OC.cpMax) c.prog = 0; else if (++c.prog >= ticks(OC.regenSec)) { c.prog = 0; c.v++; }
        if (this.ord[t] && this.t >= this.ord[t].until) this.ord[t] = null;
      }
      for (const u of this.units) {
        const o = u.ord; if (!o) continue;
        if (!u.alive || this.t >= o.until) { u.ord = null; continue; }
        if (o.id === 'ultNow' && this.t >= o.applyAt && u.ultCd <= 0 && this.castUlt(u.id).ok) u.ord = null;
      }
      this.aiCommand(0); this.aiCommand(1);
    }
    /* AI 지휘: 상황을 읽고 팀 지시를 씁니다 (사람이 지휘하지 않는 팀 · 자동 지휘 중인 팀) */
    aiCommand(team) {
      const lv = this.autoCmd[team]; if (!lv || this.t < this.aiAt[team]) return;
      const A = CONFIG.orders.ai[lv] || CONFIG.orders.ai.normal; this.aiAt[team] = this.t + ticks(A.every);
      const cur = this.ord[team];
      if (this.cp[team].v <= A.keep || this.t < this.cmdAt[team] || Math.random() > A.p || (cur && this.t < cur.until - ticks(3))) return;
      for (const id of this.aiWants(team, lv)) if (this.order(team, 'team', id).ok) return;
    }
    aiWants(team, lv) {
      const lead = Math.round(this.score[team] - this.score[1 - team]), left = this.sudden ? 0 : (this.cfg.maxTicks - this.t) / TPS, hard = lv === 'hard' || lv === 'master';
      const boss = this.units.find(b => b.team === 2 && b.alive), soon = !this.sudden && this.bossSoon(14);
      const mine = this.units.filter(u => u.team === team && u.alive && !u.struct), foes = this.units.filter(u => u.team === 1 - team && u.alive && !u.struct && !this.hidden(u));
      const sum = l => l.reduce((q, u) => q + this.coreValue(u), 0), myC = sum(mine), foeC = sum(foes);
      const bigV = this.cores.filter(c => c.known[team] && c.lockUntil <= this.t).reduce((q, c) => q + c.value, 0), w = [];
      if (boss && foes.some(e => dist(e, boss) <= 24) && boss.hp < boss.maxHp * 0.92) w.push(boss.hp < boss.maxHp * 0.5 || lead <= -2 ? 'boss' : hard ? 'bossWait' : null);
      if (soon) w.push(lead <= -2 ? 'boss' : lv === 'easy' ? null : 'bossWait');
      if (foeC >= 3 && (lead <= 1 || foeC >= 5)) w.push('kill');
      if (myC >= 4) w.push('convoy');
      if (lead >= 3 && left < 70) w.push(hard ? 'ambush' : 'retreat');
      if (lead <= -3 && left < 80) w.push('wave');
      if (bigV >= 4 && !boss && (lead <= 0 || hard)) w.push('wave');
      if (this.sudden) w.push('wave');
      return w.filter(Boolean);
    }
    orderGoal(u, o, team) {
      const K = CONFIG.battle.map.core, M = this.map, near = (list, p) => list.reduce((a, c) => (dist(p, a) <= dist(p, c) ? a : c));
      if (o.id === 'core') { const cs = this.cores.filter(c => c.known[team] && c.lockUntil <= this.t && this.coreSlots(u) + c.slots <= K.carryCap); return cs.length ? { type: 'core', c: near(cs, u), since: o.since } : null; }
      if (o.id === 'deposit') { if (!this.coreSlots(u)) { u.ord = null; return null; } return { type: 'deposit', z: near(M.zones.filter(z => z.deposit), u), since: o.since }; }
      if (o.id === 'escort') { const a = this.units.find(x => x.id === o.target); if (!a || !a.alive) { u.ord = null; return null; } return { type: 'escort', a, since: o.since }; }
      if (o.id === 'hunt') { const e = this.units.find(x => x.id === o.target); if (!e || !e.alive) { u.ord = null; return null; } return this.hidden(e) ? null : { type: 'hunt', e, since: o.since }; }
      if (o.id === 'ambush') return { type: 'ambush', z: this.foeDep(team), since: o.since };
      if (o.id === 'pod') { if (u.hp >= u.maxHp * 0.98) { u.ord = null; return null; } const ps = M.pods.filter(p => p.readyAt <= this.t + ticks(4)); return ps.length ? { type: 'pod', pod: near(ps, u), since: o.since } : null; }
      return null;
    }
    hy(team, key, on, keep) { const m = this.hys || (this.hys = {}), k = team + key; return (m[k] = m[k] ? keep : on); }
    mission(u, cur) { return this.forcedMission(u) || u.tac.mission || (cur && cur.ambush && u.f.role === 'assassin' ? 'ambush' : null); }
    homeDep(team) { const a = this.axis[team]; return this.map.zones.filter(z => z.deposit).reduce((p, q) => (Math.hypot(a.hx - p.x, a.hy - p.y) <= Math.hypot(a.hx - q.x, a.hy - q.y) ? p : q)); }
    foeDep(team) { return this.homeDep(1 - team); }
    ambushPoint(u, z) {
      const a = this.axis[1 - u.team], KA = CONFIG.battle.map.core.ai, i = Number(u.id.split('-')[1]) || 0, l = Math.hypot(a.hx - z.x, a.hy - z.y) || 1, dx = (a.hx - z.x) / l, dy = (a.hy - z.y) / l;
      const d = Math.max(z.r + 2, KA.ambushFar - KA.ambushStep * u.tac.missionL), sd = ((i % 3) - 1) * 5;
      return this.pushOut(z.x + dx * d - dy * sd, z.y + dy * d + dx * sd);
    }
    guardPoint(u, z) {
      const pit = this.map.zones.find(q => q.hub) || z, i = Number(u.id.split('-')[1]) || 0, l = Math.hypot(pit.x - z.x, pit.y - z.y) || 1, dx = (pit.x - z.x) / l, dy = (pit.y - z.y) / l, d = CONFIG.battle.map.core.ai.guardOff, sd = ((i % 3) - 1) * 6;
      return this.pushOut(z.x + dx * d - dy * sd, z.y + dy * d + dx * sd);
    }
    stagePoint(u) {
      const pit = this.map.zones.find(z => z.hub) || this.map.zones[0], ax = this.axis[u.team], i = Number(u.id.split('-')[1]) || 0;
      const a = Math.atan2(-ax.fy, -ax.fx) + (i - 1) * 0.5, R = pit.r + 16;
      return this.pushOut(pit.x + Math.cos(a) * R, pit.y + Math.sin(a) * R);
    }
    objective(u, enemies) {
      const g = u.goal, TP = CONFIG.tactics.p; let tx = null, ty = null;
      if (g && g.type === 'pod' && g.pod) { tx = g.pod.x; ty = g.pod.y; }
      else if (g && g.type === 'boss' && g.boss && g.boss.alive) { tx = g.boss.x; ty = g.boss.y; }
      else if (g && g.type === 'hunt' && (g.e || enemies.length)) { const e = g.e && g.e.alive && !this.hidden(g.e) ? g.e : (enemies.length ? nearestOf(u, enemies) : null); if (e) { tx = e.x; ty = e.y; } }
      else if (g && g.type === 'escort' && g.a && g.a.alive) {
        const a = g.a; if (dist(u, a) <= TP.escortFar - TP.escortStep * u.tac.missionL) { if (Math.abs(a.x - u.x) > 0.5) u.facing = a.x > u.x ? 1 : -1; return; }
        tx = a.x - (a.facing || 1) * 3; ty = a.y;
      }
      else if (g && g.type === 'join') { const o = this.teamUnits(u.team).filter(a => a !== u); if (o.length) { tx = o.reduce((s, a) => s + a.x, 0) / o.length; ty = o.reduce((s, a) => s + a.y, 0) / o.length; } }
      else if (g && g.type === 'stage') { const p = this.stagePoint(u); tx = p.x; ty = p.y; }
      else if (g && g.type === 'scout' && g.pt) { tx = g.pt.x; ty = g.pt.y; }
      else if (g && g.type === 'core') { if (g.c && this.cores.includes(g.c)) { tx = g.c.x; ty = g.c.y; } }
      else if (g && g.type === 'deposit' && g.z) { tx = g.z.x; ty = g.z.y; if (Math.hypot(u.x - tx, u.y - ty) <= g.z.r * 0.5) return; }
      else if (g && g.type === 'ambush' && g.z) { const p = this.ambushPoint(u, g.z); tx = p.x; ty = p.y; }
      else if (g && g.type === 'guard' && g.z) { const p = this.guardPoint(u, g.z); tx = p.x; ty = p.y; }
      if (tx == null) {
        const z = this.homeDep(u.team), i = Number(u.id.split('-')[1]) || 0, ax = this.axis[u.team];
        const off = (u.role.front && !u.role.backline ? 0.3 : u.role.backline ? -0.4 : 0) * z.r, sd = ((i % 3) - 1) * z.r * 0.38;
        tx = z.x + off * ax.fx - ax.fy * sd; ty = z.y + off * ax.fy + ax.fx * sd;
      }
      const d = Math.hypot(tx - u.x, ty - u.y);
      if (d > 1.5 && (!g || g.type !== 'pod') && enemies.some(e => e.team < 2 && !e.struct && (Math.hypot(e.x - tx, e.y - ty) <= 30 || dist(u, e) <= 30)) && this.gateHold(u)) return;
      if (d > 1.5) { if (Math.abs(tx - u.x) > 0.5) u.facing = tx > u.x ? 1 : -1; this.stepNav(u, tx, ty, d); }
    }
    duoPair(team, S, free, TP) {
      const P = this.tp[team]; if (S.formation !== 'duo' || free.length < 2) { P.duo = null; return null; }
      const kp = P.duo ? P.duo.map(id => free.findIndex(u => u.id === id)) : null;
      let pair = kp && kp[0] >= 0 && kp[1] >= 0 && dist(free[kp[0]], free[kp[1]]) <= TP.duoBreak ? kp : null;
      if (!pair) { let bd = TP.duoBreak; for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) { const d = dist(free[i], free[j]); if (d <= bd) { bd = d; pair = [i, j]; } } }
      P.duo = pair ? [free[pair[0]].id, free[pair[1]].id] : null;
      return pair;
    }
    assign(team) {
      const M = this.map, TP = CONFIG.tactics.p, S = this.strat[team], us = this.units.filter(u => u.team === team && u.alive && !u.struct && !this.gone(u));
      if (!us.length) return;
      const foes = this.units.filter(e => e.team !== team && e.alive && !this.hidden(e)), enemyUnits = foes.filter(e => e.team < 2);
      const cur = this.cur[team] = this.stratNow(team), W = cur.W, lead = cur.lead, dn = cur.dn;
      const SB = dn === 'bossWait' ? 'steal' : dn === 'boss' ? 'contest' : S.boss, BL = dn === 'boss' || dn === 'bossWait' ? 7 : S.bossL, FM = dn === 'convoy' ? 'group' : S.formation, FMS = dn === 'convoy' ? 1 : S.formationS;
      const cvy = dn === 'convoy' && us.length > 1 ? us.reduce((p, q) => (this.coreValue(q) > this.coreValue(p) ? q : p)) : null, cvyOn = !!cvy && this.coreValue(cvy) >= 2;
      const boss = this.sudden ? null : this.units.find(b => b.team === 2 && b.alive), pit = M.zones.find(z => z.hub) || M.zones[0];
      const incoming = !boss && !this.sudden && this.bossPlan.some(p => !p.spawned && p.atTick != null && p.atTick - this.t <= ticks(p.warn + 3));
      const free = [], escorts = [];
      for (const u of us) {
        const thr = clamp(u.brain.retreatHp + (S.retreat === 'brave' ? -1 : S.retreat === 'careful' ? 1 : 0) * TP.retreatThrStep * S.retreatL, 0.06, 0.75);      // 뒤처져도 체력 낮은 채 더 싸우지 않음
        if (!this.sudden && u.hp < u.maxHp * thr) {
          const pods = M.pods.filter(p => p.readyAt <= this.t + this.sec(u.brain.waitPod ? 12 : 4) && Math.hypot(p.x - u.x, p.y - u.y) < TP.podReach * W.pod);
          if (pods.length) {
            const risk = p => Math.hypot(p.x - u.x, p.y - u.y) + (enemyUnits.some(e => Math.hypot(e.x - p.x, e.y - p.y) < 14) ? 45 : 0);
            u.goal = { type: 'pod', pod: pods.reduce((a, b) => (risk(a) <= risk(b) ? a : b)) }; continue;
          }
        }
        const uo = this.orderOf(u);
        if (uo) { const og = this.orderGoal(u, uo, team); if (og) { u.goal = og; continue; } }
        if (dn === 'regroup') { u.goal = { type: 'stage', since: this.t }; continue; }
        if (dn === 'retreat') { u.goal = { type: 'guard', z: this.homeDep(team), since: this.t }; continue; }
        if (cvyOn) {
          if (u === cvy) { const zs = M.zones.filter(z => z.deposit); u.goal = { type: 'deposit', z: zs.reduce((a, c) => (dist(u, a) <= dist(u, c) ? a : c)), since: this.t }; }
          else u.goal = { type: 'escort', a: cvy, since: this.t };
          continue;
        }
        const lg = this.layerGoal(u, team, us); if (lg) { u.goal = lg; continue; }
        if (u.tac.mission === 'escort' && us.length > 1) { escorts.push(u); continue; }
        free.push(u);
      }
      for (const u of escorts) {
        const mates = us.filter(a => a !== u && a.tac.mission !== 'escort'), pool = mates.length ? mates : us.filter(a => a !== u);
        const esc = a => this.coreValue(a) * TP.escortCarry + (a.atk + a.ap) / 100; u.goal = { type: 'escort', a: pool.reduce((p, q) => (esc(p) >= esc(q) ? p : q)) };
      }
      if (!free.length) return;
      const K = CONFIG.battle.map.core, KA = K.ai, ccap = FM === 'group' ? 3 : FM === 'split' ? 1 : KA.cap, crowdK = FM === 'split' ? KA.crowdSplit : FM === 'group' ? 0 : KA.crowdMul;
      const carried = e => (e.carry || []).reduce((q, c) => q + c.value, 0), tm = K.timing[cur.dep] || K.timing.normal, dL = S.depositL - 4;
      const need = clamp(Math.round(tm.base + tm.step * dL), 1, K.carryCap), low = tm.low ? clamp(Math.round(tm.low + tm.lowStep * dL), 1, K.carryCap) : K.carryCap + 1;
      const known = this.cores.filter(c => c.known[team] && c.lockUntil <= this.t), hd = this.homeDep(team), fd = this.foeDep(team);
      if (dn === 'wave' && known.length) {
        const left = free.slice(), goals = new Map(), fit = (u, c) => this.coreSlots(u) + c.slots <= K.carryCap;
        for (const c of known.slice().sort((a, p) => p.value - a.value)) {
          if (!left.length) break; let bi = -1, bd = 1e9;
          left.forEach((u, i) => { if (!fit(u, c)) return; const d = dist(u, c); if (d < bd) { bd = d; bi = i; } });
          if (bi >= 0) { goals.set(left[bi], c); left.splice(bi, 1); }
        }
        for (const u of left) { let bc = null, bd = 1e9; for (const c of known) { if (!fit(u, c)) continue; const d = dist(u, c); if (d < bd) { bd = d; bc = c; } } if (bc) goals.set(u, bc); }
        goals.forEach((c, u) => { u.goal = { type: 'core', c, since: this.t }; free.splice(free.indexOf(u), 1); });
        if (!free.length) return;
      }
      const targets = [];
      for (const c of known) targets.push({ type: 'core', c, x: c.x, y: c.y, v: c.value * KA.coreMul * W.core * clamp(1 + KA.needCore * this.sit[team].need, 0.75, 1.35), cap: ccap, co: true });
      for (const z of M.zones) if (z.deposit) targets.push({ type: 'deposit', z, x: z.x, y: z.y, v: 0, cap: 3, co: true, foes: enemyUnits.filter(e => Math.hypot(e.x - z.x, e.y - z.y) <= KA.depThreatR).length });
      const Dg = K.danger, foesAll = enemyUnits.filter(e => !e.struct && !this.hidden(e));
      const gv = Math.max(0, W.post - 1) * KA.guardMul;
      if (gv > 0.05) targets.push({ type: 'guard', z: hd, x: hd.x, y: hd.y, v: gv, cap: 2, co: true });
      if (free.some(u => this.mission(u, cur) === 'ambush')) targets.push({ type: 'ambush', z: fd, x: fd.x, y: fd.y, v: KA.ambushV, cap: 2, co: true });
      if (boss) {
        const bv = this.bossValue(team, boss, us, enemyUnits, W, SB, BL, dn); let v = bv.v, cap = bv.cap, stage = bv.stage;
        v *= clamp(1 - 0.1 * us.reduce((q, a) => q + this.coreValue(a), 0), 0.3, 1) * (lead >= 2 ? 0.6 : lead <= -2 ? 1.2 : 1);
        targets.push({ type: 'boss', boss, x: boss.x, y: boss.y, v, cap });
        if (stage) targets.push({ type: 'stage', x: pit.x, y: pit.y, v: stage * W.boss, cap: 3 });
      } else if (incoming && SB !== 'yield') targets.push({ type: 'stage', x: pit.x, y: pit.y, v: 2 * W.boss * (SB === 'contest' ? 1.2 : 1), cap: 3 });
      if (enemyUnits.length) {
        const prey = enemyUnits.map(e => ({ e, s: (1 - e.hp / e.maxHp) + (enemyUnits.some(o => o !== e && dist(o, e) < 25) ? 0 : 0.4) + (e.role.backline ? KA.backPrey : 0) + carried(e) * KA.carryPrey * (dn === 'kill' ? 3 : 1) })).sort((p, q) => q.s - p.s)[0].e;
        const v = Math.max(0, W.kill - 0.6) * 2.2 + (prey.hp < prey.maxHp * 0.35 ? 0.45 : 0) + (this.sudden ? 0.6 : 0) + (Math.abs(lead) >= 2 ? -0.2 : 0) + carried(prey) * KA.huntV;
        if (v > 0.05 || free.some(u => this.mission(u, cur) === 'hunt')) targets.push({ type: 'hunt', e: prey, x: prey.x, y: prey.y, v: Math.max(v, 0.2), cap: dn === 'kill' ? 3 : W.kill > 1.2 ? 2 : 1 });
      }
      if (free.length && us.length > 1) targets.push({ type: 'join', x: us.reduce((q, a) => q + a.x, 0) / us.length, y: us.reduce((q, a) => q + a.y, 0) / us.length, v: KA.join, cap: 3 });
      const Sn = this.sit[team], msit = 1 - 0.3 * clamp(Math.abs(lead) / 4, 0, 1), duoP = dn === 'convoy' ? (this.tp[team].duo = null) : this.duoPair(team, S, free, TP);
      for (const tg of targets) {
        if (tg.type === 'boss' || tg.type === 'stage' || tg.type === 'join') continue;
        tg.fp = foesAll.reduce((q, e) => { const d = Math.hypot(e.x - tg.x, e.y - tg.y); return q + (d <= Dg.foeR ? this.power(e) : d <= Dg.reachR ? this.power(e) * Dg.reachW : 0); }, 0);
        tg.mates = us.map(a => ({ a, p: Math.hypot(a.x - tg.x, a.y - tg.y) <= Dg.mateR ? this.power(a) : 0 }));
      }
      const same = (g, tg) => !!g && g.type === tg.type && g.z === tg.z && g.c === tg.c && g.boss === tg.boss && g.pt === tg.pt;
      const left = (this.cfg.maxTicks - this.t) / TPS, urg = this.sudden ? 1 : Math.max(left <= KA.urgentSec ? KA.urgentMul : lead <= -1 && left <= KA.trailSec ? KA.trailMul : 1, 1 + KA.needUrg * Math.max(0, Sn.need));
      const depSc = (u, tg, dd) => {
        const slots = this.coreSlots(u); if (!slots) return -1e3;
        const val = this.coreValue(u), foeU = enemyUnits.some(e => dist(u, e) <= KA.safeR);
        let v = slots >= K.carryCap ? KA.depFull : (slots >= need || urg > 1 || (slots >= low && !foeU) || !known.length) ? val * KA.depMul * KA.depReady : val * KA.depMul * KA.depWait;
        const near = dd <= ((tg.z && tg.z.r) || 12) + 10;
        // 존에서 멀 때만 greed(더 모으기) 패널티 — 바로 옆이면 상식적으로 제출 후보
        if (u.tac.mission === 'collect' && slots < K.carryCap && !near) v *= 1 - KA.greed * u.tac.missionS;
        if (near && slots > 0) v += 2.5 + val * 0.8;
        const ms = this.mission(u, cur);
        v *= urg * (cur.st === 'collect' ? KA.collectDep : 1) * (ms === 'hunt' || ms === 'ambush' ? KA.fighterDep : 1);
        if (Sn.need < -0.25) v *= 1 + KA.leadDep * -Sn.need;
        if (tg.foes) v *= KA.depThreatMul;
        return v - dd / KA.distDiv - (tg.foes ? KA.depThreatCost : 0);
      };
      if (!this.sudden && known.length < 2) { const sp = this.scoutPick(team, us); if (sp) targets.push({ type: 'scout', pt: sp, x: sp.x, y: sp.y, v: KA.scoutV * (known.length ? 0.6 : 1) * (1 + Math.max(0, Sn.need)), cap: 1 }); }      // 아는 코어가 적으면 구역 순회
      const mat = free.map(u => targets.map(tg => {
        const dd = Math.hypot(u.x - tg.x, u.y - tg.y), g = u.goal, T = u.tac, ms = this.mission(u, cur), mS = this.forcedMission(u) ? 1 : T.missionS, mk = (0.5 + 0.5 * mS) * msit; let sc;
        if (tg.type === 'core') sc = this.coreSlots(u) + tg.c.slots > K.carryCap ? -1e3 : tg.v - dd / KA.distDiv;
        else if (tg.type === 'deposit') sc = depSc(u, tg, dd);
        else if (tg.type === 'join') sc = dd < KA.joinMin ? -1e3 : tg.v * clamp(dd / KA.joinRef, 0.4, 1.2);
        else if (tg.type === 'ambush' && ms !== 'ambush') sc = -1e3;
        else sc = tg.v - dd / 150;
        if (sc <= -1e3) return sc;
        if ((tg.type === 'boss' || tg.type === 'stage') && this.coreSlots(u)) sc -= this.coreValue(u) * KA.bossCarryPen;      // 코어 든 선수는 보스보다 제출 우선
        if (tg.fp > 0) {
          let mp = this.power(u); for (const m of tg.mates) if (m.a !== u) mp += m.p;
          const odds = tg.fp / mp, over = clamp(odds - Dg.safe, 0, Dg.cap), kr = S.retreat === 'brave' ? Dg.brave : S.retreat === 'careful' ? Dg.careful : 1;
          sc -= (over * Dg.pen + (odds >= Dg.veto ? Dg.vetoPen : 0)) * kr * (1 + this.coreValue(u) * Dg.carryMul);
        }
        if (same(g, tg) && (tg.type !== 'hunt' || g.e === tg.e)) sc += 0.15;
        if (g && g.since != null && same(g, tg) && this.t - g.since < ticks(KA.hold)) sc += KA.holdBonus;
        if (tg.type === 'hunt' && u.f.role === 'assassin') sc += KA.assassinHunt;
        if (ms === 'collect') { if (tg.type === 'core') sc += (TP.mCollect + TP.mCollectV * tg.v * mS) * mk * clamp(1.4 - dd / (TP.collectR0 + TP.collectRStep * T.missionL), 0, 1); else if (tg.type === 'hunt') sc -= TP.mHuntOff * mk; }
        else if (ms === 'ambush') { if (tg.type === 'ambush') sc += TP.mAmbush * mk; else if (tg.type === 'core') sc -= TP.mAmbushOff * mk; else if (tg.type === 'hunt') sc += TP.mHuntOff * mk; }
        else if (ms === 'hunt') { if (tg.type === 'hunt') sc += TP.mHunt * mk * clamp(1.4 - dd / (TP.huntRange0 + TP.huntRangeStep * T.missionL), 0, 1) + TP.mHuntCarry * carried(tg.e); else if (tg.type === 'core') sc -= TP.mHuntOff * mk; }
        else if (ms === 'boss') {
          if (boss || incoming) { if (tg.type === 'boss' || tg.type === 'stage') sc += TP.mBoss * mk * clamp(1.4 - dd / (TP.bossRange0 + TP.bossRangeStep * T.missionL), 0.2, 1); else sc -= TP.mBossOff * mk; }
          else if (tg.type === 'core') sc += TP.mBossWait * mk; else if (tg.type === 'hunt') sc -= TP.mBossOff * mk;
        }
        return sc;
      }));
      let best = null, bscore = -1e9; const pick = [];
      const rec = (i, sc) => {
        if (i === free.length) {
          const cnt = targets.map(() => 0); pick.forEach(k => cnt[k]++); let tot = sc;
          cnt.forEach((c, k) => {
            if (c > 1 && targets[k].co) tot -= crowdK * (c - 1);
            if (c > targets[k].cap) tot -= 0.8 * (c - targets[k].cap);
            if (FM === 'group' && c > 1) tot += TP.groupBonus * (0.5 + FMS) * c * (c - 1) / 2;
          });
          if (duoP) { const pk = pick[duoP[0]]; if (targets[pk].co && pk === pick[duoP[1]]) { tot += TP.duoBonus * (1 + targets[pk].v); free.forEach((_, n) => { if (n !== duoP[0] && n !== duoP[1] && pick[n] === pk) tot -= TP.duoApart; }); } }
          if (tot > bscore) { bscore = tot; best = pick.slice(); } return;
        }
        targets.forEach((tg, k) => { pick[i] = k; rec(i + 1, sc + mat[i][k]); });
      };
      rec(0, 0);
      free.forEach((u, i) => {
        const tg = targets[best[i]], g = u.goal;
        const ng = tg.type === 'core' ? { type: 'core', c: tg.c } : tg.type === 'boss' ? { type: 'boss', boss: tg.boss } : tg.type === 'hunt' ? { type: 'hunt', e: tg.e } : tg.pt ? { type: tg.type, pt: tg.pt } : tg.z ? { type: tg.type, z: tg.z } : { type: tg.type };
        ng.since = same(g, ng) && (ng.type === 'hunt' || g.e === ng.e) && g.since != null ? g.since : this.t;
        u.goal = ng;
      });
      if (!this.sudden && (boss || incoming) && SB !== 'yield' && free.length >= 2 && free.some(u => u.brain.ensureBoss) && !free.some(u => u.goal.type === 'boss' || u.goal.type === 'stage') && !us.some(a => Math.hypot(a.x - pit.x, a.y - pit.y) <= pit.r + 16)) {
        let pu = null, ps = 1e9;
        for (const u of free) { if (!u.brain.ensureBoss || u.hp < u.maxHp * 0.4 || this.coreSlots(u) >= 2) continue; const d = Math.hypot(u.x - pit.x, u.y - pit.y); if (d < ps) { ps = d; pu = u; } }
        if (pu) pu.goal = { type: 'stage' };
      }
    }

    /* ---------- 사망 / 부활 / 점수 ---------- */
    scoreAdd(team, pts, why) {
      if (!pts) return;
      this.score[team] += pts;
      const R = this.rec, d = Math.round(this.score[0]) - Math.round(this.score[1]), s = d > 0 ? 1 : d < 0 ? -1 : 0;
      R.pts.push({ t: this.t, team, pts, why });
      if (s && R.lead && s !== R.lead) R.flips.push({ t: this.t, team: s > 0 ? 0 : 1, why });
      if (s) R.lead = s;
    }
    onDeath(src, t) {
      const MC = CONFIG.battle.map, R = this.cfg.respawn, via = this.rec.killVia; this.rec.killVia = null;
      if (t.struct) { t.target = null; t.st = []; const i = t.ob ? this.map.obstacles.indexOf(t.ob) : -1; if (i >= 0) this.map.obstacles.splice(i, 1); this.emit({ type: 'struct', phase: 'down', unit: t }); return; }
      if (t.team === 2) { t.target = null; t.st = []; this.bossDown(src, t); return; }
      if (t.carry.length) this.dropCores(t);
      const firstKill = !this.rec.first;
      { const K = { t: this.t, kt: src ? src.team : -1, k: src && src.team < 2 ? src.id : null, v: t.id, via: via || '' }; this.rec.kills.push(K); if (!this.rec.first) this.rec.first = K; }
      if (src && src.team < 2 && src.team !== t.team) {
        const BN = MC.bonus;
        this.scoreAdd(src.team, MC.killPoints, 'kill');
        if (firstKill) this.scoreAdd(src.team, BN.first, 'first');
        if ((t.streak || 0) >= BN.shutAt) this.scoreAdd(src.team, BN.shut, 'shutdown');
        src.streak = (src.streak || 0) + 1;
      }
      t.streak = 0;
      t.deaths++; t.target = null; t.goal = null;
      for (const s of t.st) if (s.onEnd) s.onEnd(this, t, s);
      t.st = []; t.bm = []; t.rc = {};
      t.respawnAt = this.t + this.sec(Math.min(R.max, R.base + R.perDeath * (t.deaths - 1)));
      if (src && src.team < 2 && src.team !== t.team && !this.units.some(u => u.team === t.team && u.alive && !u.struct)) { this.scoreAdd(src.team, MC.acePoints, 'ace'); this.emit({ type: 'ace', team: src.team }); }
    }
    respawn(u) {
      const F = u.f, i = Number(u.id.split('-')[1]) || 0, spp = this.spawnPt(u.team, i);
      u.alive = true; u.hp = u.maxHp; u.mp = Math.max(u.mp, u.mpMax * 0.5);
      u.x = u.px = spp.x; u.y = u.py = spp.y; u.regroupUntil = this.t + ticks(2 + Math.random() * 2);      // 부활 직후 2~4초는 아군 합류
      u.fxDead = 1e12; u.cd = 0.5; u.st = []; u.target = null; u.mem = {}; u.scale = 1; u.glow = null; u.gauge = null;
      u.role = { ...F.ai, range: F.stats.range }; if (F.form0) u.form = F.form0;
      const p = F.passive; if (p && p.init) p.init(this, u); if (F.form0 && p && p.onForm) p.onForm(this, u, F.form0);
      this.buff(u, 'spawn', this.cfg.respawn.protect, { name: '재출격', quiet: true, f: { invuln: true } });
      this.emit({ type: 'aoe', x: u.x, y: u.y, radius: 7, color: CONFIG.ui.teamColors[u.team] });
      this.emit({ type: 'respawn', unit: u });
    }
    /* ---------- 중립 보스 ---------- */
    spawnBoss(pl) {
      const F = CONFIG.bossDefs[pl.def], u = this.makeUnit(F, 2, 0, 1, null);
      u.id = 'boss-' + pl.kind; u.x = u.px = pl.lair.x; u.y = u.py = pl.lair.y; u.scale = F.scale; u.bossDef = pl; u.facing = 1;
      if (pl.hpMul && pl.hpMul !== 1) u.maxHp = u.hp = Math.round(u.maxHp * pl.hpMul);
      u.st.push({ key: 'bossarmor', name: '고대 장갑', good: true, dur: 999999, ccImmune: true, quiet: true });
      this.units.push(u); pl.unit = u; pl.spawned = true;
      this.rec.boss.push({ t: this.t, ph: 'spawn', kind: pl.kind, def: pl.def });
      this.emit({ type: 'boss', phase: 'spawn', unit: u, kind: pl.kind });
    }
    bossAct(u) {
      const F = u.f, S = F.slam, foes = this.units.filter(e => e.team < 2 && e.alive && !this.hidden(e));
      u.cd = Math.min(u.cd + this.eff(u, 'aspd'), 1.5);
      const near = foes.filter(e => dist(u, e) <= 14);
      if (!near.length) { u.idle = (u.idle || 0) + 1; if (u.idle > 100) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.0012); return; }
      u.idle = 0;
      const t = nearestOf(u, near); u.facing = t.x >= u.x ? 1 : -1;
      if (this.t >= (u.mem.slamAt || 0) && near.some(e => dist(u, e) <= S.r * 0.9)) {
        u.mem.slamAt = this.t + ticks(S.every); u.fxAtk = this.t;
        this.zone({ x: u.x, y: u.y, r: S.r, dur: 0.8, owner: u, kind: 'warn', color: '#ef4444' });
        this.later(0.8, b => {
          if (!u.alive) return; b.emit({ type: 'aoe', x: u.x, y: u.y, radius: S.r, color: '#ef4444' });
          b.units.filter(e => e.team < 2 && e.alive && !b.hidden(e) && dist(u, e) <= S.r + 1).forEach(e => { b.deal(u, e, { type: 'phys', raw: S.raw + S.k * b.eff(u, 'atk'), via: '대지 강타', splash: true }); b.cc(u, e, 'stagger', 0.5); b.knock(u, e, 5); });
        });
      } else if (u.cd >= 1 && dist(u, t) <= u.role.range) { u.cd -= 1; u.fxAtk = this.t; this.attack(u, t); }
    }
    bossDown(src, t) {
      const pl = t.bossDef; if (!pl || !src || src.team > 1) return;
      const team = src.team, B = CONFIG.battle.map.core.boss, BF = B.buff, n = pl.kind === 'late' ? B.late : B.first;
      this.bossKills[team]++;
      const placed = [];
      for (let i = 0; i < n; i++) {
        let best = null, bs = -1;
        for (let k = 0; k < 30; k++) {
          const a = Math.PI * 2 * (i + rnd(-0.4, 0.4)) / n, r = rnd(B.scatterMin, B.scatterR), p = this.clampPos(t.x + Math.cos(a) * r, t.y + Math.sin(a) * r);
          const g = placed.reduce((m, q) => Math.min(m, Math.hypot(q.x - p.x, q.y - p.y)), 1e9);
          if (g > bs) { bs = g; best = p; }
          if (g >= B.minGap) break;
        }
        placed.push(best);
        this.newCore('small', best.x, best.y, B.lockSec, true);
      }
      let buffed = 0;
      for (const u of this.units) {
        if (u.team !== team || !u.alive || u.struct || this.gone(u)) continue;
        this.buff(u, 'bossbuff', BF.sec, { name: '보스의 가호', mul: { atk: 1 + BF.atk, ap: 1 + BF.ap, spd: 1 + BF.spd }, f: { dmgIn: 1 + BF.taken, noCarrySlow: BF.noCarrySlow } });
        this.heal(u, u, u.maxHp * BF.healPct, '보스의 가호'); buffed++;
      }
      this.rec.boss.push({ t: this.t, ph: 'down', team, kind: pl.kind, def: pl.def, n });
      this.rec.cores.push({ t: this.t, kind: 'drop', team: 2, n });
      this.rec.cores.push({ t: this.t, kind: 'bossbuff', team, n: buffed });
      const nx = this.bossPlan.find(p => !p.spawned && p.after != null && p.atTick == null);
      if (nx) nx.atTick = this.t + ticks(nx.after);
      this.emit({ type: 'boss', phase: 'down', team, unit: t, kind: pl.kind, n, buffed, next: nx ? nx.after : 0 });
    }
    tickMap() {
      const M = this.map;
      for (const pl of this.bossPlan) {
        if (this.sudden || pl.spawned || pl.atTick == null) continue;
        if (!pl.warned && this.t >= pl.atTick - ticks(pl.warn)) { pl.warned = true; this.emit({ type: 'boss', phase: 'warn', plan: pl, kind: pl.kind }); }
        if (this.t >= pl.atTick) this.spawnBoss(pl);
      }
      for (const tm of [0, 1]) {
        const every = this.assignEvery(tm);
        if (this.t % every === 1) this.assign(tm);
      }
      for (const u of this.units) if (!u.alive && u.respawnAt && this.t >= u.respawnAt) { u.respawnAt = 0; this.respawn(u); }
      for (const p of M.pods) {
        if (this.t < p.readyAt) continue;
        const u = this.units.find(x => x.team < 2 && !x.struct && x.alive && !this.gone(x) && x.hp < x.maxHp * 0.97 && Math.hypot(x.x - p.x, x.y - p.y) <= 3.6);
        if (!u) continue;
        p.readyAt = this.t + this.sec(p.cd);
        this.heal(u, u, u.maxHp * p.heal, '회복 장치'); this.emit({ type: 'aoe', x: p.x, y: p.y, radius: 6, color: '#34d399' }); this.emit({ type: 'pod', pod: p, unit: u });
      }
    }
    startSudden() {
      const SD = CONFIG.battle.map.sudden;
      this.sudden = true; this.suddenAt = this.t; this.suddenLoser = null; this.rec.suddenAt = this.t;
      for (const b of this.units) if (b.team === 2 && b.alive) { b.alive = false; b.hp = 0; b.st = []; this.emit({ type: 'boss', phase: 'gone', unit: b }); }
      this.bossPlan.forEach(p => { p.spawned = true; });
      this.map.pods.forEach(p => { p.readyAt = 1e12; });
      this.zones = []; this.cores = [];
      const SK = CONFIG.battle.map.core.sudden, A = this.cfg.arena;
      for (let j = 0; j < Math.floor(SK.n / 2); j++) {
        const p = this.pushOut(A.w / 2 - SK.dx, A.h / 2 + SK.dy * (j % 2 ? -1 : 1));
        this.newCore('small', p.x, p.y, 0, true); this.newCore('small', A.w - p.x, A.h - p.y, 0, true);
      }
      for (const u of this.units) {
        if (u.team > 1 || u.struct) continue;
        u.carry = []; u.depProg = 0; u.depAt = ''; u.bail = null; u.bailN = 0;
        if (!u.alive) { u.respawnAt = 0; this.respawn(u); }
        for (const s of u.st) if (s.onEnd) s.onEnd(this, u, s);
        const i = Number(u.id.split('-')[1]) || 0, sp = this.spawnPt(u.team, i);
        u.st = []; u.bm = []; u.rc = {}; u.target = null; u.goal = null; u.fb = null; u.x = u.px = sp.x; u.y = u.py = sp.y;
        u.hp = Math.max(1, Math.round(u.maxHp * SD.hpRatio)); u.mp = u.mpMax;
        this.buff(u, 'spawn', SD.protect, { name: '서든데스', quiet: true, f: { invuln: true } });
      }
      this.aiSudden();
      this.emit({ type: 'sudden' });
    }
    suddenOk() {
      const kinds = CONFIG.battle.map.sudden.kinds, m = typeof Game !== 'undefined' && Game.match;
      return !kinds || !m || kinds.includes(m.kind);
    }

    endMatch() {
      const alive = [0, 1].map(i => this.units.filter(u => u.team === i && u.alive).length);
      this.over = true; this.res = this.finish(alive); this.emit({ type: 'end', res: this.res });
    }
    clockText() {
      if (this.sudden) return 'SUDDEN ' + ((this.t - this.suddenAt) / TPS).toFixed(1) + 's';
      const left = Math.max(0, (this.cfg.maxTicks - this.t) / TPS), m = Math.floor(left / 60), sc = Math.floor(left % 60);
      return m + ':' + String(sc).padStart(2, '0');
    }

    separate() {
      const min = this.cfg.unitRadius * 2, A = this.cfg.arena, us = this.units.filter(u => u.alive && !u.struct && !this.gone(u));
      for (let i = 0; i < us.length; i++) for (let j = i + 1; j < us.length; j++) {
        const a = us[i], b = us[j], d = dist(a, b);
        if (d >= min) continue;
        const dx = d ? (a.x - b.x) / d : 1, dy = d ? (a.y - b.y) / d : 0, push = min - d, wa = b.team === 2 ? 1 : a.team === 2 ? 0 : 0.5, wb = 1 - wa;
        a.x = clamp(a.x + dx * push * wa, 2, A.w - 2); a.y = clamp(a.y + dy * push * wa, 5, A.h - 2);
        b.x = clamp(b.x - dx * push * wb, 2, A.w - 2); b.y = clamp(b.y - dy * push * wb, 5, A.h - 2);
      }
      for (const u of us) { const p = this.pushOut(u.x, u.y); u.x = p.x; u.y = p.y; }
    }

    tick() {
      if (this.over) return;
      this.t++;
      if (this.t % 10 === 0 && typeof Feedback !== 'undefined') Feedback.tick(this);
      for (const u of this.units) {
        u.px = u.x; u.py = u.y;
        if (!u.alive) continue;
        for (const k in u.cds) if (u.cds[k] > 0) u.cds[k]--;
        if (u.f && u.f.ult && u.f.ult.timed && u.ultG < 100) this.setUlt(u, u.ultG + 100 / ticks(u.f.ult.cd));
        this.gain(u, u.mpMax * this.cfg.mana.regenPerSec / TPS * u.mpMul);
        const p = u.f.passive; if (p && p.tick) p.tick(this, u);
      }
      for (const u of this.units) if (u.alive) this.tickStatus(u);
      this.tickZones(); this.tickCores(); this.tickTimers(); this.tickMap();
      this.tickOrders(); this.teamPlan(0); this.teamPlan(1);
      const order = this.units.filter(u => u.alive);
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      for (const u of order) if (u.alive) this.act(u);
      this.separate();
      for (const u of order) {                                                               // 제자리에서 비비는(막힌) 유닛은 방향을 바꿔 우회
        if (!u.alive || u.team > 1) continue;
        const moved = Math.hypot(u.x - u.px, u.y - u.py);
        if (u.intent === this.t) { if (moved < 0.2 * Math.max(0.1, this.eff(u, 'spd'))) u.stuck++; else u.stuck = Math.max(0, u.stuck - 2); } else u.stuck = Math.max(0, u.stuck - 1);
        if (u.stuck > 10) { u.stuck = 0; u.nav = null; u.side *= -1; u.detour = { until: this.t + ticks(1.0), ang: (Math.random() < 0.5 ? 1 : -1) * (1.0 + Math.random() * 0.6) }; }
      }
      if (!this.sudden && this.t >= this.cfg.maxTicks) {
        if (Math.round(this.score[0]) === Math.round(this.score[1]) && this.suddenOk()) this.startSudden(); else this.endMatch();
      } else if (this.sudden && (this.suddenWinner != null || this.t >= this.cfg.maxTicks + CONFIG.battle.map.sudden.maxTicks)) this.endMatch();
    }

    finish(alive) {
      const hp = [0, 1].map(i => {
        const us = this.units.filter(u => u.team === i && !u.struct);
        return us.reduce((s, u) => s + u.hp, 0) / us.reduce((s, u) => s + u.maxHp, 0);
      });
      const sc = this.score.map(v => Math.round(v));
      let winner = sc[0] === sc[1] ? -1 : (sc[0] > sc[1] ? 0 : 1);
      if (this.sudden) {
        if (this.suddenWinner != null) winner = this.suddenWinner;
        else if (Math.abs(hp[0] - hp[1]) >= 0.02) winner = hp[0] > hp[1] ? 0 : 1;
      }
      const units = this.units.filter(u => u.team < 2 && !u.struct).map(u => {
        const slot = Number(u.id.split('-')[1]) || 0, md = this.teams[u.team].moods, nick = (md && md[slot] && md[slot].nick) || '';
        return { id: u.id, team: u.team, slot, nick, ch: u.f, dmg: Math.round(u.dmg), healed: Math.round(u.healed), kills: u.kills, alive: u.alive,
          deaths: u.deaths, taken: Math.round(u.taken || 0), skills: u.skN || 0, ults: u.ultN || 0, deliv: u.deliv, coresIn: u.coresIn, dpts: u.dpts, fb: u.fbApplied || null };
      });
      const mv = Battle.pickMvp(units), TC = CONFIG.tactics;
      const tac = { st: this.strat.map(s => { const o = {}; TC.team.forEach(c => { o[c.id] = s[c.id]; }); return o; }),
        sl: [0, 1].map(i => this.units.filter(u => u.team === i && !u.struct).sort((a, b) => (Number(a.id.split('-')[1]) || 0) - (Number(b.id.split('-')[1]) || 0)).map(u => { const o = {}; TC.categories.forEach(c => { o[c.id] = (u.tac && u.tac[c.id]) || c.neutral; }); return o; })) };
      return {
        tac,
        winner, hp, score: sc, scoreText: sc[0] + ':' + sc[1], mvpTeam: mv ? mv.team : -1, mvpFighter: mv ? mv.ch.id : '', mvpName: mv ? (mv.nick || mv.ch.name) : '',
        target: 0, capTime: [0, 0], bossKills: this.bossKills.slice(), sudden: this.sudden, suddenWinner: this.suddenWinner, suddenLoser: this.suddenLoser, ticks: this.t, timeout: true,
        units, rec: this.rec
      };
    }
  }

  Battle.mvpScore = u => u.dmg + u.healed + (u.dpts || 0) * CONFIG.battle.map.core.mvpPerPoint;
  Battle.pickMvp = units => units.reduce((a, u) => (Battle.mvpScore(u) > (a ? Battle.mvpScore(a) : -1) ? u : a), null);      // 피해+치유+제출 점수 환산 최대 (결과 창 ★ 와 같은 기준)
  Battle.simulate = (teams, rule) => { const b = new Battle(teams, rule); while (!b.over) b.tick(); return b.res; };
  return Battle;
})();
