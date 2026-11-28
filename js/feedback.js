const Feedback = (() => {
  const CAP = 0.3, STEP = 0.4, DECAY = 0.87, SEASON = 0.35, DROP = 0.1;
  const { clamp } = Util;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = { sel: 0, from: '', text: '', pending: null, miss: [], hints: [] };

  const AX = {
    bold: { name: '교전 적극성', hi: '더 과감하게', lo: '더 조심스럽게', fx: [['brain', 'ratio', 'mul', 1], ['brain', 'retreatHp', 'mul', -0.5]] },
    chase: { name: '추격', hi: '더 끈질기게 추격', lo: '추격 줄이기', fx: [['brain', 'chaseT', 'mul', 1], ['brain', 'leash', 'mul', 1]] },
    retreat: { name: '후퇴 시점', hi: '더 일찍 후퇴', lo: '더 오래 버티기', fx: [['brain', 'retreatHp', 'mul', 1]] },
    skill: { name: '스킬 회전', hi: '스킬 빠르게', lo: '스킬 아끼기', fx: [['brain', 'skillPatience', 'mul', -1], ['brain', 'recastHold', 'mul', -0.5]] },
    ult: { name: '궁극기 속도', hi: '궁 빠르게', lo: '궁 아끼기', fx: [['brain', 'ultWait', 'mul', -1]] },
    heal: { name: '회복 장치', hi: '더 자주 이용', lo: '덜 이용', fx: [['brain', 'podRun', 'mul', 1]] },
    obj: { name: '코어·보스 의식', hi: '더 챙기기', lo: '전투 위주', fx: [['sn', 'o', 'add', 1]] },
    team: { name: '팀 합류', hi: '동료와 더 뭉치기', lo: '독립적으로', fx: [['sn', 't', 'add', 1], ['brain', 'assist', 'add', 1]] },
    finish: { name: '마무리', hi: '막타 노리기', lo: '막타 덜 노리기', fx: [['brain', 'finish', 'add', 1]] },
    aim: { name: '스킬 정확도', hi: '더 정확하게', lo: '정확도 완화', fx: [['brain', 'whiff', 'add', -1]] },
    judge: { name: '침착한 판단', hi: '더 침착하게', lo: '더 즉흥적으로', fx: [['sn', 'j', 'add', 1]] },
    react: { name: '타겟 전환', hi: '더 빠르게 전환', lo: '타겟 유지', fx: [['brain', 'retargetMul', 'mul', -1], ['sn', 'r', 'add', 1]] },
    posn: { name: '위치 선정', hi: '더 안전한 위치', lo: '더 위험한 위치', fx: [['sn', 'p', 'add', 1]] },
    clutch: { name: '위기 침착함', hi: '위기에 더 강하게', lo: '위기에 흔들리기', fx: [['brain', 'moodGuard', 'add', 1], ['sn', 'c', 'add', 1]] },
    boss: { name: '보스 타이밍', hi: '놓치지 않기', lo: '신경 덜 쓰기', bool: 'ensureBoss' },
    podwait: { name: '회복 장치 대기', hi: '리젠까지 기다리기', lo: '기다리지 않기', bool: 'waitPod' },
    mcollect: { name: '코어 수집·탐색', hi: '맵을 넓게 쓰며 수집', lo: '수집 임무 해제', tac: ['mission', 'collect', null] },
    mambush: { name: '제출 매복', hi: '제출 길목 매복', lo: '매복 해제', tac: ['mission', 'ambush', null] },
    mhunt: { name: '운반자 사냥', hi: '코어 든 적 추격', lo: '사냥 해제', tac: ['mission', 'hunt', null] },
    mboss: { name: '보스 대기', hi: '보스에 우선 합류', lo: '보스 대기 해제', tac: ['mission', 'boss', null] },
    mescort: { name: '호위', hi: '아군 옆 지키기', lo: '호위 해제', tac: ['mission', 'escort', null] },
    act: { name: '교전 태도', hi: '돌진', lo: '카이팅', tac: ['act', 'rush', 'retreat'] },
    fcoop: { name: '집중 공격', hi: '아군과 같은 적 공격', lo: '집중 해제', tac: ['fight', 'coop', null] },
    fsup: { name: '아군 지원', hi: '위급한 아군 쪽 지원', lo: '지원 해제', tac: ['fight', 'support', null] },
    fsolo: { name: '고립 사냥', hi: '타겟 오래 유지', lo: '고립 사냥 해제', tac: ['fight', 'solo', null] },
    pos: { name: '대열 위치', hi: '전방', lo: '후방', tac: ['pos', 'front', 'cover'] },
    efirst: { name: '교전 진입', hi: '선진입', lo: '후진입', tac: ['entry', 'first', 'late'] },
    eflank: { name: '우회 공격', hi: '측면 우회', lo: '우회 해제', tac: ['entry', 'flank', null] },
    aimw: { name: '표적: 체력 낮은 적', hi: '처치 노리기', lo: '해제', tac: ['aim', 'weak', null] },
    aimb: { name: '표적: 후방 딜러', hi: '뒤쪽 딜러 우선', lo: '해제', tac: ['aim', 'back', null] },
    aimc: { name: '표적: 고화력', hi: '화력 높은 적 우선', lo: '해제', tac: ['aim', 'carry', null] },
    aimcap: { name: '표적: 보스 딜러', hi: '보스 치는 적 견제', lo: '해제', tac: ['aim', 'capper', null] },
    aimn: { name: '표적: 가까운 적', hi: '가까운 적 우선', lo: '해제', tac: ['aim', 'near', null] },
    ultsave: { name: '궁: 한타·보스', hi: '큰 교전에서만 사용', lo: '해제', tac: ['ult', 'save', null] },
    ultclutch: { name: '궁: 위기 대응', hi: '아군 위기 때 사용', lo: '해제', tac: ['ult', 'clutch', null] }
  };
  const KN = { ratio: '교전 허용', retreatHp: '후퇴 체력', chaseT: '추격 시간', leash: '추격 거리', skillPatience: '스킬 대기', recastHold: '재시전 대기', ultWait: '궁 대기', podRun: '회복 이동', assist: '지원', finish: '마무리', whiff: '빗나감', retargetMul: '전환 속도', moodGuard: '위기 방어', o: '목표 의식', t: '팀워크', j: '판단', p: '위치', r: '반응', c: '위기 대응' };
  const PCT = ['retreatHp', 'assist', 'finish', 'whiff'], SNK = ['o', 't', 'j', 'p', 'r', 'c'];
  const fmt = (k, v) => PCT.includes(k) ? Math.round(v * 100) + '%' : SNK.includes(k) ? v.toFixed(2) : v.toFixed(1);
  const WL = { late: '후반', early: '초반', lowhp: '체력 낮을 때', behind: '지고 있을 때', ahead: '이기고 있을 때', boss: '보스 등장 시' };
  const CONDS = [['lowhp', /(체력|피|hp)\s*(이|가)?\s*(없으면|없을|없어|낮으면|낮을|떨어지면|떨어질|부족|위험|빠지면|모자라)/i], ['late', /후반|막판|종반|마지막|끝날 ?때|막바지/], ['early', /초반|시작할 ?때|처음에|경기 ?초/], ['behind', /지고 ?있|뒤지|밀리고|밀릴 ?때|열세|역전|점수.{0,4}(뒤|밀|낮)/], ['ahead', /이기고 ?있|앞서|리드|굳히|점수.{0,4}(앞|높)/], ['boss', /보스.{0,4}(나오면|뜨면|등장|떴을|나올)/]];
  const HINT = /제출 ?(시점|타이밍)|(빨리|일찍|늦게|모아서) ?제출|제출.{0,4}(빨리|일찍|늦게|바로)|분산|흩어|집결|뭉쳐서 ?다|짝 ?운영|운영 기조|보스 방침/;

  // [주제, 표현, 항목, 방향, 불만(0 보통 / 1 그 자체가 불만 / 2 항상 그대로), 그룹]
  const GU = /궁극|궁(?!금)|얼티|ult/i, HP = /힐|회복|팩|장치/, CO = /코어|보스|제출|오브젝트|목표|점수/;
  const R = [
    [null, /소극|겁|몸을? ?사|방어적|수비적|움츠/, 'bold', -1, 1],
    [null, /무모|무리(?:해|하게|한)|막 ?싸|덤비|돌격/, 'bold', 1, 1],
    [null, /공격적|과감|적극|들이대|밀어붙|저돌|용감/, 'bold', 1, 0],
    [null, /조심|안전하게|신중하게 싸/, 'bold', -1, 0],
    [null, /쫓|추격|따라가|집요/, 'chase', 1, 0],
    [null, /죽(?!이|여)|데스/, 'retreat', 1, 2],
    [null, /버티|끝까지 싸|안 ?빠|안 ?도망|물러나지/, 'retreat', -1, 0],
    [null, /후퇴|도망|빠지|빠져|피하|살아남|체력 ?관리/, 'retreat', 1, 0],
    [GU, /한타|보스|모였|모이면|뭉쳤/, 'ultsave', 1, 0, 'ult'],
    [GU, /위기|위급|위험|아군 ?체력/, 'ultclutch', 1, 0, 'ult'],
    [GU, /아끼|아껴|모아|늦게|타이밍|신중|천천히/, 'ult', -1, 0],
    [GU, /낭비|남발/, 'ult', 1, 1],
    [GU, /빨리|바로|자주|많이|써|쓰/, 'ult', 1, 0],
    [/스킬|기술/, /아끼|아껴|모아|늦게|천천히/, 'skill', -1, 0],
    [/스킬|기술/, /낭비|남발|난사/, 'skill', 1, 1],
    [/스킬|기술/, /빨리|바로|자주|연속|쿨|회전|많이|써|쓰|사용/, 'skill', 1, 0],
    [HP, /기다|대기|리젠/, 'podwait', 1, 0, 'heal'],
    [HP, /덜|적게/, 'heal', -1, 0],
    [HP, /챙|먹|활용|이용|들러|가|쓰|많이|자주/, 'heal', 1, 0],
    [null, /운반자|코어 ?(든|가진)|사냥|추적자/, 'mhunt', 1, 0, 'mission'],
    [null, /매복|길목|입금하러/, 'mambush', 1, 0, 'mission'],
    [null, /호위|엄호|아군 옆|지켜|보호/, 'mescort', 1, 0, 'mission'],
    [/보스/, /대기|기다|합류|나오면|뜨면/, 'mboss', 1, 0, 'join'],
    [null, /코어.{0,16}(찾|모으|모아|줍|주워|탐색)|맵.{0,10}(넓|돌|누비|탐색)|넓게.{0,12}(찾|탐색|돌|다니)|탐색|돌아다니|수집/, 'mcollect', 1, 0, 'mission'],
    [/보스/, /놓치|무시|소홀|안 ?챙|못 ?챙/, 'boss', -1, 1, 'mission'],
    [/보스/, /타이밍|챙|신경/, 'boss', 1, 0, 'mission'],
    [CO, /놓치|무시|방치|소홀|안 ?챙|못 ?챙/, 'obj', -1, 1, 'mission'],
    [CO, /챙|집중|우선|신경|먹|잡|가져|운반|노려/, 'obj', 1, 0, 'mission'],
    [null, /후진입|나중에 (들어|합류|붙)|기다렸다|눈치 ?보고|늦게 (들어|합류)/, 'efirst', -1, 0, 'join'],
    [null, /선진입|먼저 (진입|들어|열|뛰어)|교전 ?(을 )?(열|시작)/, 'efirst', 1, 0, 'join'],
    [null, /우회|측면|옆으로|옆구리|뒤를 ?(치|돌)|돌아서/, 'eflank', 1, 0, 'join'],
    [null, /혼자|단독|따로|고립|튀/, 'team', -1, 1, 'join'],
    [null, /같이|합류|뭉|붙어|함께|모여|팀플|협력|동료|아군/, 'team', 1, 0, 'join'],
    [null, /집중 ?(공격|딜|포격)|같은 적|아군이 (때리|노리|치)|포커스|한 명씩/, 'fcoop', 1, 0, 'fight'],
    [null, /위급한 아군|맞는 아군|아군.{0,4}(도와|지원|구해)|지원/, 'fsup', 1, 0, 'fight'],
    [null, /1대1|일대일|고립 ?사냥|혼자 있는 적|외톨이/, 'fsolo', 1, 0, 'fight'],
    [null, /마무리|막타|처치|(?<!스)킬/, 'finish', 1, 0],
    [null, /빗나|헛|못 ?맞/, 'aim', 1, 1],
    [null, /정확|명중|조준|에임|스킬샷/, 'aim', 1, 0],
    [null, /성급|급하|충동|흥분/, 'judge', -1, 1],
    [null, /침착|신중|판단|냉정|눈치|상황/, 'judge', 1, 0],
    [null, /흔들|주눅|멘탈 ?(약|나가|털)/, 'clutch', -1, 1],
    [null, /멘탈|클러치|위기 ?(에|때)? ?(강|침착)|집중력/, 'clutch', 1, 0],
    [/타겟|대상|딜/, /고정|집착|유지|끈질/, 'react', -1, 0],
    [/타겟|대상|딜/, /바꾸|바꿔|전환|유연|빨리|옮/, 'react', 1, 0],
    [null, /보스 ?딜러|보스 (치는|때리는) 적|막타 ?(스틸|뺏)/, 'aimcap', 1, 0, 'tgt'],
    [null, /(체력|피).{0,3}(낮은|적은) 적|딸피|약한 적|피 ?빠진 적/, 'aimw', 1, 0, 'tgt'],
    [null, /후방 딜러|원딜|마법사|뒤쪽 딜러|딜러 (먼저|위주|우선)/, 'aimb', 1, 0, 'tgt'],
    [null, /고화력|딜 ?(센|높은)|캐리|아픈 적/, 'aimc', 1, 0, 'tgt'],
    [null, /가까운 적|근처 적|가장 가까운/, 'aimn', 1, 0, 'tgt'],
    [null, /돌진|먼저 붙|달려들|뛰어들|들이박/, 'act', 1, 0],
    [null, /카이팅|카이트|거리 ?(유지|조절|벌)|치고 ?빠|안 ?붙/, 'act', -1, 0],
    [null, /후방|뒤에서|뒷줄|엄폐|숨어|뒤쪽|뒤로/, 'pos', -1, 0],
    [null, /전방|선봉|앞(?:으로|에서|에|장)|전진|앞줄|탱킹|앞쪽/, 'pos', 1, 0],
    [null, /위치|포지션|안전거리/, 'posn', 1, 0]
  ];
  const WISH = /했으면|하면 좋|해줘|해 줘|해라|해봐|하자|하도록|해주세요|해 주세요|으로 해|게 해|으면 해|길 바|부탁|줘|더 |좀 더/;
  const COMP = /너무|지나치|과하|과도|지 ?마(?:라|요)?|말아|그만|줄여|줄이|[았었했였쳤]|던데|더라|네$|네요|아쉬|문제|답답|지$/;

  function parse(text) {
    const out = {}, miss = [], hints = [];
    String(text).split(/[.!?\n,~]+|말고|대신|지만|는데|그리고/).forEach(raw => {
      const c = raw.trim(); if (c.length < 2) return;
      const mul = /많이|훨씬|확실히|꼭|제발|매우|엄청|완전/.test(c) ? 1.8 : /조금|살짝|약간|좀만/.test(c) ? 0.5 : 1;
      const wish = WISH.test(c) && !/지 ?마|너무/.test(c), seen = {}, when = (CONDS.find(x => x[1].test(c)) || [null])[0], hit = [];
      for (const [subj, q, ax, d, inh, grp] of R) {
        const gk = grp || ax;
        if (seen[gk] || (subj && !subj.test(c)) || !q.test(c)) continue;
        seen[gk] = 1;
        const comp = inh === 2 ? false : !wish && (inh === 1 || COMP.test(c)), key = ax + (when ? '@' + when : '');
        const o = out[key] || (out[key] = { ax, when, d: 0, text: c.slice(0, 40) });
        o.d += (comp ? -d : d) * mul; if (o.text !== c.slice(0, 40)) o.text += ' / ' + c.slice(0, 20);
        hit.push(key);
      }
      const bk = 'bold' + (when ? '@' + when : '');
      if (when === 'lowhp' && out[bk] && out[bk].d < 0 && !out['retreat@lowhp']) out['retreat@lowhp'] = { ax: 'retreat', when, d: mul, text: c.slice(0, 40) };
      if (!hit.length) (HINT.test(c) ? hints : miss).push(c);
    });
    const items = Object.keys(out).filter(k => out[k].d).map(k => ({ key: k, ax: out[k].ax, when: out[k].when, d: clamp(out[k].d, -2, 2), text: out[k].text }));
    return { items, miss, hints };
  }

  const st = g => { const c = g.club; if (!c.fb) c.fb = { p: {}, sig: [] }; return c.fb; };
  const nick = (g, id) => { const p = Pros.get(g, id); return p ? p.nick : '선수'; };
  function sync(g) {
    const s = st(g), ids = (g.club.roster || []), lu = (g.club.lineup || []).filter(Boolean);
    for (const id in s.p) if (!ids.includes(id)) delete s.p[id];
    let reset = false;
    if (s.sig.length && lu.filter(id => !s.sig.includes(id)).length >= 2) { s.p = {}; reset = true; }
    s.sig = lu.slice();
    return reset;
  }
  const pack = (g, i) => { const id = g.club.lineup[i], e = id && st(g).p[id]; return e && Object.keys(e).length ? { id, a: JSON.parse(JSON.stringify(e)) } : null; };

  function attach(g, moods) {
    if (sync(g)) UI.toast('선수단이 많이 바뀌어 AI 피드백이 초기화되었습니다.', 'warn');
    const m = moods || [];
    return [0, 1, 2].map(i => ({ ...(m[i] || {}), fb: pack(g, i) }));
  }

  const lvOf = v => clamp(Math.round(2 + 4 * Math.abs(v)), 1, 6);
  const optName = (cat, id) => { const c = CONFIG.tactics.categories.find(x => x.id === cat), o = c && c.options.find(x => x.id === id); return c ? `${c.name}: ${o ? o.name : '기본'}` : ''; };
  const room = (tg, mode, base, lim) => mode === 'mul' ? Math.abs(base) * CAP : CAP * (tg === 'sn' ? 1 : (lim ? lim[1] - lim[0] : 1));
  const limOf = (tg, k) => tg === 'sn' ? [-1, 1] : CONFIG.brain.stat.limits[k];

  function refresh(u) {
    const act = u.fbEnts.filter(en => !en.when || en.on), sum = {}, bl = {}, tc = {};
    act.forEach(en => {
      (en.A.fx || []).forEach(([tg, k, mode, sg]) => { const id = tg + k; if (!(id in u.fbBase)) return; const b = u.fbBase[id]; sum[id] = (sum[id] || 0) + (mode === 'mul' ? b * CAP * en.v * sg : CAP * en.v * sg * (tg === 'sn' ? 1 : (limOf(tg, k) ? limOf(tg, k)[1] - limOf(tg, k)[0] : 1))); });
      if (en.A.bool) bl[en.A.bool] = en.v > 0;
      if (en.A.tac) tc[en.A.tac[0]] = en;
    });
    for (const id in u.fbBase) {
      if (id === 'tac') continue;
      if (id[0] === 'b' && id[1] === ':') { const k = id.slice(2); u.brain[k] = k in bl ? bl[k] : u.fbBase[id]; continue; }
      const tg = id.slice(0, 2) === 'sn' ? 'sn' : 'brain', k = id.slice(tg.length), o = tg === 'sn' ? u.sn : u.brain, b = u.fbBase[id], lim = limOf(tg, k), mode = (u.fbMode || {})[id], r = room(tg, mode, b, lim);
      let n = b + clamp(sum[id] || 0, -r, r); if (lim) n = clamp(n, lim[0], lim[1]); o[k] = n;
    }
    for (const cat in u.fbBase.tac) {
      const bs = u.fbBase.tac[cat], en = tc[cat];
      if (en) { const t = en.A.tac, id = en.v > 0 ? t[1] : t[2], lv = lvOf(en.v); u.tac[cat] = id; u.tac[cat + 'L'] = lv; u.tac[cat + 'S'] = lv / CONFIG.tactics.maxLevel; if (cat === 'aim' && id === 'near') u.tac.aim = null; }
      else { u.tac[cat] = bs.id; u.tac[cat + 'L'] = bs.L; u.tac[cat + 'S'] = bs.S; }
    }
    if (u.dg) { u.dg.j = u.sn.j; u.dg.team = u.sn.t; u.dg.posn = u.sn.p; }
  }

  function apply(u, fb) {
    const ents = [];
    Object.keys(fb.a).forEach(k => { const [ax, when] = k.split('@'), A = AX[ax], e = fb.a[k]; if (A && e.v) ents.push({ ax, when: when || null, A, v: e.v, e }); });
    if (!ents.length) return;
    ents.sort((a, b) => Math.abs(a.v) - Math.abs(b.v));
    u.fbBase = { tac: {} }; u.fbMode = {}; u.fbEnts = ents;
    ents.forEach(en => {
      (en.A.fx || []).forEach(([tg, k, mode]) => { const o = tg === 'sn' ? u.sn : u.brain; if (o[k] == null) return; u.fbBase[tg + k] = o[k]; u.fbMode[tg + k] = mode; });
      if (en.A.bool) u.fbBase['b:' + en.A.bool] = u.brain[en.A.bool];
      if (en.A.tac) { const c = en.A.tac[0]; if (!(c in u.fbBase.tac)) u.fbBase.tac[c] = { id: u.tac[c], L: u.tac[c + 'L'], S: u.tac[c + 'S'] }; }
    });
    u.fbApplied = ents.map(en => {
      let d = '';
      if (en.A.fx) { const f = en.A.fx.find(([tg, k]) => (tg + k) in u.fbBase); if (f) { const [tg, k, mode, sg] = f, b = u.fbBase[tg + k], lim = limOf(tg, k), r = room(tg, mode, b, lim); let n = b + clamp(mode === 'mul' ? b * CAP * en.v * sg : CAP * en.v * sg * (tg === 'sn' ? 1 : (lim ? lim[1] - lim[0] : 1)), -r, r); if (lim) n = clamp(n, lim[0], lim[1]); d = `${KN[k]} ${fmt(k, b)}→${fmt(k, n)}`; } }
      else if (en.A.bool) d = `${en.A.name} ${en.v > 0 ? '켜짐' : '꺼짐'}`;
      else if (en.A.tac) d = `${optName(en.A.tac[0], en.v > 0 ? en.A.tac[1] : en.A.tac[2] || 'none')} Lv${lvOf(en.v)}`;
      en.r = { ax: en.ax, when: en.when, v: en.v, text: en.e.text, d, fired: !en.when };
      return en.r;
    });
    u.fbCond = ents.some(en => en.when);
    refresh(u);
  }

  const condOn = (w, b, u) => w === 'late' ? (b.sudden || b.t >= b.cfg.maxTicks * 0.6) : w === 'early' ? b.t < b.cfg.maxTicks * 0.3 : w === 'lowhp' ? u.hp < u.maxHp * 0.35 : w === 'behind' ? b.score[u.team] < b.score[1 - u.team] : w === 'ahead' ? b.score[u.team] > b.score[1 - u.team] : w === 'boss' ? b.units.some(x => x.team === 2 && x.alive) : false;
  function tick(b) {
    for (const u of b.units) {
      if (!u.fbCond || !u.alive) continue;
      let ch = false;
      for (const en of u.fbEnts) if (en.when) { const on = !!condOn(en.when, b, u); if (on !== !!en.on) { en.on = on; ch = true; if (on) en.r.fired = true; } }
      if (ch) refresh(u);
    }
  }

  function afterMatch(g, res, M, notes) {
    const s = st(g), lines = [];
    res.units.filter(u => u.team === M.pIdx).forEach(u => {
      const id = g.club.lineup[u.slot], e = id && s.p[id]; if (!e) return;
      if (u.fb) lines.push(`🧠 ${u.nick || nick(g, id)} 피드백 적용됨 — ` + u.fb.map(r => `${r.when ? '[' + WL[r.when] + (r.fired ? ' 발동' : ' 미발동') + '] ' : ''}${AX[r.ax].name} ${r.v > 0 ? '▲' : '▼'}${Math.round(Math.abs(r.v) * 100)}% (${r.d})`).join(' · '));
      let gone = 0;
      for (const ax in e) { e[ax].v *= DECAY; if (Math.abs(e[ax].v) < DROP) { delete e[ax]; gone++; } }
      if (gone) lines.push(`🧠 ${u.nick || nick(g, id)}: 오래된 피드백 ${gone}개의 효과가 사라졌습니다. 다시 알려주면 다시 반영됩니다.`);
      if (!Object.keys(e).length) delete s.p[id];
    });
    if (lines.length) notes.push(...lines);
  }

  function season(g) {
    const s = st(g);
    for (const id in s.p) { const e = s.p[id]; for (const ax in e) { e[ax].v *= SEASON; if (Math.abs(e[ax].v) < DROP) delete e[ax]; } if (!Object.keys(e).length) delete s.p[id]; }
  }

  function listHTML(g, id, withX) {
    const e = st(g).p[id], ks = e ? Object.keys(e) : [];
    if (!ks.length) return '<p class="note">반영 중인 피드백이 없습니다.</p>';
    return `<ul>${ks.map(ax => { const r = e[ax], A = AX[ax.split('@')[0]], w = ax.split('@')[1], up = r.v > 0; if (!A) return ''; return `<li>${w ? `<em>[${WL[w]}]</em> ` : ''}<b>${A.name}</b> ${up ? '▲' : '▼'} ${up ? A.hi : A.lo} <small>“${esc(r.text)}”</small><div class="fb-bar"><i class="${up ? '' : 'dn'}" style="width:${Math.round(Math.abs(r.v) * 100)}%"></i></div>${withX ? `<button class="fb-x" data-act="fbDel" data-id="${id}" data-ax="${ax}" title="이 항목 지우기">✕</button>` : ''}</li>`; }).join('')}</ul>`;
  }

  function panel(g) {
    if (!g || !g.club || !g.club.lineup) return '';
    sync(g);
    const cards = g.club.lineup.filter(Boolean).map(id => `<div class="fb-card"><h4>${esc(nick(g, id))}<button class="btn small ghost" data-act="fbResetOne" data-id="${id}">초기화</button></h4>${listHTML(g, id, true)}</div>`).join('');
    return `<section class="glass panel fb-panel"><div class="fb-head"><h3>🧠 AI 피드백 학습 · 현재 반영된 피드백</h3><div><button class="btn small primary" data-act="fbOpen">피드백 쓰기</button> <button class="btn small ghost" data-act="fbResetAll">전체 초기화</button></div></div>
      <p class="note">선수별로 적은 피드백대로 다음 경기부터 AI가 움직입니다. 항목당 최대 ±30%, 경기마다 약해져 5경기면 절반, 시즌이 바뀌면 크게 줄고, 선수단이 많이 바뀌면 초기화됩니다. 같은 불만을 다시 적으면 강해집니다.</p><div class="fb-cards">${cards || '<p class="empty">라인업을 먼저 채워주세요.</p>'}</div></section>`;
  }

  function pendHTML() {
    return `<div class="fb-card" style="margin:8px 0"><h4>이렇게 이해했어요 — 맞는지 확인하세요</h4><ul>${S.pending.map((it, i) => { const A = AX[it.ax], up = it.d > 0; return `<li>${it.when ? `<em>[${WL[it.when]}]</em> ` : ''}<b>${A.name}</b> ${up ? '▲' : '▼'} ${up ? A.hi : A.lo} <button class="fb-x" data-act="fbFlip" data-i="${i}" title="방향 반대로">⇄ 반대로</button><button class="fb-x" data-act="fbDrop" data-i="${i}" title="이 항목 빼기">✕</button></li>`; }).join('')}</ul>${S.miss && S.miss.length ? `<p class="note">이해하지 못한 부분: ${S.miss.map(m => '“' + esc(m) + '”').join(', ')}</p>` : ''}${S.hints && S.hints.length ? `<p class="note">팀 전술에서 정하는 항목이에요(전술 화면에서 설정): ${S.hints.map(m => '“' + esc(m) + '”').join(', ')}</p>` : ''}</div>`;
  }
  function render() {
    const g = Game.G, lu = g.club.lineup, id = lu[S.sel] || lu.find(Boolean);
    const tabs = lu.map((pid, i) => pid ? `<button class="btn small ${i === S.sel ? 'on' : ''}" data-act="fbPick" data-i="${i}">${esc(nick(g, pid))}</button>` : '').join('');
    UI.modal(`<h2>💬 선수 피드백</h2><p class="note">타자로 적으면 AI가 키워드를 읽어 다음 경기부터 반영합니다.</p><div class="fb-tabs">${tabs}</div>
      ${S.pending ? pendHTML() : ''}<textarea id="fbText" maxlength="150" placeholder="예) 후반엔 코어 더 넓게 맵 쓰면서 찾아. 체력 없으면 무리한 싸움 하지마">${esc(S.text)}</textarea>
      <p class="fb-ex">주제: 공격성·추격·후퇴·스킬·궁·회복 장치·코어 탐색/수집·매복·사냥·호위·보스·돌진/카이팅·집중/지원·전방/후방·진입/우회·표적·정확도·침착함·위치 / 조건: 초반·후반·체력 낮을 때·지고/이기고 있을 때·보스 등장 시</p>
      <h4>${esc(nick(g, id))} — 현재 반영 중</h4>${listHTML(g, id, false)}
      <div class="modal-actions">${S.pending ? '<button class="btn primary" data-act="fbApply">이대로 적용</button><button class="btn" data-act="fbCancel">다시 쓰기</button>' : '<button class="btn primary" data-act="fbSend">보내기</button>'}<button class="btn" data-act="fbBack">${S.from === 'result' ? '← 결과로' : '닫기'}</button></div>`, 'fb-modal', S.from !== 'result');
  }

  const grab = () => { const t = document.getElementById('fbText'); if (t) S.text = t.value; };
  const actions = {
    fbOpen(el) { S.pending = null; S.from = (el && el.dataset && el.dataset.from) || ''; S.text = ''; const lu = Game.G.club.lineup; if (!lu[S.sel]) S.sel = Math.max(0, lu.findIndex(Boolean)); render(); },
    fbPick(el) { grab(); S.pending = null; S.sel = +el.dataset.i; render(); },
    fbBack() { if (S.from === 'result') UI.reShowResult(); else UI.closeModal(); },
    fbSend() {
      grab(); const r = parse(S.text), items = r.items; S.miss = r.miss; S.hints = r.hints;
      if (!S.text.trim()) { UI.toast('피드백 내용을 입력해 주세요.', 'warn'); return; }
      if (!items.length) { UI.toast(r.hints.length ? '그건 팀 전술 화면에서 정하는 항목이에요.' : '내용을 이해하지 못했어요. 예: “후반엔 코어 넓게 찾아”, “체력 없으면 무리한 싸움 하지마”', 'warn'); return; }
      S.pending = items; render(); return;
    },
    fbFlip(el) { grab(); const it = S.pending[+el.dataset.i]; if (it) it.d = -it.d; render(); },
    fbDrop(el) { grab(); S.pending.splice(+el.dataset.i, 1); if (!S.pending.length) S.pending = null; render(); },
    fbCancel() { grab(); S.pending = null; render(); },
    fbApply() {
      const g = Game.G, id = g.club.lineup[S.sel], items = S.pending || []; S.pending = null;
      if (!items.length) { render(); return; }
      const e = st(g).p[id] || (st(g).p[id] = {});
      items.forEach(it => { const r = e[it.key] || (e[it.key] = { v: 0, text: it.text }); if (r.v * it.d < 0) r.v = 0; r.v = clamp(r.v + it.d * STEP, -1, 1); r.text = it.text; });
      Game.save(); S.text = '';
      UI.toast(`${nick(g, id)}에게 반영: ` + items.map(it => `${it.when ? WL[it.when] + ' ' : ''}${AX[it.ax].name} ${it.d > 0 ? '▲' : '▼'}`).join(' · ') + ' — 다음 경기부터 적용', 'good');
      render(); if (S.from !== 'result') UI.refresh();
    },
    fbDel(el) { const e = st(Game.G).p[el.dataset.id]; if (e) { delete e[el.dataset.ax]; if (!Object.keys(e).length) delete st(Game.G).p[el.dataset.id]; } Game.save(); UI.refresh(); },
    fbResetOne(el) { delete st(Game.G).p[el.dataset.id]; Game.save(); UI.refresh(); UI.toast('피드백을 초기화했습니다.', 'good'); },
    fbResetAll() { if (!confirm('모든 선수의 AI 피드백을 초기화할까요?')) return; st(Game.G).p = {}; Game.save(); UI.refresh(); UI.toast('모든 피드백을 초기화했습니다.', 'good'); }
  };

  return { parse, attach, apply, tick, afterMatch, season, panel, actions };
})();
