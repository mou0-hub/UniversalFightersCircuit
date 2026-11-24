/* news.js — 뉴스 / 커뮤니티 여론 / 감독 평판 / 선수 폼·멘탈 (league.js 에서 분리. league.js 뒤에 로드) */

/* ============================================================
   News — 롤갤/펨코 톤 커뮤니티 여론 + 감독 평판 + 선수 폼/멘탈
   G.news 최신순 저장 / G.rep = { v:0~100, peak, last }
   선수 pro.form(0~100), pro.mental 에 경기 후 평가가 반영됩니다.
   항목: { id, date, type, scope, headline, body[], comments[], repDelta?, ratings? }
   ============================================================ */
const News = (() => {
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const shuf = a => a.slice().sort(() => Math.random() - 0.5);
  const chance = p => Math.random() < p;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const hasB = w => { const c = w.charCodeAt(w.length - 1); return (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0) || (c >= 48 && c <= 57 && '013678'.includes(w[w.length - 1])); };
  const fill = (t, v) => t.replace(/\{(\w+)(?::([^}]+))?\}/g, (m, k, j) => {
    const w = String(v[k] != null ? v[k] : ''); if (!j) return w; const [a, b] = j.split('/');
    if (a === '으로') { const c = w.charCodeAt(w.length - 1), jong = c >= 0xAC00 && c <= 0xD7A3 ? (c - 0xAC00) % 28 : (c >= 48 && c <= 57 && '036'.includes(w[w.length - 1]) ? 1 : 0); return w + (jong && jong !== 8 ? '으로' : '로'); }
    return w + (hasB(w) ? a : b);
  });
  const F = id => (CONFIG.fighters[id] || {}).name || id;
  const ROLE = { warrior: '전사', mage: '마법', guardian: '수호', assassin: '암살', hunter: '사냥' };
  const roleOf = ids => ids.reduce((o, id) => { const r = (CONFIG.fighters[id] || {}).role || 'warrior'; o[r] = (o[r] || 0) + 1; return o; }, {});
  const rk = (G, id) => League.rankOf(G, id);
  const rec = (G, id) => { const t = League.team(G, id); return t ? `${t.w}승 ${t.d}무 ${t.l}패` : ''; };

  /* ----- 평판 ----- */
  function ensureRep(G) {
    if (!G.rep || typeof G.rep.v !== 'number') G.rep = { v: 50, peak: 50, last: 0 };
    return G.rep;
  }
  function repLabel(v) {
    if (v >= 85) return '리그 전설';
    if (v >= 70) return '인정받는 감독';
    if (v >= 55) return '무난한 평가';
    if (v >= 40) return '미묘한 시선';
    if (v >= 25) return '까이는 중';
    return '매국노 취급';
  }
  function shiftRep(G, delta, why) {
    const r = ensureRep(G);
    const before = r.v;
    r.v = clamp(Math.round(r.v + delta), 0, 100);
    r.peak = Math.max(r.peak || 0, r.v);
    r.last = r.v - before;
    r.why = why || '';
    return r.last;
  }

  /* ----- 선수 폼/멘탈 ----- */
  function ensureProMood(p) {
    if (p.form == null) p.form = 55 + Math.floor(Math.random() * 16);
    if (p.mental == null) p.mental = 70;
    return p;
  }
  function bumpPro(G, id, dForm, dMental) {
    const p = Pros.get(G, id); if (!p) return null;
    ensureProMood(p);
    p.form = clamp(Math.round(p.form + dForm), 0, 100);
    p.mental = clamp(Math.round(p.mental + dMental), 0, 100);
    return p;
  }

  /* ----- 커뮤니티 닉/톤 (롤갤·펨코 감성) ----- */
  const NA = ['롤', '갤', '조이', '노틸', '바드', '텔', '칼바람', '솔랭', '챌', '다이아', '플레', '언랭', '자랭', '듀오', '버스', '버스기사', '버스비', '원툴', '메가', '우주', '코스믹', '네온', '궤도', '성운', '혜성'];
  const NB = ['충', '전사', '유저', '장인', '교육생', '해설', '분석', '관종', '또라이', '뉴비', '고인물', '관측자', '직관러', '팬', '안티', '부캐', '본캐', '망나니', '아저씨', '누나'];
  const nick = v => {
    if (chance(0.2)) return 'ㅇㅇ';
    if (chance(0.12)) return '익명_' + Math.floor(Math.random() * 9000 + 1000);
    if (v && v.team && chance(0.1)) return String(v.team).split(' ').pop().slice(0, 5) + '팬' + (chance(0.5) ? Math.floor(Math.random() * 90 + 10) : '');
    if (v && v.star && chance(0.08)) return v.star + '빠';
    return rnd(NA) + rnd(NB) + (chance(0.4) ? String(Math.floor(Math.random() * 90 + 10)) : '');
  };
  const TONES = { hype: '🔥', salty: '💢', analyst: '🧠', meme: 'ㅋㅋ', rival: '🆚', toxic: '☠️', cope: '🥲', cheer: '📣' };

  /* ============================================================
     상황 연동 — 대회/진출/응원/인터뷰 (v.cup·v.stage·v.star 등을 읽어 문맥에 맞는 반응 생성)
     v 필드: team opp mvp score star star2 cup stage streak big sudden rank who champ
     ============================================================ */
  const needsOk = (t, v) => [...t.matchAll(/\{(\w+)/g)].every(m => v[m[1]] != null && v[m[1]] !== '' && v[m[1]] !== 0);
  const pickT = (list, v) => { const ok = list.filter(t => needsOk(t, v)); return ok.length ? fill(rnd(ok), v).replace(/\s{2,}/g, ' ').trim() : null; };
  const josa = (w, a, b) => w + (hasB(w) ? a : b);
  const stars = G => {
    try {
      const l = ((G.club && G.club.lineup) || []).filter(Boolean).map(id => Pros.get(G, id)).filter(Boolean);
      return l.map(p => p.nick).filter(Boolean);
    } catch (e) { return []; }
  };
  const base = G => { const st = shuf(stars(G)); return { team: G.teamName, star: st[0] || '', star2: st[1] || '' }; };
  const stageOf = M => { try { return M && M.t ? (League.roundName(M.t, M.t.roundIdx) || '') : ''; } catch (e) { return ''; } };

  /* 경기 직후 댓글용 문맥 풀: [조건, 톤, 템플릿들] — 조건이 맞는 것만 후보 */
  const CTX = [
    /* ----- 응원 (cheer) ----- */
    [(v, m) => m === 'win', 'cheer', ['{star} 선수 오늘도 파이팅!! 다음 경기도 부탁해요', '{star}, {star2} 믿고 있었다 ㅠㅠ 응원합니다', '{team} 화이팅 ㅠㅠ 이 기세로 쭉 가자', '{star} 선수 오늘 너무 멋있었어요 사랑합니다', '{team} 팬 된 게 자랑스럽다 다음 경기도 응원 간다']],
    [(v, m) => m === 'lose', 'cheer', ['괜찮아 {star} 선수 고개 들어 ㅠㅠ 응원함', '{team} 힘내라 팬들은 끝까지 간다', '{star2} 선수 다음엔 잘할 거야 파이팅', '졌지만 끝까지 싸워준 거 봤다 {team} 화이팅', '{star} 선수 수고했어요 푹 쉬고 다음 경기 갑시다']],
    [(v, m) => m === 'neutral', 'cheer', ['{team} 오늘 경기 파이팅! {star} 선수 컨디션 좋길', '{star}, {star2} 선수 잘 부탁합니다 응원 중', '오늘은 꼭 이기자 {team} 화이팅']],
    [(v, m) => v.cup && m === 'win', 'cheer', ['{cup}에서도 이겨줘서 고마워요 {star} 선수 파이팅 📣', '{cup} 끝까지 가자 {team} 화이팅!!', '{star} 선수 {cup} 무대에서도 빛난다 응원합니다']],
    [(v, m) => v.cup && m === 'lose', 'cheer', ['{cup}까지 올라온 것만으로도 고마웠다 {star} 선수 수고했어요', '{cup} 경험 헛되지 않을 거야 {team} 힘내라 ㅠㅠ', '{stage}까지 보여준 거 자랑스럽다 고개 들어요']],
    [(v, m) => v.cup && m === 'neutral', 'cheer', ['{cup} {stage} 파이팅!! {star} 선수 믿는다', '{team} {cup}에서 한 번 크게 놀아보자 응원합니다']],
    /* ----- 대회 (이긴 경우) ----- */
    [(v, m) => v.cup && m === 'win', 'hype', ['{cup}에서 {team} 이겼다 ㅋㅋㅋ 국제전 가자', '{stage} 돌파 ㅅㅅ {team} 가즈아', '{star} 국제무대 체질인가 ㄷㄷ', '{cup} 이 기세면 우승각인데?', '{cup} 보는 맛 난다 ㄹㅇ']],
    [(v, m) => v.cup && m === 'win', 'analyst', ['{cup:은/는} 정보가 적어서 초반 교전 선점이 중요한데 오늘 잘 풀렸음', '국제전은 밴픽 변칙이 먹히는데 오늘이 그 케이스', '{stage}에서 {opp} 상대로 운영 우세가 확실했음']],
    [(v, m) => v.cup && m === 'win', 'meme', ['{cup} 우승 간다 ㅋㅋ 아님 말고', '해외 팬들 {team} 검색하고 있을 듯 ㅋㅋ', '{opp} 짐 싸는 소리 들린다 ㅋㅋㅋ']],
    [(v, m) => v.cup && m === 'win', 'salty', ['이긴 건 좋은데 {opp:이/가} 약했던 거 아님? 다음이 진짜임', '{cup:은/는} 한 판 지면 끝이라 방심하면 안 됨']],
    [(v, m) => v.cup && m === 'win', 'cope', ['아직 한 경기 이겼을 뿐. {cup:은/는} 순식간에 끝남', '기대는 하되 들뜨지 말자 {stage}일 뿐이다']],
    [(v, m) => v.cup && m === 'win', 'rival', ['{opp} 팬들 {cup}에서 만나서 더 기분 좋다 ㅋㅋ']],
    /* ----- 대회 (진 경우) ----- */
    [(v, m) => v.cup && m === 'lose', 'salty', ['{cup}까지 와서 이 정도면 국제망신 아니냐', '{stage}에서 이러면 {cup} 진출한 의미가 없음', '{opp}한테 지다니 진짜 아쉽다']],
    [(v, m) => v.cup && m === 'lose', 'toxic', ['{cup}까지 가서 이게 뭐임 진짜', '국제전 와서 한타 이렇게 지는 거 실화냐']],
    [(v, m) => v.cup && m === 'lose', 'analyst', ['국제전 경험 차이가 한타 판단에서 보였음', '{stage}에서의 밴픽 대응이 한 박자 늦었음', '{opp}의 정보 싸움에서 밀린 경기']],
    [(v, m) => v.cup && m === 'lose', 'cope', ['{cup} 나간 것만으로도 성장임. 내년에 다시 가자', '경험치 쌓았다고 생각하자 {team} 화이팅', '국제전 첫 경험인데 선전한 거임']],
    [(v, m) => v.cup && m === 'lose', 'meme', ['{cup} 탈락 짤 벌써 돈다 ㅋㅋ', '비행기 일찍 타겠네 ㅠㅠ']],
    [(v, m) => v.cup && m === 'lose', 'rival', ['{opp} 팬들 {cup}에서 기고만장하겠네 ㅅㅂ']],
    [(v, m) => v.cup && m === 'lose', 'hype', ['{cup} 진출한 것만으로도 대단했다 다음 대회 기대한다']],
    /* ----- 대회 (경기 전/무승부) ----- */
    [(v, m) => v.cup && m === 'neutral', 'hype', ['{cup} {stage} 간다 ㄱㄱ 설레서 잠 못 잠 ㅋㅋ', '{team} 국제무대 기대된다 ㄹㅇ']],
    [(v, m) => v.cup && m === 'neutral', 'analyst', ['{stage:은/는} 한 판 승부라 밴픽 한 방이 중요함', '{opp} 최근 밴픽 보면 선픽 노릴 듯']],
    [(v, m) => v.cup && m === 'neutral', 'cope', ['이기든 지든 {star} 선수 응원함', '{cup} 즐기고 오자']],
    [(v, m) => v.cup && m === 'neutral', 'meme', ['{cup} 직관 못 가서 집에서 치킨 시킴 ㅋㅋ']],
    [(v, m) => v.cup && m === 'neutral', 'salty', ['{cup} 가서 이상한 픽 꺼내면 진짜 화낸다']],
    /* ----- 서든데스 / 점수차 / 연승 / 순위 ----- */
    [v => v.sudden, 'meme', ['서든데스 심장 약한 사람은 보지 마라 ㅋㅋ', '마지막 한 점에 손 떨림 ㄷㄷ']],
    [v => v.sudden, 'analyst', ['서든데스까지 가면 운도 실력이다', '정규 시간에 점수 차 못 벌린 게 결국 문제였음']],
    [v => v.sudden, 'cope', ['서든데스 접전이었던 만큼 결과는 승복한다']],
    [(v, m) => v.big >= 6 && m === 'win', 'hype', ['{score}?? 학살 아니냐 ㅋㅋㅋ', '{opp} 감독 퇴근 준비하겠다 ㅋㅋ', '압도적이었다 {mvp} 인정']],
    [(v, m) => v.big >= 6 && m === 'win', 'meme', ['{opp} 팬 채팅창 정지됐겠다 ㅋㅋㅋ']],
    [(v, m) => v.big >= 6 && m === 'lose', 'toxic', ['{score:은/는} 진짜 아닌 듯', '이 정도 점수차면 경질 청원 가야 되는 거 아님?']],
    [(v, m) => v.big >= 6 && m === 'lose', 'cope', ['큰 점수차였지만 한 판일 뿐이다', '오늘은 빨리 잊고 다음에 보자']],
    [(v, m) => v.streak >= 3 && m === 'win', 'hype', ['{streak}연승 ㄷㄷㄷ 이 기세 간다', '{streak}연승이라니 {team} 미쳤다']],
    [(v, m) => v.streak >= 3 && m === 'win', 'analyst', ['{streak}연승 중이라 밴픽이 읽히는 것도 감안해야 함']],
    [(v, m) => v.streak >= 3 && m === 'win', 'salty', ['{streak}연승? 운이 아직 안 끝난 듯 ㅋㅋ']],
    [(v, m) => v.rank && v.rank <= 3 && m === 'win', 'hype', ['{rank}위 굳히기 ㄱㄱ', '상위권 이 기세로 가자']],
    [(v, m) => v.rank && v.rank <= 3 && m === 'win', 'analyst', ['{rank}위면 상위권 경쟁 구도 의식해야 함']],
    [(v, m) => v.rank && v.rank <= 3 && m === 'lose', 'salty', ['{rank}위 팀이 이러면 안 되지']],
    [(v, m) => v.rank && v.rank <= 3 && m === 'lose', 'cope', ['{rank}위는 아직 유지 중이니까 침착하자']],
    [(v, m) => v.rankLow && m === 'lose', 'toxic', ['{rank}위인데 이 팀 진짜 갈 데까지 가나']],
    [(v, m) => v.rankLow && m === 'lose', 'cope', ['{rank}위지만 연승 한 번이면 위로 감']],
    [(v, m) => v.rankLow && m === 'win', 'hype', ['{rank}위 탈출각 보인다 ㄱㄱ']],
    [(v, m) => m === 'win', 'hype', ['{mvp} 오늘 수훈선수 인정 ㅇㅈ', '{star} 오늘 컨디션 좋아 보였음']],
    [(v, m) => m === 'lose', 'salty', ['{star:은/는} 오늘 존재감이 없었는데 왜 계속 쓰냐']]
  ];
  function genCtx(tone, mood, v) {
    const pool = shuf(CTX.filter(e => e[1] === tone && e[0](v, mood)));
    for (const e of pool) { const s = pickT(e[2], v); if (s) return s; }
    return null;
  }

  /* ----- 주제별 반응 풀 [톤, 템플릿] ----- */
  const EV = {
    qualify: [
      ['cheer', '{team} {cup} 진출 축하합니다!! {star} 선수 파이팅'], ['cheer', '드디어 {cup} 간다 ㅠㅠ 감동이다 {team} 화이팅'], ['cheer', '{star}, {star2} 국제무대 가서도 잘하자 응원합니다'],
      ['cheer', '{cup} 가서 좋은 성적 내자 {team} 사랑해요'], ['cheer', '{star} 선수 컨디션 관리 잘하고 {cup} 가서 보여줘요'],
      ['hype', '{team} {cup} 진출 ㅅㅅㅅㅅ'], ['hype', '이 팀 {cup} 간다고? 올해 뭔가 한다'], ['hype', '{cup} 가서 우승 가자 ㄱㄱ'],
      ['analyst', '{cup} 첫 상대 분석부터 들어가야 함. 한 판이 중요한 구조임'], ['analyst', '국제전은 정보 싸움이라 연습 영상 유출 조심해야 함'], ['analyst', '리그 성적만 보면 {cup} 진출은 정당함'],
      ['meme', '{cup} 가서 관광만 하고 오지 마라 ㅋㅋ'], ['meme', '해외 팬들 번역기 돌리는 중 ㅋㅋ'], ['meme', '{team} 비행기 탄다 ㅋㅋ 기내식 뭐 나오냐'],
      ['salty', '진출은 했는데 {cup} 가서 첫 판 지면 욕먹는다'], ['salty', '리그에서 운 좋게 올라간 거 아님? 국제전은 다르다'],
      ['rival', '{opp} 팬들 {cup} 못 간다고 배 아프겠다 ㅋㅋ'],
      ['cope', '{cup}까지 오다니 이번 시즌은 이미 성공이다']
    ],
    miss: [
      ['salty', '{cup} 못 가네 이게 맞냐'], ['salty', '상위권에 못 들면서 무슨 우승을 얘기함'], ['toxic', '{cup} 진출 실패라니 감독 뭐했냐'],
      ['cope', '{cup} 못 가서 아쉽지만 다음 기회 있다'], ['cope', '이번 시즌은 경험치 쌓은 걸로 치자'],
      ['cheer', '{star} 선수 고생했어요 ㅠㅠ 다음엔 같이 가요'], ['cheer', '{team} 힘내라 팬들은 계속 응원한다'], ['cheer', '{star2} 선수도 수고했어요 푹 쉬어요'],
      ['analyst', '초반 연패가 결국 발목을 잡았음'], ['analyst', '상위권 팀들과의 맞대결 성적이 아쉬웠음'],
      ['meme', '{cup} 집에서 치킨 먹으면서 봐야겠다 ㅋㅋ'], ['rival', '{opp} 가는 거 실화냐 ㅅㅂ']
    ],
    champ: [
      ['cheer', '{star} 선수 우승 축하해요 ㅠㅠㅠㅠ 평생 못 잊는다'], ['cheer', '{team} 우승!!! 감독님 선수들 모두 수고했습니다'], ['cheer', '{star2} 오늘 진짜 멋있었다 사랑해요'], ['cheer', '{team} 팬이라 행복하다 ㅠㅠ 고마워요'],
      ['hype', '{cup} 우승 ㅅㅂ 믿기지 않는다 ㅋㅋㅋㅋㅋ'], ['hype', '이게 우승 ㅋㅋ 오늘 잠 못 잔다'], ['hype', '레전드 팀 인정 ㅇㅈ'], ['hype', '{cup} 제패 ㄷㄷ 이 감독 뭐 하는 사람이냐'],
      ['analyst', '{cup} 우승 결정적이었던 건 밴픽 설계. 상대 읽는 속도가 달랐음'], ['analyst', '꾸준한 운영이 결국 국제전 우승으로 이어짐'],
      ['meme', '우승 기념 치킨 돌립니다 ㅋㅋ'], ['meme', '감독 몸값 폭등 ㅋㅋㅋ'],
      ['rival', '{opp}도 잘했는데 오늘은 {team} 날이었음'], ['salty', '우승했다고 자만하면 바로 털린다 내년이 중요'], ['cope', '우승했는데 눈물난다 ㅠㅠ']
    ],
    runner: [
      ['cheer', '준우승도 대단하다 {star} 선수 고생 많았어요 ㅠㅠ'], ['cheer', '{team} 자랑스럽다 고개 들어라'], ['cheer', '{star2} 선수 내년엔 꼭 우승하자 응원할게요'],
      ['cope', '결승까지 온 것만으로도 감동이다'], ['cope', '이번 {cup}에서 보여준 건 절대 헛되지 않음'],
      ['salty', '결승에서 지면 의미 없음 ㅅㅂ'], ['toxic', '결승에서 이렇게 지다니 진짜 아쉽다 못해 화난다'],
      ['analyst', '결승 마지막 한타 포지션 선택이 아쉬웠음'], ['meme', '영원한 2등 ㅋㅋ 근데 응원함'],
      ['hype', '결승 갔다는 사실만으로 커뮤니티가 축제였음'], ['rival', '{champ} 우승 축하하지만 {team:이/가} 더 인상 깊었음']
    ],
    out: [
      ['cheer', '{star} 선수 수고했어요 {cup} 경험 헛되지 않을 거예요 ㅠㅠ'], ['cheer', '{team} 힘내라 내년엔 더 높이 간다'], ['cheer', '{star2} 선수도 고생했어요 응원합니다'],
      ['salty', '{cup}에서 {stage} 탈락이라니'], ['analyst', '국제전 첫 경험 치고는 선전, 아쉬운 건 {stage} 한타'], ['analyst', '{champ:이/가} 우승한 이유가 보이네. 운영 완성도 차이'],
      ['cope', '{stage}까지 간 것만으로도 성장이다'], ['meme', '{cup} 관광 잘 하고 왔냐 ㅋㅋ'], ['toxic', '{stage}에서 탈락할 거면 뭐하러 나갔냐'],
      ['hype', '{team} {cup}에서 가능성 봤다 내년 기대한다'], ['rival', '{champ} 우승이라니 배 아프다']
    ],
    others: [
      ['analyst', '{champ} 우승 납득. 운영이 한 수 위였음'], ['analyst', '{cup} 메타는 결국 안정적인 조합이 이긴다는 걸 보여줌'],
      ['meme', '{champ} 우승 기념 짤 벌써 나옴 ㅋㅋ'], ['rival', '{champ} 우승하는 거 보니 배 아프다 ㅋㅋ'],
      ['cope', '우리는 내년에 가면 된다'], ['cheer', '{team} 내년엔 우리가 저 자리에 선다 응원한다 {star} 선수 파이팅'],
      ['hype', '{cup} 재밌었다 다음 시즌 기대된다'], ['salty', '{cup} 우승팀이 저 정도면 우리가 못 이길 것도 아니었음']
    ],
    cupRound: [
      ['analyst', '{cup} 라운드 결과 보니 이변은 없었음'], ['hype', '{cup} 볼 맛 난다'], ['meme', '직관 가고 싶다 ㅋㅋ'], ['rival', '다른 팀 경기도 챙겨봐야 함'],
      ['cheer', '{team} 다음 경기도 가자 {star} 선수 파이팅'], ['cope', '결과는 결과, 다음 경기를 보자']
    ],
    cupRoundWin: [
      ['cheer', '{team} 다음 라운드 진출!! {star} 선수 파이팅'], ['hype', '{cup} 다음 라운드 간다 ㅅㅅ'], ['analyst', '다음 상대 분석 들어가야 함'],
      ['meme', '이 기세로 우승까지 가자 ㅋㅋ'], ['cope', '한 판씩 가자 방심 금지'], ['salty', '아직 갈 길 멀다 들뜨지 마라']
    ],
    cupRoundLose: [
      ['cheer', '{star} 선수 수고했어요 {team} 힘내라 ㅠㅠ'], ['cope', '여기까지 온 것도 대단하다'], ['analyst', '교전 선택에서 한 끗 차이였음'],
      ['salty', '{cup}에서 이러면 안 되는데 ㅅㅂ'], ['meme', '짐 싸자 ㅋㅋ'], ['cheer', '내년에 다시 가요 {team} 사랑합니다']
    ],
    itvWin: [
      ['cheer', '{who} 선수 인터뷰 보니까 더 좋아짐 ㅠㅠ 파이팅'], ['cheer', '말하는 거 진짜 예쁘게 하네 {who} 응원한다'], ['hype', '{who} 인터뷰 멘트 레전드 ㅋㅋ'],
      ['analyst', '말하는 거 보니 경기 이해도 높음'], ['meme', '인터뷰 짤 벌써 나옴 ㅋㅋ'], ['salty', '말은 쉬운데 다음 경기 결과로 말해라'], ['cope', '겸손해서 더 호감이다']
    ],
    itvLose: [
      ['cheer', '감독님 힘내세요 ㅠㅠ 선수들도 힘내라'], ['cheer', '책임진다는 말 듣고 마음 풀렸다 응원함'], ['analyst', '밴픽 점검한다는 언급은 긍정적'], ['analyst', '인정할 건 인정하는 태도는 좋음'],
      ['salty', '사과만 하면 끝이냐 결과로 보여줘라'], ['toxic', '말만 번지르르하지 성적은 노답이네'], ['cope', '다음 경기 보고 평가하자'], ['meme', '인터뷰 때 표정 보니까 안쓰럽다 ㅋㅋ']
    ],
    controv: [
      ['cheer', '{who} 선수 한 경기로 판단하지 말자 응원한다'], ['cheer', '{who} 힘내라 팬들이 있다'], ['salty', '{who} 교체해라 계속 이러면 팀이 무너짐'], ['toxic', '{who} 기용하는 감독이 문제임'],
      ['analyst', '{who} 개인 문제보다 팀 전술 문제일 수도 있음'], ['analyst', '폼 사이클이니까 한두 경기 더 봐야 함'], ['cope', '누구나 부진할 때 있음'], ['meme', '{who} 버스비 환불 시위 ㅋㅋ']
    ],
    oppReact: [
      ['analyst', '{opp} 쪽에서도 인정하는 분위기네'], ['rival', '{opp} 감독 말 보니까 진 거 억울한가 봄 ㅋㅋ'], ['hype', '{opp}도 인정한 {team} 폼'], ['salty', '{opp} 감독 말은 번지르르하네'], ['meme', '{opp} 인터뷰 짤 각이다 ㅋㅋ'], ['cheer', '{team} 다음에도 이겨서 저 감독 말 바꿔놓자']
    ],
    streak: [
      ['hype', '{streak}연승 ㄷㄷㄷ 이대로 쭉 가자'], ['cheer', '{star} 선수 {streak}연승 축하해요 ㅠㅠ'], ['analyst', '연승 중이라도 상대 밴픽 변화는 체크해야 함'], ['meme', '{streak}연승이면 이제 버스 아니고 비행기 아니냐 ㅋㅋ'],
      ['salty', '연승 끊기는 순간 바로 욕먹을 거임'], ['cope', '들뜨지 말고 한 경기씩'], ['rival', '다른 팀 팬들 벌써 긴장하는 듯 ㅋㅋ']
    ],
    fan: [
      ['meme', '이 짤 보고 웃음 터짐 ㅋㅋㅋ'], ['meme', '번역기 돌려서 해외 팬들도 퍼가는 중'], ['cheer', '팬아트도 올라왔네 {star} 선수 사랑해요'], ['hype', '이 정도면 공식 굿즈로 만들어야 됨 ㅋㅋ'], ['cope', '이런 소소한 즐거움이 팬질하는 이유임']
    ],
    power: [
      ['analyst', '상위권 판도는 한 경기 차이로 갈릴 듯'], ['analyst', '파워랭킹은 최근 폼 반영이라 순위표랑 다름'], ['hype', '{team} 올라가자 ㄱㄱ'], ['cheer', '{team} 파워랭킹 오르게 {star} 선수 파이팅'], ['salty', '이 순위 기자 취향 아니냐 ㅋㅋ'], ['rival', '{opp} 1위는 아직 인정 못함'], ['meme', '파워랭킹 맨날 틀림 ㅋㅋ']
    ],
    fanfest: [
      ['cheer', '{star} 선수 보러 직관 간다 응원 현수막 준비함'], ['cheer', '{team} 팬들 최고다 ㅠㅠ'], ['hype', '직관 열기 미쳤다 ㄷㄷ'], ['meme', '현수막 문구 센스 ㅋㅋ'], ['analyst', '팬덤 규모가 평판에 반영되는 구간'], ['cope', '응원하는 맛에 산다']
    ],
    spot: [
      ['cheer', '{star} 선수 시그니처 픽 볼 때마다 설렌다'], ['hype', '{star} 선수 주력 픽은 인정'], ['analyst', '숙련도 높으면 밴 당할 때 리스크도 있음'], ['meme', '{star} 선수 팬들 벌써 응원봉 준비 ㅋㅋ'], ['cope', '소개해줘서 고맙다 몰랐던 정보네']
    ]
  };
  function eventComments(kind, v, n) {
    const pool = shuf((EV[kind] || []).filter(e => needsOk(e[1], v)));
    const ci = pool.findIndex(e => e[0] === 'cheer');
    if (ci > 0) pool.unshift(pool.splice(ci, 1)[0]);
    return pool.slice(0, n).map(([tone, t]) => ({ u: nick(v), tone, t: fill(t, v).replace(/\s{2,}/g, ' ').trim(), like: Math.floor(Math.random() * 60) + (tone === 'cheer' ? 25 : tone === 'toxic' ? 4 : 10) })).sort((a, b) => b.like - a.like);
  }

  /* ----- 인터뷰 멘트 [헤드, 본문] ----- */
  const Q = {
    win: [
      ['팀원들 덕분입니다', '오늘은 팀원들이 믿고 따라줘서 이길 수 있었습니다. 제가 한 건 크지 않아요.'],
      ['준비한 대로 풀렸다', '준비한 대로 풀려서 만족합니다. 다음 경기도 집중하겠습니다.'],
      ['감독님 지시가 맞아떨어졌다', '감독님 지시가 정확히 맞아떨어졌어요. 저는 거기에 맞춰 움직였을 뿐입니다.'],
      ['팬분들 응원이 힘', '팬분들 응원 소리가 정말 큰 힘이 됐습니다. 다음에도 보답하겠습니다.'],
      ['{opp} 선택을 예상했다', '밴픽 단계에서 {opp}의 선택을 어느 정도 예상하고 있었습니다.']
    ],
    winKill: [['교전에서 동선이 잘 맞았다', '교전이 열릴 때마다 동선이 잘 맞았습니다. 팀원들이 자리를 잡아줘서 편하게 들어갈 수 있었어요.']],
    winDeliv: [['코어 운반 호위가 완벽했다', '코어 운반할 때 동료들이 호위를 완벽하게 해줬습니다. 제출 타이밍도 잘 맞았어요.']],
    winHeal: [['팀원들을 살리는 게 역할', '팀원들을 살리는 게 제 역할이라고 생각하고 집중했습니다. 뒤에서 버텨주는 게 가장 중요했어요.']],
    winCup: [['{cup} 자신감 붙었다', '{cup:은/는} 한 경기 한 경기가 다르게 다가옵니다. {stage:을/를} 넘어서 자신감이 붙었어요.']],
    winSud: [['서든데스 마지막까지 집중했다', '서든데스까지 가서 정말 긴장했는데 끝까지 집중한 게 승리로 이어졌습니다.']],
    winStreak: [['들뜨지 않고 한 경기씩', '연승 이어가고 있지만 들뜨지 않고 한 경기씩 가겠습니다.']],
    lose: [
      ['제 책임입니다', '선수들 잘못이 아니라 지시를 내린 제 책임입니다. 다음 경기 전까지 밴픽을 다시 점검하겠습니다.'],
      ['{opp:이/가} 더 잘 준비했다', '{opp:이/가} 더 잘 준비했습니다. 인정할 부분은 인정하고 보완하겠습니다.'],
      ['팬분들께 죄송합니다', '팬분들께 죄송합니다. 이 경기 영상 다시 보면서 고치겠습니다.']
    ],
    loseCup: [['{cup} 경험으로 가져가겠다', '{cup}에서의 패배는 아쉽지만 경험으로 가져가겠습니다. 선수들도 많이 배웠을 겁니다.']],
    loseSud: [['마지막 한 끗이 부족했다', '서든데스까지 가는 접전이었는데 마지막 한 끗이 부족했습니다.']],
    coachWin: [
      ['선수들이 잘해줬다', '선수들이 잘해줬습니다. 저는 판만 깔아줬을 뿐입니다.'],
      ['방심 없이 가겠다', '이긴 건 기쁘지만 방심하지 않겠습니다. 다음 상대도 만만치 않아요.']
    ],
    oppWin: [
      ['{team:이/가} 잘했다', '{team:이/가} 잘했습니다. 우리가 준비한 대로 풀리지 않았어요. 다음에 만나면 다르게 보여드리겠습니다.'],
      ['아쉽지만 인정한다', '결과는 아쉽지만 인정합니다. 선수들이 끝까지 최선을 다했습니다.']
    ],
    oppLose: [
      ['오늘은 우리가 앞섰다', '오늘은 우리가 준비한 게 잘 맞았습니다. 하지만 {team}도 위협적인 팀이라 방심할 수 없어요.'],
      ['{team} 경계 대상', '{team:이/가} 어떤 팀인지 알고 있었습니다. 승리는 기쁘지만 다음에도 같은 결과를 장담할 순 없습니다.']
    ],
    qualCoach: [
      ['한 경기가 결승이라는 마음', '선수들이 시즌 내내 잘 따라와 줘서 {cup} 무대에 설 수 있었습니다. 국제대회에서는 한 경기 한 경기가 결승이라는 마음으로 준비하겠습니다.'],
      ['팬분들 덕분입니다', '진출할 수 있었던 건 팬분들 응원 덕분입니다. 부끄럽지 않은 경기를 하겠습니다.']
    ],
    qualStar: [
      ['{cup} 설렙니다', '{cup:은/는} 처음이라 많이 설랩니다. 팬분들 응원 덕분이에요. 목표는 일단 첫 경기 승리입니다.'],
      ['국제무대에서 보여드리겠다', '국제무대에 서게 돼서 영광입니다. 연습 때 준비한 걸 모두 보여드리고 오겠습니다.']
    ],
    missCoach: [
      ['제 부족함 때문입니다', '{cup} 진출에 실패한 건 감독인 제 부족함 때문입니다. 팬분들께 죄송합니다. 남은 시즌 다시 정비하겠습니다.'],
      ['다시 올라서겠다', '아쉬운 결과지만 포기하지 않겠습니다. 부족한 부분을 철저히 분석해서 다시 올라서겠습니다.']
    ],
    champStar: [
      ['꿈만 같습니다', '꿈만 같습니다. 팀원들, 감독님, 그리고 응원해 주신 팬분들께 감사드립니다.'],
      ['우승이라니 믿기지 않는다', '아직도 믿기지 않아요. 힘든 시간 함께한 팀원들 덕분입니다. 정말 고맙습니다.']
    ],
    champCoach: [
      ['선수들 덕분입니다', '우승은 선수들이 만든 겁니다. 저는 옆에서 도왔을 뿐이에요. 팬분들께 이 트로피를 바칩니다.'],
      ['시작일 뿐이다', '기쁘지만 여기가 끝이 아닙니다. 이 팀은 더 높이 갈 수 있다고 믿습니다.']
    ],
    runnerCoach: [
      ['결승에서 아쉬웠다', '결승까지 올라온 선수들이 자랑스럽지만 끝내 우승을 못 해드려 죄송합니다. 이 경험을 발판 삼아 더 강해지겠습니다.'],
      ['다음에는 꼭 우승', '오늘의 아쉬움을 잊지 않겠습니다. 다음에는 꼭 트로피를 들겠습니다.']
    ],
    outCoach: [
      ['{cup}에서 배웠다', '{cup}에서 많은 걸 배웠습니다. {stage} 탈락은 아쉽지만 선수들에게 큰 경험이 됐을 겁니다.'],
      ['더 강해져 돌아오겠다', '결과는 아쉽지만 선수들 모두 최선을 다했습니다. 더 강해져서 돌아오겠습니다.']
    ],
    otherChamp: [
      ['{champ} 감독, 우승 소감', '선수들이 한 팀이 되어 만든 우승입니다. {cup:을/를} 준비하며 보낸 시간이 헛되지 않았어요.']
    ]
  };
  function quoteFor(kind, v, su) {
    const pool = (Q[kind] || []).slice();
    const add = (k, w) => (Q[k] || []).forEach(x => { for (let i = 0; i < w; i++) pool.push(x); });
    if (kind === 'win' && su) {
      if (su.kills >= 3) add('winKill', 2);
      if ((su.deliv || 0) >= 2) add('winDeliv', 2);
      if (su.healed > su.dmg) add('winHeal', 2);
    }
    if (v.cup) add(kind + 'Cup', 3);
    if (v.sudden) add(kind + 'Sud', 3);
    if (kind === 'win' && v.streak >= 3) add('winStreak', 2);
    const ok = pool.filter(x => needsOk(x[0] + x[1], v));
    const pick = rnd(ok.length ? ok : Q[kind]);
    return [fill(pick[0], v).replace(/\s{2,}/g, ' '), fill(pick[1], v).replace(/\s{2,}/g, ' ')];
  }

  const C = {
    hype: {
      win: [
        'ㅅㅂ {team} 오늘 뭐임 ㅋㅋㅋㅋ 개찢음',
        '{mvp} 버스 기사 인정 돈값함',
        '이게 진짜 {team}이지 ㅋㅋ 다음 경기도 이김 ㄱㄱ',
        '와 {score} 스코어 뭐냐 상대팀 멘탈 나갔겠다',
        '연승 각이다 ㄹㅇ 이 감독 뭔가 있네',
        '코어 운영 개깔끔했음 한타도 잘 싸워줌',
        '{mvp} 캐리 미쳤다 오늘 MVP 박제해라'
      ],
      lose: [
        '졌는데 내용 나쁘지 않았음 다음엔 이기자',
        '아쉽네 그래도 {mvp}는 밥값했다',
        '한 세트만 더 있었으면... 암튼 수고',
        '괜찮아 시즌 길다 한 경기로 뭐 안 바뀜'
      ],
      neutral: [
        '오늘 경기 기대된다 직관 각?',
        '{team} 폼 올라오는 중인데 이기면 분위기 타겠는데',
        '밴픽만 안 터지면 이길 듯'
      ]
    },
    salty: {
      win: [
        '이겼는데 내용 더러움 운빨 아님?',
        '상대가 더 못해준 거임 자만 금물',
        '다음 경기에 바로 질 각 보이는데 ㅋㅋ'
      ],
      lose: [
        '아 ㅋㅋ {team} 또 짐 이게 맞냐',
        '밴픽부터 이상했음 감독 뭐하냐',
        '{mvp} 오늘 완전 먹튀였는데 왜 기용함',
        '코어도 못 모으고 한타도 짐 뭐하는 거임',
        'ㅅㅂ 멘탈 나가네 이 팀 답이 없다',
        '감독 경질각 아님? 계속 이 짓거리면',
        '저 픽 조합 보고 이미 졌다고 생각함 ㄹㅇ'
      ],
      neutral: [
        '또 이상한 픽 나오는 거 아니냐 불안한데',
        '지난 경기 보고 기대 안 함',
        '이기면 다행 지면 원래 그런 팀'
      ]
    },
    analyst: {
      win: [
        '코어 우선순위가 잘 맞았음. {score}면 운영 우세 승리',
        '보스 타이밍 싸움에서 한 템포 빨랐던 게 승부처',
        '{mvp} 사이드 압박 → 본대 합류 동선이 좋았음',
        '시간대별 기조 전환이 교과서적이었음'
      ],
      lose: [
        '교전 패배 이후 재출격이 계속 밀려서 코어 회수가 안 됐음',
        '상대 조합 시너지 대응이 늦었음. 상성 문제 큼',
        '보스 포기 타이밍을 잘못 잡은 게 점수 차로 이어짐',
        '역할 분담이 흐트러지면서 코어를 계속 내줌'
      ],
      neutral: [
        '핵심은 코어 주변 시야 싸움이 될 듯',
        '선픽 이점을 어떻게 쓰느냐가 관건',
        '상대 선호 픽 보면 조합 대충 읽힘'
      ]
    },
    meme: {
      win: [
        '{mvp} 오늘 롤 잘하네? ㅋㅋㅋㅋ',
        '와 버스 타니까 편하다 기사님 감사합니다',
        '상대팀 채팅창 불타겠는데 ㅋㅋ',
        '이 경기는 레전드로 박제다 ㄹㅇ'
      ],
      lose: [
        '아 ㅋㅋ 또 짐 나 이 팀 응원하냐',
        '감독님 롤 해본 적 있으심? ㅋㅋ',
        '{mvp} 오늘 버스비 환불각',
        '제출 지점 어디 있는지 모름? ㅋㅋㅋ'
      ],
      neutral: [
        '오늘도 한 방 있다 없냐 ㅋㅋ',
        '벤픽 보고 웃고 갑니다',
        '직관 갈까 말까 하다가 안 감 ㅋ'
      ]
    },
    rival: {
      win: [
        '{opp} 팬들 조용하네 ㅋㅋㅋ',
        '라이벌전 승리 개통쾌하다',
        '{opp} 저력 어디 갔냐'
      ],
      lose: [
        '{opp}한테 지니까 더 빡치네',
        '라이벌한테 지면서 자존심 팔아먹음',
        '{opp} 팬들 우짤 거리겠는데 ㅅㅂ'
      ],
      neutral: [
        '{opp}전이면 무조건 이겨야지',
        '라이벌전은 내용보다 결과가 중요함'
      ]
    },
    toxic: {
      win: [
        '이 감독 좀 치네? 당분간 까기 보류',
        '승리는 승리 인정함 근데 여전히 불안'
      ],
      lose: [
        '접어라 시발 이 팀',
        '선수들 손발 안 맞음 연습이나 더 해라',
        '팬 무시하냐 이런 경기력으로',
        '경질 청원 가고 싶음 ㄹㅇ'
      ],
      neutral: [
        '또 구라 기사 나오겠네',
        '기대하는 내가 병신임'
      ]
    },
    cope: {
      win: [
        '이기긴 했는데 상대가 약했음 자만 ㄴㄴ',
        '아직 시즌 초반이다 침착하자'
      ],
      lose: [
        '아직 시즌 많이 남음... 라고 씀',
        '패배로 배우는 거지 뭐 다음엔 나아질 듯',
        '점수 차는 안 컸음 희망 회로 가동'
      ],
      neutral: [
        '이기면 좋고 져도 경험이다...',
        '멘탈 관리가 제일 중요함'
      ]
    }
  };

  /* ----- 커뮤니티 여론 생성기 (조각 조합 — 매 호출마다 문장 재조합) ----- */
  const FRAG = {
    end: ['ㅋㅋ', 'ㅋㅋㅋ', 'ㄹㅇ', 'ㄷㄷ', 'ㅅㅂ', '헐', '와', '진짜', '개꿀', '레전드', '노답', '미쳤다', '실화냐', '인정', 'ㅋ', 'ㅎㅎ', 'ㅠㅠ', 'ㅇㅈ'],
    teamWin: ['오늘 미쳤다', '개찢었네', '폼 올랐다', '이거 우승각인데', '버스 기사 누구냐', '운영 깔끔했음', '한타 다 이김', '코어도 잘 먹고'],
    teamLose: ['또 짐', '이게 맞냐', '멘탈 나감', '내용이 없음', '제출 뭐함', '한타마다 짐', '감독 뭐하냐', '손발 안 맞음'],
    playerGood: ['캐리 인정', '돈값함', '개잘함', '오늘 MVP', '존재감 미쳤다', '한타 찢음'],
    playerBad: ['먹튀였음', '왜 기용함', '버스비 환불각', '동선 이상함', '한타 기여 0', '저거 벤 해야지'],
    coachGood: ['감독 좀 치네', '밴픽 괜찮았음', '전술 먹혔다', '교체 타이밍 굿'],
    coachBad: ['감독 경질각', '밴픽부터 이상', '전술 노답', '선수 탓만 하냐'],
    analystWin: ['코어 우선순위가 맞았음', '보스 타이밍 우세', '교전 선제공격이 먹힘', '역할 분담이 안정적이었음'],
    analystLose: ['재출격 타이밍이 밀림', '상성 대응 실패', '코어 방치가 패인', '한타 패배 후 복구 실패'],
    cope: ['시즌 아직 남음', '다음 경기에 보자', '한 경기로 판단 ㄴㄴ', '배우는 경기로 치자'],
    rivalWin: ['라이벌 팬 조용하네', '자존심 지킴', '더비 승리 통쾌'],
    rivalLose: ['라이벌한테 짐 ㅋㅋ', '더비에서 자존심 팔아먹음', '상대 팬 우짤 거리겠는데'],
    hypeLead: ['ㅅㅂ', '와', '오', '개', 'ㄹㅇ'],
    toxicLead: ['접어라', '진짜', '아', '뭐하냐', '시발']
  };
  function genComment(tone, mood, v) {
    const team = v.team || '우리 팀', opp = v.opp || '상대', mvp = v.mvp || '에이스', score = v.score || '';
    const e = () => rnd(FRAG.end);
    const pick2 = (a, b) => chance(0.5) ? rnd(a) : rnd(b);
    let s = '';
    if (tone === 'hype') {
      if (mood === 'win') s = chance(0.5)
        ? `${rnd(FRAG.hypeLead)} ${team} ${rnd(FRAG.teamWin)} ${e()}`
        : `${mvp} ${rnd(FRAG.playerGood)} ${e()}`;
      else if (mood === 'lose') s = `${team} 졌지만 ${mvp} ${rnd(['돈값함', '잘했다', '고생했다', '수고했다', '존재감은 있었음'])} ${e()}`;
      else s = `${team} 오늘 경기 기대된다 ${e()}`;
    } else if (tone === 'salty' || tone === 'toxic') {
      if (mood === 'lose') s = chance(0.45)
        ? `${rnd(FRAG.toxicLead)} ${team} ${rnd(FRAG.teamLose)} ${e()}`
        : chance(0.5) ? `${mvp} ${rnd(FRAG.playerBad)} ${e()}` : `${rnd(FRAG.coachBad)} ${e()}`;
      else if (mood === 'win') s = `이겼는데 ${rnd(['내용 더러움', '운빨이었음', '자만 금물'])} ${e()}`;
      else s = `${team} ${rnd(['불안한데', '또 구릴 듯', '기대 안 함'])} ${e()}`;
    } else if (tone === 'analyst') {
      if (mood === 'win') s = `${rnd(FRAG.analystWin)}.${score ? ' 스코어 ' + score + '.' : ''}`;
      else if (mood === 'lose') s = `${rnd(FRAG.analystLose)}.`;
      else s = `${rnd(['핵심은 코어 주변 싸움', '밴픽 이점이 관건', '제출 지점 두 곳 싸움 예상'])}.`;
    } else if (tone === 'meme') {
      if (mood === 'win') s = chance(0.5) ? `${mvp} 오늘 롤 잘하네? ${e()}` : `버스 타니까 편하다 ${e()}`;
      else if (mood === 'lose') s = chance(0.5) ? `감독님 롤 해본 적 있으심? ${e()}` : `${mvp} 버스비 환불각 ${e()}`;
      else s = `${rnd(['밴픽 보고 웃고 갑니다', '직관 갈까 말까', '오늘도 한 방 있냐'])} ${e()}`;
    } else if (tone === 'rival') {
      if (mood === 'win') s = `${opp} ${rnd(FRAG.rivalWin)} ${e()}`;
      else if (mood === 'lose') s = `${opp} ${rnd(FRAG.rivalLose)} ${e()}`;
      else s = `${opp}전이면 무조건 이겨야지 ${e()}`;
    } else if (tone === 'cope') {
      s = `${rnd(FRAG.cope)} ${e()}`;
    } else if (tone === 'cheer') {
      s = genCtx('cheer', mood, v) || `${team} 화이팅 ${e()}`;
    } else {
      s = mood === 'win' ? `${team} ${rnd(FRAG.teamWin)} ${e()}` : `${team} ${rnd(FRAG.teamLose)} ${e()}`;
    }
    // 템플릿 풀과 30% 섞어 더 다양하게
    if (chance(0.3) && C[tone] && C[tone][mood] && C[tone][mood].length) {
      const templ = rnd(C[tone][mood]);
      if ([...templ.matchAll(/\{(\w+)/g)].every(m => v[m[1]] != null && v[m[1]] !== '')) s = fill(templ, v);
    }
    return s;
  }
  function comments(mood, v, n, tones) {
    const ts = tones || (mood === 'win'
      ? ['hype', 'cheer', 'hype', 'meme', 'analyst', 'rival', 'salty', 'cheer', 'toxic']
      : mood === 'lose'
        ? ['salty', 'toxic', 'cheer', 'meme', 'analyst', 'cope', 'cheer', 'rival', 'hype']
        : ['analyst', 'cheer', 'meme', 'hype', 'salty', 'rival', 'cope']);
    const out = [], used = new Set();
    for (let i = 0; i < n; i++) {
      const tone = ts[i % ts.length];
      let text = '', guard = 0;
      do {
        const cx = (tone === 'cheer' || chance(0.5)) ? genCtx(tone, mood, v) : null;   // 상황(대회·연승·순위 등)에 맞는 문장 우선
        text = cx || genComment(tone, mood, v);
        guard++;
      } while (used.has(text) && guard < 10);
      used.add(text);
      out.push({
        u: nick(v),
        tone,
        t: text,
        like: Math.floor(Math.random() * (mood === 'win' && (tone === 'hype' || tone === 'meme' || tone === 'cheer') ? 80 : 40) + (tone === 'toxic' ? 5 : tone === 'cheer' ? 18 : 10))
      });
    }
    return out.sort((a, b) => b.like - a.like);
  }

  function push(G, it) {
    G.news = G.news || [];
    it.id = it.id || ('n' + Date.now().toString(36) + Math.floor(Math.random() * 1000));
    if (it.dupKey && G.news.some(n => n.dupKey === it.dupKey)) return null;
    G.news.unshift(it); if (G.news.length > 160) G.news.length = 160;
    return it;
  }
  const mk = (G, date, type, scope, headline, body, cm, extra) =>
    push(G, { date: League.isoDate(date), type, scope, headline, body: (body || []).filter(Boolean), comments: cm || [], ...(extra || {}) });

  /* 내 팀 유닛 중 피해+치유가 가장 큰(bad면 가장 작은) 유닛 — res.units 기준 */
  const sideMvp = (res, M, bad) => {
    const us = ((res && res.units) || []).filter(u => u.team === M.pIdx); if (!us.length) return null;
    return us.reduce((a, u) => ((bad ? u.dmg + u.healed < a.dmg + a.healed : u.dmg + u.healed > a.dmg + a.healed) ? u : a));
  };

  /* ----- 경기 후 선수 평가 + 폼/멘탈 ----- */
  function rateLineup(G, info) {
    const { won, draw, res, M } = info;
    const line = (G.club && G.club.lineup) ? G.club.lineup.filter(Boolean) : [];
    if (!line.length) return { lines: [], ratings: [] };
    const bs = sideMvp(res, M, false), mvpId = bs ? bs.ch.id : (res && res.mvpFighter);      // 내 팀 기준 최다 기여 파이터
    const ratings = [];
    const lines = [];
    line.forEach((pid, i) => {
      const p = Pros.get(G, pid); if (!p) return;
      ensureProMood(p);
      // 기본 변동
      let dF = draw ? rnd([-2, 0, 1]) : won ? rnd([2, 4, 6, 8]) : rnd([-8, -6, -4, -2]);
      let dM = draw ? rnd([-1, 0, 1]) : won ? rnd([1, 2, 3]) : rnd([-5, -3, -2, -1]);
      let tag = '무난';
      // MVP 추정: 매치 파이터 매핑 불명확하면 슬롯0/랜덤 가산
      const isHero = (mvpId && p.favs && p.favs.includes(mvpId)) || (won && i === 0 && chance(0.45)) || chance(0.15);
      const isGoat = !won && !draw && (i === 0 ? chance(0.35) : chance(0.25));
      if (isHero && (won || draw)) {
        dF += rnd([4, 6, 8]); dM += rnd([2, 3, 4]); tag = '캐리';
      } else if (isGoat) {
        dF -= rnd([4, 6, 9]); dM -= rnd([3, 5, 7]); tag = '비난';
      } else if (won) tag = chance(0.3) ? '준수' : '무난';
      else if (!draw) tag = chance(0.35) ? '아쉬움' : '부진';

      // 트러블/슬랙 성향이면 멘탈 출렁
      if (p.trouble > 55 && !won) dM -= 2;
      if (p.slack > 55 && won) dF -= 1;
      if (p.mental < 40 && !won) dF -= 2;

      const before = { form: p.form, mental: p.mental };
      bumpPro(G, pid, dF, dM);
      const row = { id: pid, nick: p.nick, tag, dForm: p.form - before.form, dMental: p.mental - before.mental, form: p.form, mental: p.mental };
      ratings.push(row);

      if (tag === '캐리') lines.push(rnd([
        `▶ ${p.nick}: 오늘 경기 완전 캐리. 커뮤니티에서도 "버스 기사" 소리 나옴. 폼 ${before.form}→${p.form}`,
        `▶ ${p.nick}: 한타마다 존재감. 팬들 사이 재평가 중. 멘탈 ${before.mental}→${p.mental}`
      ]));
      else if (tag === '비난') lines.push(rnd([
        `▶ ${p.nick}: 오늘 욕 많이 먹음. "왜 기용하냐" 댓글 폭주. 폼 ${before.form}→${p.form}`,
        `▶ ${p.nick}: 결정적 실수 도마. 본인도 표정 안 좋았음. 멘탈 ${before.mental}→${p.mental}`
      ]));
      else if (tag === '부진') lines.push(`▶ ${p.nick}: 존재감 부족. 다음 경기 출전 여부 의견 갈림. 폼 ${before.form}→${p.form}`);
      else if (tag === '준수') lines.push(`▶ ${p.nick}: 실수 없이 역할 수행. 무난한 고평가. 폼 ${before.form}→${p.form}`);
      else lines.push(`▶ ${p.nick}: 평범. 큰 말은 없음. 폼 ${p.form} / 멘탈 ${p.mental}`);
    });
    return { lines, ratings };
  }

  function applyMatchRep(G, info) {
    const { won, draw, res, M } = info;
    const streak = G.streak || 0;
    let d = 0, why = '';
    if (draw) { d = chance(0.5) ? 0 : -1; why = '무승부'; }
    else if (won) {
      d = 5 + (streak >= 3 ? 2 : 0) + (streak >= 5 ? 2 : 0);
      if (M && M.kind === 'playoff') d += 3;
      if (M && (M.kind === 'msi' || M.kind === 'worlds')) d += 4;
      why = streak >= 3 ? `${streak}연승 중 승리` : '승리';
    } else {
      d = -2;
      if (M && M.kind === 'playoff') d -= 1;
      if (M && (M.kind === 'msi' || M.kind === 'worlds')) d -= 2;
      why = '패배';
    }
    // 여론은 평판이 낮을수록 패배에 더 가혹, 높을수록 승리에 가산
    const r = ensureRep(G);
    if (won && r.v < 50) d += 1;          // 평판이 낮을수록 승리 시 회복이 빠름
    if (won && r.v > 70) d += 1;
    return shiftRep(G, d, why);
  }

  /* ----- 경기 전 ----- */
  function preview(G, M, date) {
    const me = G.teamName, opp = M.teams[1 - M.pIdx].name, oid = M.teams[1 - M.pIdx].id, label = M.label;
    const my = rk(G, 'player'), orank = rk(G, oid), st = G.streak, fav = (League.team(G, oid).fav || []).slice(0, 2).map(F);
    const rep = ensureRep(G);
    const v = { team: me, opp, label, streak: st, mvp: '에이스', score: '' };
    Object.assign(v, base(G), { cup: M.kind !== 'league' && M.t ? M.t.name : '', stage: stageOf(M) });
    let head;
    if (st >= 3) head = rnd(['{streak}연승 {team}, 오늘도 이기면 여론 폭발각', '연승 중인데 {opp} 만나면 긴장된다는데 ㄱㄱ?', '{team} 상승세 vs {opp} — 커뮤니티 시선 집중']);
    else if (rep.v < 35) head = rnd(['여론 최악인 {team}, {opp}전에서 반등할까', '감독 까는 중인데 오늘 지면 진짜 끝임']);
    else if (orank && my && orank < my) head = rnd(['상위권 {opp} 상대로 반란 가능하냐', '{label}: 도전자 {team} 인식전']);
    else head = rnd(['{team} vs {opp} 프리뷰 — 코어 수집 싸움 예상', '오늘 {label}, 커뮤니티 반응은 미지근']);
    if (M.kind !== 'league') {
      const ch = ['{cup} {stage}: {team} vs {opp} — 팬들 응원 열기', '{team}, {cup} {stage} 돌입 — {opp} 상대 커뮤니티 기대 반 걱정 반'];
      if (v.star) ch.push('{cup} {stage} 프리뷰: {star} 선수 활약에 시선');
      head = rnd(ch);
    }
    const body = [
      fill('오늘 {team:과/와} {opp}의 {label}. 코어 수집전 메타에서 운영 한 끗이 갈린다.', v),
      my ? fill('{team} 현재 {r}위({rec}). 감독 평판 {rep}({lab}).', { team: me, r: my, rec: rec(G, 'player'), rep: rep.v, lab: repLabel(rep.v) }) : '',
      orank ? `${opp}${hasB(opp) ? '은' : '는'} ${orank}위(${rec(G, oid)}).` : '',
      fav.length ? `상대 최근 픽 경향: ${fav.join('·')}. 밴 우선순위로 꼽힌다.` : '',
      st >= 2 ? `${st}연승 중이라 팬층은 들뜬 분위기.` : (st === 0 && G.totals && G.totals.games ? '직전 패배 때문에 커뮤니티 칼침 예고.' : '개막 분위기. 기대 반 걱정 반.')
    ];
    return mk(G, date, 'preview', M.kind === 'league' ? 'me' : 'intl', fill(head, v).replace(/\s{2,}/g, ' '), body, comments('neutral', v, 6), { dupKey: 'pv' + M.label + opp + League.isoDate(date) });
  }

  /* ----- 밴픽 후 ----- */
  function draft(G, M, date) {
    const me = G.teamName, oi = M.teams[1 - M.pIdx].name, mine = M.picks[M.pIdx], theirs = M.picks[1 - M.pIdx];
    const rc = roleOf(mine), top = Object.keys(rc).sort((a, b) => rc[b] - rc[a])[0];
    const comp = rc[top] >= 2 ? `${ROLE[top] || top} 편중 조합` : '밸런스 조합';
    const bans = [...(M.bans[0] || []), ...(M.bans[1] || [])].map(F);
    const v = { ...base(G), team: me, opp: oi, mvp: F(mine[0]), score: '', cup: M.kind !== 'league' && M.t ? M.t.name : '', stage: stageOf(M) };
    const head = rnd([
      `밴픽 분석: ${me} ${comp} 꺼냄`,
      `${mine.map(F).join('·')} 픽 — 커뮤니티 반응 분분`,
      bans.length ? `${bans[0]} 밴 이후 판 읽기` : `밴픽 종료, ${me} 선택 공개`
    ]);
    const body = [
      `${me} 픽: ${mine.map(F).join(', ')}. ${comp}으로 보는 쪽과 "또 저거?" 하는 쪽이 갈림.`,
      `${oi} 픽: ${theirs.map(F).join(', ')}.`,
      bans.length ? `밴 카드: ${bans.join(', ')}.` : '',
      chance(0.5) ? rnd(['선픽 이점을 살렸다는 평.', '후픽 운영으로 맞춰 간다는 해석.', '조합 시너지 미지수라는 분석 댓글 다수.']) : ''
    ];
    return mk(G, date, 'draft', 'me', head, body, comments('neutral', v, 6, ['analyst', 'cheer', 'meme', 'salty', 'hype', 'toxic']), { dupKey: 'dr' + M.label + League.isoDate(date) });
  }

  /* ----- 경기 결과 ----- */
  function result(G, info, date) {
    const { won, draw, res, M } = info;
    const me = G.teamName, opp = M.teams[1 - M.pIdx].name;
    const score = res && res.score ? `${res.score[M.pIdx]}:${res.score[1 - M.pIdx]}` : (res && res.scoreText) || (won ? '승' : draw ? '무' : '패');      // 내 팀 점수가 앞
    const su = sideMvp(res, M, !won && !draw);                  // 승/무: 내 팀 최다 기여 · 패배: 내 팀 최저 기여(기사에서 지적 대상)
    const mvp = su ? (nickOf(G, M, su) || su.ch.name) : ((res && res.mvpName) || (res && res.mvpFighter ? F(res.mvpFighter) : '에이스'));
    const v = { team: me, opp, mvp, score };
    const cupK = M.kind !== 'league';
    Object.assign(v, base(G), { cup: cupK && M.t ? M.t.name : '', stage: stageOf(M), streak: G.streak || 0, big: res && res.score ? Math.abs(res.score[0] - res.score[1]) : 0, sudden: !!(res && res.sudden) });
    if (!cupK) { v.rank = rk(G, 'player'); try { v.rankLow = v.rank >= Math.ceil(League.sorted(G).length * 0.7); } catch (e) {} }
    const mood = draw ? 'neutral' : won ? 'win' : 'lose';
    const repDelta = applyMatchRep(G, info);
    const rep = ensureRep(G);
    const rated = rateLineup(G, info);
    /* 경기 결과로 폼/멘탈이 변동된 뒤, 높은 확률로 기본값(55/70)으로 복구. 복구 안 되면 다음 경기 AI에 영향. 내 선수단 전체에만 적용(시설 기본값) */
    if (G.club && G.club.roster) {
      G.club.roster.forEach(pid => {
        const p = Pros.get(G, pid); if (!p) return;
        ensureProMood(p);
        if (Math.random() < 0.75) {          // 약 75% 확률로 원상복구 (기본값은 구장 시설 레벨만큼 상승)
          const bs = Facility.base(G);
          p.form = bs.form;
          p.mental = bs.mental; p.fxb = 1;
        }
      });
    }

    let head;
    if (draw) head = rnd([`{team} vs {opp}, 무승부 — 여론도 애매`, `점수 나눠 가짐 {score}. 양쪽 팬 조용`]);
    else if (won) head = rnd([
      `{team}, {opp} 잡고 승리 ㅅㅅ — {score}`,
      `{mvp} 캐리로 {team} 승! 커뮤니티 분위기 좋음`,
      G.streak >= 3 ? `{team} {streak}연승 질주 ㅋㅋㅋ`.replace('{streak}', G.streak) : `{team} 승리. 감독 평판 ${rep.v}로 ${repDelta >= 0 ? '상승' : '하락'}`
    ]);
    else head = rnd([
      `{team}, {opp}에 패배… 여론 싸늘`,
      `또 짐 ㅋㅋ {score} — 감독 무능 논란`,
      `{opp}에 덜미. 선수 개개인 평가 갈림`
    ]);
    if (cupK && !draw && chance(0.75)) head = won
      ? rnd(['{team}, {cup} {stage} 승리 — {opp} 꺾고 다음 라운드', '{cup} {stage} 돌파! {team}, {mvp} 활약으로 {opp} 제압', '{team} {cup} {stage} 통과 — 팬들 "다음도 가자!"'])
      : rnd(['{team}, {cup} {stage}에서 {opp}에 패배 — 여정 마감', '{cup} {stage} 탈락… {team}, {opp}에 덜미', '{opp}에 무릎 꿇은 {team} — {cup} 탈락 후폭풍']);

    const body = [
      fill(draw ? '{team:과/와} {opp:이/가} {score}로 비겼다.' : won ? '{team:은/는} {opp}를 꺾고 승리했다. 스코어 {score}.' : '{team:은/는} {opp}에 패했다. 스코어 {score}.', v),
      won ? fill('{mvp} 활약이 돋보였다는 반응이 많다.' , v) : (!draw ? fill('패인으로 {mvp} 쪽 동선/교전 선택이 도마에 올랐다.', v) : '결정타가 없던 경기라는 평.'),
      `감독 평판 ${rep.v} (${repLabel(rep.v)}) · 변동 ${repDelta >= 0 ? '+' : ''}${repDelta} — ${rep.why || ''}`,
      '【선수 평가】',
      ...rated.lines
    ];

    if (cupK && !draw) body.splice(1, 0, won
      ? (v.stage ? `${v.cup} ${fill('{s:을/를}', { s: v.stage })} 통과했다. 팬 커뮤니티에는 응원 글이 이어졌다.` : `${v.cup} 한 경기를 통과했다. 팬 커뮤니티에는 응원 글이 이어졌다.`)
      : `${v.cup} 여정은 ${v.stage || '이 경기'}에서 막을 내렸다.`);
    const tones = mood === 'win'
      ? ['hype', 'cheer', 'meme', 'analyst', 'rival', 'salty', 'cheer', 'cope', 'toxic', 'hype']
      : mood === 'lose'
        ? ['salty', 'toxic', 'cheer', 'meme', 'analyst', 'cope', 'cheer', 'rival', 'hype', 'toxic']
        : ['analyst', 'cheer', 'meme', 'cope', 'salty', 'hype'];

    matchExtras(G, info, date, v, rated);                           // 인터뷰·논란·상대 반응·연승 기록 등 부가 소식 (결과 기사보다 먼저 쌓아 결과가 위에 보이게)
    return mk(G, date, 'result', M.kind === 'league' ? 'me' : 'intl', fill(head, v).replace(/\s{2,}/g, ' '), body, comments(mood, v, 10, tones), {
      hot: !draw,
      repDelta,
      ratings: rated.ratings,
      dupKey: 'rs' + M.label + opp + League.isoDate(date)
    });
  }

  /* ----- 경기 후 전투 분석 칼럼 (res.rec 기반 · 내 경기 전용) ----- */
  const AN = () => CONFIG.news.analysis;
  const tps = () => 1000 / CONFIG.battle.tickMs;
  const fmtT = t => { const s = Math.round(t / tps()); return s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`; };
  const S = (pool, v) => fill(rnd(pool), v).replace(/\s{2,}/g, ' ').trim();
  const num = n => Math.round(n).toLocaleString();
  const HOW = { deliver: '코어 제출' };
  const bossName = b => (CONFIG.bossDefs && CONFIG.bossDefs[b.def] && CONFIG.bossDefs[b.def].name) || (b.kind === 'mid' ? '중앙 보스' : '후반 보스');
  const optName = (list, c, id) => { const k = list.find(x => x.id === c), o = k && k.options.find(x => x.id === id); return o ? o.name : id; };
  const tacVal = (list, raw, c) => { const k = list.find(x => x.id === c), v = raw && raw[c]; return v && k && k.options.some(o => o.id === v[0]) ? v[0] : (k ? k.neutral : ''); };

  function nickOf(G, M, u) {
    if (u.nick) return u.nick;
    if (u.team !== M.pIdx) return '';
    const line = (G.club && G.club.lineup ? G.club.lineup : []).filter(Boolean), p = line[u.slot] && Pros.get(G, line[u.slot]);
    return (p && p.nick) || '';
  }
  const whoOf = (G, M, u) => { const nk = nickOf(G, M, u); return { who: nk || u.ch.name, chv: nk ? fill('{c:으로/로}', { c: u.ch.name }) : '', nick: nk, ch: u.ch.name }; };

  const P = {
    openK: ['경기는 {t}, {kil:이/가} {vic:을/를} 먼저 쓰러뜨리며 열렸다.', '첫 처치는 {side}의 몫이었다. {t}, {kil:이/가} {vic:을/를} 잡아냈다.', '첫 교전은 {t}에 나왔다. {kil:이/가} {vic:을/를} 끊어 {side:이/가} 먼저 웃었다.'],
    openKV: ['경기는 {t}, {kil:이/가} {via:으로/로} {vic:을/를} 먼저 쓰러뜨리며 열렸다.', '첫 처치는 {side}의 몫. {t}, {kil:이/가} {via:으로/로} {vic:을/를} 정리했다.'],
    sudKV: ['승부는 서든데스에서 갈렸다. {t}에 {kil:이/가} {via:으로/로} {vic:을/를} 잡아낸 한 번의 교전이 전부였다.'],
    openV: ['{t}, {vic:이/가} 가장 먼저 쓰러지며 첫 코어 드랍이 나왔다.', '초반 첫 사망은 {t}에 나온 {vic}였다.'],
    openN: ['{me:과/와} {opp}의 경기는 초반 탐색전이 길었다.', '초반에는 서로 눈치만 보며 처치 없이 시간이 흘렀다.'],
    comeback: ['한때 {def}점까지 끌려갔던 {side:이/가} {t}, {how:으로/로} 균형을 뒤집었다.', '{side:은/는} {def}점 열세를 안고도 {t} {how:으로/로} 역전에 성공했다.', '승부는 {t}에 뒤집혔다. {def}점 뒤지던 {side:이/가} {how:으로/로} 앞서 나갔다.'],
    closeW: ['{t}, {how:으로/로} 앞서 나간 {side:이/가} 그 리드를 끝까지 지켜냈다.', '접전 끝에 {t} {how:으로/로} 점수를 벌린 {side:이/가} 흐름을 가져갔다.'],
    lostLead: ['{me:이/가} {lead}점까지 앞서 갔지만 {t}, {opp}의 {how:으로/로} 흐름이 넘어갔다.', '{lead}점 리드는 {t}를 기점으로 사라졌다. {opp:이/가} {how:으로/로} 단숨에 따라붙었다.', '앞서던 {me:은/는} {t}에 {how:으로/로} 리드를 내줬고, 끝내 되찾지 못했다.'],
    closeL: ['{t}, {opp:이/가} {how:으로/로} 앞서 나가며 접전의 균형이 기울었다.', '접전은 {t}에 {opp} 쪽으로 넘어갔다. {how:이/가} 결정타였다.'],
    bossW: ['{t}, {boss:을/를} 쓰러뜨린 {side:이/가} 코어 {n}개를 쓸어 담고 버프까지 얻으며 판을 가져갔다.', '{boss} 처치({side}, {t})가 승부의 분수령이었다. 코어 {n}개와 팀 버프가 한 번에 움직였다.'],
    bossL: ['{t}, {side:이/가} {boss:을/를} 가져가 코어 {n}개를 챙겼지만 흐름 전체를 바꾸지는 못했다.', '{boss:은/는} {side:이/가} 처치해 코어 {n}개와 버프를 얻었다. 다만 제출까지 이어지지 못해 격차를 메우지 못했다.'],
    fight: ['{from}~{to} 사이 처치 {n}회가 몰린 한타에서 {side:이/가} {ab:으로/로} 압도했고, 이 구간이 점수 차를 만들었다.', '{from}부터 {to}까지의 교전은 {side}의 완승({a}:{b})이었다. 한타 한 번이 경기 분위기를 바꿨다.'],
    wire: ['{side:은/는} 한 번도 리드를 내주지 않고 경기를 이끌었다.', '경기 내내 점수판은 {side} 쪽에서 움직였다. 역전 한 번 없는 안정적인 흐름이었다.'],
    sudKill: ['정규 시간에 점수가 같아 서든데스까지 갔다. {t}, {kil:이/가} {vic:을/를} 쓰러뜨리며 승부를 끝냈다.', '승부는 서든데스에서 갈렸다. {t}에 {kil:이/가} {vic:을/를} 잡아낸 한 번의 교전이 전부였다.'],
    sudDep: ['정규 시간에 점수가 같아 서든데스까지 갔다. {t}, {who:이/가} 코어를 먼저 제출하며 승부를 끝냈다.', '승부는 서든데스에서 갈렸다. {t}에 {who:이/가} 먼저 코어를 제출한 한 번이 전부였다.'],
    sudHp: ['서든데스에서도 처치가 나오지 않아 남은 체력 {a}% 대 {b}%로 승패가 갈렸다.', '서든데스 제한 시간까지 결판이 나지 않았다. 잔여 체력 {a}% 대 {b}%가 결과를 정했다.'],
    sudDraw: ['서든데스까지 갔지만 끝내 승부를 가르지 못했다.'],
    endW: ['최종 점수 {sc}, 보스 처치는 {bb}. {me:은/는} 필요한 순간에 점수를 챙겼다.', '{sc:으로/로} 끝난 경기. 보스 처치 {bb:이/가} 숫자로 흐름을 요약한다.'],
    endL: ['최종 점수 {sc}, 보스 처치는 {bb}. 승부처에서의 손실을 끝내 메우지 못했다.', '{sc:으로/로} 마무리. 보스 처치 {bb:이/가} 말해 주듯 중요한 순간마다 한발 늦었다.'],
    endD: ['{sc:으로/로} 승부를 가르지 못했다. 보스 처치는 {bb}.', '{sc:으로/로} 비긴 경기. 어느 쪽도 결정타를 만들지 못했다.'],

    starD: ['수훈 선수로는 {who:을/를} 꼽을 수 있다. {chv} 피해 {dmg}, 처치 {k}회, 데스 {d}회로 팀 기여도 {pct}%를 책임졌다.', '{who:은/는} {chv} 피해 {dmg}에 처치 {k}회를 쌓으며 경기를 끌고 갔다. 데스는 {d}회, 기여도는 {pct}%.', '가장 눈에 띈 쪽은 {who}였다. {chv} 피해 {dmg} · 처치 {k} · 데스 {d}로 팀 화력의 중심이었다.'],
    dlv: ['코어 제출은 {me} {a}회({ap}점) 대 {opp} {b}회({bp}점). 운반 성적이 점수판을 그대로 갈랐다.', '제출 횟수는 {a}회 대 {b}회, 제출 점수는 {ap}점 대 {bp}점이었다.'],
    dlvTop: ['코어 운반의 주역은 {who:이/가} {chv} {n}회 제출({pts}점)로 팀 점수를 책임졌다.', '{who:은/는} {chv} 코어를 {n}회 제출해 {pts}점을 올리며 MVP 경쟁에서도 앞섰다.'],
    dlv0: ['이날 우리 팀은 코어를 한 번도 제출하지 못했다.', '코어 제출 0회. 수집과 운반 동선 모두 숙제로 남았다.'],
    starH: ['{who:은/는} {chv} 치유 {heal}로 라인을 떠받친 숨은 수훈 선수였다. 피해도 {dmg:을/를} 보탰고 데스는 {d}회.', '수훈 선수는 {who}. {chv} 치유 {heal}에 피해 {dmg}까지 더하며 팀 기여도 {pct}%를 기록했다.'],
    badD: ['반면 {who:은/는} 데스 {d}회에 피해 {dmg:으로/로} 존재감이 옅어 재출격 공백이 아쉬웠다.', '부진 쪽에서는 {who:이/가} 먼저 거론된다. 데스 {d}회, 팀 기여도 {pct}%에 그쳤다.', '{who:이/가} 교전마다 일찍 쓰러지며 데스 {d}회를 쌓은 점이 뼈아팠다.'],
    badS: ['{who:은/는} {chv} 피해 {dmg}에 그치며 팀 기여도가 {pct}%에 머물렀다.', '{who}의 존재감이 옅었던 점이 아쉽다. 기여도 {pct}%, 처치 {k}회.'],
    noBad: ['눈에 띄는 부진은 없었다. 선수 전원이 제 몫은 해냈다.', '뚜렷하게 흔들린 선수는 없었다는 평가.'],
    noBadL: ['개인 부진보다는 팀 단위의 연결이 아쉬웠다는 평가.', '선수 개개인의 부진보다 합이 맞지 않은 쪽이 컸다.'],
    tank: ['{who:은/는} {chv} 팀 전체 피해의 {pct}%({taken})를 받아내며 전열을 지켰다.', '전열의 {who:이/가} 받은 피해 {taken}으로 아군의 부담을 덜었다. 데스는 {d}회뿐이었다.'],
    oppStar: ['상대 {who:이/가} {chv} 피해 {dmg}에 처치 {k}회로 판을 지배한 점도 컸다.', '{opp}의 {who:을/를} 끝내 막지 못했다. 피해 {dmg}, 처치 {k}회.'],
    ult0: ['이날 우리 팀은 궁극기를 한 번도 쓰지 못했다.', '궁극기는 끝내 나가지 않았다. 자원 관리와 타이밍 모두 숙제로 남았다.'],
    ultLess: ['궁극기 사용은 {a}회 대 {b}회로 상대가 앞섰다.'],
    ultMore: ['궁극기 사용은 {a}회 대 {b}회로 우리 쪽이 더 적극적이었다.'],

    tacG: ['{who}에게 건 \'{opt}\'({cat}) 지시가 통했다. 처치 {k}회, 데스 {d}회.', '\'{opt}\'({cat}) 지시를 받은 {who:이/가} 처치 {k}회·데스 {d}회로 역할을 해냈다.'],
    tacB: ['{who}에게 준 \'{opt}\'({cat}) 지시는 처치 {k}회·데스 {d}회에 그치며 독이 됐다.', '\'{opt}\'({cat}) 지시를 받은 {who:이/가} 기대에 못 미쳤다. 처치 {k}회, 데스 {d}회.'],
    tacNone: ['개인 지시에서는 눈에 띄는 변수가 없었다. 세부 지시보다 팀 기조가 결과를 좌우했다.'],
    ctrPW: ['밴픽에서는 {gA:이/가} {gB:을/를} 견제하는 구도로 상성 우위를 잡았고, 그 우위가 결과로 이어졌다.', '조합 상성은 우리 쪽이 앞섰다. 특히 {gA:과/와} {gB}의 맞대결 구도가 유리했다.'],
    ctrPL: ['상성 자체는 {gA:이/가} {gB:을/를} 누르는 우리 쪽 우위였지만, 그 이점을 교전에서 살리지 못했다.', '밴픽 단계의 상성 우위({gA} 대 {gB})가 실제 전투로 이어지지 않은 점이 아쉽다.'],
    ctrNW: ['밴픽 상성은 {opp} 쪽이 유리했다({bA:이/가} {mA:을/를} 압박하는 구도). 그럼에도 운영으로 열세를 뒤집었다.', '{bA:이/가} {mA:을/를} 누르는 불리한 상성이었지만 팀 운영으로 극복한 점이 돋보인다.'],
    ctrNL: ['밴픽 상성이 발목을 잡았다. {bA:이/가} {mA:을/를} 압박하는 구도에서 끝내 풀어내지 못했다.', '{opp:이/가} 상성에서 앞선 판이었다. 특히 {bA}의 {mA} 견제가 컸다.'],
    ctrE: ['조합 상성은 팽팽해 밴픽보다 운영과 교전 선택이 승부를 갈랐다.', '밴픽 상성에서는 뚜렷한 우열이 없었다.'],
    ban: ['우리의 밴 카드는 {ban:이었다/였다}.', '{ban:을/를} 밴해 상대의 선택지를 줄였다.']
  };
  const STANCE = {
    slay: { g: ['\'{nm}\' 기조가 맞아떨어졌다. 처치 {kk:으로/로} 앞서며 상대 운반자와 부활 공백을 함께 끊었다.'], b: ['\'{nm}\' 기조를 택했지만 처치가 {kk:으로/로} 밀렸다. 코어 수집과 보스 대응까지 늦어져 기조의 약점이 그대로 드러났다.'] },
    boss: { g: ['\'{nm}\' 기조대로 보스 처치 {bb:으로/로} 판의 무게중심을 가져왔다.'], b: ['\'{nm}\' 기조였지만 보스 처치가 {bb:으로/로} 따라주지 않았다. 중앙 싸움의 손실이 컸다.'] },
    collect: { g: ['\'{nm}\' 기조대로 코어를 꾸준히 모아 제출 {dl:으로/로} 앞서며 점수를 쌓았다.'], b: ['\'{nm}\' 기조였지만 코어 제출이 {dl:으로/로} 밀려 수집 싸움에서 앞서지 못했다.'] },
    defend: { g: ['\'{nm}\' 기조로 목숨을 아끼며 버틴 게 통했다. 팀 데스는 {dA}회로 재출격 공백을 줄였다.'], b: ['\'{nm}\' 기조가 지나치게 소극적이었다. 물러서는 사이 {opp}에 주도권을 내줬다.'] },
    balanced: { g: ['\'{nm}\' 기조는 무난했다. 처치 {kk}, 보스 {bb:으로/로} 어느 한쪽에 치우치지 않고 이겼다.'], b: ['\'{nm}\' 기조로 맞섰지만 처치 {kk}, 보스 {bb:으로/로} 뚜렷한 강점을 만들지 못했다.'] }
  };
  const BOSSP = {
    contest: { g: ['\'{nm}\' 방침대로 보스를 적극 공략해 {bb:으로/로} 앞섰다.'], b: ['\'{nm}\' 방침으로 보스에 달려들었지만 처치 {bb:으로/로} 이득을 보지 못했다.'] },
    steal: { g: ['\'{nm}\' 방침이 먹혀 보스 막타를 가져오며 코어 더미와 버프를 챙겼다.'], b: ['\'{nm}\' 방침으로 기회를 노렸지만 막타를 한 번도 가져오지 못했다.'] },
    yield: { g: ['\'{nm}\' 방침으로 보스를 넘기는 대신 처치 {kk:으로/로} 코어를 되찾아 만회했다.'], b: ['\'{nm}\' 방침으로 보스를 포기했지만 처치 {kk:으로/로}는 그 손실을 메우지 못했다.'] }
  };
  const SCOREP = {
    turtle: { g: ['앞선 뒤 \'{nm}\' 지침이 제때 작동해 리드를 지켰다.'], b: ['\'{nm}\' 지침을 걸었지만 앞선 점수를 끝까지 지키지는 못했다.'] },
    press: { g: ['앞선 뒤 \'{nm}\' 지침으로 끝장을 보며 격차를 벌렸다.'], b: ['\'{nm}\' 지침으로 몰아붙였지만 마무리가 이어지지 않았다.'] },
    gamble: { g: ['뒤처진 상황에서 \'{nm}\' 지침이 통해 한 방을 만들었다.'], b: ['뒤처진 상황의 \'{nm}\' 지침은 불발로 끝났다.'] },
    steady: { g: ['뒤처진 상황에서도 \'{nm}\' 지침으로 차분히 따라붙었다.'], b: ['\'{nm}\' 지침으로 꾸준히 코어를 모았지만 점수 차를 좁히지 못했다.'] }
  };
  const HEAD = {
    sudden: ['[전투 분석] 서든데스까지 간 {me}-{opp}전, 마지막 한 점의 무게', '[전투 분석] 정규 시간으로 끝나지 않은 승부 — {me} 대 {opp} 복기'],
    comeback: ['[전투 분석] {me}, {t} 역전극의 설계도', '[전투 분석] 뒤집은 한 수 — {me}의 {opp}전 복기'],
    lostlead: ['[전투 분석] 잡았던 리드는 어디서 사라졌나 — {me} 대 {opp}', '[전투 분석] {opp}전 패인, 리드를 지키지 못한 {t} 이후'],
    boss: ['[전투 분석] 보스가 가른 승부 — {me} 대 {opp}', '[전투 분석] {boss} 한 번에 갈린 {me}-{opp}전'],
    fight: ['[전투 분석] 한타 한 번에 갈린 {me}-{opp}전', '[전투 분석] {t}의 교전이 만든 점수 차'],
    wire: ['[전투 분석] 흔들림 없이 이끈 {me}, {opp}전 숫자로 복기', '[전투 분석] 리드를 한 번도 내주지 않은 {me}의 {opp}전'],
    close: ['[전투 분석] 접전 끝 {me} 대 {opp}, 승부를 가른 {t}의 장면', '[전투 분석] {t}에 기운 접전 — {me}-{opp}전 복기'],
    win: ['[전투 분석] {me}의 {opp}전, 숫자로 읽는 승인'],
    lose: ['[전투 분석] {opp}전 패인 해부 — {me}에 무엇이 부족했나'],
    draw: ['[전투 분석] 승부를 가르지 못한 {me}-{opp}전 복기']
  };

  function wantAnalysis(res, M) {
    const A = AN(); if (!A || A.mode === 'off') return false;
    if (A.mode === 'all') return true;
    if (M.kind !== 'league' || res.sudden || Math.abs(res.score[0] - res.score[1]) >= A.bigDiff) return true;
    return A.mode === 'chance' && chance(A.chance);
  }

  function digest(G, info) {
    const { res, M } = info, R = res.rec, my = M.pIdx, op = 1 - my, A = AN();
    const us = res.units, mine = us.filter(u => u.team === my), theirs = us.filter(u => u.team === op), byId = {};
    us.forEach(u => { byId[u.id] = u; });
    const sum = (l, k) => l.reduce((s, u) => s + (u[k] || 0), 0), con = u => Battle.mvpScore(u);
    const lead = [0, 0], s = [0, 0];
    R.pts.forEach(e => { s[e.team] += e.pts; const d = s[0] - s[1]; lead[0] = Math.max(lead[0], d); lead[1] = Math.max(lead[1], -d); });
    let fight = null; const ks = R.kills, W = Math.round(A.fightSec * tps());
    for (let i = 0; i < ks.length; i++) {
      let j = i; while (j + 1 < ks.length && ks[j + 1].t - ks[i].t <= W) j++;
      const n = j - i + 1; if (n < A.fightMin) continue;
      const c = [0, 0]; for (let q = i; q <= j; q++) if (ks[q].kt === 0 || ks[q].kt === 1) c[ks[q].kt]++;
      const gap = Math.abs(c[0] - c[1]);
      if (!fight || n > fight.n || (n === fight.n && gap > fight.gap)) fight = { from: ks[i].t, to: ks[j].t, n, c, gap, win: c[0] === c[1] ? -1 : (c[0] > c[1] ? 0 : 1) };
    }
    const D = {
      G, M, res, R, my, op, me: G.teamName, opp: M.teams[op].name, mine, theirs, byId, con, lead, fight,
      pv: u => whoOf(G, M, u), nm: u => whoOf(G, M, u).who,
      mineTot: mine.reduce((q, u) => q + con(u), 0), mineTaken: sum(mine, 'taken'),
      k: [sum(mine, 'kills'), sum(theirs, 'kills')], d: [sum(mine, 'deaths'), sum(theirs, 'deaths')], u: [sum(mine, 'ults'), sum(theirs, 'ults')],
      dl: [sum(mine, 'deliv'), sum(theirs, 'deliv')], dp: [sum(mine, 'dpts'), sum(theirs, 'dpts')], b: [res.bossKills[my], res.bossKills[op]], hp: [Math.round(res.hp[my] * 100), Math.round(res.hp[op] * 100)], sc: [res.score[my], res.score[op]]
    };
    const lf = R.flips[R.flips.length - 1];
    D.lostLead = !!(lf && res.winner === op && lf.team === op && lead[my] >= A.leadGap);
    return D;
  }

  /* 승부처 후보 → 가중치 상위 2개를 시간순으로 */
  function moments(D) {
    const { res, R, my, op, lead } = D, A = AN(), out = [], wt = res.winner, side = t => (t === my ? D.me : D.opp), unit = id => (id ? D.byId[id] : null);
    if (res.sudden) {
      const dep = R.cores.find(e => e.kind === 'deposit' && e.t >= R.suddenAt), sd = dep;
      let txt;
      if (wt === -1) txt = S(P.sudDraw, {});
      else if (res.suddenWinner != null && dep) txt = S(P.sudDep, { t: fmtT(dep.t), who: dep.u && D.byId[dep.u] ? D.nm(D.byId[dep.u]) : (dep.team === my ? D.me : D.opp) });
      else txt = S(P.sudHp, { a: D.hp[0], b: D.hp[1] });
      out.push({ kind: 'sudden', w: 6, t: sd ? sd.t : R.suddenAt, txt, hv: {} });
    }
    const lf = R.flips[R.flips.length - 1];
    if (lf && wt >= 0 && lf.team === wt) {
      const behind = lead[1 - wt], big = behind >= A.leadGap, how = HOW[lf.why] || '득점', t = fmtT(lf.t);
      if (wt === my) out.push({ kind: big ? 'comeback' : 'close', w: big ? 5 : 3, t: lf.t, txt: S(big ? P.comeback : P.closeW, { side: D.me, def: behind, t, how }), hv: { t } });
      else out.push({ kind: big ? 'lostlead' : 'close', w: big ? 5 : 3, t: lf.t, txt: S(big ? P.lostLead : P.closeL, { me: D.me, opp: D.opp, lead: behind, t, how }), hv: { t } });
    }
    const bd = R.boss.filter(b => b.ph === 'down').sort((a, b) => a.t - b.t)[0];
    if (bd) { const t = fmtT(bd.t), boss = bossName(bd); out.push({ kind: 'boss', w: bd.team === wt ? 4 : 2.5, t: bd.t, txt: S(bd.team === wt ? P.bossW : P.bossL, { side: side(bd.team), t, boss, n: bd.n }), hv: { t, boss } }); }
    const f = D.fight;
    if (f && f.gap >= 1) out.push({ kind: 'fight', w: 3.5, t: f.from, txt: S(P.fight, { side: side(f.win), from: fmtT(f.from), to: fmtT(f.to), n: f.n, a: f.c[f.win], b: f.c[1 - f.win], ab: `${f.c[f.win]}:${f.c[1 - f.win]}` }), hv: { t: fmtT(f.from) } });
    if (!R.flips.length && wt >= 0 && Math.abs(res.score[0] - res.score[1]) >= 2) out.push({ kind: 'wire', w: 2, t: R.first ? R.first.t : 0, txt: S(P.wire, { side: side(wt) }), hv: {} });
    out.sort((a, b) => b.w - a.w || Math.random() - 0.5);
    const top = out[0] || null;
    return { top, list: out.slice(0, 2).sort((a, b) => a.t - b.t) };
  }

  function pTurning(D) {
    const { R, res, my } = D, parts = [], f = R.first, won = res.winner === my, draw = res.winner === -1;
    if (f) {
      const k = f.k && D.byId[f.k], vi = D.byId[f.v];
      parts.push(k && vi ? S(f.via && f.via !== '기본 공격' ? P.openKV : P.openK, { side: f.kt === my ? D.me : D.opp, t: fmtT(f.t), kil: D.nm(k), vic: D.nm(vi), via: f.via }) : vi ? S(P.openV, { t: fmtT(f.t), vic: D.nm(vi) }) : '');
    } else parts.push(S(P.openN, { me: D.me, opp: D.opp }));
    const mm = moments(D); mm.list.forEach(m => parts.push(m.txt));
    parts.push(S(draw ? P.endD : won ? P.endW : P.endL, { me: D.me, opp: D.opp, sc: `${D.sc[0]}:${D.sc[1]}`, bb: `${D.b[0]}:${D.b[1]}` }));
    return { text: parts.filter(Boolean).join(' '), top: mm.top };
  }

  function pPlayers(D) {
    const A = AN(), res = D.res, won = res.winner === D.my, draw = res.winner === -1, con = D.con, out = [];
    const best = D.mine.reduce((a, u) => (con(u) > con(a) ? u : a)), share = u => (D.mineTot ? con(u) / D.mineTot : 0);
    out.push(S(best.healed > best.dmg ? P.starH : P.starD, { ...D.pv(best), dmg: num(best.dmg), heal: num(best.healed), k: best.kills, d: best.deaths, pct: Math.round(share(best) * 100) }));
    const rest = D.mine.filter(u => u !== best), worst = rest.reduce((a, u) => (!a || share(u) - u.deaths * A.slumpDeath < share(a) - a.deaths * A.slumpDeath ? u : a), null);
    const slump = worst && (worst.deaths >= A.slumpDeaths || share(worst) <= A.slumpShare);
    if (slump) out.push(S(worst.deaths >= A.slumpDeaths ? P.badD : P.badS, { ...D.pv(worst), dmg: num(worst.dmg), d: worst.deaths, k: worst.kills, pct: Math.round(share(worst) * 100) }));
    else out.push(S(won || draw ? P.noBad : P.noBadL, {}));
    const tk = rest.filter(u => u !== worst).reduce((a, u) => (!a || u.taken > a.taken ? u : a), null);
    if (tk && D.mineTaken && tk.taken / D.mineTaken >= A.tankShare && tk.deaths <= 1) out.push(S(P.tank, { ...D.pv(tk), pct: Math.round(tk.taken / D.mineTaken * 100), taken: num(tk.taken), d: tk.deaths }));
    if (!won) {
      const os = D.theirs.reduce((a, u) => (con(u) > con(a) ? u : a));
      out.push(S(P.oppStar, { ...D.pv(os), opp: D.opp, dmg: num(os.dmg), k: os.kills }));
    }
    if (D.dl[0] + D.dl[1] > 0) out.push(S(P.dlv, { me: D.me, opp: D.opp, a: D.dl[0], b: D.dl[1], ap: D.dp[0], bp: D.dp[1] }));
    const dtop = D.mine.reduce((a, u) => (!a || (u.dpts || 0) > (a.dpts || 0) ? u : a), null);
    if (dtop && dtop.dpts > 0) out.push(S(P.dlvTop, { ...D.pv(dtop), n: dtop.deliv, pts: dtop.dpts }));
    else if (!D.dl[0]) out.push(S(P.dlv0, {}));
    if (D.u[0] === 0) out.push(S(P.ult0, {}));
    else if (D.u[1] - D.u[0] >= 2) out.push(S(P.ultLess, { a: D.u[0], b: D.u[1] }));
    else if (D.u[0] - D.u[1] >= 2) out.push(S(P.ultMore, { a: D.u[0], b: D.u[1] }));
    return out.join(' ');
  }

  /* 개인 지시가 결과와 이어졌는지: +면 성공, -면 실패, 0이면 언급 안 함 */
  function judgeTac(c, id, u, D, A) {
    const sh = D.mineTot ? (u.dmg + u.healed) / D.mineTot : 0, tk = D.mineTaken ? u.taken / D.mineTaken : 0;
    if (c === 'act' && id === 'rush') return u.deaths >= A.rushDeaths ? -2 : (u.kills >= 2 && u.deaths <= 1 ? 2 : 0);
    if (c === 'act' && id === 'retreat') return u.deaths <= 1 && sh >= 0.3 ? 2 : (sh < A.slumpShare ? -1 : 0);
    if (c === 'mission' && id === 'hunt') return u.kills >= 2 ? 2 : (u.kills === 0 && u.deaths >= 2 ? -2 : 0);
    if (c === 'mission' && id === 'collect') return u.coresIn >= 2 ? 2 : (u.coresIn === 0 && u.deaths >= 2 ? -2 : 0);
    if (c === 'mission' && id === 'ambush') return u.kills >= 1 ? 1 : (u.deaths >= A.rushDeaths ? -1 : 0);
    if (c === 'mission') return u.deaths <= 1 ? 1 : (u.deaths >= A.rushDeaths ? -1 : 0);
    if (c === 'pos' && id === 'front') return u.deaths >= A.rushDeaths ? -2 : (u.deaths <= 1 && tk >= A.tankShare ? 2 : 0);
    if (c === 'pos' && id === 'cover') return u.deaths <= 1 && sh >= 0.3 ? 2 : 0;
    if (c === 'aim') return u.kills >= 2 ? 1 : (u.kills === 0 && u.deaths >= 2 ? -1 : 0);
    if (c === 'ult' && id === 'burst') return u.ults >= 2 ? 1 : 0;
    if (c === 'ult' && (id === 'save' || id === 'clutch')) return u.ults === 0 ? -1 : 0;
    return 0;
  }

  /* 밴픽 카운터: 상성표(CONFIG.news.analysis.counter)로 양 팀 조합을 비교 */
  function counterRead(D) {
    const A = AN(), { M, my, op, res } = D, rl = id => (CONFIG.fighters[id] || {}).role, mf = M.picks[my] || [], tf = M.picks[op] || [], won = res.winner === my;
    let s = 0, good = null, bad = null;
    mf.forEach(a => tf.forEach(b => {
      const ra = rl(a), rb = rl(b);
      if ((A.counter[ra] || []).includes(rb)) { s++; good = good || [a, b]; }
      if ((A.counter[rb] || []).includes(ra)) { s--; bad = bad || [a, b]; }
    }));
    D.ctr = s;
    let t = s > 0 ? S(won ? P.ctrPW : P.ctrPL, { gA: F(good[0]), gB: F(good[1]) })
      : s < 0 ? S(won ? P.ctrNW : P.ctrNL, { bA: F(bad[1]), mA: F(bad[0]), opp: D.opp })
        : S(P.ctrE, {});
    const bans = ((M.bans && M.bans[my]) || []).map(F);
    if (bans.length && chance(0.5)) t += ' ' + S(P.ban, { ban: bans[0] });
    return t;
  }

  function pTactics(D) {
    const A = AN(), { M, res, my, op } = D, won = res.winner === my, ok = won || res.winner === -1, T = CONFIG.tactics, mt = M.teams[my], st = mt.strategy, out = [];
    const sv = id => tacVal(T.team, st, id), nmOf = id => optName(T.team, id, sv(id));
    const [kA, kB] = D.k, [bA, bB] = D.b;
    const stance = STANCE[sv('stance')] ? sv('stance') : 'balanced';
    const good = { slay: kA > kB, boss: bA > bB || (bA === bB && won), collect: D.dp[0] >= D.dp[1], defend: ok, balanced: won }[stance];
    let line = S(STANCE[stance][good ? 'g' : 'b'], { nm: nmOf('stance'), kk: `${kA}:${kB}`, bb: `${bA}:${bB}`, hpA: D.hp[0], hpB: D.hp[1], dA: D.d[0], dl: `${D.dl[0]}:${D.dl[1]}`, opp: D.opp });
    const os = optName(T.team, 'stance', tacVal(T.team, M.teams[op].strategy, 'stance'));
    if (os !== nmOf('stance')) line += ` 상대 ${D.opp}의 기조는 '${os}'.`;
    out.push(line);
    out.push(counterRead(D));
    const picks = [];
    D.mine.forEach(u => {
      const raw = mt.tactics && mt.tactics[u.slot]; if (!raw) return;
      ['act', 'mission', 'pos', 'aim', 'ult'].forEach(c => {
        const cat = T.categories.find(x => x.id === c), id = cat ? tacVal(T.categories, raw, c) : ''; if (!cat || id === cat.neutral) return;
        const sc = judgeTac(c, id, u, D, A); if (sc) picks.push({ u, c, id, sc, cat: cat.name });
      });
    });
    picks.sort((a, b) => Math.abs(b.sc) - Math.abs(a.sc) || Math.random() - 0.5);
    const used = new Set();
    picks.forEach(p => {
      if (used.size >= A.maxTactic || used.has(p.u.id)) return; used.add(p.u.id);
      out.push(S(p.sc > 0 ? P.tacG : P.tacB, { ...D.pv(p.u), opt: optName(T.categories, p.c, p.id), cat: p.cat, k: p.u.kills, d: p.u.deaths }));
    });
    if (!used.size) out.push(S(P.tacNone, {}));
    const bp = sv('boss');
    if (BOSSP[bp]) out.push(S(BOSSP[bp][{ contest: bA > bB, steal: bA >= 1, yield: kA > kB }[bp] ? 'g' : 'b'], { nm: nmOf('boss'), bA, bb: `${bA}:${bB}`, kk: `${kA}:${kB}` }));
    const ld = sv('lead'), tr = sv('trail');
    if (SCOREP[ld] && D.lead[my] >= 2) out.push(S(SCOREP[ld][won ? 'g' : 'b'], { nm: nmOf('lead') }));
    else if (SCOREP[tr] && D.lead[op] >= 2) out.push(S(SCOREP[tr][won ? 'g' : 'b'], { nm: nmOf('trail') }));
    const mo = ((res.rec && res.rec.orders) || []).filter(o => o.team === my);
    if (mo.length) {
      const OC = CONFIG.orders, nameOf = o => ((o.scope === 'team' ? OC.team : OC.unit).find(d => d.id === o.id) || {}).name || o.id;
      const rd = o => ({ boss: bA > bB, bossWait: bA >= 1, kill: kA > kB, wave: D.dp[0] >= D.dp[1], convoy: D.dp[0] >= D.dp[1], ambush: ok, retreat: ok })[o.id];
      const judged = mo.filter(o => rd(o) !== undefined), good = judged.filter(rd), bad = judged.filter(o => !rd(o));
      let t = `지휘 ${mo.length}회(${[...new Set(mo.map(nameOf))].slice(0, 3).join('·')}).`;
      if (good.length) t += ` '${nameOf(good[0])}' 지시가 통했다.`;
      if (bad.length) t += ` '${nameOf(bad[0])}' 지시는 성과가 아쉬웠다.`;
      out.push(t);
    }
    return out.join(' ');
  }

  function pNext(D) {
    const A = AN(), { G, M, res, my } = D, won = res.winner === my, draw = res.winner === -1, T = [];
    if (D.d[0] >= A.deathsHigh) T.push({ p: 5, txt: S(['재출격 공백을 줄이는 것이 최우선이다. 이번 경기 팀 데스는 {d}회였다.', '무리한 교전을 줄여 데스({d}회)부터 관리해야 한다.'], { d: D.d[0] }) });
    if (D.lostLead) T.push({ p: 4, txt: S(['앞서던 점수를 지키는 법이 숙제다. 리드 중 \'굳히기\' 지침을 검토해 볼 만하다.', '리드를 잡은 뒤 흐름을 놓친 장면을 되짚어야 한다.'], {}) });
    if (D.dl[0] < D.dl[1]) T.push({ p: 4, txt: S(['코어 제출에서 {ab:으로/로} 밀렸다. 운반자 호위와 제출 시점 설정을 다시 점검하자.', '제출 횟수({a}:{b})를 따라잡을 수집 동선이 필요하다.'], { a: D.dl[0], b: D.dl[1], ab: `${D.dl[0]}:${D.dl[1]}` }) });
    if (D.b[0] < D.b[1]) T.push({ p: 4, txt: S(['보스 싸움에서 {ab:으로/로} 밀렸다. 등장 시각에 맞춘 합류와 보스 방침을 다시 점검하자.', '보스 타이밍에서의 손해({a}:{b})를 줄이는 것이 과제다.'], { a: D.b[0], b: D.b[1], ab: `${D.b[0]}:${D.b[1]}` }) });
    if (res.sudden && !won && !draw) T.push({ p: 3, txt: S(['정규 시간 안에 점수 차를 벌려 서든데스를 피하는 운영이 필요하다.'], {}) });
    if (D.u[0] <= A.ultLow) T.push({ p: 3, txt: S(['궁극기 사용이 적었다. 궁 타이밍 설정과 자원 관리를 손볼 필요가 있다.', '궁극기를 아끼다 놓친 장면이 없었는지 확인해 보자.'], {}) });
    if (D.k[0] < D.k[1]) T.push({ p: 3, txt: S(['교전에서 {ab:으로/로} 밀린 만큼 포지션과 집중 지시를 다시 점검할 필요가 있다.', '처치 수({a}:{b})를 따라잡을 교전 구도가 필요하다.'], { a: D.k[0], b: D.k[1], ab: `${D.k[0]}:${D.k[1]}` }) });
    if (D.ctr < 0) T.push({ p: 2, txt: S(['밴픽 단계에서 상성 열세를 피하는 선택이 필요하다.', '다음엔 상대 조합을 의식한 밴 카드가 과제다.'], {}) });
    if (won) {
      const os = D.theirs.reduce((a, u) => (D.con(u) > D.con(a) ? u : a));
      T.push({ p: 1, txt: S(['지금의 운영을 유지하되 상대 {who:을/를} 더 일찍 끊을 방법을 찾아야 한다.', '흐름은 좋다. 승리에 취하지 말고 폼과 멘탈 관리에 신경 쓰자.'], { who: D.nm(os) }) });
    }
    if (!T.length) T.push({ p: 0, txt: S(['큰 약점은 보이지 않는다. 지금의 균형을 유지하면서 변수 관리에 집중하자.', '뚜렷한 숙제는 없다. 다음 경기도 같은 밸런스로 가면 된다.'], {}) });
    T.sort((a, b) => b.p - a.p || Math.random() - 0.5);
    let intro = '';
    if (M.kind === 'league') {
      const nm = League.playerMatch(G), oid = nm && (nm.a === 'player' ? nm.b : nm.a);
      if (oid) intro = S(['다음 상대는 {n}, 현재 {r}위({rec}).', '다음 경기는 {n:과/와}의 맞대결 — {r}위({rec}).'], { n: League.name(G, oid), r: rk(G, oid), rec: rec(G, oid) });
    }
    return [intro, ...T.slice(0, A.maxTask).map(x => x.txt)].filter(Boolean).join(' ');
  }

  function analysis(G, info, date) {
    const { won, draw, res, M } = info;
    if (!res || !res.rec || !res.units || !res.units.length || !M || !M.teams || !M.picks || !wantAnalysis(res, M)) return null;
    try {
      const D = digest(G, info), mood = draw ? 'neutral' : won ? 'win' : 'lose';
      const t1 = pTurning(D), body = ['【승부처】 ' + t1.text, '【수훈·부진】 ' + pPlayers(D), '【전술 평가】 ' + pTactics(D), '【다음 과제】 ' + pNext(D)];
      const top = t1.top, pool = HEAD[top ? top.kind : (draw ? 'draw' : won ? 'win' : 'lose')];
      const star = D.mine.reduce((a, u) => (D.con(u) > D.con(a) ? u : a)), head = S(pool, { me: D.me, opp: D.opp, ...(top ? top.hv : {}) });
      const v = { ...base(G), team: D.me, opp: D.opp, mvp: D.nm(star), score: `${D.sc[0]}:${D.sc[1]}` };
      return mk(G, date, 'analysis', 'me', head, body, comments(mood, v, 5, ['analyst', 'analyst', 'meme', mood === 'lose' ? 'salty' : 'hype', 'cope']), { dupKey: 'an' + M.label + D.opp + League.isoDate(date) });
    } catch (e) { console.warn('News.analysis 실패', e); return null; }
  }

  /* ----- 라운드 종료 ----- */
  function afterRound(G, date) {
    const rows = League.sorted(G), me = rows.findIndex(t => t.id === 'player') + 1;
    const lead = rows[0], v = { ...base(G), team: G.teamName, opp: lead.name, mvp: '', score: '' };
    const rep = ensureRep(G);
    // 순위 보너스/패널티 (소폭)
    if (me === 1) shiftRep(G, 1, '단독 선두 여론');
    const head = rnd([
      `${League.lgOf(G).name} ${G.league.round}라운드 마감 — 선두 ${lead.name}`,
      `순위표 갱신: ${G.teamName} ${me}위 / 평판 ${rep.v}`
    ]);
    const body = [
      `${G.league.round}라운드가 끝났다. 선두는 ${lead.name}(${lead.w}승 ${lead.l}패).`,
      `${G.teamName}${hasB(G.teamName) ? '은' : '는'} ${me}위. 감독 평판은 ${rep.v}(${repLabel(rep.v)}).`,
      me <= 3 ? '상위권 싸움 깊게 물고 있다는 평.' : me >= Math.ceil(rows.length * 0.7) ? '강등권 공포 밈이 돌기 시작.' : '중위권 정체라는 냉정한 시선.'
    ];
    return mk(G, date, 'round', 'league', head, body, comments(me <= 3 ? 'win' : me >= rows.length - 2 ? 'lose' : 'neutral', v, 5));
  }

  /* ----- 경기 후 부가 소식: 수훈/감독 인터뷰, 부진 논란, 상대 반응, 연승 기록, 팬 커뮤니티 ----- */
  function matchExtras(G, info, date, v, rated) {
    const { won, draw, res, M } = info, cup = M.kind !== 'league', scope = cup ? 'intl' : 'me', key = M.label + v.opp + League.isoDate(date);
    const jb = josa(G.teamName, '은', '는');

    /* 1) 인터뷰 — 이기면 수훈 선수, 지면 감독 (대회는 항상) */
    if (cup || chance(won ? 0.6 : 0.4)) {
      if (won || draw) {
        const su = sideMvp(res, M, false);
        if (su) {
          const w = whoOf(G, M, su), vv = { ...v, who: w.who }, [h, t] = quoteFor('win', vv, su);
          const stat = `${w.who}${w.nick ? '(' + w.ch + ')' : ''} 이날 기록: 처치 ${su.kills}회 · 피해 ${num(su.dmg)} · 데스 ${su.deaths}회${su.deliv ? ' · 코어 제출 ' + su.deliv + '회' : ''}${su.healed ? ' · 치유 ' + num(su.healed) : ''}`;
          const [, ct] = quoteFor('coachWin', vv, null);
          mk(G, date, 'interview', scope, `[수훈 인터뷰] ${w.who}, "${h}"`, [
            `${G.teamName} ${w.who} 선수가 경기 후 인터뷰에서 ${fill('{opp:과/와}', vv)}의 경기를 돌아봤다.`,
            stat,
            `"${t}"`,
            `감독은 "${ct}"라고 덧붙였다.`
          ], eventComments('itvWin', vv, 6), { dupKey: 'iv' + key });
        }
      } else {
        const vv = { ...v }, [h, t] = quoteFor('lose', vv, null), bad = sideMvp(res, M, true), wb = bad ? whoOf(G, M, bad) : null;
        mk(G, date, 'interview', scope, `[감독 인터뷰] ${G.teamName} 감독, "${h}"`, [
          `${jb} ${v.opp}에게 패한 뒤 감독이 취재진 앞에 섰다.`,
          `"${t}"`,
          wb ? `${wb.who} 선수는 경기 직후 고개를 숙인 채 인터뷰를 사양했다.` : ''
        ], eventComments('itvLose', vv, 6), { dupKey: 'iv' + key });
      }
    }

    /* 2) 부진 논란 — 선수 평가가 '비난'일 때 */
    const bad = (rated.ratings || []).filter(r => r.tag === '비난');
    if (bad.length && chance(0.6)) {
      const r = rnd(bad), vv = { ...v, who: r.nick };
      mk(G, date, 'feature', 'me', `${r.nick} 부진 논란 — 팬들 "교체해라" vs "감싸자"`, [
        `${r.nick}의 이날 경기력을 두고 팬 커뮤니티에서 의견이 갈리고 있다.`,
        `경기 후 평가 기준 폼 ${r.form} · 멘탈 ${r.mental}.`,
        '교체를 요구하는 쪽과 "한 경기로 판단하지 말자"는 쪽이 팽팽히 맞서고 있다.'
      ], eventComments('controv', vv, 6), { dupKey: 'cv' + key });
    }

    /* 3) 상대팀 반응 */
    if (!draw && chance(cup ? 0.7 : 0.3)) {
      const vv = { ...v }, [h, t] = quoteFor(won ? 'oppWin' : 'oppLose', { ...v, team: G.teamName }, null);
      mk(G, date, 'interview', scope, `[상대 반응] ${v.opp} 감독, "${h}"`, [
        `${josa(v.opp, '은', '는')} 경기 후 공식 코멘트를 냈다.`,
        `"${t}"`
      ], eventComments('oppReact', vv, 5), { dupKey: 'op' + key });
    }

    /* 4) 연승 기록 */
    if (won && !cup && [3, 5, 7, 10].includes(G.streak)) {
      const n = G.streak, vv = { ...v, streak: n };
      mk(G, date, 'feature', 'me', `${G.teamName}, ${n}연승 — ${n >= 5 ? '구단 기록 경신 분위기' : '상승세 본격화'}`, [
        `${jb} ${n}연승을 달리며 리그 판도를 흔들고 있다.`,
        v.rank ? `현재 ${v.rank}위(${rec(G, 'player')}).` : '',
        n >= 5 ? '커뮤니티는 벌써 우승 얘기를 꺼내기 시작했다.' : '팬들은 "이 기세 그대로"를 외치고 있다.'
      ], eventComments('streak', vv, 6), { dupKey: 'st' + key });
    }

    /* 5) 팬 커뮤니티 베스트글 */
    if (chance(cup ? 0.3 : 0.15)) {
      const who = (won && v.mvp && v.mvp !== '에이스') ? v.mvp : (v.star || v.team);
      mk(G, date, 'fan', scope, `[팬 커뮤니티] "${who} 짤" 베스트 등극`, [
        `경기 직후 올라온 "${who}" 관련 짤이 커뮤니티 베스트에 올랐다.`,
        '해외 팬들까지 퍼가며 조회수가 빠르게 늘고 있다.',
        won ? '이긴 날의 분위기가 그대로 담긴 게시물이라는 평.' : '진 날에도 웃을 수 있는 게 팬덤이라는 반응.'
      ], eventComments('fan', { ...v, who }, 5), { dupKey: 'fn' + key });
    }
  }

  /* ----- 대회 개막: 진출 성공/실패에 따라 다른 기사 ----- */
  function bubble(G, t) { try { const seeds = t.seeds || []; const r = League.sorted(G).find(x => !seeds.includes(x.id)); return r ? r.name : ''; } catch (e) { return ''; } }
  const KIND_LINE = { msi: 'MSI는 전반기를 마친 상위 팀들이 모이는 첫 국제 무대다.', worlds: '월드 챔피언십은 한 해 농사를 결정짓는 최종 무대다.', playoff: '정규시즌 상위 팀들이 우승 트로피를 놓고 맞붙는 포스트시즌이다.' };
  function tourStart(G, kind, t, date) {
    const inField = !!(t.seeds && t.seeds.includes('player')), me = G.teamName, jb = josa(me, '은', '는');
    const v = { ...base(G), cup: t.name, opp: bubble(G, t), mvp: '', score: '' };
    const field = (t.seeds || []).map(id => League.name(G, id)).filter(Boolean), rank = rk(G, 'player'), rep = ensureRep(G);
    const cut = kind === 'playoff' ? CONFIG.league.playoffTeams : CONFIG.league.intlTeams;
    if (inField) {
      const [ch, ct] = quoteFor('qualCoach', v, null), [sh, st] = v.star ? quoteFor('qualStar', v, null) : [null, null];
      mk(G, date, 'interview', 'intl', `[진출 소감] ${sh ? `${v.star}, "${sh}"` : `감독, "${ch}"`}`, [
        `${me} ${t.name} 진출이 확정된 뒤 선수단이 소감을 전했다.`,
        sh ? `${v.star}: "${st}"` : '',
        `감독: "${ct}"`
      ], eventComments('itvWin', { ...v, who: v.star || '감독' }, 6));
      const head = rnd([`${me}, ${t.name} 진출 확정!`, `${t.name} 티켓 거머쥔 ${me} — 팬들 "가자!"`, `${me}, ${t.name} 본선 합류… 커뮤니티 축제 분위기`]);
      return mk(G, date, 'tour', 'intl', head, [
        `${t.name} 본선 진출 팀이 확정됐다. ${jb} ${kind === 'worlds' ? '정규시즌과 플레이오프를 거쳐' : `정규시즌 ${rank}위로`} 티켓을 따냈다.`,
        KIND_LINE[kind] || '',
        field.length ? `참가 팀: ${field.join(', ')}.` : '',
        v.star ? `팬들은 ${v.star} 선수를 중심으로 큰 기대감을 드러냈다.` : '',
        `감독 평판 ${rep.v}(${repLabel(rep.v)}). 국제 무대 여론은 냉정하다. 한 경기 한 경기가 평판에 직결된다.`
      ], eventComments('qualify', v, 8), { hot: true });
    }
    const [mh, mt] = quoteFor('missCoach', v, null);
    mk(G, date, 'interview', 'intl', `[감독 인터뷰] ${me} 감독, "${mh}"`, [`${me}의 ${t.name} 진출 실패 후 감독이 입장을 밝혔다.`, `"${mt}"`], eventComments('itvLose', v, 6));
    return mk(G, date, 'tour', 'intl', `${me}, ${t.name} 진출 실패 — 아쉬움 남긴 시즌`, [
      `${t.name} 진출 팀이 확정됐다. ${jb} ${kind === 'playoff' ? '상위권' : `상위 ${cut}팀`} 안에 들지 못했다.`,
      rank ? `정규시즌 ${rank}위(${rec(G, 'player')}).` : '',
      field.length ? `참가 팀: ${field.join(', ')}.` : '',
      `감독 평판 ${rep.v}(${repLabel(rep.v)}). 커뮤니티는 아쉬움과 응원이 엇갈렸다.`
    ], eventComments('miss', { ...v, cup: t.name }, 7), { hot: true });
  }
  function tourRound(G, t, ri, M, date) {
    const lines = (t.rounds[ri] || []).filter(m => m.winner).map(m => {
      const w = League.name(G, m.winner), l = League.name(G, m.winner === m.a ? m.b : m.a), sc = m.bo > 1 && m.wins ? ` (${Math.max(...m.wins)}:${Math.min(...m.wins)})` : ''; return `${w} def. ${l}${sc}`;
    });
    if (!lines.length) return null;
    let rn = ''; try { rn = League.roundName(t, ri); } catch (e) {}
    const pm = (t.rounds[ri] || []).find(m => m.a === 'player' || m.b === 'player'), me = G.teamName;
    const v = { ...base(G), cup: t.name, stage: rn, opp: '', mvp: '', score: '' };
    const extra = !pm || !pm.winner ? '' : pm.winner === 'player' ? `${josa(me, '은', '는')} ${josa(rn || '이번 라운드', '을', '를')} 통과해 다음 라운드에 올랐다.` : `${josa(me, '은', '는')} ${rn || '이번 라운드'}에서 여정을 마쳤다.`;
    const kind = !pm || !pm.winner ? 'cupRound' : pm.winner === 'player' ? 'cupRoundWin' : 'cupRoundLose';
    return mk(G, date, 'tour', 'intl', `${t.name} ${rn || (ri + 1) + '라운드'} 결과`, [`${t.name} 경기가 종료되었다.`, extra, ...lines.slice(0, 6)], eventComments(kind, v, 6));
  }
  function placing(t) {
    if (t.champion === 'player') return { k: 'champ', stage: '' };
    for (let i = t.rounds.length - 1; i >= 0; i--) if (t.rounds[i].some(m => m.a === 'player' || m.b === 'player')) { let st = ''; try { st = League.roundName(t, i); } catch (e) {} return { k: i === t.rounds.length - 1 ? 'runner' : 'out', stage: st }; }
    return { k: 'none', stage: '' };
  }
  function tourEnd(G, kind, date) {
    const t = G[kind], ch = t.champion, nm = League.name(G, ch), me = ch === 'player', pl = placing(t), mt = G.teamName, jb = josa(mt, '은', '는');
    const v = { ...base(G), cup: t.name, opp: nm, champ: nm, stage: pl.stage, mvp: '', score: '' };
    if (me) shiftRep(G, kind === 'worlds' ? 12 : kind === 'msi' ? 8 : 6, `${t.name} 우승`);
    else if (t.seeds && t.seeds.includes('player')) shiftRep(G, -1, `${t.name} 준우승 이하`);
    const rep = ensureRep(G);
    const itv = (kindQ, head, lines, cmKind, cv) => { const [h, q] = quoteFor(kindQ, cv, null); return mk(G, date, 'interview', 'intl', head(h), lines(q), eventComments(cmKind, cv, 6)); };
    if (pl.k === 'champ') {
      const [sh, sq] = v.star ? quoteFor('champStar', v, null) : [null, null], [ch2, cq] = quoteFor('champCoach', v, null);
      mk(G, date, 'interview', 'intl', `[우승 인터뷰] ${sh ? `${v.star}, "${sh}"` : `감독, "${ch2}"`}`, [
        `${t.name} 우승 직후 ${mt} 선수단이 소감을 전했다.`, sh ? `${v.star}: "${sq}"` : '', `감독: "${cq}"`
      ], eventComments('itvWin', { ...v, who: v.star || '감독' }, 6));
    } else if (pl.k === 'runner') {
      itv('runnerCoach', h => `[준우승 인터뷰] ${mt} 감독, "${h}"`, q => [`${t.name} 결승에서 ${nm}에 아쉽게 졌다.`, `"${q}"`], 'itvLose', v);
    } else if (pl.k === 'out') {
      itv('outCoach', h => `[감독 인터뷰] ${mt} 감독, "${h}"`, q => [`${jb} ${t.name} ${pl.stage}에서 탈락했다.`, `"${q}"`], 'itvLose', v);
    } else {
      itv('otherChamp', h => `[우승 인터뷰] ${fill(h, v)}`, q => [`${t.name} 정상에 오른 ${nm}의 인터뷰.`, `"${q}"`], 'others', v);
    }
    const head = pl.k === 'champ' ? rnd([`${mt}, ${t.name} 우승!! 여론 폭발`, `${t.name} 정상에 선 ${mt} — 커뮤니티 눈물바다`, `우승이다! ${mt}, ${t.name} 제패`])
      : pl.k === 'runner' ? rnd([`${mt}, ${t.name} 결승에서 ${nm}에 패배 — 준우승`, `아쉬운 준우승… ${mt}, 결승 문턱서 ${nm}에 무릎`])
        : pl.k === 'out' ? `${mt}, ${t.name} ${pl.stage} 탈락 — ${nm} 우승`
          : `${nm}, ${t.name} 정상 — ${jb} 다음을 기약`;
    const body = [
      `${t.name} 결승 종료. 우승은 ${nm}.`,
      pl.k === 'champ' ? '감독 평판이 크게 올랐다. 커뮤니티도 잠시 칭찬 모드.'
        : pl.k === 'runner' ? `${jb} 결승 무대까지 올랐지만 한 끗이 모자랐다.`
          : pl.k === 'out' ? `${jb} ${pl.stage}에서 여정을 마쳤다.` : '',
      pl.k !== 'none' ? `감독 평판 ${rep.v}(${repLabel(rep.v)}).` : '',
      (pl.k === 'champ' || pl.k === 'runner') && v.star ? `${v.star} 등 선수들을 향한 팬들의 헌사가 이어졌다.` : ''
    ];
    const cmKind = pl.k === 'none' ? 'others' : pl.k;
    return mk(G, date, 'tour', 'intl', head, body, eventComments(cmKind, v, cmKind === 'champ' ? 10 : 8), { hot: true });
  }
  function seasonEnd(G, date) {
    const rank = League.rankOf(G, 'player'), y = League.yearOf(G), v = { ...base(G), opp: '', mvp: '', score: '' };
    shiftRep(G, rank === 1 ? 5 : rank <= 3 ? 2 : rank >= 8 ? -1 : 0, `시즌 ${rank}위 정산`);
    const rep = ensureRep(G);
    return mk(G, date, 'season', 'me', `${y}년 시즌 종료 — ${G.teamName} ${rank}위 · 평판 ${rep.v}`, [
      `${y}년 시즌이 끝났다. 최종 ${rank}위.`,
      `감독 평판 ${rep.v}(${repLabel(rep.v)}).`,
      ...(G.seasonLines || []).map(l => l + '.')
    ], comments(rank <= 3 ? 'win' : 'lose', v, 6));
  }
  function seasonStart(G, date) {
    const y = League.yearOf(G), v = { ...base(G), opp: '', mvp: '', score: '' };
    ensureRep(G);
    // 시즌 시작 시 폼 완만 회귀
    if (G.club && G.club.roster) G.club.roster.forEach(id => {
      const p = Pros.get(G, id); if (!p) return;
      ensureProMood(p);
      p.form = clamp(Math.round(p.form * 0.85 + (50 + Facility.fx(G).form) * 0.15), 0, 100);
    });
    return mk(G, date, 'season', 'league', `${y}년 시즌 개막 — 여론은 리셋에 가깝다`, [
      `${y}년 ${League.lgOf(G).name} 리그 개막.`,
      `${G.teamName} 감독 평판 ${ensureRep(G).v}. 개막 전 기대와 조롱이 공존한다.`
    ], comments('neutral', v, 6, ['hype', 'analyst', 'salty', 'meme', 'cope']), { hot: true });
  }
  function halfEnd(G, date) {
    const lead = League.sorted(G)[0], v = { ...base(G), opp: '', mvp: '', score: '' };
    return mk(G, date, 'season', 'league', `전반기 종료 — 선두 ${lead.name}, MSI 앞두고 여론 분분`, [
      `전반기 종료. 선두 ${lead.name}. ${G.teamName}${hasB(G.teamName) ? '은' : '는'} ${League.rankOf(G, 'player')}위.`,
      '국제전 앞두고 감독 역량 재평가 기사가 나온다.'
    ], comments('neutral', v, 5, ['analyst', 'hype', 'salty', 'meme', 'rival']));
  }
  /* 주제 고정 댓글 — 경기 일반 댓글 풀과 분리 */
  function topicComments(topic, v, n) {
    const team = v.team || '', opp = v.opp || '', champ = v.mvp || '', rate = v.score || '';
    const money = v.money || rate;
    const pools = {
      meta: [
        `${champ} 요즘 진짜 많이 보이긴 함. 밴 우선순위 올려야 하는 거 아니냐`,
        `픽률 ${rate}%면 급등 맞긴 한데, 승률이 따라오는지가 중요함`,
        `연습실에서 ${champ} 연습 영상 돈다던 얘기 있었는데 이거였나`,
        `${champ} 카운터 조합 연구 안 하면 다음 주부터 고생각`,
        `메타 탄다고 무조건 좋은 건 아님. 숙련도 없으면 독임`,
        `우리 팀도 ${champ} 숙련자 있나? 없으면 밴하는 게 나을 듯`,
        `데이터만 보면 납득됨. 감정으로 까지 말자`,
        `${opp}${hasB(opp) ? '이' : '가'} ${champ} 올리면 운영이 많이 달라지긴 함`,
        `밴픽 페이즈부터 ${champ} 체크하는 습관 들여야 함`,
        `급등 챔프는 한동안 과대평가되는 구간 있음. 냉정하게 보자`
      ],
      interview: [
        `우승만 본다는 말은 누구나 하지. 성적으로 증명해야지`,
        `${opp} 감독 인터뷰 톤 보니까 자신 있는 척하는데 성적은 애매했음`,
        `선수들 반응은 어떨지. 감독만 열정 넘치면 소용없음`,
        `말발은 좋은데 밴픽이 못 따라가면 말짱 도루묵`,
        `여론은 한 번만 지면 바로 뒤집힘. 발언 조심해야 함`,
        `${opp} 팬덤은 좋아하겠네. 우리 쪽은 일단 지켜보자`,
        `인터뷰용 멘트 치곤 무난함. 특별한 정보 없음`,
        `다음 빅매치 결과 보고 평가하자. 지금은 말뿐`
      ],
      leak: [
        `${champ} 연습 영상? 고의 유출인지 스파이인지부터 의문`,
        `동선 보면 신규 빌드 연습하는 것 같긴 함`,
        `과한 확대 금지. 연습이랑 실전은 다름`,
        `저 조합 실전 나오면 밴픽 난이도 확 올라감`,
        `${team} 측에서 해명 안 나오면 커뮤니티는 계속 해석할 듯`,
        `영상 퀄 보니까 연습실 캠 유출 쪽 무게가 실림`,
        `카운터 픽 미리 준비하는 팀이 이득 봄`
      ],
      rivalry: [
        `${team} vs ${opp} 관련이면 댓글창 항상 이렇게 됨`,
        `라이벌 팬덤 감성 싸움을 데이터 싸움으로 가져가자`,
        `루머에 발끈하는 거 자체가 라이벌 맞긴 함 ㅋㅋ`,
        `진위 불명인데 감정만 앞서면 양쪽 다 손해야`,
        `${opp} 쪽 커뮤니티도 난리라던데. 시즌 내내 이런 식일 듯`,
        `더비 감성은 인정. 근데 경기력으로 말하자`
      ],
      sponsor_offer: [
        `${opp}${hasB(opp) ? '이' : '가'} 우리 구단에 붙으려는 거면 평판이 어느 정도 회복됐다는 뜻`,
        `금액 ${money}이면 ${v.tier || '스폰서'}치곤 나쁘지 않은데`,
        `광고 붙는 건 좋은데, 성적이 안 받쳐주면 재계약도 없음`,
        `이제 자금 숨통 트이나. 이적시장에서 한 명 더 볼 수 있겠는데`,
        `브랜드 이미지 생각하면 ${opp} 쪽도 손해 보는 계약은 아닐 듯`,
        `수락할지 말지는 연봉 구조랑 맞춰 봐야 함`,
        `커뮤니티: 돈 들어온다 = 좋음. 단, 방심 금지`,
        `평판 ${v.rep || ''} 기준으로 제안 온 거라면 납득됨`
      ],
      sponsor_yes: [
        `${opp} 계약 확정이면 유니폼에 로고 붙겠구만`,
        `+${money} 입금이면 당장 적자 메꾸는 데 도움 됨`,
        `스폰서 붙었다고 성적이 오르는 건 아님. 착각 금물`,
        `이제 구단 운영 여유 생기면 로스터 보강 압박도 커짐`,
        `${opp} 측 보도자료 톤 보니까 장기 파트너 원하나 봄`,
        `팬덤 반응 괜찮네. 적어도 "왜 저런 브랜드" 소리는 없음`,
        `계약금 들어온 김에 연습 시설/분석 인력에 쓰면 좋겠다`
      ],
      sponsor_no: [
        `거절한 이유가 뭐임? 금액 문제인가 조건 문제인가`,
        `단기 자금보다 브랜드 이미지가 안 맞았을 수도`,
        `거절도 전략일 수 있음. 더 큰 스폰서 노리는 건가`,
        `자금 여유 있으면 모를까, 타이트하면 아쉬운 선택`,
        `${opp} 팬들은 황당해하겠다 ㅋㅋ`,
        `여론 반반인 게 정상. 정답은 없음`
      ]
    };
    const list = pools[topic] || pools.meta;
    const out = [], used = new Set();
    const tones = topic.startsWith('sponsor')
      ? ['analyst', 'hype', 'salty', 'meme', 'cope']
      : ['analyst', 'meme', 'salty', 'hype', 'rival', 'toxic'];
    for (let i = 0; i < n; i++) {
      let text = '', guard = 0;
      do { text = rnd(list); guard++; } while (used.has(text) && guard < 12);
      used.add(text);
      const tone = tones[i % tones.length];
      out.push({
        u: nick(),
        tone,
        t: text,
        like: Math.floor(Math.random() * 50) + (tone === 'analyst' ? 18 : 8)
      });
    }
    return out.sort((a, b) => b.like - a.like);
  }

  function gossip(G, date) {
    const ts = G.league.teams.filter(t => t.id !== 'player'); if (!ts.length) return null;
    const lg = G.leagueId;
    const items = [];

    /* 1) 실제 픽률 데이터 기반 메타 가십 (경기 수 충분할 때만) */
    try {
      if (typeof Stats !== 'undefined' && Stats.leagueRates) {
        const rates = Stats.leagueRates(G, lg);
        const pickPack = rates && rates.picks;
        const picks = (pickPack && pickPack.list) || [];
        const games = (pickPack && pickPack.g) || (Stats.get(G).lg[lg] && Stats.get(G).lg[lg].g) || 0;
        if (games >= 6 && picks.length) {
          const top = picks.slice(0, 5);
          const rising = top.filter(p => Math.round(p.rate * 100) >= 18);
          if (rising.length) {
            const p = rnd(rising);
            const nm = F(p.id);
            const pct = Math.round(p.rate * 100);
            items.push({
              topic: 'meta',
              head: `${League.lgOf(G).name} ${nm} 픽률 ${pct}% — 메타 안착?`,
              body: [
                `리그 집계 ${games}경기 기준 ${nm} 픽률이 ${pct}%로 상위권이다.`,
                `연습·밴픽 단계에서 체크 대상이 되고 있다.`,
                `단순 루머가 아니라 리그 기록에 기반한 동향이다.`
              ],
              v: { ...base(G), team: G.teamName, opp: '', mvp: nm, score: String(pct) }
            });
          }
          /* 특정 팀 픽 편중 */
          const t = rnd(ts);
          const tr = Stats.teamRates(G, lg, t.name);
          const tp = (tr && tr.picks && tr.picks.list) || [];
          if (tp.length && Math.round(tp[0].rate * 100) >= 30) {
            const p = tp[0];
            const pct = Math.round(p.rate * 100);
            items.push({
              topic: 'meta',
              head: `${t.name}, ${F(p.id)} 의존도 ${pct}% — 원툴 논란`,
              body: [
                `${t.name} 경기에서 ${F(p.id)} 픽 비중이 ${pct}%에 달한다.`,
                `숙련 픽이면 강점이지만, 밴 당하면 조합이 흔들린다는 지적이 나온다.`,
                `상대 팀 밴픽에서 최우선 견제 대상으로 꼽힐 전망이다.`
              ],
              v: { ...base(G), team: t.name, opp: G.teamName, mvp: F(p.id), score: String(pct) }
            });
          }
        }
      }
    } catch (e) { /* stats 없으면 아래 일반 가십만 */ }

    /* 2) 인터뷰 / 라이벌 루머 (데이터 무관, 댓글은 주제에 맞게) */
    {
      const t = rnd(ts);
      items.push({
        topic: 'interview',
        head: `${t.name} 감독 인터뷰 "목표는 우승뿐"`,
        body: [
          `${t.name} 감독이 공식 인터뷰에서 우승을 목표로 내걸었다.`,
          `선수 기용·밴픽 방향에 대한 구체적 언급은 없어 해석이 분분하다.`,
          `커뮤니티 반응은 "말은 누구나 한다" 쪽이 우세하다.`
        ],
        v: { ...base(G), team: G.teamName, opp: t.name, mvp: '', score: '' }
      });
      items.push({
        topic: 'rivalry',
        head: `${G.teamName}·${t.name} 관련 루머에 팬덤 반응 분분`,
        body: [
          `양 팀 팬 커뮤니티를 중심으로 출처 불명의 루머가 돌고 있다.`,
          `구단 차원의 공식 입장은 아직 없다.`,
          `라이벌 감성이 섞이면서 감정적 댓글이 늘고 있다.`
        ],
        v: { ...base(G), team: G.teamName, opp: t.name, mvp: '', score: '' }
      });
    }

    /* 3) 연습 영상 가십 — 실제 상위 픽 챔프를 소재로 */
    {
      let fid = rnd(Object.keys(CONFIG.fighters));
      try {
        if (typeof Stats !== 'undefined' && Stats.topBy) {
          const top = Stats.topBy(G, 'g', 5);
          if (top && top.length) fid = rnd(top).id || fid;
        }
      } catch (e) {}
      const t = rnd(ts);
      items.push({
        topic: 'leak',
        head: `[가십] ${t.name} ${F(fid)} 연습 영상 유출 의혹`,
        body: [
          `${t.name} 연습실로 추정되는 영상에서 ${F(fid)} 동선이 포착됐다는 주장이 나왔다.`,
          `진위는 확인되지 않았고, 구단 측 해명은 없다.`,
          `실전 반영 여부와 별개로 밴픽 견제 목록에 오를 가능성은 있다.`
        ],
        v: { ...base(G), team: t.name, opp: G.teamName, mvp: F(fid), score: '' }
      });
    }

    /* 4) 파워랭킹 칼럼 — 실제 순위표 기반 */
    try {
      const rows = League.sorted(G), me = League.rankOf(G, 'player');
      if (rows.length >= 4 && G.league.round >= 2) {
        const top = rows.slice(0, 5);
        items.push({
          topic: 'power',
          head: `[파워랭킹] ${top[0].name} 1위 — ${G.teamName} ${me}위`,
          body: [`${League.lgOf(G).name} ${G.league.round}라운드 기준 파워랭킹이 공개됐다.`, ...top.map((t, i) => `${i + 1}위 ${t.name} (${t.w}승 ${t.d}무 ${t.l}패)`),
            me > 5 ? `${G.teamName}${hasB(G.teamName) ? '은' : '는'} ${me}위로 상위권 추격이 필요하다는 평.` : `${G.teamName}${hasB(G.teamName) ? '은' : '는'} ${me}위에 이름을 올렸다.`],
          v: { ...base(G), team: G.teamName, opp: top[0].name, mvp: '', score: '' }
        });
      }
    } catch (e) {}

    /* 5) 팬덤 소식 */
    {
      const b = base(G);
      items.push({
        topic: 'fanfest',
        head: `${G.teamName} 팬들, 응원 현수막·플래카드로 화제`,
        body: [
          `${G.teamName} 팬 커뮤니티가 다음 경기에 맞춰 응원 현수막을 준비하고 있다.`,
          b.star ? `${b.star} 선수 이름이 들어간 플래카드가 특히 눈길을 끈다.` : '선수단 이름을 딴 응원 문구가 인기다.',
          '구단 측은 응원 문화에 감사를 전했다.'
        ],
        v: { ...b, team: G.teamName, opp: '', mvp: '', score: '' }
      });
    }

    /* 6) 선수 조명 — 주력 파이터 */
    try {
      const line = ((G.club && G.club.lineup) || []).filter(Boolean).map(id => Pros.get(G, id)).filter(p => p && p.nick && p.favs && p.favs.length);
      if (line.length) {
        const p = rnd(line), fav = p.favs[0], r = (CONFIG.fighters[fav] || {}).role;
        items.push({
          topic: 'spot',
          head: `[선수 조명] ${p.nick}, 시그니처 ${F(fav)} — 팬들이 꼽은 주력 카드`,
          body: [
            `${G.teamName} ${p.nick} 선수의 주력 카드는 ${F(fav)}.${r ? ` 역할군은 ${ROLE[r] || r}.` : ''}`,
            '숙련도가 높은 만큼 상대 밴 우선순위에 오를 가능성도 거론된다.',
            '팬 커뮤니티에서는 "이 픽은 믿고 본다"는 반응이 이어졌다.'
          ],
          v: { ...base(G), team: G.teamName, star: p.nick, opp: '', mvp: F(fav), score: '' }
        });
      }
    } catch (e) {}

    const it = rnd(items);
    return mk(G, date, 'gossip', 'league', it.head, it.body, EV[it.topic] ? eventComments(it.topic, it.v, 6) : topicComments(it.topic, it.v, 6), { topic: it.topic });
  }

  function sponsorOffer(G, offer, date) {
    const money = Pros.money(offer.amount);
    const v = { team: G.teamName, opp: offer.brand, mvp: '', score: money, money, tier: offer.tier, rep: offer.rep };
    return mk(G, date, 'gossip', 'me',
      `[스폰서] ${offer.brand}, ${G.teamName}에 ${offer.tier} 제안`,
      [
        `평판 ${offer.rep} 구단으로 평가받으며 ${offer.brand} 측이 ${offer.tier} 계약을 타진했다.`,
        `제안 금액 ${money}. 구단 관리 화면에서 수락/거절할 수 있다.`,
        '브랜드 노출 조건과 계약 기간은 비공개. 커뮤니티는 금액·타이밍에 집중하는 분위기다.'
      ],
      topicComments('sponsor_offer', v, 6),
      { hot: true, sponsorId: offer.id, topic: 'sponsor' }
    );
  }
  function sponsorDeal(G, offer, accepted, date) {
    const money = Pros.money(offer.amount);
    const v = { team: G.teamName, opp: offer.brand, mvp: '', score: money, money, tier: offer.tier, rep: offer.rep };
    if (accepted) {
      return mk(G, date, 'gossip', 'me',
        `${G.teamName}, ${offer.brand} ${offer.tier} 계약 체결 (+${money})`,
        [
          `${offer.brand}와 공식 계약을 맺었다.`,
          `계약금 ${money}이 구단 자금에 입금됐다.`,
          `${offer.tier} 등급 스폰서로, 시즌 운영 자금에 바로 반영된다.`
        ],
        topicComments('sponsor_yes', v, 6),
        { hot: true, topic: 'sponsor' }
      );
    }
    return mk(G, date, 'gossip', 'me',
      `${G.teamName}, ${offer.brand} ${offer.tier} 제안 거절`,
      [
        `${offer.brand}의 ${offer.tier} 제안(${money})을 거절했다.`,
        '구단 측은 구체적 사유를 밝히지 않았다.',
        '단기 자금보다 조건·이미지 문제를 봤다는 해석이 나온다.'
      ],
      topicComments('sponsor_no', v, 5),
      { topic: 'sponsor' }
    );
  }
  return {
    preview, draft, result, analysis, afterRound, tourStart, tourRound, tourEnd,
    seasonEnd, seasonStart, halfEnd, gossip, sponsorOffer, sponsorDeal, TONES,
    ensureRep, repLabel, shiftRep, ensureProMood
  };
})();
