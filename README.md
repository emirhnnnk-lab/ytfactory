# ytfactory — Otomatik Animasyonlu Video Fabrikası

Psikoloji ve davranış bilimi konulu **YouTube Shorts ve uzun videoları** senaryodan bitmiş MP4'e kadar otomatik üreten hat. Tek senaryo dosyasından seslendirme, kelime kelime zamanlama, çizim animasyonu ve render.

## Nasıl çalışır
1. **Senaryo** (`script.<dil>.json`): satırlar, ses, hız ve **zorunlu kaynaklar** (her olgu birincil kaynakta doğrulanır).
2. **Seslendirme** (`src/tts.py`): edge-tts ile tek geçişte seslendirir, **kelime zaman çizelgesini** çıkarır.
3. **Sahne** (`scenes.js`): animasyonlar süre oranıyla değil, *kelimeye* bağlanır (`L.wat(T, 'l3', 'kelime')`) → ses ve görüntü her zaman senkron.
4. **Render** (`src/render/render.js`): programatik SVG çizimi → kare kare görüntü → MP4. 3 görsel stil (`gece`, `kesik`, `lino`), dikey 1080×1920 ve yatay 1920×1080.

## Kanallar
| Kanal | Format | Dil | Stil |
|---|---|---|---|
| Mind After Dark | Shorts + uzun | EN | gece |
| Beyin Kesiti | Shorts | TR | kesik |
| The Status Engine | Uzun | EN | lino |

Kanal görselleri (banner, avatar) de kodla üretilir: `node channels/brand.js`.

## Örnek
`videos/004-crosswalk/` — tam senaryo, sahne dosyası ve render'dan örnek kareler.

<p>
<img src="videos/004-crosswalk/ornek-kareler/still_gece_en_2.5.png" width="220">
<img src="videos/004-crosswalk/ornek-kareler/still_gece_en_13.0.png" width="220">
<img src="videos/004-crosswalk/ornek-kareler/still_gece_en_25.0.png" width="220">
</p>

## Teknoloji
Node.js · resvg-js (SVG → PNG) · Python · edge-tts · ffmpeg

## Çalıştırma
```bash
npm install
python src/tts.py videos/004-crosswalk/script.en.json
node src/render/render.js videos/004-crosswalk gece en video
```

---
Geliştiren: **Emirhan Karaca**
