/* fighters.js — 고정 파이터 14명 (스탯 / 패시브 / 스킬 2 / 궁극기 1)
   스킬 구조: { id, name, cost(마나), cd(초), range, move(이동기 여부), sfx(효과음 종류), desc, plan(b,u,적,아군,strict) → 계획|null, cast(b,u,계획) }
   수치 조절은 각 cast 안의 b.raw(u, 기본, 공격력계수, 주문력계수) 값을 고치면 됩니다. */

(() => {
  const FD = CONFIG.fighters;
  const sq = x => x * x;

  /* ---------- 계획(plan) 도우미 ---------- */
  const { foeIn, anyIn, clusterPick, hit, beam, lineEnd, cone, ring, dashTo } = FKit;
  
  /* ================= 1. 데스카이저 ================= */
  FD.deathkaiser = {
    id: 'deathkaiser', name: '데스카이저', role: 'warrior', color: '#8b5cf6', title: '어둠안개의 흡혈 버서커',
    concept: '"지옥의 압도적인 힘에 무릎을 꿇어라"',
    stats: { hp: 900, mp: 220, aspd: 0.85, spd: 8.2, atk: 52, ap: 0, def: 36, res: 28, ten: 0.10, pen: 0.10, ls: 0.08, range: 6 },
    basic: { type: 'phys', atk: 1, ap: 0, proj: 'melee' }, ai: { front: true, threat: 1.2, style: { ult: 'open' } },
    tac: { act: ['rush', 'basic'], fight: ['solo', 'coop'], pos: ['front'] },
        look: { res: 2,
      pal: { D: '#0e0716', K: '#1b1030', M: '#2e1a4f', N: '#4a2a7a', T: '#8b5cf6', e: '#ff3b6b', h: '#d6c8ee', S: '#cbbfe0', Y: '#ffd166',
            w: '#f5e1ff', v: '#c084fc', V: '#a855f7', u: '#6d28d9', g: '#a78bfa' },
      rows: [
        '....h..............h............',
        '....hh....DDDD....hh..........w.',
        '.....hDDKKKKKKKKDDh.........wwD.',
        '......DKMMMNNMMMKD.........wwVD.',
        '......DKMMNTTNMMKD........wvTuD.',
        '......DKMDDDDDDMKD.......wvVVuD.',
        '......DKDeeDDeeDKD.......wvTuD..',
        '......DKMDDDDDDMKD......wvVTDD..',
        '......DKMMDSSDMMKD.....wvvVuD...',
        '.......DKKNMMNKKD......wvTuD....',
        '....hDDDDKKTTKKDDDDh..wvvVuD....',
        '...DNNNTDKMMMMKDTNNNDwwvVuD.....',
        '..DKNDDDDKMNNMKDNTTDDwvVuuD.....',
        '.....DMMDKMNTMKDM..DwwvVuD......',
        '.....DMMDMMNTTNMM..DwvTuD.......',
        '.....DMMDDNNTTNNM..wvvuuD.......',
        '.....DMMMDMNNNNhK.wwvVuD........',
        '.....DDMMDMMMMMggKwvVuuD........',
        '......DMMDDMTTMKDgKKKuDD........',
        '......DMMMDDKKKKD.geKKDD........',
        '......DDMMMDDKKYKTNTggKK........',
        '.......DDMMMDDDKDNTNMgg.K.......',
        '........DDMMMMDD.TNTDD.gh.......',
        '.........DDMMMMDKMK.............',
        '....DDDD..DDMMTNTKDDDD..........',
        '......DKMMNDDMNTNK..............',
        '......DKMNNDDDTNTD..............',
        '......DKTNNDDNMKKD..............',
        '......DKMNNDDNgMKD..............',
        '......DNKMMDDMMKND..............',
        '......DKMNNDDNNMKD..............',
        '.....DKKMNNDDNNMKKD.............',
        '....DKNKKMMDDMMKKNKD............',
        '...DKKKKKKKDDKKKKKKKD...........',
        '...DDDDDDDDDDDDDDDDDD...........'],
      weapon: '' },
    passive: { name: '마검', desc: '자신이 만든 어둠안개 위에 서 있으면 안개를 흡수해 체력을 회복합니다. 흡수한 안개는 더 빨리 사라집니다.',
      seek(b, u) { if (u.hp >= u.maxHp * 0.95) return null; let m = null, md = 1e9; for (const z of b.zones) if (z.kind === 'fog' && z.owner === u && z.until > b.t) { const d = Math.hypot(u.x - z.x, u.y - z.y); if (d < md) { md = d; m = z; } } return m && md > m.r * 0.5 && md <= 16 ? { x: m.x, y: m.y, w: 0.6 } : null; },
      tick(b, u) {
        if (b.t % 10) return;
        for (const z of b.zones) if (z.kind === 'fog' && z.owner === u && Math.hypot(u.x - z.x, u.y - z.y) <= z.r) {
          if (b.heal(u, u, 24 + 0.32 * b.eff(u, 'atk'), '마검 흡수') > 0) z.until -= 4;
          break;
        }
      } },
    skills: [
      { id: 'dk_s1', name: '흉살풍', cost: 40, cd: 6, range: 10, sfx: 'aoe', desc: '전방 범위에 피해를 주고 둔화시킵니다. 어둠안개를 생성합니다.',
        plan: foeIn(10),
        cast(b, u, pl) {
          const t = pl.t, d = b.dir(u, t); cone(b, u, t, 13, 1.05, '#8b5cf6');
          b.inCone(b.foes(u), u, t.x, t.y, 13, 1.05).forEach(e => { hit(b, u, e, 'phys', b.raw(u, 30, 0.95), '흉살풍', { splash: true }); b.cc(u, e, 'slow', 1.8, { amt: 0.35 }); });
          const c = b.clampPos(u.x + d.x * 8, u.y + d.y * 8); b.zone({ x: c.x, y: c.y, r: 8, dur: 5, owner: u, kind: 'fog', color: '#7c3aed' });
        } },
      { id: 'dk_s2', tags: ['gapclose', 'zone'], name: '다크다이브', cost: 50, cd: 11, range: 40, move: true, sfx: 'dash', desc: '적절한 위치로 순간이동한 뒤 주변에 피해를 주고 어둠안개를 생성합니다.',
        plan: (b, u, en) => { const p = clusterPick(b, u, en, 40, 9); return p && b.dist(u, p.t) > 10 ? p : null; },
        cast(b, u, pl) {
          const t = pl.t, away = u.team === 0 ? -1 : 1; b.blink(u, t.x + away * 3.5, t.y);
          ring(b, u.x, u.y, 9, '#8b5cf6');
          b.inCircle(b.foes(u), u.x, u.y, 9).forEach(e => hit(b, u, e, 'phys', b.raw(u, 30, 0.75), '다크다이브', { splash: true }));
          b.zone({ x: u.x, y: u.y, r: 9, dur: 5, owner: u, kind: 'fog', color: '#7c3aed' });
        } }
    ],
    ult: { id: 'dk_ult', name: '참수', cd: 34, range: 11, sfx: 'nuke', desc: '전방의 단일 적에게 고정 피해를 주고, 주변의 적들을 공포 상태로 만듭니다.',
      plan: foeIn(11),
      cast(b, u, pl) {
        const t = pl.t; ring(b, t.x, t.y, 14, '#c4b5fd');
        hit(b, u, t, 'true', b.raw(u, 170, 0.95), '참수');
        b.inCircle(b.foes(u), t.x, t.y, 14).filter(e => e !== t).forEach(e => b.cc(u, e, 'fear', 1.7));
      } }
  };

  /* ================= 2. 에일리언 ================= */
  const alienEvolve = (b, u) => {
    if (u.form === 'super') return;
    b.setForm(u, 'super'); u.mem.en = 0; u.mem.endT = b.t + b.sec(14); b.setUlt(u, 100); u.maxHp += 300; u.hp += 300;
    b.buff(u, 'super', 14, { name: '슈퍼 에일리언', mul: { atk: 1.3, ap: 1.1, def: 1.3, res: 1.3, spd: 1.1 },
      f: { onEnd(bb, uu) { bb.setForm(uu, 'normal'); uu.maxHp -= 300; uu.hp = Math.min(uu.hp, uu.maxHp); bb.setUlt(uu, 0); uu.mem.en = 0; } } });
    b.emit({ type: 'skill', slot: 'ult', src: u, name: '코스믹 진화', kind: 'buff', color: '#f472b6' });
  };
  FD.alien = {
    id: 'alien', name: '에일리언', role: 'warrior', color: '#a3e635', title: '우주 진화체',
    concept: '"인간의 유전자는 참으로 비효율적이군."',
    stats: { hp: 780, mp: 260, aspd: 0.9, spd: 7.6, atk: 48, ap: 48, def: 26, res: 26, ten: 0, pen: 0.08, ls: 0, range: 26 },
    basic: { type: 'magic', atk: 0.5, ap: 0.55, proj: 'bolt' }, ai: { backline: true, kite: 14, threat: 0.95, style: { ult: 'open' } },
    tac: { act: ['basic', 'retreat'], fight: ['coop'], pos: ['none', 'cover'] },
    form0: 'normal',
  look: {
  hair: '#e2e8f0', skin: '#e2e8f0', body: '#cbd5e1', acc: '#a3e635', res: 2,
  pal: {
    T: '#e2e8f0', D: '#94a3b8', E: '#0b0f1f',          // 회백색 피부 / 피부 그림자 / 눈
    G: '#a3e635', U: '#ecfccb',                        // 라임 에너지 / 에너지 중심광
    A: '#f8fafc', B: '#cbd5e1', C: '#64748b'           // 갑옷 흰색 / 회색 / 어두운 회색
  },
  rows: [
    '..............TTTT..............',
    '.............TTTTTT.............',
    '............TTTTTTTT............',
    '...........TTTTTTTTTT...........',
    '..........TTTTTTTTTTTT..........',
    '..........TEEETTTTEEET..........',
    '..........TEEGETTEGEET..........',
    '..........TTEEETTEEETT..........',
    '...........TTTTTTTTTT...........',
    '............DTTTTTTD............',
    '..............DTTD..............',
    '............CBBBBBBC............',
    '.......CBBBBAAAAAAAABBBBC.......',
    '......CBBBBBAAAAAAAABBBBBC.GG...',
    '......CBBBBCAAGGGGAACBBBBCGUUG..',
    '......DTD.CBAAGGGGAABC.DTDGUUG..',
    '......DTD.CBAGGAAGGABC.DTD.GG...',
    '......TD..CBBAAAAAABBC..DTTT....',
    '......TTT.CCKGGCCGGKCC.TTT......',
    '..........CBBBAAAABBBC..........',
    '.........CAAAAB..BAAAAC.........',
    '.........CAAAAB..BAAAAC.........',
    '.........CBBGBB..BBGBBC.........',
    '.........CBAAAC..CAAABC.........',
    '.........CBAAAC..CAAABC.........',
    '.........CBAAAC..CAAABC.........',
    '.........CBAAAC..CAAABC.........',
    '.........CBAAAC..CAAABC.........',
    '.........CBAAAC..CAAABC.........',
    '.........CBBBBB..BBBBBC.........',
    '........XXCCCCC..CCCCCXX........',
    '.......XXXXKKKK..KKKKXXXX.......'
  ]
},
looks: {
  super: {
    hair: '#be185d', skin: '#fce7f3', body: '#9d174d', acc: '#f472b6', res: 2,
    pal: {
      T: '#fce7f3', D: '#f9a8d4', E: '#2a0a1e',        // 연분홍 피부 / 그림자 / 눈
      Y: '#fde047', P: '#f472b6',                      // 금빛 뿔·코어 / 분홍 하이라이트
      A: '#be185d', B: '#9d174d', C: '#500724',        // 갑옷 주색 / 어두운색 / 가장 어두운색
      G: '#fde047'                                     // 가슴 코어
    },
    rows: [
      '.......YY......YY......YY.......',
      '........YY....YYYY....YY........',
      '.........YY..PYYYYP..YY.........',
      '.........ACBAAPYYPAABCA.........',
      '.........CATTTTTTTTTTAC.........',
      '.........CATEETTTTEETAC.........',
      '.........CAEEYETTEYEEAC.........',
      '.........CATEEETTEEETAC.........',
      '.........BATTTTDDTTTTAB.........',
      '.........CBAATDDDDTAABC.........',
      '....Y.....CBBAADDAABBC.....Y....',
      '....YY....BBCCCCCCCCBB....YY....',
      '..CBAAAAAAAABBCCCCBBAAAAAAAABC..',
      '.CBAAPPAAAAAAABBBBAAAAAAAPPAABC.',
      '.CBAPYPAAAAABBCCCCBBAAAAAPYPABC.',
      '.CBAAPAAAABBAGGGGGGABBAAAAPAABC.',
      '..CBAAATD.CBAAGGGGAABC.DTAAABC..',
      '..CBAAATD.CBPAGGGGAPBC.DTAAABC..',
      '..CBBBATD.CBAAAGGAAABC.DTABBBC..',
      '..CAPPAAC.CBBAAAAAABBC.CAAPPAC..',
      '..CAAAAAC.CCBBAAAABBCC.CAAAAAC..',
      '..CAPPAAC.CKCCGGGGCCKC.CAAPPAC..',
      '..DTTTD.CBAAAPBAABPAAABC.DTTTD..',
      '..PTTTP.CBAAAAABBAAAAABC.PTTTP..',
      '...DTD.CBAAAPAB..BAPAAABC.DTD...',
      '.......CBAAAPAB..BAPAAABC.......',
      '.......CBAAAAAB..BAAAAABC.......',
      '......YYCBPPAAB..BAAPPBCYY......',
      '.......CBAAAAAB..BAAAAABC.......',
      '.......CBAAAPAB..BAPAAABC.......',
      '.......CBAAAAAB..BAAAAABC.......',
      '.......CBAAAAAB..BAAAAABC.......',
      '.......CBAAAAAB..BAAAAABC.......',
      '.....CCBBBBBBBB..BBBBBBBBCC.....',
      '....CCCBBBBBBBB..BBBBBBBBCCC....',
      '....KKKKKKKKKKK..KKKKKKKKKKK....'
    ]
  }
},
    passive: { name: '코스믹 진화', desc: '적에게 피해를 주면 에너지가 충전됩니다. 가득 차면 14초간 슈퍼 에일리언으로 변신하고 궁극기가 활성화됩니다.',
      init(b, u) { u.mem.en = 0; },
      onDealt(b, u, t, res) { if (u.form === 'super') return; u.mem.en = Math.min(100, u.mem.en + res.dealt * 0.14); if (u.mem.en >= 100) alienEvolve(b, u); },
      tick(b, u) { u.gauge = u.form === 'super' ? { label: '슈퍼', val: Math.max(0, u.mem.endT - b.t) / b.sec(14) * 100, max: 100, color: '#f472b6' } : { label: '에너지', val: u.mem.en, max: 100, color: '#a3e635' }; },
      onForm(b, u, form) {
        if (form === 'super') { u.role.range = 7; u.role.kite = 0; u.role.backline = false; u.role.front = true; u.scale = 1.3; u.glow = '#f472b6'; }
        else { u.role.range = 26; u.role.kite = 14; u.role.backline = true; u.role.front = false; u.scale = 1; u.glow = null; }
      } },
    forms: {
      normal: [
        { id: 'al_n1', tags: ['zone', 'peel'], name: '궤도폭격', cost: 45, cd: 9, range: 22, sfx: 'aoe', desc: '자신 주변에 위성을 생성해 7초간 회전시킵니다. 위성에 부딪힌 적이 피해를 입습니다.',
          plan: anyIn(22),
          cast(b, u) {
            b.zone({ x: u.x, y: u.y, r: 9, dur: 7, owner: u, follow: true, kind: 'orbit', color: '#a3e635', every: 0.05, ang: 0, sats: [], hitAt: {},
              onTick(z, bb) {
                z.ang += 0.2; z.sats = [0, 1, 2].map(i => ({ x: z.x + Math.cos(z.ang + i * 2.094) * 9, y: z.y + Math.sin(z.ang + i * 2.094) * 9 }));
                z.sats.forEach((s, i) => bb.foes(u).forEach(e => {
                  const k = e.id + '_' + i; if (Math.hypot(e.x - s.x, e.y - s.y) > 3.4 || (z.hitAt[k] || 0) > bb.t) return;
                  z.hitAt[k] = bb.t + bb.sec(0.9); hit(bb, u, e, 'magic', bb.raw(u, 22, 0, 0.45), '궤도폭격', { splash: true });
                }));
              } });
          } },
        { id: 'al_n2', name: '유성폭격', cost: 40, cd: 5, range: 34, sfx: 'nuke', desc: '에너지 포를 날려 직선상의 적에게 피해를 줍니다.',
          plan: foeIn(34),
          cast(b, u, pl) {
            const e = lineEnd(b, u, pl.t, 36); beam(b, u, e.x, e.y, 3.5, '#a3e635');
            b.inLine(b.foes(u), u.x, u.y, e.x, e.y, 3.5).forEach(x => hit(b, u, x, 'magic', b.raw(u, 50, 0, 0.95), '유성폭격', { path: true }));
          } }
      ],
      super: [
        { id: 'al_s1', name: '가중력장', cost: 50, cd: 10, range: 20, sfx: 'debuff', desc: '범위 안의 적이 이동 스킬을 쓰지 못하고 둔화됩니다. 자신은 이동속도가 크게 증가합니다.',
          plan: anyIn(20),
          cast(b, u) {
            b.buff(u, 'gravity_self', 4, { name: '가중력장', mul: { spd: 1.35 } });
            b.zone({ x: u.x, y: u.y, r: 16, dur: 4, owner: u, kind: 'gravity', color: '#c084fc', every: 0.25,
              onTick(z, bb) { bb.inCircle(bb.foes(u), z.x, z.y, z.r).forEach(e => { bb.cc(u, e, 'slow', 0.5, { amt: 0.45, quiet: true }); bb.buff(e, 'nodash', 0.5, { name: '이동기 봉인', good: false, f: { noDash: true }, quiet: true }); }); } });
          } },
        { id: 'al_s2', name: '하이퍼버스터', cost: 45, cd: 8, range: 24, move: true, sfx: 'pierce', desc: '짧은 거리를 돌진하며 경로의 적에게 피해를 주고 기절시킵니다.',
          plan: foeIn(24, 6),
          cast(b, u, pl) {
            const ox = u.x, oy = u.y, e = dashTo(b, u, pl.t, 16, 3); b.slide(u, e.x, e.y);
            b.inLine(b.foes(u), ox, oy, u.x, u.y, 4.5).forEach(x => { hit(b, u, x, 'phys', b.raw(u, 35, 0.9, 0.3), '하이퍼버스터', { path: true }); b.cc(u, x, 'stun', 1.0); });
          } }
      ]
    },
    ult: { id: 'al_ult', name: '초신성', cd: 30, range: 50, sfx: 'aoe', desc: '[슈퍼 상태 전용] 하늘에서 별을 떨어뜨려 넓은 범위에 피해를 줍니다. 중앙일수록 피해가 커집니다.',
      avail: (b, u) => u.form === 'super', availMsg: '슈퍼 에일리언 상태에서만 사용할 수 있습니다.',
      plan: (b, u, en) => clusterPick(b, u, en, 50, 18),
      cast(b, u, pl) {
        const c = { x: pl.t.x, y: pl.t.y };
        b.zone({ x: c.x, y: c.y, r: 18, dur: 1.4, owner: u, kind: 'warn', color: '#fde047' });
        b.later(1.4, bb => {
          ring(bb, c.x, c.y, 18, '#fde047'); bb.emit({ type: 'star', x: c.x, y: c.y });
          bb.inCircle(bb.foes(u), c.x, c.y, 18).forEach(e => { const k = 1 - 0.5 * Math.min(1, Math.hypot(e.x - c.x, e.y - c.y) / 18); hit(bb, u, e, 'magic', bb.raw(u, 120, 0.2, 1.7) * k, '초신성', { splash: true }); });
        });
      } }
  };

  /* ================= 3. 크로우 ================= */
  FD.crow = {
    id: 'crow', name: '크로우', role: 'warrior', color: '#6d28d9', title: '낫을 든 어둠의 추적자',
    concept: '"어둠에 찢겨저 죽어라"',
    stats: { hp: 980, mp: 230, aspd: 1.05, spd: 9.4, atk: 63, ap: 34, def: 28, res: 24, ten: 0.10, pen: 0.12, ls: 0.05, range: 6 },
    basic: { type: 'phys', atk: 1, ap: 0, proj: 'melee' }, ai: { front: true, threat: 0.9, style: { ult: 'open' } },
    tac: { act: ['rush'], fight: ['solo'], aim: ['back', 'weak'] },
        look: { res: 2,
      pal: { A: '#3f3f52', a: '#6b6b85', k: '#05040a', r: '#ef4444', R: '#7f1d1d', c: '#1f1b2e', C: '#2e2842', D: '#26222f', S: '#4b4552', g: '#9ca3af', x: '#cbd5e1',
            X: '#475569', K: '#2a2230', W: '#e2e8f0', v: '#7c3aed', V: '#4c1d95', P: '#1e1b4b', B: '#14121c', N: '#3b1d6e', u: '#a78bfa' },
      rows: [
        '................................',
        '................................',
        '..............aaaa......u.......',
        '............AAaaaaAA............',
        '...........AAAAaaAAAA...........',
        '...........AAXXXXXXAA...........',
        '..........XAkkkaakkkAX..........',
        '..........XrrrkaakrrrX..........',
        '..........XaRRkaakRRaX..V.......',
        '..........XakkkaakkkaX..........',
        '....u...V.AakkkaakkkaA.AAA......',
        '.......AA.cckkkkkkkkaaaaaaaa....',
        '...VaaaaaaaCCCCCCCCCAAXXXXXAA...',
        '..V.AXXXXXXACccCccCcAXXXgXXXA...',
        '....AXXgXXXAccccccccAXXXXXXXA...',
        'u...ADDDXXXASSDDDSSSAAXXXXXAA...',
        '...aaaaDXAASSSCCCCSSDAAADDDA....',
        '...SSSSDANDDSSCCCCSDDDAaDDaaaa..',
        '...SSSSDNNDDDSCCCCDDDDAADDSSSS..',
        '...XXXXNNNNaaDSSSDDaa.NNDDSSSS..',
        '...XXXXNNNNDDSSSSSDDD.NNNDXXXX..',
        '.....NNNNN.aaSSSSSSaaVNNNNXXXX..',
        '.....NNNNN.DSSSDSSSDD..NNN......',
        '.....NNNNN.SSSDDDSSSD..NNNN.....',
        '.u..NNNNNNSSSSxXxxSSSSNNNNN..v..',
        '....NNNNNNSSSSxxXxSSSSNNNNN.....',
        '....NNNNNN.PPPPPPPPPP.NNNNNN....',
        '....NNNNNN.PPPPPPPPPP.NNNNNN....',
        '.v..NNNNNN.PPPPPPPPPP.NNNNNN....',
        '...NNNNNNN.AaAAPPAaAA.NNNNVN....',
        '...NNVNNNN.AAAAPPAAAA......V....',
        '.V.NVNN....PPPP.VPPPP...........',
        '...VNNV....PPPP..PPPP..V......V.',
        '..........SSSSSSSSSSSS..........',
        '..........BBBBBBBBBBBB..........',
        '..........BBBBBBBBBBBB..........'],
            weapon: '4,-3,v;5,-3,v;21,-3,v;22,-3,v;4,-2,W;5,-2,W;21,-2,W;22,-2,W;2,-1,K;3,-1,W;4,-1,X;5,-1,x;6,-1,W;20,-1,W;21,-1,x;22,-1,X;23,-1,W;24,-1,K;25,-1,K;1,0,X;2,0,W;3,0,X;4,0,x;5,0,x;6,0,x;7,0,W;19,0,W;20,0,x;21,0,x;22,0,x;23,0,X;24,0,W;25,0,X;0,1,X;2,1,X;3,1,x;7,1,W;19,1,W;23,1,x;24,1,X;25,1,K;26,1,X;-1,2,x;2,2,x;3,2,K;6,2,x;7,2,x;19,2,x;20,2,x;24,2,x;25,2,K;27,2,x;2,3,K;3,3,K;7,3,v;19,3,v;24,3,K;25,3,K;2,4,g;3,4,K;24,4,g;25,4,K;2,5,K;3,5,K;24,5,K;25,5,K;2,6,K;3,6,K;24,6,K;25,6,K;2,7,K;3,7,K;24,7,K;25,7,K;2,8,g;3,8,K;24,8,g;25,8,K;2,9,K;3,9,K;24,9,K;25,9,K;2,10,K;3,10,K;24,10,K;25,10,K;2,17,K;3,17,K;24,17,K;25,17,K;2,18,K;3,18,K;24,18,K;25,18,K;2,19,K;3,19,K;24,19,K;25,19,K;2,20,g;3,20,K;24,20,g;25,20,K;2,21,K;3,21,K;24,21,K;25,21,K;2,22,K;3,22,K;24,22,K;25,22,K;2,23,K;3,23,K;24,23,K;25,23,K;2,24,g;3,24,K;24,24,g;25,24,K;2,25,K;3,25,K;24,25,K;25,25,K;2,26,K;3,26,K;24,26,K;25,26,K;2,27,K;3,27,K;24,27,K;25,27,K;2,28,x;3,28,x;24,28,x;25,28,x;2,29,x;24,29,x' },
    passive: { name: '어둠의 흐름', desc: '기본 공격할 때마다 스킬 피해량이 5%씩 증가합니다(최대 10중첩). 스킬을 쓰면 초기화됩니다.',
      init(b, u) { u.mem.n = 0; },
      onBasic(b, u) { if (!b.has(u, 'hell')) u.mem.n = Math.min(10, u.mem.n + 1); },
      skillMul(b, u) { return 1 + 0.05 * u.mem.n; },
      onSkill(b, u, sk) { if (b.has(u, 'hell')) { u.mem.n = 10; return; } u.mem.n = sk.id === 'cr_s1' ? (u.mem.refund || 0) : 0; u.mem.refund = 0; },
      tick(b, u) { if (b.has(u, 'hell')) u.mem.n = 10; u.gauge = { label: '어둠', val: u.mem.n, max: 10, color: '#a78bfa' }; } },
    skills: [
      { id: 'cr_s1', stack: { self: u => u.mem.n, min: 4 }, name: '어둠파장', cost: 40, cd: 6, range: 26, sfx: 'nuke', desc: '어둠을 날려 직선상의 적에게 피해를 줍니다. 적중 시 소모한 중첩의 절반을 돌려받습니다.',
        plan: foeIn(26),
        cast(b, u, pl) {
          const e = lineEnd(b, u, pl.t, 28); beam(b, u, e.x, e.y, 4, '#7c3aed');
          const hs = b.inLine(b.foes(u), u.x, u.y, e.x, e.y, 4);
          hs.forEach(x => hit(b, u, x, 'magic', b.raw(u, 38, 0.25, 0.75), '어둠파장', { path: true }));
          u.mem.refund = hs.length ? Math.floor(u.mem.n / 2) : 0;
        } },
      { id: 'cr_s2', name: '허상', cost: 45, cd: 9, range: 26, move: true, sfx: 'dash', desc: '무기를 던져 전방에 피해를 준 뒤, 무기가 있는 곳으로 순간이동하여 주변에 피해를 줍니다.',
        plan: foeIn(26, 8),
        cast(b, u, pl) {
          const ox = u.x, oy = u.y, e = lineEnd(b, u, pl.t, 24); beam(b, u, e.x, e.y, 4, '#c4b5fd');
          b.inLine(b.foes(u), ox, oy, e.x, e.y, 4).forEach(x => hit(b, u, x, 'phys', b.raw(u, 32, 0.75), '허상', { path: true }));
          b.blink(u, e.x, e.y); ring(b, u.x, u.y, 8, '#7c3aed');
          b.inCircle(b.foes(u), u.x, u.y, 8).forEach(x => hit(b, u, x, 'phys', b.raw(u, 22, 0.5), '허상', { splash: true }));
        } }
    ],
    ult: { id: 'cr_ult', name: '지옥의 추종자', cd: 36, range: 16, sfx: 'buff', desc: '8초간 중첩이 최대로 유지되고 스킬을 써도 사라지지 않습니다. 이 동안 피해를 주면 피해량에 비례해 체력을 회복합니다.',
      plan: anyIn(16),
      cast(b, u) { u.mem.n = 10; b.buff(u, 'hell', 8, { name: '지옥의 추종자', add: { ls: 0.35 }, f: { hell: true } }); u.glow = '#7c3aed'; b.later(8, () => { if (!b.has(u, 'hell')) u.glow = null; }); } }
  };

  /* ================= 4. 검성 ================= */
  FD.swordsaint = {
    id: 'swordsaint', name: '검성', role: 'warrior', color: '#e2e8f0', title: '일본도의 달인',
    concept: '"나의 영혼을 담아..."',
    stats: { hp: 900, mp: 180, aspd: 1.25, spd: 8.0, atk: 54, ap: 0, def: 32, res: 24, ten: 0.10, pen: 0.08, ls: 0, range: 6.5 },
    basic: { type: 'phys', atk: 1, ap: 0, proj: 'melee' }, ai: { front: true, threat: 1.1, style: { ult: 'open' } },
    tac: { act: ['basic', 'rush'], fight: ['solo'], pos: ['front'] },
    look: {
  pal: { K: '#151a2b', G: '#46536b', B: '#2a3142', A: '#b3262e', L: '#161b27', R: '#ff3b3b', S: '#f1d9c0' },
  rows: [
    '...Y..KK..Y.....',
    '...YKGGGGKY.....',
    '..KKKKKKKKKK....',
    '...KSESSESK.....',
    '...KRRRRRRK.....',
    '..KKGGGGGGKK....',
    '.XXXBBGGBBXXX...',
    '.AXABBGGBBAXA...',
    '.SKXBAAAABXKS...',
    '..XBGGGGGGBX....',
    '..AAAAYYAAAA....',
    '.XBBXBBBBXBBX...',
    '..BGBXBBXBGB....',
    '...LLL..LLL.....',
    '...XXL..LXX.....',
    '..KKKK..KKKK....'
  ],
  weapon: '11,-2,W;11,-1,X;11,0,W;11,1,X;11,2,W;11,3,X;11,4,W;10,5,Y;11,5,Y;12,5,Y;11,6,K;11,7,K;11,8,Y'
},
    passive: { name: '영혼검', desc: '스킬로 준 피해의 35%만큼 체력을 회복합니다.',
      onDealt(b, u, t, res, o) { if (o.skill && res.dealt > 0) b.heal(u, u, res.dealt * 0.35, '영혼검'); } },
    skills: [
      { id: 'ss_s1', name: '막아내기', cost: 30, cd: 8, range: 12, sfx: 'shield', desc: '1.2초간 모든 공격을 막아냅니다.',
        plan: (b, u, en) => (en.some(e => b.dist(u, e) <= 12) && (b.t - u.hitT < 12 || u.hp < u.maxHp * 0.7) ? {} : null),
        cast(b, u) { b.buff(u, 'block', 1.2, { name: '막아내기', f: { block: true } }); } },
      { id: 'ss_s2', name: '꿰뚫기', cost: 40, cd: 7, range: 26, move: true, sfx: 'pierce', desc: '앞으로 돌진하며 경로상의 적에게 피해를 줍니다.',
        plan: foeIn(26, 7),
        cast(b, u, pl) {
          const ox = u.x, oy = u.y, e = dashTo(b, u, pl.t, 22, -4); b.slide(u, e.x, e.y);
          b.inLine(b.foes(u), ox, oy, u.x, u.y, 4).forEach(x => hit(b, u, x, 'phys', b.raw(u, 45, 1.0), '꿰뚫기', { path: true }));
        } }
    ],
    ult: { id: 'ss_ult', name: '영혼검술', cd: 34, range: 14, sfx: 'buff', desc: '8초간 칼에 영혼을 담습니다. 기본 공격에 추가 피해가 붙으며, 이때 기본 공격 피해는 스킬 피해로 취급됩니다.',
      plan: anyIn(14),
      cast(b, u) {
        b.buff(u, 'soul', 8, { name: '영혼검술', mul: { aspd: 1.15 }, f: { basicAsSkill: true } }); u.glow = '#e2e8f0'; b.later(8, () => { u.glow = null; });
        u.bm.push({ until: b.t + b.sec(8), fn(bb, uu, t) { hit(bb, uu, t, 'magic', bb.raw(uu, 28, 0.55), '영혼검술'); } });
      } }
  };

  /* ================= 5. 사르코자 ================= */
  FD.sarcoza = {
    id: 'sarcoza', name: '사르코자', role: 'warrior', color: '#4ade80', title: '독기의 뱀전사',
    concept: '"독기...중독...살육!!"',
    stats: { hp: 1020, mp: 240, aspd: 0.95, spd: 8.2, atk: 58, ap: 50, def: 30, res: 30, ten: 0.10, pen: 0.08, ls: 0, range: 6.5 },
    basic: { type: 'phys', atk: 1, ap: 0, proj: 'melee' }, ai: { front: true, threat: 1.0, style: { ult: 'open' } },
    tac: { act: ['basic', 'rush'], fight: ['coop', 'solo'], pos: ['front'] },
    look: { res: 2,
      pal: { D: '#0b2e1a', G: '#15803d', g: '#4ade80', l: '#86efac', a: '#1f4d36', P: '#6d28d9', y: '#facc15', k: '#052e16', K: '#052e16',
            w: '#ffffff', r: '#ef4444', x: '#94a3b8', X: '#e2e8f0', b: '#3b3b2f', q: '#6b6b55' },
      rows: [
        'Xx..........DDDDDDDD............',
        'xDXD......DDGGGGGGGGDD..........',
        '.XqxD...DDGGggggggggGGDD........',
        '.DxqbDDDGGggGGggggGGggGGDD......',
        '..DqqbDGggyyGggggggGyyggGGD.....',
        '..DDqqbDggkyGggggggGykggGGD.....',
        '...DbqqbDgggGgGggGgGgggGGGD.....',
        '....DbqqbDGwGGggggGGwGGGGD......',
        '.....DbqqbDwrKKKKKKrwDGGD.......',
        '......DbqqbGGGGGGGGGGDD.........',
        '...DDDDDbqqbGggggggGGDDDDDDDD...',
        '..DGGgggDbqqbgPggPggGDDGgggGGD..',
        '..DGgGGGGDbDDDDDgGgPgGDGgGGGDD..',
        '..DGggGGGGDqGgGggPGggGDGGGGGDD..',
        '...DGGDDGGGDgGgDGgGgPgGGGGGDD...',
        '...DDDDDDDDGGgGbDgPGgGGGGGDDD...',
        '....DGGGgGgDDDDDDDDDDGGGGDDD....',
        '....DGgGGPgGgDbqqGgGGGGDDgGD....',
        '.....DGGgGgGgGDbqgGgGGDDGGw.....',
        '.....DGgGgGgGgGDbGgGDDDxXXD.....',
        '...........DDgggDDDDD.xxxX......',
        '..........DGDGGGGDbqqgxxxXX.w...',
        '..........DPDgggggDxxxxxxxXX....',
        '.........DPGDGGGGGxxxxggxxXX....',
        '.........PaaDggggggxxxxgxxxXXw..',
        '....DDGGPaGGDGGGGwXDxxxxgxxx....',
        '..GGaGGPGGaaDggggggDGxxxxxxxX.w.',
        '.GGaGGaDaaGGDGGGGGGwXaxxxxxxx.X.',
        'GGaGD.DaGGaaDggggggDGGaxxxgxxX..',
        'GaGD.DGGaaGGDGGGGGGDawXGxxxgxX..',
        'aGG..DaaGGaaDggggggDGGaaGDxxxxXX',
        'GGaDDaGGaaGGDGGGGGGDaaGGwXxxxgX.',
        'GaGGDGaaGGaaDggggggDGGaPGaGDxgxX',
        '.GGDaaGGaaGPDGGGGGGDaaPGaGwXDxgX',
        '..DaGGaaGGPaDggggggDGPaaGGaGGDgX',
        '..DGaaGGaPGGDGGGGGGDPaGGGaGGawXD'],
      weapon: '' },
    passive: { name: '중독', desc: '중독 상태의 적에게 피해를 주면 준 피해의 20%만큼 체력을 회복합니다.',
      onDealt(b, u, t, res) { if (res.dealt > 0 && t.st.some(s => s.key === 'poison')) b.heal(u, u, res.dealt * 0.2, '중독 흡수'); } },
    skills: [
      { id: 'sa_s1', name: '독기방출', cost: 40, cd: 7, range: 11, sfx: 'aoe', desc: '주변에 독기를 방출합니다. 맞은 적은 중독됩니다.',
        plan: anyIn(11),
        cast(b, u) { ring(b, u.x, u.y, 12, '#4ade80'); b.inCircle(b.foes(u), u.x, u.y, 12).forEach(e => { hit(b, u, e, 'magic', b.raw(u, 28, 0, 0.6), '독기방출', { splash: true }); b.cc(u, e, 'poison', 4.5); }); } },
      { id: 'sa_s2', name: '크로스포이즌', cost: 45, cd: 9, range: 22, move: true, sfx: 'charge', desc: '전방으로 도약해 내리찍어 피해를 줍니다. 중독된 적에게는 치명타 피해(×1.6)를 줍니다.',
        plan: foeIn(22, 7),
        cast(b, u, pl) {
          const e = dashTo(b, u, pl.t, 17, 3); b.slide(u, e.x, e.y); ring(b, u.x, u.y, 7, '#4ade80');
          b.inCircle(b.foes(u), u.x, u.y, 7).forEach(x => { const p = x.st.some(s => s.key === 'poison'); hit(b, u, x, 'phys', b.raw(u, 50, 0.95) * (p ? 1.6 : 1), '크로스포이즌', { splash: true, crit: p }); });
        } }
    ],
    ult: { id: 'sa_ult', name: '뱀의 늪', cd: 38, range: 16, sfx: 'aoe', desc: '6초간 주변을 늪으로 만들어 적에게 초당 피해를 주고 중독시키며 이동 스킬을 봉인합니다.',
      plan: anyIn(16),
      cast(b, u) {
        b.zone({ x: u.x, y: u.y, r: 18, dur: 6, owner: u, kind: 'swamp', color: '#16a34a', every: 0.5,
          onTick(z, bb) { bb.inCircle(bb.foes(u), z.x, z.y, z.r).forEach(e => { hit(bb, u, e, 'magic', bb.raw(u, 14, 0, 0.35), '뱀의 늪', { splash: true, dot: true }); bb.cc(u, e, 'poison', 1.2, { quiet: true }); bb.buff(e, 'nodash', 0.7, { name: '이동기 봉인', good: false, f: { noDash: true }, quiet: true }); }); } });
      } }
  };

  /* ================= 6. 워리어 ================= */
  FD.warrior = {
    id: 'warrior', name: '워리어', role: 'warrior', color: '#f59e0b', title: '정직한 대검 전사',
    concept: '"정의로움은 가장 큰 가치이지."',
    stats: { hp: 940, mp: 160, aspd: 0.8, spd: 7.6, atk: 61, ap: 0, def: 40, res: 30, ten: 0.15, pen: 0.10, ls: 0, range: 7 },
    basic: { type: 'phys', atk: 1, ap: 0, proj: 'melee' }, ai: { front: true, threat: 1.4, style: { ult: 'finish' } },
    tac: { act: ['basic', 'rush'], fight: ['coop'], pos: ['front'] },
    look: {
  res: 2,
  pal: {
    G: '#fff1b0', Y: '#ffd166', D: '#c98a1e', O: '#7a4a10',   // 황금 하이라이트 / 본체 / 음영 / 가장 어두운 면
    W: '#f4f8ff', X: '#8a9bb2', B: '#5ad1ff', K: '#1b1f33',   // 칼날 / 칼날 가장자리 / 성스러운 룬·보석 / 손잡이
    S: '#f0c9a0', s: '#d29a6c', E: '#101428',                  // 피부 / 피부 음영 / 눈
    C: '#c8323c', c: '#7f1d28', T: '#f7efd8'                   // 망토·깃털 / 망토 음영 / 흰 타바드
  },
  rows: [
    '...........CCCC..........WW.....',
    '........cCCCCCC.........XWWX....',
    '.......cCCDYGGYYD.......XWWX....',
    '......ccCDYGGYYYYD......XBWX....',
    '......cCDYYGGYYYYYD.....XWWX....',
    '........DYYYYGYYYYD.....XWWX....',
    '........DYSSEsSESYD.....XBWX....',
    '........DYSSSsSSSYD.....XWWX....',
    '.........DYSSsSSYD......XWWX....',
    '.........DYYSSSYYD......XBWX....',
    '........DYYYGGGYYYD.....XWWX....',
    '....DYGGYYYYGGGYYYYGGYD.XWWX....',
    '...DYGGGYDYYYBYYYDYGGYD.XBWX....',
    '...DYYYYYDYGYYYGYDYYYYD.XWWX....',
    '...cCDYYDDYYYTYYYDDYYD..XWWX....',
    '..cCCDYYDDYYTTTYYDDYYDD.XWWX.D..',
    '..cCCDYYDDYYYTYYYDDYYDDYYGGYYD..',
    '..cCCDYYDDYYYTYYYD.DYYDDYBBYD...',
    '..cCCDYYDDYYYTYYYD.DYYGYYYYD....',
    '..cCCDYYDKKKYBYKKK.DYYYYGYYD....',
    '..cCCDYDDYYGYYYGYYD.....DYYD....',
    '..cCC..DYYGYTTTYGYYD....DKKD....',
    '.cCCCc.DYYOYTTTYOYYD.....KK.....',
    '.cCCCCc.DYYYTTTYYYD.....DGGD....',
    '.cCCCCCc.DYYDTDYYD.......DD.....',
    '.cCCCCc..DYGD.DGYD..............',
    '.cCCCc..DYGYD.DYGYD.............',
    '..cCCc...DYYD.DYYD..............',
    '...cCc...DYGD.DGYD..............',
    '....cc...DYYD.DYYD..............',
    '.........DYYD.DYYD..............',
    '.......DYYYYD.DYYYYD............',
    '.......DGYYYD.DGYYYD............',
    '.......OOOOOO.OOOOOO............'
  ]
},
    passive: { name: '전사의 긍지', desc: '스킬을 사용한 뒤 4초간 방어력과 저항력이 25% 상승합니다.',
      onSkill(b, u) { b.buff(u, 'pride', 4, { name: '전사의 긍지', mul: { def: 1.25, res: 1.25 } }); } },
    skills: [
      { id: 'wr_s1', name: '신속', cost: 35, cd: 6, range: 26, move: true, sfx: 'pierce', desc: '빠르게 앞으로 이동하며 경로상의 적에게 피해를 줍니다.',
        plan: foeIn(26, 7),
        cast(b, u, pl) {
          const ox = u.x, oy = u.y, e = dashTo(b, u, pl.t, 18, -2); b.slide(u, e.x, e.y);
          b.inLine(b.foes(u), ox, oy, u.x, u.y, 4).forEach(x => hit(b, u, x, 'phys', b.raw(u, 35, 0.85), '신속', { path: true }));
        } },
      { id: 'wr_s2', name: '신검', cost: 45, cd: 9, range: 10, move: true, sfx: 'aoe', desc: '크게 휘두르며 앞으로 이동합니다. 휘두르는 1초 동안 모든 피해를 막아냅니다.',
        plan: anyIn(10),
        cast(b, u) {
          const t = b.nearest(u, b.foes(u)); if (t) { const e = dashTo(b, u, t, 9, 3); b.slide(u, e.x, e.y); }
          b.buff(u, 'block', 1.0, { name: '신검', f: { block: true } });
          const swing = () => { if (!u.alive) return; ring(b, u.x, u.y, 8, '#fbbf24'); b.inCircle(b.foes(u), u.x, u.y, 8).forEach(x => hit(b, u, x, 'phys', b.raw(u, 28, 0.6), '신검', { splash: true })); };
          swing(); b.later(0.5, swing); b.later(1.0, swing);
        } }
    ],
    ult: { id: 'wr_ult', name: '심판', cd: 34, range: 11, sfx: 'nuke', desc: '전방의 적에게 큰 피해를 줍니다. 체력이 30% 이하인 적은 처형합니다.',
      plan: foeIn(11),
      cast(b, u, pl) {
        const t = pl.t; ring(b, t.x, t.y, 7, '#fbbf24');
        if (t.hp < t.maxHp * 0.3) b.execute(u, t, '심판'); else hit(b, u, t, 'phys', b.raw(u, 140, 1.35), '심판');
      } }
  };

  /* ================= 7. 대쉬 ================= */
  const dashHit = (b, u, t, k, tag) => {
    const ox = u.x, oy = u.y, e = dashTo(b, u, t, 24, -3); b.slide(u, e.x, e.y);
    b.inLine(b.foes(u), ox, oy, u.x, u.y, 5.5).forEach(x => { hit(b, u, x, 'phys', b.raw(u, 50, 0.95) * k, tag, { path: true }); b.knock(u, x, 8, { x: ox, y: oy }); });
  };
  FD.dash = {
    id: 'dash', name: '대쉬', role: 'warrior', color: '#38bdf8', title: '방패 건틀릿의 질주 전사',
    concept: '"날 잡아봐"',
    stats: { hp: 1000, mp: 200, aspd: 0.95, spd: 9.6, atk: 58, ap: 0, def: 40, res: 28, ten: 0.15, pen: 0.06, ls: 0, range: 6 },
    basic: { type: 'phys', atk: 1, ap: 0, proj: 'melee' }, ai: { front: true, threat: 1.3, style: { engage: true, ult: 'open' } },
    tac: { act: ['rush'], fight: ['support', 'coop'], pos: ['front'] },
    look: { res: 2,
      pal: { h: '#3b2a1a', S: '#f5d0b0', G: '#1e293b', g: '#38bdf8', j: '#9a5b2b', J: '#5a3416', c: '#d6a77a', m: '#ef4444', p: '#1e293b', b: '#0f172a', q: '#1f2a44',
            a: '#7dd3fc', x: '#cbd5e1', z: '#fbbf24', k: '#0b0b12', W: '#f1f5f9', N: '#64748b', T: '#94a3b8', M: '#334155' },
      rows: [
        '....hhhhhhhh....................',
        '....hhhhhhhhhhhhhhhh............',
        '....hhhhhhhhhhhhhhhh............',
        '......hhhhhgaghhgagh............',
        '..hhhhhhhhGgggzzgggG............',
        '..hhhhhhhhhhSSSSSSSS............',
        '..hhhhhhhhSSkkSSkkSS............',
        '....hhhhh.SSSSSSSSSS............',
        '...hhhh...SSSSSSSSSS............',
        '...hhhmm...SScWWccS.............',
        '.mmmmmmmmmm.SSSSSS..............',
        'mmmmmmmmmmmmmmmmmmmJJJ..........',
        'mmmmmmmjjjmmmmmmmmmjjj..........',
        'mmmmmmjjjjmmmJJJJJjjjjj.........',
        '.mmmm.jjjjzjJJzzJJjjjjj.........',
        '.mmm.jjjjjzjJJJJJJjjjjj.........',
        '.m...jjjjzzzJJJJJJjjjjjj........',
        '....jjjjjzzzJJzzJJjjjjjj........',
        '....jjjj.jzzJJJJJJjjccccc.......',
        '...zzzzjJzJzzJJJJJjjccccc.......',
        '...xxxx.JJJzzJzzJJjjccccc.......',
        '...cccc.JJJzzJJJJJjjccccc.......',
        '...cccc..jjzzJJJJJjjj...........',
        '..........jjJJzzJJjj............',
        '..........jjJJJJJJjj............',
        '.........GGGGzzzzGGGG...........',
        '.........GGGGzzzzGGGG...........',
        '.........ppppppppppppp..........',
        '........ppppppppppppppp.........',
        '........pppppp...pppppp.........',
        '.......ppppppp...ppppppp........',
        '.......pppppp.....pppppp........',
        '.......ppppp.......ppppp........',
        '.......bbbbbb......pbbbbbbb.....',
        '.......qqqqqq.......qqqqqqq.....',
        '.......bbbbbb.......bbbbbbb.....'],
      weapon: '20,7,x;21,7,z;22,7,x;18,8,x;19,8,x;20,8,N;21,8,N;22,8,N;23,8,x;24,8,x;16,9,z;17,9,x;18,9,N;19,9,N;20,9,N;21,9,T;22,9,N;23,9,N;24,9,N;25,9,x;26,9,z;16,10,x;17,10,N;18,10,T;19,10,T;20,10,T;21,10,T;22,10,T;23,10,T;24,10,T;25,10,N;26,10,x;27,10,x;28,10,x;29,10,z;13,11,x;15,11,x;16,11,N;17,11,T;18,11,T;19,11,N;20,11,N;21,11,N;22,11,N;23,11,N;24,11,T;25,11,T;26,11,N;27,11,x;13,12,x;14,12,x;15,12,x;16,12,N;17,12,T;18,12,N;19,12,N;20,12,T;21,12,M;22,12,T;23,12,N;24,12,N;25,12,T;26,12,N;27,12,x;28,12,x;29,12,z;12,13,z;13,13,x;14,13,x;15,13,N;16,13,N;17,13,T;18,13,N;19,13,M;20,13,M;21,13,T;22,13,M;23,13,M;24,13,N;25,13,T;26,13,N;27,13,N;28,13,x;12,14,z;13,14,x;14,14,x;15,14,N;16,14,T;17,14,T;18,14,N;19,14,M;20,14,T;21,14,T;22,14,T;23,14,M;24,14,N;25,14,T;26,14,T;27,14,x;28,14,x;29,14,z;12,15,z;13,15,x;14,15,x;15,15,N;16,15,N;17,15,T;18,15,N;19,15,T;20,15,M;21,15,T;22,15,M;23,15,T;24,15,N;25,15,T;26,15,N;27,15,N;28,15,x;12,16,z;13,16,x;14,16,x;15,16,x;16,16,N;17,16,T;18,16,N;19,16,N;20,16,M;21,16,M;22,16,M;23,16,N;24,16,N;25,16,T;26,16,N;27,16,x;28,16,x;29,16,z;13,17,x;14,17,x;15,17,x;16,17,N;17,17,T;18,17,T;19,17,N;20,17,N;21,17,N;22,17,N;23,17,N;24,17,T;25,17,T;26,17,N;27,17,x;13,18,x;16,18,x;17,18,N;18,18,T;19,18,T;20,18,T;21,18,T;22,18,T;23,18,T;24,18,T;25,18,N;26,18,x;27,18,x;28,18,x;29,18,z;16,19,z;17,19,x;18,19,N;19,19,N;20,19,N;21,19,T;22,19,N;23,19,N;24,19,N;25,19,x;26,19,z;18,20,x;19,20,x;20,20,N;21,20,N;22,20,N;23,20,x;24,20,x;20,21,x;21,21,z;22,21,x' },
    passive: { name: '대쉬가드', desc: '대시(이동) 스킬을 사용하면 2.5초간 방어 상태가 되어 받는 피해가 35% 감소합니다.',
      onSkill(b, u, sk) { if (sk.move) b.buff(u, 'dguard', 2.5, { name: '대쉬가드', f: { dmgIn: 0.65 } }); } },
    skills: [
      { id: 'ds_s1', name: '가드크러쉬', cost: 40, cd: 9, range: 9, sfx: 'nuke', desc: '앞의 적의 방어 효과(보호막·막기·피해 감소)를 해제한 뒤 피해를 주고 기절시킵니다.',
        plan: foeIn(9),
        cast(b, u, pl) {
          const t = pl.t; t.st = t.st.filter(s => !(s.block || s.dmgIn || (s.shield !== undefined) || (s.mul && s.mul.def && s.mul.def > 1)));
          hit(b, u, t, 'phys', b.raw(u, 45, 0.9), '가드크러쉬'); b.cc(u, t, 'stun', 1.2);
        } },
      { id: 'ds_s2', name: '추격', cost: 35, cd: 8, range: 34, move: true, sfx: 'charge', desc: '돌진합니다. 적이나 구조물(벽)에 부딪히면 멈추며, 적과 부딪히면 피해를 줍니다.',
        plan: foeIn(34, 8),
        cast(b, u, pl) {
          const d = b.dir(u, pl.t), ox = u.x, oy = u.y; let hitFoe = null, x = ox, y = oy;
          for (let i = 1; i <= 28; i++) {
            const p = b.clampPos(ox + d.x * i, oy + d.y * i);
            if (Math.abs(p.x - (ox + d.x * i)) > 0.01 || Math.abs(p.y - (oy + d.y * i)) > 0.01) break;      // 벽
            x = p.x; y = p.y; hitFoe = b.foes(u).find(e => Math.hypot(e.x - x, e.y - y) <= 4.2);
            if (hitFoe) break;
          }
          b.slide(u, x, y); if (hitFoe) hit(b, u, hitFoe, 'phys', b.raw(u, 50, 0.95), '추격');
        } }
    ],
    ult: { id: 'ds_ult', name: 'DASH', cd: 34, range: 36, move: true, sfx: 'pierce', desc: '앞으로 돌진하며 경로의 적에게 피해를 주고 넉백시킵니다. 5초 안에 한 번 더 사용할 수 있습니다.',
      plan: foeIn(36, 4),
      cast(b, u, pl) { dashHit(b, u, pl.t, 1, 'DASH'); return { recast: 5 }; },
      recast: { move: true, plan: foeIn(40, 3), cast(b, u, pl) { dashHit(b, u, pl.t, 1.1, 'DASH'); b.buff(u, 'dguard', 2.5, { name: '대쉬가드', f: { dmgIn: 0.65 } }); } } }
  };
  FD.dash.ult.recast.move = true;

  /* ================= 8. 윈드 ================= */
  const speedK = (b, u) => Math.max(1, Math.min(2.2, b.eff(u, 'spd') * 20 / u.f.stats.spd));
  FD.wind = {
    id: 'wind', name: '윈드', role: 'warrior', color: '#5eead4', title: '바람도끼의 질풍 전사',
    concept: '"바람이 우리를 올바른길로 데려다줄거야."',
    stats: { hp: 980, mp: 200, aspd: 1.0, spd: 9.4, atk: 66, ap: 24, def: 28, res: 24, ten: 0.10, pen: 0.10, ls: 0, range: 6.5 },
    basic: { type: 'phys', atk: 1, ap: 0, proj: 'melee' }, ai: { front: true, threat: 0.95, style: { ult: 'finish' } },
    tac: { act: ['rush'], fight: ['solo'], aim: ['weak'] },
      look: {
      hair: '#e6fbff', skin: '#fde5cf', body: '#0f766e', acc: '#5eead4', res: 2,
      pal: {
        H: '#e6fbff', J: '#9bdde6',                       // 머리카락 / 머리 그림자
        S: '#fde5cf', D: '#e3b190',                       // 피부 / 피부 그림자
        G: '#22d3ee', E: '#0f2f3a',                       // 눈동자 / 눈썹
        B: '#0f766e', F: '#0b4a48', L: '#134e4a',         // 천(기본) / 천(어두움) / 바지
        C: '#f0fdfa', A: '#5eead4', U: '#d9fdff',         // 흰 천 / 바람색 포인트 / 하이라이트
        Y: '#fbbf24', N: '#1e293b'                        // 금 장식 / 부츠
      },
      rows: [
        '.........................X......',
        '.........................WW.....',
        '........' + '.....HUH' + 'HHH.....' + '.KXWW...',
        '........' + '.JHHHUHH' + 'HHHH....' + '.KXWUW..',
        '......JH' + 'HHJHHJHH' + 'HHJH....' + '.KXWAWW.',
        '....JHHH' + 'JHHHHHSS' + 'SSHH....' + '.KXAAUW.',
        '...JHHHJ' + 'HHJHHSES' + 'SESH....' + '.KXAAWW.',
        '..JHHHJH' + 'HJHHHSGS' + 'SGSH....' + '.KXWAWX.',
        '...HJHHJ' + 'HHJHHSSS' + 'DSSH....' + '.KXWWW..',
        'UA..HJHH' + 'JHHJJSSD' + 'DSSJ....' + '.KXWW...',
        '.....HJH' + 'HJHJJDSS' + 'SSD.....' + '.KXX....',
        '.....JHJ' + 'HJ..CCAC' + 'CACC....' + '.K......',
        '...CCACC' + 'ACAFBBCB' + 'BBBBF...' + '.K......',
        '..CACCAC' + '.SSBCCBB' + 'BBBBBSS.' + '.K......',
        'AU.CCACA' + '.SDBBCCB' + 'BBBBB.YS' + '.K......',
        '....CAC.' + '.SDBBBCC' + 'BABBB..S' + '.K......',
        '.....CC.' + '.SDBBBBC' + 'CBBBB...' + 'SSS.....',
        '.......X' + '.SDBBBBB' + 'BCCBF...' + 'DYD.....',
        '....WWXK' + '.SDFFFFC' + 'CFFFF...' + '.K......',
        '..WAWWXK' + '.SDLLLCC' + 'CLLLL...' + '.K......',
        '.WWAAUXK' + '.SDLLLLC' + 'CLLLL...' + '.K......',
        '.WWAAAXK' + '.SDLLLLC' + 'ALLLL...' + '.K......',
        '.XWAWWXK' + '.SDLLLLC' + 'CLLLL...' + '.K......',
        '..WWWWXK' + 'SDLLLL.C' + 'A.LLLL..' + '.K......',
        '...WWXXK' + 'SDLLLL..' + '..LLLL..' + '.K......',
        '....XXXY' + 'SSLLLL..' + '..LLLL..' + '.K......',
        '.......K' + 'DYLLLL..' + '..LLLL..' + '.K......',
        '.......K' + '.LLLL...' + '...LLLL.' + '.K......',
        '.......K' + '.LYYL...' + '...LYYL.' + '.X......',
        '.......X' + '.LLLL...' + '...LLLL.' + '........',
        '........' + 'CACAC...' + '...CACAC' + '........',
        '.......N' + 'NNNNN...' + '...NNNNN' + 'N.......',
        '.....NNN' + 'NNNNN...' + '...NNNNN' + 'NNN.....',
        '....KKKK' + 'KKKKK...' + '...KKKKK' + 'KKKK....'
      ].map(r => r)
    },
    passive: { name: '기류타기', desc: '기본 공격이 적중하면 2.5초간 이동속도가 20% 상승합니다. (중첩 불가)',
      onBasic(b, u, t, res) { if (res.dealt >= 0) b.buff(u, 'airflow', 2.5, { name: '기류타기', mul: { spd: 1.2 }, quiet: true }); } },
    skills: [
      { id: 'wd_s1', name: '바람가르기', cost: 35, cd: 5, range: 10, sfx: 'nuke', desc: '전방의 적을 베어 피해를 줍니다. 이동속도가 높을수록 피해량이 증가합니다.',
        plan: foeIn(10),
        cast(b, u, pl) { cone(b, u, pl.t, 10, 0.85, '#5eead4'); const k = speedK(b, u); b.inCone(b.foes(u), u, pl.t.x, pl.t.y, 10, 0.85).forEach(x => hit(b, u, x, 'phys', b.raw(u, 38, 0.85) * k, '바람가르기', { splash: true })); } },
      { id: 'wd_s2', name: '바람타기', cost: 30, cd: 10, range: 28, sfx: 'buff', desc: '4초간 이동속도가 대폭(+50%) 상승합니다.',
        plan: anyIn(28),
        cast(b, u) { b.buff(u, 'windride', 4, { name: '바람타기', mul: { spd: 1.5, aspd: 1.1 } }); } }
    ],
    ult: { id: 'wd_ult', name: '칼바람', cd: 34, range: 46, move: true, sfx: 'pierce', desc: '긴 거리를 빠르게 날아가며 경로의 적을 베어 피해를 줍니다. 이동속도가 높을수록 피해량이 증가합니다.',
      plan: (b, u, en) => { const l = en.filter(e => b.dist(u, e) <= 46 && b.dist(u, e) > 10); const t = b.lowest(l); return t ? { t } : null; },
      cast(b, u, pl) {
        const ox = u.x, oy = u.y, k = speedK(b, u), e = dashTo(b, u, pl.t, 40, -6); b.slide(u, e.x, e.y);
        b.inLine(b.foes(u), ox, oy, u.x, u.y, 5).forEach(x => hit(b, u, x, 'phys', b.raw(u, 80, 1.2) * k, '칼바람', { path: true }));
      } }
  };

  /* ================= 9. 써볼트 ================= */
  FD.thunderbolt = {
    id: 'thunderbolt', name: '써볼트', role: 'warrior', color: '#facc15', title: '전격창의 번개 전사',
    concept: '"뇌신의 분노를 받아라!"',
    stats: { hp: 820, mp: 230, aspd: 0.9, spd: 8.0, atk: 40, ap: 55, def: 28, res: 28, ten: 0.10, pen: 0.10, ls: 0, range: 9 },
    basic: { type: 'magic', atk: 0.6, ap: 0.5, proj: 'melee' }, ai: { front: true, kite: 0, threat: 1.0, style: { ult: 'open' } },
    tac: { act: ['basic'], fight: ['coop'], pos: ['none', 'front'] },
  look: {
  hair: '#e0f2fe', skin: '#38bdf8', body: '#1d4ed8', acc: '#fde047', res: 2,
  pal: {
    H: '#e0f2fe', J: '#7dd3fc',                       // 불꽃 머리 / 머리 음영
    S: '#38bdf8', D: '#0ea5e9', I: '#1d4ed8',         // 전기 몸(기본) / 음영 / 근육 틈새
    U: '#ffffff', V: '#bae6fd', Y: '#fde047',         // 코어·눈·창 중심 / 스파크 / 금빛 스파크·손목
    A: '#334155', Q: '#1e293b', Z: '#94a3b8'          // 갑옷 / 갑옷 어두움 / 갑옷 하이라이트
  },
  rows: [
    '..V.....' + '..H..H..' + '.H......' + '....U...',
    '........' + '..HJHHJH' + 'H.......' + '...VUV..',
    '........' + '.HJHHHHJ' + 'H.......' + '..VUUUV.',
    '........' + '.JSSSSSS' + 'J.......' + '..VYUYV.',
    '........' + '.SUUSSUU' + 'S.......' + '..VYUYV.',
    '........' + '.SSSDDSS' + 'S.......' + '...VUV..',
    '........' + '..SDSSDS' + '........' + '...VUV..',
    '........' + '...SIIS.' + '........' + '.VYYUYV.',
    '...ZAAAA' + 'AAAQUUQA' + 'AAAAAAZ.' + '....UV..',
    '.V.AQAAQ' + 'AAQAUUAQ' + 'AAQAAQA.' + '.....UV.',
    '....QAAA' + 'QAQAUUAQ' + 'AQAAAQ..' + '....UV..',
    '....SDII' + 'SIAQUUQA' + 'ISIIDS..' + '...UV...',
    '....SDID' + 'SIAAUUAA' + 'ISDIDS..' + '....UV..',
    '....SDII' + 'SIDAUUAD' + 'ISDIIS..' + '.....UV.',
    '....AQQA' + 'ZIDIUUID' + 'I.SDIDS.' + '....UV..',
    '....AQAA' + 'ZIDSUUSD' + 'I....SDI' + 'YS.UV...',
    '....AQQA' + 'ZIDIVVID' + 'I.......' + '.SDSS...',
    '...VSDSV' + '.QAAYYAA' + 'Q.......' + '.DSUV...',
    '..V.VSV.' + '.QASUUSA' + 'Q.......' + '....UV..',
    '........' + 'ZAQSIISQ' + 'AZ......' + '.....UV.',
    '..V.....' + '.SDIUUID' + 'S.......' + '....UV..',
    '.......S' + 'DIISSSSI' + 'IDS.....' + '...UV...',
    '.......S' + 'DIVSSSSV' + 'IDS..V..' + '..V.UV.V',
    '.......S' + 'DIISSSSI' + 'IDS.....' + '.....UV.',
    '......ZA' + 'QQAZ..ZA' + 'QQAZ....' + '....UV..',
    '...V...S' + 'DIIS..SI' + 'IDS.....' + '...UV...',
    '.......S' + 'DVIS..SI' + 'VDS.....' + '....UV..',
    '.......S' + 'DIIS..SI' + 'IDS...Y.' + '.....UV.',
    '.......Z' + 'AQAA..AA' + 'QAZ.....' + '....UV..',
    '.......A' + 'QAQA..AQ' + 'AQA.....' + '...UV...',
    '..V....Q' + 'AAQA..AQ' + 'AAQ.....' + '.V..UV..',
    '.......S' + 'AQAS..SA' + 'QAS.V...' + '.....UV.',
    '........' + 'SDIS..SI' + 'DS......' + '....UV..',
    '.V......' + 'SIIS..SI' + 'IS......' + '...UV...',
    '......SS' + 'SSSS..SS' + 'SSSS....' + '....U...',
    '......DS' + 'SSSD..DS' + 'SSSD....' + '....V...'
  ]
},
    passive: { name: '충전격', desc: '5초마다 전기가 충전되며, 가득 차면 다음 기본 공격이 강화됩니다. (강화 후 초기화)',
      init(b, u) { u.mem.c = 0; },
      tick(b, u) { if (u.mem.c < 1) u.mem.c = Math.min(1, u.mem.c + 1 / 100); u.gauge = { label: '충전', val: u.mem.c * 100, max: 100, color: '#facc15' }; u.glow = u.mem.c >= 1 ? '#facc15' : null; },
      onBasic(b, u, t) { if (u.mem.c >= 1 && t.alive) { u.mem.c = 0; ring(b, t.x, t.y, 5, '#facc15'); b.deal(u, t, { type: 'magic', raw: b.raw(u, 40, 0, 0.7), via: '충전격', skill: true, noPassive: true }); } } },
    skills: [
      { id: 'tb_s1', name: '뇌격', cost: 40, cd: 8, range: 28, sfx: 'nuke', desc: '전방에 전기를 내려 피해를 줍니다. 4초 안에 다시 시전하면 전기가 내려진 위치로 순간이동합니다.',
        plan: foeIn(28),
        cast(b, u, pl) {
          const t = pl.t, c = { x: t.x, y: t.y }; ring(b, c.x, c.y, 7, '#facc15'); b.emit({ type: 'bolt', x: c.x, y: c.y });
          b.inCircle(b.foes(u), c.x, c.y, 7).forEach(x => hit(b, u, x, 'magic', b.raw(u, 45, 0, 0.85), '뇌격', { splash: true }));
          u.mem.mark = c; b.zone({ x: c.x, y: c.y, r: 2.5, dur: 4, owner: u, kind: 'mark', color: '#facc15' });
          return { recast: 4 };
        },
        recast: { move: true,
          plan: (b, u, en) => { const m = u.mem.mark; return m && b.dist(u, m) > 7 && en.some(e => Math.hypot(e.x - m.x, e.y - m.y) <= 24) ? { m } : null; },
          cast(b, u, pl) { b.blink(u, pl.m.x, pl.m.y); ring(b, u.x, u.y, 6, '#facc15'); b.zones = b.zones.filter(z => !(z.kind === 'mark' && z.owner === u)); } } },
      { id: 'tb_s2', name: '전기발사', cost: 35, cd: 4, range: 30, sfx: 'nuke', desc: '전류포를 발사해 직선상의 적에게 피해를 줍니다.',
        plan: foeIn(30),
        cast(b, u, pl) { const e = lineEnd(b, u, pl.t, 32); beam(b, u, e.x, e.y, 3.5, '#fde047'); b.inLine(b.foes(u), u.x, u.y, e.x, e.y, 3.5).forEach(x => hit(b, u, x, 'magic', b.raw(u, 45, 0, 0.9), '전기발사', { path: true })); } }
    ],
    ult: { id: 'tb_ult', name: '우뢰격', cd: 34, range: 50, sfx: 'nuke', desc: '창을 번개로 만들어 날려 직선상의 적에게 큰 피해를 줍니다. 도착 지점 주변의 넓은 범위의 적들은 경직됩니다.',
      plan: foeIn(50),
      cast(b, u, pl) {
        const t = pl.t, c = { x: t.x, y: t.y }; beam(b, u, c.x, c.y, 4.5, '#fde047'); b.emit({ type: 'bolt', x: c.x, y: c.y });
        b.inLine(b.foes(u), u.x, u.y, c.x, c.y, 4).forEach(x => hit(b, u, x, 'magic', b.raw(u, 110, 0, 1.1), '우뢰격', { path: true }));
        ring(b, c.x, c.y, 14, '#facc15');
        b.inCircle(b.foes(u), c.x, c.y, 14).forEach(x => { hit(b, u, x, 'magic', b.raw(u, 45, 0, 0.5), '우뢰격', { splash: true }); b.cc(u, x, 'stagger', 0.8); });
      } }
  };

  /* ================= 10. 매그넘 ================= */
  FD.magnum = {
    id: 'magnum', name: '매그넘', role: 'warrior', color: '#fb923c', title: '인조인간 로봇병기',
    concept: '"제트엔진출력."',
    stats: { hp: 1060, mp: 200, aspd: 0.85, spd: 7.6, atk: 62, ap: 0, def: 38, res: 30, ten: 0.15, pen: 0.08, ls: 0, range: 6 },
    basic: { type: 'phys', atk: 1, ap: 0, proj: 'melee' }, ai: { front: true, threat: 1.3, style: { engage: true, ult: 'open' } },
    tac: { act: ['rush', 'basic'], fight: ['coop'], pos: ['front'] },
    look: {
  hair: '#475569', skin: '#94a3b8', body: '#334155', acc: '#fb923c', res: 2,
  pal: {
    L: '#94a3b8', M: '#475569', N: '#334155', O: '#1e293b',   // 강철 하이라이트 / 장갑 / 어두운 장갑 / 가장 어두운색
    R: '#ef4444',                                             // 붉은 바이저 눈
    F: '#fb923c', Q: '#fde047', Z: '#38bdf8'                  // 제트 화염 외곽 / 화염 중심 / 푸른 불꽃·가슴 라이트
  },
  rows: [
    '..............LLLL..............',
    'LLLLLL......LMMMMMML......LLLLLL',
    'LMMMMN.....LMMMMMMMML.....NMMMML',
    'LMMMMN....NMMLMMMMLMMN....NMMMML',
    'LMFFMN....NORRRMMRRRON....NMFFML',
    'LMQQMN....NOOOMMMMOOON....NMQQML',
    'LMQQMN....NMMLMMMMLMMN....NMQQML',
    'LMFFMN.....ONNLNNLNNO.....NMFFML',
    'LMFFMNLLLLLLLLLNNLLLLLLLLLNMFFML',
    'LMMMMLMMMMMMNLLLLLLNMMMMMMLMMMML',
    'LMMMMNLLLMMMMMMMMMMMMMMLLLNMMMML',
    'LMMMMNMMOOMMZZMMMMZZMMOOMMNMMMML',
    '.NNNNNMMMMMMZZFFFFZZMMMMMMNNNNN.',
    '.OFFONMMMNNMMMMLLMMMMNNMMMNOFFO.',
    'ZFQQFNLLM.NMLMMMMMMLMN.MLLNFQQFZ',
    '.FQQFNMMM.NMMNMLLMNMMN.MMMNFQQF.',
    '.FQQFNOOM.NMMNMMMMNMMN.MOONFQQF.',
    '..FQFNMMM.NOMMNMMNMMON.MMMNFQF..',
    '..LLLLLLL.NMMNMMMMNMMN.LLLLLLL..',
    '..NLLLLLMLLLLLLNNLLLLLLMLLLLLN..',
    '..NOFFFOMNMFFMNNNNMFFMNMOFFFON..',
    '..NOFQFOMNMMMMMNNMMMMMNMOFQFON..',
    '..NONNNOMNLLLLLNNLLLLLNMONNNON..',
    '...LMLMLMNMMMMMNNMMMMMNMLMLML...',
    '...MLMLMLNMMMMMNNMMMMMNLMLMLM...',
    '...NMNMNMNLMMMM..MMMMLNMNMNMN...',
    '...NMMMMMNMMMMN..NMMMMNMMMMMN...',
    '...NOOOOONMMMMN..NMMMMNOOOOON...',
    '....OFFO.LLLLLL..LLLLLL.OFFO....',
    '...ZFQQFZNMLMMN..NMMLMNZFQQFZ...',
    '....FQQF.NMLMMN..NMMLMN.FQQF....',
    '....FQQF.NMMMMN..NMMMMN.FQQF....',
    '.....FQF.NMLLMN..NMLLMN.FQF.....',
    '.....QF..NMMMMN..NMMMMN..FQ.....',
    '......F.NMMMMMM..MMMMMMN.F......',
    '.......OOOOOOOO..OOOOOOOO.......'
  ]
},
    passive: { name: '제트엔진', desc: '돌진(이동) 스킬 사용 후 4초간 방어력이 25%, 관통력이 20%p 상승합니다.',
      onSkill(b, u, sk) { if (sk.move) b.buff(u, 'jet', 4, { name: '제트엔진', mul: { def: 1.25 }, add: { pen: 0.2 } }); } },
    skills: [
      { id: 'mg_s1', name: '제트버스터', cost: 40, cd: 8, range: 24, move: true, sfx: 'pierce', desc: '전방으로 돌진해 경로의 적에게 피해를 주고 넉백시킵니다.',
        plan: foeIn(24, 6),
        cast(b, u, pl) {
          const ox = u.x, oy = u.y, e = dashTo(b, u, pl.t, 20, -2); b.slide(u, e.x, e.y);
          b.inLine(b.foes(u), ox, oy, u.x, u.y, 5).forEach(x => { hit(b, u, x, 'phys', b.raw(u, 40, 0.9), '제트버스터', { path: true }); b.knock(u, x, 10, { x: ox, y: oy }); });
        } },
      { id: 'mg_s2', name: '제트펀치', cost: 30, cd: 6, range: 10, sfx: 'buff', desc: '5초 안에 다음 기본 공격에 추가 피해를 주고 적을 경직시킵니다.',
        plan: anyIn(10),
        cast(b, u) {
          b.buff(u, 'jetpunch', 5, { name: '제트펀치 준비' });
          u.bm.push({ until: b.t + b.sec(5), once: true, fn(bb, uu, t) { ring(bb, t.x, t.y, 5, '#fb923c'); hit(bb, uu, t, 'phys', bb.raw(uu, 40, 0.8), '제트펀치'); bb.cc(uu, t, 'stagger', 0.7); uu.st = uu.st.filter(s => s.key !== 'jetpunch'); } });
        } }
    ],
    ult: { id: 'mg_ult', tags: ['gapclose', 'control'], name: '제트 오버', cd: 36, range: 200, move: true, sfx: 'dash', desc: '지정한 적에게 거리와 상관없이 날아가 피해를 주고 기절시킵니다.',
      plan: (b, u, en) => { const t = b.lowest(en); return t ? { t } : null; },
      cast(b, u, pl) {
        const t = pl.t, away = u.team === 0 ? -1 : 1; b.blink(u, t.x + away * 4, t.y); ring(b, t.x, t.y, 8, '#fb923c');
        hit(b, u, t, 'phys', b.raw(u, 120, 1.25), '제트 오버'); b.cc(u, t, 'stun', 1.7);
      } }
  };

  /* ================= 11. 아리아 ================= */
  FD.aria = {
    id: 'aria', name: '아리아', role: 'warrior', color: '#f472b6', title: '기동기체 사이보그 전사',
    concept: '"더이상 조종당하고 있지는 않겠어."',
    stats: { hp: 920, mp: 240, aspd: 0.9, spd: 7.8, atk: 54, ap: 40, def: 32, res: 32, ten: 0.10, pen: 0.08, ls: 0, range: 6 },
    basic: { type: 'phys', atk: 1, ap: 0, proj: 'melee' }, ai: { front: true, threat: 1.1, style: {} },
    tac: { act: ['basic'], fight: ['coop', 'support'], pos: ['none', 'front'] },
    form0: 'ground',
    look: {
  hair: '#1f2937', skin: '#fbe0d0', body: '#9ca3af', acc: '#fb923c', res: 2,
  pal: {
    H: '#1f2937', J: '#0b1220', G: '#4b5563',          // 검정 머리 / 머리 음영 / 머리 윤기
    S: '#fbe0d0', D: '#e8b9a3', E: '#0b0f1f', P: '#f472b6',   // 피부 / 음영 / 눈 / 눈동자·입술
    L: '#d1d5db', M: '#9ca3af', N: '#6b7280', O: '#374151',   // 회색 장갑 (밝음 → 어두움)
    K: '#111827', X: '#f3f4f6',                        // 관절 어둠 / 관절 링 하이라이트
    F: '#fb923c', Y: '#fde047'                         // 제트 발광 / 중심광
  },
  rows: [
    '..............HHHH..............',
    '............JHHHHHHJ............',
    '..........JHHHGHHGHHHJ..........',
    '.........JHHGHHHHHHGHHJ.........',
    '.........JHHHSSSSSSHHHJ......LL.',
    '.........JHHSPESSEPSHHJ.....LMMN',
    '.........JHHSSSSSSSSHHJ.....LFFN',
    '.........JHHSDSPPSDSHHJ.....LYYN',
    '.........JHHH.DSSD.HHHJ.....LFFN',
    '........JHHH..SSSS..HHHJ....LMMN',
    '...LLLLLLHHH.NOOOON.HHHLLLLLLMMN',
    '..LMMKKMMJH.NMLOOLMN.HJMMKKMLMMN',
    '..LMKXXKMHJNMMLOOLMMNJHMKXXKNNNN',
    '...NKXN..NMMLLMNNMLLMMN..NXKNLMN',
    '...NMLN..NLLMMMNNMMMLLN..NLMN.MN',
    '...NMMN...NLLMMNNMMLLN...NMMN.MN',
    '...NMLN....NMMMNNMMMN....NLMN.NN',
    '...NMMN....NLMLNNLMLN..NLLLLLLN.',
    '...NMLN....NKOKOOKOKN.NLMMMMMMLN',
    '...NKXN....NOKOOOOKON.NMMXXXXMMN',
    '...NMLN....NKOKOOKOKN.NMMOOOOMMN',
    '...NMLN..NMMLLLOOLLLMMNMOFFFFOMN',
    '...NMMN.NMMLOLMOOMLOLMNMOFYYFOMN',
    '...NMLN.NMKXKMLOOLMKXKNMOFFFFOMN',
    '...NMMN.NMMLLMMOOMMLLMNMMOOOOMMN',
    '...NKKN.NMMLMMN..NMMLMNMMMMMMMMN',
    '...NMMN.NMLOLMN..NMLOLNLMLMLMLMN',
    '....NN..NMMLMMN..NMMLMNMLMLMLMMN',
    '.........NKXKN....NKXKNMXXXXXXMN',
    '.........NMMLMN..NMLMMNNMLLLLMN.',
    '.........NMLLMN..NMLLMNNMMMMMMN.',
    '.........NMOLMN..NMLOMN.NMMMMN..',
    '..........NMMN....NMMN...NNNN...',
    '.........NKXKN....NKXKN.........',
    '........NMMMMMN..NMMMMMN........',
    '.......NNMMMMMN..NMMMMMNN.......'
  ]
},
looks: {
  air: {
    hair: '#1f2937', skin: '#fbe0d0', body: '#9ca3af', acc: '#67e8f9', res: 2,
    pal: {
      H: '#1f2937', J: '#0b1220', G: '#4b5563',
      S: '#fbe0d0', D: '#e8b9a3', E: '#0b0f1f', P: '#f472b6',
      L: '#d1d5db', M: '#9ca3af', N: '#6b7280', O: '#374151',
      K: '#111827', X: '#f3f4f6',
      F: '#fb923c', Y: '#fde047',
      Z: '#67e8f9', W: '#ffffff'                        // 비행 화염(청백)
    },
    rows: [
      '.PP...........HHHH...........PP.',
      'LPPL........JHHHHHHJ........LPPL',
      'LMMNLLL...JHHHGHHGHHHJ...LLLNMML',
      'LOONLMMN.JHHGHHHHHHGHHJ.NMMLNOOL',
      'LMMNLMMN.JHHHSSSSSSHHHJ.NMMLNMML',
      'LOONLMMN.JHHSPESSEPSHHJ.NMMLNOOL',
      'LMMNLFFN.JHHSSSSSSSSHHJ.NFFLNMML',
      'LFFNLFFN.JHHSDSPPSDSHHJ.NFFLNFFL',
      'LYYNLYYN.JHHH.DSSD.HHHJ.NYYLNYYL',
      'LFFNLFFNJHHH..SSSS..HHHJNFFLNFFL',
      'LMMLLLLLLHHH.NOOOON.HHHLLLLLLMML',
      'LMLMMKKMMJH.NMLOOLMN.HJMMKKMMLML',
      'NNLMKXXKMHJNMMLOOLMMNJHMKXXKMLNN',
      'OFFONKXN.NMMLLMNNMLLMMN.NXKNOFFO',
      'ZWWZNMLN.NLLMMMNNMMMLLN.NLMNZWWZ',
      'ZWWZNMMN..NLLMMNNMMLLN..NMMNZWWZ',
      'ZWWZNMLN...NMMMNNMMMN...NLMNZWWZ',
      '.ZWZNMMN...NLMLNNLMLN...NMMNZWZ.',
      '.ZWZNMLN...NKOKOOKOKN...NLMNZWZ.',
      '.ZZ.NKXN...NOKOOOOKON...NXKN.ZZ.',
      '..Z.NMLN...NKOKOOKOKN...NLMN.Z..',
      '....NMMN.NMMLLLOOLLLMMN.NMMN....',
      '....NMLNNMMLOLMOOMLOLMMNNLMN....',
      '....NMMNNMKXKMLOOLMKXKMNNMMN....',
      '....NKKNNMMLLMMOOMMLLMMNNKKN....',
      '....NMMNNMMLMMN..NMMLMMNNMMN....',
      '.....NN.NMLOLMN..NMLOLMN.NN.....',
      '........NMMLMMN..NMMLMMN........',
      '.........NKXKN....NKXKN.........',
      '.........NMMLMN..NMLMMN.........',
      '.........NMLLMN..NMLLMN.........',
      '.........NMOLMN..NMLOMN.........',
      '..........NMMN....NMMN..........',
      '.........NKXKN....NKXKN.........',
      '........NMMMMMN..NMMMMMN........',
      '........NMMMMMN..NMMMMMN........'
    ]
  }
},
    passive: { name: '기동기체 아리아', desc: '스킬을 쓸 때마다 중첩이 쌓이며 스킬 피해량이 6%씩 증가합니다(최대 6중첩). 지상 모드: 방어·저항 +30% / 공중 모드: 이동속도 +30%.',
      init(b, u) { u.mem.n = 0; },
      skillMul(b, u) { return 1 + 0.06 * u.mem.n; },
      onSkill(b, u, sk) { if (sk.id !== 'ar_ult') u.mem.n = Math.min(6, u.mem.n + 1); },
      stat(b, u, k, v) { if (u.form === 'ground' && (k === 'def' || k === 'res')) return v * 1.3; if (u.form === 'air' && k === 'spd') return v * 1.3; return v; },
      tick(b, u) { u.gauge = { label: u.form === 'ground' ? '지상' : '공중', val: u.mem.n, max: 6, color: u.form === 'ground' ? '#f472b6' : '#67e8f9' }; },
      onForm(b, u, form) {
        if (form === 'air') { u.role.range = 22; u.role.kite = 12; u.role.backline = true; u.role.front = false; u.glow = '#67e8f9'; }
        else { u.role.range = 6; u.role.kite = 0; u.role.backline = false; u.role.front = true; u.glow = null; }
      } },
    forms: {
      ground: [
        { id: 'ar_g1', tags: ['control'], name: '아리아-처형', cost: 40, cd: 8, range: 9, sfx: 'nuke', desc: '[지상] 아리아를 꺼내 적을 공격해 피해를 주고 기절시킵니다.',
          plan: foeIn(9),
          cast(b, u, pl) { const t = pl.t; ring(b, t.x, t.y, 6, '#f472b6'); hit(b, u, t, 'phys', b.raw(u, 50, 0.95), '아리아-처형'); b.cc(u, t, 'stun', 1.0); } },
        { id: 'ar_g2', name: '아리아-결집', cost: 40, cd: 9, range: 11, sfx: 'aoe', desc: '[지상] 아리아를 꺼내 땅을 찍어 주변에 피해를 주고 자신 쪽으로 살짝 끌어당깁니다.',
          plan: anyIn(11),
          cast(b, u) { ring(b, u.x, u.y, 12, '#f472b6'); b.inCircle(b.foes(u), u.x, u.y, 12).forEach(e => { hit(b, u, e, 'phys', b.raw(u, 30, 0.7, 0.2), '아리아-결집', { splash: true }); b.knock(u, e, -6, u); }); } }
      ],
      air: [
        { id: 'ar_a1', name: '아리아-요격', cost: 40, cd: 6, range: 34, sfx: 'nuke', desc: '[공중] 미사일 3발을 날려 피해를 줍니다.',
          plan: foeIn(34),
          cast(b, u) {
            const fs = b.foes(u).filter(e => b.dist(u, e) <= 36);
            for (let i = 0; i < 3; i++) { const t = fs[Math.floor(Math.random() * fs.length)]; if (!t) break; b.later(i * 0.18, bb => { if (u.alive && t.alive) { beam(bb, u, t.x, t.y, 2, '#67e8f9'); hit(bb, u, t, 'magic', bb.raw(u, 20, 0.25, 0.4), '아리아-요격', { splash: true }); } }); }
          } },
        { id: 'ar_a2', name: '아리아-열풍', cost: 40, cd: 7, range: 16, sfx: 'aoe', desc: '[공중] 전방에 열풍을 뿜어 피해를 주고 화상(치유량 감소)을 입힙니다.',
          plan: foeIn(16),
          cast(b, u, pl) { cone(b, u, pl.t, 15, 0.7, '#fb923c'); b.inCone(b.foes(u), u, pl.t.x, pl.t.y, 15, 0.7).forEach(e => { hit(b, u, e, 'magic', b.raw(u, 34, 0.1, 0.7), '아리아-열풍', { splash: true }); b.cc(u, e, 'burn', 4); }); } }
      ]
    },
    ult: { id: 'ar_ult', name: '운용변환', cd: 6.5, timed: true, range: 60, sfx: 'buff', desc: '아리아의 모드를 변환합니다. 지상 모드에서는 방어력·저항력이, 공중 모드에서는 이동속도가 상승합니다.',
      plan: (b, u, en, al, strict) => {
        const n = b.nearest(u, en); if (!n) return null; const d = b.dist(u, n), to = u.form === 'ground' ? 'air' : 'ground';
        if (!strict) return { to };
        if (u.form === 'ground') return (u.hp < u.maxHp * 0.5 && d < 16) || d > 30 ? { to } : null;
        return d < 9 && u.hp > u.maxHp * 0.45 ? { to } : null;
      },
      cast(b, u, pl) { b.setForm(u, pl.to); ring(b, u.x, u.y, 9, pl.to === 'air' ? '#67e8f9' : '#f472b6'); } }
  };

  /* ================= 12. 팹멘 ================= */
  FD.fabman = {
    id: 'fabman', name: '팹멘', role: 'warrior', color: '#ef4444', title: '맨손의 격투가 히어로',
    concept: '"영웅 등장이요!"',
    stats: { hp: 1060, mp: 180, aspd: 1.0, spd: 8.2, atk: 64, ap: 0, def: 38, res: 30, ten: 0.15, pen: 0.08, ls: 0, range: 6 },
    basic: { type: 'phys', atk: 1, ap: 0, proj: 'melee' }, ai: { front: true, threat: 1.2, style: { peel: true, stick: 'carry', ult: 'save' } },
    tac: { act: ['rush', 'basic'], fight: ['support', 'coop'], pos: ['front'] },
    look: {
  hair: '#1e2a4a', skin: '#e6b89c', body: '#1e2a4a', acc: '#b91c1c', res: 2,
  pal: {
    N: '#1e2a4a', n: '#141c33',                       // 남색 슈트 / 어두운 남색
    G: '#6b7280', g: '#8b93a1',                       // 회색 소매·복근 / 하이라이트
    R: '#7f1d1d', r: '#b91c1c',                       // 암적색 파이핑 / 밝은 붉은색(엠블럼 주먹)
    M: '#5b1a2a', m: '#7a2638',                       // 와인색 장갑·부츠 / 하이라이트
    K: '#151a2b', O: '#3a4150',                       // 벨트 / 파우치
    S: '#e6b89c', D: '#b9826a', E: '#0b0f1f'          // 턱 피부 / 입 / 눈
  },
  rows: [
    '............NNNNNNNN............',
    '...........NRNNNNNNRN...........',
    '..........NRRNNNNNNRRN..........',
    '.........NNRRNNNNNNRRNN.........',
    '.........NNNEENNNNEENNN.........',
    '.........NNNNNNNNNNNNNN.........',
    '.........NNSSSSSSSSSSNN.........',
    '.........NNSSDDDDDDSSNN.........',
    '..........NSSSSSSSSSSN..........',
    '...........NNNNNNNNNN...........',
    '.......NNNNNNNNNNNNNNNNNN.......',
    '.NNNNNNNNNRRRRRRRRRRRRNNNNNNNNN.',
    '.NNNNNNNNNNNNNNNNNNNNNNNNNNNNNN.',
    '.NNNNNNNNRRRRRRRRRRRRRRNNNNNNNN.',
    '.NRGGGGGNRRnnrrrrrrnnRRNGGGGGRN.',
    '.NRGgGGGNRRnnrrrrrrnnRRNGGGgGRN.',
    '.NRGGGGGNRNRnnrrrrnnRNRNGGGGGRN.',
    '.NRGGgGGNRNNRnnrrnnRNNRNGGgGGRN.',
    '.NRGGGGGNRNNNNNRRNNNNNRNGGGGGRN.',
    '.NRGGGGNNNRGGGGnnGGGGRNNNGGGGRN.',
    '.NRGgGGN.NRgGGGnnGGGgRN.NGGgGRN.',
    '..NRGGGN.NRGGGGnnGGGGRN.NGGGRN..',
    '..NRGGGN.NRGgGGnnGGgGRN.NGGGRN..',
    '..NRGGGN.KKKKKKKKKKKKKK.NGGGRN..',
    '..NRGgGN.KOOKKRRRRKKOOK.NGgGRN..',
    '..MMMMMM.KKKKKKKKKKKKKK.MMMMMM..',
    '.MMmMMMMNRNNNNNNNNNNNNRNMMMMmMM.',
    '.MMMMMMMNRNNNNN..NNNNNRNMMMMMMM.',
    '..MMMMM.NRNNNNN..NNNNNRN.MMMMM..',
    '........NRNNNNN..NNNNNRN........',
    '........NRnNNNn..nNNNnRN........',
    '.........NRNNNn..nNNNRN.........',
    '.........NRNNNn..nNNNRN.........',
    '.........MMMMMM..MMMMMM.........',
    '.......MMMMMMMM..MMMMMMMM.......',
    '......MMMMMMMMM..MMMMMMMMM......'
  ]
},
    passive: { name: '체술', desc: '디버프(상태이상)에 걸려 있는 동안 저항력이 35% 상승합니다.',
      stat(b, u, k, v) { return k === 'res' && u.st.some(s => s.good === false && s.key !== 'knock') ? v * 1.35 : v; } },
    skills: [
      { id: 'fb_s1', name: '파쇄권', cost: 35, cd: 7, range: 9, sfx: 'nuke', desc: '전방을 주먹으로 쳐 피해를 주고 넉백시킵니다.',
        plan: foeIn(9),
        cast(b, u, pl) { cone(b, u, pl.t, 9, 0.7, '#ef4444'); b.inCone(b.foes(u), u, pl.t.x, pl.t.y, 9, 0.7).forEach(e => { hit(b, u, e, 'phys', b.raw(u, 50, 1.0), '파쇄권', { splash: true }); b.knock(u, e, 8); }); } },
      { id: 'fb_s2', name: '금강불괴', cost: 40, cd: 14, range: 12, sfx: 'shield', desc: '1.5초간 무적 상태가 됩니다.',
        plan: (b, u, en) => (en.some(e => b.dist(u, e) <= 12) && (u.hp < u.maxHp * 0.6 || b.t - u.hitT < 10) ? {} : null),
        cast(b, u) { b.buff(u, 'invuln', 1.5, { name: '금강불괴', f: { invuln: true } }); } }
    ],
    ult: { id: 'fb_ult', name: '영웅등장', cd: 38, range: 200, move: true, sfx: 'aoe', desc: '하늘로 솟아올라 아군 위치로 낙하합니다. 아군에게 보호막을 씌우고 주변 적에게 피해를 주며 넉백시킵니다.',
      plan: (b, u, en, al, strict) => {
        const others = al.filter(a => a !== u); const pool = others.length ? others : [u];
        const a = b.lowest(pool); if (strict && !en.some(e => Math.hypot(e.x - a.x, e.y - a.y) <= 40)) return null;
        return { a };
      },
      cast(b, u, pl) {
        const a = pl.a; b.buff(u, 'hero_air', 0.9, { name: '상승', good: true, f: { hidden: true, invuln: true, stun: true } });
        const x = a.x, y = a.y;
        b.later(0.9, bb => {
          if (!u.alive) return; const ax = a.alive ? a.x : x, ay = a.alive ? a.y : y; bb.blink(u, ax, ay); ring(bb, u.x, u.y, 12, '#ef4444');
          bb.inCircle(bb.friends(u), u.x, u.y, 12).forEach(f => bb.shield(u, f, 110 + 0.6 * bb.eff(u, 'atk'), 4, '영웅등장'));
          bb.inCircle(bb.foes(u), u.x, u.y, 12).forEach(e => { hit(bb, u, e, 'phys', bb.raw(u, 80, 1.0), '영웅등장', { splash: true }); bb.knock(u, e, 10); });
        });
      } }
  };

  /* ================= 13. 카인 ================= */
  const frost = (b, u, t, n) => { if (!t.alive) return; t.mem.frost = (t.mem.frost || 0) + n; if (t.mem.frost >= 3) { t.mem.frost = 0; b.cc(u, t, 'freeze', 1.6); } };
  FD.kain = {
    id: 'kain', name: '카인', role: 'mage', color: '#7dd3fc', title: '얼음 마법사',
    concept: '"마지막남은 내 가족..내가 지켜야해..."',
    stats: { hp: 690, mp: 320, aspd: 0.85, spd: 7.4, atk: 25, ap: 56, def: 20, res: 28, ten: 0, pen: 0.12, ls: 0, range: 24 },
    basic: { type: 'magic', atk: 0.6, ap: 0.45, proj: 'bolt' }, ai: { backline: true, kite: 14, threat: 0.85, style: { ult: 'open' } },
    tac: { act: ['basic', 'retreat'], fight: ['coop'], pos: ['none', 'cover'], aim: ['carry', 'near'] },
    look: {
  res: 2,
  pal: {
    B: '#0e7490', b: '#0a5568', A: '#7dd3fc',                  // 코트 / 코트 음영 / 하늘색 포인트
    F: '#cfe1ef', f: '#93b5cf',                                // 흰 모피 / 모피 음영
    H: '#ffffff', h: '#c4def2',                                // 흰 머리 / 머리 음영
    S: '#ffe3d1', s: '#ecbfa0', E: '#101428', I: '#38bdf8',   // 피부 / 피부 음영 / 눈선 / 홍채
    p: '#ffb3c7', P: '#e87fa0',                                // 볼터치 / 입술
    Q: '#f0ffff', C: '#a5f3fc', c: '#22a6d6',                  // 결정 하이라이트 / 본체 / 음영
    T: '#b9c8dd', t: '#6b7fa0',                                // 봉 / 봉 음영
    L: '#cfe9f7', l: '#8fbdd6', D: '#164e63'                   // 타이츠 / 타이츠 음영 / 부츠
  },
  rows: [
    '......................QQ........',
    '.....................cQQc.......',
    '....................cCQQCc......',
    '...................cCCQQCCc.....',
    '..................AcCCQQCCcA....',
    '.........BBBB......cCCQQCCc.....',
    '.......BBBBBBBB.....cCQQCc......',
    '......BFFFFFFFFB.....cQQc.......',
    '......BFHHhhHHFB......QQ........',
    '......BFHSSSSHFB.....tAAt.......',
    '......BFEESSEEFB......Tt........',
    '......BFSISSISFB......Tt........',
    '......BFpSSSSpFB......Tt........',
    '......BFSSPPSSFB......Tt........',
    '......BFFsSSsFFB......Tt........',
    '.....FfFFFFFFFFfF.....Tt........',
    '....FFHHBBBBBBHHFF....Tt........',
    '....BFHhBBAABBhHFB....Tt........',
    '....bBHHBBAABBHHBB....Tt........',
    '....bBHhBBAABBhHBBB...Tt........',
    '....bBhhBBAABBhhBBBBB.Tt........',
    '....fFBhBBAABBhBBBBBBfFFf.......',
    '....fFBAAAQQAAABBb...fFFf.......',
    '.....BBBBBAABBBBB.....Tt........',
    '....BBBBBBAABBBBBB....Tt........',
    '....BBBABBAABBABBB....Tt........',
    '...bBBBBBBAABBBBBBb...Tt........',
    '...bBBABBBAABBBABBb...Tt........',
    '..FFFFFFFFFFFFFFFFFF..Tt........',
    '...fFfFfFfFfFfFfFfF...Tt........',
    '.......LLl..lLL.......Tt........',
    '.......LLl..lLL.......Tt........',
    '.......LLl..lLL.......Tt........',
    '......FFFF..FFFF......Tt........',
    '......DDDD..DDDD......Tt........',
    '.....DDDDD..DDDDD.....tt........'
  ]
},
    passive: { name: '분쇄', desc: '빙결 상태인 적에게 스킬이 적중하면 추가 피해를 줍니다.',
      onDealt(b, u, t, res, o) { if (o.skill && t.alive && t.st.some(s => s.key === 'freeze')) { ring(b, t.x, t.y, 4, '#e0f2fe'); b.deal(u, t, { type: 'magic', raw: b.raw(u, 28, 0, 0.35), via: '분쇄', noPassive: true, noLeech: true }); } } },
    skills: [
      { id: 'kn_s1', name: '냉기방출', cost: 50, cd: 8, range: 16, sfx: 'aoe', desc: '1.2초간 전방에 냉기를 방출해 피해를 줍니다. 일정량 맞은 적은 빙결됩니다.',
        plan: foeIn(16),
        cast(b, u, pl) {
          b.buff(u, 'channel', 1.2, { name: '냉기방출', f: { channel: true }, quiet: true });
          [0.15, 0.45, 0.75, 1.05].forEach(s => b.later(s, bb => {
            if (!u.alive || !bb.has(u, 'channel')) return; const t = bb.nearest(u, bb.foes(u)); if (!t) return;
            cone(bb, u, t, 17, 0.55, '#7dd3fc');
            bb.inCone(bb.foes(u), u, t.x, t.y, 17, 0.55).forEach(e => { hit(bb, u, e, 'magic', bb.raw(u, 14, 0, 0.32), '냉기방출', { splash: true }); frost(bb, u, e, 1); });
          }));
        } },
      { id: 'kn_s2', name: '빙결화', cost: 35, cd: 4, range: 14, sfx: 'nuke', desc: '가까운 거리에 얼음송곳을 날려 피해를 주고 둔화시킵니다.',
        plan: foeIn(14),
        cast(b, u, pl) { const e = lineEnd(b, u, pl.t, 16); beam(b, u, e.x, e.y, 3.2, '#e0f2fe'); b.inLine(b.foes(u), u.x, u.y, e.x, e.y, 3.2).forEach(x => { hit(b, u, x, 'magic', b.raw(u, 50, 0, 0.9), '빙결화', { path: true }); b.cc(u, x, 'slow', 1.5, { amt: 0.25 }); frost(b, u, x, 1); }); } }
    ],
    ult: { id: 'kn_ult', name: '얼음 폭격', cd: 36, range: 40, sfx: 'aoe', desc: '4초간 위에서 얼음을 쏟아부어 넓은 범위에 피해를 줍니다. 일정량 맞은 적은 빙결됩니다.',
      plan: (b, u, en) => clusterPick(b, u, en, 40, 16),
      cast(b, u, pl) {
        const c = { x: pl.t.x, y: pl.t.y };
        b.zone({ x: c.x, y: c.y, r: 16, dur: 4.6, owner: u, kind: 'ice', color: '#7dd3fc', every: 0.4,
          onTick(z, bb) { if (bb.t < z.t0 + 10) return; bb.inCircle(bb.foes(u), z.x, z.y, z.r).forEach(e => { hit(bb, u, e, 'magic', bb.raw(u, 16, 0, 0.3), '얼음 폭격', { splash: true }); frost(bb, u, e, 1); }); } });
      } }
  };

  /* ================= 14. 하이어 ================= */
  FD.hyer = {
    id: 'hyer', name: '하이어', role: 'mage', color: '#fde68a', title: '버프의 고위 마법사',
    concept: '"무엇이 문제인가?"',
    stats: { hp: 700, mp: 340, aspd: 0.8, spd: 7.4, atk: 28, ap: 62, def: 22, res: 32, ten: 0.10, pen: 0.08, ls: 0, range: 22 },
    basic: { type: 'magic', atk: 0.5, ap: 0.4, proj: 'bolt' }, ai: { backline: true, kite: 12, threat: 0.8, style: { peel: true, stick: 'carry', ult: 'save' } },
    tac: { act: ['retreat', 'basic'], fight: ['support'], pos: ['cover'], ult: ['clutch', 'normal'] },
    look: { pal: { y: '#fde047', Y: '#f59e0b', w: '#fefce8', c: '#67e8f9', e: '#1e1b4b', o: '#fef3c7', q: '#a5f3fc' },
      rows: [
        '....yyyyyyyy....',
        '...y.yyyyyy.y...',
        '...y.yyyyyy.y...',
        '....yyyyyyyy....',
        '.....wwwwww.....',
        '....wwwwwwww....',
        '...wwccccccww...',
        '...wwceeeecww...',
        '...wwccccccww...',
        '....wwwwwwww....',
        '.y..wwooooww..y.',
        '.yy.wooYYoow.yy.',
        '..y.wYYYYYYw.y..',
        '....wYYYYYYw....',
        '....owYYYYwo....',
        '.....owYYwo.....',
        '......owwo......',
        '.......oo.......'],
      weapon: '' },
    passive: { name: '불가침', desc: '받는 상태이상의 지속시간이 대폭(약 절반) 줄어듭니다.',
      stat(b, u, k, v) { return k === 'ten' ? 1 - (1 - v) * 0.5 : v; } },
    skills: [
      { id: 'hy_s1', name: '코스믹에너지', cost: 40, cd: 5, range: 30, sfx: 'nuke', sup: true, desc: '전방에 에너지를 쏴 적에게 피해를 줍니다. 아군이 맞으면 체력을 회복합니다.',
        plan: (b, u, en, al) => {
          const t = b.nearest(u, en.filter(e => b.dist(u, e) <= 30)); if (t) return { t };
          const a = b.lowest(al.filter(x => x !== u && x.hp < x.maxHp * 0.6 && b.dist(u, x) <= 30)); return a ? { t: a } : null;
        },
        cast(b, u, pl) {
          const e = lineEnd(b, u, pl.t, 32); beam(b, u, e.x, e.y, 4, '#fde047');
          b.inLine(b.foes(u), u.x, u.y, e.x, e.y, 4).forEach(x => hit(b, u, x, 'magic', b.raw(u, 40, 0, 0.75), '코스믹에너지', { path: true }));
          b.inLine(b.friends(u).filter(a => a !== u), u.x, u.y, e.x, e.y, 4).forEach(a => b.heal(u, a, b.raw(u, 40, 0, 0.8), '코스믹에너지'));
        } },
      { id: 'hy_s2', name: '코스믹 베리어', cost: 50, cd: 9, range: 30, sfx: 'shield', desc: '잠시 아군에게 보호막을 제공합니다. 보호막이 유지되는 동안 공격력과 주문력이 상승합니다.',
        plan: (b, u, en, al) => {
          if (!en.some(e => b.dist(u, e) <= 40)) return null;
          const l = al.filter(a => b.dist(u, a) <= 30 && !a.st.some(s => s.key === 'shield_코스믹 베리어')); const a = b.lowest(l); return a ? { a } : null;
        },
        cast(b, u, pl) { const a = pl.a; b.shield(u, a, b.raw(u, 80, 0, 0.9), 4.5, '코스믹 베리어'); b.buff(a, 'cosmic_b', 4.5, { name: '코스믹 베리어', mul: { atk: 1.15, ap: 1.15 } }); ring(b, a.x, a.y, 6, '#fde047'); } }
    ],
    ult: { id: 'hy_ult', name: '각성', cd: 40, range: 30, sfx: 'shield', desc: '잠시 자신과 주변 아군을 무적 상태로 만듭니다.',
      plan: (b, u, en, al, strict) => {
        if (!en.some(e => b.dist(u, e) <= 35)) return null;
        if (!strict) return {}; return al.some(a => a.hp < a.maxHp * 0.4) ? {} : null;
      },
      cast(b, u) { ring(b, u.x, u.y, 20, '#fde047'); b.inCircle(b.friends(u), u.x, u.y, 20).forEach(a => b.buff(a, 'invuln', 2.5, { name: '각성', f: { invuln: true } })); } }
  };

  CONFIG.fighterOrder = ['deathkaiser', 'alien', 'crow', 'swordsaint', 'sarcoza', 'warrior', 'dash', 'wind', 'thunderbolt', 'magnum', 'aria', 'fabman', 'kain', 'hyer'];
  CONFIG.fighterOrder.forEach(id => { const f = FD[id], R = CONFIG.roles[f.role]; f.icon = R.icon; f.roleName = R.name; });
})();
