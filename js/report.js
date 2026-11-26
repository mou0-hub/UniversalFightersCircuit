/* report.js — 시즌 종합 리포트: 내 경기를 경기마다 기록해 두었다가, 시즌이 끝나면 패인(전력·밴픽·전술·인게임·컨디션)을 모아 보여줍니다.
   R(기준값)와 CAUSE(원인 문구) 표만 고치면 판정이 바뀝니다. 기록은 G.report = { season, rows } 에 저장됩니다. */

const Report = (() => {
  const R = { keep: 300, min: 3, gapBad: -3, compBad: -1.5, counterBad: 0.45, killGap: 3, dropGap: 3, depRatio: 0.8, deaths: 5, lead: 4, lowForm: 45, lowMental: 55, luckExp: 0.55 };
  const KIND = { league: '정규', playoff: '플레이오프', msi: 'MSI', worlds: '월드' };
  const CAUSE = {
    power:   ['선수 전력 열세', '상대 선발의 능력치·폼이 더 높았습니다. 선수 영입·성장·컨디션 관리가 가장 직접적인 해법입니다.'],
    comp:    ['조합 불리', '마법사·암살자 중복 등 조합 보정이 깎였거나 전열이 없었습니다. 밴픽 규칙을 점검하세요.'],
    counter: ['상성 불리', '픽한 파이터들이 상대 조합에게 누적 승률이 낮았습니다. 밴과 픽 순서를 바꿔볼 만합니다.'],
    boss:    ['보스 경쟁 패배', '보스 처치 횟수에서 밀렸습니다. 보스 태도·궁 운용·합류 타이밍을 확인하세요.'],
    kills:   ['교전 열세', '킬 수 차이가 크게 벌어졌습니다. 교전 성향·진형(분산 여부)을 점검하세요.'],
    carry:   ['코어 운반자 손실', '코어를 든 채 쓰러져 떨군 코어가 상대보다 많았습니다. 진형과 제출 리듬(가득/수시)을 점검하세요.'],
    deposit: ['제출 점수 부족', '제출로 쌓은 점수가 상대보다 적었습니다. 제출 리듬과 활동 영역을 점검하세요.'],
    collapse:['앞서다 역전패', '리드를 잡고도 뒤집혔습니다. 리드 때의 제출·수비 운영이 흔들렸을 수 있습니다.'],
    sudden:  ['서든데스 패배', '동점에서 서든데스에 갔다가 졌습니다. 마지막 교전 대응이 약했습니다.'],
    deaths:  ['특정 선수 데스 과다', '한 선수가 너무 자주 쓰러졌습니다. 포지션·표적 성향·거리 감각을 조정해 보세요.'],
    luck:    ['운(변동)', '전력·조합상 불리하지 않았는데 졌습니다. 표본이 쌓이면 평균으로 돌아오는 경우가 많습니다.'],
    unknown: ['원인 불분명', '뚜렷한 원인 신호가 잡히지 않았습니다.']
  };
  const FD = id => CONFIG.fighters[id];
  const isFront = f => !!(f.ai && f.ai.front && !f.ai.backline), isBack = f => !!(f.ai && f.ai.backline), isTank = f => isFront(f) || f.role === 'guardian';
  const avg = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const sum = (a, f = x => x) => a.reduce((s, x) => s + f(x), 0);
  const pct = (w, n) => (n ? Math.round(w / n * 100) : 0);
  const r1 = n => Math.round(n * 10) / 10;

  function compBonus(ids) {
    const fs = (ids || []).map(FD).filter(Boolean); let b = 0;
    if (fs.some(isTank)) b += 1.5;
    if (fs.filter(f => f.role === 'mage').length >= 2) b -= 2;
    if (fs.filter(f => f.role === 'assassin').length >= 2) b -= 1.5;
    return b;
  }
  function power(G, tm, picks, mine) {
    const ids = mine ? ((G.club && G.club.lineup) || []).filter(Boolean) : (League.team(G, tm.id).pros || []), mo = tm.moods || [];
    const ps = ids.map((id, i) => ({ p: Pros.get(G, id), m: mo[i] })).filter(x => x.p);
    const base = ps.length ? avg(ps.map(({ p, m }) => p.ovr + (((m && m.form) ?? p.form ?? 55) - 55) * 0.15 + (((m && m.mental) ?? p.mental ?? 70) - 70) * 0.08)) : 60;
    return { v: base + compBonus(picks), comp: compBonus(picks), form: ps.length ? avg(ps.map(({ p, m }) => (m && m.form) ?? p.form ?? 55)) : 55, mental: ps.length ? avg(ps.map(({ p, m }) => (m && m.mental) ?? p.mental ?? 70)) : 70 };
  }
  const teamSum = (rec, team, kind) => sum(rec.cores.filter(c => c.kind === kind && c.team === team), c => c.n || 0);

  /* 저장소: G.report = { rows: [...] } (행마다 s = 시즌). 구버전 { season, rows } 는 자동 변환 */
  function store(G) {
    const S = G.report = G.report || { rows: [] };
    S.seq = S.seq || 0; S.rows.forEach(r => { if (r.q == null) r.q = ++S.seq; });
    if (S.season != null) { S.rows.forEach(r => { if (r.s == null) r.s = S.season; }); delete S.season; }
    return S;
  }
  const rowsOf = (G, scope) => store(G).rows.filter(r => scope === 'all' || r.s === scope);

  /* 내 경기 1건 기록 (finishMatch 에서 호출) */
  function record(G, M, res) {
    try {
      const me = M.pIdx, op = 1 - me, S = store(G);
      const pm = power(G, M.teams[me], M.picks[me], true), po = power(G, M.teams[op], M.picks[op], false), diff = pm.v - po.v;
      const row = {
        s: G.season || 1, k: M.kind, w: res.winner === -1 ? 0.5 : res.winner === me ? 1 : 0, opp: M.teams[op].name, oppId: M.teams[op].id, me: M.picks[me].slice(), op: M.picks[op].slice(),
        bm: (M.bans[me] || []).slice(), bo: (M.bans[op] || []).slice(), fast: !!res.fast, sc: [res.score ? res.score[me] : 0, res.score ? res.score[op] : 0],
        pw: [r1(pm.v), r1(po.v)], cp: [pm.comp, po.comp], exp: res.fast ? 1 / (1 + Math.pow(10, -diff / 32)) : null, fm: [Math.round(pm.form), Math.round(pm.mental)],
        st: {}
      };
      const sg = M.teams[me].strategy || {}; Object.keys(sg).forEach(k => { if (sg[k] && sg[k][0]) row.st[k] = sg[k][0]; });
      const rec = res.rec;
      if (rec && !res.fast) {
        let d = 0, led = 0; rec.pts.forEach(p => { d += p.team === me ? p.pts : p.team === op ? -p.pts : 0; led = Math.max(led, d); });
        const bk = res.bossKills || [0, 0], deaths = (res.units || []).filter(u => u.team === me).map(u => u.deaths || 0);
        row.g = {
          kd: [rec.kills.filter(k => k.kt === me).length, rec.kills.filter(k => k.kt === op).length], first: rec.first ? (rec.first.kt === me ? 1 : rec.first.kt === op ? -1 : 0) : 0,
          boss: [bk[me] || 0, bk[op] || 0], flips: rec.flips.length, lastFlipOpp: rec.flips.length ? rec.flips[rec.flips.length - 1].team === op : false, led,
          drop: [teamSum(rec, me, 'drop'), teamSum(rec, op, 'drop')], dep: [teamSum(rec, me, 'deposit'), teamSum(rec, op, 'deposit')], maxDeaths: Math.max(0, ...deaths), sudden: !!res.sudden
        };
      }
      row.q = ++S.seq; S.rows.push(row);
      if (res.units) { const L = snap(M, res, me, op); L.q = row.q; S.last = L; }
       if (S.rows.length > R.keep) S.rows.splice(0, S.rows.length - R.keep);
    } catch (e) { console.warn('Report.record', e); }
  }

  /* 상성: 내 픽이 상대 픽을 상대로 누적 승률이 어땠는지 (표본 R.min 이상 쌍만) */
  function counterOf(G, row) {
    const vs = (G.stats && G.stats.vs) || {}, v = [];
    row.me.forEach(a => row.op.forEach(b => { const c = vs[a] && vs[a][b]; if (c && c[0] >= R.min) v.push(c[1] / c[0]); }));
    return v.length >= 3 ? avg(v) : null;
  }
  function causesOf(r) {
    const out = [], g = r.g;
    if (r.fast && r.pw[0] - r.pw[1] <= R.gapBad) out.push('power');      // 능력치 차이는 빠른 진행 경기에서만 승패에 반영됨
    if (r.cp[0] - r.cp[1] <= R.compBad) out.push('comp');
    if (r.counter != null && r.counter < R.counterBad) out.push('counter');
    if (g) {
      if (g.boss[1] > g.boss[0]) out.push('boss');
      if (g.kd[1] - g.kd[0] >= R.killGap) out.push('kills');
      if (g.drop[0] - g.drop[1] >= R.dropGap) out.push('carry');
      if (g.dep[1] > 0 && g.dep[0] < g.dep[1] * R.depRatio) out.push('deposit');
      if (g.led >= R.lead && g.lastFlipOpp) out.push('collapse');
      if (g.sudden) out.push('sudden');
      if (g.maxDeaths >= R.deaths) out.push('deaths');
    }
    if (!out.length) out.push(r.fast && r.exp >= R.luckExp ? 'luck' : 'unknown');
    return out;
  }
  const rate = (rows, f) => { const n = rows.filter(f); return { n: n.length, w: sum(n, x => x.w), wr: pct(sum(n, x => x.w), n.length) }; };


  /* ---------- AI 전술 보정: 최근 실제 전투의 패인을 보고 팀 전술 축을 한 단계씩 조정 ----------
     규칙·기준은 CONFIG.report.adapt 표. 직접 설정한 전술에는 적용하지 않고, 자동 전술(autoPlan)에만 얹습니다. */
  const AD = () => (CONFIG.report && CONFIG.report.adapt) || { on: false, rules: [] };
  function adaptState(G) { const A = G.adapt = G.adapt || { q: 0, set: {}, log: [] }; A.set = A.set || {}; A.log = A.log || []; return A; }
  /* 자동 전술에 누적된 보정값을 얹고, 새 표본이 충분하면 패인을 분석해 보정을 추가합니다. 바뀐 항목 문구를 돌려줍니다 */
  function adapt(G, strat) {
    const C = AD(); if (!C.on || !strat) return [];
    const A = adaptState(G), St = store(G), cur = k => (strat[k] ? strat[k][0] : null);
    Object.keys(A.set).forEach(k => { const v = A.set[k]; if (strat[k] && v && v.from && v.from.includes(strat[k][0])) strat[k] = [v.to, strat[k][1]]; });      // 보정은 해당 항목이 문제의 값일 때만 얹음
    const rows = St.rows.filter(r => !r.fast && r.q > A.q), losses = rows.filter(r => r.w === 0);
    if (rows.length < C.minGames || losses.length < C.minLosses) return [];
    const tally = {}; losses.forEach(r => { r.counter = counterOf(G, r); causesOf(r).forEach(c => { tally[c] = (tally[c] || 0) + 1; }); });
    const top = Object.keys(tally).filter(c => tally[c] / losses.length >= C.share).sort((a, b) => tally[b] - tally[a]), done = new Set(), changes = [];
    top.forEach(c => {
      if (changes.length >= C.max) return;
      const rule = (C.rules || []).find(x => x.cause === c && !done.has(x.axis) && x.from.includes(cur(x.axis)));
      if (!rule) return;
      const ax = CONFIG.tactics.team.find(t => t.id === rule.axis), from = ax && ax.options.find(o => o.id === cur(rule.axis)), to = ax && ax.options.find(o => o.id === rule.to);
      if (!to) return;
      strat[rule.axis] = [rule.to, strat[rule.axis][1]]; A.set[rule.axis] = { from: rule.from, to: rule.to }; done.add(rule.axis);
      changes.push(`${CAUSE[c][0]} ${tally[c]}/${losses.length}패 → ${ax.name} '${from ? from.name : '-'}' → '${to.name}'`);
    });
    A.q = St.seq;
    if (changes.length) { A.log.push({ s: G.season || 1, games: rows.length, losses: losses.length, changes }); if (A.log.length > 20) A.log.shift(); }
    return changes;
  }

  function build(G, rows) {
    if (!rows || !rows.length) return null;
    rows.forEach(r => { r.counter = counterOf(G, r); });
    const n = rows.length, w = sum(rows, r => (r.w === 1 ? 1 : 0)), d = sum(rows, r => (r.w === 0.5 ? 1 : 0)), l = n - w - d, fastRows = rows.filter(r => r.fast), expW = sum(fastRows, r => r.exp);
    const losses = rows.filter(r => r.w === 0), tally = {};
    losses.forEach(r => { r.cs = causesOf(r); r.cs.forEach(c => { tally[c] = (tally[c] || 0) + 1; }); });
    const causes = Object.keys(tally).map(c => ({ id: c, n: tally[c], pct: pct(tally[c], losses.length) })).sort((a, b) => b.n - a.n);
    const fastN = rows.filter(r => r.fast).length, realRows = rows.filter(r => !r.fast);

    const arch = [['전열 없음', r => !r.me.some(i => FD(i) && isTank(FD(i)))], ['마법사 2명 이상', r => r.me.filter(i => FD(i) && FD(i).role === 'mage').length >= 2],
      ['암살자 2명 이상', r => r.me.filter(i => FD(i) && FD(i).role === 'assassin').length >= 2], ['후열 3명', r => r.me.filter(i => FD(i) && isBack(FD(i))).length >= 3],
      ['상성 불리(45% 미만)', r => r.counter != null && r.counter < R.counterBad], ['선호 캐릭터 밴 당함', r => { const f = favOf(G); return r.bo.some(b => f.has(b)); }]]
      .map(([name, f]) => ({ name, ...rate(rows, f) })).filter(x => x.n > 0);
    const fm = {}; rows.forEach(r => r.me.forEach(f => { const e = fm[f] = fm[f] || { id: f, n: 0, w: 0 }; e.n++; e.w += r.w; }));
    const lg = {}; (Stats.fighters ? Stats.fighters(G) : []).forEach(x => { lg[x.id] = x; });
    const fighters = Object.values(fm).filter(x => x.n >= R.min).map(x => ({ ...x, wr: pct(x.w, x.n), lg: lg[x.id] && lg[x.id].g >= 5 ? Math.round(lg[x.id].wr * 100) : null })).sort((a, b) => a.wr - b.wr);

    const axes = (CONFIG.tactics.team || []).filter(c => CONFIG.tactics.pre.team.includes(c.id)).map(c => ({
      id: c.id, name: c.name, opts: c.options.map(o => ({ name: o.name, ...rate(realRows, r => r.st[c.id] === o.id) })).filter(o => o.n > 0)
    })).filter(a => a.opts.length);
    const low = rate(rows, r => r.fm[0] < R.lowForm || r.fm[1] < R.lowMental), ok = rate(rows, r => !(r.fm[0] < R.lowForm || r.fm[1] < R.lowMental));
    const bad = rate(rows, r => r.pw[0] - r.pw[1] <= R.gapBad), even = rate(rows, r => Math.abs(r.pw[0] - r.pw[1]) < Math.abs(R.gapBad)), good = rate(rows, r => r.pw[0] - r.pw[1] >= -R.gapBad);
    return { rows, n, w, d, l, expW, fastN, realN: realRows.length, causes, losses: losses.length, arch, fighters, axes, low, ok, bad, even, good, gap: avg(rows.map(r => r.pw[0] - r.pw[1])), form: avg(rows.map(r => r.fm[0])), mental: avg(rows.map(r => r.fm[1])) };
  }
  const favOf = G => new Set(((G.club && G.club.lineup) || []).filter(Boolean).flatMap(id => (Pros.get(G, id) || {}).favs || []));

  function findings(m) {
    const out = [], rec = `전적 ${m.w}승 ${m.d ? m.d + '무 ' : ''}${m.l}패 (승률 ${pct(m.w, m.n)}%)`;
    if (m.fastN >= R.min) { const fw = sum(m.rows.filter(r => r.fast), r => (r.w === 1 ? 1 : r.w === 0.5 ? 0.5 : 0)), diff = fw - m.expW; out.push(`${rec} · 빠른 진행 ${m.fastN}경기는 능력치 기준 기대 ${r1(m.expW)}승 대비 ${r1(fw)}승(${diff <= -1.5 ? '기대보다 낮음' : diff >= 1.5 ? '기대보다 높음' : '전력대로'}).`); }
    else out.push(`${rec}.`);
    if (m.realN) out.push(`실제 전투 ${m.realN}경기에서는 선수 능력치·등급(전력차)이 승패에 거의 반영되지 않습니다. 결과는 파이터 픽·상성, 전술, 인게임 판단이 좌우합니다. (평균 전력차 ${m.gap > 0 ? '+' : ''}${r1(m.gap)}는 참고용)`);
    if (m.bad.n >= R.min && m.good.n >= R.min && m.fastN > m.realN) out.push(`전력 열세 경기 승률 ${m.bad.wr}% / 우세 경기 ${m.good.wr}%.`);
    if (m.fastN > m.n / 2) out.push(`빠른 진행(${m.fastN}경기)에서는 전술과 인게임이 반영되지 않고 능력치·폼·조합 보정으로만 결과가 정해집니다.`);
    if (m.low.n >= R.min && m.low.wr + 15 <= m.ok.wr) out.push(`폼·멘탈이 낮았던 ${m.low.n}경기 승률 ${m.low.wr}% (정상 ${m.ok.wr}%): 컨디션이 성적에 영향을 줬습니다.`);
    m.arch.filter(x => x.n >= R.min && x.wr <= 35).forEach(x => out.push(`'${x.name}' 경기 ${x.n}판 승률 ${x.wr}%.`));
    return out;
  }

  const row2 = (a, b, c, d) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td><td>${d == null ? '' : d}</td></tr>`;
  const fn = id => (FD(id) ? FD(id).name : id);
  const topCause = m => (m && m.causes[0] ? CAUSE[m.causes[0].id][0] : '-');

  function body(G, m) {
    const cs = m.causes.map(c => `<li><b>${CAUSE[c.id][0]}</b> — ${c.n}패 (${c.pct}%) · ${CAUSE[c.id][1]}</li>`).join('');
    const arch = m.arch.map(x => row2(x.name, x.n + '경기', x.wr + '%', '')).join('');
    const fg = m.fighters.slice(0, 3).concat(m.fighters.length > 3 ? m.fighters.slice(-2) : []).filter((x, i, a) => a.indexOf(x) === i).map(x => row2(fn(x.id), x.n + '경기', x.wr + '%', x.lg == null ? '' : '리그 ' + x.lg + '%')).join('');
    const ax = m.axes.map(a => `<tr><td>${a.name}</td><td colspan="3">${a.opts.map(o => `${o.name} ${o.n}경기 ${o.wr}%`).join(' · ')}</td></tr>`).join('');
    const log = m.rows.slice(-40).reverse().map(r => `<tr><td>${r.s}시즌 ${KIND[r.k] || r.k}</td><td>${r.opp}</td><td>${r.w === 1 ? '승' : r.w === 0.5 ? '무' : '패'} ${r.sc[0]}:${r.sc[1]}</td><td>${r.pw[0] - r.pw[1] > 0 ? '+' : ''}${r1(r.pw[0] - r.pw[1])}${r.fast ? ' · 빠른' : ''}${r.cs ? ' · ' + r.cs.map(c => CAUSE[c][0]).join(', ') : ''}</td></tr>`).join('');
    return `<ul class="notes">${findings(m).map(x => `<li>${x}</li>`).join('')}</ul>
      ${cs ? `<h3>패인 분석 (${m.losses}패 · 한 경기에 여러 원인 중복 집계)</h3><ul class="notes">${cs}</ul>` : ''}
      ${arch || fg ? `<h3>🎯 밴픽·조합</h3><table class="tbl small"><thead><tr><th>상황</th><th>표본</th><th>승률</th><th></th></tr></thead><tbody>${arch}${fg ? '<tr><th colspan="4">파이터별 (낮은 순 · 높은 순)</th></tr>' + fg : ''}</tbody></table>` : ''}
      ${ax ? `<h3>🧭 전술 (실제 전투 경기 기준)</h3><table class="tbl small"><tbody>${ax}</tbody></table>` : ''}
      <h3>🗒 경기별 기록 (최근 ${Math.min(40, m.rows.length)}경기)</h3><table class="tbl small"><thead><tr><th>구분</th><th>상대</th><th>결과</th><th>전력차 · 패인</th></tr></thead><tbody>${log}</tbody></table>`;
  }

  /* 시즌 종료/건너뛰기 직후 팝업: 이번 시즌 */
  function html(G) {
    const m = build(G, rowsOf(G, G.season));
    if (!m) return `<div class="res-head"><h2>📊 시즌 리포트</h2><p>이번 시즌에 기록된 내 경기가 없습니다.</p></div>`;
    return `<div class="res-head"><h2>📊 시즌 종합 리포트</h2><p>${m.n}경기 분석 (실제 전투 ${m.realN} · 빠른 진행 ${m.fastN})</p></div>${body(G, m)}
      <p style="margin-top:12px"><button class="btn small primary" data-ui="reportRoom">리포트 룸에서 시즌별·전체 보기</button> <button class="btn small" data-ui="summary">시즌 요약 보기</button></p>`;
  }

  const MA = () => Object.assign({ name: '전투 분석관', img: 'img/analyst/MatchAnalyst.png' }, (CONFIG.report && CONFIG.report.matchAnalyst) || {});
  const rel = (t, me) => (t === me ? 0 : 1);
  const r2 = n => Math.round(n * 100) / 100;
  const tOf = e => { const v = e ? [e.t, e.tick, e.time, e.at].find(x => typeof x === 'number') : null; return v == null ? null : v; };
  const pc = (a, b) => (b > 0 ? Math.round(a / b * 100) : 0);
  const sgn = n => (n > 0 ? '+' : '') + r1(n);
  const roleOf = f => { const r = f && CONFIG.roles && CONFIG.roles[f.role]; return r ? `${r.icon || ''} ${r.name}` : ''; };
  const sp = id => (FD(id) && typeof Sprites !== 'undefined' ? `<img class="px lm-sp" src="${Sprites.url(FD(id))}" alt="">` : '');
  const bar = (a, b) => `<div class="lm-bar"><i class="a" style="width:${a + b > 0 ? Math.round(a / (a + b) * 100) : 50}%"></i><i class="b" style="width:${a + b > 0 ? 100 - Math.round(a / (a + b) * 100) : 50}%"></i></div>`;

  function snap(M, res, me, op) {
    const rec = res.rec, CT = (CONFIG.battle && CONFIG.battle.tickMs) || 50, mo = (M.teams[me] && M.teams[me].moods) || [], bk = res.bossKills || [0, 0];
    const stOf = t => { const s = (M.teams[t] && M.teams[t].strategy) || {}, o = {}; Object.keys(s).forEach(k => { if (s[k] && s[k][0]) o[k] = s[k][0]; }); return o; };
    const L = {
      fast: !!res.fast, ticks: res.ticks || 0, ms: CT, sudden: !!res.sudden, hp: res.hp ? [r1(res.hp[me] * 100), r1(res.hp[op] * 100)] : null,
      score: res.score ? [r1(res.score[me]), r1(res.score[op])] : [0, 0], boss: [bk[me] || 0, bk[op] || 0], mvp: res.mvpTeam == null ? null : [rel(res.mvpTeam, me), res.mvpFighter],
      u: (res.units || []).map(u => { const m = u.team === me ? mo[u.slot] : null; return [rel(u.team, me), u.ch.id, u.nick || (m && m.nick) || '', u.slot, u.kills || 0, u.deaths || 0, Math.round(u.dmg || 0), Math.round(u.healed || 0), r1(u.dpts || 0), u.deliv || 0, u.alive ? 1 : 0, m && m.form != null ? Math.round(m.form) : null, m && m.mental != null ? Math.round(m.mental) : null]; }),
      tac: res.tac && res.tac.st ? [res.tac.st[me] || {}, res.tac.st[op] || {}] : [stOf(me), stOf(op)], sl: res.tac && res.tac.sl ? [res.tac.sl[me] || [], res.tac.sl[op] || []] : null, pe: [], ke: [], fl: [], timed: false
    };
    if (rec && !res.fast && rec.pts && rec.kills) {
      const all = rec.pts.concat(rec.kills), ts = all.map(tOf), timed = all.length > 0 && ts.every(x => x != null), mx = timed ? Math.max(...ts) : 0, sec = L.ticks * CT / 1000;
      const span = !timed ? 1 : mx <= L.ticks * 1.02 ? Math.max(L.ticks, 1) : mx <= sec * 1.02 ? Math.max(sec, 1) : Math.max(mx, 1);
      const fr = (e, i, n) => (timed ? Math.min(1, Math.max(0, tOf(e) / span)) : n > 1 ? i / (n - 1) : 0.5);
      L.timed = timed;
      L.pe = rec.pts.map((p, i) => [r2(fr(p, i, rec.pts.length)), rel(p.team, me), r2(p.pts || 0)]).slice(-400);
      L.ke = rec.kills.map((k, i) => [r2(fr(k, i, rec.kills.length)), rel(k.kt, me)]).slice(-200);
      L.fl = (rec.flips || []).map(f => rel(f.team, me));
    }
    return L;
  }

  function factors(row, L) {
    const g = row.g; if (!g) return [];
    const u = (L && L.u) || [], mine = u.filter(x => x[0] === 0), foe = u.filter(x => x[0] === 1), S = (l, i) => sum(l, x => x[i]), f = [];
    const add = (id, name, a, b, w, inv, unit) => { const d = (inv ? -1 : 1) * (a - b) / Math.max(1, a + b); f.push({ id, name, a, b, unit, d, imp: w * d }); };
    add('dep', '코어 제출', g.dep[0], g.dep[1], 1, false, '개');
    add('kills', '킬 교환', g.kd[0], g.kd[1], 0.8, false, '킬');
    add('boss', '보스 처치', g.boss[0], g.boss[1], 0.7, false, '회');
    add('drop', '코어 드롭(손실)', g.drop[0], g.drop[1], 0.5, true, '개');
    add('first', '선취점', g.first > 0 ? 1 : 0, g.first < 0 ? 1 : 0, 0.25, false, '');
    if (mine.length && foe.length) { add('dmg', '총 피해량', S(mine, 6), S(foe, 6), 0.35, false, ''); add('heal', '총 치유량', S(mine, 7), S(foe, 7), 0.15, false, ''); }
    if (L && L.hp) add('hp', '종료 시 체력', L.hp[0], L.hp[1], 0.3, false, '%');
    return f.sort((a, b) => Math.abs(b.imp) - Math.abs(a.imp));
  }
  const HINT = {
    dep: ['제출 점수로 격차를 만들었습니다', '제출이 상대보다 적었습니다 — 제출 리듬·활동 영역·운반자 보호를 점검하세요'],
    kills: ['교전에서 우위였습니다', '교전에서 밀렸습니다 — 교전 성향·진형(분산 여부)·상성을 점검하세요'],
    boss: ['보스 경쟁에서 앞섰습니다', '보스 경쟁에서 밀렸습니다 — 보스 태도·궁 운용·합류 타이밍을 확인하세요'],
    drop: ['코어 손실이 적었습니다', '코어를 든 채 더 많이 쓰러졌습니다 — 진형과 제출 리듬(가득/수시)을 점검하세요'],
    first: ['선취점으로 주도권을 잡았습니다', '선취점을 내줬습니다 — 초반 진입·교전 판단을 점검하세요'],
    dmg: ['딜량 우위', '딜량 열세 — 딜러 생존·사거리·상성을 확인하세요'],
    heal: ['치유 우위', '치유 열세'],
    hp: ['생존 체력 우위로 마무리', '체력 열세로 종료 — 교전 손실이 누적됐습니다']
  };

  function unitNotes(x, mine, mvp) {
    const T = k => sum(mine, y => y[k]), tk = T(4), td = T(5), tdmg = T(6), tdv = T(9), th = T(7), f = FD(x[1]), n = [], [, , , , k, d, dmg, heal, , dv, , form, mental] = x;
    if (mvp) n.push(['ok', '이 경기 MVP']);
    if (d >= R.deaths) n.push(['bad', `데스 ${d}회 — 기준(${R.deaths}회) 이상입니다. 포지션·표적 성향·거리 감각을 조정하세요`]);
    else if (td >= 4 && d / td >= 0.5) n.push(['bad', `팀 데스의 ${pc(d, td)}%(${d}/${td})가 이 선수에게 몰렸습니다`]);
    if (tk >= 3 && tdmg > 0 && dmg / tdmg >= 0.45 && k / tk <= 0.15) n.push(['bad', `피해는 팀의 ${pc(dmg, tdmg)}%를 넣었지만 킬은 ${k}회뿐 — 마무리가 약합니다`]);
    else if (tk >= 3 && k === Math.max(...mine.map(y => y[4])) && k > 0) n.push(['ok', `킬 ${k}회로 팀 최다 (팀 킬의 ${pc(k, tk)}%)`]);
    if (tdv >= 3 && dv > 0 && dv === Math.max(...mine.map(y => y[9])) && dv / tdv >= 0.5) n.push(['ok', `코어 제출 ${dv}회 — 팀 제출의 ${pc(dv, tdv)}%를 책임`]);
    else if (tdv >= 3 && dv === 0 && f && !isTank(f)) n.push(['bad', `코어 제출이 한 번도 없습니다 (팀 ${tdv}회)`]);
    if (th > 0 && heal > 0 && heal / th >= 0.6) n.push(['ok', `치유 ${heal} — 팀 치유의 ${pc(heal, th)}%`]);
    if (tdmg > 0 && f && !isTank(f) && heal / Math.max(1, th) < 0.3 && dmg / tdmg <= 0.15) n.push(['bad', `피해 기여 ${pc(dmg, tdmg)}%로 낮습니다 — 딜러·화력 역할이면 생존·사거리를 점검하세요`]);
    if (form != null && form < R.lowForm) n.push(['bad', `폼 ${form} — 컨디션이 낮은 상태로 출전했습니다`]);
    if (mental != null && mental < R.lowMental) n.push(['bad', `멘탈 ${mental} — 낮은 상태로 출전했습니다`]);
    return n.length ? n : [['', '뚜렷한 특이점이 없습니다']];
  }

  function quarters(L) {
    const q = [0, 1, 2, 3].map(() => ({ p: [0, 0], k: [0, 0], end: null })), at = f => Math.min(3, Math.floor(f * 4));
    let d = 0, hi = 0, lo = 0;
    (L.pe || []).forEach(e => { d += e[1] === 0 ? e[2] : -e[2]; hi = Math.max(hi, d); lo = Math.min(lo, d); q[at(e[0])].p[e[1]] += e[2]; q[at(e[0])].end = d; });
    (L.ke || []).forEach(e => { q[at(e[0])].k[e[1]]++; });
    let prev = 0; q.forEach(x => { if (x.end == null) x.end = prev; prev = x.end; });
    return { q, hi: r1(hi), lo: r1(lo) };
  }

  function lastMatch(G, H) {
    const S = store(G), row = S.rows[S.rows.length - 1], A = MA();
    const shell = (say, inner) => `<div class="lm-wrap"><aside class="lm-who"><div class="lm-photo"><span>🕵️</span><img src="${A.img}" alt="${A.name}" onerror="this.remove()"></div><div><b class="lm-name">${A.name}</b><p class="lm-bubble">${say}</p></div></aside><div class="lm-main">${inner}</div></div>`;
    if (!row) return shell('아직 기록된 경기가 없습니다. 경기를 치르면 마지막 경기의 상세 분석이 여기에 나옵니다.', '<p class="empty">기록된 경기가 없습니다.</p>');
    const L = S.last && S.last.q === row.q ? S.last : null, g = row.g, win = row.w === 1, loss = row.w === 0, cls = win ? 'win' : loss ? 'lose' : 'draw', tag = win ? '승리' : loss ? '패배' : '무승부';
    row.counter = counterOf(G, row);
    const causes = loss ? causesOf(row) : [], u = (L && L.u) || [], mine = u.filter(x => x[0] === 0), foe = u.filter(x => x[0] === 1), fac = factors(row, L);
    const nm = id => (FD(id) ? FD(id).name : id), sec = L ? r1(L.ticks * L.ms / 1000) : null;
    const head = `<div class="lm-head"><span class="lm-badge ${cls}">${tag}</span><span class="lm-score">${Math.floor(row.sc[0])} : ${Math.floor(row.sc[1])}</span><span class="lm-meta">${row.s}시즌 ${KIND[row.k] || row.k} · ${G.teamName || '우리 팀'} vs ${row.opp}${sec ? ` · ${sec}초 · ${L.sudden ? '서든데스 결정' : '시간 종료 판정'}` : ''}${row.fast ? ' · 빠른 진행(전투 기록 없음)' : ''}</span></div>`;
    const dec = fac.filter(x => (win ? x.imp > 0.06 : loss ? x.imp < -0.06 : Math.abs(x.imp) > 0.06)).slice(0, 3), con = fac.filter(x => (win ? x.imp < -0.06 : loss ? x.imp > 0.06 : false)).slice(0, 2);
    let say;
    if (!g) say = row.fast ? `빠른 진행으로 처리된 경기라 킬·점수 흐름·선수 기록이 없습니다. 능력치와 조합 기준으로만 분석합니다.${row.exp != null ? ` 기대 승률은 ${Math.round(row.exp * 100)}%였고 결과는 ${tag}입니다.` : ''}` : '이 경기는 전투 기록 없이 저장돼 있어 요약 지표만 분석합니다. 다음 경기부터 상세 기록이 쌓입니다.';
    else {
      const dn = dec.map(x => `"${x.name}"`).join(', ');
      say = win ? `이겼습니다. ${dn ? `승부를 가른 건 ${dn}입니다.` : '압도적인 지표가 없는 접전이었습니다.'}${con.length ? ` 다만 "${con[0].name}"은 오히려 밀렸습니다. 이 부분은 상대가 약했거나 운이 따른 겁니다.` : ''}`
        : loss ? `졌습니다. ${dn ? `격차가 가장 크게 난 지표는 ${dn}입니다.` : '뚜렷하게 밀린 지표가 없는 박빙이었습니다.'}${con.length ? ` "${con[0].name}"은 앞섰는데도 졌으니, 점수로 연결되는 지표에서 졌다는 뜻입니다.` : ''}`
        : `무승부입니다. ${fac[0] ? `가장 차이가 난 지표는 "${fac[0].name}"입니다.` : ''}`;
    }
    const act = [];
    if (loss) causes.forEach(c => {
      const ev = ({ power: `전력 ${sgn(row.pw[0] - row.pw[1])}`, comp: `조합 보정 ${sgn(row.cp[0])} vs ${sgn(row.cp[1])}`, counter: row.counter != null ? `누적 상성 승률 ${Math.round(row.counter * 100)}%` : '', boss: g ? `보스 ${g.boss[0]}:${g.boss[1]}` : '', kills: g ? `킬 ${g.kd[0]}:${g.kd[1]}` : '', carry: g ? `코어 드롭 ${g.drop[0]}:${g.drop[1]}` : '', deposit: g ? `제출 ${g.dep[0]}:${g.dep[1]}` : '', collapse: g ? `최대 ${g.led}점 앞서다 역전` : '', sudden: '동점 → 서든데스', deaths: g ? `한 선수 최다 ${g.maxDeaths}데스` : '', luck: row.exp != null ? `기대 승률 ${Math.round(row.exp * 100)}%` : '' })[c] || '';
      const cur = L && L.tac ? L.tac[0] : row.st || {}, rule = ((AD().rules) || []).find(x => x.cause === c && (x.from || []).includes(cur[x.axis])), ax = rule && (CONFIG.tactics.team || []).find(t => t.id === rule.axis);
      const fo = ax && ax.options.find(o => o.id === cur[rule.axis]), to = ax && ax.options.find(o => o.id === rule.to);
      act.push(['bad', `<b>${CAUSE[c][0]}</b>${ev ? ` (${ev})` : ''} — ${CAUSE[c][1]}${to ? ` <u>제안: ${ax.name} '${fo ? fo.name : '-'}' → '${to.name}'</u>` : ''}`]);
    });
    else if (g) {
      if (g.kd[1] - g.kd[0] >= R.killGap) act.push(['bad', `킬 ${g.kd[0]}:${g.kd[1]}로 밀렸는데 이겼습니다. 같은 교전 패턴이면 다음엔 집니다.`]);
      if (g.dep[1] > g.dep[0]) act.push(['bad', `제출은 ${g.dep[0]}:${g.dep[1]}로 밀렸습니다. 점수를 다른 경로로 얻은 승리라 재현성이 낮습니다.`]);
      if (g.drop[0] - g.drop[1] >= R.dropGap) act.push(['bad', `코어 드롭이 ${g.drop[0]}:${g.drop[1]}로 많았습니다. 운반자 보호가 약합니다.`]);
      if (g.sudden) act.push(['bad', '서든데스까지 간 승부였습니다. 마지막 교전 운영이 승패를 갈랐으니 재현 가능한지 확인하세요.']);
      if (g.maxDeaths >= R.deaths) act.push(['bad', `한 선수가 ${g.maxDeaths}번 쓰러졌습니다. 이겼어도 포지션 문제입니다.`]);
    }
    if (row.fm && (row.fm[0] < R.lowForm || row.fm[1] < R.lowMental)) act.push(['bad', `폼 ${row.fm[0]} · 멘탈 ${row.fm[1]} — 컨디션이 낮은 상태로 출전했습니다. 휴식·시설·피드백으로 먼저 끌어올리세요.`]);
    if (!act.length) act.push(['ok', win ? '뚜렷한 약점 신호가 없습니다. 상대 전력이 낮았던 건 아닌지 전력차도 함께 보세요.' : '뚜렷한 원인 신호가 없습니다. 표본이 더 쌓여야 판단할 수 있습니다.']);
    const panels = [];
    panels.push(H.panel('핵심 결론 · 다음 액션', loss ? `패인 ${causes.length}개` : win ? '이긴 경기의 위험 신호' : '무승부', `<ul class="lm-ul">${act.map(a => `<li class="${a[0]}">${a[1]}</li>`).join('')}</ul>`));
    if (fac.length) panels.push(H.panel('승부를 가른 지표', '내 팀(파랑) : 상대(빨강)', `${fac.map(x => `<div class="lm-fr"><span>${x.name}</span><div>${bar(x.a, x.b)}<small class="lm-fv">${x.a}${x.unit} : ${x.b}${x.unit}</small></div><em class="lm-vd ${x.d > 0.2 ? 'ok' : x.d < -0.2 ? 'bad' : ''}">${x.d > 0.2 ? '우세' : x.d < -0.2 ? '열세' : '비슷'}</em></div>`).join('')}<ul class="lm-ul">${fac.filter(x => Math.abs(x.d) > 0.2).slice(0, 5).map(x => `<li class="${x.d > 0 ? 'ok' : 'bad'}">${x.name}: ${HINT[x.id][x.d > 0 ? 0 : 1]}</li>`).join('')}</ul>`));
    if (L && mine.length) {
      const myTot = L.score[0], foeTot = L.score[1], myDp = r1(sum(mine, x => x[8])), foeDp = r1(sum(foe, x => x[8])), myO = r1(Math.max(0, myTot - myDp)), foeO = r1(Math.max(0, foeTot - foeDp));
      const eff = (dep, drop) => (dep + drop > 0 ? Math.round(dep / (dep + drop) * 100) : null);
      const e0 = g ? eff(g.dep[0], g.drop[0]) : null, e1 = g ? eff(g.dep[1], g.drop[1]) : null;
      panels.push(H.panel('점수 구성 · 코어 운영', '제출 점수 외에는 킬·보스 등 기타 점수', `<div class="lm-fr"><span>제출 점수</span><div>${bar(myDp, foeDp)}<small class="lm-fv">${myDp} : ${foeDp}</small></div><em class="lm-vd ${myDp > foeDp ? 'ok' : myDp < foeDp ? 'bad' : ''}">${myDp > foeDp ? '우세' : myDp < foeDp ? '열세' : '비슷'}</em></div><div class="lm-fr"><span>기타 점수</span><div>${bar(myO, foeO)}<small class="lm-fv">${myO} : ${foeO}</small></div><em class="lm-vd ${myO > foeO ? 'ok' : myO < foeO ? 'bad' : ''}">${myO > foeO ? '우세' : myO < foeO ? '열세' : '비슷'}</em></div>
        <ul class="lm-ul"><li>내 점수 ${myTot}점 중 제출 ${myDp}점(${pc(myDp, myTot)}%) · 상대 ${foeTot}점 중 제출 ${foeDp}점(${pc(foeDp, foeTot)}%)</li>${e0 != null ? `<li class="${e0 >= (e1 == null ? 0 : e1) ? 'ok' : 'bad'}">제출 효율(제출 ÷ 제출+드롭): 내 ${e0}%${e1 != null ? ` · 상대 ${e1}%` : ''}</li>` : ''}</ul>`));
    }
    if (L && (L.pe.length || L.ke.length)) {
      const Q = quarters(L), lab = i => (L.timed ? `${r1(sec * i / 4)}~${r1(sec * (i + 1) / 4)}초` : `${i + 1}구간`), lines = [];
      if (g) {
        lines.push(`<li>최대 리드 ${sgn(Q.hi)}점 · 최대 열세 ${sgn(Q.lo)}점 · 선두 교체 ${g.flips}회${L.pe[0] ? ` · 첫 득점은 ${L.pe[0][1] === 0 ? '우리' : '상대'}` : ''}</li>`);
        if (loss && g.led >= R.lead) lines.push(`<li class="bad">${g.led}점 앞서다 역전당했습니다. 리드를 잡은 뒤 제출·수비 운영이 무너졌습니다.</li>`);
        if (win && Q.lo <= -R.lead) lines.push(`<li class="ok">최대 ${-Q.lo}점 뒤처졌다가 뒤집었습니다. 후반 운영이 통했습니다.</li>`);
        const last = Q.q[3]; if (last.p[1] > last.p[0]) lines.push(`<li class="bad">마지막 구간 득점이 ${r1(last.p[0])}:${r1(last.p[1])}로 밀렸습니다. 막판 대응이 약합니다.</li>`);
        const worst = Q.q.map((x, i) => ({ i, v: x.p[0] - x.p[1] })).sort((a, b) => a.v - b.v)[0]; if (worst.v < 0) lines.push(`<li class="bad">가장 크게 밀린 구간은 ${lab(worst.i)}(득점 차 ${sgn(worst.v)})입니다.</li>`);
      }
      panels.push(H.panel('경기 흐름', L.timed ? '시간 4등분' : '득점·킬 발생 순서 4등분 (시간 정보 없음)', `${Q.q.map((x, i) => `<div class="lm-fr"><span>${lab(i)}</span><div>${bar(x.p[0], x.p[1])}<small class="lm-fv">득점 ${r1(x.p[0])}:${r1(x.p[1])} · 킬 ${x.k[0]}:${x.k[1]} · 구간 말 점수차 ${sgn(x.end)}</small></div><em class="lm-vd ${x.p[0] > x.p[1] ? 'ok' : x.p[0] < x.p[1] ? 'bad' : ''}">${x.p[0] > x.p[1] ? '우세' : x.p[0] < x.p[1] ? '열세' : '비슷'}</em></div>`).join('')}<ul class="lm-ul">${lines.join('')}</ul>`));
    }
    if (mine.length) {
      const tm = l => ({ k: sum(l, x => x[4]), d: sum(l, x => x[5]), dmg: sum(l, x => x[6]) }), T0 = tm(mine), T1 = tm(foe), mv = L.mvp;
      const tr = (x, T) => `<tr class="${mv && mv[0] === x[0] && mv[1] === x[1] ? 'mvp' : ''}"><td>${sp(x[1])}${nm(x[1])}${mv && mv[0] === x[0] && mv[1] === x[1] ? ' ★' : ''}<small class="lm-fv">${roleOf(FD(x[1]))}</small></td><td>${x[2] || '-'}</td><td>${x[4]}/${x[5]}</td><td>${x[6]} <small>${pc(x[6], T.dmg)}%</small></td><td>${x[7]}</td><td>${x[9]}회 ${x[8]}점</td><td>${x[10] ? '생존' : '대기'}</td><td>${x[11] != null ? `${x[11]}/${x[12]}` : '-'}</td></tr>`;
      const ace = foe.slice().sort((a, b) => b[6] - a[6])[0], aceK = foe.slice().sort((a, b) => b[4] - a[4])[0];
      panels.push(H.panel('선수·파이터별 상세', '킬/데스 · 피해(팀 비중) · 치유 · 제출 · 폼/멘탈', `<table class="tbl small"><thead><tr><th>파이터</th><th>선수</th><th>K/D</th><th>피해</th><th>치유</th><th>제출</th><th>상태</th><th>폼/멘탈</th></tr></thead><tbody><tr><th colspan="8">내 팀</th></tr>${mine.slice().sort((a, b) => a[3] - b[3]).map(x => tr(x, T0)).join('')}<tr><th colspan="8">상대 팀</th></tr>${foe.slice().sort((a, b) => a[3] - b[3]).map(x => tr(x, T1)).join('')}</tbody></table>
        <div class="lm-cards">${mine.slice().sort((a, b) => a[3] - b[3]).map(x => `<div class="lm-card"><h5>${sp(x[1])}${nm(x[1])}${x[2] ? ` · ${x[2]}` : ''}</h5><ul class="lm-ul">${unitNotes(x, mine, mv && mv[0] === 0 && mv[1] === x[1]).map(n => `<li class="${n[0]}">${n[1]}</li>`).join('')}</ul></div>`).join('')}</div>
        ${ace ? `<ul class="lm-ul"><li>상대 최다 피해: ${nm(ace[1])}(${ace[6]}, 상대 팀의 ${pc(ace[6], T1.dmg)}%)${aceK && aceK[4] > 0 ? ` · 최다 킬: ${nm(aceK[1])}(${aceK[4]}킬)` : ''} — 다음 밴·교전 타깃 후보입니다.</li></ul>` : ''}`));
    }
    const fs = row.me.map(FD).filter(Boolean), flags = [], myFav = favOf(G);
    if (!fs.some(isTank)) flags.push(['bad', '전열(탱커·전위)이 없는 조합이었습니다. 후열이 그대로 노출됩니다.']);
    if (fs.filter(f => f.role === 'mage').length >= 2) flags.push(['bad', '마법사 2명 이상 — 조합 보정이 깎입니다.']);
    if (fs.filter(f => f.role === 'assassin').length >= 2) flags.push(['bad', '암살자 2명 이상 — 조합 보정이 깎입니다.']);
    if (fs.filter(isBack).length >= 3) flags.push(['bad', '후열 3명 — 앞을 막아줄 파이터가 없습니다.']);
    const mu = typeof Draft !== 'undefined' && Draft.matchup ? Draft.matchup(row.me, row.op) : null;
    const oppFav = new Set(); try { const t = League.team(G, row.oppId); ((t && t.pros) || []).forEach(id => (((Pros.get(G, id) || {}).favs) || []).forEach(x => oppFav.add(x))); } catch (e) { /* 상대 정보 없음 */ }
    const lost = row.bo.filter(id => myFav.has(id)), hit = row.bm.filter(id => oppFav.has(id)), oppUsedFav = row.op.filter(id => oppFav.has(id)), myUsedFav = row.me.filter(id => myFav.has(id));
    const names = l => l.map(nm).join(', ') || '없음', mrow = a => `<tr><td>${sp(a.id)}${nm(a.id)}</td><td class="${a.k > 1.1 ? 'ok' : a.k < 0.9 ? 'bad' : ''}">×${r2(a.k)}</td><td>${a.why[0] || '뚜렷한 우열 없음'}</td></tr>`;
    panels.push(H.panel('밴픽 · 조합 · 상성', '상성 수치는 AI 밴픽과 같은 규칙으로 계산 (1.0 = 보통)', `<ul class="lm-ul"><li>내 조합: ${names(row.me)} · 상대 조합: ${names(row.op)}</li>${flags.map(x => `<li class="${x[0]}">${x[1]}</li>`).join('')}
      <li class="${lost.length ? 'bad' : ''}">상대 밴: ${names(row.bo)}${lost.length ? ` — 내 선수 선호 파이터 ${lost.length}개(${names(lost)})를 잃었습니다` : ''}</li>
      <li class="${hit.length ? 'ok' : ''}">내 밴: ${names(row.bm)}${hit.length ? ` — 상대 선호 파이터 ${names(hit)}를 정확히 막았습니다` : oppUsedFav.length ? ` — 빗나갔습니다. 상대는 선호 파이터 ${names(oppUsedFav)}를 그대로 썼습니다` : ''}</li>
      <li>내 선수 선호 파이터 사용 ${myUsedFav.length}/3${row.counter != null ? ` · 누적 상성 승률 ${Math.round(row.counter * 100)}%` : ''}</li></ul>
      ${mu ? `<table class="tbl small"><thead><tr><th>내 파이터 → 상대 조합</th><th>상성</th><th>이유</th></tr></thead><tbody>${mu.mine.map(mrow).join('')}</tbody></table><table class="tbl small"><thead><tr><th>상대 파이터 → 내 조합</th><th>상성</th><th>이유</th></tr></thead><tbody>${mu.theirs.map(mrow).join('')}</tbody></table><ul class="lm-ul"><li class="${mu.mk >= mu.tk ? 'ok' : 'bad'}">조합 종합 상성: 내 ${r2(mu.mk)} vs 상대 ${r2(mu.tk)} — ${mu.mk >= mu.tk * 1.05 ? '밴픽 상성은 우리 쪽이 유리했습니다' : mu.mk * 1.05 <= mu.tk ? '밴픽 상성은 상대가 유리했습니다' : '상성은 비슷했습니다'}</li></ul>` : ''}`));
    const axes = (CONFIG.tactics.team || []).filter(c => CONFIG.tactics.pre.team.includes(c.id)), mineT = ((typeof MyData !== 'undefined' && MyData.get(G).tac) || {});
    if (L && L.tac && axes.length) {
      const on = (c, id) => { const o = c.options.find(x => x.id === id); return o ? o.name : '-'; };
      panels.push(H.panel('전술 비교', '내 누적 승률은 이 경기까지 포함한 내 팀 기록', `<table class="tbl small"><thead><tr><th>축</th><th>내 설정</th><th>내 누적</th><th>상대 설정</th></tr></thead><tbody>${axes.map(c => { const mid = L.tac[0][c.id], rec = (mineT[c.id] || {})[mid], w = rec && rec[0] ? Math.round(rec[1] / rec[0] * 100) : null; return `<tr><td>${c.name}</td><td>${on(c, mid)}</td><td class="${rec && rec[0] >= 4 && w < 40 ? 'bad' : ''}">${rec && rec[0] ? `${rec[1]}/${rec[0]}경기 ${w}%` : '-'}</td><td>${on(c, L.tac[1][c.id])}</td></tr>`; }).join('')}</tbody></table>`));
    }
    const gp = row.pw[0] - row.pw[1];
    panels.push(H.panel('컨디션 · 전력', '', `<ul class="lm-ul"><li class="${gp <= R.gapBad ? 'bad' : gp >= -R.gapBad ? 'ok' : ''}">평균 전력 내 ${row.pw[0]} / 상대 ${row.pw[1]} (차이 ${sgn(gp)})${row.fast ? '' : ' — 실제 전투에서는 능력치가 직접 반영되지 않고 참고용입니다'}</li><li class="${row.cp[0] - row.cp[1] <= R.compBad ? 'bad' : ''}">조합 보정 내 ${sgn(row.cp[0])} / 상대 ${sgn(row.cp[1])}</li><li class="${row.fm[0] < R.lowForm || row.fm[1] < R.lowMental ? 'bad' : ''}">내 평균 폼 ${row.fm[0]} · 멘탈 ${row.fm[1]} (경고선 폼 ${R.lowForm} · 멘탈 ${R.lowMental})</li>${row.exp != null ? `<li>능력치 기준 기대 승률 ${Math.round(row.exp * 100)}%</li>` : ''}</ul>`));
    return shell(say, head + panels.join(''));
  }

  function css() {
    if (typeof document === 'undefined' || document.getElementById('rp-css')) return;
    const st = document.createElement('style'); st.id = 'rp-css';
    st.textContent = `.rp-officer{display:flex;gap:16px;align-items:center;padding:14px}
.rp-photo{position:relative;display:flex;flex:none;align-items:center;justify-content:center;overflow:hidden;width:120px;height:120px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(0,0,0,.35);font-size:44px}
.rp-photo img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}
.rp-say{display:flex;flex-direction:column;gap:6px;min-width:0}
.rp-say b{font-size:14px}
.rp-say p{margin:0;font-size:13px;line-height:1.6;color:var(--muted)}
.rp-scope{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}
.rp-row{cursor:pointer}
.lm-wrap{display:grid;grid-template-columns:clamp(200px,24vw,320px) minmax(0,1fr);gap:16px;align-items:start}
.lm-who{position:sticky;top:12px;display:flex;flex-direction:column;gap:8px}
.lm-photo{position:relative;display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:3/4;overflow:hidden;border:1px solid rgba(255,255,255,.14);border-radius:16px;background:rgba(0,0,0,.35);font-size:64px;box-shadow:0 6px 20px rgba(0,0,0,.4)}
.lm-photo img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:center top}
.lm-name{font-size:13px;text-align:center}
.lm-bubble{position:relative;margin:6px 0 0;padding:10px 12px;border-radius:12px;background:rgba(110,231,255,.12);font-size:13px;line-height:1.6;color:var(--text)}
.lm-main{display:flex;flex-direction:column;gap:12px;min-width:0}
.lm-head{display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.lm-badge{padding:4px 14px;border-radius:999px;font-size:15px;font-weight:800;color:#fff}
.lm-badge.win{background:rgba(52,211,153,.4)}
.lm-badge.lose{background:rgba(248,113,113,.4)}
.lm-badge.draw{background:rgba(250,204,21,.35)}
.lm-score{font-size:22px;font-weight:800}
.lm-meta{font-size:12px;color:var(--muted)}
.lm-fr{display:grid;grid-template-columns:96px minmax(0,1fr) 44px;gap:8px;align-items:center;padding:5px 0;font-size:12px}
.lm-bar{display:flex;overflow:hidden;height:10px;border-radius:5px;background:rgba(255,255,255,.08)}
.lm-bar i{display:block;height:100%}
.lm-bar i.a{background:#60a5fa}
.lm-bar i.b{background:#f87171}
.lm-fv{display:block;margin-top:2px;font-size:11px;color:var(--muted)}
.lm-vd{font-size:12px;font-style:normal;font-weight:700;text-align:right;color:var(--muted)}
.lm-vd.ok,.lm-ul .ok,.lm-wrap td.ok{color:#6ee7b7}
.lm-vd.bad,.lm-ul .bad,.lm-wrap td.bad{color:#fca5a5}
.lm-ul{margin:6px 0 0;padding-left:18px;font-size:12px;line-height:1.75;color:var(--text)}
.lm-sp{width:24px;height:24px;margin-right:4px;vertical-align:middle}
.lm-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin:10px 0 0}
.lm-card{padding:10px 12px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.04)}
.lm-card h5{margin:0 0 4px;font-size:13px}
@media (max-width:820px){.lm-wrap{grid-template-columns:1fr}.lm-who{position:static;flex-direction:row;align-items:center}.lm-photo{flex:none;width:96px;aspect-ratio:1}.lm-bubble{margin:0}}`;
    document.head.appendChild(st);
  }

  /* 데이터 센터 '리포트 룸': 담당관 + 시즌별/전체 분석. st.rsel = 'all' | 시즌 번호 */
  function room(G, st, H) {
    css();
    const S = store(G), O = (CONFIG.report && CONFIG.report.officer) || { name: '분석 담당관', dir: '', prefix: '', ext: 'png', count: 1, lines: [], empty: '' };
    const seasons = [...new Set(S.rows.map(r => r.s))].sort((a, b) => b - a);
    let scope = st.rsel == null ? (seasons.includes(G.season) ? G.season : 'all') : (st.rsel === 'all' || st.rsel === 'last' ? st.rsel : +st.rsel);
    if (scope !== 'all' && scope !== 'last' && !seasons.includes(scope)) scope = 'all';
    const m = build(G, rowsOf(G, scope)), idx = (G.season || 1) % Math.max(1, O.count) + 1;
    const greet = (O.lines && O.lines.length) ? O.lines[(G.season || 1) % O.lines.length] : '';
    const verdict = m ? `${scope === 'all' ? '전체' : scope + '시즌'} ${m.n}경기 기준으로 ${m.w}승 ${m.l}패입니다. ${m.causes[0] ? `가장 많은 패인은 '${CAUSE[m.causes[0].id][0]}'(${m.causes[0].n}패)입니다.` : '뚜렷한 패인은 없습니다.'}` : O.empty;
    const photo = `<div class="rp-photo"><span>🕵️</span><img src="${O.dir}${O.prefix}${idx}.${O.ext}" alt="${O.name}" onerror="this.remove()"></div>`;
    const officer = `<div class="glass panel rp-officer">${photo}<div class="rp-say"><b>${O.name}</b><p>${greet}</p><p>${verdict}</p></div></div>`;
    const chips = [['last', '최근 경기'], ['all', '전체 합계'], ...seasons.map(x => [x, x + '시즌'])].map(([k, n]) => `<button class="chip ${String(scope) === String(k) ? 'on' : ''}" data-act="dcReport" data-s="${k}">${n}</button>`).join('');
    let cmp = '';
    if (scope === 'all' && seasons.length) {
      cmp = H.panel('시즌별 비교', '시즌을 누르면 그 시즌 분석으로 이동', `<table class="tbl dc-tbl"><thead><tr><th>시즌</th><th>경기</th><th>전적</th><th>승률</th><th>주요 패인</th></tr></thead><tbody>${seasons.map(x => { const t = build(G, rowsOf(G, x)); return `<tr class="rp-row" data-act="dcReport" data-s="${x}"><td class="tn">${x}시즌</td><td>${t.n}</td><td>${t.w}승 ${t.d ? t.d + '무 ' : ''}${t.l}패</td><td>${pct(t.w, t.n)}%</td><td>${topCause(t)}</td></tr>`; }).join('')}</tbody></table>`);
    }
    if (scope === 'last') return `<div class="rp-scope">${chips}</div>${lastMatch(G, H)}`;
    const main = m ? `${cmp}${H.panel(scope === 'all' ? '전체 종합 분석' : scope + '시즌 분석', `실제 전투 ${m.realN} · 빠른 진행 ${m.fastN}`, body(G, m))}` : '<p class="empty">아직 기록된 경기가 없습니다. 경기를 치르면(시즌 건너뛰기 도중 중단해도) 여기에 쌓입니다.</p>';
    const A = G.adapt, adj = A && A.log && A.log.length ? H.panel('🤖 AI 전술 보정 기록', '패인 분석으로 자동 전술을 조정한 내역 (직접 설정한 전술에는 적용되지 않음)', `<ul class="notes">${A.log.slice(-8).reverse().map(x => `<li><b>${x.s}시즌</b> · ${x.games}경기 중 ${x.losses}패 분석 — ${x.changes.join(' / ')}</li>`).join('')}</ul>`) : '';
    return `${officer}<div class="rp-scope">${chips}</div>${adj}${main}`;
  }
  return { record, build, html, room, adapt };
})();
