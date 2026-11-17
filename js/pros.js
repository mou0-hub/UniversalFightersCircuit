/* pros.js — 프로게이머 데이터: 등급(C~S) · 선호 역할군/캐릭터/플레이 · 멘탈/트러블/태업 · 연봉/계약
   G.pros = { seq, by: { id: pro } } 에 모든 선수(내 선수단·시장·AI 팀)가 들어 있습니다.
   국적: 리그별 leagueMix 비율로 현지/외국인 혼합 (실제 LoL 프로씬처럼). */

const Pros = (() => {
  const P = () => CONFIG.pro;
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const state = G => (G.pros = G.pros || { seq: 0, by: {} });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const get = (G, id) => { const p = state(G).by[id]; if (p && (p.pot == null || !p.arc)) ensurePot(p); return p; };
  const fighterPool = role => CONFIG.fighterOrder.filter(f => CONFIG.fighters[f] && !CONFIG.fighters[f].boss && (!role || CONFIG.fighters[f].role === role));
  const round10 = n => Math.round(n / 10) * 10;

  function pickNation(lgId) {
    const N = P().names;
    const mix = (N.leagueMix && N.leagueMix[lgId]) || (N.leagueMix && N.leagueMix.kr) || { kr: 1 };
    let r = Math.random(), acc = 0;
    for (const [nat, w] of Object.entries(mix)) {
      acc += w;
      if (r < acc) return nat;
    }
    return Object.keys(mix)[0] || 'kr';
  }

  function nationPool(nat) {
    const N = P().names;
    const local = (N.nation && N.nation[nat]) || (N.nation && N.nation.kr) || {};
    const glob = N.globalNick || N.nick || [], nick = [...(local.nick || []), ...(nat === 'kr' ? glob : glob.filter(n => !/[가-힣]/.test(n)))];
    return {
      nick: nick.length ? nick : ['Pro'],
      sur: local.sur || N.sur || ['Kim'],
      given: local.given || N.given || ['Min'],
      tail: N.tail || ['Jr', 'X', '7', '99'],
      noSpace: nat === 'jp' || nat === 'cn' || nat === 'kr'
    };
  }

  function nickname(G, nat) {
    const pool = nationPool(nat);
    const used = new Set(Object.values(state(G).by).map(p => p.nick));
    for (let i = 0; i < 50; i++) {
      const n = pick(pool.nick) + (Math.random() < 0.22 ? pick(pool.tail) : '');
      if (!used.has(n)) return n;
    }
    return pick(pool.nick) + rnd(2, 99);
  }

  function realName(nat) {
    const pool = nationPool(nat);
    const sep = pool.noSpace ? '' : ' ';
    return pick(pool.sur) + sep + pick(pool.given);
  }

  /* ---------- 세부 능력치 ---------- */
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const seeded = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  /* 선수 id·닉네임·능력치로 시드를 고정해, 구버전 세이브 선수도 항상 같은 값이 나오고 한 번 만들면 p.sk 에 저장됩니다 */
  function skills(p) {
    if (p.sk) return p.sk;
    const R = seeded(hash(p.id + '|' + p.nick + '|' + p.ovr)), ri = (a, b) => a + Math.floor(R() * (b - a + 1)), cl = v => Math.max(15, Math.min(99, v));
    const ids = P().skills.map(s => s.id), cfg = P().rarity, sk = {};
    if (R() < ((P().skillGen.perfectChance || {})[p.grade] || 0)) {
      ids.forEach(id => { sk[id] = cl(Math.max(cfg.perfectMin, p.ovr + ri(-1, 3))); });          // 완벽한 재능: 약점이 없음
    } else {
      const order = ids.slice().sort(() => R() - 0.5);
      ids.forEach(id => {
        let v = p.ovr + ri(-4, 4);
        if (order.indexOf(id) < 2) v += ri(4, 10);                  // 강점 2개
        else if (order.indexOf(id) < 4) v -= ri(6, 16);             // 약점 2개
        sk[id] = cl(v);
      });
      if (R() < (P().skillGen.specialistChance || 0)) {             // 특화 재능: 등급이 낮아도 한 분야만큼은 돋보이는 선수
        const id = ids[ri(0, ids.length - 1)]; sk[id] = cl(Math.max(sk[id], p.ovr + ri(18, 30)));
      }
      const low = ids.reduce((m, id) => (sk[id] < sk[m] ? id : m), ids[0]);
      if (sk[low] >= cfg.perfectMin) sk[low] = ri(cfg.perfectMin - 8, cfg.perfectMin - 1);   // 일반 선수는 완벽 등급이 되지 않도록
    }
    p.sk = sk; return sk;
  }
  /* 세부 능력치가 없는 선수(국제대회 팀 등)는 등급 평균값을 씁니다 */
  function typical(grade) {
    const g = P().grades[grade] || P().grades.A, v = Math.round((g.ovr[0] + g.ovr[1]) / 2), sk = {};
    P().skills.forEach(s => { sk[s.id] = v; }); return sk;
  }
  function engage(p) {
    const sk = skills(p), vals = Object.values(sk), avg = vals.reduce((s, x) => s + x, 0) / vals.length; let best = null, bs = -1e9;
    P().engage.forEach(e => { const sc = Object.entries(e.w).reduce((s, [k, w]) => s + ((sk[k] || 0) - avg) * w, 0); if (sc > bs) { bs = sc; best = e; } });
    return best;
  }
  function rarity(p) {
    const sk = skills(p), v = Object.values(sk), cfg = P().rarity, avg = v.reduce((s, x) => s + x, 0) / v.length;
    if (Math.min(...v) >= cfg.perfectMin) return { id: 'perfect', name: '완벽한 재능', icon: '✨' };
    if (avg >= cfg.aceAvg) return { id: 'ace', name: '에이스', icon: '👑' };
    return null;
  }

  /* ---------- 잠재력 / 성장 ---------- */
  function pickArc(R) {
    const arcs = P().arcs, tot = arcs.reduce((t, a) => t + a.w, 0); let r = R() * tot;
    for (const a of arcs) { r -= a.w; if (r <= 0) return a; }
    return arcs[0];
  }
  const arcOf = p => P().arcs.find(a => a.id === p.arc) || P().arcs[0];
  function ensureArc(p) {
    if (p.arc) return;
    const R = seeded(hash(p.id + '|arc|' + p.nick)); p.arc = pickArc(R).id; p.shx = Math.floor(R() * 5) - 2;
  }
  function potFor(ovr, age, R, arc) {
    const cfg = P().potential, row = cfg.gap.find(a => age <= a[0]) || cfg.gap[cfg.gap.length - 1], lo = row[1][0], hi = row[1][1];
    let gap = lo + Math.floor(R() * (hi - lo + 1)); gap = Math.round(gap * (arc ? arc.potMul : 1));
    if (R() < cfg.gemChance) gap = Math.round(gap * cfg.gemMul);
    return Math.min(cfg.cap, Math.max(ovr, ovr + gap));
  }
  function ensurePot(p) {
    ensureArc(p);
    if (p.pot != null && p.pot >= p.ovr) return p.pot;
    p.pot = potFor(p.ovr, p.age || 24, seeded(hash(p.id + '|pot|' + p.ovr)), arcOf(p));
    return p.pot;
  }
  const premium = p => Math.min(P().potential.premiumMax, Math.max(0, (p.pot || p.ovr) - p.ovr) * P().potential.premium);
  function marketSalary(p) {
    const gr = P().grades[p.grade], t = clamp((p.ovr - gr.ovr[0]) / Math.max(1, gr.ovr[1] - gr.ovr[0]), 0, 1);
    return round10((gr.salary[0] + (gr.salary[1] - gr.salary[0]) * (0.75 * t + 0.125)) * (1 + premium(p)));
  }
  function develop(G, p, ctx = {}) {
    ensurePot(p); skills(p);
    const D = P().growth, share = ctx.share == null ? 0.5 : ctx.share, from = p.ovr, oldGrade = p.grade;
    const arc = arcOf(p), eff = p.age - arc.shift - (p.shx || 0);
    const range = (D.age.find(a => eff <= a[0]) || D.age[D.age.length - 1])[1];
    let d = range[0] + Math.random() * (range[1] - range[0]), note = '';
    if (d > 0) d *= arc.up; else d *= arc.down;
    if (arc.vol) d += (Math.random() * 2 - 1) * arc.vol;
    for (const sp of arc.spikes) {
      if (p.age >= sp.ages[0] && p.age <= sp.ages[1] && Math.random() < sp.chance) {
        const jump = sp.d[0] + Math.random() * (sp.d[1] - sp.d[0]); d += jump;
        if (jump > 0) { p.pot = Math.min(99, Math.max(p.pot, Math.round(p.ovr + d))); note = '폭발적 성장!'; } else note = '급격한 하락';
        break;
      }
    }
    if (d > 0) {
      d *= share >= D.playHi ? D.playHiMul : share < D.playLo ? D.playLoMul : 1;
      if (ctx.rank && ctx.rank <= D.rankTop) d *= D.rankTopMul; else if (ctx.rank && ctx.rank >= D.rankLow) d *= D.rankLowMul;
      if (p.mental >= D.mentalHi) d *= D.mentalHiMul;
    } else if (share < D.playLo && eff >= 30) d -= 0.5;
    const fl = Math.floor(d); d = fl + (Math.random() < d - fl ? 1 : 0);
    let to = p.ovr + d; if (d > 0) to = Math.min(to, p.pot); to = clamp(to, 20, 99);
    d = to - p.ovr; p.ovr = to; p.dev = d;
    if (d !== 0) { const sk = p.sk; Object.keys(sk).forEach(id => { sk[id] = clamp(sk[id] + d + (Math.random() < 0.4 ? rnd(-1, 1) : 0), 15, 99); }); }
    p.sn = (p.sn || 0) + 1;
    p.pot = Math.max(p.ovr, eff >= 27 ? p.pot - 1 : p.pot);
    let promoted = false;
    const order = ['C', 'B', 'A', 'S'], nx = order[order.indexOf(p.grade) + 1];
    if (nx && p.ovr >= P().grades[nx].ovr[0] + D.promoteMargin && Math.random() < D.promoteChance) {
      p.grade = nx; p.salary = Math.max(p.salary, P().grades[nx].salary[0]); promoted = true;
    }
    return { id: p.id, nick: p.nick, age: p.age, from, to: p.ovr, d, pot: p.pot, grade: p.grade, oldGrade, promoted, note };
  }

  function gen(G, grade, opts = {}) {
    const st = state(G), gr = P().grades[grade], id = 'p' + (++st.seq);
    const lgId = opts.lg || G.leagueId || 'kr';
    const nat = opts.nation || pickNation(lgId);
    const role = opts.role || pick(Object.keys(CONFIG.roles)), pool = fighterPool(role);
    const favs = shuffle(pool.slice()).slice(0, 2); const other = pick(fighterPool().filter(f => !favs.includes(f))); if (other) favs.push(other);
    const ovr = rnd(gr.ovr[0], gr.ovr[1]), t = (ovr - gr.ovr[0]) / Math.max(1, gr.ovr[1] - gr.ovr[0]);
    const troubleMaker = Math.random() < 0.14, slacker = Math.random() < 0.12;
    const age = opts.age || rnd(17, 30), arc = pickArc(Math.random), pot = potFor(ovr, age, Math.random, arc);
    const pro = {
      id, nick: nickname(G, nat), real: realName(nat), nation: nat,
      age, grade, ovr, pot, arc: arc.id, shx: rnd(-2, 2), sn: 0,
      role, favs, style: pick(P().styles).id,
      mental: rnd(62, 95), form: rnd(48, 68), trouble: troubleMaker ? rnd(60, 92) : rnd(0, 34), slack: slacker ? rnd(60, 92) : rnd(0, 34),
      salary: round10((gr.salary[0] + (gr.salary[1] - gr.salary[0]) * (0.75 * t + 0.25 * Math.random())) * (1 + Math.min(P().potential.premiumMax, (pot - ovr) * P().potential.premium))), years: rnd(P().contract[0], P().contract[1]),
      team: null, listed: false, fee: 0, games: 0, wins: 0, sg: 0, sw: 0, tn: 0
    };
    skills(pro); st.by[id] = pro; return pro;
  }
  const remove = (G, id) => { delete state(G).by[id]; };
  const grade = (G, id) => { const p = get(G, id); return p ? p.grade : CONFIG.brain.default; };

  function mixGrade(level) {
    const mix = P().aiMix[level] || P().aiMix.normal;
    let r = Math.random(), acc = 0;
    for (const g of ['C', 'B', 'A', 'S']) { acc += mix[g] || 0; if (r < acc) return g; }
    return 'B';
  }
  function startGrade(level) {
    const mix = (CONFIG.club.startMix || {})[level] || CONFIG.club.startMix.normal;
    let r = Math.random(), acc = 0;
    for (const g of ['C', 'B', 'A', 'S']) { acc += mix[g] || 0; if (r < acc) return g; }
    return 'C';
  }
  const mixBrains = level => [mixGrade(level), mixGrade(level), mixGrade(level)];

  function genTeam(G, level, lgId) {
    const lg = lgId || G.leagueId || 'kr', cap = (P().names.foreignMax || {})[lg];
    let foreign = 0;
    return [0, 1, 2].map(() => {
      let nation = pickNation(lg);
      if (nation !== lg) { if (cap != null && foreign >= cap) nation = lg; else foreign++; }
      return gen(G, mixGrade(level), { lg, nation }).id;
    });
  }

  function purge(G) {
    const keep = new Set();
    (G.club ? G.club.roster : []).forEach(id => keep.add(id));
    if (G.club) { (G.club.leavers || []).forEach(l => keep.add(l.id)); (G.club.pool || []).forEach(id => keep.add(id)); }
    ((G.market && G.market.fa) || []).forEach(id => keep.add(id));
    if (G.league) G.league.teams.forEach(t => (t.pros || []).forEach(id => keep.add(id)));
    Object.values(G.ext || {}).forEach(t => (t.pros || []).forEach(id => keep.add(id)));
    const by = state(G).by; Object.keys(by).forEach(id => { if (!keep.has(id)) delete by[id]; });
  }

  const roleName = r => (CONFIG.roles[r] ? CONFIG.roles[r].name : r);
  const styleName = s => { const x = P().styles.find(v => v.id === s); return x ? x.name : s; };
  const money = n => Math.round(n).toLocaleString('ko-KR') + ' ' + CONFIG.club.currency;
  const nationName = n => ({ kr: '한국', jp: '일본', cn: '중국', sea: '동남아', na: '북미', eu: '유럽' }[n] || n);

  return { arcOf, ensurePot, develop, marketSalary, startGrade, skills, typical, engage, rarity, state, get, gen, remove, grade, genTeam, mixBrains, mixGrade, purge, roleName, styleName, money, nationName, shuffle, rnd, pick };
})();
