/* tactics.js — 팀 스타일 프리셋 · 슬롯 전술 · AI 팀 전술 (draft.js 다음에 로드) */
(() => {
  const T = CONFIG.tactics, FD = id => CONFIG.fighters[id];
  const neutralTactic = () => { const o = {}; T.categories.forEach(c => { o[c.id] = [c.neutral, 4]; }); return o; };
  const AXIS_NEUTRAL = { engage: 'balanced', zone: 'center', formation: 'auto', deposit: 'normal', boss: 'smart', ultT: 'normal' };
  const neutralStrategy = () => {
    const o = {};
    T.team.forEach(c => { o[c.id] = [c.neutral, 4]; });
    Object.entries(AXIS_NEUTRAL).forEach(([k, v]) => { if (!o[k]) o[k] = [v, 4]; });
    return o;
  };
  const set = (o, id, v, lv) => { o[id] = [v, lv == null ? 4 : lv]; return o; };
  const isBack = f => !!(f.ai && f.ai.backline);
  const isFront = f => !!(f.ai && f.ai.front && !f.ai.backline);
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const { pick } = Util;

  /* 개인 전술: 파이터 유형별 전투 스타일 (데이터만 고치면 반영) */
  const KIND_STYLE = {
    front:    { mission: 'free',    pos: 'front', entry: 'first',   act: 'basic',   fight: 'coop' },
    guard:    { mission: 'escort',  pos: 'front', entry: 'none',    aim: 'carry',   fight: 'support' },
    assassin: { mission: 'hunt',    entry: 'flank', aim: 'back',    act: 'rush',    fight: 'solo' },
    mid:      { mission: 'collect', aim: 'weak',   fight: 'coop' },
    back:     { mission: 'collect', pos: 'cover',  entry: 'support', aim: 'carry', act: 'retreat', fight: 'coop' }
  };
  const SLOT_KIND = ['front', 'mid', 'back'];
  const kindOf = (fid, slot) => {
    const f = fid && FD(fid);
    if (!f) return SLOT_KIND[slot | 0] || 'mid';
    if (f.role === 'assassin') return 'assassin';
    if (isBack(f)) return 'back';
    if (f.role === 'guardian') return 'guard';
    return isFront(f) ? 'front' : 'mid';
  };

  /* 팀 스타일 프리셋: set = 팀 축, mis = 유형별 주 활동 */
  const PRESETS = {
    steady: {
      name: '안정 운영', desc: '우리 진영에서 신중하게 버티며 코어를 가득 채워 제출합니다.',
      set: { engage: ['careful', 4], zone: ['home', 4], formation: ['duo', 4], deposit: ['full', 4], boss: ['smart', 4], ultT: ['save', 4] },
      mis: { front: 'escort', guard: 'escort', assassin: 'collect', mid: 'collect', back: 'collect' }
    },
    attack: {
      name: '공격 교전', desc: '적진을 압박하며 먼저 교전을 열고, 코어는 틈틈이 바로 제출합니다.',
      set: { engage: ['aggressive', 4], zone: ['press', 4], formation: ['split', 4], deposit: ['early', 4], boss: ['steal', 4], ultT: ['burst', 4] },
      mis: { front: 'hunt', guard: 'free', assassin: 'hunt', mid: 'collect', back: 'collect' }
    },
    brawl: {
      name: '한타 중심', desc: '중앙에 모여 큰 교전과 보스전에서 힘을 합쳐 싸웁니다.',
      set: { engage: ['balanced', 4], zone: ['center', 4], formation: ['group', 4], deposit: ['normal', 4], boss: ['contest', 4], ultT: ['save', 4] },
      mis: { front: 'boss', guard: 'boss', assassin: 'free', mid: 'collect', back: 'collect' }
    },
    balanced: {
      name: '유연 밸런스', desc: '한쪽으로 치우치지 않고 상황에 맞춰 고르게 움직입니다.',
      set: { engage: ['balanced', 4], zone: ['center', 4], formation: ['auto', 4], deposit: ['normal', 4], boss: ['smart', 4], ultT: ['normal', 4] },
      mis: {}
    }
  };

  function presetStrategy(name) {
    const s = neutralStrategy(), p = PRESETS[name];
    if (p) Object.entries(p.set).forEach(([k, v]) => { s[k] = v.slice(); });
    return s;
  }

  function slotFor(name, fid, slot) {
    const kind = kindOf(fid, slot), t = neutralTactic(), p = PRESETS[name];
    Object.entries(KIND_STYLE[kind]).forEach(([k, v]) => set(t, k, v, 3));
    if (p && p.mis && p.mis[kind]) set(t, 'mission', p.mis[kind], 3);
    return t;
  }
  const presetSlot = (slot, fid) => slotFor(null, fid, slot);
  const presetTactic = fid => slotFor(null, fid, 1);
  const presetSlots = (name, ids) => [0, 1, 2].map(i => slotFor(name, ids && ids[i], i));
  const autoSlots = (name, ids) => ids.map((fid, i) => slotFor(name, fid, i));
  const neutralSlots = () => [0, 1, 2].map(i => presetSlot(i));

  /* AI 팀: 같은 축 사용. 상대 조합은 보지 않고 우리 조합으로 스타일 선택 */
  function styleFor(ids) {
    const k = ids.map((id, i) => kindOf(id, i)), n = x => k.filter(y => y === x).length;
    if (n('assassin') >= 1) return 'attack';
    if (n('front') + n('guard') >= 2) return 'brawl';
    if (n('back') >= 2) return 'steady';
    return 'balanced';
  }

  function aiTeam(level, ids, opp) {
    const oppBack = (opp || []).map(FD).filter(f => f && isBack(f)).length;
    let S, tac;
    if (level === 'easy') {
      S = neutralStrategy();
      set(S, 'engage', pick(['careful', 'balanced', 'balanced', 'aggressive']), rnd(2, 5));
      set(S, 'zone', 'center'); set(S, 'formation', pick(['auto', 'group', 'split']), rnd(2, 5));
      set(S, 'deposit', 'early', rnd(2, 5)); set(S, 'boss', 'yield');
      tac = ids.map((id, i) => {
        const t = slotFor(null, id, i);
        if (Math.random() < 0.3) T.categories.forEach(c => { t[c.id] = [c.neutral, 4]; });
        return t;
      });
    } else {
      const name = level === 'normal' ? 'balanced' : styleFor(ids);
      S = presetStrategy(name); tac = autoSlots(name, ids);
      if (level === 'master') {
        set(S, 'ultT', 'save', 4);
        tac.forEach((t, i) => { if (kindOf(ids[i], i) === 'assassin' && oppBack >= 2) { set(t, 'mission', 'hunt', 4); set(t, 'aim', 'back', 4); } });
      }
    }
    return { strategy: S, tactics: tac };
  }

  /* 정도는 모두 pre.level 로 고정 */
  function normalizeStrategy(S) {
    const P = T.pre, keys = new Set([...P.team, ...Object.keys(AXIS_NEUTRAL)]);
    keys.forEach(k => { if (S[k]) S[k][1] = P.level; }); return S;
  }
  function normalizeSlots(arr) {
    const P = T.pre; arr.forEach(t => T.categories.forEach(c => { if (t[c.id]) t[c.id][1] = P.level; })); return arr;
  }

  function roleTactic(id) {
    const r = T.roles.find(x => x.id === id), t = neutralTactic();
    if (r) Object.entries(r.set).forEach(([k, v]) => set(t, k, v)); return t;
  }
  function slotsFor(G, ids) {
    const roles = G.slotRole || [], auto = autoSlots(G.slotPreset, ids);
    return normalizeSlots(ids.map((fid, i) => (roles[i] && roles[i] !== 'auto' && G.slotTactics && G.slotTactics[i] ? JSON.parse(JSON.stringify(G.slotTactics[i])) : auto[i])));
  }

  Object.assign(Draft, {
    neutralTactic, neutralStrategy, presetTactic, presetSlot, presetSlots, presetStrategy,
    aiTactic: presetTactic, aiTeam, strategyPresets: PRESETS, neutralSlots, normalizeStrategy, normalizeSlots, roleTactic, autoSlots, slotsFor
  });
})();
