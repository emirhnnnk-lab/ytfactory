"""ytfactory paneli — kaynak metinden video üreten ajanı tarayıcıdan denemek için.

Çalıştır:  streamlit run panel.py
Gereken:   Ollama açık (qwen2.5:7b + qwen2.5:14b), node, ffmpeg.
Hiçbir şey yüklemez; video videos/<slug>/out altına düşer, yayın insan kararıdır.
"""
import json
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import streamlit as st

KOK = Path(__file__).resolve().parent
VID = KOK / "videos"
STILLER = ["gece", "lino", "kesik", "neon", "gazete", "plan"]

st.set_page_config(page_title="ytfactory paneli", page_icon="🎬", layout="wide")
st.title("ytfactory · kaynaktan videoya")
st.caption("Konuyu yaz → kaynağı seç → ajan senaryoyu yazar, 14B denetçi kaynağa karşı kontrol eder, sahneleri çizer, seslendirir, render alır.")


def pubmed(pmid: str):
    u = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id={pmid}&rettype=abstract&retmode=text"
    metin = urllib.request.urlopen(u, timeout=30).read().decode("utf-8")
    b = [" ".join(s.split()) for s in metin.split("\n\n") if s.strip()]
    dergi = re.sub(r"^\d+\.\s*", "", b[0]).split(" doi:")[0] if b else ""
    baslik = b[1] if len(b) > 1 else ""
    yazar = (re.sub(r"\(\d+\)", "", b[2].split(",")[0]) + " et al.") if len(b) > 2 else ""
    return metin, f"{yazar} {baslik} {dergi} PMID {pmid}".strip()


def getjson(u, veri=None):
    r = urllib.request.Request(u, data=veri, headers={"User-Agent": "ytfactory-panel/1.0"})
    return json.loads(urllib.request.urlopen(r, timeout=60).read().decode("utf-8"))


def arama_terimi(konu: str) -> str:
    """Türkçe/serbest konuyu kısa İngilizce arama terimine çevirir (yerel 7B)."""
    g = json.dumps({"model": "qwen2.5:7b", "stream": False, "keep_alive": 0,
                    "prompt": "Turn this video topic into a short English search query (3-6 keywords) for finding research. "
                              f"Reply with the query only.\nTOPIC: {konu}"}).encode()
    try:
        return getjson("http://localhost:11434/api/generate", g)["response"].strip().strip('"')[:120]
    except Exception:
        return konu


def kaynak_ara(terim: str):
    sonuc = []
    q = urllib.parse.quote(f"({terim}) AND hasabstract")
    ids = getjson(f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=4&sort=relevance&term={q}")["esearchresult"]["idlist"]
    if ids:
        oz = getjson(f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id={','.join(ids)}")["result"]
        for i in ids:
            sonuc.append({"tur": "pubmed", "id": i, "etiket": f"📄 {oz[i]['title']} ({oz[i].get('pubdate', '')[:4]}, {oz[i].get('source', '')})"})
    w = getjson("https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=2&srsearch=" + urllib.parse.quote(terim))
    for s in w["query"]["search"]:
        sonuc.append({"tur": "wiki", "id": s["title"], "etiket": f"🌐 Wikipedia: {s['title']}"})
    return sonuc


def wiki(baslik: str):
    d = getjson("https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exintro=1&format=json&redirects=1&titles=" + urllib.parse.quote(baslik))
    sayfa = next(iter(d["query"]["pages"].values()))
    return sayfa.get("extract", ""), f"Wikipedia, \"{sayfa.get('title', baslik)}\" (en.wikipedia.org)"


def slugla(metin: str) -> str:
    tr = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    s = re.sub(r"[^a-z0-9]+", "-", metin.translate(tr).lower()).strip("-")
    return "-".join(s.split("-")[:4])


yeni, galeri = st.tabs(["Yeni video", "Galeri"])

with yeni:
    sol, sag = st.columns([3, 2])
    with sol:
        konu = st.text_input("Konu — bir iki cümleyle yaz", placeholder="örn. telefonla konuşurken araba kullanmak neden tehlikeli?")
        if st.button("Kaynak ara", disabled=not konu.strip()):
            with st.spinner("Konu arama terimine çevriliyor, PubMed ve Wikipedia taranıyor…"):
                try:
                    terim = arama_terimi(konu)
                    st.session_state.adaylar = kaynak_ara(terim)
                    st.session_state.terim = terim
                    if not st.session_state.get("slug"):
                        st.session_state.slug = slugla(terim)
                except Exception as e:
                    st.error(f"Arama başarısız: {e}")
        adaylar = st.session_state.get("adaylar", [])
        if adaylar:
            st.caption(f"Arama: *{st.session_state.get('terim', '')}* — bir kaynak seç:")
            sec = st.radio("Kaynaklar", range(len(adaylar)), format_func=lambda i: adaylar[i]["etiket"], label_visibility="collapsed")
            if st.button("Bu kaynağı kullan"):
                a = adaylar[sec]
                try:
                    st.session_state.kaynak, st.session_state.atif = pubmed(a["id"]) if a["tur"] == "pubmed" else wiki(a["id"])
                except Exception as e:
                    st.error(f"Kaynak alınamadı: {e}")
        with st.expander("Makale numarasını biliyorsan: PubMed ID ile getir"):
            pmid = st.text_input("PubMed ID", placeholder="örn. 12710835")
            if st.button("Özeti getir", disabled=not pmid.strip().isdigit()):
                try:
                    st.session_state.kaynak, st.session_state.atif = pubmed(pmid.strip())
                except Exception as e:
                    st.error(f"PubMed'e ulaşılamadı: {e}")
        kaynak = st.text_area("Kaynak metin (özet)", key="kaynak", height=260,
                              help="Ajan yalnızca bu metindeki bilgileri kullanabilir; sayılar burada geçmek zorunda.")
        atif = st.text_input("Atıf", key="atif", placeholder="Yazar (yıl), Dergi")
    with sag:
        slug = st.text_input("Video adı (otomatik dolar, değiştirebilirsin)", key="slug", placeholder="telefon-surus")
        kip = st.radio("Video türü", ["anlatim", "reklam"], horizontal=True, format_func=lambda k: {"anlatim": "Bilim anlatımı", "reklam": "Ürün reklamı"}[k],
                       help="Ürün reklamında kaynak metin ürün açıklamasıdır; ajan fiyat, indirim gibi kaynakta olmayan şeyleri yazamaz.")
        stil = st.selectbox("Stil", STILLER, index=0)
        dil = st.radio("Dil", ["en", "tr"], horizontal=True)
        sadece = st.radio("Ne kadarını üretsin?", ["senaryo", "kare", "video"], index=2, horizontal=True,
                          help="senaryo ≈ 3-6 dk · kare = + ses ve 4 kare · video ≈ 10-15 dk (bu bilgisayarda)")
        with st.expander("Ürün fotoğrafı ekle (isteğe bağlı: reklam videosu için)"):
            foto = st.file_uploader("Ürün fotoğrafı", type=["jpg", "jpeg", "png", "webp"])
            urun_kutu = st.text_input("Ürün bölgesi (isteğe bağlı) x1,y1,x2,y2", placeholder="fotoğrafta bacak/el gibi başka şeyler varsa",
                                      help="Boş bırakırsan fotoğrafta öne çıkan nesneyi keser. Ürünün yanında başka şeyler varsa ürünün kutusunu ver.")
            if foto:
                st.image(foto, caption="Yüklenen fotoğraf", width=220)
        hazir = kaynak.strip() and atif.strip() and re.fullmatch(r"[a-z0-9-]+", slug or "")
        if not hazir:
            st.info("Kaynak, atıf ve küçük harf/rakam/tireden oluşan bir slug gerekli.")
        basla = st.button("Ajanı çalıştır", type="primary", disabled=not hazir)

    if basla:
        vd = VID / slug
        vd.mkdir(parents=True, exist_ok=True)
        kp = vd / "kaynak.txt"
        kp.write_text(kaynak, encoding="utf-8")
        komut = [sys.executable, "-u", "src/ajan.py", "--slug", slug, "--kaynak", str(kp), "--atif", atif,
                 "--dil", dil, "--stil", stil, "--sadece", sadece, "--kip", kip]
        if foto:
            fp = vd / ("urun_kaynak" + Path(foto.name).suffix.lower())
            fp.write_bytes(foto.getvalue())
            komut += ["--urun", str(fp)] + (["--urun_kutu", urun_kutu.strip()] if re.fullmatch(r"\d+,\d+,\d+,\d+", urun_kutu.strip()) else [])
        kutu = st.status("Ajan çalışıyor…", expanded=True)
        satirlar = []
        alan = kutu.empty()
        p = subprocess.Popen(komut, cwd=KOK, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                             encoding="utf-8", errors="replace", env={**__import__("os").environ, "PYTHONIOENCODING": "utf-8"})
        for s in p.stdout:
            if s.strip().startswith("["):  # ajanın adım kayıtları
                satirlar.append(s.rstrip())
                alan.code("\n".join(satirlar[-25:]))
        p.wait()
        if p.returncode == 0:
            kutu.update(label="Bitti — Galeri sekmesinde izle", state="complete")
        else:
            kutu.update(label=f"Ajan hata ile durdu (kod {p.returncode})", state="error")

with galeri:
    klasorler = sorted((d for d in VID.iterdir() if d.is_dir() and any(d.glob("out/*.mp4"))), reverse=True)
    if not klasorler:
        st.info("Henüz video yok.")
    sec = st.selectbox("Video", [d.name for d in klasorler]) if klasorler else None
    if sec:
        d = VID / sec
        a, b = st.columns([2, 3])
        with a:
            for mp4 in sorted(d.glob("out/*.mp4")):
                st.video(str(mp4))
                st.caption(mp4.name)
        with b:
            for sj in sorted(d.glob("script.*.json")):
                sc = json.loads(sj.read_text(encoding="utf-8"))
                st.subheader("Senaryo")
                for l in sc.get("lines", []):
                    st.markdown(f"- {l['text']}")
                st.caption("Kaynak: " + "; ".join(sc.get("sources", [])))
            kayit = d / "ajan_kaydi.json"
            if kayit.exists():
                with st.expander("Ajan kaydı (denemeler, denetçinin yakaladıkları, onarımlar)"):
                    for k in json.loads(kayit.read_text(encoding="utf-8")):
                        st.markdown(f"**{k.get('adim')}** — deneme {k.get('deneme', '-')}, hata {k.get('hata', '-')}, onarım {k.get('onarim', '-')}")
                        for h in k.get("ilk", [])[:4]:
                            st.caption("• " + h)
            stills = sorted(d.glob("out/still_*.png"))
            if stills:
                st.subheader("Kareler")
                st.image([str(p) for p in stills[:4]], width=150)
        st.warning("Yayından önce izle ve kaynağı kontrol et. Panel hiçbir yere yükleme yapmaz.")
