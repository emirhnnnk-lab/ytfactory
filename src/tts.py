"""Synthesize the whole script in ONE pass (natural, consistent pacing) and record per-word timings.

Writes audio_<lang>/narration.wav and audio_<lang>/timeline.json:
  {duration, lines:[{id, text, start, end, words:[{w, start, end}]}]}
Scenes anchor animations to words (lib.wat), so picture and voice stay in sync in every language.
"""
import asyncio, json, re, subprocess, sys
from pathlib import Path
import edge_tts

LEAD = 0.30  # silence before the first word


def norm(w):
    return re.sub(r"[^\w']", "", w.lower())


async def main(script_path):
    sp = Path(script_path).resolve()
    s = json.loads(sp.read_text(encoding="utf-8"))
    out = sp.parent / f"audio_{s['lang']}"
    out.mkdir(exist_ok=True)
    full = " ".join(ln["text"] for ln in s["lines"])

    com = edge_tts.Communicate(full, s["voice"], rate=s.get("rate", "+0%"), boundary="WordBoundary")
    audio, words = bytearray(), []
    async for ch in com.stream():
        if ch["type"] == "audio":
            audio += ch["data"]
        elif ch["type"] == "WordBoundary":
            words.append({"w": ch["text"], "start": ch["offset"] / 1e7, "end": (ch["offset"] + ch["duration"]) / 1e7})
    mp3 = out / "narration.mp3"
    mp3.write_bytes(audio)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(mp3), "-af", "adelay=0", "-ar", "24000", "-ac", "1", str(out / "narration.wav")], check=True)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(out / "narration.wav")], capture_output=True, text=True).stdout)

    # assign boundary words to script lines in order
    lines, wi = [], 0
    for ln in s["lines"]:
        toks = [t for t in (norm(x) for x in ln["text"].split()) if t]
        mine = []
        for tok in toks:
            # boundary tokens can split/merge differently from our split (e.g. "1736'da"); consume until we cover tok
            got = ""
            while wi < len(words) and len(got) < len(tok):
                got += norm(words[wi]["w"])
                mine.append(words[wi]); wi += 1
        ws = [{"w": w["w"], "start": round(w["start"], 3), "end": round(w["end"], 3)} for w in mine]
        lines.append({"id": ln["id"], "text": ln["text"], "start": ws[0]["start"], "end": ws[-1]["end"], "words": ws})
    # edge-tts leaves ~1.1s after every sentence. Rebuild the track from speech segments: any silence longer
    # than SPLIT becomes a fixed gap (INNER inside a line, the line's "gap" between lines). Timings are shifted.
    raw = out / "narration_raw.wav"
    (out / "narration.wav").replace(raw)
    PAD, SPLIT, INNER = 0.06, 0.55, 0.30
    segs, t = [], LEAD   # (src_a, src_b, gap_after)
    shift_of = {}
    for i, ln in enumerate(lines):
        ws, cur = ln["words"], [ln["words"][0]]
        groups = []
        for w in ws[1:]:
            if w["start"] - cur[-1]["end"] > SPLIT: groups.append(cur); cur = [w]
            else: cur.append(w)
        groups.append(cur)
        for gi, grp in enumerate(groups):
            a, b = max(0, grp[0]["start"] - PAD), grp[-1]["end"] + PAD
            for w in grp: shift_of[id(w)] = t - a
            gap = INNER if gi < len(groups) - 1 else s["lines"][i].get("gap", s.get("gap", 0.28))
            segs.append((a, b, gap)); t += (b - a) + gap
    for ln in lines:
        for w in ln["words"]:
            d = shift_of[id(w)]; w["start"] = round(w["start"] + d, 3); w["end"] = round(w["end"] + d, 3)
        ln["start"], ln["end"] = ln["words"][0]["start"], ln["words"][-1]["end"]
    dur = t
    parts = [f"[0:a]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS,apad=pad_dur={g:.3f}[s{i}]" for i, (a, b, g) in enumerate(segs)]
    fc = f"anullsrc=r=24000:cl=mono,atrim=0:{LEAD}[lead];" + ";".join(parts) + ";[lead]" + "".join(f"[s{i}]" for i in range(len(segs))) + f"concat=n={len(segs)+1}:v=0:a=1[o]"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-filter_complex", fc, "-map", "[o]", "-ar", "24000", "-ac", "1", str(out / "narration.wav")], check=True)
    (out / "timeline.json").write_text(json.dumps({"duration": round(dur, 3), "lines": lines}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"total {dur:.2f}s, {len(words)} words")
    for x in lines:
        print(f"{x['start']:6.2f}-{x['end']:6.2f} {x['text']}")


asyncio.run(main(sys.argv[1]))
