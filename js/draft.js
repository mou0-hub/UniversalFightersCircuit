/* draft.js — 밴픽 진행 / AI 밴픽 / AI 전술 */

const Draft = (() => {
  const ids = () => CONFIG.fighterOrder;
  const { clamp, pick } = Util;
  const wpick = (list, w) => { let tot = 0; w.forEach(x => tot += x); let r = Math.random() * tot; for (let i = 0; i < list.length; i++) { r -= w[i]; if (r < 0) return list[i]; } return list[list.length - 1]; };

  /* ---------- 상태 ---------- */
  function create(fearless) {
    const order = CONFIG.draft.order.map(t => { const [s, k] = t.split(':'); return { team: s === 'A' ? 0 : 1, type: k }; });
    return { order, step: 0, bans: [[], []], picks: [[], []], fearless: fearless ? fearless.slice() : [], done: false };
  }
  const current = d => (d.step < d.order.length ? d.order[d.step] : null);
  const taken = d => [...d.bans[0], ...d.bans[1], ...d.picks[0], ...d.picks[1], ...(d.fearless || [])];      // fearless: 같은 시리즈 앞 세트에서 나온 파이터(사용 불가)
  const banned = d => [...d.bans[0], ...d.bans[1]];
  function apply(d, id) {
    const cur = current(d); if (!cur || taken(d).includes(id) || !CONFIG.fighters[id]) return false;
    (cur.type === 'ban' ? d.bans : d.picks)[cur.team].push(id);
    d.step++; if (d.step >= d.order.length) d.done = true;
    return true;
  }

  /* ---------- AI 밴픽 ----------
     픽 점수 = 선호(내 슬롯 선수의 선호 캐릭터 · 선호 역할) × [조합 균형 × 상대 조합 카운터]^지능 × 메타(최근 승률)
     밴 점수 = 상대가 쓸 법한 캐릭터(상대 선호) × 내 조합에 대한 카운터 위협 × 메타, 내 선호는 밴하지 않음
     점수^SHARP 로 가중 추첨 → 같은 팀·같은 상대면 비슷한 조합이 반복되고(메타), 완전히 같지는 않음 */
  const TUNE = { sharp: 2.2, meta: 5, smart: { easy: 0.35, normal: 0.65, hard: 1, master: 1.25 } };
  const featCache = {};
  function feat(id) {                                  // 파이터 특징(역할·전열/후열·방어 유형·기동성 등) — 한 번만 계산
    if (featCache[id]) return featCache[id];
    const f = CONFIG.fighters[id], s = f.stats || {}, ai = f.ai || {}, st = ai.style || {}, atk = s.atk || 0, ap = s.ap || 0;
    const back = !!ai.backline, peel = !!st.peel;
    return (featCache[id] = {
      id, role: f.role, front: !!ai.front, back, peel, engage: !!st.engage, kite: ai.kite || 0,
      assn: f.role === 'assassin', tank: f.role === 'guardian',
      mobile: (s.spd || 0) >= 9 || (f.skills || []).some(k => k && k.move),
      mag: clamp(ap / (atk + ap || 1), 0, 1), def: s.def || 0, res: s.res || 0, hp: s.hp || 0,
      carry: back && !peel && (atk >= 50 || ap >= 60)
    });
  }
  /* 선수·팀 정보(슬롯별 선호 캐릭터/역할) 붙이기. G 가 있어야 합니다. 내 팀은 Club.lineup, AI 팀은 t.pros 사용 */
  function profile(G, tm) {
    if (!tm || !G || tm.slots) return tm;
    let pros = [];
    try {
      if (tm.id === 'player' && typeof Club !== 'undefined' && Club.lineup) pros = Club.lineup(G) || [];
      else pros = (tm.pros || []).map(id => Pros.get(G, id));
    } catch (e) { pros = []; }
    const slots = [0, 1, 2].map(i => (pros[i] ? { role: pros[i].role, favs: (pros[i].favs || []).filter(x => CONFIG.fighters[x]) } : null));
    const fav = [...new Set([...(tm.fav || []), ...slots.flatMap(x => (x ? x.favs : []))])];
    return Object.assign({}, tm, { slots, fav });
  }
  const levelK = tm => TUNE.smart[tm && tm.level] || 1;
  const metaK = (G, id) => { const m = G && G.draftMeta && G.draftMeta[id]; return m ? clamp(Math.exp(TUNE.meta * ((m[0] + 6) / (m[1] + 12) - 0.5)), 0.6, 1.8) : 1; };
  /* 메타 학습: 실제 전투 결과로 파이터별 승/판수를 누적(G.draftMeta, 세이브에 같이 저장) */
  function learn(G, picks, winner) {
    if (!G || !(winner === 0 || winner === 1)) return;
    const m = G.draftMeta = G.draftMeta || {};
    [0, 1].forEach(t => (picks[t] || []).forEach(id => {
      const e = m[id] = m[id] || [0, 0]; e[1]++; if (t === winner) e[0]++;
      if (e[1] > 600) { e[0] *= 0.5; e[1] *= 0.5; }        // 오래된 기록은 반감 → 메타가 조금씩 바뀜
    }));
  }
  /* 상대(또는 상대로 예상되는) 조합 요약: 이미 뽑은 캐릭터는 1, 아직 안 뽑은 슬롯은 그 선수의 선호 캐릭터를 0.45 로 가정 */
  function view(tm, picks, takenIds) {
    const it = picks.map(id => ({ f: feat(id), w: 1 }));
    for (let k = picks.length; k < 3; k++) {
      const s = tm && tm.slots && tm.slots[k]; if (!s) continue;
      const c = (s.favs || []).filter(id => !takenIds.includes(id));
      c.forEach(id => it.push({ f: feat(id), w: 0.45 / c.length }));
    }
    const n = it.reduce((a, x) => a + x.w, 0); if (n <= 0.2) return null;
    const sum = fn => it.reduce((a, x) => a + x.w * fn(x.f), 0);
    return {
      n, back: sum(f => f.back ? 1 : 0), front: sum(f => (f.front || f.tank) ? 1 : 0), assn: sum(f => f.assn ? 1 : 0),
      kite: sum(f => f.kite >= 10 ? 1 : 0), mag: sum(f => f.mag) / n, def: sum(f => f.def) / n, res: sum(f => f.res) / n
    };
  }
  /* 카운터: 후보 f 가 상대 조합 A 에 얼마나 유리한가 (1 = 보통). why 배열을 주면 유리한 이유를 담아 줌, T<1 이면 단일 캐릭터용으로 기준을 낮춤 */
  function counter(f, A, why, T) {
    if (!A) return 1;
    T = T || 1;
    const add = s => { if (why && !why.includes(s)) why.push(s); };
    let k = 1, m;
    m = 1 + 0.4 * clamp((A.def - A.res) / 10, -1, 1) * (f.mag - 0.5) * 2; k *= m;
    if (m > 1.08) add(A.def > A.res ? '상대 방어력이 높아 마법 피해가 유리' : '상대 마법저항이 높아 물리 피해가 유리');
    m = 1 + 0.3 * clamp((A.mag - 0.5) * 2, -1, 1) * clamp((f.res - f.def) / 10, -1, 1); k *= m;
    if (m > 1.06) add(A.mag > 0.5 ? '상대 마법 화력에 마법저항으로 대응' : '상대 물리 화력에 방어력으로 대응');
    if (A.back >= 1.2 * T && (f.assn || (f.mobile && !f.back))) { k *= 1 + 0.22 * Math.min(2, A.back - 0.5); add('후열을 파고들 수 있음'); }
    if (A.assn >= 0.8) { if (f.peel || f.tank) { k *= 1.25; add('상대 암살자를 막아줄 수 있음'); } if (f.back && !f.peel && f.hp < 780) k *= 0.8; }
    if (A.front >= 1.8 * T) { if (f.back && f.kite >= 10) { k *= 1.25; add('두꺼운 전열 너머로 원거리 지속 화력'); } if (f.assn) k *= 0.8; }
    if (A.kite >= 1.8 * T) { if (f.mobile || f.engage) { k *= 1.2; add('카이팅 위주 상대를 쫓는 기동·돌진'); } else if (f.tank) k *= 0.85; }
    return clamp(k, 0.55, 2.2);
  }
  /* 조합 균형: f 를 더한 내 조합이 전열·후열·화력 유형·지원/캐리 궁합이 맞는가 */
  function comp(f, mine, left) {
    const T = mine.concat(f), n = T.length, cnt = fn => T.filter(fn).length;
    const front = cnt(x => x.front || x.tank), back = cnt(x => x.back), assn = cnt(x => x.assn), mages = cnt(x => x.role === 'mage'), guards = cnt(x => x.tank);
    let k = 1;
    if (!front) k *= left === 0 ? 0.12 : left === 1 ? 0.6 : 1;           // 마지막 픽까지 전열이 없으면 전열 우선
    else if (front >= 3) k *= 0.45;
    if (back >= 3) k *= 0.3;
    if (n === 3 && !back) k *= 0.8;
    if (assn >= 3) k *= 0.2; else if (assn >= 2) k *= 0.5;
    if (mages >= 3) k *= 0.2; else if (mages >= 2) k *= 0.6;
    if (guards >= 3) k *= 0.3; else if (guards >= 2) k *= 0.5;
    if (n === 3) { const m = T.reduce((a, x) => a + x.mag, 0) / 3; k *= (m < 0.12 || m > 0.85) ? 0.8 : 1.1; }   // 물리/마법 화력이 섞이면 가산
    if (f.peel) k *= mine.some(x => x.carry) ? 1.4 : (left === 0 ? 0.6 : 0.85);                          // 지원은 지킬 캐리가 있어야
    if (f.carry && mine.some(x => x.peel)) k *= 1.25;
    if (f.engage && mine.some(x => x.back)) k *= 1.1;
    return k;
  }
  /* 선호: 이번 슬롯 선수의 선호 캐릭터 > 선호 역할 > 다른 슬롯 선수의 선호 > 그 밖 */
  function pref(f, tm, slot) {
    if (!tm) return 1;
    const me = tm.slots && tm.slots[slot], fav = tm.fav || []; let x = 1;
    if (me) {
      if ((me.favs || []).includes(f.id)) x *= 6;
      else if (me.role === f.role) x *= 1.8;
      else x *= 0.75;
      if (!(me.favs || []).includes(f.id) && tm.slots.some((s, i) => i !== slot && s && (s.favs || []).includes(f.id))) x *= 1.5;
    }
    if (fav.includes(f.id)) x *= me ? 1.3 : 3;
    return x;
  }
  /* AI 선택. ctx = { G, opp } (선택) — G 가 있으면 선수 선호·메타를, opp 가 있으면 상대 조합 카운터를 씁니다 */
  function aiChoose(d, team, tm, usage, ctx) {
    ctx = ctx || {};
    const cur = current(d), tk = taken(d), avail = ids().filter(i => !tk.includes(i));
    if (!avail.length) return undefined;
    const G = ctx.G, me = profile(G, tm), opp = profile(G, ctx.opp), smart = levelK(tm), meFav = (me && me.fav) || [];
    const myPicks = d.picks[team], opPicks = d.picks[1 - team];
    let score;
    if (cur.type === 'ban') {
      const mine = view(me, [], tk), oppSlots = (opp && opp.slots) || [], oppFav = (opp && opp.fav) || [];
      score = avail.map(i => {
        const f = feat(i); let likely = 1;
        if (oppSlots.some(s => s && (s.favs || []).includes(i))) likely *= 3;              // 상대 선수의 선호 캐릭터
        else if (oppSlots.some(s => s && s.role === f.role)) likely *= 1.3;
        if (oppFav.includes(i)) likely *= 1.5;
        let own = meFav.includes(i) ? 0.1 : 1;                                              // 내 선호는 밴하지 않음
        const u = usage && usage[i] ? 1 + usage[i] * 1.0 : 1;
        return likely * Math.pow(counter(f, mine), smart) * metaK(G, i) * own * u;
      });
    } else {
      const slot = myPicks.length, left = 2 - slot, mineF = myPicks.map(feat), A = view(opp, opPicks, tk);
      score = avail.map(i => {
        const f = feat(i); let k = pref(f, me, slot);
        if (!(me && me.slots)) {                                                           // 선수 정보가 없는 팀(구버전 호출): 예전 규칙
          if (f.role === 'mage' && mineF.filter(x => x.role === 'mage').length >= 2) k *= 0.25;
          if (f.tank && mineF.filter(x => x.tank).length >= 2) k *= 0.3;
          if (f.role === 'mage' && !mineF.length) k *= 0.5;
          return k * metaK(G, i);
        }
        return k * Math.pow(comp(f, mineF, left) * counter(f, A), smart) * metaK(G, i);
      });
    }
    return wpick(avail, score.map(s => Math.pow(Math.max(s, 1e-4), TUNE.sharp)));
  }
  function matchup(mine, theirs) {
    const side = (a, b) => { const A = view(null, b, []); return a.filter(id => CONFIG.fighters[id]).map(id => { const w = []; return { id, k: counter(feat(id), A, w), why: w }; }); };
    const m = side(mine, theirs), o = side(theirs, mine), gm = l => Math.exp(l.reduce((s, r) => s + Math.log(r.k), 0) / Math.max(1, l.length));
    return { mine: m, theirs: o, mk: gm(m), tk: gm(o) };
  }
  /* ---------- 분석관 (밴픽 화면 조언) ---------- */
  const fname = id => (CONFIG.fighters[id] || {}).name || id;
  function traits(f) {
    const n = [];
    if (f.assn) n.push('암살자');
    if (f.tank) n.push('탱커');
    if (f.peel) n.push('지원형'); else if (f.carry) n.push('후열 캐리'); else if (f.back) n.push('후열');
    if (f.engage && !f.assn) n.push('돌진형');
    if (f.kite >= 10) n.push('카이팅');
    n.push(f.mag > 0.65 ? '마법 피해' : f.mag < 0.35 ? '물리 피해' : '혼합 피해');
    if (f.mobile && !f.assn) n.push('기동력');
    return n.slice(0, 4);
  }
  const weakness = f => f.res + 3 < f.def ? '마법 피해에 약함' : f.def + 3 < f.res ? '물리 피해에 약함' : (f.back && f.hp < 780 ? '낮은 체력 (암살자·돌진에 취약)' : '');
  function oppTags(A) {
    const t = [A.mag > 0.65 ? '마법 위주' : A.mag < 0.35 ? '물리 위주' : '물리·마법 혼합'];
    if (A.front >= 0.9) t.push('전열 ' + Math.round(A.front));
    if (A.back >= 0.9) t.push('후열 ' + Math.round(A.back));
    if (A.assn >= 0.9) t.push('암살자');
    if (A.kite >= 0.9) t.push('카이팅');
    return t;
  }
  /* 내 시점 분석: opp = 상대 픽 상성(약점·카운터·추천), threat = 내 선수 주력 파이터를 노리는 파이터(밴 판단용) */
  function analyze(G, d, team, tm, oppTm) {
    const cur = current(d);
    if (!cur || d.done) return { say: '밴픽이 끝났어요. 내 픽 슬롯을 눌러 순서를 정리하세요.', opp: null, threat: null };
    const me = profile(G, tm), tk = taken(d), bn = banned(d), avail = ids().filter(i => !tk.includes(i));
    const myPicks = d.picks[team], opPicks = d.picks[1 - team], mineF = myPicks.map(feat);
    const rank = (S, T, mul, n, ex) => avail.filter(c => c !== ex).map(c => {
      const w = [], f = feat(c);
      return { id: c, s: counter(f, S, w, T) * (mul ? mul(f) : 1), why: w.length ? w : [mul ? '내 조합과 균형이 좋음' : '종합 상성이 유리'] };
    }).sort((a, b) => b.s - a.s).slice(0, n);
    let opp = null;
    if (opPicks.length) {
      const A = view(null, opPicks, tk), left = 2 - myPicks.length;
      opp = {
        tags: oppTags(A),
        picks: opPicks.map(id => { const f = feat(id); return { id, notes: traits(f), weak: weakness(f), counters: rank(view(null, [id], []), 0.55, null, 2, id).filter(x => x.s > 1.08) }; }),
        recs: rank(A, 1, myPicks.length < 3 ? f => comp(f, mineF, left) : null, 4).filter(x => x.s > 1.05)
      };
    }
    let threat = null;
    if (me && me.slots && d.order.slice(d.step).some(o => o.team === team && o.type === 'ban')) {
      const rows = me.slots.map((s, i) => s && s.favs.length ? {
        slot: i,
        favs: s.favs.slice(0, 3).map(id => {
          const state = bn.includes(id) ? 'banned' : myPicks.includes(id) ? 'mine' : tk.includes(id) ? 'used' : 'ok';
          return { id, state, threats: state === 'ok' ? rank(view(null, [id], []), 0.55, null, 2, id).filter(x => x.s > 1.1) : [] };
        })
      } : null).filter(Boolean);
      threat = { rows, ban: rank(view(me, myPicks, tk), 1, null, 3).filter(x => x.s > 1.05) };
    }
    const mineTurn = cur.team === team;
    let say;
    if (mineTurn && cur.type === 'ban') say = threat && threat.ban.length ? `밴 차례예요. 우리 주력에게 가장 위협적인 파이터는 "${fname(threat.ban[0].id)}"입니다 — ${threat.ban[0].why[0]}.` : '밴 차례예요. 뚜렷한 위협은 없으니 상대가 아끼는 파이터를 노려 보세요.';
    else if (mineTurn) say = opp ? `상대는 ${opp.tags.join(', ')} 조합이에요.${opp.recs.length ? ` "${fname(opp.recs[0].id)}" 어떨까요? ${opp.recs[0].why[0]}.` : ''}` : '아직 상대 픽이 없어요. 전열·후열 균형부터 맞춰 보세요.';
    else say = threat ? '상대 차례예요. 우리 주력을 노릴 수 있는 파이터를 미리 확인해 두세요.' : '상대가 고르는 중이에요.';
    return { say, opp, threat };
  }

  /* 전부 AI 인 경기를 즉시 결정 → [[ids],[ids]] (G 를 주면 선수 선호/메타까지 반영) */
  function auto(teamA, teamB, G) {
    const d = create(), tms = [teamA, teamB];
    while (!d.done) { const c = current(d); apply(d, aiChoose(d, c.team, tms[c.team], null, { G, opp: tms[1 - c.team] })); }
    return d.picks;
  }

  /* ---------- 전술 ---------- */
  const neutralTactic = () => { const o = {}; CONFIG.tactics.categories.forEach(c => o[c.id] = [c.neutral, 4]); return o; };
  function presetTactic(fid) {
    const pre = (CONFIG.fighters[fid] && CONFIG.fighters[fid].tac) || {}, o = {};
    CONFIG.tactics.categories.forEach(c => o[c.id] = [pre[c.id] ? pre[c.id][0] : c.neutral, 4]);
    return o;
  }
  function aiTactic(fid) {
    const pre = (CONFIG.fighters[fid] && CONFIG.fighters[fid].tac) || {}, o = {};
    CONFIG.tactics.categories.forEach(c => {
      const want = pre[c.id], id = want && Math.random() < 0.75 ? pick(want) : pick(c.options).id;
      o[c.id] = [id, 1 + Math.floor(Math.random() * CONFIG.tactics.maxLevel)];
    });
    return o;
  }
  const favorites = n => { const a = ids().slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };

  return { create, current, taken, banned, apply, aiChoose, auto, profile, learn, analyze, matchup, neutralTactic, presetTactic, aiTactic, favorites };
})();
