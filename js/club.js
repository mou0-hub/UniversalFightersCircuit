/* club.js — 구단 관리: 자금 · 선수단 · 라인업(1/2/3번) · 시즌 정산(구단주 지급 − 연봉) + 화면에서 쓰는 액션 */

const Club = (() => {
  const C = () => CONFIG.club;


  /* ---------- 팬 · 티켓 수입 ---------- */
  const FN = () => CONFIG.fans;
  const diffOf = G => G.difficulty || (League.lgOf(G) && League.lgOf(G).diff) || 'normal';
  const repOf = G => (G.rep && typeof G.rep.v === 'number') ? G.rep.v : 50;
  const stadium = G => FN().stadium[diffOf(G)] || FN().stadium.normal;
  const fanMax = G => Math.round(stadium(G) * (1 + repOf(G) / FN().repCapDiv));
  const fanStart = G => Math.round((FN().start[Scout.teamTier(G.leagueId, G.baseTeam) - 1] || FN().start[2]) * (FN().leagueMul[diffOf(G)] || 1));
  const rand = (a, b) => a + Math.random() * (b - a);
  const newTix = G => ({ season: G.season || 1, reg: 0, all: 0, games: 0, regGames: 0, viewers: 0, cap: 0, last: null });
  function clampFans(G) {
    const c = G.club, hi = fanMax(G), lo = Math.min(hi, Math.max(FN().floor, Math.round((c.fanPeak || 0) * FN().floorPeak)));
    c.fans = clamp(Math.round(c.fans), lo, hi); c.fanPeak = Math.max(c.fanPeak || 0, c.fans);
  }
  function moveFans(G, d) { const c = G.club, b = c.fans; c.fans = b + d; clampFans(G); return c.fans - b; }
  function ensureFans(G) {
    const c = G.club; if (!c) return;
    if (c.fans == null) { c.fans = Math.round(fanStart(G) * (0.8 + repOf(G) / 100 * 0.8)); c.fanPeak = c.fans; }
    if (c.fanPeak == null) c.fanPeak = c.fans;
    if (!Array.isArray(c.recent)) c.recent = [];
    if (!c.tix) c.tix = newTix(G);
    if (c.fansStart == null) c.fansStart = c.fans;
    if (c.lossStreak == null) c.lossStreak = 0;
    clampFans(G);
  }
  const recentRate = c => { const r = (c.recent || []).slice(-FN().mob.recent); return r.length ? r.reduce((t, x) => t + x, 0) / r.length : 0.5; };
  function ticketFor(G, kind) {
    const F = FN(), c = G.club, cap = stadium(G), mob = F.mob.base + F.mob.form * recentRate(c);
    const viewers = Math.round(Math.min(cap, c.fans * mob));
    return { viewers, cap, income: round10(round10(viewers / 100 * (F.unit[diffOf(G)] || 1)) * (F.kindMul[kind] || 1) * (1 + Facility.fx(G).tix)) };
  }
  function fanPct(G, o) {
    const F = FN(), c = G.club; let pct = 0;
    if (o.draw) pct = rand(F.draw.min, F.draw.max);
    else if (o.won) {
      pct = o.kind === 'league' ? rand(F.win.min, F.win.max) : rand(F.tour.min, F.tour.max);
      if (o.oppRank > 0 && o.myRank > 0 && o.oppRank < o.myRank) pct += F.win.upset;
      if ((G.streak || 0) >= F.win.streakAt) pct += F.win.streak;
    } else if (Math.random() >= F.loss.none) {
      pct = -rand(F.loss.min, F.loss.max);
      if ((c.lossStreak || 0) >= F.loss.streakAt) pct = -Math.min(F.loss.cap, -pct * F.loss.streakMul);
    }
    return pct;
  }
  /* 경기 직후: 티켓 수입 입금 + 팬 증감. o = { kind, home, won(경기 단위), draw, myRank, oppRank } */
  function afterMatch(G, o) {
    ensureFans(G); const c = G.club, F = FN();
    c.recent = [...c.recent, o.draw ? 0.5 : o.won ? 1 : 0].slice(-F.mob.recent);
    c.lossStreak = !o.won && !o.draw ? (c.lossStreak || 0) + 1 : 0;
    let ticket = null;
    if (o.home) {
      ticket = ticketFor(G, o.kind); c.funds += ticket.income; ticket.extra = Facility.matchIncome(G, ticket); c.funds += ticket.extra; c.facInc = (c.facInc || 0) + ticket.extra;
      const t = c.tix; t.all += ticket.income; t.games++; t.viewers += ticket.viewers; t.cap += ticket.cap; t.last = ticket.income;
      if (o.kind === 'league') { t.reg += ticket.income; t.regGames++; }
    }
    const fp = fanPct(G, o), before = c.fans, pct = fp > 0 ? fp * (1 + Facility.fx(G).fan) : fp;
    let d = Math.round(before * pct); if (pct !== 0 && Math.abs(d) < F.minDelta) d = Math.sign(pct) * F.minDelta;
    d = moveFans(G, d); c.fanLast = d;
    return { ticket, fans: { d, pct: before ? d / before : 0, after: c.fans } };
  }
  function fanTitle(G, key) {
    ensureFans(G); const c = G.club, before = c.fans, pct = FN().title[key] || 0;
    const d = moveFans(G, Math.round(before * pct)); c.fanLast = d;
    return { d, pct: before ? d / before : 0, after: c.fans };
  }
  function fanSeason(G) {
    ensureFans(G); const F = FN(), c = G.club, rank = League.rankOf(G, 'player'), n = G.league.teams.length; let pct = 0;
    if (rank > n - F.season.bottom) pct = F.season.bottomPct; else if (rank <= F.season.top) pct = F.season.topPct;
    const before = c.fans, d = pct ? moveFans(G, Math.round(before * pct)) : 0; c.fanLast = d;
    return { d, pct: before ? d / before : 0, after: c.fans, rank };
  }
  function fanInfo(G) {
    ensureFans(G); const c = G.club, t = c.tix;
    return { fans: c.fans, max: fanMax(G), peak: c.fanPeak, last: c.fanLast || 0, seasonGain: c.fans - (c.fansStart || c.fans), tix: t.all, tixReg: t.reg, games: t.games, avg: t.games ? Math.round(t.all / t.games) : 0, fill: t.cap ? t.viewers / t.cap : 0, stadium: stadium(G) };
  }

  /* 새 커리어: 구단 자금 + 리그 난이도에 맞는 기본 선수단 5명 지급 (G.league 이전에 호출)
     등급은 AI와 같은 aiMix를 쓰고, 시작/지급 크레딧이 리그 수준에 맞게 책정되어 있음 */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round10 = n => Math.round(n / 10) * 10;
  const capOfDiff = d => (C().cap || {})[d] || C().cap.normal;
  const KR = () => C().capRule;
  /* 캡 반영 연봉: 한 구단에서 오래 뛴 선수(p.tn 시즌)일수록 감면. sal 을 주면 그 연봉 기준으로 계산(재계약 예상용) */
  const capSal = (p, sal) => { const T = KR().tenure || {}; return round10((sal == null ? p.salary : sal) * (1 - Math.min(T.max == null ? 0.4 : T.max, (p.tn || 0) * (T.perSeason == null ? 0.08 : T.perSeason)))); };
  const capBase = G => capOfDiff(diffOf(G));
  function nextCap(G) {
    const ord = C().promotion.order, base = capBase(G);
    for (let i = ord.indexOf(G.leagueId) + 1; i > 0 && i < ord.length; i++) { const lg = CONFIG.leagues.find(l => l.id === ord[i]); if (lg && capOfDiff(lg.diff) > base) return capOfDiff(lg.diff); }
    return Infinity;
  }
  const capMaxGrow = G => { const nx = nextCap(G); return nx === Infinity ? KR().maxGrow : Math.max(0, Math.min(KR().maxGrow, nx * KR().nextRatio / capBase(G) - 1)); };
  const capGrow = G => Math.min((G.club && G.club.capGrow) || 0, capMaxGrow(G));
  const cap = G => round10(capBase(G) * (1 + capGrow(G)));
  const hardCap = G => round10(cap(G) * (1 + KR().hardOver));
  const capFloor = G => round10(cap(G) * KR().floor);
  const capLeft = G => cap(G) - payroll(G);
  const taxOf = (G, pay) => round10(Math.max(0, pay - cap(G)) * KR().tax);
  function capInfo(G) {
    const c = G.club, pay = payroll(G), cp = cap(G), avg = c.pN ? c.pSum / c.pN : pay;
    return { cap: cp, base: capBase(G), grow: capGrow(G), maxGrow: capMaxGrow(G), hard: hardCap(G), floor: capFloor(G), pay, left: cp - pay, avg, taxNow: taxOf(G, pay), atMax: capGrow(G) >= capMaxGrow(G) - 1e-9 };
  }
  /* 시즌 정산 때 캡 성장: 기본 + 순위·우승 + 수입(경상 수입 / 기준) → 상한 maxStep, 총 성장은 maxGrow·다음 단계 캡 × nextRatio 이하 */
  function capSeason(G, rec, rank) {
    const K = KR(), S = K.step, o = C().owner, mul = o.leagueMul[League.lgOf(G).diff] || 1, ref = (o.base + (o.rank[3] || 0)) * mul * K.refUp, c = G.club;
    let step = S.base; if (rank >= 1 && rank <= S.topRank) step += S.top;
    [['playoff', S.league], ['msi', S.msi], ['worlds', S.worlds]].forEach(([k, v]) => { if (G[k] && G[k].champion === 'player') step += v; });
    step = clamp(step + clamp((ref ? rec / ref : 1) - 1, -1, 1) * K.revW, 0, K.maxStep);
    const from = cap(G), mx = capMaxGrow(G), g0 = Math.min(c.capGrow || 0, mx), g1 = Math.min(mx, g0 + step);
    c.capGrow = g1; return { from, to: cap(G), step: g1 - g0, atMax: g1 >= mx - 1e-9 };
  }
  /* 자기 선수 재계약: 소프트캡 초과를 하드캡까지 허용(사치세 부과) */
  function renewRoom(G, add, minus) {
    const after = payroll(G) - (minus || 0) + add, cp = cap(G), hard = hardCap(G);
    return { after, ok: after <= hard, over: after > cp, tax: taxOf(G, after), hard, cap: cp };
  }

  /* 새 커리어: opts.carry = 승계 선수(이전 구단 객체), opts.pool = 미승계 선수(FA 풀로 환원), opts.carryFee, opts.keepFunds */
  function init(G, opts = {}) {
    G.pros = { seq: 0, by: {} }; G.market = { fa: [], round: -99 };
    const funds = (C().startFunds[G.difficulty] || C().startFunds.normal) + (opts.keepFunds || 0) - (opts.carryFee || 0);
    G.club = { funds, fans: 0, fanPeak: 0, recent: [], lossStreak: 0, roster: [], lineup: [null, null, null], finance: null, sponsorEarned: 0, sponsorCD: 0, pendingSponsor: null, ownerGoal: null, sg: 0, sgSeason: null, leavers: [], pool: [], capGrow: 0, sIn: 0, pSum: 0, pN: 0 };
    const level = G.difficulty || 'normal', lgId = G.leagueId || 'kr', by = G.pros.by;
    const copy = (src, team) => { const p = JSON.parse(JSON.stringify(src)); p.id = 'p' + (++G.pros.seq); p.team = team; p.sg = 0; p.sw = 0; p.tn = 0; p.refused = null; p.listed = false; p.fee = 0; by[p.id] = p; return p; };
    const carried = (opts.carry || []).map(src => copy(src, 'player'));
    (opts.pool || []).forEach(src => { const p = copy(src, null); G.club.pool.push(p.id); });
    const starters = [], limit = cap(G);
    let pay = carried.reduce((t, p) => t + p.salary, 0);
    for (let i = 0; i < Math.max(0, C().startSize - carried.length); i++) {
      let p = Pros.gen(G, Pros.startGrade(level), { lg: lgId });
      if (pay + p.salary > limit) { Pros.remove(G, p.id); p = Pros.gen(G, 'C', { lg: lgId }); }
      if (pay + p.salary > limit) { Pros.remove(G, p.id); continue; }
      p.team = 'player'; pay += p.salary; starters.push(p);
    }
    const all = [...carried, ...starters].sort((a, b) => b.ovr - a.ovr);
    G.club.roster = all.map(p => p.id);
    G.club.lineup = [0, 1, 2].map(i => (all[i] ? all[i].id : null));
    ensureRoster(G);
    G.club.fans = Math.round(fanStart(G) * (1 + (opts.moved ? FN().carryRep * repOf(G) / 100 : 0))); G.club.fanPeak = G.club.fans; G.club.fansStart = G.club.fans; G.club.tix = newTix(G);
    clampFans(G);
  }

  /* 시즌 시작마다: 리그 AI 팀 선수 배정 + 시장 갱신 */
  function seasonSetup(G) {
    const lg = League.lgOf(G);
    G.league.teams.forEach(t => {
      if (t.isPlayer) return;
      const teamLg = t.lg || lg.id;
      t.pros = Pros.genTeam(G, t.level || lg.diff, teamLg);
      t.pros.forEach(id => {
        const p = Pros.get(G, id); p.team = t.id;
        /* 시즌마다 폼·멘탈 재배치 (완전 랜덤에 가깝게 흔들림) */
        p.form = 35 + Math.floor(Math.random() * 50);
        p.mental = 50 + Math.floor(Math.random() * 45);
      });
    });
    /* 지난 시즌 이적을 선택한 내 선수들은 해당 AI 팀의 가장 약한 선수 자리를 대체합니다 */
    (G.club.leavers || []).forEach(l => {
      const p = Pros.get(G, l.id), t = G.league.teams.find(x => x.id === l.tid && !x.isPlayer); if (!p || !t || !t.pros || !t.pros.length) return;
      let wi = 0; t.pros.forEach((id, i) => { if (Pros.get(G, id).ovr < Pros.get(G, t.pros[wi]).ovr) wi = i; });
      Pros.remove(G, t.pros[wi]); t.pros[wi] = p.id; p.team = t.id; p.listed = false;
    });
    G.club.leavers = [];
    if (G.club.sgSeason !== G.season) { G.club.sg = 0; G.club.pSum = 0; G.club.pN = 0; G.club.sgSeason = G.season; roster(G).forEach(p => { p.sg = 0; p.sw = 0; p.moodAdj = 0; }); }
    Pros.purge(G); Market.refresh(G, true);
    /* 승계하지 못한 선수는 FA 풀로 환원 */
    (G.club.pool || []).forEach(id => { const p = Pros.get(G, id); if (p) { p.team = null; p.years = Pros.rnd(1, 2); Market.ensure(G).fa.push(id); } });
    G.club.pool = [];
    ensureRoster(G);
    if (!G.club.ownerGoal || G.club.ownerGoal.season !== G.season) assignGoal(G);
    ensureFans(G);
    if (G.club.tix.season !== G.season) { G.club.tix = newTix(G); G.club.fansStart = G.club.fans; }
  }

  /* 구버전 세이브 보정 */
  function migrate(G) {
    if (!G.club) { G.pros = G.pros || { seq: 0, by: {} }; G.market = G.market || { fa: [], round: -99 }; G.club = { funds: C().startFunds[G.difficulty] || C().startFunds.normal, roster: [], lineup: [null, null, null], finance: null }; }
    if (G.pros && G.club.roster && G.club.lineup) ensureRoster(G);
    if (G.league) ensureFans(G);
    if (G.club.ownerGoal === undefined) G.club.ownerGoal = null;
    if (G.club.sponsorEarned == null) G.club.sponsorEarned = 0;
    if (G.club.sg == null) G.club.sg = 0;
    if (G.club.capGrow == null) G.club.capGrow = 0;
    if (G.club.sIn == null) G.club.sIn = 0;
    if (G.club.pN == null) { G.club.pSum = 0; G.club.pN = 0; }
    if (!G.club.leavers) G.club.leavers = [];
    if (!G.club.pool) G.club.pool = [];
    if (G.pros) Object.values(G.pros.by).forEach(p => { Pros.ensurePot(p); if (p.sg == null) { p.sg = 0; p.sw = 0; } if (p.tn == null) p.tn = 0; });
    if (G.league && G.league.teams.some(t => !t.isPlayer && !t.pros)) seasonSetup(G);
    // 구버전 세이브: 시즌 중인데 목표가 없으면 즉시 배정
    if (!G.club.ownerGoal && G.phase === 'season' && G.league) {
      try { assignGoal(G); } catch (e) { /* 함수 정의 전 로드 순서 대비 */ }
    }
  }

  const roster = G => G.club.roster.map(id => Pros.get(G, id)).filter(Boolean);
  const lineup = G => G.club.lineup.map(id => (id ? Pros.get(G, id) : null));
  const ready = G => !!G.club && G.club.lineup.every(id => id && G.club.roster.includes(id));
  const brains = G => G.club.lineup.map(id => Pros.grade(G, id));
  const moods = G => G.club.lineup.map(id => {
    const p = Pros.get(G, id);
    if (!p) return { form: 55, mental: 70, trouble: 0, slack: 0 };
    if (typeof News !== 'undefined' && News.ensureProMood) News.ensureProMood(p);
    const fv = Facility.eff(G, p);
    return { form: fv.form, mental: fv.mental, trouble: fv.trouble, slack: p.slack ?? 0, nick: p.nick, sk: fv.sk };
  });
  /* 셀러리캡 대상 연봉 = 선발(라인업) 3명의 캡 반영 연봉 합. 실제 지급 연봉(벤치 포함 전원)은 wage */
  const payroll = G => lineup(G).filter(Boolean).reduce((s, p) => s + capSal(p), 0);
  const wage = G => roster(G).reduce((s, p) => s + p.salary, 0);

  function setSlot(G, id, slot) {
    if (!G.club.roster.includes(id)) return { ok: false, msg: '선수단에 없는 선수입니다.' };
    const lu = G.club.lineup.map(x => (x === id ? null : x)); lu[slot] = id;
    const after = lu.reduce((s, x) => { const p = x && Pros.get(G, x); return s + (p ? capSal(p) : 0); }, 0), before = payroll(G);
    if (after > cap(G) && after > before) return { ok: false, msg: `셀러리캡 초과로 선발에 넣을 수 없습니다. (선발 연봉 합 ${Pros.money(after)} / 상한 ${Pros.money(cap(G))})` };
    G.club.lineup = lu; return { ok: true };
  }
  function clearSlot(G, slot) { G.club.lineup[slot] = null; }
  function autoFill(G) {
    const free = roster(G).filter(p => !G.club.lineup.includes(p.id)).sort((a, b) => b.ovr - a.ovr), lu = G.club.lineup.slice();
    for (let i = 0; i < lu.length; i++) {
      if (lu[i] || !free.length) continue;
      const pay = lu.reduce((s, x) => { const p = x && Pros.get(G, x); return s + (p ? capSal(p) : 0); }, 0);
      let k = free.findIndex(p => pay + capSal(p) <= cap(G));                 // 캡 안에서 능력이 가장 높은 선수
      if (k < 0) k = free.reduce((m, p, j) => (capSal(p) < capSal(free[m]) ? j : m), 0);   // 맞는 선수가 없으면 가장 싼 선수(경기 불능 방지)
      lu[i] = free.splice(k, 1)[0].id;
    }
    G.club.lineup = lu;
  }

  /* 안전장치: 선수단이 3명 미만이면(계약 만료 + 자금 부족 등) 무료 C급 신인을 보충해 경기 불능을 막습니다 */
  function ensureRoster(G) {
    const made = [];
    while (G.club.roster.length < 3) {
      const p = Pros.gen(G, 'C', { lg: G.leagueId || 'kr' });
      p.team = 'player'; p.years = 1; G.club.roster.push(p.id); made.push(p);
    }
    G.club.lineup = G.club.lineup.map(id => (id && G.club.roster.includes(id) ? id : null));
    autoFill(G);
    return made;
  }

  /* ----- 선수 만족도 / 출전 기록 ----- */
  function trackGame(G, won) {
    if (!G.club) return;
    G.club.sg = (G.club.sg || 0) + 1; G.club.pSum = (G.club.pSum || 0) + payroll(G); G.club.pN = (G.club.pN || 0) + 1;
    G.club.lineup.forEach(id => { const p = id && Pros.get(G, id); if (p) { p.sg = (p.sg || 0) + 1; if (won) p.sw = (p.sw || 0) + 1; } });
    const B = CONFIG.pro.morale;
    G.club.roster.forEach(id => { const p = !G.club.lineup.includes(id) && Pros.get(G, id); if (p && Math.random() < B.recover) p.moodAdj = Math.min(B.recoverMax, (p.moodAdj || 0) + B.recoverStep + Facility.fx(G).recover); });
  }
  function shareOf(G, p) {
    const tg = G.club.sg || 0;
    if (tg < 4) return G.club.lineup.includes(p.id) ? 0.75 : 0.3;
    return Math.min(1, (p.sg || 0) / tg);
  }
  function mood(G, p) {
    const B = CONFIG.pro.morale, n = CONFIG.league.teamCount || 12, rank = League.rankOf(G, 'player') || Math.ceil(n / 2);
    const fv = Facility.eff(G, p), share = shareOf(G, p), young = p.age <= 22 || (p.pot - p.ovr) >= 8, vet = p.age >= 27, star = p.grade === 'A' || p.grade === 'S';
    const parts = {
      play: Math.max((share - 0.5) * B.play * (young ? 1.35 : 1), -B.benchFloor),
      team: ((n + 1) / 2 - rank) / ((n - 1) / 2) * B.team * ((vet || star) ? 1.3 : 1),
      pay: clamp((p.salary / Math.max(1, Pros.marketSalary(p)) - 1) * B.pay, B.payMin, B.payMax) * (star ? 1.2 : 1),
      growth: clamp((p.dev || 0) * B.growth, -B.growthMax, B.growthMax),
      title: G.playoff && G.playoff.champion === 'player' ? B.title : 0,
      trait: (fv.trouble >= 60 ? -B.trouble : 0) + (fv.mental >= 85 ? 3 : 0),
      adj: p.moodAdj || 0
    };
    const score = clamp(Math.round(B.base + Object.values(parts).reduce((t, v) => t + v, 0)), 0, 100);
    const names = { play: '출전 기회 부족', team: '팀 성적 부진', pay: '연봉 대우 불만', growth: '성장 정체' };
    let why = '', low = 0; Object.keys(names).forEach(k => { if (parts[k] < low) { low = parts[k]; why = names[k]; } });
    return { score, parts, why: why || '전반적인 분위기', share };
  }
  function rivalOf(G, rank) {
    const all = League.sorted(G).filter(t => t.id !== 'player'), better = League.sorted(G).slice(0, Math.max(0, rank - 1)).filter(t => t.id !== 'player');
    const pool = better.length ? better : all.slice(0, 4); return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }
  function sendAway(G, p, rank) {
    const t = rivalOf(G, rank); if (!t) return null;
    G.club.roster = G.club.roster.filter(x => x !== p.id); G.club.lineup = G.club.lineup.map(x => (x === p.id ? null : x));
    p.team = t.id; (G.club.leavers = G.club.leavers || []).push({ id: p.id, tid: t.id });
    return League.name(G, t.id);
  }

  function ownerPay(G, rank) {
    const o = C().owner, mul = o.leagueMul[League.lgOf(G).diff] || 1;
    const rk = rank >= 1 && rank <= o.rank.length ? o.rank[rank - 1] : 0;
    const lines = [{ k: '구단주 기본 지급', v: Math.round(o.base * mul) }, { k: `정규시즌 ${rank}위 보너스`, v: Math.round(rk * mul) }];
    [['playoff', 'league', '리그 우승'], ['msi', 'msi', 'MSI 우승'], ['worlds', 'worlds', '월드 챔피언십 우승']].forEach(([key, tk, name]) => {
      if (G[key] && G[key].champion === 'player') lines.push({ k: `${name} 보너스`, v: Math.round(o.trophy[tk] * mul) });
    });
    /* 평판 보너스: 55↑ 소폭, 70↑ 본격, 85↑ 대형 */
    const rep = (G.rep && typeof G.rep.v === 'number') ? G.rep.v : 50;
    let repMul = 0, repLabel = '';
    if (rep >= 85) { repMul = 0.28; repLabel = '평판 최고 보너스'; }
    else if (rep >= 70) { repMul = 0.16; repLabel = '평판 우대 보너스'; }
    else if (rep >= 55) { repMul = 0.07; repLabel = '평판 소폭 보너스'; }
    if (repMul > 0) {
      const baseSum = lines.reduce((s, x) => s + x.v, 0);
      lines.push({ k: `${repLabel} (${rep})`, v: Math.round(baseSum * repMul) });
    }
    return lines;
  }

  function settle(G) {
    const rank = League.rankOf(G, 'player'), pay = ownerPay(G, rank).slice();
    const fs = fanSeason(G), fi = fanInfo(G), tix = G.club.tix, ticketSum = tix.all;
    const sponsorSum = G.club.sponsorEarned || 0;
    if (sponsorSum > 0) pay.push({ k: '시즌 스폰서·광고 수입', v: sponsorSum });
    if (ticketSum > 0) pay.push({ k: `시즌 티켓 수입 (${tix.games}경기)`, v: ticketSum });
    const facSum = G.club.facInc || 0; if (facSum > 0) pay.push({ k: '시즌 시설 부가 수입', v: facSum });
    const income = pay.reduce((s, x) => s + x.v, 0), cost = wage(G), capNow = cap(G), out = [], K = KR(), cc = G.club;
    const avgPay = cc.pN ? cc.pSum / cc.pN : payroll(G), tax = taxOf(G, avgPay), floorV = capFloor(G);
    const pen = (cc.sIn || 0) >= K.floorGrace && avgPay < floorV ? round10((floorV - avgPay) * K.floorPen) : 0;
    const before = G.club.funds, paid = sponsorSum + ticketSum + facSum;        // 스폰서·티켓은 이미 입금됨
    G.club.funds += (income - paid) - cost - tax - pen;
    const cs = capSeason(G, pay.filter(x => !/우승 보너스/.test(x.k)).reduce((s, x) => s + x.v, 0), rank); cc.sIn = (cc.sIn || 0) + 1;
    const B = CONFIG.pro.morale, ros = roster(G), left = [], expired = [];
    const growth = ros.map(p => Pros.develop(G, p, { share: shareOf(G, p), rank }));
    const mo = {}; ros.forEach(p => { mo[p.id] = mood(G, p); });
    ros.forEach(p => { p.years--; p.age++; p.tn = (p.tn || 0) + 1; });
    /* 이적 요구: 계약이 남았어도 대우가 나쁘면 더 좋은 팀으로 떠납니다 (이적 보상금 수령) */
    let asked = 0;
    ros.filter(p => p.years > 0 && mo[p.id].score < B.demandBelow).sort((a, b) => mo[a.id].score - mo[b.id].score).forEach(p => {
      if (asked >= B.demandMax || Math.random() >= B.demandChance) return;
      const to = sendAway(G, p, rank); if (!to) return;
      const fee = round10(p.salary * B.demandFeeMul); G.club.funds += fee; asked++;
      left.push({ nick: p.nick, to, why: mo[p.id].why, fee, kind: 'demand' });
    });
    /* 계약 만료: 불만족·재계약 거부 선수는 다른 팀으로, 나머지는 FA 시장으로 */
    ros.forEach(p => {
      if (p.years > 0 || !G.club.roster.includes(p.id)) return;
      p.years = 2; expired.push(p);
      const to = (mo[p.id].score < B.refuseBelow || p.refused === G.season) ? sendAway(G, p, rank) : null;
      if (to) { left.push({ nick: p.nick, to, why: mo[p.id].why, kind: 'expire' }); return; }
      G.club.roster = G.club.roster.filter(x => x !== p.id); G.club.lineup = G.club.lineup.map(x => (x === p.id ? null : x)); p.team = null; Market.ensure(G).fa.push(p.id);
    });
    const toFA = expired.filter(p => p.team === null);
    const rookies = ensureRoster(G);
    const ev = evaluateGoal(G);
    if (ev && ev.success) pay.push({ k: `구단주 목표 달성 (${ev.goal.label})`, v: ev.bonus });
    const chDone = checkChallenges(G);
    G.club.finance = { season: G.season, income: pay, cost, before, after: G.club.funds, expired: toFA.map(p => p.nick), sponsor: sponsorSum, cap: capNow, avgPay, tax, pen, capTo: cs.to, growth, left };
    out.push(`💰 구단주 지급 +${Pros.money(income - paid)} · 연봉 −${Pros.money(cost)} → 자금 ${Pros.money(G.club.funds)}`);
    out.push(`🎟 티켓 수입 합계 +${Pros.money(ticketSum)} (이미 입금됨) · 경기당 평균 ${Pros.money(fi.avg)} · 관중률 ${Math.round(fi.fill * 100)}%`);
    out.push(`👥 팬 ${fi.seasonGain >= 0 ? '+' : ''}${fi.seasonGain.toLocaleString('ko-KR')}명 (시즌 시작 ${(G.club.fansStart || 0).toLocaleString('ko-KR')} → ${fi.fans.toLocaleString('ko-KR')})${fs.d ? ` · 시즌 순위 반영 ${fs.d > 0 ? '+' : ''}${fs.d.toLocaleString('ko-KR')}` : ''}`);
    out.push(`📊 셀러리캡 사용(선발 3명 · 시즌 평균) ${Pros.money(Math.round(avgPay))} / ${Pros.money(capNow)} (${avgPay > capNow ? '초과' : '여유 ' + Pros.money(Math.round(capNow - avgPay))})`);
    if (tax > 0) out.push(`💸 사치세 −${Pros.money(tax)} (캡 초과분 ${Pros.money(Math.round(avgPay - capNow))}의 ${Math.round(K.tax * 100)}%)`);
    if (pen > 0) out.push(`📉 최소 연봉 미달 벌금 −${Pros.money(pen)} (하한 ${Pros.money(floorV)} · 시즌 평균 ${Pros.money(Math.round(avgPay))})`);
    out.push(cs.step > 0.0005 ? `📈 셀러리캡 상승 ${Pros.money(cs.from)} → ${Pros.money(cs.to)} (+${(cs.step * 100).toFixed(1)}%)${cs.atMax ? ' · 이 리그의 성장 한계' : ''}` : `📈 셀러리캡 ${Pros.money(cs.to)} · 이 리그의 성장 한계에 도달했습니다. 상위 리그로 승격하면 더 큰 캡을 쓸 수 있습니다.`);
    growth.forEach(g => out.push(`📈 ${g.nick} ${g.from}→${g.to} (${g.d >= 0 ? '+' : ''}${g.d}) · 잠재 ${g.pot}${g.promoted ? ` · ${g.oldGrade}급→${g.grade}급 승급!` : ''}${g.note ? ' · ' + g.note : ''}`));
    if (ev) out.push(ev.success ? `🎯 구단주 목표 「${ev.goal.label}」 달성! 보너스 +${Pros.money(ev.bonus)}` : `🎯 구단주 목표 「${ev.goal.label}」 미달성 — 평판이 하락했습니다.`);
    chDone.forEach(c => out.push(`🏅 도전과제 「${c.name}」 달성 +${Pros.money(c.reward)}`));
    if (sponsorSum > 0) out.push(`📣 시즌 스폰서·광고 누적 +${Pros.money(sponsorSum)} (이미 입금됨)`);
    left.forEach(l => out.push(l.kind === 'demand' ? `🚪 ${l.nick} 선수가 이적을 요구해 ${l.to}(으)로 떠났습니다. (${l.why}) 보상금 +${Pros.money(l.fee)}` : `🚪 ${l.nick} 선수가 재계약 없이 ${l.to}(으)로 떠났습니다. (${l.why})`));
    if (toFA.length) out.push(`📄 계약 만료로 FA 시장에 나간 선수: ${toFA.map(p => p.nick).join(', ')}`);
    if (rookies.length) out.push(`🆘 선수단이 부족해 구단이 신인 ${rookies.map(p => p.nick).join(', ')} 선수를 보충했습니다.`);
    if (G.club.funds < 0) out.push(`⚠ 구단 자금이 마이너스입니다. 선수 영입이 제한됩니다.`);
    G.club.sponsorEarned = 0; G.club.facInc = 0;
    return out;
  }

  /* ----- 시작 리그 / 승격 / 이동 승계 ----- */
  const tierOf = (G, id) => C().promotion.order.indexOf(id);
  const startAllowed = lgId => (C().startLeagues || []).includes(lgId);
  function moveCheck(G, lgId) {
    const P = C().promotion, cur = P.order.indexOf(G.leagueId), tgt = P.order.indexOf(lgId), lg = CONFIG.leagues.find(l => l.id === lgId);
    if (tgt < 0 || !lg) return { kind: 'same', ok: true, rows: [] };
    if (tgt <= cur) return { kind: tgt === cur ? 'same' : 'down', ok: true, rows: [] };
    const req = P.req[lg.diff] || {}, ros = roster(G).slice().sort((a, b) => b.ovr - a.ovr), top = ros.slice(0, 3);
    const avg = top.length ? Math.round(top.reduce((t, p) => t + p.ovr, 0) / top.length) : 0, rank = League.rankOf(G, 'player'), nA = ros.filter(p => p.grade === 'A' || p.grade === 'S').length;
    const rows = [
      { ok: tgt - cur <= P.maxStep, txt: `한 번에 ${P.maxStep}단계까지만 승격 가능` },
      { ok: rank > 0 && rank <= P.rank, txt: `정규시즌 ${P.rank}위 이내 (현재 ${rank}위)` },
      { ok: avg >= (req.avgOvr || 0), txt: `상위 3명 평균 능력 ${req.avgOvr || 0} 이상 (현재 ${avg})` }
    ];
    if (req.minA) rows.push({ ok: nA >= req.minA, txt: `A급 이상 ${req.minA}명 이상 (현재 ${nA}명)` });
    rows.push({ ok: G.club.funds >= (req.funds || 0), txt: `구단 자금 ${Pros.money(req.funds || 0)} 이상 (현재 ${Pros.money(G.club.funds)})` });
    rows.push({ ok: payroll(G) <= cap(G), txt: `셀러리캡 이내 (선발 연봉 ${Pros.money(payroll(G))} / ${Pros.money(cap(G))})` });
    return { kind: 'up', ok: rows.every(r => r.ok), rows, lg };
  }
  function promoLines(G) {
    const P = C().promotion, nx = P.order[P.order.indexOf(G.leagueId) + 1]; if (!nx) return ['⬆ 최상위 리그입니다.'];
    const chk = moveCheck(G, nx), lg = CONFIG.leagues.find(l => l.id === nx);
    return chk.ok ? [`⬆ ${lg.name} 리그 승격 조건을 충족했습니다. (스카웃 제안 시 이동 가능)`] : [`⬆ ${lg.name} 리그 승격 조건 미달: ${chk.rows.filter(r => !r.ok).map(r => r.txt).join(' / ')}`];
  }
  function carryPlan(G, lgId, ids) {
    const lg = CONFIG.leagues.find(l => l.id === lgId), K = C().carry, capN = capOfDiff(lg.diff), reasons = [];
    const picks = [...new Set(ids)].filter(id => G.club.roster.includes(id)), ps = picks.map(id => Pros.get(G, id));
    const pay = ps.reduce((t, p) => t + p.salary, 0), fee = ps.reduce((t, p) => t + round10(p.salary * K.feeMul), 0);
    const start = C().startFunds[lg.diff] || C().startFunds.normal, keep = round10(Math.min(Math.max(0, G.club.funds) * K.fundsKeep, start * K.keepCap));
    const funds = start + keep - fee;
    if (picks.length > K.max) reasons.push(`승계는 최대 ${K.max}명입니다.`);
    if (pay > capN) reasons.push(`셀러리캡 초과 (연봉 ${Pros.money(pay)} / 상한 ${Pros.money(capN)})`);
    if (funds < 0) reasons.push(`승계 비용이 부족합니다. (필요 ${Pros.money(fee)})`);
    return { picks, pay, cap: capN, fee, keep, funds, ok: !reasons.length, msg: reasons[0] || '', reasons };
  }
  function carryDefault(G, lgId) {
    const sel = []; roster(G).slice().sort((a, b) => b.ovr - a.ovr).forEach(p => { if (carryPlan(G, lgId, [...sel, p.id]).ok) sel.push(p.id); }); return sel;
  }

  /* ----- 구단주 시즌 목표 ----- */
  function assignGoal(G) {
    const pools = (C().goals && C().goals.pools) || {};
    const diff = G.difficulty || (League.lgOf(G) && League.lgOf(G).diff) || 'normal';
    const noImport = ((CONFIG.pro.names || {}).foreignMax || {})[G.leagueId] === 0;
    const pool = (pools[diff] || pools.normal || []).filter(g => !(noImport && g.type === 'import'));
    if (!pool.length) { G.club.ownerGoal = null; return null; }
    // 직전 시즌 성공/실패와 같은 목표 반복 피하기
    const prevId = G.club.ownerGoal && G.club.ownerGoal.id;
    const cand = pool.filter(g => g.id !== prevId);
    const pick = (cand.length ? cand : pool)[Math.floor(Math.random() * (cand.length ? cand.length : pool.length))];
    G.club.ownerGoal = {
      id: pick.id, type: pick.type, target: pick.target, grade: pick.grade, bonusMul: pick.bonusMul, base: G.club.funds,
      label: pick.label, desc: pick.desc,
      status: 'active', pressure: 0, warned: false,
      season: G.season, setAt: G.league ? G.league.round : 0
    };
    return G.club.ownerGoal;
  }

  function goalProgress(G) {
    const g = G.club && G.club.ownerGoal;
    if (!g || g.status !== 'active') return null;
    const rank = League.rankOf(G, 'player');
    const st = G.league && G.league.standings && G.league.standings.player;
    const wins = st ? st.w : 0;
    const total = (CONFIG.league && CONFIG.league.rounds) || 24;
    const round = G.league ? G.league.round : 0;
    const mid = (CONFIG.league && CONFIG.league.midRound) || 12;
    let current = 0, ok = false, hint = '';
    switch (g.type) {
      case 'rank':
        current = rank || 99;
        ok = rank > 0 && rank <= g.target;
        hint = `현재 ${rank}위 / 목표 ${g.target}위 이내`;
        break;
      case 'wins':
        current = wins;
        ok = wins >= g.target;
        hint = `현재 ${wins}승 / 목표 ${g.target}승`;
        break;
      case 'playoff':
        current = rank || 99;
        ok = rank > 0 && rank <= (CONFIG.league.playoffTeams || 8);
        hint = `현재 ${rank}위 · 플레이오프권 ${CONFIG.league.playoffTeams || 8}위 이내`;
        break;
      case 'msi':
        current = rank || 99;
        ok = rank > 0 && rank <= (CONFIG.league.intlTeams || 4);
        // 전반기 종료 전엔 중간 순위로 추정
        hint = round < mid
          ? `전반 ${rank}위 · MSI 시드 ${CONFIG.league.intlTeams || 4}위 이내 필요`
          : `현재 ${rank}위 · MSI 시드 ${CONFIG.league.intlTeams || 4}위 이내`;
        break;
      case 'playoff_win':
        ok = !!(G.playoff && G.playoff.champion === 'player');
        hint = G.playoff
          ? (G.playoff.champion === 'player' ? '플레이오프 우승 달성' : (G.playoff.champion ? '플레이오프 탈락' : '플레이오프 진행 중'))
          : `현재 ${rank}위 · 일단 플레이오프 진출이 선행 조건`;
        break;
      case 'worlds':
        current = rank || 99;
        ok = !!(G.worlds && G.worlds.seeds && G.worlds.seeds.includes('player')) || (rank > 0 && rank <= (CONFIG.league.intlTeams || 4));
        hint = `현재 ${rank}위 · 월드 진출권 ${CONFIG.league.intlTeams || 4}위 이내`;
        break;
      case 'fundsUp':
        current = Math.round(G.club.funds - (g.base || 0));
        ok = current >= g.target;
        hint = `시즌 시작 대비 ${current >= 0 ? '+' : ''}${current} / 목표 +${g.target} 크레딧`;
        break;
      case 'grade': {
        const GR = { C: 0, B: 1, A: 2, S: 3 };
        current = roster(G).filter(p => GR[p.grade] >= GR[g.grade || 'A']).length;
        ok = current >= g.target;
        hint = `${g.grade || 'A'}급 이상 선수 ${current}명 / 목표 ${g.target}명`;
        break;
      }
      case 'homegrown': {
        const ln = lineup(G).filter(Boolean);
        current = ln.filter(p => p.nation === G.leagueId).length;
        ok = ln.length === 3 && current === 3;
        hint = `라인업 현지 국적 ${current}/3명`;
        break;
      }
      case 'import': {
        const ln = lineup(G).filter(Boolean);
        current = ln.filter(p => p.nation !== G.leagueId).length;
        ok = current >= g.target;
        hint = `라인업 외국인 ${current}명 / 목표 ${g.target}명`;
        break;
      }
      default:
        hint = g.label;
    }
    // 페이스 추정: 시즌 중반 이후 목표 대비 처지면 위험
    let risk = 'on'; // on | warn | danger
    if (g.type === 'rank' || g.type === 'playoff' || g.type === 'msi' || g.type === 'worlds') {
      if (rank > g.target + 3 && round >= Math.floor(total * 0.4)) risk = 'danger';
      else if (rank > g.target && round >= Math.floor(total * 0.35)) risk = 'warn';
      else if (ok) risk = 'on';
    } else if (g.type === 'wins') {
      const pace = total ? (wins / Math.max(1, round)) * total : 0;
      if (round >= 6 && pace < g.target * 0.75) risk = 'danger';
      else if (round >= 4 && pace < g.target * 0.9) risk = 'warn';
      else if (ok) risk = 'on';
    } else if (g.type === 'playoff_win') {
      if (G.phase === 'season' && rank > (CONFIG.league.playoffTeams || 8) && round >= Math.floor(total * 0.5)) risk = 'danger';
      else if (G.phase === 'season' && rank > 4 && round >= Math.floor(total * 0.4)) risk = 'warn';
    }
    return { goal: g, rank, wins, current, ok, hint, risk, round, total };
  }

  function checkPressure(G) {
    const prog = goalProgress(G);
    if (!prog || !G.club.ownerGoal) return null;
    const g = G.club.ownerGoal;
    if (g.status !== 'active') return null;
    // 위험/경고일 때만 압박 카운트 증가, 뉴스용 플래그
    if (prog.risk === 'danger') g.pressure = Math.min(5, (g.pressure || 0) + 1);
    else if (prog.risk === 'warn') g.pressure = Math.min(5, (g.pressure || 0) + 0.5);
    else g.pressure = Math.max(0, (g.pressure || 0) - 0.25);
    // 연속 위험이거나 경고 구간에서 간헐 뉴스
    const shouldWarn = prog.risk === 'danger' || (prog.risk === 'warn' && (g.pressure >= 1.5) && Math.random() < 0.45);
    if (!shouldWarn) return null;
    g.warned = true;
    return prog;
  }

  function evaluateGoal(G) {
    const g = G.club && G.club.ownerGoal;
    if (!g || g.status !== 'active') return null;
    const prog = goalProgress(G);
    let success = false;
    if (g.type === 'rank') success = prog && prog.rank > 0 && prog.rank <= g.target;
    else if (g.type === 'wins') {
      const st = G.league && G.league.standings && G.league.standings.player;
      success = !!(st && st.w >= g.target);
    } else if (g.type === 'playoff') success = prog && prog.rank > 0 && prog.rank <= (CONFIG.league.playoffTeams || 8);
    else if (g.type === 'msi') {
      // MSI 시드 = 전반기 종료 시점 상위 intlTeams. 기록 없으면 최종 순위로 대체
      const intlN = CONFIG.league.intlTeams || 4;
      if (G.msi && G.msi.seeds && G.msi.seeds.includes('player')) success = true;
      else success = prog && prog.rank > 0 && prog.rank <= intlN;
    } else if (g.type === 'playoff_win') success = !!(G.playoff && G.playoff.champion === 'player');
    else success = !!(prog && prog.ok);
    g.status = success ? 'success' : 'fail';
    const cfg = C().goals || {};
    let bonus = 0;
    if (success) {
      const o = C().owner, mul = o.leagueMul[League.lgOf(G).diff] || 1;
      bonus = Math.round(o.base * mul * (g.bonusMul || cfg.bonusMul || 0.35) / 10) * 10;
      G.club.funds += bonus; G.club.goalWins = (G.club.goalWins || 0) + 1;
      if (typeof News !== 'undefined' && News.shiftRep) News.shiftRep(G, cfg.successRep || 5, '구단주 목표 달성');
    } else {
      if (typeof News !== 'undefined' && News.shiftRep) News.shiftRep(G, cfg.failRep || -4, '구단주 목표 실패');
    }
    return { goal: g, success, bonus, prog };
  }

  const goalReward = (G, g) => { const o = C().owner, mul = o.leagueMul[League.lgOf(G).diff] || 1; return Math.round(o.base * mul * ((g && g.bonusMul) || (C().goals || {}).bonusMul || 0.35) / 10) * 10; };

  const CHV = {
    trophy: (G, c) => G.trophies.filter(t => t.k === c.k).length,
    leagues: G => new Set(G.trophies.filter(t => t.k === 'league').map(t => t.lg)).size,
    streak: G => G.bestStreak || 0,
    wins: G => (G.totals && G.totals.wins) || 0,
    goals: G => G.club.goalWins || 0,
    rare: G => roster(G).filter(p => Pros.rarity(p)).length,
    funds: G => Math.round(G.club.funds),
    foreign: G => roster(G).filter(p => p.nation && p.nation !== G.leagueId).length,
    seasons: G => G.season || 1
  };
  /* 같은 대회를 연속 시즌 우승한 최대 횟수 (리핏·쓰리핏) */
  CHV.repeat = (G, c) => {
    const ss = [...new Set(G.trophies.filter(t => t.k === c.k).map(t => t.season))].sort((x, y) => x - y);
    let best = 0, run = 0;
    ss.forEach((v, i) => { run = i && v === ss[i - 1] + 1 ? run + 1 : 1; best = Math.max(best, run); });
    return best;
  };
  const chValue = (G, c) => (CHV[c.type] ? CHV[c.type](G, c) : 0);
  /* 시리즈(tiers)를 단계별 항목으로 펼칩니다. 단계 없는 옛 항목도 그대로 지원 */
  const chFlat = () => (CONFIG.challenges || []).flatMap(s => (s.tiers
    ? s.tiers.map((t, i) => ({ icon: s.icon, type: s.type, k: s.k, ...t, id: t.id || `${s.id}_${t.n}`, desc: typeof s.desc === 'function' ? s.desc(t.n) : s.desc, series: s.id, tier: i + 1 }))
    : [{ ...s, series: s.id }]));
  /* 달성한 단계 + 시리즈별 다음 단계 하나만 보여줍니다 */
  function challenges(G) {
    const done = G.club.ch = G.club.ch || {}, open = {};
    return chFlat().map(c => ({ ...c, value: chValue(G, c), done: done[c.id] != null })).filter(c => {
      if (c.done) return true;
      if (open[c.series]) return false;
      return (open[c.series] = true);
    });
  }
  function checkChallenges(G) {
    if (!G.club) return [];
    const done = G.club.ch = G.club.ch || {}, out = [];
    chFlat().forEach(c => {
      if (done[c.id] != null || chValue(G, c) < c.n) return;
      done[c.id] = G.season || 1; G.club.funds += c.reward; out.push(c);
    });
    return out;
  }

  /* ----- 스폰서 / 광고 제안 ----- */
  function ensureSponsor(G) {
    if (!G.club) return;
    if (G.club.sponsorEarned == null) G.club.sponsorEarned = 0;
    if (G.club.sponsorCD == null) G.club.sponsorCD = 0;
    if (!G.club.pendingSponsor) G.club.pendingSponsor = null;
  }
  function sponsorTier(rep) {
    const tiers = (CONFIG.sponsor && CONFIG.sponsor.tierMul) || [];
    let t = tiers[0] || { rep: 55, mul: 1, label: '소형 광고' };
    tiers.forEach(x => { if (rep >= x.rep) t = x; });
    return t;
  }
  function sponsorChance(rep) {
    const rows = (CONFIG.sponsor && CONFIG.sponsor.chance) || [];
    let p = 0;
    rows.forEach(x => { if (rep >= x.rep) p = x.p; });
    return p;
  }
  function trySponsor(G) {
    ensureSponsor(G);
    const S = CONFIG.sponsor; if (!S) return null;
    if (G.club.pendingSponsor) return null;                    // 미응답 제안 있으면 스킵
    if ((G.club.sponsorCD || 0) > 0) { G.club.sponsorCD--; return null; }
    const rep = (G.rep && G.rep.v) || 50;
    if (rep < (S.minRep || 55)) return null;
    if (Math.random() > sponsorChance(rep)) return null;
    const tier = sponsorTier(rep);
    const lgMul = (S.leagueMul && S.leagueMul[League.lgOf(G).diff]) || 1;
    const jitter = 0.85 + Math.random() * 0.3;
    const amount = Math.round((S.base || 400) * tier.mul * lgMul * jitter / 10) * 10;
    const brands = S.brands || ['스폰서'];
    const brand = brands[Math.floor(Math.random() * brands.length)];
    const offer = {
      id: 'sp' + Date.now().toString(36),
      brand, amount, tier: tier.label, rep,
      round: G.league ? G.league.round : 0
    };
    G.club.pendingSponsor = offer;
    if (typeof News !== 'undefined' && News.sponsorOffer) News.sponsorOffer(G, offer, League.when(G));
    return offer;
  }
  function acceptSponsor(G) {
    ensureSponsor(G);
    const o = G.club.pendingSponsor; if (!o) return { ok: false, msg: '대기 중인 스폰서 제안이 없습니다.' };
    G.club.funds += o.amount;
    G.club.sponsorEarned = (G.club.sponsorEarned || 0) + o.amount;
    G.club.sponsorCD = (CONFIG.sponsor && CONFIG.sponsor.cooldownRounds) || 3;
    G.club.pendingSponsor = null;
    if (typeof News !== 'undefined' && News.sponsorDeal) News.sponsorDeal(G, o, true, League.when(G));
    return { ok: true, msg: `${o.brand} ${o.tier} 계약! +${Pros.money(o.amount)}` };
  }
  function declineSponsor(G) {
    ensureSponsor(G);
    const o = G.club.pendingSponsor; if (!o) return { ok: false, msg: '대기 중인 스폰서 제안이 없습니다.' };
    G.club.sponsorCD = Math.max(1, Math.floor(((CONFIG.sponsor && CONFIG.sponsor.cooldownRounds) || 3) / 2));
    G.club.pendingSponsor = null;
    if (typeof News !== 'undefined' && News.sponsorDeal) News.sponsorDeal(G, o, false, League.when(G));
    return { ok: true, msg: `${o.brand} 제안을 거절했습니다.` };
  }

  const done = (r) => { if (r && r.msg) UI.toast(r.msg, r.ok ? 'good' : 'warn'); Game.save(); UI.refresh(); };
  const actions = {
    proSlot(el) { const g = Game.G; done(setSlot(g, el.dataset.id, +el.dataset.slot)); },
    proClear(el) { clearSlot(Game.G, +el.dataset.slot); done(); },
    proAuto() { autoFill(Game.G); done(); },
    proSign(el) { done(Market.signFA(Game.G, el.dataset.id)); },
    proBuy(el) { done(Market.buyListed(Game.G, el.dataset.id)); },
    proRelease(el) {
      const g = Game.G, p = Pros.get(g, el.dataset.id); if (!p) return;
      if (!confirm(`${p.nick} 선수를 방출하면 위약금 ${Pros.money(Market.releaseFee(p))}이 듭니다. 방출할까요?`)) return;
      done(Market.release(g, p.id));
    },
    proSell(el) {
      const g = Game.G, p = Pros.get(g, el.dataset.id); if (!p) return;
      if (!confirm(`${p.nick} 선수를 판매할까요? 판매 대금 ${Pros.money(Market.sellPrice(p))}을 받고 다른 팀으로 이적합니다.`)) return;
      done(Market.sell(g, p.id));
    },
    proRenew(el) { done(Market.renew(Game.G, el.dataset.id)); },
    mkTab(el) { ProUI.mk({ tab: el.dataset.tab }); },
    mkGrade(el) { ProUI.mk({ grade: el.dataset.g }); },
    carryToggle(el) {
      const c = Game.carry; if (!c) return; const id = el.dataset.id;
      if (c.sel.has(id)) c.sel.delete(id);
      else { const t = carryPlan(Game.G, c.lg, [...c.sel, id]); if (!t.ok) { UI.toast(t.msg, 'warn'); return; } c.sel.add(id); }
      ProUI.carry();
    },
    carryNone() { if (Game.carry) { Game.carry.sel.clear(); ProUI.carry(); } },
    carryAuto() { if (Game.carry) { Game.carry.sel = new Set(carryDefault(Game.G, Game.carry.lg)); ProUI.carry(); } },
    carryGo() { const c = Game.carry; if (!c) return; Game.carry = null; Game.takeOffer(c.lg, c.team, [...c.sel]); },
    spAccept() { done(acceptSponsor(Game.G)); },
    spDecline() { done(declineSponsor(Game.G)); }
  };

  return { afterMatch, fanTitle, fanInfo, ensureFans, capInfo, hardCap, capFloor, renewRoom, cap, capLeft, mood, trackGame, moveCheck, promoLines, startAllowed, carryPlan, carryDefault, tierOf, init, seasonSetup, migrate, challenges, checkChallenges, goalReward, ensureRoster, roster, lineup, ready, brains, moods, payroll, wage, capSal, setSlot, autoFill, ownerPay, settle, assignGoal, goalProgress, checkPressure, evaluateGoal, trySponsor, acceptSponsor, declineSponsor, actions };
})();
