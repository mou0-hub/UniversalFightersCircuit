const Feedback = (() => {
  const CAP = 0.3, STEP = 0.4, DECAY = 0.87, SEASON = 0.35, DROP = 0.1;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = { sel: 0, from: '', text: '', pending: null };

  const AX = {
    bold: { name: '교전 적극성', hi: '더 과감하게', lo: '더 조심스럽게', fx: [['brain', 'ratio', 'mul', 1], ['brain', 'retreatHp', 'mul', -0.5]] },
    chase: { name: '추격', hi: '더 끈질기게 추격', lo: '추격 줄이기', fx: [['brain', 'chaseT', 'mul', 1], ['brain', 'leash', 'mul', 1]] },
    retreat: { name: '후퇴 시점', hi: '더 일찍 후퇴', lo: '더 오래 버티기', fx: [['brain', 'retreatHp', 'mul', 1]] },
    skill: { name: '스킬 회전', hi: '스킬 빠르게', lo: '스킬 아끼기', fx: [['brain', 'skillPatience', 'mul', -1], ['brain', 'recastHold', 'mul', -0.5]] },
    ult: { name: '궁극기', hi: '궁 빠르게', lo: '궁 아끼기', fx: [['brain', 'ultWait', 'mul', -1]] },
    heal: { name: '회복 장치', hi: '더 자주 이용', lo: '덜 이용', fx: [['brain', 'podRun', 'mul', 1]] },
    obj: { name: '코어·보스', hi: '더 챙기기', lo: '전투 위주', fx: [['sn', 'o', 'add', 1]] },
    team: { name: '팀 합류', hi: '동료와 더 뭉치기', lo: '독립적으로', fx: [['sn', 't', 'add', 1], ['brain', 'assist', 'add', 1]] },
    finish: { name: '마무리', hi: '막타 노리기', lo: '막타 덜 노리기', fx: [['brain', 'finish', 'add', 1]] },
    aim: { name: '스킬 정확도', hi: '더 정확하게', lo: '정확도 완화', fx: [['brain', 'whiff', 'add', -1]] },
    judge: { name: '침착한 판단', hi: '더 침착하게', lo: '더 즉흥적으로', fx: [['sn', 'j', 'add', 1]] },
    react: { name: '타겟 전환', hi: '더 빠르게 전환', lo: '타겟 유지', fx: [['brain', 'retargetMul', 'mul', -1], ['sn', 'r', 'add', 1]] },
    posn: { name: '위치 선정', hi: '더 안전한 위치', lo: '더 앞쪽 위치', fx: [['sn', 'p', 'add', 1]] }
  };
  const KN = { ratio: '교전 허용', retreatHp: '후퇴 체력', chaseT: '추격 시간', leash: '추격 거리', skillPatience: '스킬 대기', recastHold: '재시전 대기', ultWait: '궁 대기', podRun: '회복 이동', assist: '지원', finish: '마무리', whiff: '빗나감', retargetMul: '전환 속도', o: '목표 의식', t: '팀워크', j: '판단', p: '위치', r: '반응' };
  const PCT = ['retreatHp', 'assist', 'finish', 'whiff'];
  const fmt = (k, v) => PCT.includes(k) ? Math.round(v * 100) + '%' : ['o', 't', 'j', 'p', 'r'].includes(k) ? v.toFixed(2) : v.toFixed(1);

  // [주제, 표현, 항목, 방향, 불만(0 보통 / 1 그 자체가 불만 / 2 항상 그대로)]
  const R = [
    [null, /소극|겁|몸을? ?사|방어적|수비적|움츠/, 'bold', -1, 1],
    [null, /무모|무리(?:해|하게|한)|막 ?싸|덤비|돌격/, 'bold', 1, 1],
    [null, /공격적|과감|적극|들이대|밀어붙|저돌|용감|앞장/, 'bold', 1, 0],
    [null, /조심|안전하게|신중하게 싸/, 'bold', -1, 0],
    [null, /쫓|추격|따라가|집요/, 'chase', 1, 0],
    [null, /죽(?!이|여)|데스/, 'retreat', 1, 2],
    [null, /버티|끝까지 싸|안 ?빠|안 ?도망|물러나지/, 'retreat', -1, 0],
    [null, /후퇴|도망|빠지|빠져|피하|살아남|체력 ?관리/, 'retreat', 1, 0],
    [/스킬|기술/, /아끼|아껴|모아|늦게|천천히/, 'skill', -1, 0],
    [/스킬|기술/, /낭비|남발|난사/, 'skill', 1, 1],
    [/스킬|기술/, /빨리|바로|자주|연속|쿨|회전|많이|써|쓰|사용/, 'skill', 1, 0],
    [/궁극|궁(?!금)|얼티|ult/i, /아끼|아껴|모아|늦게|타이밍|신중|천천히/, 'ult', -1, 0],
    [/궁극|궁(?!금)|얼티|ult/i, /낭비|남발/, 'ult', 1, 1],
    [/궁극|궁(?!금)|얼티|ult/i, /빨리|바로|자주|많이|써|쓰/, 'ult', 1, 0],
    [/힐|회복|팩|장치/, /덜|적게/, 'heal', -1, 0],
    [/힐|회복|팩|장치/, /챙|먹|활용|이용|들러|가|쓰|많이|자주/, 'heal', 1, 0],
    [/코어|보스|제출|오브젝트|목표|점수/, /놓치|무시|방치|소홀|안 ?챙|못 ?챙/, 'obj', -1, 1],
    [/코어|보스|제출|오브젝트|목표|점수/, /챙|집중|우선|신경|먹|잡|가져|운반|수집|제출|노려/, 'obj', 1, 0],
    [null, /혼자|단독|따로|고립|튀/, 'team', -1, 1],
    [null, /같이|합류|뭉|붙어|함께|모여|팀플|협력|동료|아군/, 'team', 1, 0],
    [null, /마무리|막타|처치|딸피|(?<!스)킬/, 'finish', 1, 0],
    [null, /빗나|헛|못 ?맞/, 'aim', 1, 1],
    [null, /정확|명중|조준|에임|스킬샷/, 'aim', 1, 0],
    [null, /성급|급하|충동|흥분/, 'judge', -1, 1],
    [null, /침착|신중|판단|냉정|눈치|상황/, 'judge', 1, 0],
    [/타겟|대상|딜/, /고정|집착|유지|끈질/, 'react', -1, 0],
    [/타겟|대상|딜/, /바꾸|바꿔|전환|유연|빨리|옮/, 'react', 1, 0],
    [null, /앞으로|전진|앞에/, 'posn', -1, 0],
    [null, /위치|포지션|거리 ?(?:유지|조절|벌)|뒤에서|뒤로|안전거리|카이팅|카이트/, 'posn', 1, 0]
  ];
  const WISH = /했으면|하면 좋|해줘|해 줘|해라|해봐|하자|하도록|해주세요|해 주세요|으로 해|게 해|으면 해|길 바|부탁|더 |좀 더/;
  const COMP = /너무|지나치|과하|과도|지 ?마(?:라|요)?|말아|그만|줄여|줄이|[았었했였쳤]|해서|던데|더라|네$|네요|아쉬|문제|답답|지$/;

  function parse(text) {
    const out = {};
    String(text).split(/[.!?\n,~]+|말고|대신|지만|는데|면서|그리고/).forEach(raw => {
      const c = raw.trim(); if (c.length < 2) return;
      const mul = /많이|훨씬|확실히|꼭|제발|매우|엄청|완전/.test(c) ? 1.8 : /조금|살짝|약간|좀만/.test(c) ? 0.5 : 1;
      const wish = WISH.test(c) && !/지 ?마|너무/.test(c), seen = {};
      for (const [subj, q, ax, d, inh] of R) {
        if (seen[ax] || (subj && !subj.test(c)) || !q.test(c)) continue;
        seen[ax] = 1;
        const comp = inh === 2 ? false : !wish && (inh === 1 || COMP.test(c)), o = out[ax] || (out[ax] = { d: 0, text: c.slice(0, 40) });
        o.d += (comp ? -d : d) * mul; if (o.text !== c.slice(0, 40)) o.text += ' / ' + c.slice(0, 20);
      }
      if (/(체력|피|hp).{0,6}(없|낮|떨어|적|부족|위험|빠지)/i.test(c) && out.bold && out.bold.d < 0 && !seen.retreat) { const o = out.retreat || (out.retreat = { d: 0, text: c.slice(0, 40) }); o.d += mul; }
    });
    return Object.keys(out).filter(k => out[k].d).map(k => ({ ax: k, d: clamp(out[k].d, -2, 2), text: out[k].text }));
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

  function apply(u, fb) {
    const L = CONFIG.brain.stat.limits, rep = []; u.fbBase = {};
    for (const ax in fb.a) {
      const e = fb.a[ax], A = AX[ax]; if (!A || !e.v) continue;
      let first = null;
      for (const [tg, k, mode, sg] of A.fx) {
        const o = tg === 'sn' ? u.sn : u.brain, b = o[k]; if (b == null) continue;
        const lim = tg === 'sn' ? [-1, 1] : L[k], id = tg + k, base = id in u.fbBase ? u.fbBase[id] : (u.fbBase[id] = b);
        const span = tg === 'sn' ? 1 : (lim ? lim[1] - lim[0] : 1), room = mode === 'mul' ? Math.abs(base) * CAP : CAP * span;
        let n = mode === 'mul' ? b * (1 + CAP * e.v * sg) : b + CAP * e.v * sg * span;
        n = clamp(n, base - room, base + room); if (lim) n = clamp(n, lim[0], lim[1]);
        o[k] = n; if (!first) first = [k, b, n];
      }
      if (ax === 'obj') { if (e.v >= 0.5) u.brain.ensureBoss = true; else if (e.v <= -0.5) u.brain.ensureBoss = false; }
      rep.push({ ax, v: e.v, text: e.text, d: first ? `${KN[first[0]]} ${fmt(first[0], first[1])}→${fmt(first[0], first[2])}` : '' });
    }
    if (u.dg) { u.dg.j = u.sn.j; u.dg.team = u.sn.t; u.dg.posn = u.sn.p; }
    if (rep.length) u.fbApplied = rep;
  }

  function afterMatch(g, res, M, notes) {
    const s = st(g), lines = [];
    res.units.filter(u => u.team === M.pIdx).forEach(u => {
      const id = g.club.lineup[u.slot], e = id && s.p[id]; if (!e) return;
      if (u.fb) lines.push(`🧠 ${u.nick || nick(g, id)} 피드백 적용됨 — ` + u.fb.map(r => `${AX[r.ax].name} ${r.v > 0 ? '▲' : '▼'}${Math.round(Math.abs(r.v) * 100)}% (${r.d})`).join(' · '));
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

  function css() {
    if (document.getElementById('fbCss')) return;
    const t = document.createElement('style'); t.id = 'fbCss';
    t.textContent = `.fb-panel{margin-top:14px}.fb-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.fb-head h3{margin:0}.fb-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-top:10px}.fb-card{padding:10px;border-radius:10px;background:rgba(255,255,255,.05)}.fb-card h4{margin:0 0 6px;display:flex;justify-content:space-between;align-items:center}.fb-card ul{list-style:none;margin:0;padding:0}.fb-card li{margin:6px 0;font-size:13px}.fb-card li small{display:block;opacity:.7}.fb-bar{height:5px;border-radius:3px;background:rgba(255,255,255,.12);margin-top:3px}.fb-bar i{display:block;height:100%;border-radius:3px;background:#6cf}.fb-bar i.dn{background:#f96}.fb-x{background:none;border:0;color:inherit;opacity:.6;cursor:pointer}.fb-tabs{display:flex;gap:6px;margin:10px 0}.fb-tabs .btn.on{outline:2px solid #6cf}.fb-modal textarea{width:100%;box-sizing:border-box;min-height:80px;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.3);color:inherit;font:inherit}.fb-ex{font-size:12px;opacity:.7;margin:6px 0}`;
    document.head.appendChild(t);
  }

  function listHTML(g, id, withX) {
    const e = st(g).p[id], ks = e ? Object.keys(e) : [];
    if (!ks.length) return '<p class="note">반영 중인 피드백이 없습니다.</p>';
    return `<ul>${ks.map(ax => { const r = e[ax], A = AX[ax], up = r.v > 0; return `<li><b>${A.name}</b> ${up ? '▲' : '▼'} ${up ? A.hi : A.lo} <small>“${esc(r.text)}”</small><div class="fb-bar"><i class="${up ? '' : 'dn'}" style="width:${Math.round(Math.abs(r.v) * 100)}%"></i></div>${withX ? `<button class="fb-x" data-act="fbDel" data-id="${id}" data-ax="${ax}" title="이 항목 지우기">✕</button>` : ''}</li>`; }).join('')}</ul>`;
  }

  function panel(g) {
    if (!g || !g.club || !g.club.lineup) return '';
    css(); sync(g);
    const cards = g.club.lineup.filter(Boolean).map(id => `<div class="fb-card"><h4>${esc(nick(g, id))}<button class="btn small ghost" data-act="fbResetOne" data-id="${id}">초기화</button></h4>${listHTML(g, id, true)}</div>`).join('');
    return `<section class="glass panel fb-panel"><div class="fb-head"><h3>🧠 AI 피드백 학습 · 현재 반영된 피드백</h3><div><button class="btn small primary" data-act="fbOpen">피드백 쓰기</button> <button class="btn small ghost" data-act="fbResetAll">전체 초기화</button></div></div>
      <p class="note">선수별로 적은 피드백대로 다음 경기부터 AI가 움직입니다. 항목당 최대 ±30%, 경기마다 약해져 5경기면 절반, 시즌이 바뀌면 크게 줄고, 선수단이 많이 바뀌면 초기화됩니다. 같은 불만을 다시 적으면 강해집니다.</p><div class="fb-cards">${cards || '<p class="empty">라인업을 먼저 채워주세요.</p>'}</div></section>`;
  }

  function pendHTML() {
    return `<div class="fb-card" style="margin:8px 0"><h4>이렇게 이해했어요 — 맞는지 확인하세요</h4><ul>${S.pending.map((it, i) => { const A = AX[it.ax], up = it.d > 0; return `<li><b>${A.name}</b> ${up ? '▲' : '▼'} ${up ? A.hi : A.lo} <button class="fb-x" data-act="fbFlip" data-i="${i}" title="방향 반대로">⇄ 반대로</button><button class="fb-x" data-act="fbDrop" data-i="${i}" title="이 항목 빼기">✕</button></li>`; }).join('')}</ul></div>`;
  }
  function render() {
    const g = Game.G, lu = g.club.lineup, id = lu[S.sel] || lu.find(Boolean);
    css();
    const tabs = lu.map((pid, i) => pid ? `<button class="btn small ${i === S.sel ? 'on' : ''}" data-act="fbPick" data-i="${i}">${esc(nick(g, pid))}</button>` : '').join('');
    UI.modal(`<h2>💬 선수 피드백</h2><p class="note">타자로 적으면 AI가 키워드를 읽어 다음 경기부터 반영합니다.</p><div class="fb-tabs">${tabs}</div>
      ${S.pending ? pendHTML() : ''}<textarea id="fbText" maxlength="150" placeholder="예) 너무 무리해서 싸우다 죽어. 스킬 좀 아껴 쓰고 힐팩 챙겨줘">${esc(S.text)}</textarea>
      <p class="fb-ex">쓸 수 있는 주제: 공격성 · 추격 · 후퇴 · 스킬 · 궁극기 · 회복 장치 · 코어/보스 · 동료 합류 · 마무리 · 정확도 · 침착함 · 타겟 전환 · 위치</p>
      <h4>${esc(nick(g, id))} — 현재 반영 중</h4>${listHTML(g, id, false)}
      <div class="modal-actions">${S.pending ? '<button class="btn primary" data-act="fbApply">이대로 적용</button><button class="btn" data-act="fbCancel">다시 쓰기</button>' : '<button class="btn primary" data-act="fbSend">보내기</button>'}<button class="btn" data-act="fbBack">${S.from === 'result' ? '← 결과로' : '닫기'}</button></div>`, 'fb-modal', S.from !== 'result');
  }

  const grab = () => { const t = document.getElementById('fbText'); if (t) S.text = t.value; };
  const actions = {
    fbOpen(el) { S.pending = null; S.from = (el && el.dataset && el.dataset.from) || ''; S.text = ''; const lu = Game.G.club.lineup; if (!lu[S.sel]) S.sel = Math.max(0, lu.findIndex(Boolean)); render(); },
    fbPick(el) { grab(); S.pending = null; S.sel = +el.dataset.i; render(); },
    fbBack() { if (S.from === 'result') UI.reShowResult(); else UI.closeModal(); },
    fbSend() {
      grab(); const g = Game.G, id = g.club.lineup[S.sel], items = parse(S.text);
      if (!S.text.trim()) { UI.toast('피드백 내용을 입력해 주세요.', 'warn'); return; }
      if (!items.length) { UI.toast('내용을 이해하지 못했어요. 예: “너무 무리해서 싸워”, “스킬 아껴 써”', 'warn'); return; }
      S.pending = items; render(); return;
    },
    fbFlip(el) { grab(); const it = S.pending[+el.dataset.i]; if (it) it.d = -it.d; render(); },
    fbDrop(el) { grab(); S.pending.splice(+el.dataset.i, 1); if (!S.pending.length) S.pending = null; render(); },
    fbCancel() { grab(); S.pending = null; render(); },
    fbApply() {
      const g = Game.G, id = g.club.lineup[S.sel], items = S.pending || []; S.pending = null;
      if (!items.length) { render(); return; }
      const e = st(g).p[id] || (st(g).p[id] = {});
      items.forEach(it => { const r = e[it.ax] || (e[it.ax] = { v: 0, text: it.text }); if (r.v * it.d < 0) r.v = 0; r.v = clamp(r.v + it.d * STEP, -1, 1); r.text = it.text; });
      Game.save(); S.text = '';
      UI.toast(`${nick(g, id)}에게 반영: ` + items.map(it => `${AX[it.ax].name} ${it.d > 0 ? '▲' : '▼'}`).join(' · ') + ' — 다음 경기부터 적용', 'good');
      render(); if (S.from !== 'result') UI.refresh();
    },
    fbDel(el) { const e = st(Game.G).p[el.dataset.id]; if (e) { delete e[el.dataset.ax]; if (!Object.keys(e).length) delete st(Game.G).p[el.dataset.id]; } Game.save(); UI.refresh(); },
    fbResetOne(el) { delete st(Game.G).p[el.dataset.id]; Game.save(); UI.refresh(); UI.toast('피드백을 초기화했습니다.', 'good'); },
    fbResetAll() { if (!confirm('모든 선수의 AI 피드백을 초기화할까요?')) return; st(Game.G).p = {}; Game.save(); UI.refresh(); UI.toast('모든 피드백을 초기화했습니다.', 'good'); }
  };

  return { parse, attach, apply, afterMatch, season, panel, actions };
})();
