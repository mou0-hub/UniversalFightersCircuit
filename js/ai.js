(() => {
  const A = () => CONFIG.mind;
  const TPS = 1000 / CONFIG.battle.tickMs;
  const ticks = s => Math.max(1, Math.round(s * TPS));
  const { dist, clamp, segDist, lerp } = Util;
  const nearestOf = (u, list) => list.reduce((a, b) => (dist(u, a) <= dist(u, b) ? a : b));
  const lowestOf = list => list.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b));
  const carried = e => (e.carry || []).reduce((q, k) => q + k.value, 0);
  const half = v => clamp(0.5 + 0.5 * v, 0, 1);
  const ramp = (v, lo, hi) => clamp((v - lo) / Math.max(1e-6, hi - lo), 0, 1);       // 능력치를 문턱 대신 0~1 연속값으로
  const GR = () => CONFIG.mind.grade;
  const gOf = u => (u.g != null ? u.g : 0.67);
  const NOSTYLE = Object.freeze({});
  /* ===== 재설계: 모드 / 팀 목표 / 역할 ===== */
  const LD = { sec: 26, sight: 55, sightQ: 30, noticeBase: 0.25, noticeQ: 0.5, ambush: 24, minThr: 0.35, v: 2.4, cap2: 1.1 };   // 리드 운영: 보유량 추정 유지시간(초) · 시야 · 코어 사라짐 인지 확률 · 길목 거리 · 대응 문턱 · 가치
  const CARRY_MIN = 2;                                   // 이 가치 이상 들면 Carrier (Escort 강제 배정)
  const MD = {                                           // push: 템포 보정, aggro: 교전 거리 보정, hold: 최소 유지 시간(초)
    Protect:     { push: -0.45, aggro: -8, hold: [6, 9], clutch: -0.15 },
    Extend:      { push: -0.15, aggro: -3, hold: [5, 8], clutch: -0.05 },
    Contest:     { push: 0,     aggro: 0,  hold: [4, 7], clutch: 0.05 },
    Comeback:    { push: 0.35,  aggro: 6,  hold: [4, 7], clutch: 0.35 },
    Desperation: { push: 0.75,  aggro: 12,  hold: [4, 6], clutch: 0.6 },
    SuddenPrep:  { push: -0.2,  aggro: -2, hold: [3, 5], clutch: 0.15 }
  };

  Object.assign(Battle.prototype, {
    clock() { const total = this.cfg.maxTicks / TPS; return { total, left: this.sudden ? 0 : Math.max(0, (this.cfg.maxTicks - this.t) / TPS) }; },
    aiInit() {
      this.sit = [0, 1].map(() => ({ at: 0, edge: 0, need: 0, win: 'even', bias: 0, biasAt: 0, lead: 0, left: 0, j: 0, c: 0, t: 0, o: 0, p: 0, r: 0, a: 0, f: 0, u: 0, g: 0.67, gk: 0 }));
      this.rk = [0, 1].map(() => ({ picks: [], thr: 0, ep: 0, unseen: 0, noise: 1, nAt: 0, pt: { x: 0, y: 0, r: 12 } }));
      this.md = [0, 1].map(() => ({ mode: 'Contest', since: 0, until: 0, goal: 'FarmCores', gUntil: 0, sig: '', rAt: 0, gs: null }));
      this.tp = [0, 1].map(() => ({ focus: null, gate: { st: 'idle', since: 0, until: 0 }, chain: { until: 0, by: null }, pod: null, rearm: 0, duo: null, chase: null, escort: null, engage: false, tempo: null, planAt: 0 }));
    },
    aiSudden() { this.md.forEach(M => { M.until = 0; M.gUntil = 0; M.sig = ''; }); this.tp.forEach(P => { P.gate.st = 'idle'; P.pod = null; P.focus = null; P.chase = null; P.escort = null; P.engage = false; }); },

    /* ---------- Layer 1: Game State / 모드 ---------- */
    gameState(team) {
      const S = this.sit[team], { total, left } = this.clock();
      const us = this.teamUnits(team), foes = this.foesOf(team), boss = this.sudden ? null : this.units.find(b => b.team === 2 && b.alive);
      const bossState = boss ? (boss.hp < boss.maxHp * 0.4 ? 'lowHp' : 'active') : (!this.sudden && this.bossSoon(40) ? 'upcoming' : 'none');
      return {
        scoreDiff: this.score[team] - this.score[1 - team], timeRatio: total ? left / total : 0, left, powerRatio: S.edge,
        ourCores: us.reduce((q, a) => q + this.coreValue(a), 0), theirCores: foes.reduce((q, a) => q + carried(a), 0),
        bossState, boss, suddenRisk: this.sudden || (left > 0 && left <= 15), aliveCount: [us.length, foes.length]
      };
    },
    modeStep(team, T) {
      const M = this.md[team], S = this.sit[team], gs = M.gs = this.gameState(team);
      if (this.t >= M.until) {
        const u = 1 - gs.timeRatio, m = gs.scoreDiff + 2.5 * gs.powerRatio * (1 + 0.5 * u);
        const big = 4 - 1.5 * u, dire = 3.5 - 1.5 * u;
        let want;
        if (this.sudden) want = 'Contest';
        else if (gs.suddenRisk && Math.round(gs.scoreDiff) === 0) want = 'SuddenPrep';
        else if (m >= big) want = 'Protect';
        else if (m >= 1) want = 'Extend';
        else if (m > -1) want = 'Contest';
        else if (m <= -dire && gs.timeRatio < 0.3) want = 'Desperation';
        else want = 'Comeback';
        const h = MD[want].hold;
        if (want !== M.mode) M.since = this.t;
        M.mode = want; M.until = this.t + ticks(lerp(h[0], h[1], 1 - half(S.r)));
      }
      T.push += MD[M.mode].push * (T.bank || T.gamble ? 0.4 : 1);   // 기존 bank/gamble 과 같은 방향이면 이중 보정 완화
    },

    /* ---------- 보스 대비 ---------- */
    bossEta() {                                           // 다음 보스 스폰까지 남은 초 (없으면 null)
      let m = null;
      for (const p of this.bossPlan || []) if (!p.spawned && p.atTick != null) { const s = (p.atTick - this.t) / TPS; if (s >= 0 && (m == null || s < m)) m = s; }
      return m;
    },
    bossPrepV(team, us, pit) {                            // 긴박도 = (스폰까지 남은 시간 - 도착 소요시간)이 줄수록 ↑. 점수 열세 ↑, 구덩이를 적이 선점했으면 ↓
      const eta = this.bossEta(); if (eta == null || this.sudden || !us.length || eta >= this.clock().left) return 0;
      const X = A().prep, S = this.sit[team];
      const trav = us.reduce((s, a) => s + dist(a, pit) / Math.max(0.05, this.eff(a, 'spd') * TPS), 0) / us.length;
      const est = trav * (1 + X.safety) * (1 + X.err * S.bias * (1 - 0.5 * half(S.o)));   // 판단력·오브젝트가 높을수록 도착 시간을 정확히 계산
      const urg = clamp(1 - (eta - est) / X.horizon, 0, 1); if (urg <= 0) return 0;
      const myP = us.reduce((q, a) => q + this.power(a), 0) || 1, pitFp = this.foesOf(team).filter(e => Math.hypot(e.x - pit.x, e.y - pit.y) <= 30).reduce((q, e) => q + this.power(e), 0);
      const contest = 1 / (1 + Math.pow(pitFp / myP * X.avoid, 2));
      return urg * clamp(1 + X.need * S.need, 0.5, 1.5) * (0.4 + 0.6 * contest);
    },

    /* ---------- Layer 2·3: 팀 목표 + 역할 ---------- */
    /* ---------- 리드 운영: 시야 밖 상대 보유량 추정 → 역전 위협 → 길목 차단 ---------- */
    rkQ(team) { const S = this.sit[team]; return S ? clamp(0.5 * half(S.j) + 0.5 * S.g, 0, 1) : 0.5; },
    aiPick(u, c) {                                         // 상대 팀 입장에서: 코어가 사라졌다 = 누군가 주웠다 (알고 있던 코어면 거의 확실, 아니면 판단력에 따라 눈치챔)
      const obs = 1 - u.team, R = this.rk && this.rk[obs]; if (!R) return;
      if ((c.known && c.known[obs]) || Math.random() < LD.noticeBase + LD.noticeQ * this.rkQ(obs)) { R.picks.push({ t: this.t, x: c.x, y: c.y, id: u.id }); if (R.picks.length > 8) R.picks.shift(); }
    },
    aiDrop(u, n) { const R = this.rk && this.rk[1 - u.team]; if (!R) return; for (let i = R.picks.length - 1, k = n; i >= 0 && k > 0; i--) if (R.picks[i].id === u.id) { R.picks.splice(i, 1); k--; } },
    aiDeposit(team, n) { const R = this.rk && this.rk[1 - team]; if (R) R.picks.splice(0, Math.max(1, n)); },
    reckon(team, foes) {                                   // 상대가 지금 들고 있을 코어 점수 추정 + 그걸 제출하면 얼마나 위험한가
      const R = this.rk[team], q = this.rkQ(team), us = this.teamUnits(team), T = this.tp[team].tempo;
      R.picks = R.picks.filter(p => this.t - p.t <= ticks(LD.sec * (0.7 + 0.6 * q)));
      const sr = LD.sight + LD.sightQ * q;
      const vis = foes.reduce((a, e) => a + (us.some(m => dist(m, e) <= sr) ? this.coreValue(e) : 0), 0);
      const inf = R.picks.length, ep = Math.max(vis, inf * (0.85 + 0.15 * q));
      R.ep = ep; R.unseen = Math.max(0, inf - vis);
      if (this.t >= R.nAt) { R.nAt = this.t + ticks(1); R.noise = 1 + (Math.random() - 0.5) * 0.5 * (1 - q); }
      const lead = this.score[team] - this.score[1 - team], fr = T ? T.fr : 0, gap = lead - ep;
      const urg = lead < 0 ? 0.35 : lead === 0 ? 0.8 : gap <= 0 ? 1.4 : gap < 1.5 ? 1 : gap < 3 ? 0.6 : 0.3;
      const late = 1 + 0.8 * fr + (this.sudden ? 0.6 : 0);
      R.thr = ep < 0.5 ? 0 : urg * (0.6 + 0.4 * clamp(ep / 2, 0, 2)) * late * R.noise;
      if (R.unseen >= 1 && inf) {                          // 가장 최근에 줍힌 곳 → 상대 제출 구역 방향의 길목
        const a = R.picks[R.picks.length - 1], z = this.foeDep(team), d = Math.hypot(a.x - z.x, a.y - z.y) || 1, k = Math.min(LD.ambush, d) / d;
        R.pt.x = z.x + (a.x - z.x) * k; R.pt.y = z.y + (a.y - z.y) * k; R.pt.r = 12;
      }
    },
    interceptTarget(team) {
      const R = this.rk[team]; if (!R || R.thr < LD.minThr || R.unseen < 1) return null;
      return { type: 'intercept', pt: R.pt, x: R.pt.x, y: R.pt.y, v: LD.v * Math.min(R.thr, 2) * clamp(R.ep / 2, 0.6, 1.6), cap: R.thr > LD.cap2 ? 2 : 1, co: false };
    },
    interceptScore(u, tg, dd) {
      if (this.coreSlots(u) >= 1 || u.hp < u.maxHp * 0.35) return -1e3;
      return tg.v * (1 + 0.3 * u.sn.o + 0.2 * Math.max(0, u.sn.c)) - dd / 120;
    },

    planMind(team, us, foes) {
      const M = this.md[team], P = this.tp[team], S = this.sit[team], gs = M.gs || this.gameState(team), edge = S.edge;
      const cv = us.reduce((q, a) => Math.max(q, this.coreValue(a)), 0), foeCar = foes.filter(e => carried(e) >= A().chase.minVal);
      const bossOn = gs.bossState === 'active' || gs.bossState === 'lowHp';
      this.reckon(team, foes);
      let want;
      if (this.sudden) want = 'ForceFight';
      else if (cv >= 3) want = 'SecureDeposit';
      else switch (M.mode) {
        case 'Protect': want = cv > 0 ? 'SecureDeposit' : 'FarmCores'; break;
        case 'Extend': want = cv >= CARRY_MIN ? 'SecureDeposit' : 'FarmCores'; break;
        case 'SuddenPrep': want = cv > 0 ? 'SecureDeposit' : 'FarmCores'; break;
        case 'Contest': want = bossOn && edge > -0.1 ? 'BossPlay' : foeCar.length && edge > 0 ? 'HuntCarrier' : edge > 0.25 ? 'ForceFight' : 'FarmCores'; break;
        case 'Comeback': want = foeCar.length ? 'HuntCarrier' : bossOn ? 'BossPlay' : edge > -0.15 ? 'ForceFight' : 'FarmCores'; break;
        default: want = bossOn ? 'BossPlay' : foeCar.length && edge > -0.3 ? 'HuntCarrier' : 'ForceFight';
      }
      const aliveFoe = this.units.filter(e => e.team === 1 - team && e.alive && !e.struct && e.team < 2).length, numAdv = us.length - aliveFoe;
      if (cv < 3 && want !== 'SecureDeposit' && M.mode !== 'Protect') {                    // 킬 직후 수적 우위면 주도권을 잡고, 열세면 모여서 버틴다
        if (numAdv >= 1) want = foeCar.length ? 'HuntCarrier' : bossOn ? 'BossPlay' : 'ForceFight';
        else if (numAdv <= -1 && M.mode !== 'Desperation') want = 'Stall';
      }
      if (want !== M.goal && (this.t >= M.gUntil || (want === 'SecureDeposit' && cv >= 3))) { M.goal = want; M.gUntil = this.t + ticks(4 + 3 * (1 - half(S.r))); M.sig = ''; }
      const G = M.goal;
      if (G === 'SecureDeposit' || G === 'Stall') P.engage = false;
      else if (G === 'ForceFight' && P.rearm <= this.t && foes.length) {
        P.engage = P.gate.st === 'go';
        if (!P.engage && P.gate.st === 'wait' && this.t - P.gate.since > ticks(1)) { P.gate.st = 'go'; P.gate.until = this.t + ticks(A().gate.goHit); P.engage = true; }
      }
      this.assignRoles(team, us, foes, M, foeCar);
    },
    assignRoles(team, us, foes, M, foeCar) {
      const carriers = us.filter(a => this.coreValue(a) >= CARRY_MIN).sort((a, b) => this.coreValue(b) - this.coreValue(a));
      const sig = carriers.map(a => a.id).join(',') + '|' + M.goal + '|' + us.length;
      if (sig === M.sig && this.t < M.rAt) return;
      M.sig = sig; M.rAt = this.t + ticks(3);
      for (const a of us) { a.cr = 'free'; a.crT = null; }
      const used = new Set();
      for (const c of carriers) { c.cr = 'carrier'; used.add(c); }
      if (carriers.length) {
        const top = carriers[0], threatened = foes.some(e => dist(e, top) <= 45);
        let need = Math.min(us.length - carriers.length, (this.coreValue(top) >= 4 || threatened) && us.length >= 3 ? 2 : 1);
        for (const c of carriers) {
          if (need <= 0) break;
          const pool = us.filter(a => !used.has(a) && a.hp > a.maxHp * 0.25 && !(a.goal && a.goal.type === 'pod'));
          if (!pool.length) break;
          const sc = a => -dist(a, c) / 18 + 0.9 * half(a.sn.t) + (a.role.front ? 0.3 : 0) + (a.cr === 'escort' && a.crT === c ? 0.8 : 0);
          const e = pool.reduce((p, q) => (sc(p) >= sc(q) ? p : q));
          e.cr = 'escort'; e.crT = c; used.add(e); need--;
        }
      }
      if (M.goal === 'HuntCarrier' && foeCar.length) {
        const cx = us.reduce((q, a) => q + a.x, 0) / us.length, cy = us.reduce((q, a) => q + a.y, 0) / us.length;
        const tg = foeCar.reduce((p, q) => (Math.hypot(p.x - cx, p.y - cy) - carried(p) * 8 <= Math.hypot(q.x - cx, q.y - cy) - carried(q) * 8 ? p : q));
        const hs = us.filter(a => !used.has(a) && a.hp > a.maxHp * 0.5 && this.coreSlots(a) < 2 && this.persBias(a).fight > -0.3).sort((p, q) => dist(p, tg) - dist(q, tg)).slice(0, 2);
        for (const h of hs) { h.cr = 'hunter'; h.crT = tg; }
      }
    },

    /* ---------- Layer 4: 성향 = 가치 함수 편향 ---------- */
    perceive(u) {                                         // 팀 모드를 각자 읽는다: 판단력 낮으면 한 단계 잘못 읽고, 그 오독은 몇 초 유지됨
      const M = this.md[u.team], m = u.mind || (u.mind = { bias: 0, at: 0 });
      if (!M) return 'Contest';
      if (this.t < (m.pmUntil || 0) && m.pmFor === M.mode) return m.pm;
      const ord = ['Protect', 'Extend', 'Contest', 'Comeback', 'Desperation'], i = ord.indexOf(M.mode);
      let mode = M.mode;
      if (i >= 0 && Math.random() < 0.18 * (1 - half(u.sn.j)) * (1 - 0.5 * gOf(u))) mode = ord[clamp(i + (Math.random() < 0.5 ? -1 : 1), 0, 4)];
      m.pm = mode; m.pmFor = M.mode; m.pmUntil = this.t + ticks(5 + 4 * Math.random());
      return mode;
    },
    confOf(u) {                                           // 최근 킬/데스에 따른 자신감 (-1~1): 이긴 직후엔 과감, 죽은 직후엔 위축
      const m = u.mind || (u.mind = { bias: 0, at: 0 });
      if (m.k0 == null) { m.k0 = u.kills || 0; m.d0 = u.deaths || 0; m.conf = 0; m.cT = this.t; }
      m.conf = clamp(m.conf * Math.pow(0.5, (this.t - m.cT) / ticks(25)) + 0.3 * ((u.kills || 0) - m.k0) - 0.4 * ((u.deaths || 0) - m.d0), -1, 1);
      m.k0 = u.kills || 0; m.d0 = u.deaths || 0; m.cT = this.t;
      return m.conf;
    },
    persBias(u) {
      if (u.pbT === this.t) return u.pb;
      const N = u.sn, M = this.md[u.team], g = gOf(u), mk = MD[M ? this.perceive(u) : 'Contest'];
      const X = A().pers, q = this.evQ(u), Sit = this.sit[u.team];
      let b = X.style * N.f + mk.clutch * lerp(X.pLo, X.pHi, half(N.c));       // 교전능력은 '마무리 자신감'일 뿐 공격성이 아님 · 압박에 약할수록 분위기에 휘둘림
      b += X.hot * this.confOf(u) * (1 - X.hotQ * q);                          // 연속 킬로 들뜨는 정도는 판단이 좋을수록 줄어듦
      const ev = Sit ? clamp(X.edgeK * Sit.edge, -0.6, 0.6) : 0, cal = X.cal * q;
      b = b * (1 - cal) + ev * cal;                                            // 품질이 높을수록 '실제 우세/열세'를 따라 과감·신중해짐
      u.pbT = this.t; return (u.pb = { fight: clamp(b, -0.6, 0.9), obj: 1 + 0.3 * N.o, ally: 1 + 0.5 * N.t });
    },

    groupUp(u, c) {                                        // 홀로 떨어져 적을 마주쳤고 이길 것 같지 않으면 아군 쪽으로 붙는다 (판단력 낮으면 놓침)
      if (u.cr && u.cr !== 'free') return false;
      const qG = half(u.sn.j) * 0.5 + gOf(u) * 0.5;                     // 판단 품질: 높을수록 위험을 일찍 알아채고 합류, 낮을수록 한참 위험해진 뒤에야 움직임
      if (this.coreSlots(u) >= 1 || !c.near.length || c.mateIn.length || this.t - u.hitT < 30 || c.ratio <= 0.9 + GR().groupSlack * (1 - qG)) return false;
      if (c.nf && dist(u, c.nf) <= u.role.range + 2 && c.hpR > 0.5 && c.ratio <= 1.3) return false;
      const mates = c.mates.filter(a => a.alive); if (!mates.length) return false;
      const cx = mates.reduce((q, a) => q + a.x, 0) / mates.length, cy = mates.reduce((q, a) => q + a.y, 0) / mates.length;
      if (Math.hypot(cx - u.x, cy - u.y) <= 22) return false;
      u.actT = this.t; this.stepNav(u, cx, cy, this.eff(u, 'spd')); return true;
    },

    layerGoal(u, team, us) {
      const P = this.tp[team], M = this.md[team], own = this.coreSlots(u), pb = this.persBias(u), G = M.goal;
      const keep = (type, key, v) => (u.goal && u.goal.type === type && u.goal[key] === v ? u.goal.since : this.t);
      if (u.cr === 'carrier') return null;
      if (u.cr === 'escort' && u.crT && u.crT.alive && this.coreValue(u.crT) >= CARRY_MIN) return { type: 'escort', a: u.crT, since: keep('escort', 'a', u.crT) };
      if (u.cr === 'hunter' && u.crT && u.crT.alive && !this.hidden(u.crT) && carried(u.crT) > 0 && own < 2 && u.hp > u.maxHp * 0.35 && this.huntEV(u, u.crT).p >= GR().hunt.engageP * 0.8 - 0.25 * pb.fight)
        return { type: 'hunt', e: u.crT, since: keep('hunt', 'e', u.crT) };
      if (G !== 'SecureDeposit' && G !== 'Stall' && P.chase && P.chase.ids.includes(u.id) && P.chase.e.alive) return { type: 'hunt', e: P.chase.e, since: keep('hunt', 'e', P.chase.e) };
      const tw = ramp(u.sn.t, GR().teamLo, GR().teamHi);
      if (tw > 0 && own <= 1) {                                     // team 성향: 위험한 아군 캐리어를 본능적으로 도움
        const r = (45 + 25 * u.sn.t * pb.ally / 1.5) * tw, cs = us.filter(a => a !== u && this.coreValue(a) >= CARRY_MIN && this.t - a.hitT < ticks(2.5) && dist(a, u) <= r);
        if (cs.length) return { type: 'escort', a: cs.reduce((p, q) => (this.coreValue(p) >= this.coreValue(q) ? p : q)), since: this.t };
      }
      const prot = this.perceive(u) === 'Protect' ? 0.15 : 0;
      const solo = pb.fight >= 0.35 && G !== 'SecureDeposit' && this.perceive(u) !== 'Protect';          // 성향이 강하면 팀 신호 없이도 직접 건다
      if ((P.engage || solo) && G !== 'Stall' && P.focus && P.focus.e.alive && own < 2 && u.hp > u.maxHp * 0.35 && this.follows(u) && this.huntEV(u, P.focus.e).p >= GR().hunt.engageP - 0.3 * pb.fight + prot)
        return { type: 'hunt', e: P.focus.e, since: keep('hunt', 'e', P.focus.e) };
      return null;
    },

    assignEvery(team) { const X = A().assign, r = half(this.sit[team].r); return Math.max(8, Math.round(X.every - X.everyR * r)); },
    focusPull(u) { const X = A().focus; return X.pull0 + X.pullT * (u.sn.t + 1) * 2; },
    roleGap(u) { const X = A().role; return X.gap0 + X.gapP * half(u.sn.p); },

    readSit(team) {
      const X = A().team, P = this.sit[team], us = this.teamUnits(team);
      if (!us.length) { P.win = 'avoid'; P.edge = -1; return; }
      const avg = k => us.reduce((s, a) => s + (a.sn ? a.sn[k] : 0), 0) / us.length;
      P.j = avg('j'); P.c = avg('c'); P.t = avg('t'); P.o = avg('o'); P.p = avg('p'); P.r = avg('r'); P.a = avg('a'); P.f = avg('f'); P.u = avg('u');
      if (!P.gk) { const ln = this.units.filter(e => e.team === team && !e.struct); if (ln.length) { P.g = ln.reduce((s, e) => s + gOf(e), 0) / ln.length; P.gk = 1; } }
      if (this.t < P.at) return;
      P.at = this.t + ticks(X.refresh * (1 - X.refreshR * half(P.r)));
      const all = this.units.filter(e => !e.struct && e.team < 2 && !this.gone(e)), me = all.filter(e => e.team === team), op = all.filter(e => e.team !== team);
      const pw = l => l.reduce((s, a) => s + (a.alive ? this.power(a) : 0), 0);
      const gap = l => l.filter(a => !a.alive && a.respawnAt - this.t > ticks(X.winSec)).length;
      const mine = pw(me), theirs = pw(op);
      if (this.t >= P.biasAt) { P.biasAt = this.t + ticks(2); P.bias = (Math.random() * 2 - 1) * X.noise * (1 - half(P.j)) * (1 - GR().noiseT * P.g); }
      P.edge = clamp((mine - theirs) / (mine + theirs || 1) + X.respawn * (gap(op) - gap(me)) + P.bias, -1, 1);
      const lead = this.score[team] - this.score[1 - team], { total, left } = this.clock();
      P.lead = lead; P.left = left;
      P.need = this.sudden ? 0 : clamp(-lead / ((X.needBase + X.needLeft * left / total) * (1 - X.needC * P.c)), -1, 1);
    },

    tempo(team) {
      const X = A().time, S = this.sit[team], { total, left } = this.clock(), el = total - left, fr = el / total;
      const lead = this.score[team] - this.score[1 - team];
      const Gr = GR(), lb = (X.lead0 - X.leadLate * fr) * (1 - X.leadJ * S.j) * (1 - Gr.bank * S.g), tb = Math.max(1, X.trail0 - X.trailLate * fr - X.trailC * Math.max(0, S.c)) * (1 - 0.15 * S.j) * (1 - Gr.gamble * S.g);
      const bank = !this.sudden && (this.hy(team, 'bank', lead >= lb, lead >= lb - 1.5) || (left > 0 && left <= X.bankSec && lead >= 1));
      const gamble = !this.sudden && this.hy(team, 'gam', lead <= -tb, lead <= -(tb - 1.5));
      const catchUp = !this.sudden && left < X.catchSec && lead <= -1;
      const sdGuard = this.sudden || (left > 0 && left <= X.sdPre && Math.round(lead) === 0);
      let push = el < X.early ? X.pushEarly : el >= X.late ? X.pushLate : 0;
      push += X.pushNeed * S.need * half(S.c);
      if (catchUp) push += X.pushCatch;
      if (bank) push = Math.min(push, X.pushLead);
      if (gamble) push = Math.max(push, X.pushGamble);
      if (sdGuard) push += X.sdPush;
      return { lead, left, el, fr, bank, gamble, catchUp, sdGuard, push };
    },

    teamPlan(team) {
      const P = this.tp[team], us = this.teamUnits(team);
      this.readSit(team);
      if (!us.length) { P.focus = null; P.chase = null; P.escort = null; P.engage = false; P.gate.st = 'idle'; P.pod = null; return; }
      if (this.t < P.planAt && P.tempo) return;
      const Sit = this.sit[team], X = A().team;
      P.planAt = this.t + ticks(X.plan * (1 - X.planR * half(Sit.r)));
      const foes = this.units.filter(e => e.team === 1 - team && e.alive && !e.struct && !this.hidden(e) && !this.gone(e));
      const T = P.tempo = this.tempo(team);
      this.modeStep(team, T);
      const th = (1 - X.openJ * Sit.j) * (1 - GR().open * Sit.g), edge = Sit.edge + X.pushEdge * T.push;
      Sit.win = edge >= X.open * th ? 'open' : edge <= -X.avoid * th ? 'avoid' : 'even';
      P.asn = foes.some(e => e.f.role === 'assassin' && us.some(a => dist(a, e) <= A().fstate.exposeR) && this.foeState(e, Sit.g).ult);
      this.planPod(team, us);
      this.planChase(team, us, foes);
      this.planFocus(team, us, foes);
      this.planGate(team, us, foes);
      this.planMind(team, us, foes);
    },

    planPod(team, us) {
      const X = A().pod, P = this.tp[team], S = this.sit[team];
      const runner = us.find(a => a.goal && a.goal.type === 'pod' && a.hp < a.maxHp * X.hpMax);
      if (runner) { P.pod = { id: runner.id, until: this.t + ticks(X.base + X.t * half(S.t)) }; return; }
      if (P.pod && P.pod.until > this.t) return;
      if (P.pod) { P.pod = null; P.rearm = this.t + ticks(X.rearm); }
    },

    planChase(team, us, foes) {
      const X0 = A().chase, S = this.sit[team], P = this.tp[team], thr = this.rk ? clamp(this.rk[team].thr, 0, 1.6) : 0;
      const X = Object.assign({}, X0, { minVal: Math.max(1, X0.minVal - (thr > 0.7 ? 1 : 0)), isoR: X0.isoR * (1 - 0.5 * Math.min(thr, 1)), reach: X0.reach * (1 + 0.5 * thr), maxOwn: X0.maxOwn + (thr > 1 ? 1 : 0), minHp: X0.minHp - 0.1 * Math.min(thr, 1) });      // 역전 위협이 크면 단독 1코어 캐리어도, 지원이 있어도 쫓는다
      let c = P.chase; const Gr = GR(), g = S.g, hw = ramp(g, Gr.hiLo, Gr.mustHi);
      if (c && (!c.e.alive || this.hidden(c.e) || this.gone(c.e) || carried(c.e) < X.minVal * 0.5 || this.t > c.until)) c = P.chase = null;
      if (this.sudden) { P.chase = null; return; }
      const cands = foes.filter(e => carried(e) >= X.minVal && !foes.some(o => o !== e && dist(o, e) <= X.isoR * (1 - Gr.chaseIso * g)));
      if (c && !cands.includes(c.e)) c = P.chase = null;
      if (!cands.length) return;
      const reach = X.reach + X.reachT * half(S.t) + Gr.chaseReach * g;
      const hunters = us.filter(a => this.coreValue(a) <= X.maxOwn + hw * Gr.chaseOwn && a.hp > a.maxHp * (X.minHp - Gr.chaseHp * g) && !(a.goal && a.goal.type === 'pod') && this.follows(a));
      if (!hunters.length) { P.chase = null; return; }
      let best = null, bs = -1e9;
      for (const e of cands) {
        const near = hunters.reduce((m, a) => Math.min(m, dist(a, e)), 1e9);
        if (near > reach) continue;
        const sc = carried(e) * 2 - near / 25 + (c && c.e === e ? 1 : 0);
        if (sc > bs) { bs = sc; best = e; }
      }
      if (!best) { P.chase = null; return; }
      const sup = foes.filter(o => o !== best && dist(o, best) <= X.supportR).reduce((q, o) => q + this.power(o), 0);
      const able = hunters.filter(a => dist(a, best) <= reach && (this.eff(a, 'spd') >= this.eff(best, 'spd') * X.spdMin || dist(a, best) <= a.role.range + X.near)).sort((p, q) => dist(p, best) - dist(q, best));
      if (!able.length) { P.chase = null; return; }
      const n = Math.min(X.max, able.length, 1 + (carried(best) >= X.dupVal - hw ? 1 : 0));
      const group = able.slice(0, n);
      if (sup > group.reduce((q, a) => q + this.power(a), 0) * (X.supportMul + Gr.chaseSup * g)) { P.chase = null; return; }
      P.chase = { e: best, ids: group.map(a => a.id), until: c && c.e === best ? c.until : this.t + ticks(X.hold + Gr.chaseHold * g) };
    },

    planFocus(team, us, foes) {
      const X = A().focus, S = this.sit[team], P = this.tp[team], f = P.focus;
      const cand = foes.filter(e => us.some(a => dist(a, e) <= X.within));
      if (!cand.length) { P.focus = null; return; }
      let keep = !!(f && f.e.alive && !this.hidden(f.e) && !this.gone(f.e) && us.some(a => dist(a, f.e) <= X.keep));
      if (keep && f.e.fb && !us.some(a => dist(a, f.e) <= 14)) keep = false;
      if (keep && this.t - f.since < ticks(X.stick)) return;
      const cx = us.reduce((a, b) => a + b.x, 0) / us.length, cy = us.reduce((a, b) => a + b.y, 0) / us.length, maxAtk = Math.max(...cand.map(e => e.atk + e.ap)) || 1;
      const weakAny = cand.some(e => e.hp < e.maxHp * X.weakHp), jit = clamp(half(S.j) + GR().jit * (S.g - 0.5), 0, 1), asn = us.some(a => a.f.role === 'assassin'), FS = A().fstate;
      const ban = us.some(a => [...this.skillsOf(a).list, a.f.ult].some(k => this.skillTags(k).includes('antiheal')));
      let best = null, bs = -1e9;
      for (const e of cand) {
        const d = Math.hypot(e.x - cx, e.y - cy), hpR = e.hp / e.maxHp;
        let sc = -d / 40 + (1 - hpR) * 3 * (weakAny ? 1 : 0.6) + (hpR < X.weakHp ? 1 : 0);
        sc += ((e.atk + e.ap) / maxAtk) * X.threat * (e.role.threat || 1) * (0.5 + 0.5 * jit);
        const sup = (e.f.skills || []).some(k => k.sfx === 'shield' || k.sfx === 'buff' || k.sfx === 'heal');
        sc += (e.role.backline ? X.back * (asn ? 1.3 : 1) * (0.4 + 0.6 * jit) + (sup ? 1 : 0) : 0) + carried(e) * X.carry;
        if (ban && this.foeState(e, S.g).heal) sc += FS.healBan * (0.4 + 0.6 * jit);
        if (f && f.e === e) sc += 0.5;
        if (sc > bs) { bs = sc; best = e; }
      }
      P.focus = f && f.e === best ? f : { e: best, since: this.t };
    },

    planGate(team, us, foes) {
      const X = A().gate, G = this.tp[team].gate, P = this.tp[team], S = this.sit[team], rearm = P.rearm > this.t;
      P.engage = false;
      const close = foes.filter(e => us.some(a => dist(a, e) <= X.trig));
      if (!close.length) { G.st = 'idle'; return; }
      const gu = us.filter(a => !(a.goal && a.goal.type === 'deposit') && this.coreSlots(a) < 2);
      const need = clamp(Math.round(2 + (close.length >= 3 ? 1 : 0) * half(S.j)), 2, 3), n = Math.min(need, gu.length);
      const rad = (X.rad - X.radT * half(S.t)) * (S.win === 'open' ? 1.35 : 1);
      const gathered = n <= 1 || gu.some(a => gu.filter(b => dist(a, b) <= rad).length >= n);
      let limit = X.base * (1 + X.patient * half(S.j) - X.rash * half(S.c) * (1 + Math.max(0, S.need)));
      limit *= S.win === 'open' ? X.openMul : S.win === 'avoid' ? X.avoidMul : 1;
      limit *= ({ Protect: 1.3, Extend: 1.1, Comeback: 0.8, Desperation: 0.6 })[this.md[team].mode] || 1;
      limit = Math.max(X.min, limit * (1 - GR().gateWait * S.g));
      const engaged = us.some(a => this.t - a.hitT < 30 || foes.some(e => dist(a, e) <= 16));
      const chained = P.chain.until > this.t;
      if (G.st === 'go') {
        if (engaged) G.until = Math.max(G.until, this.t + ticks(3));
        if (this.t >= G.until) { G.st = 'wait'; G.since = this.t; }
      } else {
        if (G.st === 'idle') { G.st = 'wait'; G.since = this.t; }
        const hold = !engaged && !chained && this.t - G.since < ticks(Math.min(limit, X.initSec * (0.5 + 0.5 * S.g))) && this.initWait(us);
        if (!hold && (gathered || engaged || chained || this.t - G.since > ticks(limit) || (S.win === 'open' && !rearm && gu.length < 2))) G.st = 'go', G.until = this.t + ticks(gathered || chained ? X.go : X.goHit);
      }
      P.engage = G.st === 'go' && (S.win === 'open' || chained) && !rearm;
    },

    follows(u) { if (!(this.t < (u.callT || 0))) { u.callT = this.t + ticks(GR().callSec); u.callOk = Math.random() < (u.obey != null ? u.obey : 1); } return u.callOk; },
    gateHold(u) {
      const G = this.tp[u.team].gate; if (G.st !== 'wait' || !this.follows(u)) return false;
      if (this.t - u.hitT < 30) return false;
      if (this.persBias(u).fight >= 0.3) return false;                      // 공격 성향이 강한 선수는 합류를 기다리지 않고 먼저 건다
      if (u.goal && u.goal.type === 'deposit') return false;
      if (this.coreSlots(u) >= 2) return false;
      const us = this.teamUnits(u.team); if (us.length < 2) return false;
      const oth = us.filter(a => a !== u), cx = oth.reduce((s, a) => s + a.x, 0) / oth.length, cy = oth.reduce((s, a) => s + a.y, 0) / oth.length, d = Math.hypot(cx - u.x, cy - u.y);
      u.actT = this.t;
      if (d > 6) this.stepNav(u, cx, cy, Math.min(this.eff(u, 'spd'), d - 4));
      return true;
    },
    podPull(u, enemies, allies) {
      const P = this.tp[u.team].pod; if (!P || P.until <= this.t || P.id === u.id || (u.goal && u.goal.type === 'pod') || !this.follows(u)) return false;
      if (this.t - u.hitT < 30) return false;
      const threats = enemies.filter(e => e.team < 2 && !e.struct && !this.hidden(e) && dist(u, e) <= 40);
      if (!threats.length || threats.some(e => dist(u, e) <= 14)) return false;
      const p = this.safePoint(u, allies, threats); if (!p) return false;
      u.actT = this.t; if (dist(u, p) > 1.5) this.stepNav(u, p.x, p.y, this.eff(u, 'spd'));
      return true;
    },
    onUlt(u) {
      const X = A().chain, S = this.sit[u.team];
      this.tp[u.team].chain = { until: this.t + ticks(X.base + X.t * half(S.t) + X.u * half(u.sn.u)), by: u.id };
    },
    roamTarget(u, enemies, aggro) {
      const X = A().role, P = this.tp[u.team];
      if (P.gate.st === 'wait') return null;
      let k = X.roam + X.roamP * half(u.sn.p);
      if (P.chain.until > this.t) k = Math.max(k, this.cur[u.team] && this.cur[u.team].lead >= 2 ? X.roam : X.chainRoam);
      const lim = aggro * k + 6; let best = null, bd = 1e9;
      for (const e of enemies) { if (e.team > 1 || e.struct || this.hidden(e)) continue; const d = dist(u, e); if (d <= lim && d < bd) { bd = d; best = e; } }
      return best;
    },
    flankPoint(u, t, want) {
      if (!(u.tac.entry === 'flank' || u.f.role === 'assassin') || t.struct || t.team > 1) return null;
      const d = dist(u, t); if (d < want + 14) { u.flank = null; return null; }
      const X = A().role; let fk = u.flank;
      if (!fk || fk.e !== t || this.t > fk.until) {
        const ax = this.axis[u.team], px = -ax.fy, py = ax.fx, off = X.flank0 + X.flankP * half(u.sn.p); let best = null, bs = 1e9;
        for (const sg of [1, -1]) {
          const p = this.pushOut(t.x + px * sg * off + ax.fx * 5, t.y + py * sg * off + ax.fy * 5);
          if (this.inObs(p.x, p.y, 2)) continue;
          const sc = dist(u, p) + Math.hypot(p.x - t.x, p.y - t.y) + (this.clearLine(u.x, u.y, p.x, p.y) ? 0 : 20);
          if (sc < bs) { bs = sc; best = { x: p.x, y: p.y }; }
        }
        fk = u.flank = best ? { e: t, x: best.x, y: best.y, until: this.t + ticks(2.5) } : null;
      }
      if (!fk || dist(u, fk) < 5) return null;
      return fk;
    },

    retreatSgn(S) { if (S.engage) return clamp((((CONFIG.tactics.axes.engage[S.engage] || {}).risk || 1) - 1) / 0.2, -1, 1); return S.retreat === 'careful' ? 1 : S.retreat === 'brave' ? -1 : 0; },
    riskK(S) { const Dg = CONFIG.battle.map.core.danger; if (S.engage) return (CONFIG.tactics.axes.engage[S.engage] || {}).risk || 1; return S.retreat === 'brave' ? Dg.brave : S.retreat === 'careful' ? Dg.careful : 1; },

    stratNow(team) {
      const S = this.strat[team], P = this.tp[team], TP = CONFIG.tactics, bossUp = this.units.some(b => b.team === 2 && b.alive);
      if (!P.tempo) this.teamPlan(team);
      const T = P.tempo, lead = this.score[team] - this.score[1 - team];
      let st = S.stance, lv = S.stanceL, dep = S.deposit, amb = false, ruled = false;
      const dn = this.ordNow(team);
      if (this.sudden) { st = 'slay'; lv = 6; ruled = true; }
      else if (dn === 'kill') { st = 'slay'; lv = 7; ruled = true; }
      else if (dn === 'boss') { st = 'boss'; lv = 7; ruled = true; }
      else if (dn === 'bossWait') { st = 'boss'; lv = 5; ruled = true; }
      else if (dn === 'wave') { st = 'collect'; lv = 7; ruled = true; }
      else if (dn === 'convoy') { st = 'balanced'; lv = 5; dep = 'early'; ruled = true; }
      else if (dn === 'ambush') { st = 'balanced'; lv = 4; ruled = true; }
      else if (dn === 'retreat') { st = 'defend'; lv = 7; dep = 'early'; ruled = true; }
      else if (dn === 'regroup') ruled = true;
      const adj = [], kf = ruled ? 1 : lerp(GR().fol[0], GR().fol[1], this.sit[team].g);
      if (!ruled) {
        if (T.bank) { adj.push('bank'); dep = 'early'; }
        else if (T.gamble) { const car = this.foesOf(team).some(e => carried(e) >= A().chase.minVal); adj.push('gamble', bossUp ? 'gambleBoss' : car ? 'gambleCarry' : 'gambleCore'); dep = 'early'; amb = !bossUp && car; }
        else if (T.sdGuard) adj.push('sdGuard');
        else if (T.catchUp) { adj.push('catchUp'); dep = 'early'; }
        else if (T.push < -0.15) adj.push('idle');
        const me = this.units.filter(e => e.team === team && e.alive && !e.struct), fo = this.units.filter(e => e.team === 1 - team && e.alive && !e.struct);
        if (fo.length - me.length >= TP.p.outnumGap) adj.push('outnum');
        if (me.filter(e => e.hp < e.maxHp * TP.p.lowHpThr).length >= TP.p.lowHpN) adj.push('lowHp');
      }
      const k = (0.35 + 0.65 * lv / TP.maxLevel) * kf, base = TP.stances[st] || TP.stances.balanced, W = {};
      for (const key in base) W[key] = key === 'aggro' ? base[key] * k : 1 + (base[key] - 1) * k;
      const fx = (o, f) => { for (const key in o) if (key in W) { if (key === 'aggro') W[key] += o[key] * f; else W[key] *= 1 + (o[key] - 1) * f; } };
      if (!ruled) { const AX = TP.axes; [AX.engage[S.engage], AX.zone[S.zone], AX.boss[S.boss]].forEach(o => o && fx(o, kf)); }
      adj.forEach(id => fx(TP.adj[id], 1));
      for (const key in TP.adj.limit) if (key in W) W[key] = clamp(W[key], TP.adj.limit[key][0], TP.adj.limit[key][1]);
      W.aggro += T.push * A().time.aggroPush;
      const MM = this.md[team]; if (MM && 'boss' in W) { if (MM.goal === 'BossPlay') W.boss *= 1.35; else if (MM.mode === 'Protect') W.boss *= 0.7; }
      if ('core' in W && lead > 0 && !this.sudden) W.core *= 1 + 0.18 * clamp(lead / 4, 0, 1);                // 앞서 있어도 코어 수집은 멈추지 않는다
      return { st, lv, W, lead, bossUp, dep, ambush: amb, dn };
    },

    aggro(u) {
      const T = u.tac, TP = CONFIG.tactics.p, X = A(), cur = this.cur[u.team]; let a = this.cfg.aggro + (cur ? cur.W.aggro : 0);
      if (T.mission === 'hunt') a += TP.mHuntAggro * T.missionL;
      if (u.goal && u.goal.type === 'hunt') a += 8;
      if (u.role.front && !u.role.backline) a += X.role.front * (0.6 + 0.4 * half(u.sn.t));
      const Sit = this.sit[u.team]; if (Sit) a += X.aggroEdge * Sit.edge;
      if (this.md) a += MD[this.perceive(u)].aggro + 7 * this.persBias(u).fight;
      const v = this.coreValue(u); if (v >= 2) a = Math.min(a, Math.max(u.role.range * 1.15, X.carry.aggroCap + 4 * (3 - Math.min(3, v))));
      if (u.cr === 'escort' && u.crT && u.crT.alive) a = Math.min(a, u.role.range * 1.15 + 8 + 8 * clamp(this.persBias(u).fight, 0, 1));
      return Math.max(a, u.role.range * 1.15);
    },

    ultPolicy(u, foesNear, allies) {
      const T = u.tac, S = this.strat[u.team], TP = CONFIG.tactics.p; let mode = T.ult, L = T.ultL, ok = true, strict = true, now = false;
      if (!mode && this.styleOf(u).ult) mode = this.styleOf(u).ult;
      if (!mode && S.ultT !== 'normal') { mode = S.ultT; L = S.ultTL; }
      if (mode === 'burst') { if (L >= 3) strict = false; }
      else if (mode === 'open') { ok = foesNear.some(e => e.team < 2); strict = false; now = true; }
      else if (mode === 'finish') ok = foesNear.some(e => e.team < 2 && e.hp < e.maxHp * A().intent.ultFinHp);
      else if (mode === 'clutch') ok = allies.some(a => a.hp < a.maxHp * (TP.clutchHp0 + TP.clutchHpStep * L));
      else if (mode === 'save') {
        const boss = this.units.some(b => b.team === 2 && b.alive && dist(u, b) <= 26);
        ok = boss || foesNear.filter(e => e.team < 2).length >= 2 || allies.some(a => a.hp < a.maxHp * 0.4);
      }
      let chain = false;
      const ch = this.tp[u.team].chain;
      if (ch.until > this.t && ch.by !== u.id && mode !== 'clutch' && foesNear.some(e => e.team < 2)) {
        chain = true;
        if (mode === 'save') ok = true; else if (mode !== 'burst') strict = false;
      }
      if (this.t < (u.standT || 0)) { ok = true; strict = false; now = true; }               // 도망칠 수 없어 맞서는 중: 궁극기를 아끼지 않는다
      const win = this.sit[u.team].win;
      if ((mode == null || mode === 'normal') && (win === 'open' || (u.sn.u > 0.4 && foesNear.filter(e => e.team < 2).length >= 2))) strict = false;
      return { ok, strict, chain, now };
    },

    /* ---------- 시야 밖 적 기억 ---------- */
    ghostsOf(u, near, vis) {                              // 위협도 = 마지막 위치와 (그 적이 움직였을 수 있는 거리)로 계산. 판단력·등급은 기억 유지 시간만 좌우
      const G = A().ghost, N = u.sn, mem = (this.seen || (this.seen = [{}, {}]))[u.team], seen = new Set(near.map(e => e.id)), list = [];
      for (const e of near) mem[e.id] = { x: e.x, y: e.y, t: this.t };
      const q = 0.6 * half(N.j) + 0.4 * gOf(u), span = ticks(G.sec * (G.q0 + (1 - G.q0) * q)); let p = 0;
      for (const id in mem) {
        if (seen.has(id)) continue;
        const m = mem[id], age = this.t - m.t, e = this.units.find(x => x.id === id);
        if (!e || !e.alive || e.team === u.team || age > ticks(G.sec)) { delete mem[id]; continue; }      // 공용 기억이라 지우는 기준은 능력치와 무관
        const d = Math.hypot(u.x - m.x, u.y - m.y), closing = this.eff(e, 'spd') * age * G.drift;
        let w = clamp(1 - Math.max(0, d - closing - vis) / G.reach, 0, 1) * clamp(1 - age / span, 0, 1);
        if (d < vis && !this.hidden(e)) w *= G.stale + (1 - G.stale) * (d / vis);        // 마지막 위치가 시야 안인데 안 보이면 떠났을 가능성이 큼
        if (w < 0.03) continue;
        const pw = this.power(e); list.push({ e, x: m.x, y: m.y, w, pw }); p += pw * w * G.mul;
      }
      return { list, p };
    },
    sense(u, enemies, allies) {
      const X = A().sense, K = CONFIG.battle.map.core, N = u.sn, m = u.mind || (u.mind = { bias: 0, at: 0 }), Gr = GR(), g = gOf(u);
      if (this.t >= m.at) { m.at = this.t + ticks(X.refresh * (1 - X.refreshR * half(N.r))); m.bias = (Math.random() * 2 - 1) * X.noise * (1 - half(N.j)) * lerp(Gr.noise[0], Gr.noise[1], g); }
      const vis = Math.max(22, X.vis + X.visJ * Math.max(0, N.j) + Gr.vis * (g - 0.67)), mr = Math.max(16, X.mate + X.mateT * N.t + Gr.mate * (g - 0.67));
      const foes = enemies.filter(e => e.team < 2 && !e.struct && !this.hidden(e));
      const near = foes.filter(e => dist(u, e) <= vis), gh = this.ghostsOf(u, near, vis);
      const mates = allies.filter(a => a !== u && !this.gone(a));
      let mp = this.power(u); const mateIn = [];
      for (const a of mates) {
        const d = dist(u, a);
        if (d <= mr) { mp += this.power(a); mateIn.push(a); }
        else if (d <= mr * 1.6) mp += this.power(a) * clamp(1 - (d - mr) / (mr * 0.6), 0.2, 1) * 0.6;
      }
      let fp = 0; for (const e of near) fp += this.power(e);
      const ratio = fp ? (fp + gh.p) / mp * (1 + m.bias) : 0;                // 보이는 적이 있을 때만 '근처에 있을 법한 나머지'를 더해 견적
      const reachers = enemies.filter(e => !e.struct && dist(u, e) <= (e.role.range || 6) + 4);
      const dps = Math.max(this.recentDps(u, X.dpsSec), reachers.length * X.assume * u.maxHp);
      const n = u.carry.length, val = this.coreValue(u);
      let z = null, dd = 1e9, key = 1e9, foesZ = 0;
      if (n) for (const q of this.map.zones) {
        if (!q.deposit || (u.bail && u.bail.zid === q.id && this.t < u.bail.retryAt)) continue;
        const d = Math.hypot(u.x - q.x, u.y - q.y), th = foes.filter(e => Math.hypot(e.x - q.x, e.y - q.y) <= (q.r || K.deposit.r) + X.zoneR).length + gh.list.reduce((s, g) => s + (Math.hypot(g.x - q.x, g.y - q.y) <= (q.r || K.deposit.r) + X.zoneR ? g.w : 0), 0), k = d + th * X.zoneCost;
        if (k < key) { key = k; z = q; dd = d; foesZ = th; }
      }
      const spd = Math.max(0.05, this.eff(u, 'spd')) * TPS;
      let route = 0;
      if (z) {
        for (const e of foes) { const ds = segDist(e.x, e.y, u.x, u.y, z.x, z.y); if (ds <= X.routeR) route += this.power(e) / mp * (1 - ds / (X.routeR + 6)); }
        for (const g of gh.list) { const ds = segDist(g.x, g.y, u.x, u.y, z.x, z.y); if (ds <= X.routeR) route += g.pw / mp * g.w * (1 - ds / (X.routeR + 6)); }
      }
      return { foes, near, mates, mateIn, mp, fp, ratio, reachers, dps, ttd: dps > 0 ? u.hp / dps : 99, hpR: u.hp / u.maxHp, n, val, z, dd, tDep: z ? dd / spd : 99, foesZ, route, gh: gh.list, ghP: gh.p, nf: near.length ? nearestOf(u, near) : null, hurt: this.t - u.hitT < ticks(1.5) };
    },

    styleOf(u) { return (u.role && u.role.style) || NOSTYLE; },
    foeState(e, g) {
      const X = A().fstate; const c = e.fs;
      if (c && this.t < c.until) return c;
      const sk = (e.f && (e.f.forms ? e.f.forms[e.form] : e.f.skills)) || [], rd = k => !(e.cds && e.cds[k.id] > 0) && e.mp >= (k.cost || 0), er = X.err * (1 - g), fl = v => (Math.random() < er ? !v : v);
      let esc = false, cc = false, heal = false, anti = false;
      for (const k of sk) {
        const tg = this.skillTags(k);
        if (rd(k)) { if (k.move) esc = true; if (tg.includes('control')) cc = true; }
        if (tg.includes('heal')) heal = true;
        if (tg.includes('antiheal')) anti = true;
      }
      return (e.fs = { until: this.t + ticks(lerp(X.refresh[0], X.refresh[1], g)), esc: fl(esc), cc: fl(cc), ult: fl(e.ultCd <= 0), heal, anti });
    },
    engageSkills(a) { return this.skillsOf(a).list.filter(k => { const t = this.skillTags(k); return t.includes('gapclose') || t.includes('control'); }); },
    initWait(us) {
      const ks = us.filter(a => a.alive && this.styleOf(a).engage).map(a => [a, this.engageSkills(a)]).filter(q => q[1].length);
      return ks.length > 0 && ks.every(q => !q[1].some(k => !((q[0].cds[k.id] || 0) > 0) && q[0].mp >= (k.cost || 0)));
    },
    intentRaw(u, c, s) {
      const X = A().intent, Sy = this.styleOf(u), B = X.style[u.role.backline ? 'back' : 'front'], St = { surv: B.surv, peel: B.peel * (Sy.peel ? X.peelBoost : 1), eng: Sy.engage ? 1 : B.eng }, m = u.mind;
      const thr = St.surv * (1 + m.bias * X.hpFuzz);
      if (c.hpR <= thr && c.reachers.length > 0) return 'survive';
      if (!c.n) {
        let best = null, bs = 0;
        for (const a of c.mates) {
          if (!a.alive || dist(u, a) > X.peelR * St.peel) continue;
          const hit = this.t - a.hitT < ticks(X.hitSec) && a.hitBy && a.hitBy.alive, cv = carried(a);
          if (!hit && !cv) continue;
          if (!c.foes.some(e => dist(e, a) <= Math.max(X.threatR, (e.role.range || 6) + 4))) continue;
          const stk = Sy.stick === 'backline' ? a.role.backline : Sy.stick === 'carry' ? cv > 0 : Sy.stick === 'front' ? a.role.front : false;
          const sc = cv * X.carryW + (1 - a.hp / a.maxHp) + (hit ? 0.3 : 0) + (stk ? X.stickW : 0);
          if (sc > bs) { bs = sc; best = a; }
        }
        s.ally = best;
        if (best) return 'peel';
      } else s.ally = null;
      return St.eng && this.tp[u.team].gate.st === 'go' ? 'engage' : 'trade';
    },
    intentOf(u, c) {
      const X = A().intent, g = gOf(u), m = u.mind || (u.mind = { bias: 0, at: 0 });
      const s = m.it || (m.it = { v: 'trade', since: this.t, raw: 'trade', cs: this.t, roll: 1, ally: null, at: -1 });
      if (!u.intentN) u.intentN = { engage: 0, peel: 0, survive: 0, trade: 0 };
      if (s.at === this.t) return s.v;
      s.at = this.t;
      const raw = this.intentRaw(u, c, s), urgent = raw === 'survive' || raw === 'peel';
      if (raw !== s.raw) { s.raw = raw; s.cs = this.t; s.roll = Math.random(); }
      let want = raw;
      if (urgent && s.roll < lerp(X.miss[0], X.miss[1], g) && this.t - s.cs < ticks(X.missSec)) want = this.tp[u.team].gate.st === 'go' ? 'engage' : 'trade';
      const need = ticks(urgent ? lerp(X.lag[0], X.lag[1], g) : X.baseLag), cur = s.v === 'survive' || s.v === 'peel';
      if (want !== s.v && this.t - s.cs >= need && (!cur || this.t - s.since >= ticks(X.hold) || want === 'survive')) { s.v = want; s.since = this.t; u.intentN[want]++; }
      return s.v;
    },

    podFor(u, c) {
      const X = A().surv, reach = Math.max(X.podReach, u.brain.podRun);
      const ps = this.map.pods.filter(p => p.readyAt <= this.t + this.sec(u.brain.waitPod ? 12 : 4) && dist(u, p) <= reach && !c.foes.some(e => Math.hypot(e.x - p.x, e.y - p.y) < X.podBlock));
      return ps.length ? ps.reduce((a, b) => (dist(u, a) <= dist(u, b) ? a : b)) : null;
    },
    kiteOk(u, c) {
      const R = A().retreat;
      return !c.n && c.hpR >= R.kiteHp && c.reachers.length <= 2 && c.mateIn.some(a => a.hp >= a.maxHp * R.kiteAllyHp);
    },
    startFb(u, why, sec) { u.fb = { why, until: this.t + ticks(sec), min: this.t + ticks(0.8) }; return { kind: 'flee' }; },
    fleeStand(u, c) {                                     // 도망(생존확률)과 맞서기(승리확률 + 처치 가치)를 기대값으로 비교. 판단력이 낮을수록 두 추정에 오차가 큼
      const F = A().flee, ch = c.reachers.filter(e => e.team < 2 && !e.struct && !this.hidden(e)).concat(c.near.filter(e => !c.reachers.includes(e) && dist(u, e) <= F.chaseR));
      if (!ch.length) return false;
      const my = Math.max(0.05, this.eff(u, 'spd')); let p = 1;
      for (const e of ch) {
        let q = clamp(F.base + F.spd * (my / Math.max(0.05, this.eff(e, 'spd')) - 1), 0.05, 1);
        if ((e.role.range || 6) >= F.rangedR) q *= F.rangedMul;
        p = Math.min(p, q);
      }
      p *= Math.pow(F.multi, Math.max(0, ch.length - 1));
      if (this.skillsOf(u).list.some(k => (k.move || this.skillTags(k).includes('escape')) && !((u.cds[k.id] || 0) > 0) && u.mp >= (k.cost || 0))) p += F.escBonus;
      if (c.mateIn.some(a => a.hp > a.maxHp * 0.4 && dist(a, u) <= F.allyR)) p += F.allyBonus;
      if (this.podFor(u, c)) p += F.podBonus;
      const pEsc = clamp(p * (1 - F.noise * (u.mind ? u.mind.bias : 0)), 0, 1);
      const pWin = 1 / (1 + Math.pow(Math.max(0.01, c.ratio) / A().carry.pw, 2));
      const K = (F.kill + (c.nf ? carried(c.nf) * F.killCarry : 0)) / (1 + F.carryD * Math.min(c.val, 5));
      return pEsc < pWin * (1 + K);                       // 도망치다 죽을 확률이 이기는 쪽보다 크면 맞선다
    },
    tryFb(u, c, why, sec) {
      if (this.t < (u.standT || 0)) return null;
      if (this.fleeStand(u, c)) { u.standT = this.t + ticks(A().flee.standSec); return null; }
      return this.startFb(u, why, sec);
    },

    survive(u, c) {
      const X = A().surv, K = CONFIG.battle.map.core, N = u.sn, Sit = this.sit[u.team], T = this.tp[u.team].tempo || {}, S = this.strat[u.team], B = u.brain;
      const thr = c.reachers.length > 0 || c.hurt;
      if (u.fb) {
        if (this.t > u.fb.until || (!thr && this.t > u.fb.min) || (u.fb.why === 'hp' && c.hpR > X.hpBack)) { u.fb = null; u.fbCd = this.t + ticks(X.fbCdSec); }
        else if (c.hurt && c.reachers.length && this.t > u.fb.min + ticks(A().flee.turnSec) && this.fleeStand(u, c)) { u.fb = null; u.fbCd = this.t + ticks(X.fbCdSec); u.standT = this.t + ticks(A().flee.standSec); return null; }   // 도망 중 따라잡혀 더는 못 벗어나면 돌아서서 싸운다
        else return { kind: 'flee' };
      }
      if (!c.near.length && !thr) { u.waitSince = 0; return null; }
      const sign = this.retreatSgn(S), doct = sign * S.retreatL / 7, pbS = this.persBias(u);
      const Gr = A().grade, g = gOf(u), nk = c.nf;
      const kill = !!nk && nk.hp < nk.maxHp * Gr.killHp && dist(u, nk) <= u.role.range + 4 && c.reachers.length <= 2 && c.hpR > 0.2 && c.ratio <= Gr.killRatio;
      const coming = c.mates.some(a => a.alive && a.hp > a.maxHp * 0.4 && !c.mateIn.includes(a) && dist(a, u) <= Gr.allyR);
      const hold = clamp(g * Gr.hold * ((kill ? 1 : 0) + (coming ? Gr.allyW : 0)), 0, 0.45);
      const hpThr = clamp((B.retreatHp + doct * X.doctHp + (c.n ? X.hpCarry * Math.min(c.val, 5) : 0)) * (1 - hold) + Gr.earlyHp * (1 - g) - 0.06 * pbS.fight, 0.06, 0.75);
      if (c.hpR < hpThr && thr && !(this.t < (u.fbCd || 0) && c.hpR >= hpThr * 0.9)) {
        if (u.goal && u.goal.type === 'boss' && c.hpR > B.retreatHp * 0.7) return null;
        const pod = this.podFor(u, c);
        if (pod) return { kind: 'pod', pod };
        return this.tryFb(u, c, 'hp', X.fbSec);
      }
      const safe = (1 - hold * 0.6) * (X.ttd + X.ttdP * N.p + (c.n ? X.ttdCarry * Math.min(c.val, 5) : 0) - X.ttdClutch * Math.max(0, Sit.need) * half(N.c) + (T.sdGuard ? X.ttdSd : 0) + doct * X.doct);
      const outnum = c.reachers.filter(e => e.team < 2).length > c.mateIn.filter(a => dist(a, u) <= 20).length + 1;
      const home = dist(u, this.homeDep(u.team)) <= K.caution.holdHome;
      if (thr && c.ttd < safe) {
        const nf = c.nf, win = c.ratio <= X.win * (1 + X.winJ * N.j) && c.hpR > 0.35;
        const fin = nf && nf.hp < nf.maxHp * X.finishHp && dist(u, nf) <= u.role.range + 3 && c.reachers.length <= 1 && c.hpR > 0.25;
        const dire = c.ttd < safe * Gr.dire * ramp(g, Gr.direLo, Gr.direHi);
        if ((win && !dire) || fin || (home && !c.n)) return null;
        if (dire) { const pd = this.podFor(u, c); if (pd) return { kind: 'pod', pod: pd }; }
        if (!dire && this.kiteOk(u, c) && u.role.range >= A().retreat.kiteRange) return { kind: 'kite' };
        return this.tryFb(u, c, 'ttd', X.fbSec * (dire ? 0.8 : 0.5));
      }
      const sk = this.skillsOf(u), allCd = sk.list.every(k => (u.cds[k.id] || 0) > ticks(1.2) || u.mp < k.cost) && u.ultCd > ticks(1.2);
      if (thr && allCd && c.hpR < X.cdHp && (outnum || u.role.backline) && !(u.tac.act === 'rush' && u.tac.actS >= 0.5)) return this.tryFb(u, c, 'cd', X.cdSec);
      if (thr && outnum && c.hpR < hpThr + X.outHp * (1.3 - Gr.outHp * g) && !(this.t < (u.fbCd || 0))) return this.tryFb(u, c, 'hp', X.fbSec);
      if (c.ratio > 0 && this.t >= (u.cautionOff || 0)) {
        let lim = B.ratio * (u.caution > this.t ? 0.85 : 1) * (1 + Gr.ratio * (g - 0.67)) * (1 + 0.3 * pbS.fight) * clamp(1 + X.softNeed * Sit.need + X.softEdge * Sit.edge, X.softLim[0], X.softLim[1]);
        if (c.near.length > c.mateIn.length + 1) lim *= this.retreatSgn(S) < 0 ? 0.8 : K.caution.outMul;
        if (c.near.length >= 2 && c.mateIn.length < 1) lim = Math.min(lim, K.danger.soloLim);
        if (c.ratio > lim) {
          const ne = c.nf;
          if (ne && ne.hp < ne.maxHp * 0.25 && dist(u, ne) <= u.role.range + 4 && c.hpR > 0.3) return null;
          if (!u.waitSince) u.waitSince = this.t;
          if (this.t - u.waitSince > ticks(X.softWait)) { u.waitSince = 0; u.cautionOff = this.t + ticks(X.softOff); return null; }
          u.caution = this.t + ticks(2);
          const safeD = Math.max(18, ...c.near.map(e => e.role.range + 8)) + X.safeP * N.p;
          if (ne && dist(u, ne) < safeD) return home ? null : this.kiteOk(u, c) ? { kind: 'kite' } : { kind: 'flee' };
          return { kind: 'wait' };
        }
      }
      u.waitSince = 0;
      return null;
    },

    decideCarry(u, c) {
      if (!c.n || !c.z) return null;
      const X = A().carry, N = u.sn, Sit = this.sit[u.team], zr = c.z.r || CONFIG.battle.map.core.deposit.r, Gr = A().grade, g = gOf(u), hw = ramp(g, Gr.hiLo, Gr.mustHi), lead = Math.max(0, -Sit.need);
      const foes0 = c.near.filter(e => dist(u, e) <= Math.max(28, (e.role.range || 6) + 8));
      if (!foes0.length && !c.reachers.length) { u.cdec = null; return null; }
      const go = { kind: 'deposit', z: c.z };
      const feas0 = c.tDep <= c.ttd * X.feas || !c.reachers.length, pReach = clamp(c.ttd / Math.max(0.2, c.tDep), 0, 1);
      const feasible = feas0 || (hw > 0 && c.val >= Gr.riskVal && pReach >= Gr.riskP + Gr.riskSlack * (1 - hw)), nearZ = c.dd <= zr + X.nearZone;
      const must = c.n >= X.must - hw || (c.n >= 2 && foes0.length >= X.mustFoes) || c.val >= X.mustVal - hw || (c.val >= 2 && lead * ramp(g, Gr.leadLo, Gr.leadHi) >= Gr.leadNeed), calmW = !c.reachers.length && feasible ? ramp(g, Gr.hiLo, Gr.calmG) : 0;
      const pSafe = clamp(1 - X.routeW * c.route - X.zoneW * c.foesZ, 0.15, 1) * (feas0 ? 1 : clamp(c.ttd / Math.max(0.2, c.tDep), 0.2, 1));
      let Vd = c.val * pSafe * (1 + X.needDep * Math.max(0, Sit.need) + X.leadDep * Math.max(0, -Sit.need) + X.objDep * N.o) * (1 + Gr.dep * (g - 0.67)) / (1 + X.time * c.tDep);
      const tg = foes0.length ? lowestOf(foes0) : null;
      const pWin = 1 / (1 + Math.pow(Math.max(0.01, c.ratio) / X.pw, 2));
      const pKill = tg ? pWin * (0.55 + 0.45 * (1 - tg.hp / tg.maxHp)) : 0;
      const pDie = (1 - pWin) * clamp(X.dieTtd / Math.max(0.5, c.ttd), 0.15, 1);
      let Vf = pKill * (X.kill + (tg ? carried(tg) * X.killCarry : 0)) * (1 + X.gamble * Math.max(0, Sit.need) * half(N.c)) - pDie * (c.val * X.loss + X.death);
      Vf *= nearZ ? X.nearMul : clamp(0.5 + (c.dd - zr - X.nearZone) / (X.nearZone * 4), 0.5, 1);
      if (Sit.need < 0) Vf *= 1 + Sit.need * X.leadFight;
      Vf *= 1 - Gr.leadCut * g * lead;
      Vf *= 1 - calmW;                                    // 안전하게 갈 수 있을 때 판단이 좋을수록 괜한 교전 유혹을 덜 받는다
      const margin = X.margin * (1 - X.marginJ * N.j);
      const pb = this.persBias(u); Vd *= pb.obj; Vf += pb.fight * margin * 1.5;
      if (c.val >= CARRY_MIN) Vf -= margin * 1.4 * (1 - clamp(pb.fight, 0, 0.9));
      const help = c.mateIn.some(a => a.hp > a.maxHp * X.allyHp && (this.engagedAlly(a) || dist(a, u) <= X.allyR * 0.6));
      let d;
      if (must) d = feasible ? go : help ? { kind: 'fight' } : c.mateIn.length ? { kind: 'flee' } : go;
      else if (Vd > Vf + margin) d = go;
      else if (Vf > Vd + margin) d = { kind: 'fight' };
      else d = help ? { kind: 'fight' } : feasible ? go : c.mateIn.length ? { kind: 'flee' } : go;
      const prev = u.cdec;
      if (prev && this.t < prev.until && prev.kind !== d.kind && !must) d = prev.kind === 'deposit' ? go : { kind: prev.kind };
      else u.cdec = { kind: d.kind, until: this.t + ticks(X.hold) };
      return d;
    },

    /* ---------- Layer 5: 코어 소지자 평가기 ----------
       규칙(문턱값) 대신 선택지를 짧게 앞서 굴려 '승리확률' 변화로 비교합니다. 선택지: 제출(구역별) · 아군 경유 제출 · 후퇴/회복팩 · 교전.
       q(등급+판단력)가 높을수록 멀리 보고, 안 보이는 적도 계산하고, 아군을 이용한 경로를 떠올리며, 위험 추정이 정밀합니다. 낮으면 가까운 것만 보고 놓칩니다. */
    evQ(u) { return clamp(0.6 * gOf(u) + 0.4 * half(u.sn.j), 0, 1); },
    evWp(lead, left) { const X = A().ev, sd = this.sudden ? X.sigSd : X.sig0 + X.sigT * Math.max(0, left); return 1 / (1 + Math.exp(-lead / sd)); },
    foeDps(e, u) {                                         // 적 한 명이 나에게 주는 초당 예상 피해 (기본 공격 + 스킬 보정)
      const B = e.f && e.f.basic; if (!B) return 0;
      const raw = this.raw(e, 0, B.atk, B.ap), pen = clamp(this.eff(e, 'pen'), 0, 0.9);
      const arm = B.type === 'true' ? 0 : Math.max(0, this.eff(u, B.type === 'magic' ? 'res' : 'def') * (1 - pen));
      return raw * 100 / (100 + arm) * this.eff(e, 'aspd') * TPS * (1 + A().ev.skillDps);
    },
    evThreats(u, c, q, reach) {                            // 판단 품질에 맞춰 고려할 위협 목록 (보이는 적 + 기억 속의 적)
      const X = A().ev, out = [];
      const push = (e, x, y, w, vis) => { const dps = this.foeDps(e, u); if (dps > 0 && w > 0.03) out.push({ x, y, r: (e.role && e.role.range) || 6, s: Math.max(0.05, this.eff(e, 'spd')) * TPS, dps, w, vis }); };
      for (const e of c.foes) if (dist(u, e) <= reach) push(e, e.x, e.y, 1, true);
      const gq = ramp(q, X.ghostQ, 0.8) * X.ghostW;
      if (gq > 0) for (const g of c.gh) if (Math.hypot(u.x - g.x, u.y - g.y) <= reach + 10) push(g.e, g.x, g.y, Math.min(1, g.w) * gq, false);
      return out;
    },
    evSim(u, pts, stayT, thr, mates, maxT) {               // 내가 경로를 따라 이동(도착 후 stayT초 정지)하는 동안 적이 따라붙으며 주는 예상 피해
      const X = A().ev, dt = X.dt, spd = Math.max(0.05, this.eff(u, 'spd')) * TPS;
      let px = u.x, py = u.y, wi = 0, t = 0, stay = 0, dmg = 0;
      const fs = thr.map(f => ({ x: f.x, y: f.y, r: f.r, s: f.s * (f.vis ? X.pursuit : X.ghostPursuit), dps: f.dps, w: f.w }));
      while (t < maxT) {
        let rem = spd * dt;
        while (rem > 1e-6 && wi < pts.length) {
          const tx = pts[wi].x, ty = pts[wi].y, d = Math.hypot(tx - px, ty - py);
          if (d <= rem) { px = tx; py = ty; rem -= d; wi++; } else { px += (tx - px) / d * rem; py += (ty - py) / d * rem; rem = 0; }
        }
        const moving = wi < pts.length; if (!moving) stay += dt;
        let nA = 0; for (const m of mates) if (Math.hypot(m.x - px, m.y - py) <= X.allyR) nA++;
        const shr = 1 / (1 + X.allyShare * nA);
        for (const f of fs) {
          const dx = px - f.x, dy = py - f.y, d = Math.hypot(dx, dy), rc = f.r * 0.85;
          if (d > rc) { const st = Math.min(d - rc, f.s * dt); f.x += dx / d * st; f.y += dy / d * st; }
          if (Math.hypot(px - f.x, py - f.y) <= f.r + 1.5) dmg += f.dps * dt * f.w * shr;
        }
        t += dt; if (!moving && stay >= stayT) break;
      }
      return { dmg, t };
    },
    carryPlan(u, c) {                                      // 반환: 결정({kind}) 또는 null(위협 없음 → 기존 흐름)
      const X = A().ev, K = CONFIG.battle.map.core, N = u.sn, Sit = this.sit[u.team], q = this.evQ(u);
      const thr = this.evThreats(u, c, q, lerp(X.reachLo, X.reachHi, q));
      if (!thr.length) { u.ev = null; return null; }
      const s = u.ev, sig = thr.length + '|' + c.reachers.length;
      if (s && this.t < s.at && s.sig === sig && !(c.hurt && this.t - s.t0 > ticks(0.25))) return s.d;
      const us = this.teamUnits(u.team), mates = us.filter(a => a !== u && a.hp > a.maxHp * 0.3).map(a => ({ x: a.x, y: a.y, a }));
      const lead = this.score[u.team] - this.score[1 - u.team], left = this.clock().left, val = c.val, n = c.n, hpR = c.hpR;
      const pts = val + (n >= K.deposit.comboAt ? K.deposit.comboBonus : 0), m = u.mind || (u.mind = { bias: 0, at: 0 });
      const H = lerp(X.hLo, X.hHi, q), spd = Math.max(0.05, this.eff(u, 'spd')) * TPS, kk = X.k0 + X.kQ * q;
      const surv = dmg => 1 / (1 + Math.exp(kk * (dmg * (1 + m.bias * 0.5) / Math.max(1, u.hp) - X.surv0)));
      const pGrab = clamp(X.grab0 + X.grabN * c.near.filter(e => dist(u, e) <= 30).length, 0, 0.95);
      const dieV = T => this.evWp(lead - X.deathPts - val * pGrab, left - T);
      const chan = K.deposit.channelSec + (K.deposit.perCoreSec || 0) * (n - 1);
      const opts = [], zones = this.map.zones.filter(z => z.deposit && !(u.bail && u.bail.zid === z.id && this.t < u.bail.retryAt));
      const dep = (key, d, pts_, T0) => {                  // 제출 선택지: pts_ 경유지 목록 → 마지막이 제출 지점
        const last = pts_[pts_.length - 1];
        let len = 0, px = u.x, py = u.y; for (const p of pts_) { len += Math.hypot(p.x - px, p.y - py); px = p.x; py = p.y; }
        const Tfull = len / spd + chan, r = this.evSim(u, pts_, chan, thr, mates, Math.min(Tfull, H) + 1e-3), p = surv(r.dmg);
        opts.push({ key, d, pS: p, ev: p * this.evWp(lead + pts, left - Tfull) + (1 - p) * dieV(r.t) });
      };
      for (const z of zones) {
        const zr = (z.r || K.deposit.r) * 0.8, dd = Math.hypot(u.x - z.x, u.y - z.y), k = dd > zr ? (dd - zr) / dd : 0;
        dep('dep:' + z.id, { kind: 'deposit', z }, [{ x: u.x + (z.x - u.x) * k, y: u.y + (z.y - u.y) * k }]);
      }
      if (q >= X.viaQ && opts.length && mates.length) {    // 아군 쪽으로 돌아서 제출: 좋은 판단은 '같이 가는' 경로를 떠올린다
        const bd = opts.reduce((a, b) => (a.ev >= b.ev ? a : b)), z = bd.d.z;
        let bm = null, bs = 1e9;
        for (const a of mates) { const dv = Math.hypot(a.x - u.x, a.y - u.y) + Math.hypot(a.x - z.x, a.y - z.y) - Math.hypot(u.x - z.x, u.y - z.y); if (dv < bs && dv <= X.viaMax) { bs = dv; bm = a; } }
        if (bm && bs > 6) {
          const zr = (z.r || K.deposit.r) * 0.8, dd = Math.hypot(bm.x - z.x, bm.y - z.y), k = dd > zr ? (dd - zr) / dd : 0;
          dep('via:' + z.id, { kind: 'route', via: { x: bm.x, y: bm.y }, z }, [{ x: bm.x, y: bm.y }, { x: bm.x + (z.x - bm.x) * k, y: bm.y + (z.y - bm.y) * k }]);
        }
      }
      const sp = this.safePoint(u, us, c.near);            // 후퇴 / 회복팩 / 아군 합류
      if (sp) {
        const len = Math.hypot(sp.x - u.x, sp.y - u.y), r = this.evSim(u, [{ x: sp.x, y: sp.y }], Math.max(0, H - len / spd), thr, mates, H), p = surv(r.dmg);
        const pod = sp.pod ? this.map.pods.find(o => o.x === sp.x && o.y === sp.y) : null;
        opts.push({ key: pod ? 'pod' : 'ret', d: pod ? { kind: 'pod', pod } : { kind: 'flee' }, pS: p, ev: p * (this.evWp(lead + val * X.hold, left - H * 0.5) + (pod ? X.podV * (1 - hpR) : 0)) + (1 - p) * dieV(H * 0.5) });
      }
      if (c.near.length) {                                 // 교전: 이길 확률(전력비) × (처치 가치 + 코어 유지) / 질 확률 × 죽음. 뒤질수록 클러치가 낮은 선수는 승산을 과대평가
        const pw = 1 / (1 + Math.pow(Math.max(0.01, c.ratio) / A().carry.pw, 2)), desp = Math.max(0, Sit.need) * (1 - (0.5 + 0.5 * N.c)), pW = clamp(pw + X.panic * desp * (1 - pw), 0, 1);
        const kill = X.kill + (c.nf ? carried(c.nf) * X.killCarry : 0);
        opts.push({ key: 'fight', d: { kind: 'fight' }, pS: pW, ev: pW * this.evWp(lead + kill + val * X.hold, left - X.fightSec) + (1 - pW) * dieV(X.fightSec) });
      }
      if (!opts.length) { u.ev = null; return null; }
      for (const o of opts) o.ev += this.goalEv(u, o.key);
      opts.sort((a, b) => b.ev - a.ev);
      let pick = opts[0]; const prev = s && opts.find(o => o.key === s.key), margin = lerp(X.swLo, X.swHi, q);
      if (prev && pick !== prev && pick.ev - prev.ev < margin) pick = prev;       // 한 번 정한 계획은 뚜렷하게 더 좋은 대안이 있을 때만 바꾼다
      if (pick.d.kind === 'fight') u.standT = this.t + ticks(A().flee.standSec);   // 맞서기로 했으면 궁극기를 아끼지 않는다
      u.ev = { key: pick.key, d: pick.d, sig, t0: this.t, at: this.t + ticks(lerp(X.evalSec[0], X.evalSec[1], clamp(0.5 * half(N.r) + 0.5 * q, 0, 1))), q, opts: opts.map(o => ({ k: o.key, ev: Math.round(o.ev * 1000) / 1000, p: Math.round(o.pS * 100) / 100 })) };
      return pick.d;
    },
    goalAdj(u, tg) {                                       // 팀 목표 → 개인 목표 점수 보너스 (battle.assign 에서 호출)
      const M = this.md && this.md[u.team], X = A().goalW; if (!M || !X) return 0;
      const own = this.coreValue(u), carrier = own >= CARRY_MIN, ty = tg.type, g = M.goal; let a = 0;
      if (g === 'SecureDeposit') { if (carrier) { if (ty === 'deposit') a += X.secDep; else if (ty === 'core') a -= X.secCore; else if (ty === 'hunt') a -= X.secHunt; } }
      else if (g === 'FarmCores') { if (ty === 'core') a += X.farm; }
      else if (g === 'HuntCarrier') { if (ty === 'hunt' && !carrier) a += X.hunt * (carried(tg.e) > 0 ? 1 : 0.4); }
      else if (g === 'ForceFight') { if (ty === 'hunt' && !carrier) a += X.force; }
      else if (g === 'BossPlay') { if ((ty === 'boss' || ty === 'stage') && !carrier) a += X.boss; }
      else if (g === 'Stall') { if (ty === 'hunt') a -= X.stallHunt; else if (ty === 'deposit' || ty === 'guard' || ty === 'join') a += X.stall; }
      return a * (X.f0 + X.fq * this.evQ(u));
    },
    goalEv(u, key) {                                       // 평가기용: 팀 목표가 제출/교전 선택지에 얹는 작은 보정
      const M = this.md && this.md[u.team], X = A().goalW; if (!M || !X) return 0;
      const w = X.f0 + X.fq * this.evQ(u), dep = key.startsWith('dep:') || key.startsWith('via:');
      if (M.goal === 'SecureDeposit') return (dep ? X.evDep : key === 'fight' ? -X.evFight : 0) * w;
      if (M.goal === 'HuntCarrier' || M.goal === 'ForceFight') return key === 'fight' ? X.evFight * w : 0;
      return 0;
    },
    depNeed(u, need, foeU, known, urg, Sn, slots) {         // 선수별 제출 기준: 안전하면 콤보까지 욕심, 위험하면 일찍 제출 (품질이 높을수록 이 판단을 함)
      const X = A().depT, K = CONFIG.battle.map.core; if (!X) return need;
      const q = this.evQ(u);
      if (foeU) return q >= X.riskQ ? Math.max(1, need - 1) : need;
      if (q >= X.comboQ && urg <= 1 && need < K.deposit.comboAt && slots >= need && slots < K.deposit.comboAt && u.hp >= u.maxHp * X.comboHp && Sn.need <= X.comboNeed
        && known.some(k => dist(u, k) <= X.knownR)) return K.deposit.comboAt;
      return need;
    },
    carryDisc(u, c) {                                      // 코어를 든 채 위협이 있으면 욕심 부려 줍거나 교전 중 코어를 챙기러 가지 않는다 (제출/후퇴 판단은 평가기)
      const X = A().ev; if (!X || !X.on || !c.n || c.val < X.grabVal) return false;
      return c.near.length > 0 || c.ghP > X.grabGhost;
    },
    grabOk(u, c) {                                         // 위협이 없어도 제출 방향에서 크게 벗어나는 코어는 줍지 않는다
      const X = A().ev; if (!X || !X.on || !c.n || c.val < X.grabVal || !c.z) return true;
      const K = CONFIG.battle.map.core, slots = this.coreSlots(u); let best = null, bd = K.grabR;
      for (const k of this.cores) { if (!k.known[u.team] || k.lockUntil > this.t || slots + k.slots > K.carryCap) continue; const d = dist(u, k); if (d < bd) { bd = d; best = k; } }
      if (!best) return true;
      return bd + Math.hypot(best.x - c.z.x, best.y - c.z.y) - c.dd <= X.detour + X.detourV * best.value;
    },

    decide(u, c) {
      if (c.n && A().ev && A().ev.on) { const e = this.carryPlan(u, c); if (e) { u.fb = null; return e; } }       // 코어 소지자: 평가기가 판단 (위협이 없으면 null → 기존 흐름)
      const s = this.survive(u, c);
      if (s) {
        if ((s.kind === 'flee' || s.kind === 'wait') && c.n && c.z && c.tDep <= c.ttd * A().carry.feas) return { kind: 'deposit', z: c.z };
        return s;
      }
      return this.decideCarry(u, c);
    },

    runDecision(u, d, c, enemies, allies) {
      if (d.kind === 'fight') return false;
      if (d.kind === 'pod') { u.goal = { type: 'pod', pod: d.pod }; u.target = null; u.chase = null; this.objective(u, enemies); return true; }
      if (d.kind === 'route') {                           // 아군 쪽을 거쳐 제출: 경유지에 닿으면 제출로 전환
        if (dist(u, d.via) > 6) { u.actT = this.t; u.target = null; u.chase = null; this.stepNav(u, d.via.x, d.via.y, this.eff(u, 'spd')); return true; }
        d = { kind: 'deposit', z: d.z };
      }
      if (d.kind === 'deposit') { u.goal = { type: 'deposit', z: d.z, since: u.goal && u.goal.type === 'deposit' ? u.goal.since : this.t }; u.target = null; u.chase = null; this.objective(u, enemies); return true; }
      if (d.kind === 'flee') {
        const th = c.near.filter(e => dist(u, e) <= Math.max(26, (e.role.range || 6) + 10));
        u.actT = this.t; u.target = u.target && u.target.alive ? u.target : (th.length ? nearestOf(u, th) : null);
        this.retreatMove(u, allies, th.length ? th : c.near); return true;
      }
      if (d.kind === 'kite') {
        const nf = c.nf; if (!nf) return false;
        const dd = dist(u, nf), R = u.role; u.actT = this.t;
        if (R.range >= 10) {
          if (dd < R.range * A().retreat.kiteClose) { u.target = nf; this.retreatMove(u, allies, c.near); return true; }
          return false;
        }
        const m = c.mateIn.filter(q => q.hp > q.maxHp * 0.5);
        if (m.length && dd > R.range + 2) {
          const cx = m.reduce((s, q) => s + q.x, 0) / m.length, cy = m.reduce((s, q) => s + q.y, 0) / m.length;
          if (Math.hypot(cx - u.x, cy - u.y) > 8) { this.stepNav(u, cx, cy, this.eff(u, 'spd')); return true; }
        }
        return false;
      }
      if (d.kind === 'wait') {
        u.actT = this.t;
        const g = u.goal, pt = g && g.type === 'deposit' ? g.z : g && g.type === 'core' ? g.c : null;
        if (pt && !enemies.some(e => e.team < 2 && dist(e, pt) < (pt.r || 0) + 12)) this.objective(u, enemies);
        return true;
      }
      return false;
    },

    channelRisk(u, c) {
      const K = CONFIG.battle.map.core, B = A().chan, N = u.sn, Sit = this.sit[u.team], T = this.tp[u.team].tempo || {};
      if ((u.bailN || 0) >= B.max || (!this.sudden && (this.cfg.maxTicks - this.t) / TPS <= B.lastSec)) return null;
      const inReach = c.reachers.filter(e => e.team < 2);
      if (!c.reachers.length && c.dps <= 0) return null;
      const rem = (1 - u.depProg) * (K.deposit.channelSec + (K.deposit.perCoreSec || 0) * (c.n - 1)), lam = this.recentHits(u, B.win) / B.win;
      const stuck = lam > 0 && Math.exp(-lam * rem) < B.minChance && c.hpR < B.earlyHp;
      const margin = clamp(B.margin * (1 - B.marginP * N.p + B.marginC * Math.max(0, Sit.need) * N.c) * (T.sdGuard ? B.sdMul : 1), 0.3, 1.3);
      if (rem <= c.ttd * margin && !stuck) return null;
      if (c.hpR <= B.panicHp) return 'panic';
      if (!c.mates.some(a => a.hp > a.maxHp * 0.4 && dist(u, a) <= B.allyR)) return null;
      const h = u.hitBy && u.hitBy.alive && !this.hidden(u.hitBy) && this.t - u.hurtT < ticks(1.5) ? u.hitBy : null;
      if (h && dist(u, h) <= u.role.range && h.hp < h.maxHp * 0.3 && inReach.length <= 1) return null;
      if (inReach.length <= 1 && h && this.power(h) <= this.power(u) * B.counterPow) return null;
      if (c.ratio < B.allyRatio) return null;
      return stuck && rem <= c.ttd * margin ? 'stuck' : inReach.length > 1 ? 'outnum' : 'die';
    },
    depAbort(u, why) {
      const B = A().chan, n = (u.bailN || 0) + 1;
      u.bailN = n; u.bail = { zid: u.depAt, why, fleeUntil: this.t + ticks(B.fleeSec), minAt: this.t + ticks(B.minWaitSec), retryAt: this.t + ticks(B.waitSec + (n - 1) * 2) };
      u.depProg = 0; u.depAt = ''; u.goal = null; u.target = null; u.chase = null;
    },
    bailStep(u, enemies, allies) {
      const b = u.bail; if (!b) return false;
      const B = A().chan;
      if (!u.carry.length || this.t >= b.retryAt) { u.bail = null; return false; }
      const z = this.map.zones.find(q => q.id === b.zid), foes = enemies.filter(e => e.team < 2 && !e.struct && !this.hidden(e));
      if (this.t >= b.minAt && z && !foes.some(e => dist(e, z) <= (z.r || 12) + B.clearR)) { u.bail = null; return false; }
      const near = foes.filter(e => dist(u, e) <= B.safeD);
      if (this.t < b.fleeUntil && near.length) { this.retreatMove(u, allies, near); u.actT = this.t; return true; }
      if (!near.length) { u.actT = this.t; return true; }
      return false;
    },

    huntEV(u, e) {
      const H = GR().hunt, g = gOf(u);
      let fp = this.power(e), mp = this.power(u);
      for (const o of this.units) {
        if (!o.alive || o.struct || o === u || o === e || o.team === 2) continue;
        if (o.team === u.team) { if (dist(o, e) <= H.mateR) mp += this.power(o); }
        else if (!this.hidden(o) && dist(o, e) <= H.foeR) fp += this.power(o);
      }
      const r = Math.max(0.05, mp / Math.max(0.05, fp)) * (1 + (Math.random() - 0.5) * H.noise * (1 - g) * (1 - 0.4 * half(u.sn.j)));
      const p = 1 / (1 + Math.exp(-H.k * Math.log(r)));
      const read = clamp((g - 0.2) / 0.6, 0, 1);
      const esc = this.foeState(e, g).esc;
      const gain = clamp(2 * p, 0, H.gainCap) * (esc ? 1 - H.escCut * read : 1);
      const cost = (H.deathBase + this.coreValue(u) * H.carryW) * lerp(H.careLo, H.careHi, g);
      return { p, gain, loss: (1 - p) * cost * H.costW };
    },
    foesOf(team) { return this.units.filter(e => e.team === 1 - team && e.alive && !e.struct && !this.hidden(e) && !this.gone(e)); },

    bossValue(team, boss, us, enemyUnits, W, SB, BL, dn) {
      const AB = A().boss, T = this.tp[team].tempo || {}, Sb = this.sit[team];
      const nearFoes = enemyUnits.filter(e => Math.hypot(e.x - boss.x, e.y - boss.y) <= 24).length, mineNear = us.filter(a => Math.hypot(a.x - boss.x, a.y - boss.y) <= 24).length;
      const hpR = boss.hp / boss.maxHp, hitting = nearFoes > 0 && hpR < 0.92;
      const pitFp = enemyUnits.filter(e => Math.hypot(e.x - boss.x, e.y - boss.y) <= 30).reduce((q, e) => q + this.power(e), 0), myP = us.reduce((q, a) => q + this.power(a), 0);
      const K = CONFIG.battle.map.core.boss;
      let v = (boss.bossDef.kind === 'late' ? K.valueLate : K.valueFirst) * W.boss, cap = 3, stage = 0;
      if (SB === 'steal') { v *= hitting && hpR < AB.stealHp ? 2.2 : 0.1; stage = 1.5; }
      else {
        if (SB === 'contest') { cap = dn === 'boss' ? 3 : clamp(Math.ceil(BL / 2.5), 1, 3); }
        if (T.bank) { v *= hitting && hpR < AB.bankHp ? AB.bankSteal : SB === 'contest' ? AB.bankContest : AB.bankMul; stage = Math.max(stage, 1.2); cap = Math.min(cap, 2); }
        else if (T.gamble) {
          if (pitFp > myP * AB.avoid) { v *= 0.5; stage = Math.max(stage, 1.5); } else { v *= AB.gambleMul; cap = 3; }
          if (hitting && hpR < AB.stealHp) { v *= 1.4; stage = Math.max(stage, 1.2); }
        }
        else {
          if (hitting && hpR < AB.stealHp) { v *= 1.4; stage = Math.max(stage, 1.2); }
          if (nearFoes >= 2 && mineNear < 2) v *= 0.75;
          if (pitFp > myP * AB.avoid && SB !== 'contest') { v *= 0.5; stage = Math.max(stage, 1.5); }
        }
      }
      if (SB === 'yield' && !(hitting && hpR < AB.stealHp) && !T.gamble) { v *= CONFIG.tactics.p.yieldMul; cap = Math.min(cap, CONFIG.tactics.p.yieldCap); }
      if (Sb.j > 0.2 && hitting) v *= 1.2;
      return { v, cap, stage, hitting, hpR };
    },

    act(u) {
      const cfg = this.cfg;
      if (u.team === 2) { this.bossAct(u); return; }
      if (u.struct) return;
      if (this.stunned(u) || this.gone(u)) return;
      const enemies = this.foes(u), allies = this.friends(u);
      const fear = u.st.find(s => s.fear);
      if (fear) { const src = fear.src && fear.src.alive ? fear.src : (enemies.length ? nearestOf(u, enemies) : null); if (src) this.flee(u, src); return; }
      if (this.t < u.regroupUntil && this.t - u.hitT > 20 && this.regroupStep(u)) return;
      const c = this.sense(u, enemies, allies);
      this.intentOf(u, c);
      if (c.n && u.depProg > 0 && u.depAt) { const why = this.channelRisk(u, c); if (why) this.depAbort(u, why); }
      if (this.bailStep(u, enemies, allies)) return;
      if (c.n && u.depProg > 0 && u.depAt) {
        u.actT = this.t; u.cd = Math.min(u.cd + this.eff(u, 'aspd'), 1.5);
        const h = u.hitBy;
        if (h && h.alive && !this.hidden(h) && this.t - u.hurtT < ticks(1.2) && dist(u, h) <= u.role.range) {
          for (const k of this.skillsOf(u).list) if (!k.move && this.trySkill(u, k, 'skill', [h], allies, false, true)) return;
          if (u.cd >= 1 && !u.st.some(s => s.disarm)) { u.cd -= 1; u.fxAtk = this.t; this.attack(u, h); }
        }
        return;
      }
      u.cd = Math.min(u.cd + this.eff(u, 'aspd'), 1.5);
      if (u.st.some(s => s.channel)) { u.actT = this.t; return; }
      if (this.t - u.actT > 36) { u.forceGo = this.t + 50; u.actT = this.t; }
      const dec = this.decide(u, c), lock = !!dec && (dec.kind === 'deposit' || dec.kind === 'flee' || dec.kind === 'route');
      const sk = this.skillsOf(u), ult = sk.ult, aggro = this.aggro(u), reach = Math.max(aggro, 34);
      const foesNear = enemies.filter(e => !e.struct && dist(u, e) <= (e.team === 2 ? 24 : reach));

      for (const k of [...sk.list, ult]) if (u.rc[k.id] && this.tryRecast(u, k, k === ult ? 'ult' : 'skill', enemies, allies, true)) return;

      if (foesNear.length || allies.some(a => a.hp < a.maxHp * 0.6)) {
        if (!this.manual[u.team] && u.ultCd <= 0 && !(this.orderOf(u) && this.orderOf(u).id === 'ultHold') && !(dec && dec.kind === 'deposit' && !c.reachers.length)) {
          const up = this.ultPolicy(u, foesNear, allies);
          if (up.ok && this.trySkill(u, ult, 'ult', foesNear, allies, up.strict, !(up.chain || up.now))) return;
        }
        for (const k of sk.list) { if (lock && k.move) continue; if (this.trySkill(u, k, 'skill', foesNear, allies, false, true)) return; }
      }
      if (dec && this.runDecision(u, dec, c, enemies, allies)) return;
      if (this.podPull(u, enemies, allies)) return;
      if (this.groupUp(u, c)) return;
      if (!(dec && dec.kind === 'fight')) {
        if (!(u.cr === 'escort' && u.crT && u.crT.alive) && this.grabOk(u, c) && this.grabNear(u, enemies)) return;
        if (!this.carryDisc(u, c) && this.dgStep(u, enemies, allies, aggro)) return;
      }

      const P = this.tp[u.team], CX = A().chase, N = u.sn;
      const near = enemies.filter(e => dist(u, e) <= (e.team === 2 ? 15 : e.struct ? 14 : aggro)), hb = u.hitBy;
      if (hb && hb.alive && !this.hidden(hb) && this.t - u.hitT < 60 && dist(u, hb) <= aggro + 20 && !near.includes(hb)) near.push(hb);
      const tg = u.target;
      if (tg && tg.alive && !this.hidden(tg) && dist(u, tg) <= (tg.team === 2 ? 20 : tg.struct ? 18 : aggro + 12) && !near.includes(tg)) near.push(tg);
      const huntLock = !!(P.chase && P.chase.ids.includes(u.id) && P.chase.e.alive && !this.hidden(P.chase.e));
      if (huntLock && !near.includes(P.chase.e) && dist(u, P.chase.e) <= aggro + CX.reach) near.push(P.chase.e);
      const fcE = P.focus && P.focus.e.alive && !this.hidden(P.focus.e) ? P.focus.e : null;
      if (fcE && !near.includes(fcE) && !(u.carry && u.carry.length) && allies.some(a => a !== u && dist(a, fcE) <= 24) && dist(u, fcE) <= aggro + 14 + 2 * (3 + 2 * half(N.t))) near.push(fcE);
      if (fcE !== u.focusSeen) { u.focusSeen = fcE; if (fcE) u.retarget = 0; }
      if (u.ignore && u.ignore.until > this.t) for (let i = near.length - 1; i >= 0; i--) if (near[i] === u.ignore.e && dist(u, near[i]) > u.role.range + 2) near.splice(i, 1);
      if (near.length && u.brain.podRun && this.podRun(u, near, enemies)) return;
      if (u.cr === 'escort' && u.crT && u.crT.alive && this.coreValue(u.crT) >= CARRY_MIN) {     // 호위: 캐리어에게서 먼 적은 쫓지 않는다
        const k = u.crT, pbE = this.persBias(u), lv = 14 + 8 * clamp(pbE.fight, 0, 1) - 4 * half(u.sn.t);
        for (let i = near.length - 1; i >= 0; i--) { const e = near[i]; if (e.team < 2 && !e.struct && dist(e, k) > lv + (e.role.range || 6) * 0.5 && !(u.hitBy === e && this.t - u.hitT < 30)) near.splice(i, 1); }
        if (!near.length && dist(u, k) > 16 && this.t - u.hitT > 30) { u.goal = { type: 'escort', a: k, since: this.t }; u.target = null; u.chase = null; this.objective(u, enemies); return; }
      }
      if (!near.length) { const he = this.helpTarget(u, enemies, allies, aggro); if (he) near.push(he); }
      if (!near.length) { const rt = this.roamTarget(u, enemies, aggro); if (rt) near.push(rt); }
      if (!near.length) { u.target = null; this.objective(u, enemies); return; }

      if (!u.target || !u.target.alive || this.hidden(u.target) || !near.includes(u.target) || --u.retarget <= 0) {
        u.target = this.pick(u, near, allies);
        const T = u.tac; u.retarget = Math.round(cfg.retargetTicks * u.brain.retargetMul * (T.fight === 'solo' ? 1 + CONFIG.tactics.p.soloStick * T.fightS : T.fight === 'coop' ? 1 - 0.5 * T.fightS : 1));
      }
      const t = u.target; if (!t) return;
      const d = dist(u, t);
      if (Math.abs(t.x - u.x) > 0.5) u.facing = t.x > u.x ? 1 : -1;
      if (t.team < 2 && !t.struct && d > u.role.range + 1.5 && !(u.hitBy === t && this.t - u.hitT < 40)) {
        const ch = (u.chase && u.chase.e === t) ? u.chase : (u.chase = { e: t, t0: this.t, dBest: d, x0: u.x, y0: u.y });
        if (d < ch.dBest - 0.4) { ch.dBest = d; ch.t0 = this.t; ch.x0 = u.x; ch.y0 = u.y; }
        const carrying = u.carry && u.carry.length > 0, alone = c.mateIn.length < 1, win = c.ratio <= 0.6 && t.hp < t.maxHp * 0.3;
        const lockT = huntLock && P.chase.e === t;
        const chaseMul = carrying ? (win ? 0.5 : 0.1) : lockT ? CX.stick : alone ? 0.5 : 1, leashMul = carrying ? (win ? 0.6 : 0.2) : lockT ? CX.stick : alone ? 0.6 : 1, ignoreSec = carrying || alone ? 5 : 3.5;
        if (this.t - ch.t0 > ticks(u.brain.chaseT * chaseMul) || Math.hypot(u.x - ch.x0, u.y - ch.y0) > u.brain.leash * leashMul) {
          u.ignore = { e: t, until: this.t + ticks(ignoreSec) }; u.chase = null; u.target = null; this.objective(u, enemies); return;
        }
      } else u.chase = null;
      if (u.cd >= 1 && d <= u.role.range && !u.st.some(s => s.disarm)) { u.cd -= 1; u.fxAtk = this.t; u.actT = this.t; this.attack(u, t); }
      else if (t.team < 2 && !t.struct && d > u.role.range + 6 && this.gateHold(u)) return;
      else this.move(u, t, d, enemies, allies);
    }
  });
})();
