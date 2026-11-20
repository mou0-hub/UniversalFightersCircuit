/* mascot.js — 화면 왼쪽 아래에 떠 있는 매니저 마스코트 (화면 전환과 상관없이 유지) */

const Mascot = (() => {
  const C = () => CONFIG.mascot, G = () => Game.G;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  /* 터치 반응 영역(얼굴·가슴) 위에서 쓰는 하트 커서 */
  const HEART = `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path d='M16 28S3 19.5 3 11.2C3 7 6.2 4.5 9.6 4.5c2.5 0 4.7 1.4 6.4 3.9 1.7-2.5 3.9-3.9 6.4-3.9C25.8 4.5 29 7 29 11.2 29 19.5 16 28 16 28z' fill='#ff4d8d' stroke='white' stroke-width='2' stroke-linejoin='round'/></svg>")}") 16 15`;
  const KEY = 'cl_mascot_min', POS = 'cl_mascot_pos', SIZE = 'cl_mascot_w';
  let el, pose, img, bubble, pip, hideTimer = 0, chatTimer = 0, animTimer = 0, blushTimer = 0;
  let curNo = null, lastLog = -1, lastPhase = '', recent = [];
  let faceN = 0, faceT = 0, chestN = 0, chestT = 0, drag = null, moved = false, pending = null;
  let rsz = null, defW = 264;
  let curG = null, seen = {}, lastRank = 0, lastStreak = 0, queue = [], busyUntil = 0, vSince = 0, wasHidden = true;
  const PRI = { champ: 10, runnerUp: 8, out: 8, qualify: 7, miss: 5, rankTop: 4, playoffLine: 4, streak: 4, streakBreak: 3, end: 2, win: 1, lose: 1, tie: 1 };

  const slot = () => { const h = new Date().getHours(); return h >= 5 && h < 11 ? 'morning' : h < 14 && h >= 11 ? 'noon' : h >= 14 && h < 18 ? 'afternoon' : h >= 18 && h < 23 ? 'evening' : 'night'; };

  function ctx(g) {
    const lg = g.league, log = lg.playerLog || [], last = log[log.length - 1], t = [];
    const rank = League.rankOf(g, 'player'), n = lg.teams.length, rounds = lg.schedule.length, mid = CONFIG.league.midRound;
    let opp = '';
    try { const o = Game.opponent(); if (o) opp = o.name; } catch (e) { /* 상대 정보 없음 */ }
    if (g.streak >= 6) t.push('blaze'); else if (g.streak >= 3) t.push('hot');
    if (!g.streak && last && !last.won && !last.draw) t.push('slump');
    if (g.phase === 'season') {
      if (rank <= 2) t.push('top'); else if (rank <= CONFIG.league.playoffTeams) t.push('upper'); else if (rank > n - 3) t.push('low');
      if (lg.round <= 2) t.push('early'); if (lg.round === mid) t.push('mid'); if (lg.round >= rounds - 3) t.push('late');
    } else if (g.phase === 'msi' || g.phase === 'playoff' || g.phase === 'worlds') t.push(g.phase);
    else if (g.phase === 'seasonEnd') t.push('end');
    const funds = g.club ? g.club.funds : 0;
    if (funds < C().poorFunds) t.push('poor'); else if (funds > C().richFunds) t.push('rich');
    if (g.club && !Club.ready(g)) t.push('noLineup', 'noLineup');
    if ((g.trophies || []).length) t.push('cup');
    if (g.season === 1 && g.phase === 'season' && lg.round <= 3) t.push('first');
    return { tags: t, v: { team: g.teamName, rank, streak: g.streak, funds: funds.toLocaleString(), opp, round: lg.round + 1, season: g.season, mgr: Facility.mgrLook(g).name } };
  }

  const fresh = a => { const f = a.filter(s => !recent.includes(s)), s = pick(f.length ? f : a); recent.push(s); if (recent.length > 16) recent.shift(); return s; };
  /* 매니저별 전용 대사: own = 전용 풀(없으면 null), pp = 확률적으로 전용 풀을 고르고 아니면 공통 풀 */
  const own = k => { const A = C().personaAlias || {}, p = (C().persona || {})[A[curNo] || curNo], a = p && p[k]; return a && a.length ? a : null; };
  const pp = (k, base) => { const m = own(k); return m && Math.random() < (C().personaRate == null ? .7 : C().personaRate) ? m : base; };
  const fill = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (v[k] == null || v[k] === '' ? '' : v[k]));

  function say(text, ms) {
    bubble.firstChild.textContent = text; bubble.hidden = false;
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    clearTimeout(hideTimer); hideTimer = setTimeout(() => { bubble.hidden = true; }, ms || 3400 + text.length * 70);
  }
  const sayFrom = (pool, g, ms) => { if (pool && pool.length) say(fill(fresh(pool), ctx(g).v), ms); };

  const curView = () => { const nb = document.querySelector('.nav-btn.on'); return nb ? nb.dataset.view : ''; };
  function situation(g, focus) {
    const c = ctx(g), tags = c.tags.filter(k => (C().say[k] || []).length), vp = (C().view || {})[curView()] || [], r = Math.random(), mine = own('idle');
    const tm = slot() === 'night' ? pp('night', C().time.night) : C().time[slot()];
    const pool = mine && Math.random() < (C().personaIdle == null ? .4 : C().personaIdle) ? mine
      : vp.length && r < (focus ? .7 : .4) ? vp : tags.length && r < .8 ? C().say[pick(tags)] : r < .92 ? tm : C().idle;
    say(fill(fresh(pool), c.v));
  }

  function anim(cls) {
    pose.classList.remove('happy', 'shy', 'mad'); void pose.offsetWidth; pose.classList.add(cls);
    clearTimeout(animTimer); animTimer = setTimeout(() => pose.classList.remove(cls), 760);
  }
  function fx(e, ch) {
    const r = pose.getBoundingClientRect(), i = document.createElement('i');
    i.className = 'mc-fx'; i.textContent = ch; i.style.left = (e.clientX - r.left) + 'px'; i.style.top = (e.clientY - r.top) + 'px';
    const rp = document.createElement('i'); rp.className = 'mc-ripple'; rp.style.left = i.style.left; rp.style.top = i.style.top;
    pose.appendChild(rp); pose.appendChild(i); setTimeout(() => { i.remove(); rp.remove(); }, 1000);
  }
  function blush() { el.classList.add('blush'); clearTimeout(blushTimer); blushTimer = setTimeout(() => el.classList.remove('blush'), 2200); }

  function touch(zone, e) {
    const g = G(); if (!g || !g.club) return; const now = Date.now(), v = Math.random();
    if (zone === 'face') {
      faceN = now - faceT < 5000 ? faceN + 1 : 1; faceT = now; anim('happy'); fx(e, '♥');
      if (faceN >= 4) sayFrom(pp('faceMany', C().faceMany), g); else if (v < .78) sayFrom(pp('face', C().face), g); else situation(g);
    } else if (zone === 'chest') {
      chestN = now - chestT < 5000 ? chestN + 1 : 1; chestT = now; blush();
      if (chestN >= 3) { anim('mad'); fx(e, '💢'); sayFrom(pp('chestMad', C().chestMad), g); } else { anim('shy'); fx(e, '///'); sayFrom(pp('chest', C().chest), g); }
    } else {
      anim('happy'); if (v < .3) sayFrom(pp('body', C().body), g); else situation(g, true);
    }
  }

  function applyLook(look) {
    curNo = look.no; img.src = look.src;
    const z = (C().zones || {})[look.no] || {}, f = z.face || C().zone.face, c = z.chest || C().zone.chest;
    const set = (node, a) => { node.style.setProperty('--x', a[0] + '%'); node.style.setProperty('--y', a[1] + '%'); node.style.setProperty('--w', a[2] + '%'); node.style.setProperty('--h', a[3] + '%'); };
    set(el.querySelector('[data-mz="face"]'), f); set(el.querySelector('[data-mz="chest"]'), c);
    set(el.querySelector('.mc-blush'), [f[0], f[1] + f[3] * .45, f[2], f[3] * .5]);
    el.style.setProperty('--mc-img', `url("${look.src}")`);
    el.style.setProperty('--mc-pos', `${Math.round(f[0] + f[2] / 2)}% ${Math.max(0, Math.round(f[1] - 6))}%`);
  }

  /* ---------- 성적 이벤트: 상태 변화를 감지해 쌓아두고, 마스코트가 보이는 화면으로 돌아오면 재생 ---------- */
  const push = (key, extra) => { queue.push({ key, extra: extra || {}, at: Date.now() }); };
  const rankNow = g => { try { return League.rankOf(g, 'player'); } catch (e) { return 0; } };
  const isLeagueTag = t => /^\d+R$/.test(String(t || '').trim());
  const finalHasMe = t => { const f = t.rounds[t.rounds.length - 1] || []; return f.some(m => m.a === 'player' || m.b === 'player'); };

  function track(g) {
    const tours = ['msi', 'playoff', 'worlds'];
    if (g !== curG) {                                     // 새 게임·불러오기: 현재 상태를 기준선으로만 기록 (과거 일을 다시 축하하지 않음)
      curG = g; seen = {}; lastLog = (g.league.playerLog || []).length; lastPhase = g.phase; lastStreak = g.streak || 0; lastRank = rankNow(g);
      tours.forEach(k => { if (g[k]) seen[k] = { t: g[k], over: !!g[k].champion }; });
      return;
    }
    const log = g.league.playerLog || [], n = log.length;
    if (n > lastLog) {                                    // 내 경기가 끝남
      const m = log[n - 1], k = m.won ? 'win' : m.draw ? 'tie' : 'lose';
      push(k);
      if (m.won && [3, 5, 7, 10, 15].includes(g.streak)) push('streak', { streak: g.streak });
      if (!m.won && lastStreak >= 3) push('streakBreak', { streak: lastStreak });
      if (isLeagueTag(m.tag)) {
        const rk = rankNow(g), po = CONFIG.league.playoffTeams;
        if (rk && lastRank) { if (rk === 1 && lastRank !== 1) push('rankTop', { rank: rk }); else if (rk <= po && lastRank > po) push('playoffLine', { rank: rk }); }
        if (rk) lastRank = rk;
      }
    }
    lastLog = n; lastStreak = g.streak || 0;
    tours.forEach(k => {                                  // MSI · 플레이오프 · 월즈: 진출 / 우승 / 탈락
      const t = g[k]; if (!t) return;
      let s = seen[k];
      if (!s || s.t !== t) { s = seen[k] = { t, over: false }; push(t.seeds.includes('player') ? 'qualify' : 'miss', { cup: t.name }); }
      if (t.champion && !s.over) {
        s.over = true;
        if (!t.seeds.includes('player')) return;
        push(t.champion === 'player' ? 'champ' : finalHasMe(t) ? 'runnerUp' : 'out', { cup: t.name });
      }
    });
    if (g.phase !== lastPhase) { if (g.phase === 'seasonEnd') push('end'); lastPhase = g.phase; }
  }

  function sayEvent(e) {
    const g = G(), c = ctx(g), base = (C().event || {})[e.key] || (C().say || {})[e.key] || [], mine = own(e.key);
    const pool = mine && (!base.length || Math.random() < (C().personaEvent == null ? .85 : C().personaEvent)) ? mine : base;
    if (!pool.length) return 0;
    const text = fill(fresh(pool), Object.assign({}, c.v, e.extra));
    say(text); return 3400 + text.length * 70;
  }

  function flush() {
    if (!queue.length || Date.now() < busyUntil || el.hidden || el.classList.contains('is-min') || !vSince || Date.now() - vSince < 800) return;
    queue = queue.filter(e => Date.now() - e.at < 20 * 60 * 1000);       // 너무 오래된 소식은 버림
    if (!queue.length) return;
    const top = Math.max(...queue.map(e => PRI[e.key] || 1));
    const list = queue.filter(e => top < 3 || (PRI[e.key] || 1) > 1).sort((a, b) => (PRI[b.key] || 1) - (PRI[a.key] || 1)).slice(0, 2);   // 큰 소식 우선, 최대 2개
    queue = [];
    const play = i => {
      if (el.hidden || el.classList.contains('is-min')) return;
      const ms = sayEvent(list[i]); busyUntil = Date.now() + ms + 600;
      if (i + 1 < list.length) setTimeout(() => play(i + 1), ms + 600);
    };
    play(0);
  }

  function sync() {
    const g = G();
    if (!g || !g.club || !g.league) { el.hidden = true; wasHidden = true; return; }
    const v = curView(), md = document.getElementById('modal');
    el.hidden = !!Game.battleOn || !v || v === 'match' || v === 'select' || !!(md && !md.hidden);
    if (pending && !el.hidden) { place(pending[0], pending[1]); pending = null; }
    const look = Facility.mgrLook(g); if (look.no !== curNo) applyLook(look);
    if (!el.hidden && wasHidden) vSince = Date.now();     // 마스코트가 다시 보이기 시작한 시각 (경기 후 메인 화면 복귀 등)
    wasHidden = el.hidden;
    track(g); flush();
  }

  function chatter() {
    const g = G(), [a, b] = C().chatterMs;
    if (g && g.club && g.league && !el.hidden && !el.classList.contains('is-min') && bubble.hidden) situation(g);
    chatTimer = setTimeout(chatter, a + Math.random() * (b - a));
  }

  const vis = () => (el.classList.contains('is-min') ? pip : el.querySelector('.mc-fig'));
  function place(l, t) {
    const r = el.getBoundingClientRect(), v = vis().getBoundingClientRect(), ox = v.left - r.left, oy = v.top - r.top;
    l = Math.min(Math.max(l, -ox), Math.max(-ox, window.innerWidth - v.width - ox));
    t = Math.min(Math.max(t, -oy), Math.max(-oy, window.innerHeight - v.height - oy));
    el.style.transform = 'none'; el.style.left = l + 'px'; el.style.top = t + 'px';
  }
  function fitW() { const w = parseFloat(el.style.width); if (w) setW(w); }
  function clampPos() { if (el.style.transform === 'none' && !el.hidden) { const r = el.getBoundingClientRect(); place(r.left, r.top); } }
  function down(e) {
    if ((e.button || 0) > 0 || e.target.closest('.mc-min') || e.target.closest('.mc-rs')) return;
    const r = el.getBoundingClientRect(); moved = false; drag = { x: e.clientX, y: e.clientY, l: r.left, t: r.top, on: false };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  function move(e) {
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.on) { if (Math.hypot(dx, dy) < 6) return; drag.on = true; moved = true; el.classList.add('drag'); }
    place(drag.l + dx, drag.t + dy);
  }
  function up() {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    if (drag && drag.on) { el.classList.remove('drag'); const r = el.getBoundingClientRect(); try { localStorage.setItem(POS, JSON.stringify([r.left, r.top])); } catch (e) { /* 무시 */ } }
    drag = null;
  }

  /* ---------- 크기 조절: 오른쪽 아래 핸들을 드래그하면 커지고 작아짐 (더블클릭: 원래 크기) ---------- */
  const natRatio = () => (img && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1.6);
  const maxW = () => Math.max(160, Math.min(560, window.innerWidth - 16, (window.innerHeight - 16) / natRatio()));
  function setW(w) {
    w = Math.round(Math.min(Math.max(w, 110), maxW()));
    el.style.width = w + 'px'; el.classList.add('mc-sz');
    el.style.setProperty('--mc-fs', Math.round(Math.min(18, Math.max(11, 14 * w / defW))) + 'px');
    return w;
  }
  function resetW() { el.style.width = ''; el.style.removeProperty('--mc-fs'); el.classList.remove('mc-sz'); try { localStorage.removeItem(SIZE); } catch (e) { /* 무시 */ } clampPos(); }
  function rsDown(e) {
    if ((e.button || 0) > 0) return; e.preventDefault(); e.stopPropagation();
    const r = el.getBoundingClientRect();
    if (el.style.transform !== 'none') { el.style.transform = 'none'; el.style.left = r.left + 'px'; el.style.top = r.top + 'px'; }   // 왼쪽 위를 고정한 채 늘어나도록
    rsz = { x: e.clientX, y: e.clientY, w: r.width, ratio: r.height / r.width };
    el.classList.add('drag', 'rs-on');
    window.addEventListener('pointermove', rsMove); window.addEventListener('pointerup', rsUp); window.addEventListener('pointercancel', rsUp);
  }
  function rsMove(e) {
    if (!rsz) return;
    setW(rsz.w + ((e.clientX - rsz.x) + (e.clientY - rsz.y) / rsz.ratio) / 2); clampPos();
  }
  function rsUp() {
    window.removeEventListener('pointermove', rsMove); window.removeEventListener('pointerup', rsUp); window.removeEventListener('pointercancel', rsUp);
    el.classList.remove('drag', 'rs-on'); rsz = null;
    try { const r = el.getBoundingClientRect(); localStorage.setItem(SIZE, String(Math.round(r.width))); localStorage.setItem(POS, JSON.stringify([r.left, r.top])); } catch (e) { /* 무시 */ }
  }

  function setMin(on) {
    el.classList.toggle('is-min', on); try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* 저장 불가 환경은 무시 */ }
    clampPos(); if (on) bubble.hidden = true; else { vSince = Date.now(); const g = G(); if (g && g.club && !queue.length) setTimeout(() => situation(g), 300); }
  }

  function init() {
    if (el) return;
    el = document.createElement('aside'); el.id = 'mascot'; el.className = 'mc'; el.hidden = true;
    el.innerHTML = `<div class="mc-bubble" hidden><span></span></div>
      <div class="mc-fig"><div class="mc-pose"><img class="mc-img" data-mz="body" alt="" draggable="false"><i class="mc-blush"></i><i class="mc-zone" data-mz="face"></i><i class="mc-zone" data-mz="chest"></i></div>
      <button class="mc-min" data-mc="min" title="접기">−</button>
      <button class="mc-rs" title="드래그: 크기 조절 · 더블클릭: 원래 크기"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10 2h4v4M6 14H2v-4M14 2L9.5 6.5M2 14l4.5-4.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
      <button class="mc-pip" data-mc="open" title="매니저 펼치기"></button>`;
    document.body.appendChild(el);
    const rst = document.createElement('style');
    rst.textContent = `#mascot .mc-rs { position: absolute; right: 6px; bottom: 6px; z-index: 3; display: grid; width: 28px; height: 28px; padding: 0; place-items: center; border: 1px solid rgba(255,255,255,.28); border-radius: 50%; background: rgba(10,14,32,.55); color: #fff; box-shadow: 0 4px 14px rgba(0,0,0,.35); opacity: .7; backdrop-filter: blur(8px); cursor: nwse-resize; touch-action: none; transition: opacity .15s ease, background .15s ease, transform .15s ease; }
#mascot .mc-rs:hover, #mascot.rs-on .mc-rs { background: rgba(255,126,179,.45); opacity: 1; transform: scale(1.1); }
#mascot.rs-on, #mascot.rs-on * { cursor: nwse-resize !important; }
#mascot.mc-sz .mc-bubble { font-size: var(--mc-fs); }`;
    document.head.appendChild(rst);
    defW = parseFloat(getComputedStyle(el).width) || 264;
    const rs = el.querySelector('.mc-rs');
    rs.addEventListener('pointerdown', rsDown); rs.addEventListener('dblclick', e => { e.stopPropagation(); resetW(); });
    try { const sw = Number(localStorage.getItem(SIZE)); if (sw > 0) setW(sw); } catch (e) { /* 무시 */ }
    if (C().heartCursor !== false) {
      const st = document.createElement('style');
      st.textContent = `#mascot:not(.drag) .mc-zone[data-mz="face"], #mascot:not(.drag) .mc-zone[data-mz="chest"] { cursor: ${HEART}, pointer; }`;
      document.head.appendChild(st);
    }
    pose = el.querySelector('.mc-pose'); img = el.querySelector('.mc-img'); bubble = el.querySelector('.mc-bubble'); pip = el.querySelector('.mc-pip');
    if (C().debug) el.classList.add('dbg');
    let saved = null; try { saved = localStorage.getItem(KEY); } catch (e) { /* 무시 */ }
    el.classList.toggle('is-min', saved == null ? window.innerWidth <= 900 : saved === '1');
    el.addEventListener('pointerdown', down); window.addEventListener('resize', () => { fitW(); clampPos(); });
    try { const p = JSON.parse(localStorage.getItem(POS)); if (Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)) pending = p; } catch (e) { /* 무시 */ }
    el.addEventListener('click', e => {
      if (moved) { moved = false; return; }
      const b = e.target.closest('[data-mc]');
      if (b) { setMin(b.dataset.mc === 'min'); return; }
      const z = e.target.closest('[data-mz]'); if (z) touch(z.dataset.mz, e);
    });
    img.addEventListener('error', () => { img.style.visibility = 'hidden'; });
    img.addEventListener('load', () => { img.style.visibility = ''; });
    setInterval(sync, 350); sync();
    chatTimer = setTimeout(chatter, 9000);
  }

  return { init, say, touch, event: push };
})();
