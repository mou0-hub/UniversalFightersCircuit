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
      row.q = ++S.seq; S.rows.push(row); if (S.rows.length > R.keep) S.rows.splice(0, S.rows.length - R.keep);
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
.rp-row{cursor:pointer}`;
    document.head.appendChild(st);
  }

  /* 데이터 센터 '리포트 룸': 담당관 + 시즌별/전체 분석. st.rsel = 'all' | 시즌 번호 */
  function room(G, st, H) {
    css();
    const S = store(G), O = (CONFIG.report && CONFIG.report.officer) || { name: '분석 담당관', dir: '', prefix: '', ext: 'png', count: 1, lines: [], empty: '' };
    const seasons = [...new Set(S.rows.map(r => r.s))].sort((a, b) => b - a);
    let scope = st.rsel == null ? (seasons.includes(G.season) ? G.season : 'all') : (st.rsel === 'all' ? 'all' : +st.rsel);
    if (scope !== 'all' && !seasons.includes(scope)) scope = 'all';
    const m = build(G, rowsOf(G, scope)), idx = (G.season || 1) % Math.max(1, O.count) + 1;
    const greet = (O.lines && O.lines.length) ? O.lines[(G.season || 1) % O.lines.length] : '';
    const verdict = m ? `${scope === 'all' ? '전체' : scope + '시즌'} ${m.n}경기 기준으로 ${m.w}승 ${m.l}패입니다. ${m.causes[0] ? `가장 많은 패인은 '${CAUSE[m.causes[0].id][0]}'(${m.causes[0].n}패)입니다.` : '뚜렷한 패인은 없습니다.'}` : O.empty;
    const photo = `<div class="rp-photo"><span>🕵️</span><img src="${O.dir}${O.prefix}${idx}.${O.ext}" alt="${O.name}" onerror="this.remove()"></div>`;
    const officer = `<div class="glass panel rp-officer">${photo}<div class="rp-say"><b>${O.name}</b><p>${greet}</p><p>${verdict}</p></div></div>`;
    const chips = [['all', '전체 합계'], ...seasons.map(x => [x, x + '시즌'])].map(([k, n]) => `<button class="chip ${String(scope) === String(k) ? 'on' : ''}" data-act="dcReport" data-s="${k}">${n}</button>`).join('');
    let cmp = '';
    if (scope === 'all' && seasons.length) {
      cmp = H.panel('시즌별 비교', '시즌을 누르면 그 시즌 분석으로 이동', `<table class="tbl dc-tbl"><thead><tr><th>시즌</th><th>경기</th><th>전적</th><th>승률</th><th>주요 패인</th></tr></thead><tbody>${seasons.map(x => { const t = build(G, rowsOf(G, x)); return `<tr class="rp-row" data-act="dcReport" data-s="${x}"><td class="tn">${x}시즌</td><td>${t.n}</td><td>${t.w}승 ${t.d ? t.d + '무 ' : ''}${t.l}패</td><td>${pct(t.w, t.n)}%</td><td>${topCause(t)}</td></tr>`; }).join('')}</tbody></table>`);
    }
    const main = m ? `${cmp}${H.panel(scope === 'all' ? '전체 종합 분석' : scope + '시즌 분석', `실제 전투 ${m.realN} · 빠른 진행 ${m.fastN}`, body(G, m))}` : '<p class="empty">아직 기록된 경기가 없습니다. 경기를 치르면(시즌 건너뛰기 도중 중단해도) 여기에 쌓입니다.</p>';
    const A = G.adapt, adj = A && A.log && A.log.length ? H.panel('🤖 AI 전술 보정 기록', '패인 분석으로 자동 전술을 조정한 내역 (직접 설정한 전술에는 적용되지 않음)', `<ul class="notes">${A.log.slice(-8).reverse().map(x => `<li><b>${x.s}시즌</b> · ${x.games}경기 중 ${x.losses}패 분석 — ${x.changes.join(' / ')}</li>`).join('')}</ul>`) : '';
    return `${officer}<div class="rp-scope">${chips}</div>${adj}${main}`;
  }
  return { record, build, html, room, adapt };
})();
