/* club.js — 구단 관리: 자금 · 선수단 · 라인업(1/2/3번) · 시즌 정산(구단주 지급 − 연봉) + 화면에서 쓰는 액션 */

const Club = (() => {
  const C = () => CONFIG.club;

  /* 새 커리어: 구단 자금 + 리그 난이도에 맞는 기본 선수단 5명 지급 (G.league 이전에 호출)
     등급은 AI와 같은 aiMix를 쓰고, 시작/지급 크레딧이 리그 수준에 맞게 책정되어 있음 */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round10 = n => Math.round(n / 10) * 10;
  const capOfDiff = d => (C().cap || {})[d] || C().cap.normal;
  const cap = G => capOfDiff(G.difficulty || (League.lgOf(G) && League.lgOf(G).diff) || 'normal');
  const capLeft = G => cap(G) - payroll(G);

  /* 새 커리어: opts.carry = 승계 선수(이전 구단 객체), opts.pool = 미승계 선수(FA 풀로 환원), opts.carryFee, opts.keepFunds */
  function init(G, opts = {}) {
    G.pros = { seq: 0, by: {} }; G.market = { fa: [], round: -99 };
    const funds = (C().startFunds[G.difficulty] || C().startFunds.normal) + (opts.keepFunds || 0) - (opts.carryFee || 0);
    G.club = { funds, roster: [], lineup: [null, null, null], finance: null, sponsorEarned: 0, sponsorCD: 0, pendingSponsor: null, ownerGoal: null, sg: 0, sgSeason: null, leavers: [], pool: [] };
    const level = G.difficulty || 'normal', lgId = G.leagueId || 'kr', by = G.pros.by;
    const copy = (src, team) => { const p = JSON.parse(JSON.stringify(src)); p.id = 'p' + (++G.pros.seq); p.team = team; p.sg = 0; p.sw = 0; p.refused = null; p.listed = false; p.fee = 0; by[p.id] = p; return p; };
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
    if (G.club.sgSeason !== G.season) { G.club.sg = 0; G.club.sgSeason = G.season; roster(G).forEach(p => { p.sg = 0; p.sw = 0; }); }
    Pros.purge(G); Market.refresh(G, true);
    /* 승계하지 못한 선수는 FA 풀로 환원 */
    (G.club.pool || []).forEach(id => { const p = Pros.get(G, id); if (p) { p.team = null; p.years = Pros.rnd(1, 2); Market.ensure(G).fa.push(id); } });
    G.club.pool = [];
    ensureRoster(G);
    if (!G.club.ownerGoal || G.club.ownerGoal.season !== G.season) assignGoal(G);
  }

  /* 구버전 세이브 보정 */
  function migrate(G) {
    if (!G.club) { G.pros = G.pros || { seq: 0, by: {} }; G.market = G.market || { fa: [], round: -99 }; G.club = { funds: C().startFunds[G.difficulty] || C().startFunds.normal, roster: [], lineup: [null, null, null], finance: null }; }
    if (G.pros && G.club.roster && G.club.lineup) ensureRoster(G);
    if (G.club.ownerGoal === undefined) G.club.ownerGoal = null;
    if (G.club.sponsorEarned == null) G.club.sponsorEarned = 0;
    if (G.club.sg == null) G.club.sg = 0;
    if (!G.club.leavers) G.club.leavers = [];
    if (!G.club.pool) G.club.pool = [];
    if (G.pros) Object.values(G.pros.by).forEach(p => { Pros.ensurePot(p); if (p.sg == null) { p.sg = 0; p.sw = 0; } });
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
    return { form: p.form ?? 55, mental: p.mental ?? 70, trouble: p.trouble ?? 0, slack: p.slack ?? 0, nick: p.nick, sk: Pros.skills(p) };
  });
  const payroll = G => roster(G).reduce((s, p) => s + p.salary, 0);

  function setSlot(G, id, slot) {
    if (!G.club.roster.includes(id)) return false;
    G.club.lineup = G.club.lineup.map(x => (x === id ? null : x)); G.club.lineup[slot] = id; return true;
  }
  function clearSlot(G, slot) { G.club.lineup[slot] = null; }
  function autoFill(G) {
    const free = roster(G).filter(p => !G.club.lineup.includes(p.id)).sort((a, b) => b.ovr - a.ovr);
    G.club.lineup = G.club.lineup.map(x => x || (free.length ? free.shift().id : null));
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
    G.club.sg = (G.club.sg || 0) + 1;
    G.club.lineup.forEach(id => { const p = id && Pros.get(G, id); if (p) { p.sg = (p.sg || 0) + 1; if (won) p.sw = (p.sw || 0) + 1; } });
  }
  function shareOf(G, p) {
    const tg = G.club.sg || 0;
    if (tg < 4) return G.club.lineup.includes(p.id) ? 0.75 : 0.3;
    return Math.min(1, (p.sg || 0) / tg);
  }
  function mood(G, p) {
    const B = CONFIG.pro.morale, n = CONFIG.league.teamCount || 12, rank = League.rankOf(G, 'player') || Math.ceil(n / 2);
    const share = shareOf(G, p), young = p.age <= 22 || (p.pot - p.ovr) >= 8, vet = p.age >= 27, star = p.grade === 'A' || p.grade === 'S';
    const parts = {
      play: (share - 0.5) * B.play * (young ? 1.35 : 1),
      team: ((n + 1) / 2 - rank) / ((n - 1) / 2) * B.team * ((vet || star) ? 1.3 : 1),
      pay: clamp((p.salary / Math.max(1, Pros.marketSalary(p)) - 1) * B.pay, B.payMin, B.payMax) * (star ? 1.2 : 1),
      growth: clamp((p.dev || 0) * B.growth, -B.growthMax, B.growthMax),
      title: G.playoff && G.playoff.champion === 'player' ? B.title : 0,
      trait: (p.trouble >= 60 ? -B.trouble : 0) + (p.mental >= 85 ? 3 : 0)
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
    const sponsorSum = G.club.sponsorEarned || 0;
    if (sponsorSum > 0) pay.push({ k: '시즌 스폰서·광고 수입', v: sponsorSum });
    const income = pay.reduce((s, x) => s + x.v, 0), cost = payroll(G), capNow = cap(G), out = [];
    const before = G.club.funds;
    G.club.funds += (income - sponsorSum) - cost;
    const B = CONFIG.pro.morale, ros = roster(G), left = [], expired = [];
    const growth = ros.map(p => Pros.develop(G, p, { share: shareOf(G, p), rank }));
    const mo = {}; ros.forEach(p => { mo[p.id] = mood(G, p); });
    ros.forEach(p => { p.years--; p.age++; });
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
    G.club.finance = { season: G.season, income: pay, cost, before, after: G.club.funds, expired: toFA.map(p => p.nick), sponsor: sponsorSum, cap: capNow, growth, left };
    out.push(`💰 구단주 지급 +${Pros.money(income - sponsorSum)} · 연봉 −${Pros.money(cost)} → 자금 ${Pros.money(G.club.funds)}`);
    out.push(`📊 셀러리캡 사용 ${Pros.money(cost)} / ${Pros.money(capNow)} (${cost > capNow ? '초과' : '여유 ' + Pros.money(capNow - cost)})`);
    growth.forEach(g => out.push(`📈 ${g.nick} ${g.from}→${g.to} (${g.d >= 0 ? '+' : ''}${g.d}) · 잠재 ${g.pot}${g.promoted ? ` · ${g.oldGrade}급→${g.grade}급 승급!` : ''}${g.note ? ' · ' + g.note : ''}`));
    if (ev) out.push(ev.success ? `🎯 구단주 목표 「${ev.goal.label}」 달성! 보너스 +${Pros.money(ev.bonus)}` : `🎯 구단주 목표 「${ev.goal.label}」 미달성 — 평판이 하락했습니다.`);
    chDone.forEach(c => out.push(`🏅 도전과제 「${c.name}」 달성 +${Pros.money(c.reward)}`));
    if (sponsorSum > 0) out.push(`📣 시즌 스폰서·광고 누적 +${Pros.money(sponsorSum)} (이미 입금됨)`);
    left.forEach(l => out.push(l.kind === 'demand' ? `🚪 ${l.nick} 선수가 이적을 요구해 ${l.to}(으)로 떠났습니다. (${l.why}) 보상금 +${Pros.money(l.fee)}` : `🚪 ${l.nick} 선수가 재계약 없이 ${l.to}(으)로 떠났습니다. (${l.why})`));
    if (toFA.length) out.push(`📄 계약 만료로 FA 시장에 나간 선수: ${toFA.map(p => p.nick).join(', ')}`);
    if (rookies.length) out.push(`🆘 선수단이 부족해 구단이 신인 ${rookies.map(p => p.nick).join(', ')} 선수를 보충했습니다.`);
    if (G.club.funds < 0) out.push(`⚠ 구단 자금이 마이너스입니다. 선수 영입이 제한됩니다.`);
    G.club.sponsorEarned = 0;
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
    rows.push({ ok: payroll(G) <= cap(G), txt: `셀러리캡 이내 (연봉 ${Pros.money(payroll(G))} / ${Pros.money(cap(G))})` });
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
  const chValue = (G, c) => (CHV[c.type] ? CHV[c.type](G, c) : 0);
  function challenges(G) {
    const done = G.club.ch = G.club.ch || {};
    return (CONFIG.challenges || []).map(c => ({ ...c, value: chValue(G, c), done: done[c.id] != null }));
  }
  function checkChallenges(G) {
    if (!G.club) return [];
    const done = G.club.ch = G.club.ch || {}, out = [];
    (CONFIG.challenges || []).forEach(c => {
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
    proSlot(el) { const g = Game.G; setSlot(g, el.dataset.id, +el.dataset.slot); done(); },
    proClear(el) { clearSlot(Game.G, +el.dataset.slot); done(); },
    proAuto() { autoFill(Game.G); done(); },
    proSign(el) { done(Market.signFA(Game.G, el.dataset.id)); },
    proBuy(el) { done(Market.buyListed(Game.G, el.dataset.id)); },
    proRelease(el) {
      const g = Game.G, p = Pros.get(g, el.dataset.id); if (!p) return;
      if (!confirm(`${p.nick} 선수를 방출하면 위약금 ${Pros.money(Market.releaseFee(p))}이 듭니다. 방출할까요?`)) return;
      done(Market.release(g, p.id));
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

  return { cap, capLeft, mood, trackGame, moveCheck, promoLines, startAllowed, carryPlan, carryDefault, tierOf, init, seasonSetup, migrate, challenges, checkChallenges, goalReward, ensureRoster, roster, lineup, ready, brains, moods, payroll, setSlot, autoFill, ownerPay, settle, assignGoal, goalProgress, checkPressure, evaluateGoal, trySponsor, acceptSponsor, declineSponsor, actions };
})();
