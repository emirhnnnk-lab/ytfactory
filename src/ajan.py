"""Konu + kaynak metin -> bitmiş video. Lokal LLM (Ollama), insan onayı yayından önce.

Kullanım:
  python src/ajan.py --slug 005-ornek --kaynak kaynak.txt --atif "Yazar (Yıl). Başlık. Dergi." [--dil en] [--stil gece] [--model qwen2.5:7b]

Zincir: kaynak -> senaryo.json (LLM) -> doğrula -> sahne tarifi (LLM) -> doğrula -> tts -> kontrol kareleri -> video
Doğrulayıcılar hata bulursa hatayı LLM'e geri verip en fazla 3 kez yeniden ister.
Ajan hiçbir yere yükleme yapmaz; videoyu ve kontrol karelerini insan izler, yayın kararı insanındır.
"""
import argparse, json, re, subprocess, sys, time
from pathlib import Path
import urllib.request, urllib.error

KOK = Path(__file__).resolve().parents[1]
SES = {"en": "en-US-GuyNeural", "tr": "tr-TR-AhmetNeural"}
KAYIT = []
SC_AKTIF = [None]


def log(adim, **k):
    KAYIT.append({"adim": adim, "t": round(time.time(), 1), **k})
    print(f"[{adim}] " + " ".join(f"{a}={str(b)[:120]}" for a, b in k.items()), flush=True)


SON_MODEL = [None]


def bosalt(model):
    """Modeli Ollama belleğinden hemen çıkar. 16 GB RAM + 4 GB GPU'da 7B ve 14B aynı anda sığmıyor;
    ikisi birden yüklü kalınca Ollama 500 dönüyordu."""
    try:
        urllib.request.urlopen(urllib.request.Request("http://localhost:11434/api/generate",
                               json.dumps({"model": model, "keep_alive": 0}).encode(), {"Content-Type": "application/json"}), timeout=60).read()
    except Exception:
        pass


def llm(model, sistem, kullanici, sema=None):
    if SON_MODEL[0] and SON_MODEL[0] != model:
        bosalt(SON_MODEL[0]); log("model_degisimi", eski=SON_MODEL[0], yeni=model)
    SON_MODEL[0] = model
    govde = {"model": model, "stream": False, "format": "json", "options": {"temperature": 0.4, "num_ctx": 8192},
             "messages": [{"role": "system", "content": sistem}, {"role": "user", "content": kullanici}]}
    for deneme in range(4):   # Ollama model değiştirirken (7B <-> 14B) bellek yetmeyip 500 dönebiliyor
        try:
            r = urllib.request.urlopen(urllib.request.Request("http://localhost:11434/api/chat", json.dumps(govde).encode(),
                                                              {"Content-Type": "application/json"}), timeout=600)
            return json.loads(json.loads(r.read())["message"]["content"])
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:   # 500, zaman aşımı, bağlantı kopması
            log("ollama_hata", hata=getattr(e, "code", type(e).__name__), model=model, deneme=deneme + 1)
            time.sleep(15 * (deneme + 1))
    raise SystemExit(f"Ollama {model}: 4 denemede cevap yok")


# ---------- 1. senaryo ----------
SENARYO_SISTEM = """You write narration for a 45-60 second animated explainer video about a psychology / behavioural science finding.
Return JSON: {"title": str, "lines": [{"id": "l1", "text": str, "gap": number (optional pause after, 0.2-0.6)}]}.
Rules:
- 6 to 9 lines. Each line at most 18 words, one idea per line, plain spoken {dil}.
- Line 1 is a hook that states the surprising finding. Then: who did the study, what they did, what they found, why it matters. Last line lands the point.
- Use ONLY facts present in the SOURCE. Never invent numbers, places, years or names. Write numbers as digits.
- Never use "..." (the voice engine pauses badly). Use "gap" for dramatic pauses.
- No claims stronger than the source. If the source says "predicted" do not write "caused"."""


REKLAM_SISTEM = """You write the voice-over for a 20-30 second animated product ad for social media.
Return JSON: {"title": str, "lines": [{"id": "l1", "text": str, "gap": number (optional pause after, 0.2-0.6)}]}.
Rules:
- 5 or 6 short lines. Each line at most 12 words, plain spoken {dil}, warm and confident, no hype words like "amazing" or "best ever".
- Line 1 is a hook about the customer's moment or need, not about the product. Then 2-3 lines on what the product is and its concrete features. Last line is the brand name and its tagline from the SOURCE.
- Use ONLY facts present in the SOURCE. Never invent prices, discounts, materials, sizes, guarantees or delivery promises. Write numbers as digits.
- Never use "..." (the voice engine pauses badly)."""


DENETCI_SISTEM = """You are a strict fact checker. You get a SOURCE and narration LINES.
For EACH line decide if every factual claim in it is directly supported by the SOURCE with the same meaning.
Watch for: a different mechanism or outcome than the source names (e.g. the source says 'attention' but the line says 'vision'; the source tested one setting but the line generalizes to everyone or everything), a number attached to the wrong group (e.g. a rate for ALL drivers presented as a rate for a subgroup), stronger causal wording than the source, invented details.
Return JSON: {"checks": [{"id": "l1", "supported": true|false, "evidence": "short quote from SOURCE or empty", "problem": "what is wrong, or empty"}]}"""


REKLAM_DENETCI = """You check an AD voice-over against a PRODUCT DESCRIPTION. Ads may use mood, everyday moments and invitations
(e.g. "a long day in the city", "step out in style"); do NOT flag those. Flag a line ONLY if it makes a concrete PRODUCT CLAIM
that the description does not support: a price, discount, material, size, colour, feature, guarantee, delivery or health promise,
or a feature attributed to the wrong product. Brand name and tagline must match the description exactly if used.
Return JSON: {"checks": [{"id": "l1", "supported": true|false, "evidence": "short quote or empty", "problem": "what is wrong, or empty"}]}"""


def olgu_denetimi(model, sc, kaynak, sistem=None):
    satir = "\n".join(l["id"] + ": " + l["text"] for l in sc["lines"])
    r = llm(model, sistem or DENETCI_SISTEM, f"SOURCE:\n{kaynak}\n\nLINES:\n{satir}")
    return [f'{c["id"]}: not supported by SOURCE ({c.get("problem", "")})' for c in r.get("checks", []) if not c.get("supported", True)]


def sayilar(s):
    return set(re.findall(r"\d+(?:[.,]\d+)?", s.replace(",", "")))


def senaryo_dogrula(sc, kaynak):
    h = []
    ls = sc.get("lines") or []
    if not 5 <= len(ls) <= 10: h.append(f"{len(ls)} lines; need 6-9")
    kay = sayilar(kaynak)
    for i, l in enumerate(ls):
        l["id"] = f"l{i + 1}"
        t = l.get("text", "")
        if len(t.split()) > 20: h.append(f"{l['id']} has {len(t.split())} words; max 18")
        if "..." in t or "…" in t: h.append(f"{l['id']} contains '...'")
        for n in sayilar(t) - kay:
            h.append(f"{l['id']}: number {n} does not appear in the SOURCE (invented?)")
    return h


# ---------- 2. sahne tarifi ----------
def spec_bilgi():
    o = subprocess.run(["node", "-e", "const s=require('./src/render/spec');console.log(JSON.stringify({v:s.VOCAB,i:s.ITEMS,e:s.EXPR,h:s.HAIR}))"],
                       cwd=KOK, capture_output=True, text=True, check=True)
    return json.loads(o.stdout)


SAHNE_SISTEM = """You storyboard an animated explainer. For EACH narration line write one scene made of 1-4 elements.
Return JSON: {"scenes": [{"line": "l1", "elements": [ ... ]}]}
Element types (nothing else exists):
- {"type":"title","text":<=22 chars,"at":word,"pos":"left|center|right","y":"top|mid|low","accent":bool}
- {"type":"stamp","text":<=22 chars,"at":word}            short label that pops (place, year)
- {"type":"label","text":<=22 chars,"at":word,"pos":..}    small caption under things
- {"type":"person","at":word,"pos":..,"expr":one of {expr},"mood_at":word (when expression changes),"hair":one of {hair}}
- {"type":"walk","at":word}                               a person walks across
- {"type":"row","item":one of {items},"n":1-6,"at":word,"until":word,"grow":bool,"highlight":index}   items appear one by one
- {"type":"counter","to":number,"from":number,"suffix":"%" or "","at":word,"until":word}  number rolls up
- {"type":"cross","at":word}                              big X (something fails / does not happen)
- {"type":"bubble","text":<=22 chars,"at":word,"pos":..}   speech bubble
- {"type":"icon","item":one of {items},"at":word,"pos":..,"y":..,"lit_at":word (highlight moment),"tilt":-1..1 (only for scale)}   one big object
- {"type":"chart","kind":"up|down|bars","values":[numbers] (optional, only numbers from the line),"at":word,"until":word,"label":<=22 chars}   chart that draws itself
- {"type":"split","left":<=14 chars,"right":<=14 chars,"at":word,"right_at":word}   screen split in two: compare two groups/conditions
- {"type":"pair","at":word,"expr_left":..,"expr_right":..,"mood_at":word,"talk":"left|right"}   two people facing each other
- {"type":"crowd","n":3-7,"at":word,"highlight":index,"highlight_at":word}   group of people, one can stand out
Rules:
- Every "at", "until", "mood_at" MUST be ONE single word from that line's "allowed anchor words" list, never a phrase. It MUST be a word that is spoken in THAT line (copy it exactly).
- At most 2 accents per scene (counter, stamp and accent titles count as accents). Keep frames simple.
- Show, do not repeat: do not put the whole sentence on screen; pick 1-3 key words or a number.
- Numbers on screen must be the numbers spoken in the line.
- Pick the picture that SHOWS the idea: comparisons -> split, trends -> chart, groups -> crowd, conversations -> pair, objects (phone, sleep, money, time) -> icon.
- Vary the scenes: do not use the same element type in more than 2 scenes in a row."""


def spec_dogrula(spec, sc):
    o = subprocess.run(["node", "-e", "const S=require('./src/render/spec');let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const{spec,sc}=JSON.parse(d);console.log(JSON.stringify(S.validate(spec,sc).concat(S.visualCheck(spec,sc))))})"],
                       cwd=KOK, input=json.dumps({"spec": spec, "sc": sc}), capture_output=True, text=True, check=True)
    h = json.loads(o.stdout)
    eksik = {l["id"] for l in sc["lines"]} - {s.get("line") for s in spec.get("scenes", [])}
    h += [f"no scene for {i}" for i in sorted(eksik)]
    return h


def kelimeler(t):
    # "34.9%" -> "34.9" (ondalık noktası korunur; model sayıyı bozmasın)
    return [re.sub(r"(?<!\d)\.|\.(?!\d)|[^\w'.]", "", w.lower()) for w in t.split() if re.sub(r"[^\w']", "", w)]


def onar(spec, sc):
    """Modelin düzeltemediği, anlamı değiştirmeyen hataları deterministik onarır. Her onarım kayda geçer.
    - çok kelimeli bağ ("were observed") -> satırda geçen ilk kelime
    - satırda olmayan yan bağ (until, lit_at...) -> silinir; olmayan ana bağ (at) -> satırın ilk kelimesi
    - kütüphanede olmayan nesne ("laptop") -> o kelimeyi ekrana yazan başlık (anlam kaybolmaz)"""
    nz = lambda w: re.sub(r"[^\w']", "", w.lower())
    n, satir = [], {l["id"]: kelimeler(l["text"]) for l in sc["lines"]}
    # sahnesi hiç yazılmamış satır (08.11, nöbetçinin ikinci koşusunda yakalandı: "no scene for l7"):
    # satırın en uzun kelimesini gösteren sade bir başlık sahnesi eklenir; video eksik kalmaz, onarım kayda geçer
    spec.setdefault("scenes", [])
    var = {s.get("line") for s in spec["scenes"]}
    for l in sc["lines"]:
        if l["id"] not in var and satir.get(l["id"]):
            ws = satir[l["id"]]
            ana = max((w for w in ws if len(w) <= 22), key=len, default=ws[0])
            spec["scenes"].append({"line": l["id"], "elements": [{"type": "title", "text": ana, "at": ws[0]}]})
            n.append(f'{l["id"]}: sahne yoktu -> "{ana}" başlığı eklendi')
    sira = {l["id"]: i for i, l in enumerate(sc["lines"])}
    spec["scenes"].sort(key=lambda s: sira.get(s.get("line"), 999))
    bilinen = set(spec_bilgi()["i"])
    for s in spec.get("scenes", []):
        ws = satir.get(s.get("line"), [])
        for e in s.get("elements", []):
            if e.get("type") in ("row", "icon") and e.get("item") not in bilinen:
                ad = str(e.get("item") or "?")[:22]
                n.append(f'{s.get("line")}: nesne "{ad}" yok -> başlık')
                at = e.get("at"); e.clear(); e.update({"type": "title", "text": ad, "at": at})
            if e.get("type") == "counter":
                # sayaç sadece satırda söylenen bir sayıyı gösterebilir; söylenen sayı yoksa öğe çıkarılır
                sayi = [float(x) if "." in x else int(x) for x in re.findall(r"\d+(?:\.\d+)?", next((l["text"] for l in sc["lines"] if l["id"] == s.get("line")), "").replace(",", ""))]
                if not sayi: n.append(f'{s.get("line")}: sayılmayan satırda sayaç -> çıkarıldı'); e.clear(); e.update({"type": "_sil"}); continue
                if e.get("to") not in sayi: n.append(f'{s.get("line")}: sayaç {e.get("to")} -> {sayi[0]}'); e["to"] = sayi[0]
            for k in ("at", "until", "mood_at", "lit_at", "right_at", "highlight_at"):
                v = e.get(k)
                if not isinstance(v, str) or not v: continue
                if " " not in v.strip() and any(nz(w).startswith(nz(v)) for w in ws): continue
                aday = [w for w in kelimeler(v) if w in ws]
                if aday: e[k] = aday[0]; n.append(f'{s.get("line")}: {k}="{v}" -> "{aday[0]}"')
                elif k != "at": e.pop(k); n.append(f'{s.get("line")}: {k}="{v}" silindi')
                elif ws: e[k] = ws[0]; n.append(f'{s.get("line")}: at="{v}" -> "{ws[0]}" (satır başı)')
        s["elements"] = [e for e in s.get("elements", []) if e.get("type") != "_sil"]
        # stil kuralı: sahnede en fazla 2 vurgu. Fazlası modelin sık inat ettiği hata (08.11, nöbetçinin
        # yakaladığı arıza). İlk iki vurgu kalır; sonrakilerin vurgu bayrağı kaldırılır, damga sade başlığa döner.
        vurgu = 0
        for e in s["elements"]:
            bayrak = [k for k in ("accent", "lit", "lit_at") if e.get(k)]
            dogal = e.get("type") in ("counter", "stamp", "chart")
            if not (bayrak or dogal):
                continue
            vurgu += 1
            if vurgu <= 2:
                continue
            if bayrak:
                for k in bayrak: e.pop(k)
                n.append(f'{s.get("line")}: 3. vurgu ({e.get("type")}) -> vurgusuz')
            elif e.get("type") == "stamp":
                e["type"] = "title"; e.pop("accent", None)
                n.append(f'{s.get("line")}: 3. vurgu (damga) -> başlık')
    return n


def urun_garanti(spec, sc, src):
    """Ürün verildiyse sahnelerin en az yarısında görünmesini kod garanti eder (08.11: model talimata rağmen
    ürünü hiç kullanmadı). Eksik sahnelere ürün eklenir; hareketler sırayla değişir; ilk ve son sahne her zaman ürünlü."""
    sahneler = spec.get("scenes", [])
    if not sahneler:
        return []
    hareket = ["slide", "float", "pop", "spin"]
    hedef = {0, len(sahneler) - 1} | set(range(0, len(sahneler), 2))
    n = []
    for i, s in enumerate(sahneler):
        els = s.setdefault("elements", [])
        if i not in hedef or any(e.get("type") == "photo" for e in els):
            continue
        ilk = next((l["text"] for l in sc["lines"] if l["id"] == s.get("line")), "")
        kel = kelimeler(ilk)
        if not kel:
            continue
        for e in els:  # ürünü ortaya al, yazıları üste/alta it
            if e.get("type") in ("title", "stamp"): e["y"] = "top"
            elif e.get("type") == "label": e["y"] = "low"
        els.insert(0, {"type": "photo", "src": src, "at": kel[0], "motion": hareket[len(n) % 4], "y": "mid"})
        n.append(f'{s.get("line")}: ürün eklendi')
    return n


def tekrar(ad, uret, dogrula, deneme=3):
    geri = ""
    for i in range(deneme):
        sonuc = uret(geri)
        if ad == "sahne":
            sonuc["_onarim"] = onar(sonuc, SC_AKTIF[0])
        h = dogrula(sonuc)
        log(ad, deneme=i + 1, hata=len(h), onarim=len(sonuc.get("_onarim", [])) if isinstance(sonuc, dict) else 0, ilk=h[:3], onarimlar=sonuc.get("_onarim", []) if isinstance(sonuc, dict) else [])
        if not h:
            return sonuc
        geri = "\n\nYour previous answer had these problems, fix ALL of them and return the full JSON again:\n- " + "\n- ".join(h) + "\n\nPrevious answer:\n" + json.dumps(sonuc, ensure_ascii=False)
    if ad == "sahne" and h and all(x.startswith("[visual]") for x in h):
        # görsel uyarılar kural ihlali değil: video yine üretilir, uyarılar insan kontrolü için kayda geçer
        log(ad, gorsel_uyari=len(h), uyarilar=h)
        sonuc["_gorsel_uyarilar"] = h
        return sonuc
    if ad == "senaryo":
        # son çare: denetçinin hâlâ itiraz ettiği satırları at (şüpheli cümleyi tutmaktansa atmak güvenli)
        kotu = {x.split(":")[0] for x in h if re.match(r"l\d+:", x)}
        kalan = [l for l in sonuc.get("lines", []) if l.get("id") not in kotu]
        if len(kotu) == len(h) and len(kalan) >= 5:
            log(ad, son_care=f"{len(kotu)} satır çıkarıldı", satirlar=sorted(kotu))
            sonuc["lines"] = kalan
            for i, l in enumerate(kalan): l["id"] = f"l{i + 1}"
            return sonuc
    raise SystemExit(f"{ad}: {deneme} denemede geçerli çıktı yok, son hatalar: {h}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", required=True); ap.add_argument("--kaynak", required=True); ap.add_argument("--atif", required=True)
    ap.add_argument("--dil", default="en"); ap.add_argument("--stil", default="gece"); ap.add_argument("--model", default="qwen2.5:7b"); ap.add_argument("--denetci", default="qwen2.5:14b")
    ap.add_argument("--sadece", choices=["senaryo", "kare", "video"], default="video")
    ap.add_argument("--kip", choices=["anlatim", "reklam"], default="anlatim", help="anlatim: bilim videosu · reklam: ürün reklamı")
    ap.add_argument("--urun", help="ürün fotoğrafı (jpg/png); arka planı silinip videoda kullanılır")
    ap.add_argument("--urun_kutu", help="ürün bölgesi x1,y1,x2,y2 (fotoğrafta başka şeyler varsa)")
    a = ap.parse_args()
    kaynak = Path(a.kaynak).read_text(encoding="utf-8")
    vd = KOK / "videos" / a.slug; vd.mkdir(parents=True, exist_ok=True)
    dil = {"en": "English", "tr": "Turkish"}[a.dil]
    t0 = time.time()

    sc = tekrar("senaryo", lambda g: llm(a.model, (REKLAM_SISTEM if a.kip == "reklam" else SENARYO_SISTEM).replace("{dil}", dil), f"SOURCE:\n{kaynak}{g}"),
                lambda s: senaryo_dogrula(s, kaynak) or olgu_denetimi(a.denetci, s, kaynak, REKLAM_DENETCI if a.kip == "reklam" else None))
    sc.update({"id": a.slug, "lang": a.dil, "voice": SES[a.dil], "rate": "+0%", "sources": [a.atif], "uretildi": f"ajan ({a.model})"})
    (vd / f"script.{a.dil}.json").write_text(json.dumps(sc, ensure_ascii=False, indent=1), encoding="utf-8")

    b = spec_bilgi()
    sis = SAHNE_SISTEM.replace("{expr}", "/".join(b["e"])).replace("{hair}", "/".join(b["h"])).replace("{items}", "/".join(b["i"]))
    if a.urun:  # dış kaynak ürün görseli: kes, sahne diline "photo" öğesi olarak tanıt
        from urun import kes
        kutu = tuple(int(v) for v in a.urun_kutu.split(",")) if a.urun_kutu else None
        png = vd / "urun.png"
        log("urun", **kes(a.urun, str(png), kutu))
        rel = png.relative_to(KOK).as_posix()
        sis += ("\n\nA PRODUCT PHOTO is available. It is the star of this video. Use it in at least half of the scenes with: "
                '{"type":"photo","src":"' + rel + '","at":word,"pos":"left|center|right","y":"top|mid|low",'
                '"motion":"pop|float|spin|slide","size":optional px height}. Never put two photos in one scene. '
                "Put labels or titles next to it, not on top of it.")
    SC_AKTIF[0] = sc
    satirlar = "\n".join(l["id"] + ": " + l["text"] + "\n    allowed anchor words: " + ", ".join(kelimeler(l["text"])) for l in sc["lines"])
    spec = tekrar("sahne", lambda g: llm(a.model, sis, f"NARRATION:\n{satirlar}{g}"), lambda s: spec_dogrula(s, sc))
    if a.urun:
        log("urun_garanti", eklenen=urun_garanti(spec, sc, rel))
    (vd / "scenes.spec.json").write_text(json.dumps(spec, ensure_ascii=False, indent=1), encoding="utf-8")
    (vd / "scenes.js").write_text("// Ajan tarafından üretilen sahne tarifi; düzen ve zamanlama src/render/spec.js'te.\n"
                                  "module.exports = require('../../src/render/spec')(require('./scenes.spec.json'));\n", encoding="utf-8")
    if a.sadece == "senaryo":
        return

    subprocess.run([sys.executable, "src/tts.py", str(vd / f"script.{a.dil}.json")], cwd=KOK, check=True)
    log("ses", tamam=True)
    tl = json.loads((vd / f"audio_{a.dil}" / "timeline.json").read_text(encoding="utf-8"))
    dur = tl["duration"]
    kareler = ",".join(str(round(dur * f, 1)) for f in (.1, .35, .6, .85))
    subprocess.run(["node", "src/render/render.js", str(vd), a.stil, a.dil, "stills", kareler], cwd=KOK, check=True)
    log("kareler", saniyeler=kareler)
    if a.sadece == "video":
        subprocess.run(["node", "src/render/render.js", str(vd), a.stil, a.dil, "video"], cwd=KOK, check=True)
        log("video", sure_sn=round(dur, 1))
    log("bitti", toplam_sn=round(time.time() - t0))
    (vd / "ajan_kaydi.json").write_text(json.dumps(KAYIT, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nKontrol: {vd / 'out'}  — yayından önce izle ve kaynağı kontrol et.")


if __name__ == "__main__":
    main()
