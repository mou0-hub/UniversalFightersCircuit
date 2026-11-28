/* scout.js — 시즌 종료 스카웃 제안: 감독 평판 + 시즌 성적(리그 순위 · 플레이오프 · MSI · 월드)으로 0~3팀의 제안이 옵니다.
   - 제안이 없으면 현재 팀 잔류만 가능합니다. 제안이 있으면 제안 온 팀 또는 현재 팀 잔류 중에서만 고를 수 있습니다.
   - 구단 등급(1~5)은 팀 이름으로 고정 산출되므로 리그가 같아도 팀마다 격이 다릅니다. */

const Scout = (() => {
  const { clamp } = Util;
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

  const C = () => CONFIG.scout;
  const FDX = id => CONFIG.fighters[id];
  const avgOf = l => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);

  const favOf = t => {
    const a = (t.fav || []).filter(f => FDX(f) && !FDX(f).boss);
    CONFIG.fighterOrder.forEach(f => { if (a.length < 3 && FDX(f) && !FDX(f).boss && !a.includes(f)) a.push(f); });
    return a.slice(0, 3);
  };
  const gradeOvr = g => { const r = CONFIG.pro.grades[g] || CONFIG.pro.grades.B; return (r.ovr[0] + r.ovr[1]) / 2; };
  const powerOf = (G, id) => { const b = League.brainsOf(G, id); return b && b.length ? avgOf(b.map(gradeOvr)) : null; };

  function skillAvg(G, id) {
    const m = League.moodsOf(G, id);
    if (!m || !m.length) return null;
    const out = {};
    CONFIG.pro.skills.forEach(s => { const v = m.filter(x => x.sk).map(x => x.sk[s.id]); out[s.id] = v.length ? avgOf(v) : null; });
    return Object.values(out).some(v => v == null) ? null : out;
  }

  function strengths(sk) {
    if (!sk) return { strong: [], weak: [] };
    const mean = avgOf(Object.values(sk)), list = CONFIG.pro.skills.map(s => ({ ...s, v: sk[s.id], d: sk[s.id] - mean })).sort((a, b) => b.d - a.d);
    return { strong: list.slice(0, 2).filter(x => x.d >= C().skillGap), weak: list.slice(-1).filter(x => x.d <= -C().skillGap) };
  }

  function optName(cat, v) {
    const c = CONFIG.tactics.team.find(x => x.id === cat), o = c && c.options.find(x => x.id === v);
    return { cat: c ? c.name : cat, name: o ? o.name : v, desc: o ? o.desc : '' };
  }

  function proNotes(G, t) {
    const out = [];
    (t.pros || []).forEach(pid => {
      const p = Pros.get(G, pid); if (!p) return;
      const R = C().risk;
      if (p.mental < R.mental) out.push(`${p.nick}: 멘탈이 불안합니다`);
      if (p.form < R.form) out.push(`${p.nick}: 폼이 낮습니다`);
      if (p.trouble >= R.trouble) out.push(`${p.nick}: 트러블 성향이 있습니다`);
      if (p.slack >= R.slack) out.push(`${p.nick}: 태업 성향이 있습니다`);
    });
    return out;
  }

  const kindOf = f => (f.role === 'assassin' ? 'asn' : f.ai && f.ai.backline ? 'back' : f.role === 'guardian' ? 'guard' : f.ai && f.ai.front ? 'front' : 'mid');
  function compOf(ids) {
    const fs = ids.map(FDX).filter(Boolean); if (!fs.length) return null;
    const n = k => fs.filter(f => kindOf(f) === k).length;
    return { n: fs.length, asn: n('asn') / 1.5, back: n('back') / 1.5, front: (n('front') + n('guard')) / 1.5, range: avgOf(fs.map(f => (f.stats && f.stats.range) || 8)) };
  }
  const tiltOf = (m, R) => (m && m.length ? m.filter(x => x.mental < R.mental || x.form < R.form).length / m.length : 0);
  const trblOf = (m, R) => (m && m.length ? m.filter(x => x.trouble >= R.trouble || x.slack >= R.slack).length / m.length : 0);

  function features(G, t, S, o) {
    const K = C(), R = K.risk, em = { avoid: -1, careful: -0.6, balanced: 0, aggressive: 0.7, allout: 1 }, pm = { home: -1, center: 0, press: 1 }, sm = { split: 1, auto: 0, duo: 0, group: -1 };
    const dm = { early: 1, normal: 0, full: -1 }, bm = { yield: -1, smart: 0, steal: 0.7, contest: 1 };
    const lv = Object.keys(CONFIG.ai.levels), li = lv.indexOf(o.level), raw = {}, F = {};
    const sk = k => { if (!o.sOpp || !o.sMe) return 0; raw[k] = Math.round(o.sMe[k] - o.sOpp[k]); return clamp(raw[k] / K.scale.skill, -1.5, 1.5); };
    raw.adv = o.gap;
    Object.assign(F, {
      adv: o.gap == null ? 0 : clamp(o.gap / K.scale.gap, -1.5, 1.5),
      oppAggro: em[S.engage && S.engage[0]] || 0, oppPress: pm[S.zone && S.zone[0]] || 0, oppSplit: sm[S.formation && S.formation[0]] || 0, oppEarly: dm[S.deposit && S.deposit[0]] || 0, oppBoss: bm[S.boss && S.boss[0]] || 0,
      oppAsn: o.cOpp ? o.cOpp.asn : 0, oppBack: o.cOpp ? o.cOpp.back : 0, oppFront: o.cOpp ? o.cOpp.front : 0,
      myAsn: o.cMe ? o.cMe.asn : 0, myBack: o.cMe ? o.cMe.back : 0, myFront: o.cMe ? o.cMe.front : 0,
      rng: o.cOpp && o.cMe ? clamp((o.cMe.range - o.cOpp.range) / 10, -1.2, 1.2) : 0,
      eAim: sk('aim'), eJudge: sk('judge'), eFight: sk('fight'), eReact: sk('react'), ePosn: sk('posn'), eUlt: sk('ult'), eObj: sk('obj'), eTeam: sk('team'), eClutch: sk('clutch'),
      tiltMy: tiltOf(o.mMe, R), tiltOpp: tiltOf(o.mOpp, R), trblMy: trblOf(o.mMe, R), lvF: lv.length > 1 && li >= 0 ? li / (lv.length - 1) * 2 - 1 : 0
    });
    return { F, raw };
  }

  /* 축마다 모든 옵션의 점수(상대 성향·조합·능력치 격차·컨디션·기록 승률)를 계산해, 현재 설정보다 뚜렷하게 나은 옵션만 근거와 함께 제안 */
  function recommend(F, cur, ctx) {
    const K = C(), M = K.model, data = ctx.data || {}, raw = ctx.raw || {}, cand = [];
    const term = (axis, opt) => { const r = data[axis] && data[axis][opt]; if (!r || !r[0]) return { v: 0 }; const wr = (r[1] + K.prior * 0.5) / (r[0] + K.prior); return { v: (wr - 0.5) * K.dataK, wr, n: r[0] }; };
    const U = (axis, opt) => { const w = M[axis][opt] || {}; let u = (w._ || 0) + term(axis, opt).v; for (const k in w) if (k !== '_') u += w[k] * (F[k] || 0); return u; };
    CONFIG.tactics.team.filter(c => M[c.id]).forEach(c => {
      const now = cur && cur[c.id] ? cur[c.id][0] : c.neutral, nowOk = M[c.id][now] ? now : c.neutral, uNow = U(c.id, nowOk);
      let best = null;
      c.options.filter(o => M[c.id][o.id] && o.id !== now).forEach(o => { const u = U(c.id, o.id); if (!best || u > best.u) best = { o, u }; });
      if (best && best.u - uNow >= K.margin) cand.push({ axis: c.id, cat: c.name, now, nowOk, to: best.o.id, toName: best.o.name, delta: best.u - uNow });
    });
    cand.sort((a, b) => b.delta - a.delta);
    const next = { ...Object.fromEntries(Object.keys(M).map(k => [k, cur && cur[k] ? cur[k][0] : (CONFIG.tactics.team.find(c => c.id === k) || {}).neutral])) }, out = [];
    for (const c of cand) {
      if (out.length >= K.top) break;
      const after = { ...next, [c.axis]: c.to };
      if (K.conflicts.some(([a, b]) => after[a[0]] === a[1] && after[b[0]] === b[1])) continue;
      next[c.axis] = c.to;
      const wT = M[c.axis][c.to] || {}, wN = M[c.axis][c.nowOk] || {}, tT = term(c.axis, c.to), tN = term(c.axis, c.nowOk), cs = [];
      new Set([...Object.keys(wT), ...Object.keys(wN)]).forEach(k => { if (k === '_') return; const v = ((wT[k] || 0) - (wN[k] || 0)) * (F[k] || 0); if (v >= 0.1 && Math.abs(F[k] || 0) >= 0.25 && K.feat[k]) cs.push({ k, v }); });
      if (tT.v - tN.v >= 0.1 && tT.n) cs.push({ k: '_data', v: tT.v - tN.v });
      cs.sort((a, b) => b.v - a.v);
      const why = cs.slice(0, 3).map(({ k }) => {
        if (k === '_data') return `전체 기록상 '${c.toName}' 승률 ${Math.round(tT.wr * 100)}% (${tT.n}경기)`;
        const p = K.feat[k][F[k] > 0 ? 0 : 1] || '';
        return p.replace('{v}', raw[k] != null ? Math.abs(raw[k]) : '');
      }).filter(Boolean);
      const conf = ctx.conf * clamp(0.55 + c.delta / 1.6, 0.55, 1), label = conf >= 0.75 ? '높음' : conf >= 0.5 ? '보통' : '참고용';
      const eff = (K.effect[c.axis] || {})[c.to] || '', rk = (K.risk[c.axis] || {})[c.to] || '';
      out.push({ axis: c.axis, to: c.to, cat: c.cat, fromName: optName(c.axis, c.now).name, toName: c.toName, delta: Math.round(c.delta * 100) / 100, conf: Math.round(conf * 100) / 100,
        why: `근거 — ${why.length ? why.join(' · ') : '현재 설정보다 상대 대비 점수가 높음'}<br><small>기대 효과: ${eff}${rk ? ` · 주의: ${rk}` : ''} · 확신도 ${label}</small>` });
    }
    return out;
  }

  function insightsOf(F) {
    return C().insights.filter(x => (x.gte == null || (F[x.f] || 0) >= x.gte) && (x.lte == null || (F[x.f] || 0) <= x.lte)).sort((a, b) => Math.abs(F[b.f] || 0) - Math.abs(F[a.f] || 0)).slice(0, 4).map(x => x.text);
  }

  function analyze(G, id) {
    const t = League.team(G, id); if (!t || !t.name) return null;
    const lg = t.lg || G.leagueId, level = t.level || League.lgOf(G).diff;
    const tr = Stats.teamRates(G, lg, t.name), picks = tr.picks.g >= C().minGames ? tr.picks.list.slice(0, 3) : [];
    const known = picks.map(x => x.id), bans = known.length >= 2 ? known.slice(0, 2) : favOf(t).slice(0, 2);
    const oppIds = known.length >= 3 ? known : favOf(t);
    let myIds = [];
    try { myIds = ((G.club && G.club.roster) || []).map(pid => Pros.get(G, pid)).filter(Boolean).sort((a, b) => b.ovr - a.ovr).slice(0, 3).map(p => (p.favs || [])[0]).filter(Boolean); } catch (e) { myIds = []; }
    const ai = Draft.aiTeam(level, oppIds, myIds), S = ai.strategy;
    const strat = ['engage', 'zone', 'formation', 'deposit', 'boss'].filter(k => S[k]).map(k => ({ ...optName(k, S[k][0]), id: S[k][0], key: k }));
    const sOpp = skillAvg(G, id), sMe = skillAvg(G, 'player');
    const pOpp = powerOf(G, id), pMe = powerOf(G, 'player');
    const gap = pOpp != null && pMe != null ? Math.round((pMe - pOpp) * 10) / 10 : null;
    const mOpp = League.moodsOf(G, id), mMe = League.moodsOf(G, 'player'), cOpp = compOf(oppIds), cMe = compOf(myIds);
    const { F, raw } = features(G, t, S, { gap, sOpp, sMe, cOpp, cMe, mOpp, mMe, level });
    let data = {}; try { data = Stats.tactics(G).team || {}; } catch (e) { data = {}; }
    const conf = clamp(1 - (gap == null ? 0.3 : 0) - (!sOpp || !sMe ? 0.2 : 0) - (known.length < 3 ? 0.15 : 0) - (!cMe ? 0.1 : 0), 0.2, 1);
    const rec = recommend(F, G.strategy, { raw, data, conf });
    const all = League.sorted(G), ri = all.findIndex(x => x.id === id);
    const pros = (t.pros || []).map(pid => Pros.get(G, pid)).filter(Boolean).map(p => ({ p, grade: p.grade, role: Pros.roleName(p.role), style: Pros.styleName(p.style), engage: (Pros.engage(p) || {}).name || '' }));
    return { id, name: t.name, comp: { opp: cOpp, me: cMe }, feat: F, tag: League.tag(G, id), level, lv: CONFIG.ai.levels[level], rank: ri >= 0 && (t.lg || G.leagueId) === G.leagueId ? ri + 1 : 0, strat, power: { opp: pOpp, me: pMe, gap }, skill: strengths(sOpp), mySkill: strengths(sMe), pros, notes: proNotes(G, t).concat(insightsOf(F)), bans, sample: tr.picks.g, rec };
  }


  return { teamTier, teamMul, stars, TIER_LABEL, merit, generate, payPreview, allowed, ensure, clubLevel, analyze, recommend, optName };
})();
