/* fighter-kit.js — 파이터 스킬 코드(fighters / fighters2 / fighters3)가 함께 쓰는 도우미 모음 (fighters.js 보다 먼저 로드)
   사용: 파일 위쪽에서 `const { foeIn, cone } = FKit;`
   모두 엔진(b)·유닛(u)만 받는 순수 함수라서 파일별 사본 없이 한 곳에 둡니다.
   ※ fighters3.js 의 hit 은 관통(pierce) 처리가 더해져 달라서 그 파일에 남겨 두었습니다. */

const FKit = Object.freeze({
  /* ---------- 계획(plan) 도우미 ---------- */
  foeIn: (r, min) => (b, u, en) => b.skillPick(u, en, r, min || 0),
  anyIn: r => (b, u, en) => (en.some(e => b.dist(u, e) <= r) ? {} : null),

  /* 범위(range) 안에서, 주변 r 안에 적이 가장 많은 적 */
  clusterPick: (b, u, en, range, r) => {
    let best = null, bn = 0;
    for (const e of en) { if (b.dist(u, e) > range) continue; const n = en.filter(x => b.dist(x, e) <= r).length; if (n > bn || (n === bn && best && b.dist(u, e) < b.dist(u, best))) { best = e; bn = n; } }
    return best ? { t: best, n: bn } : null;
  },

  /* ---------- 피해 / 연출 ---------- */
  hit: (b, u, e, type, raw, via, extra) => b.deal(u, e, { type, raw, via, skill: true, ...(extra || {}) }),
  beam: (b, u, x2, y2, w, color) => b.emit({ type: 'beam', x1: u.x, y1: u.y, x2, y2, w, color }),
  cone: (b, u, t, range, half, color) => { const d = b.dir(u, t); b.emit({ type: 'cone', x: u.x, y: u.y, dir: Math.atan2(d.y, d.x), range, half, color }); },
  ring: (b, x, y, r, color) => b.emit({ type: 'aoe', x, y, radius: r, color }),

  /* ---------- 이동 / 위치 ---------- */
  lineEnd: (b, u, t, len) => { const d = b.dir(u, t); return b.clampPos(u.x + d.x * len, u.y + d.y * len); },
  /* t 방향으로 최대 maxDist 만큼(대상 앞 stopGap 에서 멈춤) 이동할 도착점 */
  dashTo: (b, u, t, maxDist, stopGap) => {
    const d = b.dir(u, t), go = Math.max(0, Math.min(maxDist, b.dist(u, t) - (stopGap || 0)));
    return b.clampPos(u.x + d.x * go, u.y + d.y * go);
  },

  /* 시전 중 이동·행동 잠금 */
  lock: (b, u, sec) => b.buff(u, 'channel', sec, { name: '시전 중', f: { channel: true }, quiet: true })
});
