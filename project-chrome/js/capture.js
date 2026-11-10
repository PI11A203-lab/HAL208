// 撮影（PNG保存）用の処理。#11
// DOM・renderer・カメラを直接参照せず、必要なものは引数で受け取る（Nodeのテストで確認できるようにするため）。

// 撮影要求と処理中フラグの管理。撮影キューは作らず、同時に1枚だけ扱う。
export function createCaptureController({ isReady }) {
  let requested = false;
  let busy = false;
  return {
    // ボタン押下時に呼ぶ。受け付けたら true。
    request() {
      if (requested || busy || !isReady()) return false;
      requested = true;
      return true;
    },
    // render直後に呼ぶ。要求があれば true を返し、処理中へ進める。
    take() {
      if (!requested) return false;
      requested = false;
      busy = true;
      return true;
    },
    // 成功・失敗どちらでも必ず呼ぶ。
    finish() {
      busy = false;
    },
    // RESET等で未実行の要求だけを取り消す。処理中の1枚は完了させる。
    cancel() {
      requested = false;
    },
    get requested() { return requested; },
    get busy() { return busy; },
  };
}

// layers（video→eyec→glの順）を同じW×Hで重ね、全体を一回だけ左右反転して描く。
export function composeFrame(ctx, layers, width, height) {
  if (!(width > 0 && height > 0)) throw new Error('映像サイズが不正です');
  ctx.save();
  try {
    ctx.clearRect(0, 0, width, height);
    ctx.translate(width, 0);
    ctx.scale(-1, 1); // 画面のCSS scaleX(-1)と同じ見た目にする
    for (const layer of layers) ctx.drawImage(layer, 0, 0, width, height);
  } finally {
    ctx.restore();
  }
}

// canvas → PNG Blob。null・例外は reject する。
export function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('PNGの生成に失敗しました'));
      }, 'image/png');
    } catch (error) {
      reject(error);
    }
  });
}

// 個人情報を含まないファイル名。例：project-chrome-20261109-102530.png
export function makeFileName(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const d = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}`;
  const t = `${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  return `project-chrome-${d}-${t}.png`;
}

// ObjectURL + a[download] でローカル保存を開始し、後片付けする。
// ダウンロード開始前にURLを消さないよう、revokeは少し遅らせる。
export function downloadBlob(blob, fileName, { doc, urlApi, schedule = setTimeout, revokeDelayMs = 1000 }) {
  const url = urlApi.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = fileName;
  doc.body.appendChild(a);
  try {
    a.click();
  } finally {
    a.remove();
    schedule(() => urlApi.revokeObjectURL(url), revokeDelayMs);
  }
}
