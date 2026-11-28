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
    hp:    { name: '체력',       short: '체력',   color: '#4ade80', max: 2000, digits: 0 },
    mp:    { name: '마나',       short: '마나',   color: '#38bdf8', max: 500,  digits: 0 },
    aspd:  { name: '공격속도',   short: '공속',   color: '#f97316', max: 5.0,  digits: 2 },
    spd:   { name: '이동속도',   short: '이속',   color: '#2dd4bf', max: 20,   digits: 1 },
    atk:   { name: '공격력',     short: '공격력', color: '#fb7185', max: 100,   digits: 0 },
    ap:    { name: '주문력',     short: '주문력', color: '#c084fc', max: 100,   digits: 0 },
    def:   { name: '방어력',     short: '방어력', color: '#60a5fa', max: 100,   digits: 0 },
    res:   { name: '저항력',     short: '저항력', color: '#a78bfa', max: 100,   digits: 0 },
    ten:   { name: '강인함',     short: '강인함', color: '#fbbf24', max: 1.0,  digits: 0, pct: true, tip: 'CC 지속시간 단축' },
    pen:   { name: '관통력',     short: '관통력', color: '#f43f5e', max: 1.0,  digits: 0, pct: true, tip: '방어력·저항력 무시' },
    ls:    { name: '생명력흡수', short: '흡수',   color: '#ef4444', max: 5.0,  digits: 0, pct: true, tip: '준 피해의 일부를 회복' },
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
    top: 3, minGames: 3, skillGap: 4,
    analyst: { dir: 'img/manager/', prefix: 'Analyst', ext: 'png', count: 1,   /* 이미지: img/manager/Analyst1.png, Analyst2.png … (count = 준비한 장수, 입장 때마다 무작위) */
      lines: ['상대 데이터 정리해 뒀습니다. 천천히 보세요.', '조정 제안은 참고만 하세요. 최종 판단은 감독님 몫입니다.', '상대의 예상 운영 방식부터 확인해 보세요.', '밴 추천도 놓치지 마세요. 의외로 승부가 갈립니다.', '표본이 적으면 예측이 빗나갈 수 있습니다. 그건 감안해 주세요.'] },
    risk: { mental: 65, form: 45, trouble: 60, slack: 60 },
    margin: 0.35, prior: 8, dataK: 3, scale: { gap: 12, skill: 10 },
    conflicts: [[['engage', 'allout'], ['zone', 'home']], [['engage', 'allout'], ['deposit', 'full']], [['engage', 'careful'], ['zone', 'press']], [['engage', 'avoid'], ['boss', 'contest']]],
    model: {
      engage: {
        avoid:      { _: -0.9, adv: -1.0, tiltMy: 0.6, oppAggro: 0.2, lvF: 0.2 },
        careful:    { _: 0.05, adv: -0.6, oppAggro: 0.5, tiltMy: 0.6, eJudge: -0.2, eFight: -0.3, myBack: 0.4, oppAsn: 0.3, lvF: 0.15 },
        balanced:   { _: 0.25 },
        aggressive: { _: -0.35, adv: 0.9, oppAggro: -0.5, eFight: 0.5, eReact: 0.3, eClutch: 0.2, eJudge: 0.2, myAsn: 0.4, myFront: 0.3, oppBack: 0.35, tiltOpp: 0.5, tiltMy: -0.7 },
        allout:     { _: -1.0, adv: 1.0, oppAggro: -0.8, eFight: 0.4, eReact: 0.2, oppBack: 0.3, tiltOpp: 0.4, tiltMy: -1.0 }
      },
      zone: {
        home:   { _: -0.1, adv: -0.5, oppPress: 0.6, oppAsn: 0.3, myBack: 0.4, tiltMy: 0.3, eTeam: -0.2 },
        center: { _: 0.2 },
        press:  { _: -0.35, adv: 0.6, oppPress: -0.5, eTeam: 0.3, myAsn: 0.4, oppBack: 0.2, tiltMy: -0.4, rng: 0.2 }
      },
      formation: {
        split: { _: -0.4, adv: 0.3, eJudge: 0.5, ePosn: 0.4, eObj: 0.4, oppAsn: -0.8, oppAggro: -0.5, tiltMy: -0.3, myAsn: 0.2 },
        auto:  { _: 0.2 },
        duo:   { _: 0.05, oppAsn: 0.5, oppAggro: 0.2, eTeam: 0.1 },
        group: { _: -0.05, adv: -0.5, oppAsn: 0.4, oppAggro: 0.4, oppSplit: 0.5, eTeam: 0.5, myBack: 0.3, tiltMy: 0.2, eObj: -0.3 }
      },
      deposit: {
        early:  { _: 0, adv: -0.3, oppAggro: 0.4, oppAsn: 0.4, oppPress: 0.4, tiltMy: 0.3, eObj: -0.3, eJudge: -0.2 },
        normal: { _: 0.2 },
        full:   { _: -0.2, adv: 0.4, oppAggro: -0.6, oppPress: -0.5, oppAsn: -0.4, eJudge: 0.4, ePosn: 0.3, eObj: 0.4 }
      },
      boss: {
        yield:   { _: -0.1, adv: -0.6, oppBoss: 0.5, tiltMy: 0.4, myBack: 0.2, eTeam: -0.4, eJudge: -0.2 },
        smart:   { _: 0.25, eJudge: 0.4, eReact: 0.3, oppBoss: 0.3 },
        steal:   { _: -0.2, adv: 0.1, oppBoss: 0.7, eReact: 0.5, eJudge: 0.3, eFight: 0.3, myAsn: 0.3 },
        contest: { _: -0.35, adv: 0.9, oppBoss: -0.8, eTeam: 0.5, eFight: 0.4, eUlt: 0.2, myFront: 0.4, tiltMy: -0.5 }
      },
      ultT: {
        normal: { _: 0.25 },
        burst:  { _: -0.2, adv: 0.4, myAsn: 0.3, oppBack: 0.3, eUlt: 0.3, tiltOpp: 0.2, oppAsn: -0.2 },
        save:   { _: 0, adv: -0.2, eTeam: 0.5, eJudge: 0.3, oppBoss: 0.5, oppAggro: 0.3 },
        clutch: { _: -0.1, adv: -0.4, eClutch: 0.3, myBack: 0.5, oppAsn: 0.6, oppAggro: 0.4, tiltMy: 0.3 }
      }
    },
    feat: {
      adv: ['전력이 평균 {v} 앞섬', '전력이 평균 {v} 뒤짐'], oppAggro: ['상대가 교전을 일찍 여는 성향', '상대가 교전에 신중한 성향'], oppPress: ['상대가 우리 진영까지 올라오는 편', '상대가 자기 진영에서 버티는 편'],
      oppSplit: ['상대가 흩어져 움직이는 편', '상대가 뭉쳐 다니는 편'], oppEarly: ['상대가 코어를 일찍 제출하는 편', '상대가 코어를 가득 채워 제출하는 편'], oppBoss: ['상대가 보스에 적극적', '상대가 보스를 양보하는 편'],
      oppAsn: ['상대에 암살자형이 있어 후열이 위험', '상대에 암살자형이 없어 후방이 비교적 안전'], oppBack: ['상대 후열 딜러가 많아 파고들 틈이 있음', '상대 후열이 적어 정면 싸움 중심'], oppFront: ['상대 전열이 두터움', '상대 전열이 얇음'],
      myAsn: ['우리에게 침투형 파이터가 있음', '우리에게 침투형 파이터가 없음'], myBack: ['우리 후열 비중이 높아 보호가 필요', '우리 후열이 적어 기동이 자유로움'], myFront: ['우리 전열이 탄탄함', '우리 전열이 얇음'],
      rng: ['우리 쪽 사거리가 더 김', '상대 쪽 사거리가 더 김'], eAim: ['스킬샷 정확도가 {v} 앞섬', '스킬샷 정확도가 {v} 뒤짐'], eJudge: ['판단력이 {v} 앞섬', '판단력이 {v} 뒤짐'], eFight: ['교전 마무리 능력이 {v} 앞섬', '교전 마무리 능력이 {v} 뒤짐'],
      eReact: ['반응속도가 {v} 앞섬', '반응속도가 {v} 뒤짐'], ePosn: ['포지셔닝이 {v} 앞섬', '포지셔닝이 {v} 뒤짐'], eUlt: ['궁극기 운용이 {v} 앞섬', '궁극기 운용이 {v} 뒤짐'], eObj: ['오브젝트·회복 운영이 {v} 앞섬', '오브젝트·회복 운영이 {v} 뒤짐'],
      eTeam: ['팀워크가 {v} 앞섬', '팀워크가 {v} 뒤짐'], eClutch: ['클러치·침착성이 {v} 앞섬', '클러치·침착성이 {v} 뒤짐'], tiltMy: ['우리 선수 중 폼·멘탈이 불안한 선수가 있음', '우리 선수들의 컨디션이 안정적'],
      tiltOpp: ['상대 선수 중 폼·멘탈이 불안한 선수가 있음', '상대 선수들의 컨디션이 안정적'], trblMy: ['우리 선수 중 트러블·태업 성향이 있어 변수가 큼', ''], lvF: ['상대 AI 난이도가 높아 실수가 적음', '상대 AI 난이도가 낮아 실수가 잦음']
    },
    effect: {
      engage: { avoid: '손실을 최소화하고 코어 운영에 집중합니다', careful: '불리한 교전을 피해 손실을 줄입니다', balanced: '변수를 줄이고 상황에 맞춰 대응합니다', aggressive: '교전 주도권을 잡아 킬과 압박을 늘립니다', allout: '끝까지 몰아붙여 상대 흐름을 끊습니다' },
      zone: { home: '우리 진영 방어가 단단해집니다', center: '양쪽 길목을 고르게 봅니다', press: '상대 제출 길목을 눌러 점수 템포를 늦춥니다' },
      formation: { split: '코어를 넓게 빨리 찾습니다', auto: '코어 가치에 따라 자연스럽게 나뉩니다', duo: '고립을 피하면서 수집 범위를 유지합니다', group: '한타 힘이 커지고 고립이 사라집니다' },
      deposit: { early: '점수를 일찍 확정해 코어 손실을 막습니다', normal: '수집과 제출의 균형을 잡습니다', full: '왕복 횟수를 줄여 한 번에 큰 점수를 냅니다' },
      boss: { yield: '보스 부담을 덜고 코어 수집에 집중합니다', smart: '점수와 위치를 보고 합류 여부를 정합니다', steal: '체력이 깎인 보스를 가로챌 기회가 늘어납니다', contest: '보스를 먼저 잡아 큰 점수를 선점합니다' },
      ultT: { normal: '개인 궁 설정에 맞춰 효율적으로 씁니다', burst: '궁을 아끼지 않고 흐름을 잡습니다', save: '큰 교전과 보스 타이밍에 궁을 맞춥니다', clutch: '아군이 위험할 때 궁이 곧바로 나갑니다' }
    },
    risk: {
      engage: { avoid: '킬·압박이 줄어 역전 수단이 부족합니다', careful: '기회를 놓칠 수 있습니다', balanced: '뚜렷한 장점이 없습니다', aggressive: '컨디션이 흔들리면 손실이 커집니다', allout: '데스가 늘고 점수 템포가 늦어집니다' },
      zone: { home: '먼 코어는 늦게 닿습니다', center: '길목을 놓칠 수 있습니다', press: '우리 진영이 비기 쉽습니다' },
      formation: { split: '고립되면 암살자에게 노출됩니다', auto: '조합 특성을 못 살릴 수 있습니다', duo: '나머지 1명이 고립됩니다', group: '코어 수집 범위가 좁아집니다' },
      deposit: { early: '오가는 시간이 늘어납니다', normal: '', full: '운반 중 사망하면 손실이 큽니다' },
      boss: { yield: '보스 점수를 내줄 수 있습니다', smart: '', steal: '타이밍을 놓치면 아무것도 못 얻습니다', contest: '보스전에서 체력과 궁을 많이 씁니다' },
      ultT: { normal: '', burst: '큰 교전에서 궁이 비어 있을 수 있습니다', save: '아끼다가 못 쓰고 지는 경우가 있습니다', clutch: '선제 타이밍을 놓칠 수 있습니다' }
    },
    insights: [
      { f: 'oppAsn', gte: 0.6, text: '상대에 암살자형이 있습니다. 후열이 고립되지 않게 주의하세요.' },
      { f: 'oppBack', gte: 0.6, text: '상대 후열 딜러가 많습니다. 전열이 파고들 수 있는 구도입니다.' },
      { f: 'oppFront', gte: 0.9, text: '상대 전열이 두텁습니다. 정면 교전보다 코어 운영이 유리할 수 있습니다.' },
      { f: 'myBack', gte: 0.9, text: '우리 후열 비중이 높습니다. 전열 보호와 사거리 활용이 핵심입니다.' },
      { f: 'rng', gte: 0.5, text: '사거리 우위가 있습니다. 거리를 유지하며 싸우는 편이 유리합니다.' },
      { f: 'rng', lte: -0.5, text: '상대 사거리가 더 깁니다. 거리를 좁힐 타이밍이 중요합니다.' },
      { f: 'tiltOpp', gte: 0.3, text: '상대 선수 중 컨디션이 불안한 선수가 있습니다. 초반 압박이 먹힐 수 있습니다.' },
      { f: 'eReact', lte: -0.5, text: '상대 반응속도가 더 높습니다. 허를 찌르는 변칙보다 안정적인 운영이 낫습니다.' },
      { f: 'eTeam', lte: -0.5, text: '상대 팀워크가 더 좋습니다. 한타가 길어지면 불리합니다.' },
      { f: 'adv', gte: 0.75, text: '전력 우위가 큽니다. 상대가 맞서더라도 흔들리지 않는 운영이 가능합니다.' },
      { f: 'adv', lte: -0.75, text: '전력이 크게 밀립니다. 정면 승부보다 상대 약점을 노리는 운영이 필요합니다.' }
    ]
  },
  mind: {
    sense: { vis: 34, visJ: 12, mate: 30, mateT: 14, noise: 0.5, refresh: 0.8, refreshR: 0.4, assume: 0.1, dpsSec: 2, zoneR: 12, zoneCost: 22, routeR: 16 },
    surv: { ttd: 1.7, ttdP: 0.8, ttdCarry: 0.3, ttdClutch: 0.7, ttdSd: 0.6, doct: 0.6, doctHp: 0.08, hpCarry: 0.05, hpBack: 0.5, win: 0.9, winJ: 0.2, finishHp: 0.25, fbSec: 3.5, fbCdSec: 4.5, cdSec: 1.8, cdHp: 0.7, outHp: 0.22, softNeed: 0.3, softEdge: 0.35, softLim: [0.7, 1.45], softWait: 7, softOff: 5, safeP: 6, podReach: 160, podBlock: 14 },
    /* 코어 소지자 평가기(ev): 선택지(제출·아군 경유 제출·후퇴/회복팩·교전)를 짧게 앞서 굴려 '승리확률' 변화로 비교합니다.
       품질 q = 0.6*등급 + 0.4*판단력 → 예측 시야(hLo~hHi 초)·고려하는 적 범위(reachLo~Hi)·안 보이는 적 고려(ghostQ 이상)·판단 정밀도(k0+kQ*q)·경로 아이디어(viaQ)가 q에 따라 넓어집니다.
       on 끄면 기존 규칙 · dt 예측 간격(초) · pursuit/ghostPursuit 적이 따라붙는 속도 배율 · skillDps 스킬 보정 · allyR/allyShare 근처 아군이 피해를 나눠 받는 정도
       surv0 예상 피해/체력이 이 값이면 생존 50% · sig0/sigT/sigSd 승리확률 곡선 폭(남은 시간이 길수록 넓음, sd 서든데스) · deathPts 죽음 비용(점수) · grab0/grabN 드롭 코어를 상대가 줍을 확률
       hold 아직 못 낸 코어의 가치 비율 · kill/killCarry 처치 가치 · fightSec 교전 소요 · panic 뒤질 때 클러치가 낮을수록 교전 승산을 과대평가하는 정도 · podV 회복팩 가치
       swLo/swHi 계획을 바꾸는 데 필요한 이득(q 높을수록 한 번 정한 계획을 더 유지) · evalSec 재평가 주기 · grabVal 이 가치 이상 들고 있으면 위협 중 코어 줍기/교전 중 코어 챙기기 금지 · detour/detourV 허용 우회 거리 */
    /* 성향(pers): 공격 편향 = 스타일(교전능력 style) + 압박 반응(클러치 높으면 pHi로 차분, 낮으면 pLo로 휘둘림) + 연속 킬 자신감(hot, 판단 높을수록 줄어듦).
       그다음 q(등급+판단력)만큼 '실제 전력 우위(Sit.edge*edgeK)'에 맞춰 보정(cal) → 고등급은 이길 때만 과감, 질 때는 물러남. 저등급은 기분·분위기대로 움직임 */
    /* 제출 기준(depT): 팀 기본 제출 개수(need)를 선수별 상황으로 조정. 안전하고 주변에 코어가 있으면 콤보(4개)까지 모으고(comboQ 이상 품질),
       적이 가까우면 한 개 일찍 제출(riskQ 이상). comboHp 체력 · comboNeed 이 이상 뒤지면 욕심 안 부림 · knownR 주변 코어 탐색 거리 */
    depT: { comboQ: 0.5, riskQ: 0.3, comboHp: 0.5, comboNeed: 0.3, knownR: 40 },
    pers: { style: 0.15, pLo: 1.4, pHi: 0.5, hot: 0.25, hotQ: 0.6, cal: 0.7, edgeK: 0.8 },
    /* 팀 목표(goalW): 팀 목표가 개인 목표 점수에 얹는 보너스. 반영 비율 = f0 + fq*q (고품질일수록 팀 계획을 따르되, 소지자 보호 등은 근거가 있을 때만)
       secDep/secCore/secHunt: SecureDeposit 중 코어 든 선수의 제출 가산·코어/사냥 감점 · farm 코어 수집 · hunt 캐리어 사냥 · force 비소지자 교전 · boss 보스 · stall/stallHunt 시간끌기
       evDep/evFight: 평가기 보정(SecureDeposit이면 제출 +, 교전 -  / 사냥 목표면 교전 +) */
    goalW: { f0: 0.5, fq: 0.5, secDep: 0.5, secCore: 0.4, secHunt: 0.4, farm: 0.15, hunt: 0.25, force: 0.2, boss: 0.2, stall: 0.3, stallHunt: 0.3, evDep: 0.02, evFight: 0.015 },
    ev: { on: true, dt: 0.5, hLo: 1.8, hHi: 6, reachLo: 28, reachHi: 52, ghostQ: 0.3, ghostW: 1, pursuit: 0.9, ghostPursuit: 0.6, skillDps: 0.4, allyR: 20, allyShare: 0.45, k0: 4, kQ: 6, surv0: 0.9, sig0: 1, sigT: 0.035, sigSd: 0.35, deathPts: 0.6, grab0: 0.25, grabN: 0.2, hold: 0.55, kill: 0.45, killCarry: 0.4, fightSec: 2.5, panic: 0.35, podV: 0.03, viaQ: 0.3, viaMax: 70, swLo: 0.01, swHi: 0.03, evalSec: [0.9, 0.2], grabVal: 2, grabGhost: 0.3, detour: 6, detourV: 4 },
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
      /* ovrOn: 선수 ovr 로 등급 g 를 연속값으로 계산 (같은 S급이라도 81과 92가 다르고 SSS(99)는 1.0). gOvr = [ovr, g] 꺾은선. ovr 정보가 없으면 위 gr(등급 고정값) 사용 */
      ovrOn: true, gOvr: [[32, 0], [41, 0.05], [58, 0.35], [73, 0.65], [86, 0.9], [99, 1]],
      noiseT: 0.7, open: 0.25, bank: 0.25, gamble: 0.2, gateWait: 0.35,
      chaseReach: 25, chaseOwn: 1, chaseIso: 0.35, chaseSup: 0.4, chaseHold: 2, chaseHp: 0.1,
      mustHi: 0.85, calmG: 0.8, dep: 0.6, riskVal: 3, riskP: 0.5, leadNeed: 0.5, leadCut: 0.6,
      /* 연속 곡선(문턱 없음): ramp(g, lo, hi) = 등급·판단 품질이 lo 이하면 0, hi 이상이면 1, 사이는 선형. hiLo~mustHi 위험 제출·강행 · calmG 까지 여유 제출 · direLo~Hi 위급 판단 · leadLo~Hi 리드 시 제출 우선 · teamLo~Hi 아군 캐리어 돕기 · groupSlack 낮은 품질일수록 합류가 늦어지는 폭 · riskSlack 낮은 품질일수록 위험 제출에 요구되는 도달 확률 */
      hiLo: 0.5, direLo: 0.4, direHi: 0.8, leadLo: 0.3, leadHi: 0.7, teamLo: 0.1, teamHi: 0.6, groupSlack: 1.2, riskSlack: 0.5,
      hold: 0.3, killHp: 0.35, allyR: 32, killRatio: 1.1, allyW: 0.6, dire: 0.45, earlyHp: 0.05, outHp: 0.6, ratio: 0,
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
      sudden: { hpRatio: 1, maxTicks: 1500, protect: 3, pressSec: 30, kinds: ['playoff', 'msi', 'worlds'] },
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
           chaseT: 8, leash: 48, retreatHp: 0.21, ratio: 3.4, podRun: 16, ensureBoss: false, waitPod: false, skillPatience: 2.4, recastHold: 0.9 },
      B: { name: 'B급', desc: '적당히 쫓다 돌아오고, 힐팩을 가끔 챙깁니다.',
           chaseT: 7, leash: 44, retreatHp: 0.22, ratio: 3.4, podRun: 28, ensureBoss: false, waitPod: false, skillPatience: 2.0, recastHold: 0.95 },
      A: { name: 'A급', desc: '보스 타이밍을 챙기고, 스킬을 비교적 빠르게 돌립니다.',
           chaseT: 6, leash: 40, retreatHp: 0.22, ratio: 3.4, podRun: 40, ensureBoss: true, waitPod: false, skillPatience: 1.6, recastHold: 1.0 },
      S: { name: 'S급', desc: '보스 타이밍과 회복 장치를 놓치지 않고, 스킬을 쿨이 돌자마자 씁니다.',
           chaseT: 5.5, leash: 38, retreatHp: 0.23, ratio: 3.4, podRun: 50, ensureBoss: true, waitPod: true, skillPatience: 1.3, recastHold: 1.1 }
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
