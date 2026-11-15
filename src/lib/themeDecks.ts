import type { JSONContent } from '@tiptap/react'
import { newBox, newSlide, type FooterSettings, type PresentationContent, type SlideData } from './presentation'
import type { SlideTheme } from './slideThemes'

/** Sample content of each theme's starter deck (general business and tech topics). */
const TOPICS: Record<string, { agenda: string[]; headline: string; kpis: Array<[string, string, string]>; chart: { eyebrow: string; title: string; text: string; series: string; labels: string[]; values: number[]; unit: string } }> = {
  product: {
    agenda: ['Vision — one product, every device', 'What ships this year', 'What customers told us', 'Roadmap — the next four quarters'],
    headline: 'One product, loved everywhere.',
    kpis: [['2.4 M', 'Monthly active users', '+38% YoY'], ['4.8★', 'Average app rating', '12k reviews'], ['99.95%', 'Service uptime', 'Last 12 months']],
    chart: { eyebrow: 'Adoption', title: 'More people, every quarter.', text: 'Monthly active users, in millions.', series: 'Active users (M)', labels: ["Q1 '25", 'Q2', 'Q3', 'Q4', "Q1 '26", 'Q2', 'Q3'], values: [1.1, 1.3, 1.5, 1.7, 1.9, 2.2, 2.4], unit: ' M' },
  },
  design: {
    agenda: ['Design language — color, type and motion', 'Navigation — calm and focused', 'Accessibility — for everyone', 'Design system — shared components'],
    headline: 'An interface that feels effortless.',
    kpis: [['4.7★', 'Satisfaction with the new design', '+0.6 vs. previous'], ['−42%', 'Clicks to common tasks', 'Usability study'], ['64', 'Components in the design system', 'Web and mobile']],
    chart: { eyebrow: 'Satisfaction', title: 'Every release, a calmer experience.', text: 'Satisfaction score in user surveys.', series: 'Satisfaction score', labels: ["Q1 '25", 'Q2', 'Q3', 'Q4', "Q1 '26", 'Q2', 'Q3'], values: [71, 73, 76, 78, 81, 84, 88], unit: '' },
  },
  release: {
    agenda: ['What’s new in 4.2', 'Performance — start-up and scrolling', 'Integrations — calendar and chat', 'Quality — crashes and support tickets'],
    headline: 'Faster, smoother, better connected.',
    kpis: [['1.2 s', 'App start time', '−38% vs 4.0'], ['60 fps', 'Scrolling on every screen', 'New rendering'], ['−54%', 'Crash rate', 'vs. version 4.0']],
    chart: { eyebrow: 'Start time', title: 'Every release starts faster.', text: 'Seconds from tap to the home screen.', series: 'Start time (s)', labels: ['3.6', '3.8', '4.0', '4.1', '4.2β', '4.2'], values: [2.4, 2.2, 1.9, 1.7, 1.4, 1.2], unit: ' s' },
  },
  growth: {
    agenda: ['Where we are', 'Revenue and customers', 'Performance and efficiency', 'Plan for next year'],
    headline: 'Growing fast, and efficiently.',
    kpis: [['$12.4 M', 'Annual recurring revenue', '+31% YoY'], ['14 ms', 'P95 response time', 'Target met'], ['−18%', 'Cloud cost per user', 'Since Q1']],
    chart: { eyebrow: 'Revenue', title: 'Steady growth, quarter after quarter.', text: 'Annual recurring revenue, in millions of dollars.', series: 'ARR ($M)', labels: ["Q1 '25", 'Q2', 'Q3', 'Q4', "Q1 '26", 'Q2', 'Q3'], values: [7.2, 7.9, 8.6, 9.5, 10.4, 11.3, 12.4], unit: ' M' },
  },
  launch: {
    agenda: ['Scope — what we tested', 'Beta — 12,000 testers', 'Results and open issues', 'Go / no-go decision'],
    headline: 'Ready for launch.',
    kpis: [['99.95%', 'Uptime during the beta', 'Target 99.9%'], ['12,000', 'Beta testers', '14 countries'], ['0', 'Open critical issues', 'Security reviewed']],
    chart: { eyebrow: 'Bugs', title: 'Issues closed ahead of plan.', text: 'Open bugs during the beta.', series: 'Open bugs', labels: ['W1', 'W3', 'W5', 'W7', 'W9', 'W11', 'W13'], values: [142, 120, 96, 71, 44, 21, 6], unit: '' },
  },
  migration: {
    agenda: ['Why we are moving', 'Migration status', 'Data and security', 'Next steps'],
    headline: 'Moving to the cloud, service by service.',
    kpis: [['27/32', 'Services migrated', '84% done'], ['412', 'APIs documented', 'Shared catalog'], ['−35%', 'Infrastructure cost', 'Year to date']],
    chart: { eyebrow: 'Migration', title: 'Services moved per sprint.', text: 'Services running in the cloud at the end of each sprint.', series: 'Services migrated', labels: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'], values: [3, 6, 10, 15, 19, 24, 27], unit: '' },
  },
  ai: {
    agenda: ['AI assistant', 'Smart search', 'Automation', 'Responsible AI & privacy'],
    headline: 'Intelligence that saves everyone time.',
    kpis: [['180 ms', 'Assistant response time', 'Runs on device'], ['97%', 'Answer accuracy', 'Internal benchmark'], ['−23%', 'Time on routine tasks', 'Pilot teams']],
    chart: { eyebrow: 'Assistant usage', title: 'People rely on it every day.', text: 'Weekly assistant requests per active user.', series: 'Requests per user / week', labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'], values: [4.1, 5.0, 6.2, 7.9, 9.4, 11.2, 12.6], unit: '' },
  },
}

const text = (t: string): JSONContent[] => (t ? [{ type: 'text', text: t }] : [])
const h = (level: number, t: string): JSONContent => ({ type: 'heading', attrs: { level }, content: text(t) })
const p = (t: string): JSONContent => ({ type: 'paragraph', content: text(t) })
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })

/** A theme's starter deck: title, agenda, key numbers, chart and closing slides. */
export function starterDeck(theme: SlideTheme): SlideData[] {
  const topic = TOPICS[theme.deck.topic] ?? TOPICS.product
  const title = newSlide('title')
  title.content = doc(h(4, theme.deck.eyebrow), h(1, theme.deck.title), p(theme.deck.sub))
  // Upper part of the slide (the theme's artwork owns the lower right / horizon).
  // Narrower titles where the artwork sits on the right.
  const narrow = ['aurora', 'neural', 'glacier', 'lumen'].includes(theme.id)
  const medium = ['carbon', 'ivory', 'studio'].includes(theme.id)
  title.frame = { x: 96, y: 96, w: narrow ? 660 : medium ? 820 : 980, h: 380 }

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
  end.content = doc(h(4, 'Thank you'), h(1, 'Questions?'), p('Product team · November 2026'))
  end.frame = { x: 96, y: 96, w: 760, h: 380 }

  return [title, agenda, kpi, chart, end]
}

/** Footer used by starter decks: deck title and slide numbers (not on title slides). */
export const starterFooter = (theme: SlideTheme): FooterSettings => ({ slideNumbers: true, text: theme.deck.title.replace(/‑/g, '-'), hideOnTitle: true })

/** A whole new themed presentation. */
export function themedPresentation(theme: SlideTheme): PresentationContent {
  return { type: 'slides', slides: starterDeck(theme), theme: theme.id, footer: starterFooter(theme) }
}
