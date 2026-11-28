/* main.js — 게임 상태/흐름 제어 (시즌 진행, 밴픽, 저장, 이벤트 라우팅) */

const Game = {
  G: null, match: null, draft: null, battleOn: false, autoUlt: false, aiTimer: 0,

  init() {
    Sound.init(); Sound.bgm('lobby');
    this.G = this.load();
    UI.init(); if (typeof Mascot !== 'undefined') Mascot.init(); UI.go(this.G ? 'league' : 'select');
    if (this.G && this.G.phase === 'seasonEnd') UI.showSummary();
  },

  lg() { return League.lgOf(this.G); },
  isTour(k) { return k === 'msi' || k === 'playoff' || k === 'worlds'; },
  tourName(k) { return k === 'playoff' ? CONFIG.league.playoffName : CONFIG.league.intl[k].name; },

  /* 새 커리어: 리그와 팀을 고릅니다. 트로피·전술·전적은 이어받습니다 */
  startCareer(leagueId, teamName, carryIds) {
    const prev = this.G, lg = CONFIG.leagues.find(l => l.id === leagueId);
    const G = { v: 4, leagueId, baseTeam: teamName, teamName, season: (prev && prev.phase === 'seasonEnd') ? (prev.season || 0) + 1 : 1, streak: 0, bestStreak: 0, totals: { games: 0, wins: 0 },
      seasonLines: [], usage: {}, slotTactics: Draft.neutralSlots(), slotRole: ['auto', 'auto', 'auto'], slotPreset: null, strategy: Draft.neutralStrategy(), difficulty: lg.diff, trophies: [], stats: Stats.blank() };
    if (prev) {
      G.trophies = prev.trophies || [];
      G.slotTactics = prev.slotTactics || Draft.neutralSlots(); G.slotRole = prev.slotRole || ['auto', 'auto', 'auto']; G.slotPreset = prev.slotPreset || null;
      G.strategy = prev.strategy; G.usage = prev.usage; G.totals = prev.totals; G.bestStreak = prev.bestStreak; G.stats = prev.stats; G.mine = prev.mine; G.mgr = prev.mgr;
    }
    G.news = prev && prev.news ? prev.news : []; G.rep = (prev && prev.rep) || { v: 50, peak: 50, last: 0 }; this.G = G;
    let initOpts = {};
    if (prev && prev.club && carryIds && prev.phase === 'seasonEnd') {
      const plan = Club.carryPlan(prev, leagueId, carryIds), pick = new Set(plan.picks);
      initOpts = { carry: plan.picks.map(id => Pros.get(prev, id)), pool: prev.club.roster.filter(id => !pick.has(id)).map(id => Pros.get(prev, id)).filter(Boolean), carryFee: plan.fee, keepFunds: plan.keep };
    } else if (prev && prev.club && prev.phase === 'seasonEnd') {
      const plan = Club.carryPlan(prev, leagueId, []);
      initOpts = { pool: prev.club.roster.map(id => Pros.get(prev, id)).filter(Boolean), keepFunds: plan.keep };
    }
    if (prev && prev.club) initOpts.moved = true;
    Club.init(G, initOpts);
    if (prev && prev.club && prev.club.facilities && Object.keys(prev.club.facilities).length) {      // 리그 이동 시 시설 레벨 유지
      G.club.facilities = { ...prev.club.facilities };
      const bs = Facility.base(G), b0 = { form: 55, mental: 70, ...CONFIG.facility.base }, df = bs.form - b0.form, dm = bs.mental - b0.mental;
      if (df || dm) (G.club.roster || []).forEach(id => { const p = Pros.get(G, id); if (p && !p.fxb) { p.form = Math.max(0, Math.min(100, (p.form ?? 55) + df)); p.mental = Math.max(0, Math.min(100, (p.mental ?? 70) + dm)); p.fxb = 1; } });
    }
    if (prev && prev.club) {      // 리그 이동 시 도전과제 수령 기록·구단주 목표 달성 수 유지
      ['ch', 'chSeen'].forEach(k => { if (prev.club[k]) G.club[k] = { ...prev.club[k] }; });
      if (prev.club.goalWins) G.club.goalWins = prev.club.goalWins;
    }
    League.newSeason(G); News.seasonStart(G, League.when(G)); this.match = null; this.draft = null; this.battleOn = false; clearTimeout(this.aiTimer);
    this.save(); UI.closeModal(); UI.go('league'); UI.toast(`${lg.name} 리그 · ${teamName} 감독으로 부임했습니다.`, 'good');
  },
  save() { try { localStorage.setItem(CONFIG.game.saveKey, JSON.stringify(this.G)); } catch (e) { /* 저장 불가 환경은 무시 */ } },
  load() {
    try {
      const s = JSON.parse(localStorage.getItem(CONFIG.game.saveKey));
      if (!s || s.v !== 4 || !s.league || !CONFIG.leagues.some(l => l.id === s.leagueId)) return null;
      if (!Array.isArray(s.slotTactics) || s.slotTactics.length !== 3) s.slotTactics = Draft.neutralSlots();
      s.slotTactics = s.slotTactics.map((t, i) => {
        const base = t || Draft.presetSlot(i);
        CONFIG.tactics.categories.forEach(c => {
          if (!base[c.id] || !c.options.some(o => o.id === base[c.id][0])) base[c.id] = [c.neutral, 4];
        });
        return base;
      });
      const st = s.strategy = s.strategy || Draft.neutralStrategy();
      if (st.stance && !st.engage) {      // 구버전 세이브: stance/retreat → engage+zone
        const M = { slay: ['aggressive', 'press'], defend: ['careful', 'home'], collect: ['balanced', 'center'], boss: ['balanced', 'center'], balanced: ['balanced', 'center'] }, m = M[st.stance[0]] || M.balanced;
        st.engage = [m[0], 4]; st.zone = [m[1], 4];
        if (st.stance[0] === 'boss' && (!st.boss || st.boss[0] === 'smart')) st.boss = ['contest', 4];
      }
      if (st.stance) st.stance = ['balanced', 4];
      if (st.retreat) st.retreat = ['careful', 4];
      if (s.slotPreset && !Draft.strategyPresets[s.slotPreset]) s.slotPreset = null;
      CONFIG.tactics.team.forEach(c => { if (!st[c.id] || !c.options.some(o => o.id === st[c.id][0])) st[c.id] = [c.neutral, 4]; });
      Draft.normalizeStrategy(st); Draft.normalizeSlots(s.slotTactics);
      if (!Array.isArray(s.slotRole) || s.slotRole.length !== 3) s.slotRole = s.slotTactics.map(t => (CONFIG.tactics.categories.some(c => t[c.id][0] !== c.neutral) ? 'custom' : 'auto'));
      s.slotRole = s.slotRole.map(r => (r === 'auto' || r === 'custom' || CONFIG.tactics.roles.some(x => x.id === r) ? r : 'custom'));
      s.teamName = String(s.teamName || '').replace(/[<>&"'`]/g, '') || s.baseTeam; s.difficulty = League.lgOf(s).diff; s.trophies = s.trophies || []; s.ext = s.ext || {}; s.stats = s.stats || Stats.blank(); s.news = s.news || []; s.rep = s.rep || { v: 50, peak: 50, last: 0 };
      Club.migrate(s);
      if (s.phase === 'seasonEnd') Scout.ensure(s);          // 시즌 종료 상태의 세이브에 스카웃 제안이 없으면 생성
      return s;
    } catch (e) { return null; }
  },

  /* ---------- 표시용 정보 ---------- */
  phaseLabel() {
    const g = this.G, lg = this.lg();
    const d = League.fmtDate(League.when(g), true);
    if (g.phase === 'season') return `${d} · ${League.stage(g)} ${g.league.round}/${g.league.schedule.length}`;
    if (this.isTour(g.phase)) return `${d} · ${this.tourName(g.phase)}`;
    return `${d} · 시즌 종료`;
  },
  hero() {
    const g = this.G;
    if (g.phase === 'season') {
      const total = g.league.schedule.length, r = g.league.round, mid = CONFIG.league.midRound;
      return { sub: `${this.lg().name} 리그 · ${League.stage(g)} · 현재 ${League.rankOf(g, 'player')}위${r < mid ? ` · ${mid}라운드 후 MSI` : ''}`, title: `${r + 1}라운드 / ${total}`, pct: r / total * 100, label: '밴픽 시작' };
    }
    if (g.phase === 'seasonEnd') return { sub: '시즌 종료', title: `시즌 ${g.season} 마무리`, pct: 100, label: '시즌 종료' };
    const t = g[g.phase], total = Math.log2(t.rounds[0].length * 2);
    return { sub: t.name, title: League.roundName(t, t.roundIdx), pct: t.roundIdx / total * 100, label: '밴픽 시작' };
  },
  opponent() {
    const g = this.G; let m, label;
    if (g.phase === 'season') { m = League.playerMatch(g); label = `정규시즌 ${g.league.round + 1}라운드 상대`; }
    else if (this.isTour(g.phase)) { m = League.tourPlayerMatch(g[g.phase]); label = `${g[g.phase].name} 상대`; }
    if (!m) return null;
    const id = m.a === 'player' ? m.b : m.a;
    return { id, label, name: League.name(g, id), fav: League.team(g, id).fav || [], rank: League.team(g, id).lg === g.leagueId || !League.team(g, id).lg ? League.rankOf(g, id) : 0 };
  },

  /* ---------- 경기 진입: 밴픽 → 경기장 ---------- */
  openMatch() {
    const g = this.G;
    if (!Club.ready(g)) { UI.toast('프로게이머 3명을 라인업(1·2·3번)에 배치해야 경기할 수 있습니다.', 'warn'); UI.go('club'); return; }
    let kind = g.phase, m, t = null, label, rule = null;
    if (kind === 'season') { m = League.playerMatch(g); kind = 'league'; label = `정규시즌 ${g.league.round + 1}라운드`; }
    else if (this.isTour(kind)) { t = g[kind]; m = League.tourPlayerMatch(t); rule = t.rule; label = `${t.name} ${League.roundName(t, t.roundIdx)}`; }
    if (!m) return;
    label = `${League.fmtDate(League.when(g))} · ${label}${t && m.bo > 1 ? ' · ' + League.seriesLabel(m, 'player') : ''}`;
    this.match = { kind, m, t, label, rule, pIdx: m.a === 'player' ? 0 : 1,
      teams: [m.a, m.b].map(id => ({ id, name: League.name(g, id) })) };
    this.draft = Draft.create(t ? League.fearlessOf(m) : null);
    News.preview(g, this.match, League.when(g)); this.save();
    UI.go('draft');
    this.runAi();
  },
  isPlayerTurn() { const c = this.draft && Draft.current(this.draft); return !!c && c.team === this.match.pIdx; },
  runAi() {
    clearTimeout(this.aiTimer);
    const d = this.draft; if (!d || d.done) { UI.draftUpdate(); return; }
    UI.draftUpdate();
    if (this.isPlayerTurn()) return;
    this.aiTimer = setTimeout(() => {
      const c = Draft.current(d); if (!c || c.team === this.match.pIdx || this.draft !== d) return;
      const tid = this.match.teams[c.team].id, tm = League.team(this.G, tid);
      Draft.apply(d, Draft.aiChoose(d, c.team, tm, this.G.usage, { G: this.G, opp: League.team(this.G, this.match.teams[1 - c.team].id) })); Sound.play('click');
      this.runAi();
    }, CONFIG.draft.aiDelayMs);
  },
  finishDraft() {
    const M = this.match, d = this.draft, g = this.G; if (!d || !d.done) return;
    M.picks = d.picks; M.bans = d.bans; News.draft(g, M, League.when(g));
    M.picks[M.pIdx].forEach(f => { g.usage[f] = (g.usage[f] || 0) + 1; });
    M.teams.forEach((tm, i) => {
      const isMe = tm.id === 'player';
      tm.fighters = d.picks[i]; tm.brains = League.brainsOf(g, tm.id); tm.moods = League.moodsOf(g, tm.id);
      if (isMe) { tm.tactics = Draft.slotsFor(g, tm.fighters); tm.strategy = Draft.normalizeStrategy(g.strategy); tm.moods = Feedback.attach(g, tm.moods); }
      else { const ai = Draft.aiTeam(League.team(g, tm.id).level || g.difficulty, tm.fighters, d.picks[1 - i]); tm.tactics = ai.tactics; tm.strategy = ai.strategy; tm.cmd = League.team(g, tm.id).level || g.difficulty; }
    });
    this.save(); UI.go('match');
  },

  onBattleEnd(res) {
    this.battleOn = false; Sound.bgm(null);
    const info = this.finishMatch(res);
    UI.status(); UI.showResult(info); Sound.result(info);
  },

  finishMatch(res) {
    const g = this.G, M = this.match, notes = [];
    M.finished = true;                       // 끝난 경기는 다시 시작/재처리되지 않도록 표시
    const when = League.when(g);             // 경기 날짜(상태가 바뀌기 전에 기록)
    Stats.record(g, { ids: [M.m.a, M.m.b], picks: M.picks, bans: M.bans, winner: res.winner, tac: res.tac, ord: res.rec && res.rec.orders, int: res.rec && res.rec.intents });      // 데이터 센터 집계
    MyData.record(g, M, res);
    Report.record(g, M, res);
    const opp0 = this.opponent(), myRank0 = League.rankOf(g, 'player'), oppRank0 = opp0 ? opp0.rank : 0;      // 순위 반영 전(경기 직전) 기준
    let won, draw = false, tag;
    if (M.kind === 'league') {
      tag = `${g.league.round + 1}R`;
      won = res.winner === M.pIdx; draw = res.winner === -1;
      League.completeRound(g, M.m, res);
    } else {
      tag = League.roundName(M.t, M.t.roundIdx);
      won = League.tourResolve(M.t, M.m, res, M.picks) === M.pIdx;
    }
    if (won) { g.streak++; g.bestStreak = Math.max(g.bestStreak, g.streak); } else g.streak = 0;
    g.totals.games++; if (won) g.totals.wins++;
    Club.trackGame(g, won);
    Feedback.afterMatch(g, res, M, notes);
    const fan = Club.afterMatch(g, { kind: M.kind, home: M.kind !== 'league' || M.m.a === 'player', won: res.winner === M.pIdx, draw: res.winner === -1, myRank: myRank0, oppRank: oppRank0 });
    if (fan.winPay) notes.push(`💰 승리 수당 +${Pros.money(fan.winPay)}`);
    Club.checkChallenges(g).forEach(c => notes.push(`🏅 도전과제 달성: ${c.name} — 구단 관리에서 보상 수령`));
    const oppId = M.m.a === 'player' ? M.m.b : M.m.a;
    g.league.playerLog.push({ tag: M.kind === 'league' ? tag : ({ playoff: 'PO ', msi: 'MSI ', worlds: 'WC ' }[M.kind] || '') + tag, opp: League.name(g, oppId), won, draw, picks: M.picks[M.pIdx] });

    News.result(g, { won, draw, res, M }, when);
    const an = News.analysis(g, { won, draw, res, M }, when);
    if (M.kind === 'league') {
      News.afterRound(g, when); if (Math.random() < 0.6) News.gossip(g, when);
      const offer = Club.trySponsor(g);
      if (offer) notes.push(`📣 ${offer.brand} ${offer.tier} 제안 (+${Pros.money(offer.amount)}) — 구단 관리에서 수락/거절`);
      if (g.league.round % CONFIG.pro.market.refreshRounds === 0 && g.league.round < g.league.schedule.length) Market.refresh(g);
      if (g.league.round >= g.league.schedule.length) this.startPlayoff(notes);
      else if (g.league.round === CONFIG.league.midRound) { News.halfEnd(g, when); this.startMsi(notes); }
    } else {
      const t = M.t;
      const ri = t.roundIdx, done = M.m.winner != null; League.tourSimCurrent(g, t); League.tourAdvance(t); if (done) News.tourRound(g, t, ri, M, when);
      if (done && !t.champion && M.m.winner !== 'player') League.tourSimAll(g, t);
      if (done && M.m.winner !== 'player') notes.push(`${t.name} 탈락 — 남은 경기는 자동으로 진행되었습니다.`);
      if (t.champion) this.finishTour(M.kind, notes);
    }
    this.save();
    return { won, draw, res, M, notes, analysisId: an ? an.id : null, fan };
  },

  /* ---------- MSI / 플레이오프 / 월드 챔피언십 / 시즌 종료 ---------- */
  pickRule() { const r = CONFIG.league.cupRules; return r.length ? r[Math.floor(Math.random() * r.length)] : null; },
  startIntl(kind, notes) {
    const g = this.G, rule = this.pickRule(), t = League.createTour(kind, CONFIG.league.intl[kind].name, League.intlField(g), rule);
    g[kind] = t; g.phase = kind; News.tourStart(g, kind, t, League.when(g));
    if (!t.seeds.includes('player')) {
      League.tourSimAll(g, t); g.seasonLines.push(`${t.name} 진출 실패`); notes.push(`${t.name} 진출에 실패했습니다. (리그 상위 ${CONFIG.league.intlTeams}팀 진출)`);
      this.finishTour(kind, notes);
    } else { League.tourStart(g, t); notes.push(`${t.name} 진출! 개막${rule ? ` — 특수 규칙: ${rule.name}` : ''}`); }
  },
  startMsi(notes) { this.startIntl('msi', notes); },
  startWorlds(notes) { this.startIntl('worlds', notes); },
  startPlayoff(notes) {
    const g = this.G, ids = League.sorted(g).slice(0, CONFIG.league.playoffTeams).map(t => t.id);
    g.playoff = League.createTour('playoff', CONFIG.league.playoffName, ids, null);
    g.phase = 'playoff'; News.tourStart(g, 'playoff', g.playoff, League.when(g));
    if (!g.playoff.seeds.includes('player')) {
      League.tourSimAll(g, g.playoff);
      g.seasonLines.push(`${CONFIG.league.playoffName} 진출 실패`); notes.push(`${CONFIG.league.playoffName} 진출에 실패했습니다.`);
      this.finishTour('playoff', notes);
    } else notes.push(`${CONFIG.league.playoffName} 진출! 상위 시드 순으로 대진이 짜였습니다.`);
  },
  tourText(t) {
    if (t.champion === 'player') return '우승';
    for (let i = t.rounds.length - 1; i >= 0; i--) if (t.rounds[i].some(m => m.a === 'player' || m.b === 'player')) return `${League.roundName(t, i)} 탈락`;
    return '진출 실패';
  },
  award(kind) {
    const g = this.G, key = kind === 'playoff' ? 'league' : kind, T = CONFIG.trophies[key];
    g.trophies.push({ k: key, lg: g.leagueId, season: g.season, team: g.teamName });
    Club.checkChallenges(g).forEach(c => UI.toast(`🏅 도전과제 달성: ${c.name} — 구단 관리에서 보상 수령`, 'good'));
    UI.toast(`${T.icon} ${this.lg().name} ${T.name} 트로피 획득!`, 'good'); Sound.play('win');
  },
  finishTour(kind, notes) {
    const g = this.G, t = g[kind]; News.tourEnd(g, kind, League.when(g));
    if (t.seeds.includes('player')) g.seasonLines.push(`${t.name}: ${this.tourText(t)}`);
    if (t.champion === 'player') {
      notes.push(`${t.name} 우승!`); this.award(kind); notes.push(`💰 우승 상금 +${Pros.money(Club.champPay(g, kind))}`);
      const ft = Club.fanTitle(g, kind === 'playoff' ? 'league' : kind); notes.push(`👥 우승 효과로 팬 ${ft.d >= 0 ? '+' : ''}${ft.d.toLocaleString('ko-KR')}명 (${(ft.pct * 100).toFixed(1)}%)`);
    }
    else if (t.champion) notes.push(`${t.name} 우승: ${League.name(g, t.champion)}`);
    if (kind === 'msi') g.phase = 'season';                              // MSI 가 끝나면 정규시즌 후반부로 복귀
    else if (kind === 'playoff') this.startWorlds(notes);
    else this.endSeason(notes);
  },
  endSeason(notes) {
    const g = this.G, rank = League.rankOf(g, 'player');
    g.summary = { season: g.season, year: League.yearOf(g), rank, lines: [`${this.lg().name} 리그 정규시즌 ${rank}위`, ...g.seasonLines] };
    g.summary.lines.push(...Club.settle(g)); g.summary.lines.push(...Club.promoLines(g)); g.summary.growth = (g.club.finance && g.club.finance.growth) || [];
    g.phase = 'seasonEnd'; notes.push('시즌이 종료되었습니다.'); News.seasonEnd(g, League.when(g));
    const sc = Scout.generate(g);                                          // 평판·성적 반영(시즌 종료 평판 변동 이후)
    g.summary.lines.push(sc.offers.length ? `📨 스카웃 제안 ${sc.offers.length}건 도착 (감독 평가 ${sc.merit}점)` : `📭 스카웃 제안 없음 (감독 평가 ${sc.merit}점) — 현재 팀 잔류`);
  },
  /* 스카웃 제안 수락: 제안 온 팀으로만 이적 가능 (Scout.allowed 로 한 번 더 검사) */
  takeOffer(leagueId, teamName, carryIds) {
    if (!Scout.allowed(this.G, leagueId, teamName)) return false;
    if (this.G && this.G.phase === 'seasonEnd' && !Club.moveCheck(this.G, leagueId).ok) { UI.toast('승격 조건을 충족하지 못했습니다.', 'warn'); return false; }
    this.startCareer(leagueId, teamName, carryIds); return true;
  },
  /* 이동 시작: 첫 커리어는 시작 가능 리그만, 이후에는 승격 조건 확인 → 선수 승계 화면 */
  beginMove(leagueId, teamName) {
    const g = this.G, lg = CONFIG.leagues.find(l => l.id === leagueId);
    if (!g) { if (!Club.startAllowed(leagueId)) { UI.toast('처음에는 입문 리그(' + CONFIG.club.startLeagues.map(id => CONFIG.leagues.find(l => l.id === id).short).join('·') + ')에서만 시작할 수 있습니다.', 'warn'); return; } this.takeOffer(leagueId, teamName); return; }
    if (!Scout.allowed(g, leagueId, teamName)) { UI.toast('스카웃 제안이 온 팀(또는 현재 팀)만 선택할 수 있습니다.', 'warn'); return; }
    const chk = Club.moveCheck(g, leagueId);
    if (!chk.ok) { ProUI.moveBlocked(lg, teamName, chk); return; }
    this.carry = { lg: leagueId, team: teamName, sel: new Set(Club.carryDefault(g, leagueId)) };
    ProUI.carry();
  },
  /* ---------- 시즌 건너뛰기: 남은 경기를 모두 치르며(밴픽 자동) 진행 게이지 표시 ---------- */
  autoProgress() {
    const g = this.G, R = g.league.schedule.length, T = 3; let done = g.league.round;
    ['msi', 'playoff', 'worlds'].forEach(k => {
      const t = g[k]; if (!t) return;
      done += t.champion ? T : (g.phase === k ? T * t.roundIdx / Math.log2(t.rounds[0].length * 2) : 0);
    });
    return Math.min(100, done / (R + 3 * T) * 100);
  },
  /* 건너뛰기 밴픽(내 팀): AI 와 같은 역할 균형 규칙 + 상대 조합 대응 + 내 경기 기록 반영.
     픽: 선발 선호 캐릭터 가산(skipTune.fav) × 내 기록 승률 보정 × 상대 픽에 대한 누적 상성 × 역할 균형·카운터 규칙
     밴: 내 선발 선호는 피하고, 상대 선호 캐릭터 + 내 조합에 상성이 좋은(강한) 파이터를 우선 금지
     수치는 skipTune 표만 고치면 됩니다. 내 팀 자동 밴픽에만 적용됩니다. */
  skipTune: { fav: 2, favAny: 1.4, minGames: 3, prior: 4, recent: 80, wrK: 1.8, wrMin: 0.5, wrMax: 1.15, vsMin: 2, vsK: 1.6, vsLo: 0.45, vsHi: 1.4, banK: 1.2, banLo: 0.7, banHi: 1.8, oppBack: 1.9, antiAssn: 1.25 },
  skipRecord(g) {                                          // 내 최근 경기(G.report)에서 파이터별 [판수, 승수] — 빠른 진행은 0.5 비중
    const T = this.skipTune, rows = ((g.report && g.report.rows) || []).slice(-T.recent), rec = {};
    rows.forEach(r => { const wt = r.fast ? 0.5 : 1; (r.me || []).forEach(id => { const e = rec[id] = rec[id] || [0, 0]; e[0] += wt; e[1] += wt * r.w; }); });
    return rec;
  },
  skipRate(rec, id) {                                      // 내 기록 승률 배수: 표본이 적으면 1, 승률이 낮으면 최대 ×wrMin 까지 감소
    const T = this.skipTune, e = rec[id]; if (!e || e[0] < T.minGames) return 1;
    const wr = (e[1] + T.prior / 2) / (e[0] + T.prior);
    return Math.min(T.wrMax, Math.max(T.wrMin, Math.exp(T.wrK * (wr - 0.5) * 2)));
  },
  skipVs(g, id, refs) {                                    // id 가 refs 를 상대로 낸 누적 승률 평균(G.stats.vs, 표본 vsMin 이상 쌍만). 자료가 없으면 null
    const T = this.skipTune, vs = (g.stats && g.stats.vs) || {}, v = [];
    refs.forEach(b => {
      const c = vs[id] && vs[id][b], r = vs[b] && vs[b][id];
      if (c && c[0] >= T.vsMin) v.push((c[1] + 1) / (c[0] + 2));
      else if (r && r[0] >= T.vsMin) v.push(1 - (r[1] + 1) / (r[0] + 2));
    });
    return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null;
  },
  skipPick(g, d, team, oppId) {
    const c = Draft.current(d), FD = id => CONFIG.fighters[id], used = new Set(Draft.taken(d)), T = this.skipTune;
    const favs = (Club.lineup(g) || []).filter(Boolean).map(p => p.favs || []), all = new Set(favs.flat());
    const avail = CONFIG.fighterOrder.filter(i => FD(i) && !FD(i).boss && !used.has(i));
    const wpick = (list, w) => { let tot = w.reduce((a, b) => a + b, 0), r = Math.random() * tot; for (let i = 0; i < list.length; i++) { r -= w[i]; if (r < 0) return list[i]; } return list[list.length - 1]; };
    if (!avail.length) return Draft.aiChoose(d, team, { fav: [...all] }, g.usage);
    const rec = this.skipRecord(g), clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    if (c.type === 'ban') {
      const oppFav = (oppId && League.team(g, oppId).fav) || [];
      const refs = (d.picks[team].length ? d.picks[team] : [...all]).slice(0, 6);        // 내가 쓸 파이터(이미 뽑았으면 그것, 아니면 선호 캐릭터)
      const w = avail.map(i => {
        if (all.has(i)) return 0.05;
        let m = (oppFav.includes(i) ? 4 : 1) + (g.usage && g.usage[i] ? g.usage[i] * 0.3 : 0);
        const thr = refs.length ? this.skipVs(g, i, refs) : null;                         // 이 파이터가 내 조합을 상대로 누적 승률이 높으면 위협
        if (thr != null) m *= clamp(Math.exp(T.banK * (thr - 0.5) * 2), T.banLo, T.banHi);
        return m;
      });
      return wpick(avail, w);
    }
    const mine = d.picks[team].map(FD), k = d.picks[team].length, oppIds = d.picks[1 - team], opp = oppIds.map(FD);
    const isBack = f => !!(f.ai && f.ai.backline), isFront = f => !!(f.ai && f.ai.front && !f.ai.backline), isTank = f => isFront(f) || f.role === 'guardian';
    const oppBack = opp.filter(isBack).length, oppAssn = opp.filter(x => x.role === 'assassin').length, hasTank = mine.some(isTank), left = 3 - k;
    const w = avail.map(i => {
      const f = FD(i); let m = (favs[k] || []).includes(i) ? T.fav : all.has(i) ? T.favAny : 1;
      m *= this.skipRate(rec, i);                                                          // 내 경기 승률이 낮은 파이터는 비중 감소
      if (oppIds.length) { const vs = this.skipVs(g, i, oppIds); if (vs != null) m *= clamp(Math.exp(T.vsK * (vs - 0.5) * 2), T.vsLo, T.vsHi); }   // 상대 픽에 상성 불리하면 감소
      if (f.role === 'mage' && mine.filter(x => x.role === 'mage').length >= 2) m *= 0.25;
      if (f.role === 'mage' && k === 0) m *= 0.5;
      if (f.role === 'guardian' && mine.filter(x => x.role === 'guardian').length >= 2) m *= 0.3;
      if (!hasTank && left === 1 && !isTank(f)) m *= 0.35;                                  // 마지막 픽까지 전열이 없으면 전열 우선
      if (oppBack >= 2 && f.role === 'assassin') m *= T.oppBack;                              // 상대 후열이 많으면 암살자
      if (oppAssn >= 1 && isTank(f)) m *= T.antiAssn;                                         // 상대 암살자가 있으면 막아주는 전열
      if (mine.filter(x => x.role === 'assassin').length >= 1 && f.role === 'assassin') m *= 0.5;
      return m;
    });
    return wpick(avail, w);
  },
  /* 건너뛰기 전술/지휘(내 팀): 직접 설정한 전략·슬롯 역할이 있으면 그대로 쓰고, 기본값(중립)이면 AI 와 같은 깊이의 자동 전술을 사용.
     자동 수준은 리그 난이도(easy/normal 리그는 hard)로, 지휘(cmd)도 같은 수준 */
  autoPlan(g, fighters, oppFighters) {
    const diff = League.lgOf(g).diff, lv = (diff === 'hard' || diff === 'master') ? diff : 'hard';
    const ap = Draft.aiTeam(lv, fighters, oppFighters);
    const stratCustom = CONFIG.tactics.team.some(c => { const s = g.strategy && g.strategy[c.id]; return s && s[0] !== c.neutral; });
    if (!stratCustom) Report.adapt(g, ap.strategy);      // 패인 분석으로 자동 전술 보정 (직접 설정한 전술은 건드리지 않음)
    const roles = g.slotRole || [], mine = Draft.slotsFor(g, fighters);
    const tactics = fighters.map((_, i) => ((roles[i] && roles[i] !== 'auto') || g.slotPreset ? mine[i] : ap.tactics[i]));
    return { lv, tactics, strategy: stratCustom ? Draft.normalizeStrategy(g.strategy) : ap.strategy };
  },
  autoMatch() {
    const g = this.G; let kind = g.phase, m, t = null, rule = null;
    if (kind === 'season') { m = League.playerMatch(g); kind = 'league'; }
    else if (this.isTour(kind)) { t = g[kind]; m = League.tourPlayerMatch(t); rule = t.rule; }
    if (!m) throw new Error('진행할 경기를 찾지 못했습니다.');
    const M = { kind, m, t, rule, label: '', pIdx: m.a === 'player' ? 0 : 1, teams: [m.a, m.b].map(id => ({ id, name: League.name(g, id) })) };
    const d = Draft.create(t ? League.fearlessOf(m) : null);
    while (!d.done) {
      const c = Draft.current(d), tid = M.teams[c.team].id;
      if (!(!this.autoReal && tid === 'player' && Draft.apply(d, this.skipPick(g, d, c.team, M.teams[1 - c.team].id)))) Draft.apply(d, Draft.aiChoose(d, c.team, League.team(g, tid), g.usage, { G: g, opp: League.team(g, M.teams[1 - c.team].id) }));
    }
    M.picks = d.picks; M.bans = d.bans; this.match = M; this.draft = d;
    M.picks[M.pIdx].forEach(f => { g.usage[f] = (g.usage[f] || 0) + 1; });
    M.teams.forEach((tm, i) => {
      tm.fighters = d.picks[i]; tm.brains = League.brainsOf(g, tm.id); tm.moods = League.moodsOf(g, tm.id);
      if (tm.id === 'player') {      // 내 팀: 실제 전투 모드에서도 autoPlan (최소 hard 전술 + 내 설정 존중 + 패인 보정)
        const pl = this.autoPlan(g, tm.fighters, d.picks[1 - i]); tm.tactics = pl.tactics; tm.strategy = pl.strategy; tm.moods = Feedback.attach(g, tm.moods);
        if (this.autoReal) { tm.cmd = pl.lv; tm.autoFull = true; } else tm.cmd = Arena.skipCmd() ? pl.lv : null;
      }
      else { const ai = Draft.aiTeam(League.team(g, tm.id).level || g.difficulty, tm.fighters, d.picks[1 - i]); tm.tactics = ai.tactics; tm.strategy = ai.strategy; tm.cmd = League.team(g, tm.id).level || g.difficulty; }
    });
    if (League.isFast()) {                                                                    // 건너뛰기: AI 경기와 같은 전력 기반 확률로 처리
      const res = League.quickResult(g, M.m.a, M.m.b, d.picks), mo = M.teams[M.pIdx].moods || [];
      res.units.forEach(u => { if (u.team === M.pIdx && mo[u.slot] && mo[u.slot].nick) u.nick = mo[u.slot].nick; });      // 선수별 기록(내 데이터)에 경기 수가 잡히도록
      this.finishMatch(res);
    } else this.finishMatch(Battle.simulate(M.teams, rule));
    this.match = null; this.draft = null;
  },
  async autoSeason() {
    const g = this.G;
    if (!g || g.phase === 'seasonEnd' || this.battleOn || this.auto) return;
    if (!Club.ready(g)) { UI.toast('프로게이머 3명을 라인업(1·2·3번)에 배치해야 합니다.', 'warn'); UI.go('club'); return; }
    if (!confirm('남은 시즌 경기를 모두 자동 진행합니다. (밴픽·전술 자동) 계속할까요?')) return;
    this.autoReal = confirm('실제 전투 모드로 진행할까요?\n\n[확인] 모든 경기(AI끼리 포함)를 실제 밴픽·전술·인게임 전투로 진행합니다. 오래 걸리지만 기록·통계가 정확합니다. 내 팀도 AI와 같은 로직을 씁니다.\n[취소] 빠른 진행 (AI 경기는 능력치 확률로 처리)');
    clearTimeout(this.aiTimer); this.draft = null; this.match = null;
    const ov = document.createElement('div'); ov.className = 'auto-ov';
    ov.innerHTML = '<div class="auto-box"><b>시즌 자동 진행 중…</b><div class="auto-bar"><i></i></div><span class="auto-txt"></span><button class="btn small">중단</button></div>';
    document.body.appendChild(ov);
    League.setFast(!this.autoReal);
    const bar = ov.querySelector('i'), txt = ov.querySelector('.auto-txt'), st = this.auto = { stop: false };
    ov.querySelector('button').onclick = () => { st.stop = true; };
    try {
      for (let n = 0; g.phase !== 'seasonEnd' && !st.stop && n < 600; n++) {
        this.autoMatch();
        const p = this.autoProgress(); bar.style.width = p.toFixed(1) + '%'; txt.textContent = `${League.stage(g)} · ${p.toFixed(0)}%`;
        await new Promise(r => setTimeout(r, 0));
      }
    } catch (e) { console.error(e); UI.toast('자동 진행 중 오류: ' + e.message, 'warn'); }
    League.setFast(false); ov.remove(); this.auto = null; this.autoReal = false; this.match = null; this.draft = null; this.save(); UI.status(); UI.go('league');
    if (g.phase === 'seasonEnd') { if (g.report && g.report.season === g.season && g.report.rows.length) UI.showReport(); else UI.showSummary(); }
  },
  nextSeason() {
    const g = this.G; g.season++; g.seasonLines = []; g.scout = null;
    Feedback.season(g); League.newSeason(g); News.seasonStart(g, League.when(g)); this.save(); UI.closeModal(); UI.go('league'); UI.toast(`${League.yearOf(g)}년 시즌 시작`, 'good');
  },

  /* ---------- 이벤트 라우팅 ---------- */
  act(name, el) { const f = this.actions[name]; if (f) f.call(this, el); },

  actions: {
    nav(el) {
      if (this.battleOn) { UI.toast('경기 중에는 이동할 수 없습니다.', 'warn'); return; }
      if (this.draft && !this.draft.done && UI.view === 'draft') { clearTimeout(this.aiTimer); this.draft = null; this.match = null; }
      UI.go(el.dataset.view);
    },
    advance() { if (this.G.phase === 'seasonEnd') UI.showSummary(); else this.openMatch(); },
    skipSeason() { this.autoSeason(); },
    skipCmdToggle() { Arena.setSkipCmd(!Arena.skipCmd()); const t = '건너뛰기 자동지시: ' + (Arena.skipCmd() ? '사용' : '안 함'); document.querySelectorAll('[data-act="skipCmdToggle"]').forEach(b => { b.textContent = t; }); },
    leagueTab(el) { UI.setLeagueTab(el.dataset.tab); },
    roleFilter(el) { UI.setRoleFilter(el.dataset.role); },
    closeModal() { UI.closeModal(); UI.refresh(); },
    codexOpen(el) { UI.showFighter(el.dataset.id); },
    codexForm(el) { UI.setCodexForm(el.dataset.id, el.dataset.form); },
    rename() {
      const n = prompt('팀 이름을 입력하세요', this.G.teamName);
      const clean = n ? n.replace(/[<>&"'`]/g, '').trim() : '';      // 화면에 HTML 로 들어가므로 특수문자 제거
      if (!clean) return;
      this.G.teamName = clean.slice(0, 16); this.G.league.teams[0].name = this.G.teamName; this.save(); UI.refresh();
    },

    /* 밴픽 */
    draftFilter(el) { UI.setDraftFilter(el.dataset.role); },
    draftSel(el) { if (!this.isPlayerTurn()) return; UI.draftSelect(el.dataset.id); },
    draftConfirm() {
      const id = UI.draftSelected(); if (!id || !this.isPlayerTurn()) return;
      if (Draft.apply(this.draft, id)) { UI.draftSelect(null); Sound.play('coin'); this.runAi(); }
    },
    draftDone() { this.finishDraft(); },

    startBattle() { if (!this.match || this.match.finished || this.battleOn) return; Sound.unlock(); Sound.play('battleStart'); Sound.bgm('battle'); this.battleOn = true; Arena.start(); UI.battleStarted(); },
    pause(el) { const p = !el.dataset.p; el.dataset.p = p ? '1' : ''; Arena.setPaused(p); UI.setPauseLabel(p); },
    speed(el) { Arena.setSpeed(+el.dataset.s); UI.setSpeedUI(el); },
    skipBattle() { Arena.skip(); },
    tacSlot(el) { UI.setTacSlot(+el.dataset.slot); },
    tacOpt(el) {
      const slot = +el.dataset.slot;
      const t = this.G.slotTactics[slot], c = el.dataset.cat;
      t[c] = [el.dataset.id, CONFIG.tactics.pre.level]; this.G.slotRole[slot] = 'custom'; this.save(); UI.refresh();
    },
    tacRole(el) {
      const slot = +el.dataset.slot, id = el.dataset.role; this.G.slotRole[slot] = id;
      if (id !== 'auto') this.G.slotTactics[slot] = Draft.normalizeSlots([Draft.roleTactic(id)])[0];
      this.save(); UI.refresh();
    },
    tacLv(el) {
      const slot = +el.dataset.slot;
      const t = this.G.slotTactics[slot], c = el.dataset.cat;
      t[c][1] = +el.value; const b = el.parentElement.querySelector('.val, b'); if (b) b.textContent = el.value; this.save();
    },
    tacReset(el) {
      const slot = +el.dataset.slot;
      this.G.slotRole[slot] = 'auto'; this.save(); UI.refresh();
    },
    selLeague(el) { UI.setSelLeague(el.dataset.id); },
    dcTab(el) { UI.dc({ tab: el.dataset.tab }); },
    dcRole(el) { UI.dc({ role: el.dataset.role }); },
    dcSort(el) { UI.dc({ sort: el.dataset.k }); },
    dcFighter(el) { UI.dc({ tab: 'matchup', fid: el.dataset.id }); },
    dcLeague(el) { UI.dc({ lg: el.dataset.id, team: null }); },
    dcTeam(el) { UI.dc({ team: el.dataset.n }); },
    dcReport(el) { UI.dc({ rsel: el.dataset.s }); },
    selTeam(el) {
      const lg = CONFIG.leagues.find(l => l.id === UI.selLeague()), name = lg && lg.teams[+el.dataset.i]; if (!name) return;
      const g = this.G;
      if (g && g.phase !== 'seasonEnd') { UI.toast(`${this.lg().name} 리그 시즌이 끝나야 다른 리그로 갈 수 있습니다. (${League.stage(g)} 진행 중)`, 'warn'); return; }      // 시즌 종료 전에는 리그 변경 불가
      if (g && !Scout.allowed(g, lg.id, name)) { UI.toast('스카웃 제안이 온 팀(또는 현재 팀)만 선택할 수 있습니다.', 'warn'); return; }   // 시즌 종료 후 제안 외 팀 선택 차단
      if (g && lg.id === g.leagueId && name === g.baseTeam) { this.nextSeason(); return; }
      this.beginMove(lg.id, name);
    },
    acceptOffer(el) {
      const lg = CONFIG.leagues.find(l => l.id === el.dataset.lg), name = lg && lg.teams[+el.dataset.i]; if (!name) return;
      if (!Scout.allowed(this.G, lg.id, name)) { UI.toast('스카웃 제안이 온 팀만 선택할 수 있습니다.', 'warn'); return; }
      this.beginMove(lg.id, name);
    },
    strOpt(el) { const S = this.G.strategy, c = el.dataset.cat; S[c] = [el.dataset.id, CONFIG.tactics.pre.level]; this.save(); UI.refresh(); },
    strLv(el) { const S = this.G.strategy, c = el.dataset.cat; S[c][1] = +el.value; const b = el.parentElement.querySelector('.val, b'); if (b) b.textContent = el.value; this.save(); },
    strPreset(el) { this.G.strategy = Draft.normalizeStrategy(Draft.presetStrategy(el.dataset.p)); this.save(); UI.refresh(); },
    strReset() { this.G.strategy = Draft.normalizeStrategy(Draft.neutralStrategy()); this.save(); UI.refresh(); },
    ult(el) { const r = Arena.castUlt(el.dataset.u); if (!r.ok) UI.toast(r.msg, 'warn'); },
    autoUlt() {
      this.autoUlt = !this.autoUlt; UI.setAutoLabel(this.autoUlt);
      if (Arena.battle && this.match) Arena.battle.manual[this.match.pIdx] = !this.autoUlt;
    },
    logFilter(el) { UI.toggleLogFilter(el.dataset.cat, el); },
    teamInfo(el) { UI.showTeam(el.dataset.id); },
    resultContinue() { UI.closeModal(); this.draft = null; this.match = null; if (this.G.phase === 'seasonEnd') { UI.go('league'); UI.showSummary(); } else UI.go('league'); },
    nextSeason() { this.nextSeason(); },
    toSelect() { UI.closeModal(); UI.go('select'); },
    reset() {
      if (!confirm('트로피를 포함한 모든 진행 상황이 삭제됩니다. 계속할까요?')) return;
      try { localStorage.removeItem(CONFIG.game.saveKey); } catch (e) { /* noop */ }
      clearTimeout(this.aiTimer); this.G = null; this.match = null; this.draft = null; this.battleOn = false; UI.closeModal(); UI.go('select'); UI.toast('초기화했습니다. 리그를 선택하세요.', 'info');
    }
  }
};

Object.assign(Game.actions, Club.actions, MyData.actions, Feedback.actions, Facility.actions);

window.addEventListener('DOMContentLoaded', () => Game.init());
