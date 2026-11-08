// Generic props for the agent's vocabulary. Every prop is centered on (0,0), ~160px tall at s=1,
// and only uses paint() roles, so it re-skins with every style (line / fill / cut).
const L = require('./lib');
const { paint, clamp, easeOut } = L;

const g = (s, inner, p) => `<g transform="scale(${s})"${p.shadow}>${inner}</g>`;
const glow = (st, lit, r = 110) => lit ? (st.mode === 'line' ? `<circle r="${r}" fill="${st.accent}" opacity=".35" filter="url(#glow)"/>` : `<circle r="${r}" fill="${st.accent}" opacity=".18"/>`) : '';

const PROPS = {
  phone: (st, s, lit, t) => { const p = paint(st);
    return glow(st, lit) + g(s, `<rect x="-50" y="-90" width="100" height="180" rx="18" ${p.mass}/><rect x="-38" y="-70" width="76" height="128" rx="6" ${lit ? p.aFill : p.card}/><circle cy="74" r="7" ${p.dFill}/>`
      + (lit ? [0, 1, 2].map(i => `<rect x="-26" y="${-56 + i * 34}" width="${52 - i * 12}" height="16" rx="8" fill="${st.paper}" opacity=".85"/>`).join('') : ''), p); },
  clock: (st, s, lit, t) => { const p = paint(st), a = t * 1.6;
    return g(s, `<circle r="80" ${p.card}/><circle r="80" fill="none" stroke="${st.ink}" stroke-width="${st.mode === 'line' ? 7 : 9}"/>`
      + [0, 1, 2, 3].map(i => `<path d="M0,-66 V-56" ${p.limb(8)} transform="rotate(${i * 90})"/>`).join('')
      + `<path d="M0,0 L${Math.sin(a) * 52},${-Math.cos(a) * 52}" ${lit ? p.aStroke(9) : p.limb(9)}/><path d="M0,0 L${Math.sin(a / 12) * 34},${-Math.cos(a / 12) * 34}" ${p.limb(11)}/><circle r="8" ${p.aFill}/>`, p); },
  brain: (st, s, lit, t) => { const p = paint(st);
    const lobe = `M-6,-70 C-40,-92 -88,-74 -86,-34 C-108,-18 -104,26 -78,38 C-80,70 -44,86 -14,70 C-8,76 -4,78 0,78 V-66Z`;
    return glow(st, lit) + g(s, `<path d="${lobe}" ${lit ? p.aFill : p.mass}/><path d="${lobe}" transform="scale(-1,1)" ${lit ? p.aFill : p.mass}/>`
      + `<path d="M-60,-30 q22,10 8,34 M-34,20 q20,-6 26,18 M60,-30 q-22,10 -8,34 M34,20 q-20,-6 -26,18 M0,-66 V78" ${p.dStroke(6)}/>`, p); },
  heart: (st, s, lit, t) => { const p = paint(st), b = 1 + .06 * Math.max(0, Math.sin(t * 7));
    return g(s * b, `<path d="M0,70 C-90,10 -100,-50 -58,-72 C-30,-86 -8,-66 0,-48 C8,-66 30,-86 58,-72 C100,-50 90,10 0,70Z" ${lit ? p.aFill : p.mass}/>`, p); },
  bulb: (st, s, lit, t) => { const p = paint(st);
    return glow(st, lit, 120) + g(s, `<path d="M-30,40 C-30,10 -66,-10 -66,-46 C-66,-84 -36,-104 0,-104 C36,-104 66,-84 66,-46 C66,-10 30,10 30,40Z" ${lit ? p.aFill : p.card}/>`
      + `<rect x="-30" y="44" width="60" height="16" rx="6" ${p.mass}/><rect x="-24" y="64" width="48" height="16" rx="6" ${p.mass}/><path d="M-14,40 V-10 L0,4 L14,-10 V40" ${lit ? `fill="none" stroke="${st.paper}" stroke-width="6"` : p.dStroke(6)}/>`, p); },
  lock: (st, s, lit, t) => { const p = paint(st), open = lit ? 34 : 0;
    return g(s, `<path d="M-40,-10 V-50 A40,40 0 0 1 40,-50 V${-10 - open}" ${p.limb(16)} transform="translate(0,${-open})"/><rect x="-62" y="-14" width="124" height="96" rx="12" ${lit ? p.aFill : p.mass}/><circle cy="24" r="12" ${p.dFill}/><path d="M0,30 V52" ${p.dStroke(8)}/>`, p); },
  trophy: (st, s, lit, t) => { const p = paint(st);
    return glow(st, lit) + g(s, `<path d="M-56,-80 H56 V-30 C56,10 28,30 0,30 C-28,30 -56,10 -56,-30Z" ${lit ? p.aFill : p.mass}/><path d="M-56,-60 C-96,-60 -96,-10 -50,-6 M56,-60 C96,-60 96,-10 50,-6" ${p.limb(10)}/><rect x="-10" y="30" width="20" height="34" ${p.mass}/><rect x="-46" y="62" width="92" height="22" rx="4" ${p.mass}/>`, p); },
  scale: (st, s, lit, t, tilt = 0) => { const p = paint(st), a = tilt * 14, dy = Math.sin(a * Math.PI / 180) * 80;
    const pan = (x, y) => `<path d="M${x - 40},${y} L${x},${y - 60} L${x + 40},${y}" ${p.limb(5)}/><path d="M${x - 50},${y} H${x + 50} Q${x + 44},${y + 26} ${x},${y + 26} Q${x - 44},${y + 26} ${x - 50},${y}Z" ${p.mass}/>`;
    return g(s, `<path d="M0,-80 V80 M-50,84 H50" ${p.limb(12)}/><g transform="rotate(${a})"><path d="M-90,-70 H90" ${p.limb(10)}/></g>${pan(-90, -10 - dy)}${pan(90, -10 + dy)}<circle cy="-80" r="10" ${p.aFill}/>`, p); },
  globe: (st, s, lit, t) => { const p = paint(st), o = (t * 18) % 40;
    return g(s, `<circle r="80" ${lit ? p.aFill : p.card}/><circle r="80" fill="none" stroke="${st.ink}" stroke-width="8"/>`
      + `<ellipse rx="34" ry="80" fill="none" stroke="${st.ink}" stroke-width="5" opacity=".7"/><path d="M-80,0 H80 M-70,-40 H70 M-70,40 H70" fill="none" stroke="${st.ink}" stroke-width="5" opacity=".7"/>`
      + `<path d="M${-40 + o},-30 q20,-20 40,0 q10,30 -20,40 q-30,-10 -20,-40Z" ${p.mass} opacity=".85"/>`, p); },
  money: (st, s, lit, t) => { const p = paint(st);
    return glow(st, lit) + g(s, [2, 1, 0].map(i => `<g transform="translate(${i * 10},${-i * 12}) rotate(${-6 + i * 5})"><rect x="-80" y="-44" width="160" height="88" rx="8" ${i === 0 && lit ? p.aFill : p.card}/><circle r="24" fill="none" stroke="${st.ink}" stroke-width="5"/><text y="12" font-family="${st.font.title}" font-size="34" text-anchor="middle" fill="${st.ink}">$</text></g>`).join(''), p); },
  pill: (st, s, lit, t) => { const p = paint(st);
    return g(s, `<g transform="rotate(-35)"><path d="M-80,0 A40,40 0 0 1 -40,-40 H0 V40 H-40 A40,40 0 0 1 -80,0Z" ${lit ? p.aFill : p.mass}/><path d="M0,-40 H40 A40,40 0 0 1 40,40 H0Z" ${p.card}/></g>`, p); },
  bed: (st, s, lit, t) => { const p = paint(st), z = (t * .8) % 1;
    return g(s, `<rect x="-110" y="-10" width="220" height="50" rx="8" ${p.mass}/><path d="M-110,-60 V80 M110,0 V80" ${p.limb(12)}/><rect x="-96" y="-34" width="56" height="26" rx="12" ${p.card}/><path d="M-36,-10 Q20,-44 100,-14" ${p.limb(10)}/>`
      + `<text x="${40 + z * 30}" y="${-60 - z * 60}" font-family="${st.font.title}" font-size="${40 + z * 20}" fill="${st.accent}" opacity="${1 - z}">Z</text>`, p); },
  laptop: (st, s, lit, t) => { const p = paint(st);
    return glow(st, lit) + g(s, `<rect x="-90" y="-80" width="180" height="116" rx="10" ${p.mass}/><rect x="-76" y="-66" width="152" height="88" rx="4" ${lit ? p.aFill : p.card}/><path d="M-118,44 H118 L104,64 H-104Z" ${p.mass}/>`, p); },
  pen: (st, s, lit, t) => { const p = paint(st);
    return g(s, `<g transform="rotate(-40)"><rect x="-16" y="-96" width="32" height="150" rx="6" ${lit ? p.aFill : p.mass}/><path d="M-16,54 L0,92 L16,54Z" ${p.card}/><rect x="-16" y="-96" width="32" height="26" ${p.card}/></g>`, p); },
  eye: (st, s, lit, t) => { const p = paint(st), look = Math.sin(t * 1.3) * 14;
    return glow(st, lit) + g(s, `<path d="M-100,0 Q0,-80 100,0 Q0,80 -100,0Z" ${p.card}/><circle cx="${look}" r="34" ${lit ? p.aFill : p.mass}/><circle cx="${look + 10}" cy="-10" r="9" fill="${st.paper}"/>`, p); },
};

// line / bar chart that draws itself as pr goes 0→1. values are relative heights.
function chart(st, w, h, kind, values, pr, accentLast = true) {
  const p = paint(st), vs = values && values.length > 1 ? values : (kind === 'down' ? [5, 4, 4.2, 3, 1.5] : [1, 1.6, 1.4, 3, 4.6]);
  const mx = Math.max(...vs), x0 = -w / 2, y0 = h / 2;
  let out = `<path d="M${x0},${-h / 2 - 20} V${y0} H${w / 2 + 20}" ${p.limb(8)}/>`;
  if (kind === 'bars') {
    const bw = w / vs.length * .62;
    vs.forEach((v, i) => { const a = easeOut(clamp(pr * vs.length - i)), bh = v / mx * h * a;
      if (a > 0) out += `<rect x="${x0 + (i + .5) * w / vs.length - bw / 2}" y="${y0 - bh}" width="${bw}" height="${bh}" ${accentLast && i === vs.length - 1 ? p.aFill : p.mass}${p.shadow}/>`; });
  } else {
    const pts = vs.map((v, i) => [x0 + i / (vs.length - 1) * w, y0 - v / mx * h]);
    const n = pr * (pts.length - 1), k = Math.floor(n), f = n - k;
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i <= k && i < pts.length; i++) d += ` L${pts[i][0]},${pts[i][1]}`;
    if (k + 1 < pts.length) d += ` L${pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f},${pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f}`;
    out += `<path d="${d}" ${p.aStroke(14)}/>`;
    if (pr >= 1) { const [ex, ey] = pts[pts.length - 1]; out += `<circle cx="${ex}" cy="${ey}" r="16" ${p.aFill}/>`; }
  }
  return out;
}

module.exports = { PROPS, chart, NAMES: Object.keys(PROPS) };
