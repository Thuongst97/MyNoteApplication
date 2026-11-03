/**
 * Presentation themes (premium tech & automotive). A theme styles the whole deck: background,
 * fonts, colors, cards and the title slide's artwork. Artwork is static SVG/HTML made here
 * (never user content), drawn behind the slide's blocks.
 */
export type ThemeId = 'obsidian' | 'champagne' | 'platinum' | 'electric' | 'carbon' | 'aurora' | 'neural'

export interface SlideTheme {
  id: ThemeId
  name: string
  tag: string
  blurb: string
  dark: boolean
  /** Background of every slide. */
  bg: string
  text: string
  muted: string
  /** Hairlines (dividers, card borders). */
  hair: string
  accent: string
  /** Accent for small text (labels) — lighter on dark themes. */
  accentText: string
  /** Gradient for big numbers and small accent lines. */
  grad: string
  /** Second accent (charts). */
  accent2: string
  card: string
  cardBorder?: string
  titleFont: string
  titleWeight: number
  /** Letter spacing of display titles. */
  titleTracking: string
  /** Labels, eyebrows and the footer in a monospace font. */
  mono?: boolean
  /** Rounded (glass) cards. */
  round?: boolean
  grain: number
  /** Soft light over the background (CSS background). */
  glow?: string
  /** Pattern over the background (CSS background). */
  pattern?: string
  /** Title-slide artwork (HTML). */
  art: () => string
  /** Starter deck. */
  deck: { eyebrow: string; title: string; sub: string; topic: string }
}

const INTER = "'Inter', ui-sans-serif, system-ui, sans-serif"
const LORA = "'Lora', Georgia, serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"

/** Light trails: smooth gradient curves with a soft glow copy underneath. */
function trails(id: string, stops: Array<[number, string, number?]>, paths: Array<[string, number]>, glow = 14, opacity = 1): string {
  return `<svg style="position:absolute;inset:0;opacity:${opacity}" width="1280" height="720" viewBox="0 0 1280 720" aria-hidden="true">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a ?? 1}"/>`).join('')}</linearGradient>
  <filter id="${id}b" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="${glow}"/></filter></defs>
  ${paths.map(([d, w]) => `<path d="${d}" stroke="url(#${id})" stroke-width="${w * 3}" fill="none" filter="url(#${id}b)" opacity=".55"/><path d="${d}" stroke="url(#${id})" stroke-width="${w}" fill="none" stroke-linecap="round"/>`).join('')}</svg>`
}

export const SLIDE_THEMES: SlideTheme[] = [
  {
    id: 'obsidian',
    name: 'Obsidian',
    tag: 'Keynote dark',
    blurb: 'Near-black, huge tight titles and one electric light trail.',
    dark: true,
    bg: '#09090b',
    text: '#f5f5f7',
    muted: '#8e8e96',
    hair: 'rgba(255,255,255,.10)',
    accent: '#6e8bff',
    accentText: '#9db0ff',
    accent2: '#a46bff',
    grad: 'linear-gradient(90deg,#4f7cff,#a46bff)',
    card: 'rgba(255,255,255,.035)',
    titleFont: INTER,
    titleWeight: 600,
    titleTracking: '-0.04em',
    grain: 0.1,
    glow: 'radial-gradient(700px 360px at 85% 25%,rgba(110,139,255,.16),transparent 70%)',
    art: () => trails('pn-ob', [[0, '#4f7cff', 0], [0.35, '#4f7cff'], [1, '#b06bff']], [['M560 760 C 760 640 900 560 1020 470 S 1220 300 1340 200', 3], ['M700 780 C 880 660 1000 590 1100 520 S 1260 400 1340 340', 1.4]], 16),
    deck: { eyebrow: 'Strategy 2027', title: 'The Software‑Defined Vehicle', sub: 'One platform for cluster, head unit and telematics.', topic: 'platform' },
  },
  {
    id: 'champagne',
    name: 'Graphite & Champagne',
    tag: 'Luxury automotive',
    blurb: 'Graphite, champagne-gold hairlines and an elegant serif.',
    dark: true,
    bg: '#141416',
    text: '#f3efe7',
    muted: '#9a958c',
    hair: 'rgba(214,186,140,.22)',
    accent: '#d6ba8c',
    accentText: '#e6cfa6',
    accent2: '#8a7a5e',
    grad: 'linear-gradient(90deg,#b8925a,#f0d9ae)',
    card: 'rgba(214,186,140,.05)',
    titleFont: LORA,
    titleWeight: 400,
    titleTracking: '-0.015em',
    grain: 0.12,
    glow: 'radial-gradient(900px 300px at 50% 105%,rgba(214,186,140,.14),transparent 70%)',
    art: () => trails('pn-ch', [[0, '#b8925a', 0], [0.5, '#d6ba8c'], [1, '#f6e6c4', 0.2]], [['M-40 500 C 300 460 640 460 900 500 S 1200 580 1340 540', 1.6], ['M-40 535 C 340 495 680 500 940 535 S 1220 615 1340 585', 0.8]], 10, 0.9),
    deck: { eyebrow: 'Cockpit experience', title: 'The Luxury Cockpit, Reimagined', sub: 'Cluster, head unit and ambient light as one experience.', topic: 'cockpit' },
  },
  {
    id: 'platinum',
    name: 'Platinum',
    tag: 'Premium light',
    blurb: 'Bright platinum white, deep ink type and a cobalt accent.',
    dark: false,
    bg: 'linear-gradient(180deg,#fbfbfc 0%,#eef0f4 100%)',
    text: '#0b1220',
    muted: '#5d6676',
    hair: 'rgba(11,18,32,.10)',
    accent: '#2453ff',
    accentText: '#2453ff',
    accent2: '#9db4ff',
    grad: 'linear-gradient(90deg,#2453ff,#6aa0ff)',
    card: 'rgba(255,255,255,.8)',
    cardBorder: 'rgba(11,18,32,.08)',
    titleFont: INTER,
    titleWeight: 600,
    titleTracking: '-0.04em',
    round: true,
    grain: 0.05,
    art: () =>
      `<div style="position:absolute;right:-180px;top:-220px;width:760px;height:760px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ffffff 0%,#dfe6f5 45%,#c5d1ec 70%,rgba(197,209,236,0) 72%)"></div>` +
      trails('pn-pl', [[0, '#2453ff', 0], [0.4, '#2453ff'], [1, '#7fb0ff', 0.4]], [['M620 760 C 820 640 960 560 1080 470 S 1260 330 1340 270', 2]], 12, 0.85),
    deck: { eyebrow: 'Release review', title: 'AVN Head Unit 4.2', sub: 'Navigation, media and connectivity — faster than ever.', topic: 'headunit' },
  },
  {
    id: 'electric',
    name: 'Electric Night',
    tag: 'EV & digital cluster',
    blurb: 'Midnight blue, cyan headlight trails and a horizon glow.',
    dark: true,
    bg: 'linear-gradient(180deg,#050a14 0%,#071226 60%,#0a1a33 100%)',
    text: '#eef6ff',
    muted: '#8ea3bd',
    hair: 'rgba(120,200,255,.14)',
    accent: '#38e1ff',
    accentText: '#7fecff',
    accent2: '#1a7bff',
    grad: 'linear-gradient(90deg,#1aa8ff,#38e1ff)',
    card: 'rgba(56,225,255,.05)',
    titleFont: INTER,
    titleWeight: 600,
    titleTracking: '-0.04em',
    grain: 0.1,
    glow: 'radial-gradient(800px 300px at 50% 110%,rgba(26,123,255,.18),transparent 70%)',
    art: () =>
      `<div style="position:absolute;left:0;right:0;top:470px;height:2px;background:linear-gradient(90deg,transparent,rgba(56,225,255,.55),transparent)"></div><div style="position:absolute;left:-10%;right:-10%;top:420px;height:200px;background:radial-gradient(50% 50% at 50% 30%,rgba(56,225,255,.22),transparent 70%)"></div>` +
      trails('pn-el', [[0, '#38e1ff', 0], [0.5, '#38e1ff'], [1, '#1a7bff', 0]], [['M470 720 C 560 590 610 520 640 472', 2.2], ['M810 720 C 720 590 670 520 640 472', 2.2], ['M580 720 C 610 600 628 520 640 472', 1], ['M700 720 C 670 600 652 520 640 472', 1]], 9),
    deck: { eyebrow: 'Digital cluster · EV', title: 'Range, Rendered', sub: 'The 2027 digital cluster and 800 V powertrain.', topic: 'cluster' },
  },
  {
    id: 'carbon',
    name: 'Carbon',
    tag: 'Engineering & motorsport',
    blurb: 'Carbon weave, signal-red details and technical mono labels.',
    dark: true,
    bg: '#0c0d0e',
    text: '#f2f2f2',
    muted: '#8b8f94',
    hair: 'rgba(255,255,255,.09)',
    accent: '#ff2d2d',
    accentText: '#ff5a52',
    accent2: '#5b5f66',
    grad: 'linear-gradient(90deg,#ff2d2d,#ff7a3d)',
    card: 'rgba(255,255,255,.03)',
    titleFont: INTER,
    titleWeight: 600,
    titleTracking: '-0.04em',
    mono: true,
    grain: 0.08,
    pattern: 'repeating-linear-gradient(45deg,rgba(255,255,255,.022) 0 2px,transparent 2px 6px),repeating-linear-gradient(-45deg,rgba(255,255,255,.018) 0 2px,transparent 2px 6px)',
    glow: 'radial-gradient(600px 300px at 90% 100%,rgba(255,45,45,.10),transparent 70%)',
    art: () =>
      `<div style="position:absolute;right:96px;top:96px;bottom:96px;width:1px;background:rgba(255,255,255,.12)"></div>` +
      [0, 1, 2, 3, 4].map((i) => `<div style="position:absolute;right:${96 + i * 54}px;bottom:96px;width:2px;height:${[230, 170, 120, 80, 50][i]}px;background:${i === 0 ? '#ff2d2d' : 'rgba(255,255,255,.25)'}"></div>`).join('') +
      `<div style="position:absolute;right:96px;bottom:338px;font:700 13px ${MONO};letter-spacing:.2em;color:#ff5a52">SIGNAL −71 dBm</div>`,
    deck: { eyebrow: 'Validation report', title: 'Telematics Control Unit', sub: '5G TCU · eCall · OTA — 1.2 million test km.', topic: 'telematics' },
  },
  {
    id: 'aurora',
    name: 'Aurora Glass',
    tag: 'HMI · Android Automotive',
    blurb: 'Deep night, a teal-violet aurora and frosted glass panels.',
    dark: true,
    bg: '#070b12',
    text: '#f1f5fb',
    muted: '#93a0b4',
    hair: 'rgba(255,255,255,.10)',
    accent: '#5ef0c3',
    accentText: '#7ff5d2',
    accent2: '#7a7cff',
    grad: 'linear-gradient(90deg,#3ee0b4,#7a7cff)',
    card: 'rgba(255,255,255,.06)',
    cardBorder: 'rgba(255,255,255,.12)',
    titleFont: INTER,
    titleWeight: 600,
    titleTracking: '-0.04em',
    round: true,
    grain: 0.1,
    art: () =>
      `<div style="position:absolute;right:-120px;top:-160px;width:820px;height:640px;filter:blur(60px);opacity:.75;background:radial-gradient(40% 45% at 30% 40%,#14b88f 0%,transparent 70%),radial-gradient(40% 45% at 70% 55%,#5a4dff 0%,transparent 70%),radial-gradient(30% 35% at 55% 25%,#1f7bff 0%,transparent 70%)"></div>
      <div style="position:absolute;right:96px;top:250px;width:330px;height:200px;border-radius:28px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);box-shadow:0 30px 60px rgba(0,0,0,.35)">
        <div style="position:absolute;left:28px;top:26px;font:500 14px ${INTER};color:#a9b6c9;letter-spacing:.04em">AAOS 14 · Head unit</div>
        <div style="position:absolute;left:28px;top:58px;font:600 54px ${INTER};color:#fff;letter-spacing:-0.03em">27 / 32</div>
        <div style="position:absolute;left:28px;top:128px;font:400 15px ${INTER};color:#a9b6c9">apps running natively</div>
        <div style="position:absolute;left:28px;right:28px;bottom:26px;height:4px;border-radius:2px;background:rgba(255,255,255,.12)"><div style="width:84%;height:4px;border-radius:2px;background:linear-gradient(90deg,#3ee0b4,#7a7cff)"></div></div></div>`,
    deck: { eyebrow: 'Program update', title: 'Android Automotive OS', sub: 'Moving the head unit to AAOS 14 — status and next steps.', topic: 'android' },
  },
  {
    id: 'neural',
    name: 'Neural',
    tag: 'AI',
    blurb: 'Iridescent violet-to-amber light and a fine neural network — for AI topics.',
    dark: true,
    bg: '#07060c',
    text: '#f6f3ff',
    muted: '#9b94b3',
    hair: 'rgba(196,170,255,.14)',
    accent: '#b38cff',
    accentText: '#cbb2ff',
    accent2: '#ff8a5c',
    grad: 'linear-gradient(90deg,#8b5cf6,#ec4899 55%,#f59e0b)',
    card: 'rgba(179,140,255,.05)',
    titleFont: INTER,
    titleWeight: 600,
    titleTracking: '-0.04em',
    grain: 0.1,
    glow: 'radial-gradient(700px 380px at 80% 30%,rgba(139,92,246,.14),transparent 70%)',
    art: () => {
      // A soft iridescent orb with a fine constellation of nodes around it.
      const nodes: Array<[number, number]> = [
        [820, 140], [930, 210], [1060, 160], [1170, 250], [900, 330], [1010, 300], [1140, 380], [860, 470], [990, 450], [1110, 520], [1210, 440], [940, 580], [1070, 620],
      ]
      const links = [[0, 1], [1, 2], [2, 3], [1, 4], [1, 5], [2, 5], [5, 6], [3, 6], [4, 7], [4, 8], [5, 8], [8, 9], [6, 9], [6, 10], [9, 10], [7, 11], [8, 11], [11, 12], [9, 12]]
      return `<div style="position:absolute;right:40px;top:110px;width:520px;height:520px;border-radius:50%;filter:blur(40px);opacity:.85;background:conic-gradient(from 200deg at 50% 50%,#8b5cf6,#ec4899,#f59e0b,#8b5cf6);-webkit-mask:radial-gradient(circle,#000 30%,transparent 68%);mask:radial-gradient(circle,#000 30%,transparent 68%)"></div>
      <svg style="position:absolute;inset:0" width="1280" height="720" viewBox="0 0 1280 720" aria-hidden="true">
        ${links.map(([a, b]) => `<line x1="${nodes[a][0]}" y1="${nodes[a][1]}" x2="${nodes[b][0]}" y2="${nodes[b][1]}" stroke="#d9c8ff" stroke-opacity=".22" stroke-width="1"/>`).join('')}
        ${nodes.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 4 === 0 ? 4.5 : 3}" fill="${i % 5 === 0 ? '#ffd2a8' : '#efe6ff'}" opacity="${i % 3 === 0 ? 1 : 0.7}"/>`).join('')}
      </svg>`
    },
    deck: { eyebrow: 'AI in the vehicle', title: 'The Intelligent Cockpit', sub: 'On-device assistant, driver monitoring and predictive maintenance.', topic: 'ai' },
  },
]

export const THEME_IDS = SLIDE_THEMES.map((t) => t.id)
export const slideTheme = (id: unknown): SlideTheme | null => SLIDE_THEMES.find((t) => t.id === id) ?? null

/** Film-grain texture (very subtle), as a CSS background. */
export const GRAIN_BG = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`

/** CSS variables a theme sets on the slide surface (used by the themed slide styles). */
export function themeVars(t: SlideTheme): Record<string, string> {
  return {
    '--st-text': t.text,
    '--st-muted': t.muted,
    '--st-hair': t.hair,
    '--st-accent': t.accent,
    '--st-accent-text': t.accentText,
    '--st-grad': t.grad,
    '--st-card': t.card,
    '--st-card-border': t.cardBorder ?? t.hair,
    '--st-card-radius': t.round ? '22px' : '6px',
    '--st-title-font': t.titleFont,
    '--st-title-weight': String(t.titleWeight),
    '--st-title-tracking': t.titleTracking,
    '--st-label-font': t.mono ? MONO : INTER,
  }
}
