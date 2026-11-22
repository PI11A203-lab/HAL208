// 入店演出はカメラ・外部モデルの読込と独立させ、必ず終了できるようにする。
const intro = document.getElementById('storeIntro');
const skip = document.getElementById('skipIntro');
const status = document.getElementById('introStatus');
const surfaces = [document.querySelector('header'), document.getElementById('exhibitionMain')];
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
let timers = [];
let previousFocus;
function clearTimers() { timers.forEach(clearTimeout); timers = []; }
function finish() {
  clearTimers();
  intro.hidden = true;
  surfaces.forEach(el => { el.inert = false; });
  if (previousFocus?.isConnected) previousFocus.focus();
}
function start() {
  clearTimers();
  previousFocus = document.activeElement;
  intro.hidden = false;
  intro.classList.remove('is-opening', 'is-ready');
  status.textContent = 'ACCESSING STORE';
  surfaces.forEach(el => { el.inert = true; });
  skip.focus({ preventScroll: true });
  if (reduced.matches) { finish(); return; }
  timers.push(setTimeout(() => {
    intro.classList.add('is-ready');
    status.textContent = 'ACCESS GRANTED';
  }, 1450));
  timers.push(setTimeout(() => intro.classList.add('is-opening'), 2100));
  timers.push(setTimeout(finish, 3050));
}
skip.addEventListener('click', finish);
intro.addEventListener('keydown', e => {
  if (e.key === 'Escape') finish();
  if (e.key === 'Tab') { e.preventDefault(); skip.focus(); }
});
reduced.addEventListener('change', () => { if (reduced.matches) finish(); });
document.getElementById('replayIntro').addEventListener('click', start);
start();
