(() => {
  const A = () => CONFIG.mind;
  const TPS = 1000 / CONFIG.battle.tickMs;
  const ticks = s => Math.max(1, Math.round(s * TPS));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const nearestOf = (u, list) => list.reduce((a, b) => (dist(u, a) <= dist(u, b) ? a : b));
  const lowestOf = list => list.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b));
  const carried = e => (e.carry || []).reduce((q, k) => q + k.value, 0);
  const segDist = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
    if (!l2) return Math.hypot(px - x1, py - y1);
    const t = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
  };
  const half = v => clamp(0.5 + 0.5 * v, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const GR = () => CONFIG.mind.grade;
  const gOf = u => (u.g != null ? u.g : 0.67);
  const NOSTYLE = Object.freeze({});

  Object.assign(Battle.prototype, {
    aiInit() {
      this.sit = [0, 1].map(() => ({ at: 0, edge: 0, need: 0, win: 'even', bias: 0, biasAt: 0, lead: 0, left: 0, j: 0, c: 0, t: 0, o: 0, p: 0, r: 0, a: 0, f: 0, u: 0, g: 0.67, gk: 0 }));
      this.tp = [0, 1].map(() => ({ focus: null, gate: { st: 'idle', since: 0, until: 0 }, chain: { until: 0, by: null }, pod: null, rearm: 0, duo: null, chase: null, escort: null, engage: false, tempo: null, planAt: 0 }));
    },
    aiSudden() { this.tp.forEach(P => { P.gate.st = 'idle'; P.pod = null; P.focus = null; P.chase = null; P.escort = null; P.engage = false; }); },
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
      const lead = this.score[team] - this.score[1 - team], total = this.cfg.maxTicks / TPS, left = this.sudden ? 0 : Math.max(0, (this.cfg.maxTicks - this.t) / TPS);
      P.lead = lead; P.left = left;
      P.need = this.sudden ? 1 : clamp(-lead / ((X.needBase + X.needLeft * left / total) * (1 - X.needC * P.c)), -1, 1);
    },

    tempo(team) {
      const X = A().time, S = this.sit[team], total = this.cfg.maxTicks / TPS;
      const left = this.sudden ? 0 : Math.max(0, (this.cfg.maxTicks - this.t) / TPS), el = total - left, fr = el / total;
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
      const th = (1 - X.openJ * Sit.j) * (1 - GR().open * Sit.g), edge = Sit.edge + X.pushEdge * T.push;
      Sit.win = edge >= X.open * th ? 'open' : edge <= -X.avoid * th ? 'avoid' : 'even';
      P.asn = foes.some(e => e.f.role === 'assassin' && us.some(a => dist(a, e) <= A().fstate.exposeR) && this.foeState(e, Sit.g).ult);
      this.planPod(team, us);
      this.planChase(team, us, foes);
      this.planFocus(team, us, foes);
      this.planGate(team, us, foes);
    },

    planPod(team, us) {
      const X = A().pod, P = this.tp[team], S = this.sit[team];
      const runner = us.find(a => a.goal && a.goal.type === 'pod' && a.hp < a.maxHp * X.hpMax);
      if (runner) { P.pod = { id: runner.id, until: this.t + ticks(X.base + X.t * half(S.t)) }; return; }
      if (P.pod && P.pod.until > this.t) return;
      if (P.pod) { P.pod = null; P.rearm = this.t + ticks(X.rearm); }
    },

    planChase(team, us, foes) {
      const X = A().chase, S = this.sit[team], P = this.tp[team];
      let c = P.chase; const Gr = GR(), g = S.g, hi = g >= Gr.mustHi;
      if (c && (!c.e.alive || this.hidden(c.e) || this.gone(c.e) || carried(c.e) < X.minVal * 0.5 || this.t > c.until)) c = P.chase = null;
      if (this.sudden) { P.chase = null; return; }
      const cands = foes.filter(e => carried(e) >= X.minVal && !foes.some(o => o !== e && dist(o, e) <= X.isoR * (1 - Gr.chaseIso * g)));
      if (c && !cands.includes(c.e)) c = P.chase = null;
      if (!cands.length) return;
      const reach = X.reach + X.reachT * half(S.t) + Gr.chaseReach * g;
      const hunters = us.filter(a => this.coreValue(a) <= X.maxOwn + (hi ? Gr.chaseOwn : 0) && a.hp > a.maxHp * (X.minHp - Gr.chaseHp * g) && !(a.goal && a.goal.type === 'pod') && this.follows(a));
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
      const n = Math.min(X.max, able.length, 1 + (carried(best) >= X.dupVal - (hi ? 1 : 0) ? 1 : 0));
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

    stratNow(team) {
      const S = this.strat[team], P = this.tp[team], TP = CONFIG.tactics, bossUp = this.units.some(b => b.team === 2 && b.alive);
      if (!P.tempo) this.teamPlan(team);
      const T = P.tempo, lead = this.score[team] - this.score[1 - team];
      let st = S.stance, lv = S.stanceL, dep = S.deposit, amb = false, ruled = false;
      const dn = this.ordNow(team);
      if (this.sudden) { st = 'collect'; lv = 6; dep = 'early'; ruled = true; }
      else if (dn === 'kill') { st = 'slay'; lv = 7; ruled = true; }
      else if (dn === 'boss') { st = 'boss'; lv = 7; ruled = true; }
      else if (dn === 'bossWait') { st = 'boss'; lv = 5; ruled = true; }
      else if (dn === 'wave') { st = 'collect'; lv = 7; ruled = true; }
      else if (dn === 'convoy') { st = 'balanced'; lv = 5; dep = 'early'; ruled = true; }
      else if (dn === 'ambush') { st = 'balanced'; lv = 4; ruled = true; }
      else if (dn === 'retreat') { st = 'defend'; lv = 7; dep = 'early'; ruled = true; }
      else if (dn === 'regroup') ruled = true;
      if (!ruled) {
        if (T.bank) { st = 'defend'; dep = 'early'; lv = Math.max(lv, 5); }
        else if (T.gamble) { const car = this.foesOf(team).some(e => carried(e) >= A().chase.minVal); st = bossUp ? 'boss' : car ? 'slay' : 'collect'; dep = 'early'; amb = !bossUp && car; lv = Math.max(lv, 5); }
        else if (T.sdGuard) { st = 'defend'; lv = Math.max(lv, 4); }
        else if (T.catchUp && st === 'balanced') { st = 'collect'; dep = 'early'; lv = Math.max(lv, 4); }
        else if (T.push < -0.15 && st === 'balanced') st = 'collect';
      }
      const k = (0.35 + 0.65 * lv / TP.maxLevel) * (ruled ? 1 : lerp(GR().fol[0], GR().fol[1], this.sit[team].g)), base = TP.stances[st] || TP.stances.balanced, W = {};
      for (const key in base) W[key] = key === 'aggro' ? base[key] * k : 1 + (base[key] - 1) * k;
      W.aggro += T.push * A().time.aggroPush;
      return { st, lv, W, lead, bossUp, dep, ambush: amb, dn };
    },

    aggro(u) {
      const T = u.tac, TP = CONFIG.tactics.p, X = A(), cur = this.cur[u.team]; let a = this.cfg.aggro + (cur ? cur.W.aggro : 0);
      if (T.mission === 'hunt') a += TP.mHuntAggro * T.missionL;
      if (u.goal && u.goal.type === 'hunt') a += 8;
      if (u.role.front && !u.role.backline) a += X.role.front * (0.6 + 0.4 * half(u.sn.t));
      const Sit = this.sit[u.team]; if (Sit) a += X.aggroEdge * Sit.edge;
      const v = this.coreValue(u); if (v >= 2) a = Math.min(a, Math.max(u.role.range * 1.15, X.carry.aggroCap + 4 * (3 - Math.min(3, v))));
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
      const win = this.sit[u.team].win;
      if ((mode == null || mode === 'normal') && (win === 'open' || (u.sn.u > 0.4 && foesNear.filter(e => e.team < 2).length >= 2))) strict = false;
      return { ok, strict, chain, now };
    },

    sense(u, enemies, allies) {
      const X = A().sense, K = CONFIG.battle.map.core, N = u.sn, m = u.mind || (u.mind = { bias: 0, at: 0 }), Gr = GR(), g = gOf(u);
      if (this.t >= m.at) { m.at = this.t + ticks(X.refresh * (1 - X.refreshR * half(N.r))); m.bias = (Math.random() * 2 - 1) * X.noise * (1 - half(N.j)) * lerp(Gr.noise[0], Gr.noise[1], g); }
      const vis = Math.max(22, X.vis + X.visJ * Math.max(0, N.j) + Gr.vis * (g - 0.67)), mr = Math.max(16, X.mate + X.mateT * N.t + Gr.mate * (g - 0.67));
      const foes = enemies.filter(e => e.team < 2 && !e.struct && !this.hidden(e));
      const near = foes.filter(e => dist(u, e) <= vis);
      const mates = allies.filter(a => a !== u && !this.gone(a));
      let mp = this.power(u); const mateIn = [];
      for (const a of mates) {
        const d = dist(u, a);
        if (d <= mr) { mp += this.power(a); mateIn.push(a); }
        else if (d <= mr * 1.6) mp += this.power(a) * clamp(1 - (d - mr) / (mr * 0.6), 0.2, 1) * 0.6;
      }
      let fp = 0; for (const e of near) fp += this.power(e);
      const ratio = fp ? fp / mp * (1 + m.bias) : 0;
      const reachers = enemies.filter(e => !e.struct && dist(u, e) <= (e.role.range || 6) + 4);
      const dps = Math.max(this.recentDps(u, X.dpsSec), reachers.length * X.assume * u.maxHp);
      const n = u.carry.length, val = this.coreValue(u);
      let z = null, dd = 1e9, key = 1e9, foesZ = 0;
      if (n) for (const q of this.map.zones) {
        if (!q.deposit || (u.bail && u.bail.zid === q.id && this.t < u.bail.retryAt)) continue;
        const d = Math.hypot(u.x - q.x, u.y - q.y), th = foes.filter(e => Math.hypot(e.x - q.x, e.y - q.y) <= (q.r || K.deposit.r) + X.zoneR).length, k = d + th * X.zoneCost;
        if (k < key) { key = k; z = q; dd = d; foesZ = th; }
      }
      const spd = Math.max(0.05, this.eff(u, 'spd')) * TPS;
      let route = 0;
      if (z) for (const e of foes) { const ds = segDist(e.x, e.y, u.x, u.y, z.x, z.y); if (ds <= X.routeR) route += this.power(e) / mp * (1 - ds / (X.routeR + 6)); }
      return { foes, near, mates, mateIn, mp, fp, ratio, reachers, dps, ttd: dps > 0 ? u.hp / dps : 99, hpR: u.hp / u.maxHp, n, val, z, dd, tDep: z ? dd / spd : 99, foesZ, route, nf: near.length ? nearestOf(u, near) : null, hurt: this.t - u.hitT < ticks(1.5) };
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

    survive(u, c) {
      const X = A().surv, K = CONFIG.battle.map.core, N = u.sn, Sit = this.sit[u.team], T = this.tp[u.team].tempo || {}, S = this.strat[u.team], B = u.brain;
      const thr = c.reachers.length > 0 || c.hurt;
      if (u.fb) {
        if (this.t > u.fb.until || (!thr && this.t > u.fb.min) || (u.fb.why === 'hp' && c.hpR > X.hpBack)) { u.fb = null; u.fbCd = this.t + ticks(X.fbCdSec); }
        else return { kind: 'flee' };
      }
      if (!c.near.length && !thr) { u.waitSince = 0; return null; }
      const sign = S.retreat === 'careful' ? 1 : S.retreat === 'brave' ? -1 : 0, doct = sign * S.retreatL / 7;
      const Gr = A().grade, g = gOf(u), nk = c.nf;
      const kill = !!nk && nk.hp < nk.maxHp * Gr.killHp && dist(u, nk) <= u.role.range + 4 && c.reachers.length <= 2 && c.hpR > 0.2;
      const coming = c.mates.some(a => a.alive && a.hp > a.maxHp * 0.4 && !c.mateIn.includes(a) && dist(a, u) <= Gr.allyR);
      const hold = clamp(g * Gr.hold * ((kill ? 1 : 0) + (coming ? Gr.allyW : 0)), 0, 0.45);
      const hpThr = clamp((B.retreatHp + doct * X.doctHp + (c.n ? X.hpCarry * Math.min(c.val, 5) : 0)) * (1 - hold) + Gr.earlyHp * (1 - g), 0.06, 0.75);
      if (c.hpR < hpThr && thr && !(this.t < (u.fbCd || 0) && c.hpR >= hpThr * 0.9)) {
        if (u.goal && u.goal.type === 'boss' && c.hpR > B.retreatHp * 0.7) return null;
        const pod = this.podFor(u, c);
        if (pod) return { kind: 'pod', pod };
        return this.startFb(u, 'hp', X.fbSec);
      }
      const safe = (1 - hold * 0.6) * (X.ttd + X.ttdP * N.p + (c.n ? X.ttdCarry * Math.min(c.val, 5) : 0) - X.ttdClutch * Math.max(0, Sit.need) * half(N.c) + (T.sdGuard ? X.ttdSd : 0) + doct * X.doct);
      const outnum = c.reachers.filter(e => e.team < 2).length > c.mateIn.filter(a => dist(a, u) <= 20).length + 1;
      const home = dist(u, this.homeDep(u.team)) <= K.caution.holdHome;
      if (thr && c.ttd < safe) {
        const nf = c.nf, win = c.ratio <= X.win * (1 + X.winJ * N.j) && c.hpR > 0.35;
        const fin = nf && nf.hp < nf.maxHp * X.finishHp && dist(u, nf) <= u.role.range + 3 && c.reachers.length <= 1 && c.hpR > 0.25;
        const dire = g >= 0.6 && c.ttd < safe * Gr.dire;
        if ((win && !dire) || fin || (home && !c.n)) return null;
        if (dire) { const pd = this.podFor(u, c); if (pd) return { kind: 'pod', pod: pd }; }
        if (!dire && this.kiteOk(u, c) && u.role.range >= A().retreat.kiteRange) return { kind: 'kite' };
        return this.startFb(u, 'ttd', X.fbSec * (dire ? 0.8 : 0.5));
      }
      const sk = this.skillsOf(u), allCd = sk.list.every(k => (u.cds[k.id] || 0) > ticks(1.2) || u.mp < k.cost) && u.ultCd > ticks(1.2);
      if (thr && allCd && c.hpR < X.cdHp && (outnum || u.role.backline) && !(u.tac.act === 'rush' && u.tac.actS >= 0.5)) return this.startFb(u, 'cd', X.cdSec);
      if (thr && outnum && c.hpR < hpThr + X.outHp * (1.3 - Gr.outHp * g) && !(this.t < (u.fbCd || 0))) return this.startFb(u, 'hp', X.fbSec);
      if (c.ratio > 0 && this.t >= (u.cautionOff || 0)) {
        let lim = B.ratio * (u.caution > this.t ? 0.85 : 1) * (1 + Gr.ratio * (g - 0.67)) * clamp(1 + X.softNeed * Sit.need + X.softEdge * Sit.edge, X.softLim[0], X.softLim[1]);
        if (c.near.length > c.mateIn.length + 1) lim *= S.retreat === 'brave' ? 0.8 : K.caution.outMul;
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
      const X = A().carry, N = u.sn, Sit = this.sit[u.team], zr = c.z.r || CONFIG.battle.map.core.deposit.r, Gr = A().grade, g = gOf(u), hi = g >= Gr.mustHi, lead = Math.max(0, -Sit.need);
      const foes0 = c.near.filter(e => dist(u, e) <= Math.max(28, (e.role.range || 6) + 8));
      if (!foes0.length && !c.reachers.length) { u.cdec = null; return null; }
      const go = { kind: 'deposit', z: c.z };
      const feas0 = c.tDep <= c.ttd * X.feas || !c.reachers.length, pReach = clamp(c.ttd / Math.max(0.2, c.tDep), 0, 1);
      const feasible = feas0 || (hi && c.val >= Gr.riskVal && pReach >= Gr.riskP), nearZ = c.dd <= zr + X.nearZone;
      const must = c.n >= X.must - (hi ? 1 : 0) || (c.n >= 2 && foes0.length >= X.mustFoes) || c.val >= X.mustVal - (hi ? 1 : 0) || (g >= 0.5 && lead >= Gr.leadNeed && c.val >= 2), calm = !c.reachers.length && g >= Gr.calmG && feasible;
      const pSafe = clamp(1 - X.routeW * c.route - X.zoneW * c.foesZ, 0.15, 1) * (feas0 ? 1 : clamp(c.ttd / Math.max(0.2, c.tDep), 0.2, 1));
      const Vd = c.val * pSafe * (1 + X.needDep * Math.max(0, Sit.need) + X.leadDep * Math.max(0, -Sit.need) + X.objDep * N.o) * (1 + Gr.dep * (g - 0.67)) / (1 + X.time * c.tDep);
      const tg = foes0.length ? lowestOf(foes0) : null;
      const pWin = 1 / (1 + Math.pow(Math.max(0.01, c.ratio) / X.pw, 2));
      const pKill = tg ? pWin * (0.55 + 0.45 * (1 - tg.hp / tg.maxHp)) : 0;
      const pDie = (1 - pWin) * clamp(X.dieTtd / Math.max(0.5, c.ttd), 0.15, 1);
      let Vf = pKill * (X.kill + (tg ? carried(tg) * X.killCarry : 0)) * (1 + X.gamble * Math.max(0, Sit.need) * half(N.c)) - pDie * (c.val * X.loss + X.death);
      Vf *= nearZ ? X.nearMul : clamp(0.5 + (c.dd - zr - X.nearZone) / (X.nearZone * 4), 0.5, 1);
      if (Sit.need < 0) Vf *= 1 + Sit.need * X.leadFight;
      Vf *= 1 - Gr.leadCut * g * lead;
      const margin = X.margin * (1 - X.marginJ * N.j);
      const help = c.mateIn.some(a => a.hp > a.maxHp * X.allyHp && (this.engagedAlly(a) || dist(a, u) <= X.allyR * 0.6));
      let d;
      if (must) d = feasible ? go : help ? { kind: 'fight' } : c.mateIn.length ? { kind: 'flee' } : go;
      else if (calm) d = go;
      else if (Vd > Vf + margin) d = go;
      else if (Vf > Vd + margin) d = { kind: 'fight' };
      else d = help ? { kind: 'fight' } : feasible ? go : c.mateIn.length ? { kind: 'flee' } : go;
      const prev = u.cdec;
      if (prev && this.t < prev.until && prev.kind !== d.kind && !must) d = prev.kind === 'deposit' ? go : { kind: prev.kind };
      else u.cdec = { kind: d.kind, until: this.t + ticks(X.hold) };
      return d;
    },

    decide(u, c) {
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

    layerGoal(u, team, us) {
      const P = this.tp[team], X = A(), own = this.coreSlots(u);
      if (P.chase && P.chase.ids.includes(u.id) && P.chase.e.alive) return { type: 'hunt', e: P.chase.e, since: u.goal && u.goal.type === 'hunt' && u.goal.e === P.chase.e ? u.goal.since : this.t };
      if (own <= 1 && this.follows(u)) {
        const S = this.sit[team], r = X.escort.r + X.escort.rT * half(S.t);
        const cs = us.filter(a => a !== u && this.coreValue(a) >= X.escort.val && this.foesOf(team).some(e => dist(e, a) <= r));
        if (cs.length) return { type: 'escort', a: cs.reduce((p, q) => (this.coreValue(p) >= this.coreValue(q) ? p : q)), since: this.t };
      }
      if (P.engage && P.focus && P.focus.e.alive && own < 2 && u.hp > u.maxHp * 0.35 && this.follows(u) && this.huntEV(u, P.focus.e).p >= GR().hunt.engageP) return { type: 'hunt', e: P.focus.e, since: u.goal && u.goal.type === 'hunt' && u.goal.e === P.focus.e ? u.goal.since : this.t };
      return null;
    },
    huntEV(u, e) {
      const H = GR().hunt, g = gOf(u), Dg = CONFIG.battle.map.core.danger;
      let fp = this.power(e), mp = this.power(u);
      for (const o of this.units) {
        if (!o.alive || o.struct || o === u || o === e || o.team === 2) continue;
        if (o.team === u.team) { if (dist(o, e) <= H.mateR) mp += this.power(o); }
        else if (!this.hidden(o) && dist(o, e) <= H.foeR) fp += this.power(o);
      }
      const r = Math.max(0.05, mp / Math.max(0.05, fp)) * (1 + (Math.random() - 0.5) * H.noise * (1 - g));
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
      if (SB === 'yield') { v *= 0.3; cap = 1; }
      else if (SB === 'steal') { v *= hitting && hpR < AB.stealHp ? 2.2 : 0.1; stage = 1.5; }
      else {
        if (SB === 'contest') { v *= 1.25; cap = dn === 'boss' ? 3 : clamp(Math.ceil(BL / 2.5), 1, 3); }
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
      if (Sb.j > 0.2 && SB !== 'yield' && hitting) v *= 1.2;
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
      const dec = this.decide(u, c), lock = !!dec && (dec.kind === 'deposit' || dec.kind === 'flee');
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
      if (!(dec && dec.kind === 'fight')) {
        if (this.grabNear(u, enemies)) return;
        if (this.dgStep(u, enemies, allies, aggro)) return;
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
