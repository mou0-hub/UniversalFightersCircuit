/* league.js — 리그별 정규시즌 일정/순위 + 토너먼트(플레이오프, MSI, 월드 챔피언십) */

const League = (() => {
  const L = () => CONFIG.league;
  const lgOf = G => CONFIG.leagues.find(l => l.id === G.leagueId) || CONFIG.leagues[0];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  const team = (G, id) => G.league.teams.find(t => t.id === id) || (G.ext || {})[id] || { id, fav: [] };
  const name = (G, id) => (id == null ? '부전승' : team(G, id).name || id);
  const tag = (G, id) => { const t = team(G, id), l = CONFIG.leagues.find(x => x.id === (t.lg || G.leagueId)); return l ? l.short : ''; };
  /* 밴픽 없이 즉시 진행하는 경기(AI 대 AI)용 입력 — AI 난이도는 팀이 속한 리그 기준 */
  function input(G, id, picks, opp) {
    const t = team(G, id);
    if (id === 'player') return { name: name(G, id), fighters: picks, tactics: Draft.slotsFor(G, picks), strategy: G.strategy, brains: brainsOf(G, id), moods: moodsOf(G, id), cmd: 'normal' };
    const ai = Draft.aiTeam(t.level || lgOf(G).diff, picks, opp);
    return { name: name(G, id), fighters: picks, tactics: ai.tactics, strategy: ai.strategy, brains: brainsOf(G, id), moods: moodsOf(G, id), cmd: t.level || lgOf(G).diff };
  }
  /* 슬롯(1/2/3번) 순서의 선수 등급 = 전투 AI 지능 단계. 내 팀은 라인업, AI 팀은 보유 선수, 국제대회 팀은 미리 뽑은 등급 */
  function brainsOf(G, id) {
    if (id === 'player') return G.club && Club.ready(G) ? Club.brains(G) : undefined;
    const t = team(G, id); return t.pros ? t.pros.map(p => Pros.grade(G, p)) : t.brains;
  }
  /* 슬롯별 폼/멘탈/트러블/태업 — 전투 AI 보정용 (내 팀 라인업 / AI 팀 pros 순서) */
  function moodsOf(G, id) {
    if (id === 'player') return G.club && Club.ready(G) ? Club.moods(G) : undefined;
    const t = team(G, id);
    if (!t.pros) return undefined;
    return t.pros.map(pid => {
      const p = Pros.get(G, pid);
      if (!p) return { form: 55, mental: 70, trouble: 0, slack: 0 };
      if (typeof News !== 'undefined' && News.ensureProMood) News.ensureProMood(p);
      return { form: p.form ?? 55, mental: p.mental ?? 70, trouble: p.trouble ?? 0, slack: p.slack ?? 0, nick: p.nick, sk: Pros.skills(p) };
    });
  }
  /* ---------- 피어리스: 같은 시리즈 앞 세트에서 나온 파이터는 양 팀 모두 사용 불가 ---------- */
  const boOf = (kind, size) => ((L().bestOf || {})[kind] || {})[size] || 1;
  const poolSize = () => CONFIG.fighterOrder.filter(f => CONFIG.fighters[f] && !CONFIG.fighters[f].boss).length;
  function fearlessOf(m) {
    let ex = ((m && m.used) || []).slice();
    while (ex.length && poolSize() - new Set(ex).size < 8) ex = ex.slice(6);        // 파이터가 모자라면 가장 오래된 세트부터 풀어줌
    return ex;
  }
  function seriesLabel(m, me) {
    if (!m || !(m.bo > 1)) return '';
    const w = m.wins || [0, 0], my = m.b === me ? [w[1], w[0]] : w;
    return `BO${m.bo} ${my[0]}:${my[1]} · ${(m.games || []).length + 1}세트`;
  }
  function autoDraft(tA, tB, fear) {                            // Draft.auto 와 같은 AI 밴픽이지만 밴 목록도 돌려줍니다
    const d = Draft.create(fear), tms = [tA, tB];
    while (!d.done) { const c = Draft.current(d); Draft.apply(d, Draft.aiChoose(d, c.team, tms[c.team])); }
    return d;
  }
  function simulate(G, aId, bId, rule, series) {
    const d = autoDraft(team(G, aId), team(G, bId), series ? fearlessOf(series) : null), p = d.picks;
    const res = Battle.simulate([input(G, aId, p[0], p[1]), input(G, bId, p[1], p[0])], rule);
    Stats.record(G, { ids: [aId, bId], picks: p, bans: d.bans, winner: res.winner });       // 데이터 센터 집계
    res.picks = p;
    return res;
  }

  /* ---------- 일정 (서클 메서드 더블 라운드로빈 + 부족한 라운드는 앞 라운드를 홈/원정 바꿔 반복) ---------- */
  function makeSchedule(ids, rounds) {
    const n = ids.length, arr = ids.slice(), base = [];
    for (let r = 0; r < n - 1; r++) {
      const m = [];
      for (let i = 0; i < n / 2; i++) { let a = arr[i], b = arr[n - 1 - i]; if (r % 2) [a, b] = [b, a]; m.push({ a, b, played: false }); }
      base.push(m);
      arr.splice(1, 0, arr.pop());
    }
    const out = [];
    for (let l = 0; l < 2; l++) base.forEach(rd => out.push(rd.map(m => l ? { a: m.b, b: m.a, played: false } : { a: m.a, b: m.b, played: false })));
    for (let k = 0; out.length < rounds; k++) out.push(base[k % base.length].map(m => ({ a: m.a, b: m.b, played: false })));
    return out.slice(0, rounds);
  }

  function newSeason(G) {
    const lg = lgOf(G);
    const names = shuffle(lg.teams.filter(n => n !== G.baseTeam));
    const teams = [{ id: 'player', name: G.teamName, isPlayer: true, fav: [], lg: lg.id }];
    for (let i = 0; i < L().teamCount - 1; i++) teams.push({ id: 'ai' + i, name: names[i] || ('팀 ' + (i + 1)), fav: Draft.favorites(L().aiFavorites), level: lg.diff, lg: lg.id });
    const ids = teams.map(t => t.id), standings = {};
    ids.forEach(id => standings[id] = { w: 0, d: 0, l: 0, pts: 0, diff: 0 });
    G.league = { teams, schedule: makeSchedule(ids, L().rounds), round: 0, standings, playerLog: [] };
    G.phase = 'season'; G.playoff = null; G.msi = null; G.worlds = null; G.ext = {}; G.summary = null;
    Club.seasonSetup(G);                                          // AI 팀 프로게이머 배정 + 이적시장 갱신
  }

  function sorted(G) {
    const S = G.league.standings;
    return G.league.teams.map(t => ({ ...t, ...S[t.id] }))
      .sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.w - a.w || a.name.localeCompare(b.name));
  }
  const rankOf = (G, id) => sorted(G).findIndex(t => t.id === id) + 1;

  function applyStanding(G, aId, bId, res) {
    const S = G.league.standings, a = S[aId], b = S[bId], diff = Math.round((res.hp[0] - res.hp[1]) * 100);
    a.diff += diff; b.diff -= diff;
    if (res.winner === 0) { a.w++; a.pts += L().ptsWin; b.l++; b.pts += L().ptsLoss; }
    else if (res.winner === 1) { b.w++; b.pts += L().ptsWin; a.l++; a.pts += L().ptsLoss; }
    else { a.d++; b.d++; a.pts += L().ptsDraw; b.pts += L().ptsDraw; }
  }

  const playerMatch = G => (G.league.schedule[G.league.round] || []).find(m => !m.played && (m.a === 'player' || m.b === 'player'));

  /* 플레이어 경기 결과를 반영하고 같은 라운드의 나머지 경기를 즉시 시뮬레이션 */
  function completeRound(G, pm, res) {
    pm.played = true; applyStanding(G, pm.a, pm.b, res);
    G.league.recent = [{ a: pm.a, b: pm.b, w: res.winner, s: res.score }];                       // 이번 라운드 결과 기록(뉴스용)
    for (const m of G.league.schedule[G.league.round]) {
      if (m.played) continue;
      const r = simulate(G, m.a, m.b);
      m.played = true; applyStanding(G, m.a, m.b, r); G.league.recent.push({ a: m.a, b: m.b, w: r.winner, s: r.score });
    }
    G.league.round++;
  }

  /* ---------- 국제대회 참가 팀: 내 리그는 현재 순위 상위, 다른 리그는 해당 리그 팀 중 무작위(강팀 순) ---------- */
  function intlField(G) {
    const n = L().intlTeams, rows = [];
    Object.values(G.ext || {}).forEach(t => (t.pros || []).forEach(pid => Pros.remove(G, pid)));
    G.ext = {};
    CONFIG.leagues.forEach((lg, li) => {
      if (lg.id === G.leagueId) { sorted(G).slice(0, n).forEach((t, i) => rows.push({ id: t.id, rank: i + 1, str: li })); return; }
      shuffle(lg.teams.slice()).slice(0, n).forEach((nm, i) => {
        const id = `x:${lg.id}:${i}`;
        const pros = Pros.genTeam(G, lg.diff, lg.id);
        pros.forEach(pid => { const p = Pros.get(G, pid); p.team = id; p.form = 35 + Math.floor(Math.random() * 50); p.mental = 50 + Math.floor(Math.random() * 45); });
        G.ext[id] = { id, name: nm, fav: Draft.favorites(L().aiFavorites), level: lg.diff, lg: lg.id, pros };
        rows.push({ id, rank: i + 1, str: li });
      });
    });
    return rows.sort((a, b) => a.rank - b.rank || b.str - a.str).map(r => r.id);
  }

  /* ---------- 토너먼트 (참가 팀이 2의 거듭제곱이 아니면 상위 시드가 부전승) ---------- */
  function seedOrder(n) { let o = [1, 2]; while (o.length < n) { const m = o.length * 2; o = o.flatMap(s => [s, m + 1 - s]); } return o; }

  function createTour(kind, name, seedIds, rule) {
    const cnt = seedIds.length, n = Math.max(2, 1 << Math.ceil(Math.log2(cnt))), ids = seedIds.slice(), order = seedOrder(n), first = [];
    while (ids.length < n) ids.push(null);
    for (let i = 0; i < n; i += 2) {
      const a = ids[order[i] - 1], b = ids[order[i + 1] - 1];
      first.push({ a: a || b, b: a ? b : null, winner: a && b ? null : (a || b), res: null, bo: boOf(kind, n), wins: [0, 0], games: [], used: [] });
    }
    return { kind, name, rule, seeds: seedIds.slice(), rounds: [first], roundIdx: 0, champion: null };
  }
  const roundName = (t, i) => { const size = t.rounds[i].length * 2; return L().roundNames[size] || (size + '강'); };
  const tourPlayerMatch = t => t.rounds[t.roundIdx].find(m => m.winner == null && (m.a === 'player' || m.b === 'player'));
  const slim = r => ({ winner: r.winner, hp: r.hp, ticks: r.ticks });

  function tourResolve(t, m, res, picks) {
    const bo = m.bo || 1, w = res.winner === -1 ? (Math.random() < 0.5 ? 0 : 1) : res.winner;
    m.res = slim(res);
    m.wins = m.wins || [0, 0]; m.games = m.games || []; m.wins[w]++; m.games.push({ w });
    if (picks) m.used = (m.used || []).concat(picks[0] || [], picks[1] || []);
    if (bo === 1 || m.wins[w] >= Math.ceil(bo / 2)) m.winner = w === 0 ? m.a : m.b;
    return w;
  }
  function tourSimCurrent(G, t) {
    for (const m of t.rounds[t.roundIdx]) {
      while (m.winner == null) { const r = simulate(G, m.a, m.b, t.rule, m); tourResolve(t, m, r, r.picks); }
    }
  }
  function tourAdvance(t) {
    const rd = t.rounds[t.roundIdx];
    if (rd.some(m => m.winner == null)) return;
    const w = rd.map(m => m.winner);
    if (w.length === 1) { t.champion = w[0]; return; }
    const next = [];
    for (let i = 0; i < w.length; i += 2) next.push({ a: w[i], b: w[i + 1], winner: null, res: null, bo: boOf(t.kind, w.length), wins: [0, 0], games: [], used: [] });
    t.rounds.push(next); t.roundIdx++;
  }
  function tourSimAll(G, t) { while (!t.champion) { tourSimCurrent(G, t); tourAdvance(t); } }
  /* 내 팀이 1라운드 부전승이면 나머지 경기를 진행해 내 경기가 있는 라운드까지 넘깁니다 */
  function tourStart(G, t) { if (t.seeds.includes('player') && !tourPlayerMatch(t)) { tourSimCurrent(G, t); tourAdvance(t); } }

  /* ---------- 달력: 전반기 2~5월 · MSI 6월 · 후반기 7~10월(플레이오프 10월 말) · 월즈 11월 · 12~1월 휴식 ---------- */
  const CAL = { startYear: 2027 }, WD = ['일', '월', '화', '수', '목', '금', '토'];
  const yearOf = G => CAL.startYear + (G.season || 1) - 1;
  /* 현재 진행 상태에 해당하는 날짜 */
  function when(G) {
    const y = yearOf(G), ph = G.phase;
    if (ph === 'season') { const r = G.league.round, mid = L().midRound; return r < mid ? new Date(y, 1, 5 + 10 * r) : new Date(y, 6, 8 + 9 * (r - mid)); }
    if (ph === 'msi') return new Date(y, 5, 6 + 2 * (G.msi ? G.msi.roundIdx : 0));
    if (ph === 'playoff') return new Date(y, 9, 20 + 2 * (G.playoff ? G.playoff.roundIdx : 0));
    if (ph === 'worlds') return new Date(y, 10, 3 + 5 * (G.worlds ? G.worlds.roundIdx : 0));
    return new Date(y, 11, 15);
  }
  const fmtDate = (d, short) => (short ? `${d.getMonth() + 1}월 ${d.getDate()}일` : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일(${WD[d.getDay()]})`);
  const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  /* 시기 이름: 전반기 / MSI / 후반기 / 월드 챔피언십 / 휴식기 */
  function stage(G) {
    const ph = G.phase;
    if (ph === 'msi') return 'MSI'; if (ph === 'worlds') return '월드 챔피언십'; if (ph === 'playoff') return '후반기 플레이오프'; if (ph === 'seasonEnd') return '휴식기';
    return G.league.round < L().midRound ? '전반기' : '후반기';
  }

  return { team, name, tag, brainsOf, moodsOf, lgOf, when, fmtDate, isoDate, stage, yearOf, CAL, newSeason, sorted, rankOf, playerMatch, completeRound, intlField, createTour, roundName, tourPlayerMatch, tourResolve, tourSimCurrent, tourAdvance, tourSimAll, tourStart, shuffle, fearlessOf, seriesLabel };
})();
