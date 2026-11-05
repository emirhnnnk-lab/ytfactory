# STİL SÖZLEŞMESİ

Bu dosya kanalın görsel kimliğidir. Claude her videoda bu kurallara uyar.
Kural değişikliği sadece bu dosya değiştirilerek yapılır, video içinde istisna yoktur.

**Seçili stil:** _henüz seçilmedi_ (`lino` | `gece` | `kesik`). Renk ve fontlar `src/render/styles.js` içinde.

## 1. Değişmez kurallar
1. **Tek vurgu rengi.** Vurgu rengi sadece *anlam* taşıyan şeylere verilir: kilit kelime, kilit nesne, üstü çizilen yanlış.
   Karakterlerin kıyafetine, arka plana, dekora asla verilmez. Bir karede en fazla 2 vurgulu öğe olur.
2. **Karakterler sadece `person()` ile çizilir.** Yeni yüz, yeni vücut oranı icat edilmez.
   Farklılık sadece `hair`, `expr`, `pose` ile verilir. Yeni bir karakter tipi gerekiyorsa önce kütüphaneye eklenir, sonra kullanılır.
3. **Sahnelerde renk ve font yazılmaz.** Sahne kodu sadece rollerle konuşur (`mass`, `detail`, `accent`, `card`). Renk ve fontu stil verir.
4. **Ayaklar her zaman zemin çizgisinde** (`FEET = 1250`). Yakın plan sahneleri hariç.
5. **Güvenli alan:** önemli her şey x 90–990, y 200–1560 arasında olur. Altta Shorts arayüzü, sağda butonlar var.
6. **Altyazı** tek ve sabit konumdadır (y 1470). Başlık kartı sahnelerinde altyazı kapalıdır.

## 2. Hikâye yapısı (her video)
1. **Hook (0–3 sn):** izleyicinin bildiğini sandığı şeyi ters çeviren tek cümle. Görselde "yanlış" olan şeyin üstü vurgu rengiyle çizilir.
2. **Başlık kartı (3–5 sn):** hook'un cevabı, 2–3 kelime, büyük yazı.
3. **Kanıt hikâyesi:** gerçek, kaynaklı tek bir olay. Tarih veya isim bir damgayla (`stamp`) gösterilir.
4. **Mekanizma:** "Çünkü beyin şöyle düşünür:" — düşünce balonu.
5. **İsim:** kavramın adı, son kare. İzleyici bunu yorumlara yazar.

## 3. Yasaklar
- Kaynağı olmayan tarih, sayı, isim. Her olgunun `script.*.json` içinde kaynağı olur.
- Sağlık, hukuk, yatırım tavsiyesi (YouTube 2026 kuralı: AI karakterle bu konular paraya dönmez).
- Rahatsız edici veya duygu sömürüsü sahneler (şiddet, hayvana eziyet, ağlatma amaçlı dram).
- Rakip kanalların karakter tasarımını, renk paletini veya altyazı stilini kopyalamak.
- Aynı hook kalıbını üst üste 3 videoda kullanmak (çeşitlilik kuralı, "şablon içerik" riskine karşı).

## 4. Hareket dili
- Her sahne kesmeyle girer: hafif zoom darbesi (%3) ve yavaş yakınlaşma (%3,5).
- Yeni öğeler `backOut` ile "pop" yaparak girer. Hiçbir şey düz kayarak gelmez.
- Karakterler nefes alır ve göz kırpar. Konuşan karakterin ağzı hareket eder.
- Çarpı işareti vurgu rengiyle çizgi çizgi çizilir, darbe sesiyle.
