import type { LibraryCategory, LibraryItem } from './libraries'

/**
 * Built-in "Automotive" drawing library: cockpit hardware (head unit, IVI screen, cluster,
 * AVN), vehicles, batteries, ECUs, in-vehicle networks (CAN, LIN, FlexRay, automotive
 * Ethernet), software stacks (Android Automotive, hypervisor, AUTOSAR) and sensors.
 *
 * Shapes are plain Excalidraw elements built in code (no images, no brand logos), so they
 * stay sharp, can be recolored and edited, and ship with the app. Excalidraw normalizes
 * missing element fields when items are shown or inserted.
 */

export const AUTOMOTIVE_LIBRARY_ID = 'builtin-automotive'

// Palette: deep navy hardware, cyan/blue accents, status colors.
const C = {
  ink: '#1e293b',
  body: '#334155',
  dark: '#0f172a',
  screen: '#1e293b',
  panel: '#475569',
  light: '#e2e8f0',
  paper: '#f8fafc',
  cyan: '#06b6d4',
  blue: '#3b82f6',
  sky: '#bae6fd',
  green: '#22c55e',
  lime: '#bbf7d0',
  amber: '#f59e0b',
  orange: '#f97316',
  red: '#ef4444',
  purple: '#8b5cf6',
  white: '#ffffff',
  gray: '#94a3b8',
  android: '#3ddc84',
}

const FONT = { sans: 6, mono: 3 } // Nunito, Cascadia (Excalidraw font ids)

interface Style {
  stroke?: string
  fill?: string
  width?: number
  dashed?: boolean
  dotted?: boolean
  round?: boolean
  opacity?: number
  hachure?: boolean
}

type El = Record<string, unknown>

class Builder {
  els: El[] = []
  private n = 0
  constructor(
    private readonly itemId: string,
    private readonly group: string,
  ) {}

  private base(type: string, x: number, y: number, w: number, h: number, s: Style): El {
    this.n++
    return {
      id: `${this.itemId}-${this.n}`,
      type,
      x,
      y,
      width: w,
      height: h,
      angle: 0,
      strokeColor: s.stroke ?? C.ink,
      backgroundColor: s.fill ?? 'transparent',
      fillStyle: s.hachure ? 'hachure' : 'solid',
      strokeWidth: s.width ?? 2,
      strokeStyle: s.dashed ? 'dashed' : s.dotted ? 'dotted' : 'solid',
      roughness: 0,
      opacity: s.opacity ?? 100,
      groupIds: [this.group],
      frameId: null,
      // Rounded corners (shapes) or a smooth curve (lines).
      roundness: s.round ? { type: type === 'line' || type === 'arrow' ? 2 : 3 } : null,
      seed: this.n * 7919 + 13,
      version: 1,
      versionNonce: this.n * 104729,
      isDeleted: false,
      boundElements: null,
      updated: 1,
      link: null,
      locked: false,
    }
  }

  rect(x: number, y: number, w: number, h: number, s: Style = {}) {
    this.els.push(this.base('rectangle', x, y, w, h, { round: true, ...s }))
    return this
  }

  ellipse(x: number, y: number, w: number, h: number, s: Style = {}) {
    this.els.push(this.base('ellipse', x, y, w, h, s))
    return this
  }

  circle(cx: number, cy: number, r: number, s: Style = {}) {
    return this.ellipse(cx - r, cy - r, r * 2, r * 2, s)
  }

  diamond(x: number, y: number, w: number, h: number, s: Style = {}) {
    this.els.push(this.base('diamond', x, y, w, h, s))
    return this
  }

  /** Polyline through absolute points; `closed` repeats the first point (filled shape). */
  line(points: Array<[number, number]>, s: Style & { closed?: boolean; arrow?: 'end' | 'both' } = {}) {
    const pts = s.closed ? [...points, points[0]] : points
    const x0 = pts[0][0]
    const y0 = pts[0][1]
    const rel = pts.map(([x, y]) => [x - x0, y - y0])
    const xs = rel.map((p) => p[0])
    const ys = rel.map((p) => p[1])
    const el = this.base(s.arrow ? 'arrow' : 'line', x0, y0, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), { round: false, ...s })
    Object.assign(el, {
      points: rel,
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: s.arrow === 'both' ? 'arrow' : null,
      endArrowhead: s.arrow ? 'arrow' : null,
      elbowed: false,
      ...(s.closed ? { polygon: true } : {}),
    })
    this.els.push(el)
    return this
  }

  /** Text whose box starts at (x, y); `center` centers it on x instead. */
  text(x: number, y: number, text: string, opts: { size?: number; color?: string; mono?: boolean; center?: boolean; bold?: boolean } = {}) {
    const size = opts.size ?? 16
    const lines = text.split('\n')
    const w = Math.max(...lines.map((l) => l.length)) * size * (opts.mono ? 0.6 : 0.55)
    const h = lines.length * size * 1.25
    const el = this.base('text', opts.center ? x - w / 2 : x, y, w, h, { stroke: opts.color ?? C.ink, round: false })
    Object.assign(el, {
      text,
      originalText: text,
      fontSize: size,
      fontFamily: opts.mono ? FONT.mono : FONT.sans,
      textAlign: opts.center ? 'center' : 'left',
      verticalAlign: 'top',
      containerId: null,
      lineHeight: 1.25,
      autoResize: true,
    })
    this.els.push(el)
    return this
  }
}

function item(id: string, name: string, draw: (b: Builder) => void): LibraryItem {
  const b = new Builder(id, `${id}-g`)
  draw(b)
  return { id, name, created: 0, elements: b.els }
}

// ---------- small reusable parts ----------

/** Connector pins along the bottom edge of a box. */
function pins(b: Builder, x: number, y: number, count: number, gap = 14, color = C.gray) {
  for (let i = 0; i < count; i++) b.rect(x + i * gap, y, 8, 12, { fill: color, stroke: color, width: 1, round: false })
}

/** Status LED. */
function led(b: Builder, cx: number, cy: number, color = C.green) {
  b.circle(cx, cy, 4, { fill: color, stroke: color, width: 1 })
}

/** A labelled module box (ECU-style). */
function moduleBox(b: Builder, x: number, y: number, w: number, h: number, title: string, sub?: string, fill = C.body) {
  b.rect(x, y, w, h, { fill, stroke: C.dark, width: 2 })
  b.text(x + w / 2, y + (sub ? h / 2 - 20 : h / 2 - 11), title, { size: 18, color: C.white, center: true })
  if (sub) b.text(x + w / 2, y + h / 2 + 4, sub, { size: 12, color: C.light, center: true, mono: true })
}

/** Simple chip (square with pins on all sides). */
function chip(b: Builder, x: number, y: number, s: number, label: string, fill = C.dark) {
  const p = 5
  for (let i = 1; i <= 3; i++) {
    const o = (s / 4) * i
    b.line([[x + o, y - p], [x + o, y]], { stroke: C.gray, width: 2 })
    b.line([[x + o, y + s], [x + o, y + s + p]], { stroke: C.gray, width: 2 })
    b.line([[x - p, y + o], [x, y + o]], { stroke: C.gray, width: 2 })
    b.line([[x + s, y + o], [x + s + p, y + o]], { stroke: C.gray, width: 2 })
  }
  b.rect(x, y, s, s, { fill, stroke: C.gray, width: 1 })
  b.text(x + s / 2, y + s / 2 - 8, label, { size: 12, color: C.white, center: true, mono: true })
}

/** Wheel with rim. */
function wheel(b: Builder, cx: number, cy: number, r: number) {
  b.circle(cx, cy, r, { fill: C.dark, stroke: C.dark })
  b.circle(cx, cy, r * 0.58, { fill: C.gray, stroke: C.light, width: 2 })
  b.circle(cx, cy, r * 0.18, { fill: C.panel, stroke: C.panel })
}

// ---------- the items ----------

const ITEMS: LibraryItem[] = [
  item('auto-head-unit', 'Head Unit ECU', (b) => {
    b.rect(0, 0, 220, 130, { fill: C.body, stroke: C.dark, width: 2 })
    b.rect(12, 12, 196, 34, { fill: C.dark, stroke: C.dark, width: 1 })
    b.text(110, 18, 'HEAD UNIT', { size: 18, color: C.cyan, center: true })
    b.text(110, 58, 'IVI ECU · SoC', { size: 14, color: C.light, center: true })
    b.text(110, 80, 'CAN · ETH · USB · LVDS', { size: 11, color: C.gray, center: true, mono: true })
    led(b, 22, 112, C.green)
    led(b, 36, 112, C.amber)
    pins(b, 104, 106, 8, 13)
  }),

  item('auto-ivi-screen', 'IVI screen (modern)', (b) => {
    b.rect(0, 0, 340, 200, { fill: C.dark, stroke: C.dark, width: 2 })
    b.rect(10, 10, 320, 180, { fill: C.screen, stroke: C.screen, width: 1 })
    b.text(20, 16, '12:45', { size: 12, color: C.light })
    b.text(278, 16, '5G  22°C', { size: 11, color: C.gray, mono: true })
    // map tile with route
    b.rect(20, 38, 190, 112, { fill: '#0c4a6e', stroke: '#0c4a6e', width: 1 })
    b.line([[34, 136], [70, 112], [96, 118], [132, 80], [170, 70], [196, 50]], { stroke: C.cyan, width: 4 })
    b.circle(196, 50, 6, { fill: C.white, stroke: C.cyan, width: 2 })
    b.text(28, 44, 'Navigation', { size: 11, color: C.sky })
    // media tile
    b.rect(218, 38, 102, 52, { fill: C.panel, stroke: C.panel, width: 1 })
    b.rect(226, 46, 36, 36, { fill: C.purple, stroke: C.purple, width: 1 })
    b.text(268, 50, 'Now\nplaying', { size: 10, color: C.light })
    // climate tile
    b.rect(218, 98, 102, 52, { fill: C.panel, stroke: C.panel, width: 1 })
    b.text(228, 104, 'Climate', { size: 10, color: C.light })
    b.text(228, 120, '21.5°', { size: 18, color: C.white })
    // dock
    const dock = [C.blue, C.green, C.amber, C.purple, C.red, C.cyan]
    dock.forEach((c, i) => b.rect(40 + i * 46, 158, 30, 24, { fill: c, stroke: c, width: 1 }))
  }),

  item('auto-cluster', 'Digital instrument cluster', (b) => {
    b.rect(0, 0, 360, 150, { fill: C.dark, stroke: C.dark, width: 2 })
    // speed gauge
    b.circle(70, 75, 52, { fill: C.screen, stroke: C.cyan, width: 4 })
    b.text(70, 56, '88', { size: 28, color: C.white, center: true })
    b.text(70, 92, 'km/h', { size: 11, color: C.gray, center: true })
    // power gauge
    b.circle(290, 75, 52, { fill: C.screen, stroke: C.green, width: 4 })
    b.text(290, 56, '42', { size: 28, color: C.white, center: true })
    b.text(290, 92, 'kW', { size: 11, color: C.gray, center: true })
    // center info
    b.rect(136, 28, 88, 94, { fill: C.screen, stroke: C.panel, width: 1 })
    b.text(180, 36, 'D', { size: 22, color: C.cyan, center: true })
    b.text(180, 70, '320 km', { size: 13, color: C.light, center: true })
    b.rect(150, 96, 60, 8, { fill: C.panel, stroke: C.panel, width: 1 })
    b.rect(150, 96, 42, 8, { fill: C.green, stroke: C.green, width: 1 })
    // tell-tales
    led(b, 150, 134, C.amber)
    led(b, 166, 134, C.red)
    led(b, 182, 134, C.blue)
    led(b, 198, 134, C.green)
  }),

  item('auto-avn', 'AVN unit (audio · video · navigation)', (b) => {
    b.rect(0, 0, 300, 140, { fill: C.body, stroke: C.dark, width: 2 })
    b.rect(60, 12, 180, 100, { fill: C.screen, stroke: C.dark, width: 2 })
    b.line([[76, 96], [110, 70], [140, 78], [176, 46], [222, 36]], { stroke: C.cyan, width: 3 })
    b.text(150, 116, 'AVN', { size: 14, color: C.light, center: true })
    // knobs
    b.circle(32, 46, 20, { fill: C.dark, stroke: C.gray, width: 2 })
    b.circle(268, 46, 20, { fill: C.dark, stroke: C.gray, width: 2 })
    // buttons
    for (let i = 0; i < 3; i++) {
      b.rect(14, 82 + i * 16, 36, 10, { fill: C.panel, stroke: C.panel, width: 1 })
      b.rect(250, 82 + i * 16, 36, 10, { fill: C.panel, stroke: C.panel, width: 1 })
    }
  }),

  item('auto-hud', 'Head-up display (HUD)', (b) => {
    b.line([[0, 90], [40, 0], [260, 0], [300, 90]], { stroke: C.gray, width: 2, closed: true, fill: '#e0f2fe', opacity: 70 })
    b.text(150, 22, '80', { size: 26, color: C.blue, center: true })
    b.line([[118, 66], [150, 52], [182, 66]], { stroke: C.cyan, width: 4 })
    b.text(150, 70, '200 m', { size: 11, color: C.body, center: true })
  }),

  item('auto-steering', 'Steering wheel', (b) => {
    b.circle(70, 70, 66, { stroke: C.ink, width: 10 })
    b.circle(70, 70, 22, { fill: C.body, stroke: C.ink, width: 3 })
    b.line([[6, 70], [48, 70]], { stroke: C.ink, width: 8 })
    b.line([[92, 70], [134, 70]], { stroke: C.ink, width: 8 })
    b.line([[70, 92], [70, 134]], { stroke: C.ink, width: 8 })
  }),

  item('auto-luxury-sedan', 'Luxury vehicle (sedan)', (b) => {
    // body
    b.line(
      [
        [10, 92], [14, 70], [46, 60], [104, 54], [150, 22], [252, 18], [300, 50], [370, 58], [396, 72], [398, 92],
      ],
      { closed: true, fill: C.ink, stroke: C.dark, width: 2 },
    )
    // windows
    b.line([[116, 54], [154, 28], [200, 26], [200, 54]], { closed: true, fill: C.sky, stroke: C.dark, width: 2 })
    b.line([[210, 26], [250, 24], [286, 52], [210, 54]], { closed: true, fill: C.sky, stroke: C.dark, width: 2 })
    // chrome line & lights
    b.line([[40, 74], [380, 74]], { stroke: C.gray, width: 2 })
    b.rect(372, 60, 22, 8, { fill: C.white, stroke: C.gray, width: 1 })
    b.rect(12, 64, 14, 8, { fill: C.red, stroke: C.red, width: 1 })
    wheel(b, 90, 96, 28)
    wheel(b, 320, 96, 28)
  }),

  item('auto-suv', 'SUV', (b) => {
    b.line(
      [
        [10, 100], [12, 62], [40, 52], [70, 16], [270, 12], [312, 50], [372, 58], [384, 76], [386, 100],
      ],
      { closed: true, fill: C.body, stroke: C.dark, width: 2 },
    )
    b.line([[84, 48], [100, 22], [170, 20], [170, 48]], { closed: true, fill: C.sky, stroke: C.dark, width: 2 })
    b.line([[180, 20], [262, 18], [292, 48], [180, 48]], { closed: true, fill: C.sky, stroke: C.dark, width: 2 })
    b.rect(366, 62, 16, 8, { fill: C.white, stroke: C.gray, width: 1 })
    wheel(b, 84, 104, 30)
    wheel(b, 310, 104, 30)
  }),

  item('auto-ev-topview', 'Electric vehicle (top view)', (b) => {
    b.rect(0, 0, 140, 300, { fill: C.light, stroke: C.ink, width: 2 })
    b.rect(18, 50, 104, 50, { fill: C.sky, stroke: C.ink, width: 2 })
    b.rect(18, 210, 104, 40, { fill: C.sky, stroke: C.ink, width: 2 })
    b.rect(26, 112, 88, 86, { fill: C.lime, stroke: C.green, width: 2 })
    b.text(70, 140, 'HV\nbattery', { size: 12, color: '#166534', center: true })
    for (const [x, y] of [[-8, 40], [128, 40], [-8, 220], [128, 220]] as const) b.rect(x, y, 20, 46, { fill: C.dark, stroke: C.dark, width: 1 })
  }),

  item('auto-battery-12v', 'Vehicle battery (12 V)', (b) => {
    b.rect(20, 0, 30, 18, { fill: C.red, stroke: C.dark, width: 2, round: false })
    b.rect(150, 0, 30, 18, { fill: C.ink, stroke: C.dark, width: 2, round: false })
    b.rect(0, 14, 200, 110, { fill: C.body, stroke: C.dark, width: 2 })
    b.text(35, 30, '+', { size: 24, color: C.red, center: true })
    b.text(165, 30, '−', { size: 24, color: C.white, center: true })
    b.text(100, 60, '12V', { size: 28, color: C.white, center: true })
    b.text(100, 96, '70 Ah · AGM', { size: 12, color: C.light, center: true, mono: true })
  }),

  item('auto-ev-battery', 'EV battery pack (HV) + BMS', (b) => {
    b.rect(0, 0, 340, 130, { fill: C.dark, stroke: C.dark, width: 2 })
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 8; c++) b.rect(14 + c * 30, 14 + r * 52, 24, 44, { fill: C.green, stroke: '#15803d', width: 1 })
    b.rect(262, 14, 64, 102, { fill: C.panel, stroke: C.gray, width: 1 })
    b.text(294, 40, 'BMS', { size: 16, color: C.white, center: true })
    led(b, 294, 80, C.green)
    b.text(170, 136, 'HV battery · 400 V · 75 kWh', { size: 12, color: C.ink, center: true })
  }),

  item('auto-charger', 'EV charger (DC fast charging)', (b) => {
    b.rect(0, 0, 90, 180, { fill: C.paper, stroke: C.ink, width: 2 })
    b.rect(14, 16, 62, 44, { fill: C.screen, stroke: C.ink, width: 1 })
    b.text(45, 26, '80%', { size: 16, color: C.green, center: true })
    b.text(45, 70, 'DC', { size: 14, color: C.blue, center: true })
    b.line([[90, 120], [130, 120], [140, 160], [170, 160]], { stroke: C.ink, width: 4 })
    b.rect(166, 148, 34, 24, { fill: C.ink, stroke: C.ink, width: 1 })
    b.text(45, 150, 'CCS2', { size: 11, color: C.body, center: true, mono: true })
  }),

  item('auto-ecu', 'ECU (generic)', (b) => {
    moduleBox(b, 0, 0, 160, 90, 'ECU', 'MCU · AUTOSAR')
    pins(b, 20, 84, 9, 14)
    led(b, 146, 14, C.green)
  }),

  item('auto-gateway', 'Central gateway', (b) => {
    moduleBox(b, 0, 0, 220, 110, 'Central Gateway', 'routing · firewall')
    const ports: Array<[string, string]> = [['CAN', C.orange], ['LIN', C.amber], ['ETH', C.blue], ['FR', C.purple]]
    ports.forEach(([label, color], i) => {
      b.rect(14 + i * 52, 118, 44, 22, { fill: color, stroke: color, width: 1 })
      b.text(36 + i * 52, 121, label, { size: 12, color: C.white, center: true, mono: true })
    })
  }),

  item('auto-domain-controller', 'Domain controller (ADAS / cockpit)', (b) => {
    b.rect(0, 0, 220, 120, { fill: C.body, stroke: C.dark, width: 2 })
    b.text(110, 10, 'Domain Controller', { size: 16, color: C.white, center: true })
    chip(b, 30, 44, 56, 'SoC')
    chip(b, 130, 44, 56, 'MCU', C.panel)
  }),

  item('auto-zonal', 'Zonal controller', (b) => {
    moduleBox(b, 0, 0, 170, 90, 'Zonal ECU', 'front-left zone', '#0e7490')
    for (let i = 0; i < 4; i++) b.line([[20 + i * 40, 90], [20 + i * 40, 120]], { stroke: C.gray, width: 2 })
    b.text(85, 124, 'sensors · actuators', { size: 11, color: C.body, center: true })
  }),

  item('auto-tcu', 'Telematics unit (TCU) · 4G/5G', (b) => {
    moduleBox(b, 0, 40, 170, 90, 'TCU', 'LTE / 5G · GNSS · eCall')
    b.line([[130, 40], [130, 6]], { stroke: C.ink, width: 3 })
    b.circle(130, 6, 5, { fill: C.cyan, stroke: C.ink, width: 2 })
    b.line([[144, 14], [152, 6]], { stroke: C.cyan, width: 2 })
    b.line([[150, 22], [162, 10]], { stroke: C.cyan, width: 2 })
  }),

  item('auto-can-bus', 'CAN bus network (CAN_H / CAN_L)', (b) => {
    b.line([[0, 100], [460, 100]], { stroke: C.orange, width: 3 })
    b.line([[0, 116], [460, 116]], { stroke: C.green, width: 3 })
    b.text(4, 78, 'CAN_H', { size: 12, color: C.orange, mono: true })
    b.text(4, 122, 'CAN_L', { size: 12, color: C.green, mono: true })
    // 120 Ω terminations
    for (const x of [6, 438]) {
      b.rect(x, 98, 16, 20, { fill: C.paper, stroke: C.ink, width: 2, round: false })
    }
    b.text(14, 140, '120 Ω', { size: 11, color: C.body, center: true, mono: true })
    b.text(446, 140, '120 Ω', { size: 11, color: C.body, center: true, mono: true })
    // nodes
    ;['ECU 1', 'ECU 2', 'ECU 3'].forEach((label, i) => {
      const x = 80 + i * 120
      b.rect(x, 10, 90, 50, { fill: C.body, stroke: C.dark, width: 2 })
      b.text(x + 45, 24, label, { size: 15, color: C.white, center: true })
      b.line([[x + 36, 60], [x + 36, 100]], { stroke: C.orange, width: 2 })
      b.line([[x + 54, 60], [x + 54, 116]], { stroke: C.green, width: 2 })
    })
  }),

  item('auto-lin-bus', 'LIN bus (master / slaves)', (b) => {
    b.line([[0, 80], [400, 80]], { stroke: C.amber, width: 3, dashed: true })
    b.rect(0, 0, 110, 50, { fill: C.body, stroke: C.dark, width: 2 })
    b.text(55, 8, 'LIN master', { size: 14, color: C.white, center: true })
    b.text(55, 28, 'body ECU', { size: 11, color: C.light, center: true })
    b.line([[55, 50], [55, 80]], { stroke: C.amber, width: 2 })
    ;['Window', 'Mirror', 'Seat'].forEach((label, i) => {
      const x = 140 + i * 90
      b.rect(x, 104, 76, 40, { fill: C.paper, stroke: C.ink, width: 2 })
      b.text(x + 38, 114, label, { size: 13, color: C.ink, center: true })
      b.line([[x + 38, 80], [x + 38, 104]], { stroke: C.amber, width: 2 })
    })
  }),

  item('auto-flexray', 'FlexRay (dual channel)', (b) => {
    b.line([[0, 70], [360, 70]], { stroke: C.purple, width: 3 })
    b.line([[0, 86], [360, 86]], { stroke: '#c4b5fd', width: 3 })
    b.text(4, 48, 'FlexRay A / B · 10 Mbit/s', { size: 12, color: C.purple, mono: true })
    ;['Chassis', 'Brake', 'Steer'].forEach((label, i) => {
      const x = 40 + i * 110
      b.rect(x, 104, 84, 40, { fill: C.body, stroke: C.dark, width: 2 })
      b.text(x + 42, 114, label, { size: 13, color: C.white, center: true })
      b.line([[x + 34, 70], [x + 34, 104]], { stroke: C.purple, width: 2 })
      b.line([[x + 50, 86], [x + 50, 104]], { stroke: '#c4b5fd', width: 2 })
    })
  }),

  item('auto-eth-switch', 'Automotive Ethernet switch', (b) => {
    b.rect(0, 0, 240, 100, { fill: '#1e3a8a', stroke: C.dark, width: 2 })
    b.text(120, 10, 'Ethernet Switch', { size: 16, color: C.white, center: true })
    b.text(120, 32, 'TSN · VLAN · 100/1000BASE-T1', { size: 10, color: C.sky, center: true, mono: true })
    for (let i = 0; i < 6; i++) {
      b.rect(16 + i * 36, 60, 28, 24, { fill: C.dark, stroke: C.sky, width: 1 })
      led(b, 30 + i * 36, 54, i % 3 ? C.green : C.amber)
    }
  }),

  item('auto-eth-link', 'Ethernet link (1000BASE-T1)', (b) => {
    b.line([[0, 20], [300, 20]], { stroke: C.blue, width: 4, arrow: 'both' })
    b.text(150, 30, '1000BASE-T1 · single pair', { size: 12, color: C.blue, center: true, mono: true })
  }),

  item('auto-aaos-stack', 'Android Automotive OS stack', (b) => {
    const layers: Array<[string, string, string]> = [
      ['Apps · Maps · Media · Settings', C.paper, C.ink],
      ['Android Automotive OS (framework)', C.android, '#0b3d1e'],
      ['Car service · Vehicle HAL (VHAL)', '#a7f3d0', '#064e3b'],
      ['Linux kernel · drivers', C.light, C.ink],
      ['SoC', C.body, C.white],
    ]
    layers.forEach(([label, fill, color], i) => {
      b.rect(0, i * 46, 280, 40, { fill, stroke: C.ink, width: 2 })
      b.text(140, i * 46 + 10, label, { size: 14, color, center: true })
    })
  }),

  item('auto-cockpit-hypervisor', 'Cockpit SoC: hypervisor (IVI + cluster)', (b) => {
    b.rect(0, 0, 150, 90, { fill: C.android, stroke: C.ink, width: 2 })
    b.text(75, 14, 'Android IVI', { size: 15, color: '#0b3d1e', center: true })
    b.text(75, 40, 'infotainment', { size: 12, color: '#14532d', center: true })
    b.rect(160, 0, 150, 90, { fill: C.sky, stroke: C.ink, width: 2 })
    b.text(235, 14, 'Cluster', { size: 15, color: '#0c4a6e', center: true })
    b.text(235, 40, 'Linux / QNX · RTOS', { size: 12, color: '#075985', center: true })
    b.rect(0, 100, 310, 40, { fill: C.amber, stroke: C.ink, width: 2 })
    b.text(155, 110, 'Hypervisor', { size: 15, color: C.ink, center: true })
    b.rect(0, 150, 310, 40, { fill: C.body, stroke: C.ink, width: 2 })
    b.text(155, 160, 'Cockpit SoC (CPU · GPU · NPU)', { size: 14, color: C.white, center: true })
  }),

  item('auto-autosar', 'AUTOSAR classic stack', (b) => {
    b.rect(0, 0, 280, 40, { fill: C.paper, stroke: C.ink, width: 2 })
    b.text(140, 10, 'Application SW-Cs', { size: 14, center: true })
    b.rect(0, 46, 280, 34, { fill: '#fde68a', stroke: C.ink, width: 2 })
    b.text(140, 54, 'RTE', { size: 14, center: true })
    b.rect(0, 86, 136, 40, { fill: C.sky, stroke: C.ink, width: 2 })
    b.text(68, 96, 'Services · OS', { size: 13, center: true })
    b.rect(144, 86, 136, 40, { fill: '#c4b5fd', stroke: C.ink, width: 2 })
    b.text(212, 96, 'COM · CAN stack', { size: 13, center: true })
    b.rect(0, 132, 280, 34, { fill: C.light, stroke: C.ink, width: 2 })
    b.text(140, 140, 'MCAL', { size: 14, center: true })
    b.rect(0, 172, 280, 34, { fill: C.body, stroke: C.ink, width: 2 })
    b.text(140, 180, 'Microcontroller', { size: 14, color: C.white, center: true })
  }),

  item('auto-camera', 'Camera (ADAS)', (b) => {
    b.rect(0, 10, 90, 60, { fill: C.body, stroke: C.dark, width: 2 })
    b.circle(45, 40, 20, { fill: C.dark, stroke: C.gray, width: 3 })
    b.circle(45, 40, 8, { fill: C.blue, stroke: C.blue, width: 1 })
    b.line([[90, 40], [150, 10]], { stroke: C.cyan, width: 2, dashed: true })
    b.line([[90, 40], [150, 70]], { stroke: C.cyan, width: 2, dashed: true })
    b.text(45, 76, 'Camera', { size: 12, color: C.ink, center: true })
  }),

  item('auto-radar', 'Radar', (b) => {
    b.rect(0, 20, 70, 50, { fill: C.body, stroke: C.dark, width: 2 })
    b.text(35, 36, 'RADAR', { size: 11, color: C.white, center: true, mono: true })
    for (let i = 0; i < 3; i++) {
      const r = 24 + i * 16
      b.line([[78 + i * 12, 45 - r / 2], [86 + i * 16, 45], [78 + i * 12, 45 + r / 2]], { stroke: C.orange, width: 2, round: true })
    }
    b.text(35, 76, '77 GHz', { size: 11, color: C.body, center: true, mono: true })
  }),

  item('auto-lidar', 'LiDAR', (b) => {
    b.ellipse(0, 0, 80, 20, { fill: C.light, stroke: C.ink, width: 2 })
    b.rect(0, 10, 80, 60, { fill: C.body, stroke: C.ink, width: 2, round: false })
    b.rect(0, 30, 80, 14, { fill: C.cyan, stroke: C.cyan, width: 1, round: false })
    b.ellipse(0, 60, 80, 20, { fill: C.body, stroke: C.ink, width: 2 })
    b.text(40, 88, 'LiDAR', { size: 12, color: C.ink, center: true })
  }),

  item('auto-ultrasonic', 'Ultrasonic park sensor', (b) => {
    b.circle(30, 30, 24, { fill: C.light, stroke: C.ink, width: 2 })
    b.circle(30, 30, 10, { fill: C.panel, stroke: C.ink, width: 2 })
    for (let i = 0; i < 3; i++) b.line([[62 + i * 10, 14 - i * 3], [70 + i * 12, 30], [62 + i * 10, 46 + i * 3]], { stroke: C.blue, width: 2 })
  }),

  item('auto-obd', 'OBD-II port', (b) => {
    b.line([[0, 0], [160, 0], [146, 60], [14, 60]], { closed: true, fill: C.ink, stroke: C.dark, width: 2 })
    for (let r = 0; r < 2; r++) for (let c = 0; c < 8; c++) b.rect(18 + c * 16 + r * 2, 14 + r * 22, 8, 12, { fill: C.amber, stroke: C.amber, width: 1, round: false })
    b.text(80, 66, 'OBD-II', { size: 12, color: C.ink, center: true, mono: true })
  }),

  item('auto-ota-cloud', 'OTA / cloud backend', (b) => {
    b.ellipse(20, 30, 90, 60, { fill: C.sky, stroke: C.blue, width: 2 })
    b.ellipse(70, 10, 100, 70, { fill: C.sky, stroke: C.blue, width: 2 })
    b.ellipse(130, 34, 80, 56, { fill: C.sky, stroke: C.blue, width: 2 })
    b.rect(30, 58, 170, 34, { fill: C.sky, stroke: C.sky, width: 1 })
    b.text(115, 54, 'OTA server', { size: 16, color: '#1e3a8a', center: true })
    b.line([[115, 100], [115, 150]], { stroke: C.blue, width: 3, arrow: 'end', dashed: true })
    b.text(124, 116, 'update', { size: 11, color: C.blue, mono: true })
  }),

  item('auto-key-fob', 'Key fob', (b) => {
    b.rect(0, 0, 60, 110, { fill: C.ink, stroke: C.dark, width: 2 })
    b.circle(30, 28, 12, { fill: C.panel, stroke: C.gray, width: 2 })
    b.circle(30, 60, 10, { fill: C.panel, stroke: C.gray, width: 2 })
    b.circle(30, 88, 8, { fill: C.red, stroke: C.gray, width: 2 })
    b.line([[70, 20], [80, 10]], { stroke: C.cyan, width: 2 })
    b.line([[74, 30], [90, 14]], { stroke: C.cyan, width: 2 })
  }),

  item('auto-phone-projection', 'Phone projection (wired / wireless)', (b) => {
    b.rect(0, 0, 60, 110, { fill: C.dark, stroke: C.dark, width: 2 })
    b.rect(6, 10, 48, 84, { fill: C.blue, stroke: C.blue, width: 1 })
    b.line([[70, 55], [150, 55]], { stroke: C.blue, width: 3, arrow: 'both', dashed: true })
    b.rect(160, 10, 150, 90, { fill: C.dark, stroke: C.dark, width: 2 })
    b.rect(168, 18, 134, 74, { fill: C.screen, stroke: C.screen, width: 1 })
    for (let i = 0; i < 4; i++) b.rect(178 + i * 30, 40, 22, 22, { fill: [C.green, C.blue, C.amber, C.red][i], stroke: C.screen, width: 1 })
    b.text(110, 64, 'projection', { size: 11, color: C.blue, center: true, mono: true })
  }),

  item('auto-speaker', 'Speaker / amplifier', (b) => {
    b.rect(0, 0, 90, 120, { fill: C.body, stroke: C.dark, width: 2 })
    b.circle(45, 38, 22, { fill: C.dark, stroke: C.gray, width: 2 })
    b.circle(45, 38, 8, { fill: C.panel, stroke: C.gray, width: 1 })
    b.circle(45, 88, 14, { fill: C.dark, stroke: C.gray, width: 2 })
    b.text(45, 124, 'Amp · DSP', { size: 11, color: C.ink, center: true })
  }),
]

/** The built-in automotive library (a fresh copy each time). */
export function automotiveLibrary(): LibraryCategory {
  return {
    id: AUTOMOTIVE_LIBRARY_ID,
    name: 'Automotive',
    source: 'builtin',
    installedAt: 0,
    items: structuredClone(ITEMS),
  }
}
