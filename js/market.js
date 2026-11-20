/* market.js — FA 시장 / 이적 시장 / 영입·방출·재계약
   G.market = { fa:[선수id], round } — 이적 시장은 AI 팀 선수 중 listed 표시가 있는 선수입니다. */

const Market = (() => {
  const M = () => CONFIG.pro.market;
  const ensure = G => (G.market = G.market || { fa: [], round: -99 });
  const by = (tbl, g) => (typeof tbl === 'number' ? tbl : (tbl && tbl[g]) || 0);
  const lvOf = G => G.difficulty || 'normal';
  const faGrade = G => {
    const mix = M().faMix[lvOf(G)] || M().faMix.normal; let r = Math.random(), a = 0;
    for (const g of ['C', 'B', 'A', 'S']) { a += mix[g] || 0; if (r < a) return g; }
    return 'C';
  };
  const signFee = p => Math.round(p.salary * by(M().signMul, p.grade) / 10) * 10;
  const releaseFee = p => Math.round(p.salary * Math.max(0, p.years - 1) * M().releaseMul / 10) * 10 + Math.round(p.salary * 0.1 / 10) * 10;
  const renewFee = p => Math.round(p.salary * by(M().renewMul, p.grade) / 10) * 10;
  const listFee = p => { const f = M().feeMul[p.grade] || M().feeMul.B; return Math.round(p.salary * (f[0] + Math.random() * (f[1] - f[0])) / 10) * 10; };

  function refresh(G, full) {
    const m = ensure(G), by_ = Pros.state(G).by, maxS = (M().faMaxS || {})[lvOf(G)];
    m.fa = m.fa.filter(id => { if (!by_[id]) return false; if (full || Math.random() < 0.3) { delete by_[id]; return false; } return true; });
    const cntS = () => m.fa.filter(id => by_[id] && by_[id].grade === 'S').length;
    while (m.fa.length < M().faSize) {
      let g = faGrade(G); if (g === 'S' && maxS != null && cntS() >= maxS) g = 'A';
      const p = Pros.gen(G, g); p.years = Pros.rnd(1, 3); m.fa.push(p.id);
    }
    G.league.teams.forEach(t => (t.pros || []).forEach(id => { if (by_[id]) by_[id].listed = false; }));
    const cand = []; G.league.teams.forEach(t => { if (!t.isPlayer) (t.pros || []).forEach(id => { if (by_[id]) cand.push({ t, id }); }); });
    Pros.shuffle(cand).slice(0, M().listedSize).forEach(({ id }) => { const p = by_[id]; p.listed = true; p.fee = listFee(p); });
    m.round = G.league.round;
  }
  const listed = G => { const out = []; G.league.teams.forEach(t => { if (t.isPlayer) return; (t.pros || []).forEach(id => { const p = Pros.get(G, id); if (p && p.listed) out.push({ p, team: t }); }); }); return out; };

  function canAfford(G, cost) { return G.club.funds >= cost; }
  function rosterFull(G) { return G.club.roster.length >= CONFIG.club.maxRoster; }
  function capFail(G, add, minus, own) {
    const cap = Club.cap(G), after = Club.payroll(G) - (minus || 0) + add;
    if (after <= cap) return null;
    if (own) { const hard = Club.hardCap(G); return after <= hard ? null : `하드캡 초과입니다. (선발 연봉 합 ${Pros.money(after)} / 재계약 한도 ${Pros.money(hard)})`; }
    return `셀러리캡 초과입니다. (선발 연봉 합 ${Pros.money(after)} / 상한 ${Pros.money(cap)})`;
  }

  function signFA(G, id) {
    const p = Pros.get(G, id), m = ensure(G); if (!p || !m.fa.includes(id)) return { ok: false, msg: '이미 다른 팀과 계약한 선수입니다.' };
    if (rosterFull(G)) return { ok: false, msg: `선수단은 최대 ${CONFIG.club.maxRoster}명입니다.` };
    const fee = signFee(p); if (!canAfford(G, fee)) return { ok: false, msg: `계약금이 부족합니다. (필요 ${Pros.money(fee)})` };
    G.club.funds -= fee; m.fa = m.fa.filter(x => x !== id); p.team = 'player'; p.sg = 0; p.sw = 0; p.tn = 0; G.club.roster.push(id);
    return { ok: true, msg: `${p.nick} 영입 완료 (계약금 ${Pros.money(fee)})` };
  }
  function buyListed(G, id) {
    const p = Pros.get(G, id), t = G.league.teams.find(x => (x.pros || []).includes(id)); if (!p || !t) return { ok: false, msg: '이적 대상이 아닙니다.' };
    if (rosterFull(G)) return { ok: false, msg: `선수단은 최대 ${CONFIG.club.maxRoster}명입니다.` };
    const transfer = p.fee, fee = transfer + signFee(p); if (!canAfford(G, fee)) return { ok: false, msg: `자금이 부족합니다. (이적료+계약금 ${Pros.money(fee)})` };
    G.club.funds -= fee; t.pros = t.pros.filter(x => x !== id);
    const rep = Pros.gen(G, p.grade === 'S' ? 'A' : p.grade === 'A' ? 'B' : 'C'); t.pros.push(rep.id); rep.team = t.id;
    p.listed = false; p.fee = 0; p.team = 'player'; p.sg = 0; p.sw = 0; p.tn = 0; G.club.roster.push(id);
    return { ok: true, msg: `${p.nick} 이적 완료 (이적료 ${Pros.money(transfer)} + 계약금 ${Pros.money(signFee(p))})` };
  }
  function release(G, id) {
    const p = Pros.get(G, id); if (!p || !G.club.roster.includes(id)) return { ok: false, msg: '선수단에 없는 선수입니다.' };
    const fee = releaseFee(p); if (!canAfford(G, fee)) return { ok: false, msg: `위약금이 부족합니다. (필요 ${Pros.money(fee)})` };
    G.club.funds -= fee; G.club.roster = G.club.roster.filter(x => x !== id); G.club.lineup = G.club.lineup.map(x => (x === id ? null : x));
    p.team = null; ensure(G).fa.push(id);
    return { ok: true, msg: `${p.nick} 방출 (위약금 ${Pros.money(fee)})` };
  }
  /* 보유 선수 판매: 시장 연봉 기준 대금을 받고, 다른 AI 팀으로 이적합니다 (그 팀의 최약체는 FA로 방출) */
  const sellPrice = p => Math.round(Pros.marketSalary(p) * by(M().sellMul, p.grade) / 10) * 10;
  function sell(G, id) {
    const p = Pros.get(G, id), c = G.club; if (!p || !c.roster.includes(id)) return { ok: false, msg: '선수단에 없는 선수입니다.' };
    const min = M().sellMinRoster || 3, lim = M().sellMax || 0;
    if (c.roster.length <= min) return { ok: false, msg: `선수단이 최소 ${min}명은 있어야 판매할 수 있습니다.` };
    if (!c.sold || c.sold.season !== G.season) c.sold = { season: G.season, n: 0 };
    if (lim && c.sold.n >= lim) return { ok: false, msg: `이번 시즌 판매 한도(${lim}명)를 모두 사용했습니다.` };
    const weakest = t => t.pros.map(x => Pros.get(G, x)).filter(Boolean).reduce((m, x) => (!m || x.ovr < m.ovr ? x : m), null);
    const buyers = G.league.teams.filter(t => !t.isPlayer && t.pros && t.pros.length); if (!buyers.length) return { ok: false, msg: '선수를 받을 팀이 없습니다.' };
    const better = buyers.filter(t => { const w = weakest(t); return w && w.ovr < p.ovr; }), t = Pros.pick(better.length ? better : buyers), out = weakest(t);
    const price = sellPrice(p);
    c.funds += price; c.sold.n++; c.roster = c.roster.filter(x => x !== id); c.lineup = c.lineup.map(x => (x === id ? null : x));
    if (out) { t.pros = t.pros.filter(x => x !== out.id); out.team = null; out.listed = false; out.fee = 0; out.years = Pros.rnd(1, 2); ensure(G).fa.push(out.id); }
    t.pros.push(id); p.team = t.id; p.listed = false; p.fee = 0; p.sg = 0; p.sw = 0;
    return { ok: true, msg: `${p.nick} 판매 완료 → ${League.name(G, t.id)} (+${Pros.money(price)})` };
  }
  /* 재계약 연봉: 성장·시장가치와 무관하게 현재 연봉에서 renewRaise(2%)만 인상 */
  function renewSalary(p) { return Math.round(p.salary * (1 + M().renewRaise) / 10) * 10; }
  function renew(G, id) {
    const p = Pros.get(G, id); if (!p || !G.club.roster.includes(id)) return { ok: false, msg: '선수단에 없는 선수입니다.' };
    if (p.refused === G.season) return { ok: false, msg: `${p.nick} 선수는 이번 시즌 재계약을 거부한 상태입니다.` };
    const fee = renewFee(p), ns = renewSalary(p);
    const cf = G.club.lineup.includes(id) ? capFail(G, Club.capSal(p, ns), Club.capSal(p), true) : null; if (cf) return { ok: false, msg: `재계약 제한 — ${cf}` };
    if (!canAfford(G, fee)) return { ok: false, msg: `재계약금이 부족합니다. (필요 ${Pros.money(fee)})` };
    const mo = Club.mood(G, p), B = CONFIG.pro.morale, chance = Math.max(0, Math.min(0.95, (B.refuseBelow - mo.score) / B.refuseBelow));
    if (chance > 0 && Math.random() < chance) { p.refused = G.season; return { ok: false, msg: `${p.nick} 선수가 재계약을 거부했습니다. (${mo.why})` }; }
    G.club.funds -= fee; p.years = 2; p.salary = ns;
    const rr = Club.renewRoom(G, 0, 0);
    return { ok: true, msg: `${p.nick} 재계약 (2년, 연봉 ${Pros.money(p.salary)})${rr.over ? ` · 캡 초과분에 사치세가 부과됩니다 (현재 기준 시즌당 약 ${Pros.money(rr.tax)})` : ''}` };
  }
  return { refresh, listed, signFA, buyListed, release, sell, sellPrice, renew, signFee, releaseFee, renewFee, renewSalary, ensure };
})();
