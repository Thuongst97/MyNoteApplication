/**
 * Built-in illustrated covers (public/covers/<id>.svg, made by scripts/make-covers.cjs).
 * A page stores one as "cover:<id>".
 */
export const COVER_TOPICS: Array<{ id: string; label: string; covers: Array<{ id: string; label: string }> }> = [
  {
    id: 'nature',
    label: 'Nature',
    covers: [
      { id: 'nature-mountains', label: 'Mountains at dawn' },
      { id: 'nature-forest', label: 'Pine forest' },
      { id: 'nature-ocean', label: 'Ocean' },
      { id: 'nature-dunes', label: 'Desert dunes' },
      { id: 'nature-sakura', label: 'Cherry blossom' },
    ],
  },
  {
    id: 'books',
    label: 'Books',
    covers: [
      { id: 'books-shelf', label: 'Bookshelf' },
      { id: 'books-open', label: 'Open book' },
      { id: 'books-notebook', label: 'Notebook' },
    ],
  },
  {
    id: 'tech',
    label: 'Technology',
    covers: [
      { id: 'tech-circuit', label: 'Circuit board' },
      { id: 'tech-network', label: 'Network' },
      { id: 'tech-code', label: 'Code' },
      { id: 'tech-grid', label: 'Neon grid' },
    ],
  },
  {
    id: 'space',
    label: 'Space',
    covers: [
      { id: 'space-stars', label: 'Milky Way' },
      { id: 'space-planet', label: 'Ringed planet' },
    ],
  },
  {
    id: 'city',
    label: 'City',
    covers: [
      { id: 'city-dusk', label: 'City at dusk' },
      { id: 'city-night', label: 'City at night' },
    ],
  },
  {
    id: 'abstract',
    label: 'Abstract',
    covers: [
      { id: 'abstract-waves', label: 'Waves' },
      { id: 'abstract-geometric', label: 'Geometric' },
      { id: 'abstract-bokeh', label: 'Bokeh' },
    ],
  },
]

const IDS = new Set(COVER_TOPICS.flatMap((t) => t.covers.map((c) => c.id)))

export const coverImageValue = (id: string) => `cover:${id}`

/** The image path of a stored "cover:<id>" value (null for anything else). */
export function coverImageUrl(value: string): string | null {
  const m = /^cover:([a-z]+-[a-z]+)$/.exec(value)
  return m && IDS.has(m[1]) ? `./covers/${m[1]}.svg` : null
}
