/* report.js — 시즌 종합 리포트: 내 경기를 경기마다 기록해 두었다가, 시즌이 끝나면 패인(전력·밴픽·전술·인게임·컨디션)을 모아 보여줍니다.
   R(기준값)와 CAUSE(원인 문구) 표만 고치면 판정이 바뀝니다. 기록은 G.report = { season, rows } 에 저장됩니다. */

const Report = (() => {
  const R = { keep: 300, min: 3, gapBad: -3, counterBad: 0.45, killGap: 3, dropGap: 3, depRatio: 0.8, deaths: 5, lead: 4, lowForm: 45, lowMental: 55, luckExp: 0.55 };
  const KIND = { league: '정규', playoff: '플레이오프', msi: 'MSI', worlds: '월드' };
  const CAUSE = {
    power:   ['선수 전력 열세', '상대 선발의 능력치·폼이 더 높았습니다. 선수 영입·성장·컨디션 관리가 가장 직접적인 해법입니다.'],
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

  function power(G, tm, picks, mine) {
    const ids = mine ? ((G.club && G.club.lineup) || []).filter(Boolean) : (League.team(G, tm.id).pros || []), mo = tm.moods || [];
    const ps = ids.map((id, i) => ({ p: Pros.get(G, id), m: mo[i] })).filter(x => x.p);
    const base = ps.length ? avg(ps.map(({ p, m }) => p.ovr + (((m && m.form) ?? p.form ?? 55) - 55) * 0.15 + (((m && m.mental) ?? p.mental ?? 70) - 70) * 0.08)) : 60;
    return { v: base, form: ps.length ? avg(ps.map(({ p, m }) => (m && m.form) ?? p.form ?? 55)) : 55, mental: ps.length ? avg(ps.map(({ p, m }) => (m && m.mental) ?? p.mental ?? 70)) : 70 };
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
        pw: [r1(pm.v), r1(po.v)], exp: res.fast ? 1 / (1 + Math.pow(10, -diff / 32)) : null, fm: [Math.round(pm.form), Math.round(pm.mental)],
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
    if (m.fastN > m.n / 2) out.push(`빠른 진행(${m.fastN}경기)에서는 전술과 인게임이 반영되지 않습니다.`);
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
  const r2 = n => Math.round(n * 100) / 100;
  const pc = (a, b) => (b > 0 ? Math.round(a / b * 100) : 0);
  const sgn = n => (n > 0 ? '+' : '') + r1(n);
  const sd = (t, me) => (t === me ? 0 : t === 1 - me ? 1 : t === 2 ? 2 : -1);
  const mmss = (t, ms) => { const s = Math.round(t * ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const WHY = { deliver: '제출', kill: '킬', first: '선취점', shutdown: '연속 킬 저지', ace: '전멸(에이스)' };
  const roleOf = f => { const r = f && CONFIG.roles && CONFIG.roles[f.role]; return r ? `${r.icon || ''} ${r.name}` : ''; };
  const sp = id => (FD(id) && typeof Sprites !== 'undefined' ? `<img class="px lm-sp" src="${Sprites.url(FD(id))}" alt="">` : '');
  const bar = (a, b) => { const w = a + b > 0 ? Math.round(a / (a + b) * 100) : 50; return `<div class="lm-bar"><i class="a" style="width:${w}%"></i><i class="b" style="width:${100 - w}%"></i></div>`; };
  const cmp = (a, b, inv) => { const d = (inv ? -1 : 1) * (a - b) / Math.max(1, a + b); return d > 0.2 ? 'ok' : d < -0.2 ? 'bad' : ''; };
  const vd = c => (c === 'ok' ? '우세' : c === 'bad' ? '열세' : '비슷');
  const top = (m, n) => Object.keys(m).sort((a, b) => m[b] - m[a]).slice(0, n).map(k => `${k || '기본'} ${m[k]}`).join(' · ');
  const tally = (list, fn) => { const m = {}; list.forEach(x => { const k = fn(x); m[k] = (m[k] || 0) + 1; }); return m; };

  function snap(M, res, me, op) {
    const rec = res.rec || {}, CT = (CONFIG.battle && CONFIG.battle.tickMs) || 50, mo = (M.teams[me] && M.teams[me].moods) || [], bk = res.bossKills || [0, 0], units = res.units || [], cores = rec.cores || [], kills = rec.kills || [];
    const stOf = t => { const s = (M.teams[t] && M.teams[t].strategy) || {}, o = {}; Object.keys(s).forEach(k => { if (s[k] && s[k][0]) o[k] = s[k][0]; }); return o; };
    const idm = {}; units.forEach(u => { idm[u.id] = [sd(u.team, me), u.ch.id, u.team]; });
    const fid = id => (idm[id] ? idm[id][1] : '');
    return {
      v: 2, fast: !!res.fast, ticks: res.ticks || 0, ms: CT, sudden: !!res.sudden, suddenAt: rec.suddenAt || 0, suddenWin: res.suddenWinner == null ? -1 : sd(res.suddenWinner, me),
      hp: res.hp ? [r1(res.hp[me] * 100), r1(res.hp[op] * 100)] : null, score: res.score ? [res.score[me], res.score[op]] : [0, 0], boss: [bk[me] || 0, bk[op] || 0],
      mvp: res.mvpTeam >= 0 && res.mvpFighter ? [sd(res.mvpTeam, me), res.mvpFighter] : null,
      u: units.map(u => { const m = u.team === me ? mo[u.slot] : null; return [sd(u.team, me), u.ch.id, u.nick || (m && m.nick) || '', u.slot, u.kills || 0, u.deaths || 0, Math.round(u.dmg || 0), Math.round(u.healed || 0), r1(u.dpts || 0), u.deliv || 0, u.alive ? 1 : 0, m && m.form != null ? Math.round(m.form) : null, m && m.mental != null ? Math.round(m.mental) : null, Math.round(u.taken || 0), u.skills || 0, u.ults || 0, u.coresIn || 0]; }),
      tac: res.tac && res.tac.st ? [res.tac.st[me] || {}, res.tac.st[op] || {}] : [stOf(me), stOf(op)], sl: res.tac && res.tac.sl ? [res.tac.sl[me] || [], res.tac.sl[op] || []] : null,
      pe: (rec.pts || []).map(p => [p.t, sd(p.team, me), r2(p.pts), p.why || '']).slice(-400),
      ke: kills.map(k => { const v = idm[k.v] || [-1, '', -1], dr = cores.find(c => c.kind === 'drop' && c.t === k.t && c.team === v[2]); return [k.t, sd(k.kt, me), k.k ? fid(k.k) : '', v[0], v[1], k.via || '', dr ? dr.n : 0]; }).slice(-200),
      ce: cores.map(c => [c.t, c.kind, sd(c.team, me), c.n, c.u ? fid(c.u) : '']).slice(-500),
      fl: (rec.flips || []).map(f => [f.t, sd(f.team, me), f.why || '']),
      bs: (rec.boss || []).map(b => [b.t, b.ph, b.team == null ? -1 : sd(b.team, me), b.kind, b.n || 0]),
      od: (rec.orders || []).map(o => [o.t, sd(o.team, me), o.scope, o.id, o.lead, o.boss ? 1 : 0]).slice(-80)
    };
  }

  function derive(L) {
    const TS = 1000 / L.ms, mine = L.u.filter(x => x[0] === 0), foe = L.u.filter(x => x[0] === 1), why = [{}, {}];
    L.pe.forEach(e => { if (e[1] === 0 || e[1] === 1) why[e[1]][e[3]] = r1((why[e[1]][e[3]] || 0) + e[2]); });
    const cs = [0, 1].map(i => {
      const dep = L.ce.filter(c => c[1] === 'deposit' && c[2] === i), dr = sum(L.ce.filter(c => c[1] === 'drop' && c[2] === i), c => c[3]), ts = dep.map(c => c[0]), gaps = ts.slice(1).map((t, k) => (t - ts[k]) / TS), cin = sum(i ? foe : mine, x => x[16]), car = L.ke.filter(k => k[3] === i && k[6] > 0);
      return { n: dep.length, pts: r1(sum(dep, c => c[3])), avg: dep.length ? r1(sum(dep, c => c[3]) / dep.length) : 0, first: ts.length ? ts[0] : null, gap: gaps.length ? r1(sum(gaps, x => x) / gaps.length) : null, pick: L.ce.filter(c => c[1] === 'pick' && c[2] === i).length, drop: dr, cin, eff: cin + dr > 0 ? Math.round(cin / (cin + dr) * 100) : null, cd: car.length, cdn: sum(car, k => k[6]) };
    });
    const win = L.ticks > 0 ? 40 * TS : 0, bossD = L.bs.filter(b => b[1] === 'down').map(d => {
      const s = L.bs.find(b => b[1] === 'spawn' && b[3] === d[3]), w = L.pe.filter(e => e[0] >= d[0] && e[0] <= d[0] + win);
      return { kind: d[3], t: d[0], spawn: s ? s[0] : null, team: d[2], cores: d[4], kp: r1(sum(w.filter(e => e[1] === d[2]), e => e[2])), op: r1(sum(w.filter(e => e[1] === 1 - d[2]), e => e[2])) };
    });
    const gap = 8 * TS, fights = [];
    L.ke.slice().sort((a, b) => a[0] - b[0]).forEach(k => { const f = fights[fights.length - 1]; if (f && k[0] - f.t1 <= gap) { f.t1 = k[0]; f.ev.push(k); } else fights.push({ t0: k[0], t1: k[0], ev: [k] }); });
    fights.forEach(f => {
      f.km = f.ev.filter(k => k[1] === 0).length; f.ml = f.ev.filter(k => k[3] === 0).length; f.kb = f.ev.filter(k => k[1] === 2).length;
      f.dm = sum(f.ev.filter(k => k[3] === 0), k => k[6]); f.df = sum(f.ev.filter(k => k[3] === 1), k => k[6]);
      const w = L.pe.filter(e => e[0] >= f.t0 && e[0] <= f.t1 + gap); f.pm = r1(sum(w.filter(e => e[1] === 0), e => e[2]) - sum(w.filter(e => e[1] === 1), e => e[2])); f.net = f.km - f.ml;
    });
    const q = [0, 1, 2, 3].map(() => ({ p: [0, 0], k: [0, 0], end: 0 })), at = t => Math.min(3, Math.floor(t / Math.max(L.ticks, 1) * 4));
    let d = 0, hi = 0, lo = 0;
    L.pe.forEach(e => { if (e[1] > 1) return; d += e[1] === 0 ? e[2] : -e[2]; hi = Math.max(hi, d); lo = Math.min(lo, d); q[at(e[0])].p[e[1]] += e[2]; q[at(e[0])].end = d; });
    L.ke.forEach(e => { if (e[1] === 0 || e[1] === 1) q[at(e[0])].k[e[1]]++; });
    let pv = 0; q.forEach(x => { if (!x.p[0] && !x.p[1]) x.end = pv; pv = x.end; });
    return { mine, foe, why, cs, bossD, fights, q, hi: r1(hi), lo: r1(lo), TS };
  }

  function leadChart(L) {
    const T = Math.max(L.ticks, 1), W = 400, Hh = 90, ev = L.pe.filter(e => e[1] === 0 || e[1] === 1), X = t => r1(t / T * W);
    let d = 0, hi = 1, lo = -1; const st = [[0, 0]];
    ev.forEach(e => { d += e[1] === 0 ? e[2] : -e[2]; st.push([e[0], d]); hi = Math.max(hi, d); lo = Math.min(lo, d); });
    st.push([T, d]);
    const Y = v => r1(8 + (hi - v) / (hi - lo) * (Hh - 28));
    let pts = ''; st.forEach((p, i) => { if (i) pts += `${X(p[0])},${Y(st[i - 1][1])} `; pts += `${X(p[0])},${Y(p[1])} `; });
    const ln = (t, c, y1, y2, dash) => `<line x1="${X(t)}" x2="${X(t)}" y1="${y1}" y2="${y2}" stroke="${c}" stroke-width="1.2" vector-effect="non-scaling-stroke"${dash ? ' stroke-dasharray="3 3"' : ''}/>`;
    const marks = L.bs.map(b => ln(b[0], b[1] === 'spawn' ? '#facc15' : b[2] === 0 ? '#60a5fa' : '#f87171', 2, Hh - 22, true)).join('') + (L.suddenAt ? ln(L.suddenAt, '#f472b6', 2, Hh - 22, true) : '') + L.ke.map(k => (k[1] === 0 ? ln(k[0], '#60a5fa', Hh - 18, Hh - 8) : k[3] === 0 ? ln(k[0], '#f87171', Hh - 8, Hh) : '')).join('');
    return `<svg class="lm-svg" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" role="img"><line x1="0" x2="${W}" y1="${Y(0)}" y2="${Y(0)}" stroke="rgba(255,255,255,.3)" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="4 4"/><polyline points="${pts}" fill="none" stroke="#6ee7ff" stroke-width="2" vector-effect="non-scaling-stroke"/>${marks}</svg><small class="lm-fv">점수차 ${sgn(lo)} ~ ${sgn(hi)} · 노랑 점선 보스 출현 · 파랑/빨강 점선 보스 처치 팀 · 분홍 서든데스 · 아래 눈금: 파랑 내 킬 / 빨강 내 사망</small>`;
  }

  function factors(row, L, D) {
    const g = row.g; if (!g) return [];
    const f = [], add = (id, name, a, b, w, inv, unit) => { const d = (inv ? -1 : 1) * (a - b) / Math.max(1, a + b); f.push({ id, name, a, b, unit, d, imp: w * d }); };
    add('dep', '제출 점수', g.dep[0], g.dep[1], 1, false, '점');
    add('kills', '킬 교환', g.kd[0], g.kd[1], 0.8, false, '킬');
    add('boss', '보스 처치', g.boss[0], g.boss[1], 0.7, false, '회');
    add('drop', '코어 유실', g.drop[0], g.drop[1], 0.5, true, '개');
    add('first', '선취점', g.first > 0 ? 1 : 0, g.first < 0 ? 1 : 0, 0.25, false, '');
    if (D) { add('dmg', '총 피해량', sum(D.mine, x => x[6]), sum(D.foe, x => x[6]), 0.35, false, ''); add('heal', '총 치유량', sum(D.mine, x => x[7]), sum(D.foe, x => x[7]), 0.15, false, ''); }
    if (L && L.hp) add('hp', '종료 시 체력', L.hp[0], L.hp[1], 0.3, false, '%');
    return f.sort((a, b) => Math.abs(b.imp) - Math.abs(a.imp));
  }
  const HINT = {
    dep: ['제출 점수로 격차를 만들었습니다', '제출 점수에서 밀렸습니다 — 제출 리듬·활동 영역·운반자 보호를 점검하세요'],
    kills: ['교전에서 우위였습니다', '교전에서 밀렸습니다 — 교전 성향·진형·상성을 점검하세요'],
    boss: ['보스 경쟁에서 앞섰습니다', '보스 경쟁에서 밀렸습니다 — 보스 태도·궁 운용·합류 타이밍을 확인하세요'],
    drop: ['코어 손실이 적었습니다', '코어를 든 채 더 많이 쓰러졌습니다 — 진형과 제출 리듬을 점검하세요'],
    first: ['선취점으로 주도권을 잡았습니다', '선취점을 내줬습니다 — 초반 진입·교전 판단을 점검하세요'],
    dmg: ['딜량 우위', '딜량 열세 — 딜러 생존·사거리·상성을 확인하세요'],
    heal: ['치유 우위', '치유 열세'],
    hp: ['생존 체력 우위로 마무리', '체력 열세로 종료 — 교전 손실이 누적됐습니다']
  };

  function unitNotes(x, L, D, mvp) {
    const mine = D.mine, T = k => sum(mine, y => y[k]), tk = T(4), td = T(5), tdmg = T(6), tdv = T(9), th = T(7), ttk = T(13), f = FD(x[1]), n = [], sec = L.ticks * L.ms / 1000;
    const k = x[4], d = x[5], dmg = x[6], heal = x[7], dv = x[9], form = x[11], mental = x[12], taken = x[13], ults = x[15];
    const myDeaths = L.ke.filter(e => e[3] === 0 && e[4] === x[1]).sort((a, b) => a[0] - b[0]), carried = myDeaths.filter(e => e[6] > 0);
    if (mvp) n.push(['ok', '이 경기 MVP']);
    if (d >= R.deaths) n.push(['bad', `데스 ${d}회 — 기준(${R.deaths}회) 이상입니다. 포지션·표적 성향·거리 감각을 조정하세요`]);
    else if (td >= 4 && d / td >= 0.5) n.push(['bad', `팀 데스의 ${pc(d, td)}%(${d}/${td})가 이 선수에게 몰렸습니다`]);
    if (myDeaths.length) n.push(['', `첫 사망 ${mmss(myDeaths[0][0], L.ms)}${myDeaths[0][2] ? ` (${(FD(myDeaths[0][2]) || {}).name || '?'}에게${myDeaths[0][5] ? `, ${myDeaths[0][5]}` : ''})` : myDeaths[0][1] === 2 ? ' (보스에게)' : ''}`]);
    if (carried.length >= 2) n.push(['bad', `코어를 든 채 ${carried.length}번 사망 (코어 ${sum(carried, e => e[6])}개 유실)`]);
    else if (carried.length === 1) n.push(['', `코어 ${carried[0][6]}개를 든 채 사망 1회`]);
    if (tk >= 3 && tdmg > 0 && dmg / tdmg >= 0.45 && k / tk <= 0.15) n.push(['bad', `피해는 팀의 ${pc(dmg, tdmg)}%를 넣었지만 킬은 ${k}회뿐 — 마무리가 약합니다`]);
    else if (tk >= 3 && k === Math.max(...mine.map(y => y[4])) && k > 0) n.push(['ok', `킬 ${k}회로 팀 최다 (팀 킬의 ${pc(k, tk)}%)`]);
    if (tdv >= 3 && dv > 0 && dv === Math.max(...mine.map(y => y[9])) && dv / tdv >= 0.5) n.push(['ok', `제출 ${dv}회 — 팀 제출의 ${pc(dv, tdv)}%를 책임`]);
    else if (tdv >= 3 && dv === 0 && f && !isTank(f)) n.push(['bad', `제출이 한 번도 없습니다 (팀 ${tdv}회)`]);
    if (th > 0 && heal > 0 && heal / th >= 0.6) n.push(['ok', `치유 ${heal} — 팀 치유의 ${pc(heal, th)}%`]);
    if (f && isTank(f) && ttk > 0 && taken / ttk >= 0.35) n.push(['ok', `받은 피해 ${taken} — 팀의 ${pc(taken, ttk)}%를 받아냈습니다 (데스 ${d})`]);
    if (f && !isTank(f) && taken > 0 && dmg > 0 && taken > dmg * 2) n.push(['bad', `받은 피해(${taken})가 준 피해(${dmg})의 2배 이상 — 일방적으로 맞았습니다`]);
    else if (tdmg > 0 && f && !isTank(f) && heal / Math.max(1, th) < 0.3 && dmg / tdmg <= 0.15) n.push(['bad', `피해 기여 ${pc(dmg, tdmg)}%로 낮습니다 — 딜러·화력 역할이면 생존·사거리를 점검하세요`]);
    if (ults === 0 && sec >= 60) n.push(['bad', `궁극기를 한 번도 쓰지 못했습니다 (스킬 ${x[14]}회)`]);
    else n.push(['', `스킬 ${x[14]}회 · 궁 ${ults}회`]);
    const killed = tally(L.ke.filter(e => e[1] === 0 && e[2] === x[1]), e => e[4]), diedTo = tally(myDeaths, e => e[2] || (e[1] === 2 ? '보스' : '기타'));
    const nmf = id => (FD(id) ? FD(id).name : id), join = m => Object.keys(m).sort((a, b) => m[b] - m[a]).map(i => `${nmf(i)} ${m[i]}`).join(', ');
    if (Object.keys(killed).length) n.push(['', `잡은 상대: ${join(killed)}`]);
    if (Object.keys(diedTo).length) n.push(['', `쓰러진 원인: ${join(diedTo)}`]);
    if (form != null && form < R.lowForm) n.push(['bad', `폼 ${form} — 컨디션이 낮은 상태로 출전했습니다`]);
    if (mental != null && mental < R.lowMental) n.push(['bad', `멘탈 ${mental} — 낮은 상태로 출전했습니다`]);
    return n;
  }

  function lastMatch(G, H) {
    const S = store(G), row = S.rows[S.rows.length - 1], A = MA();
    const shell = (say, inner) => `<div class="lm-wrap"><aside class="lm-who"><div class="lm-photo"><span>🕵️</span><img src="${A.img}" alt="${A.name}" onerror="this.remove()"></div><div><b class="lm-name">${A.name}</b><p class="lm-bubble">${say}</p></div></aside><div class="lm-main">${inner}</div></div>`;
    if (!row) return shell('아직 기록된 경기가 없습니다. 경기를 치르면 마지막 경기의 상세 분석이 여기에 나옵니다.', '<p class="empty">기록된 경기가 없습니다.</p>');
    const L = S.last && S.last.q === row.q && S.last.v === 2 && !S.last.fast ? S.last : null, D = L ? derive(L) : null, g = row.g, win = row.w === 1, loss = row.w === 0, cls = win ? 'win' : loss ? 'lose' : 'draw', tag = win ? '승리' : loss ? '패배' : '무승부';
    row.counter = counterOf(G, row);
    const causes = loss ? causesOf(row) : [], fac = factors(row, L, D), nm = id => (FD(id) ? FD(id).name : id), tm = t => mmss(t, L.ms), sec = L ? r1(L.ticks * L.ms / 1000) : null;
    const head = `<div class="lm-head"><span class="lm-badge ${cls}">${tag}</span><span class="lm-score">${Math.floor(row.sc[0])} : ${Math.floor(row.sc[1])}</span><span class="lm-meta">${row.s}시즌 ${KIND[row.k] || row.k} · ${G.teamName || '우리 팀'} vs ${row.opp}${sec ? ` · ${tm(L.ticks)} 경과${L.sudden ? ` · 서든데스(${tm(L.suddenAt)}~)` : ' · 시간 종료'}` : ''}${row.fast ? ' · 빠른 진행(전투 기록 없음)' : ''}</span></div>`;
    const dec = fac.filter(x => (win ? x.imp > 0.06 : loss ? x.imp < -0.06 : Math.abs(x.imp) > 0.06)).slice(0, 3), con = fac.filter(x => (win ? x.imp < -0.06 : loss ? x.imp > 0.06 : false)).slice(0, 2);
    let say;
    if (!g) say = row.fast ? `빠른 진행으로 처리된 경기라 킬·점수 흐름·선수 기록이 없습니다. 능력치와 조합 기준으로만 분석합니다.${row.exp != null ? ` 기대 승률은 ${Math.round(row.exp * 100)}%였고 결과는 ${tag}입니다.` : ''}` : '이 경기는 전투 기록 없이 저장돼 있어 요약 지표만 분석합니다. 다음 경기부터 상세 기록이 쌓입니다.';
    else {
      const dn = dec.map(x => `"${x.name}"`).join(', ');
      say = win ? `이겼습니다. ${dn ? `승부를 가른 건 ${dn}입니다.` : '압도적인 지표가 없는 접전이었습니다.'}${con.length ? ` 다만 "${con[0].name}"은 오히려 밀렸습니다. 이 부분은 상대가 약했거나 운이 따른 겁니다.` : ''}`
        : loss ? `졌습니다. ${dn ? `격차가 가장 크게 난 지표는 ${dn}입니다.` : '뚜렷하게 밀린 지표가 없는 박빙이었습니다.'}${con.length ? ` "${con[0].name}"은 앞섰는데도 졌으니, 점수로 연결되는 지표에서 졌다는 뜻입니다.` : ''}`
        : `무승부입니다. ${fac[0] ? `가장 차이가 난 지표는 "${fac[0].name}"입니다.` : ''}`;
      if (D && D.fights.length) { const w = D.fights.filter(f => f.net > 0).length, l = D.fights.filter(f => f.net < 0).length; say += ` 교전은 ${D.fights.length}회 중 ${w}승 ${l}패였습니다.`; }
    }
    const act = [];
    if (loss) causes.forEach(c => {
      const ev = ({ power: `전력 ${sgn(row.pw[0] - row.pw[1])}`, counter: row.counter != null ? `누적 상성 승률 ${Math.round(row.counter * 100)}%` : '', boss: g ? `보스 ${g.boss[0]}:${g.boss[1]}` : '', kills: g ? `킬 ${g.kd[0]}:${g.kd[1]}` : '', carry: g ? `코어 유실 ${g.drop[0]}:${g.drop[1]}` : '', deposit: g ? `제출 점수 ${g.dep[0]}:${g.dep[1]}` : '', collapse: g ? `최대 ${g.led}점 앞서다 역전` : '', sudden: '동점 → 서든데스', deaths: g ? `한 선수 최다 ${g.maxDeaths}데스` : '', luck: row.exp != null ? `기대 승률 ${Math.round(row.exp * 100)}%` : '' })[c] || '';
      const cur = L && L.tac ? L.tac[0] : row.st || {}, rule = ((AD().rules) || []).find(x => x.cause === c && (x.from || []).includes(cur[x.axis])), ax = rule && (CONFIG.tactics.team || []).find(t => t.id === rule.axis);
      const fo = ax && ax.options.find(o => o.id === cur[rule.axis]), to = ax && ax.options.find(o => o.id === rule.to);
      act.push(['bad', `<b>${CAUSE[c][0]}</b>${ev ? ` (${ev})` : ''} — ${CAUSE[c][1]}${to ? ` <u>제안: ${ax.name} '${fo ? fo.name : '-'}' → '${to.name}'</u>` : ''}`]);
    });
    else if (g) {
      if (g.kd[1] - g.kd[0] >= R.killGap) act.push(['bad', `킬 ${g.kd[0]}:${g.kd[1]}로 밀렸는데 이겼습니다. 같은 교전 패턴이면 다음엔 집니다.`]);
      if (g.dep[1] > g.dep[0]) act.push(['bad', `제출 점수는 ${g.dep[0]}:${g.dep[1]}로 밀렸습니다. 다른 경로로 얻은 승리라 재현성이 낮습니다.`]);
      if (g.drop[0] - g.drop[1] >= R.dropGap) act.push(['bad', `코어 유실이 ${g.drop[0]}:${g.drop[1]}로 많았습니다. 운반자 보호가 약합니다.`]);
      if (g.sudden) act.push(['bad', '서든데스까지 간 승부였습니다. 마지막 교전 운영이 승패를 갈랐으니 재현 가능한지 확인하세요.']);
      if (g.maxDeaths >= R.deaths) act.push(['bad', `한 선수가 ${g.maxDeaths}번 쓰러졌습니다. 이겼어도 포지션 문제입니다.`]);
    }
    if (D) {
      const wf = D.fights.filter(f => f.net < 0).sort((a, b) => a.net - b.net || a.pm - b.pm)[0], one = D.fights.filter(f => f.ml >= 2 && f.km === 0).length;
      if (wf && wf.net <= -2) act.push(['bad', `${tm(wf.t0)} 교전에서 킬 ${wf.km}:${wf.ml}로 크게 졌습니다${wf.dm ? ` (코어 ${wf.dm}개 유실)` : ''}. 가장 큰 손실 교전이니 당시 진형·진입 타이밍을 복기하세요.`]);
      if (one >= 1) act.push(['bad', `한 명도 못 잡고 2명 이상 쓰러진 일방적 교전이 ${one}회 있었습니다.`]);
      if (D.cs[0].eff != null && D.cs[1].eff != null && D.cs[0].eff + 15 <= D.cs[1].eff) act.push(['bad', `제출 효율 ${D.cs[0].eff}% vs ${D.cs[1].eff}% — 주운 코어의 ${100 - D.cs[0].eff}%를 제출 전에 잃었습니다.`]);
    }
    if (row.fm && (row.fm[0] < R.lowForm || row.fm[1] < R.lowMental)) act.push(['bad', `폼 ${row.fm[0]} · 멘탈 ${row.fm[1]} — 컨디션이 낮은 상태로 출전했습니다. 휴식·시설·피드백으로 먼저 끌어올리세요.`]);
    if (!act.length) act.push(['ok', win ? '뚜렷한 약점 신호가 없습니다. 상대 전력이 낮았던 건 아닌지 전력차도 함께 보세요.' : '뚜렷한 원인 신호가 없습니다. 표본이 더 쌓여야 판단할 수 있습니다.']);
    const P = [], row2 = (label, a, b, c, extra) => `<div class="lm-fr"><span>${label}</span><div>${bar(a, b)}<small class="lm-fv">${a} : ${b}${extra || ''}</small></div><em class="lm-vd ${c}">${vd(c)}</em></div>`;
    P.push(H.panel('핵심 결론 · 다음 액션', loss ? `패인 ${causes.length}개` : win ? '이긴 경기의 위험 신호' : '무승부', `<ul class="lm-ul">${act.map(a => `<li class="${a[0]}">${a[1]}</li>`).join('')}</ul>`));
    if (fac.length) P.push(H.panel('승부를 가른 지표', '내 팀(파랑) : 상대(빨강)', `${fac.map(x => row2(x.name, x.a, x.b, cmp(x.a, x.b, x.id === 'drop'), x.unit)).join('')}<ul class="lm-ul">${fac.filter(x => Math.abs(x.d) > 0.2).slice(0, 5).map(x => `<li class="${x.d > 0 ? 'ok' : 'bad'}">${x.name}: ${HINT[x.id][x.d > 0 ? 0 : 1]}</li>`).join('')}</ul>`));
    if (D) {
      const keys = Object.keys(WHY).filter(k => D.why[0][k] || D.why[1][k]), tot = [r1(sum(keys, k => D.why[0][k] || 0)), r1(sum(keys, k => D.why[1][k] || 0))], sw = keys.map(k => ({ k, d: (D.why[0][k] || 0) - (D.why[1][k] || 0) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
      P.push(H.panel('점수 구성', '점수가 어디서 나왔는지 (이벤트 기록 기준)', `${keys.map(k => row2(WHY[k], D.why[0][k] || 0, D.why[1][k] || 0, cmp(D.why[0][k] || 0, D.why[1][k] || 0))).join('')}<ul class="lm-ul"><li>내 점수 ${tot[0]}점: ${keys.filter(k => D.why[0][k]).map(k => `${WHY[k]} ${D.why[0][k]}(${pc(D.why[0][k], tot[0])}%)`).join(' · ') || '-'}</li><li>상대 점수 ${tot[1]}점: ${keys.filter(k => D.why[1][k]).map(k => `${WHY[k]} ${D.why[1][k]}(${pc(D.why[1][k], tot[1])}%)`).join(' · ') || '-'}</li>${sw && Math.abs(sw.d) >= 2 ? `<li class="${sw.d > 0 ? 'ok' : 'bad'}">점수 격차가 가장 크게 난 경로는 "${WHY[sw.k]}" (${sgn(sw.d)}점)</li>` : ''}</ul>`));
      const c0 = D.cs[0], c1 = D.cs[1], t = (v, f) => (v == null ? '-' : f ? f(v) : v);
      const trow = (label, a, b, c, fa) => `<tr><td>${label}</td><td class="${c}">${t(a, fa)}</td><td>${t(b, fa)}</td></tr>`;
      P.push(H.panel('코어 운영', '초록=우세 · 빨강=열세', `<table class="tbl small"><thead><tr><th>지표</th><th>내 팀</th><th>상대</th></tr></thead><tbody>${trow('제출 횟수', c0.n, c1.n, cmp(c0.n, c1.n))}${trow('제출 점수', c0.pts, c1.pts, cmp(c0.pts, c1.pts))}${trow('제출당 평균 점수', c0.avg, c1.avg, cmp(c0.avg, c1.avg))}${trow('첫 제출', c0.first, c1.first, c0.first != null && (c1.first == null || c0.first < c1.first) ? 'ok' : 'bad', v => tm(v))}${trow('평균 제출 간격(초)', c0.gap, c1.gap, c0.gap != null && c1.gap != null ? cmp(c0.gap, c1.gap, true) : '')}${trow('코어 픽업', c0.pick, c1.pick, cmp(c0.pick, c1.pick))}${trow('제출한 코어', c0.cin, c1.cin, cmp(c0.cin, c1.cin))}${trow('유실한 코어', c0.drop, c1.drop, cmp(c0.drop, c1.drop, true))}${trow('제출 효율(%)', c0.eff, c1.eff, c0.eff != null && c1.eff != null ? cmp(c0.eff, c1.eff) : '')}${trow('코어 든 채 사망', c0.cd, c1.cd, cmp(c0.cd, c1.cd, true))}</tbody></table><ul class="lm-ul">${c0.first != null && c1.first != null && c0.first - c1.first >= 15 * D.TS ? `<li class="bad">첫 제출이 상대보다 ${r1((c0.first - c1.first) / D.TS)}초 늦었습니다. 초반 코어 수급 동선을 점검하세요.</li>` : ''}${c0.cd >= 2 ? `<li class="bad">코어를 든 채 ${c0.cd}번 쓰러져 ${c0.cdn}개를 잃었습니다.</li>` : ''}${c0.eff != null && c0.eff < 60 ? `<li class="bad">제출 효율 ${c0.eff}% — 코어를 주워 놓고 제출 전에 잃는 비율이 높습니다.</li>` : ''}</ul>`));
      if (L.bs.length) {
        const bn = k => (k === 'first' ? '1차' : k === 'late' ? '2차' : k), sp0 = L.bs.filter(b => b[1] === 'spawn'), lines = sp0.map(s => { const d = D.bossD.find(x => x.kind === s[3]); return d ? `<li class="${d.team === 0 ? 'ok' : 'bad'}">${bn(s[3])} 보스: ${tm(s[0])} 출현 → ${tm(d.t)} ${d.team === 0 ? '우리' : '상대'}가 처치 (${r1((d.t - s[0]) / D.TS)}초 소요, 코어 ${d.cores}개 방출). 이후 40초 득점 ${d.team === 0 ? `우리 ${d.kp} : 상대 ${d.op}` : `상대 ${d.kp} : 우리 ${d.op}`}</li>` : `<li>${bn(s[3])} 보스: ${tm(s[0])} 출현 → 경기 종료까지 처치되지 않음</li>`; }), bk = L.ke.filter(e => e[1] === 2);
        P.push(H.panel('보스 교전', '', `<ul class="lm-ul">${lines.join('')}${bk.length ? `<li>보스에게 쓰러진 선수: 우리 ${bk.filter(e => e[3] === 0).length}명 · 상대 ${bk.filter(e => e[3] === 1).length}명</li>` : ''}</ul>`));
      }
      const lab = i => `${tm(L.ticks * i / 4)}~${tm(L.ticks * (i + 1) / 4)}`, lines = [];
      lines.push(`<li>최대 리드 ${sgn(D.hi)}점 · 최대 열세 ${sgn(D.lo)}점 · 선두 교체 ${L.fl.length}회${L.pe[0] ? ` · 첫 득점 ${tm(L.pe[0][0])} ${L.pe[0][1] === 0 ? '우리' : '상대'}(${WHY[L.pe[0][3]] || L.pe[0][3]})` : ''}</li>`);
      if (L.fl.length) lines.push(`<li>선두 교체: ${L.fl.map(f => `${tm(f[0])} ${f[1] === 0 ? '우리' : '상대'}가 역전(${WHY[f[2]] || f[2]})`).join(' · ')}</li>`);
      if (loss && g && g.led >= R.lead) lines.push(`<li class="bad">${g.led}점 앞서다 역전당했습니다. 리드를 잡은 뒤 제출·수비 운영이 무너졌습니다.</li>`);
      if (win && D.lo <= -R.lead) lines.push(`<li class="ok">최대 ${-D.lo}점 뒤처졌다가 뒤집었습니다. 후반 운영이 통했습니다.</li>`);
      const last = D.q[3]; if (last.p[1] > last.p[0]) lines.push(`<li class="bad">마지막 구간 득점이 ${r1(last.p[0])}:${r1(last.p[1])}로 밀렸습니다. 막판 대응이 약합니다.</li>`);
      const worst = D.q.map((x, i) => ({ i, v: x.p[0] - x.p[1] })).sort((a, b) => a.v - b.v)[0]; if (worst.v < 0) lines.push(`<li class="bad">가장 크게 밀린 구간은 ${lab(worst.i)}(득점 차 ${sgn(worst.v)})입니다.</li>`);
      P.push(H.panel('경기 흐름', '4등분 구간 · 점수차 그래프', `${leadChart(L)}${D.q.map((x, i) => `<div class="lm-fr"><span>${lab(i)}</span><div>${bar(x.p[0], x.p[1])}<small class="lm-fv">득점 ${r1(x.p[0])}:${r1(x.p[1])} · 킬 ${x.k[0]}:${x.k[1]} · 구간 말 점수차 ${sgn(x.end)}</small></div><em class="lm-vd ${cmp(x.p[0], x.p[1])}">${vd(cmp(x.p[0], x.p[1]))}</em></div>`).join('')}<ul class="lm-ul">${lines.join('')}</ul>`));
      if (D.fights.length) {
        const w = D.fights.filter(f => f.net > 0).length, l = D.fights.filter(f => f.net < 0).length, fk = L.ke.slice().sort((a, b) => a[0] - b[0]);
        const via = (side) => top(tally(L.ke.filter(e => e[1] === side), e => e[5]), 3);
        P.push(H.panel('교전 · 킬 분석', '8초 이내 이어진 킬을 한 교전으로 묶음', `<table class="tbl small"><thead><tr><th>시간</th><th>킬(내:상대${D.fights.some(f => f.kb) ? '+보스' : ''})</th><th>코어 유실(내/상대)</th><th>전후 점수 변동</th><th>결과</th></tr></thead><tbody>${D.fights.map(f => `<tr><td>${tm(f.t0)}${f.t1 > f.t0 ? `~${tm(f.t1)}` : ''}</td><td>${f.km}:${f.ml - f.kb}${f.kb ? `+${f.kb}` : ''}</td><td>${f.dm}/${f.df}</td><td class="${f.pm > 0 ? 'ok' : f.pm < 0 ? 'bad' : ''}">${sgn(f.pm)}</td><td class="${f.net > 0 ? 'ok' : f.net < 0 ? 'bad' : ''}">${f.net > 0 ? '승' : f.net < 0 ? '패' : '무'}</td></tr>`).join('')}</tbody></table>
          <ul class="lm-ul"><li>교전 ${D.fights.length}회 — 승 ${w} · 패 ${l} · 무 ${D.fights.length - w - l}</li>${fk[0] ? `<li>첫 킬: ${tm(fk[0][0])} ${fk[0][1] === 0 ? '우리' : fk[0][1] === 1 ? '상대' : '보스'}${fk[0][2] ? ` ${nm(fk[0][2])}` : ''} → ${nm(fk[0][4])}</li>` : ''}<li>우리 킬 수단: ${via(0) || '-'}</li><li>상대 킬 수단: ${via(1) || '-'}</li></ul>
          <details class="lm-det"><summary>킬 로그 전체 (${fk.length})</summary><ul class="lm-ul">${fk.map(e => `<li class="${e[3] === 0 ? 'bad' : e[1] === 0 ? 'ok' : ''}">${tm(e[0])} ${e[2] ? nm(e[2]) : e[1] === 2 ? '보스' : '환경'} → ${nm(e[4])}${e[5] ? ` (${e[5]})` : ''}${e[6] ? ` · 코어 ${e[6]}개 유실` : ''}</li>`).join('')}</ul></details>`));
      }
      const tr = (x, T) => { const m = L.mvp && L.mvp[0] === x[0] && L.mvp[1] === x[1]; return `<tr class="${m ? 'mvp' : ''}"><td>${sp(x[1])}${nm(x[1])}${m ? ' ★' : ''}<small class="lm-fv">${roleOf(FD(x[1]))}</small></td><td>${x[2] || '-'}</td><td>${x[4]}/${x[5]}</td><td>${x[6]} <small>${pc(x[6], T)}%</small></td><td>${x[13]}</td><td>${x[7]}</td><td>${x[14]}/${x[15]}</td><td>${x[9]}회 · ${x[16]}코어 · ${x[8]}점</td><td>${x[11] != null ? `${x[11]}/${x[12]}` : '-'}</td></tr>`; };
      const T0 = sum(D.mine, x => x[6]), T1 = sum(D.foe, x => x[6]), ace = D.foe.slice().sort((a, b) => b[6] - a[6])[0], aceK = D.foe.slice().sort((a, b) => b[4] - a[4])[0], srt = l => l.slice().sort((a, b) => a[3] - b[3]);
      P.push(H.panel('선수·파이터별 상세', '킬/데스 · 준 피해(팀 비중) · 받은 피해 · 치유 · 스킬/궁 · 제출 · 폼/멘탈', `<div class="lm-scroll"><table class="tbl small"><thead><tr><th>파이터</th><th>선수</th><th>K/D</th><th>준 피해</th><th>받은 피해</th><th>치유</th><th>스킬/궁</th><th>제출</th><th>폼/멘탈</th></tr></thead><tbody><tr><th colspan="9">내 팀</th></tr>${srt(D.mine).map(x => tr(x, T0)).join('')}<tr><th colspan="9">상대 팀</th></tr>${srt(D.foe).map(x => tr(x, T1)).join('')}</tbody></table></div>
        <div class="lm-cards">${srt(D.mine).map(x => `<div class="lm-card"><h5>${sp(x[1])}${nm(x[1])}${x[2] ? ` · ${x[2]}` : ''}</h5><ul class="lm-ul">${unitNotes(x, L, D, L.mvp && L.mvp[0] === 0 && L.mvp[1] === x[1]).map(n => `<li class="${n[0]}">${n[1]}</li>`).join('')}</ul></div>`).join('')}</div>
        ${ace ? `<ul class="lm-ul"><li>상대 최다 피해: ${nm(ace[1])}(${ace[6]}, 상대 팀의 ${pc(ace[6], T1)}%)${aceK && aceK[4] > 0 ? ` · 최다 킬: ${nm(aceK[1])}(${aceK[4]}킬)` : ''} — 다음 밴·교전 타깃 후보입니다.</li></ul>` : ''}`));
    }
    const fs = row.me.map(FD).filter(Boolean), flags = [], myFav = favOf(G);
    if (!fs.some(isTank)) flags.push(['bad', '전열(탱커·전위)이 없는 조합이었습니다. 후열이 그대로 노출됩니다.']);
    if (fs.filter(isBack).length >= 3) flags.push(['bad', '후열 3명 — 앞을 막아줄 파이터가 없습니다.']);
    const mu = typeof Draft !== 'undefined' && Draft.matchup ? Draft.matchup(row.me, row.op) : null, oppFav = new Set();
    try { const t = League.team(G, row.oppId); ((t && t.pros) || []).forEach(id => (((Pros.get(G, id) || {}).favs) || []).forEach(x => oppFav.add(x))); } catch (e) { /* 상대 정보 없음 */ }
    const lost = row.bo.filter(id => myFav.has(id)), hit = row.bm.filter(id => oppFav.has(id)), oppUsedFav = row.op.filter(id => oppFav.has(id)), myUsedFav = row.me.filter(id => myFav.has(id));
    const names = l => l.map(nm).join(', ') || '없음', mrow = a => `<tr><td>${sp(a.id)}${nm(a.id)}</td><td class="${a.k > 1.1 ? 'ok' : a.k < 0.9 ? 'bad' : ''}">×${r2(a.k)}</td><td>${a.why[0] || '뚜렷한 우열 없음'}</td></tr>`;
    P.push(H.panel('밴픽 · 조합 · 상성', '상성 수치는 AI 밴픽과 같은 규칙으로 계산 (1.0 = 보통)', `<ul class="lm-ul"><li>내 조합: ${names(row.me)} · 상대 조합: ${names(row.op)}</li>${flags.map(x => `<li class="${x[0]}">${x[1]}</li>`).join('')}
      <li class="${lost.length ? 'bad' : ''}">상대 밴: ${names(row.bo)}${lost.length ? ` — 내 선수 선호 파이터 ${lost.length}개(${names(lost)})를 잃었습니다` : ''}</li>
      <li class="${hit.length ? 'ok' : ''}">내 밴: ${names(row.bm)}${hit.length ? ` — 상대 선호 파이터 ${names(hit)}를 정확히 막았습니다` : oppUsedFav.length ? ` — 빗나갔습니다. 상대는 선호 파이터 ${names(oppUsedFav)}를 그대로 썼습니다` : ''}</li>
      <li>내 선수 선호 파이터 사용 ${myUsedFav.length}/3${row.counter != null ? ` · 누적 상성 승률 ${Math.round(row.counter * 100)}%` : ''}</li></ul>
      ${mu ? `<table class="tbl small"><thead><tr><th>내 파이터 → 상대 조합</th><th>상성</th><th>이유</th></tr></thead><tbody>${mu.mine.map(mrow).join('')}</tbody></table><table class="tbl small"><thead><tr><th>상대 파이터 → 내 조합</th><th>상성</th><th>이유</th></tr></thead><tbody>${mu.theirs.map(mrow).join('')}</tbody></table><ul class="lm-ul"><li class="${mu.mk >= mu.tk ? 'ok' : 'bad'}">조합 종합 상성: 내 ${r2(mu.mk)} vs 상대 ${r2(mu.tk)} — ${mu.mk >= mu.tk * 1.05 ? '밴픽 상성은 우리 쪽이 유리했습니다' : mu.mk * 1.05 <= mu.tk ? '밴픽 상성은 상대가 유리했습니다' : '상성은 비슷했습니다'}</li></ul>` : ''}`));
    const axes = (CONFIG.tactics.team || []).filter(c => CONFIG.tactics.pre.team.includes(c.id)), mineT = ((typeof MyData !== 'undefined' && MyData.get(G).tac) || {});
    if (L && L.tac && axes.length) {
      const on = (c, id) => { const o = c.options.find(x => x.id === id); return o ? o.name : '-'; }, OC = CONFIG.orders || {}, oname = id => { const d = (OC.team || []).concat(OC.unit || []).find(x => x.id === id); return d ? d.name : id; };
      const od = L.od.filter(o => o[1] === 0), od1 = L.od.filter(o => o[1] === 1), cats = (CONFIG.tactics.categories || []).filter(c => CONFIG.tactics.pre.slot && CONFIG.tactics.pre.slot.includes(c.id));
      const slotTxt = i => (L.sl && L.sl[0][i] ? cats.map(c => { const id = L.sl[0][i][c.id], o = c.options.find(x => x.id === id); return id && id !== c.neutral && o ? `${c.name} ${o.name}` : ''; }).filter(Boolean).join(' · ') : '');
      P.push(H.panel('전술 · 지휘', '내 누적 승률은 이 경기까지 포함한 내 팀 기록', `<table class="tbl small"><thead><tr><th>축</th><th>내 설정</th><th>내 누적</th><th>상대 설정</th></tr></thead><tbody>${axes.map(c => { const mid = L.tac[0][c.id], rc = (mineT[c.id] || {})[mid], w = rc && rc[0] ? Math.round(rc[1] / rc[0] * 100) : null; return `<tr><td>${c.name}</td><td>${on(c, mid)}</td><td class="${rc && rc[0] >= 4 && w < 40 ? 'bad' : ''}">${rc && rc[0] ? `${rc[1]}/${rc[0]}경기 ${w}%` : '-'}</td><td>${on(c, L.tac[1][c.id])}</td></tr>`; }).join('')}</tbody></table>
        <ul class="lm-ul">${L.sl ? D.mine.slice().sort((a, b) => a[3] - b[3]).map((x, i) => slotTxt(i) ? `<li>${nm(x[1])}: ${slotTxt(i)}</li>` : '').join('') : ''}<li>지휘 기록: 우리 ${od.length}회 · 상대 ${od1.length}회${od.length ? ` — ${od.slice(0, 8).map(o => `${tm(o[0])} ${oname(o[3])}(${o[4] >= 0 ? '+' : ''}${o[4]})`).join(' · ')}${od.length > 8 ? ' …' : ''}` : ''}</li></ul>`));
    }
    const gp = row.pw[0] - row.pw[1];
    P.push(H.panel('컨디션 · 전력', '', `<ul class="lm-ul"><li class="${gp <= R.gapBad ? 'bad' : gp >= -R.gapBad ? 'ok' : ''}">평균 전력 내 ${row.pw[0]} / 상대 ${row.pw[1]} (차이 ${sgn(gp)})${row.fast ? '' : ' — 실제 전투에서 공격·방어·속도는 파이터 기본 스탯과 전술로만 정해집니다. 선수 능력치는 AI 판단 품질에만 반영됩니다'}</li><li class="${row.fm[0] < R.lowForm || row.fm[1] < R.lowMental ? 'bad' : ''}">내 평균 폼 ${row.fm[0]} · 멘탈 ${row.fm[1]} (경고선 폼 ${R.lowForm} · 멘탈 ${R.lowMental}) — 낮으면 스킬 아끼기·후퇴 기준·추격 판단이 나빠집니다</li>${row.exp != null ? `<li>능력치 기준 기대 승률 ${Math.round(row.exp * 100)}%</li>` : ''}</ul>`));
    return shell(say, head + P.join(''));
  }

  /* 데이터 센터 '리포트 룸': 담당관 + 시즌별/전체 분석. st.rsel = 'all' | 시즌 번호 */
  function room(G, st, H) {
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
