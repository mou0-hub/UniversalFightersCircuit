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
  small: { value: 1, slots: 1 },
  carryCap: 6, slowPer: 0.03, slowMax: 0.18,
  pickR: 6, grabR: 14, lockSec: 1.0, senseR: 45,   /* pickR 줍는 거리 · grabR 다른 일 중에도 코어를 주우러 틀어 가는 거리 · senseR 코어 발견 거리 */
  startSmall: 3, startRing: [22, 48],
  wave: { every: 8, count: 2, max: 14, finalSec: 30, finalEveryMul: 0.5 },
  deposit: { r: 12, channelSec: 1.2, perCoreSec: 0.3, comboAt: 4, comboBonus: 1, hitKeep: 0.5 },
  boss: {
    first: 8, late: 12, scatterR: 46, scatterMin: 12, minGap: 13, lockSec: 1.5,
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
  danger: { foeR: 26, reachR: 48, reachW: 0.5, mateR: 26, safe: 1.0, cap: 3, pen: 1.1, veto: 2.2, vetoPen: 4, carryMul: 0.25, brave: 0.85, careful: 1.15, soloLim: 1.5 },
  ai: {
    coreMul: 1.2, distDiv: 100, cap: 2,
    needUrg: 1.2, needCore: 0.3, leadDep: 0.5, urgentSec: 25, urgentMul: 3, trailSec: 60, trailMul: 2, collectDep: 1.5, fighterDep: 1.6, depMul: 0.4, depFull: 6, depReady: 1.6, depWait: 0.3, depThreatR: 25, depThreatMul: 0.5, depThreatCost: 1.2, safeR: 45, greed: 0.7,
    guardMul: 1.2, guardOff: 14, ambushFar: 40, ambushStep: 3.5, ambushV: 0.5,
    carryPrey: 0.5, huntV: 0.25, crowdSplit: 0.8, crowdMul: 0.35,
    join: 0.7, joinMin: 14, joinRef: 70, hold: 6, holdBonus: 0.5, assassinHunt: 0.3, backPrey: 0.8,
    scoutV: 1.1, bossCarryPen: 0.6   /* scoutV 코어를 못 찾을 때 구역 순회 가치 · bossCarryPen 코어 든 선수의 보스 개입 감점(코어 가치당) */
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
    /* 슬롯 역할: 배치한 선수(1·2·3번)마다 고르는 역할. 'auto' 는 픽한 파이터에 맞춰 경기 시작 때 자동 결정 */
    roles: [
      { id: 'vanguard', name: '선봉', desc: '맨 앞에서 부딪히며 교전의 문을 여는 방식으로 싸웁니다. 보스전에서도 선두에 서는 편입니다.', set: { mission: 'boss', pos: 'front', entry: 'first', aim: 'near', ult: 'save', act: 'rush', fight: 'coop' } },
      { id: 'collector', name: '수집가', desc: '코어를 챙기며 움직이고, 빈틈이 보이면 약한 적을 치는 방식으로 싸웁니다.', set: { mission: 'collect', pos: 'none', entry: 'none', aim: 'weak', ult: 'normal', act: 'basic', fight: 'coop' } },
      { id: 'hunter', name: '사냥꾼', desc: '코어를 든 적과 후열을 향해 파고들어 흔드는 방식으로 싸웁니다.', set: { mission: 'hunt', pos: 'none', entry: 'flank', aim: 'back', ult: 'burst', act: 'rush', fight: 'solo' } },
      { id: 'guard', name: '호위', desc: '코어를 든 아군 곁에서 버티며 함께 싸웁니다.', set: { mission: 'escort', pos: 'front', entry: 'none', aim: 'carry', ult: 'clutch', act: 'basic', fight: 'support' } },
      { id: 'carry', name: '후방 화력', desc: '한 발 뒤에서 거리를 두고 고화력 표적에 화력을 쏟아붓는 방식으로 싸웁니다.', set: { mission: 'collect', pos: 'cover', entry: 'support', aim: 'carry', ult: 'save', act: 'retreat', fight: 'coop' } }
    ],
    pre: {
      level: 4,
      team: ['engage', 'zone', 'formation', 'deposit', 'boss', 'ultT'],
      slot: ['mission', 'entry', 'pos', 'act', 'fight', 'aim', 'ult'],
    },
    stances: {
      balanced: { post: 1,    kill: 1,    boss: 1,    pod: 1,    core: 1,    aggro: 0 },
      collect:  { post: 0.95, kill: 0.92, boss: 0.92, pod: 1.1,  core: 1.15, aggro: -1 },
      slay:     { post: 0.9,  kill: 1.2,  boss: 0.95, pod: 0.95, core: 0.92, aggro: 4 },
      boss:     { post: 0.92, kill: 0.93, boss: 1.2,  pod: 1.12, core: 0.93, aggro: 0 },
      defend:   { post: 1.2,  kill: 0.92, boss: 0.85, pod: 1.1,  core: 1,    aggro: -2 }
    },
    axes: {
      engage: {
        avoid:      { kill: 0.9,  aggro: -3, risk: 1.2 },
        careful:    { kill: 0.95, aggro: -1, risk: 1.1 },
        balanced:   {},
        aggressive: { kill: 1.08, aggro: 3,  risk: 0.92 },
        allout:     { kill: 1.15, aggro: 6,  risk: 0.85 }
      },
      zone: {
        home:   { post: 1.25, ambush: 0 },
        center: {},
        press:  { post: 0.9,  ambush: 1 }
      },
      formation: {
        split: { bond: -0.25, ccap: 2, crowd: 0.8 },
        auto:  {},
        duo:   { duo: 1 },
        group: { bond: 0.25,  ccap: 3, crowd: 0.1 }
      },
      deposit: { early: {}, normal: {}, full: {} },
      boss: {
        yield:   { boss: 0.85 },
        smart:   {},
        steal:   { boss: 1 },
        contest: { boss: 1.12 }
      },
      ultT: { normal: {}, burst: {}, save: {}, clutch: {} }
    },
    adj: {
      bank:        { kill: 0.9,  post: 1.1,  aggro: -2 },
      gamble:      { kill: 1.05, aggro: 2 },
      gambleBoss:  { boss: 1.12 },
      gambleCarry: { kill: 1.1 },
      gambleCore:  { core: 1.1 },
      sdGuard:     { post: 1.1,  kill: 0.95, aggro: -1 },
      catchUp:     { core: 1.08, aggro: 1 },
      idle:        { core: 1.05 },
      outnum:      { kill: 0.85, aggro: -2 },
      lowHp:       { kill: 0.9,  aggro: -2 },
      limit:       { kill: [0.75, 1.3], post: [0.75, 1.4], boss: [0.6, 1.4], core: [0.7, 1.4], pod: [0.8, 1.4], aggro: [-6, 10] }
    },
    categories: [
      { id: 'mission', name: '주 활동 성향', neutral: 'free', options: [
        { id: 'free',   name: '자유',     desc: '정해 둔 주 활동 없이 상황에 맞춰 움직입니다.' },
        { id: 'collect', name: '코어 수집', desc: '코어 줍기를 먼저 챙기는 편입니다. 코어를 찾아 멀리까지 나가는 대신 교전 합류는 늦습니다.' },
        { id: 'hunt',   name: '교전·추격', desc: '코어를 많이 든 적, 체력이 낮거나 고립된 적을 먼저 쫓는 편입니다. 교전이 늘어나는 만큼 위험도 커집니다.' },
        { id: 'boss',   name: '보스 대기', desc: '보스가 나오면 먼저 합류하는 편이고, 그 전에는 코어를 주우며 기다립니다.' },
        { id: 'escort', name: '호위',     desc: '코어를 든 아군 곁에서 함께 움직이며 싸웁니다. 혼자 앞서 나가지는 않습니다.' } ] },
      { id: 'act', name: '거리 감각', neutral: 'basic', options: [
        { id: 'basic',   name: '기본', desc: '파이터 고유 사거리·카이팅을 따릅니다.' },
        { id: 'rush',    name: '돌진', desc: '적에게 먼저 붙습니다. 이동속도↑ 방어력↓ (정도에 비례).' },
        { id: 'retreat', name: '카이팅', desc: '거리를 유지하며 싸웁니다. 정도가 높을수록 일찍 뒤로 빠집니다.' } ] },
      { id: 'fight', name: '팀 호흡', neutral: 'none', options: [
        { id: 'none',    name: '단독', desc: '자기 목표를 우선합니다.' },
        { id: 'coop',    name: '집중', desc: '아군이 노리는 적을 함께 때립니다. 집중 공격 시 피해↑.' },
        { id: 'support', name: '지원', desc: '맞는 아군 쪽 적을 우선 끊고, 위급한 아군 쪽으로 붙습니다.' },
        { id: 'solo',    name: '고립 사냥', desc: '타겟을 오래 유지합니다. 주변에 아군이 없을 때 공격력↑.' } ] },
      { id: 'pos', name: '포지션', neutral: 'none', options: [
        { id: 'none',  name: '기본', desc: '파이터 기본 포지션을 따릅니다.' },
        { id: 'front', name: '전방', desc: '아군보다 앞에서 교전을 엽니다. 보스 진입·선제 교전에 유리합니다.' },
        { id: 'cover', name: '후방', desc: '아군 뒤·엄폐물 쪽에서 딜합니다. 암살·누킹에 덜 노출됩니다.' } ] },
      { id: 'entry', name: '교전 방식', neutral: 'none', options: [
        { id: 'none',    name: '기본',     desc: '파이터 기본 진입 방식을 따릅니다.' },
        { id: 'first',   name: '선진입',   desc: '아군보다 먼저 뛰어들어 교전을 엽니다.' },
        { id: 'late',    name: '후진입',   desc: '아군이 교전을 시작할 때까지 기다렸다 합류합니다.' },
        { id: 'support', name: '후방지원', desc: '전열 뒤에서 맞는 아군 쪽 적을 끊으며 지원합니다.' },
        { id: 'flank',   name: '우회',     desc: '측면으로 돌아 적의 옆·뒤를 칩니다.' } ] },
      { id: 'aim', name: '표적 성향', neutral: 'near', options: [
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
      { id: 'engage', group: '전투 성향', name: '교전 성향', neutral: 'balanced', options: [
        { id: 'avoid',      name: '회피', desc: '싸움을 가급적 피하고 코어에 집중합니다. 손실은 적지만 킬과 압박이 줄어듭니다.' },
        { id: 'careful',    name: '신중', desc: '유리할 때만 교전을 엽니다. 안정적인 대신 기회를 놓치기도 합니다.' },
        { id: 'balanced',   name: '균형', desc: '교전과 코어 수집을 고르게 봅니다.' },
        { id: 'aggressive', name: '적극', desc: '교전을 먼저 열고 추격합니다. 킬이 늘지만 손실 위험도 커집니다.' },
        { id: 'allout',     name: '맹공', desc: '끝까지 몰아붙입니다. 킬과 데스가 함께 늘고 점수 쌓는 템포는 늦어집니다.' } ] },
      { id: 'zone', group: '전투 성향', name: '활동 영역', neutral: 'center', options: [
        { id: 'home',   name: '아군 진영', desc: '우리 제출 지점 근처에서 움직입니다. 방어는 단단하지만 먼 코어는 늦게 닿습니다.' },
        { id: 'center', name: '중앙',     desc: '맵 중앙을 중심으로 움직입니다.' },
        { id: 'press',  name: '적진 압박', desc: '적 제출 지점 쪽까지 올라가 길목을 노립니다. 우리 진영이 비기 쉽습니다.' } ] },
      { id: 'formation', group: '전투 성향', name: '진형', neutral: 'auto', options: [
        { id: 'split', name: '분산', desc: '셋이 넓게 흩어져 코어를 찾습니다. 수집은 빠르지만 고립되기 쉽습니다.' },
        { id: 'auto',  name: '자동', desc: '코어 가치에 따라 자연스럽게 나뉩니다.' },
        { id: 'duo',   name: '짝',   desc: '가장 가까운 아군 2명이 함께 움직이고 나머지 1명은 따로 움직입니다.' },
        { id: 'group', name: '집결', desc: '셋이 함께 움직입니다. 교전은 강하지만 코어 수집 범위가 좁아집니다.' } ] },
      { id: 'deposit', group: '운영', name: '제출 리듬', neutral: 'normal', options: [
        { id: 'early',  name: '수시', desc: '코어를 1~2개 모으면 바로 제출합니다. 점수는 빨리 쌓이지만 오가는 시간이 늘어납니다.' },
        { id: 'normal', name: '보통', desc: '슬롯이 절반쯤 차면 제출하러 갑니다.' },
        { id: 'full',   name: '가득', desc: '슬롯이 가득 차거나 주변이 안전할 때 제출합니다. 안전하지만 점수가 늦게 반영됩니다.' } ] },
      { id: 'boss', group: '운영', name: '보스 태도', neutral: 'smart', options: [
        { id: 'yield',   name: '양보',     desc: '보스 비중을 낮추고 코어에 집중합니다. 이득이 크면 합류합니다.' },
        { id: 'smart',   name: '상황 판단', desc: '점수와 위치를 보고 합류할지 기다릴지 정합니다.' },
        { id: 'steal',   name: '스틸',     desc: '보스 구덩이 가장자리에서 기다리다 체력이 깎이면 끼어듭니다.' },
        { id: 'contest', name: '적극',     desc: '보스가 나오면 먼저 달려듭니다. 보스전 부담이 커집니다.' } ] },
      { id: 'ultT', group: '운영', name: '궁 운용', neutral: 'normal', options: [
        { id: 'normal', name: '효율',        desc: '개인 궁 설정이 우선이고, 없으면 효율 좋은 타이밍에 씁니다.' },
        { id: 'burst',  name: '즉시',        desc: '쿨이 오면 빨리 쓰도록 느슨한 조건을 씁니다.' },
        { id: 'save',   name: '한타/보스 보존', desc: '큰 교전·보스 타이밍까지 궁을 아낍니다.' },
        { id: 'clutch', name: '위기',        desc: '아군이 위험할 때 쓰기 쉽게 맞춥니다.' } ] },
      /* 내부용(플레이어 UI 미노출): 경기 중 지시·상황 프로필 호환 */
      { id: 'stance', group: '내부', name: '내부 성향', neutral: 'balanced', options: [
        { id: 'balanced', name: '균형', desc: '' }, { id: 'collect', name: '수집', desc: '' }, { id: 'slay', name: '사냥', desc: '' }, { id: 'boss', name: '보스', desc: '' }, { id: 'defend', name: '수비', desc: '' } ] },
      { id: 'retreat', group: '내부', name: '내부 열세 대응', neutral: 'careful', options: [
        { id: 'careful', name: '신중', desc: '' }, { id: 'brave', name: '강행', desc: '' } ] }
    ],
    p: {
      rushSpd: 0.025, rushDef: 0.02,
      retreatHp0: 0.3, retreatHpStep: 0.1, retreatBase: 5, retreatMul: 0.9, retreatAdd: 4,
      coopBias: 0.5, coopDmg: 0.018, supportBias: 0.65, assistWindow: 40, assistBase: 8, assistStep: 2.5,
      soloStick: 3, soloAtk: 0.02, soloAlone: 20,
      frontBase: 0.4, frontStep: 0.035, coverHide: 0.16, coverBack: 2, coverStep: 0.6, aimBias: 0.7, clutchHp0: 0.2, clutchHpStep: 0.06,
      mCollect: 0.4, mCollectV: 0.5, collectR0: 50, collectRStep: 25,
      mAmbush: 0.4, mAmbushOff: 0.1,
      mHunt: 0.3, mHuntOff: 0.1, mHuntAggro: 0.8, huntRange0: 32, huntRangeStep: 10, mHuntCarry: 0.2,
      mBoss: 0.45, mBossWait: 0.3, mBossOff: 0.15, bossRange0: 50, bossRangeStep: 25,
      escortFar: 13, escortStep: 1.2, escortCarry: 0.4, capperBias: 0.7,
      duoBreak: 60, duoBonus: 0.35, duoApart: 0.5,
      huntCapKill: 1.08, yieldMul: 0.8, yieldCap: 2, zoneAmbush: 0.6, lowHpThr: 0.4, lowHpN: 2, outnumGap: 2, retreatThr: 0.4, retreatThrStep: 0.04, podReach: 110
    }
  },

  report: {
    /* AI 전술 보정: 새 실제 전투 minGames 경기 중 패배 minLosses 이상이고, 어떤 패인이 패배의 share 이상이면 그 패인의 첫 일치 규칙을 적용 (한 번에 최대 max 항목) */
    adapt: { on: true, minGames: 5, minLosses: 3, share: 0.4, max: 2, rules: [
      { cause: 'boss',     axis: 'boss',      from: ['yield'],                to: 'smart' },
      { cause: 'boss',     axis: 'boss',      from: ['smart', 'contest'],     to: 'steal' },
      { cause: 'carry',    axis: 'deposit',   from: ['full', 'normal'],       to: 'early' },
      { cause: 'carry',    axis: 'formation', from: ['split'],                to: 'auto' },
      { cause: 'deposit',  axis: 'deposit',   from: ['full'],                 to: 'normal' },
      { cause: 'deposit',  axis: 'deposit',   from: ['normal'],               to: 'early' },
      { cause: 'kills',    axis: 'engage',    from: ['aggressive', 'allout'], to: 'balanced' },
      { cause: 'kills',    axis: 'formation', from: ['split', 'auto'],        to: 'duo' },
      { cause: 'collapse', axis: 'zone',      from: ['press'],                to: 'center' },
      { cause: 'collapse', axis: 'deposit',   from: ['full'],                 to: 'normal' },
      { cause: 'sudden',   axis: 'ultT',      from: ['normal', 'burst'],      to: 'save' },
      { cause: 'deaths',   axis: 'zone',      from: ['press'],                to: 'center' },
      { cause: 'deaths',   axis: 'engage',    from: ['allout'],               to: 'aggressive' }
    ] },
    officer: { name: '분석 담당관', dir: 'img/officer/', prefix: 'Officer', ext: 'png', count: 1,   /* 이미지: img/officer/Officer1.png … (count = 준비한 장수) */
      lines: ['경기가 끝날 때마다 기록이 쌓입니다. 시즌을 중간에 멈춰도 여기서 볼 수 있습니다.', '시즌별로, 또 전체 합계로 패인을 나눠서 보여드립니다.', '숫자는 참고 자료입니다. 표본이 적을 땐 너무 믿지 마세요.'],
      empty: '아직 기록된 경기가 없습니다. 경기를 치르면 분석 자료가 쌓입니다.' }
  },

  scout: {
    top: 2, minGames: 3, skillGap: 4,
    analyst: { dir: 'img/manager/', prefix: 'Analyst', ext: 'png', count: 1,   /* 이미지: img/manager/Analyst1.png, Analyst2.png … (count = 준비한 장수, 입장 때마다 무작위) */
      lines: ['상대 데이터 정리해 뒀습니다. 천천히 보세요.', '조정 제안은 참고만 하세요. 최종 판단은 감독님 몫입니다.', '상대의 예상 운영 방식부터 확인해 보세요.', '밴 추천도 놓치지 마세요. 의외로 승부가 갈립니다.', '표본이 적으면 예측이 빗나갈 수 있습니다. 그건 감안해 주세요.'] },
    risk: { mental: 65, form: 45, trouble: 60, slack: 60 },
    rules: [
      { axis: 'deposit', to: 'early', w: 2, when: { deposit: { is: 'early' } }, why: "상대가 일찍 제출하는 편이니 제출 리듬을 '수시'로 바꿔볼 수 있습니다." },
      { axis: 'boss', to: 'smart', w: 2, when: { boss: { in: ['contest', 'steal'] }, gap: { lte: 0 } }, why: "상대가 보스에 적극적이라 보스 태도를 '상황 판단'으로 두면 무리한 합류를 줄일 수 있습니다." },
      { axis: 'boss', to: 'contest', w: 2, when: { boss: { is: 'yield' }, gap: { gte: 0 } }, why: "상대가 보스 비중을 낮추는 편이라 보스 태도를 '적극'으로 올려볼 수 있습니다." },
      { axis: 'engage', to: 'careful', w: 1, when: { engage: { in: ['aggressive', 'allout'] }, gap: { lte: 0 } }, why: "상대가 교전을 일찍 여는 편이라 교전 성향을 '신중'으로 두면 손실을 줄일 수 있습니다." },
      { axis: 'engage', to: 'aggressive', w: 1, when: { gap: { gte: 2 } }, why: "선수단 등급이 앞서 교전 성향을 '적극'으로 올려도 부담이 적습니다." },
      { axis: 'formation', to: 'group', w: 1, when: { gap: { lte: -2 } }, why: "전력이 밀리는 편이라 진형을 '집결'로 두면 흩어져 손해 보는 일이 줄어듭니다." },
      { axis: 'formation', to: 'duo', w: 1, when: { form: { is: 'split' } }, why: "상대가 흩어져 움직이는 편이라 진형을 '짝'으로 두면 고립 없이 코어를 챙길 수 있습니다." },
      { axis: 'zone', to: 'center', w: 1, when: { zone: { is: 'press' } }, why: "상대가 적진까지 올라오는 편이라 활동 영역을 '중앙'에 두면 양쪽 길목을 함께 볼 수 있습니다." },
      { axis: 'zone', to: 'press', w: 1, when: { zone: { is: 'home' }, gap: { gte: 0 } }, why: "상대가 자기 진영에서 버티는 편이라 활동 영역을 '적진 압박'으로 넓혀볼 수 있습니다." },
      { axis: 'ultT', to: 'save', w: 1, when: { teamEdge: { gte: 3 } }, why: "상대 팀워크가 높아 한타가 길어질 수 있어 궁 운용을 '한타/보스 보존'으로 두면 좋습니다." }
    ]
  },
  mind: {
    sense: { vis: 34, visJ: 12, mate: 30, mateT: 14, noise: 0.5, refresh: 0.8, refreshR: 0.4, assume: 0.1, dpsSec: 2, zoneR: 12, zoneCost: 22, routeR: 16 },
    surv: { ttd: 1.7, ttdP: 0.8, ttdCarry: 0.3, ttdClutch: 0.7, ttdSd: 0.6, doct: 0.6, doctHp: 0.08, hpCarry: 0.05, hpBack: 0.5, win: 0.9, winJ: 0.2, finishHp: 0.25, fbSec: 3.5, fbCdSec: 4.5, cdSec: 1.8, cdHp: 0.7, outHp: 0.22, softNeed: 0.3, softEdge: 0.35, softLim: [0.7, 1.45], softWait: 7, softOff: 5, safeP: 6, podReach: 160, podBlock: 14 },
    carry: { must: 3, mustVal: 5, mustFoes: 2, nearZone: 22, nearMul: 0.25, pw: 1, kill: 1.2, killCarry: 0.7, loss: 1, death: 1.4, dieTtd: 4, gamble: 0.8, leadFight: 0.6, needDep: 0.7, leadDep: 0.4, objDep: 0.2, time: 0.04, routeW: 1, zoneW: 0.2, feas: 1.1, margin: 0.9, marginJ: 0.5, allyHp: 0.4, allyR: 30, hold: 1.2, aggroCap: 14 },
    chan: { max: 2, lastSec: 10, win: 2, margin: 0.8, marginP: 0.25, marginC: 0.2, sdMul: 0.85, panicHp: 0.2, minChance: 0.3, earlyHp: 0.6, counterPow: 0.9, allyRatio: 0.7, allyR: 30, fleeSec: 2.5, waitSec: 5, minWaitSec: 1.5, clearR: 16, safeD: 26 },
    team: { refresh: 0.6, refreshR: 0.4, noise: 0.35, open: 0.28, avoid: 0.28, openJ: 0.35, respawn: 0.22, winSec: 4, needBase: 2, needLeft: 4, needC: 0.3, plan: 0.35, planR: 0.4, pushEdge: 0.15 },
    time: { early: 40, late: 100, pushEarly: -0.25, pushLate: 0.2, pushNeed: 0.6, pushLead: -0.5, pushGamble: 0.6, pushCatch: 0.3, sdPush: -0.4, sdPre: 20, bankSec: 45, catchSec: 80, lead0: 4, leadLate: 1.5, leadJ: 0.25, trail0: 3.5, trailLate: 1.5, trailC: 1, aggroPush: 5 },
    chase: { minVal: 2, maxOwn: 2, minHp: 0.5, isoR: 26, reach: 70, reachT: 25, near: 20, supportR: 30, supportMul: 0.9, max: 2, dupVal: 4, hold: 6, stick: 1.8, spdMin: 0.95 },
    gate: { trig: 50, rad: 26, radT: 6, base: 2.5, patient: 0.6, rash: 0.5, min: 0.8, openMul: 0.7, avoidMul: 1.3, go: 5, goHit: 4, initSec: 2.2 },
    fstate: { refresh: [2.5, 0.6], err: 0.35, healBan: 1.2, exposeR: 45, exposeGap: 8 },
    focus: { within: 48, keep: 40, stick: 1.2, weakHp: 0.4, threat: 2, back: 2.2, carry: 0.3, pull0: 0.25, pullT: 0.05 },
    chain: { base: 1.5, t: 2, u: 1 },
    pod: { base: 2, t: 3, rearm: 8, hpMax: 0.8 },
    role: { front: 5, roam: 1.35, roamP: 0.45, chainRoam: 1.9, flank0: 11, flankP: 9, gap0: 3, gapP: 4 },
    boss: { stealHp: 0.6, bankHp: 0.5, bankMul: 0.05, bankSteal: 1.6, bankContest: 0.4, gambleMul: 1.7, avoid: 1.3 },
    retreat: { gapMin: 18, gapAdd: 10, step: 10, depthCap: 0.5, deepHp: 0.25, kiteHp: 0.55, kiteAllyHp: 0.5, kiteRange: 10, kiteClose: 0.6 },
    assign: { every: 22, everyR: 8 },
    aggroEdge: 4,
    intent: {
      fresh: 0.6, nearR: 24, peelFit: 16, healHp: 0.85, finHp: 0.4, hpFuzz: 0.35, missSec: 2.2,
      lag: [1.4, 0.15], baseLag: 0.25, hold: 1.2, miss: [0.35, 0],
      peelR: 34, hitSec: 1.6, threatR: 12, carryW: 0.6, peelBoost: 1.3, stickW: 0.5, ultFinHp: 0.4,
      style: { front: { surv: 0.3, peel: 1, eng: 1 }, back: { surv: 0.45, peel: 0.7, eng: 0 } },
      pref: {
        survive: { go: ['escape', 'peel', 'heal', 'control'], hold: ['gapclose', 'amp', 'zone', 'antiheal'] },
        peel: { go: ['peel', 'control', 'heal'], hold: ['gapclose'] },
        engage: { go: ['gapclose', 'control', 'amp', 'zone', 'finisher'], hold: ['escape'] },
        trade: { go: ['amp', 'zone', 'antiheal', 'finisher', 'heal'], hold: ['escape'] }
      },
      holdMul: { survive: 0, peel: 2, engage: 2, trade: 2 }
    },
    /* 기억(ghost): 시야 밖으로 사라진 적을 기억해 교전 견적·제출 경로에 반영. 위협도는 '마지막 위치 + 그 적이 움직였을 수 있는 거리'로 계산하고, 판단력·등급은 기억을 얼마나 오래·정확히 유지하는지(q0=최저 유지율)만 결정 */
    ghost: { sec: 9, reach: 26, q0: 0.5, drift: 0.6, mul: 0.8, stale: 0.35 },
    /* 도주 vs 맞서기: 도주 생존확률(속도 차·원거리·탈출기·아군·힐팩)과 승리확률을 비교(문턱값 없음). noise 판단 오차 반영 · kill 처치 가치 · carryD 코어를 들수록 죽음 비용 증가 · standSec 한 번 정한 뒤 유지 시간 */
    flee: { chaseR: 24, base: 0.7, spd: 1.5, rangedR: 10, rangedMul: 0.75, multi: 0.9, escBonus: 0.35, allyBonus: 0.2, allyR: 30, podBonus: 0.3, noise: 0.8, kill: 0.6, killCarry: 0.3, carryD: 0.25, standSec: 1.5, turnSec: 1.2 },
    /* 보스 대비: '도착 소요시간 대비 남은 스폰 시간'에서 긴박도를 연속 계산(horizon 초 안쪽부터 서서히 상승). safety 여유 · err 판단 오차 · need 점수가 밀릴수록 가치↑ · avoid 구덩이 선점 적 경계 · stage 집결 가치 · heal 긴박할수록 올라가는 회복 기준 */
    prep: { horizon: 14, safety: 0.25, err: 0.6, need: 0.25, avoid: 1, stage: 1.4, heal: 0.35 },
    grade: {
      gr: { C: 0, B: 0.33, A: 0.67, S: 1 }, jMix: 0.12,
      noiseT: 0.7, open: 0.25, bank: 0.25, gamble: 0.2, gateWait: 0.35,
      chaseReach: 25, chaseOwn: 1, chaseIso: 0.35, chaseSup: 0.4, chaseHold: 2, chaseHp: 0.1,
      mustHi: 0.85, calmG: 0.8, dep: 0.6, riskVal: 3, riskP: 0.5, leadNeed: 0.5, leadCut: 0.6,
      hold: 0.3, killHp: 0.35, allyR: 55, allyW: 0.6, dire: 0.45, earlyHp: 0.05, outHp: 0.6, ratio: 0.2,
      vis: 18, mate: 12, noise: [1.5, 0.4], jit: 0.25,
      obeyC: 0.72, lv: [0.8, 1.12], fol: [0.85, 1.1], callSec: 3,
      hunt: { k: 2.2, noise: 0.5, gainCap: 1.5, costW: 0.5, deathBase: 0.8, carryW: 0.6, careLo: 0.5, careHi: 1.2, escCut: 0.25, vetoP: 0.2, engageP: 0.42, interruptV: 1.2, foeR: 26, mateR: 26 },
      pw: { aspd: 0.4, range: 0.005, tough: 1, ult: 0.1, sup: 0.08, norm: 1.25 }
    }
  },

  /* ---------- AI 난이도 ----------
     파이터 개별 AI(이동·스킬·타게팅)는 모든 난이도에서 동일합니다. 난이도는 AI 팀이 짜는 팀 전략/개인 지시의 수준만 바꿉니다. */
  ai: {
    default: 'normal',
    levels: {
      easy:   { name: '쉬움',   desc: '코어를 보이는 대로 모아 빨리 제출합니다. 처치·매복은 하지 않고, 보스를 포기하며 상황 변화에 둔하고, 체력이 줄어도 버팁니다.' },
      normal: { name: '보통',   desc: '유연 밸런스로 무난하게 운영합니다. 상황 대응은 선수 능력치가 맡습니다.' },
      hard:   { name: '어려움', desc: '우리 조합에 어울리는 스타일을 정해 일관되게 운영하고, 점수 차와 인원 열세에 맞춰 판단합니다.' },
      master: { name: '마스터', desc: '자기 스타일을 일관되게 지키면서, 점수 차와 인원·보스 타이밍에 맞춰 판단을 다듬고 서든데스까지 계산해 움직입니다.' }
    }
  },

  /* ---------- 전투 ---------- */
  /* ---------- 경기 중 지휘(지시) ----------
     지휘 포인트(CP)를 써서 팀/개인에게 지시합니다. 지시는 반응 지연 뒤 적용되고 지속 시간이 지나면 자동(설정한 전술)으로 돌아옵니다. */
  orders: {
    cpMax: 3, cpStart: 2, regenSec: 15,
    teamSec: 15, unitSec: 12, recallSec: 3, playerLv: 'ultra',            // playerLv: 내 팀의 자동 지휘는 항상 이 단계로 동작
    delay: { min: 0.5, max: 2 },
    ai: {                                                                 // AI 지휘관: every 판단 간격(초) · noise 판단 흔들림 · keep 아껴 둘 CP · min 지시를 낼 최소 이득 · unit 개인 지시 사용
      easy: { every: 5, noise: 0.35, keep: 1, min: 1.8, unit: 0 }, normal: { every: 3.5, noise: 0.2, keep: 0, min: 1.3, unit: 1 },
      hard: { every: 2.5, noise: 0.1, keep: 0, min: 1.0, unit: 1 }, master: { every: 1.5, noise: 0, keep: 0, min: 0.8, unit: 1 },
      ultra: { every: 0.5, noise: 0, keep: 0, min: 0.4, unit: 1, sight: 1, sharp: 1.4, gap: 0.4, lat: 0.1, recall: 0.5 }   // sight 숨은 적까지 파악 · sharp 승패 판정 날카로움 · gap 지시 교체 문턱 배율 · lat 지시 전달 지연(초) · recall 재지시 대기(초)
    },
    cmd: {                                                                // 지시별 기대 이득은 점수(코어 1개 = 1점) 환산
      bossCap: 0.6, bossBuff: 2.5, bossLoss: 2, carryPen: 0.3, near: 26, joinFar: 0.4, raceK: 1.8, contest: 0.55,
      stealP: 0.4, stealBoost: 0.6, lateMul: 0.2, etaSlack: 3, killSec: 20, depSec: 15, pre: 0.6, soonSec: 10,
      wave: 0.4, contested: 0.3, reach: 80, endCut: 12, endRamp: 18, suddenWave: 9,
      riskBase: 0.15, riskFoe: 0.3, riskEnd: 0.3, threatR: 35, escortCost: 0.8,
      kill: 0.6, killLoss: 1,
      depLeft: 20, depEnd: 1, depHurt: 0.5, hurtHp: 0.5, ultBoss: 0.25, ultReach: 6,
      needLead: 4, appetite: 0.5,
      dropBelow: 0.3, switchGap: 1.5, cpBar: 0.6, fullBar: 0.5, urgent: 3,
      idleSec: 5, idleSpd: 1.2, calmR: 30, idleBoost: 1.5, podHp: 0.4, podV: 2.5, passive: ['bossWait', 'ambush', 'retreat', 'regroup']
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
    speeds: [1, 2, 4,16],
    mana: { regenPerSec: 0.05, onHit: 4, onHurt: 3, startRatio: 0.4 },
    map: {
      killPoints: 0, acePoints: 0,
      core: MAP_CORE,
      bonus: { first: 0, cap: 0, shut: 0, shutAt: 3 },
      sudden: { hpRatio: 0.35, maxTicks: 1200, protect: 3, pressSec: 30, kinds: ['playoff', 'msi', 'worlds'] },
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
    skillStartCdRatio: 0.3, ultStart: 0.2, ultAtk: 2.5, ultSkill: 8, ultRefCd: 32,      /* 궁 게이지: 시작 비율 · 기본공격/스킬 1회 충전량(%) · 기준 cd(궁 cd가 클수록 충전 느림) */
    /* 파이터별 궁 충전 배율 (1 = 기본, 클수록 빨리 참 / 작을수록 천천히 참). 위 cd 보정에 추가로 곱해집니다. 없는 파이터는 1.
       기준: 위력 · 범위 · 사거리 · 부가효과(CC/무적/회복)가 강할수록 낮게, 자기 강화·보조형이나 공속이 빠른 파이터는 높게.
       alien(슈퍼 상태에서만 궁 사용), aria·steamman(변환형, 시간 충전)은 해당 없음 */
    ultCharge: {
      /* 전사 */ deathkaiser: 0.90, crow: 1.10, swordsaint: 1.20, sarcoza: 0.85, warrior: 0.90, dash: 1.00, wind: 1.00, thunderbolt: 0.80, magnum: 0.75, fabman: 0.80, oba: 0.85,
      /* 마법사 */ kain: 0.80, hyer: 0.90, salamander: 1.00, plasma: 0.95, necro: 0.85, rusellaster: 1.00, aozu: 1.10, harvest: 0.95, angel: 1.05, renegade: 0.95,
      /* 수호자 */ minotaur: 0.95, rescue: 1.05, zombie: 0.95, alcaba: 0.90, ananta: 0.95, giant: 0.95, etech: 1.00, dt: 0.80, kum: 1.10, gaia: 0.80, carcer: 1.15,
      /* 암살자 */ crush: 1.00, viser: 1.10, darkknight: 0.85, shadow: 1.20, redhood: 1.10, reaper: 0.85, stardust: 0.90,
      /* 사냥꾼 */ press: 0.75, jade: 1.25, dark: 1.10, biomachine: 1.00, frost: 0.85, shining: 1.05, itrain: 1.10, grainger: 1.00, peg: 1.10
    }
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
    skillAI: {
      gW: 0.65, distDiv: 20, target: 2, targetFloor: 0.25, focus: 1.5, finish: 1, want: 3, exec: 4, stack: 2.5, back: 1.2, ccPen: 3, immune: 6,
      stackHold: 2, cdCap: 0.3, emergencyHp: 0.35, burstQ: 0.3, execNear: 0.3, escLo: 0.75, escHi: 0.5
    },
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
      defaults: { finish: 0, assist: 0, whiff: 0.07, dodge: 0.08, ultWait: 6, retargetMul: 1, moodGuard: 0 },
      whiffKinds: ['nuke', 'pierce', 'aoe', 'charge'],          // 스킬샷 정확도가 영향을 주는 스킬 종류 (대상이 있는 공격 스킬)
      limits: { finish: [0, 0.4], assist: [0, 0.3], retreatHp: [0.1, 0.55], ratio: [1.05, 6], leash: [18, 80], chaseT: [1.2, 14], podRun: [0, 90], skillPatience: [0.5, 4], recastHold: [0.3, 1.6], whiff: [0, 0.22], ultWait: [2.5, 12], retargetMul: [0.5, 1.5], moodGuard: [-0.25, 0.4] },
      fx: {
        judge:  [['chaseT', 'mul', -0.12], ['skillPatience', 'add', -0.4]],
        posn:   [['retreatHp', 'add', 0.04]],
        obj:    [['podRun', 'mul', 0.15]],
        team:   [['assist', 'add', 0.15]],
        react:  [['retargetMul', 'mul', -0.25]],
        aim:    [['whiff', 'add', -0.11]],
        ult:    [['ultWait', 'add', -3]],
        fight:  [['finish', 'add', 0.25]],
        clutch: [['moodGuard', 'add', 0.4]]
      },
      objHi: 75, objLo: 40,
      dg: { reach: 55, reachJ: 0.3, reachO: 0.15, base: 3.2, val: 1, dist: 40, margin: 0.6, marginJ: 0.5, hold: 2.5, cool: 3, guardR: 22, guardPen: 1.0, contest: 1.0, race: 0.6, hitSec: 1, holdOdds: 1.2, oddsStay: 0.75, gain0: 0.4, gainNeed: 0.9, gainMin: 0.1, gainMax: 1.6, stayNeed: 0, contestNeed: 0.8,   /* 교전 중 코어 가치 = clamp(gain0 + 점수필요도×gainNeed, gainMin, gainMax) · 뒤질수록 싸움 가치를 stayNeed 비율만큼 깎음 · contestNeed 뒤질수록 적이 있는 코어도 노리는 허용치(contest)를 이 비율만큼 키움. 시뮬 테스트상 contestNeed 만 효과가 있었음 */
    openStay: 1.2, avoidStay: 1.2, aggroWin: 4, winLim: 0.35, needLim: 0.3, depMargin: 0.8, depMarginJ: 0.5, needDep: 1.4, flipDep: 2, distPen: 0.03, distPenO: 0.3, carryW: 0.35, senseO: 0.35, foeJ: 10, mateR: 8, noise: 0.4, biasSec: 2, safeP: 6, stale: 1.5, extend: 4 },
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
      gemChance: 0.1, gemMul: 1.5, cap: 99, premium: 0.008, premiumMax: 0.25,
      /* 전설의 원석: 낮은 등급(grades)의 어린(maxAge 이하) 선수가 chance 확률로 S급 수준 잠재력(pot 범위)을 갖고 태어남. growMul = 성장 가속 배율 */
      legend: { chance: 0.02, grades: ['C', 'B'], maxAge: 21, pot: [86, 94], growMul: 1.8 }
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
      { id: 'judge',  name: '판단력',        icon: '🧠', desc: '전력·점수·위험을 정확히 읽습니다 — 제출 vs 교전 비교, 한타 개시·회피, 보스 개입 여부, 고립 운반자 추격 판단' },
      { id: 'fight',  name: '교전 능력',     icon: '⚔️', desc: '체력이 깎인 적을 놓치지 않고 마무리합니다(캐릭터 능력치에는 영향 없음)' },
      { id: 'react',  name: '반응속도',      icon: '⚡', desc: '상황을 다시 읽는 주기와 목표 전환 속도 — 팀 판단 갱신과 지시 변화에 빠르게 반응합니다' },
      { id: 'posn',   name: '포지셔닝',      icon: '📍', desc: '위험해지기 전에 물러나는 기준과 제출 중 이탈 시점 — 높을수록 일찍 빠지고, 전열 뒤 간격과 우회 폭도 정교합니다' },
      { id: 'ult',    name: '궁극기 운용',   icon: '💥', desc: '궁극기를 좋은 때를 기다리지 않고 더 일찍 씁니다' },
      { id: 'obj',    name: '오브젝트·회복', icon: '🚩', desc: '코어를 더 멀리서 찾고 제출 타이밍을 잘 잡으며, 보스·힐팩도 놓치지 않습니다' },
      { id: 'team',   name: '팀워크',        icon: '🤝', desc: '아군 위치·전력을 넓게 읽고 한타 전 집결, 집중 공격, 궁 연계, 회복팩 순환, 호위를 함께 합니다' },
      { id: 'clutch', name: '클러치·침착성', icon: '🧊', desc: '점수가 밀릴 때 더 빨리 승부수를 던지고 급한 순간에도 성급해지지 않으며, 낮은 폼·멘탈의 악영향을 줄여줍니다' }
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
      releaseMul: 0.5, renewMul: { C: 0.25, B: 0.3, A: 0.4, S: 0.5 }, renewRaise: 0.02, renewMarket: 0.85,
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
    base: 600,
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
    unit: { easy: 2.25, normal: 2.25, hard: 2.1, master: 1.875 },   // 관중 100명당 크레딧
    kindMul: { league: 1, playoff: 1.5, msi: 1.8, worlds: 2.5 },
    rep: { winMul: 1.5, lossMul: 0.5, lossNone: 0.35, titleMul: 1.5 }
  },
  club: {
    currency: '크레딧', maxRoster: 10,      /* 선수단 최대 인원(벤치 포함) — 셀러리캡은 선발 3명에게만 적용 */
    /* 셀러리캡: 라인업 선발 3명의 '캡 반영 연봉' 합 상한 (벤치 선수는 캡과 무관, 이적료·계약금은 자금에서 별도). 초과 시 선발 배치·재계약·이동 승계 불가 */
    cap: { easy: 5200, normal: 8200, hard: 11500, master: 15500 },
    /* 캡 운영: 같은 리그에 머무는 동안 성적·수입에 따라 매 시즌 정산 때 성장(maxGrow 또는 다음 단계 캡 × nextRatio 까지).
       재계약(자기 선수)만 소프트캡을 hardOver 비율까지 넘길 수 있고, 초과분에는 시즌 평균 연봉 기준 tax 비율의 사치세. 시즌 평균 연봉이 하한(floor)보다 낮으면 부족분 × floorPen 벌금(floorGrace 시즌 유예) */
    capRule: {
      maxGrow: 0.3, nextRatio: 0.9, maxStep: 0.08,
      step: { base: 0.02, top: 0.015, topRank: 4, league: 0.03, msi: 0.01, worlds: 0.02 },
      revW: 0.15, revMin: -0.01, revMax: 0.03, refUp: 1.1,
      hardOver: 0.15, tax: 0.5, floor: 0.4, floorPen: 0.5, floorGrace: 1,
      tenure: { perSeason: 0.08, max: 0.4 }      /* 장기 보유 감면: 한 구단에서 보낸 시즌마다 캡 반영 연봉이 perSeason 만큼 줄어듦(최대 max). 실제 지급 연봉은 그대로 */
    },
    startSize: 5,
    godStart: 5,                                   // 새 커리어 시작 시 내 팀에 배정되는 SSS급 시험용 선수 수 (0이면 끔, 5면 역할군별 1명씩)
    startMix: { easy: { C: 0.7, B: 0.3, A: 0, S: 0 }, normal: { C: 0.55, B: 0.4, A: 0.05, S: 0 }, hard: { C: 0.4, B: 0.5, A: 0.1, S: 0 }, master: { C: 0.3, B: 0.55, A: 0.15, S: 0 } },
    startLeagues: ['sea', 'jp', 'na'],            // 새 커리어를 처음 시작할 수 있는 리그
    /* 이동 시 승계: 최대 max 명, 선수당 연봉 × feeMul 비용(새 구단 자금에서). 기존 자금의 fundsKeep 비율을 이월(새 시작 자금의 keepCap 배까지) */
    carry: { max: 3, feeMul: 0.3, fundsKeep: 1, keepCap: 99 },
    /* 승격: order 순서대로 한 번에 maxStep 단계까지. rank = 정규시즌 최소 순위, req = 목표 리그 난이도별 요구 (상위 3명 평균 ovr · A급 이상 수 · 구단 자금) */
    promotion: {
      order: ['sea', 'jp', 'na', 'eu', 'cn', 'kr'], maxStep: 1, rank: 4,
      req: { normal: { avgOvr: 56, minA: 0, funds: 1500 }, hard: { avgOvr: 63, minA: 1, funds: 3000 }, master: { avgOvr: 70, minA: 2, funds: 5000 } }
    },
    startFunds: { easy: 5200, normal: 6000, hard: 7500, master: 9000 },
    /* 구단주 지급액 배율: 시작 선수단 연봉(리그 수준별 AI 등급 분포)과 4위 기준 수지가 맞도록 조정 */
    owner: { base: 4800, rank: [3900, 3000, 2250, 1500, 900, 520, 300, 150], trophy: { league: 3000, msi: 2250, worlds: 5250 },
      winPay: { league: 300, playoff: 800, msi: 1000, worlds: 1800 },        // 경기 승리 수당 (승리할 때마다, 리그 난이도 배율 적용)
      champPay: { league: 15000, msi: 20000, worlds: 50000 },                // 대회 우승 즉시 상금 (시즌 정산의 우승 보너스와 별도, 리그 난이도 배율 적용)
      leagueMul: { easy: 1, normal: 1.55, hard: 2.5, master: 3 } },
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

  facility: {
    costScale: 3,                                  /* 시설 업그레이드 비용 전체 배율 (1 = 기존) */
    managers: {
      img: 'img/manager/manager{n}.png', costScale: 3,       /* 매니저 해금 비용 전체 배율 */
      /* 추가: 아래 list 끝에 { name, role, cost, fx, zone:{face,chest}, [pic, alt, zoneAlt, lines] } 한 줄 · 번호=순서(1번=기본, 비용 0) */
      list: [
        { name: '강지윤', role: '서머 파이널 현장 운영', cost: 0, fx: { sk: { team: 3, judge: 3 }, inc: 0.3, fan: 0.25, tix: 0.25, form: 3, mental: 3, trouble: 0.1, recover: 1, chem: 2, grow: 0.2 },
          zone: { face: [31, 25, 43, 34], chest: [24, 72, 50, 18] } },
        { name: '오유진', role: '토너먼트 대진·운영 총괄', cost: 12000, fx: { sk: { react: 4, initiator: 4, aim: 4 }, inc: 0.5, fan: 0.45, tix: 0.4, form: 6, mental: 5, trouble: 0.2, recover: 2, chem: 3, grow: 0.35 },
          zone: { face: [24, 30, 54, 38], chest: [20, 76, 60, 20] } },
        { name: '차서현', role: '팀 데이터 분석·육성 보조', cost: 11000, fx: { sk: { judge: 4, posn: 4, obj: 4 }, inc: 0.5, fan: 0.4, tix: 0.45, form: 5, mental: 6, trouble: 0.2, recover: 2, chem: 3, grow: 0.4 },
          zone: { face: [30, 19, 45, 35], chest: [18, 74, 62, 20] } },
        { name: '윤하린', role: '선수 컨디션·멘탈 케어', cost: 13000, fx: { sk: { safe: 4, team: 4, counter: 4 }, inc: 0.45, fan: 0.4, tix: 0.4, form: 5, mental: 6, trouble: 0.25, recover: 3, chem: 3, grow: 0.35 },
          zone: { face: [26, 19, 50, 40], chest: [14, 70, 64, 22] } },
        { name: '박다은', role: '팬 이벤트·행사 진행', cost: 12000, fx: { sk: { clutch: 4, ult: 4, team: 4 }, inc: 0.5, fan: 0.5, tix: 0.4, form: 5, mental: 5, trouble: 0.2, recover: 2, chem: 4, grow: 0.35 },
          zone: { face: [22, 12, 60, 48], chest: [14, 80, 66, 18] } },
        { name: '송유빈', role: '우주 항로 안내·궁극기 코칭', cost: 11000, fx: { sk: { poke: 4, counter: 4, react: 4 }, inc: 0.5, fan: 0.4, tix: 0.4, form: 6, mental: 5, trouble: 0.2, recover: 2, chem: 3, grow: 0.4 },
          zone: { face: [25, 18, 52, 44], chest: [24, 72, 56, 22] } },
        { name: '정서아', role: '게이밍 하우스 훈련 총괄', cost: 13000, fx: { sk: { fight: 4, aim: 4, react: 4 }, inc: 0.5, fan: 0.4, tix: 0.4, form: 6, mental: 5, trouble: 0.2, recover: 3, chem: 3, grow: 0.4 },
          zone: { face: [28, 19, 52, 40], chest: [14, 76, 66, 22] } },
        { name: '신지아', role: '휴양·컨디션 회복 담당', cost: 12000, fx: { sk: { team: 4, safe: 4, posn: 4 }, inc: 0.45, fan: 0.4, tix: 0.4, form: 5, mental: 6, trouble: 0.25, recover: 3, chem: 3, grow: 0.35 },
          zone: { face: [27, 27, 50, 40], chest: [24, 76, 52, 22] } },
        { name: '주아린', role: '굿즈 기획·브랜드 운영', cost: 11000, fx: { sk: { ult: 4, initiator: 4, allin: 4 }, inc: 0.45, fan: 0.5, tix: 0.4, form: 5, mental: 5, trouble: 0.2, recover: 2, chem: 4, grow: 0.35 },
          zone: { face: [23, 24, 63, 50], chest: [24, 82, 56, 16] } },
        { name: '한소율', role: '데이터 분석·전술 노트', cost: 13000, fx: { sk: { judge: 4, obj: 4, team: 4 }, inc: 0.5, fan: 0.4, tix: 0.45, form: 5, mental: 6, trouble: 0.2, recover: 2, chem: 3, grow: 0.4 },
          zone: { face: [21, 12, 68, 54], chest: [30, 76, 48, 22] } },
        { name: '류지안', role: '대학 연계 홍보·신규 팬 유치', cost: 12000, fx: { sk: { aim: 4, clutch: 4, poke: 4 }, inc: 0.5, fan: 0.45, tix: 0.4, form: 6, mental: 5, trouble: 0.2, recover: 2, chem: 3, grow: 0.35 },
          zone: { face: [28, 15, 58, 48], chest: [24, 76, 52, 22] } },
        { name: '최예린', role: '신인 육성·멘토링', cost: 12000, fx: { sk: { posn: 4, poke: 4, allin: 4 }, inc: 0.5, fan: 0.4, tix: 0.4, form: 5, mental: 5, trouble: 0.25, recover: 3, chem: 3, grow: 0.4 },
          zone: { face: [21, 13, 66, 50], chest: [18, 78, 64, 20] } }
      ]
    },
    order: ['shop', 'goods', 'cafe', 'fanzone', 'training', 'dorm', 'medical', 'lounge'],
    costMul: { easy: 1, normal: 1, hard: 1, master: 1 },      // 시설·매니저 비용은 리그 난이도와 무관하게 동일
    base: { formFloor: 30, mentalFloor: 40 }, troubleMin: 0.4,
    defs: {
      shop:     { name: '매점',   icon: '🍔', max: 5, cost: [300, 500, 800, 1200, 1800],  fx: { inc: 0.16 },                          desc: '홈 경기 부가 수입이 늘어납니다.' },
      goods:    { name: '굿즈샵', icon: '👕', max: 5, cost: [300, 500, 800, 1200, 1800],  fx: { inc: 0.12, fan: 0.015 },              desc: '부가 수입과 팬 증가가 소폭 늘어납니다.' },
      cafe:     { name: '카페',   icon: '☕', max: 4, cost: [250, 400, 650, 1000],        fx: { inc: 0.06, mental: 0.4 },             desc: '부가 수입과 멘탈이 소폭 오릅니다.' },
      fanzone:  { name: '팬존',   icon: '🎤', max: 5, cost: [450, 700, 1100, 1600, 2400], fx: { tix: 0.06, fan: 0.03 },               desc: '티켓 수입과 팬 증가가 늘어납니다.' },
      training: { name: '연습장', icon: '🎯', max: 5, cost: [500, 800, 1200, 1800, 2600], fx: { form: 1.6, formFloor: 3 },           desc: '선발 폼 평균이 오르고 슬럼프가 얕아집니다.' },
      dorm:     { name: '합숙소', icon: '🛏', max: 5, cost: [400, 650, 1000, 1500, 2200], fx: { trouble: 0.08, mental: 0.4 },        desc: '트러블이 줄고 멘탈이 안정됩니다.' },
      medical:  { name: '의료실', icon: '🩺', max: 4, cost: [350, 600, 950, 1400],        fx: { recover: 1, mentalFloor: 4, mental: 0.4 }, desc: '컨디션 회복이 빨라지고 멘탈 하한이 오릅니다.' },
      lounge:   { name: '라운지', icon: '🛋', max: 5, cost: [400, 650, 1000, 1500, 2200], fx: { mental: 1, chem: 1.6 },              desc: '멘탈과 팀워크(케미)가 오릅니다.' }
    }
  },

  ui: { teamColors: ['#5ee7ff', '#ff6ec7'], starCount: 90 },
  fighters: {}   // fighters.js 에서 채워집니다
};

const _has = (e, k) => e.st.some(s => s.key === k);
const _cluster = { ready: (b, u, t, pl) => ((pl && pl.n >= 2) || t.hp <= t.maxHp * 0.3 ? 1 : 0), hold: 3 };
CONFIG.skillUse = {
  wr_ult: { exec: 0.3, hold: 3 },
  cu_ult: { exec: 0.4, hold: 3 },
  dk3_ult: { exec: 0.35, hold: 2.5 },
  vz_s1: { low: 2 },
  cu_s2: { want: (b, u, e) => _has(e, 'bleed'), ready: (b, u, t) => (_has(t, 'bleed') ? 1 : 0), hold: 1 },
  sa_s2: { want: (b, u, e) => _has(e, 'poison'), ready: (b, u, t) => (_has(t, 'poison') ? 1 : 0), hold: 1.2 },
  sl_s2: { want: (b, u, e) => e.st.some(s => s.key === 'sal_mark' && s.src === u), ready: (b, u, t) => (t.st.some(s => s.key === 'sal_mark' && s.src === u) ? 1 : 0), hold: 1.2 },
  kn_s2: { want: (b, u, e) => _has(e, 'freeze') },
  kn_ult: _cluster, ne_ult: _cluster, ga_ult: _cluster, dt_ult: _cluster,
  ru_ult: { cc: true }, cs_s2: { cc: true }, hv_m1: { cc: true }, ar_g1: { cc: true },
  pr_s1: { mode: 'escape', r: 9.5, rMax: 9.8 },
  dk_r2: { mode: 'escape', r: 9.5, rMax: 9.8 }
};

/* 시간대 계획 항목은 운영 기조와 같은 선택지를 씁니다 */
CONFIG.tactics.team.filter(c => c.noLevel).forEach(c => {
  c.options = [{ id: 'follow', name: '기조 따름', desc: '이 시간대에도 운영 기조를 그대로 따릅니다.' }, ...CONFIG.tactics.team[0].options];
});

/* ---------- 매니저 마스코트: 대사·히트존 데이터 (대사만 추가하면 자동 적용) ----------
   토큰: {team} 팀명 · {rank} 순위 · {streak} 연승 · {funds} 자금 · {opp} 다음 상대 · {round} 라운드 · {season} 시즌 · {mgr} 매니저 이름 */
CONFIG.mascot = {
  debug: false,
  chatterMs: [28000, 52000],
  poorFunds: 1500, richFunds: 14000,
  zone: { face: [32, 12, 36, 17], chest: [28, 80, 64, 13] },
  zones: {},
  face: [
    '앙~ 간지러워요~', '에헤헤, 볼 만지지 마세요~ 말랑해서 늘어나요!', '감독님~ 저 오늘 예뻐요? 예쁘죠? 네?', '앙~ 감독님 손 따뜻해요…',
    '헤헤, 감독님이 쓰다듬어 주면 기운이 팍팍 나요!', '꺄륵~ 심장이 두근두근해요!', '으응~ 조금만 더요~', '와앙~ 머리도 쓰다듬어 주세요!',
    '쪽! …앗, 방금 건 못 들은 걸로 해주세요!', '감독님 최고! 오늘도 제가 응원할게요, 화이팅!', '에헤~ 자꾸 그러면 더 좋아해버릴 거예요!',
    '앙앙~ 기분 좋아요~', '음냐~ 감독님 곁이 제일 편해요.', '히히, 감독님 웃는 거 처음 봤어요!', '{mgr}는 감독님 편이에요, 언제나요!',
    '오늘도 같이 힘내요! 아자아자!', '뽀뽀는 우승하고 나서요~ 비밀이에요!', '헤헤, 저 이대로 하루 종일 있어도 좋아요~', '앙~ 감독님이 부르면 어디서든 달려와요!',
    '엣헴, 오늘 컨디션 최고예요! 감독님은요?', '꺄~ 앞머리 흐트러지잖아요!', '두근두근… 얼굴 빨개진 거 보이죠?', '감독님 손이 마법 같아요, 피로가 싹~!'
  ],
  faceMany: [
    '자, 잠깐만요~ 얼굴 빨개지잖아요!', '감독님~ 자꾸 그러시면 일에 집중이 안 돼요!', '으응~ 이제 그만! 경기 준비하러 가야죠?',
    '앙! 이러다 볼이 닳겠어요~', '그만 만지고 선수들한테도 이렇게 다정하게 해주세요!', '히잉~ 알았어요, 알았으니까 이제 그만요!'
  ],
  chest: [
    '꺄앗! 어, 어딜 만지는 거예요!', '그, 그만요… 부끄럽단 말이에요 ///', '감독님 바보! 저 안 볼래요!', '으읏… 얼굴 뜨거워… 다음엔 먼저 말씀해 주세요!',
    '히잉… 그런 장난은 반칙이에요~', '아, 안 돼요오~! 두 손으로 가릴 거예요!', '감독님 이상해요… 심장이 터지겠어요 ///', '꺄아악! 놀랐잖아요, 정말!',
    '모, 몰라요! 부끄러워서 쳐다도 못 보겠어요…', '으으… 이런 건 둘만 있을 때도 곤란해요!', '앗! 그, 그쪽은 터치 금지 구역이에요!', '으아… 귀까지 빨개졌죠? 보지 마세요!',
    '감독님!! 매니저 놀리면 못써요!', '우웅… 부끄러워서 숨고 싶어요…'
  ],
  chestMad: [
    '정말 화낼 거예요! 으르렁~', '감독님!! 자꾸 그러면 월급 깎을 거예요!', '자꾸 그러면 연습 스케줄 빡세게 짜놓는다요?', '흥! 삐졌어요. 사과하실 때까지 말 안 할래요.',
    '진짜 진짜 마지막 경고예요! 이제 안 봐줄 거예요!', '두고 보세요, 오늘 밥은 감독님만 빼고 시킬 거예요!'
  ],
  body: [
    '꺄하하, 간지러워요~', '앗, 콕콕 하지 마세요~', '저 여기 있어요! 부르셨어요?', '감독님, 저한테 할 말 있으세요?', '짠! 매니저 소환 완료~',
    '오늘 일정 확인해 드릴까요?', '뭐 도와드릴까요? 뭐든 말씀만 하세요!', '으응? 저 불렀어요?', '히히, 눌러도 아무것도 안 나와요~', '간식 주시는 거예요? 아니에요? 쳇~',
    '감독님, 잠깐 쉬었다 해요~ 쭈욱 스트레칭!', '어어, 흔들지 마세요~ 어지러워요!'
  ],
  idle: [
    '물 마시는 거 잊지 마세요, 감독님!', '잠깐 스트레칭 한번 해요~ 쭈우욱~', '오늘 점심은 뭐 드셨어요? 저는 샌드위치요!', '선수들 컨디션도 한 번 살펴봐 주세요~',
    '저 응원 열심히 하고 있답니다!', '눈 오래 쓰면 피곤해요, 잠깐 먼 곳 보세요~', '감독님 오늘도 멋져요! …라고 말하래요, 헤헤. 진심이에요!', '연습생들이 밤새 게임하는 거 아세요? 저는 다 알아요~',
    '오늘은 어떤 전술을 써볼까요? 두근두근!', '팬레터가 도착했어요! …제가 쓴 건 아니에요, 아마도요!', '시설 업그레이드는 계획적으로~ 지갑이 울어요!', '저도 게임 잘하고 싶어요. 알려주실래요?',
    '숨 한번 크게 쉬어요, 후우~', '오늘 날씨 좋죠? 창문 열고 환기해요!', '간식 타임! 당 충전하면 전술도 달콤해져요~', '제가 모아둔 선수 칭찬 리스트, 보여드릴까요?',
    '감독님은 어떤 파이터가 제일 좋아요? 전 귀여운 애요!', '노래 흥얼흥얼~ 랄랄라~', '구단 로고 볼 때마다 뿌듯해요!', '혹시 졸리면 말씀하세요, 자장가 불러드릴게요~'
  ],
  time: {
    morning: ['좋은 아침이에요, 감독님! 오늘도 화이팅!', '아침은 드셨어요? 든든하게 먹어야 전술도 잘 떠올라요!', '으음~ 아침 햇살 좋다~ 오늘 일정 시작해요!'],
    noon: ['점심시간이에요! 맛있는 거 드세요~', '밥 먹고 하면 더 잘돼요, 진짜예요!', '배고프다~ 감독님, 오늘 메뉴 추천해 주세요!'],
    afternoon: ['나른한 오후네요… 커피 한 잔 할까요?', '오후에도 힘내요! 조금만 더요!', '간식 타임~ 하나 드실래요?'],
    evening: ['오늘 하루 수고하셨어요, 감독님!', '저녁은 꼭 챙겨 드세요~ 저는 치킨 먹고 싶어요!', '퇴근하고 싶다… 아, 아니에요! 끝까지 같이해요!'],
    night: ['벌써 시간이 이렇게 됐네요… 무리하지 마세요!', '밤샘은 몸에 안 좋아요, 감독님. 이제 쉬어요~', '졸리면 얼른 주무세요… 저도 하품이 나와요 하암~']
  },
  view: {
    league: ['리그 화면이에요! 오늘 경기 준비는 끝나셨어요?', '순위표는 제가 매일 확인하고 있어요, 지금 {rank}위!', '다음 상대는 {opp}! 분석 자료 챙겨놨어요~', '{round}라운드예요, 한 경기씩 차근차근 가요!', '일정표 보는 거 좋아해요~ 두근두근해요!'],
    club: ['구단 관리 시간이에요! 선수들 컨디션부터 볼까요?', '자금은 {funds} 크레딧이에요, 알뜰하게 써봐요~', '시설 꾸미기도 재밌어요! 제 방도 예쁘게 해주세요~', '선수들 면담도 잊지 마세요, 다들 감독님 기다려요!', '라인업 점검! 1·2·3번 모두 괜찮은지 확인해요!', '구단 운영은 살림이 반이래요. 제가 옆에서 도울게요!'],
    market: ['이적시장이에요! 좋은 선수 놓치면 안 돼요~', '눈여겨본 선수 있으세요? 제가 같이 찾아드릴게요!', '자금이 {funds} 크레딧인데… 지르기 전에 한 번 더 생각해요!', '유망주를 키우는 것도 방법이에요, 장기전이에요~', '계약서 도장 찍기 전에 능력치 한 번 더 확인!', '싸고 좋은 선수는 숨어 있대요, 같이 찾아봐요!'],
    codex: ['파이터 도감이에요! 구경하면 시간 가는 줄 몰라요~', '어떤 파이터가 마음에 드세요? 전 귀여운 애가 좋아요!', '스킬 설명 읽는 거 재밌어요! 궁극기가 특히요!', '상대 파이터 약점도 같이 공부해 둬요, 밴픽에 도움 돼요!', '도감 다 채우면 박사님이라고 불러드릴게요!', '이 파이터랑 저 파이터, 조합이 좋을지 같이 생각해 봐요~'],
    tactics: ['전술 짜는 시간! 감독님의 머릿속이 궁금해요~', '전술은 우리 팀이 어떻게 싸울지 정하는 거래요!', '너무 복잡하면 머리 아파요… 천천히 해요~', '이번엔 어떤 작전으로 놀라게 해줄까요?', '전술 저장하는 거 잊지 마세요!', '작전이 통할 때가 제일 짜릿해요, 그쵸?'],
    data: ['데이터 센터예요! 숫자 보는 건 감독님이 최고예요~', '승률이 눈에 보이니까 더 힘나요!', '어떤 파이터가 제일 잘 먹히는지 분석해 봐요!', '기록은 거짓말을 안 해요… 열심히 한 흔적이에요!', '통계 보다 보면 답이 보일 거예요, 같이 봐요!'],
    trophy: ['트로피장이에요! 반짝반짝 눈부셔요~', '이 트로피들, 전부 감독님이 만든 거예요!', '다음엔 어떤 트로피를 올려볼까요? 두근두근!', '빈 자리가 보이시죠? 얼른 채워야겠어요~', '트로피 닦는 건 제 담당이에요! 광내는 중~']
  },
  say: {
    win: ['이겼다! 이겼어요 감독님!! 꺄아~', '역시 우리 감독님! 완벽한 지휘였어요!', '승리의 맛은 달콤하네요~ 오늘은 제가 쏠게요!', '{team}, 최고예요! 짝짝짝!', '와아! 선수들 칭찬해 주러 가요!'],
    lose: ['아… 졌네요… 그래도 괜찮아요, 다음이 있잖아요!', '속상해하지 마세요, 감독님. 제가 옆에 있을게요.', '오늘은 운이 없었어요. 다음엔 꼭 이겨요!', '괜찮아요, 괜찮아요! 지는 날도 있는 법이에요. 맛있는 거 먹어요!', '복기하면 분명 답이 보일 거예요. 같이 해요!'],
    tie: ['아슬아슬했어요… 심장 떨어지는 줄 알았어요!', '비겼네요! 지지 않은 걸로 위안 삼아요~'],
    hot: ['{streak}연승이라니! 감독님 완전 무적이에요!', '이 기세 그대로 쭉 가요! {streak}연승 중이에요!', '연승 행진! 팬분들 난리 났어요~'],
    blaze: ['{streak}연승… 믿을 수가 없어요! 전설이에요!', '이쯤 되면 상대 팀이 감독님 이름만 들어도 떨겠어요!'],
    slump: ['요즘 좀 힘들죠… 그래도 전 감독님 믿어요!', '연패는 금방 끊을 수 있어요! 전술 같이 다시 봐요!'],
    top: ['지금 {rank}위! 우승도 꿈이 아니에요!', '선두권이에요! 계속 이렇게만 가요!'],
    upper: ['지금 {rank}위, 플레이오프권이에요! 조금만 더 힘내요!', '순위표 볼 때마다 뿌듯해요~ {rank}위!'],
    low: ['순위가 조금 아쉽네요… 하지만 아직 늦지 않았어요!', '지금 {rank}위… 분위기 반전이 필요해요! 제가 응원할게요!'],
    early: ['시즌 초반이에요! 천천히, 하지만 확실하게 가요!', '이번 시즌은 어떤 이야기가 될까요? 설레요!'],
    mid: ['중간 점검 타임! 선수 컨디션 확인해 봐요~', 'MSI도 다가오네요, 준비 잘해야 해요!'],
    late: ['시즌 막바지예요, 집중 또 집중!', '남은 경기가 얼마 없어요! 끝까지 가요, 감독님!'],
    msi: ['MSI예요! 세계 무대에서 우리 팀을 보여줘요!', '국제전은 긴장돼요… 저 손에 땀이 나요!'],
    playoff: ['플레이오프예요! 여기서부터가 진짜죠!', '한 경기 한 경기가 결승이에요, 감독님!'],
    worlds: ['월드 챔피언십이에요! 꿈의 무대네요!', '여기까지 오다니… 감동이에요 흑흑. 우승까지 가요!'],
    end: ['시즌 수고하셨어요, 감독님! 푹 쉬어요~', '이번 시즌도 정말 멋졌어요! 다음 시즌도 같이해요!'],
    poor: ['자금이 {funds}밖에 안 남았어요… 아껴 써야 해요!', '지갑이 가벼워요… 시설 투자는 조금만 참아요~'],
    rich: ['자금이 {funds}나 있어요! 시설 업그레이드 어때요?', '부자 구단이에요! 좋은 선수 영입도 노려봐요~'],
    noLineup: ['앗, 아직 라인업이 비어 있어요! 선수 3명을 배치해 주세요~', '경기 전에 1·2·3번 라인업부터 채워야 해요!'],
    cup: ['트로피장이 반짝반짝해요! 더 채워봐요~', '우승 트로피 닦는 건 제 담당이에요, 헤헤.'],
    first: ['처음이라 떨려요… 잘 부탁드려요, 감독님!', '{team}의 첫 시즌! 같이 멋진 역사를 써요!']
  }
};

/* ---------- 매니저별 전용 대사 (번호 = img/manager/manager{n}.png) ----------
   1 강지윤(다정한 언니) · 2 오유진(에너자이저) · 3 차서현(수줍은 분석가) · 4 윤하린(걱정 많은 케어러) · 5 박다은(분위기메이커) · 6 송유빈(여우·고양이 밀당)
   7 정서아(운동 코치) · 8 신지아(나른한 응석꾼) · 9 주아린(셀카·굿즈 여친) · 11 류지안(여유로운 연상) · 13 주아린-비키니(직진 여름 소녀) · 15 조은비(도도 츤데레)
   키: face · faceMany · chest · chestMad · body · idle · win · lose · night  (없는 키는 공통 대사로 대체됩니다) */
CONFIG.mascot.personaRate = 0.7;    /* 터치 반응에서 전용 대사가 나올 확률 (나머지는 공통 대사) */
CONFIG.mascot.personaIdle = 0.4;    /* 혼잣말(말풍선)에서 전용 대사가 나올 확률 */
CONFIG.mascot.personaAlias = {};
CONFIG.mascot.persona = {
  1: {
    face: ["어머, 감독님 손이 따뜻하네요. 기분 좋아요~", "후후, 쓰다듬어 주는 거예요? 더 해도 돼요.", "그렇게 쳐다보면 부끄러워요, 감독님~", "이리 와 봐요, 저도 쓰담쓰담 해드릴게요.", "감독님이 만져주면 하루 피로가 싹 풀려요~", "에이, 간지러워요~ 후후.", "오늘도 감독님 곁에 있어서 행복해요.", "저 지금 웃고 있죠? 감독님 때문이에요.", "으응~ 조금만 더요, 딱 한 번만 더~", "감독님, 오늘은 제가 챙겨드릴게요. 가만히 계세요~", "나 예뻐요? …대답 안 하면 삐질 거예요.", "현장에서 제일 보고 싶었던 얼굴이 감독님이에요."],
    faceMany: ["감독님~ 자꾸 만지면 얼굴 빨개진단 말이에요.", "이러다 일 못 해요~ 이제 그만, 네?", "후우… 심장 소리 들리겠어요. 잠깐만요!"],
    chest: ["어머, 감독님! 거긴 안 돼요~", "장난이 지나치세요… 얼굴 달아올랐어요.", "그, 그런 건 먼저 물어봐야죠~", "감독님… 저 지금 많이 놀랐어요.", "후후, 안 돼요. 선 넘으면 곤란해요.", "으응… 부끄러우니까 이제 그만요."],
    chestMad: ["감독님, 저 진짜 화낼 거예요. 조용히 화내는 게 더 무서운 거 알죠?", "이번엔 안 넘어가요. 사과부터 해주세요.", "현장 운영 보고서, 감독님 것만 안 올려드릴 거예요.", "삐졌어요. 달래줄 때까지 안 풀 거예요."],
    body: ["네, 감독님. 불러주셨어요?", "오늘 현장 체크는 끝났어요, 걱정 마세요.", "후후, 저 여기 있어요~", "필요한 거 있으면 말씀만 하세요.", "일정 정리해 둘까요? 감독님 먼저 쉬어요.", "콕콕 하지 마세요~ 간지럽단 말이에요.", "손이 심심하세요? 그럼 저랑 손잡을래요?", "감독님 오늘 표정 좋으시네요. 무슨 좋은 일 있었어요?"],
    idle: ["감독님, 커피 한 잔 타드릴까요? 제가 타면 맛있어요~", "오늘도 고생 많으셨어요. 제가 어깨 주물러 드릴까요?", "저는요, 감독님이 웃는 얼굴이 제일 좋아요.", "경기 끝나고 같이 저녁 먹어요. 제가 맛집 봐뒀어요~", "감독님 생각하다가 서류 한 장을 두 번 읽었지 뭐예요, 후후.", "가끔은 쉬어가도 돼요. 감독님 몸이 먼저예요.", "있잖아요, 감독님 옆자리가 제일 편해요.", "오늘 하루 어땠어요? 저한테만 살짝 얘기해 줘요.", "제가 감독님 팬 1호인 거 알죠? 변하지 않아요~", "감독님이 힘들어 보이면 저도 마음이 쓰여요.", "우리 감독님, 오늘도 멋있다… 아, 혼잣말이에요!", "비 오는 날엔 같이 따뜻한 차 마시고 싶어요.", "감독님, 잊은 거 없죠? 제가 다 챙겨놨어요. 칭찬해 주세요~", "시즌 끝나면 단둘이 바람 쐬러 가요. 약속이에요?", "피곤하면 제 어깨 빌려드릴게요. 잠깐이면 돼요.", "감독님 이름 부를 때마다 괜히 기분이 좋아져요.", "저 오늘 향수 바꿨어요. 눈치채셨어요? …아직이죠?"],
    win: ["이겼어요, 감독님! 제가 제일 먼저 안아드리고 싶어요.", "역시 감독님이에요. 오늘은 칭찬 많이 해드릴게요~"],
    lose: ["괜찮아요, 감독님. 오늘은 제가 곁에 있어 드릴게요.", "속상할 땐 기대도 돼요. 제 어깨, 비어 있어요."],
    night: ["감독님, 이제 들어가서 쉬어요. 걱정돼서 그래요.", "늦은 시간까지… 그럼 제가 끝까지 옆에 있을게요."],
    champ: ["{cup} 우승이에요, 감독님! 저… 눈물 날 것 같아요. 정말 자랑스러워요.", "우리가 해냈어요! 오늘은 제가 꼭 안아드릴게요.", "{cup} 챔피언 감독님! 고생 많으셨어요, 정말로요.", "이 순간을 감독님 곁에서 볼 수 있어서 행복해요."],
    runnerUp: ["아쉽지만 {cup} 준우승도 대단해요. 감독님, 정말 잘했어요.", "조금만 더였는데… 괜찮아요, 제가 안아드릴게요."],
    out: ["{cup}에서 탈락이네요… 그래도 감독님 잘못 아니에요. 푹 쉬어요.", "속상하죠… 이럴 땐 제가 따뜻한 차 내어 드릴게요."],
    qualify: ["{cup} 진출이에요! 감독님, 정말 멋져요~", "와, 우리 {cup}에 가요! 제가 옆에서 끝까지 응원할게요.", "진출 축하해요, 감독님. 오늘은 마음껏 기뻐해도 돼요."],
    miss: ["이번엔 {cup}에 못 갔지만… 괜찮아요, 다음이 있어요.", "아쉽죠. 그래도 감독님 곁엔 제가 있잖아요."],
    streak: ["{streak}연승이에요! 감독님 정말 대단해요~", "벌써 {streak}연승! 저도 모르게 박수 쳤어요, 짝짝.", "이 기세 너무 좋아요. 그래도 무리는 하지 마요, 네?"],
    streakBreak: ["연승이 끊겼네요… 그래도 정말 잘해왔어요.", "괜찮아요, 연승은 또 만들면 되죠. 오늘은 쉬어요."],
    rankTop: ["감독님, 1위예요! 순위표 맨 위에 우리 이름이 있어요~", "1위라니… 믿기지 않아요. 정말 멋져요, 감독님."],
    playoffLine: ["{rank}위, 플레이오프권이에요! 감독님 덕분이에요.", "순위가 올랐어요! 조금만 더 힘내요, 제가 곁에 있을게요."]
  },
  2: {
    face: ["감독니임~ 쓰다듬는 거야? 좋아좋아!", "헤헤, 머리 쓰담쓰담 해주면 에너지 120% 충전이에요!", "앗 간지러워! 하지 마요~ 하지 말라니까~ 하하!", "나 오늘 대진표 다 외웠어요! 칭찬해 줘요, 칭찬!", "감독님 손 크다~ 얼굴이 쏙 들어가네요, 히히.", "쪽… 은 아니고요! 볼 만져서 간 보는 거예요!", "와~ 감독님이 먼저 만져주다니, 오늘 무슨 날이에요?", "으아, 심쿵! 잠깐 심장 좀 진정시킬게요.", "내 편은 감독님뿐이야~ 알죠? 알죠~?", "나 지금 완전 기분 좋아서 날아갈 것 같아요!", "한 번만 더요, 한 번만! 응? 응? 네에~?", "감독님 쓰다듬는 솜씨 합격! 상 드릴게요, 짝짝!"],
    faceMany: ["자자 타임! 오늘 대진 짜야 하는데 정신이 없잖아요!", "아잉, 진짜 그만요! 얼굴 터지겠다~", "감독님 오늘 왜 이렇게 적극적이에요? 부끄럽게!"],
    chest: ["꺄악! 감독님 어디 만져요!", "으아아! 반칙! 레드카드예요!", "아니 감독님! 이건 선 넘었어요!", "헉… 저 지금 얼굴 불난 거 같아요 ///", "장난이어도 그쪽은 안 돼요! 알겠죠?", "으으, 몰라요! 저 대진표 보러 갈래요!"],
    chestMad: ["레드카드 두 장! 퇴장이에요 퇴장!", "감독님 대진표에서 제외시킬 거예요!", "진짜 화났어요! 한 판 붙을래요?!", "흥! 한 시간 동안 말 안 걸 거예요!"],
    body: ["넵! 대진·운영 총괄 오유진, 대기 중입니다!", "왜요왜요, 뭐 시킬 거 있어요?", "콕콕~ 하지 마요, 자꾸 하면 반격할 거예요!", "짜잔! 불렀으면 바로 등장이죠~", "오늘 스케줄 완벽하게 짜놨어요, 확인할래요?", "감독님~ 심심해요? 저랑 놀아요!", "으차차, 스트레칭 같이 해요! 하나둘~", "아아, 눌러도 점수 안 올라가요~ 히히!"],
    idle: ["대진표 짜는 거 은근 재밌어요! 퍼즐 맞추는 느낌?", "감독님~ 우리 오늘 치킨 어때요? 제가 쏠게요! …반반 해요, 반반.", "심심한데 게임 한 판 할래요? 져도 울지 마요~", "나 오늘 컨디션 최고예요! 뭐든 시켜주세요!", "감독님이랑 일하면 하루가 금방 가요, 신기하죠?", "있잖아요, 나 감독님이 웃을 때 제일 좋아요! 더 웃어요!", "오늘 목표! 감독님 한 번 더 웃기기! 시작!", "야호~ 오늘도 출근길이 즐거웠어요!", "감독님, 나 안 보고 싶었어요? 난 보고 싶었는데~", "간식 먹을래요? 반 나눠줄게요! 특별 대우예요~", "힝, 감독님이 바쁘면 나 심심해요… 조금만 놀아줘요~", "내가 감독님 1번 팬이거든요! 아, 2번이라고 하면 서운해요!", "오늘 운세 봤는데 감독님 옆에 있으면 대박이래요!", "이기면 소원 하나 들어줘요! 약속~ 새끼손가락!", "감독님 머리에 꽃가루 묻었… 아, 거짓말! 놀랐죠? 히히!", "팔짱 끼고 같이 걸어갈까요? 농담~ 반은 진심이에요!", "이번 시즌 끝나면 같이 놀러 가요! 어디든 좋아요!"],
    win: ["야호!! 이겼다! 감독님 하이파이브!", "우리 감독님 짱! 오늘 소원권 하나 줄게요~"],
    lose: ["에이~ 괜찮아요! 다음엔 제가 더 열심히 응원할게요!", "울지 마요 감독님, 대신 제가 치킨 쏠게요!"],
    night: ["감독님~ 늦었어요! 나도 졸린데 같이 퇴근해요!", "밤새면 내일 얼굴 푸석해져요! 얼른 자요, 얼른!"],
    champ: ["우승이다아!! {cup} 챔피언 우리 감독님!!", "꺄아악!! 해냈어요 해냈어!! 나 지금 소리 질러도 돼요?!", "{cup} 우승!! 오늘은 제가 감독님 업고 돌아다닐 거예요!", "이거 꿈 아니죠? 볼 꼬집어 줘요, 아니 내가 꼬집을게요 아야!"],
    runnerUp: ["준우승이다! 아쉽긴 한데 진짜 멋졌어요, 감독님!", "다음엔 꼭 우승 가요! 제가 대진 완벽하게 짜올게요!"],
    out: ["{cup} 탈락… 에이, 분하다! 그래도 다음엔 꼭 이겨요!", "울지 마요 감독님, 대신 맛있는 거 먹으러 가요!"],
    qualify: ["{cup} 진출이다! 대진표 제가 제일 먼저 확인했어요!", "야호~! {cup}라니! 나 벌써 떨려요, 감독님!", "진출 축하해요! 이 기세로 쭉쭉 가요!"],
    miss: ["{cup} 못 갔네… 아~ 아쉽다! 다음엔 꼭 가요, 약속!", "으아, 속상해! 그래도 감독님 옆엔 내가 있잖아요!"],
    streak: ["{streak}연승!! 대박! 감독님 무적이에요!", "와 {streak}연승이래요! 하이파이브 해요, 짝!", "연승 행진 멈추지 마요! 제가 응원단장 할게요!"],
    streakBreak: ["아, 연승 끊겼다… 괜찮아요! 다시 쌓으면 돼요!", "에잇, 아쉽다! 그래도 정말 잘했어요, 감독님!"],
    rankTop: ["1위!! 감독님 우리 1위예요!! 순위표 사진 찍을래요!", "맨 위에 우리 이름 있어요! 와, 기분 최고예요!"],
    playoffLine: ["{rank}위, 플레이오프권! 이대로 쭉 가요, 감독님!", "플레이오프 보인다! 두근두근, 대진표 짜볼까요?"]
  },
  3: {
    face: ["…앗, 갑자기 그러시면 놀라요. 싫은 건 아니지만요.", "저, 저 지금 표정 이상하죠? 보지 마세요…", "감독님 손… 생각보다 따뜻하네요. …기록해 둘게요.", "어, 어어… 심박수가 갑자기 올라갔어요. 이거 감독님 탓이에요.", "조금만요. 정말 조금만 더… 아, 아니에요!", "…좋아요. 방금 건 데이터에 없던 감정이에요.", "그렇게 웃으시면 계산이 안 돼요… 반칙이에요.", "칭찬 받는 거… 은근히 기분 좋네요. 헤헤…", "저 사실 감독님이 불러주는 거 기다렸어요. 비밀이에요.", "쓰다듬는 거 처음이라… 어떻게 반응해야 할지 모르겠어요 ///", "다음 데이터 분석 땐 더 잘할게요. 그러니까… 또 해주세요.", "…감독님만 특별히 허락해 드리는 거예요."],
    faceMany: ["저, 저기요… 연산 오류 나요. 너무 자주예요!", "아, 안 되겠어요. 얼굴이 너무 뜨거워서 그래프가 안 보여요…", "이제 그만요… 자꾸 이러시면 집중 못 한단 말이에요."],
    chest: ["…!! 어, 어디를 만지시는 거예요!", "이, 이건 분석 불가예요… 부끄러워서요 ///", "감독님 바보… 갑자기 그러면 어떡해요.", "아, 안 돼요… 숨이 막힐 것 같아요…", "…못 본 걸로 할게요. 그러니까 두 번 하지 마세요.", "으윽… 지금 얼굴 보지 마세요. 진짜로요."],
    chestMad: ["…정말 화났어요. 이번 주 분석 자료 안 드릴 거예요.", "감독님 승률 예측치, 지금 확 낮췄어요.", "사과문 A4 한 장이요. 손으로 쓰세요.", "흥… 삐졌어요. 말 걸지 마세요."],
    body: ["네, 부르셨어요? 자료 준비돼 있어요.", "…콕콕하지 마세요. 집중 흐트러져요.", "아, 감독님. 제가 필요하세요?", "오늘 수치 정리해 뒀어요. …칭찬해 주셔도 돼요.", "저 여기 조용히 있었는데… 불러주셔서 기뻐요.", "무슨 일 있어요? 표정이 평소랑 달라요.", "차, 차 한 잔 하실래요? 제가 가져올게요.", "…가끔은 이렇게 불러주세요. 심심했거든요."],
    idle: ["감독님 최근 승률 그래프 봤어요. 우상향이에요… 뿌듯해요.", "혼자 있을 땐 감독님 경기 영상을 두 번씩 돌려봐요. …비밀이에요.", "숫자는 거짓말을 안 해요. 근데 감독님은 가끔 거짓말하죠? 좋은 쪽으로요.", "…있잖아요, 감독님 옆에 있으면 마음이 편해져요.", "오늘 분석하다가 감독님 생각이 나서 한 줄을 날렸어요. 책임져요.", "감독님이 잘하면 제가 더 기뻐요. 이상하죠?", "밥은 챙겨 드셨어요? …걱정돼서 그래요, 진짜로.", "솔직히 말하면… 감독님이랑 일하는 거 좋아해요.", "제가 말이 별로 없어도… 속으로는 엄청 응원하고 있어요.", "오늘 입은 거 어때요? …아, 아니에요. 잊어버리세요.", "데이터 보다가 졸았어요. 감독님이 깨워주면 좋았을 텐데…", "감독님이 칭찬해 주면 하루 종일 기분이 좋아요.", "다음 경기 승리 확률, 감독님이 있으면 +10%예요. 제 기준으로요.", "…손 시려요. 감독님은 따뜻하죠? 아, 농담이에요!", "감독님, 저한테만 살짝 알려줘요. 오늘 힘들었죠?", "저도 가끔은 애교 부리고 싶은데… 잘 안 돼요. 어색하죠?", "…이렇게 말 걸어 주셔서 고마워요."],
    win: ["이길 줄 알았어요. 제 예측이 맞았죠? …칭찬해 주세요.", "감독님 최고예요. …방금 한 말, 기록은 하지 마세요 ///"],
    lose: ["…오늘은 변수가 많았어요. 감독님 잘못 아니에요.", "다음엔 꼭 이겨요. 제가 밤새서라도 분석해 올게요."],
    night: ["이 시간까지… 같이 있어 드릴게요. 대신 너무 늦진 마세요.", "감독님, 잠은 자야 해요. …걱정돼서 그래요."],
    champ: ["…{cup} 우승이에요. 데이터가 아니라… 감독님이 이긴 거예요.", "정말 해냈어요… 지금 눈물이 나는데, 보지 마세요.", "우승 확률, 제 계산으론 낮았는데… 감독님이 뒤집었어요. 최고예요.", "…축하해요, 감독님. 이 말 하려고 계속 기다렸어요."],
    runnerUp: ["준우승이에요. …수치로 보면 충분히 대단한 성적이에요.", "아쉬워요… 하지만 감독님은 분명 잘했어요. 제가 보증해요."],
    out: ["{cup} 탈락이에요… 변수가 너무 많았어요. 감독님 잘못 아니에요.", "…다음엔 더 정확한 분석 해올게요. 그러니까 너무 속상해하지 마세요."],
    qualify: ["{cup} 진출이에요. …예상보다 빨랐어요. 감독님 덕분이에요.", "진출 확정! …저 지금 조금 설레요. 비밀이에요.", "{cup} 대비 자료, 밤새서라도 만들어 올게요."],
    miss: ["{cup}에 못 갔어요… 다음엔 꼭 갈 수 있게 제가 더 분석할게요.", "…속상하죠. 저도 그래요. 같이 다시 시작해요."],
    streak: ["{streak}연승이에요. …승률 그래프가 예쁘게 올라가요.", "{streak}연승… 솔직히 감탄했어요. 칭찬해 드릴게요.", "이 흐름 유지해요. 제가 옆에서 계속 분석할게요."],
    streakBreak: ["연승이 끊겼어요. …그래도 기록은 남아요. 대단한 거예요.", "괜찮아요. 다음 연승은 제가 같이 만들어 드릴게요."],
    rankTop: ["1위예요. …정말이에요. 표를 세 번 확인했어요.", "순위표 맨 위… 감독님 이름이 있어요. 뿌듯해요."],
    playoffLine: ["{rank}위, 플레이오프권이에요. 확률이 올랐어요, 감독님.", "…좋은 흐름이에요. 이대로만 가면 돼요."]
  },
  4: {
    face: ["아이구, 우리 감독님 오늘도 고생했어요~ 쓰담쓰담.", "어머, 손이 차갑네요. 제가 잡아줄게요.", "후후, 감독님이 이러면 저도 모르게 웃음이 나요.", "더 해도 돼요. 대신 밥 잘 챙겨 먹기, 약속!", "어머, 간지러워요~ 너무 귀엽게 구시는 거 아니에요?", "감독님 기운 없어 보였는데 지금은 괜찮아 보여서 다행이에요.", "저한테 기대도 돼요. 언제든요.", "에헤헤, 감독님 손길 좋아요. 마음이 놓여요.", "자꾸 이러시면… 잔소리 못 하잖아요, 참~", "오늘도 무리했죠? 이리 와요, 잠깐만 쉬어요.", "으응~ 포근해요. 이대로 낮잠 자고 싶어요.", "저는 감독님 편이에요. 세상이 다 뭐라 해도요."],
    faceMany: ["어머, 자꾸 그러시면 부끄럽잖아요~ 이제 그만요.", "으응, 감독님~ 선수들 컨디션 체크하러 가야 해요!", "그만, 그만요~ 얼굴이 홍당무 되겠어요."],
    chest: ["어머! 감독님 거긴… 안 돼요!", "그, 그런 장난은 곤란해요~ 심장 떨어질 뻔했어요.", "으응… 하지 말라고 했잖아요, 정말~", "부끄러워요… 그렇게 쳐다보지 마세요 ///", "감독님, 저 지금 진짜 놀랐어요. 잠깐 숨 좀 쉴게요.", "이런 건 마음 정리 안 된 상태에선 안 돼요…"],
    chestMad: ["감독님, 이번엔 잔소리 폭탄이에요. 각오하세요!", "진짜 화났어요. 오늘 저녁 당근 반찬만 줄 거예요!", "한 번만 더 하면 상담 안 해드려요!", "삐졌어요. 사과할 때까지 안 안아줄 거예요."],
    body: ["부르셨어요? 어디 불편한 데 있어요?", "저 여기 있어요~ 필요한 거 말씀하세요.", "콕콕 하지 마세요~ 간지러워요!", "물은 마셨어요? 제가 챙겨드릴게요.", "선수들 컨디션 체크 끝났어요. 감독님도 체크할까요?", "무슨 고민 있으면 저한테 먼저 말해줘요.", "잠깐 앉아봐요. 목 뻐근하죠? 제가 풀어드릴게요.", "감독님 눈 피곤해 보여요. 잠깐 눈 감아봐요~"],
    idle: ["감독님~ 밥은 먹었어요? 안 먹었으면 저한테 혼나요.", "요즘 잠은 잘 자고 있어요? 눈 밑이 어두워요.", "제 멘탈 케어 서비스 받아보실래요? 오늘은 무료예요~", "우리 감독님, 힘들 땐 힘들다고 말해도 돼요.", "선수들도 감독님 닮아서 다 착해요. 제가 보증해요.", "있잖아요, 저는 감독님이 안 아팠으면 좋겠어요.", "오늘 날씨 쌀쌀해요. 겉옷 챙기셨죠? 역시 안 챙겼죠?", "따뜻한 차 가져왔어요. 식기 전에 마셔요~", "감독님이 웃으면 저도 덩달아 기분이 좋아져요.", "오늘 하루도 잘 버텨줘서 고마워요, 감독님.", "힘들면 저한테 기대요. 어깨는 항상 비어 있어요.", "저 사실 감독님 걱정에 하루 세 번은 확인해요, 헤헤.", "쉬는 날엔 같이 산책해요. 바람 쐬면 마음이 풀려요.", "감독님이 좋아하는 간식, 제가 살짝 숨겨놨어요. 비밀이에요~", "감독님이 아프면 제가 더 아파요. 알았죠?", "자, 심호흡 한번 해요. 후우~ 하아~ 잘했어요!", "감독님 곁이라서 제가 매일 출근하는 게 즐거워요."],
    win: ["이겼네요, 감독님! 정말 수고 많았어요, 안아드릴게요~", "고생했어요. 오늘은 푹 쉬면서 기분 좋게 마무리해요."],
    lose: ["괜찮아요, 괜찮아. 감독님 잘못 아니에요. 이리 와요.", "속상하죠… 오늘은 제가 곁에 있을게요. 울어도 돼요."],
    night: ["늦었어요, 감독님. 내일을 위해서 이제 자야 해요.", "제가 자장가 불러드릴까요? 눈 감아봐요~"],
    champ: ["우승이에요, 감독님! 정말정말 고생 많으셨어요… 눈물 나요.", "{cup} 우승이라니! 오늘은 푹 쉬고, 맛있는 것도 먹어요. 제가 챙길게요.", "그동안 힘든 거 다 알아요. 이렇게 보답받아서 너무 기뻐요.", "감독님, 이리 와요. 안아드릴게요. 우승 축하해요!"],
    runnerUp: ["준우승이에요. 정말 잘했어요… 오늘은 푹 쉬어요.", "아쉬워도 괜찮아요. 감독님이 노력한 거 제가 다 알아요."],
    out: ["탈락이라니… 많이 속상하죠. 오늘은 아무 생각 말고 쉬어요.", "괜찮아요, 괜찮아. 제가 곁에 있을게요. 울고 싶으면 울어도 돼요."],
    qualify: ["{cup} 진출이에요! 감독님 정말 수고 많았어요~", "축하해요! 대신 컨디션 관리 철저히 해야 해요, 알았죠?", "와, {cup}에 가다니! 몸 챙기면서 가요, 감독님."],
    miss: ["{cup}은 아쉽게 못 갔네요. 그래도 괜찮아요, 푹 쉬어요.", "속상해하지 말아요. 다음 기회가 분명 있어요."],
    streak: ["{streak}연승이에요! 대단한데, 너무 무리하진 마요~", "연승 중이네요! 밥은 잘 챙겨 먹고 있죠?", "{streak}연승… 감독님 자랑스러워요."],
    streakBreak: ["연승이 끊겼지만 괜찮아요. 쉬어가는 타이밍이에요.", "속상해하지 마요. 이리 와요, 위로해 드릴게요."],
    rankTop: ["1위라니! 감독님 정말 대단해요. 오늘은 칭찬 많이 해드릴게요.", "순위표 맨 위! 감독님, 고생한 보람이 있네요."],
    playoffLine: ["{rank}위, 플레이오프권이에요! 조금만 더 힘내요.", "순위가 올랐네요! 컨디션 관리 잘하고 있어서 그래요."]
  },
  5: {
    face: ["꺄~ 감독님 쓰다듬는 거 팬서비스예요?", "헤헤, 저 방금 심쿵! 오늘 하트 이벤트 당첨이에요!", "감독님~ 더 만져주면 하트 날려드릴게요! 뿅~♥", "앗, 스타일 망가지잖아요! …그래도 좋아요, 히히!", "나 예뻐요? 예쁘다고 해야 이벤트 진행해요~", "감독님이 만져주면 텐션이 200%예요!", "악수회 말고 쓰담회! 오늘 한정이에요~", "으앙, 이러면 진행 멘트 까먹잖아요~ 책임져요!", "볼이 말랑말랑하죠? 팬들한테도 비밀이에요!", "하트 쿠폰 발급! 감독님 전용이에요~ 평생 유효!", "앙~ 감독님이 제 최애예요, 알죠? 알죠~?", "웃어봐요 감독님! 찰칵~ 인생샷 건졌다!"],
    faceMany: ["자, 자! 팬 서비스 시간 종료입니다~!", "아앙~ 그만요! 마이크 쥘 손에 힘이 안 들어가요!", "감독님 오늘 왜 이렇게 대담해요? 부끄러워서 진행 못 하겠어요!"],
    chest: ["꺄악! 거긴 VIP 구역 아니에요!", "아, 안 돼요! 출입 금지예요 ///", "감독님 이거 반칙이에요! 경고 1회!", "으으… 심장 터지겠어요 진짜…", "농담이어도 안 돼요! 얼굴 빨개졌잖아요!", "앗! 놀라서 마이크 떨어뜨릴 뻔했어요!"],
    chestMad: ["진짜 화났어요! 오늘 이벤트 MC 안 봐줄 거예요!", "감독님 블랙리스트에 올릴 거예요!", "경고 누적 3회! 퇴장입니다, 퇴장!", "흥, 삐졌어요. 팬 서비스 중단합니다!"],
    body: ["짜잔~ 행사 진행 담당 박다은 등장이요!", "콕콕 하지 마요, 마이크 놓치잖아요~", "뭐뭐~ 부르셨어요? 이벤트 준비해 드릴까요?", "오늘 텐션 어때요? 저는 풀충전이에요!", "감독님, 저랑 셀카 찍어요! 하나 둘 셋, 찰칵~", "심심해요? 제가 노래 불러드릴까요? 랄랄라~", "간식 이벤트 당첨자는 바로 감독님! 축하드려요~", "하이파이브 해요! 짝! 에이, 더 세게요!"],
    idle: ["오늘 팬 이벤트 어떤 거 해볼까요? 감독님 아이디어 주세요~", "감독님, 저 오늘 코디 바꿨는데 어때요? 칭찬 부탁드려요!", "팬들한테 사랑받는 구단, 제가 만들어 드릴게요!", "노래방 가고 싶다~ 감독님 십팔번 뭐예요?", "있잖아요, 제 이벤트 중에 제일 좋아하는 건 감독님이랑 하는 거예요!", "오늘도 웃으면서 일하는 중~ 저 대단하죠? 칭찬해 줘요!", "감독님, 웃어봐요! 웃는 게 제일 잘생겼어요~ 진짜예요!", "팬분들한테 인사하는 것도 좋지만 감독님한테 하는 게 제일 좋아요.", "이번 시즌 우승하면 파티는 제가 쏠게요! 의상은 비밀~", "감독님, 저 한 곡 불러도 돼요? 응원가 만들었어요!", "피곤하죠? 제가 에너지 충전해 드릴게요~ 하트 슛! 뿅뿅♥", "오늘 하루 어땠어요? 일기에 감독님 얘기 또 썼어요, 히히.", "감독님은 제 이상형이… 아, 아니에요! 구단주 이상형이요!", "간식 사러 가는 길인데 같이 갈래요? 데이트 아니고 업무예요!", "인기투표 1위는 감독님이에요! 제 마음속에서요~", "저 팬레터 쓰는 중이에요. 누구한테냐고요? 비밀~", "오늘도 감독님 덕분에 행복한 하루예요, 꺄르르~"],
    win: ["이겼다아~! 파티해요 파티! 제가 사회 볼게요!", "우리 감독님 최고! 팬분들도 난리 났어요, 저도요!"],
    lose: ["에이~ 괜찮아요! 오늘은 제가 위로 공연 해드릴게요!", "다음엔 꼭 이길 거예요! 응원가 더 열심히 부를게요~"],
    night: ["밤 늦게까지 일하면 안 돼요~ 오늘 행사 종료입니다!", "감독님, 이제 자요~ 꿈에서 팬미팅 열어요!"],
    champ: ["꺄아아악!! 우승이에요!! {cup} 챔피언 우리 감독님!!", "우승 파티 제가 사회 볼게요! 폭죽 준비~ 뻥! 뻥!", "팬분들 난리 났어요! 저도요!! 우승 축하드려요 감독님♥", "이건 전설이에요! 오늘 밤은 우승 기념 이벤트 열어요!"],
    runnerUp: ["준우승이에요! 팬분들이 박수 치고 있어요, 들리죠?", "아쉽지만 멋졌어요! 위로 공연 준비할게요~"],
    out: ["아… 탈락이에요. 그래도 팬분들은 감독님 믿어요, 저도요!", "속상할 땐 노래해요! 제가 불러드릴게요, 라라라~"],
    qualify: ["{cup} 진출이에요! 팬 이벤트 대박 예감~ 꺄!", "와~ {cup}라니! 응원가 준비해야겠어요!", "진출 축하해요 감독님! 하트 쏴드릴게요~ 뿅♥"],
    miss: ["{cup} 못 갔지만 괜찮아요! 다음엔 더 큰 무대 만들어요!", "아쉽다~ 그래도 팬 서비스는 계속돼요! 힘내요!"],
    streak: ["{streak}연승!! 팬분들 반응 폭발했어요!", "와~ {streak}연승! 인기투표 1위 확정이에요!", "연승 기념으로 하트 하나! 뿅♥ 계속 가요~"],
    streakBreak: ["앗, 연승이 끊겼네요… 괜찮아요! 다음엔 더 길게요!", "에이~ 아쉽지만 그동안 정말 멋졌어요!"],
    rankTop: ["1위예요!! 팬분들한테 자랑해야겠어요!", "순위표 1등!! 감독님 최고, 사인 받아도 돼요?"],
    playoffLine: ["{rank}위, 플레이오프권이에요! 응원 열기도 뜨거워요~", "순위 상승! 팬분들도 신났어요, 저도요!"]
  },
  6: {
    face: ["흐응~ 감독님이 먼저 만져주다니, 오늘은 특별히 봐줄게요.", "앙~ 그렇게 쓰다듬으면 고양이처럼 골골거릴 거예요, 골골~", "감독님 손, 은근 기분 좋은데요? 더 해봐요.", "후후, 감독님 귀 빨개진 거 알아요? 제가 보고 있어요~", "냐앙~ 이제 좀 마음에 들었어요, 감독님.", "그렇게 쳐다보면 심장에 무리 가요. 책임질 거예요?", "앙탈 부려도 돼요? 아잉~ 감독님~ 이렇게요?", "밀당 중인 거 아시죠? 오늘은 제가 져 드릴게요.", "감독님, 저한테 빠진 거 아니에요? 아니면 말고요~", "쓰담쓰담 더 해줘요. 안 해주면 삐질 거예요~", "이런 거 아무한테나 안 허락해요. 감독님이니까요.", "헤헤, 저 지금 웃음 못 숨기겠어요. 보지 마요~"],
    faceMany: ["앙~ 이제 그만! 고양이도 쉬는 시간이 필요해요!", "자꾸 그러면 깨물어요, 앙! 농담이에요~", "으응~ 얼굴 너무 빨개졌어요, 그만요~"],
    chest: ["꺄앗! 감독님 손버릇 나빠요!", "앙! 거긴 안 돼요, 진짜~", "힝… 장난이 심하세요 ///", "그, 그런 건 밀당에서도 반칙이에요!", "으응, 갑자기 그러시면 어떡해요. 얼굴 못 들겠어요!", "감독님 나쁜 사람! 몰라요, 몰라 ///"],
    chestMad: ["이번엔 정말 화났어요. 발톱 세울 거예요!", "감독님 간식 전부 제가 먹어버릴 거예요, 흥!", "앙! 물어버릴 거예요!", "삐졌어요. 한동안 말 걸지 마요~"],
    body: ["냐앙~ 불렀어요? 뭐 필요한 거 있어요?", "콕콕 하지 마요, 고양이 깨요~", "후후, 저 찾았어요? 제가 숨바꼭질 잘하는데.", "감독님, 저한테 할 말 있죠? 얼굴에 쓰여 있어요~", "오늘은 어떤 장난을 쳐볼까요, 히힛.", "간식 주는 거예요? 그럼 봐줄게요~", "감독님~ 저 심심해요. 놀아줘요, 놀아줘요~", "으응? 방금 눈 마주친 거 맞죠? 심장이 쿵!"],
    idle: ["카페에서 일하는 것도 좋지만 감독님이랑 있는 게 더 좋아요.", "있잖아요, 감독님은 어떤 스타일 좋아해요? 그냥 궁금해서요~", "저 오늘 좀 예쁘지 않아요? 아니라고 하면 삐질 거예요.", "감독님, 제 취향 맞춰 주세요. 우선 아메리카노 말고 달달한 거로요~", "오늘 감독님 생각했어요. …조금만요. 진짜 조금만!", "밀당하는 거 재밌는데… 감독님한텐 자꾸 져요.", "하트 하나 날려드릴게요. 받으세요~ 뿅♡", "감독님이 안 보이니까 심심해서 졸았어요, 하암~", "감독님, 저 안 보고 싶었어요? 전 조금 보고 싶었는데.", "이번엔 제가 먼저 연락 안 할 거예요. …아, 한 번만 할게요.", "감독님이랑 같이 있으면 시간이 순간이동해요. 신기해~", "있잖아요, 감독님은 웃을 때 제일 좋아요. 자주 웃어요~", "저 이대로 감독님 옆자리 찜! 아무도 못 앉아요.", "앙탈 부리는 거 좋아해요? 아잉~ 이렇게요~ 헤헤.", "시즌 끝나면 같이 놀러 가요. 거절하면 울 거예요~", "제 맘대로 칭찬해 드릴게요! 감독님 오늘 완전 멋져요!", "감독님이라서 이렇게 편하게 구는 거예요. 아무한테나 안 그래요."],
    win: ["이겼다~! 오늘은 제가 감독님 소원 들어드릴게요, 딱 하나만!", "후후, 역시 제가 점찍은 감독님이에요."],
    lose: ["괜찮아요, 괜찮아~ 제가 위로해 드릴게요. 이리 와요~", "속상해하는 감독님도 귀엽긴 한데… 웃는 게 더 좋아요."],
    night: ["밤이 깊었어요, 감독님. 이제 자야죠? 같이 가줄까요?", "흐응~ 아직도 안 자요? 감독님이 안 자니까 저도 못 자겠어요."],
    champ: ["후후, 우승했네요. 제가 점찍은 감독님이 맞았어요.", "냐앙~ 우승이에요! 오늘은 제가 소원 하나 들어드릴게요, 딱 하나만.", "{cup} 챔피언 감독님… 솔직히 말하면, 반했어요. 비밀이에요.", "앙~ 기분 너무 좋아요! 안아줘도 돼요, 오늘만 특별히!"],
    runnerUp: ["준우승도 충분히 멋져요, 감독님. 다음엔 제가 더 응원할게요.", "아쉬워요? 괜찮아요, 제가 위로해 드릴게요~"],
    out: ["탈락이네요… 흥, 감독님 괴롭힌 상대 팀 미워요!", "속상한 얼굴도 귀엽지만… 웃는 게 더 좋아요. 이리 와요~"],
    qualify: ["{cup} 진출이에요~ 후후, 역시 제가 보는 눈이 있어요.", "진출 축하해요! 상으로 오늘 칭찬 많이 해드릴게요~", "{cup}라니, 설레는데요? 같이 가요, 감독님."],
    miss: ["{cup}에 못 갔네요… 흥, 다음엔 꼭 가요. 제가 응원할게요.", "아쉽죠? 괜찮아요. 제가 곁에 있잖아요~"],
    streak: ["{streak}연승이에요~ 감독님 오늘 좀 멋진데요?", "연승 행진이네요! 이러다 반하겠어요, 정말로.", "{streak}연승! 제 눈이 틀리지 않았어요, 후후."],
    streakBreak: ["앙, 연승이 끊겼네요… 괜찮아요. 제가 위로해 드릴게요.", "아쉬워요? 그럼 오늘은 제 앞에서만 투정 부려도 돼요~"],
    rankTop: ["1위예요, 1위! 감독님, 칭찬해 줘요. 아니, 제가 해드릴게요!", "맨 위에 우리 이름이 있어요, 후후. 기분 최고예요~"],
    playoffLine: ["{rank}위, 플레이오프권이에요~ 좋아요, 이 느낌.", "순위 올랐어요! 이 기세, 마음에 들어요, 감독님."]
  }
};
CONFIG.mascot.personaEvent = 0.85;
CONFIG.mascot.event = {
  champ: ["{cup} 우승이에요, 감독님!! 우리가 해냈어요!!", "챔피언이에요! 오늘은 마음껏 기뻐해도 돼요, 감독님!", "{team} 우승!! 이 순간을 평생 잊지 못할 거예요!", "트로피 번쩍! 감독님 정말 최고예요!"],
  runnerUp: ["{cup} 준우승이에요! 정말 잘했어요, 감독님!", "아쉽지만 대단한 성적이에요! 다음엔 우승이에요!", "결승까지 오다니… 자랑스러워요, 감독님."],
  out: ["{cup}에서 탈락했어요… 그래도 정말 잘했어요, 감독님.", "아쉽지만 괜찮아요. 다음엔 더 멀리 가요!", "속상하죠… 푹 쉬고 다시 도전해요!"],
  qualify: ["{cup} 진출이에요! 감독님 정말 멋져요!", "와, {cup}라니! 같이 최선을 다해요!", "진출 확정! 좋은 결과 기대해도 되겠죠?", "{cup} 진출 축하드려요, 감독님!"],
  miss: ["이번엔 {cup}에 못 갔어요… 다음엔 꼭 가요!", "아쉽지만 아직 기회는 많아요, 감독님!", "괜찮아요, 다시 준비하면 돼요!"],
  streak: ["{streak}연승이에요! 감독님 대단해요!", "벌써 {streak}연승! 이 기세 그대로 가요!", "{streak}연승 행진 중! 팬분들도 난리예요~"],
  streakBreak: ["연승이 끊겼네요… 그래도 정말 잘해왔어요!", "괜찮아요, 다음엔 더 길게 이어가요!", "아쉽지만 훌륭한 연승이었어요, 감독님."],
  rankTop: ["1위예요, 감독님! 순위표 맨 위에 우리가 있어요!", "1위 등극! 이 자리 꼭 지켜요!", "정상에 올랐어요! 대단해요!"],
  playoffLine: ["{rank}위, 플레이오프권 진입이에요!", "순위가 올랐어요! 조금만 더 힘내요, 감독님!", "플레이오프가 보여요! 계속 가요!"]
};
CONFIG.mascot.heartCursor = true;

Object.assign(CONFIG.mascot.persona, {
  7: {
    face: ["앗, 감독님 손이 닿으니까 심박수 올라가요!", "하하, 쓰다듬는 거 좋아요! 운동 후에 받으면 더 좋겠다!", "오늘 훈련 열심히 했는데 칭찬 받는 거예요? 헤헤!", "와, 얼굴 쓰다듬는 거 반칙이에요! 갑자기 힘이 쭉~", "으헤헤, 간지러워요! 하지 말라니까 더 하시네요~", "감독님 손에 기가 있나 봐요. 피로가 싹 풀려요!", "저 오늘 목표 달성했어요! 상으로 쓰담쓰담 한 번 더요!", "감독님 같이 운동해요! 제가 옆에서 붙어서 가르쳐드릴게요~", "에이, 이러면 훈련 집중 안 되잖아요~ 책임져요!", "앙~ 감독님 칭찬이 최고의 단백질이에요!", "나 오늘 땀 냄새 안 나죠? 아까 샤워했어요, 히히.", "감독님이 곁에 있으면 무게도 더 들 수 있을 것 같아요!"],
    faceMany: ["잠, 잠깐 쉬는 시간! 숨이 가빠요!", "이제 그만요~ 훈련 세트 놓쳤잖아요!", "감독님 오늘 왜 이렇게 적극적이에요? 저 땀나요!"],
    chest: ["꺄앗! 감독님, 거긴 안 돼요!", "으아, 반칙! 파울이에요!", "헉… 놀라서 덤벨 떨어뜨릴 뻔했어요 ///", "장난이어도 선 넘으면 안 돼요, 정말!", "아, 안 돼요오~ 얼굴 확 달아올랐어요!", "감독님 바보! 훈련 열 세트 시킬 거예요!"],
    chestMad: ["파울 누적! 스쿼트 100개 시킬 거예요!", "진짜 화났어요! 오늘 단백질 셰이크 감독님은 없어요!", "레드카드! 훈련장 출입 금지예요!", "흥! 한 시간 동안 말 안 걸 거예요, 쳇!"],
    body: ["넵! 훈련 총괄 정서아, 출동했습니다!", "콕콕 하지 마요~ 균형 무너져요!", "감독님, 스트레칭 같이 해요! 하나, 둘, 셋~", "물 마셨어요? 수분 보충은 기본이에요!", "오늘 훈련 일지 다 썼어요! 칭찬해 줘요~", "감독님 어깨 뭉쳤죠? 제가 풀어드릴게요! 아이고 딱딱해~", "힘든 일 있으면 얘기해요. 같이 뛰어요!", "불렀어요? 저 여기 있죠! 대기 완료예요!"],
    idle: ["감독님, 하루 10분 운동만 해도 컨디션이 달라져요! 같이 해요~", "저 오늘 PT 해드릴까요? 특별히 봐줄게요, 히히.", "운동 끝나고 먹는 치킨이 제일 맛있어요! 오늘 쏠게요!", "감독님 팔 한번 만져봐도 돼요? …농담이에요! 아닌데, 조금 궁금해요.", "선수들 훈련 끝나면 제가 직접 칭찬해 줘요. 감독님한테도 해줄게요!", "있잖아요, 저는 감독님 옆에서 달릴 때가 제일 좋아요.", "오늘 새벽 러닝 했는데 기분이 최고예요! 다음엔 같이 뛰어요!", "감독님, 허리 곧게 펴요! 자세 바르면 멋있어요~", "힘들 땐 제가 어깨 빌려드릴게요. 근육 짱짱한 어깨요!", "운동복 입으면 마음이 편해요. 감독님도 편하게 입고 와요~", "감독님이 칭찬해 주면 제가 운동 두 배로 해요, 신기하죠?", "있잖아요, 헬스장에서 감독님 얘기 자주 해요. 선수들이 놀려요, 헤헤.", "저한테 기대요, 감독님. 이래 봬도 힘 엄청 세요!", "제 목표는 우승과… 아, 이건 비밀이에요!", "오늘은 운동 쉬는 날! 같이 놀아요, 감독님~", "감독님이 웃으면 제 훈련 효율이 올라가요. 진짜예요!", "샤워하고 나왔는데 감독님이 부르는 느낌이 들었어요. 기분 탓?"],
    win: ["이겼다!! 감독님! 하이파이브 말고 포옹이요! 아니, 농담이에요!", "역시 훈련은 배신하지 않아요! 감독님 최고!"],
    lose: ["괜찮아요! 근육도 찢어져야 크는 법이에요! 다음에 이겨요!", "으아, 속상해요! 우리 같이 달리면서 털어내요!"],
    night: ["이 시간엔 근육도 쉬어야 해요! 감독님도 얼른 자요!", "늦게까지 일하면 회복이 안 돼요. 수면도 훈련이에요~"],
    champ: ["우승!!! 감독님 우승이에요!! 만세!!", "{cup} 챔피언! 오늘만큼은 훈련 쉬어도 돼요, 푸하하!", "해냈어요! 우리 훈련이 배신하지 않았어요!", "감독님 번쩍 들어 올리고 싶어요! 아, 진짜 들면 안 되겠죠? 헤헤."],
    runnerUp: ["준우승이에요! 정말 멋졌어요, 감독님! 다음엔 우승이에요!", "아쉬워요! 근데 이만큼 온 것도 대단한 거예요!"],
    out: ["탈락이네요… 으아, 속상해! 같이 달리면서 털어내요!", "괜찮아요! 근육도 다치고 나면 더 강해지는 법이에요!"],
    qualify: ["{cup} 진출! 훈련 강도 올려야겠어요, 각오하세요!", "진출 축하해요! 오늘은 치킨 먹고 내일부터 달려요!", "{cup}라니! 심장이 운동한 것처럼 뛰어요!"],
    miss: ["{cup}은 아쉽게 못 갔네요! 다음엔 더 열심히 해요, 제가 도울게요!", "으아, 분하다! 훈련 더 빡세게 가요, 감독님!"],
    streak: ["{streak}연승! 컨디션 최고예요! 이대로 쭉쭉!", "연승 중이에요! 감독님, 폼 좋은데요? 파이팅!", "{streak}연승 기념, 하이파이브! 짝!"],
    streakBreak: ["연승이 끊겼지만 괜찮아요! 다시 달리면 돼요!", "으아, 아쉽다! 회복 잘하고 다음에 또 이겨요!"],
    rankTop: ["1위예요!! 감독님, 우리가 맨 위예요! 만세!", "1등이다! 오늘 훈련은 쉬엄쉬엄 해도 되겠어요, 농담이에요!"],
    playoffLine: ["{rank}위, 플레이오프권 진입! 마지막까지 달려요!", "순위 올랐어요! 이 기세로 쭉 가요, 감독님!"]
  },
  8: {
    face: ["으음~ 감독님 손 따뜻해요… 졸려요…", "쓰다듬어 주니까 기분이 몽글몽글해요~", "앙~ 더요… 조금만 더 해주세요, 네에~", "고양이처럼 골골 소리 나겠어요, 으응~", "감독님 곁에 있으면 하품이 나와요. 편해서요.", "꿈 같아요… 깨지 않았으면 좋겠어요.", "으응~ 이대로 안겨서 자고 싶어요.", "후후, 감독님 손길은 최고의 안마예요~", "조금만 더 쉬어가요, 감독님. 저랑 같이요.", "감독님이 오니까 기분이 좋아졌어요. 헤헤~", "졸린 눈으로 쳐다봐도 이해해 주세요, 네?", "이대로 시간이 멈췄으면… 으음~"],
    faceMany: ["으응… 이제 그만요, 잠이 깨버리잖아요~", "아앙~ 너무 많이 해주면 심장이 두근거려서 못 자요.", "그만요, 감독님~ 얼굴이 뜨거워서 쉬는 게 안 돼요."],
    chest: ["꺄앗…! 감독님, 갑자기 그러시면…", "으응… 부끄러워서 잠이 확 깼어요 ///", "안 돼요… 그런 장난은 싫어요~", "감독님 바보… 심장이 너무 뛰어서 쉴 수가 없어요.", "앗… 거기는 안 돼요. 알았죠?", "으으… 얼굴 보지 마세요. 숨고 싶어요…"],
    chestMad: ["흥… 이번엔 정말 삐졌어요. 이불 속에 들어갈 거예요.", "감독님 휴양 일정 전부 취소할 거예요!", "정말 화났어요… 낮잠 같이 안 잘 거예요.", "삐졌어요. 사과의 마사지를 해주셔야 풀려요."],
    body: ["으음? 부르셨어요? 저 졸고 있었어요…", "콕콕 하지 마요~ 잠이 깨요, 으응.", "감독님 오셨어요? 이리 와서 좀 쉬어요~", "따뜻한 차 한잔 마실래요? 제가 타 드릴게요.", "오늘 컨디션 어때요? 힘들면 바로 말해요.", "쉬는 것도 일이에요. 감독님 쉬어요~", "포근한 담요 가져올까요? 같이 덮어요.", "하암… 감독님 보니까 잠이 깼어요, 신기해요."],
    idle: ["오늘 같은 날은 같이 낮잠 자면 딱인데… 아, 업무 중이죠.", "감독님~ 따뜻한 차 한잔 해요. 향이 정말 좋아요.", "휴양지 가고 싶다… 감독님이랑 둘이서요. 헤헤.", "으음~ 오늘은 일하기 싫은 날이에요. 감독님도 그렇죠?", "저는요, 감독님이 옆에 있을 때 제일 잘 자요.", "선수들 컨디션은 잘 챙기고 있어요. 감독님 컨디션은 제가 챙길게요.", "있잖아요, 감독님 목소리 들으면 마음이 풀려요.", "하품 나왔어요… 보셨어요? 부끄러워요 ///", "감독님 어깨에 기대서 잠깐 쉬어도 돼요? 5분만요.", "쉬는 날엔 같이 온천 가요. 제가 다 알아봤어요.", "피곤할 땐 쉬어요. 세상 안 무너져요, 감독님.", "오늘도 곁에 있어 줘서 고마워요, 감독님.", "따뜻한 이불 속에 있는 기분이에요. 감독님 덕분이에요.", "이대로 시간이 천천히 흘렀으면 좋겠어요, 으음~", "감독님, 저 오늘 향 좋아요? 새로운 바디로션 썼는데…", "졸리면 같이 쉬어요. …아, 오해 마세요! 그냥 쉬는 거예요!", "꿈에서 감독님이 우승 트로피 들고 있었어요. 길몽이에요!"],
    win: ["이겼어요? 우와~ 잠이 확 깼어요! 감독님 최고예요~", "오늘은 푹 쉬어도 돼요. 이긴 사람 특권이에요, 후후."],
    lose: ["괜찮아요. 오늘은 푹 쉬고 내일 다시 해요. 제가 안아줄게요.", "속상할 땐 따뜻한 차가 최고예요. 이리 와요~"],
    night: ["이제 잘 시간이에요… 저도 졸려요, 하암~", "불 끄고 눈 감아요. 제가 곁에서 지켜줄게요~"],
    champ: ["우승이에요… 정말요? 잠이 확 깼어요! 감독님 축하해요!!", "{cup} 챔피언이라니… 꿈 아니죠? 같이 푹 쉬면서 기뻐해요.", "정말 정말 멋졌어요, 감독님. 오늘은 제가 포근하게 안아드릴게요.", "우승 기념으로 오늘은 아무 일도 안 해요. 같이 쉬어요~"],
    runnerUp: ["준우승이에요… 정말 잘했어요. 푹 쉬고 다시 해요.", "아쉬워도 괜찮아요. 제가 따뜻한 차 내어 드릴게요."],
    out: ["탈락이네요… 많이 속상하죠. 이리 와서 쉬어요.", "오늘은 아무 생각 말고 푹 자요. 제가 곁에 있을게요."],
    qualify: ["{cup} 진출이에요~ 우와, 잠이 다 깨네요. 축하해요!", "진출했어요! 그럼 푹 쉬고 컨디션 올려야죠?", "{cup}이라니… 설레서 잠이 안 올 것 같아요."],
    miss: ["{cup}에 못 갔지만… 괜찮아요. 푹 쉬면 다음엔 갈 수 있어요.", "속상해하지 마요. 같이 따뜻한 차 마셔요."],
    streak: ["{streak}연승이에요~ 우와, 감독님 대단해요.", "연승이라니… 오늘은 푹 쉬어도 돼요, 이긴 사람 특권이에요.", "{streak}연승! 기분 좋아서 졸음이 날아갔어요."],
    streakBreak: ["연승이 끊겼네요… 괜찮아요, 쉬어가는 거예요.", "아쉬워요… 오늘은 푹 자고 내일 또 해요."],
    rankTop: ["1위라니… 우와, 눈이 번쩍 떠졌어요!", "맨 위에 우리 이름이 있어요. 감독님 덕분이에요, 헤헤."],
    playoffLine: ["{rank}위, 플레이오프권이에요~ 조금만 더 힘내요.", "순위가 올랐어요! 이대로면 마음 편히 쉴 수 있겠어요."]
  },
  9: {
    face: ["꺄~ 감독님 만지지 마요, 셀카 흐트러지잖아요!", "으히히, 감독님 손 큰 거 알아요? 얼굴 다 가려져요~", "나 오늘 화장 안 했는데… 예뻐요? 솔직히요!", "쓰담쓰담 해주니까 광대 올라가요, 사진 찍어요!", "앙~ 간지러워요! 그런데 기분은 좋아요~", "굿즈 모델로 감독님 얼굴 쓰면 대박 날 텐데! 농담이에요~", "감독님 손길은 한정판이에요, 소장하고 싶어요.", "저 오늘 기분 최고! 셀카 폴더 가득 찼어요~", "앙~ 더 해줘요, 더요! 졸라요~", "감독님이랑 같이 찍은 사진, 제 폰 배경화면이에요. 비밀!", "아잉~ 이러면 어떡해요, 심장 터져요!", "헤헤, 감독님 좋아요. 이 정도는 말해도 되죠?"],
    faceMany: ["아앙~ 그만해요, 저 지금 얼굴 엉망이에요!", "이제 그만! 카메라 켜져 있다고요!", "감독님~ 자꾸 그러면 굿즈에 감독님 사진 못 써요!"],
    chest: ["꺄앗! 감독님 어딜 만져요!", "으아, 반칙이에요! 얼굴 빨개졌잖아요 ///", "장난이어도 선 지켜요, 감독님~", "으으, 놀랐잖아요! 심장 떨어지는 줄 알았어요 ///", "그, 그쪽은 비매품이에요!", "앙~ 나빠요! 몰라요, 안 봐요!"],
    chestMad: ["진짜 화났어요! 굿즈 수익 배분 줄일 거예요!", "감독님 사진 전부 삭제할 거예요! …아, 거짓말이에요.", "삐졌어요. 사과 선물 안 주면 안 풀 거예요!", "흥! SNS 팔로우 취소할 거예요!"],
    body: ["짠~ 굿즈 기획 담당 주아린, 등장이요!", "콕콕 하지 마요~ 신상 굿즈 흔들려요!", "감독님, 저랑 셀카 찍어요! 브이~", "뭐 필요한 거 있어요? 말만 해요, 바로 가져올게요!", "이번 신상 굿즈 보실래요? 감독님 취향 저격일걸요?", "앙~ 저한테 할 말 있어요? 눈빛이 수상한데요?", "오늘 코디 어때요? 점수 매겨 봐요, 100점 아니면 삐질 거예요~", "히히, 제가 먼저 불러보려 했는데 선수 뺏겼네요!"],
    idle: ["새 굿즈 시안 나왔어요! 감독님한테 제일 먼저 보여드릴게요~", "오늘 셀카 잘 나왔는데 보여드릴까요? 보정 안 했어요!", "감독님 팬이 늘어나는 것도 다 제 굿즈 덕분이에요, 칭찬해 줘요~", "있잖아요, 감독님이랑 찍은 사진이 제일 잘 나와요. 신기하죠?", "굿즈 모델 해주실래요? 대가는 저 한 명과 데이트!", "오늘 감독님 코디 어때요? 제가 골라줄까요?", "감독님이 안 보이니까 심심해서 SNS만 봤어요.", "감독님, 저 삐졌어요! 이유는 비밀! 맞춰봐요~", "오늘의 한정판 굿즈는 바로 저예요, 후후.", "쇼핑 같이 가요! 감독님 옷은 제가 골라줄게요~", "감독님은 제 최애예요. 이건 진짜 진심이에요!", "저는 감독님이 웃을 때 제일 좋아요. 그래서 맨날 웃기려고요~", "앙탈 좀 부려도 돼요? 아잉~ 감독님~ 이렇게?", "이번 달 매출 올랐어요! 칭찬 안 해주면 삐집니다~", "카페 가서 사진 찍고 싶다~ 감독님이 찍어주세요!", "감독님이 좋아하는 굿즈는 어떤 거예요? 취향 알려줘요~", "오늘은 감독님 옆에 있고 싶은 날이에요~ 그냥 그래요!"],
    win: ["이겼다! 이기면 굿즈 풀어야죠! 오늘 기념으로 한정판 출시!", "감독님 최고! 기념 셀카 한 장 찍어요, 브이~"],
    lose: ["아~ 졌어요… 그래도 감독님은 제 최애예요. 사진 보고 힘내요!", "속상할 땐 쇼핑이 최고인데… 아, 지갑은 잠깐 참아요!"],
    night: ["벌써 이 시간이에요? 감독님 얼른 자요, 내일 또 봐요~", "밤에 셀카 올리면 안 된다던데… 아, 감독님한테만 보낼게요!"],
    champ: ["우승이에요!!! 우승 기념 한정판 굿즈 바로 출시할게요!!", "{cup} 챔피언 감독님! 우리 같이 우승 셀카 찍어요, 브이!!", "꺄악! 우승이라니! 이 순간 사진으로 평생 남길 거예요!", "감독님은 제 최애를 넘어서 평생 최애예요, 알죠?"],
    runnerUp: ["준우승이에요! 아쉽지만 멋졌어요, 기념 사진 찍어요~", "다음엔 꼭 우승 굿즈 만들어요! 힘내요, 감독님!"],
    out: ["탈락이네요… 흑, 속상해요. 셀카 보면서 힘내요!", "괜찮아요. 오늘은 저랑 쇼핑하면서 털어버려요!"],
    qualify: ["{cup} 진출이에요! 기념 굿즈 시안 바로 뽑을게요!", "와~ {cup}라니! 오늘 셀카 폴더 가득 찰 것 같아요!", "진출 축하해요 감독님~ 브이! 사진 찍어요!"],
    miss: ["{cup}은 못 갔지만 괜찮아요! 다음엔 같이 가요, 약속!", "아쉽다~ 그래도 감독님은 제 최애예요, 변함없어요!"],
    streak: ["{streak}연승! 대박 굿즈 매출 오르겠어요!", "연승 중이에요! 감독님 오늘 사진 잘 나올 것 같아요, 찍어요!", "{streak}연승 기념으로 셀카 한 장, 브이~"],
    streakBreak: ["연승 끊겼지만 괜찮아요! 위로 셀카 보내드릴게요~", "에이, 아쉬워요! 그래도 감독님 최고예요!"],
    rankTop: ["1위예요!! 순위표 캡처해서 폰 배경화면 할래요!", "맨 위에 우리 이름이~ 감독님 최고, 사진 찍어요!"],
    playoffLine: ["{rank}위, 플레이오프권이에요! 응원 굿즈 출시 준비할게요~", "순위 올랐어요~ 기분 좋아서 셀카 찍었어요!"]
  },
  11: {
    face: ["후후, 감독님 손길… 나쁘지 않네요.", "어머, 이렇게 가까이서 보면 부끄러운데요?", "감독님, 저 지금 두근거리는 거 들켰어요?", "쓰다듬는 솜씨 꽤 좋으시네요. 더 해봐요~", "이런 건 아무한테나 허락 안 해요. 감독님이니까요.", "후후, 이대로 있으면 감독님한테 빠질지도 몰라요.", "볼이 따뜻해요… 감독님 때문이에요, 책임지세요.", "감독님이 웃으면 저도 덩달아 웃게 돼요.", "조금만 더요. 아, 아니… 많이요, 많이.", "감독님 손 아래서 눈 감으니까 편안해요~", "캠퍼스에서도 이렇게 다정하면 인기 폭발일 텐데, 저만 알래요.", "앙~ 감독님 눈빛이 너무 뜨거워요, 어떡해요 ///"],
    faceMany: ["어머, 감독님~ 오늘은 꽤 적극적이시네요. 부끄러워요.", "후후, 이제 그만요. 더 하면 진짜 빠져버려요.", "으응~ 감독님, 우리 일은 해야죠? 잠깐만요."],
    chest: ["어머, 감독님! 그건 선 넘은 거예요.", "후후, 장난이 지나치시네요. 얼굴 달아올랐어요 ///", "그, 그런 건 먼저 허락받아야죠, 감독님~", "감독님, 저 지금 진짜 당황했어요…", "이러시면 곤란해요. 마음의 준비가 안 됐단 말이에요.", "으응… 부끄러우니까 쳐다보지 마세요 ///"],
    chestMad: ["감독님, 이번엔 진짜 화났어요. 미소도 안 지어줄 거예요.", "홍보 자료에서 감독님 사진만 빼버릴까요?", "후후… 웃고 있지만 화난 거예요. 무섭죠?", "삐졌어요. 달래줄 때까지 안 풀릴 거예요."],
    body: ["네, 감독님. 부르셨어요?", "후후, 저 필요하세요? 언제든 말씀하세요.", "콕콕 하지 마요, 간지러워요~", "오늘 홍보 일정 정리해 뒀어요. 칭찬해 주실 거죠?", "감독님, 오늘 좀 멋져 보이네요. 괜히 하는 말 아니에요.", "무슨 생각 해요? 저한테도 알려줘요~", "차 한잔 하실래요? 제가 대접할게요.", "후후, 감독님 시선이 느껴졌어요. 맞죠?"],
    idle: ["신입생 환영회 때 감독님 소개하면 팬이 확 늘 거예요, 후후.", "감독님, 오늘 향수 바꿨어요. 어때요? 솔직하게요.", "있잖아요, 저는 감독님이 일할 때 진지한 얼굴이 좋아요.", "캠퍼스 홍보 자료 만들 때마다 감독님 생각이 나요. 이상하죠?", "오늘은 감독님이랑 저녁 같이 먹고 싶은데… 안 될까요?", "감독님은 어떤 사람이 이상형이에요? 그냥 궁금해서요~", "후후, 감독님은 눈치가 없네요. 그런 점도 귀엽지만요.", "저 감독님 옆에서 일할 때가 제일 행복해요.", "조용한 카페에서 단둘이 커피 마시고 싶다… 상상만요, 후후.", "오늘 감독님 뒤에서 한참 쳐다봤는데 몰랐죠? 비밀이에요.", "감독님이 칭찬해 주면 하루종일 기분이 좋아요. 알고 있었죠?", "시즌 끝나면 드라이브 가요. 제가 운전할게요.", "감독님 곁에 있으니까 저도 더 멋진 사람이 되고 싶어져요.", "가끔은 제가 먼저 챙겨드릴게요. 기대해요, 후후.", "감독님 힘든 날엔 제가 따뜻하게 안아드릴게요. 농담 아니에요.", "오늘은 감독님께 꼭 하고 싶은 말이 있었는데… 다음에 할게요.", "감독님은 정말 매력 있는 사람이에요. 자각 좀 하세요~"],
    win: ["이겼어요, 감독님! 오늘은 제가 축하 커피 쏠게요~", "후후, 역시 제 눈이 틀리지 않았어요. 멋져요, 감독님."],
    lose: ["괜찮아요, 감독님. 오늘은 제가 곁에서 위로해 드릴게요.", "슬퍼하지 마요. 감독님은 충분히 멋진 사람이에요."],
    night: ["이렇게 늦은 시간에 둘만 남았네요… 후후, 농담이에요.", "감독님, 이제 쉬어요. 제가 먼저 퇴근하면 서운하죠?"],
    champ: ["우승이에요, 감독님. …정말 멋졌어요. 오늘은 제가 축하해 드릴게요.", "{cup} 챔피언이라니… 후후, 제가 사람 보는 눈이 있었네요.", "이 순간을 감독님 옆에서 볼 수 있어서 영광이에요.", "오늘은 가만히 계세요. 제가 먼저 챙겨드릴게요."],
    runnerUp: ["준우승, 충분히 멋진 성적이에요. 자랑스러워요, 감독님.", "아쉽죠? 괜찮아요. 오늘은 제가 곁에서 위로해 드릴게요."],
    out: ["탈락이네요… 감독님, 괜찮아요. 오늘은 제가 곁에 있을게요.", "슬퍼하는 모습은 저한테만 보여줘요. 위로해 드릴게요, 후후."],
    qualify: ["{cup} 진출이에요. 후후, 감독님 이런 모습 멋져요.", "진출 축하해요, 감독님. 저녁은 제가 살게요.", "{cup}이라니… 가슴이 뛰어요. 같이 가요."],
    miss: ["{cup}은 아쉽지만… 감독님은 충분히 멋진 사람이에요.", "다음엔 꼭 가요. 그때까지 제가 곁에 있을게요."],
    streak: ["{streak}연승이에요. …오늘은 감독님 조금 반했어요.", "연승 행진이네요. 후후, 눈을 못 떼겠어요.", "{streak}연승이라니, 대단해요. 칭찬 더 해드릴까요?"],
    streakBreak: ["연승이 끊겼지만… 괜찮아요. 충분히 멋졌어요.", "아쉬워요? 이럴 땐 제 곁에서 쉬어요, 후후."],
    rankTop: ["1위예요, 감독님. …정말 멋져요. 숨길 수가 없네요.", "순위표 맨 위에 우리 이름이 있어요. 감독님 덕분이에요."],
    playoffLine: ["{rank}위, 플레이오프권이에요. 좋은 흐름이네요, 감독님.", "순위가 올랐어요. 후후, 이 기세 마음에 들어요."]
  }
});
Object.assign(CONFIG.mascot.persona, {
  10: {
    face: ['어머, 갑자기 쓰다듬으시면 놀라잖아요. …싫진 않지만요.', '감독님 손, 생각보다 따뜻하네요. 잠깐만 더 있어도 될까요?', '이렇게 가까이서 보시면 부끄러워요.', '칭찬받는 건 아직 익숙하지 않아요. 그래도 기분은 좋네요.', '저는 조용한 편이지만, 감독님 앞에서는 표정이 숨겨지지 않아요.', '한 번만 더 해주시면… 오늘 정리한 자료, 두 배로 열심히 볼게요.', '감독님이 웃으시면 제 마음도 정리가 안 돼요.', '볼이 따뜻해요. 아마 햇볕 때문이겠죠? …아니에요, 감독님 때문이에요.', '가만히 있을게요. 감독님이 하고 싶은 만큼 해주세요.', '이런 거, 아무한테나 허락하는 거 아니에요. 알고 계시죠?', '제 얼굴을 이렇게 오래 본 사람은 감독님이 처음이에요.', '조금만 더요. 오늘 하루 중에 지금이 제일 좋아요.'],
    faceMany: ['감독님… 자꾸 그러시면 집중이 안 돼요.', '이제 그만요. 얼굴이 빨개져서 자료를 못 보겠어요.', '숨이 가빠져요. 잠깐만 쉬어도 될까요?'],
    chest: ['어머, 감독님! 거기는 안 돼요.', '그, 그런 장난은 곤란해요… 심장이 떨어질 뻔했어요.', '조금만 천천히요. 저도 마음의 준비가 필요해요.', '얼굴이 너무 뜨거워요. 보지 말아 주세요 ///', '감독님, 허락 없이는 곤란해요. 정말로요.', '으응… 부끄러워서 말이 안 나와요.'],
    chestMad: ['정말 화났어요. 오늘 자료 정리는 안 도와드릴 거예요.', '실망했어요, 감독님. 사과부터 들려주세요.', '조용히 화내는 게 더 무섭다는 거, 아시죠?', '삐졌어요. 따뜻한 차 한 잔은 사주셔야 풀려요.'],
    body: ['네, 감독님. 부르셨어요?', '콕콕 하지 마세요, 집중이 흐트러져요.', '오늘 전술 노트 정리했어요. 칭찬해 주세요.', '피곤해 보여요. 잠깐 앉아서 쉬세요. 제가 차 가져올게요.', '궁금한 게 있으면 편하게 물어보세요.', '저 여기 있어요. 부르실 줄 알았어요.', '감독님 표정이 평소랑 달라요. 무슨 좋은 일 있어요?', '필요하면 언제든 말씀하세요. 밤늦게라도 괜찮아요.'],
    idle: ['오늘 분석하다가 감독님 생각이 나서 한 줄을 다시 읽었어요.', '조용한 도서관 같은 곳에서 감독님과 나란히 앉아 있고 싶어요.', '저는 말수가 적지만, 속으로는 하고 싶은 말이 많아요.', '감독님이 경기에서 이길 때 제일 먼저 박수 치는 사람이 저예요.', '따뜻한 차 한잔과 감독님 옆자리… 제 이상적인 오후예요.', '가끔은 감독님도 쉬세요. 제가 대신 챙길 수 있는 건 챙길게요.', '비 오는 날엔 같이 창가에 앉아 있고 싶어요. 아무 말 없어도 좋아요.', '감독님이 칭찬해 주시면 하루 종일 기분이 좋아요.', '저, 사실 감독님 웃는 모습 보려고 자료를 더 열심히 만들어요.', '오늘은 감독님께 하고 싶은 말이 있었는데… 다음에 할게요.', '손이 차가워요. 감독님 손은 따뜻하죠? 아, 농담이에요.', '감독님 곁에 있으면 마음이 놓여요. 이상하죠?', '제가 조금 서툴러도 이해해 주세요. 표현이 느린 사람이라서요.', '퇴근길에 같이 걸을래요? 조금만 돌아가도 괜찮아요.', '우승하면 소원 하나만 말씀드릴게요. 지금은 비밀이에요.', '감독님 이름을 노트에 적다가 지웠어요. 아무것도 아니에요.', '좋아한다는 말은 아직 아껴둘게요. 대신 눈빛으로 전할게요.'],
    win: ['이기셨어요! 오늘은 제가 따뜻한 차를 준비할게요.', '역시 감독님이세요. …정말 멋졌어요.'],
    lose: ['괜찮아요. 오늘은 제가 곁에 있을게요.', '속상하시죠. 말씀 안 하셔도 괜찮아요.'],
    night: ['밤이 깊었네요. 조금만 더 곁에 있어도 될까요?', '이 시간까지… 감독님도 저도 참 못 말리는 사람이네요.'],
    champ: ['{cup} 우승이에요, 감독님! 정말 해내셨어요… 눈물이 나요.', '이 순간을 감독님 곁에서 볼 수 있어서 행복해요.', '우승 축하드려요. 오늘은 제가 따뜻하게 안아드려도 될까요?', '챔피언 감독님… 평생 잊지 못할 거예요.'],
    runnerUp: ['준우승도 정말 대단해요. 오늘은 제가 곁에 있을게요.', '아쉬워도 괜찮아요. 충분히 멋졌어요, 감독님.'],
    out: ['탈락이네요… 속상하시죠. 제 곁에서 쉬세요.', '감독님 탓이 아니에요. 제가 다 봤어요.'],
    qualify: ['{cup} 진출이에요! 감독님, 정말 멋져요.', '와, {cup}라니… 가슴이 두근거려요.', '진출 축하드려요. 전술 노트는 제가 밤새 정리할게요.'],
    miss: ['{cup}은 아쉬웠지만… 감독님 곁에는 제가 있어요.', '다음엔 꼭 가요. 제가 같이 준비할게요.'],
    streak: ['{streak}연승이에요! 감독님, 정말 대단해요.', '{streak}연승… 저도 모르게 박수를 쳤어요.', '이 기세 마음에 들어요. 무리하진 마세요.'],
    streakBreak: ['연승이 끊겼지만 괜찮아요. 충분히 잘해왔어요.', '아쉬우시죠. 따뜻한 차 한 잔 드릴게요.'],
    rankTop: ['1위예요, 감독님! 순위표 맨 위에 감독님 이름이 있어요.', '1위라니… 믿기지 않아요. 정말 멋져요.'],
    playoffLine: ['{rank}위, 플레이오프권이에요! 조금만 더 힘내요.', '순위가 올랐어요! 감독님 덕분이에요.']
  },
  12: {
    face: ['선배… 아니 감독님! 쓰다듬는 거예요? 더 해줘요, 더요~', '헤헤, 머리 쓰담쓰담 해주니까 기분이 둥둥 떠다녀요.', '앙~ 간지러워요! 그런데 멈추면 삐질 거예요!', '감독님 손 크다~ 제 얼굴이 쏙 들어가요, 히히.', '저 오늘 예뻐요? 예쁘다고 해줘요, 안 해주면 울 거예요.', '감독님이 만져주면 에너지 충전 100%예요!', '나만 쓰다듬어 줘요. 다른 사람한테 하면 저 질투해요!', '헤헤… 심장이 콩닥콩닥해요. 들려요?', '한 번만 더요? 응? 응? 제발요, 감독님~', '감독님은 제 최애 선배예요. 아니, 최애 감독님!', '눈 마주쳤다! 방금 저 쳐다봤죠? 들켰어요~', '이대로 안겨도 돼요? 아니, 그냥 안길래요.'],
    faceMany: ['아앙~ 그만해요! 얼굴이 터질 것 같아요!', '자꾸 그러면 저 진짜 감독님한테 안겨버릴 거예요!', '감독님 오늘 왜 이렇게 적극적이에요? 부끄러워요 ///'],
    chest: ['꺄악! 감독님 어딜 만져요!', '으아, 반칙이에요! 레드카드!', '장난이어도 거긴 안 돼요, 정말!', '헉… 저 지금 얼굴 불난 것 같아요 ///', '몰라요, 몰라! 감독님 바보!', '앙~ 놀랐잖아요! 심장이 튀어나오는 줄 알았어요.'],
    chestMad: ['진짜 화났어요! 한 시간 동안 말 안 걸 거예요!', '감독님 간식 전부 제가 먹어버릴 거예요, 흥!', '삐졌어요. 사과로 안아주기 10분, 안 하면 안 풀려요!', '이번엔 진짜예요! 저 토라졌어요!'],
    body: ['네~ 감독님! 예린이 대령이요!', '콕콕 하지 마요~ 간지러워요!', '뭐 필요한 거 있어요? 말만 해요, 바로 달려올게요!', '심심해요! 저랑 놀아줘요, 네?', '간식 같이 먹어요! 반 나눠줄게요, 특별 대우예요~', '감독님, 저랑 셀카 찍어요! 하나 둘 셋, 찰칵!', '불러줘서 기뻐요! 안 불러주면 삐질 뻔했어요.', '으응? 방금 저 쳐다봤죠? 다 알아요, 헤헤.'],
    idle: ['감독님~ 저 오늘 칭찬받을 일 했어요! 맞춰봐요!', '있잖아요, 감독님이 바쁘면 저 심심해서 시들어요.', '오늘 날씨 좋죠? 같이 산책 나가요, 한 바퀴만요!', '감독님 생각하다가 점심을 두 번 먹었어요. 책임져요!', '퇴근하면 같이 떡볶이 먹으러 가요! 제가 쏠게요!', '저 앙탈 부려도 돼요? 아잉~ 감독님~ 이렇게요, 히히.', '감독님이 웃으면 저도 덩달아 신나요. 더 웃어줘요!', '오늘은 감독님 옆자리 제가 찜! 아무도 못 앉아요.', '저 질투 많은 거 알죠? 다른 매니저 언니들한테 너무 친절하지 마요.', '감독님, 눈 감아봐요! 아니에요, 그냥 장난이에요, 히히.', '우승하면 소원 하나 들어줘요! 약속, 새끼손가락!', '저는 감독님 팬 1호예요! 2호가 있으면 가만 안 둬요.', '감독님이랑 같이 있으면 시간이 순간이동해요. 신기해요~', '손 시려요… 감독님 주머니에 넣어도 돼요? 헤헤.', '오늘은 조금 더 곁에 있고 싶은 날이에요. 이유는 비밀!', '감독님은 제 마음속 우승 트로피예요. 절대 안 뺏겨요.', '밤에 연락하면 받아줄 거죠? 그냥 목소리 듣고 싶어서요.'],
    win: ['이겼다아! 감독님 하이파이브! 오늘은 제가 쏠게요!', '우리 감독님 최고! 소원권 하나 드릴게요~'],
    lose: ['에이~ 괜찮아요! 다음엔 제가 더 열심히 응원할게요!', '울지 마요 감독님, 제가 안아줄게요!'],
    night: ['벌써 밤이에요? 감독님, 오늘도 같이 있어줘서 고마워요.', '졸려도 안 잘래요. 감독님 옆이 좋아서요!'],
    champ: ['우승이다아!! {cup} 챔피언 우리 감독님!!', '꺄아악! 해냈어요! 안아줘요, 아니 제가 안을래요!', '우승 기념 소원 하나요! 오늘 저랑 놀아주기!', '이거 꿈 아니죠? 볼 꼬집어 줘요! 아야!'],
    runnerUp: ['준우승이에요! 아쉽지만 정말 멋졌어요, 감독님!', '다음엔 꼭 우승 가요! 제가 응원단장 할게요!'],
    out: ['탈락… 으아, 분해요! 그래도 감독님 최고예요!', '울지 마요, 대신 맛있는 거 사줄게요!'],
    qualify: ['{cup} 진출이에요! 와아, 신나요!', '진출 축하해요 감독님! 오늘 저녁은 제가 쏠게요!', '{cup}라니! 저 벌써 떨려요, 헤헤.'],
    miss: ['{cup}은 못 갔네요… 아쉬워요! 다음엔 꼭 가요, 약속!', '속상하죠? 제가 곁에 있잖아요!'],
    streak: ['{streak}연승!! 감독님 무적이에요!', '와 {streak}연승이래요! 하이파이브 해요, 짝!', '연승 행진 멈추지 마요! 제가 응원할게요!'],
    streakBreak: ['아, 연승 끊겼다… 괜찮아요! 다시 쌓으면 돼요!', '에잇, 아쉽다! 그래도 정말 잘했어요, 감독님!'],
    rankTop: ['1위!! 감독님 우리 1위예요!! 순위표 사진 찍을래요!', '맨 위에 우리 이름 있어요! 기분 최고예요!'],
    playoffLine: ['{rank}위, 플레이오프권! 이대로 쭉 가요, 감독님!', '플레이오프 보인다! 두근두근해요!']
  }
});

CONFIG.facility.managers.list.forEach((m, i) => {
  const pic = m.pic || i + 1, M = CONFIG.mascot;
  if (m.zone) M.zones[pic] = m.zone;
  if (m.lines) M.persona[pic] = m.lines;
  if (m.alt) { M.personaAlias[m.alt] = pic; M.zones[m.alt] = m.zoneAlt || m.zone; }
});
