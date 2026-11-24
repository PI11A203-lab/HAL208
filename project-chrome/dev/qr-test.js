// 開発用：スマホで QR 受取ができるかを確かめるページ（dev/qr-test.html）の処理。展示の画面からは使わない。
import { drawQr, registerReceipt } from '../js/receipt-client.js';

const $ = (id) => document.getElementById(id);

// 確認用のダミー画像（日時入り）
function dummyPng() {
  const c = document.createElement('canvas');
  c.width = 600; c.height = 800;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 600, 800);
  grad.addColorStop(0, '#0f2a3a'); grad.addColorStop(1, '#3dd6ff');
  g.fillStyle = grad; g.fillRect(0, 0, 600, 800);
  g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = 'bold 48px system-ui, sans-serif'; g.fillText('PROJECT CHROME', 300, 300);
  g.font = '28px system-ui, sans-serif'; g.fillText('QR 受取テスト', 300, 370);
  g.fillText(new Date().toLocaleString('ja-JP'), 300, 430);
  g.font = '22px system-ui, sans-serif'; g.fillText('展示用・決済は発生しません', 300, 740);
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

async function run() {
  $('status').textContent = '登録中…';
  $('url').textContent = '';
  try {
    const { url, expiresAt } = await registerReceipt(await dummyPng());
    await drawQr($('qr'), url, { size: 320 });
    $('url').textContent = url;
    $('status').textContent = `スマホ（同じ Wi-Fi）のカメラで読み取ってください。${new Date(expiresAt).toLocaleTimeString('ja-JP')} まで有効です。`;
  } catch (e) {
    $('status').textContent = e.message;
  }
}

$('make').addEventListener('click', run);
run();
