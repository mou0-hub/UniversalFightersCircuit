/* scout.js — 시즌 종료 스카웃 제안: 감독 평판 + 시즌 성적(리그 순위 · 플레이오프 · MSI · 월드)으로 0~3팀의 제안이 옵니다.
   - 제안이 없으면 현재 팀 잔류만 가능합니다. 제안이 있으면 제안 온 팀 또는 현재 팀 잔류 중에서만 고를 수 있습니다.
   - 구단 등급(1~5)은 팀 이름으로 고정 산출되므로 리그가 같아도 팀마다 격이 다릅니다. */

const Scout = (() => {
  const LG = () => CONFIG.leagues;
  const lgIdx = id => Math.max(0, LG().findIndex(l => l.id === id));
  const TEAM_MUL = [0.9, 0.95, 1, 1.08, 1.16];                    // 구단 등급 1~5 → 구단주 지급 배율
  const TIER_LABEL = ['소규모 구단', '중소 구단', '중견 구단', '명문 구단', '최상위 구단'];

  /* 팀 이름 → 구단 등급 (같은 팀은 언제나 같은 등급) */
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); }
  function teamTier(lgId, name) {
    const lg = LG().find(l => l.id === lgId); if (!lg) return 3;
    const ranked = lg.teams.map(n => ({ n, h: hash(lgId + '|' + n) })).sort((a, b) => a.h - b.h);   // 리그 안에서 5등급이 고르게 분포
    const i = ranked.findIndex(x => x.n === name); if (i < 0) return 3;
    return Math.min(5, 1 + Math.floor(i * 5 / ranked.length));
  }
  const teamMul = (lgId, name) => TEAM_MUL[teamTier(lgId, name) - 1] || 1;
  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
  /* 리그·구단 수준을 합친 0~100 점수 (리그 70% + 구단 30%) */
  const clubLevel = (lgId, name) => (lgIdx(lgId) / (LG().length - 1)) * 70 + ((teamTier(lgId, name) - 1) / 4) * 30;

  /* 국제대회/플레이오프 성적: { in, champ, depth(0~1) } */
  function tourResult(t) {
    if (!t || !t.seeds || !t.seeds.includes('player')) return { in: false, champ: false, depth: 0 };
    if (t.champion === 'player') return { in: true, champ: true, depth: 1 };
    let last = 0;
    t.rounds.forEach((rd, i) => { if (rd.some(m => m.a === 'player' || m.b === 'player')) last = i; });
    return { in: true, champ: false, depth: Math.min(0.95, (last + 1) / Math.max(1, t.rounds.length)) };
  }

  /* 감독 가치(0~100): 우승 실적이 가장 크게 반영됩니다.
     평판은 최대 25점, 정규시즌 순위 최대 20점이고, 리그(플레이오프) 우승 28 · MSI 우승 24 · 월드 우승 36점이 붙습니다. 성적 합계에는 0.9를 곱합니다.
     우승이 하나도 없으면 상한 62점(최대 2팀), 우승 1회는 상한 85점이라 3팀 제안은 우승을 여러 번 해야 나옵니다. */
  function merit(G) {
    const rank = League.rankOf(G, 'player'), rep = (G.rep && typeof G.rep.v === 'number') ? G.rep.v : 50;
    const rankPts = [20, 17, 14, 11, 8, 6, 4, 3, 1.5, 1, 0, 0][Math.max(0, Math.min(11, rank - 1))];
    const po = tourResult(G.playoff), ms = tourResult(G.msi), wd = tourResult(G.worlds);
    let perf = rankPts;
    if (po.in) perf += po.champ ? 28 : Math.round(po.depth * 4);
    if (ms.in) perf += ms.champ ? 24 : 2 + Math.round(ms.depth * 3);
    if (wd.in) perf += wd.champ ? 36 : 4 + Math.round(wd.depth * 6);
    const titles = [po.champ ? '리그 우승' : null, ms.champ ? 'MSI 우승' : null, wd.champ ? '월드 챔피언십 우승' : null].filter(Boolean);
    let val = Math.round(rep * 0.25 + perf * 0.9);
    val = Math.min(val, titles.length === 0 ? 62 : titles.length === 1 ? 85 : 100);
    return { value: Math.max(0, Math.min(100, val)), rank, rep, perf, titles };
  }

  function offerCount(m, rank, rep) {
    if (rank >= 11 && rep < 40) return 0;                         // 최하위권 + 나쁜 평판은 제안 없음
    const v = m.value, r = Math.random();
    if (v < 18) return 0;
    if (v < 40) return r < 0.5 ? 0 : 1;
    if (v < 55) return 1;
    if (v < 68) return r < 0.5 ? 1 : 2;
    if (v < 80) return 2;
    if (v < 90) return r < 0.6 ? 2 : 3;
    return 3;
  }

  /* 제안 생성: 감독 가치에 가까운 수준의 팀이 가중 추첨됩니다 (현재 팀은 제외) */
  function generate(G) {
    const m = merit(G), n = offerCount(m, m.rank, m.rep), pool = [];
    LG().forEach(l => l.teams.forEach((name, i) => {
      if (l.id === G.leagueId && name === G.baseTeam) return;
      const ord = CONFIG.club.promotion.order; if (ord.indexOf(l.id) - ord.indexOf(G.leagueId) > CONFIG.club.promotion.maxStep) return;   // 한 번에 한 단계 초과 승격 제안은 오지 않음
      const lv = clubLevel(l.id, name), d = lv - (m.value - 5);
      if (lv > m.value + 12 || lv < m.value - 45) return;
      pool.push({ lg: l.id, team: name, i, level: lv, w: Math.exp(-Math.pow(d / 18, 2)) + 0.02 });
    }));
    const offers = [];
    while (offers.length < n && pool.length) {
      const sum = pool.reduce((s, x) => s + x.w, 0); let r = Math.random() * sum, k = 0;
      for (; k < pool.length - 1; k++) { r -= pool[k].w; if (r <= 0) break; }
      const c = pool.splice(k, 1)[0];
      offers.push({ lg: c.lg, team: c.team, i: c.i, tier: teamTier(c.lg, c.team), level: Math.round(c.level) });
    }
    offers.sort((a, b) => b.level - a.level);
    G.scout = { season: G.season, merit: m.value, rank: m.rank, rep: m.rep, titles: m.titles, offers, done: false };
    return G.scout;
  }

  /* 구단주 지급 기준값(4위 기준 정규시즌 보너스 포함, 평판·트로피 보너스 제외) — 제안 카드에 표시 */
  function payPreview(lgId, name) {
    const lg = LG().find(l => l.id === lgId), o = CONFIG.club.owner, mul = (o.leagueMul[lg.diff] || 1) * teamMul(lgId, name);
    return { base: Math.round(o.base * mul), rank4: Math.round((o.rank[3] || 0) * mul), mul: Math.round(mul * 100) / 100, funds: CONFIG.club.startFunds[lg.diff] || CONFIG.club.startFunds.normal };
  }

  /* 선택 가능한 팀인지 검사 — 시즌 종료 상태에서는 제안 온 팀 또는 현재 팀만 허용 */
  function allowed(G, lgId, name) {
    if (!G) return true;                                           // 첫 부임: 자유 선택
    if (G.phase !== 'seasonEnd') return false;
    if (lgId === G.leagueId && name === G.baseTeam) return true;   // 잔류
    const s = G.scout; return !!(s && !s.done && s.offers.some(o => o.lg === lgId && o.team === name));
  }
  const ensure = G => { if (G && G.phase === 'seasonEnd' && !G.scout) generate(G); return G && G.scout; };

  return { teamTier, teamMul, stars, TIER_LABEL, merit, generate, payPreview, allowed, ensure, clubLevel };
})();
