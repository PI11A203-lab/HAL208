import { DESIGNS } from './config.js?v=33-develop-merge';

// 商品の表示はカメラ初期化から独立させる。操作はmain.jsの準備後に有効になる。
export function renderArmCards(selected, ready = true) {
  document.getElementById('cards').innerHTML = Object.entries(DESIGNS).map(([key, item]) =>
    `<button class="card ${key === selected ? 'sel' : ''}" data-k="${key}" aria-pressed="${key === selected}" ${ready ? '' : 'disabled'}><img src="./assets/shop/${key}.png" alt=""><b>${item.name}</b><small>${item.desc}</small><span>${key === selected ? '✓ SELECTED' : 'SELECT'}</span></button>`).join('');
  const item = DESIGNS[selected];
  document.getElementById('dname').textContent = item.name;
  document.getElementById('ddesc').textContent = item.long;
  ['str', 'spd', 'dur'].forEach((id, index) => {
    document.getElementById(id).style.width = item.stats[index] + '%';
  });
}

document.querySelectorAll('#panel button, #stage button').forEach(button => { button.disabled = true; });
renderArmCards('mk1', false);
