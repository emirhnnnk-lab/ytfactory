"""Ürün fotoğrafından ürünü keser: arka planı siler, boş kenarları kırpar, şeffaf PNG yazar.

Kullanım:
  python src/urun.py foto.jpg cikti.png                 # tüm fotoğraf
  python src/urun.py foto.jpg cikti.png --kutu 150,250,560,640   # önce bu bölgeye odaklan (x1,y1,x2,y2)

Yerel çalışır (rembg, u2net). Model ilk kullanımda bir kez indirilir (~170 MB, ~/.u2net).
Fotoğrafta ürünün yanında bacak/el gibi başka şeyler varsa --kutu ile ürün bölgesini vermek sonucu çok iyileştirir;
otomatik kesici "öne çıkan nesne"yi alır, hangisinin ürün olduğunu bilmez.
"""
import argparse
import sys
from pathlib import Path

from PIL import Image


def kes(foto: str, cikti: str, kutu: tuple[int, int, int, int] | None = None, model: str = "u2net",
        kenar: int = 12) -> dict:
    from rembg import new_session, remove

    im = Image.open(foto).convert("RGB")
    if kutu:
        im = im.crop(kutu)
    out = remove(im, session=new_session(model))
    alfa = out.getchannel("A")
    bbox = alfa.point(lambda a: 255 if a > 20 else 0).getbbox()
    if not bbox:
        raise SystemExit("ürün bulunamadı: arka plan silindikten sonra hiçbir şey kalmadı")
    x1, y1, x2, y2 = bbox
    out = out.crop((max(0, x1 - kenar), max(0, y1 - kenar), min(out.width, x2 + kenar), min(out.height, y2 + kenar)))
    Path(cikti).parent.mkdir(parents=True, exist_ok=True)
    out.save(cikti)
    dolu = sum(1 for a in out.getchannel("A").get_flattened_data() if a > 20) / (out.width * out.height)
    return {"cikti": cikti, "boyut": out.size, "doluluk": round(dolu, 3)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("foto"); ap.add_argument("cikti")
    ap.add_argument("--kutu", help="x1,y1,x2,y2")
    ap.add_argument("--model", default="u2net")
    a = ap.parse_args()
    k = tuple(int(v) for v in a.kutu.split(",")) if a.kutu else None
    print(kes(a.foto, a.cikti, k, a.model))
    sys.exit(0)
