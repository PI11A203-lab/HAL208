# 商品画像

同梱の配布GLBからBlender / Cyclesで出力した透明背景の製品レンダー。
カメラ写真や参考画像の転載ではありません。モデル原本は変更しません。

- mk1.png / neon.png / titan.png：対応する arm-*.glb。
- cat.png：ears-prototype-04.glb。
- rabbit.png：ears-rabbit-led.glb。

再生成（repoルート、Blenderの実行パスは環境に合わせる）：

```powershell
blender --background --python scripts/blender/render_shop_products.py
```

末尾に `-- rabbit` 等を付けると対象だけを再生成できます。
