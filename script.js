const $ = id => document.getElementById(id);
let S = null; // {f, rows, root, converged}

const num = v => (typeof v === 'number' && isFinite(v)) ? v : NaN;
const fmt = v => !isFinite(v) ? '–' : (v !== 0 && Math.abs(v) < 1e-4) ? v.toExponential(3) : +v.toPrecision(9) + '';
const fmtE = v => !isFinite(v) ? '–' : v === 0 ? '0' : v.toExponential(2);

function solve() {
  const msg = $('msg'); msg.textContent = '';
  const expr = $('fx').value.trim();
  const x0 = parseFloat($('x0').value);
  const tol = Math.abs(parseFloat($('tol').value)) || 1e-6;
  const maxIt = Math.max(1, Math.min(parseInt($('max').value) || 30, 100));
  if (!expr) { msg.textContent = 'Enter a function of x, for example x^3 - 8x + 5.'; return; }
  if (!isFinite(x0)) { msg.textContent = 'Enter a number for the initial guess x₀.'; return; }
  let f, df;
  try {
    const node = math.parse(expr);
    f = node.compile();
    df = math.derivative(node, 'x').compile();
    const t = f.evaluate({x: x0});
    if (typeof t !== 'number') throw new Error('f(x) must return a real number');
  } catch (e) {
    msg.textContent = 'Could not read f(x). Use x as the variable, ^ for powers and functions like sin(x), exp(x), sqrt(x).';
    return;
  }
  const F = x => { try { return num(f.evaluate({x})); } catch (e) { return NaN; } };
  const D = x => { try { return num(df.evaluate({x})); } catch (e) { return NaN; } };

  const rows = []; let x = x0, converged = false, stop = '';
  for (let n = 0; n < maxIt; n++) {
    const fx = F(x), d = D(x);
    if (!isFinite(fx) || !isFinite(d)) { stop = 'f(x) or f′(x) is undefined at x = ' + fmt(x) + '.'; break; }
    if (Math.abs(d) < 1e-12) { rows.push({n: n + 1, x, fx, d, xn: NaN, e: NaN}); stop = 'f′(x) is 0 at x = ' + fmt(x) + ', so the tangent never meets the x-axis. Try another x₀.'; break; }
    const xn = x - fx / d, e = Math.abs(xn - x);
    rows.push({n: n + 1, x, fx, d, xn, e});
    x = xn;
    if (e < tol) { converged = true; break; }
    if (Math.abs(x) > 1e12) { stop = 'The iterations diverge. Try another x₀.'; break; }
  }
  if (!rows.length) { msg.textContent = stop || 'No iterations could be computed.'; return; }
  if (!converged && !stop) stop = 'Reached the maximum iterations without meeting the tolerance.';
  msg.textContent = stop;
  const last = rows[rows.length - 1];
  const root = isFinite(last.xn) ? last.xn : last.x;
  S = {F, rows, root, converged};

  $('out').hidden = false; $('tcard').hidden = false;
  $('rootv').textContent = fmt(root);
  $('frootv').textContent = fmtE(F(root));
  $('itv').textContent = rows.length + (converged ? '' : ' (not converged)');
  const st = $('step'); st.max = rows.length; st.value = rows.length;
  $('tb').innerHTML = rows.map((r, i) => `<tr data-i="${i + 1}"><td>${r.n}</td><td>${fmt(r.x)}</td><td>${fmtE(r.fx)}</td><td>${fmt(r.d)}</td><td>${fmt(r.xn)}</td><td>${fmtE(r.e)}</td></tr>`).join('');
  draw();
}

function niceStep(span, target) {
  const raw = span / target, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

function draw() {
  if (!S) return;
  const k = +$('step').value; $('stepv').textContent = k;
  document.querySelectorAll('#tb tr').forEach(tr => tr.classList.toggle('on', +tr.dataset.i === k));
  const cv = $('cv'), dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = Math.round(Math.min(440, Math.max(300, W * 0.58)));
  cv.height = H * dpr; cv.width = W * dpr; cv.style.height = H + 'px';
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue(n).trim();
  const {F, rows, root} = S;

  // x-range from every point of the run (not only the visible ones, so the view stays steady)
  const xs = [];
  rows.forEach(r => { xs.push(r.x); if (isFinite(r.xn)) xs.push(r.xn); });
  let xlo = Math.min(...xs), xhi = Math.max(...xs);
  let span = xhi - xlo; if (span < 1) { const m = (xlo + xhi) / 2; xlo = m - 1; xhi = m + 1; span = 2; }
  const padX = span * 0.25; xlo -= padX; xhi += padX;

  // y-range from samples, trimming extreme spikes
  const N = 500, samp = [];
  for (let i = 0; i <= N; i++) { const y = F(xlo + (xhi - xlo) * i / N); if (isFinite(y)) samp.push(y); }
  const sorted = samp.slice().sort((a, b) => a - b);
  let ylo = sorted.length ? sorted[Math.floor(sorted.length * 0.02)] : -1;
  let yhi = sorted.length ? sorted[Math.floor(sorted.length * 0.98)] : 1;
  rows.forEach(r => { ylo = Math.min(ylo, r.fx); yhi = Math.max(yhi, r.fx); });
  ylo = Math.min(ylo, 0); yhi = Math.max(yhi, 0);
  if (yhi - ylo < 1e-9) { ylo -= 1; yhi += 1; }
  const padY = (yhi - ylo) * 0.1; ylo -= padY; yhi += padY;

  const L = 46, R = 14, T = 12, B = 28;
  const X = x => L + (x - xlo) / (xhi - xlo) * (W - L - R);
  const Y = y => T + (yhi - y) / (yhi - ylo) * (H - T - B);
  c.clearRect(0, 0, W, H);
  c.font = '12px system-ui,sans-serif';

  // grid + tick labels
  const sx = niceStep(xhi - xlo, Math.max(4, W / 90)), sy = niceStep(yhi - ylo, 6);
  c.lineWidth = 1; c.strokeStyle = v('--grid'); c.fillStyle = v('--muted');
  c.textAlign = 'center'; c.textBaseline = 'top';
  for (let t = Math.ceil(xlo / sx) * sx; t <= xhi; t += sx) {
    c.beginPath(); c.moveTo(X(t), T); c.lineTo(X(t), H - B); c.stroke();
    c.fillText(+t.toPrecision(6) + '', X(t), H - B + 6);
  }
  c.textAlign = 'right'; c.textBaseline = 'middle';
  for (let t = Math.ceil(ylo / sy) * sy; t <= yhi; t += sy) {
    c.beginPath(); c.moveTo(L, Y(t)); c.lineTo(W - R, Y(t)); c.stroke();
    c.fillText(+t.toPrecision(6) + '', L - 6, Y(t));
  }
  // axes
  c.strokeStyle = v('--muted'); c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(L, Y(0)); c.lineTo(W - R, Y(0)); c.stroke();
  if (xlo < 0 && xhi > 0) { c.beginPath(); c.moveTo(X(0), T); c.lineTo(X(0), H - B); c.stroke(); }

  c.save(); c.beginPath(); c.rect(L, T, W - L - R, H - T - B); c.clip();

  // curve
  c.strokeStyle = v('--curve'); c.lineWidth = 2.5; c.beginPath();
  let pen = false, py = 0;
  for (let i = 0; i <= N * 2; i++) {
    const x = xlo + (xhi - xlo) * i / (N * 2), y = F(x);
    if (!isFinite(y) || Math.abs(Y(y)) > 1e5 || (pen && Math.abs(Y(y) - py) > H * 3)) { pen = false; continue; }
    if (!pen) { c.moveTo(X(x), Y(y)); pen = true; } else c.lineTo(X(x), Y(y));
    py = Y(y);
  }
  c.stroke();

  // tangent lines + guide lines
  const vis = rows.slice(0, k);
  vis.forEach(r => {
    if (!isFinite(r.xn)) return;
    c.strokeStyle = v('--tan'); c.lineWidth = 1.8; c.setLineDash([]);
    const ext = (r.xn - r.x) * 0.15;               // extend the tangent slightly past the x-axis
    const xa = r.x - ext * 0.4, xb = r.xn + ext;
    c.beginPath(); c.moveTo(X(xa), Y(r.fx + r.d * (xa - r.x))); c.lineTo(X(xb), Y(r.fx + r.d * (xb - r.x))); c.stroke();
    c.strokeStyle = v('--muted'); c.lineWidth = 1; c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(X(r.x), Y(0)); c.lineTo(X(r.x), Y(r.fx)); c.stroke();
    c.setLineDash([]);
  });

  // points on the curve and on the x-axis
  vis.forEach((r, i) => {
    c.fillStyle = v('--point');
    c.beginPath(); c.arc(X(r.x), Y(r.fx), i === k - 1 ? 6 : 4.5, 0, 7); c.fill();
    c.fillStyle = v('--card'); c.strokeStyle = v('--point'); c.lineWidth = 2;
    c.beginPath(); c.arc(X(r.x), Y(0), 4, 0, 7); c.fill(); c.stroke();
  });
  // next point after the last visible step
  const lr = vis[vis.length - 1];
  if (isFinite(lr.xn)) {
    c.fillStyle = v('--card'); c.strokeStyle = v('--tan'); c.lineWidth = 2;
    c.beginPath(); c.arc(X(lr.xn), Y(0), 4.5, 0, 7); c.fill(); c.stroke();
  }
  // root marker at the end of the run
  if (k === rows.length && S.converged) {
    c.fillStyle = v('--root'); c.beginPath(); c.arc(X(root), Y(0), 7, 0, 7); c.fill();
  }
  c.restore();

  // labels: x0, x1, ... above the axis points
  c.fillStyle = v('--text'); c.textAlign = 'center'; c.textBaseline = 'bottom';
  const sub = '₀₁₂₃₄₅₆₇₈₉';
  const lab = n => String(n).split('').map(d => sub[+d]).join('');
  vis.forEach((r, i) => {
    if (i > 7 && i !== k - 1) return;
    const px = X(r.x); if (px < L || px > W - R) return;
    c.fillText('x' + lab(i), px, Y(0) - 9);
  });
  if (isFinite(lr.xn) && !(k === rows.length && S.converged)) {
    const px = X(lr.xn); if (px >= L && px <= W - R) c.fillText('x' + lab(k), px, Y(0) - 9);
  }
  if (k === rows.length && S.converged) {
    c.fillStyle = v('--root'); c.font = '600 12px system-ui,sans-serif';
    c.fillText('root ≈ ' + fmt(root), Math.min(Math.max(X(root), L + 50), W - R - 50), Y(0) - 14);
  }
}

$('go').addEventListener('click', solve);
$('step').addEventListener('input', draw);
['fx', 'x0', 'tol', 'max'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') solve(); }));
document.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { $('fx').value = b.dataset.f; $('x0').value = b.dataset.x; solve(); }));
window.addEventListener('resize', draw);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);
solve();
