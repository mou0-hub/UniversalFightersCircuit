/* mydata.js — 데이터 센터 '내 데이터': 내 팀 경기(리그·플레이오프·MSI·월드)의 캐릭터/조합/선수/상대/시즌 집계 + 화면 */
const MyData = (() => {
  const blank = () => ({ v: 1, g: 0, w: 0, l: 0, d: 0, pf: 0, pa: 0, kf: 0, ka: 0, dmg: 0, heal: 0, deliv: 0, ch: {}, combo: {}, pair: {}, pro: {}, opp: {}, kind: {}, season: {}, log: [], tac: {}, vtac: {}, slot: {} });
  const get = G => (G.mine = G.mine || blank());
  const bump = (o, k, init) => (o[k] = o[k] || init());
  const line = () => ({ g: 0, w: 0, d: 0, k: 0, de: 0, dmg: 0, heal: 0, pts: 0, deliv: 0, mvp: 0 });
  const KINDS = { league: '정규시즌', playoff: '플레이오프', msi: 'MSI', worlds: '월드 챔피언십' };

  function add(o, u, win, draw) {
    o.g++; if (win) o.w++; if (draw) o.d++;
    o.k += u.kills || 0; o.de += u.deaths || 0; o.dmg += u.dmg || 0; o.heal += u.healed || 0; o.pts += u.dpts || 0; o.deliv += u.deliv || 0;
  }

  function record(G, M, res) {
    if (!M || M.mineDone || !res || !res.units) return;
    M.mineDone = true;
    const S = get(G), p = M.pIdx, win = res.winner === p, draw = res.winner === -1, mine = res.units.filter(u => u.team === p), foe = res.units.filter(u => u.team !== p);
    const picks = ((M.picks && M.picks[p]) || mine.map(u => u.ch.id)).slice().sort(), oppId = M.m.a === 'player' ? M.m.b : M.m.a, oppName = League.name(G, oppId);
    const sum = (l, k) => l.reduce((s, u) => s + (u[k] || 0), 0), kf = sum(mine, 'kills'), ka = sum(foe, 'kills'), pf = res.score[p], pa = res.score[1 - p];
    S.g++; if (win) S.w++; else if (draw) S.d++; else S.l++;
    S.pf += pf; S.pa += pa; S.kf += kf; S.ka += ka; S.dmg += sum(mine, 'dmg'); S.heal += sum(mine, 'healed'); S.deliv += sum(mine, 'deliv');
    mine.forEach(u => {
      const c = bump(S.ch, u.ch.id, line); add(c, u, win, draw); if (res.mvpTeam === p && res.mvpFighter === u.ch.id) c.mvp++;
      if (u.nick) { const r = bump(S.pro, u.nick, () => ({ ...line(), ch: {} })); add(r, u, win, draw); r.ch[u.ch.id] = (r.ch[u.ch.id] || 0) + 1; if (res.mvpTeam === p && res.mvpFighter === u.ch.id) r.mvp++; }
    });
    const cb = bump(S.combo, picks.join('|'), () => ({ g: 0, w: 0, d: 0, k: 0, pf: 0, pa: 0 }));
    cb.g++; if (win) cb.w++; if (draw) cb.d++; cb.k += kf; cb.pf += pf; cb.pa += pa;
    for (let i = 0; i < picks.length; i++) for (let j = i + 1; j < picks.length; j++) { const pr = bump(S.pair, picks[i] + '|' + picks[j], () => ({ g: 0, w: 0 })); pr.g++; if (win) pr.w++; }
    const op = bump(S.opp, oppName, () => ({ g: 0, w: 0, d: 0, pf: 0, pa: 0, k: 0, ka: 0 }));
    op.g++; if (win) op.w++; if (draw) op.d++; op.pf += pf; op.pa += pa; op.k += kf; op.ka += ka;
    const kd = bump(S.kind, M.kind, () => ({ g: 0, w: 0, d: 0 })); kd.g++; if (win) kd.w++; if (draw) kd.d++;
    const se = bump(S.season, G.season || 1, () => ({ g: 0, w: 0, d: 0, pf: 0, pa: 0, k: 0, ka: 0 })); se.g++; if (win) se.w++; if (draw) se.d++; se.pf += pf; se.pa += pa; se.k += kf; se.ka += ka;
    if (res.tac) {
      const put = (root, c, o, on) => { const row = ((root[c] = root[c] || {})[o] = root[c][o] || [0, 0]); row[0]++; if (on) row[1]++; };
      S.tac = S.tac || {}; S.vtac = S.vtac || {}; S.slot = S.slot || {};
      Object.keys(res.tac.st[p]).forEach(c => { put(S.tac, c, res.tac.st[p][c], win); put(S.vtac, c, res.tac.st[1 - p][c], win); });
      (res.tac.sl[p] || []).forEach(s => Object.keys(s).forEach(c => put(S.slot, c, s[c], win)));
    }
    S.log.unshift({ s: G.season || 1, kind: M.kind, opp: oppName, r: win ? 1 : draw ? 0 : -1, sc: pf + ':' + pa, k: kf + ':' + ka, picks });
    S.log.length = Math.min(S.log.length, 40);
  }

  /* ---------- 화면 ---------- */
  const pct = x => (x * 100).toFixed(1) + '%', f1 = x => (Math.round(x * 10) / 10).toFixed(1), div = (a, b) => (b ? a / b : 0);
  const kda = r => f1(div(r.k, Math.max(1, r.de)));
  const sorters = { g: (a, b) => b.g - a.g || b.wr - a.wr, wr: (a, b) => (b.g > 0) - (a.g > 0) || b.wr - a.wr || b.g - a.g, kd: (a, b) => b.kd - a.kd, pts: (a, b) => b.apts - a.apts, dmg: (a, b) => b.admg - a.admg };

  function html(g, st, H) {
    const S = get(g), sub = st.sub || 'overview', FD = H.FD;
    const subs = [['overview', '개요'], ['char', '캐릭터'], ['combo', '조합'], ['tac', '전술'], ['pro', '선수'], ['opp', '상대 팀'], ['log', '최근 경기']];
    const nav = `<div class="chips my-subs">${subs.map(([id, n]) => `<button class="chip ${sub === id ? 'on' : ''}" data-act="myTab" data-sub="${id}">${n}</button>`).join('')}</div>`;
    if (!S.g) return `${nav}<p class="empty">내 팀이 치른 경기가 아직 없습니다. 경기를 치르면 캐릭터·조합·선수별 기록이 여기에 쌓입니다. (이 기능 도입 이전 경기는 집계되지 않습니다)</p>`;
    const tile = (k, v, s) => `<div class="dc-tile"><small>${k}</small><b>${v}</b><span>${s || ''}</span></div>`;
    const icons = ids => `<span class="my-combo">${ids.map(id => H.mini(FD(id))).join('')}</span>`;
    const th = (key, n) => `<th><button class="dc-th ${(st.msort || 'g') === key ? 'on' : ''}" data-act="mySort" data-k="${key}">${n}${(st.msort || 'g') === key ? ' ▾' : ''}</button></th>`;
    const rowsOf = o => Object.keys(o).map(id => { const r = o[id]; return { id, ...r, wr: div(r.w, r.g), kd: div(r.k, Math.max(1, r.de)), apts: div(r.pts, r.g), admg: div(r.dmg, r.g) }; });
    let body = '';
    if (sub === 'overview') {
      const chs = rowsOf(S.ch).filter(x => FD(x.id)), most = chs.slice().sort(sorters.g)[0], best = chs.filter(x => x.g >= Math.min(3, S.g)).sort(sorters.wr)[0];
      const cbs = Object.keys(S.combo).map(k => ({ key: k, ...S.combo[k], wr: div(S.combo[k].w, S.combo[k].g) })).filter(x => x.g >= Math.min(2, S.g)).sort((a, b) => b.wr - a.wr || b.g - a.g)[0];
      const tiles = `<div class="dc-tiles">${tile('전적', `${S.w}승 ${S.d ? S.d + '무 ' : ''}${S.l}패`, `${S.g}경기 · 승률 ${pct(div(S.w, S.g))}`)}${tile('평균 점수', `${f1(div(S.pf, S.g))} : ${f1(div(S.pa, S.g))}`, '득점 : 실점')}${tile('평균 킬', `${f1(div(S.kf, S.g))} : ${f1(div(S.ka, S.g))}`, `팀 KDA ${f1(div(S.kf, Math.max(1, S.ka)))}`)}${tile('경기당 제출', f1(div(S.deliv, S.g)), '코어 제출 수')}</div>`;
      const tiles2 = `<div class="dc-tiles">${tile('최다 사용', most ? FD(most.id).name : '-', most ? `${most.g}경기 · 승률 ${pct(most.wr)}` : '')}${tile('최고 승률 캐릭터', best ? FD(best.id).name : '-', best ? `${pct(best.wr)} (${best.g}경기)` : '표본 부족')}${tile('최고 승률 조합', cbs ? icons(cbs.key.split('|')) : '-', cbs ? `${pct(cbs.wr)} (${cbs.g}경기)` : '표본 부족')}${tile('경기당 피해', Math.round(div(S.dmg, S.g)), `치유 ${Math.round(div(S.heal, S.g))}`)}</div>`;
      const kinds = Object.keys(S.kind).map(k => `<tr><td class="tn">${KINDS[k] || k}</td><td>${S.kind[k].g}</td><td>${S.kind[k].w}승 ${S.kind[k].g - S.kind[k].w - S.kind[k].d}패</td><td>${pct(div(S.kind[k].w, S.kind[k].g))}</td></tr>`).join('');
      const seas = Object.keys(S.season).map(Number).sort((a, b) => b - a).map(s => { const r = S.season[s]; return `<tr><td class="tn">${s}시즌</td><td>${r.g}</td><td>${r.w}승 ${r.g - r.w - r.d}패</td><td>${pct(div(r.w, r.g))}</td><td>${f1(div(r.pf, r.g))}:${f1(div(r.pa, r.g))}</td><td>${f1(div(r.k, r.g))}:${f1(div(r.ka, r.g))}</td></tr>`; }).join('');
      body = tiles + tiles2 + `<div class="dc-cols">${H.panel('대회별 전적', '', `<table class="tbl dc-tbl"><thead><tr><th>구분</th><th>경기</th><th>전적</th><th>승률</th></tr></thead><tbody>${kinds}</tbody></table>`)}${H.panel('시즌별 전적', '', `<table class="tbl dc-tbl"><thead><tr><th>시즌</th><th>경기</th><th>전적</th><th>승률</th><th>점수</th><th>킬</th></tr></thead><tbody>${seas}</tbody></table>`)}</div>`;
    } else if (sub === 'char') {
      const k = st.msort || 'g', rows = rowsOf(S.ch).filter(x => FD(x.id)).sort(sorters[k] || sorters.g);
      body = H.panel('내 캐릭터 기록', '출전한 모든 경기 기준', `<table class="tbl dc-tbl"><thead><tr><th>#</th><th>캐릭터</th>${th('g', '경기')}${th('wr', '승률')}${th('kd', 'KDA')}<th>평균 킬</th>${th('dmg', '평균 피해')}${th('pts', '평균 제출점수')}<th>MVP</th></tr></thead><tbody>${rows.map((x, i) => `<tr data-act="dcFighter" data-id="${x.id}"><td>${i + 1}</td><td class="tn dc-tn">${H.name(x.id)}</td><td>${x.g}</td><td><span class="dc-v">${pct(x.wr)}</span>${H.bar(x.wr, 1, x.wr >= 0.5 ? '' : 'bad')}</td><td>${kda(x)}</td><td>${f1(div(x.k, x.g))}</td><td>${Math.round(x.admg)}</td><td>${f1(x.apts)}</td><td>${x.mvp || '-'}</td></tr>`).join('')}</tbody></table>`);
    } else if (sub === 'combo') {
      const rows = Object.keys(S.combo).map(key => ({ ids: key.split('|'), ...S.combo[key], wr: div(S.combo[key].w, S.combo[key].g) })).filter(x => x.ids.every(id => FD(id))).sort((a, b) => b.g - a.g || b.wr - a.wr);
      const pairs = Object.keys(S.pair).map(key => ({ ids: key.split('|'), ...S.pair[key], wr: div(S.pair[key].w, S.pair[key].g) })).filter(x => x.g >= Math.min(2, S.g) && x.ids.every(id => FD(id)));
      const plist = (l, cls) => `<table class="tbl dc-tbl"><tbody>${l.map(x => `<tr><td class="tn">${icons(x.ids)}</td><td>${x.g}경기</td><td><span class="dc-v">${pct(x.wr)}</span>${H.bar(x.wr, 1, cls)}</td></tr>`).join('') || '<tr><td>데이터 부족</td></tr>'}</tbody></table>`;
      body = H.panel('조합 승률', '3인 조합 · 경기 수 순', `<table class="tbl dc-tbl"><thead><tr><th>#</th><th>조합</th><th>경기</th><th>승률</th><th>평균 킬</th><th>평균 점수</th></tr></thead><tbody>${rows.map((x, i) => `<tr><td>${i + 1}</td><td class="tn">${icons(x.ids)}<small class="my-names">${x.ids.map(id => FD(id).name).join(' · ')}</small></td><td>${x.g}</td><td><span class="dc-v">${pct(x.wr)}</span>${H.bar(x.wr, 1, x.wr >= 0.5 ? '' : 'bad')}</td><td>${f1(div(x.k, x.g))}</td><td>${f1(div(x.pf, x.g))}:${f1(div(x.pa, x.g))}</td></tr>`).join('')}</tbody></table>`)
        + `<div class="dc-cols">${H.panel('잘 맞는 듀오', '2인 조합 승률 상위', plist(pairs.slice().sort((a, b) => b.wr - a.wr || b.g - a.g).slice(0, 5), ''))}${H.panel('안 맞는 듀오', '2인 조합 승률 하위', plist(pairs.slice().sort((a, b) => a.wr - b.wr || b.g - a.g).slice(0, 5), 'bad'))}</div>`;
    } else if (sub === 'tac') {
      const T = CONFIG.tactics, LT = Stats.tactics(g), cats = [...T.team.filter(c => T.pre.team.includes(c.id)).map(c => ({ ...c, key: c.id, root: 't' })), ...T.categories.filter(c => T.pre.slot.includes(c.id)).map(c => ({ ...c, key: 's:' + c.id, root: 's', group: '슬롯' }))]; /* 전술 화면에 노출되는 항목만 */
      const cur = cats.find(c => c.key === (st.tcat || 'stance')) || cats[0];
      const mineRoot = cur.root === 't' ? S.tac || {} : S.slot || {}, lgRoot = cur.root === 't' ? LT.team : LT.slot, id = cur.id;
      const chips = cats.map(c => `<button class="chip ${c.key === cur.key ? 'on' : ''}" data-act="myCat" data-c="${c.key}">${c.root === 's' ? '슬롯·' : ''}${c.name}</button>`).join('');
      const rows = cur.options.map(o => { const m = (mineRoot[id] || {})[o.id] || [0, 0], v = cur.root === 't' ? ((S.vtac || {})[id] || {})[o.id] || [0, 0] : null, l = (lgRoot[id] || {})[o.id] || [0, 0]; return { o, m, v, l, wr: div(m[1], m[0]) }; });
      const best = rows.filter(r => r.m[0] >= 3).sort((a, b) => b.wr - a.wr || b.m[0] - a.m[0])[0];
      const cell = a => (a && a[0] ? `<span class="dc-v">${pct(div(a[1], a[0]))}</span>${H.bar(div(a[1], a[0]), 1, a[1] / a[0] >= 0.5 ? '' : 'bad')}<small class="my-names">${a[0]}경기</small>` : '-');
      const unit = cur.root === 't' ? '경기' : '출전';
      body = `<div class="glass panel dc-sel"><div class="chips my-cats">${chips}</div><small class="note">내 팀이 실제로 쓴 설정 기준입니다. 기본값(미설정)도 선택지로 집계되며, '리그 전체'는 AI 팀끼리의 경기까지 포함한 모든 팀의 기록입니다.</small></div>`
        + H.panel(`${cur.name} 별 승률`, best ? `내 기록 중 가장 잘 맞은 선택: ${best.o.name} (${pct(best.wr)}, ${best.m[0]}${unit})` : `표본이 3${unit} 이상인 선택이 아직 없습니다`,
          `<table class="tbl dc-tbl"><thead><tr><th>선택지</th><th>내 승률</th>${cur.root === 't' ? '<th>상대가 쓸 때 내 승률</th>' : ''}<th>리그 전체 승률</th></tr></thead><tbody>${rows.map(r => `<tr><td class="tn">${r.o.name}</td><td>${cell(r.m)}</td>${cur.root === 't' ? `<td>${cell(r.v)}</td>` : ''}<td>${cell(r.l)}</td></tr>`).join('')}</tbody></table>`);
    } else if (sub === 'pro') {
      const rows = Object.keys(S.pro).map(n => { const r = S.pro[n], fav = Object.keys(r.ch).sort((a, b) => r.ch[b] - r.ch[a])[0]; return { n, fav, ...r, wr: div(r.w, r.g), kd: div(r.k, Math.max(1, r.de)) }; }).sort((a, b) => b.g - a.g);
      body = H.panel('내 선수 기록', '프로게이머별 · 출전 경기 기준', rows.length ? `<table class="tbl dc-tbl"><thead><tr><th>선수</th><th>경기</th><th>승률</th><th>KDA</th><th>평균 킬</th><th>평균 피해</th><th>평균 제출점수</th><th>MVP</th><th>주 캐릭터</th></tr></thead><tbody>${rows.map(x => `<tr><td class="tn">${x.n}</td><td>${x.g}</td><td><span class="dc-v">${pct(x.wr)}</span>${H.bar(x.wr, 1, x.wr >= 0.5 ? '' : 'bad')}</td><td>${kda(x)}</td><td>${f1(div(x.k, x.g))}</td><td>${Math.round(div(x.dmg, x.g))}</td><td>${f1(div(x.pts, x.g))}</td><td>${x.mvp || '-'}</td><td>${x.fav && FD(x.fav) ? FD(x.fav).name : '-'}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">선수 기록이 아직 없습니다.</p>');
    } else if (sub === 'opp') {
      const rows = Object.keys(S.opp).map(n => ({ n, ...S.opp[n], wr: div(S.opp[n].w, S.opp[n].g) })).sort((a, b) => b.g - a.g || b.wr - a.wr);
      body = H.panel('상대 팀별 전적', '', `<table class="tbl dc-tbl"><thead><tr><th>팀</th><th>경기</th><th>전적</th><th>승률</th><th>평균 점수</th><th>평균 킬</th></tr></thead><tbody>${rows.map(x => `<tr><td class="tn">${x.n}</td><td>${x.g}</td><td>${x.w}승 ${x.g - x.w - x.d}패</td><td><span class="dc-v">${pct(x.wr)}</span>${H.bar(x.wr, 1, x.wr >= 0.5 ? '' : 'bad')}</td><td>${f1(div(x.pf, x.g))}:${f1(div(x.pa, x.g))}</td><td>${f1(div(x.k, x.g))}:${f1(div(x.ka, x.g))}</td></tr>`).join('')}</tbody></table>`);
    } else {
      body = H.panel('최근 경기', `최근 ${S.log.length}경기`, `<table class="tbl dc-tbl"><thead><tr><th>시즌</th><th>구분</th><th>상대</th><th>결과</th><th>점수</th><th>킬</th><th>조합</th></tr></thead><tbody>${S.log.map(x => `<tr><td>${x.s}</td><td>${KINDS[x.kind] || x.kind}</td><td class="tn">${x.opp}</td><td>${x.r > 0 ? '승' : x.r < 0 ? '패' : '무'}</td><td>${x.sc}</td><td>${x.k}</td><td class="tn">${icons(x.picks.filter(id => FD(id)))}</td></tr>`).join('')}</tbody></table>`);
    }
    /* 모바일: 표가 화면보다 넓으면 표만 가로 스크롤 */
    return nav + body.replace(/<table class="tbl dc-tbl">/g, '<div class="my-scroll"><table class="tbl dc-tbl">').replace(/<\/table>/g, '</table></div>');
  }

  const actions = {
    myTab(el) { UI.dc({ sub: el.dataset.sub }); },
    mySort(el) { UI.dc({ msort: el.dataset.k }); },
    myCat(el) { UI.dc({ tcat: el.dataset.c }); }
  };

  if (typeof document !== 'undefined') {
    const css = document.createElement('style');
    css.textContent = [
      '.my-subs { margin-bottom: 12px; }',
      '.my-cats { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }',
      '.my-combo { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; }',
      '.my-names { display: block; margin-top: 2px; font-size: 11px; color: var(--muted); }',
      '.my-scroll { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }',
      '@media (max-width: 720px) {',
      '  .my-subs { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; }',
      '  .my-subs .chip { flex: none; white-space: nowrap; }',
      '  .my-scroll .dc-tbl { min-width: 560px; font-size: 12px; }',
      '  .my-scroll .dc-tbl th, .my-scroll .dc-tbl td { padding: 7px 8px; white-space: nowrap; }',
      '  .dc-tiles .dc-tile { min-width: 0; padding: 12px; }',
      '  .dc-tiles .dc-tile b { font-size: 18px; }',
      '}'
    ].join('\n');
    document.head.appendChild(css);
  }

  return { blank, get, record, html, actions };
})();
