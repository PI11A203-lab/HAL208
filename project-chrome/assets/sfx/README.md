# 効果音

すべて `make-sfx.py` で数式から合成したオリジナルの音です（外部の音源・録音は使っていません）。
単発の音は MP3、繰り返し鳴らす音（`*-loop`）はつなぎ目が出ないよう WAV です。合計 約0.5 MB。

| ファイル | 鳴る時 | 音の作り |
|---|---|---|
| `charge-loop.wav` | 溜めている間（溜まるほど高くなる） | ずらしたのこぎり波のうなり＋電気のノイズ |
| `charge-full.mp3` | 満タンになった瞬間 | 上がっていく高い音 |
| `plasma-fire.mp3` / `plasma-hit.mp3` | PLASMA の発射 / 命中 | 下がっていくレーザー音＋低い衝撃 / 低い爆発音と火花 |
| `net-fire.mp3` / `net-open.mp3` | NET の発射 / 網が広がる | 空気の発射音 / 電気のはじける音 |
| `hook-fire.mp3` / `hook-hit.mp3` / `hook-reel.mp3` | HOOK の発射 / 刺さる / 巻き取り | 金属音＋空気 / 金属がぶつかる音 / 鎖の音とモーター |
| `fist-launch.mp3` / `thrust-loop.wav` / `fist-hit.mp3` | FIST の発射 / 飛んでいる間 / 命中 | 点火と噴射 / 噴射音 / 重い打撃音 |
| `flame-ignite.mp3` / `flame-loop.wav` | 指先の火が点く / 燃えている間 | 「ボッ」という音 / 炎のごう音とパチパチ |
| `assemble-whir.mp3` / `assemble-lock.mp3` / `assemble-done.mp3` | 装着の部品が飛ぶ / はまる / 完了 | モーター音 / 金属の固定音 / 上がっていく和音 |

- ファイル名と音量の補正は `js/config.js` の `SFX` です。差し替える時は同じファイル名で置くか、`SFX.files` を書き換えてください。
- 作り直す時：`python3 make-sfx.py .`（Python 3、numpy、scipy、ffmpeg が必要）。
- ブラウザの制限で、ページを開いて最初にクリック（APPLY など）またはキーを押した後から鳴ります。TRACKING SETTINGS の Sound・Volume、または M キーで消音できます。
- 外部の効果音（例：Kenney の CC0 素材）に差し替える場合は、出典URL・作者・ライセンスをこの README に追記してください。

| ファイル | 作者・出典 | ライセンス・利用条件 |
|---|---|---|
| すべて | HAL208 チーム（`make-sfx.py` で合成。スクリプトの作成にAI（Claude）を使用） | チーム内の作品用。外部素材なし |
