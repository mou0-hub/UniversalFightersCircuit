/* sounds.js — 효과음 (Web Audio 합성, 외부 파일/링크 불필요)
 *
 * ▣ 새 소리 추가: SOUNDS 에 한 줄만 추가하면 끝.
 *    이름: [ 레이어, 레이어, ... ]
 *    레이어 = { w: 파형, f: 주파수 또는 [시작,끝], d: 길이(초), v: 음량, at: 시작 지연(초), lp/hp: 필터(숫자 또는 [시작,끝]) }
 *    w: 'square' | 'sine' | 'triangle' | 'sawtooth' | 'noise'
 *
 * ▣ 상황 연결은 아래 매핑 표만 고치면 됩니다.
 *    SKILL_SOUND : 스킬 종류(kind) → 소리 이름
 *    HIT_SOUND   : 투사체 종류(proj) → 타격음 / 발사음
 *    RARITY_SOUND: 가챠 등급 → 소리 이름
 *    COOLDOWN    : 같은 소리 최소 간격(ms) — 난타 시 소리가 뭉개지는 것 방지
 */

const Sound = (() => {
  /* ---------- 소리 정의 (여기에만 추가) ---------- */
  const SOUNDS = {
    /* UI */
    click:      [{ w: 'sine', f: [900, 700], d: 0.04, v: 0.12 }],
    error:      [{ w: 'square', f: 200, d: 0.09, v: 0.14 }, { w: 'square', f: 160, d: 0.12, v: 0.14, at: 0.11 }],
    coin:       [{ w: 'square', f: 988, d: 0.07, v: 0.12 }, { w: 'square', f: 1319, d: 0.28, v: 0.12, at: 0.07 }],
    ultReady:   [{ w: 'triangle', f: 880, d: 0.09, v: 0.16 }, { w: 'triangle', f: 1175, d: 0.2, v: 0.16, at: 0.09 }],

    /* 공격 / 피격 */
    hit:        [{ w: 'square', f: [220, 90], d: 0.08, v: 0.22 }, { w: 'noise', hp: 1500, d: 0.05, v: 0.18 }],
    hitBolt:    [{ w: 'sine', f: [900, 200], d: 0.13, v: 0.2 }, { w: 'noise', lp: 3000, d: 0.08, v: 0.12 }],
    hitArrow:   [{ w: 'triangle', f: [700, 300], d: 0.07, v: 0.2 }, { w: 'noise', hp: 2500, d: 0.04, v: 0.15 }],
    shoot:      [{ w: 'noise', hp: 2000, d: 0.09, v: 0.1 }, { w: 'triangle', f: [1200, 500], d: 0.07, v: 0.1 }],
    beam:       [{ w: 'sine', f: [700, 1100], d: 0.14, v: 0.12 }],
    crit:       [{ w: 'square', f: [330, 60], d: 0.14, v: 0.28 }, { w: 'noise', hp: 1200, d: 0.1, v: 0.22 }, { w: 'sine', f: [1400, 900], d: 0.12, v: 0.14, at: 0.02 }],
    kill:       [{ w: 'sawtooth', f: [220, 40], d: 0.32, v: 0.28 }, { w: 'noise', lp: 800, d: 0.28, v: 0.28 }, { w: 'sine', f: [120, 50], d: 0.3, v: 0.3 }],
    miss:       [{ w: 'noise', hp: 3000, d: 0.07, v: 0.07 }],
    block:      [{ w: 'triangle', f: [1200, 900], d: 0.09, v: 0.18 }, { w: 'sine', f: 1800, d: 0.06, v: 0.1 }],
    dot:        [{ w: 'sine', f: [300, 150], d: 0.07, v: 0.1 }],

    /* 스킬 */
    skill:      [{ w: 'triangle', f: [500, 1000], d: 0.16, v: 0.16 }, { w: 'square', f: [750, 1500], d: 0.1, v: 0.1, at: 0.06 }],
    skillNuke:  [{ w: 'sawtooth', f: [200, 900], d: 0.2, v: 0.14 }, { w: 'noise', lp: [600, 3500], d: 0.22, v: 0.14 }],
    aoe:        [{ w: 'sine', f: [120, 40], d: 0.36, v: 0.36 }, { w: 'noise', lp: [2000, 300], d: 0.36, v: 0.24 }],
    dash:       [{ w: 'noise', lp: [400, 3000], d: 0.18, v: 0.2 }, { w: 'sine', f: [300, 700], d: 0.12, v: 0.08 }],
    pierce:     [{ w: 'sawtooth', f: [1400, 300], d: 0.12, v: 0.14 }, { w: 'noise', hp: 2500, d: 0.08, v: 0.1 }],
    taunt:      [{ w: 'square', f: [150, 110], d: 0.16, v: 0.2 }, { w: 'square', f: [150, 110], d: 0.16, v: 0.2, at: 0.2 }],
    shield:     [{ w: 'sine', f: [600, 1200], d: 0.22, v: 0.16 }, { w: 'triangle', f: 900, d: 0.3, v: 0.08, at: 0.05 }],
    heal:       [{ w: 'sine', f: 523, d: 0.14, v: 0.14 }, { w: 'sine', f: 659, d: 0.14, v: 0.14, at: 0.07 }, { w: 'sine', f: 784, d: 0.22, v: 0.14, at: 0.14 }],
    drain:      [{ w: 'sine', f: [400, 250], d: 0.1, v: 0.09 }],
    buff:       [{ w: 'triangle', f: [440, 880], d: 0.2, v: 0.15 }],
    debuff:     [{ w: 'sawtooth', f: [400, 150], d: 0.22, v: 0.11 }],
    ult:        [{ w: 'sawtooth', f: [110, 440], d: 0.55, v: 0.18 }, { w: 'sine', f: [220, 880], d: 0.55, v: 0.22 }, { w: 'noise', lp: [500, 4000], d: 0.55, v: 0.14 }, { w: 'square', f: 880, d: 0.25, v: 0.12, at: 0.28 }],

    /* 경기 흐름 */
    battleStart:[{ w: 'square', f: 330, d: 0.1, v: 0.14 }, { w: 'square', f: 440, d: 0.1, v: 0.14, at: 0.11 }, { w: 'square', f: 660, d: 0.3, v: 0.16, at: 0.22 }, { w: 'sine', f: [100, 50], d: 0.3, v: 0.3, at: 0.22 }],
    win:        [{ w: 'square', f: 523, d: 0.14, v: 0.14 }, { w: 'square', f: 659, d: 0.14, v: 0.14, at: 0.15 }, { w: 'square', f: 784, d: 0.14, v: 0.14, at: 0.3 }, { w: 'square', f: 1047, d: 0.5, v: 0.16, at: 0.45 }, { w: 'sine', f: 523, d: 0.6, v: 0.16, at: 0.45 }],
    lose:       [{ w: 'sawtooth', f: 392, d: 0.28, v: 0.12, lp: 1200 }, { w: 'sawtooth', f: 330, d: 0.28, v: 0.12, at: 0.3, lp: 1200 }, { w: 'sawtooth', f: 262, d: 0.28, v: 0.12, at: 0.6, lp: 1200 }, { w: 'sawtooth', f: 196, d: 0.7, v: 0.14, at: 0.9, lp: 900 }],
    draw:       [{ w: 'triangle', f: 440, d: 0.2, v: 0.14 }, { w: 'triangle', f: 440, d: 0.35, v: 0.14, at: 0.25 }],

    /* 가챠 */
    pull:       [{ w: 'noise', lp: [300, 4000], d: 0.4, v: 0.16 }, { w: 'sine', f: [200, 800], d: 0.4, v: 0.14 }],
    gachaCommon:[{ w: 'sine', f: 660, d: 0.16, v: 0.14 }],
    gachaRare:  [{ w: 'sine', f: 660, d: 0.12, v: 0.15 }, { w: 'sine', f: 880, d: 0.22, v: 0.15, at: 0.1 }],
    gachaEpic:  [{ w: 'triangle', f: 523, d: 0.12, v: 0.16 }, { w: 'triangle', f: 784, d: 0.12, v: 0.16, at: 0.1 }, { w: 'triangle', f: 1047, d: 0.35, v: 0.18, at: 0.2 }, { w: 'sine', f: [1800, 2600], d: 0.3, v: 0.07, at: 0.2 }],
    gachaLegendary: [
      { w: 'square', f: 523, d: 0.12, v: 0.14 }, { w: 'square', f: 659, d: 0.12, v: 0.14, at: 0.12 }, { w: 'square', f: 784, d: 0.12, v: 0.14, at: 0.24 },
      { w: 'square', f: 1047, d: 0.7, v: 0.16, at: 0.36 }, { w: 'sine', f: 523, d: 0.8, v: 0.2, at: 0.36 }, { w: 'sine', f: [2000, 3200], d: 0.6, v: 0.08, at: 0.4 }
    ]
  };

  /* ---------- 상황 → 소리 매핑 (여기만 고치면 연결 변경) ---------- */
  const SKILL_SOUND  = { nuke: 'skillNuke', aoe: 'aoe', heal: 'heal', healAoe: 'heal', shield: 'shield', buff: 'buff', debuff: 'debuff',
                         dash: 'dash', charge: 'dash', blink: 'dash', pierce: 'pierce', taunt: 'taunt', rescue: 'shield', execute: 'skillNuke' };
  const HIT_SOUND    = { melee: ['hit'], bolt: ['hitBolt', 0.1], arrow: ['hitArrow', 0.14, 'shoot'], beam: ['hitBolt', 0.1, 'beam'], none: ['hit'] };
  const RARITY_SOUND = { common: 'gachaCommon', rare: 'gachaRare', epic: 'gachaEpic', legendary: 'gachaLegendary' };
  const COOLDOWN     = { hit: 35, hitBolt: 35, hitArrow: 35, miss: 90, dot: 140, block: 60, drain: 120, heal: 80, kill: 0, crit: 0, click: 30 };
  const CLICK_SKIP   = ['pull', 'startBattle', 'ult', 'tacLv'];          // 자체 소리가 있는 버튼은 클릭음 생략
  const MAX_VOICES   = 28;

  /* ---------- 엔진 ---------- */
  const KEY = (typeof CONFIG !== 'undefined' && CONFIG.game ? CONFIG.game.saveKey : 'game') + '_sound';
  let ac = null, master = null, noiseBuf = null, voices = 0;
  const lastAt = {};
  const st = (() => { try { return Object.assign({ on: true, vol: 0.6 }, JSON.parse(localStorage.getItem(KEY))); } catch (e) { return { on: true, vol: 0.6 }; } })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* 저장 불가 환경은 무시 */ } };

  function unlock() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ac = new AC();
      const comp = ac.createDynamicsCompressor();                       // 동시 다발 소리가 찢어지지 않게
      master = ac.createGain(); master.gain.value = st.on ? st.vol : 0;
      master.connect(comp); comp.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
    setTimeout(startBgm, 50);
  }

  const arr = v => (Array.isArray(v) ? v : [v, v]);
  function layer(L, t0) {
    const dur = L.d, t = t0 + (L.at || 0), g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, L.v), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let src;
    if (L.w === 'noise') { src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true; }
    else {
      src = ac.createOscillator(); src.type = L.w; const [f0, f1] = arr(L.f);
      src.frequency.setValueAtTime(f0, t); if (f1 !== f0) src.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    }
    let node = src;
    [['lp', 'lowpass'], ['hp', 'highpass']].forEach(([k, type]) => {
      if (L[k] === undefined) return;
      const f = ac.createBiquadFilter(), [a, b] = arr(L[k]); f.type = type;
      f.frequency.setValueAtTime(a, t); if (b !== a) f.frequency.exponentialRampToValueAtTime(b, t + dur);
      node.connect(f); node = f;
    });
    node.connect(g); g.connect(master);
    voices++; src.onended = () => { voices--; };
    src.start(t); src.stop(t + dur + 0.05);
  }

  /* play('hit') / play('hit', { delay: 0.1 }) */
  function play(name, o) {
    if (!st.on || !ac || ac.state !== 'running') return;
    const def = SOUNDS[name]; if (!def) return;
    const nowMs = performance.now(), cd = COOLDOWN[name] === undefined ? 30 : COOLDOWN[name];
    if (nowMs - (lastAt[name] || -1e9) < cd) return;
    if (voices > MAX_VOICES) return;
    lastAt[name] = nowMs;
    const t0 = ac.currentTime + ((o && o.delay) || 0);
    def.forEach(L => layer(L, t0));
  }

  /* ---------- 전투 이벤트 → 소리 (arena.js 의 onEvent 에서 호출) ---------- */
  function fromEvent(ev) {
    switch (ev.type) {
      case 'skill':
        if (ev.slot === 'ult') play('ult');
        play(SKILL_SOUND[ev.kind] || 'skill', ev.slot === 'ult' ? { delay: 0.12 } : null);
        break;
      case 'move':   play('dash'); break;
      case 'aoe':    play('aoe'); break;
      case 'status': play(ev.good ? 'buff' : 'debuff'); break;
      case 'heal':   play(ev.blocked ? 'error' : ev.drain ? 'drain' : 'heal'); break;
      case 'attack': {
        if (ev.dot) { play(ev.kill ? 'kill' : 'dot'); break; }
        const h = HIT_SOUND[ev.proj] || HIT_SOUND.melee;
        if (h[2]) play(h[2]);                                              // 발사음
        if (!ev.hit) { play('miss', { delay: h[1] || 0 }); break; }
        const d = { delay: h[1] || 0 };
        if (ev.kill) play('kill', d);
        else if (ev.dmg === 0) play('block', d);
        else if (ev.crit) play('crit', d);
        else if (!ev.splash) play(h[0], d);
        break;
      }
    }
  }

  /* ---------- 경기 결과 / 가챠 ---------- */
  function result(info) {
    play(info.won ? 'win' : info.draw ? 'draw' : 'lose');
    if (info.reward && info.reward.total > 0) play('coin', { delay: info.won ? 1.0 : 0.5 });
  }
  function gacha(chars) {
    play('pull');
    chars.forEach((c, i) => setTimeout(() => play(RARITY_SOUND[c.rarity] || 'gachaCommon'), 300 + i * 140));   // 카드 공개 간격(140ms)에 맞춤
  }

  /* ---------- 초기화: 첫 클릭 시 오디오 활성화, 켜기/끄기·볼륨 UI ---------- */
  function sync() {
    if (master) master.gain.setTargetAtTime(st.on ? st.vol : 0, ac.currentTime, 0.02);
    const b = document.getElementById('soundBtn'), r = document.getElementById('volume');
    if (b) { b.textContent = st.on && st.vol > 0 ? '🔊' : '🔇'; b.title = st.on ? '소리 끄기' : '소리 켜기'; }
    if (r) r.value = Math.round(st.vol * 100);
  }
  function init() {
    ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, { passive: true }));
    document.addEventListener('click', e => {
      const b = e.target.closest('#soundBtn');
      if (b) { unlock(); st.on = !st.on; if (st.on && st.vol === 0) st.vol = 0.6; save(); sync(); play('click'); return; }
      const el = e.target.closest('[data-act]');
      if (el && !CLICK_SKIP.includes(el.dataset.act)) play('click');
    });
    document.addEventListener('input', e => {
      if (e.target.id !== 'volume') return;
      unlock(); st.vol = e.target.value / 100; st.on = st.vol > 0; save(); sync();
    });
    sync();
  }

  /* ---------- BGM (TRACKS 에 곡 추가 → GROUPS 에 이름 넣으면 랜덤 후보에 포함) ---------- */
  const QUAL = { M: [1, 1.26, 1.5], m: [1, 1.19, 1.5], sus: [1, 1.335, 1.5], dim: [1, 1.19, 1.414] };   // 화음 구성
  const DRUMS = {                                   // 8분음표 8칸 중 어디서 칠지 (k 킥 / s 스네어 / h 하이햇 / ohat 오픈햇 / clap 박수 / tom 톰·팀파니 / roll 스네어 롤 / crash 심벌(N마디마다))
    rush:  { k: [0, 4, 7], s: [2, 6], h: [0, 1, 2, 3, 4, 5, 6, 7], run: true },
    march: { k: [0, 3, 4, 7], s: [4], h: [] },
    boom:  { k: [0], s: [], h: [] },
    pulse: { k: [0, 2, 4, 6], s: [], h: [1, 3, 5, 7], run: true },
    /* MSI: 힙합 · 락 · 펑크 */
    hip:    { k: [0, 3, 6], s: [4], clap: [4], h: [0, 2, 4, 6], ohat: [7] },
    hipSoft:{ k: [0, 5], s: [4], h: [0, 2, 4, 6] },
    rock:   { k: [0, 3, 4], s: [2, 6], h: [0, 1, 2, 3, 4, 5, 6, 7], crash: 4 },
    rockLt: { k: [0, 4], s: [2, 6], h: [0, 2, 4, 6] },
    punk:   { k: [0, 2, 4, 6], s: [2, 6], h: [0, 1, 2, 3, 4, 5, 6, 7], crash: 4 },
    funk:   { k: [0, 3, 6], s: [2, 6], h: [0, 1, 2, 3, 4, 5, 6, 7], ohat: [5] },
    /* 월즈: 팀파니 · 전쟁북 · 심장박동 */
    timp:   { tom: [0, 3, 4], s: [6], roll: [7], crash: 4 },
    war:    { tom: [0, 2, 4, 6], k: [0, 4], s: [2, 6], roll: [7], crash: 4 },
    heart:  { tom: [0, 1], k: [0] },
    toll:   { tom: [0], crash: 8 },
    /* 신규: 일렉트로닉(4박 킥 + 박수 + 엇박 오픈햇) / 오케스트라(팀파니 두 번 + 심벌) */
    edm:    { k: [0, 2, 4, 6], clap: [2, 6], ohat: [1, 3, 5, 7], crash: 4 },
    orch:   { tom: [0, 4], crash: 4 },
    /* 빌드업 곡용: 파트별(tom/k/s/h)로 구간마다 켜고 끌 수 있습니다 */
    siege:  { tom: [0, 4], k: [0, 3, 4, 7], s: [2, 6], h: [1, 3, 5, 7] },
    /* MSI 힙합: 반박자 느낌의 킥 + 3박 클랩 + 잘게 쪼개지는 하이햇(hroll = 한 칸을 3연타) */
    trap:   { k: [0, 3, 6], clap: [4], h: [0, 1, 2, 4, 5, 6], hroll: [3, 7] },
    /* 월드 군단: 팀파니가 몰아치고 마디 끝마다 스네어 롤 */
    legion: { tom: [0, 3, 4, 6], k: [0, 4], s: [2, 6], roll: [7] }
  };
  /* chords: [루트Hz, 화음종류] / arp: 8칸 멜로디 배율(0=쉼) / pad: 길게 깔리는 화음 / bell: 종소리 칸 / echo: 메아리 */
  const TRACKS = {
    lobby:   { bpm: 84, vol: 0.09, wave: 'triangle', pad: 1,
               chords: [[220, 'm'], [174.61, 'M'], [130.81, 'M'], [196, 'M']], arp: [1, 1.5, 2, 3, 2, 1.5, 2, 1.5] },

    rush:    { bpm: 142, vol: 0.085, wave: 'square', arpLp: 2500, drums: 'rush',                       // 긴박
               chords: [[146.83, 'm'], [116.54, 'M'], [174.61, 'M'], [130.81, 'M']], arp: [1, 2, 1.5, 2, 1, 2, 1.5, 3] },

    epic:    { bpm: 104, vol: 0.08, wave: 'sawtooth', arpLp: 1400, drums: 'march',                     // 웅장
               pad: 1, padWave: 'sawtooth', padLp: 900, padAtt: 0.25, padOct: 1,
               chords: [[130.81, 'm'], [103.83, 'M'], [155.56, 'M'], [116.54, 'M']], arp: [2, 0, 2, 0, 3, 0, 2, 0] },

    odyssey: { bpm: 56, vol: 0.075, wave: 'sine', drums: 'boom', bell: [0, 4],                           // 스페이스 오디세이풍
               pad: 1, padWave: 'sawtooth', padLp: 500, padAtt: 1.2, padVol: 0.5, padOct: 1, bassWave: 'triangle',
               chords: [[130.81, 'sus'], [174.61, 'sus'], [196, 'sus'], [146.83, 'm']], arp: [0, 0, 0, 0, 0, 0, 0, 0] },

    mystic:  { bpm: 72, vol: 0.08, wave: 'triangle', arpLp: 3000, echo: 1, bell: [0, 3, 6],              // 신비
               pad: 1, padLp: 1200, padAtt: 0.5,
               chords: [[196, 'm'], [155.56, 'M'], [233.08, 'M'], [174.61, 'sus']], arp: [1, 1.5, 2.25, 3, 2.25, 1.5, 0, 3] },

    pursuit: { bpm: 168, vol: 0.08, wave: 'sawtooth', arpLp: 2000, drums: 'pulse',                      // 추격
               chords: [[220, 'm'], [220, 'm'], [207.65, 'M'], [196, 'M']], arp: [1, 1, 2, 1, 1.5, 1, 2, 1.5] }
  };
  /* ================= 빌드업 → 폭발 곡 =================
     form: 구간(마디 수 bars)마다 켜지는 레이어 on 목록으로 편곡을 만듭니다. 마지막 구간 뒤에는 처음으로 돌아가 반복합니다.
       레이어: pad bell bass tom kick snare hat arp lead stab
       구간 옵션: dbl(16분 겹침) riser(끝 2마디 노이즈 상승) fill(마지막 마디 스네어 롤) gap(마지막 마디 끝 2칸 무음) boom(첫 박 폭발) crash:N(N마디마다 심벌)
       구간 길이는 코드 진행(4마디)의 배수로 맞춰야 화음이 어긋나지 않습니다. */
  TRACKS.crescendo = { bpm: 96, vol: 0.085, wave: 'sawtooth', arpLp: 1400, arpLen: 0.8, drums: 'siege',
    pad: 1, padWave: 'sawtooth', padLp: 900, padAtt: 0.5, padVol: 0.55, padOct: 1, padVib: 5, bassWave: 'sawtooth', bassLp: 420,
    bass: [1, 0, 1, 1, 0, 1, 0, 1], bassLen: 0.9, bell: [0, 4], stab: [0, 3, 6], stabWave: 'sawtooth', stabVol: 0.42, stabLp: 1700, stabLen: 0.7,
    lead: [[3, 0, 0, 2.67, 2.38, 0, 2.67, 2.38], [2, 0, 1.78, 0, 1.5, 0, 1.19, 0], [1.5, 0, 1.26, 0, 1.5, 0, 2, 0], [1.5, 0, 1.78, 0, 2, 0, 1.78, 1.26]],
    leadWave: 'sawtooth', leadLp: 2400, leadLen: 2.2, leadVol: 0.8, leadAtt: 0.03, leadVib: 10, leadUni: 10,
    chords: [[146.83, 'm'], [196, 'm'], [233.08, 'M'], [220, 'M']], arp: [1, 1.5, 2, 1.5, 1, 1.5, 2, 2.38],
    form: [
      { name: '여명',   bars: 4, on: ['pad', 'bell'] },
      { name: '심장박동', bars: 4, on: ['pad', 'bell', 'bass', 'tom'] },
      { name: '행군',   bars: 4, on: ['pad', 'bass', 'tom', 'kick', 'hat', 'arp'] },
      { name: '고조',   bars: 4, on: ['pad', 'bass', 'tom', 'kick', 'snare', 'hat', 'arp', 'stab'], dbl: 1, riser: 1, fill: 1, gap: 1 },
      { name: '폭발',   bars: 8, on: ['pad', 'bell', 'bass', 'tom', 'kick', 'snare', 'hat', 'arp', 'stab', 'lead'], dbl: 1, boom: 1, crash: 4 },
      { name: '여운',   bars: 4, on: ['pad', 'bell', 'tom'] }
    ] };
  /* ================= 신규 경기 BGM 3곡 (GROUPS.battle 랜덤 후보) ================= */
  Object.assign(TRACKS, {
    /* 스페이스 오디세이풍: 아주 느린 박자, 넓게 깔리는 패드와 멀리서 울리는 종소리 */
    cosmos: { bpm: 58, vol: 0.075, wave: 'sine', drums: 'heart', bell: [0, 4], arpLen: 3.2,
              pad: 1, padWave: 'sawtooth', padLp: 620, padAtt: 1.6, padVol: 0.5, padOct: 1, bassWave: 'triangle', riser: 1,
              lead: [[0, 0, 0, 0, 3, 0, 0, 0], [0, 0, 0, 2.5, 0, 0, 0, 0], [0, 0, 0, 0, 4, 0, 0, 3], [0, 0, 0, 0, 0, 0, 2.5, 0]], leadWave: 'sine', leadLen: 4, leadVol: 0.55, leadLp: 2200, leadAtt: 0.25, leadOct: 1,
              chords: [[110, 'sus'], [98, 'sus'], [130.81, 'M'], [123.47, 'dim']], arp: [1, 0, 0, 0, 1.5, 0, 0, 0] },

    /* NCS풍 일렉트로닉: 4박 킥 + 박수 + 엇박 베이스, 사이드체인 펌핑 패드, 슈퍼소 리드 */
    neon:   { bpm: 128, vol: 0.08, wave: 'square', arpLp: 2400, arpLen: 0.6, drums: 'edm',
              pad: 1, padWave: 'sawtooth', padLp: 1500, padAtt: 0.05, padVol: 0.4, padOct: 1, pump: 1,
              bass: [0, 1, 0, 1, 0, 1, 0, 1], bassWave: 'sawtooth', bassLp: 520, bassLen: 0.8,
              lead: [[2, 0, 1.5, 0, 2, 2.38, 3, 0], [2, 0, 1.5, 0, 2, 2.52, 3, 0], [2, 0, 1.5, 0, 2, 2.52, 3, 2.52], [2, 0, 2.52, 0, 3, 0, 2.52, 2]], leadWave: 'sawtooth', leadLp: 3400, leadLen: 1.1, leadVol: 0.7, leadUni: 14,
              chords: [[164.81, 'm'], [130.81, 'M'], [196, 'M'], [146.83, 'M']], arp: [1, 0, 1.5, 1, 0, 1.5, 2, 0] },

    /* 클래식·웅장: 현악 오스티나토(바이올린) 위로 비브라토 선율, 팀파니와 심벌 */
    grand:  { bpm: 92, vol: 0.08, wave: 'sawtooth', arpLp: 2000, arpLen: 0.7, dbl: 1, arpVib: 8, drums: 'orch',
              pad: 1, padWave: 'sawtooth', padLp: 1500, padAtt: 0.7, padVol: 0.5, padOct: 1, padVib: 6, bassWave: 'triangle', riser: 1,
              lead: [[2, 0, 2.38, 0, 3, 0, 2.67, 2.38], [1.5, 0, 1.26, 0, 1, 0, 1.12, 1.26], [1.19, 0, 1.5, 0, 2, 0, 1.78, 1.5], [1.5, 0, 1.78, 0, 1.26, 0, 1.5, 0]], leadWave: 'sawtooth', leadLp: 2600, leadLen: 2.4, leadVol: 0.85, leadAtt: 0.09, leadVib: 14,
              chords: [[146.83, 'm'], [233.08, 'M'], [196, 'm'], [220, 'M']], arp: [[1, 1.5, 2, 1.5, 1, 1.5, 2, 1.5], [1, 1.5, 2, 1.5, 1, 1.5, 2, 1.5], [1, 1.5, 2, 1.5, 1, 1.5, 2, 1.5], [1, 1.5, 2, 1.5, 1, 1.5, 2, 1.78]] }
  });
  /* ================= MSI: 힙하고 락하고 자유분방 ================= */
  Object.assign(TRACKS, {
    /* 밴픽 */
    msi_d1: { bpm: 82, vol: 0.085, wave: 'triangle', echo: 1, swing: 0.2, drums: 'hipSoft', bell: [0, 4],                      // 로파이 힙합
              pad: 1, padWave: 'triangle', padLp: 1100, padAtt: 0.4, bass: [1, 0, 0, 1, 0, 0, 1, 0], bassWave: 'sine', bassLen: 1.4,
              chords: [[174.61, 'm'], [138.59, 'M'], [207.65, 'M'], [155.56, 'M']], arp: [[1, 0, 1.5, 0, 2, 0, 1.5, 0], [1.19, 0, 1.5, 0, 2.38, 0, 1.78, 0]] },
    msi_d2: { bpm: 100, vol: 0.085, wave: 'triangle', swing: 0.12, drums: 'funk', arpLp: 2600,                                   // 쿨한 그루브
              bass: [1, 0, 0, 1, 0, 1, 0, 1.5], bassWave: 'sawtooth', bassLp: 700, stab: [3, 7], stabWave: 'square', stabVol: 0.35, stabLp: 1500, stabLen: 0.6,
              chords: [[146.83, 'm'], [196, 'M'], [130.81, 'M'], [220, 'm']], arp: [0, 0, 1.5, 0, 0, 2, 0, 1.78] },
    msi_d3: { bpm: 108, vol: 0.08, wave: 'sawtooth', arpLp: 1800, drums: 'rockLt', swing: 0.05,                                  // 개러지 락 워밍업
              bass: [1, 0, 1, 0, 1, 0, 1.5, 0], bassWave: 'sawtooth', bassLp: 650, stab: [0, 4], stabVol: 0.45,
              chords: [[164.81, 'm'], [146.83, 'M'], [130.81, 'M'], [146.83, 'M']], arp: [1, 0, 1.5, 0, 1.19, 0, 1.5, 0] },
    /* 경기 */
    msi_m1: { bpm: 138, vol: 0.085, wave: 'sawtooth', arpLp: 1500, drums: 'rock',                                              // 락 라이엇
              bass: [1, 0, 1, 0, 1, 1, 0, 1], bassWave: 'sawtooth', bassLp: 800, stab: [0, 3, 6], stabVol: 0.5, lead: [[2, 0, 2.38, 0, 3, 2.67, 2, 0], [3, 0, 2.67, 0, 2.38, 0, 2, 0], [2, 2.38, 3, 0, 3.56, 0, 3, 2.67], [2.38, 0, 2, 0, 1.78, 0, 2, 0]],
              leadWave: 'sawtooth', leadLp: 2600, leadVol: 0.7,
              chords: [[164.81, 'm'], [146.83, 'M'], [130.81, 'M'], [146.83, 'M']], arp: [0, 0, 0, 0, 0, 0, 0, 0] },
    msi_m2: { bpm: 94, vol: 0.09, wave: 'triangle', swing: 0.18, drums: 'hip', echo: 1,                                        // 힙합 스트럿
              pad: 1, padWave: 'triangle', padLp: 900, padAtt: 0.3, padVol: 0.45, bass: [1, 0, 0, 1, 0, 0, 1, 0], bassWave: 'sine', bassLen: 1.6,
              lead: [[2, 0, 0, 2.38, 0, 3, 0, 2], [2.67, 0, 2.38, 0, 2, 0, 0, 0], [2, 0, 2.38, 0, 3, 0, 3.56, 0], [3, 0, 2.67, 0, 2.38, 0, 2, 0]], leadWave: 'square', leadLp: 2200, leadLen: 0.9,
              chords: [[220, 'm'], [196, 'M'], [174.61, 'M'], [164.81, 'M']], arp: [0, 0, 0, 0, 0, 0, 0, 0] },
    msi_m3: { bpm: 122, vol: 0.085, wave: 'square', arpLp: 2400, drums: 'funk', swing: 0.1,                                     // 자유분방 펑크 잼
              bass: [1, 0, 1, 1, 0, 1, 0, 1.5], bassWave: 'sawtooth', bassLp: 900, stab: [1, 3, 5, 7], stabWave: 'square', stabVol: 0.32, stabLen: 0.5, stabLp: 1700,
              lead: [[2, 2.38, 0, 2.67, 3, 0, 2.38, 0], [3, 0, 3.56, 3, 0, 2.67, 0, 2], [2.67, 0, 3, 0, 2.38, 2, 0, 0], [2, 0, 2.38, 2.67, 0, 3, 3.56, 0]], leadWave: 'square', leadLp: 3000,
              chords: [[146.83, 'm'], [196, 'M'], [130.81, 'M'], [220, 'm']], arp: [0, 0, 0, 0, 0, 0, 0, 0] }
  });

  /* ================= 월드 챔피언십: 웅장 · 비장 · 숨막힘 ================= */
  Object.assign(TRACKS, {
    /* 밴픽 */
    wld_d1: { bpm: 72, vol: 0.08, wave: 'sine', drums: 'toll', bell: [0, 4],                                                     // 개막식
              pad: 1, padWave: 'sawtooth', padLp: 800, padAtt: 0.8, padVol: 0.55, padOct: 1, bassWave: 'triangle', riser: 1,
              chords: [[146.83, 'm'], [116.54, 'M'], [174.61, 'M'], [130.81, 'M']], arp: [2, 0, 0, 0, 3, 0, 2.5, 0] },
    wld_d2: { bpm: 66, vol: 0.08, wave: 'sawtooth', arpLp: 1100, drums: 'timp', echo: 1, bell: [0],                                // 챔피언의 전당
              pad: 1, padWave: 'sawtooth', padLp: 650, padAtt: 1.0, padVol: 0.5, padOct: 1, bassWave: 'triangle',
              chords: [[130.81, 'm'], [103.83, 'M'], [116.54, 'M'], [98, 'm']], arp: [0, 0, 0, 0, 3, 0, 0, 0] },
    wld_d3: { bpm: 60, vol: 0.075, wave: 'sine', drums: 'heart', bell: [0],                                                      // 고요한 경기장
              pad: 1, padWave: 'sawtooth', padLp: 420, padAtt: 1.4, padVol: 0.5, padOct: 1, bassWave: 'triangle', riser: 1,
              chords: [[110, 'sus'], [116.54, 'm'], [103.83, 'dim'], [110, 'm']], arp: [0, 0, 0, 0, 0, 0, 0, 0] },
    /* 경기 */
    wld_m1: { bpm: 98, vol: 0.085, wave: 'sawtooth', arpLp: 1300, drums: 'war', dbl: 1, arpLen: 1,                              // 타이탄의 찬가
              pad: 1, padWave: 'sawtooth', padLp: 1000, padAtt: 0.25, padVol: 0.65, padOct: 1, bassWave: 'sawtooth', bassLp: 500, riser: 1,
              lead: [[3, 0, 0, 2.5, 3, 0, 4, 0], [3.56, 0, 3, 0, 2.5, 0, 2, 0], [3, 0, 4, 0, 4.5, 0, 4, 3.56], [3, 0, 0, 0, 2.5, 0, 3, 0]], leadWave: 'sawtooth', leadLp: 1800, leadLen: 2, leadVol: 0.8,
              chords: [[146.83, 'm'], [116.54, 'M'], [174.61, 'M'], [130.81, 'M']], arp: [1, 1, 1.5, 1, 1, 1.19, 1.5, 1.19] },
    wld_m2: { bpm: 132, vol: 0.085, wave: 'sawtooth', arpLp: 1500, drums: 'war', dbl: 1, arpLen: 0.9,                             // 파이널 아워
              pad: 1, padWave: 'sawtooth', padLp: 900, padAtt: 0.15, padOct: 1, bassWave: 'sawtooth', bassLp: 450, riser: 1,
              chords: [[220, 'm'], [174.61, 'M'], [130.81, 'M'], [164.81, 'M']], arp: [[1, 1, 1.5, 1, 1.19, 1, 1.5, 2], [1, 1, 1.5, 1, 1.6, 1, 1.5, 1.19]] },
    wld_m3: { bpm: 70, vol: 0.08, wave: 'sawtooth', arpLp: 900, drums: 'heart', echo: 1, bell: [0, 4],                             // 숨막히는 압박
              pad: 1, padWave: 'sawtooth', padLp: 380, padAtt: 1.0, padVol: 0.7, padOct: 1, bassWave: 'sawtooth', bassLp: 300, riser: 1,
              chords: [[130.81, 'dim'], [138.59, 'm'], [123.47, 'dim'], [130.81, 'm']], arp: [1, 0, 1.06, 0, 1, 0, 1.19, 0] }
  });
  /* ================= MSI 전용: 트랩 힙합 '스트리트 앤섬' (젊음 · 트렌디 · 자신감) =================
     808 베이스 + 3연타 하이햇 + 반복되는 종소리 훅. 인트로 → 벌스 → 훅 → 브레이크(드럼 빠지고 상승 후 정적) → 다시 훅으로 */
  TRACKS.msi_m4 = { bpm: 140, vol: 0.088, wave: 'square', arpLp: 2100, arpLen: 0.55, drums: 'trap', swing: 0.06,
    pad: 1, padWave: 'triangle', padLp: 1400, padAtt: 0.2, padVol: 0.4, padOct: 0.5, riser: 1,
    bass: [1, 0, 0, 1, 0, 0, 1, 0], bassWave: 'triangle', bassLp: 380, bassLen: 1.6,
    arp: [[2, 0, 1.5, 0, 1.19, 0, 1.5, 2], [2, 0, 1.5, 0, 1.26, 0, 1.5, 2], [2, 0, 1.5, 0, 1.26, 0, 1.5, 2], [2, 0, 1.5, 0, 1.26, 0, 1.5, 2]],
    lead: [[1.5, 0, 1.5, 1.19, 0, 1, 0, 1.19], [1.5, 0, 1.5, 1.26, 0, 1, 0, 1.26], [2, 0, 2, 1.5, 0, 1.26, 0, 1.5], [1.5, 0, 1.5, 1.26, 0, 1, 0, 1.5]],
    leadWave: 'triangle', leadLp: 2600, leadLen: 0.8, leadVol: 0.75, leadAtt: 0.005, leadUni: 7,
    stab: [0, 6], stabWave: 'square', stabVol: 0.3, stabLp: 1500, stabLen: 0.5,
    chords: [[220, 'm'], [174.61, 'M'], [130.81, 'M'], [196, 'M']],
    form: [
      { name: '인트로', bars: 4, on: ['pad', 'arp', 'hat'] },
      { name: '벌스',   bars: 8, on: ['pad', 'bass', 'kick', 'snare', 'hat', 'arp'] },
      { name: '훅',     bars: 8, on: ['pad', 'bass', 'kick', 'snare', 'hat', 'arp', 'lead', 'stab'], boom: 1, crash: 4 },
      { name: '브레이크', bars: 4, on: ['pad', 'arp', 'lead', 'hat'], riser: 1, gap: 1 },
      { name: '훅',     bars: 8, on: ['pad', 'bass', 'kick', 'snare', 'hat', 'arp', 'lead', 'stab'], boom: 1, crash: 4 }
    ] };

  /* ================= 월드 챔피언십 전용: '레퀴엠 오브 타이탄' (웅장 · 비장 · 치열 · 긴장) =================
     현악 오스티나토와 팀파니가 점점 몰아치다 대폭발. 개전 → 진군 → 격돌 → 절규(고조·정적) → 대폭발 → 정적 */
  TRACKS.wld_m4 = { bpm: 108, vol: 0.088, wave: 'sawtooth', arpLp: 1700, arpLen: 0.75, dbl: 1, arpVib: 8, drums: 'legion',
    pad: 1, padWave: 'sawtooth', padLp: 1100, padAtt: 0.8, padVol: 0.55, padOct: 1, padVib: 6, riser: 1,
    bass: [1, 0, 1, 1, 0, 1, 1, 0], bassWave: 'sawtooth', bassLp: 460, bassLen: 0.85, bell: [0, 4],
    arp: [[2, 3, 2.38, 3, 2, 3, 2.38, 3], [2, 3, 2.52, 3, 2, 3, 2.52, 3], [2, 3, 2.38, 3, 2, 3, 2.38, 3], [2, 3, 2.52, 3, 2, 3, 2.52, 3]],
    lead: [[3, 0, 0, 2.38, 2.67, 0, 3, 0], [2, 0, 1.5, 0, 1.26, 0, 1.5, 0], [2, 0, 1.78, 0, 1.5, 0, 1.19, 0], [1.5, 0, 1.78, 0, 2, 0, 1.26, 0]],
    leadWave: 'sawtooth', leadLp: 2500, leadLen: 2.4, leadVol: 0.85, leadAtt: 0.04, leadVib: 12, leadUni: 10,
    stab: [0, 3], stabWave: 'sawtooth', stabVol: 0.45, stabLp: 1600, stabLen: 0.8,
    chords: [[130.81, 'm'], [207.65, 'M'], [174.61, 'm'], [196, 'M']],
    form: [
      { name: '개전', bars: 4, on: ['pad', 'bell', 'tom'] },
      { name: '진군', bars: 4, on: ['pad', 'bass', 'tom', 'kick', 'arp'] },
      { name: '격돌', bars: 8, on: ['pad', 'bass', 'tom', 'kick', 'snare', 'arp', 'stab', 'lead'], crash: 4 },
      { name: '절규', bars: 4, on: ['pad', 'bass', 'tom', 'kick', 'snare', 'arp', 'stab'], riser: 1, fill: 1, gap: 1 },
      { name: '대폭발', bars: 8, on: ['pad', 'bell', 'bass', 'tom', 'kick', 'snare', 'arp', 'stab', 'lead'], boom: 1, crash: 2 },
      { name: '정적', bars: 4, on: ['pad', 'bell', 'tom'] }
    ] };

  const GROUPS = { lobby: ['lobby', 'cosmos', 'neon', 'grand'], battle: ['rush', 'epic', 'odyssey', 'mystic', 'pursuit', 'crescendo'],
    draft_msi: ['msi_d1', 'msi_d2', 'msi_d3'], match_msi: ['msi_m1', 'msi_m2', 'msi_m3', 'msi_m4'],
    draft_wld: ['wld_d1', 'wld_d2', 'wld_d3'], match_wld: ['wld_m1', 'wld_m2', 'wld_m3', 'wld_m4'] };   // Sound.bgm('draft') / ('battle') = 대회에 맞는 그룹 중 랜덤

  let bgmName = null, bgmTimer = 0, bgmNext = 0, bgmStep = 0, bgmGain = null;
  let wantReq = null, wantBgm = null, bgmPlaying = null; const lastPick = {};

  /* o.lp 로우패스 / o.att 어택 / o.vib 비브라토 깊이(센트, 현악) / o.uni 유니즌 디튠(센트, 슈퍼소 느낌) / o.dest 연결할 노드(펌핑용) */
  function bgmNote(f, t, d, v, w, o) {
    o = o || {};
    const g = ac.createGain(), att = o.att || 0.02, oscs = [];
    const mk = det => { const x = ac.createOscillator(); x.type = w; x.frequency.value = f; if (det) x.detune.value = det; oscs.push(x); return x; };
    const voices = o.uni ? [mk(-o.uni), mk(0), mk(o.uni)] : [mk(0)];
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v / (o.uni ? 2 : 1)), t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    let fl = null;
    if (o.lp) { fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; fl.connect(g); }
    voices.forEach(x => x.connect(fl || g));
    if (o.vib) {                                                    // 느린 어택 뒤 서서히 커지는 비브라토
      const lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(o.vib, t + Math.min(d * 0.6, 0.5));
      lfo.connect(lg); voices.forEach(x => lg.connect(x.detune)); lfo.start(t); lfo.stop(t + d + 0.05);
    }
    g.connect(o.dest || bgmGain); oscs.forEach(x => { x.start(t); x.stop(t + d + 0.05); });
  }
  /* 사이드체인 느낌: 박마다 볼륨이 쑥 내려갔다 올라오는 버스 (T.pump 트랙의 패드에 사용) */
  function duckBus(t, e) {
    const g = ac.createGain(), beat = e * 2; g.connect(bgmGain);
    for (let k = 0; k < 4; k++) { g.gain.setValueAtTime(0.2, t + k * beat); g.gain.linearRampToValueAtTime(1, t + k * beat + beat * 0.85); }
    return g;
  }
  function bgmDrum(kind, t, v) {
    const g = ac.createGain(); g.connect(bgmGain);
    if (kind === 'kick') {
      const o = ac.createOscillator();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(v * 2.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g); o.start(t); o.stop(t + 0.16);
    } else if (kind === 'tom') {                                    // 낮은 톰 / 팀파니
      const o = ac.createOscillator();
      o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(58, t + 0.35);
      g.gain.setValueAtTime(v * 2.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      o.connect(g); o.start(t); o.stop(t + 0.6);
    } else {
      const s = ac.createBufferSource(), f = ac.createBiquadFilter();
      const P = { snare: [0.12, 'highpass', 1500, 1.3], hat: [0.04, 'highpass', 6000, 0.6], ohat: [0.2, 'highpass', 6500, 0.55], clap: [0.09, 'bandpass', 1400, 1.2], crash: [1.3, 'highpass', 3500, 0.7] }[kind] || [0.04, 'highpass', 6000, 0.6];
      s.buffer = noiseBuf; f.type = P[1]; f.frequency.value = P[2];
      g.gain.setValueAtTime(v * P[3], t); g.gain.exponentialRampToValueAtTime(0.0001, t + P[0]);
      s.connect(f); f.connect(g); s.start(t); s.stop(t + P[0] + 0.02);
    }
  }
  function bgmRiser(t, dur, v) {                                    // 긴장감 상승 노이즈
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(5000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 1.4, t + dur * 0.95); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bgmGain); s.start(t); s.stop(t + dur + 0.05);
  }
  /* 구간 편곡: 몇 번째 마디인지로 지금 구간·구간 안 위치를 찾습니다 */
  function formAt(T, bar) {
    let b = bar % T.form.reduce((a, x) => a + x.bars, 0);
    for (const x of T.form) { if (b < x.bars) return { s: x, sb: b, last: b === x.bars - 1 }; b -= x.bars; }
    return { s: T.form[0], sb: 0, last: false };
  }
  function bgmSchedule() {
    const T = TRACKS[bgmName]; if (!T || !ac) return;
    const e = 60 / T.bpm / 2, D = DRUMS[T.drums], pick = (p, bar) => (Array.isArray(p[0]) ? p[bar % p.length] : p);
    while (bgmNext < ac.currentTime + 0.3) {
      const bar = Math.floor(bgmStep / 8), i = bgmStep % 8, ch = T.chords[bar % T.chords.length], root = ch[0];
      const t = bgmNext + (T.swing && i % 2 ? T.swing * e : 0);
      const F = T.form ? formAt(T, bar) : null, on = n => !F || F.s.on.includes(n);          // 구간 편곡: 지금 켜진 레이어만 연주
      if (F && F.s.gap && F.last && i >= 6) { bgmNext += e; bgmStep++; continue; }          // 폭발 직전 정적
      if (F && i === 0) {
        if (F.s.boom && F.sb === 0) {                                                        // 폭발: 심벌 + 킥 + 팀파니 + 서브 베이스 + 풀 화음
          bgmDrum('crash', t, T.vol * 1.3); bgmDrum('kick', t, T.vol * 1.2); bgmDrum('tom', t, T.vol * 1.2);
          bgmNote(root * 0.5, t, e * 6, T.vol * 2.2, 'sine');
          [1, 1.5, 2, 3].forEach(m => bgmNote(root * m, t, e * 5, T.vol * 0.7, 'sawtooth', { lp: 2200, att: 0.005, uni: 12 }));
        } else if (F.s.crash && F.sb > 0 && F.sb % F.s.crash === 0) bgmDrum('crash', t, T.vol);
        if (F.s.riser && F.sb === F.s.bars - 2) bgmRiser(t, e * 16, T.vol);                  // 끝 2마디 동안 노이즈 상승
      }
      if (F && F.s.fill && F.last && (i === 4 || i === 5)) for (let q = 0; q < 4; q++) bgmDrum('snare', t + q * e / 4, T.vol * (0.5 + (i - 4) * 0.35 + q * 0.12));   // 스네어 롤
      const r = on('arp') ? pick(T.arp, bar)[i] : 0;
      if (r) {
        bgmNote(root * r, t, e * (T.arpLen || 1.6), T.vol, T.wave, { lp: T.arpLp, vib: T.arpVib, uni: T.arpUni });
        if (T.dbl || (F && F.s.dbl)) bgmNote(root * r, t + e / 2, e * 0.8, T.vol * 0.8, T.wave, { lp: T.arpLp, vib: T.arpVib, uni: T.arpUni });         // 16분 겹치기(현악 오스티나토)
        if (T.echo) bgmNote(root * r, t + e * 1.5, e * 1.6, T.vol * 0.35, T.wave, { lp: T.arpLp });
      }
      if (T.lead && on('lead')) {                                                                                      // 리드 멜로디(마디마다 다른 패턴)
        const lr = pick(T.lead, bar)[i];
        if (lr) bgmNote(root * lr * (T.leadOct || 2), t, e * (T.leadLen || 1.2), T.vol * (T.leadVol || 0.9), T.leadWave || 'square', { lp: T.leadLp || 3200, att: T.leadAtt || 0.01, vib: T.leadVib, uni: T.leadUni });
      }
      if (i === 0 && T.pad && on('pad')) { const dest = T.pump ? duckBus(t, e) : null; QUAL[ch[1] || 'M'].forEach(m => bgmNote(root * m * (T.padOct || 0.5), t, e * 8, T.vol * (T.padVol || 0.6), T.padWave || 'sine', { lp: T.padLp, att: T.padAtt, vib: T.padVib, dest })); }
      if (!on('bass')) { /* 베이스 꺼짐 */ }
      else if (T.bass) { const b = T.bass[i]; if (b) bgmNote(root * 0.5 * b, t, e * (T.bassLen || 0.9), T.vol * 1.5, T.bassWave || 'sawtooth', { lp: T.bassLp || 600 }); }
      else if (i === 0) bgmNote(root * 0.5, t, e * 3, T.vol * 1.4, T.bassWave || 'sine');
      if (T.stab && T.stab.includes(i) && on('stab')) [1, 1.5, 2].forEach(m => bgmNote(root * m, t, e * (T.stabLen || 0.9), T.vol * (T.stabVol || 0.55), T.stabWave || 'sawtooth', { lp: T.stabLp || 1900, att: 0.005 }));   // 파워코드 스탭
      if (T.bell && T.bell.includes(i) && on('bell')) {
        const bf = root * (i < 4 ? 4 : 6);
        bgmNote(bf, t, 2.2, T.vol * 0.7, 'sine', { att: 0.005 });
        bgmNote(bf * 2.76, t, 1.2, T.vol * 0.2, 'sine', { att: 0.005 });
      }
      if (D) {
        on('kick') && (D.k || []).includes(i) && bgmDrum('kick', t, T.vol);
        on('tom') && (D.tom || []).includes(i) && bgmDrum('tom', t, T.vol);
        on('snare') && (D.s || []).includes(i) && bgmDrum('snare', t, T.vol);
        on('snare') && (D.clap || []).includes(i) && bgmDrum('clap', t, T.vol);
        on('hat') && (D.h || []).includes(i) && bgmDrum('hat', t, T.vol);
        on('hat') && (D.hroll || []).includes(i) && [0, 1, 2].forEach(q => bgmDrum('hat', t + q * e / 3, T.vol * (q ? 0.7 : 1)));   // 3연타 하이햇 롤
        on('hat') && (D.ohat || []).includes(i) && bgmDrum('ohat', t, T.vol);
        if (on('snare') && (D.roll || []).includes(i)) for (let q = 0; q < 4; q++) bgmDrum('snare', t + q * e / 4, T.vol * (0.5 + q * 0.12));
        if (D.crash && i === 0 && bar % D.crash === 0 && on('crash')) bgmDrum('crash', t, T.vol);
        if (D.run && i % 2 === 0 && on('kick')) bgmNote(root * 0.5, t, e * 0.9, T.vol * 1.2, 'sawtooth');
      }
      if (!T.form && T.riser && bar % 4 === 3 && i === 0) bgmRiser(t, e * 8, T.vol);
      bgmNext += e; bgmStep++;
    }
  }

  /* Sound.bgm('lobby') / Sound.bgm('battle')(랜덤) / Sound.bgm(null)(정지) */
  function pickTrack(req) {
    const g = GROUPS[req]; if (!g) return req;
    const pool = g.filter(n => n !== lastPick[req]);                 // 직전 곡은 제외하고 랜덤
    return (lastPick[req] = pool[Math.floor(Math.random() * pool.length)]);
  }
  /* 대회 구분: MSI 기간 = 힙/락, 월드 챔피언십 = 웅장. 그 외(정규시즌 등)는 밴픽=MSI풍 / 경기=기존 곡 */
  function tier() {
    try { const p = typeof Game !== 'undefined' && Game.G && Game.G.phase, k = typeof Game !== 'undefined' && Game.match && Game.match.kind; return p === 'worlds' || k === 'worlds' ? 'wld' : p === 'msi' || k === 'msi' ? 'msi' : null; } catch (e) { return null; }
  }
  const draftOn = () => { try { return typeof Game !== 'undefined' && Game.draft && !Game.draft.done; } catch (e) { return false; } };
  function resolve(req) {
    if (req === 'lobby' && draftOn()) req = 'draft';                  // 밴픽 화면이 열려 있으면 로비 요청도 밴픽 곡으로
    if (req === 'draft') return 'draft_' + (tier() || 'msi');
    if (req === 'battle' && tier()) return 'match_' + tier();
    return req;
  }
  function bgm(req) {
    req = req && resolve(req);
    if (req === wantReq) return;                                     // 같은 요청이면 재시작 안 함
    wantReq = req;
    if (!req) {
      wantBgm = bgmPlaying = bgmName = null; clearInterval(bgmTimer);
      if (bgmGain && ac) bgmGain.gain.setTargetAtTime(0, ac.currentTime, 0.15);
      return;
    }
    wantBgm = pickTrack(req); startBgm();
  }
  function startBgm() {
    if (!wantBgm || !ac || ac.state !== 'running') return;           // 첫 클릭 전에는 대기
    if (bgmPlaying === wantBgm) return;
    if (!bgmGain) { bgmGain = ac.createGain(); bgmGain.connect(master); }
    bgmGain.gain.setTargetAtTime(1, ac.currentTime, 0.3);
    bgmPlaying = bgmName = wantBgm; bgmNext = ac.currentTime + 0.1; bgmStep = 0;
    clearInterval(bgmTimer); bgmTimer = setInterval(bgmSchedule, 100);
  }

  return { init, play, fromEvent, result, gacha, unlock, bgm, SOUNDS };
})();
