// Drawing kit: style-agnostic geometry, style-specific paint.
// Every function returns an SVG string. Coordinates are in the 1080x1920 frame (Shorts),
// or 1920x1080 after setFrame(1920, 1080) for long-form videos.

let W = 1080, H = 1920;
function setFrame(w, h) { W = w; H = h; }

// ---------- math / easing ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const prog = (t, t0, d) => clamp((t - t0) / d);
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeInOut = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const backOut = x => { const c = 1.9; return Math.max(.01, 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2)); };  // never 0: resvg panics on zero-size filtered groups
const lerp = (a, b, x) => a + (b - a) * x;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// deterministic rng so every render of a frame is identical
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// time of a spoken word: wat(T, 'l3', 'hemen') -> start seconds. Throws if the word is missing,
// so a script edit can never silently desync an animation.
const normW = w => w.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}']/gu, '');
function wat(T, id, prefix, which = 'start') {
  const p = normW(prefix), w = T[id].words.find(x => normW(x.w).startsWith(p));
  if (!w) throw new Error(`word "${prefix}" not found in ${id}: ${T[id].text}`);
  return w[which];
}

// ---------- paint roles ----------
function paint(st) {
  const m = st.mode;
  return {
    mass: m === 'fill' ? `fill="url(#tex)"`
      : m === 'line' ? `fill="${st.paper}" stroke="${st.ink}" stroke-width="7" stroke-linejoin="round"`
      : `fill="${st.ink}"`,
    limb: w => m === 'line'
      ? `fill="none" stroke="${st.ink}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"`
      : `fill="none" stroke="${m === 'fill' ? 'url(#tex)' : st.ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`,
    dFill: `fill="${m === 'line' ? st.ink : st.detail}"`,
    dStroke: w => `fill="none" stroke="${m === 'line' ? st.ink : st.detail}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`,
    eyeWhite: m === 'line' ? `fill="${st.paper}" stroke="${st.ink}" stroke-width="5"` : `fill="${st.detail}"`,
    pupil: m === 'line' ? st.ink : st.ink,
    aFill: `fill="${st.accent}"`,
    aStroke: w => `fill="none" stroke="${st.accent}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`,
    // light surfaces (speech bubbles, cards)
    card: m === 'fill' ? `fill="${st.paper}" stroke="${st.ink}" stroke-width="8" stroke-linejoin="round"`
      : m === 'line' ? `fill="${st.paper}" stroke="${st.ink}" stroke-width="6" stroke-linejoin="round"`
      : `fill="${st.detail}"`,
    cardInk: m === 'line' ? st.ink : st.ink,
    shadow: m === 'cut' ? ` filter="url(#sh)"` : '',
    faint: m === 'line' ? `fill="none" stroke="${st.ink}" stroke-width="5" opacity=".22"`
      : `fill="${st.ink}" opacity="${m === 'fill' ? .13 : .16}"`,
  };
}

// ---------- shared <defs> per frame ----------
function defs(st, frame) {
  let d = '<defs>';
  if (st.mode === 'fill') {
    // speckled ink texture (the "grain" of a lino print)
    const r = rng(7); let sp = '';
    for (let i = 0; i < 340; i++) {
      const x = (r() * 240).toFixed(1), y = (r() * 240).toFixed(1), w = (1 + r() * 2.6).toFixed(1);
      sp += `<rect x="${x}" y="${y}" width="${w}" height="${(1 + r() * 1.6).toFixed(1)}" fill="${st.paper}" opacity="${(.25 + r() * .5).toFixed(2)}"/>`;
    }
    d += `<pattern id="tex" width="240" height="240" patternUnits="userSpaceOnUse"><rect width="240" height="240" fill="${st.ink}"/>${sp}</pattern>`;
  }
  if (st.mode === 'cut') d += `<filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="7" dy="10" stdDeviation="5" flood-color="#000" flood-opacity=".33"/></filter>`;
  if (st.mode === 'line') {
    // "boil": hand-drawn wobble, re-seeded every 4 frames
    d += `<filter id="wob" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="${Math.floor(frame / 4) % 6}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter>`;
    d += `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>`;
  }
  return d + '</defs>';
}

// static background, rendered once per style to PNG
function background(st) {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>
    <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="4"/><feColorMatrix type="saturate" values="0"/></filter>
    <filter id="f"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.2" numOctaves="2" seed="9"/><feColorMatrix type="saturate" values="0"/></filter>
    <radialGradient id="v" cx="50%" cy="45%" r="75%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="${st.mode === 'line' ? .55 : .22}"/></radialGradient>
  </defs><rect width="${W}" height="${H}" fill="${st.paper}"/>`;
  s += `<rect width="${W}" height="${H}" filter="url(#n)" opacity="${st.mode === 'line' ? .05 : .10}"/>`;
  s += `<rect width="${W}" height="${H}" filter="url(#f)" opacity="${st.mode === 'line' ? .03 : .07}"/>`;
  if (st.mode === 'line') { // notebook dot grid
    for (let y = 60; y < H; y += 54) for (let x = 36; x < W; x += 54) s += `<circle cx="${x}" cy="${y}" r="2" fill="${st.ink}" opacity=".09"/>`;
  }
  if (st.mode === 'cut') { // a lighter torn sheet behind the stage
    const r = rng(3), top = H > W ? 240 : 70; let p = `M70,${top} `;
    for (let x = 70; x <= W - 70; x += 22) p += `L${x},${top + r() * 14 - 7} `;
    for (let y = top; y <= H - 220; y += 22) p += `L${W - 70 + r() * 12 - 6},${y} `;
    for (let x = W - 70; x >= 70; x -= 22) p += `L${x},${H - 220 + r() * 14 - 7} `;
    for (let y = H - 220; y >= top; y -= 22) p += `L${70 + r() * 12 - 6},${y} `;
    s += `<path d="${p}Z" fill="#EADFC8" transform="rotate(-1.2 ${W / 2} ${H / 2})" filter="url(#n)" opacity="0"/>`;
    s += `<path d="${p}Z" fill="#E9DDC4" transform="rotate(-1.2 ${W / 2} ${H / 2})"/>`;
    s += `<path d="${p}Z" filter="url(#n)" opacity=".06" transform="rotate(-1.2 ${W / 2} ${H / 2})"/>`;
  }
  if (st.mode === 'fill') { // carved border lines top & bottom, our signature instead of a frame
    for (let i = 0; i < 4; i++) s += `<rect x="60" y="${(H > W ? 150 : 50) + i * 16}" width="${W - 120}" height="5" fill="${st.ink}" opacity="${.85 - i * .2}"/>`;
    for (let i = 0; i < 4; i++) s += `<rect x="60" y="${H - (H > W ? 165 : 65) - i * 16}" width="${W - 120}" height="5" fill="${st.ink}" opacity="${.85 - i * .2}"/>`;
  }
  return s + `<rect width="${W}" height="${H}" fill="url(#v)"/></svg>`;
}

// ---------- ground ----------
function ground(st, y = 1250) {
  const p = paint(st);
  if (st.mode === 'line') return `<path d="M90,${y} C${W * .28},${y - 6} ${W * .65},${y + 6} ${W - 90},${y}" ${p.limb(0)}/>`;
  if (st.mode === 'cut') {
    const r = rng(11); let d = `M0,${y} `;
    for (let x = 0; x <= W; x += 30) d += `L${x},${y + r() * 10 - 5} `;
    return `<path d="${d}L${W},${H} L0,${H}Z" fill="${st.ink}" opacity=".9"${p.shadow}/>`;
  }
  // lino: carved hatch band
  let s = `<rect x="60" y="${y}" width="${W - 120}" height="120" fill="url(#tex)"/>`;
  for (let i = 0; i < 6; i++) s += `<path d="M60,${y + 18 + i * 18} C${W * .32},${y + 12 + i * 18} ${W * .65},${y + 26 + i * 18} ${W - 60},${y + 18 + i * 18}" fill="none" stroke="${st.paper}" stroke-width="3" opacity=".8"/>`;
  return s;
}

// ---------- characters ----------
// o: { x, y(feet), s, face(1 right / -1 left), phase,
//      build: normal|thin|heavy|short, outfit: coat|suit|worker|hoodie,
//      hair: none|bun|franklin|rival|cap|slick|curly|pony,
//      expr: neutral|happy|sad|angry|surprised|smug|worried|fear, look: 'down'|'up',
//      pose: down|offer|shake|cross|clutch|reach, talk:[t0,t1], sweat, walk }
const BUILD = { normal: { w: 1, leg: 232 }, thin: { w: .78, leg: 250 }, heavy: { w: 1.42, leg: 210 }, short: { w: .95, leg: 150 } };

function person(st, o, t) {
  const p = paint(st), f = o.face || 1, s = o.s || 1, ph = o.phase || 0;
  const B = BUILD[o.build || 'normal'], bw = B.w, lift = 232 - B.leg;
  const breathe = 1 + .012 * Math.sin(t * 2.3 + ph);
  const bt = (t + ph * 1.3) % 3.6, blink = bt < .13 ? .12 : 1;
  const cx = f * 12, ey = -588;
  const talking = o.talk && t >= o.talk[0] && t <= o.talk[1];
  let legs = '', g = '';

  // legs + shoes (length depends on build; upper body is shifted by `lift`)
  const lx = 40 * Math.min(bw, 1.15);
  legs += `<path d="M${-lx - 6},${-B.leg} L${-lx},-8 L-8,-8 L-6,${-B.leg}Z" ${p.mass}/><path d="M6,${-B.leg} L8,-8 L${lx},-8 L${lx + 6},${-B.leg}Z" ${p.mass}/>`;
  legs += `<path d="M${-lx - 4 + f * 6},-14 h44 q${f * 22},0 ${f * 22},14 h-66Z" ${p.mass}/><path d="M${4 + f * 6},-14 h44 q${f * 22},0 ${f * 22},14 h-66Z" ${p.mass}/>`;

  // arms
  const pose = o.pose || 'down';
  const shx = 82 * bw, sh = [-shx, shx];
  const arm = (side, hx, hy, ex, ey2) => `<path d="M${sh[side]},-440 Q${ex},${ey2} ${hx},${hy}" ${p.limb(32)}/>`;
  const hand = (hx, hy) => `<circle cx="${hx}" cy="${hy}" r="22" ${p.mass}/>`;
  let front = '', back = '';
  const fs = f > 0 ? 1 : 0, bs = 1 - fs;
  const down = side => arm(side, sh[side] * 1.18, -232, sh[side] * 1.28, -330);
  if (pose === 'down') { back += down(bs); front += down(fs); }
  if (pose === 'offer' || pose === 'shake') {
    back += down(bs);
    const hx = pose === 'offer' ? f * (150 + 85 * bw) : f * (105 + 85 * bw), hy = pose === 'offer' ? -385 : -345;
    front += arm(fs, hx, hy, f * (70 + 80 * bw), -330) + hand(hx, hy);
  }
  if (pose === 'reach') { back += down(bs); const hx = f * (110 + 60 * bw), hy = -700; front += arm(fs, hx, hy, f * (120 + 60 * bw), -520) + hand(hx, hy); }
  if (pose === 'clutch') {
    back += arm(bs, f * 10, -350, sh[bs] * 1.25, -330);
    front += arm(fs, f * 30, -345, sh[fs] * 1.25, -320) + hand(f * 22, -352);
  }
  if (pose === 'cross') back += arm(bs, sh[bs] * 1.2, -260, sh[bs] * 1.3, -340) + arm(fs, sh[fs] * 1.2, -260, sh[fs] * 1.3, -340);
  g += back;

  // torso by outfit
  const outfit = o.outfit || 'coat';
  g += `<g transform="scale(${bw},1)">`;
  if (outfit === 'hoodie') g += `<path d="M-80,-470 Q-104,-466 -108,-436 L-116,-222 Q-116,-202 -96,-202 L96,-202 Q116,-202 116,-222 L108,-436 Q104,-466 80,-470Z" ${p.mass}/>`;
  else g += `<path d="M-74,-472 Q-98,-470 -102,-440 L-114,-222 Q-114,-202 -94,-202 L94,-202 Q114,-202 114,-222 L102,-440 Q98,-470 74,-472Z" ${p.mass}/>`;
  g += `</g>`;
  if (outfit === 'coat') { g += `<path d="M-34,-470 L0,-372 L34,-470" ${p.dStroke(6)}/>`; for (const by of [-340, -295, -250]) g += `<circle cx="0" cy="${by}" r="6" ${p.dFill}/>`; }
  if (outfit === 'suit') {
    g += `<path d="M-44,-470 L0,-360 L44,-470" ${p.dStroke(6)}/>`;
    g += `<path d="M-13,-466 L13,-466 L9,-440 L18,-350 L0,-326 L-18,-350 L-9,-440Z" ${p.dFill}/>`;
    g += `<path d="M${-60 * bw},-300 h28" ${p.dStroke(5)}/>`;
  }
  if (outfit === 'worker') {
    g += `<path d="M-46,-470 V-330 M46,-470 V-330" ${p.dStroke(6)}/><rect x="-62" y="-340" width="124" height="96" rx="8" ${p.dStroke(6)}/>`;
    g += `<circle cx="-46" cy="-330" r="7" ${p.dFill}/><circle cx="46" cy="-330" r="7" ${p.dFill}/>`;
  }
  if (outfit === 'hoodie') {
    g += `<path d="M-70,-466 Q0,-410 70,-466" ${p.dStroke(6)}/><path d="M-16,-432 v54 M16,-432 v54" ${p.dStroke(4)}/>`;
    g += `<path d="M-70,-300 h140 l-14,70 h-112Z" ${p.dStroke(5)}/>`;
  }
  if (pose === 'cross') g += `<rect x="${-112 * bw}" y="-372" width="${224 * bw}" height="62" rx="31" ${p.mass}/><rect x="${-112 * bw}" y="-372" width="${224 * bw}" height="62" rx="31" ${p.dStroke(5)}/>`;
  g += front;

  // neck + head
  g += `<rect x="-24" y="-510" width="48" height="44" ${p.mass}/>`;
  const hair = o.hair || 'none';
  if (outfit === 'hoodie') g += `<path d="M-96,-470 Q-118,-600 -60,-668 Q0,-700 60,-668 Q118,-600 96,-470Z" ${p.mass}/>`;
  if (hair === 'franklin') g += `<path d="M-70,-600 Q-112,-560 -98,-500 Q-80,-490 -70,-520Z" ${p.mass}/><path d="M70,-600 Q112,-560 98,-500 Q80,-490 70,-520Z" ${p.mass}/>`;
  if (hair === 'pony') g += `<path d="M${-f * 70},-640 Q${-f * 150},-610 ${-f * 128},-500 Q${-f * 110},-560 ${-f * 66},-600Z" ${p.mass}/>`;
  if (hair === 'curly') for (let i = 0; i < 9; i++) { const a = Math.PI * (1.05 + i * .1125); g += `<circle cx="${(Math.cos(a) * 82).toFixed(1)}" cy="${(-588 + Math.sin(a) * 96).toFixed(1)}" r="30" ${p.mass}/>`; }
  g += `<ellipse cx="0" cy="-578" rx="${84 * Math.min(1.12, bw)}" ry="96" ${p.mass}/>`;
  if (outfit === 'hoodie') g += `<path d="M-84,-560 Q-90,-660 0,-672 Q90,-660 84,-560" ${p.dStroke(6)}/>`;
  if (hair === 'rival') g += `<path d="M-86,-596 L-84,-684 Q0,-700 84,-684 L86,-596 Q60,-650 0,-655 Q-60,-650 -86,-596Z" ${p.mass}/>`;
  if (hair === 'bun') g += `<circle cx="${-f * 10}" cy="-690" r="34" ${p.mass}/>`;
  if (hair === 'none') g += `<path d="M${-f * 18},-672 q${f * 10},-30 ${f * 34},-22" ${p.dStroke(6)}/>`;
  if (hair === 'franklin') g += `<path d="M-60,-650 Q0,-690 60,-650" ${p.dStroke(4)} opacity=".6"/>`;
  if (hair === 'slick') g += `<path d="M-88,-590 Q-96,-690 0,-688 Q96,-690 88,-590 Q70,-650 ${-f * 20},-650 Q-60,-646 -88,-590Z" ${p.mass}/><path d="M${-f * 22},-684 Q${-f * 4},-664 ${f * 60},-664" ${p.dStroke(5)}/>`;
  if (hair === 'cap') g += `<path d="M-90,-622 Q-88,-700 0,-702 Q88,-700 90,-622Z" ${p.mass}/><path d="M${f * 20},-626 L${f * 150},-616 Q${f * 150},-604 ${f * 20},-608Z" ${p.mass}/><path d="M-88,-624 H88" ${p.dStroke(5)}/>`;

  // face
  const e = o.expr || 'neutral';
  const big = e === 'surprised' || e === 'fear';
  const lookX = f * 6, lookY = o.look === 'down' ? 6 : o.look === 'up' ? -6 : 1;
  for (const sx of [-34, 34]) {
    g += `<ellipse cx="${cx + sx}" cy="${ey}" rx="${big ? 22 : 20}" ry="${(big ? 21 : e === 'smug' ? 10 : 15) * blink}" ${p.eyeWhite}/>`;
    if (blink > .5) g += `<circle cx="${cx + sx + lookX}" cy="${ey + lookY}" r="${e === 'fear' ? 5 : big ? 7 : e === 'smug' ? 7 : 9}" fill="${p.pupil}"/>`;
  }
  if (hair === 'franklin') g += `<circle cx="${cx - 34}" cy="${ey}" r="29" ${p.dStroke(4)}/><circle cx="${cx + 34}" cy="${ey}" r="29" ${p.dStroke(4)}/><path d="M${cx - 6},${ey} h12" ${p.dStroke(4)}/>`;
  // brows: [outer x, outer y, inner x, inner y] for the left brow; right is mirrored
  const brow = {
    neutral: [-54, -620, -16, -620], happy: [-54, -618, -16, -624], sad: [-54, -612, -16, -626],
    worried: [-54, -612, -16, -630], fear: [-54, -628, -16, -642], angry: [-56, -628, -14, -610],
    surprised: [-54, -638, -16, -642], smug: [-54, -614, -16, -614],
  }[e] || [-54, -620, -16, -620];
  const bwid = e === 'angry' || hair === 'rival' ? 9 : 6;
  const [x1, y1, x2, y2] = brow, raise = e === 'smug' ? -18 : 0;
  g += `<path d="M${cx + x1},${y1} L${cx + x2},${y2}" ${p.dStroke(bwid)}/>`;
  g += `<path d="M${cx - x1},${y1 + raise} L${cx - x2},${y2 + raise * .5}" ${p.dStroke(bwid)}/>`;
  g += `<path d="M${cx + f * 2},${ey + 2} L${cx + f * 16},${ey + 40} L${cx},${ey + 42}" ${p.dStroke(5)}/>`;
  if (hair === 'rival') g += `<path d="M${cx - 30},-532 Q${cx},-552 ${cx + 30},-532 Q${cx},-538 ${cx - 30},-532Z" ${p.dFill}/>`;
  const my = -516;
  if (talking) g += `<ellipse cx="${cx}" cy="${my}" rx="16" ry="${4 + 11 * Math.abs(Math.sin(t * 13))}" ${p.dFill}/>`;
  else if (e === 'happy') g += `<path d="M${cx - 28},${my - 6} Q${cx},${my + 20} ${cx + 28},${my - 6}" ${p.dStroke(6)}/>`;
  else if (e === 'smug') g += `<path d="M${cx - 22},${my + 2} Q${cx + 6},${my + 6} ${cx + 28},${my - 10}" ${p.dStroke(6)}/>`;
  else if (e === 'sad') g += `<path d="M${cx - 24},${my + 6} Q${cx},${my - 12} ${cx + 24},${my + 6}" ${p.dStroke(6)}/>`;
  else if (e === 'worried' || e === 'fear') g += `<path d="M${cx - 26},${my} q8.6,-8 17.3,0 t17.3,0 t17.3,0" ${p.dStroke(5)}/>`;
  else if (e === 'surprised') g += `<ellipse cx="${cx}" cy="${my}" rx="11" ry="15" ${p.dFill}/>`;
  else if (e === 'angry') g += `<path d="M${cx - 22},${my + 2} L${cx + 22},${my - 3}" ${p.dStroke(7)}/>`;
  else g += `<path d="M${cx - 22},${my} L${cx + 22},${my}" ${p.dStroke(6)}/>`;
  if (o.sweat) { const sy = -640 + ((t * 40) % 50); g += `<path d="M${-f * 74},${sy} q-12,22 0,30 q12,-8 0,-30Z" ${p.dFill}/>`; }

  const bob = o.walk ? -Math.abs(Math.sin(t * 9)) * 10 : 0;
  return `<g transform="translate(${o.x},${o.y + bob}) scale(${s},${s * breathe})"${p.shadow}>${legs}<g transform="translate(0,${lift})">${g}</g></g>`;
}

// ---------- props ----------
function giftBox(st, x, y, s = 1) {
  const p = paint(st);
  return `<g transform="translate(${x},${y}) scale(${s})"${p.shadow}>
    <rect x="-62" y="-52" width="124" height="104" ${p.mass}/><rect x="-74" y="-80" width="148" height="30" ${p.mass}/>
    <path d="M0,-80 V52" ${p.dStroke(12)}/><path d="M-62,0 H62" ${p.dStroke(10)}/>
    <path d="M0,-80 C-40,-130 -70,-90 0,-80 C40,-130 70,-90 0,-80" ${p.dStroke(7)}/></g>`;
}

function book(st, x, y, s = 1, lit = 0, t = 0) {
  const p = paint(st);
  let g = '';
  if (lit > 0) {
    const pulse = 1 + .06 * Math.sin(t * 6);
    if (st.mode === 'line') g += `<circle r="${120 * pulse}" fill="${st.accent}" opacity="${.45 * lit}" filter="url(#glow)"/>`;
    else for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g += `<path d="M${Math.cos(a) * 95 * pulse},${Math.sin(a) * 95 * pulse} L${Math.cos(a) * 128 * pulse},${Math.sin(a) * 128 * pulse}" ${p.aStroke(9)} opacity="${lit}"/>`; }
  }
  const cover = lit > .5 ? p.aFill : p.mass;
  g += `<path d="M-62,-46 h112 q10,0 10,10 v76 q0,10 -10,10 h-112Z" ${cover}${p.shadow}/>`;
  g += `<path d="M-48,-46 V50" ${p.dStroke(5)}/><path d="M-30,-20 h60 M-30,0 h46" ${p.dStroke(5)} opacity=".8"/>`;
  return `<g transform="translate(${x},${y}) scale(${s})">${g}</g>`;
}

// speech / thought bubble with arbitrary inner svg (inner drawn in local coords centered at 0,0)
function bubble(st, x, y, w, h, tailX, tailY, inner = '', sc = 1, thought = false) {
  const p = paint(st);
  let tail = thought
    ? `<circle cx="${tailX * .45}" cy="${tailY * .55}" r="18" ${p.card}/><circle cx="${tailX * .8}" cy="${tailY * .85}" r="10" ${p.card}/>`
    : `<path d="M${tailX * .2 - 26},${h / 2 - 6} L${tailX},${tailY} L${tailX * .2 + 26},${h / 2 - 6}Z" ${p.card}/>`;
  let body = `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${Math.min(h / 2, 48)}" ${p.card}/>`;
  // hide the seam where tail meets body
  const seam = !thought ? `<rect x="${tailX * .2 - 22}" y="${h / 2 - 14}" width="44" height="14" fill="${st.mode === 'cut' ? st.detail : st.paper}"/>` : '';
  return `<g transform="translate(${x},${y}) scale(${sc})"><g${p.shadow}>${tail}${body}</g>${seam}${inner}</g>`;
}

function bigX(st, x, y, size, pr) {
  if (pr <= 0) return '';
  const p = paint(st), L = size * 1.42;
  const a = clamp(pr * 2), b = clamp(pr * 2 - 1);
  const ln = (x1, y1, x2, y2, q) => q > 0 ? `<path d="M${x1},${y1} L${x2},${y2}" ${p.aStroke(size * .16)} stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - q)}"/>` : '';
  return `<g transform="translate(${x},${y})">${ln(-size / 2, -size / 2, size / 2, size / 2, a)}${ln(size / 2, -size / 2, -size / 2, size / 2, b)}</g>`;
}

function columns(st) {
  const p = paint(st); let g = '';
  g += `<path d="M150,520 L540,380 L930,520Z" ${p.faint}/>`;
  g += `<rect x="150" y="530" width="780" height="34" ${p.faint}/>`;
  for (let i = 0; i < 5; i++) { const x = 190 + i * 175; g += `<rect x="${x}" y="580" width="70" height="640" ${p.faint}/>`; }
  return g;
}

// coin; lit = accent colored
function coin(st, x, y, s = 1, lit = false, spin = 0) {
  const p = paint(st), sx = Math.abs(Math.cos(spin)) * .85 + .15;
  const body = lit ? p.aFill : (st.mode === 'line' ? `fill="${st.paper}" stroke="${st.ink}" stroke-width="6"` : `fill="${st.mode === 'cut' ? st.detail : st.paper}" stroke="${st.ink}" stroke-width="7"`);
  const mark = lit ? (st.mode === 'line' ? st.paper : st.paper) : st.ink;
  return `<g transform="translate(${x},${y}) scale(${s * sx},${s})"${p.shadow}><circle r="40" ${body}/><circle r="28" fill="none" stroke="${mark}" stroke-width="4" opacity=".7"/><text y="14" font-family="${st.font.title}" font-size="40" text-anchor="middle" fill="${mark}">$</text></g>`;
}

// staircase going down left→right. returns { svg, top(i) } where top(i) = [x, y] of step i's surface center
function stairs(st, n, x0, x1, yTop, yBottom) {
  const p = paint(st), w = (x1 - x0) / n, dy = (yBottom - yTop) / (n - 1);
  let g = '';
  const tops = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + i * w, y = yTop + i * dy;
    tops.push([x + w / 2, y]);
    if (st.mode === 'line') g += `<path d="M${x},${y} H${x + w} V${yBottom + 140}" ${p.limb(0)}/>`;
    else g += `<rect x="${x}" y="${y}" width="${w + 1}" height="${yBottom + 140 - y}" ${p.mass}${p.shadow}/>`;
    if (st.mode === 'fill') g += `<path d="M${x + 8},${y + 14} H${x + w - 8}" stroke="${st.paper}" stroke-width="3" opacity=".7"/>`;
  }
  if (st.mode === 'line') g += `<path d="M${x0},${yTop} V${yBottom + 140}" ${p.limb(0)}/>`;
  return { svg: g, top: i => tops[i], w };
}

function arrow(st, x1, y1, x2, y2, pr = 1, accent = false, bend = 60) {
  if (pr <= 0) return '';
  const p = paint(st), mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - bend;
  const d = `M${x1},${y1} Q${mx},${my} ${x2},${y2}`, L = Math.hypot(x2 - x1, y2 - y1) * 1.25;
  const stroke = accent ? p.aStroke(10) : (st.mode === 'line' ? p.limb(0) : `fill="none" stroke="${st.ink}" stroke-width="9" stroke-linecap="round"`);
  const a = Math.atan2(y2 - my, x2 - mx);
  const head = pr >= 1 ? `<path d="M${x2 - 34 * Math.cos(a - .5)},${y2 - 34 * Math.sin(a - .5)} L${x2},${y2} L${x2 - 34 * Math.cos(a + .5)},${y2 - 34 * Math.sin(a + .5)}" ${stroke}/>` : '';
  return `<path d="${d}" ${stroke} stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - pr)}"/>${head}`;
}

function dashedLine(st, x1, x2, y, labelText) {
  const col = st.accent;
  return `<path d="M${x1},${y} H${x2}" stroke="${col}" stroke-width="7" stroke-dasharray="28 18"/>` + (labelText ? text(st, x2, y - 22, 40, labelText, { fill: col, anchor: 'end', font: st.font.sub }) : '');
}

// house: x = center, y = ground. s scales. windows lit with accent if `lit`
function house(st, x, y, s = 1, o = {}) {
  const p = paint(st);
  const win = o.lit ? p.aFill : (st.mode === 'line' ? `fill="none" stroke="${st.ink}" stroke-width="5"` : p.dFill);
  let g = `<path d="M-150,0 V-200 L0,-320 L150,-200 V0Z" ${p.mass}/>`;
  g += `<path d="M70,-262 V-330 H110 V-232" ${p.mass}/>`;                       // chimney
  g += `<rect x="-36" y="-110" width="72" height="110" ${p.dStroke(6)}/><circle cx="20" cy="-55" r="6" ${p.dFill}/>`;
  g += `<rect x="-118" y="-170" width="60" height="56" ${win}/><rect x="58" y="-170" width="60" height="56" ${win}/>`;
  if (st.mode !== 'line') g += `<path d="M-88,-170 V-114 M-118,-142 H-58 M88,-170 V-114 M58,-142 H118" stroke="${st.mode === 'fill' ? st.ink : st.ink}" stroke-width="4"/>`;
  if (o.big) g += `<path d="M-150,-200 H150" ${p.dStroke(6)}/><rect x="-46" y="-290" width="92" height="50" ${p.dStroke(5)}/>`;
  return `<g transform="translate(${x},${y}) scale(${s})"${p.shadow}>${g}</g>`;
}

function car(st, x, y, s = 1, face = 1, lit = false) {
  const p = paint(st), body = lit ? p.aFill : p.mass;
  let g = `<path d="M-200,-40 Q-200,-90 -150,-95 L-90,-100 L-40,-160 L90,-160 L140,-100 L190,-90 Q210,-80 205,-40Z" ${body}/>`;
  g += `<path d="M-28,-148 L-70,-102 H20 V-148Z M36,-148 V-102 H118 L84,-148Z" ${st.mode === 'line' ? `fill="none" stroke="${st.ink}" stroke-width="5"` : p.dFill}/>`;
  for (const wx of [-120, 120]) g += `<circle cx="${wx}" cy="-30" r="42" ${p.mass}/><circle cx="${wx}" cy="-30" r="16" ${p.dFill}/>`;
  return `<g transform="translate(${x},${y}) scale(${s * face},${s})"${p.shadow}>${g}</g>`;
}

function sofa(st, x, y, s = 1) {
  const p = paint(st);
  const g = `<rect x="-160" y="-150" width="320" height="90" rx="30" ${p.mass}/><rect x="-190" y="-110" width="60" height="100" rx="24" ${p.mass}/><rect x="130" y="-110" width="60" height="100" rx="24" ${p.mass}/><rect x="-140" y="-80" width="280" height="60" rx="14" ${p.mass}/><path d="M0,-80 V-20" ${p.dStroke(5)}/><path d="M-160,-10 V0 M160,-10 V0" ${p.limb(14)}/>`;
  return `<g transform="translate(${x},${y}) scale(${s})"${p.shadow}>${g}</g>`;
}

function ticket(st, x, y, s = 1, rot = -8) {
  const p = paint(st);
  let g = `<path d="M-130,-70 H130 V-22 A22,22 0 0 0 130,22 V70 H-130 V22 A22,22 0 0 0 -130,-22Z" ${p.aFill}/>`;
  g += `<path d="M-70,-70 V70" stroke="${st.paper}" stroke-width="5" stroke-dasharray="12 10"/>`;
  g += text(st, 32, 22, 64, '777', { fill: st.paper });
  return `<g transform="translate(${x},${y}) rotate(${rot}) scale(${s})"${p.shadow}>${g}</g>`;
}

function magnifier(st, x, y, s = 1, rot = -30) {
  const p = paint(st);
  const g = `<path d="M0,70 V200" ${p.limb(30)}/><circle cx="0" cy="0" r="74" ${st.mode === 'line' ? `fill="none" stroke="${st.ink}" stroke-width="9"` : `fill="none" stroke="${st.mode === 'fill' ? 'url(#tex)' : st.ink}" stroke-width="22"`}/>`;
  return `<g transform="translate(${x},${y}) rotate(${rot}) scale(${s})"${p.shadow}>${g}</g>`;
}

// hanging price/credit tag in accent color, swinging
function priceTag(st, x, y, str, t = 0, s = 1) {
  const p = paint(st), sw = 6 * Math.sin(t * 3 + x);
  const g = `<path d="M0,0 V40" ${p.aStroke(4)}/><g transform="rotate(${sw} 0 40)"><path d="M-70,40 H50 L80,80 L50,120 H-70Z" ${p.aFill}/><circle cx="52" cy="80" r="8" fill="${st.paper}"/>${text(st, -12, 98, 44, str, { fill: st.paper, font: st.font.sub })}</g>`;
  return `<g transform="translate(${x},${y}) scale(${s})">${g}</g>`;
}

function confetti(st, cx, cy, t, t0, n = 26) {
  if (t < t0) return '';
  const r = rng(5), p = paint(st), k = t - t0; let g = '';
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, v = 260 + r() * 360, x = cx + Math.cos(a) * v * k, y = cy + Math.sin(a) * v * k * .6 + 520 * k * k;
    const col = st.mode === 'line' ? st.ink : i % 3 ? st.ink : st.detail;
    const op = clamp(2.2 - k);   // tiny/exponent opacities crash resvg, so skip near-invisible pieces
    if (op > .02 && x > 0 && x < W && y > 0 && y < H) g += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="14" height="24" fill="${col}" transform="rotate(${((k * 400 + i * 37) % 360).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" opacity="${op.toFixed(2)}"/>`;
  }
  return g;
}

// ---------- text ----------
function text(st, x, y, size, str, o = {}) {
  const fam = o.font || st.font.title;
  const fill = o.fill || (st.mode === 'line' ? st.ink : st.ink);
  return `<text x="${x}" y="${y}" font-family="${fam}" font-size="${size}" text-anchor="${o.anchor || 'middle'}" fill="${fill}"${o.ls ? ` letter-spacing="${o.ls}"` : ''}${o.extra || ''}>${esc(str)}</text>`;
}

// popped stamp (dates, labels). pr 0..1
function stamp(st, x, y, size, str, pr, rot = -6, color) {
  if (pr <= 0) return '';
  const sc = backOut(clamp(pr));
  const fill = color || st.accent;
  return `<g transform="translate(${x},${y}) rotate(${rot}) scale(${sc})" opacity="${clamp(pr * 3)}">${text(st, 0, size * .35, size, str, { fill })}</g>`;
}

function label(st, x, y, str) {
  const p = paint(st);
  const w = str.length * 26 + 40;
  if (st.mode === 'line') return text(st, x, y + 14, 44, str, { fill: st.ink, ls: 3 });
  return `<g${p.shadow}><rect x="${x - w / 2}" y="${y - 30}" width="${w}" height="60" ${st.mode === 'fill' ? `fill="${st.ink}"` : `fill="${st.detail}"`}/></g>${text(st, x, y + 14, 38, str, { fill: st.mode === 'fill' ? st.paper : st.ink, ls: 3, font: st.font.sub })}`;
}

// ---------- subtitles ----------
function chunkLine(str, maxChars = 24) {
  // sentence boundaries first, then balanced word splits for anything longer than two rows
  const sentences = str.split(/(?<=[.!?:])(?!\d)\s+/).map(x => x.trim()).filter(Boolean);   // "34.9%" is not a sentence end
  const out = [];
  for (const sn of sentences) {
    if (sn.length <= maxChars * 2) { out.push(sn); continue; }
    const words = sn.split(/\s+/), n = Math.ceil(sn.length / (maxChars * 2)), target = sn.length / n;
    let cur = [];
    for (const w of words) { cur.push(w); if (cur.join(' ').length >= target && out.length < 99) { out.push(cur.join(' ')); cur = []; } }
    if (cur.length) out.push(cur.join(' '));
  }
  // glue very short tails ("vardı.") onto the previous chunk
  for (let i = out.length - 1; i > 0; i--) if (out[i].length < 12 && (out[i - 1] + ' ' + out[i]).length <= maxChars * 2) { out[i - 1] += ' ' + out[i]; out.splice(i, 1); }
  return out;
}
function wrap(str, maxChars) {
  const words = str.split(' '), rows = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > maxChars && cur) { rows.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) rows.push(cur); return rows;
}
function subtitle(st, str, appear) {
  if (!str) return '';
  const p = paint(st);
  const size = st.sub === 'plain' ? 66 : 50, maxC = (st.sub === 'plain' ? 24 : 26) * (W > H ? 2 : 1);
  const rows = wrap(str, maxC), lh = size * 1.22, cy = W > H ? H - 110 : 1470;
  const cw = st.sub === 'plain' ? .5 : .66;
  const w = Math.min(W - 120, Math.max(...rows.map(r => r.length)) * size * cw + 90), h = rows.length * lh + 46;
  const sc = .92 + .08 * easeOut(clamp(appear * 6));
  let g = '';
  const fill = st.sub === 'box' ? st.paper : st.ink;
  if (st.sub === 'box') g += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="${st.ink}"/>`;
  if (st.sub === 'strip') {
    const r = rng(str.length); let d = `M${-w / 2},${-h / 2} `;
    for (let x = -w / 2; x <= w / 2; x += 18) d += `L${x},${-h / 2 + r() * 8 - 4} `;
    for (let x = w / 2; x >= -w / 2; x -= 18) d += `L${x},${h / 2 + r() * 8 - 4} `;
    g += `<path d="${d}Z" fill="${st.detail}" filter="url(#sh)" transform="rotate(-1)"/>`;
  }
  rows.forEach((row, i) => {
    const y = -h / 2 + 23 + lh * (i + .78);
    if (st.sub === 'plain') g += text(st, 0, y, size, row, { font: st.font.sub, fill: '#000', extra: ` opacity=".55" transform="translate(4,5)"` });
    g += text(st, 0, y, size, row, { font: st.font.sub, fill });
  });
  return `<g transform="translate(${W / 2},${cy}) scale(${sc})">${g}</g>`;
}

module.exports = { get W() { return W; }, get H() { return H; }, setFrame, wat, normW, clamp, prog, easeOut, easeInOut, backOut, lerp, rng, paint, defs, background, ground, person, giftBox, book, bubble, bigX, columns, coin, stairs, arrow, dashedLine, house, car, sofa, ticket, magnifier, priceTag, confetti, text, stamp, label, subtitle, chunkLine };
