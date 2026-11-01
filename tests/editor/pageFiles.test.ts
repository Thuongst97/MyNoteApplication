import { describe, expect, it } from 'vitest'
import { markdownToPage } from '@/components/Editor/pageFiles'

describe('Markdown import', () => {
  it('uses the first # heading as the title and converts the rest to blocks', () => {
    const { title, content } = markdownToPage('notes', '\n# Weekly review\n\nSome **bold** text\n\n- [x] done\n- [ ] todo\n\n| a | b |\n| - | - |\n| 1 | 2 |\n')
    expect(title).toBe('Weekly review')
    const types = (content.content ?? []).map((n) => n.type)
    expect(types).toEqual(['paragraph', 'taskList', 'table'])
  })

  it('falls back to the file name', () => {
    const { title, content } = markdownToPage('My file', '## Section\n\ntext')
    expect(title).toBe('My file')
    expect(content.content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 2 } })
  })
})
