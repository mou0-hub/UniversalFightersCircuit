/* util.js — 여러 파일에서 같은 모양으로 쓰던 작은 도우미 함수 모음 (가장 먼저 로드).
   사용: 파일 위쪽에서 `const { clamp, pick } = Util;` 처럼 필요한 것만 꺼내 씁니다.
   난수(rnd)·합계(sum)·평균(avg)·포맷(fmt)은 파일마다 뜻이 달라서 여기에 넣지 않았습니다. */

const Util = Object.freeze({
  /* 값을 [a, b] 범위 안으로 제한 */
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),

  /* 배열에서 무작위로 하나 */
  pick: a => a[Math.floor(Math.random() * a.length)],

  /* 배열을 제자리에서 섞고(Fisher–Yates) 그대로 돌려줌 */
  shuffle: a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },

  /* 선형 보간 */
  lerp: (a, b, t) => a + (b - a) * t,

  /* 두 점(x, y) 사이 거리 */
  dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),

  /* 점 (px, py) 에서 선분 (x1,y1)-(x2,y2) 까지의 최단 거리. 선분 길이가 0 이면 점-점 거리 */
  segDist: (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1, k = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
    return Math.hypot(px - (x1 + dx * k), py - (y1 + dy * k));
  }
});
