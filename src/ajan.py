"""Konu + kaynak metin -> bitmiş video. Lokal LLM (Ollama), insan onayı yayından önce.

Kullanım:
  python src/ajan.py --slug 005-ornek --kaynak kaynak.txt --atif "Yazar (Yıl). Başlık. Dergi." [--dil en] [--stil gece] [--model qwen2.5:7b]

Zincir: kaynak -> senaryo.json (LLM) -> doğrula -> sahne tarifi (LLM) -> doğrula -> tts -> kontrol kareleri -> video
Doğrulayıcılar hata bulursa hatayı LLM'e geri verip en fazla 3 kez yeniden ister.
Ajan hiçbir yere yükleme yapmaz; videoyu ve kontrol karelerini insan izler, yayın kararı insanındır.
"""
import argparse, json, re, subprocess, sys, time
from pathlib import Path
import urllib.request

KOK = Path(__file__).resolve().parents[1]
SES = {"en": "en-US-GuyNeural", "tr": "tr-TR-AhmetNeural"}
KAYIT = []
SC_AKTIF = [None]


def log(adim, **k):
    KAYIT.append({"adim": adim, "t": round(time.time(), 1), **k})
    print(f"[{adim}] " + " ".join(f"{a}={str(b)[:120]}" for a, b in k.items()), flush=True)


def llm(model, sistem, kullanici, sema=None):
    govde = {"model": model, "stream": False, "format": "json", "options": {"temperature": 0.4, "num_ctx": 8192},
             "messages": [{"role": "system", "content": sistem}, {"role": "user", "content": kullanici}]}
    r = urllib.request.urlopen(urllib.request.Request("http://localhost:11434/api/chat", json.dumps(govde).encode(),
                                                      {"Content-Type": "application/json"}), timeout=600)
    return json.loads(json.loads(r.read())["message"]["content"])


# ---------- 1. senaryo ----------
SENARYO_SISTEM = """You write narration for a 45-60 second animated explainer video about a psychology / behavioural science finding.
Return JSON: {"title": str, "lines": [{"id": "l1", "text": str, "gap": number (optional pause after, 0.2-0.6)}]}.
Rules:
- 6 to 9 lines. Each line at most 18 words, one idea per line, plain spoken {dil}.
- Line 1 is a hook that states the surprising finding. Then: who did the study, what they did, what they found, why it matters. Last line lands the point.
- Use ONLY facts present in the SOURCE. Never invent numbers, places, years or names. Write numbers as digits.
- Never use "..." (the voice engine pauses badly). Use "gap" for dramatic pauses.
- No claims stronger than the source. If the source says "predicted" do not write "caused"."""


DENETCI_SISTEM = """You are a strict fact checker. You get a SOURCE and narration LINES.
For EACH line decide if every factual claim in it is directly supported by the SOURCE with the same meaning.
Watch for: a number attached to the wrong group (e.g. a rate for ALL drivers presented as a rate for a subgroup), stronger causal wording than the source, invented details.
Return JSON: {"checks": [{"id": "l1", "supported": true|false, "evidence": "short quote from SOURCE or empty", "problem": "what is wrong, or empty"}]}"""


def olgu_denetimi(model, sc, kaynak):
    satir = "\n".join(l["id"] + ": " + l["text"] for l in sc["lines"])
    r = llm(model, DENETCI_SISTEM, f"SOURCE:\n{kaynak}\n\nLINES:\n{satir}")
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
Rules:
- Every "at", "until", "mood_at" MUST be ONE single word from that line's "allowed anchor words" list, never a phrase. It MUST be a word that is spoken in THAT line (copy it exactly).
- At most 2 accents per scene (counter, stamp and accent titles count as accents). Keep frames simple.
- Show, do not repeat: do not put the whole sentence on screen; pick 1-3 key words or a number.
- Numbers on screen must be the numbers spoken in the line."""


def spec_dogrula(spec, sc):
    o = subprocess.run(["node", "-e", "const v=require('./src/render/spec').validate;let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const{spec,sc}=JSON.parse(d);console.log(JSON.stringify(v(spec,sc)))})"],
                       cwd=KOK, input=json.dumps({"spec": spec, "sc": sc}), capture_output=True, text=True, check=True)
    h = json.loads(o.stdout)
    eksik = {l["id"] for l in sc["lines"]} - {s.get("line") for s in spec.get("scenes", [])}
    h += [f"no scene for {i}" for i in sorted(eksik)]
    return h


def kelimeler(t):
    # "34.9%" -> "34.9" (ondalık noktası korunur; model sayıyı bozmasın)
    return [re.sub(r"(?<!\d)\.|\.(?!\d)|[^\w'.]", "", w.lower()) for w in t.split() if re.sub(r"[^\w']", "", w)]


def onar(spec, sc):
    """Çok kelimeli bağları ("were observed") satırda geçen ilk kelimeye indirir. Kaç onarım yapıldığını döndürür."""
    n, satir = 0, {l["id"]: kelimeler(l["text"]) for l in sc["lines"]}
    for s in spec.get("scenes", []):
        ws = satir.get(s.get("line"), [])
        for e in s.get("elements", []):
            for k in ("at", "until", "mood_at"):
                v = e.get(k)
                if not isinstance(v, str) or not v: continue
                if any(w.startswith(re.sub(r"[^\w']", "", v.lower())) for w in ws) and " " not in v.strip(): continue
                aday = [w for w in kelimeler(v) if w in ws]
                if aday: e[k] = aday[0]; n += 1
                elif k != "at": e.pop(k); n += 1
    return n


def tekrar(ad, uret, dogrula, deneme=3):
    geri = ""
    for i in range(deneme):
        sonuc = uret(geri)
        if ad == "sahne":
            sonuc["_onarim"] = onar(sonuc, SC_AKTIF[0])
        h = dogrula(sonuc)
        log(ad, deneme=i + 1, hata=len(h), onarim=sonuc.get("_onarim", 0) if isinstance(sonuc, dict) else 0, ilk=h[:3])
        if not h:
            return sonuc
        geri = "\n\nYour previous answer had these problems, fix ALL of them and return the full JSON again:\n- " + "\n- ".join(h) + "\n\nPrevious answer:\n" + json.dumps(sonuc, ensure_ascii=False)
    raise SystemExit(f"{ad}: {deneme} denemede geçerli çıktı yok, son hatalar: {h}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", required=True); ap.add_argument("--kaynak", required=True); ap.add_argument("--atif", required=True)
    ap.add_argument("--dil", default="en"); ap.add_argument("--stil", default="gece"); ap.add_argument("--model", default="qwen2.5:7b"); ap.add_argument("--denetci", default="qwen2.5:14b")
    ap.add_argument("--sadece", choices=["senaryo", "kare", "video"], default="video")
    a = ap.parse_args()
    kaynak = Path(a.kaynak).read_text(encoding="utf-8")
    vd = KOK / "videos" / a.slug; vd.mkdir(parents=True, exist_ok=True)
    dil = {"en": "English", "tr": "Turkish"}[a.dil]
    t0 = time.time()

    sc = tekrar("senaryo", lambda g: llm(a.model, SENARYO_SISTEM.replace("{dil}", dil), f"SOURCE:\n{kaynak}{g}"),
                lambda s: senaryo_dogrula(s, kaynak) or olgu_denetimi(a.denetci, s, kaynak))
    sc.update({"id": a.slug, "lang": a.dil, "voice": SES[a.dil], "rate": "+0%", "sources": [a.atif], "uretildi": f"ajan ({a.model})"})
    (vd / f"script.{a.dil}.json").write_text(json.dumps(sc, ensure_ascii=False, indent=1), encoding="utf-8")

    b = spec_bilgi()
    sis = SAHNE_SISTEM.replace("{expr}", "/".join(b["e"])).replace("{hair}", "/".join(b["h"])).replace("{items}", "/".join(b["i"]))
    SC_AKTIF[0] = sc
    satirlar = "\n".join(l["id"] + ": " + l["text"] + "\n    allowed anchor words: " + ", ".join(kelimeler(l["text"])) for l in sc["lines"])
    spec = tekrar("sahne", lambda g: llm(a.model, sis, f"NARRATION:\n{satirlar}{g}"), lambda s: spec_dogrula(s, sc))
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
