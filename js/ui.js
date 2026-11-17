/* ui.js — 화면 렌더링 (리그 / 팀 편성 / 상점 / 경기장), 카드, 모달, 토스트, 인터랙션 */

const UI = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const G = () => Game.G;
  let view = 'league', selLg = null, legendOpen = true, leagueTab = 'season', introAuto = '', roleFilter = 'all', tacSlot = 0, selected = null, draftRole = 'all';
  const logOff = new Set();

  /* ---------- 파이터 표시 도우미 ---------- */
  const fmtStat = (k, v) => { const S = CONFIG.stats[k]; return S.pct ? Math.round(v * 100) + '%' : v.toFixed(S.digits); };
  const FD = id => CONFIG.fighters[id];
  const sec = t => (t * CONFIG.battle.tickMs / 1000);
  const mini = (f, form) => `<span class="mini" style="--ec:${f.color}" title="${f.name}"><img class="px" src="${Sprites.url(f, form)}" alt=""><b>${f.icon}</b></span>`;
  const statRows = f => CONFIG.statOrder.map(k => {
    const S = CONFIG.stats[k], v = f.stats[k], pct = Math.min(100, v / S.max * 100);
    return `<div class="stat" style="--c:${S.color};--p:${pct.toFixed(1)}%" ${S.tip ? `title="${S.tip}"` : ''}><span class="sn">${S.short}</span><span class="sb"><i></i></span><span class="sv">${fmtStat(k, v)}</span></div>`;
  }).join('');
  const skBlock = (cls, label, sk) => `<div class="sk ${cls}"><span class="sk-t">${label}</span><b>${sk.name}</b><p>${sk.desc}</p></div>`;
  const codexForm = {};
  function skillsHTML(f) {
    let h = skBlock('pa', '고유 패시브', f.passive);
    const forms = f.forms ? Object.keys(f.forms) : null;
    let list = f.skills;
    if (forms) {
      const cur = codexForm[f.id] && f.forms[codexForm[f.id]] ? codexForm[f.id] : forms[0];
      const names = { normal: '일반 상태', super: '슈퍼 상태', ground: '지상 모드', air: '공중 모드', mage: '마법태세', battle: '전투태세' };
      h += `<div class="form-tabs">${forms.map(k => `<button class="chip ${k === cur ? 'on' : ''}" data-act="codexForm" data-id="${f.id}" data-form="${k}">${names[k] || k}</button>`).join('')}</div>`;
      list = f.forms[cur];
    }
    list.forEach((sk, i) => { h += skBlock('sk', `기본스킬 ${i + 1} · 마나 ${sk.cost} · 쿨타임 ${sk.cd}초`, sk); });
    h += skBlock('ul', `궁극기 · 쿨타임 ${f.ult.cd}초`, f.ult);
    return h;
  }
  function fighterDetail(f) {
    const forms = f.forms ? Object.keys(f.forms) : null, cur = codexForm[f.id], R = CONFIG.roles[f.role];
    const form = forms ? (f.looks && cur && f.looks[cur] ? cur : null) : null;
    return `<div class="fd-head" style="--ec:${f.color}"><div class="fd-thumb"><img class="px" src="${Sprites.url(f, form)}" alt="${f.name}"></div>
      <div><h2>${f.name}</h2><div class="cc-tags"><span class="tag" style="--c:${R.color}">${R.icon} ${R.name}</span></div><p class="fd-title">${f.title}</p><p class="fd-concept">${f.concept}</p></div></div>
      <div class="fd-body"><div class="cc-stats fd-stats">${statRows(f)}</div><div class="fd-skills">${skillsHTML(f)}</div></div>`;
  }
  function fighterCard(f, o = {}) {
    const R = CONFIG.roles[f.role];
    return `<article class="fcard ${o.cls || ''}" style="--ec:${f.color}" data-act="${o.act || 'codexOpen'}" data-id="${f.id}">
      <div class="fc-thumb"><img class="px" src="${Sprites.url(f)}" alt="${f.name}"></div>
      <h4>${f.name}</h4><span class="tag" style="--c:${R.color}">${R.icon} ${R.name}</span>
      <p>${f.title}</p>
      <div class="fc-mini"><span>체력 <b>${f.stats.hp}</b></span><span>공격 <b>${f.stats.atk}</b></span><span>주문 <b>${f.stats.ap}</b></span><span>사거리 <b>${f.stats.range}</b></span></div></article>`;
  }

  /* ===== 파이터 출신 / 상세 스토리: 여기에 직접 작성하세요 (이미지 파일: img/파이터id.png) =====
     origin = 출신(짧게), story = 상세 스토리(줄바꿈은 \n) */
  const LORE = {
    deathkaiser: { origin: '지옥', story: '' },
    alien: { origin: '외계', story: '' },
    crow: { origin: '아실레인', story: '' },
    swordsaint: { origin: '아실레인', story: '' },
    sarcoza: { origin: '마르카느', story: '' },
    warrior: { origin: '천계', story: '' },
    dash: { origin: '아실레인', story: '' },
    wind: { origin: '마르카느', story: '' },
    thunderbolt: { origin: '마르카느', story: '' },
    magnum: { origin: '씬시티', story: '' },
    aria: { origin: '씬시티', story: '' },
    fabman: { origin: '씬시티', story: '' },
    kain: { origin: '마르카느', story: '' },
    hyer: { origin: '외계', story: '' },
    salamander: { origin: '마르카느', story: '' },
    plasma: { origin: '마르카느', story: '' },
    necro: { origin: '지옥', story: '' },
    rusellaster: { origin: '지옥', story: '' },
    aozu: { origin: '아실레인', story: '' },
    harvest: { origin: '지옥', story: '' },
    minotaur: { origin: '마르카느', story: '' },
    rescue: { origin: '씬시티', story: '' },
    zombie: { origin: '씬시티', story: '' },
    alcaba: { origin: '씬시티', story: '' },
    ananta: { origin: '마르카느', story: '' },
    giant: { origin: '마르카느', story: '' },
    etech: { origin: '씬시티', story: '' },
    dt: { origin: '외계', story: '' },
    kum: { origin: '마르카느', story: '' },
    gaia: { origin: '마르카느', story: '' },
    crush: { origin: '지옥', story: '' },
    viser: { origin: '외계', story: '' },
    darkknight: { origin: '아실레인', story: '' },
    shadow: { origin: '아실레인', story: '' },
    redhood: { origin: '아실레인', story: '' },
    reaper: { origin: '지옥', story: '' },
    press: { origin: '천계', story: '' },
    jade: { origin: '씬시티', story: '' },
    dark: { origin: '씬시티', story: '' },
    biomachine: { origin: '씬시티', story: '' },
    frost: { origin: '마르카느', story: '' },
    shining: { origin: '천계', story: '' },
    steamman: { origin: '아실레인', story: '' },
    itrain: { origin: '외계', story: '' },
    grainger: { origin: '아실레인', story: '' },
    angel: { origin: '천계', story: '' },
    oba: { origin: '씬시티', story: '' },
    stardust: { origin: '외계', story: '' },
    renegade: { origin: '천계', story: '' },
    carcer: { origin: '외계', story: '' },
    peg: { origin: '씬시티', story: '' },
  };

  /* ---------- 파이터 도감: 꽉 찬 카드 + 슬라이드 상세 ---------- */
  const cx = { id: null, slide: 0, list: [] }, CX_SLIDES = ['스탯', '스킬', '스토리'];
  const imgTag = f => `<img src="img/${f.id}.png" alt="${f.name}" onerror="this.onerror=null;this.classList.add('px','fb');this.src='${Sprites.url(f)}'">`;
  const codexCard = f => {
    const R = CONFIG.roles[f.role];
    return `<article class="cxcard" style="--ec:${f.color}" data-act="codexOpen" data-id="${f.id}">${imgTag(f)}<div class="cx-cap"><h4>${f.name}</h4><span class="tag" style="--c:${R.color}">${R.icon} ${R.name}</span></div></article>`;
  };
  function cxHTML(f) {
    const R = CONFIG.roles[f.role], L = LORE[f.id] || {}, i = cx.list.indexOf(f.id);
    return `<div class="cxd" style="--ec:${f.color}">
      <div class="cxd-left"><div class="cxd-img">${imgTag(f)}</div>
        <div class="cxd-meta"><span class="tag" style="--c:${R.color}">${R.icon} ${R.name}</span><span class="cxd-origin">출신 · ${L.origin || '미정'}</span></div></div>
      <div class="cxd-right">
        <div class="cxd-head"><h2>${f.name}</h2><p>${f.title}</p></div>
        <div class="cxd-slides" id="cxSlides">
          <section class="cxd-slide"><p class="fd-concept">${f.concept}</p><div class="cc-stats fd-stats">${statRows(f)}</div></section>
          <section class="cxd-slide" id="cxSkills">${skillsHTML(f)}</section>
          <section class="cxd-slide"><h3>${f.name} 이야기</h3><p class="cxd-story">${L.story ? L.story.replace(/\n/g, '<br>') : '스토리가 아직 작성되지 않았습니다.'}</p></section>
        </div>
        <div class="cxd-dots">${CX_SLIDES.map((n, k) => `<button class="cxd-dot" data-ui="cxSlide" data-i="${k}">${n}</button>`).join('')}</div>
        <div class="cxd-foot"><span class="cxd-count">${i + 1} / ${cx.list.length}</span><button class="btn primary" data-act="closeModal">닫기</button></div>
      </div></div>`;
  }
  function cxDots() { $$('.cxd-dot').forEach((d, k) => d.classList.toggle('on', k === cx.slide)); }
  function cxGoSlide(i, smooth) {
    const s = $('#cxSlides'); if (!s) return; cx.slide = Math.max(0, Math.min(CX_SLIDES.length - 1, i));
    s.scrollTo({ left: s.clientWidth * cx.slide, behavior: smooth ? 'smooth' : 'auto' }); cxDots();
  }
  function cxRender() {
    const f = FD(cx.id); let box = $('.modal-box.cxd-box');
    if (!box) {
      modal('', 'cxd-box'); box = $('.modal-box.cxd-box');
      $('#modal').insertAdjacentHTML('beforeend', '<button class="cx-arrow prev" data-ui="cxNav" data-d="-1" title="이전 파이터">‹</button><button class="cx-arrow next" data-ui="cxNav" data-d="1" title="다음 파이터">›</button>');
    }
    box.innerHTML = cxHTML(f);
    const s = $('#cxSlides'); requestAnimationFrame(() => cxGoSlide(cx.slide, false));
    let timer = 0, drag = null;
    s.addEventListener('scroll', () => { clearTimeout(timer); timer = setTimeout(() => { const k = Math.round(s.scrollLeft / s.clientWidth); if (k !== cx.slide) { cx.slide = k; cxDots(); } }, 80); });
    s.addEventListener('mousedown', e => { if (e.target.closest('button')) return; drag = { x: e.clientX, l: s.scrollLeft }; s.classList.add('drag'); });
    window.addEventListener('mousemove', e => { if (drag) s.scrollLeft = drag.l - (e.clientX - drag.x); });
    window.addEventListener('mouseup', () => { if (!drag) return; drag = null; s.classList.remove('drag'); cxGoSlide(Math.round(s.scrollLeft / s.clientWidth), true); });
  }
  function cxNav(d) {
    const n = cx.list.length, i = (cx.list.indexOf(cx.id) + d + n) % n; cx.id = cx.list[i];
    const f = FD(cx.id); if (f.forms && !codexForm[cx.id]) codexForm[cx.id] = Object.keys(f.forms)[0];
    cxRender();
  }
  function injectHall() {
    if ($('#hallCss')) return; const st = document.createElement('style'); st.id = 'hallCss';
    st.textContent = `
/* 닉네임 / 리그 카드 */
.mgr-card { display: flex; align-items: center; gap: 16px; padding: 16px 20px; border-radius: 18px; border: 1px solid var(--line); background: linear-gradient(90deg, rgba(255,209,102,.12), rgba(255,255,255,.03)); }
.mgr-card > div { flex: 1; display: flex; flex-direction: column; gap: 6px; } .mgr-card small { color: var(--muted); } .mgr-card b { font-family: var(--disp); font-size: 22px; }
.mgr-ic { font-size: 34px; } .mgr-input { width: min(360px, 100%); padding: 10px 14px; border-radius: 12px; border: 1px solid var(--line); background: rgba(0,0,0,.35); color: var(--text); font: inherit; font-size: 16px; outline: none; }
.mgr-input:focus { border-color: var(--acc); box-shadow: 0 0 0 3px rgba(110,231,255,.18); }
.lg-title { margin: 6px 2px 0; } .lg-card.dis { opacity: .55; filter: saturate(.5); }
.lg-card { overflow: hidden; min-height: 150px; } .lg-card > b, .lg-card > small, .lg-card > em { position: relative; z-index: 1; }
.lg-bg { position: absolute; inset: 0; z-index: 0; background: linear-gradient(135deg, color-mix(in srgb, var(--c) 26%, transparent), transparent 70%); }
.lg-bg img { width: 100%; height: 100%; object-fit: cover; opacity: .28; mask-image: linear-gradient(90deg, transparent 20%, #000 90%); -webkit-mask-image: linear-gradient(90deg, transparent 20%, #000 90%); }
/* 리그 선택 팝업 */
.modal-box.lgm { width: min(1080px, 100%); padding: 0; overflow: hidden; border-radius: 22px; }
.lgm-wrap { display: grid; grid-template-columns: 300px 1fr; min-height: 560px; max-height: 92vh; }
.lgm-banner { position: relative; background: #060914; }
.lgm-art { position: absolute; inset: 0; overflow: hidden; background: radial-gradient(120% 70% at 50% 0%, color-mix(in srgb, var(--c) 70%, #000) 0%, transparent 70%), linear-gradient(180deg, color-mix(in srgb, var(--c) 40%, #070b18), #070b18 85%); }
.lgm-art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.lgm-art::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 55%, rgba(4,6,16,.85)); }
.lgm-code { position: absolute; top: 18px; left: 20px; z-index: 2; font-family: var(--disp); font-size: 54px; font-weight: 900; color: rgba(255,255,255,.9); text-shadow: 0 4px 24px var(--c); letter-spacing: .04em; }
.lgm-vname { position: absolute; bottom: 20px; left: 20px; z-index: 2; font-family: var(--disp); font-size: 24px; font-weight: 800; color: #fff; text-shadow: 0 2px 14px #000; }
.lgm-main { display: flex; flex-direction: column; gap: 12px; padding: 24px 26px 20px; overflow: auto; background: linear-gradient(180deg, color-mix(in srgb, var(--c) 10%, transparent), transparent 40%); }
.lgm-main header { display: flex; justify-content: space-between; gap: 18px; align-items: flex-end; } .lgm-main h2 { margin: 2px 0 0; font-family: var(--disp); font-size: 30px; color: var(--c); }
.lgm-main header small { color: var(--muted); } .lgm-main header small i { font-style: normal; color: var(--gold); } .lgm-main header p { margin: 0; max-width: 300px; color: var(--muted); font-size: 12.5px; line-height: 1.5; text-align: right; }
.lgm-h { margin: 6px 0 0; display: flex; justify-content: space-between; align-items: baseline; } .lgm-h em { font-style: normal; color: var(--gold); font-size: 13px; }
.lgm-lock { margin: 0; color: #fbbf24; font-size: 13px; }
.lgm-teams { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.lgm-team { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 14px; cursor: pointer; text-align: left; color: var(--text); background: rgba(255,255,255,.04); border: 1px solid var(--line); transition: all .22s var(--ease); }
.lgm-team:hover:not(:disabled) { transform: translateY(-3px); border-color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); box-shadow: 0 10px 24px -12px var(--c); }
.lgm-team:disabled { opacity: .45; cursor: not-allowed; } .lgm-team b { font-size: 13.5px; line-height: 1.3; }
.logo-b { position: relative; flex: none; width: 52px; height: 52px; border-radius: 14px; display: grid; place-items: center; overflow: hidden; background: linear-gradient(145deg, color-mix(in srgb, var(--c) 80%, #fff 0%), color-mix(in srgb, var(--c) 30%, #0a0f1f)); border: 1px solid rgba(255,255,255,.25); box-shadow: 0 4px 14px -6px var(--c); }
.logo-b i { font-style: normal; font-family: var(--disp); font-weight: 900; font-size: 18px; color: #fff; text-shadow: 0 2px 6px rgba(0,0,0,.5); } .logo-b img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; background: rgba(8,12,28,.9); }
.lgm-main footer { margin-top: auto; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-top: 8px; } .lgm-main footer small { color: var(--muted); }
@media (max-width: 900px) { .lgm-wrap { grid-template-columns: 1fr; } .lgm-banner { min-height: 160px; } .lgm-teams { grid-template-columns: repeat(2, 1fr); } .lgm-main header { flex-direction: column; align-items: flex-start; } .lgm-main header p { text-align: left; } }
/* 트로피 전시관 */
.hall { position: relative; display: grid; grid-template-columns: 1fr 1.15fr 1.4fr; align-items: end; gap: 10px; padding: 34px 18px 0; border-radius: 24px; overflow: hidden; border: 1px solid var(--line);
  background: radial-gradient(900px 340px at 50% 0%, rgba(167,139,250,.22), transparent 70%), linear-gradient(180deg, #0a0e22, #060814 70%); }
.hall::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(90deg, rgba(255,255,255,.025) 0 2px, transparent 2px 120px); pointer-events: none; }
.hall-floor { position: absolute; left: 0; right: 0; bottom: 0; height: 60px; background: linear-gradient(180deg, transparent, rgba(110,231,255,.07)); }
.hall-ped { position: relative; display: flex; flex-direction: column; align-items: center; z-index: 1; }
.hall-spot { position: absolute; top: -40px; width: 78%; height: 360px; background: conic-gradient(from 180deg at 50% 0%, transparent 168deg, rgba(255,236,170,.0) 170deg, rgba(255,236,170,.16) 180deg, rgba(255,236,170,.0) 190deg, transparent 192deg); clip-path: polygon(40% 0, 60% 0, 100% 100%, 0 100%); background: linear-gradient(180deg, rgba(255,236,170,.0), rgba(255,236,170,.10)); opacity: .0; transition: opacity .6s; }
.hall-ped.own .hall-spot { opacity: 1; }
.hall-item { position: relative; display: grid; place-items: end center; min-height: 120px; margin-bottom: -2px; }
.hall-item img.px { image-rendering: pixelated; display: block; } .hall-item img.lockd, .case img.lockd { filter: brightness(0) opacity(.28); }
.hall-ped.own .hall-item img { animation: hallFloat 4.2s ease-in-out infinite; filter: drop-shadow(0 0 18px rgba(255,214,102,.55)); }
.hall-ped.worlds.own .hall-item img { filter: drop-shadow(0 0 30px rgba(255,214,102,.8)) drop-shadow(0 0 60px rgba(110,231,255,.35)); }
@keyframes hallFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
.hall-item .sp { position: absolute; width: 10px; height: 10px; background: #fff; clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%); animation: spk 2.4s ease-in-out infinite; }
.sp.s1 { top: 16%; left: 14%; } .sp.s2 { top: 34%; right: 10%; animation-delay: .8s; } .sp.s3 { top: 6%; right: 32%; animation-delay: 1.5s; }
@keyframes spk { 0%,100% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.4); opacity: 1; } }
.hall-base { width: 100%; padding: 12px 10px 14px; text-align: center; border-radius: 14px 14px 0 0; background: linear-gradient(180deg, #2a2350, #141030); border: 1px solid rgba(255,209,102,.35); border-bottom: 0; box-shadow: 0 -8px 30px -14px rgba(255,209,102,.5); }
.hall-base b { display: block; font-family: var(--disp); font-size: 14px; color: #ffe27a; letter-spacing: .04em; } .hall-base strong { font-family: var(--disp); font-size: 26px; } .hall-base small { display: block; color: var(--muted); font-size: 11.5px; }
.hall-ped.league .hall-base { padding-bottom: 10px; } .hall-ped.msi .hall-base { padding-bottom: 22px; } .hall-ped.worlds .hall-base { padding-bottom: 34px; background: linear-gradient(180deg, #3a2f6e, #181240); border-color: rgba(255,226,122,.7); }
.shelves { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; } .shelf { padding: 12px 12px 0; border-radius: 16px; background: linear-gradient(180deg, color-mix(in srgb, var(--c) 10%, rgba(10,14,30,.9)), rgba(8,10,24,.9)); border: 1px solid var(--line); }
.shelf-h { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; } .shelf-h b { color: var(--c); } .shelf-h small { color: var(--muted); font-family: var(--disp); }
.shelf-row { display: flex; align-items: flex-end; justify-content: space-around; gap: 6px; min-height: 124px; } .case { position: relative; display: grid; place-items: end center; } .case img.px { image-rendering: pixelated; display: block; }
.case.own img { filter: drop-shadow(0 0 8px rgba(255,214,102,.5)); } .case-n { position: absolute; right: -4px; top: 0; padding: 1px 6px; border-radius: 99px; font-size: 11px; font-weight: 800; background: var(--gold); color: #1a1030; }
.shelf-board { height: 10px; margin: 0 -12px; background: linear-gradient(180deg, #6b4a2a, #3a2714); border-top: 2px solid #9a6e3e; box-shadow: 0 6px 12px -6px #000; }
@media (max-width: 1000px) { .hall { grid-template-columns: 1fr; } .shelves { grid-template-columns: 1fr; } }
`;
    document.head.appendChild(st);
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-ui="mgrSave"],[data-ui="mgrEdit"]'); if (!el) return;
      if (el.dataset.ui === 'mgrEdit') { mgrEdit = true; refresh(); return; }
      const v = ($('#mgrInput') ? $('#mgrInput').value : '').trim().slice(0, 12);
      if (!v) { toast('닉네임을 입력해 주세요.', 'warn'); return; }
      setMgr(v); mgrEdit = false; toast(`${v} 감독님, 환영합니다!`, 'good'); refresh();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'mgrInput') { const b = document.querySelector('[data-ui="mgrSave"]'); if (b) b.click(); } });
  }
  function injectCx() {
    if ($('#cxCss')) return; const st = document.createElement('style'); st.id = 'cxCss';
    st.textContent = `
.cx-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; }
.cxcard { position: relative; aspect-ratio: 3 / 4; border-radius: 16px; overflow: hidden; cursor: pointer; border: 1px solid var(--line); border-bottom: 3px solid var(--ec); background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--ec) 30%, #0b1030), #070a1c); transition: transform .2s, box-shadow .2s; }
.cxcard:hover { transform: translateY(-4px); box-shadow: 0 10px 30px color-mix(in srgb, var(--ec) 40%, transparent); }
.cxcard > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 20%; }
.cxcard > img.fb, .cxd-img > img.fb { object-fit: contain; padding: 10% 8% 26%; image-rendering: pixelated; }
.cx-cap { position: absolute; left: 0; right: 0; bottom: 0; padding: 36px 12px 11px; display: flex; flex-direction: column; align-items: flex-start; gap: 5px; background: linear-gradient(transparent, rgba(4, 6, 20, .94)); }
.cx-cap h4 { font-size: 17px; margin: 0; }
.modal-box.cxd-box { width: min(1120px, 92vw); height: min(660px, 86vh); padding: 18px; display: flex; }
.cxd { display: grid; grid-template-columns: 42% 1fr; gap: 22px; width: 100%; min-height: 0; }
.cxd-left { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.cxd-img { position: relative; flex: 1; min-height: 0; border-radius: 16px; overflow: hidden; border: 1px solid var(--line); border-bottom: 3px solid var(--ec); background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--ec) 30%, #0b1030), #070a1c); }
.cxd-img > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 20%; }
.cxd-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.cxd-origin { color: var(--muted); font-size: 13px; }
.cxd-right { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.cxd-head h2 { margin: 0; font-size: 26px; }
.cxd-head p { margin: 2px 0 10px; color: var(--gold); font-weight: 700; }
.cxd-slides { flex: 1; min-height: 0; display: flex; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; scrollbar-width: none; cursor: grab; }
.cxd-slides::-webkit-scrollbar { display: none; }
.cxd-slides.drag { scroll-snap-type: none; cursor: grabbing; user-select: none; }
.cxd-slide { flex: 0 0 100%; scroll-snap-align: start; overflow-y: auto; padding: 2px 10px 6px 2px; box-sizing: border-box; }
.cxd-story { line-height: 1.8; color: #dbe3ff; font-size: 14px; white-space: normal; }
.cxd-dots { display: flex; gap: 8px; justify-content: center; margin: 10px 0 6px; }
.cxd-dot { padding: 5px 16px; border-radius: 999px; border: 1px solid var(--line); background: transparent; color: var(--muted); cursor: pointer; font-size: 12px; }
.cxd-dot.on { background: var(--ec); color: #0b1030; border-color: transparent; font-weight: 700; }
.cxd-foot { display: flex; align-items: center; justify-content: space-between; }
.cxd-count { color: var(--muted); font-size: 12px; }
.cx-arrow { position: fixed; top: 50%; transform: translateY(-50%); z-index: 20; width: 52px; height: 72px; border-radius: 14px; border: 1px solid var(--line); background: rgba(10, 14, 40, .85); color: #fff; font-size: 38px; cursor: pointer; }
.cx-arrow:hover { background: rgba(60, 80, 160, .9); }
.cx-arrow.prev { left: max(8px, calc(50% - min(560px, 46vw) - 66px)); }
.cx-arrow.next { right: max(8px, calc(50% - min(560px, 46vw) - 66px)); }
@media (max-width: 800px) { .cxd { grid-template-columns: 1fr; overflow-y: auto; } .cxd-img { min-height: 220px; } .modal-box.cxd-box { height: 90vh; } }`;
    document.head.appendChild(st);
  }

  /* ---------- 공통 ---------- */
  function layoutShell() {
    if (document.getElementById('navBar')) return;
    const nav = document.getElementById('nav');
    if (!nav) return;
    const bar = document.createElement('nav');
    bar.id = 'navBar';
    bar.className = 'nav-bar';
    const header = nav.closest('header') || nav.parentElement;
    if (header && header.parentElement) header.parentElement.insertBefore(bar, header.nextSibling);
    else nav.parentElement.insertBefore(bar, nav.nextSibling);
    bar.appendChild(nav);
    if (!document.getElementById('navBarCss')) {
      const st = document.createElement('style');
      st.id = 'navBarCss';
      st.textContent = `
.nav-bar{
  display:flex;align-items:center;gap:8px;
  padding:8px 20px 10px;margin:0;
  border-bottom:1px solid var(--line);
  background:linear-gradient(180deg, rgba(110,231,255,.06), rgba(255,255,255,.02));
  backdrop-filter:blur(8px);
  overflow-x:auto;scrollbar-width:thin;
}
.nav-bar #nav{display:flex;flex-wrap:wrap;gap:6px;width:100%;align-items:center}
.nav-bar .nav-btn{white-space:nowrap}
/* 상단 헤더는 브랜드·상태칩·사운드만 남기고 한 줄로 */
header.top, header.app-header, #topbar, .topbar{
  flex-wrap:nowrap;
}
@media (max-width:720px){
  .nav-bar{padding:8px 12px}
  .nav-bar #nav{flex-wrap:nowrap}
}`;
      document.head.appendChild(st);
    }
  }
  function init() {
    injectCx(); injectNews(); injectHall();
    $('#brandTitle').textContent = CONFIG.game.title; $('#brandSub').textContent = CONFIG.game.subtitle;
    $('#nav').innerHTML = Object.keys(CONFIG.nav).map(k => `<button class="nav-btn" data-act="nav" data-view="${k}">${CONFIG.nav[k]}</button>`).join('');
    layoutShell();
    const sp = $('#space');
    for (let i = 0; i < CONFIG.ui.starCount; i++) {
      const s = document.createElement('i'), z = Math.random() * 2 + 1;
      s.className = 'star'; s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;width:${z}px;height:${z}px;animation-delay:${(Math.random() * 6).toFixed(2)}s`;
      sp.appendChild(s);
    }
    document.addEventListener('click', e => {
      const b = e.target.closest('.btn');
      if (b) {
        const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 1.6, s = document.createElement('span');
        s.className = 'ripple'; s.style.cssText = `left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px;width:${d}px;height:${d}px`;
        b.appendChild(s); setTimeout(() => s.remove(), 650);
      }
      const el = e.target.closest('[data-act]');
      if (el) Game.act(el.dataset.act, el, e);
    });
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-ui]'); if (!el) return;
      const k = el.dataset.ui;
      if (k === 'cxNav') cxNav(+el.dataset.d);
      else if (k === 'cxSlide') cxGoSlide(+el.dataset.i, true);
      else if (k === 'strPresetAll') { const g = G(); g.strategy = Draft.normalizeStrategy(Draft.presetStrategy(el.dataset.p)); g.slotRole = ['auto', 'auto', 'auto']; g.slotPreset = el.dataset.p; Game.save(); refresh(); }
      else if (k === 'scout') showScout(el.dataset.id);
      else if (k === 'tourEnter') { const g = G(); (g.tourSeen = g.tourSeen || {})[tourKey(g, el.dataset.k)] = 1; Game.save(); refresh(); }
      else if (k === 'scoutApply') { const g = G(); g.strategy = Draft.normalizeStrategy(Draft.presetStrategy(el.dataset.p)); g.slotRole = ['auto', 'auto', 'auto']; g.slotPreset = el.dataset.p; Game.save(); closeModal(); refresh(); toast('추천 전술을 적용했습니다'); }
      else if (k === 'tacTab') { tacTab = el.dataset.t === 'slot' ? 'slot' : 'team'; tacPage = 0; refresh(); }
      else if (k === 'tacPage') {
        let max;
        if (tacTab === 'team') max = Math.max(1, [...new Set(CONFIG.tactics.team.map(c => c.group))].length);
        else max = Math.max(1, Math.ceil(CONFIG.tactics.categories.length / TAC_PER_PAGE));
        tacPage = Math.max(0, Math.min(max - 1, +el.dataset.p));
        refresh();
      }
    });
    document.addEventListener('click', e => { const el = e.target.closest('[data-ui]'); if (!el) return; const k = el.dataset.ui; if (k === 'newsOpen') { nw.back = false; openNews(el.dataset.id); } else if (k === 'resOpen') { nw.back = true; openNews(el.dataset.id); } else if (k === 'newsSel') { nw.id = el.dataset.id; renderNews(); } else if (k === 'newsFilter') { nw.filter = el.dataset.f; nw.id = null; renderNews(); } });
    document.addEventListener('keydown', e => { if ($('#modal').hidden || !$('#cxSlides')) return; if (e.key === 'ArrowLeft') cxNav(-1); else if (e.key === 'ArrowRight') cxNav(1); });
    document.addEventListener('input', e => { const el = e.target.closest && e.target.closest('[data-input]'); if (el) Game.act(el.dataset.input, el); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && $('#modal').dataset.closable === '1') closeModal();
      if (['1', '2', '3'].includes(e.key) && view === 'match' && Game.match && Game.battleOn) Game.act('ult', { dataset: { u: Game.match.pIdx + '-' + (+e.key - 1) } });
    });
  }

  /* ---------- 달력 / 소식(뉴스·커뮤니티) ---------- */
  const NW_ICON = { preview: '🔎', draft: '🧩', result: '🏁', round: '📊', tour: '🏆', season: '📅', gossip: '💬', analysis: '🧮', interview: '🎤', feature: '📈', fan: '📣' };
  const NW_TYPE = { preview: '경기 프리뷰', draft: '밴픽 분석', result: '경기 결과', round: '리그 소식', tour: '대회 소식', season: '시즌 소식', gossip: '리그 가십', analysis: '전투 분석 칼럼', interview: '선수·감독 인터뷰', feature: '기록·조명', fan: '팬 커뮤니티' };
  const nw = { id: null, filter: 'all', back: false };
  function calBarHTML(g) {
    const d = League.when(g), cur = d.getMonth(), st = League.stage(g);
    const M = [[1, '2월', 'a'], [2, '3월', 'a'], [3, '4월', 'a'], [4, '5월', 'a'], [5, '6월', 'm'], [6, '7월', 'b'], [7, '8월', 'b'], [8, '9월', 'b'], [9, '10월', 'b'], [10, '11월', 'w'], [11, '12월', 'o'], [0, '1월', 'o']];
    const cells = M.map(([m, l, k]) => `<i class="cal-m ${k} ${m === cur ? 'now' : ''}"><em>${l}</em></i>`).join('');
    return `<div class="cal"><div class="cal-top"><b>📅 ${League.fmtDate(d)}</b><span>${League.yearOf(g)}년 · ${st}</span></div><div class="cal-bar">${cells}</div>
      <div class="cal-leg"><span class="a">전반기 2~5월</span><span class="m">MSI 6월</span><span class="b">후반기 7~10월</span><span class="w">월즈 11월</span><span class="o">휴식 12~1월</span></div></div>`;
  }
  function unseenNews(g) { const l = g.news || []; const i = l.findIndex(n => n.id === g.newsSeen); return i < 0 ? l.length : i; }
  function newsPanelHTML() {
    const g = G(), list = (g.news || []).slice(0, 5), nu = unseenNews(g);
    const rep = g.rep || { v: 50, last: 0 };
    const repTxt = `평판 ${rep.v}${rep.last ? (rep.last > 0 ? ` (+${rep.last})` : ` (${rep.last})`) : ''}`;
    return `<div class="glass panel news-card"><div class="news-h"><h3>📰 소식</h3>${nu ? `<span class="news-new">NEW ${nu}</span>` : ''}<span class="pill" style="margin-left:auto">${repTxt}</span></div>
      ${list.length ? `<ul class="news-mini">${list.map(n => `<li data-ui="newsOpen" data-id="${n.id}"><i>${NW_ICON[n.type] || '📰'}</i><b>${n.headline}</b><small>${n.date.slice(5).replace('-', '/')} · 💬 ${n.comments.length}${n.repDelta ? ` · 평판 ${n.repDelta > 0 ? '+' : ''}${n.repDelta}` : ''}</small></li>`).join('')}</ul>` : '<p class="empty">아직 소식이 없습니다.</p>'}
      <button class="btn" data-ui="newsOpen">소식 보기</button></div>`;
  }
  function newsHTML() {
    const g = G(), all = g.news || [], list = all.filter(n => nw.filter === 'all' || n.scope === nw.filter), seenIdx = all.findIndex(n => n.id === g.newsSeen);
    if (!list.some(n => n.id === nw.id)) nw.id = list[0] && list[0].id;
    const cur = list.find(n => n.id === nw.id);
    const chips = [['all', '전체'], ['me', '내 팀'], ['league', '리그'], ['intl', '대회']].map(([k, n]) => `<button class="chip ${nw.filter === k ? 'on' : ''}" data-ui="newsFilter" data-f="${k}">${n}</button>`).join('');
    const items = list.map(n => `<button class="nw-item ${n.id === nw.id ? 'on' : ''}" data-ui="newsSel" data-id="${n.id}"><i>${NW_ICON[n.type] || '📰'}</i><span><b>${n.hot ? '🔥 ' : ''}${n.headline}</b><small>${n.date} · ${NW_TYPE[n.type] || ''} · 💬 ${n.comments.length}</small></span></button>`).join('');
    const detail = cur ? `<article class="nw-art"><small>${cur.date} · ${NW_TYPE[cur.type] || ''}</small><h2>${cur.headline}</h2>${cur.body.map(p => `<p>${p}</p>`).join('')}</article>
      <h4 class="nw-ch">커뮤니티 반응 <em>${cur.comments.length}</em></h4><ul class="cm">${cur.comments.map(c => `<li class="${c.tone === 'cheer' ? 'cheer hype' : c.tone}"><span class="cm-tone">${News.TONES[c.tone] || '💬'}</span><div><b>${c.u}</b><p>${c.t}</p></div><em>👍 ${c.like}</em></li>`).join('')}</ul>` : '<p class="empty">표시할 소식이 없습니다.</p>';
    return `<div class="nw-top"><h2>📰 소식</h2><div class="chips">${chips}</div></div>
      <div class="nw-wrap"><div class="nw-list">${items || '<p class="empty">소식이 없습니다.</p>'}</div><div class="nw-detail">${detail}</div></div>
      <div class="nw-foot"><small>경기 전·후, 대회, 시즌 소식과 커뮤니티 반응이 자동으로 쌓입니다.</small><button class="btn primary" data-act="${nw.back ? 'resultContinue' : 'closeModal'}">${nw.back ? '계속' : '닫기'}</button></div>`;
  }
  function renderNews() { const box = $('.modal-box.newsm'); if (box) { const keep = $('.nw-detail'), sc = keep ? keep.scrollTop : 0; box.innerHTML = newsHTML(); } }
  function openNews(id) {
    const g = G(); if (!g) return; if (id) nw.id = id; nw.filter = id ? 'all' : nw.filter;
    modal('', 'newsm'); renderNews();
    if (g.news && g.news[0]) { g.newsSeen = g.news[0].id; Game.save(); }
  }
  function injectNews() {
    if ($('#nwCss')) return; const st = document.createElement('style'); st.id = 'nwCss';
    st.textContent = `
.cal-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; } .cal-top span { color: var(--muted); font-size: 12px; }
.cal-bar { display: grid; grid-template-columns: repeat(12, 1fr); gap: 3px; }
.cal-m { height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-style: normal; font-size: 11px; opacity: .55; border: 1px solid transparent; }
.cal-m.a { background: rgba(94,231,255,.25); } .cal-m.m { background: rgba(251,191,36,.35); } .cal-m.b { background: rgba(167,139,250,.28); } .cal-m.w { background: rgba(244,114,182,.35); } .cal-m.o { background: rgba(255,255,255,.08); }
.cal-m.now { opacity: 1; border-color: #fff; box-shadow: 0 0 10px rgba(255,255,255,.45); font-weight: 700; }
.cal-leg { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 8px; font-size: 11px; color: var(--muted); }
.lock-note { border-left: 4px solid #fbbf24; }
.team-pick:disabled { opacity: .4; cursor: not-allowed; }
.news-h { display: flex; justify-content: space-between; align-items: center; } .news-new { background: #ef4444; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 999px; }
.news-mini { list-style: none; margin: 8px 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.news-mini li { display: grid; grid-template-columns: 22px 1fr; gap: 2px 6px; cursor: pointer; padding: 6px 8px; border-radius: 8px; background: rgba(255,255,255,.04); }
.news-mini li:hover { background: rgba(255,255,255,.1); } .news-mini li b { font-size: 12.5px; line-height: 1.35; } .news-mini li small { grid-column: 2; color: var(--muted); font-size: 11px; }
.modal-box.newsm { width: min(1100px, 94vw); height: min(680px, 88vh); padding: 18px; display: flex; flex-direction: column; gap: 10px; }
.nw-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; } .nw-top h2 { margin: 0; }
.nw-wrap { flex: 1; min-height: 0; display: grid; grid-template-columns: 360px 1fr; gap: 14px; }
.nw-list, .nw-detail { overflow-y: auto; min-height: 0; padding-right: 6px; }
.nw-item { display: grid; grid-template-columns: 26px 1fr; gap: 6px; width: 100%; text-align: left; padding: 9px 10px; margin-bottom: 6px; border-radius: 10px; border: 1px solid var(--line); background: rgba(255,255,255,.03); color: #fff; cursor: pointer; }
.nw-item.on { background: rgba(94,231,255,.14); border-color: rgba(94,231,255,.5); } .nw-item b { display: block; font-size: 13px; line-height: 1.35; } .nw-item small { color: var(--muted); font-size: 11px; }
.nw-art h2 { margin: 4px 0 10px; line-height: 1.35; } .nw-art p { line-height: 1.75; color: #dbe3ff; margin: 0 0 8px; } .nw-art small { color: var(--muted); }
.nw-ch { margin: 16px 0 8px; } .nw-ch em { color: var(--gold); font-style: normal; }
.cm { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.cm li { display: grid; grid-template-columns: 28px 1fr auto; gap: 8px; align-items: start; padding: 9px 11px; border-radius: 10px; background: rgba(255,255,255,.05); border-left: 3px solid #64748b; }
.cm li.hype { border-color: #fb923c; } .cm li.salty { border-color: #ef4444; } .cm li.analyst { border-color: #60a5fa; } .cm li.meme { border-color: #facc15; } .cm li.rival { border-color: #c084fc; }
.cm b { font-size: 12px; color: #9fb4ff; } .cm p { margin: 2px 0 0; font-size: 13.5px; line-height: 1.5; } .cm em { font-style: normal; font-size: 11px; color: var(--muted); }
.nw-foot { display: flex; justify-content: space-between; align-items: center; } .nw-foot small { color: var(--muted); }
@media (max-width: 820px) { .nw-wrap { grid-template-columns: 1fr; } .nw-list { max-height: 200px; } }`;
    document.head.appendChild(st);
  }

  const statusHooks = [];
  function status() {
    const g = G(); if (!g) return;
    $('#seasonChip').textContent = `${League.lgOf(g).name} · ${League.yearOf(g)}년`;
    $('#phaseChip').textContent = Game.phaseLabel();
    $('#streakChip').textContent = g.streak >= 2 ? `${g.streak}연승 중` : '연승 없음';
    $('#streakChip').classList.toggle('hot', g.streak >= 2);
    statusHooks.forEach(f => f(g));
  }

  function toast(msg, type = 'info') {
    const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg;
    if (type === 'warn') Sound.play('error');
    $('#toasts').appendChild(t); setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3100);
  }
  function modal(html, cls = '', closable = true) {
    const m = $('#modal'); m.hidden = false; m.dataset.closable = closable ? '1' : '';
    m.innerHTML = `<div class="modal-bg" ${closable ? 'data-act="closeModal"' : ''}></div><div class="modal-box glass ${cls}">${html}</div>${closable ? '<button class="modal-x" data-act="closeModal" aria-label="닫기">✕</button>' : ''}`;
  }
  function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }

  function go(v) {
    if (v) view = v;
    if (!G() && view !== 'select') view = 'select';             // 리그를 고르기 전에는 선택 화면만 열립니다
    if (!Game.battleOn) Sound.bgm('lobby');
    $$('.nav-btn').forEach(b => b.classList.toggle('on', b.dataset.view === view));
    if (view !== 'match') Arena.unmount();
    if (view !== 'draft') { selected = null; draftRole = 'all'; }
    const el = $('#view');
    el.innerHTML = views[view]();
    el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
    if (after[view]) after[view]();
    status();
  }
  const refresh = () => go();

  /* ---------- 리그 ---------- */
  function standingsHTML() {
    const g = G(), rows = League.sorted(g), cut = CONFIG.league.playoffTeams;
    return `<table class="tbl"><thead><tr><th>순위</th><th>팀</th><th>승</th><th>무</th><th>패</th><th>점수</th><th>체력차</th></tr></thead><tbody>${rows.map((t, i) => `
      <tr class="${t.id === 'player' ? 'me' : 'clk'} ${i === cut - 1 ? 'cut' : ''}" ${t.id === 'player' ? '' : `data-act="teamInfo" data-id="${t.id}"`}><td>${i + 1}</td><td class="tn"><span class="tn-in">${teamLogo(t.name, 28)}<span>${t.name}${t.id === 'player' ? ' <small>(나)</small>' : ''}${i < CONFIG.league.intlTeams ? ' <span class="tag intl">국제</span>' : ''}</span></span></td>
      <td>${t.w}</td><td>${t.d}</td><td>${t.l}</td><td><b>${t.pts}</b></td><td class="${t.diff >= 0 ? 'pos' : 'neg'}">${t.diff > 0 ? '+' : ''}${t.diff}</td></tr>`).join('')}</tbody></table>
      <p class="note">상위 ${cut}팀이 ${CONFIG.league.playoffName}에, 상위 ${CONFIG.league.intlTeams}팀이 국제대회(MSI·월드 챔피언십)에 진출합니다. MSI 는 ${CONFIG.league.midRound}라운드 직후 열립니다. 정렬: 점수 → 체력차 → 승수</p>`;
  }
  function bracketHTML(t) {
    const g = G();
    if (!t) return `<p class="empty">아직 열리지 않았습니다.</p>`;
    const box = m => {
      const row = id => (id == null ? `<div class="br-team bye"><span>부전승</span></div>` : `<div class="br-team ${m.winner === id ? 'win' : ''} ${m.winner != null && m.winner !== id ? 'lose' : ''} ${id === 'player' ? 'me' : 'clk'}" ${id === 'player' ? '' : `data-act="teamInfo" data-id="${id}"`}><span>${League.name(g, id)}${m.bo > 1 && m.wins && m.b != null ? ` <small>[${m.wins[id === m.a ? 0 : 1]}]</small>` : ''}${t.kind !== 'playoff' ? ` <small>${League.tag(g, id)}</small>` : ''}</span><b>${t.seeds.indexOf(id) + 1}</b></div>`);
      return `<div class="br-match">${row(m.a)}${row(m.b)}</div>`;
    };
    const cols = t.rounds.map((rd, i) => `<div class="br-col"><h5>${League.roundName(t, i)}${rd[0] && rd[0].bo > 1 ? ' BO' + rd[0].bo : ''}</h5>${rd.map(box).join('')}</div>`).join('');
    const champ = t.champion ? `<div class="br-col"><h5>우승</h5><div class="br-champ ${t.champion === 'player' ? 'me' : ''}">🏆 ${League.name(g, t.champion)}</div></div>` : '';
    const rule = t.rule ? `<p class="rule">특수 규칙 · <b>${t.rule.name}</b> — ${t.rule.desc}</p>` : '';
    return `${rule}<div class="bracket">${cols}${champ}</div>`;
  }
  function opponentHTML() {
    const o = Game.opponent(); if (!o) return `<p class="empty">예정된 경기가 없습니다.</p>`;
    return `<div class="opp clk" data-ui="scout" data-id="${o.id}" title="눌러서 상대 분석과 전술 추천 보기"><h3>${o.label}</h3>
      <div class="opp-name">${o.name}${o.rank ? `<small>리그 ${o.rank}위</small>` : ''}</div>
      <p class="note">주력 파이터 (밴픽에서 자주 선택)</p>
      <div class="opp-line">${o.fav.map(id => mini(FD(id))).join('')}</div>
      <p class="ob-hint">🔍 눌러서 분석 · 추천 전술 보기</p></div>`;
  }
  function showScout(id) {
    const g = G(), a = Scout.analyze(g, id); if (!a) return;
    const gp = a.power.gap, cls = gp == null || gp === 0 ? '' : gp > 0 ? 'up' : 'dn';
    const gapTxt = gp == null ? '비교 정보 없음' : gp > 0 ? `우리가 평균 ${gp} 앞섬` : gp < 0 ? `우리가 평균 ${-gp} 뒤짐` : '비슷함';
    const share = gp == null ? 50 : Math.max(8, Math.min(92, Math.round(a.power.me / (a.power.me + a.power.opp) * 100)));
    const st = k => a.strat.find(x => x.key === k), chips = (l, c) => l.length ? l.map(x => `<span class="ob-chip ${c}">${x.icon} ${x.name}</span>`).join('') : '<span class="ob-chip">뚜렷하지 않음</span>';
    const prosHtml = a.pros.length ? a.pros.map(r => `<li><em class="ob-gr" data-g="${r.grade}">${r.grade}</em><div><b>${r.p.nick}</b><span>${r.role} · ${r.style}${r.engage ? ' · ' + r.engage : ''}</span></div></li>`).join('') : '<li class="ob-none">선수 정보가 없습니다.</li>';
    const recHtml = a.rec.map((r, i) => `<article class="ob-rec ${i === 0 ? 'top' : ''}"><header><div>${i === 0 ? '<span class="ob-badge">추천</span>' : ''}<b>${r.name}</b></div><button class="btn small ${i === 0 ? 'primary' : 'ghost'}" data-ui="scoutApply" data-p="${r.id}">적용</button></header><p>${r.desc}</p><ul>${(r.why.length ? r.why : ['특별히 유리한 점은 없지만 무난하게 운영할 수 있습니다']).map(w => `<li>${w}</li>`).join('')}</ul></article>`).join('');
    modal(`<header class="ob-head">${teamLogo(a.name, 56)}<div><h3>${a.name}</h3><div class="ob-meta"><span>${a.tag}</span>${a.lv ? `<span>난이도 ${a.lv.name}</span>` : ''}${a.rank ? `<span>리그 ${a.rank}위</span>` : ''}</div></div></header>
      <div class="ob-sum">
        <div><small>전력 차이</small><b class="${cls}">${gp == null ? '-' : (gp > 0 ? '+' : '') + gp}</b><em>${gapTxt}</em></div>
        <div><small>예상 기조</small><b>${st('stance') ? st('stance').name : '-'}</b><em>보스 ${st('boss') ? st('boss').name : '-'}</em></div>
        <div><small>추천 전술</small><b>${a.rec[0].name}</b><em>${a.rec[0].why.length ? a.rec[0].why.length + '가지 근거' : '기본 운영'}</em></div>
      </div>
      <div class="ob-gauge"><i style="width:${share}%"></i></div><div class="ob-gl"><span>우리</span><span>상대</span></div>
      ${a.notes.length ? `<ul class="ob-note">${a.notes.map(n => `<li>${n}</li>`).join('')}</ul>` : ''}
      <section class="ob-sec"><h4>예상 운영 방식</h4><ul class="ob-strat">${a.strat.map(x => `<li title="${x.desc}"><small>${x.cat}</small><b>${x.name}</b></li>`).join('')}</ul></section>
      <section class="ob-sec"><h4>선수단</h4><ul class="ob-pros">${prosHtml}</ul><div class="ob-skill"><span>강점</span>${chips(a.skill.strong, 'good')}</div><div class="ob-skill"><span>약점</span>${chips(a.skill.weak, 'bad')}</div></section>
      <section class="ob-sec"><h4>밴 추천</h4><div class="ob-ban">${a.bans.map(id => mini(FD(id))).join('')}<p>${a.sample >= 3 ? `최근 ${a.sample}경기에서 자주 고른 파이터 기준` : '주력 파이터 기준입니다. 경기 기록이 쌓이면 더 정확해집니다.'}</p></div></section>
      <section class="ob-sec"><h4>추천 전술</h4>${recHtml}</section>
      <div class="modal-actions"><button class="btn" data-act="closeModal">닫기</button></div>`, 'tm-box ob-box');
  }
  function showTeam(id) {
    const g = G(), t = League.team(g, id); if (!t || !t.name) return;
    const all = League.sorted(g), ri = all.findIndex(x => x.id === id), s = all[ri], lv = CONFIG.ai.levels[t.level || League.lgOf(g).diff];
    const pros = (t.pros || []).map(pid => Pros.get(g, pid)).filter(Boolean);
    modal(`<div class="tm-head"><h3>${t.name}</h3><small>${League.tag(g, id)}${lv ? ' · 난이도 ' + lv.name : ''}${s ? ` · ${ri + 1}위 · ${s.w}승 ${s.d}무 ${s.l}패 · ${s.pts}점` : ''}</small></div>
      <div class="opp-line">${(t.fav || []).map(f => FD(f)).filter(Boolean).map(f => mini(f)).join('')}</div>
      <div class="pro-list">${pros.length ? pros.map((p, i) => `<small class="tm-pick">${i + 1}픽</small>${ProUI.card(p, '', { front: true })}`).join('') : '<p class="empty">선수 정보가 없습니다.</p>'}</div>
      <div class="modal-actions"><button class="btn" data-act="closeModal">닫기</button></div>`, 'tm-box');
  }
  const TOUR_KINDS = ['msi', 'playoff', 'worlds'];
  const tourKey = (g, k) => `${g.season || 1}:${k}`;
  const tourSeen = (g, k) => !!(g.tourSeen && g.tourSeen[tourKey(g, k)]);
  function tourIntroHTML(k) {
    const g = G(), t = g[k], I = (CONFIG.tourIntro || {})[k] || {}, name = I.name || (k === 'playoff' ? CONFIG.league.playoffName : t.name), mine = t.seeds.includes('player');
    return `<div class="ti">
      <div class="ti-art">${I.img ? `<img src="${I.img}" alt="" onerror="this.remove()">` : ''}<span class="ti-tag">${League.yearOf(g)} 시즌</span></div>
      <div class="ti-info"><h2>${I.title || name + ' 개최!'}</h2><p>${I.desc || ''}</p>
        <dl class="ti-meta"><div><dt>참가 팀</dt><dd>${t.seeds.length}<small>팀</small></dd></div><div><dt>방식</dt><dd>${t.rounds[0].length * 2}<small>강 토너먼트</small></dd></div><div><dt>내 팀</dt><dd class="${mine ? 'on' : ''}">${mine ? '출전' : '미출전'}</dd></div></dl>
        <button class="btn primary big ti-go" data-ui="tourEnter" data-k="${k}">${name} ${mine ? '참가' : '입장'}<span>→</span></button></div></div>`;
  }
  const views = {};
  views.league = () => {
    const g = G(), h = Game.hero();
    if (TOUR_KINDS.includes(g.phase) && g[g.phase] && !tourSeen(g, g.phase) && introAuto !== tourKey(g, g.phase)) { leagueTab = g.phase; introAuto = tourKey(g, g.phase); }
    const heroLogo = teamLogo(g.baseTeam, 68);
    const tabs = [['season', '정규시즌'], ['msi', 'MSI'], ['playoff', CONFIG.league.playoffName], ['worlds', '월드 챔피언십']];
    const body = leagueTab === 'season' ? standingsHTML() : (g[leagueTab] && !tourSeen(g, leagueTab) ? tourIntroHTML(leagueTab) : bracketHTML(g[leagueTab]));
    const log = g.league.playerLog.slice(-8).reverse().map(r => `<li class="${r.won ? 'w' : r.draw ? 'd' : 'l'}"><span>${r.tag}</span><b>${r.won ? '승' : r.draw ? '무' : '패'}</b><em>${r.opp}</em><small>${r.reward ? '+' + r.reward : ''}</small></li>`).join('');
    return `<section class="league-grid">
      <div class="col">
        <div class="glass hero"><div class="hero-main">${heroLogo}<div><span class="hero-sub">${h.sub}</span><h2>${h.title}</h2>
          <div class="prog"><i style="width:${h.pct}%"></i></div></div></div>
          <button class="btn primary big" data-act="advance" ${h.disabled ? 'disabled' : ''}>${h.label}</button></div>
        <div class="glass panel">${calBarHTML(g)}</div>
        <div class="tabs">${tabs.map(([k, n]) => `<button class="tab ${leagueTab === k ? 'on' : ''}" data-act="leagueTab" data-tab="${k}">${n}</button>`).join('')}</div>
        <div class="glass panel">${body}</div>
      </div>
      <aside class="col"><div class="glass panel">${opponentHTML()}</div>
        ${newsPanelHTML()}
        <div class="glass panel"><h3>최근 경기</h3>${log ? `<ul class="results">${log}</ul>` : '<p class="empty">아직 경기 기록이 없습니다.</p>'}</div></aside></section>`;
  };

  /* ---------- 데이터 센터 ---------- */
  const dcS = { tab: 'overview', role: 'all', sort: 'wr', fid: null, lg: null, team: null };
  const pct = x => (x * 100).toFixed(1) + '%';
  const dcBar = (v, max, cls) => `<i class="dc-bar ${cls || ''}"><u style="width:${Math.max(2, Math.min(100, v / max * 100))}%"></u></i>`;
  const dcName = id => { const f = FD(id); return `${mini(f)}<span class="dc-nm"><b>${f.name}</b><small>${CONFIG.roles[f.role].icon} ${CONFIG.roles[f.role].name}</small></span>`; };
  const dcList = (rows, val, max, cls, empty) => rows.length
    ? `<ol class="dc-list">${rows.map((x, i) => `<li><button data-act="dcFighter" data-id="${x.id}"><em>${i + 1}</em>${dcName(x.id)}<span class="dc-v">${val(x)}</span>${dcBar(x.bar == null ? x.v : x.bar, max, cls)}</button></li>`).join('')}</ol>`
    : `<p class="empty">${empty || '집계된 데이터가 아직 없습니다.'}</p>`;
  const dcPanel = (title, sub, body) => `<div class="glass panel dc-panel"><header><h4>${title}</h4>${sub ? `<small>${sub}</small>` : ''}</header>${body}</div>`;
  views.data = () => {
    const g = G(), S = Stats.get(g), all = Stats.fighters(g), top = Stats.topWin(g, 5), roster = Stats.roster();
    const tabs = [['overview', '종합'], ['mine', '내 데이터'], ['fighter', '파이터 승률'], ['matchup', '상성'], ['team', '팀 선호도'], ['league', '리그 밴픽률'], ['order', '지시']];
    const tabHtml = `<nav class="dc-tabs">${tabs.map(([id, n]) => `<button class="dc-tab ${dcS.tab === id ? 'on' : ''}" data-act="dcTab" data-tab="${id}">${n}</button>`).join('')}</nav>`;
    const hero = `<section class="dc-hero"><div class="dc-hero-h"><h3>승률 TOP 5</h3><small>총 ${S.n}경기 집계${S.n ? ' · 표본이 적은 파이터는 제외' : ''}</small></div>${top.length
      ? `<div class="dc-top5">${top.map((x, i) => { const f = FD(x.id); return `<button class="dc-card r${i + 1}" style="--ec:${f.color}" data-act="dcFighter" data-id="${x.id}"><span class="dc-rank">${i + 1}</span>${mini(f)}<b>${f.name}</b><em>${CONFIG.roles[f.role].icon} ${CONFIG.roles[f.role].name}</em><strong>${pct(x.wr)}</strong><small>${x.w}승 ${x.g - x.w}패 · ${x.g}전</small>${dcBar(x.wr, 1)}</button>`; }).join('')}</div>`
      : `<p class="empty">경기가 진행되면 파이터별 승률이 여기에 표시됩니다. 리그 경기를 치르면 AI 팀 경기까지 모두 집계됩니다.</p>`}</section>`;
    let body = '';
    if (dcS.tab === 'mine') {
      body = MyData.html(g, dcS, { FD, mini, panel: dcPanel, name: dcName, bar: dcBar });
    } else if (dcS.tab === 'overview') {
      const pick1 = Stats.topBy(g, 'pr', 1)[0], ban1 = Stats.topBy(g, 'br', 1)[0], tile = (k, v, sub) => `<div class="dc-tile"><small>${k}</small><b>${v}</b><span>${sub || ''}</span></div>`;
      const tiles = `<div class="dc-tiles">${tile('총 경기', S.n, '집계된 전체 경기')}${tile('집계 파이터', all.filter(x => x.g).length + ' / ' + roster.length, '1회 이상 출전')}
        ${tile('최다 픽', pick1 ? FD(pick1.id).name : '-', pick1 ? pct(pick1.pr) + ' 픽률' : '')}${tile('최다 밴', ban1 ? FD(ban1.id).name : '-', ban1 ? pct(ban1.br) + ' 밴률' : '')}</div>`;
      const mk = (rows, key) => rows.map(x => ({ ...x, v: x[key], bar: x[key] }));
      body = tiles + `<div class="dc-cols three">${dcPanel('픽률 TOP 5', '경기당 출전 비율', dcList(mk(Stats.topBy(g, 'pr', 5), 'pr'), x => pct(x.pr), Math.max(0.01, (Stats.topBy(g, 'pr', 1)[0] || { pr: 1 }).pr), 'acc'))}
        ${dcPanel('밴률 TOP 5', '경기당 밴된 비율', dcList(mk(Stats.topBy(g, 'br', 5), 'br'), x => pct(x.br), Math.max(0.01, (Stats.topBy(g, 'br', 1)[0] || { br: 1 }).br), 'warn'))}
        ${dcPanel('승률 하위 5', '고전 중인 파이터', dcList(Stats.botWin(g, 5).map(x => ({ ...x, v: x.wr })), x => pct(x.wr), 1, 'bad'))}</div>`;
    } else if (dcS.tab === 'fighter') {
      const roles = ['all', ...Object.keys(CONFIG.roles)].map(r => `<button class="chip ${dcS.role === r ? 'on' : ''}" data-act="dcRole" data-role="${r}">${r === 'all' ? '전체' : CONFIG.roles[r].icon + ' ' + CONFIG.roles[r].name}</button>`).join('');
      const k = dcS.sort, rows = all.filter(x => dcS.role === 'all' || FD(x.id).role === dcS.role).sort((a, b) => (k === 'wr' ? (b.g > 0) - (a.g > 0) : 0) || b[k] - a[k] || b.g - a.g);
      const th = (key, n) => `<th><button class="dc-th ${k === key ? 'on' : ''}" data-act="dcSort" data-k="${key}">${n}${k === key ? ' ▾' : ''}</button></th>`;
      body = `<div class="filter-row"><h3>파이터 ${rows.length}명</h3><div class="chips">${roles}</div></div><div class="glass panel dc-panel"><table class="tbl dc-tbl"><thead><tr><th>#</th><th>파이터</th>${th('g', '경기')}${th('wr', '승률')}${th('pr', '픽률')}${th('br', '밴률')}</tr></thead><tbody>
        ${rows.map((x, i) => `<tr data-act="dcFighter" data-id="${x.id}"><td>${i + 1}</td><td class="tn dc-tn">${dcName(x.id)}</td><td>${x.g || '-'}</td><td>${x.g ? `<span class="dc-v">${pct(x.wr)}</span>${dcBar(x.wr, 1, x.wr >= 0.5 ? '' : 'bad')}` : '-'}</td><td>${x.g ? pct(x.pr) : '-'}</td><td>${x.b ? pct(x.br) : '-'}</td></tr>`).join('')}</tbody></table></div>`;
    } else if (dcS.tab === 'order') {
      const O = CONFIG.orders, TG = { 'ph:early': '초반', 'ph:mid': '중반', 'ph:late': '후반', 'ld:behind': '뒤질 때', 'ld:even': '비슷할 때', 'ld:ahead': '앞설 때', 'boss:on': '보스 있을 때', 'boss:off': '보스 없을 때', sd: '서든데스' };
      const nm = r => { const d = (r.scope === 'team' ? O.team : O.unit).find(x => x.id === r.id); return d ? `${d.icon} ${d.name}` : r.id; }, cell = x => (x ? `${TG[x.tag] || x.tag} <span class="dc-v">${pct(x.wr)}</span> <small>${x.g}회</small>` : '-');
      const rows = Stats.orders(g);
      body = dcPanel('지시 사용 기록', '양 팀 지시 합산 · 지시 시점 기준 · 전체 승률보다 상황별 승률을 비교하세요', rows.length
        ? `<table class="tbl dc-tbl"><thead><tr><th>구분</th><th>지시</th><th>사용</th><th>전체 승률</th><th>가장 잘 통한 상황</th><th>가장 안 통한 상황</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.scope === 'team' ? '팀' : '개인'}</td><td class="tn">${nm(r)}</td><td>${r.g}</td><td>${pct(r.wr)}</td><td>${cell(r.best)}</td><td>${cell(r.worst)}</td></tr>`).join('')}</tbody></table>`
        : '<p class="empty">경기 중 지시를 쓰면 기록이 쌓입니다. (상황별 표본은 3회 이상부터 표시)</p>');
    } else if (dcS.tab === 'matchup') {
      const fid = dcS.fid || (top[0] && top[0].id) || roster[0], F = all.find(x => x.id === fid) || { g: 0, w: 0, wr: 0, pr: 0, br: 0 }, ms = Stats.matchups(g, fid);
      const strong = ms.filter(x => x.wr >= 0.5).sort((a, b) => b.wr - a.wr || b.g - a.g).slice(0, 5), weak = ms.filter(x => x.wr < 0.5).sort((a, b) => a.wr - b.wr || b.g - a.g).slice(0, 5);
      const val = x => `${pct(x.wr)} <small>${x.w}승 ${x.g - x.w}패</small>`, f = FD(fid);
      const chips = roster.map(id => `<button class="dc-chip ${id === fid ? 'on' : ''}" data-act="dcFighter" data-id="${id}" title="${FD(id).name}">${mini(FD(id))}</button>`).join('');
      body = `<div class="glass panel dc-sel"><div class="dc-chips">${chips}</div></div>
        <div class="glass panel dc-focus" style="--ec:${f.color}">${dcName(fid)}<div class="dc-fs"><div><small>승률</small><b>${F.g ? pct(F.wr) : '-'}</b></div><div><small>경기</small><b>${F.g}</b></div><div><small>픽률</small><b>${pct(F.pr)}</b></div><div><small>밴률</small><b>${pct(F.br)}</b></div></div></div>
        <div class="dc-cols">${dcPanel('강한 상대', `${f.name}이(가) 우세한 파이터`, dcList(strong.map(x => ({ ...x, v: x.wr })), val, 1, '', '우세한 상대 데이터가 부족합니다.'))}
        ${dcPanel('약한 상대', `${f.name}이(가) 고전하는 파이터`, dcList(weak.map(x => ({ ...x, v: 1 - x.wr })), val, 1, 'bad', '고전하는 상대 데이터가 부족합니다.'))}</div>`;
    } else if (dcS.tab === 'team') {
      const lgId = dcS.lg || g.leagueId, lg = CONFIG.leagues.find(l => l.id === lgId), tn = dcS.team || (lgId === g.leagueId ? g.baseTeam : lg.teams[0]);
      const lgChips = CONFIG.leagues.map(l => `<button class="chip ${l.id === lgId ? 'on' : ''}" data-act="dcLeague" data-id="${l.id}" style="--c:${l.color}">${l.name}</button>`).join('');
      const teamChips = lg.teams.map(n => { const has = Stats.get(g).team[lgId + '|' + (lgId === g.leagueId && n === g.baseTeam ? g.teamName : n)]; return `<button class="chip ${n === tn ? 'on' : ''}" data-act="dcTeam" data-n="${n}">${has ? '● ' : ''}${n}</button>`; }).join('');
      const R = Stats.teamRates(g, lgId, lgId === g.leagueId && tn === g.baseTeam ? g.teamName : tn), pk = R.picks.list.slice(0, 8), bn = R.bans.list.slice(0, 5);
      body = `<div class="glass panel dc-sel"><div class="chips">${lgChips}</div><div class="chips dc-teams">${teamChips}</div><small class="note">● 표시는 집계된 경기가 있는 팀입니다.</small></div>
        <div class="dc-cols">${dcPanel(`${tn} 선호 파이터`, R.picks.g ? `${R.picks.g}경기 기준 픽 비율` : '', dcList(pk.map(x => ({ ...x, v: x.rate })), x => pct(x.rate), Math.max(0.05, pk[0] ? pk[0].rate : 1), 'acc', '이 팀의 경기 기록이 아직 없습니다.'))}
        ${dcPanel(`${tn} 자주 밴하는 파이터`, R.bans.g ? `${R.bans.g}경기 기준` : '', dcList(bn.map(x => ({ ...x, v: x.rate })), x => pct(x.rate), Math.max(0.05, bn[0] ? bn[0].rate : 1), 'warn', '밴 기록이 아직 없습니다.'))}</div>`;
    } else {
      const lgId = dcS.lg || g.leagueId, lg = CONFIG.leagues.find(l => l.id === lgId), R = Stats.leagueRates(g, lgId), pk = R.picks.list.slice(0, 10), bn = R.bans.list.slice(0, 10);
      const lgChips = CONFIG.leagues.map(l => { const has = Stats.get(g).lg[l.id]; return `<button class="chip ${l.id === lgId ? 'on' : ''}" data-act="dcLeague" data-id="${l.id}" style="--c:${l.color}">${has ? '● ' : ''}${l.name}</button>`; }).join('');
      body = `<div class="glass panel dc-sel"><div class="chips">${lgChips}</div><small class="note">${lg.name} 리그 소속 팀이 치른 모든 경기(리그·MSI·월드)를 집계합니다. ● 는 데이터가 있는 리그입니다.</small></div>
        <div class="dc-cols">${dcPanel(`${lg.name} 리그 픽률 TOP 10`, R.picks.g ? `${R.picks.g}팀 경기 기준` : '', dcList(pk.map(x => ({ ...x, v: x.rate })), x => pct(x.rate), Math.max(0.05, pk[0] ? pk[0].rate : 1), 'acc', '이 리그의 경기 기록이 아직 없습니다.'))}
        ${dcPanel(`${lg.name} 리그 밴률 TOP 10`, R.bans.g ? `${R.bans.g}팀 경기 기준` : '', dcList(bn.map(x => ({ ...x, v: x.rate })), x => pct(x.rate), Math.max(0.05, bn[0] ? bn[0].rate : 1), 'warn', '밴 기록이 아직 없습니다.'))}</div>`;
    }
    return `<section class="dc-view"><div class="glass panel team-head"><div><h2>${CONFIG.nav.data}</h2><p>모든 경기 결과가 자동으로 집계됩니다. 파이터를 누르면 상성 화면으로 이동합니다.</p></div></div>${tabHtml}${dcS.tab === 'mine' ? '' : hero}${body}</section>`;
  };

  /* ---------- 리그 선택 / 트로피 ---------- */
  const STARS = { easy: 1, normal: 2, hard: 3, master: 4 };
  const stars = d => '★'.repeat(STARS[d]) + '☆'.repeat(4 - STARS[d]);
  const trophyCount = (g, lgId, k) => (g ? g.trophies.filter(t => t.lg === lgId && (!k || t.k === k)).length : 0);
  /* 이미지 규칙: 리그 배너 img/leagues/{리그id}.png (세로 1:2 권장) · 팀 로고 img/teams/{리그id}_{01~12}.png (정사각 권장, 번호는 CONFIG.leagues[].teams 순서)
     이미지가 없으면 색상 배너/이니셜 로고로 자동 대체됩니다. 리그id: kr cn eu na sea jp */
  const IMG = { league: id => `img/leagues/${id}.png`, team: (id, i) => `img/teams/${id}_${String(i + 1).padStart(2, '0')}.png` };
  const mgrKey = 'cosmic_manager';
  const mgr = () => { try { return localStorage.getItem(mgrKey) || ''; } catch (e) { return ''; } };
  const setMgr = v => { try { localStorage.setItem(mgrKey, v); } catch (e) { /* noop */ } };
  let mgrEdit = false;
  const abbr = n => n.split(' ').map(w => w[0]).join('').slice(0, 2);
  const logoHTML = (l, i) => `<span class="logo-b" style="--c:${l.color}"><i>${abbr(l.teams[i])}</i><img src="${IMG.team(l.id, i)}" alt="" onerror="this.remove()"></span>`;
  /* 팀 이름 → 로고(이미지 없으면 이니셜). 내 팀은 baseTeam 으로 찾고, 현재 리그를 먼저 찾습니다 */
  const teamLogo = (name, size = 36) => {
    const g = G(), nm = g && name === g.teamName && g.baseTeam ? g.baseTeam : name;
    const lg = CONFIG.leagues.find(l => g && l.id === g.leagueId && l.teams.includes(nm)) || CONFIG.leagues.find(l => l.teams.includes(nm));
    if (!lg) return '';
    return `<span class="team-logo" style="--c:${lg.color};--s:${size}px"><i>${abbr(nm)}</i><img src="${IMG.team(lg.id, lg.teams.indexOf(nm))}" alt="" onerror="this.remove()"></span>`;
  };
  const bannerHTML = l => `<div class="lgm-art" style="--c:${l.color}"><img src="${IMG.league(l.id)}" alt="" onerror="this.remove()"><span class="lgm-code">${l.short}</span><span class="lgm-vname">${l.name} 리그</span></div>`;

  function openLeague(id) {
    if (!mgr()) { toast('먼저 감독 닉네임을 정해 주세요.', 'warn'); return; }
    const l = CONFIG.leagues.find(x => x.id === id); if (!l) return; selLg = id;
    const g = G(), locked = !!g && g.phase !== 'seasonEnd';
    if (!g && !Club.startAllowed(id)) { toast('처음에는 입문 리그(' + CONFIG.club.startLeagues.map(x => CONFIG.leagues.find(y => y.id === x).short).join('·') + ')에서만 시작할 수 있습니다. 성적과 선수단을 갖춰 승격하세요.', 'warn'); return; }
    const endPhase = !!g && g.phase === 'seasonEnd', sc = endPhase ? Scout.ensure(g) : null, mv = endPhase ? Club.moveCheck(g, l.id) : null;
    const teams = l.teams.map((n, i) => {
      const ok = !locked && Scout.allowed(g, l.id, n) && (!mv || mv.ok), offered = !!(sc && sc.offers.some(o => o.lg === l.id && o.team === n)), cur = !!g && l.id === g.leagueId && n === g.baseTeam;
      return `<button class="lgm-team ${offered ? 'offered' : ''}" data-act="selTeam" data-i="${i}" ${ok ? '' : 'disabled'}>${logoHTML(l, i)}<b>${n}</b>${offered ? '<em class="lgm-offer">📨 제안</em>' : cur ? '<em class="lgm-offer">현재 팀</em>' : ''}</button>`;
    }).join('');
    modal(`<div class="lgm-wrap" style="--c:${l.color}"><aside class="lgm-banner">${bannerHTML(l)}</aside>
      <div class="lgm-main"><header><div><small>${l.short} · 난이도 ${CONFIG.ai.levels[l.diff].name} <i>${stars(l.diff)}</i></small><h2>${l.name} 리그</h2></div><p>${l.desc}</p></header>
        <h4 class="lgm-h">감독을 맡을 팀을 선택하세요 <em>${mgr()} 감독</em></h4>
        ${mv && mv.kind === 'up' ? `<ul class="mv-list">${mv.rows.map(r => `<li class="${r.ok ? 'ok' : 'no'}">${r.ok ? '✔' : '✖'} ${r.txt}</li>`).join('')}</ul>` : ''}${locked ? `<p class="lgm-lock">🔒 진행 중인 시즌이 끝나야 새 팀을 맡을 수 있습니다.</p>` : endPhase ? `<p class="lgm-lock">📨 스카웃 제안이 온 팀과 현재 팀만 선택할 수 있습니다.</p>` : ''}
        <div class="lgm-teams">${teams}</div>
        <footer><small>트로피와 전술 설정은 리그를 옮겨도 유지됩니다.</small><button class="btn" data-act="closeModal">닫기</button></footer></div></div>`, 'lgm', true);
  }

  views.select = () => {
    const g = G(), L = CONFIG.leagues, has = !!mgr();
    const cards = L.map(l => { const n = trophyCount(g, l.id);
      return `<button class="lg-card ${has && (g || Club.startAllowed(l.id)) ? '' : 'dis'}" style="--c:${l.color}" data-act="selLeague" data-id="${l.id}"><span class="lg-bg"><img src="${IMG.league(l.id)}" alt="" onerror="this.remove()"></span><span class="lg-short">${l.short}</span><b>${l.name} 리그</b>
        <small>난이도 ${CONFIG.ai.levels[l.diff].name} <i>${stars(l.diff)}</i></small><em>${l.desc}${!g && !Club.startAllowed(l.id) ? ' 🔒 승격으로만 진입' : ''}</em>${n ? `<span class="lg-tr">🏆 ${n}</span>` : ''}</button>`; }).join('');
    const locked = !!g && g.phase !== 'seasonEnd';
    const lockNote = locked ? `<div class="glass panel lock-note">🔒 <b>${League.lgOf(g).name} 리그 ${League.yearOf(g)}년 시즌</b> 진행 중 (${League.stage(g)}) — 시즌이 끝나야 다른 리그로 이동할 수 있습니다.</div>` : '';
    const endNote = g && g.phase === 'seasonEnd' ? `<div class="glass panel lock-note">📨 <b>시즌 종료</b> — 스카웃 제안이 온 팀 또는 현재 팀만 선택할 수 있습니다. <button class="btn small" data-act="advance">스카웃 제안 보기</button></div>` : '';
    const cur = g ? `<div class="glass panel cur-run"><div>현재 진행 <b>${League.lgOf(g).name} 리그 · ${g.teamName}</b> <small>시즌 ${g.season}</small></div><button class="btn primary" data-act="nav" data-view="league">이어서 하기</button></div>` : '';
    const nick = has && !mgrEdit
      ? `<div class="mgr-card done"><span class="mgr-ic">🎖</span><div><small>감독</small><b>${mgr()}</b></div><button class="btn small ghost" data-ui="mgrEdit">닉네임 변경</button></div>`
      : `<div class="mgr-card"><span class="mgr-ic">🎖</span><div><small>${has ? '닉네임 변경' : '처음 오셨군요! 감독 닉네임을 정해 주세요'}</small>
          <input id="mgrInput" class="mgr-input" maxlength="12" placeholder="감독 닉네임 (최대 12자)" value="${mgr()}" data-ui="mgr"></div><button class="btn primary" data-ui="mgrSave">감독 등록</button></div>`;
    return `<section class="select-view"><div class="glass panel team-head"><div><h2>${CONFIG.game.title}</h2><p>감독이 되어 6개 리그에 도전하세요. 리그를 고르면 배너와 함께 팀 목록이 열립니다. 리그 우승 · MSI · 월드 챔피언십 트로피를 모두 모아 보세요.</p></div></div>
      ${nick}${lockNote}${endNote}${cur}<h3 class="lg-title">${has ? '도전할 리그를 선택하세요' : '닉네임을 등록하면 리그를 선택할 수 있습니다'}</h3><div class="lg-grid">${cards}</div></section>`;
  };

  /* ---------- 트로피 전시관 ---------- */
  views.trophy = () => {
    const g = G(), T = CONFIG.trophies, kinds = ['league', 'msi', 'worlds'], cnt = k => g.trophies.filter(t => t.k === k).length;
    const img = (k, sc, own) => { const z = TrophyArt.size(k); return `<img class="px ${own ? '' : 'lockd'}" src="${TrophyArt.url(k)}" alt="" style="width:${z.w * sc}px;height:${z.h * sc}px">`; };
    const last = k => { const l = g.trophies.filter(t => t.k === k).slice(-1)[0]; return l ? `최근 시즌 ${l.season} · ${l.team}` : '아직 도전 중'; };
    const pedestal = k => { const n = cnt(k); return `<div class="hall-ped ${k} ${n ? 'own' : ''}"><div class="hall-spot"></div><div class="hall-item">${img(k, 7, n)}${n ? '<i class="sp s1"></i><i class="sp s2"></i><i class="sp s3"></i>' : ''}</div>
      <div class="hall-base"><b>${T[k].name}</b><strong>× ${n}</strong><small>${last(k)}</small></div></div>`; };
    const shelf = CONFIG.leagues.map(l => `<div class="shelf" style="--c:${l.color}"><div class="shelf-h"><b>${l.name}</b><small>${l.short}</small></div><div class="shelf-row">${kinds.map(k => {
      const list = g.trophies.filter(t => t.lg === l.id && t.k === k), n = list.length;
      return `<div class="case ${n ? 'own' : ''}" title="${n ? list.map(t => '시즌 ' + t.season + ' · ' + t.team).join('\n') : T[k].name + ' (미획득)'}">${img(k, 2.4, n)}${n > 1 ? `<span class="case-n">×${n}</span>` : ''}</div>`; }).join('')}</div><div class="shelf-board"></div></div>`).join('');
    const recent = g.trophies.slice(-8).reverse().map(t => `<li><b>${T[t.k].icon} ${T[t.k].name}</b><em>${CONFIG.leagues.find(l => l.id === t.lg).name} 리그 · ${t.team}</em><small>시즌 ${t.season}</small></li>`).join('');
    return `<section class="trophy-view"><div class="glass panel team-head"><div><h2>🏛 ${mgr() ? mgr() + ' 감독의 ' : ''}트로피 전시관</h2><p>우승할 때마다 전시관에 트로피가 놓입니다. 리그 우승 → MSI → 월드 챔피언십 순으로 더 웅장해집니다.</p></div></div>
      <div class="hall"><div class="hall-floor"></div>${kinds.map(pedestal).join('')}</div>
      <div class="glass panel"><h3>리그별 전시장</h3><div class="shelves">${shelf}</div></div>
      <div class="glass panel"><h3>최근 획득</h3>${recent ? `<ul class="tr-list">${recent}</ul>` : '<p class="empty">아직 획득한 트로피가 없습니다.</p>'}</div></section>`;
  };

  /* ---------- 전술 (팀 전략 + 1·2·3픽 슬롯) — 슬라이드·2개씩 컴팩트 ---------- */
  let tacTab = 'team', tacPage = 0;   // tacTab: 'team' | 'slot'
  const TAC_PER_PAGE = 2;

  function injectTacCss() {
    if ($('#tacCss')) return;
    const st = document.createElement('style'); st.id = 'tacCss';
    st.textContent = `
.tac-view{display:flex;flex-direction:column;gap:14px;max-width:1040px;margin:0 auto}
.tac-hero{position:relative;overflow:hidden;border-radius:18px;padding:18px 20px 16px;border:1px solid var(--line);
  background:linear-gradient(135deg,rgba(94,231,255,.08),rgba(255,110,199,.05) 45%,rgba(0,0,0,.25))}
.tac-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(600px 120px at 10% -20%,rgba(94,231,255,.18),transparent 60%),radial-gradient(500px 100px at 90% 0%,rgba(255,110,199,.12),transparent 55%);pointer-events:none}
.tac-hero-inner{position:relative;display:flex;flex-wrap:wrap;gap:14px 20px;align-items:flex-end;justify-content:space-between}
.tac-hero h2{margin:0 0 4px;font-family:var(--disp);font-size:24px;letter-spacing:.02em}
.tac-hero p{margin:0;max-width:560px;color:var(--muted);font-size:12.5px;line-height:1.5}
.tac-seg{display:inline-flex;padding:3px;border-radius:12px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08);gap:2px}
.tac-seg button{appearance:none;border:0;background:transparent;color:var(--muted);font:inherit;font-size:13px;font-weight:700;padding:8px 16px;border-radius:10px;cursor:pointer;transition:all .18s}
.tac-seg button:hover{color:var(--text)}
.tac-seg button.on{background:var(--acc);color:#061018;box-shadow:none}
.tac-panel{padding:0;overflow:hidden;display:flex;flex-direction:column;min-height:300px}
.tac-toolbar{display:flex;flex-wrap:wrap;gap:10px 12px;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.06);background:rgba(0,0,0,.18)}
.tac-toolbar .left{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.tac-toolbar .right{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.tac-subtabs{display:inline-flex;flex-wrap:wrap;gap:4px;padding:3px;border-radius:11px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}
.tac-subtabs button{appearance:none;border:0;background:transparent;color:var(--muted);font:inherit;font-size:12.5px;font-weight:700;padding:6px 12px;border-radius:8px;cursor:pointer;transition:all .15s}
.tac-subtabs button:hover{color:var(--text);background:rgba(255,255,255,.05)}
.tac-subtabs button.on{color:#061018;background:var(--acc);box-shadow:none}
.tac-slots{display:inline-flex;gap:6px}
.tac-slot-btn{appearance:none;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.28);color:var(--muted);font:inherit;font-size:12.5px;font-weight:800;padding:6px 12px;border-radius:10px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s}
.tac-slot-btn .n{width:18px;height:18px;border-radius:6px;display:grid;place-items:center;font-size:11px;background:rgba(255,255,255,.08)}
.tac-slot-btn:hover{border-color:rgba(94,231,255,.4);color:var(--text)}
.tac-slot-btn.on{border-color:var(--acc);background:var(--acc);color:#061018;box-shadow:none}
.tac-slot-btn.on .n{background:rgba(0,0,0,.25);color:#fff}
.tac-hint{color:var(--muted);font-size:12px}
.tac-presets{display:flex;flex-wrap:wrap;gap:5px}
.tac-presets .btn{font-size:11.5px;padding:5px 10px;border-radius:8px}
.tac-body{padding:14px 16px 16px}
.tac-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
@media (max-width:760px){.tac-grid{grid-template-columns:1fr}}
.tac-card{position:relative;display:flex;flex-direction:column;gap:8px;padding:12px 14px 12px 15px;border-radius:14px;
  background:linear-gradient(165deg,rgba(255,255,255,.045),rgba(255,255,255,.02));
  border:1px solid rgba(255,255,255,.07);box-shadow:0 8px 24px -18px rgba(0,0,0,.6);transition:border-color .18s,box-shadow .18s}
.tac-card::before{content:'';position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:0 3px 3px 0;background:rgba(255,255,255,.12)}
.tac-card:hover{border-color:rgba(94,231,255,.22);box-shadow:0 10px 28px -16px rgba(94,231,255,.25)}
.tac-card:hover::before{background:var(--acc)}
.tac-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.tac-card h4{margin:0;font-size:13px;font-weight:800;letter-spacing:.01em;display:flex;flex-direction:column;gap:3px}
.tac-card h4 .cur{font-size:11.5px;font-weight:600;color:var(--acc);opacity:.95}
.tac-card .tg{font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);background:rgba(255,255,255,.05);padding:2px 7px;border-radius:999px;white-space:nowrap}
.tac-opts{display:flex;flex-wrap:wrap;gap:5px}
.tac-opt{appearance:none;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.28);color:var(--text);font:inherit;font-size:12px;font-weight:650;padding:5px 10px;border-radius:8px;cursor:pointer;transition:all .14s;line-height:1.2}
.tac-opt:hover{border-color:rgba(94,231,255,.45);background:rgba(94,231,255,.08)}
.tac-opt.on{border-color:var(--acc);background:var(--acc);color:#061018;font-weight:800;box-shadow:none}
.tac-meter{display:flex;align-items:center;gap:10px;margin-top:2px}
.tac-meter.off{opacity:.35;pointer-events:none}
.tac-meter .lab{font-size:11px;font-weight:700;color:var(--muted);min-width:28px}
.tac-meter input[type=range]{flex:1;min-width:0;height:6px;border-radius:999px;appearance:none;background:linear-gradient(90deg,rgba(94,231,255,.15),rgba(255,110,199,.15));outline:none}
.tac-meter input[type=range]::-webkit-slider-thumb{appearance:none;width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid var(--acc);box-shadow:0 0 8px var(--acc);cursor:pointer}
.tac-meter .val{min-width:22px;text-align:center;font-size:12px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--acc)}
.tac-desc{margin:0;font-size:11.5px;line-height:1.4;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tac-empty{grid-column:1/-1;text-align:center;color:var(--muted);padding:28px}
`;
    document.head.appendChild(st);
  }

  const tacRow = (cat, id, lv, a) => {
    const T = CONFIG.tactics, neutral = id === cat.neutral, opt = cat.options.find(o => o.id === id) || cat.options[0];
    const meter = true ? '' : `<div class="tac-meter ${neutral ? 'off' : ''}"><span class="lab">정도</span><input type="range" min="1" max="${T.maxLevel}" value="${lv}" data-input="${a.lv}" ${a.attr} data-cat="${cat.id}" ${neutral ? 'disabled' : ''}><span class="val">${neutral ? '–' : lv}</span></div>`;
    return `<article class="tac-card">
      <div class="tac-card-top"><h4>${cat.name}<span class="cur">${opt.name}</span></h4></div>
      <div class="tac-opts">${cat.options.map(o => `<button class="tac-opt ${o.id === id ? 'on' : ''}" data-act="${a.opt}" ${a.attr} data-cat="${cat.id}" data-id="${o.id}" title="${o.desc || ''}">${o.name}</button>`).join('')}</div>
      ${meter}<p class="tac-desc" title="${opt.desc || ''}">${opt.desc || ''}</p>
    </article>`;
  };

  function tacPageCount(list) { return Math.max(1, Math.ceil(list.length / TAC_PER_PAGE)); }
  function tacSlice(list, page) {
    const max = tacPageCount(list);
    const p = Math.max(0, Math.min(max - 1, page | 0));
    return { page: p, max, items: list.slice(p * TAC_PER_PAGE, p * TAC_PER_PAGE + TAC_PER_PAGE) };
  }

  views.tactics = () => {
    injectTacCss();
    const g = G(), T = CONFIG.tactics;
    if (!g.slotTactics || g.slotTactics.length !== 3) g.slotTactics = Draft.neutralSlots();
    const S = g.strategy;
    const slot = Math.max(0, Math.min(2, tacSlot | 0));
    const tac = g.slotTactics[slot];
    const presets = Object.entries(Draft.strategyPresets).map(([id, p]) =>
      `<button class="btn small ghost" data-ui="strPresetAll" data-p="${id}" title="${p.desc}">${p.name}</button>`).join('');

    const teamCats = T.team.filter(c => T.pre.team.includes(c.id)), teamGroups = [...new Set(teamCats.map(c => c.group))];
    const slotCats = T.categories.filter(c => T.pre.slot.includes(c.id));
    let page, max, items, groupLabel = '';

    if (tacTab === 'team') {
      max = Math.max(1, teamGroups.length);
      page = Math.max(0, Math.min(max - 1, tacPage | 0));
      tacPage = page;
      groupLabel = teamGroups[page];
      items = teamCats.filter(c => c.group === groupLabel);
    } else {
      page = 0; max = 1; items = slotCats;
    }

    const lineup = g.club && typeof Club !== 'undefined' ? Club.lineup(g) : [], roleOf = (g.slotRole || [])[slot] || 'auto';
    const slotHint = roleOf === 'auto' ? '픽한 파이터에 맞춰 경기 시작 때 자동으로 정해집니다.' : roleOf === 'custom' ? '직접 설정한 값입니다.' : (T.roles.find(r => r.id === roleOf) || {}).desc || '';
    const slotBtns = [0, 1, 2].map(i =>
      `<button class="tac-slot-btn ${i === slot ? 'on' : ''}" data-act="tacSlot" data-slot="${i}"><span class="n">${i + 1}</span>${lineup[i] ? lineup[i].nick : (i + 1) + '번'}</button>`).join('');
    const roleBtns = [{ id: 'auto', name: '자동', desc: '픽한 파이터에 맞춰 자동 결정' }, ...T.roles].map(r =>
      `<button class="${roleOf === r.id ? 'on' : ''}" data-act="tacRole" data-slot="${slot}" data-role="${r.id}" title="${r.desc}">${r.name}</button>`).join('');
    const groupTabs = teamGroups.length < 2 ? '' : teamGroups.map((gr, i) =>
      `<button class="${i === page ? 'on' : ''}" data-ui="tacPage" data-p="${i}">${gr}</button>`).join('');

    let body;
    if (tacTab === 'team') {
      const rows = items.map(cat => tacRow(cat, S[cat.id][0], S[cat.id][1], { opt: 'strOpt', lv: 'strLv', attr: '' })).join('');
      body = `<section class="glass panel tac-panel">
        <div class="tac-toolbar">
          <div class="left"><div class="tac-subtabs">${groupTabs}</div></div>
          <div class="right tac-presets">${presets}<button class="btn small" data-act="strReset">초기화</button></div>
        </div>
        <div class="tac-body"><div class="tac-grid">${rows || '<p class="tac-empty">항목 없음</p>'}</div></div>
      </section>`;
    } else {
      const rows = items.map(cat => tacRow(cat, tac[cat.id][0], tac[cat.id][1], { opt: 'tacOpt', lv: 'tacLv', attr: `data-slot="${slot}"` })).join('');
      body = `<section class="glass panel tac-panel">
        <div class="tac-toolbar">
          <div class="left">
            <div class="tac-slots">${slotBtns}</div>
            <div class="tac-subtabs">${roleBtns}</div>
          </div>
          <div class="right"><span class="tac-hint">${slotHint}</span><button class="btn small ghost" data-act="tacReset" data-slot="${slot}">자동으로</button></div>
        </div>
        <div class="tac-body"><div class="tac-grid" ${roleOf === 'auto' ? 'style="opacity:.5"' : ''}>${rows || '<p class="tac-empty">항목 없음</p>'}</div></div>
      </section>`;
    }

    return `<section class="tac-view">
      <div class="glass panel tac-hero"><div class="tac-hero-inner">
        <div><h2>${CONFIG.nav.tactics}</h2>
          <p>팀 기조와, 배치한 선수별 역할을 정합니다. 경기 중에는 지시로 상황에 맞게 바꿀 수 있고, 지시가 없으면 여기서 정한 대로 움직입니다.</p></div>
        <div class="tac-seg">
          <button class="${tacTab === 'team' ? 'on' : ''}" data-ui="tacTab" data-t="team">팀 전략</button>
          <button class="${tacTab === 'slot' ? 'on' : ''}" data-ui="tacTab" data-t="slot">픽 슬롯 전술</button>
        </div>
      </div></div>
      ${body}
    </section>`;
  };

  /* ---------- 파이터 도감 ---------- */
  views.codex = () => {
    const list = CONFIG.fighterOrder.map(FD).filter(f => roleFilter === 'all' || f.role === roleFilter);
    const chips = ['all', ...Object.keys(CONFIG.roles)].map(r => `<button class="chip ${roleFilter === r ? 'on' : ''}" data-act="roleFilter" data-role="${r}">${r === 'all' ? '전체' : CONFIG.roles[r].icon + ' ' + CONFIG.roles[r].name}</button>`).join('');
    const stat = Object.keys(CONFIG.status).map(k => `<span class="st-chip"><b>${CONFIG.status[k].name}</b> ${CONFIG.status[k].desc}</span>`).join('');
    return `<section class="codex-view"><div class="glass panel team-head"><div><h2>${CONFIG.nav.codex}</h2><p>전체 파이터 ${CONFIG.fighterOrder.length}명의 스탯과 스킬을 열람합니다. 카드를 누르면 상세 정보가 열립니다.</p></div></div>
      <div class="glass panel st-legend"><h4>상태이상</h4><div>${stat}</div></div>
      <div class="filter-row"><h3>파이터 ${list.length}명</h3><div class="chips">${chips}</div></div>
      <div class="cx-grid">${list.map(f => codexCard(f)).join('')}</div></section>`;
  };
  function showFighter(id) {
    const f = FD(id); if (f.forms && !codexForm[id]) codexForm[id] = Object.keys(f.forms)[0];
    cx.list = CONFIG.fighterOrder.filter(i => roleFilter === 'all' || FD(i).role === roleFilter); if (!cx.list.includes(id)) cx.list = CONFIG.fighterOrder.slice();
    cx.id = id; cx.slide = 0; cxRender();
  }
  function setCodexForm(id, form) {
    codexForm[id] = form; const f = FD(id), sk = $('#cxSkills');
    if (sk) { sk.innerHTML = skillsHTML(f); return; }
    const box = $('.modal-box .fd'); if (box) box.innerHTML = fighterDetail(f);
  }

  /* ---------- 밴픽 ---------- */
  /* 밴픽 슬롯용 프로 정보 (닉·선호 챔프·주 포지션) */
  function draftProOf(teamIdx, slot) {
    const M = Game.match, g = G(); if (!M || !g) return null;
    const tid = M.teams[teamIdx].id;
    let pid = null;
    if (tid === 'player') pid = g.club && g.club.lineup ? g.club.lineup[slot] : null;
    else {
      const tm = League.team(g, tid);
      pid = tm && tm.pros ? tm.pros[slot] : null;
    }
    if (!pid) return null;
    const p = Pros.get(g, pid); if (!p) return null;
    const favs = (p.favs || []).slice(0, 3);
    const roles = {};
    favs.forEach(id => { const f = FD(id); if (f) roles[f.role] = (roles[f.role] || 0) + 1; });
    const topRole = Object.keys(roles).sort((a, b) => roles[b] - roles[a])[0];
    const R = topRole && CONFIG.roles[topRole];
    return { nick: p.nick || '선수', favs, roleName: R ? (R.icon + ' ' + R.name) : '', grade: p.grade || '' };
  }
  let swapFrom = null;      // 밴픽 완료 후 스왑용 (슬롯 인덱스)

  views.draft = () => {
    const M = Game.match, d = Game.draft; if (!M || !d) return `<section class="glass panel empty-match"><h2>진행 중인 경기가 없습니다</h2><button class="btn primary" data-act="nav" data-view="league">리그로 이동</button></section>`;
    if (!$('#draftCss')) {
      const st = document.createElement('style'); st.id = 'draftCss';
      st.textContent = `
.draft-view .dr-grid { grid-template-columns: minmax(200px, 0.85fr) minmax(0, 1.3fr) minmax(200px, 0.85fr); gap: 12px; align-items: start; }
.draft-view .dr-mid { min-width: 0; }
.draft-view .dr-tiles { grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); gap: 6px; }
.draft-view .dr-tiles-box { position: relative; border-radius: 12px; }
.draft-view .dr-tiles { max-height: clamp(320px, calc(100vh - 340px), 640px); overflow-y: auto; overflow-x: hidden; padding: 4px 6px 4px 2px; scrollbar-width: thin; }
.draft-view .dr-tiles::-webkit-scrollbar { width: 8px; }
.draft-view .dr-tiles::-webkit-scrollbar-thumb { background: rgba(255,255,255,.25); border-radius: 4px; }
.draft-view .dr-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(4,8,18,.6); border-radius: 12px; opacity: 0; pointer-events: none; transition: opacity .35s; }
.draft-view .dr-overlay.on { opacity: 1; pointer-events: auto; }
.draft-view .dr-team h3 { text-align: center; }
.draft-view .dr-slot {
  display: flex; flex-direction: row; align-items: center; justify-content: space-between;
  gap: 10px; padding: 14px 12px; min-height: 88px;
}
.draft-view .dr-slot .dr-info { flex: 1; min-width: 0; text-align: left; display: flex; flex-direction: column; gap: 4px; }
.draft-view .dr-slot .dr-pick { flex: none; width: 64px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.draft-view .dr-slot .dr-pick img.px { margin: 0 auto; display: block; }
.draft-view .dr-slot .dr-pick b { display: block; font-size: 11px; line-height: 1.2; }
.dr-slot .dr-lab { display: block; font-size: 11px; opacity: .8; }
.dr-slot .dr-pro { display: block; font-size: 12px; font-weight: 700; color: var(--text); line-height: 1.3; }
.dr-slot .dr-meta { display: block; font-size: 11px; color: var(--muted); line-height: 1.3; }
.dr-slot .dr-favs { display: block; font-size: 11px; color: var(--text); opacity: .92; line-height: 1.35; word-break: keep-all; }
.dr-slot.swap-on { outline: 2px solid var(--acc); box-shadow: 0 0 0 3px rgba(110,231,255,.25); }
.dr-slot.can-swap { cursor: pointer; }
.dr-slot.can-swap:hover { background: rgba(255,255,255,.06); }
.dr-swap-hint { font-size: 12px; color: var(--muted); margin: 0 0 6px; }
`;
      document.head.appendChild(st);
    }
    swapFrom = null;
    const proBlock = (t, i) => {
      const pr = draftProOf(t, i);
      if (!pr) return `<div class="dr-info"><span class="dr-lab">PICK ${i + 1}</span></div><div class="dr-pick"></div>`;
      const favHtml = pr.favs.map(id => { const f = FD(id); return f ? f.name : ''; }).filter(Boolean).join(', ') || '—';
      return `<div class="dr-info">
        <span class="dr-lab">PICK ${i + 1}</span>
        <span class="dr-pro">${pr.nick}${pr.grade ? ' · ' + pr.grade : ''}</span>
        <span class="dr-meta">${pr.roleName ? pr.roleName + ' 선호' : '선호 챔프'}</span>
        <span class="dr-favs">${favHtml}</span>
      </div><div class="dr-pick"></div>`;
    };
    const col = t => `<div class="dr-team t${t}" style="--tc:${CONFIG.ui.teamColors[t]}"><div class="dr-logo">${teamLogo(M.teams[t].name, 88)}</div><h3>${M.teams[t].name}${t === M.pIdx ? ' <small>(나)</small>' : ''}</h3>
      <div class="dr-slot ban" id="slot-b${t}"><span class="dr-lab">BAN</span></div>${[0, 1, 2].map(i => `<div class="dr-slot" id="slot-p${t}-${i}" data-team="${t}" data-slot="${i}">${proBlock(t, i)}</div>`).join('')}</div>`;
    const tiles = CONFIG.fighterOrder.map(id => { const f = FD(id); return `<button class="dr-tile" data-act="draftSel" data-id="${id}" data-fid="${id}" data-role="${f.role}" style="--ec:${f.color}"><img class="px" src="${Sprites.url(f)}" alt=""><b>${f.name}</b><small>${f.icon}</small><i class="dr-x"></i></button>`; }).join('');
    return `<section class="draft-view"><div class="glass panel dr-head"><div><h2>밴픽</h2><p>${M.label} · 벤 1 · 픽 3 · 번갈아 선택 (벤된 파이터는 양 팀 모두 사용 불가)${Game.draft && Game.draft.fearless && Game.draft.fearless.length ? ' · 피어리스: 앞 세트에서 나온 파이터 사용 불가' : ''}</p><p class="dr-swap-hint" id="drSwapHint" hidden>밴픽 완료 — 내 픽 슬롯을 두 번 클릭하면 순서를 바꿀 수 있습니다</p></div><div class="dr-turn" id="drTurn"></div></div>
      <div class="dr-grid">${col(0)}<div class="dr-mid"><div class="chips dr-filter" id="drFilter">${['all', ...Object.keys(CONFIG.roles)].map(r => `<button class="chip ${draftRole === r ? 'on' : ''}" data-act="draftFilter" data-role="${r}">${r === 'all' ? '전체' : CONFIG.roles[r].icon + ' ' + CONFIG.roles[r].name}</button>`).join('')}</div><div class="dr-tiles-box"><div class="dr-tiles" id="drTiles">${tiles}</div><div class="dr-overlay" id="drOverlay"><button class="btn primary big" data-act="draftDone" id="drDone">경기장으로 이동</button></div></div></div>${col(1)}</div></section>`;
  };
  const draftSelected = () => selected;
  function setDraftFilter(r) {
    draftRole = r; $$('#drFilter .chip').forEach(c => c.classList.toggle('on', c.dataset.role === r)); draftUpdate();
  }
  function draftSelect(id) {
    selected = id;
    $$('.dr-tile').forEach(b => b.classList.toggle('sel', b.dataset.fid === id));
    if (!id) { closeModal(); draftUpdate(); return; }
    const cur = Game.draft && Draft.current(Game.draft), isBan = cur && cur.type === 'ban';
    modal(`<div class="fd">${fighterDetail(FD(id))}</div>
      <div class="dr-actions"><button class="btn primary big" data-act="draftConfirm" id="drConfirm">${isBan ? '밴 확정' : '픽 확정'}</button><button class="btn big" id="drCancel">취소</button></div>`, 'dr-pop', false);
    $('#drCancel').addEventListener('click', () => draftSelect(null));
    $('#drConfirm').addEventListener('click', () => setTimeout(closeModal, 0));      // 확정 처리는 main.js 의 draftConfirm 이 담당
    draftUpdate();
  }
  function draftSwapClick(team, slot) {
    const M = Game.match, d = Game.draft;
    if (!M || !d || !d.done || team !== M.pIdx) return;
    if (swapFrom == null) {
      swapFrom = slot;
    } else if (swapFrom === slot) {
      swapFrom = null;
    } else {
      const arr = d.picks[team];
      const a = arr[swapFrom], b = arr[slot];
      if (a != null || b != null) { arr[swapFrom] = b; arr[slot] = a; }
      swapFrom = null;
    }
    draftUpdate();
  }
  function draftUpdate() {
    const M = Game.match, d = Game.draft; if (!M || !d || view !== 'draft' || !$('#drTiles')) return;
    const taken = Draft.taken(d), banned = Draft.banned(d), cur = Draft.current(d);
    $$('.dr-tile').forEach(b => {
      const id = b.dataset.fid, isBan = banned.includes(id) || !!(d.fearless && d.fearless.includes(id)), t = d.picks[0].includes(id) ? 0 : d.picks[1].includes(id) ? 1 : -1;
      b.hidden = draftRole !== 'all' && b.dataset.role !== draftRole;
      b.classList.toggle('banned', isBan); b.classList.toggle('picked', t >= 0); b.disabled = taken.includes(id) || !Game.isPlayerTurn() || d.done;
      b.style.setProperty('--pc', t >= 0 ? CONFIG.ui.teamColors[t] : 'transparent');
    });
    [0, 1].forEach(t => {
      const fill = (el, id, slotIdx) => {
        if (!el) return;
        const f = id && FD(id);
        el.classList.toggle('filled', !!f);
        const isPlayerSlot = t === M.pIdx && slotIdx != null && d.done;
        el.classList.toggle('can-swap', !!isPlayerSlot);
        el.classList.toggle('swap-on', isPlayerSlot && swapFrom === slotIdx);
        const pr = slotIdx != null ? draftProOf(t, slotIdx) : null;
        let info = `<span class="dr-lab">${slotIdx == null ? 'BAN' : 'PICK ' + (slotIdx + 1)}</span>`;
        if (pr) {
          const favHtml = pr.favs.map(fid => { const ff = FD(fid); return ff ? ff.name : ''; }).filter(Boolean).join(', ') || '—';
          info += `<span class="dr-pro">${pr.nick}${pr.grade ? ' · ' + pr.grade : ''}</span>
            <span class="dr-meta">${pr.roleName ? pr.roleName + ' 선호' : '선호 챔프'}</span>
            <span class="dr-favs">${favHtml}</span>`;
        }
        const pick = f ? `<img class="px" src="${Sprites.url(f)}" alt=""><b>${f.name}</b>` : '';
        el.innerHTML = `<div class="dr-info">${info}</div><div class="dr-pick">${pick}</div>`;
        if (isPlayerSlot) {
          el.onclick = () => draftSwapClick(t, slotIdx);
        } else {
          el.onclick = null;
        }
      };
      fill($(`#slot-b${t}`), d.bans[t][0], null);
      [0, 1, 2].forEach(i => fill($(`#slot-p${t}-${i}`), d.picks[t][i], i));
      $$(`.dr-team.t${t} .dr-slot`).forEach(e => e.classList.remove('now'));
      if (cur && cur.team === t && !d.done) { const idx = cur.type === 'ban' ? $(`#slot-b${t}`) : $(`#slot-p${t}-${d.picks[t].length}`); if (idx) idx.classList.add('now'); }
    });
    const turn = $('#drTurn'), mine = Game.isPlayerTurn();
    if (turn) turn.innerHTML = d.done ? '<b>밴픽 완료</b> — 픽 순서 스왑 후 이동' : `<span style="color:${CONFIG.ui.teamColors[cur.team]}">${M.teams[cur.team].name}</span>의 <b>${cur.type === 'ban' ? '밴' : '픽'}</b> ${mine ? '— 선택하세요' : '— 선택 중...'}`;
    const hint = $('#drSwapHint'); if (hint) hint.hidden = !d.done;
    const c = $('#drConfirm'), done = $('#drDone');
    if (c && (d.done || !mine || !selected || taken.includes(selected))) { closeModal(); selected = null; $$('.dr-tile').forEach(b => b.classList.remove('sel')); }
    else if (c) c.textContent = cur && cur.type === 'ban' ? '밴 확정' : '픽 확정';
    const ov = $('#drOverlay'); if (ov) ov.classList.toggle('on', !!d.done);
  }

  /* ---------- 경기장 ---------- */
  views.match = () => {
    const M = Game.match;
    if (!M) return `<section class="glass panel empty-match"><h2>진행 중인 경기가 없습니다</h2><p>리그 화면에서 다음 경기를 시작하세요.</p><button class="btn primary" data-act="nav" data-view="league">리그로 이동</button></section>`;
    const cats = [['atk', '공격'], ['skill', '스킬'], ['crit', '치명타'], ['heal', '치유'], ['buff', '상태'], ['ko', '쓰러짐'], ['miss', '빗나감']];
    return `<section class="match-grid"><div class="arena-col">
      <div class="scoreboard glass"><div class="sb-team" style="--tc:${CONFIG.ui.teamColors[0]}">${M.teams[0].name}</div><div class="sb-mid"><b id="clock">0.0s</b><small>${M.label}</small><small id="coreHud" style="display:block;font-size:11px"></small></div><div class="sb-team r" style="--tc:${CONFIG.ui.teamColors[1]}">${M.teams[1].name}</div></div>
      <div class="arena-wrap glass"><canvas id="arena"></canvas><div class="arena-overlay" id="arenaOverlay">
        <h2>${M.teams[0].name} <span>vs</span> ${M.teams[1].name}</h2><p>${M.label}${M.rule ? ` · 특수 규칙 ${M.rule.name} (${M.rule.desc})` : ''}</p>
        <p class="rule">제한시간 ${Math.round(CONFIG.battle.maxTicks * CONFIG.battle.tickMs / 60000)}분 동안 맵 곳곳의 에너지 코어를 모아 중앙 위·아래 제출 지점에 내면 점수가 되고, 제출 점수가 더 높은 팀이 승리합니다. 킬은 점수가 없고, 죽으면 들고 있던 코어를 그 자리에 드랍합니다. 첫 보스는 ${CONFIG.battle.map.bosses[0].at}초에 중앙에 나타나고 두 번째 보스는 첫 보스가 쓰러지고 ${CONFIG.battle.map.bosses[1].after}초 뒤에 나타납니다. 보스를 처치하면 코어 더미(${CONFIG.battle.map.core.boss.first} / ${CONFIG.battle.map.core.boss.late}개)가 떨어지고 처치한 팀이 ${CONFIG.battle.map.core.boss.buff.sec}초 동안 강화됩니다. 외곽·구석의 초록 십자 장치를 밟으면 체력을 회복합니다. 동점이면 서든데스 — 전원 체력이 줄어든 상태에서 먼저 코어를 제출하는 팀이 승리합니다.</p>
        <button class="btn primary big" data-act="startBattle">경기 시작</button></div></div>
      <div class="controls glass"><button class="btn" data-act="pause" id="btnPause" disabled>일시정지</button>
        ${CONFIG.battle.speeds.map((s, i) => `<button class="btn speed ${i === 0 ? 'on' : ''}" data-act="speed" data-s="${s}">${s}배속</button>`).join('')}
        <button class="btn" data-act="autoUlt" id="btnAuto">궁극기 자동: ${Game.autoUlt ? '켜짐' : '꺼짐'}</button>
        <button class="btn ghost" data-act="skipBattle" id="btnSkip" disabled>결과까지 건너뛰기</button></div>
        <div class="cmd glass off" id="cmdPanel"><div class="cmd-head"><b>지휘</b><span class="cmd-cp" id="cmdCp"></span><small id="cmdNow">자동 (설정한 전술)</small><button class="btn ghost cmd-off" data-cmd="auto:" id="cmdAuto">자동 지휘: 꺼짐</button><button class="btn ghost cmd-off" data-cmd="off:">지시 해제</button></div><div id="cmdBody"></div></div></div>
      <aside class="log-col glass"><div class="log-head"><h3>전투 로그</h3><div class="chips">${cats.map(([k, n]) => `<button class="chip on" data-act="logFilter" data-cat="${k}">${n}</button>`).join('')}</div></div><div class="log" id="log"></div></aside></section>`;
  };
  const after = {};
  let liveBattle = null;
  /* ---------- 경기 중 지휘 패널 ---------- */
  let cmdTab = 'team', cmdPick = null, cmdSig = '';
  const myUnits = b => b.units.filter(x => x.team === Game.match.pIdx && !x.struct).sort((p, q) => (Number(p.id.split('-')[1]) || 0) - (Number(q.id.split('-')[1]) || 0));
  const roleIcon = f => (CONFIG.roles[f.role] || {}).icon || '';
  function cmdBody(b) {
    const O = CONFIG.orders, M = Game.match, us = myUnits(b), me = us[cmdTab], btn = (cmd, id, label, desc) => `<button class="cmd-btn" data-cmd="${cmd}" data-id="${id}" title="${desc || ''}">${label}${desc ? `<small>${desc}</small>` : ''}</button>`;
    const tabs = `<button class="chip ${cmdTab === 'team' ? 'on' : ''}" data-cmd="tab:team">팀</button>` + us.map((x, i) => `<button class="chip ${cmdTab === i ? 'on' : ''}${x.alive ? '' : ' dead'}" data-cmd="tab:${i}">${roleIcon(x.f)} ${x.f.name}</button>`).join('');
    let grid;
    if (cmdTab === 'team') grid = O.team.map(o => btn('team:' + o.id, o.id, `${o.icon} ${o.name}`, o.desc)).join('');
    else if (!me || !me.alive) grid = '<p class="cmd-hint">쓰러진 선수에게는 지시할 수 없습니다.</p>';
    else if (cmdPick) {
      const list = cmdPick.target === 'ally' ? us.filter(x => x !== me && x.alive) : b.units.filter(x => x.team === 1 - M.pIdx && !x.struct && x.alive);
      grid = `<p class="cmd-hint">${cmdPick.name} 대상을 고르세요</p>` + list.map(x => `<button class="cmd-btn" data-cmd="pick:${x.id}">${roleIcon(x.f)} ${x.f.name}</button>`).join('') + '<button class="cmd-btn" data-cmd="pick:">취소</button>';
    } else grid = O.unit.map(o => btn('unit:' + o.id, o.id, `${o.icon} ${o.name}`, o.desc)).join('');
    return `<div class="cmd-tabs">${tabs}</div><div class="cmd-grid">${grid}</div>`;
  }
  function syncCmd(b) {
    const box = $('#cmdBody'); if (!box || !Game.match || !b.cp) return;
    const O = CONFIG.orders, M = Game.match, p = M.pIdx, us = myUnits(b), cp = b.cp[p], sig = [cmdTab, cmdPick && cmdPick.id, us.map(x => (x.alive ? 1 : 0)).join('')].join('|');
    if (sig !== cmdSig) { cmdSig = sig; box.innerHTML = cmdBody(b); }
    const ms = CONFIG.battle.tickMs, sec = t => Math.max(0, Math.ceil(t * ms / 1000));
    $('#cmdCp').innerHTML = Array.from({ length: O.cpMax }, (_, i) => `<i class="cmd-pip${i < cp.v ? ' on' : ''}"></i>`).join('') + (cp.v < O.cpMax ? `<small>다음 +1 · ${sec(O.regenSec * 1000 / ms - cp.prog)}초</small>` : '');
    const to = b.ord[p], me = us[cmdTab], uo = me && me.ord, act = o => o && b.t < o.until ? o : null, nm = (list, o) => (list.find(d => d.id === o.id) || {}).name || o.id;
    const lines = [act(to) && `${nm(O.team, to)} ${b.t < to.applyAt ? '전달 중' : sec(to.until - b.t) + '초'}`, act(uo) && `${me.f.name}: ${nm(O.unit, uo)} ${b.t < uo.applyAt ? '전달 중' : sec(uo.until - b.t) + '초'}`].filter(Boolean);
    $('#cmdAuto').textContent = '자동 지휘: ' + (b.autoCmd[p] ? '켜짐' : '꺼짐');
    $('#cmdNow').textContent = lines.length ? lines.join(' · ') : '자동 (설정한 전술)';
    box.querySelectorAll('.cmd-btn[data-id]').forEach(x => {
      const cur = cmdTab === 'team' ? act(to) : act(uo), def = (cmdTab === 'team' ? O.team : O.unit).find(d => d.id === x.dataset.id);
      x.disabled = !def || cp.v < def.cost; x.classList.toggle('on', !!cur && cur.id === x.dataset.id);
    });
  }
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-cmd]'); if (!el || el.disabled) return;
    const M = Game.match, b = liveBattle; if (!M || !b || b.over || !Game.battleOn) return;
    const [kind, a] = el.dataset.cmd.split(':'), us = myUnits(b), me = us[cmdTab], done = r => { if (r && !r.ok) toast(r.msg, 'warn'); };
    if (kind === 'tab') { cmdTab = a === 'team' ? 'team' : Number(a); cmdPick = null; }
    else if (kind === 'team') done(b.order(M.pIdx, 'team', a));
    else if (kind === 'unit') { const def = CONFIG.orders.unit.find(o => o.id === a); if (def.target) cmdPick = def; else done(b.order(M.pIdx, 'unit', a, { uid: me.id })); }
    else if (kind === 'pick') { const def = cmdPick; cmdPick = null; if (a && def) done(b.order(M.pIdx, 'unit', def.id, { uid: me.id, target: a })); }
    else if (kind === 'auto') b.autoCmd[M.pIdx] = b.autoCmd[M.pIdx] ? null : 'normal';
    else if (kind === 'off') done(cmdTab === 'team' || !me ? b.order(M.pIdx, 'team', 'auto') : b.order(M.pIdx, 'unit', 'auto', { uid: me.id }));
    cmdSig = ''; syncCmd(b);
  });
  after.draft = () => draftUpdate();
  after.match = () => {
    const M = Game.match; if (!M) return;
    liveBattle = null; cmdTab = 'team'; cmdPick = null; cmdSig = ''; Arena.mount($('#arena'));
    Arena.prepare(M.teams, M.rule, { hud: updateHud, log: addLog, end: res => Game.onBattleEnd(res), ult: id => { const r = Arena.castUlt(id); if (!r.ok) toast(r.msg, 'warn'); } }, { manual: [0, 1].map(i => i === M.pIdx && !Game.autoUlt) });
    logOff.forEach(c => $('#log').classList.add('hide-' + c));
  };
  function updateHud(b) {
    liveBattle = b; syncCmd(b);
    const c = $('#clock'); if (c) c.textContent = b.clockText ? b.clockText() : (b.t * CONFIG.battle.tickMs / 1000).toFixed(1) + 's';
    const tc = CONFIG.ui.teamColors, ch = $('#coreHud');
    if (!ch || !b.cores) return;
    const carry = t => b.units.filter(u => u.team === t && u.alive && u.carry).reduce((q, u) => q + b.coreValue(u), 0);
    const buff = t => Math.max(0, ...b.units.filter(u => u.team === t && u.alive).flatMap(u => u.st.filter(x => x.key === 'bossbuff').map(x => x.dur)));
    const bf = [0, 1].filter(t => buff(t) > 0).map(t => `<span style="color:${tc[t]}">버프 ${Math.ceil(buff(t) / 20)}초</span>`).join(' ');
    ch.innerHTML = `제출 <span style="color:${tc[0]}">${Math.round(b.score[0])}</span> : <span style="color:${tc[1]}">${Math.round(b.score[1])}</span> · 맵 위 코어 ${b.cores.length} · 운반 <span style="color:${tc[0]}">${carry(0)}</span> / <span style="color:${tc[1]}">${carry(1)}</span>${bf ? ' · ' + bf : ''}`;
  }
  function addLog(line) {
    const box = $('#log'); if (!box) return;
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    const d = document.createElement('div'); d.className = 'log-line cat-' + line.cat; d.innerHTML = line.html; box.appendChild(d);
    while (box.children.length > 500) box.removeChild(box.firstChild);
    if (near) box.scrollTop = box.scrollHeight;
  }
  function toggleLogFilter(cat, el) {
    const off = !logOff.has(cat); off ? logOff.add(cat) : logOff.delete(cat);
    $('#log').classList.toggle('hide-' + cat, off); el.classList.toggle('on', !off);
  }
  function battleStarted() {
    $('#arenaOverlay').classList.add('hide'); $('#btnPause').disabled = false; $('#btnSkip').disabled = false; const cp = $('#cmdPanel'); if (cp) cp.classList.remove('off');
  }
  function setPauseLabel(p) { const b = $('#btnPause'); if (b) b.textContent = p ? '재개' : '일시정지'; }
  function setAutoLabel(on) { const b = $('#btnAuto'); if (b) b.textContent = '궁극기 자동: ' + (on ? '켜짐' : '꺼짐'); }
  function setSpeedUI(el) { $$('.speed').forEach(b => b.classList.toggle('on', b === el)); }

  /* ---------- 결과 / 요약 ---------- */
  let lastRes = null;
  function showResult(info) {
    lastRes = info;
    const { won, draw, res, M } = info;
    const best = Battle.pickMvp(res.units);
    const rows = res.units.map(u => `<tr class="${u === best ? 'mvp' : ''}"><td style="color:${CONFIG.ui.teamColors[u.team]}">${u.ch.name}${u === best ? ' ★' : ''}</td><td>${u.ch.icon}</td><td>${u.dmg}</td><td>${u.healed}</td><td>${u.kills}</td><td>${u.deliv || 0}회 (${u.dpts || 0}점)</td><td>${u.alive ? '생존' : '재출격 대기'}</td></tr>`).join('');
    const pct = i => Math.round(res.hp[i] * 100) + '%', dl = i => res.units.filter(u => u.team === i).reduce((q, u) => q + (u.deliv || 0), 0);
    modal(`<div class="res-head ${won ? 'win' : draw ? 'draw' : 'lose'}"><h2>${won ? '승리' : draw ? '무승부' : '패배'}</h2>
      <p>점수 ${M.teams[0].name} <b>${Math.floor(res.score[0])}</b> : <b>${Math.floor(res.score[1])}</b> ${M.teams[1].name} · ${(res.ticks * CONFIG.battle.tickMs / 1000).toFixed(1)}초${res.sudden ? ' · 서든데스 결정' : ' · 시간 종료 판정'}</p><p class="note">코어 제출 ${dl(0)}회 : ${dl(1)}회 · 보스 처치 ${(res.bossKills || [0, 0])[0]} : ${(res.bossKills || [0, 0])[1]} · 남은 체력 ${pct(0)} : ${pct(1)}</p></div>
      ${G().streak >= 2 ? `<p class="note">${G().streak}연승 중!</p>` : ''}
      ${info.fan ? `<p class="note">${info.fan.ticket ? `🎟 티켓 수입 +${Pros.money(info.fan.ticket.income)} · ` : ''}👥 ${info.fan.fans.d ? `팬 ${info.fan.fans.d > 0 ? '+' : ''}${info.fan.fans.d.toLocaleString('ko-KR')}명(${info.fan.fans.pct > 0 ? '+' : ''}${(info.fan.fans.pct * 100).toFixed(1)}%)` : '팬 변동 없음'}</p>` : ''}
      ${info.notes && info.notes.length ? `<ul class="notes">${info.notes.map(n => `<li>${n}</li>`).join('')}</ul>` : ''}
      <table class="tbl small"><thead><tr><th>파이터</th><th>타입</th><th>피해</th><th>치유</th><th>처치</th><th>코어 제출</th><th>상태</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="modal-actions">${info.analysisId ? `<button class="btn big" data-ui="resOpen" data-id="${info.analysisId}">전투 분석 보기</button>` : ''}${typeof Feedback !== 'undefined' && G().club && G().club.lineup ? '<button class="btn big" data-act="fbOpen" data-from="result">💬 선수 피드백</button>' : ''}<button class="btn primary big" data-act="resultContinue">계속</button></div>`, 'result', false);
  }
  /* 시즌 종료 스카웃 제안 영역: 제안 온 팀 또는 현재 팀 잔류만 선택 가능 */
  function scoutHTML(s) {
    const g = G(), sc = Scout.ensure(g), money = v => v.toLocaleString() + ' ' + CONFIG.club.currency;
    const curLg = League.lgOf(g), curTier = Scout.teamTier(g.leagueId, g.baseTeam), curPay = Scout.payPreview(g.leagueId, g.baseTeam);
    const stay = `<div class="sc-card stay"><div class="sc-top"><small>${curLg.short} · ${curLg.name} 리그</small><b>${g.teamName}</b><span class="sc-st">${Scout.stars(curTier)} ${Scout.TIER_LABEL[curTier - 1]}</span></div>
        <p class="sc-pay">구단주 기본 지급 <b>${money(curPay.base)}</b> <em>(×${curPay.mul})</em></p><p class="sc-note">선수단·자금 그대로 이어서 진행</p>
        <button class="btn ${sc && sc.offers.length ? '' : 'primary'} big" data-act="nextSeason">${sc && sc.offers.length ? '현재 팀 잔류' : '같은 팀으로 계속'} · 시즌 ${s.season + 1} 시작</button></div>`;
    if (!sc || !sc.offers.length) return `<div class="sc-box"><h3>📭 스카웃 제안</h3><p class="sc-lead">이번 시즌 성적과 평판으로는 제안을 보낸 구단이 없습니다. <small>(감독 평가 ${sc ? sc.merit : '-'}점 · 평판 ${sc ? sc.rep : '-'})</small></p><div class="sc-grid">${stay}</div></div>`;
    const cards = sc.offers.map(o => {
      const l = CONFIG.leagues.find(x => x.id === o.lg), chk = Club.moveCheck(g, o.lg), p = Scout.payPreview(o.lg, o.team), up = o.level > Scout.clubLevel(g.leagueId, g.baseTeam) + 2, down = o.level < Scout.clubLevel(g.leagueId, g.baseTeam) - 2;
      return `<div class="sc-card" style="--c:${l.color}"><div class="sc-top"><small>${l.short} · ${l.name} 리그 · 난이도 ${CONFIG.ai.levels[l.diff].name}</small><b>${o.team}</b><span class="sc-st">${Scout.stars(o.tier)} ${Scout.TIER_LABEL[o.tier - 1]}</span>${up ? '<span class="sc-tag up">▲ 현재보다 상위</span>' : down ? '<span class="sc-tag down">▼ 현재보다 하위</span>' : '<span class="sc-tag">● 비슷한 수준</span>'}</div>
        <p class="sc-pay">구단주 기본 지급 <b>${money(p.base)}</b> <em>(×${p.mul})</em></p><p class="sc-note">4위 기준 순위 보너스 +${money(p.rank4)} · 부임 시 자금 ${money(p.funds)}</p>
        ${chk.kind === 'up' ? `<ul class="mv-list">${chk.rows.map(r => `<li class="${r.ok ? 'ok' : 'no'}">${r.ok ? '✔' : '✖'} ${r.txt}</li>`).join('')}</ul>` : ''}
        <button class="btn ${chk.ok ? 'primary' : ''} big" data-act="acceptOffer" data-lg="${o.lg}" data-i="${o.i}" ${chk.ok ? '' : 'disabled'}>${chk.ok ? '제안 수락 · 선수 승계 선택' : '승격 조건 미달'}</button></div>`;
    }).join('');
    return `<div class="sc-box"><h3>📨 스카웃 제안 ${sc.offers.length}건 <small>감독 평가 ${sc.merit}점 · 평판 ${sc.rep} · 정규시즌 ${sc.rank}위${sc.titles && sc.titles.length ? ' · 🏆 ' + sc.titles.join(' · ') : ''}</small></h3><p class="sc-lead">제안이 온 팀 중에서만 고를 수 있습니다. 이적하면 선수 최대 3명까지 승계할 수 있고(연봉 합이 새 리그 셀러리캡 이내), 나머지는 FA로 나갑니다. 상위 리그는 한 단계씩, 성적·선수단·재정 조건을 충족해야 갈 수 있습니다.</p>
      <div class="sc-grid">${cards}${stay}</div></div>`;
  }
  function showSummary() {
    const s = G().summary; if (!s) return;
    Sound.play('win');
    modal(`<div class="res-head win"><h2>${s.year ? s.year + '년 ' : ''}시즌 ${s.season} 종료</h2><p>${G().teamName} 최종 순위 ${s.rank}위</p></div>
      <ul class="notes">${s.lines.map(l => `<li>${l}</li>`).join('')}</ul>
      ${s.growth && s.growth.length ? `<h3>📈 선수 성장 결과</h3><table class="tbl small"><thead><tr><th>선수</th><th>나이</th><th>능력</th><th>변화</th><th>잠재</th><th>등급</th></tr></thead><tbody>${s.growth.map(x => `<tr><td>${x.nick}</td><td>${x.age}</td><td>${x.from} → ${x.to}</td><td>${x.d > 0 ? '▲ +' + x.d : x.d < 0 ? '▼ ' + x.d : '-'}</td><td>${x.pot}</td><td>${x.promoted ? x.oldGrade + ' → ' + x.grade + ' 승급' : x.grade}${x.note ? ' · ' + x.note : ''}</td></tr>`).join('')}</tbody></table>` : ''}
      ${scoutHTML(s)}`, 'result scout-modal', false);
  }

  return { teamLogo, addView: (n, f) => { views[n] = f; }, onStatus: f => statusHooks.push(f), init, go, refresh, status, toast, modal, closeModal, showFighter, setCodexForm, showResult, reShowResult: () => { if (lastRes) showResult(lastRes); }, showSummary, showTeam, draftSelect, draftSelected, draftUpdate, setDraftFilter,
    toggleLegend: () => { legendOpen = !legendOpen; refresh(); }, battleStarted, setPauseLabel, setSpeedUI, setAutoLabel, toggleLogFilter,
    setTacSlot: s => { tacSlot = +s; refresh(); }, setLeagueTab: t => { leagueTab = t; refresh(); }, setSelLeague: id => openLeague(id), dc: p => { Object.assign(dcS, p); refresh(); }, selLeague: () => selLg, setRoleFilter: r => { roleFilter = r; refresh(); }, get view() { return view; } };
})();
