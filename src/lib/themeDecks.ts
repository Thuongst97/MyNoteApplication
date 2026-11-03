import type { JSONContent } from '@tiptap/react'
import { newBox, newSlide, type FooterSettings, type PresentationContent, type SlideData } from './presentation'
import type { SlideTheme } from './slideThemes'

/** Sample content of each theme's starter deck (automotive & tech topics). */
const TOPICS: Record<string, { agenda: string[]; headline: string; kpis: Array<[string, string, string]>; chart: { eyebrow: string; title: string; text: string; series: string; labels: string[]; values: number[]; unit: string } }> = {
  platform: {
    agenda: ['Platform — one OS stack, monthly OTA', 'Digital cluster — 12.3″ · 60 fps', 'Head unit — AVN 4.2 · AAOS 14', 'Telematics — 5G TCU · eCall · V2X'],
    headline: 'A faster, longer-range, always-connected car.',
    kpis: [['3.8 s', 'Cold boot to home screen', '−38% vs 4.0'], ['612 km', 'WLTP range, 800 V pack', '+12% YoY'], ['99.95%', 'Telematics fleet uptime', 'Oct 2026']],
    chart: { eyebrow: 'OTA adoption', title: 'Updates reach the fleet faster.', text: 'Share of cars on the latest release 30 days after launch.', series: 'Fleet on latest release', labels: ["Q1 '25", 'Q2', 'Q3', 'Q4', "Q1 '26", 'Q2', 'Q3'], values: [41, 48, 55, 63, 71, 80, 87], unit: '%' },
  },
  cockpit: {
    agenda: ['Design language — materials & light', 'Cluster — calm, focused, adaptive', 'Head unit — one-touch comfort', 'Ambient light — synced to drive mode'],
    headline: 'A cockpit that feels effortless.',
    kpis: [['4.7★', 'Customer rating of the new UI', '+0.6 vs. previous'], ['−42%', 'Taps to common actions', 'Climate & seats'], ['64', 'Ambient light colors', 'Synced to drive mode']],
    chart: { eyebrow: 'Satisfaction', title: 'Every release, a calmer cabin.', text: 'Cockpit satisfaction score in owner surveys.', series: 'Satisfaction score', labels: ["Q1 '25", 'Q2', 'Q3', 'Q4', "Q1 '26", 'Q2', 'Q3'], values: [71, 73, 76, 78, 81, 84, 88], unit: '' },
  },
  headunit: {
    agenda: ['What’s new in 4.2', 'Performance — boot & navigation', 'Connectivity — wireless projection', 'Quality — defects & field data'],
    headline: 'Faster, smoother, more connected.',
    kpis: [['3.8 s', 'Cold boot to home screen', '−38% vs 4.0'], ['60 fps', 'Map & list scrolling', 'GPU pipeline rework'], ['−54%', 'Field defects per 1k cars', 'vs. release 4.0']],
    chart: { eyebrow: 'Boot time', title: 'Every release starts faster.', text: 'Seconds from ignition to the home screen.', series: 'Boot time (s)', labels: ['3.6', '3.8', '4.0', '4.1', '4.2β', '4.2'], values: [7.4, 6.6, 6.1, 5.2, 4.4, 3.8], unit: ' s' },
  },
  cluster: {
    agenda: ['Digital cluster 2027', 'Rendering — 60 fps, ASIL-B', 'EV range & efficiency', 'Roadmap'],
    headline: 'More range, rendered beautifully.',
    kpis: [['612 km', 'WLTP range, 800 V pack', '+12% YoY'], ['14 ms', 'P95 frame time', '60 fps target met'], ['1.4 s', 'Boot to telltales', 'Safety requirement < 2 s']],
    chart: { eyebrow: 'EV range', title: 'Every update adds range.', text: 'Thermal pre-conditioning and new cell chemistry added 132 km, delivered over the air.', series: 'WLTP range (km)', labels: ["Q1 '25", 'Q2', 'Q3', 'Q4', "Q1 '26", 'Q2', 'Q3'], values: [480, 505, 520, 548, 560, 588, 612], unit: ' km' },
  },
  telematics: {
    agenda: ['Scope — 5G TCU, eCall, OTA', 'Test campaign — 1.2 M km', 'Results & open issues', 'Release decision'],
    headline: 'Validated for launch.',
    kpis: [['99.95%', 'Fleet connectivity uptime', 'Target 99.9%'], ['1.2 M', 'Test kilometres', '14 countries'], ['0', 'Open safety issues', 'eCall certified']],
    chart: { eyebrow: 'Defects', title: 'Issues closed ahead of plan.', text: 'Open defects during the validation campaign.', series: 'Open defects', labels: ['W1', 'W3', 'W5', 'W7', 'W9', 'W11', 'W13'], values: [142, 120, 96, 71, 44, 21, 6], unit: '' },
  },
  android: {
    agenda: ['Why AAOS 14', 'Migration status', 'Vehicle HAL & car services', 'Next steps'],
    headline: 'The head unit is moving to Android.',
    kpis: [['27/32', 'Apps running natively', '84% done'], ['412', 'Vehicle HAL properties mapped', 'Climate, seats, ADAS'], ['GAS', 'Google services certified', 'Maps · Assistant · Play']],
    chart: { eyebrow: 'Migration', title: 'Apps ported per sprint.', text: 'In-house apps running natively on AAOS 14.', series: 'Apps on AAOS', labels: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'], values: [3, 6, 10, 15, 19, 24, 27], unit: '' },
  },
  ai: {
    agenda: ['On-device assistant', 'Driver monitoring', 'Predictive maintenance', 'Responsible AI & privacy'],
    headline: 'Intelligence that stays in the car.',
    kpis: [['180 ms', 'Assistant response, on device', 'No cloud round-trip'], ['97%', 'Drowsiness detection accuracy', 'Euro NCAP DMS'], ['−23%', 'Unplanned workshop visits', 'Predictive maintenance']],
    chart: { eyebrow: 'Assistant usage', title: 'Drivers talk to their car.', text: 'Weekly assistant requests per active car after the on-device model update.', series: 'Requests per car / week', labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'], values: [4.1, 5.0, 6.2, 7.9, 9.4, 11.2, 12.6], unit: '' },
  },
}

const text = (t: string): JSONContent[] => (t ? [{ type: 'text', text: t }] : [])
const h = (level: number, t: string): JSONContent => ({ type: 'heading', attrs: { level }, content: text(t) })
const p = (t: string): JSONContent => ({ type: 'paragraph', content: text(t) })
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })

/** A theme's starter deck: title, agenda, key numbers, chart and closing slides. */
export function starterDeck(theme: SlideTheme): SlideData[] {
  const topic = TOPICS[theme.deck.topic] ?? TOPICS.platform
  const title = newSlide('title')
  title.content = doc(h(4, theme.deck.eyebrow), h(1, theme.deck.title), p(theme.deck.sub))
  // Upper part of the slide (the theme's artwork owns the lower right / horizon).
  title.frame = { x: 96, y: 96, w: theme.id === 'aurora' || theme.id === 'neural' ? 660 : theme.id === 'carbon' ? 820 : 980, h: 380 }

  const agenda = newSlide('content')
  agenda.content = doc(h(4, 'Agenda'), h(2, 'Today'))
  agenda.frame = { x: 96, y: 96, w: 360, h: 480 }
  agenda.boxes = [newBox({ x: 520, y: 110, w: 664 }, { type: 'doc', content: [{ type: 'orderedList', content: topic.agenda.map((a) => ({ type: 'listItem', content: [p(a)] })) }] })]

  const kpi = newSlide('content')
  kpi.content = doc(
    h(4, 'Results'),
    h(2, topic.headline),
    {
      type: 'columns',
      content: topic.kpis.map(([v, label, delta]) => ({ type: 'column', content: [h(1, v), p(label), h(4, delta)] })),
    },
  )
  kpi.frame = { x: 96, y: 96, w: 1088, h: 500 }

  const chart = newSlide('content')
  chart.content = doc(h(4, topic.chart.eyebrow), h(2, topic.chart.title), p(topic.chart.text))
  chart.frame = { x: 96, y: 96, w: 380, h: 500 }
  chart.boxes = [
    newBox(
      { x: 520, y: 120, w: 664 },
      {
        type: 'doc',
        content: [
          {
            type: 'chart',
            attrs: {
              spec: {
                type: 'area',
                title: '',
                labels: topic.chart.labels,
                series: [{ name: topic.chart.series, values: topic.chart.values }],
                border: false,
                seriesColors: [theme.accent],
                format: { legend: 'none', smooth: true, gridlines: true, dataLabels: false, height: 'large' },
              },
            },
          },
        ],
      },
    ),
  ]

  const end = newSlide('title')
  end.content = doc(h(4, 'Thank you'), h(1, 'Questions?'), p('Automotive Software · November 2026'))
  end.frame = { x: 96, y: 96, w: 760, h: 380 }

  return [title, agenda, kpi, chart, end]
}

/** Footer used by starter decks: deck title and slide numbers (not on title slides). */
export const starterFooter = (theme: SlideTheme): FooterSettings => ({ slideNumbers: true, text: theme.deck.title.replace(/‑/g, '-'), hideOnTitle: true })

/** A whole new themed presentation. */
export function themedPresentation(theme: SlideTheme): PresentationContent {
  return { type: 'slides', slides: starterDeck(theme), theme: theme.id, footer: starterFooter(theme) }
}
