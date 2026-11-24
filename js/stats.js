/* stats.js — 데이터 센터: 경기 기록 집계(파이터 승률/상성/팀 선호도/리그 밴픽률) + 조회 */

const Stats = (() => {
  const blank = () => ({ n: 0, f: {}, vs: {}, team: {}, lg: {}, tac: {}, slot: {}, ord: {}, int: {} });
  const get = G => (G.stats = G.stats || blank());
  const roster = () => CONFIG.fighterOrder.filter(id => CONFIG.fighters[id] && !CONFIG.fighters[id].boss);
  const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
  const bucket = (o, k) => (o[k] = o[k] || { g: 0, p: {}, b: {} });

  /* 경기 1건 기록: ids=[A팀,B팀], picks/bans=[[A],[B]], winner=0|1|-1 */
  function record(G, r) {
    const S = get(G); S.n++;
    for (let i = 0; i < 2; i++) {
      const t = League.team(G, r.ids[i]), lg = t.lg || G.leagueId, key = lg + '|' + League.name(G, r.ids[i]);
      for (const B of [bucket(S.team, key), bucket(S.lg, lg)]) { B.g++; r.picks[i].forEach(f => inc(B.p, f)); r.bans[i].forEach(f => inc(B.b, f)); }
      r.picks[i].forEach(f => { const F = S.f[f] = S.f[f] || { g: 0, w: 0, b: 0 }; F.g++; if (r.winner === i) F.w++; });
      r.bans[i].forEach(f => { const F = S.f[f] = S.f[f] || { g: 0, w: 0, b: 0 }; F.b++; });
    }
    if (r.tac) for (let i = 0; i < 2; i++) {
      const win = r.winner === i, put = (root, c, o) => { const row = ((root[c] = root[c] || {})[o] = root[c][o] || [0, 0]); row[0]++; if (win) row[1]++; };
      S.tac = S.tac || {}; S.slot = S.slot || {};
      Object.keys(r.tac.st[i]).forEach(c => put(S.tac, c, r.tac.st[i][c]));
      (r.tac.sl[i] || []).forEach(s => Object.keys(s).forEach(c => put(S.slot, c, s[c])));
    }
    if (r.ord) {
      const S2 = S.ord = S.ord || {}, max = (CONFIG.battle && CONFIG.battle.maxTicks) || 3600;
      r.ord.forEach(o => {
        const win = r.winner === o.team, row = (S2[o.scope + ':' + o.id] = S2[o.scope + ':' + o.id] || {});
        ['all', 'ph:' + (o.t < max * 0.25 ? 'early' : o.t < max * 0.65 ? 'mid' : 'late'), 'ld:' + (o.lead <= -2 ? 'behind' : o.lead >= 2 ? 'ahead' : 'even'), o.boss ? 'boss:on' : 'boss:off'].concat(o.sudden ? ['sd'] : [])
          .forEach(tg => { const c = (row[tg] = row[tg] || [0, 0]); c[0]++; if (win) c[1]++; });
      });
    }
    if (r.int) for (let i = 0; i < 2; i++) {
      const row = r.int[i]; if (!row) continue;
      const root = S.int = S.int || {}, win = r.winner === i;
      for (const fid in row) {
        const F = root[fid] = root[fid] || { g: 0, w: 0, n: {} }, c = row[fid];
        F.g++; if (win) F.w++;
        for (const v in c) F.n[v] = (F.n[v] || 0) + c[v];
      }
    }
    for (const a of r.picks[0]) for (const b of r.picks[1]) {
      const x = (S.vs[a] = S.vs[a] || {})[b] = S.vs[a][b] || [0, 0], y = (S.vs[b] = S.vs[b] || {})[a] = S.vs[b][a] || [0, 0];
      x[0]++; y[0]++; if (r.winner === 0) x[1]++; else if (r.winner === 1) y[1]++;
    }
  }

  /* 파이터 전체 표: 경기수 g, 승 w, 승률 wr, 픽률 pr, 밴률 br */
  function fighters(G) {
    const S = get(G);
    return roster().map(id => { const F = S.f[id] || { g: 0, w: 0, b: 0 };
      return { id, g: F.g, w: F.w, b: F.b, wr: F.g ? F.w / F.g : 0, pr: S.n ? F.g / S.n : 0, br: S.n ? F.b / S.n : 0 }; });
  }
  /* 표본이 충분한 파이터만(기본 min경기). 부족하면 기준을 낮춰 최소 n명을 채웁니다 */
  function eligible(list, n, min) { let m = min; while (m > 1 && list.filter(x => x.g >= m).length < n) m--; return list.filter(x => x.g >= m && x.g > 0); }
  const minGames = G => Math.max(3, Math.round(get(G).n * 0.04));
  const topWin = (G, n) => eligible(fighters(G), n, minGames(G)).sort((a, b) => b.wr - a.wr || b.g - a.g).slice(0, n);
  const botWin = (G, n) => eligible(fighters(G), n, minGames(G)).sort((a, b) => a.wr - b.wr || b.g - a.g).slice(0, n);
  const topBy = (G, key, n) => fighters(G).filter(x => x[key] > 0).sort((a, b) => b[key] - a[key]).slice(0, n);

  /* 상대 파이터별 승률 */
  function matchups(G, id) {
    const row = get(G).vs[id] || {}, list = Object.keys(row).map(o => ({ id: o, g: row[o][0], w: row[o][1], wr: row[o][1] / row[o][0] })).filter(x => CONFIG.fighters[x.id]);
    return eligible(list, 5, 3);
  }
  /* 리그/팀 선호도 */
  function rates(B, key) { if (!B || !B.g) return { g: 0, list: [] }; return { g: B.g, list: Object.keys(B[key]).map(id => ({ id, n: B[key][id], rate: B[key][id] / B.g })).filter(x => CONFIG.fighters[x.id]).sort((a, b) => b.n - a.n) }; }
  const leagueRates = (G, lg) => { const B = get(G).lg[lg]; return { picks: rates(B, 'p'), bans: rates(B, 'b') }; };
  const teamRates = (G, lg, name) => { const B = get(G).team[lg + '|' + name]; return { picks: rates(B, 'p'), bans: rates(B, 'b') }; };

  /* 지시별 사용 횟수·승률과 상황별 최고/최저 (표본 min회 이상) */
  function orders(G, min = 3) {
    const S = get(G).ord || {}, wr = c => c[1] / c[0];
    return Object.keys(S).map(key => {
      const row = S[key], all = row.all || [0, 0], tags = Object.keys(row).filter(t => t !== 'all' && row[t][0] >= min).map(t => ({ tag: t, g: row[t][0], wr: wr(row[t]) })).sort((a, b) => b.wr - a.wr || b.g - a.g);
      const [scope, id] = key.split(':');
      return { key, scope, id, g: all[0], w: all[1], wr: all[0] ? wr(all) : 0, best: tags[0] || null, worst: tags.length > 1 ? tags[tags.length - 1] : null };
    }).sort((a, b) => b.g - a.g);
  }
  const tactics = G => ({ team: get(G).tac || {}, slot: get(G).slot || {} });
  /* 파이터별 의도 선택 비율: share[의도]=그 의도 선택 횟수/전체, g=경기수, wr=승률 */
  function intents(G) {
    const S = get(G).int || {};
    return Object.keys(S).filter(id => CONFIG.fighters[id]).map(id => {
      const F = S[id], tot = Object.values(F.n).reduce((a, b) => a + b, 0) || 1, share = {};
      Object.keys(F.n).forEach(v => { share[v] = F.n[v] / tot; });
      return { id, g: F.g, w: F.w, wr: F.g ? F.w / F.g : 0, share, n: F.n };
    }).sort((a, b) => b.g - a.g);
  }
  return { orders, tactics, intents, blank, get, record, fighters, topWin, botWin, topBy, matchups, leagueRates, teamRates, roster };
})();
