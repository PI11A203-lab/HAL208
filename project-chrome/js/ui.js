// UI 共通ヘルパー。
// DOMイベントと画面更新の本体は main.js にあります。
// UIが大きくなったら、イベント登録をこのファイルへ順番に移動できます。
export const byId = (id) => document.getElementById(id);
