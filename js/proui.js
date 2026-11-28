/* proui.js — 구단 관리 / 이적시장 화면 (ui.js 의 addView 로 등록) */

const ProUI = (() => {
  const G = () => Game.G, FD = id => CONFIG.fighters[id], money = n => Pros.money(n);
  const st = { tab: 'fa', grade: 'all', cTab: 'goal' };
  const GR = ['S', 'A', 'B', 'C'];
  const flipped = new Set();                       // 뒤집어 둔 카드 키 '위치:선수id' (같은 선수라도 선발 / 선수단 / 시장 카드는 따로 뒤집힘)
  const tier = v => (v >= 90 ? 's' : v >= 75 ? 'a' : v >= 60 ? 'b' : 'c');
  const gcol = p => (p.god ? '#fb7185' : CONFIG.pro.grades[p.grade].color), gname = p => (p.god ? 'SSS' : p.grade);
  const pmini = id => { const f = FD(id); return `<span class="pmini" style="--ec:${f.color}" title="${f.name}"><img class="px" src="${Sprites.url(f)}" alt=""></span>`; };
  const bar = (v, cls) => `<i class="pbar ${cls || ''}"><u style="width:${Math.max(3, Math.min(100, v))}%"></u></i>`;
  const arcTag = p => { if (!p.arc) return ''; const a = Pros.arcOf(p); return (p.sn || 0) >= CONFIG.pro.growth.seasonsToReveal ? `<span class="ptag" title="${a.desc}">${a.icon} ${a.name}</span>` : '<span class="ptag" title="함께 뛴 시즌이 쌓이면 성장 유형이 드러납니다">❔ 성향 미확인</span>'; };
  const tags = p => [arcTag(p), p.trouble >= 60 ? '<span class="ptag bad">트러블 메이커</span>' : '', p.slack >= 60 ? '<span class="ptag bad">태업 성향</span>' : '', p.mental >= 85 ? '<span class="ptag good">강철 멘탈</span>' : '', (p.form != null && p.form >= 75) ? '<span class="ptag good">상승세</span>' : '', (p.form != null && p.form < 35) ? '<span class="ptag bad">슬럼프</span>' : ''].join('');

  const capBar = (used, capV) => `<i class="cap-bar ${used > capV ? 'over' : used > capV * 0.85 ? 'warn' : ''}"><u style="width:${Math.max(2, Math.min(100, used / Math.max(1, capV) * 100))}%"></u></i>`;
  const moodChip = p => { const m = Club.mood(G(), p); return `<span class="ptag ${m.score < 45 ? 'bad' : m.score >= 75 ? 'good' : ''}" title="${m.why}">만족도 ${m.score}</span>`; };

  function backFace(p) {
    const sk = Pros.skills(p), en = Pros.engage(p), ra = Pros.rarity(p), r = CONFIG.roles[p.role], defs = CONFIG.pro.skills;
    const sorted = defs.slice().sort((x, y) => sk[y.id] - sk[x.id]);
    const best = sorted.slice(0, 2).map(d => d.name).join(' · '), worst = sorted[sorted.length - 1].name;
    const avg = Math.round(defs.reduce((t, d) => t + sk[d.id], 0) / defs.length);
    const rows = defs.map(d => `<div class="sk-row" title="${d.desc}"><span>${d.icon} ${d.name}</span><b class="t-${tier(sk[d.id])}">${sk[d.id]}</b>${bar(sk[d.id], 't-' + tier(sk[d.id]))}</div>`).join('');
    return `<div class="pro-card back ${ra ? 'rare-' + ra.id : ''}" style="--gc:${gcol(p)}">
      <div class="back-head"><div class="pro-grade mini"><b>${gname(p)}</b></div>
        <h4>${p.nick}<small>${p.real} · ${p.nation ? Pros.nationName(p.nation) + ' · ' : ''}${p.age}세</small></h4>
        ${ra ? `<span class="rare-badge ${ra.id}">${ra.icon} ${ra.name}</span>` : ''}
        <span class="avg-chip" title="세부 능력치 평균">평균 <b>${avg}</b></span><span class="avg-chip" title="성장 한계">잠재 <b>${p.pot != null ? p.pot : p.ovr}</b></span>
        <span class="flip-hint">↺ 클릭하면 돌아갑니다</span></div>
      <div class="back-info">
        <span title="선호 플레이">🎮 플레이 성향 <b>${Pros.styleName(p.style)}</b></span>
        <span title="${en.desc}">⚔️ 교전 스타일 <b>${en.name}</b></span>
        <span>${r.icon} 선호 역할 <b>${r.name}</b></span>
        <span class="good">▲ 강점 <b>${best}</b></span><span class="bad">▼ 약점 <b>${worst}</b></span>
        <span class="pro-favs" title="선호 캐릭터">${p.favs.map(pmini).join('')}</span></div>
      <div class="sk-grid">${rows}</div></div>`;
  }

  function card(p, actions, o = {}) {
    const r = CONFIG.roles[p.role], ra = Pros.rarity(p), fk = (o.scope || 'x') + ':' + p.id, on = flipped.has(fk);
    const g0 = Game.G, mine = !!(g0 && g0.club && (g0.club.roster || []).includes(p.id));
    if (!mine && p.fxb) Facility.clean(p);
    const pv = mine ? { ...p, ...(({ form, mental, trouble }) => ({ form, mental, trouble }))(Facility.eff(g0, p)) } : p;
    const front = `<div class="pro-card front ${o.cls || ''} ${ra ? 'rare-' + ra.id : ''}" style="--gc:${gcol(p)}">
      <span class="flip-ico">↻</span>
      <div class="pro-grade"><b>${gname(p)}</b><small>${p.god ? 'SSS급' : CONFIG.pro.grades[p.grade].name}</small></div>
      <div class="pro-main"><h4>${p.nick}<small>${p.real} · ${p.nation ? Pros.nationName(p.nation) + ' · ' : ''}${p.age}세</small>${ra ? `<span class="rare-badge ${ra.id}">${ra.icon} ${ra.name}</span>` : ''}</h4>
        <div class="pro-pref"><span title="선호 역할군">${r.icon} ${r.name}</span><span title="선호 플레이">🎮 ${Pros.styleName(p.style)}</span><span class="pro-favs" title="선호 캐릭터">${p.favs.map(pmini).join('')}</span></div>
        <div class="pro-tags">${tags(pv)}</div></div>
      <div class="pro-stat"><div><small>능력</small><b>${p.ovr}</b><span class="pot-line">잠재 <b>${p.pot != null ? p.pot : p.ovr}</b></span></div>
        <div><small>폼 ${pv.form != null ? pv.form : '-'}</small>${bar(pv.form != null ? pv.form : 50, (pv.form != null && pv.form < 40) ? 'bad' : '')}</div>
        <div><small>멘탈 ${pv.mental}</small>${bar(pv.mental, pv.mental < 45 ? 'bad' : '')}</div>
        <div><small>트러블 ${pv.trouble}</small>${bar(pv.trouble, 'warn')}</div></div>
      <div class="pro-money"><b>${money(p.salary)}</b><small>연봉 · 계약 ${p.god ? '무제한' : p.years + '년'}</small>${o.extra || ''}</div>
      <div class="pro-act">${actions || ''}</div></div>`;
    if (o.front) return front.replace('<span class="flip-ico">↻</span>', '');
    return `<div class="pro-flip ${on ? 'flipped' : ''}" data-fk="${fk}" title="클릭하면 세부 능력치를 볼 수 있습니다"><div class="pro-inner">${front}${backFace(p)}</div></div>`;
  }

  function club() {
    const g = G(), c = g.club, ros = Club.roster(g), lu = Club.lineup(g), rank = League.rankOf(g, 'player'), fi = Club.fanInfo(g);
    const exp = Club.ownerPay(g, rank).reduce((s, x) => s + x.v, 0), pay = Club.payroll(g), wage = Club.wage(g), net = exp - wage, ci = Club.capInfo(g), capV = ci.cap, capLeft = capV - pay;
    const tile = (k, v, sub, cls) => `<div class="dc-tile ${cls || ''}"><small>${k}</small><b>${v}</b><span>${sub || ''}</span></div>`;
    const slots = [0, 1, 2].map(i => { const p = lu[i];
      return `<div class="slot ${p ? 'on' : ''}"><div class="slot-n">${i + 1}번</div>${p ? card(p, `<button class="btn small ghost" data-act="proClear" data-slot="${i}">빼기</button>`, { cls: 'compact', scope: 'lu' }) : `<p class="slot-empty">선수를 배치하세요<br><small>아래 선수단에서 [${i + 1}번]을 누르세요</small></p>`}</div>`; }).join('');
    const list = ros.map(p => { const cur = lu.findIndex(x => x && x.id === p.id), rOver = cur >= 0 && Club.payroll(g) - Club.capSal(p) + Club.capSal(p, Market.renewSalary(p)) > Club.cap(g);
      const btns = [0, 1, 2].map(i => `<button class="btn small ${cur === i ? 'primary' : ''}" data-act="proSlot" data-id="${p.id}" data-slot="${i}">${i + 1}번</button>`).join('')
        + (p.years <= 1 ? `<button class="btn small ${p.refused === g.season ? 'dis' : ''}" data-act="proRenew" data-id="${p.id}" title="재계약금 ${money(Market.renewFee(p))} · 새 연봉 ${money(Market.renewSalary(p))}${rOver ? ' · 캡 초과 → 사치세 부과' : ''}">${p.refused === g.season ? '재계약 거부됨' : '재계약' + (rOver ? ' ⚠' : '')}</button>` : '') + `<button class="btn small ghost" data-act="proSell" data-id="${p.id}" title="판매 대금 ${money(Market.sellPrice(p))}">판매</button><button class="btn small ghost" data-act="proRelease" data-id="${p.id}">방출</button>`;
      return card(p, btns, { scope: 'ro', extra: (p.years <= 1 ? '<span class="ptag bad">계약 임박</span> ' : '') + ((p.tn || 0) > 0 ? `<span class="ptag">보유 ${p.tn}시즌 · 캡 반영 ${money(Club.capSal(p))}</span> ` : '') + moodChip(p) }); }).join('');
    const fin = c.finance ? `<div class="glass panel"><h3>지난 시즌 정산 (시즌 ${c.finance.season})</h3><ul class="notes">${c.finance.income.map(x => `<li>${x.k} <b>+${money(x.v)}</b></li>`).join('')}<li>선수단 연봉 <b>−${money(c.finance.cost)}</b></li><li>셀러리캡 <b>${money(Math.round(c.finance.avgPay || c.finance.cost))} / ${money(c.finance.cap || Club.cap(g))}</b></li>${c.finance.tax ? `<li>사치세 <b>−${money(c.finance.tax)}</b></li>` : ''}${c.finance.pen ? `<li>최소 연봉 미달 벌금 <b>−${money(c.finance.pen)}</b></li>` : ''}${c.finance.capTo ? `<li>다음 시즌 셀러리캡 <b>${money(c.finance.capTo)}</b></li>` : ''}${(c.finance.growth || []).map(x => `<li>${x.nick} 성장 <b>${x.from} → ${x.to}</b> (잠재 ${x.pot})${x.promoted ? ` · ${x.oldGrade}→${x.grade}급 승급` : ''}</li>`).join('')}${(c.finance.left || []).map(x => `<li>${x.nick} 이적 → ${x.to} (${x.why})</li>`).join('')}<li>자금 ${money(c.finance.before)} → <b>${money(c.finance.after)}</b></li></ul></div>` : '';
    const sp = c.pendingSponsor;
    const spBox = sp ? `<div class="glass panel" style="border-color:var(--gold)"><h3>📣 스폰서 제안</h3>
      <p><b>${sp.brand}</b> · ${sp.tier} · 제안금 <b style="color:var(--gold)">${money(sp.amount)}</b> (평판 ${sp.rep} 기준)</p>
      <div class="pro-act" style="justify-content:flex-start;margin-top:8px">
        <button class="btn primary" data-act="spAccept">수락</button>
        <button class="btn ghost" data-act="spDecline">거절</button>
      </div></div>` : '';
    const gs = Club.allGoals(g), gOk = gs.filter(x => x.status === 'success').length;
    const goalCard = (og, i) => {
      const prog = Club.goalProgress(g, og), risk = prog ? prog.risk : 'on', ok = og.status === 'success', fail = og.status === 'fail';
      const badge = ok ? 'success' : fail ? 'fail' : risk, name = ok ? '달성' : fail ? '실패' : risk === 'danger' ? '위험' : risk === 'warn' ? '주의' : '순항';
      const cls = ok ? 'pos' : fail || risk === 'danger' ? 'neg' : risk === 'warn' ? 'warn' : '';
      return `<div class="glass panel owner-goal ${cls}"><div class="og-head"><h3>${i ? '🎯' : '⭐'} ${og.label}</h3><span class="og-badge ${badge}">${name}</span></div>
        <p class="og-hint">${prog ? prog.hint : og.desc || ''}</p>${bar(prog ? prog.pct : ok ? 100 : 0)}
        <small>달성 시 +${money(Club.goalReward(g, og))}${og.desc ? ' · ' + og.desc : ''}</small></div>`;
    };
    const goalBody = gs.length ? `<div class="goal-head"><h3>🎯 시즌 목표 <small>${gOk}/${gs.length} 달성</small></h3><small>시즌 종료 시 평가 · ⭐ 핵심 목표만 평판에 반영</small></div><div class="goal-list">${gs.map(goalCard).join('')}</div>` : '<p class="empty glass panel">이번 시즌 목표가 없습니다.</p>';
    const chs = Club.challenges(g), rdy = chs.filter(x => x.ready).length, nf = n => n.toLocaleString('ko-KR');
    const chCard = x => `<div class="ch-item ${x.finished ? 'done' : ''} ${x.ready ? 'ready' : ''}"><b>${x.icon} ${x.name}</b><small>${x.desc}</small>${bar(Math.round(Math.min(1, x.value / x.n) * 100))}<em>${x.finished ? '모든 단계 달성' : `${nf(Math.min(x.value, x.n))}/${nf(x.n)} · 보상 ${money(x.reward)}`}</em>
      <div class="ch-foot"><small>${x.claimed}/${x.total}단계</small>${x.finished ? '' : `<button class="btn small ${x.ready ? 'primary' : 'dis'}" ${x.ready ? '' : 'disabled'} data-act="chClaim" data-id="${x.id}">보상받기</button>`}</div></div>`;
    const chBody = `<div class="glass panel"><h3>🏅 도전과제 <small>${chs.reduce((t, x) => t + x.claimed, 0)}/${chs.reduce((t, x) => t + x.total, 0)}단계</small></h3><div class="ch-grid">${chs.map(chCard).join('')}</div></div>`;
    const rosterBody = `<div class="glass panel team-head"><div><h2>👥 선수단 관리</h2><p>이적시장·FA 시장에서 프로게이머를 영입해 3명을 라인업(1·2·3번)에 배치하세요. 1번 선수가 첫 번째 픽, 2번이 두 번째 픽, 3번이 세 번째 픽 파이터를 맡습니다. 선수의 등급(C~S)이 높을수록 전투 AI가 정교합니다. 선수단은 최대 ${CONFIG.club.maxRoster}명까지 두고, 셀러리캡은 선발 3명에게만 적용됩니다(한 구단에서 오래 뛸수록 캡 반영 연봉이 줄어듭니다).</p></div><div class="pro-act"><button class="btn" data-act="proAuto">라인업 자동 채우기</button></div></div>
      <div class="dc-tiles">${tile('구단 자금', money(c.funds), '시즌 종료 시 정산', c.funds < 0 ? 'neg' : '')}${tile('선발 연봉 / 셀러리캡', money(pay), `선수단 ${ros.length}/${CONFIG.club.maxRoster}명 (총 연봉 ${money(wage)}) · 상한 ${money(capV)}${ci.grow > 0.0005 ? ` (+${(ci.grow * 100).toFixed(0)}%${ci.atMax ? ' 한계' : ''})` : ''} · ${capLeft >= 0 ? '여유 ' + money(capLeft) : '초과 ' + money(-capLeft)}${capBar(pay, capV)}<small class="cap-note">${capLeft < 0 ? `사치세 예상 시즌당 ${money(ci.taxNow)} · ` : ''}재계약 한도 ${money(ci.hard)} · 최소 연봉 ${money(ci.floor)}</small>`, capLeft < 0 ? 'neg' : '')}${tile('예상 구단주 지급', money(exp), `현재 ${rank}위 기준`)}${tile('예상 순수익', (net >= 0 ? '+' : '') + money(net), '지급 − 선수단 총 연봉', net < 0 ? 'neg' : 'pos')}${tile('팬 수', fi.fans.toLocaleString('ko-KR') + '명', `최대 ${fi.max.toLocaleString('ko-KR')}명 · 이번 시즌 ${fi.seasonGain >= 0 ? '+' : ''}${fi.seasonGain.toLocaleString('ko-KR')}`)}${tile('이번 시즌 티켓 수입', money(fi.tix), `${fi.games}경기 · 경기당 평균 ${money(fi.avg)} · 관중 ${Math.round(fi.fill * 100)}% (수용 ${fi.stadium.toLocaleString('ko-KR')}명)`)}</div>
      <div class="lineup">${slots}</div>
      <div class="glass panel"><h3>선수단 <small>${ros.length}명</small></h3>${list || '<p class="empty">선수가 없습니다. 이적시장에서 영입하세요.</p>'}${ros.length < 3 ? '<p class="note">경기를 하려면 최소 3명이 필요합니다.</p>' : ''}</div>${typeof Feedback !== 'undefined' ? Feedback.panel(g) : ''}${fin}`;
    const tabs = [['goal', '🎯 시즌 목표'], ['roster', '👥 선수단 관리'], ['fac', '🏟 구장 꾸미기'], ['ch', '🏅 도전과제' + (rdy ? ` 🔔${rdy}` : '')]];
    if (!tabs.some(t => t[0] === st.cTab)) st.cTab = 'goal';
    const body = st.cTab === 'fac' ? Facility.screen(true) : { goal: goalBody, roster: rosterBody, ch: chBody }[st.cTab];
    return `<section class="pro-view"><div class="glass panel team-head"><div class="club-main">${UI.teamLogo(g.baseTeam, 72)}<div><b class="club-team">${g.teamName}</b><small class="club-lg">${(CONFIG.leagues.find(l => l.id === g.leagueId) || {}).name || ''} 리그</small><h2>${CONFIG.nav.club}</h2></div></div>
      <div class="mk-funds"><small>구단 자금</small><b>${money(c.funds)}</b></div></div>
      ${spBox}<nav class="dc-tabs">${tabs.map(([id, n]) => `<button class="dc-tab ${st.cTab === id ? 'on' : ''}" data-act="clubTab" data-tab="${id}">${n}</button>`).join('')}</nav>${body}</section>`;
  }

  function market() {
    const g = G(), m = Market.ensure(g), c = g.club;
    let list = st.tab === 'fa' ? m.fa.map(id => ({ p: Pros.get(g, id) })).filter(x => x.p) : Market.listed(g);
    if (st.grade !== 'all') list = list.filter(x => x.p.grade === st.grade);
    list.sort((a, b) => GR.indexOf(a.p.grade) - GR.indexOf(b.p.grade) || b.p.ovr - a.p.ovr);
    const full = c.roster.length >= CONFIG.club.maxRoster;
    const cards = list.map(({ p, team }) => {
      const cost = st.tab === 'fa' ? Market.signFee(p) : p.fee + Market.signFee(p), capOk = true, ok = c.funds >= cost && !full && capOk;
      const btn = `<button class="btn ${ok ? 'primary' : 'dis'}" ${ok ? '' : 'disabled'} data-act="${st.tab === 'fa' ? 'proSign' : 'proBuy'}" data-id="${p.id}">${capOk ? (st.tab === 'fa' ? '영입' : '이적') + ' · ' + money(cost) : '캡 초과 · 연봉 ' + money(p.salary)}</button>`;
      return card(p, btn, { scope: 'mk', extra: team ? `<small>소속 ${team.name}</small>` : '<small>자유계약(FA)</small>' }); }).join('');
    const tabs = [['fa', 'FA 시장'], ['tr', '이적 시장']].map(([id, n]) => `<button class="dc-tab ${st.tab === id ? 'on' : ''}" data-act="mkTab" data-tab="${id}">${n}</button>`).join('');
    const chips = ['all', ...GR].map(x => `<button class="chip ${st.grade === x ? 'on' : ''}" data-act="mkGrade" data-g="${x}">${x === 'all' ? '전체' : x + '급'}</button>`).join('');
    return `<section class="pro-view"><div class="glass panel team-head"><div><h2>${CONFIG.nav.market}</h2><p>FA 시장은 계약금만, 이적 시장은 이적료 + 계약금이 듭니다. 선수의 선호 역할군·캐릭터·플레이가 팀과 맞을수록 유리합니다. 시장은 ${CONFIG.pro.market.refreshRounds}라운드마다 갱신됩니다.</p></div>
      <div class="mk-funds"><small>구단 자금</small><b>${money(c.funds)}</b><small>선수단 ${c.roster.length}/${CONFIG.club.maxRoster}</small><small>선발 셀러리캡 ${money(Club.payroll(g))} / ${money(Club.cap(g))}${Club.capInfo(g).grow > 0.0005 ? ` (+${(Club.capInfo(g).grow * 100).toFixed(0)}%)` : ''}</small>${capBar(Club.payroll(g), Club.cap(g))}</div></div>
      <nav class="dc-tabs">${tabs}</nav><div class="filter-row"><h3>${list.length}명</h3><div class="chips">${chips}</div></div>
      <div class="pro-list">${cards || '<p class="empty">조건에 맞는 선수가 없습니다.</p>'}</div></section>`;
  }

  function carry() {
    const c = Game.carry, g = G(); if (!c) return;
    const lg = CONFIG.leagues.find(l => l.id === c.lg), plan = Club.carryPlan(g, c.lg, [...c.sel]), chk = Club.moveCheck(g, c.lg), K = CONFIG.club.carry;
    const rows = Club.roster(g).slice().sort((a, b) => b.ovr - a.ovr).map(p => {
      const on = c.sel.has(p.id), fee = Math.round(p.salary * K.feeMul / 10) * 10;
      return `<button class="cy-row ${on ? 'on' : ''}" data-act="carryToggle" data-id="${p.id}"><span class="cy-chk">${on ? '✔' : ''}</span><span><b>${p.nick}</b> · ${p.grade}급 · 능력 ${p.ovr} / 잠재 ${p.pot} · ${p.age}세</span><span>연봉 ${money(p.salary)}</span><span>비용 ${money(fee)}</span></button>`;
    }).join('');
    const promo = chk.kind === 'up' ? `<ul class="mv-list">${chk.rows.map(r => `<li class="${r.ok ? 'ok' : 'no'}">${r.ok ? '✔' : '✖'} ${r.txt}</li>`).join('')}</ul>` : '';
    UI.modal(`<div class="cy-wrap"><div class="tm-head"><h3>${lg.name} 리그 · ${c.team} 부임 — 선수 승계</h3><small>최대 ${K.max}명까지 새 구단으로 데려갈 수 있습니다. 나머지는 FA 시장으로 나갑니다.</small></div>
      ${promo}<div class="cy-list">${rows}</div>
      <div class="cy-sum"><span>승계 ${plan.picks.length}/${K.max}명 · 승계 비용 <b>${money(plan.fee)}</b> · 이월 자금 +${money(plan.keep)}</span>
        <span>연봉 합 <b class="${plan.pay > plan.cap ? 'bad' : ''}">${money(plan.pay)}</b> / 새 리그 캡 ${money(plan.cap)}</span>${capBar(plan.pay, plan.cap)}
        <span>부임 시 자금 <b>${money(plan.funds)}</b></span></div>
      <div class="modal-actions"><button class="btn ghost" data-act="carryNone">승계 없이 새 선수단</button><button class="btn" data-act="carryAuto">추천 선택</button><button class="btn" data-act="closeModal">취소</button><button class="btn primary" data-act="carryGo" ${plan.ok ? '' : 'disabled'}>${plan.picks.length ? '선택한 선수 승계하고 부임' : '새 선수단으로 부임'}</button></div></div>`, 'tm-box', true);
  }
  function moveBlocked(lg, team, chk) {
    UI.modal(`<div class="cy-wrap"><div class="tm-head"><h3>${lg.name} 리그 · ${team} — 승격 조건 미달</h3><small>한 단계씩, 성적과 선수단·재정 기반을 갖춰야 상위 리그로 갈 수 있습니다.</small></div>
      <ul class="mv-list">${chk.rows.map(r => `<li class="${r.ok ? 'ok' : 'no'}">${r.ok ? '✔' : '✖'} ${r.txt}</li>`).join('')}</ul>
      <div class="modal-actions"><button class="btn" data-act="closeModal">닫기</button></div></div>`, 'tm-box', true);
  }

  UI.addView('club', club); UI.addView('market', market);
  /* 카드 클릭 → 앞/뒤 전환 (버튼을 누를 때는 제외). 클릭한 카드 하나만 뒤집힙니다 */
  document.addEventListener('click', e => {
    const w = e.target.closest && e.target.closest('.pro-flip'); if (!w || e.target.closest('button, a, input')) return;
    const fk = w.dataset.fk, on = !w.classList.contains('flipped');
    w.classList.toggle('flipped', on);
    if (on) flipped.add(fk); else flipped.delete(fk);
  });
  UI.onStatus(g => {
    let c = document.getElementById('fundsChip');
    if (!c) { c = document.createElement('span'); c.id = 'fundsChip'; c.className = 'pill'; const ref = document.getElementById('seasonChip'); ref.parentNode.insertBefore(c, ref); }
    let rc = document.getElementById('repChip');
    if (!rc) { rc = document.createElement('span'); rc.id = 'repChip'; rc.className = 'pill'; const ref = document.getElementById('seasonChip'); ref.parentNode.insertBefore(rc, ref); }
    let fc = document.getElementById('fanChip');
    if (!fc) { fc = document.createElement('span'); fc.id = 'fanChip'; fc.className = 'pill'; const ref = document.getElementById('seasonChip'); ref.parentNode.insertBefore(fc, ref); }
    if (g.club) { const fi = Club.fanInfo(g); fc.textContent = `👥 ${fi.fans.toLocaleString('ko-KR')}${fi.last ? (fi.last > 0 ? ' ▲' : ' ▼') : ''}`; fc.title = `팬 최대 ${fi.max.toLocaleString('ko-KR')}명 · 수용 인원 ${fi.stadium.toLocaleString('ko-KR')}명`; fc.classList.toggle('hot', fi.last > 0); } else fc.textContent = '';
    c.textContent = g.club ? `💰 ${money(g.club.funds)}` : ''; c.classList.toggle('hot', !!g.club && g.club.funds < 0);
    const rep = (typeof News !== 'undefined' && News.ensureRep) ? News.ensureRep(g) : (g.rep || { v: 50, last: 0 });
    rc.textContent = '평판 ' + rep.v + (rep.last ? (rep.last > 0 ? ' ▲' : ' ▼') : '');
    rc.title = (News.repLabel ? News.repLabel(rep.v) : '') + (g.club && g.club.pendingSponsor ? ' · 스폰서 제안 대기' : '');
    rc.classList.toggle('hot', rep.v >= 70);
    rc.style.outline = (g.club && g.club.pendingSponsor) ? '1px solid var(--gold)' : '';
  });
  return { mk: p => { Object.assign(st, p); UI.refresh(); }, card, carry, moveBlocked, capBar };
})();
