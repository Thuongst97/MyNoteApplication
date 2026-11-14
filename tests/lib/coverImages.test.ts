import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { COVER_TOPICS, coverImageUrl, coverImageValue } from '@/lib/coverImages'
import { cleanCover, coverToCss } from '@/lib/pageMeta'

describe('illustrated covers', () => {
  it('has covers for nature, books, technology, space, city and abstract — each file exists', () => {
    expect(COVER_TOPICS.map((t) => t.id)).toEqual(['nature', 'books', 'tech', 'space', 'city', 'abstract'])
    const ids = COVER_TOPICS.flatMap((t) => t.covers.map((c) => c.id))
    expect(ids.length).toBeGreaterThanOrEqual(18)
    for (const id of ids) {
      const file = path.join(__dirname, '../../public/covers', `${id}.svg`)
      expect(fs.existsSync(file), id).toBe(true)
      expect(fs.readFileSync(file, 'utf8')).not.toMatch(/<script|on\w+=|href=|xlink/i)
    }
  })
  it('stores a cover as "cover:<id>" and draws it from the bundled file', () => {
    const v = coverImageValue('nature-forest')
    expect(v).toBe('cover:nature-forest')
    expect(coverImageUrl(v)).toBe('./covers/nature-forest.svg')
    expect(coverToCss(v)).toBe('center / cover no-repeat url("./covers/nature-forest.svg")')
    expect(cleanCover(v)).toBe(v)
  })
  it('ignores unknown or unsafe cover names', () => {
    for (const bad of ['cover:nope-nope', 'cover:../x', 'cover:nature-forest"', 'cover:']) {
      expect(coverImageUrl(bad)).toBeNull()
      expect(cleanCover(bad)).toBeNull()
    }
  })
})
