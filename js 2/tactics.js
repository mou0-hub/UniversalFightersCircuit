/* tactics.js — 팀 전략 · 1/2/3픽 슬롯 전술 · AI 팀 전술
   - 개인 전술은 캐릭터가 아니라 라인업 픽 슬롯(0=1픽, 1=2픽, 2=3픽) 단위
   - AI 난이도는 파이터 개별 전투 AI가 아니라 팀이 짜는 전술 깊이만 바꿈
   - 로드 순서: draft.js 다음 (Draft 동명 함수 대체) */
(() => {
  const T = CONFIG.tactics, FD = id => CONFIG.fighters[id];
  const neutralTactic = () => { const o = {}; T.categories.forEach(c => { o[c.id] = [c.neutral, 4]; }); return o; };
  const neutralStrategy = () => { const o = {}; T.team.forEach(c => { o[c.id] = [c.neutral, 4]; }); return o; };
  const set = (o, id, v, lv) => { o[id] = [v, lv == null ? 4 : lv]; return o; };
  const isBack = f => !!(f.ai && f.ai.backline);
  const isFront = f => !!(f.ai && f.ai.front && !f.ai.backline);
  const isTank = f => !!f && (isFront(f) || f.role === 'guardian');
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function presetSlot(slot, fid) {
    const t = neutralTactic();
    const f = fid ? FD(fid) : null;
    const s = slot | 0;
    if (s === 0) {
      set(t, 'mission', 'collect', 3); set(t, 'fight', 'coop', 3);
      if (f && f.role === 'assassin') { set(t, 'mission', 'hunt', 3); set(t, 'aim', 'back', 3); }
      else if (f && f.role === 'guardian') set(t, 'fight', 'support', 3);
    } else if (s === 1) {
      set(t, 'mission', 'collect', 3); set(t, 'fight', 'coop', 3);
      if (f && f.role === 'assassin') { set(t, 'mission', 'hunt', 3); set(t, 'aim', 'weak', 3); }
      else if (f && isBack(f)) { set(t, 'pos', 'cover', 2); set(t, 'aim', 'carry', 3); }
    } else {
      set(t, 'mission', 'escort', 3); set(t, 'fight', 'support', 3);
      if (f && f.role === 'assassin') { set(t, 'mission', 'hunt', 3); set(t, 'aim', 'back', 3); }
      else { set(t, 'aim', 'carry', 3); if (!f || !isFront(f)) set(t, 'pos', 'cover', 2); }
    }
    return t;
  }

  function presetTactic(fid) {
    const f = FD(fid);
    if (!f) return neutralTactic();
    if (f.role === 'assassin' || f.role === 'guardian' || isFront(f)) return presetSlot(0, fid);
    if (isBack(f)) return presetSlot(2, fid);
    return presetSlot(1, fid);
  }

  const PRESETS = {
    balanced: {
      name: '균형', desc: '기본 기조에 가벼운 팀플레이(집결·포커스·역할 이동)를 얹습니다.',
      set: { gather: ['two', 3], hurry: ['normal', 4], focus: ['weak', 3], chain: ['follow', 3], roleMove: ['split', 3], podCycle: ['cover', 3] }
    },
    scavenger: {
      name: '분산 수집', desc: '셋이 흩어져 코어를 넓게 찾고, 가득 채워 한 번에 제출합니다.',
      set: { formation: ['split', 5], stance: ['collect', 5], deposit: ['full', 4], retreat: ['careful', 3] },
      tac: () => ({ mission: ['collect', 5] })
    },
    convoy: {
      name: '뭉쳐 운반', desc: '셋이 붙어 다니며 전열이 코어 운반자를 호위하고, 나머지는 코어를 줍습니다.',
      set: { formation: ['group', 5], deposit: ['normal', 4] },
      tac: (i, f) => ({ mission: f ? (isTank(f) ? ['escort', 3] : ['collect', 3]) : (i === 0 ? ['escort', 3] : ['collect', 3]) })
    },
    raider: {
      name: '약탈', desc: '코어를 든 적을 사냥해 빼앗고, 모이면 바로 제출합니다.',
      set: { stance: ['slay', 5], formation: ['split', 4], deposit: ['early', 4], retreat: ['brave', 3] },
      tac: (i, f) => ({ mission: f ? (f.role === 'assassin' || isFront(f) ? ['hunt', 4] : ['collect', 3]) : (i < 2 ? ['hunt', 4] : ['collect', 3]) })
    },
    sentinel: {
      name: '제출 지점 수비', desc: '우리 쪽 제출 지점을 지키고 적 운반자를 매복하며, 나머지는 코어를 줍습니다.',
      set: { stance: ['defend', 5], deposit: ['early', 4] },
      tac: (i, f) => {
        if (f) return { mission: f.role === 'assassin' ? ['ambush', 4] : isTank(f) ? ['free', 4] : ['collect', 3] };
        return { mission: i === 0 ? ['ambush', 4] : i === 1 ? ['free', 4] : ['collect', 3] };
      }
    },
    bosshunt: {
      name: '보스 사냥', desc: '중앙 보스에 힘을 모아 코어 더미와 버프를 한 번에 가져갑니다.',
      set: { stance: ['boss', 5], boss: ['contest', 5], formation: ['group', 4], ultT: ['save', 4], deposit: ['normal', 4] },
      tac: i => ({ mission: i < 2 ? ['boss', 4] : ['collect', 3] })
    }
  };

  function presetStrategy(name) {
    const s = neutralStrategy(), p = PRESETS[name];
    if (p) Object.entries(p.set).forEach(([k, v]) => { s[k] = v.slice(); });
    return s;
  }

  function presetSlots(name, ids) {
    const p = PRESETS[name];
    return [0, 1, 2].map(i => {
      const fid = ids && ids[i], t = presetSlot(i, fid);
      if (p && p.tac) Object.entries(p.tac(i, fid ? FD(fid) : null)).forEach(([k, v]) => { t[k] = v.slice(); });
      return t;
    });
  }

  function aiTeam(level, ids, opp) {
    let S = neutralStrategy();
    let tac;
    const of = (opp || []).map(FD);
    const oppBack = of.filter(isBack).length;
    const oppFront = of.filter(isTank).length;

    if (level === 'easy') {
      set(S, 'stance', 'collect', rnd(3, 5)); set(S, 'boss', 'yield'); set(S, 'react', 'fixed', 1);
      set(S, 'retreat', 'brave', rnd(5, 7)); set(S, 'formation', pick(['auto', 'group', 'split']), rnd(2, 5));
      set(S, 'deposit', 'early', rnd(2, 5));
      tac = ids.map(() => {
        const t = neutralTactic();
        if (Math.random() < 0.7) set(t, 'mission', 'collect', rnd(1, 3));
        return t;
      });
    } else if (level === 'hard') {
      set(S, 'stance', 'balanced', 4); set(S, 'boss', 'steal', 3); set(S, 'react', 'smart', 5);
      set(S, 'lead', 'turtle', 4); set(S, 'trail', 'gamble', 4); set(S, 'ultT', 'save', 3);
      set(S, 'gather', 'two', 4); set(S, 'hurry', 'normal', 4); set(S, 'focus', 'weak', 4); set(S, 'chain', 'follow', 4); set(S, 'roleMove', 'split', 4); set(S, 'podCycle', 'cover', 3);
      set(S, 'formation', 'duo', 4); set(S, 'deposit', 'normal', 4);
      tac = ids.map((id, i) => {
        const t = presetSlot(i, id), f = FD(id);
        if (f.role === 'assassin') set(t, 'mission', 'hunt', 3);
        else if (isTank(f)) set(t, 'mission', 'collect', 3);
        return t;
      });
    } else if (level === 'master') {
      set(S, 'stance', 'balanced', 5); set(S, 'boss', 'smart', 6); set(S, 'react', 'smart', 7);
      set(S, 'lead', 'turtle', 5); set(S, 'trail', 'gamble', 5); set(S, 'retreat', 'careful', 3); set(S, 'ultT', 'save', 4);
      set(S, 'early', 'collect', 4);
      set(S, 'formation', 'group', 5); set(S, 'deposit', 'normal', 5);
      set(S, 'gather', 'two', 5); set(S, 'hurry', 'normal', 5); set(S, 'chain', 'follow', 6); set(S, 'roleMove', 'split', 6); set(S, 'podCycle', 'cover', 5);
      set(S, 'focus', oppBack >= 2 ? 'back' : oppFront >= 2 ? 'threat' : 'weak', 6);
      tac = ids.map((id, i) => {
        const t = presetSlot(i, id), f = FD(id);
        if (f.role === 'assassin') { set(t, 'mission', 'hunt', oppBack >= 2 ? 6 : 3); if (oppBack >= 2) set(t, 'aim', 'back', 5); }
        else if (isTank(f)) set(t, 'mission', 'escort', 4);
        else set(t, 'mission', 'collect', 4);
        return t;
      });
    } else {
      S = presetStrategy('scavenger');
      set(S, 'stance', 'collect', 4); set(S, 'react', 'adapt', 3);
      set(S, 'gather', 'two', 2); set(S, 'focus', 'weak', 2); set(S, 'chain', 'follow', 2);
      tac = ids.map((id, i) => { const t = presetSlot(i, id); if (t.mission[0] !== 'hunt') set(t, 'mission', 'collect', 4); return t; });
    }
    return { strategy: S, tactics: tac };
  }

  function neutralSlots() { return [0, 1, 2].map(i => presetSlot(i)); }

  Object.assign(Draft, {
    neutralTactic, neutralStrategy, presetTactic, presetSlot, presetSlots, presetStrategy,
    aiTactic: presetTactic, aiTeam, strategyPresets: PRESETS, neutralSlots
  });
})();
