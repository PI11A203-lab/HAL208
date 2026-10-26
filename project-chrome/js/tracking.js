// One Euro フィルター：ランドマークの揺れを抑えます。
// 時刻は秒単位で渡してください。
function alpha(cutoff, dt) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
export class OneEuro {
  constructor() { this.reset(); }
  reset() { this.x = null; this.dx = 0; this.last = null; }
  filter(v, t, minCutoff, beta) {
    if (this.x === null) { this.x = v; this.dx = 0; this.last = t; return v; }
    const dt = Math.max(t - this.last, 1e-3); this.last = t;
    const dv = (v - this.x) / dt;
    const a1 = alpha(1.0, dt);
    this.dx = a1 * dv + (1 - a1) * this.dx;
    const cutoff = minCutoff + beta * Math.abs(this.dx);
    const a = alpha(cutoff, dt);
    this.x = a * v + (1 - a) * this.x;
    return this.x;
  }
}
