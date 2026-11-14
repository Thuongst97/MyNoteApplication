/**
 * Generates the built-in illustrated page covers (public/covers/*.svg).
 * Run: node scripts/make-covers.cjs — the output is committed, so this only runs when the art changes.
 * Every cover is 1600×400 and drawn to be cropped from the center (background-size: cover).
 */
const fs = require('fs')
const path = require('path')

const W = 1600, H = 400
let seed = 1
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const r = (a, b) => a + rnd() * (b - a)
const f = (n) => Math.round(n * 10) / 10
const svg = (body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${body}</svg>\n`
const lin = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`
const rad = (id, stops, cx = 0.5, cy = 0.5, rr = 0.5) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${rr}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`

/** A smooth ridge line across the width, closed at the bottom. */
function ridge(base, amp, step, rough = 1) {
  let d = `M0 ${H} L0 ${f(base)}`
  let y = base
  for (let x = 0; x <= W + step; x += step) {
    y = base + Math.sin(x / (step * r(2.2, 3.6))) * amp * 0.5 + r(-amp, amp) * 0.5 * rough
    d += ` L${x} ${f(y)}`
  }
  return d + ` L${W} ${H} Z`
}
/** Smooth hills (quadratic curves). */
function hills(base, amp, n) {
  const pts = Array.from({ length: n + 1 }, (_, i) => [(W / n) * i, base + r(-amp, amp)])
  let d = `M0 ${H} L0 ${f(pts[0][1])}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]
    d += ` Q${f((x0 + x1) / 2)} ${f(Math.min(y0, y1) - amp * 0.6)} ${f(x1)} ${f(y1)}`
  }
  return d + ` L${W} ${H} Z`
}
function pine(x, base, h) {
  const w = h * 0.42
  let d = ''
  for (let k = 0; k < 4; k++) {
    const top = base - h + (h * k) / 4.6, bw = (w * (k + 1.4)) / 4.4, by = top + h / 3
    d += `M${f(x)} ${f(top)} L${f(x - bw)} ${f(by)} L${f(x + bw)} ${f(by)} Z `
  }
  return d + `M${f(x - h * 0.03)} ${f(base - h * 0.25)} h${f(h * 0.06)} V${f(base)} h${f(-h * 0.06)} Z`
}

const covers = {}

// ---------------------------------------------------------------- Nature
seed = 11
covers['nature-mountains'] = svg(
  `<rect width="${W}" height="${H}" fill="url(#sky)"/><circle cx="1120" cy="150" r="70" fill="#fff6e0" opacity=".9"/><circle cx="1120" cy="150" r="150" fill="url(#sun)"/>` +
    [['#9aa7d6', 200, 70, 40], ['#7482c0', 245, 60, 30], ['#525fa0', 290, 50, 26], ['#363f78', 335, 36, 22]].map(([c, b, a, s]) => `<path d="${ridge(b, a, s)}" fill="${c}"/>`).join(''),
  lin('sky', [[0, '#ffd8b8'], [0.55, '#f7b9c4'], [1, '#c2b6e6']]) + rad('sun', [[0, '#fff3d6', 0.8], [1, '#fff3d6', 0]]),
)
seed = 23
covers['nature-forest'] = svg(
  `<rect width="${W}" height="${H}" fill="url(#sky)"/>` +
    [['#a9cdb6', 230, 0.6], ['#6fa587', 290, 0.8], ['#3f7a5c', 340, 1], ['#24513b', 400, 1.2]]
      .map(([c, base, sc]) => { let d = ''; for (let x = -20; x < W + 40; x += r(26, 48) * sc) d += pine(x, base + r(-8, 10), r(90, 150) * sc) + ' '; return `<path d="${d}" fill="${c}"/>` })
      .join('') + `<rect width="${W}" height="${H}" fill="url(#mist)"/>`,
  lin('sky', [[0, '#e8f3ec'], [1, '#cfe6d7']]) + lin('mist', [[0, '#fff', 0], [0.55, '#fff', 0.18], [1, '#fff', 0]]),
)
seed = 31
covers['nature-ocean'] = svg(
  `<rect width="${W}" height="${H}" fill="url(#sky)"/><circle cx="420" cy="170" r="60" fill="#fff4d2"/><rect y="200" width="${W}" height="200" fill="url(#sea)"/>` +
    Array.from({ length: 7 }, (_, i) => { const y = 215 + i * 28; let d = `M0 ${y}`; for (let x = 0; x <= W; x += 80) d += ` q20 ${-6 - i} 40 0 t40 0`; return `<path d="${d}" fill="none" stroke="#ffffff" stroke-opacity="${0.35 - i * 0.04}" stroke-width="${2 + i * 0.4}"/>` }).join('') +
    `<path d="M380 205 h80 M360 222 h120 M390 240 h60" stroke="#fff4d2" stroke-width="5" stroke-linecap="round" opacity=".7"/>`,
  lin('sky', [[0, '#8ec5e8'], [1, '#d8eef7']]) + lin('sea', [[0, '#3aa6c9'], [1, '#0f5f86']]),
)
seed = 41
covers['nature-dunes'] = svg(
  `<rect width="${W}" height="${H}" fill="url(#sky)"/><circle cx="1240" cy="120" r="54" fill="#fff1c9"/>` +
    [['#f3c58f', 210, 50, 5], ['#e8a96b', 260, 45, 4], ['#d58a4f', 310, 40, 4], ['#b8693a', 360, 30, 3]].map(([c, b, a, n]) => `<path d="${hills(b, a, n)}" fill="${c}"/>`).join(''),
  lin('sky', [[0, '#fbd9a6'], [1, '#fdeccf']]),
)
seed = 47
covers['nature-sakura'] = svg(
  `<rect width="${W}" height="${H}" fill="url(#sky)"/>` +
    `<path d="M0 330 C 300 280 500 360 800 320 S 1300 280 1600 330 V400 H0 Z" fill="#f4d7df"/>` +
    `<path d="M1600 0 C 1400 60 1300 90 1180 160 M1350 70 C 1300 140 1260 180 1200 210 M1450 30 C 1460 90 1440 140 1420 190" stroke="#6b4a4a" stroke-width="10" fill="none" stroke-linecap="round"/>` +
    Array.from({ length: 70 }, () => `<circle cx="${f(r(1120, 1620))}" cy="${f(r(-10, 240))}" r="${f(r(10, 26))}" fill="${['#f7b7c9', '#f4a3bb', '#fbd0dc', '#ffe3ea'][Math.floor(r(0, 4))]}" opacity="${f(r(0.75, 1))}"/>`).join('') +
    Array.from({ length: 30 }, () => `<ellipse cx="${f(r(0, 1500))}" cy="${f(r(40, 360))}" rx="7" ry="4" fill="#f4a3bb" opacity=".7" transform="rotate(${f(r(0, 180))} ${f(r(0, 1500))} ${f(r(40, 360))})"/>`).join(''),
  lin('sky', [[0, '#fff5f7'], [1, '#fde4ea']]),
)

// ---------------------------------------------------------------- Books & study
seed = 53
{
  const colors = ['#c0392b', '#2c3e50', '#16a085', '#d68910', '#7d3c98', '#1f618d', '#a04000', '#117a65', '#b03a2e', '#283747', '#9c640c', '#4a235a']
  let shelf = ''
  for (const top of [30, 215]) {
    let x = 10
    while (x < W - 20) {
      const w = r(26, 52), h = r(120, 168), c = colors[Math.floor(r(0, colors.length))]
      if (rnd() < 0.06) { x += 40; continue }
      shelf += `<rect x="${f(x)}" y="${f(top + 170 - h)}" width="${f(w)}" height="${f(h)}" rx="3" fill="${c}"/><rect x="${f(x + 4)}" y="${f(top + 170 - h + 16)}" width="${f(w - 8)}" height="5" fill="#fff" opacity=".35"/><rect x="${f(x + 4)}" y="${f(top + 170 - h + 28)}" width="${f(w - 8)}" height="3" fill="#fff" opacity=".25"/>`
      x += w + r(2, 5)
    }
    shelf += `<rect x="0" y="${top + 170}" width="${W}" height="14" fill="#6e4b2f"/>`
  }
  covers['books-shelf'] = svg(`<rect width="${W}" height="${H}" fill="#8a6142"/>${shelf}<rect width="${W}" height="${H}" fill="url(#v)"/>`, lin('v', [[0, '#000', 0.15], [0.5, '#000', 0], [1, '#000', 0.2]]))
}
covers['books-notebook'] = svg(
  `<rect width="${W}" height="${H}" fill="#fdfbf4"/>` +
    Array.from({ length: 13 }, (_, i) => `<line x1="0" x2="${W}" y1="${40 + i * 30}" y2="${40 + i * 30}" stroke="#a9c7e8" stroke-width="2"/>`).join('') +
    `<line x1="160" x2="160" y1="0" y2="${H}" stroke="#ef9a9a" stroke-width="3"/>` +
    Array.from({ length: 7 }, (_, i) => `<circle cx="70" cy="${30 + i * 56}" r="14" fill="#e9e4d6"/>`).join('') +
    `<g transform="rotate(-18 1200 220)"><rect x="900" y="200" width="560" height="34" rx="6" fill="#f5c542"/><rect x="900" y="200" width="70" height="34" fill="#e6a8b4"/><rect x="960" y="200" width="18" height="34" fill="#c9c9c9"/><path d="M1460 200 l60 17 l-60 17 Z" fill="#f3d6a9"/><path d="M1505 212 l15 5 l-15 5 Z" fill="#333"/></g>` +
    `<circle cx="1320" cy="90" r="62" fill="none" stroke="#c8a27a" stroke-opacity=".35" stroke-width="10"/>`,
)
seed = 59
covers['books-open'] = svg(
  `<rect width="${W}" height="${H}" fill="url(#bg)"/>` +
    `<path d="M800 120 C 650 80 450 80 300 110 V380 C 450 350 650 350 800 390 Z" fill="#fffaf0"/><path d="M800 120 C 950 80 1150 80 1300 110 V380 C 1150 350 950 350 800 390 Z" fill="#fff6e6"/>` +
    `<path d="M800 120 V390" stroke="#d9c7a8" stroke-width="3"/>` +
    Array.from({ length: 8 }, (_, i) => `<path d="M360 ${150 + i * 25} C 480 ${140 + i * 25} 620 ${140 + i * 25} ${f(740 - r(0, 80))} ${152 + i * 25}" stroke="#c9b48f" stroke-width="4" stroke-linecap="round" fill="none" opacity=".7"/><path d="M${f(860 + r(0, 40))} ${152 + i * 25} C 980 ${140 + i * 25} 1120 ${140 + i * 25} 1240 ${150 + i * 25}" stroke="#c9b48f" stroke-width="4" stroke-linecap="round" fill="none" opacity=".7"/>`).join('') +
    `<circle cx="800" cy="70" r="160" fill="url(#glow)"/>`,
  lin('bg', [[0, '#3b2f4a'], [1, '#1f1a2e']]) + rad('glow', [[0, '#ffe8b0', 0.45], [1, '#ffe8b0', 0]]),
)

// ---------------------------------------------------------------- Technology
seed = 61
{
  let traces = ''
  for (let i = 0; i < 60; i++) {
    let x = f(r(0, W)), y = f(r(0, H)), d = `M${x} ${y}`
    for (let k = 0; k < 3; k++) {
      const len = r(40, 160)
      const dir = Math.floor(r(0, 4))
      if (dir === 0) x = f(x + len); else if (dir === 1) y = f(y + len * 0.6); else if (dir === 2) { x = f(x + len * 0.6); y = f(y + len * 0.6) } else { x = f(x + len * 0.6); y = f(y - len * 0.6) }
      d += ` L${x} ${y}`
    }
    traces += `<path d="${d}" stroke="#7fe0b1" stroke-opacity="${f(r(0.35, 0.8))}" stroke-width="3" fill="none" stroke-linejoin="round"/><circle cx="${x}" cy="${y}" r="6" fill="#0e3b2c" stroke="#b9f5d6" stroke-width="3"/>`
  }
  const chip = `<rect x="700" y="130" width="200" height="140" rx="10" fill="#111a17" stroke="#3a6b57" stroke-width="3"/>` + Array.from({ length: 8 }, (_, i) => `<rect x="${715 + i * 23}" y="118" width="10" height="12" fill="#cfd8d3"/><rect x="${715 + i * 23}" y="270" width="10" height="12" fill="#cfd8d3"/>`).join('') + `<text x="800" y="208" font-family="Menlo, monospace" font-size="22" fill="#7fe0b1" text-anchor="middle">SoC</text>`
  covers['tech-circuit'] = svg(`<rect width="${W}" height="${H}" fill="url(#pcb)"/>${traces}${chip}`, lin('pcb', [[0, '#0f5a40'], [1, '#08392a']], 1, 1))
}
seed = 67
{
  const nodes = Array.from({ length: 46 }, () => [r(0, W), r(0, H)])
  let lines = ''
  nodes.forEach(([x, y], i) => nodes.slice(i + 1).forEach(([a, b]) => { const dd = Math.hypot(x - a, y - b); if (dd < 210) lines += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(a)}" y2="${f(b)}" stroke="#7aa8ff" stroke-opacity="${f(0.5 - dd / 500)}" stroke-width="1.5"/>` }))
  covers['tech-network'] = svg(`<rect width="${W}" height="${H}" fill="url(#bg)"/>${lines}${nodes.map(([x, y], i) => `<circle cx="${f(x)}" cy="${f(y)}" r="${i % 5 ? 3.5 : 6}" fill="${i % 7 ? '#cfe0ff' : '#5eead4'}"/>`).join('')}`, lin('bg', [[0, '#0b1530'], [1, '#1b1150']], 1, 1))
}
seed = 71
{
  const palette = ['#c792ea', '#82aaff', '#c3e88d', '#f78c6c', '#89ddff', '#ffcb6b', '#676e95']
  let lines = ''
  for (let row = 0; row < 15; row++) {
    let x = 80 + Math.floor(r(0, 4)) * 36
    lines += `<text x="30" y="${44 + row * 25}" font-family="Menlo, monospace" font-size="15" fill="#4b526d">${row + 1}</text>`
    const n = Math.floor(r(2, 6))
    for (let k = 0; k < n; k++) { const w = r(40, 180); lines += `<rect x="${f(x)}" y="${33 + row * 25}" width="${f(w)}" height="11" rx="5" fill="${palette[Math.floor(r(0, palette.length))]}" opacity=".9"/>`; x += w + 14 }
  }
  covers['tech-code'] = svg(`<rect width="${W}" height="${H}" fill="#1e2233"/><rect width="${W}" height="${H}" fill="url(#g)"/>${lines}<rect x="0" y="0" width="${W}" height="8" fill="#2b3048"/>`, rad('g', [[0, '#3b4a8a', 0.35], [1, '#1e2233', 0]], 0.8, 0.2, 0.7))
}
covers['tech-grid'] = svg(
  `<rect width="${W}" height="${H}" fill="url(#sky)"/><circle cx="800" cy="210" r="120" fill="url(#sun)"/>` +
    Array.from({ length: 6 }, (_, i) => `<rect x="660" y="${150 + i * 18}" width="280" height="${4 + i}" fill="#2a1450"/>`).join('') +
    `<rect y="230" width="${W}" height="170" fill="#170b33"/>` +
    Array.from({ length: 9 }, (_, i) => { const y = 230 + Math.pow(i / 8, 2) * 170; return `<line x1="0" x2="${W}" y1="${f(y)}" y2="${f(y)}" stroke="#ff4fd8" stroke-opacity=".8" stroke-width="2"/>` }).join('') +
    Array.from({ length: 33 }, (_, i) => `<line x1="800" y1="230" x2="${f(800 + (i - 16) * 160)}" y2="400" stroke="#ff4fd8" stroke-opacity=".7" stroke-width="2"/>`).join(''),
  lin('sky', [[0, '#1a0b3d'], [1, '#5b1b74']]) + lin('sun', [[0, '#ffd166'], [1, '#ff4f9a']]),
)

// ---------------------------------------------------------------- Space
seed = 83
covers['space-stars'] = svg(
  `<rect width="${W}" height="${H}" fill="url(#bg)"/><ellipse cx="800" cy="200" rx="900" ry="90" fill="url(#mw)" transform="rotate(-12 800 200)"/>` +
    Array.from({ length: 260 }, () => `<circle cx="${f(r(0, W))}" cy="${f(r(0, H))}" r="${f(r(0.5, 2.1))}" fill="#fff" opacity="${f(r(0.4, 1))}"/>`).join(''),
  lin('bg', [[0, '#05060f'], [1, '#141a3a']]) + rad('mw', [[0, '#b9a6ff', 0.45], [0.5, '#5b6bd6', 0.18], [1, '#000', 0]]),
)
seed = 89
covers['space-planet'] = svg(
  `<rect width="${W}" height="${H}" fill="#070815"/>` +
    Array.from({ length: 160 }, () => `<circle cx="${f(r(0, W))}" cy="${f(r(0, H))}" r="${f(r(0.5, 1.8))}" fill="#fff" opacity="${f(r(0.3, 0.9))}"/>`).join('') +
    `<circle cx="1050" cy="430" r="300" fill="url(#pl)"/><ellipse cx="1050" cy="300" rx="470" ry="56" fill="none" stroke="#f5c98b" stroke-opacity=".6" stroke-width="10" transform="rotate(-8 1050 300)"/>` +
    `<circle cx="420" cy="120" r="34" fill="url(#moon)"/>`,
  lin('pl', [[0, '#f8b26a'], [0.5, '#e0607e'], [1, '#5b2a86']], 1, 1) + rad('moon', [[0, '#f2f2f2'], [1, '#9a9aa8']], 0.35, 0.35, 0.7),
)

// ---------------------------------------------------------------- City
seed = 97
function skyline(base, minH, maxH, color, win) {
  let x = -10, body = ''
  while (x < W) {
    const w = r(40, 110), h = r(minH, maxH)
    body += `<rect x="${f(x)}" y="${f(base - h)}" width="${f(w)}" height="${f(h + 10)}" fill="${color}"/>`
    if (win) for (let wy = base - h + 14; wy < base - 8; wy += 16) for (let wx = x + 8; wx < x + w - 10; wx += 14) if (rnd() < 0.42) body += `<rect x="${f(wx)}" y="${f(wy)}" width="6" height="8" fill="${win}" opacity="${f(r(0.5, 1))}"/>`
    x += w + r(0, 6)
  }
  return body
}
covers['city-dusk'] = svg(`<rect width="${W}" height="${H}" fill="url(#sky)"/><circle cx="1180" cy="230" r="80" fill="#ffd08a" opacity=".9"/>${skyline(330, 60, 200, '#8a6aa8', null)}${skyline(400, 40, 170, '#4c3b6e', '#ffd88a')}`, lin('sky', [[0, '#ffb08a'], [0.6, '#f78fb3'], [1, '#8f7ad6']]))
seed = 101
covers['city-night'] = svg(`<rect width="${W}" height="${H}" fill="url(#sky)"/>${Array.from({ length: 70 }, () => `<circle cx="${f(r(0, W))}" cy="${f(r(0, 160))}" r="${f(r(0.5, 1.6))}" fill="#fff" opacity=".7"/>`).join('')}${skyline(320, 80, 230, '#1b2340', '#7fb2ff')}${skyline(400, 40, 160, '#0e1428', '#ffd36e')}`, lin('sky', [[0, '#0b1026'], [1, '#2a3566']]))

// ---------------------------------------------------------------- Abstract
seed = 107
covers['abstract-waves'] = svg(
  `<rect width="${W}" height="${H}" fill="#fdf2ec"/>` +
    [['#ffc8a2', 120], ['#ff9fae', 190], ['#c58ef0', 260], ['#7f8cf5', 330]].map(([c, y], i) => `<path d="M0 ${y} C 300 ${y - 80 - i * 10} 600 ${y + 70} 900 ${y - 10} S 1400 ${y - 90} 1600 ${y - 20} V400 H0 Z" fill="${c}" opacity=".85"/>`).join(''),
)
seed = 109
{
  let tri = ''
  const cols = ['#264653', '#2a9d8f', '#8ab17d', '#e9c46a', '#f4a261', '#e76f51']
  for (let y = 0; y < H; y += 80) for (let x = -80; x < W + 80; x += 80) {
    const c1 = cols[Math.floor(r(0, cols.length))], c2 = cols[Math.floor(r(0, cols.length))]
    tri += `<path d="M${x} ${y} h80 v80 Z" fill="${c1}"/><path d="M${x} ${y} v80 h80 Z" fill="${c2}"/>`
  }
  covers['abstract-geometric'] = svg(tri)
}
seed = 113
covers['abstract-bokeh'] = svg(
  `<rect width="${W}" height="${H}" fill="url(#bg)"/>` +
    Array.from({ length: 55 }, () => `<circle cx="${f(r(0, W))}" cy="${f(r(0, H))}" r="${f(r(14, 70))}" fill="${['#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#ffc6ff'][Math.floor(r(0, 6))]}" opacity="${f(r(0.15, 0.5))}"/>`).join(''),
  lin('bg', [[0, '#2b2d42'], [1, '#4a3f6b']], 1, 1),
)

const out = path.join(__dirname, '..', 'public', 'covers')
fs.mkdirSync(out, { recursive: true })
for (const [id, s] of Object.entries(covers)) fs.writeFileSync(path.join(out, `${id}.svg`), s)
console.log(Object.keys(covers).length, 'covers', Object.entries(covers).map(([k, v]) => `${k}:${(v.length / 1024).toFixed(1)}k`).join(' '))
