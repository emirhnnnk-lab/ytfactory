# Kanallar

| Kanal | Format | Dil | Stil | Klasör |
|---|---|---|---|---|
| **Mind After Dark** | Karışık (Shorts + uzun) | EN | `gece` | `channels/mixed-en/` |
| **Beyin Kesiti** | Sadece Shorts | TR | `kesik` | `channels/shorts-tr/` |
| **The Status Engine** | Sadece uzun video | EN | `lino` | `channels/long-en/` |

Eşleme gerekçesi: 001-003 zaten TR Shorts (kesik) → Shorts kanalı. Uzun video en yüksek gelirli dilde (EN) olmalı → lino uzun kanal. Gece zaten EN → karışık kanal, ilk açılacak olan.
Görseller: `node channels/brand.js` → her klasörde `banner.png` (2560×1440) ve `avatar.png` (800×800).

**Açılış sırası:** önce Mind After Dark (veri buradan gelir), sonra Beyin Kesiti, en son The Status Engine.

---

## Senin yapacakların (kanal başına ~2 dk)
1. youtube.com → giriş → profil → **Kanal oluştur** (marka kanalı = yeni Google hesabı, o tık sende).
2. Bana "açtım" de. Aşağıdaki alanları tarayıcıda ben doldururum, her ayar değişikliğinden önce onay sorarım.
3. Her yüklemede **"Altered or synthetic content" = Evet** (klon ses).

## Kimlik paketleri

### Mind After Dark (EN · karışık · gece)
- **Durum:** ✅ açıldı 2026-11-02 · **@mindafterdarkstudies** · https://www.youtube.com/@mindafterdarkstudies (ad, handle, açıklama yayında; banner/avatar kullanıcı yükleyecek; telefon doğrulaması bekliyor)
- **Yedek isimler:** The Quiet Why · Chalk Mind
- **Açıklama:**
  > Short, sourced stories about why people do what they do: status, money, power and the quiet tricks your brain plays on you. Every claim comes from a peer-reviewed study, linked in the description. New Shorts every week, a deep-dive once a week.
- **Anahtar kelimeler:** psychology, dark psychology, behavioral science, social status, human behavior, animated psychology
- **Cadence:** haftada 4 Shorts + 1 uzun (8-12 dk). Uzun video, en çok izlenen Shorts konusunun genişletilmiş hali olur.

### Beyin Kesiti (TR · Shorts · kesik)
- **Handle önerileri:** @beyinkesiti · @beyinkesitii · @beyinkesititr
- **Yedek isimler:** Neden Böyle? · Kesik Akıl
- **Açıklama:**
  > İnsanların neden öyle davrandığını 40 saniyede anlatan çizim animasyonlar. Statü, para, güç ve beynin sana oynadığı oyunlar. Her bilgi hakemli bir çalışmaya dayanır, kaynak açıklamada.
- **Anahtar kelimeler:** psikoloji, karanlık psikoloji, davranış bilimi, insan davranışı, sosyal psikoloji
- **Cadence:** haftada 5 Shorts.

### The Status Engine (EN · uzun · lino)
- **Handle önerileri:** @thestatusengine · @statusengine · @statusenginetv
- **Yedek isimler:** Pressmark · Ink & Status
- **Açıklama:**
  > Long-form animated essays on class, money and the mind. Why the rich behave differently, why we keep up with the neighbours, how status quietly runs our choices. Built on peer-reviewed research, sources in every description.
- **Anahtar kelimeler:** social class, status psychology, wealth, inequality, video essay, behavioral economics
- **Cadence:** haftada 1 uzun video (10-15 dk).

---

## Konu havuzları

Durum: **aday** = kaynak künyesi bilinen, videodan önce tam metinde doğrulanacak (CLAUDE.md kuralı). Doğrulanan konu `videos/NNN-slug` olunca listeden düşer.

### Mind After Dark (Shorts + uzun)
| Konu | Kaynak | Durum |
|---|---|---|
| Pahalı arabalar yayaya yol vermiyor | Piff ve ark. 2012, PNAS | ✅ 004 |
| Komşun piyango kazanınca iflas riskin artar (EN sürümü) | Agarwal, Mikhed, Scholnick 2020, RFS | ✅ 003 (TR) |
| Güç sahibi olunca başkasının bakış açısını kaybetmek ("E" testi) | Galinsky ve ark. 2006, Psychological Science | aday |
| Daha zengin olanlar çocukların şekerini daha çok alır | Piff ve ark. 2012, PNAS (çalışma 4) | aday |
| Düşük statüdekiler duyguları daha iyi okur | Kraus, Côté, Keltner 2010, Psychological Science | aday |
| İnsanlar gümüş madalyalıdan bronz madalyalı kadar mutlu değil | Medvec, Madey, Gilovich 1995, JPSP | aday |
| Kalabalıkta yardım edilmeme (seyirci etkisi) | Darley & Latané 1968, JPSP | aday |
| Prestijli iş unvanı = düşük maaşa razı olmak | (kaynak aranacak) | araştır |
| Nispi gelir: başkaları daha az kazanıyorsa daha az kazanmaya razıyız | Solnick & Hemenway 1998, J. Econ. Behav. Organ. | aday |
| Status quo: insanlar varsayılanı seçer (organ bağışı) | Johnson & Goldstein 2003, Science | aday |

**Uzun video adayları:** "Neden zenginler farklı davranır?" (Piff + Kraus + Galinsky birleşimi) · "Komşuya yetişme ekonomisi" (Agarwal + Solnick + Luttmer 2005 QJE)

### Beyin Kesiti (TR Shorts)
| Konu | Kaynak | Durum |
|---|---|---|
| Franklin etkisi | Jecker & Landy 1969, Human Relations | ✅ 001 |
| Sonuncu (002) | script.tr.json'daki kaynak | ✅ 002 |
| Komşuya yetişme tuzağı | Agarwal ve ark. 2020 | ✅ 003 |
| Pahalı arabalar yol vermiyor (TR sürümü) | Piff ve ark. 2012 | ✅ doğrulandı |
| Gümüş madalya bronzdan mutsuz | Medvec ve ark. 1995 | aday |
| Kulpsuz fincan: sahip olunca değer artar (sahiplik etkisi) | Kahneman, Knetsch, Thaler 1990, JPE | aday |
| Sıra beklerken bahane yeter ("çünkü" kelimesi) | Langer, Blank, Chanowitz 1978, JPSP | aday |
| Çapalama: rastgele sayı tahmini değiştirir | Tversky & Kahneman 1974, Science | aday |
| IKEA etkisi | Norton, Mochon, Ariely 2012, JCP | aday |
| Seçenek çokluğu: 24 reçel vs 6 reçel | Iyengar & Lepper 2000, JPSP | aday (replikasyon tartışmalı, videoda söylenmeli) |

### The Status Engine (uzun)
| Konu | Kaynaklar | Durum |
|---|---|---|
| Zenginlik ve etik: araba, şeker, yalan (7 çalışma) | Piff ve ark. 2012 + eleştiri/replikasyon literatürü | kısmen doğrulandı |
| Komşuya yetişme: piyango, iflas, görünür tüketim | Agarwal 2020, Luttmer 2005 QJE, Charles ve ark. 2009 QJE | aday |
| Güç bakış açısını nasıl köreltir | Galinsky 2006, Keltner "power paradox" çalışmaları | aday |
| Statü ve sağlık (Whitehall çalışmaları) | Marmot ve ark. 1991, Lancet | aday (sağlık tavsiyesi verilmez, sadece bulgu) |
