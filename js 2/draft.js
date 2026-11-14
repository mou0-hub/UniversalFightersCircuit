/* draft.js — 밴픽 진행 / AI 밴픽 / AI 전술 */

const Draft = (() => {
  const ids = () => CONFIG.fighterOrder;
  const pick = a => a[Math.floor(Math.random() * a.length)];
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

  /* ---------- AI ---------- */
  function aiChoose(d, team, tm, usage) {
    const cur = current(d), avail = ids().filter(i => !taken(d).includes(i)), fav = (tm && tm.fav) || [];
    if (cur.type === 'ban') {
      const w = avail.map(i => (fav.includes(i) ? 0.1 : 1 + (usage && usage[i] ? usage[i] * 1.5 : 0)));
      return wpick(avail, w);
    }
    const mine = d.picks[team].map(i => CONFIG.fighters[i]), mages = mine.filter(f => f.role === 'mage').length;
    const w = avail.map(i => {
      const f = CONFIG.fighters[i]; let k = fav.includes(i) ? 3 : 1;
      if (f.role === 'mage' && mages >= 2) k *= 0.25;
      if (f.role === 'guardian' && mine.filter(x => x.role === 'guardian').length >= 2) k *= 0.3;
      if (f.role === 'mage' && mine.length === 0) k *= 0.5;      // 첫 픽 마법사는 드물게
      if (f.id === 'hyer' && mine.length < 1) k *= 0.3;
      return k;
    });
    return wpick(avail, w);
  }
  /* 전부 AI 인 경기를 즉시 결정 → [[ids],[ids]] */
  function auto(teamA, teamB) {
    const d = create(), tms = [teamA, teamB];
    while (!d.done) { const c = current(d); apply(d, aiChoose(d, c.team, tms[c.team])); }
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

  return { create, current, taken, banned, apply, aiChoose, auto, neutralTactic, presetTactic, aiTactic, favorites };
})();
