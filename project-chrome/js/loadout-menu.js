import { LOADOUT_CATEGORIES, adjacentCategory } from './mask-fit.js';

// カメラ起動の成否とは独立してカテゴリーを操作できる。
export function createLoadoutMenu(document) {
  let current = 'arms';
  const byId = id => document.getElementById(id);
  function select(category, focus = false) {
    if (!LOADOUT_CATEGORIES.includes(category)) return;
    current = category;
    document.querySelectorAll('.tab[data-t]').forEach(tab => {
      const active = tab.dataset.t === category;
      tab.disabled = false;
      tab.classList.toggle('sel', active);
      tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
      if (active) {
        tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        if (focus) tab.focus();
      }
    });
    for (const name of LOADOUT_CATEGORIES) byId('sec-' + name).hidden = name !== category;
    byId('categoryPrev').disabled = category === LOADOUT_CATEGORIES[0];
    byId('categoryNext').disabled = category === LOADOUT_CATEGORIES.at(-1);
  }
  document.querySelectorAll('.tab[data-t]').forEach(tab => {
    tab.onclick = () => select(tab.dataset.t);
    tab.onkeydown = event => {
      const category = event.key === 'Home' ? LOADOUT_CATEGORIES[0] : event.key === 'End' ? LOADOUT_CATEGORIES.at(-1)
        : event.key === 'ArrowRight' ? adjacentCategory(current, 1)
        : event.key === 'ArrowLeft' ? adjacentCategory(current, -1) : null;
      if (category) { event.preventDefault(); select(category, true); }
    };
  });
  byId('categoryPrev').onclick = () => select(adjacentCategory(current, -1));
  byId('categoryNext').onclick = () => select(adjacentCategory(current, 1));
  select(current);
  return { select, refresh() { select(current); } };
}
