/* ============================================================
   config.js — 수치·네이밍 설정. 파이터 본체(스탯/스킬)는 fighters.js 에 있습니다.
   - 스탯 단위: hp/mp 수치, aspd=초당 공격 횟수, spd=초당 이동 거리(유닛),
     atk/ap/def/res 수치, ten/pen/ls = 0~1 비율, range = 사거리(유닛, 근접 ≈ 6)
   - 피해 공식: 피해 = 원피해 × 100 / (100 + 방어(or 저항) × (1 - 관통력))
   ============================================================ */
const MAP_W = 225, MAP_H = 150, MAP_CX = 112.5, MAP_CY = 75;
const _rot = o => (o.t === 'c' ? { ...o, x: MAP_W - o.x, y: MAP_H - o.y } : { ...o, x: MAP_W - o.x - o.w, y: MAP_H - o.y - o.h });
const _rotPts = pts => pts.map(p => [MAP_W - p[0], MAP_H - p[1]]);
const _half = [
  { t: 'r', x: 28, y: 5,  w: 3,  h: 15, z: 12 }, { t: 'r', x: 5,  y: 28, w: 15, h: 3,  z: 12 },
  { t: 'r', x: 96, y: 4,  w: 3,  h: 10, z: 12 }, { t: 'r', x: 126, y: 4, w: 3,  h: 10, z: 12 },
  { t: 'r', x: 4,  y: 62, w: 14, h: 3,  z: 12 }, { t: 'r', x: 4,  y: 85, w: 14, h: 3,  z: 12 },
  { t: 'r', x: 40, y: 16, w: 14, h: 10, z: 30 }, { t: 'r', x: 92, y: 22, w: 12, h: 8,  z: 22 },
  { t: 'r', x: 66, y: 54, w: 10, h: 10, z: 26 }, { t: 'r', x: 36, y: 88, w: 12, h: 10, z: 28 },
  { t: 'r', x: 54, y: 96, w: 3,  h: 12, z: 10 }, { t: 'r', x: 6,  y: 100, w: 14, h: 12, z: 34 },
  ...[18, 63, 117, 162].map(a => ({ t: 'c', x: MAP_CX + 38 * Math.cos(a * Math.PI / 180), y: MAP_CY + 38 * Math.sin(a * Math.PI / 180), r: 3, z: 22 }))
];
const MAP_OBSTACLES = [..._half, ..._half.map(_rot)];
const _parkHalf = [ { x: 20, y: 44, w: 12, h: 10 }, { x: 74, y: 30, w: 14, h: 8 } ];
const MAP_PARKS = [..._parkHalf, ..._parkHalf.map(_rot)];
const _ringHalf = [[23, 125], [22, 100], [22, 75], [24, 40], [40, 24], [112.5, 20], [190, 20], [202, 21]];
const MAP_ROADS = [
  { w: 8, pts: _ringHalf }, { w: 8, pts: _rotPts(_ringHalf) },
  { w: 6, pts: [[22, 75], [86, 75]] }, { w: 6, pts: [[203, 75], [139, 75]] },
  { w: 6, pts: [[112.5, 20], [112.5, 49]] }, { w: 6, pts: [[112.5, 130], [112.5, 101]] },
  { w: 6, pts: [[23, 129], [88, 93]] }, { w: 6, pts: [[202, 21], [137, 57]] },
  { w: 6, pts: [[14, 14], [88, 57]] }, { w: 6, pts: [[211, 136], [137, 93]] }
];
const MAP_CORE = {
  small: { value: 1, slots: 1 }, big: { value: 3, slots: 2 },
  carryCap: 6, slowPer: 0.03, slowMax: 0.18,
  pickR: 6, grabR: 14, lockSec: 1.0, senseR: 45,   /* pickR 줍는 거리 · grabR 다른 일 중에도 코어를 주우러 틀어 가는 거리 · senseR 코어 발견 거리 */
  startSmall: 3, startRing: [22, 48],
  wave: { every: 8, count: 2, max: 14, bigEvery: 4, finalSec: 30, finalEveryMul: 0.5, bigRing: [35, 60] },
  deposit: { r: 12, channelSec: 1.2, perCoreSec: 0.3, comboAt: 4, comboBonus: 1 }, /* 제출 시간 = channelSec + perCoreSec × (든 코어 수-1) */
  boss: {
    first: 8, late: 12, scatterR: 10, lockSec: 1.5,
    buff: { sec: 40, atk: 0.25, ap: 0.25, spd: 0.15, taken: -0.15, healPct: 0.3, noCarrySlow: true },
    valueFirst: 4.0, valueLate: 5.5
  },
  spawnClear: { base: 20, pit: 30, deposit: 20, obs: 3 },
  scatterR: 6, mvpPerPoint: 500,
  sudden: { n: 2, dx: 30, dy: 22 },
  timing: {
    normal: { base: 3, step: 0.34 },
    early: { base: 2, step: -0.34 },
    full: { base: 6, step: 0, low: 3, lowStep: 0.34 }
  },
  caution: { outMul: 0.65, holdHome: 34 },   /* outMul: 수적 열세 시 교전 허용 배율(클수록 덜 도망) · holdHome: 본진 제출 지점에서 이 거리 안이면 더 도망치지 않고 싸움(0=끔) */
  danger: { foeR: 26, reachR: 48, reachW: 0.5, mateR: 26, safe: 1.0, cap: 3, pen: 1.1, veto: 2.2, vetoPen: 4, carryMul: 0.25, brave: 0.6, careful: 1.4, soloLim: 1.5 },
  ai: {
    coreMul: 1.2, distDiv: 100, cap: 2,
    needUrg: 1.2, needCore: 0.3, leadDep: 0.5, urgentSec: 25, urgentMul: 3, trailSec: 60, trailMul: 2, collectDep: 1.5, fighterDep: 1.6, depMul: 0.4, depFull: 6, depReady: 1.6, depWait: 0.3, depThreatR: 25, depThreatMul: 0.5, depThreatCost: 1.2, safeR: 45, greed: 0.7,
    guardMul: 1.2, guardOff: 14, ambushFar: 40, ambushStep: 3.5, ambushV: 0.5,
    carryPrey: 0.5, huntV: 0.25, crowdSplit: 1.2, crowdMul: 0.35,
    join: 0.7, joinMin: 14, joinRef: 70, hold: 6, holdBonus: 0.5, assassinHunt: 0.6, backPrey: 0.8
  }
};
const _freeSpot = (x, y) => {
  const hit = (px, py) => MAP_OBSTACLES.some(o => (o.t === 'c' ? Math.hypot(px - o.x, py - o.y) < o.r + 3 : px > o.x - 3 && px < o.x + o.w + 3 && py > o.y - 3 && py < o.y + o.h + 3));
  if (!hit(x, y)) return { x, y };
  for (let r = 1; r < 60; r++) for (let a = 0; a < 24; a++) { const px = x + r * Math.cos(a * Math.PI / 12), py = y + r * Math.sin(a * Math.PI / 12); if (!hit(px, py)) return { x: px, y: py }; }
  return { x, y };
};
const _depN = _freeSpot(112.5, 30), _depS = { x: MAP_W - _depN.x, y: MAP_H - _depN.y };
const MAP_ZONES = [
  { id: 'pit', name: '중앙 보스 구덩이', x: MAP_CX, y: MAP_CY, r: 26, hub: true },
  { id: 'depN', name: '제출 지점 북', x: _depN.x, y: _depN.y, r: MAP_CORE.deposit.r, deposit: true },
  { id: 'depS', name: '제출 지점 남', x: _depS.x, y: _depS.y, r: MAP_CORE.deposit.r, deposit: true }
];

const CONFIG = {
  game: { title: 'COSMIC LEAGUE', subtitle: '유니버설 파이터즈 서킷', saveKey: 'cosmic_league_save_v6' },
  nav: { select: '리그 선택', league: '리그', club: '구단 관리', market: '이적시장', codex: '파이터 도감', tactics: '전술', match: '경기장', data: '데이터 센터', trophy: '트로피' },

  /* ---------- 스탯 (도감 표시용) ---------- */
  statOrder: ['hp', 'mp', 'aspd', 'spd', 'atk', 'ap', 'def', 'res', 'ten', 'pen', 'ls', 'range', 'crit', 'critDmg'],
  stats: {
    hp:    { name: '체력',       short: '체력',   color: '#4ade80', max: 1100, digits: 0 },
    mp:    { name: '마나',       short: '마나',   color: '#38bdf8', max: 360,  digits: 0 },
    aspd:  { name: '공격속도',   short: '공속',   color: '#f97316', max: 1.4,  digits: 2 },
    spd:   { name: '이동속도',   short: '이속',   color: '#2dd4bf', max: 11,   digits: 1 },
    atk:   { name: '공격력',     short: '공격력', color: '#fb7185', max: 70,   digits: 0 },
    ap:    { name: '주문력',     short: '주문력', color: '#c084fc', max: 80,   digits: 0 },
    def:   { name: '방어력',     short: '방어력', color: '#60a5fa', max: 50,   digits: 0 },
    res:   { name: '저항력',     short: '저항력', color: '#a78bfa', max: 40,   digits: 0 },
    ten:   { name: '강인함',     short: '강인함', color: '#fbbf24', max: 0.6,  digits: 0, pct: true, tip: 'CC 지속시간 단축' },
    pen:   { name: '관통력',     short: '관통력', color: '#f43f5e', max: 0.3,  digits: 0, pct: true, tip: '방어력·저항력 무시' },
    ls:    { name: '생명력흡수', short: '흡수',   color: '#ef4444', max: 0.3,  digits: 0, pct: true, tip: '준 피해의 일부를 회복' },
    range: { name: '사거리',     short: '사거리', color: '#94a3b8', max: 30,   digits: 0 },
    crit:  { name: '치명타 확률', short: '치명타', color: '#facc15', max: 0.5,  digits: 0, pct: true, tip: '기본 공격이 치명타가 될 확률' },
    critDmg: { name: '치명타 피해', short: '치피',  color: '#fb923c', max: 2.5,  digits: 0, pct: true, tip: '치명타 시 피해 배율' }
  },

  /* ---------- 상태이상 (cc:true 는 강인함으로 지속시간 단축) ---------- */
  status: {
    slow:    { name: '둔화', cc: true,  desc: '이동속도 감소' },
    stun:    { name: '기절', cc: true,  desc: '행동불가' },
    root:    { name: '속박', cc: true,  desc: '이동불가' },
    silence: { name: '침묵', cc: true,  desc: '스킬불가' },
    poison:  { name: '중독', cc: false, desc: '마나 회복량 감소' },
    burn:    { name: '화상', cc: false, desc: '치유량 감소' },
    freeze:  { name: '빙결', cc: true,  desc: '둔화 및 피해량 감소' },
    fear:    { name: '공포', cc: true,  desc: '잠시 반대로 도망감' },
    knock:   { name: '넉백', cc: false, desc: '뒤로 밀려남' },
    stagger: { name: '경직', cc: true,  desc: '아주 짧게 이동 및 스킬 불가' },
    bleed:   { name: '출혈', cc: false, desc: '받는 피해 증가' },
    blind:   { name: '실명', cc: true,  desc: '기본 공격이 빗나감' }
  },
  statusFx: { slow: 0.3, poison: 0.5, burn: 0.5, freezeSlow: 0.35, freezeDmg: 0.8, bleed: 0.08 },

  roles: {
    warrior: { name: '전사',   icon: '⚔', color: '#ff7a59' },
    mage:    { name: '마법사', icon: '🔮', color: '#a78bfa' },
    guardian: { name: '수호자', icon: '🛡', color: '#38bdf8' },
    assassin: { name: '암살자', icon: '🗡', color: '#f43f5e' },
    hunter: { name: '사냥꾼', icon: '🎯', color: '#22c55e' }
  },

  /* ---------- 밴픽 ----------
     order: 토큰 'A:ban' 'B:pick' ... (A = 먼저 선택하는 팀 = 경기 대진의 앞쪽 팀)  지그재그(번갈아) 형식, 벤 1 · 픽 3 (팀당) */
  draft: {
    order: ['A:ban', 'B:ban', 'A:pick', 'B:pick', 'A:pick', 'B:pick', 'A:pick', 'B:pick'],
    aiDelayMs: 900
  },

  /* ---------- 전술 ----------
     개인 지시(categories): 파이터마다 설정. 팀 전략(team): 팀 전체에 적용. 모든 항목은 [선택지, 정도(1~7)] 로 저장됩니다.
     난이도는 파이터 개별 AI(이동·스킬·타게팅)를 바꾸지 않고, AI 팀이 '어떤 전술을 짜는가'만 바꿉니다. */
  tactics: {
    maxLevel: 7,
    /* 사전 전술(경기 전 설정): 화면에 보이는 항목만 조정, 나머지는 fixed 값으로 고정. 정도(단계)는 level 로 고정 */
    /* 슬롯 역할: 배치한 선수(1·2·3번)마다 고르는 역할. 'auto' 는 픽한 파이터에 맞춰 경기 시작 때 자동 결정 */
    roles: [
      { id: 'vanguard', name: '선봉', desc: '앞에서 교전을 열고 보스전 선봉에 섭니다.', set: { mission: 'boss', pos: 'front', entry: 'first', aim: 'near', ult: 'save', act: 'rush', fight: 'coop' } },
      { id: 'collector', name: '수집가', desc: '코어를 모으며 약한 적을 노립니다.', set: { mission: 'collect', pos: 'none', entry: 'none', aim: 'weak', ult: 'normal', act: 'basic', fight: 'coop' } },
      { id: 'hunter', name: '사냥꾼', desc: '코어를 든 적과 후열을 쫓습니다.', set: { mission: 'hunt', pos: 'none', entry: 'flank', aim: 'back', ult: 'burst', act: 'rush', fight: 'solo' } },
      { id: 'guard', name: '호위', desc: '코어 든 아군을 따라다니며 지킵니다.', set: { mission: 'escort', pos: 'front', entry: 'none', aim: 'carry', ult: 'clutch', act: 'basic', fight: 'support' } },
      { id: 'carry', name: '후방 화력', desc: '뒤에서 코어를 모으며 고화력 적을 노립니다.', set: { mission: 'collect', pos: 'cover', entry: 'support', aim: 'carry', ult: 'save', act: 'retreat', fight: 'coop' } },
      { id: 'ambusher', name: '매복', desc: '상대 제출 길목에서 기다립니다.', set: { mission: 'ambush', pos: 'cover', entry: 'late', aim: 'carry', ult: 'burst', act: 'basic', fight: 'none' } }
    ],
    pre: {
      level: 4,
      team: ['stance', 'boss', 'formation', 'deposit', 'retreat', 'ultT'],
      slot: ['mission', 'entry', 'pos', 'aim', 'ult'],
      fixed: { gather: 'two', hurry: 'normal', focus: 'weak', chain: 'follow', roleMove: 'split', podCycle: 'cover', early: 'follow', mid: 'follow', late: 'follow', lead: 'keep', trail: 'keep', react: 'adapt' }
    },
    phases: [40, 100],
    marginBase: 4, marginStep: 0.4,
    stances: {
      balanced: { post: 1,    kill: 1,    boss: 1,    pod: 1,   core: 1,    aggro: 0 },
      collect:  { post: 0.9,  kill: 0.8,  boss: 0.8,  pod: 1.2, core: 1.5,  aggro: -2 },
      slay:     { post: 0.75, kill: 1.6,  boss: 0.85, pod: 0.85, core: 0.8, aggro: 8 },
      boss:     { post: 0.85, kill: 0.85, boss: 1.6,  pod: 1.3, core: 0.85, aggro: 0 },
      defend:   { post: 1.8,  kill: 0.85, boss: 0.55, pod: 1.2, core: 1,    aggro: -3 }
    },
    categories: [
      { id: 'mission', name: '임무', neutral: 'free', options: [
        { id: 'free',   name: '자유',     desc: '별도 임무 없이 팀 기조를 따릅니다.' },
        { id: 'collect', name: '코어 수집', desc: '코어를 찾아 모으는 데 우선합니다. 정도가 높을수록 멀리까지 탐색하고, 가득 찰 때까지 제출을 미룹니다.' },
        { id: 'ambush', name: '제출 매복', desc: '상대 팀에 가까운 쪽 제출 지점 외곽에서 입금하러 오는 운반자를 노립니다. 정도가 높을수록 제출 지점 가까이 붙습니다.' },
        { id: 'hunt',   name: '처치',     desc: '코어를 많이 든 적, 체력이 낮거나 고립된 적을 쫓습니다. 정도가 높을수록 멀리까지 추격합니다.' },
        { id: 'boss',   name: '보스 대기', desc: '보스가 나오면 우선 합류하고, 없으면 코어를 주우며 대기합니다. 정도가 높을수록 먼 거리에서도 합류합니다.' },
        { id: 'escort', name: '호위',     desc: '코어를 많이 든 아군 옆을 지키며 싸웁니다. 정도가 높을수록 바짝 붙습니다.' } ] },
      { id: 'act', name: '교전 태도', neutral: 'basic', options: [
        { id: 'basic',   name: '기본', desc: '파이터 고유 사거리·카이팅을 따릅니다.' },
        { id: 'rush',    name: '돌진', desc: '적에게 먼저 붙습니다. 이동속도↑ 방어력↓ (정도에 비례).' },
        { id: 'retreat', name: '카이팅', desc: '거리를 유지하며 싸웁니다. 정도가 높을수록 일찍 뒤로 빠집니다.' } ] },
      { id: 'fight', name: '팀플레이', neutral: 'none', options: [
        { id: 'none',    name: '단독', desc: '자기 목표를 우선합니다.' },
        { id: 'coop',    name: '집중', desc: '아군이 노리는 적을 함께 때립니다. 집중 공격 시 피해↑.' },
        { id: 'support', name: '지원', desc: '맞는 아군 쪽 적을 우선 끊고, 위급한 아군 쪽으로 붙습니다.' },
        { id: 'solo',    name: '고립 사냥', desc: '타겟을 오래 유지합니다. 주변에 아군이 없을 때 공격력↑.' } ] },
      { id: 'pos', name: '대열 위치', neutral: 'none', options: [
        { id: 'none',  name: '기본', desc: '파이터 기본 포지션을 따릅니다.' },
        { id: 'front', name: '전방', desc: '아군보다 앞에서 교전을 엽니다. 보스 진입·선제 교전에 유리합니다.' },
        { id: 'cover', name: '후방', desc: '아군 뒤·엄폐물 쪽에서 딜합니다. 암살·누킹에 덜 노출됩니다.' } ] },
      { id: 'entry', name: '교전 진입', neutral: 'none', options: [
        { id: 'none',    name: '기본',     desc: '파이터 기본 진입 방식을 따릅니다.' },
        { id: 'first',   name: '선진입',   desc: '아군보다 먼저 뛰어들어 교전을 엽니다.' },
        { id: 'late',    name: '후진입',   desc: '아군이 교전을 시작할 때까지 기다렸다 합류합니다.' },
        { id: 'support', name: '후방지원', desc: '전열 뒤에서 맞는 아군 쪽 적을 끊으며 지원합니다.' },
        { id: 'flank',   name: '우회',     desc: '측면으로 돌아 적의 옆·뒤를 칩니다.' } ] },
      { id: 'aim', name: '표적 우선', neutral: 'near', options: [
        { id: 'near',   name: '가까운 적', desc: '가장 가까운 적을 기본 목표로 잡습니다.' },
        { id: 'weak',   name: '체력 낮은 적', desc: '체력 비율이 낮은 적을 우선해 처치를 노립니다.' },
        { id: 'back',   name: '후방 딜러', desc: '마법사·원거리 등 뒤쪽 딜러를 우선합니다.' },
        { id: 'carry',  name: '고화력', desc: '공격력·주문력이 높은 적을 우선합니다.' },
        { id: 'capper', name: '보스 딜러', desc: '보스를 치고 있는 적을 우선해 막타 스틸과 견제를 노립니다.' } ] },
      { id: 'ult', name: '궁극기 타이밍', neutral: 'normal', options: [
        { id: 'normal', name: '효율',     desc: '다수 적중·위급 아군 등 효율 좋은 타이밍에 씁니다.' },
        { id: 'burst',  name: '즉시',     desc: '쿨이 오면 바로 씁니다. 정도 3↑ 이면 조건이 더 느슨해집니다.' },
        { id: 'save',   name: '한타·보스', desc: '적이 모였거나 보스 근처, 아군 위급할 때만 씁니다.' },
        { id: 'clutch', name: '위기 아낌', desc: '아군 체력이 위험할 때까지 아끼다 씁니다.' } ] }
    ],
    team: [
      { id: 'stance', group: '운영', name: '운영 기조', neutral: 'balanced', options: [
        { id: 'balanced', name: '균형',     desc: '코어 수집·제출·교전·보스·회복 루트를 상황에 맞게 고르게 봅니다.' },
        { id: 'collect',  name: '수집 중시', desc: '코어 수집과 제출로 꾸준히 점수를 쌓습니다. 무리한 추격은 줄입니다.' },
        { id: 'slay',     name: '운반자 사냥', desc: '코어를 든 적을 쫓아 처치하고 코어를 빼앗습니다. 킬 자체는 점수가 아닙니다. 수집·보스 대응이 늦어지기 쉽습니다.' },
        { id: 'boss',     name: '보스',     desc: '보스와 회복팩을 우선해 한 방에 판을 뒤집습니다. 코어 수집은 덜 챙깁니다.' },
        { id: 'defend',   name: '수비 우선', desc: '무리하게 나서지 않고 우리 쪽 가까운 제출 지점 근처를 지키며 목숨을 아낍니다. 리드 중 굳히기에 적합합니다.' } ] },
      { id: 'boss', group: '운영', name: '보스 방침', neutral: 'smart', options: [
        { id: 'smart',   name: '상황 판단', desc: '점수 차를 보고 앞서면 스틸, 뒤처지면 적극 도전하고, 위치를 보고 합류·대기를 정합니다.' },
        { id: 'contest', name: '적극 도전', desc: '보스가 나오면 적극적으로 갑니다. 정도가 높을수록 더 많은 인원이 붙습니다.' },
        { id: 'yield',   name: '양보',     desc: '보스는 포기하고 코어 수집·제출에 집중합니다.' },
        { id: 'steal',   name: '스틸',     desc: '보스 구덩이 가장자리에서 대기하다 상대가 보스 체력을 깎으면 끼어들어 막타를 노립니다.' } ] },
      { id: 'formation', group: '운영', name: '병력 운용', neutral: 'auto', options: [
        { id: 'auto',  name: '자동',   desc: '코어 가치에 따라 자연스럽게 나뉩니다.' },
        { id: 'group', name: '집결',   desc: '셋이 함께 코어를 줍고 같이 이동합니다.' },
        { id: 'duo',   name: '짝 운영', desc: '가장 가까운 아군 2명이 함께 코어를 줍고, 나머지 1명은 따로 움직입니다. 둘이 멀어지면 짝이 풀립니다.' },
        { id: 'split', name: '분산',   desc: '셋이 각자 넓게 흩어져 코어를 탐색합니다.' } ] },
      { id: 'deposit', group: '운영', name: '제출 시점', neutral: 'normal', options: [
        { id: 'normal', name: '보통',     desc: '슬롯이 절반 이상 차면 제출하러 갑니다. 정도가 높을수록 더 모아서 갑니다.' },
        { id: 'early',  name: '즉시 제출', desc: '코어를 1~2개 모으면 바로 제출하러 갑니다. 정도가 높을수록 더 일찍 갑니다.' },
        { id: 'full',   name: '가득 채움', desc: '슬롯이 가득 차거나 주변이 안전할 때 제출합니다. 정도가 높을수록 오래 모읍니다.' } ] },
      { id: 'retreat', group: '운영', name: '열세 대응', neutral: 'careful', options: [
        { id: 'careful', name: '신중', desc: '수적·체력 열세면 무리한 교전을 피합니다.' },
        { id: 'brave',   name: '강행', desc: '불리해도 교전·보스를 밀어붙입니다.' } ] },
      { id: 'ultT', group: '운영', name: '팀 궁 기조', neutral: 'normal', options: [
        { id: 'normal', name: '기본',       desc: '개인 궁 지시가 우선. 없으면 효율 타이밍에 씁니다.' },
        { id: 'burst',  name: '즉시 투하',   desc: '쿨이 오면 빨리 쓰도록 팀 전체가 느슨한 조건을 씁니다.' },
        { id: 'save',   name: '한타·보스 보존', desc: '큰 교전·보스 타이밍까지 궁을 아낍니다.' },
        { id: 'clutch', name: '위기 대응',   desc: '아군이 위험할 때 쓰기 쉽게 맞춥니다.' } ] },
      /* 팀 교전 (신규): 모든 항목의 첫 선택지가 중립값이며 예전 동작과 같습니다. 정도(1~7)의 의미는 각 항목 설명 참고 */
      { id: 'gather', group: '교전', name: '진입 기준 인원', neutral: 'free', options: [
        { id: 'free',  name: '각자 이동', desc: '집결하지 않고 각자 목표로 움직입니다.' },
        { id: 'two',   name: '2명 집결', desc: '적이 가까우면 아군 2명이 모일 때까지 안전 지점에서 기다렸다가 같이 진입합니다. 제출 지점으로 향하는 아군은 기다리지 않습니다. 정도가 높을수록 더 바짝 모여야 합니다.' },
        { id: 'three', name: '3명 집결', desc: '3명이 모일 때까지 기다렸다가 전원이 같이 진입합니다. 정도가 높을수록 더 바짝 모여야 합니다.' } ] },
      { id: 'hurry', group: '교전', name: '성급함', neutral: 'normal', options: [
        { id: 'normal',  name: '보통', desc: '집결을 최대 약 5초 기다린 뒤 풀려서 교전합니다.' },
        { id: 'patient', name: '차분', desc: '집결을 더 오래 기다립니다. 정도가 높을수록 길어집니다(최대 약 15초).' },
        { id: 'rash',    name: '성급', desc: '집결을 빨리 포기하고 진입합니다. 정도가 높을수록 짧아집니다(최소 약 1.2초).' } ] },
      { id: 'focus', group: '교전', name: '팀 포커스 타깃', neutral: 'own', options: [
        { id: 'own',    name: '각자 판단', desc: '각자 가까운 적을 노립니다.' },
        { id: 'weak',   name: '약한 적',   desc: '팀 전체가 체력이 낮은 적을 먼저 노립니다. 정도가 높을수록 타깃을 강하게 따릅니다.' },
        { id: 'threat', name: '위협 큰 적', desc: '공격력과 위협도가 큰 적을 먼저 노립니다.' },
        { id: 'back',   name: '후열·지원',  desc: '후열 딜러와 보호막·강화를 쓰는 지원형 적을 먼저 노립니다.' } ] },
      { id: 'chain', group: '교전', name: '궁 연계', neutral: 'off', options: [
        { id: 'off',    name: '연계 없음', desc: '궁 타이밍은 각자의 궁 설정에 따릅니다.' },
        { id: 'follow', name: '같이 진입', desc: '아군이 궁을 쓰면 잠시 다른 아군의 궁 사용 문턱이 낮아지고 집결 대기가 풀려 함께 진입합니다. 정도가 높을수록 오래 지속됩니다.' } ] },
      { id: 'roleMove', group: '교전', name: '역할별 이동', neutral: 'free', options: [
        { id: 'free',  name: '각자', desc: '역할 구분 없이 움직입니다.' },
        { id: 'split', name: '역할 분담', desc: '전열이 먼저 들어가고 후열은 전열 뒤에서 간격을 유지하며, 암살자는 측면으로 우회합니다. 목표 지점 밖에서도 적을 따라가 싸웁니다. 정도가 높을수록 간격·우회 폭·추격 범위가 커집니다.' } ] },
      { id: 'podCycle', group: '교전', name: '회복팩 순환', neutral: 'off', options: [
        { id: 'off',   name: '각자', desc: '회복하러 가는 사람과 무관하게 움직입니다.' },
        { id: 'cover', name: '함께 물러남', desc: '아군이 회복팩을 먹으러 가면 나머지는 잠시 물러났다가 복귀 후 같이 재진입합니다. 정도가 높을수록 물러나 있는 시간이 깁니다.' } ] },
      { id: 'early', group: '시간대', name: '초반 (0~40초)', noLevel: true, neutral: 'follow', options: [] },
      { id: 'mid', group: '시간대', name: '중반 (40~100초)', noLevel: true, neutral: 'follow', options: [] },
      { id: 'late', group: '시간대', name: '후반 (100초~)', noLevel: true, neutral: 'follow', options: [] },
      { id: 'lead', group: '점수 차', name: '앞서면', neutral: 'keep', options: [
        { id: 'keep',   name: '유지',     desc: '기조를 바꾸지 않습니다.' },
        { id: 'turtle', name: '굳히기',   desc: '점수 차가 벌어지면 우리 쪽 제출 지점을 지키고 조기 제출로 전환하며 목숨을 아낍니다.' },
        { id: 'press',  name: '마무리',   desc: '점수 차가 벌어지면 처치 기조로 끝장을 봅니다.' } ] },
      { id: 'trail', group: '점수 차', name: '뒤처지면', neutral: 'keep', options: [
        { id: 'keep',   name: '유지',     desc: '기조를 바꾸지 않습니다.' },
        { id: 'gamble', name: '승부수',   desc: '보스가 있으면 보스, 없으면 운반자 사냥·제출 매복·조기 제출로 한 방을 노립니다.' },
        { id: 'steady', name: '차근 소모전', desc: '무리하지 않고 코어를 꾸준히 모아 제출하며 점수를 따라갑니다.' } ] },
      { id: 'react', group: '점수 차', name: '판단력', neutral: 'fixed', options: [
        { id: 'fixed', name: '지시 유지', desc: '정해 둔 기조를 끝까지 지킵니다. 코어·교전 판단은 선수 능력치대로 계속 작동합니다.' },
        { id: 'adapt', name: '점수·시간', desc: '점수 차와 남은 시간을 보고 기조 자체를 바꿉니다(지시보다 상황 우선).' },
        { id: 'smart', name: '적 읽기',   desc: '적의 보스 딜·불리한 교전 회피·보스 스틸·유인까지 봅니다.' } ] }
    ],
    p: {
      rushSpd: 0.025, rushDef: 0.02,
      retreatHp0: 0.3, retreatHpStep: 0.1, retreatBase: 5, retreatMul: 0.9, retreatAdd: 4,
      coopBias: 0.5, coopDmg: 0.018, supportBias: 0.65, assistWindow: 40, assistBase: 8, assistStep: 2.5,
      soloStick: 3, soloAtk: 0.02, soloAlone: 20,
      frontBase: 0.4, frontStep: 0.035, coverHide: 0.16, coverBack: 2, coverStep: 0.6, aimBias: 0.7, clutchHp0: 0.2, clutchHpStep: 0.06,
      mCollect: 0.5, mCollectV: 0.6, collectR0: 50, collectRStep: 25,
      mAmbush: 1.0, mAmbushOff: 0.25,
      mHunt: 0.7, mHuntOff: 0.2, mHuntAggro: 3, huntRange0: 40, huntRangeStep: 14, mHuntCarry: 0.2,
      mBoss: 0.9, mBossWait: 0.45, mBossOff: 0.3, bossRange0: 50, bossRangeStep: 25,
      escortFar: 13, escortStep: 1.2, escortCarry: 0.4, capperBias: 0.7,
      duoBreak: 60, duoBonus: 0.35, duoApart: 0.5,
      groupBonus: 0.45, splitPenalty: 0.9, retreatThr: 0.4, retreatThrStep: 0.04, podReach: 110
    }
  },

  /* ---------- AI 난이도 ----------
     파이터 개별 AI(이동·스킬·타게팅)는 모든 난이도에서 동일합니다. 난이도는 AI 팀이 짜는 팀 전략/개인 지시의 수준만 바꿉니다. */
  ai: {
    default: 'normal',
    levels: {
      easy:   { name: '쉬움',   desc: '코어를 보이는 대로 모아 빨리 제출합니다. 처치·매복은 하지 않고, 보스를 포기하며 상황 변화에 둔하고, 체력이 줄어도 버팁니다.' },
      normal: { name: '보통',   desc: '흩어져 코어를 모으며 점수·시간을 보고 기조를 바꿉니다.' },
      hard:   { name: '어려움', desc: '전열은 수집, 암살자는 처치로 임무를 나누고 짝을 지어 움직입니다. 적의 보스 교전을 읽어 스틸·유인으로 대응합니다.' },
      master: { name: '마스터', desc: '상대 편성에 맞춰 기조를 정하고, 점수 차에 따라 수비·약탈을 전환하며, 보스를 가로채고 서든데스까지 계산해 움직입니다.' }
    }
  },

  /* ---------- 전투 ---------- */
  /* ---------- 경기 중 지휘(지시) ----------
     지휘 포인트(CP)를 써서 팀/개인에게 지시합니다. 지시는 반응 지연 뒤 적용되고 지속 시간이 지나면 자동(설정한 전술)으로 돌아옵니다. */
  orders: {
    cpMax: 3, cpStart: 2, regenSec: 15,
    teamSec: 15, unitSec: 12, recallSec: 3,
    delay: { min: 0.5, max: 2 },
    ai: {                                                                 // AI 지휘: every 판단 간격(초) · p 지시 확률 · keep 아껴 둘 CP
      easy: { every: 6, p: 0.3, keep: 1 }, normal: { every: 4, p: 0.55, keep: 0 },
      hard: { every: 2.5, p: 0.8, keep: 0 }, master: { every: 1.5, p: 1, keep: 0 }
    },
    team: [
      { id: 'boss', name: '보스 총공', icon: '👹', cost: 1, desc: '전원이 보스를 공격합니다.' },
      { id: 'bossWait', name: '보스 길목 대기', icon: '🕓', cost: 1, desc: '중앙에서 기다리다 상대가 보스 체력을 깎으면 가로챕니다.' },
      { id: 'wave', name: '웨이브 선점', icon: '🌊', cost: 1, desc: '아는 코어(큰 코어 우선)를 전원이 먼저 줍습니다.' },
      { id: 'convoy', name: '제출 호송', icon: '🛡', cost: 1, desc: '셋이 붙어 코어를 든 아군을 호위하고 일찍 제출합니다.' },
      { id: 'ambush', name: '길목 매복', icon: '🕸', cost: 1, desc: '상대 제출 지점 길목에서 기다립니다.' },
      { id: 'kill', name: '운반자 사냥', icon: '🎯', cost: 1, desc: '코어를 든 적을 우선 노립니다.' },
      { id: 'retreat', name: '후퇴', icon: '↩', cost: 1, desc: '우리 제출 지점으로 물러나 수비합니다.' },
      { id: 'regroup', name: '중앙 집결', icon: '✚', cost: 1, desc: '중앙에 모입니다.' }
    ],
    unit: [
      { id: 'core', name: '코어 줍기', icon: '◆', cost: 1, desc: '가장 가까운 코어를 줍습니다.' },
      { id: 'deposit', name: '지금 제출', icon: '⬇', cost: 1, desc: '들고 있는 코어를 바로 제출하러 갑니다.' },
      { id: 'escort', name: '호위', icon: '🛡', cost: 1, target: 'ally', desc: '지정한 아군을 따라다니며 지킵니다.' },
      { id: 'hunt', name: '사냥', icon: '🎯', cost: 1, target: 'foe', desc: '지정한 적을 쫓습니다.' },
      { id: 'ambush', name: '매복', icon: '🕸', cost: 1, desc: '상대 제출 지점 길목에서 기다립니다.' },
      { id: 'pod', name: '회복', icon: '✚', cost: 1, desc: '가까운 회복 펄스로 갑니다.' },
      { id: 'ultNow', name: '궁 즉발', icon: '⚡', cost: 1, desc: '궁극기가 준비되면 바로 씁니다.' },
      { id: 'ultHold', name: '궁 대기', icon: '⏸', cost: 1, desc: '지시가 끝날 때까지 궁극기를 아낍니다.' }
    ]
  },

  battle: {
    tickMs: 50, maxTicks: 3600, retargetTicks: 12,
    arena: { w: 225, h: 150 }, unitRadius: 2.2,
    aggro: 26,
    respawn: { base: 6, perDeath: 1.5, max: 14, protect: 2 },
    damage: { variance: 0.08 },
    hpScale: 1.45,
    speeds: [1, 2, 4],
    mana: { regenPerSec: 0.05, onHit: 4, onHurt: 3, startRatio: 0.4 },
    map: {
      killPoints: 0, acePoints: 0,
      core: MAP_CORE,
      bonus: { first: 0, cap: 0, shut: 0, shutAt: 3 },
      gate: { base: 2.5, patientStep: 0.6, rashMin: 0.8, rashStep: 0.25, threeMax: 3 },
      sudden: { hpRatio: 0.35, maxTicks: 1200, protect: 3, pressSec: 30 },
      spawns: [ { pts: [[20, 125], [28, 130], [21, 133]] }, { pts: [[205, 25], [197, 20], [204, 17]] } ],
      zones: MAP_ZONES,
      lanes: MAP_ROADS,
      jungles: [], parks: MAP_PARKS,
      obstacles: MAP_OBSTACLES,
      pods: [
        { x: 14,    y: 14,  heal: 0.4, cd: 20, big: true }, { x: 211,   y: 136, heal: 0.4, cd: 20, big: true },
        { x: 112.5, y: 10,  heal: 0.4, cd: 20, big: true }, { x: 112.5, y: 140, heal: 0.4, cd: 20, big: true },
        { x: 10,    y: 75,  heal: 0.4, cd: 20, big: true }, { x: 215,   y: 75,  heal: 0.4, cd: 20, big: true },
        { x: 62,    y: 105, heal: 0.3, cd: 20 },            { x: 163,   y: 45,  heal: 0.3, cd: 20 }
      ],
      bosses: [
        { kind: 'mid',  def: 'golem', at: 40, warn: 8, hpMul: 1 },
        { kind: 'late', def: 'titan', after: 40, warn: 8, hpMul: 1 }
      ],
      lairs: [ { x: MAP_CX, y: MAP_CY } ]
    },
    skillStartCdRatio: 0.3, ultStartCdRatio: 0.4
  },

  /* ---------- 리그 ----------
     6개 리그: 난이도(AI 팀 전술 수준)가 다릅니다. 전투 캐릭터 능력치 보정(bonus·시즌 성장)은 없습니다. 플레이어는 감독이 되어 리그의 팀 하나를 고릅니다.
     정규시즌 rounds 라운드 → 중간(midRound)에 MSI → 시즌 종료 후 플레이오프 → 월드 챔피언십. 국제대회는 리그별 상위 intlTeams 팀이 참가합니다. */
  league: {
    teamCount: 12, rounds: 24, midRound: 12,           // 12팀 더블 라운드로빈(22) + 2라운드 = 팀당 24경기
    ptsWin: 3, ptsDraw: 1, ptsLoss: 0,
    playoffTeams: 8, intlTeams: 4,
    aiFavorites: 5,                                   // AI 팀이 선호하는 파이터 수
    roundNames: { 2: '결승', 4: '준결승', 8: '8강', 16: '16강', 32: '32강' },
    bestOf: { playoff: { 2: 3 }, msi: { 2: 3, 4: 3 }, worlds: { 2: 3, 4: 3 } },      // 대회별 라운드 크기(2=결승, 4=준결승)의 판 수. 2판 이상이면 피어리스(앞 세트에서 나온 파이터 사용 불가)
    playoffName: '플레이오프',
    intl: { msi: { name: 'MSI', full: '미드시즌 인비테이셔널' }, worlds: { name: '월드 챔피언십', full: '월드 챔피언십' } },
    cupRules: [   // 국제대회 때 무작위 1개 적용. hpMul atkMul apMul defMul spdMul aspdMul mpMul
      { name: '저중력 경기장', desc: '이동속도 +30%', spdMul: 1.3 },
      { name: '과부하 코어',   desc: '공격력·주문력 +15% / 체력 -10%', atkMul: 1.15, apMul: 1.15, hpMul: 0.9 },
      { name: '마나 폭풍',     desc: '마나 회복 2배', mpMul: 2 },
      { name: '가속 필드',     desc: '공격속도 +25%', aspdMul: 1.25 },
      { name: '강화 장갑',     desc: '방어력·저항력 +30%', defMul: 1.3 }
    ]
  },
  leagues: [
    { id: 'sea', name: '동남아', short: 'SEA', color: '#34d399', diff: 'easy', desc: '입문 리그. AI 팀의 전술이 단순합니다.',
      teams: ['방콕 나가', '자카르타 가루다', '마닐라 아길라', '쿠알라룸푸르 트윈', '싱가포르 머라이언', '하노이 롱', '호치민 사이공', '세부 코랄', '발리 서프', '치앙마이 오키드', '프놈펜 앙코르', '양곤 파고다'] },
    { id: 'jp', name: '일본', short: 'JP', color: '#f472b6', diff: 'normal', desc: '균형 잡힌 AI. 점수와 시간을 보고 기조를 바꿉니다.',
      teams: ['도쿄 사쿠라', '오사카 쇼군', '교토 토리이', '요코하마 미나토', '나고야 샤치', '삿포로 유키', '후쿠오카 하카타', '센다이 다테', '고베 카이', '히로시마 모미지', '나라 시카', '가나자와 킨'] },
    { id: 'na', name: '북미', short: 'NA', color: '#60a5fa', diff: 'normal', desc: '다양한 편성이 나오는 리그. 변수가 많습니다.',
      teams: ['로스앤젤레스 코멧', '뉴욕 타이탄', '시카고 윈드', '시애틀 레인', '토론토 노스', '댈러스 아웃로', '마이애미 플레어', '보스턴 패트리어트', '덴버 서밋', '애틀랜타 피치', '밴쿠버 오션', '피닉스 듄'] },
    { id: 'eu', name: '유럽', short: 'EU', color: '#a78bfa', diff: 'hard', desc: '적의 움직임을 읽고 보스를 가로채는 영리한 AI.',
      teams: ['베를린 발키리', '런던 나이츠', '파리 에클레르', '마드리드 솔라', '로마 센츄리온', '암스테르담 오션', '스톡홀름 아이스', '바르샤바 이글스', '프라하 클락', '빈 심포니', '리스본 카라벨', '코펜하겐 바이킹'] },
    { id: 'cn', name: '중국', short: 'CN', color: '#f87171', diff: 'hard', desc: '전술이 날카로운 강팀들의 리그.',
      teams: ['상하이 드래곤즈', '베이징 피닉스', '광저우 타이거즈', '선전 사이버', '청두 판다 크루', '항저우 네오', '우한 썬더', '시안 레전드', '난징 블레이드', '충칭 인페르노', '톈진 글로리', '칭다오 웨이브'] },
    { id: 'kr', name: '한국', short: 'KR', color: '#fbbf24', diff: 'master', desc: '최고 난이도. 편성을 읽고 승부수와 굳히기를 정확히 합니다.',
      teams: ['서울 아스트라', '부산 오로라', '인천 노바', '대구 베가', '광주 시리우스', '대전 퀘이사', '울산 헬리오스', '수원 스펙트라', '제주 루나', '전주 오리온', '창원 파이로', '성남 비전'] }
  ],
  news: {
    analysis: {                                       // 경기 후 전투 분석 칼럼 (News.analysis)
      mode: 'chance',                                 // 'all' 내 경기 전부 · 'important' 중요 경기만 · 'chance' 중요 경기 + 일반 경기는 확률 · 'off' 끔
      chance: 0.4,                                    // mode 'chance' 일 때 일반 경기에서 생성될 확률
      bigDiff: 6,                                     // 최종 점수 차가 이 값 이상이면 중요 경기 (플레이오프·MSI·월즈·서든데스는 항상 중요)
      fightSec: 10, fightMin: 3,                      // 한타 판정: 이 시간(초) 안에 처치가 이 수 이상
      leadGap: 3,                                     // 이 점수 차 이상 앞섰다가/뒤졌다가 뒤집히면 '역전' 으로 서술
      slumpDeaths: 3, slumpShare: 0.2, slumpDeath: 0.15,   // 부진 판정: 데스 수 · 팀 기여도 하한 · 데스 1회당 기여도 감점
      tankShare: 0.4,                                 // 받은 피해가 팀 전체의 이 비율 이상이면 전열 서술
      rushDeaths: 3, deathsHigh: 6, ultLow: 1,        // 개인 지시 실패 데스 수 · 팀 데스 많음 · 궁극기 사용 적음 기준
      maxTactic: 2, maxTask: 2,                       // 전술 평가의 개인 지시 문장 수 · 다음 과제 문장 수
      counter: {                                      // 상성표: 키 역할이 값 역할들에게 유리 (밴픽 카운터 서술용)
        assassin: ['mage', 'hunter'], mage: ['hunter', 'warrior'], hunter: ['warrior', 'guardian'],
        warrior: ['guardian', 'assassin'], guardian: ['assassin', 'mage']
      }
    }
  },
  trophies: {
    league: { name: '리그 우승', icon: '🏆' },
    msi:    { name: 'MSI 우승', icon: '🥇' },
    worlds: { name: '월드 챔피언십 우승', icon: '👑' }
  },

  /* ---------- 전투 AI 지능 단계 (프로게이머 C~S급) ----------
     파이터 개별 전투 AI 의 '판단력'입니다. 팀 전체는 teams[i].brain, 파이터별은 teams[i].brains[idx] 에 'C'|'B'|'A'|'S' 를 넣으면 됩니다. 기본은 default.
     chaseT: 도망가는 적을 따라잡지 못하고 쫓는 최대 시간(초)  leash: 쫓는 최대 거리  retreatHp: 이 체력 비율 아래면 즉시 후퇴·재정비
     ratio: 주변 적 전력 ÷ 아군 전력이 이 값을 넘으면 싸우지 않고 기다림(99=판단 안 함)  podRun: 체력이 낮을 때 이 거리 안의 힐팩이 있으면 교전 중에도 먹으러 감
     ensureBoss: 모두가 추격에 몰려도 보스 타이밍에는 한 명은 중앙으로  waitPod: 회복 장치가 다시 나올 때까지 기다렸다 회복 */
  brain: {
    default: 'A',
    /* 등급별 기본 행동. 등급 사이 격차는 일부러 작게 두었습니다(C급도 S급을 이길 수 있게).
       시험 결과 '무조건 조심스러운' 설정(열세 시 대기·이른 후퇴)은 승률이 오히려 낮아, 등급 차이를 소극성이 아닌 수집·회복·스킬 회전의 효율로 두었습니다.
       실제 차이는 아래 stat 의 세부 능력치(선수마다 다름)에서 생깁니다.
       chaseT/leash: 추격 시간·거리  retreatHp: 후퇴 체력비  ratio: 수적·전력 열세 허용 배율(클수록 무모)
       podRun: 교전 중 회복 장치로 달려가는 거리  ensureBoss: 보스 타이밍 놓치지 않기  waitPod: 회복 장치 대기
       skillPatience: 쿨타임이 돈 스킬을 '더 좋은 순간'을 기다리는 시간(초) — 짧을수록 스킬 회전이 빠릅니다(시험 결과 빠를수록 유리)
       recastHold: 재시전을 기다리는 신중함(초) */
    levels: {
      C: { name: 'C급', desc: '오래 쫓다가 보스 타이밍을 놓치기 쉽고, 스킬 타이밍이 늦습니다.',
           chaseT: 8, leash: 48, retreatHp: 0.21, ratio: 3.2, podRun: 16, ensureBoss: false, waitPod: false, skillPatience: 2.4, recastHold: 0.9 },
      B: { name: 'B급', desc: '적당히 쫓다 돌아오고, 힐팩을 가끔 챙깁니다.',
           chaseT: 7, leash: 44, retreatHp: 0.22, ratio: 3.4, podRun: 28, ensureBoss: false, waitPod: false, skillPatience: 2.0, recastHold: 0.95 },
      A: { name: 'A급', desc: '보스 타이밍을 챙기고, 스킬을 비교적 빠르게 돌립니다.',
           chaseT: 6, leash: 40, retreatHp: 0.22, ratio: 3.6, podRun: 40, ensureBoss: true, waitPod: false, skillPatience: 1.6, recastHold: 1.0 },
      S: { name: 'S급', desc: '보스 타이밍과 회복 장치를 놓치지 않고, 스킬을 쿨이 돌자마자 씁니다.',
           chaseT: 5.5, leash: 38, retreatHp: 0.23, ratio: 3.8, podRun: 50, ensureBoss: true, waitPod: true, skillPatience: 1.3, recastHold: 1.1 }
    },
    /* 선수 세부 능력치 → 전투 행동 보정.
       능력치 값을 (값 - center) / range 로 -1~+1 로 바꾼 뒤, 아래 항목을 [행동값, 'mul'(곱: 1 + k*n) | 'add'(더하기: k*n), k] 로 적용합니다.
       항목을 고치거나 추가하면 자동 반영됩니다. defaults 는 등급 값에 없는 행동의 기본값입니다. */
    stat: {
      center: 65, range: 35,
      defaults: { finish: 0, assist: 0, whiff: 0.05, ultWait: 6, retargetMul: 1, moodGuard: 0 },
      whiffKinds: ['nuke', 'pierce', 'aoe', 'charge'],          // 스킬샷 정확도가 영향을 주는 스킬 종류 (대상이 있는 공격 스킬)
      limits: { finish: [0, 0.4], assist: [0, 0.3], retreatHp: [0.1, 0.55], ratio: [1.05, 6], leash: [18, 80], chaseT: [1.2, 14], podRun: [0, 90], skillPatience: [0.5, 4], recastHold: [0.3, 1.6], whiff: [0, 0.22], ultWait: [2.5, 12], retargetMul: [0.5, 1.5], moodGuard: [-0.25, 0.4] },
      fx: {
        judge:  [['chaseT', 'mul', -0.12], ['skillPatience', 'add', -0.4]],
        posn:   [['retreatHp', 'add', 0.04]],
        obj:    [['podRun', 'mul', 0.15]],
        team:   [['assist', 'add', 0.15]],
        react:  [['retargetMul', 'mul', -0.25]],
        aim:    [['whiff', 'add', -0.09]],
        ult:    [['ultWait', 'add', -3]],
        fight:  [['finish', 'add', 0.25]],
        clutch: [['moodGuard', 'add', 0.4]]
      },
      objHi: 75, objLo: 40,
      dg: { reach: 55, reachJ: 0.3, reachO: 0.15, base: 3.2, val: 1, dist: 40, margin: 0.6, marginJ: 0.5, hold: 2.5, cool: 3, guardR: 22, guardPen: 1.0, contest: 1.0, race: 0.6, hitSec: 1, holdOdds: 1.2, oddsStay: 0.75, openStay: 1.2, avoidStay: 1.2, aggroWin: 4, winLim: 0.35, needLim: 0.3, depMargin: 0.8, depMarginJ: 0.5, needDep: 1.4, flipDep: 2, distPen: 0.03, distPenO: 0.3, carryW: 0.35, senseO: 0.35, foeJ: 10, mateR: 8, noise: 0.4, biasSec: 2, safeP: 6, stale: 1.5, extend: 4 },
      sit: { refresh: 0.6, refreshR: 0.4, noise: 0.35, ultW: 0.25, respawn: 0.22, winSec: 4, open: 0.28, avoid: 0.28, openJ: 0.35, needBase: 2, needLeft: 4, needC: 0.3 }
    }
  },

  /* ---------- 프로게이머 / 구단 ----------
     등급(C~S)은 전투 AI 지능 단계(CONFIG.brain)와 같습니다. 1번/2번/3번 라인업 = 첫째/둘째/셋째 픽 파이터를 맡는 선수 */
  pro: {
    grades: {
      C: { name: 'C급', color: '#94a3b8', salary: [200, 420],   ovr: [32, 50] },
      B: { name: 'B급', color: '#60a5fa', salary: [500, 1000],  ovr: [51, 65] },
      A: { name: 'A급', color: '#c084fc', salary: [1700, 3100], ovr: [66, 80] },
      S: { name: 'S급', color: '#fbbf24', salary: [4400, 7200], ovr: [81, 92] }
    },
    /* 잠재력(pot): 나이별 ovr 위 여유폭. gemChance 확률로 gemMul 배 '대형 유망주'. premium: pot 이 ovr 보다 1 높을 때마다 연봉 가산(최대 premiumMax) */
    potential: {
      gap: [[19, [8, 22]], [21, [5, 16]], [23, [3, 11]], [25, [1, 6]], [27, [0, 3]], [99, [0, 1]]],
      gemChance: 0.1, gemMul: 1.5, cap: 99, premium: 0.008, premiumMax: 0.25
    },
    /* 시즌 성장: age 는 [최대나이, [최소, 최대]] 구간. 출전 비율·팀 순위·멘탈이 성장폭을 조정하고, 성장은 pot 을 넘지 못합니다. 승급은 매우 드뭅니다 */
    growth: {
      age: [[19, [2, 5]], [22, [1, 4]], [25, [0, 2]], [29, [0, 1]], [32, [-1, 0]], [99, [-2, -1]]],
      seasonsToReveal: 2,
      playHi: 0.6, playHiMul: 1.25, playLo: 0.2, playLoMul: 0.45,
      rankTop: 4, rankTopMul: 1.1, rankLow: 9, rankLowMul: 0.85, mentalHi: 80, mentalHiMul: 1.1,
      promoteMargin: 3, promoteChance: 0.25
    },
    /* 성장 유형(arc): 선수마다 랜덤 배정. w=가중치, shift=나이 곡선 이동(+면 일찍 꺾임, -면 늦게 꺾임), up/down=성장·하락 배율, vol=시즌마다 ±흔들림,
       potMul=잠재 여유폭 배율, spikes=[{ages:[최소,최대], chance, d:[최소,최대]}] 시즌마다 확률로 터지는 급성장/급락. 선수 개인 편차(shx ±2)가 추가로 붙어 유형 조합이 매우 다양해집니다 */
    arcs: [
      { id: 'steady',    name: '정석형',     icon: '📈', w: 26, shift: 0,  up: 1,   down: 1,   vol: 0,   potMul: 1,   spikes: [], desc: '나이에 맞게 무난하게 성장하고 하락합니다.' },
      { id: 'prodigy',   name: '천재 소년',   icon: '🌟', w: 6,  shift: 3,  up: 1.4, down: 1.1, vol: 0.3, potMul: 1.3, spikes: [], desc: '빠르게 성장하지만 일찍 정점을 찍고 내려옵니다.' },
      { id: 'late',      name: '대기만성',   icon: '🌱', w: 8,  shift: -4, up: 1.1, down: 0.7, vol: 0.2, potMul: 1.2, spikes: [], desc: '늦게 피어 오래 정점을 유지합니다.' },
      { id: 'flash',     name: '반짝 스타',   icon: '⚡', w: 6,  shift: 4,  up: 1,   down: 1.2, vol: 0.5, potMul: 1.4, spikes: [{ ages: [18, 23], chance: 0.45, d: [3, 6] }, { ages: [25, 40], chance: 0.5, d: [-4, -2] }], desc: '어린 나이에 폭발하지만 오래가지 못합니다.' },
      { id: 'iron',      name: '철인',       icon: '🛡️', w: 8,  shift: -5, up: 0.9, down: 0.5, vol: 0,   potMul: 0.9, spikes: [], desc: '나이를 먹어도 거의 떨어지지 않습니다.' },
      { id: 'fragile',   name: '유리몸',     icon: '💔', w: 6,  shift: 3,  up: 1,   down: 1.6, vol: 0.8, potMul: 1,   spikes: [], desc: '피로가 쌓이면 빠르게 무너집니다.' },
      { id: 'roller',    name: '롤러코스터',  icon: '🎢', w: 8,  shift: 0,  up: 1,   down: 1,   vol: 2.6, potMul: 1.1, spikes: [], desc: '시즌마다 성적 기복이 큽니다.' },
      { id: 'grinder',   name: '노력파',     icon: '💪', w: 8,  shift: -1, up: 1.2, down: 0.8, vol: 0,   potMul: 1,   spikes: [], desc: '꾸준히 뛰면 끝까지 성장합니다.' },
      { id: 'plateau',   name: '조기 정체',   icon: '🧱', w: 6,  shift: 0,  up: 0.5, down: 0.6, vol: 0,   potMul: 0.6, spikes: [], desc: '성장 폭이 작은 대신 안정적입니다.' },
      { id: 'comeback',  name: '부활형',     icon: '🔥', w: 5,  shift: 0,  up: 1,   down: 1,   vol: 0.4, potMul: 1,   spikes: [{ ages: [26, 34], chance: 0.3, d: [2, 4] }], desc: '전성기가 지난 뒤 부활하기도 합니다.' },
      { id: 'vet',       name: '노련미',     icon: '🎖️', w: 6,  shift: -3, up: 1,   down: 0.6, vol: 0,   potMul: 0.9, spikes: [], desc: '경험으로 버티며 천천히 하락합니다.' },
      { id: 'bloom',     name: '늦깎이 폭발', icon: '💥', w: 4,  shift: -2, up: 1,   down: 0.9, vol: 0.4, potMul: 1.1, spikes: [{ ages: [23, 29], chance: 0.3, d: [3, 6] }], desc: '어느 시즌 갑자기 한 단계 도약합니다.' }
    ],
    /* 선수 만족도: 출전 · 팀 성적 · 연봉 대우 · 성장 · 성향. 재계약 거부 / 이적 요구 기준 */
    morale: {
      base: 52, play: 60, team: 24, pay: 60, payMin: -20, payMax: 12, title: 8, growth: 3, growthMax: 8, trouble: 8,
      refuseBelow: 45, demandBelow: 30, demandChance: 0.6, demandMax: 1, demandFeeMul: 1.0,
      benchFloor: 12, recover: 0.35, recoverStep: 2, recoverMax: 14
    },
    styles: [ { id: 'balanced', name: '균형형' }, { id: 'capture', name: '힐 장악형' }, { id: 'slay', name: '교전형' }, { id: 'objective', name: '오브젝트형' }, { id: 'defend', name: '수비형' } ],
    contract: [1, 3],
    /* 세부 능력치 (선수 카드 뒷면). 항목을 추가/삭제하려면 이 목록만 고치면 자동 반영됩니다 */
    skills: [
      { id: 'aim',    name: '스킬샷 정확도', icon: '🎯', desc: '대상을 노리는 공격 스킬이 빗나갈 확률이 줄어듭니다' },
      { id: 'judge',  name: '판단력',        icon: '🧠', desc: '상황을 정확히 읽고 빠르게 결정합니다 — 점수·전력 판단, 코어 쟁탈 가능성, 한타 개시·회피, 교전 중 코어 이탈' },
      { id: 'fight',  name: '교전 능력',     icon: '⚔️', desc: '체력이 깎인 적을 놓치지 않고 마무리합니다(캐릭터 능력치에는 영향 없음)' },
      { id: 'react',  name: '반응속도',      icon: '⚡', desc: '상황 변화를 읽는 주기와 목표 전환 속도 — 약해진 적을 빨리 노리고 판단 갱신이 빠릅니다' },
      { id: 'posn',   name: '포지셔닝',      icon: '📍', desc: '위험해지기 전에 물러나는 체력·거리 기준 — 높을수록 일찍 빠집니다' },
      { id: 'ult',    name: '궁극기 운용',   icon: '💥', desc: '궁극기를 좋은 때를 기다리지 않고 더 일찍 씁니다' },
      { id: 'obj',    name: '오브젝트·회복', icon: '🚩', desc: '코어를 더 멀리서 찾고 제출 타이밍을 잘 잡으며, 보스·힐팩도 놓치지 않습니다' },
      { id: 'team',   name: '팀워크',        icon: '🤝', desc: '아군 위치·전력을 넓게 읽고 한타를 함께 엽니다 — 아군을 때린 적을 먼저 견제합니다' },
      { id: 'clutch', name: '클러치·침착성', icon: '🧊', desc: '점수가 밀릴 때 더 빨리 승부를 걸고, 낮은 폼·멘탈이 AI 판단에 주는 악영향을 줄여줍니다' }
    ],
    /* 교전 스타일: 선수 본인 평균 대비 강점이 가중합으로 가장 크게 나타나는 쪽으로 자동 결정 */
    engage: [
      { id: 'initiator', name: '선제 돌입형', desc: '먼저 파고들어 교전을 엽니다', w: { fight: 0.5, react: 0.3, clutch: 0.2 } },
      { id: 'counter',   name: '카운터형',    desc: '상대 진입을 받아치는 데 능합니다', w: { judge: 0.45, posn: 0.3, react: 0.25 } },
      { id: 'poke',      name: '견제·포킹형', desc: '거리를 두고 스킬로 체력을 깎습니다', w: { aim: 0.55, posn: 0.3, judge: 0.15 } },
      { id: 'safe',      name: '안정 교전형', desc: '아군과 보조를 맞추며 손해를 피합니다', w: { team: 0.4, judge: 0.3, posn: 0.3 } },
      { id: 'allin',     name: '올인 돌격형', desc: '궁극기와 함께 승부를 거는 공격형입니다', w: { fight: 0.4, ult: 0.4, clutch: 0.3, judge: -0.1 } }
    ],
    /* 희귀도: 모든 능력치가 perfectMin 이상이면 '완벽한 재능', 평균이 aceAvg 이상이면 '에이스'. perfectChance 는 등급별 완벽 재능 확률 */
    rarity: { perfectMin: 86, aceAvg: 88 },
    skillGen: { perfectChance: { S: 0.015, A: 0, B: 0, C: 0 }, specialistChance: 0.15 },     // 완벽한 재능은 S급 중 1.5%만 / 특화 재능은 전 등급 15%
    aiMix: { easy: { C: 0.55, B: 0.4, A: 0.05, S: 0 }, normal: { C: 0.3, B: 0.45, A: 0.22, S: 0.03 }, hard: { C: 0.1, B: 0.4, A: 0.4, S: 0.1 }, master: { C: 0.03, B: 0.27, A: 0.5, S: 0.2 } },
    /* 시장: 등급이 높을수록 이적료·계약금·재계약금 배율이 커집니다. faMix = 난이도별 FA 등급 분포, faMaxS = FA 시장에 동시에 나오는 S급 상한 */
    market: {
      faSize: 16, listedSize: 6, refreshRounds: 6,
      feeMul: { C: [1.3, 2.0], B: [1.5, 2.4], A: [1.9, 3.0], S: [2.4, 3.8] },
      signMul: { C: 0.3, B: 0.4, A: 0.55, S: 0.8 },
      sellMul: { C: 0.9, B: 1.1, A: 1.4, S: 1.8 }, sellMinRoster: 3, sellMax: 2,   /* 판매가 = 시장 연봉 × sellMul / 선수단 최소 인원 / 시즌당 판매 상한(0=무제한) */
      releaseMul: 0.5, renewMul: { C: 0.25, B: 0.3, A: 0.4, S: 0.5 }, renewRaise: 0.08, renewMarket: 0.85,
      faMix: { easy: { C: 0.55, B: 0.4, A: 0.05, S: 0.0 }, normal: { C: 0.4, B: 0.38, A: 0.19, S: 0.03 }, hard: { C: 0.22, B: 0.38, A: 0.3, S: 0.1 }, master: { C: 0.12, B: 0.33, A: 0.38, S: 0.17 } },
      faMaxS: { easy: 0, normal: 1, hard: 1, master: 2 }
    },
    names: {
      nick: ['Vex', 'Noir', 'Rin', 'Kairos', 'Mizu', 'Hana', 'Zephyr', 'Lumi', 'Orca', 'Draco', 'Nova', 'Echo', 'Jett', 'Kuro', 'Sora', 'Ryu', 'Blitz', 'Cipher', 'Dusk', 'Ember', 'Frost', 'Glitch', 'Haze', 'Iris', 'Jinx', 'Kite', 'Lynx', 'Mako', 'Nyx', 'Onyx', 'Pixel', 'Quill', 'Raze', 'Sable', 'Talon', 'Umbra', 'Volt', 'Wisp', 'Xeno', 'Yuki', 'Zero', '하늘', '새벽', '라온', '도윤', '시우', '바람', '하랑', '이든', '로아', '태오', '아린', '단비', '누리', '한결', '보람', '가온', '다온'],
      tail: ['Jr', 'X', '7', '99'],
      sur: ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍'],
      given: ['민준', '서준', '도윤', '시우', '주원', '하준', '지호', '준우', '현우', '예준', '건우', '우진', '선우', '지훈', '승현', '유찬', '태윤', '은우', '이안', '정우'],
      nation: {
        kr:  { nick: ['Haneul', 'Baram', 'Dokkaebi', 'Sunwoo', 'Byeol', 'Mirae', 'Hwarang', 'Seol', 'Garam', 'Nuri'] },
        jp:  { nick: ['Kaze', 'Tsuki', 'Hayate', 'Shinobi', 'Kitsune', 'Sakura', 'Raiden', 'Yuki', 'Ronin', 'Akatsuki'],
               sur: ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤'], given: ['蓮', '翔', '大和', '陽翔', '悠真', '颯太', '湊', '樹', '拓海', '蒼'] },
        cn:  { nick: ['Longwei', 'Xingyao', 'Tianlang', 'Feiyan', 'Baihu', 'Qilin', 'Yunfei', 'Mochen', 'Zhanlu', 'Fenghuang'],
               sur: ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴'], given: ['浩然', '子轩', '宇航', '思远', '俊杰', '梓睿', '天宇', '明哲', '博文', '嘉豪'] },
        sea: { nick: ['Naga', 'Garuda', 'Harimau', 'Bayan', 'Kris', 'Lotus', 'Mekong', 'Typhoon', 'Rimau', 'Surya'],
               sur: ['Nguyen', 'Tran', 'Le', 'Pham', 'Somchai', 'Wong', 'Santos', 'Tan', 'Lim', 'Reyes'], given: ['Minh', 'Anh', 'Duc', 'Bao', 'Khoa', 'Arif', 'Rizky', 'Nattapon', 'Jericho', 'Kai'] },
        na:  { nick: ['Maverick', 'Ranger', 'Outlaw', 'Rocket', 'Stetson', 'Titan', 'Hawk', 'Bronco', 'Rebel', 'Ghost'],
               sur: ['Smith', 'Johnson', 'Miller', 'Davis', 'Garcia', 'Martinez', 'Anderson', 'Taylor', 'Moore', 'Clark'], given: ['Ethan', 'Mason', 'Logan', 'Noah', 'Tyler', 'Jordan', 'Caleb', 'Ryan', 'Diego', 'Austin'] },
        eu:  { nick: ['Viking', 'Valkyrie', 'Baron', 'Rapier', 'Sigurd', 'Aegis', 'Fjord', 'Gallus', 'Nordic', 'Templar'],
               sur: ['Müller', 'Jensen', 'Kowalski', 'Rossi', 'Novak', 'Dubois', 'Larsen', 'Silva', 'Ivanov', 'Andersson'], given: ['Lukas', 'Mikkel', 'Jan', 'Marco', 'Pierre', 'Erik', 'Tomas', 'Luca', 'Henrik', 'Matteo'] }
      },
      leagueMix: {
        kr:  { kr: 0.9, cn: 0.05, sea: 0.03, jp: 0.02 },
        cn:  { cn: 1 },
        jp:  { jp: 0.84, kr: 0.12, cn: 0.04 },
        sea: { sea: 0.62, kr: 0.2, jp: 0.06, cn: 0.06, na: 0.03, eu: 0.03 },
        na:  { na: 0.5, kr: 0.22, eu: 0.12, cn: 0.1, sea: 0.06 },
        eu:  { eu: 0.45, kr: 0.2, na: 0.12, cn: 0.15, sea: 0.04, jp: 0.04 }
      },
      foreignMax: { kr: 1, cn: 0, jp: 1, sea: 2, na: 2, eu: 2 }
    }
  },

  /* 스폰서/광고: 평판이 높을수록 제안 확률·금액↑. 수락 시 즉시 입금 */
  sponsor: {
    minRep: 55,                 // 이 미만이면 제안 안 옴
    cooldownRounds: 3,          // 제안/계약 후 최소 간격(라운드)
    chance: [                   // 평판 구간별 제안 확률
      { rep: 55, p: 0.18 },
      { rep: 70, p: 0.32 },
      { rep: 85, p: 0.48 }
    ],
    // 금액 = base * leagueMul * tierMul * (0.85~1.15 랜덤)
    base: 400,
    tierMul: [
      { rep: 55, mul: 1.0, label: '소형 광고' },
      { rep: 70, mul: 1.8, label: '공식 스폰서' },
      { rep: 85, mul: 3.0, label: '메인 스폰서' }
    ],
    leagueMul: { easy: 0.85, normal: 1, hard: 1.15, master: 1.3 },
    brands: [
      '네뷸라 에너지', '오비트 기어', '퀀텀칩', '스타링크 모바일', '코스믹 드링크',
      '갤럭시 뱅크', '하이퍼카 코리아', '루나 스포츠', '에이펙스 헤드셋', '보이드 스트리밍'
    ]
  },
  /* 팬 · 티켓 수입 · 평판 증감 (코드는 이 값을 읽기만 합니다) */
  fans: {
    start: [1200, 2000, 3200, 5000, 8000],            // 구단 등급 1~5 시작 팬 수
    leagueMul: { easy: 0.6, normal: 1, hard: 1.6, master: 2.5 },
    floor: 300, floorPeak: 0.5,                        // 팬 최소값 = max(floor, 역대 최고 × floorPeak)
    carryRep: 0.3,                                     // 커리어 이동 시 평판 100 기준 최대 가산 비율
    repCapDiv: 200,                                    // 팬 최댓값 = 수용 인원 × (1 + 평판 / repCapDiv)
    minDelta: 50,                                      // 변동이 있을 때 최소 증감 인원
    win: { min: 0.015, max: 0.03, upset: 0.01, streakAt: 3, streak: 0.005 },
    loss: { min: 0.003, max: 0.008, none: 0.4, streakAt: 3, streakMul: 1.3, cap: 0.012 },
    draw: { min: 0, max: 0.005 },
    tour: { min: 0.03, max: 0.06 },                    // 플레이오프·MSI·월드 승리
    title: { league: 0.12, msi: 0.10, worlds: 0.20 },  // 우승 보너스
    season: { bottom: 2, bottomPct: -0.02, top: 3, topPct: 0.02 },
    stadium: { easy: 6000, normal: 12000, hard: 20000, master: 32000 },
    mob: { base: 0.55, form: 0.35, recent: 5 },        // 동원율 = base + form × 최근 recent경기 승률
    unit: { easy: 1.5, normal: 1.5, hard: 1.4, master: 1.25 },   // 관중 100명당 크레딧
    kindMul: { league: 1, playoff: 1.5, msi: 1.8, worlds: 2.5 },
    rep: { winMul: 1.5, lossMul: 0.5, lossNone: 0.35, titleMul: 1.5 }
  },
  club: {
    currency: '크레딧', maxRoster: 6,
    /* 셀러리캡: 선수단 연봉 합 상한 (이적료·계약금은 자금에서 별도). 초과 시 영입·재계약·이동 승계 불가 */
    cap: { easy: 5200, normal: 8200, hard: 11500, master: 15500 },
    /* 캡 운영: 같은 리그에 머무는 동안 성적·수입에 따라 매 시즌 정산 때 성장(maxGrow 또는 다음 단계 캡 × nextRatio 까지).
       재계약(자기 선수)만 소프트캡을 hardOver 비율까지 넘길 수 있고, 초과분에는 시즌 평균 연봉 기준 tax 비율의 사치세. 시즌 평균 연봉이 하한(floor)보다 낮으면 부족분 × floorPen 벌금(floorGrace 시즌 유예) */
    capRule: {
      maxGrow: 0.3, nextRatio: 0.9, maxStep: 0.08,
      step: { base: 0.02, top: 0.015, topRank: 4, league: 0.03, msi: 0.01, worlds: 0.02 },
      revW: 0.15, revMin: -0.01, revMax: 0.03, refUp: 1.1,
      hardOver: 0.15, tax: 0.5, floor: 0.4, floorPen: 0.5, floorGrace: 1
    },
    startSize: 5,
    startMix: { easy: { C: 0.7, B: 0.3, A: 0, S: 0 }, normal: { C: 0.55, B: 0.4, A: 0.05, S: 0 }, hard: { C: 0.4, B: 0.5, A: 0.1, S: 0 }, master: { C: 0.3, B: 0.55, A: 0.15, S: 0 } },
    startLeagues: ['sea', 'jp', 'na'],            // 새 커리어를 처음 시작할 수 있는 리그
    /* 이동 시 승계: 최대 max 명, 선수당 연봉 × feeMul 비용(새 구단 자금에서). 기존 자금의 fundsKeep 비율을 이월(새 시작 자금의 keepCap 배까지) */
    carry: { max: 3, feeMul: 0.3, fundsKeep: 0.2, keepCap: 0.5 },
    /* 승격: order 순서대로 한 번에 maxStep 단계까지. rank = 정규시즌 최소 순위, req = 목표 리그 난이도별 요구 (상위 3명 평균 ovr · A급 이상 수 · 구단 자금) */
    promotion: {
      order: ['sea', 'jp', 'na', 'eu', 'cn', 'kr'], maxStep: 1, rank: 4,
      req: { normal: { avgOvr: 56, minA: 0, funds: 1500 }, hard: { avgOvr: 63, minA: 1, funds: 3000 }, master: { avgOvr: 70, minA: 2, funds: 5000 } }
    },
    startFunds: { easy: 5200, normal: 6000, hard: 7500, master: 9000 },
    /* 구단주 지급액 배율: 시작 선수단 연봉(리그 수준별 AI 등급 분포)과 4위 기준 수지가 맞도록 조정 */
    owner: { base: 3200, rank: [2600, 2000, 1500, 1000, 600, 350, 200, 100], trophy: { league: 2000, msi: 1500, worlds: 3500 }, leagueMul: { easy: 1, normal: 1.55, hard: 2.5, master: 3 } },
    goals: {
      bonusMul: 0.35, successRep: 5, failRep: -4,
      pools: {
        easy: [
          { id: 'e_rank6', type: 'rank', target: 6, label: '정규시즌 6위 이내', desc: '구단주: "중위권은 지켜 주세요."', bonusMul: 0.25 },
          { id: 'e_wins11', type: 'wins', target: 11, label: '정규시즌 11승 이상', desc: '구단주: "5할 승률은 기대합니다."', bonusMul: 0.25 },
          { id: 'e_playoff', type: 'playoff', target: 8, label: '플레이오프 진출', desc: '구단주: "포스트시즌 무대를 보고 싶습니다."', bonusMul: 0.3 },
          { id: 'e_msi', type: 'msi', target: 4, label: 'MSI 진출', desc: '구단주: "국제 무대에 우리 이름을 올립시다."', bonusMul: 0.45 },
          { id: 'e_funds', type: 'fundsUp', target: 1200, label: '구단 자금 +1,200 크레딧', desc: '구단주: "적자 없이 살림을 불려 주세요."', bonusMul: 0.3 },
          { id: 'e_grade', type: 'grade', grade: 'A', target: 1, label: 'A급 이상 선수 1명 보유', desc: '구단주: "간판 선수가 필요합니다."', bonusMul: 0.3 },
          { id: 'e_import', type: 'import', target: 1, label: '외국인 용병 1명 라인업 기용', desc: '구단주: "해외 선수의 경험을 들여오세요."', bonusMul: 0.3 }
        ],
        normal: [
          { id: 'n_rank5', type: 'rank', target: 5, label: '정규시즌 5위 이내', desc: '구단주: "상위권 경쟁에 끼어야 합니다."', bonusMul: 0.3 },
          { id: 'n_wins13', type: 'wins', target: 13, label: '정규시즌 13승 이상', desc: '구단주: "승률 5할 5푼을 요구합니다."', bonusMul: 0.3 },
          { id: 'n_msi', type: 'msi', target: 4, label: 'MSI 진출', desc: '구단주: "전반기를 4위 안에서 마치세요."', bonusMul: 0.5 },
          { id: 'n_po', type: 'playoff_win', target: 1, label: '플레이오프 우승', desc: '구단주: "우승컵이 필요합니다."', bonusMul: 0.8 },
          { id: 'n_funds', type: 'fundsUp', target: 2000, label: '구단 자금 +2,000 크레딧', desc: '구단주: "흑자 경영을 부탁합니다."', bonusMul: 0.3 },
          { id: 'n_grade', type: 'grade', grade: 'A', target: 2, label: 'A급 이상 선수 2명 보유', desc: '구단주: "투자 가치가 있는 선수단을 만드세요."', bonusMul: 0.4 },
          { id: 'n_home', type: 'homegrown', target: 3, label: '라인업 전원 현지 선수', desc: '구단주: "우리 지역 선수로 팬을 모읍시다."', bonusMul: 0.35 },
          { id: 'n_import', type: 'import', target: 1, label: '외국인 용병 1명 라인업 기용', desc: '구단주: "용병 카드를 써 보세요."', bonusMul: 0.3 }
        ],
        hard: [
          { id: 'h_rank4', type: 'rank', target: 4, label: '정규시즌 4위 이내', desc: '구단주: "플레이오프 상위 시드가 목표입니다."', bonusMul: 0.4 },
          { id: 'h_wins15', type: 'wins', target: 15, label: '정규시즌 15승 이상', desc: '구단주: "압도적인 승률을 보여 주세요."', bonusMul: 0.4 },
          { id: 'h_msi', type: 'msi', target: 4, label: 'MSI 진출', desc: '구단주: "국제 무대는 필수입니다."', bonusMul: 0.55 },
          { id: 'h_po', type: 'playoff_win', target: 1, label: '플레이오프 우승', desc: '구단주: "리그 정상에 서세요."', bonusMul: 0.8 },
          { id: 'h_worlds', type: 'worlds', target: 4, label: '월드 챔피언십 진출', desc: '구단주: "월드 무대에 우리 팀이 있어야 합니다."', bonusMul: 0.6 },
          { id: 'h_funds', type: 'fundsUp', target: 3000, label: '구단 자금 +3,000 크레딧', desc: '구단주: "수익 구조를 개선하세요."', bonusMul: 0.35 },
          { id: 'h_grade', type: 'grade', grade: 'S', target: 1, label: 'S급 선수 1명 보유', desc: '구단주: "리그를 대표할 슈퍼스타가 필요합니다."', bonusMul: 0.5 },
          { id: 'h_home', type: 'homegrown', target: 3, label: '라인업 전원 현지 선수', desc: '구단주: "토종 라인업으로 승부합시다."', bonusMul: 0.35 },
          { id: 'h_import', type: 'import', target: 1, label: '외국인 용병 1명 라인업 기용', desc: '구단주: "해외 스타를 영입해 보세요."', bonusMul: 0.3 }
        ],
        master: [
          { id: 'm_rank3', type: 'rank', target: 3, label: '정규시즌 3위 이내', desc: '구단주: "최상위권만 인정합니다."', bonusMul: 0.5 },
          { id: 'm_wins16', type: 'wins', target: 16, label: '정규시즌 16승 이상', desc: '구단주: "한국 리그의 자존심을 지키세요."', bonusMul: 0.45 },
          { id: 'm_msi', type: 'msi', target: 4, label: 'MSI 진출', desc: '구단주: "전반기 4위 안은 기본입니다."', bonusMul: 0.6 },
          { id: 'm_po', type: 'playoff_win', target: 1, label: '플레이오프 우승', desc: '구단주: "우승 외에는 의미가 없습니다."', bonusMul: 0.9 },
          { id: 'm_worlds', type: 'worlds', target: 4, label: '월드 챔피언십 진출', desc: '구단주: "세계 무대에서 증명하세요."', bonusMul: 0.7 },
          { id: 'm_funds', type: 'fundsUp', target: 4500, label: '구단 자금 +4,500 크레딧', desc: '구단주: "성적과 수익을 모두 잡으세요."', bonusMul: 0.4 },
          { id: 'm_grade', type: 'grade', grade: 'S', target: 2, label: 'S급 선수 2명 보유', desc: '구단주: "최고 선수들로 라인업을 채우세요."', bonusMul: 0.6 },
          { id: 'm_home', type: 'homegrown', target: 3, label: '라인업 전원 현지 선수', desc: '구단주: "한국인 라인업으로 팬심을 얻읍시다."', bonusMul: 0.4 }
        ]
      }
    }
  },

  /* 도전과제: 시리즈별 단계(tiers). 달성한 단계 + 다음 단계 하나만 보이고, 단계는 계속 이어집니다.
     id 는 기본 '시리즈id_n' (기존 저장 호환용으로 id 를 직접 지정한 단계도 있음) */
  challenges: [
    { id: 'wins', icon: '⚔️', type: 'wins', desc: n => `통산 ${n}승 달성`, tiers: [
      { n: 1, id: 'first_win', icon: '🌱', name: '첫 승리', reward: 300 }, { n: 5, name: '초보 감독', reward: 400 },
      { n: 10, id: 'wins_10', name: '신예 감독', reward: 500 }, { n: 25, name: '중견 감독', reward: 900 },
      { n: 50, id: 'wins_50', icon: '🛡️', name: '베테랑 감독', reward: 1500 }, { n: 100, name: '백전노장', reward: 2500 },
      { n: 150, id: 'wins_150', icon: '🏛️', name: '명장', reward: 4000 }, { n: 250, name: '전설의 감독', reward: 6000 },
      { n: 500, name: '불멸의 감독', reward: 10000 }, { n: 1000, name: '승리의 화신', reward: 20000 } ] },
    { id: 'streak', icon: '🔥', type: 'streak', desc: n => `${n}연승 달성`, tiers: [
      { n: 3, name: '3연승', reward: 400 }, { n: 5, id: 'streak_5', name: '5연승', reward: 800 },
      { n: 10, id: 'streak_10', icon: '☄️', name: '10연승', reward: 2500 }, { n: 15, name: '15연승', reward: 5000 },
      { n: 20, name: '무적 행진', reward: 9000 } ] },
    { id: 'league', icon: '🏆', type: 'trophy', k: 'league', desc: n => `리그 우승 ${n}회`, tiers: [
      { n: 1, id: 'league_1', name: '첫 리그 우승', reward: 1500 }, { n: 3, id: 'league_3', name: '리그 왕조', reward: 4000 },
      { n: 5, name: '리그의 지배자', reward: 7000 }, { n: 10, name: '영원한 챔피언', reward: 15000 }, { n: 20, name: '리그 그 자체', reward: 30000 } ] },
    { id: 'league_rep', icon: '🔁', type: 'repeat', k: 'league', desc: n => `리그 ${n}시즌 연속 우승`, tiers: [
      { n: 2, name: '리핏', reward: 3000 }, { n: 3, name: '쓰리핏', reward: 6000 }, { n: 4, name: '포핏', reward: 10000 },
      { n: 5, name: '파이브핏', reward: 16000 } ] },
    { id: 'msi', icon: '🥇', type: 'trophy', k: 'msi', desc: n => `MSI 우승 ${n}회`, tiers: [
      { n: 1, id: 'msi_1', name: 'MSI 챔피언', reward: 2500 }, { n: 3, name: 'MSI 강자', reward: 6000 },
      { n: 5, name: 'MSI 왕조', reward: 10000 }, { n: 10, name: 'MSI 전설', reward: 20000 } ] },
    { id: 'msi_rep', icon: '🔁', type: 'repeat', k: 'msi', desc: n => `MSI ${n}회 연속 우승`, tiers: [
      { n: 2, name: 'MSI 리핏', reward: 5000 }, { n: 3, name: 'MSI 쓰리핏', reward: 10000 } ] },
    { id: 'worlds', icon: '👑', type: 'trophy', k: 'worlds', desc: n => `월드 챔피언십 우승 ${n}회`, tiers: [
      { n: 1, id: 'worlds_1', name: '월드 챔피언', reward: 6000 }, { n: 3, name: '월드 강자', reward: 12000 },
      { n: 5, name: '월드 왕조', reward: 20000 }, { n: 10, name: '월드 전설', reward: 40000 } ] },
    { id: 'worlds_rep', icon: '🔁', type: 'repeat', k: 'worlds', desc: n => `월드 챔피언십 ${n}회 연속 우승`, tiers: [
      { n: 2, name: '월드 리핏', reward: 12000 }, { n: 3, name: '월드 쓰리핏', reward: 25000 } ] },
    { id: 'leagues', icon: '🌍', type: 'leagues', desc: n => `서로 다른 ${n}개 리그에서 우승`, tiers: [
      { n: 2, id: 'multi_league', name: '리그 정복자', reward: 5000 }, { n: 3, name: '대륙 정복자', reward: 9000 },
      { n: 4, name: '세계 정복자', reward: 15000 }, { n: 6, name: '모든 리그의 주인', reward: 30000 } ] },
    { id: 'goals', icon: '🎯', type: 'goals', desc: n => `구단주 목표 ${n}회 달성`, tiers: [
      { n: 1, name: '목표 달성', reward: 600 }, { n: 3, id: 'goals_3', name: '구단주의 신뢰', reward: 2000 },
      { n: 5, name: '구단주의 총애', reward: 3500 }, { n: 10, name: '구단의 얼굴', reward: 8000 }, { n: 20, name: '구단의 상징', reward: 16000 } ] },
    { id: 'rare', icon: '💎', type: 'rare', desc: n => `에이스 또는 완벽한 재능 선수 ${n}명 보유`, tiers: [
      { n: 1, id: 'rare_1', name: '전설의 재능', reward: 3000 }, { n: 2, name: '재능 수집가', reward: 6000 }, { n: 3, name: '재능의 산실', reward: 10000 } ] },
    { id: 'foreign', icon: '🌐', type: 'foreign', desc: n => `외국인 선수 ${n}명 보유`, tiers: [
      { n: 2, id: 'foreign_2', name: '글로벌 로스터', reward: 600 }, { n: 3, name: '국제 로스터', reward: 1200 }, { n: 5, name: '다국적 군단', reward: 3000 } ] },
    { id: 'funds', icon: '💰', type: 'funds', desc: n => `구단 자금 ${n.toLocaleString()} 크레딧 보유`, tiers: [
      { n: 25000, id: 'rich', name: '부자 구단', reward: 2500 }, { n: 100000, name: '재벌 구단', reward: 8000 },
      { n: 250000, name: '거대 자본', reward: 15000 }, { n: 1000000, name: '구단 제국', reward: 40000 } ] },
    { id: 'seasons', icon: '📅', type: 'seasons', desc: n => `시즌 ${n} 도달`, tiers: [
      { n: 5, id: 'seasons_5', name: '장기 집권', reward: 1000 }, { n: 10, name: '십 년 감독', reward: 3000 },
      { n: 20, name: '영원한 감독', reward: 8000 }, { n: 30, name: '구단의 역사', reward: 15000 } ] }
  ],

  ui: { teamColors: ['#5ee7ff', '#ff6ec7'], starCount: 90 },
  fighters: {}   // fighters.js 에서 채워집니다
};

/* 시간대 계획 항목은 운영 기조와 같은 선택지를 씁니다 */
CONFIG.tactics.team.filter(c => c.noLevel).forEach(c => {
  c.options = [{ id: 'follow', name: '기조 따름', desc: '이 시간대에도 운영 기조를 그대로 따릅니다.' }, ...CONFIG.tactics.team[0].options];
});
