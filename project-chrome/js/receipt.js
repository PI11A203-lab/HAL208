// 仮想購入（#22）の記念レシート画像を作る。撮った写真・装備・日時・記念番号・「決済は発生しません」を 1 枚の PNG にする。
// 名前などの個人情報は入れない。描画は canvas の 2D だけ（テストでは描画命令を記録する入れ物を渡す）。

export const RECEIPT_STYLE = Object.freeze({
  width: 760,
  pad: 40,
  photoMaxH: 520,
  paper: '#fbfaf6',
  ink: '#16181c',
  sub: '#5b6470',
  accent: '#0097a7',
  sans: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", system-ui, sans-serif',
  mono: 'Menlo, "SF Mono", Consolas, "Noto Sans Mono", monospace',
});

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // 見間違えやすい 0/O・1/I は使わない

// 記念番号。例：PC-261120-1215-K7QF（日付・時刻と、ランダムな4文字）
export function makeReceiptNo(date = new Date(), random = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const p = (n) => String(n).padStart(2, '0');
  const code = Array.from(random(4), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
  return `PC-${p(date.getFullYear() % 100)}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}-${code}`;
}

export function formatReceiptDate(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${p(date.getMonth() + 1)}/${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

// 装備の一覧（レシートの品目）。装着していない物は載せない
export function receiptItems({ arm, eyes, eyeColor, ears } = {}) {
  const items = [];
  if (arm) items.push({ label: 'ARMS', name: arm });
  if (eyes === 'lens') items.push({ label: 'EYES', name: `COLOR LENS ${(eyeColor ?? '').toUpperCase()}`.trim() });
  if (eyes === 'cyber') items.push({ label: 'EYES', name: `CYBER EYE ${(eyeColor ?? '').toUpperCase()}`.trim() });
  if (ears) items.push({ label: 'HEAD', name: ears });
  return items;
}

// 写真を幅に合わせた大きさ（縦が長すぎる時は高さに合わせる）
export function fitPhoto(w, h, maxW, maxH) {
  if (!(w > 0 && h > 0)) return { w: maxW, h: Math.round(maxW * 9 / 16) };
  const s = Math.min(maxW / w, maxH / h);
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

// 記念番号から決まる飾りのバーコード（読み取りはできない）
export function decorBars(text, count = 56) {
  let h = 2166136261;
  const bars = [];
  for (let i = 0; i < count; i++) {
    h ^= text.charCodeAt(i % text.length) + i;
    h = Math.imul(h, 16777619) >>> 0;
    bars.push(1 + (h % 3));
  }
  return bars;
}

// レシートを描く。ctx = null の時は高さだけを返す（先に高さを測ってから canvas を作るため）
export function drawReceipt(ctx, { photo, photoW, photoH, items, no, date }, S = RECEIPT_STYLE) {
  const W = S.width, X = S.pad, R = W - S.pad, inner = R - X;
  const pic = fitPhoto(photoW, photoH, inner, S.photoMaxH);
  let y = 0;
  const text = (t, x, size, { align = 'left', bold = false, color = S.ink, font = S.sans } = {}) => {
    if (!ctx) return;
    ctx.fillStyle = color;
    ctx.font = `${bold ? '700 ' : ''}${size}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(t, x, y);
  };
  const dashed = () => {
    y += 18;
    if (ctx) {
      ctx.strokeStyle = S.sub; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(X, y); ctx.lineTo(R, y); ctx.stroke(); ctx.setLineDash([]);
    }
    y += 18;
  };

  if (ctx) {
    ctx.fillStyle = S.paper;
    ctx.fillRect(0, 0, W, ctx.canvas?.height ?? 4000);
  }
  y = S.pad + 40; text('PROJECT CHROME', W / 2, 40, { align: 'center', bold: true });
  y += 30; text('CYBERWARE  //  VIRTUAL STORE', W / 2, 16, { align: 'center', color: S.accent, font: S.mono });
  y += 30; text('記念レシート', W / 2, 20, { align: 'center', bold: true });
  dashed();
  y += 22; text(`日時  ${formatReceiptDate(date)}`, X, 18, { font: S.mono });
  y += 28; text(`No.   ${no}`, X, 18, { font: S.mono });
  dashed();
  if (ctx) {
    const px = Math.round((W - pic.w) / 2);
    ctx.drawImage(photo, px, y, pic.w, pic.h);
    ctx.strokeStyle = S.ink; ctx.lineWidth = 2; ctx.strokeRect(px, y, pic.w, pic.h);
  }
  y += pic.h;
  dashed();
  for (const item of items) {
    y += 26;
    text(item.label, X, 16, { font: S.mono, color: S.sub });
    text(item.name, X + 90, 20, { bold: true });
    text('¥0', R, 20, { align: 'right', font: S.mono });
  }
  if (items.length === 0) { y += 26; text('（装備なし）', X, 18, { color: S.sub }); }
  dashed();
  y += 30; text('合計', X, 26, { bold: true }); text('¥0', R, 30, { align: 'right', bold: true, font: S.mono });
  y += 30; text('お支払い', X, 18, { color: S.sub }); text('なし', R, 18, { align: 'right', color: S.sub });
  dashed();
  y += 30; text('展示用・決済は発生しません', W / 2, 24, { align: 'center', bold: true });
  y += 28; text('このレシートは体験の記念品です。商品の購入・お届けはありません。', W / 2, 14, { align: 'center', color: S.sub });
  y += 30;
  const bars = decorBars(no);
  const unit = 3, total = bars.reduce((s, b) => s + b * unit + unit, 0) - unit;
  if (ctx) {
    ctx.fillStyle = S.ink;
    let bx = Math.round((W - total) / 2);
    for (const b of bars) { ctx.fillRect(bx, y, b * unit, 56); bx += b * unit + unit; }
  }
  y += 56 + 24; text(no, W / 2, 14, { align: 'center', font: S.mono, color: S.sub });
  y += 26; text('HAL208  PROJECT CHROME  —  THANK YOU', W / 2, 13, { align: 'center', font: S.mono, color: S.sub });
  return Math.ceil(y + S.pad);
}

// 写真（PNG の Blob）とその時の装備からレシートの PNG（Blob）を作る
export async function composeReceipt({ photo, loadout, date = new Date(), no = makeReceiptNo(date), doc = document }) {
  const bitmap = await createImageBitmap(photo);
  try {
    const data = { photo: bitmap, photoW: bitmap.width, photoH: bitmap.height, items: receiptItems(loadout), no, date };
    const canvas = doc.createElement('canvas');
    canvas.width = RECEIPT_STYLE.width;
    canvas.height = drawReceipt(null, data);
    drawReceipt(canvas.getContext('2d'), data);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('レシート画像を作れませんでした。'))), 'image/png');
    });
  } finally {
    bitmap.close?.();
  }
}
