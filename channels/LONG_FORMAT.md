# Uzun video şartnamesi (taslak)

Shorts kuralları STYLE_BIBLE.md'de. Uzun video bunlara ek olarak:

## Teknik
- 1920×1080 yatay, 30 fps. `scenes.js` sonuna `module.exports.format = 'landscape';` yazılır; render bunu görünce kareyi 1920×1080 yapar (arka plan, zemin, altyazı buna göre ayarlanır, Shorts çıktısı değişmez).
- Sahne koordinatları: güvenli alan x 120–1800, y 80–900; zemin çizgisi ~y 820; altyazı otomatik y 970.
- Süre 8-15 dk. Render süresi Shorts'ta ~9 sn/sn video, 10 dk video ≈ 1.5 saat; arka planda çalıştırılır.
- Aynı `L.wat` kuralı: her animasyon bir kelimeye bağlı.

## Yapı
1. **Soğuk açılış (0-30 sn):** en çarpıcı bulgu, Shorts hook'u gibi.
2. **Söz:** "bu videoda üç çalışmaya bakacağız".
3. **3-5 bölüm**, her biri bir çalışma: olay → yöntem (damga: yıl, N) → sonuç → sınırlılık.
4. **Karşı kanıt:** replikasyon ve eleştiriler. Uzun formatın Shorts'tan farkı ve güvenilirliği bu.
5. **Kapanış:** kavramın adı + kanalın bir Shorts'una yönlendirme.
- Bölüm başlıkları YouTube "chapters" olarak açıklamaya yazılır.

## Durum
Yatay render desteği hazır ve üç stilde test edildi. İlk uzun video yazılırken sahneler bölüm başına gruplanır (sadece yorum satırlarıyla, aynı dizi).
