// Dependency-free confetti burst.
const COLORS = ['#ff7eb6', '#4fd6a8', '#ffd84d', '#b9a2ff', '#7cc8ff', '#ff9f6b'];

export function confetti(count = 140) {
  const canvas = document.getElementById('confetti');
  if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.display = 'block';
  ctx.scale(dpr, dpr);
  const bits = Array.from({ length: count }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80,
    y: innerHeight * 0.55,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 16 - 6,
    r: Math.random() * 6 + 4,
    rot: Math.random() * 6,
    vr: (Math.random() - 0.5) * 0.4,
    c: COLORS[Math.floor(Math.random() * COLORS.length)],
    round: Math.random() > 0.6,
  }));
  let frames = 0;
  (function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const b of bits) {
      b.vy += 0.38; b.x += b.vx; b.y += b.vy; b.rot += b.vr; b.vx *= 0.99;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = b.c;
      if (b.round) { ctx.beginPath(); ctx.arc(0, 0, b.r / 1.5, 0, 7); ctx.fill(); }
      else ctx.fillRect(-b.r, -b.r / 2, b.r * 2, b.r);
      ctx.restore();
    }
    if (++frames < 130) requestAnimationFrame(tick);
    else { ctx.clearRect(0, 0, innerWidth, innerHeight); canvas.style.display = 'none'; }
  })();
}
