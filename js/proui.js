/* proui.js — 구단 관리 / 이적시장 화면 (ui.js 의 addView 로 등록) */

const ProUI = (() => {
  const G = () => Game.G, FD = id => CONFIG.fighters[id], money = n => Pros.money(n);
  const st = { tab: 'fa', grade: 'all' };
  const GR = ['S', 'A', 'B', 'C'];
  const flipped = new Set();                       // 뒤집어 둔 카드 키 '위치:선수id' (같은 선수라도 선발 / 선수단 / 시장 카드는 따로 뒤집힘)
  const tier = v => (v >= 90 ? 's' : v >= 75 ? 'a' : v >= 60 ? 'b' : 'c');
  const gcol = g => CONFIG.pro.grades[g].color;
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
    return `<div class="pro-card back ${ra ? 'rare-' + ra.id : ''}" style="--gc:${gcol(p.grade)}">
      <div class="back-head"><div class="pro-grade mini"><b>${p.grade}</b></div>
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
    const front = `<div class="pro-card front ${o.cls || ''} ${ra ? 'rare-' + ra.id : ''}" style="--gc:${gcol(p.grade)}">
      <span class="flip-ico">↻</span>
      <div class="pro-grade"><b>${p.grade}</b><small>${CONFIG.pro.grades[p.grade].name}</small></div>
      <div class="pro-main"><h4>${p.nick}<small>${p.real} · ${p.nation ? Pros.nationName(p.nation) + ' · ' : ''}${p.age}세</small>${ra ? `<span class="rare-badge ${ra.id}">${ra.icon} ${ra.name}</span>` : ''}</h4>
        <div class="pro-pref"><span title="선호 역할군">${r.icon} ${r.name}</span><span title="선호 플레이">🎮 ${Pros.styleName(p.style)}</span><span class="pro-favs" title="선호 캐릭터">${p.favs.map(pmini).join('')}</span></div>
        <div class="pro-tags">${tags(p)}</div></div>
      <div class="pro-stat"><div><small>능력</small><b>${p.ovr}</b><span class="pot-line">잠재 <b>${p.pot != null ? p.pot : p.ovr}</b></span></div>
        <div><small>폼 ${p.form != null ? p.form : '-'}</small>${bar(p.form != null ? p.form : 50, (p.form != null && p.form < 40) ? 'bad' : '')}</div>
        <div><small>멘탈 ${p.mental}</small>${bar(p.mental, p.mental < 45 ? 'bad' : '')}</div>
        <div><small>트러블 ${p.trouble}</small>${bar(p.trouble, 'warn')}</div></div>
      <div class="pro-money"><b>${money(p.salary)}</b><small>연봉 · 계약 ${p.years}년</small>${o.extra || ''}</div>
      <div class="pro-act">${actions || ''}</div></div>`;
    if (o.front) return front.replace('<span class="flip-ico">↻</span>', '');
    return `<div class="pro-flip ${on ? 'flipped' : ''}" data-fk="${fk}" title="클릭하면 세부 능력치를 볼 수 있습니다"><div class="pro-inner">${front}${backFace(p)}</div></div>`;
  }

  function club() {
    const g = G(), c = g.club, ros = Club.roster(g), lu = Club.lineup(g), rank = League.rankOf(g, 'player'), fi = Club.fanInfo(g);
    const exp = Club.ownerPay(g, rank).reduce((s, x) => s + x.v, 0), pay = Club.payroll(g), net = exp - pay, ci = Club.capInfo(g), capV = ci.cap, capLeft = capV - pay;
    const tile = (k, v, sub, cls) => `<div class="dc-tile ${cls || ''}"><small>${k}</small><b>${v}</b><span>${sub || ''}</span></div>`;
    const slots = [0, 1, 2].map(i => { const p = lu[i];
      return `<div class="slot ${p ? 'on' : ''}"><div class="slot-n">${i + 1}번</div>${p ? card(p, `<button class="btn small ghost" data-act="proClear" data-slot="${i}">빼기</button>`, { cls: 'compact', scope: 'lu' }) : `<p class="slot-empty">선수를 배치하세요<br><small>아래 선수단에서 [${i + 1}번]을 누르세요</small></p>`}</div>`; }).join('');
    const list = ros.map(p => { const cur = lu.findIndex(x => x && x.id === p.id);
      const btns = [0, 1, 2].map(i => `<button class="btn small ${cur === i ? 'primary' : ''}" data-act="proSlot" data-id="${p.id}" data-slot="${i}">${i + 1}번</button>`).join('')
        + (p.years <= 1 ? `<button class="btn small ${p.refused === g.season ? 'dis' : ''}" data-act="proRenew" data-id="${p.id}" title="재계약금 ${money(Market.renewFee(p))} · 새 연봉 ${money(Market.renewSalary(p))}${Club.payroll(g) - p.salary + Market.renewSalary(p) > Club.cap(g) ? ' · 캡 초과 → 사치세 부과' : ''}">${p.refused === g.season ? '재계약 거부됨' : '재계약' + (Club.payroll(g) - p.salary + Market.renewSalary(p) > Club.cap(g) ? ' ⚠' : '')}</button>` : '') + `<button class="btn small ghost" data-act="proSell" data-id="${p.id}" title="판매 대금 ${money(Market.sellPrice(p))}">판매</button><button class="btn small ghost" data-act="proRelease" data-id="${p.id}">방출</button>`;
      return card(p, btns, { scope: 'ro', extra: (p.years <= 1 ? '<span class="ptag bad">계약 임박</span> ' : '') + moodChip(p) }); }).join('');
    const fin = c.finance ? `<div class="glass panel"><h3>지난 시즌 정산 (시즌 ${c.finance.season})</h3><ul class="notes">${c.finance.income.map(x => `<li>${x.k} <b>+${money(x.v)}</b></li>`).join('')}<li>선수단 연봉 <b>−${money(c.finance.cost)}</b></li><li>셀러리캡 <b>${money(Math.round(c.finance.avgPay || c.finance.cost))} / ${money(c.finance.cap || Club.cap(g))}</b></li>${c.finance.tax ? `<li>사치세 <b>−${money(c.finance.tax)}</b></li>` : ''}${c.finance.pen ? `<li>최소 연봉 미달 벌금 <b>−${money(c.finance.pen)}</b></li>` : ''}${c.finance.capTo ? `<li>다음 시즌 셀러리캡 <b>${money(c.finance.capTo)}</b></li>` : ''}${(c.finance.growth || []).map(x => `<li>${x.nick} 성장 <b>${x.from} → ${x.to}</b> (잠재 ${x.pot})${x.promoted ? ` · ${x.oldGrade}→${x.grade}급 승급` : ''}</li>`).join('')}${(c.finance.left || []).map(x => `<li>${x.nick} 이적 → ${x.to} (${x.why})</li>`).join('')}<li>자금 ${money(c.finance.before)} → <b>${money(c.finance.after)}</b></li></ul></div>` : '';
    const sp = c.pendingSponsor;
    const spBox = sp ? `<div class="glass panel" style="border-color:var(--gold)"><h3>📣 스폰서 제안</h3>
      <p><b>${sp.brand}</b> · ${sp.tier} · 제안금 <b style="color:var(--gold)">${money(sp.amount)}</b> (평판 ${sp.rep} 기준)</p>
      <div class="pro-act" style="justify-content:flex-start;margin-top:8px">
        <button class="btn primary" data-act="spAccept">수락</button>
        <button class="btn ghost" data-act="spDecline">거절</button>
      </div></div>` : '';
    const prog = (typeof Club !== 'undefined' && Club.goalProgress) ? Club.goalProgress(g) : null;
    const og = c.ownerGoal;
    let goalBox = '';
    if (og) {
      const risk = prog ? prog.risk : 'on';
      const riskLabel = risk === 'danger' ? '위험' : risk === 'warn' ? '주의' : (og.status === 'success' ? '달성' : og.status === 'fail' ? '실패' : '순항');
      const riskCls = risk === 'danger' ? 'neg' : risk === 'warn' ? 'warn' : (og.status === 'success' ? 'pos' : '');
      const hint = prog ? prog.hint : (og.desc || '');
      goalBox = `<div class="glass panel owner-goal ${riskCls}"><div class="og-head"><h3>🎯 구단주 목표</h3><span class="og-badge ${risk}">${riskLabel}</span></div>
        <p class="og-label"><b>${og.label}</b><small>달성 시 +${money(Club.goalReward(g, og))}</small></p>
        <p class="og-hint">${hint}</p>
        <small>${og.desc || ''}${og.status === 'active' ? ' · 시즌 종료 시 평가' : og.status === 'success' ? ' · 달성 완료' : ' · 미달성'}</small>
      </div>`;
    }
    const chs = Club.challenges(g), chBox = `<div class="glass panel"><h3>🏅 도전과제 <small>${chs.filter(x => x.done).length}/${chs.length}</small></h3><div class="ch-grid">${chs.map(x => `<div class="ch-item ${x.done ? 'done' : ''}"><b>${x.icon} ${x.name}</b><small>${x.desc}</small>${bar(Math.round(x.value / x.n * 100))}<em>${x.done ? '달성 완료' : `${Math.min(x.value, x.n)}/${x.n}`} · 보상 ${money(x.reward)}</em></div>`).join('')}</div></div>`;
    return `<section class="pro-view"><div class="glass panel team-head"><div class="club-main">${UI.teamLogo(g.baseTeam, 72)}<div><b class="club-team">${g.teamName}</b><small class="club-lg">${(CONFIG.leagues.find(l => l.id === g.leagueId) || {}).name || ''} 리그</small><h2>${CONFIG.nav.club}</h2><p>이적시장·FA 시장에서 프로게이머를 영입해 3명을 라인업(1·2·3번)에 배치하세요. 1번 선수가 첫 번째 픽, 2번이 두 번째 픽, 3번이 세 번째 픽 파이터를 맡습니다. 선수의 등급(C~S)이 높을수록 전투 AI가 정교합니다.</p></div></div>
      <button class="btn" data-act="proAuto">라인업 자동 채우기</button></div>
      ${goalBox}${spBox}<div class="dc-tiles">${tile('구단 자금', money(c.funds), '시즌 종료 시 정산', c.funds < 0 ? 'neg' : '')}${tile('선수단 연봉 / 셀러리캡', money(pay), `${ros.length}/${CONFIG.club.maxRoster}명 · 상한 ${money(capV)}${ci.grow > 0.0005 ? ` (+${(ci.grow * 100).toFixed(0)}%${ci.atMax ? ' 한계' : ''})` : ''} · ${capLeft >= 0 ? '여유 ' + money(capLeft) : '초과 ' + money(-capLeft)}${capBar(pay, capV)}<small class="cap-note">${capLeft < 0 ? `사치세 예상 시즌당 ${money(ci.taxNow)} · ` : ''}재계약 한도 ${money(ci.hard)} · 최소 연봉 ${money(ci.floor)}</small>`, capLeft < 0 ? 'neg' : '')}${tile('예상 구단주 지급', money(exp), `현재 ${rank}위 기준`)}${tile('예상 순수익', (net >= 0 ? '+' : '') + money(net), '지급 − 연봉', net < 0 ? 'neg' : 'pos')}${tile('팬 수', fi.fans.toLocaleString('ko-KR') + '명', `최대 ${fi.max.toLocaleString('ko-KR')}명 · 이번 시즌 ${fi.seasonGain >= 0 ? '+' : ''}${fi.seasonGain.toLocaleString('ko-KR')}`)}${tile('이번 시즌 티켓 수입', money(fi.tix), `${fi.games}경기 · 경기당 평균 ${money(fi.avg)} · 관중 ${Math.round(fi.fill * 100)}% (수용 ${fi.stadium.toLocaleString('ko-KR')}명)`)}</div>
      <div class="lineup">${slots}</div>
      <div class="glass panel"><h3>선수단 <small>${ros.length}명</small></h3>${list || '<p class="empty">선수가 없습니다. 이적시장에서 영입하세요.</p>'}${ros.length < 3 ? '<p class="note">경기를 하려면 최소 3명이 필요합니다.</p>' : ''}</div>${fin}${chBox}</section>`;
  }

  function market() {
    const g = G(), m = Market.ensure(g), c = g.club;
    let list = st.tab === 'fa' ? m.fa.map(id => ({ p: Pros.get(g, id) })).filter(x => x.p) : Market.listed(g);
    if (st.grade !== 'all') list = list.filter(x => x.p.grade === st.grade);
    list.sort((a, b) => GR.indexOf(a.p.grade) - GR.indexOf(b.p.grade) || b.p.ovr - a.p.ovr);
    const full = c.roster.length >= CONFIG.club.maxRoster;
    const cards = list.map(({ p, team }) => {
      const cost = st.tab === 'fa' ? Market.signFee(p) : p.fee + Market.signFee(p), capOk = Club.capLeft(g) >= p.salary, ok = c.funds >= cost && !full && capOk;
      const btn = `<button class="btn ${ok ? 'primary' : 'dis'}" ${ok ? '' : 'disabled'} data-act="${st.tab === 'fa' ? 'proSign' : 'proBuy'}" data-id="${p.id}">${capOk ? (st.tab === 'fa' ? '영입' : '이적') + ' · ' + money(cost) : '캡 초과 · 연봉 ' + money(p.salary)}</button>`;
      return card(p, btn, { scope: 'mk', extra: team ? `<small>소속 ${team.name}</small>` : '<small>자유계약(FA)</small>' }); }).join('');
    const tabs = [['fa', 'FA 시장'], ['tr', '이적 시장']].map(([id, n]) => `<button class="dc-tab ${st.tab === id ? 'on' : ''}" data-act="mkTab" data-tab="${id}">${n}</button>`).join('');
    const chips = ['all', ...GR].map(x => `<button class="chip ${st.grade === x ? 'on' : ''}" data-act="mkGrade" data-g="${x}">${x === 'all' ? '전체' : x + '급'}</button>`).join('');
    return `<section class="pro-view"><div class="glass panel team-head"><div><h2>${CONFIG.nav.market}</h2><p>FA 시장은 계약금만, 이적 시장은 이적료 + 계약금이 듭니다. 선수의 선호 역할군·캐릭터·플레이가 팀과 맞을수록 유리합니다. 시장은 ${CONFIG.pro.market.refreshRounds}라운드마다 갱신됩니다.</p></div>
      <div class="mk-funds"><small>구단 자금</small><b>${money(c.funds)}</b><small>선수단 ${c.roster.length}/${CONFIG.club.maxRoster}</small><small>셀러리캡 ${money(Club.payroll(g))} / ${money(Club.cap(g))}${Club.capInfo(g).grow > 0.0005 ? ` (+${(Club.capInfo(g).grow * 100).toFixed(0)}%)` : ''}</small>${capBar(Club.payroll(g), Club.cap(g))}</div></div>
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

  function css() {
    if (document.getElementById('proCss')) return; const s = document.createElement('style'); s.id = 'proCss';
    s.textContent = `
.pro-view { display: flex; flex-direction: column; gap: 14px; } .pro-list { display: flex; flex-direction: column; gap: 10px; }
.owner-goal { border-left: 4px solid var(--acc); } .owner-goal.neg { border-left-color: #fb7185; } .owner-goal.warn { border-left-color: #fbbf24; } .owner-goal.pos { border-left-color: #34d399; }
.og-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; } .og-head h3 { margin: 0; }
.og-badge { font-size: 12px; font-weight: 700; padding: 2px 10px; border-radius: 99px; border: 1px solid var(--line); }
.og-badge.danger { color: #fb7185; border-color: rgba(251,113,133,.5); } .og-badge.warn { color: #fbbf24; border-color: rgba(251,191,36,.5); }
.og-badge.on { color: #34d399; border-color: rgba(52,211,153,.5); } .og-badge.success, .og-label b { color: var(--text); }
.og-label { margin: 8px 0 4px; font-size: 16px; } .og-hint { margin: 0 0 6px; color: var(--muted); font-size: 13px; }
.pro-card { display: grid; grid-template-columns: 74px 1.5fr 1.2fr 150px auto; gap: 16px; align-items: center; padding: 12px 16px; border-radius: 16px; border: 1px solid var(--line); border-left: 4px solid var(--gc);
  background: linear-gradient(90deg, color-mix(in srgb, var(--gc) 12%, transparent), rgba(255,255,255,.03) 40%); }
.pro-card.compact { grid-template-columns: 56px 1fr; } .pro-card.compact .pro-stat, .pro-card.compact .pro-money { display: none; } .pro-card.compact .pro-act { grid-column: 1 / -1; }
.pro-grade { text-align: center; } .pro-grade b { display: block; font-family: var(--disp); font-size: 38px; line-height: 1; color: var(--gc); text-shadow: 0 0 18px var(--gc); } .pro-grade small { color: var(--muted); font-size: 11px; }
.pro-main h4 { margin: 0 0 4px; font-size: 17px; } .pro-main h4 small { margin-left: 8px; color: var(--muted); font-weight: 400; font-size: 12px; }
.pro-pref { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 12.5px; color: var(--muted); } .pro-pref > span { padding: 2px 8px; border-radius: 99px; background: rgba(255,255,255,.06); }
.pro-favs { display: inline-flex; gap: 3px; padding: 0 !important; background: none !important; } .pmini { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; background: rgba(255,255,255,.07); border: 1px solid var(--ec); } .pmini img { width: 26px; height: 26px; image-rendering: pixelated; }
.pro-tags { display: flex; gap: 6px; margin-top: 6px; min-height: 18px; } .ptag { font-size: 11px; padding: 1px 8px; border-radius: 99px; border: 1px solid var(--line); } .ptag.bad { color: #fb7185; border-color: rgba(251,113,133,.5); } .ptag.good { color: #34d399; border-color: rgba(52,211,153,.5); }
.pro-stat { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; align-items: center; font-size: 12px; } .pro-stat > div:first-child { grid-row: span 3; text-align: center; } .pro-stat b { font-family: var(--disp); font-size: 24px; }
.pro-stat small { display: block; color: var(--muted); margin-bottom: 2px; font-size: 11px; }
.pbar { display: block; height: 5px; border-radius: 99px; background: rgba(255,255,255,.08); overflow: hidden; } .pbar u { display: block; height: 100%; background: linear-gradient(90deg, #34d399, #6ee7ff); } .pbar.bad u { background: #fb7185; } .pbar.warn u { background: linear-gradient(90deg, #fbbf24, #f97316); }
.pro-money { text-align: right; } .pro-money b { display: block; font-size: 16px; } .pro-money small { color: var(--muted); display: block; font-size: 11.5px; }
.pro-act { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; } .btn.dis { opacity: .45; cursor: not-allowed; }
.lineup { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; } .slot { position: relative; padding: 14px 12px 12px; border-radius: 18px; border: 1px dashed var(--line); background: rgba(255,255,255,.02); } .slot.on { border-style: solid; background: rgba(110,231,255,.05); }
.slot-n { position: absolute; top: -10px; left: 14px; padding: 1px 12px; border-radius: 99px; font-family: var(--disp); font-size: 13px; background: var(--acc); color: #04101f; font-weight: 800; }
.slot-empty { text-align: center; color: var(--muted); padding: 22px 0; margin: 0; }
.mk-funds { text-align: right; } .mk-funds b { display: block; font-family: var(--disp); font-size: 24px; color: var(--gold); } .mk-funds small { color: var(--muted); display: block; }
.dc-tile.neg b { color: #fb7185; } .dc-tile.pos b { color: #34d399; }
/* 선수 카드 뒤집기 */
.pro-flip { cursor: pointer; }
.pro-inner { display: grid; }
.pro-inner > .pro-card { position: relative; grid-area: 1 / 1; max-height: 420px; overflow: hidden; opacity: 1; transition: max-height .45s ease, padding .45s ease, opacity .4s ease, transform .4s ease; }
.pro-card.back { display: flex; flex-direction: column; gap: 10px; align-items: stretch; }
.pro-flip:not(.flipped) .pro-card.back, .pro-flip.flipped .pro-card.front { max-height: 0; padding-top: 0; padding-bottom: 0; border-width: 0; opacity: 0; transform: translateY(6px); pointer-events: none; }
.flip-ico { position: absolute; top: 6px; right: 10px; font-size: 13px; color: var(--muted); opacity: .6; } .pro-flip:hover .flip-ico { opacity: 1; color: var(--acc); }
.back-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; } .back-head h4 { margin: 0; font-size: 17px; } .back-head h4 small { margin-left: 8px; color: var(--muted); font-weight: 400; font-size: 12px; }
.pro-grade.mini b { font-size: 28px; } .flip-hint { margin-left: auto; font-size: 11px; color: var(--muted); }
.avg-chip { font-size: 12px; padding: 2px 10px; border-radius: 99px; background: rgba(255,255,255,.07); color: var(--muted); } .avg-chip b { color: var(--text); font-family: var(--disp); }
.back-info { display: flex; flex-wrap: wrap; gap: 6px 10px; font-size: 12.5px; color: var(--muted); } .back-info > span { padding: 2px 10px; border-radius: 99px; background: rgba(255,255,255,.06); } .back-info b { color: var(--text); margin-left: 4px; font-weight: 600; }
.back-info .good b { color: #34d399; } .back-info .bad b { color: #fb7185; } .back-info .pro-favs { padding: 0; background: none; }
.sk-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 18px; } .sk-row { display: grid; grid-template-columns: 1fr auto; gap: 3px 8px; align-items: center; font-size: 12px; color: var(--muted); } .sk-row b { font-family: var(--disp); font-size: 14px; } .sk-row .pbar { grid-column: 1 / -1; }
.t-s { color: #fbbf24; } .t-a { color: #c084fc; } .t-b { color: #60a5fa; } .t-c { color: #94a3b8; }
.pbar.t-s u { background: linear-gradient(90deg, #f59e0b, #fde047); } .pbar.t-a u { background: linear-gradient(90deg, #8b5cf6, #c084fc); } .pbar.t-b u { background: linear-gradient(90deg, #3b82f6, #60a5fa); } .pbar.t-c u { background: #64748b; }
.rare-badge { margin-left: 8px; font-size: 11px; font-weight: 700; padding: 1px 9px; border-radius: 99px; vertical-align: middle; } .rare-badge.perfect { color: #04101f; background: linear-gradient(90deg, #fde047, #f472b6, #67e8f9); } .rare-badge.ace { color: #fbbf24; border: 1px solid rgba(251,191,36,.6); }
.pro-card.rare-perfect { box-shadow: 0 0 0 1px rgba(253,224,71,.45), 0 0 26px rgba(244,114,182,.28); } .pro-card.rare-ace { box-shadow: 0 0 18px rgba(251,191,36,.18); }
@media (max-width: 700px) { .sk-grid { grid-template-columns: repeat(2, 1fr); } }
.modal-box.tm-box { display: flex; flex-direction: column; gap: 12px; width: min(960px, 94vw); max-height: 88vh; padding: 18px; overflow-y: auto; }
.tm-head h3 { margin: 0 0 4px; } .tm-head small, .tm-pick { font-size: 12px; color: var(--muted); }
.tbl tr.clk, .br-team.clk { cursor: pointer; } .tbl tr.clk:hover td { background: rgba(255,255,255,.05); }
.og-label small { margin-left: 8px; font-size: 12px; color: var(--gold); }
.ch-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; margin-top: 10px; }
.ch-item { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: rgba(255,255,255,.03); }
.ch-item small, .ch-item em { font-size: 12px; font-style: normal; color: var(--muted); }
.ch-item.done { border-color: rgba(52,211,153,.5); background: rgba(52,211,153,.08); }
.cap-bar { display: block; height: 6px; margin-top: 4px; overflow: hidden; border-radius: 99px; background: rgba(255,255,255,.08); }
.cap-bar u { display: block; height: 100%; background: linear-gradient(90deg, #34d399, #6ee7ff); transition: width .4s ease; }
.cap-note { display: block; margin-top: 4px; font-size: 11px; color: var(--muted); }
.cap-bar.warn u { background: linear-gradient(90deg, #fbbf24, #f97316); } .cap-bar.over u { background: #fb7185; }
.pot-line { display: block; margin-top: 2px; font-size: 11px; color: var(--muted); } .pot-line b { font-family: var(--disp); font-size: 13px; color: #c084fc; }
.cy-wrap { display: flex; flex-direction: column; gap: 12px; } .cy-list { display: flex; flex-direction: column; gap: 6px; }
.cy-row { display: grid; grid-template-columns: 26px 1fr auto auto; gap: 10px; align-items: center; width: 100%; padding: 8px 12px; border: 1px solid var(--line); border-radius: 12px; background: rgba(255,255,255,.03); font-size: 13px; text-align: left; color: var(--text); cursor: pointer; }
.cy-row.on { border-color: var(--acc); background: rgba(110,231,255,.08); }
.cy-chk { display: grid; place-items: center; width: 22px; height: 22px; border: 1px solid var(--line); border-radius: 6px; font-size: 13px; color: var(--acc); }
.cy-sum { display: grid; gap: 6px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; background: rgba(255,255,255,.04); font-size: 13px; } .cy-sum .bad { color: #fb7185; }
.mv-list { margin: 0; padding-left: 18px; font-size: 13px; } .mv-list .ok { color: #34d399; } .mv-list .no { color: #fb7185; }
@media (max-width: 1100px) { .pro-card { grid-template-columns: 64px 1fr; } .pro-stat, .pro-money, .pro-act { grid-column: 1 / -1; } .lineup { grid-template-columns: 1fr; } }
`; document.head.appendChild(s);
  }

  UI.addView('club', club); UI.addView('market', market); css();
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
