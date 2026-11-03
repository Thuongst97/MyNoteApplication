import { describe, expect, it } from 'vitest'
import { codeClickRange } from '@/components/Editor/code/codeClicks'

const code = 'const max_speed = getSpeed($vehicle);\nif (max_speed > 120) {\n    warn("fast");\n}'
const pick = (offset: number, count: number) => {
  const r = codeClickRange(code, offset, count)
  return r ? code.slice(r.from, r.to) : null
}
const at = (s: string, k = 0) => code.indexOf(s) + k

describe('code block click selection (like VS Code)', () => {
  it('double click: whole word with _ and $, no trailing space', () => {
    expect(pick(at('max_speed', 4), 2)).toBe('max_speed')
    expect(pick(at('$vehicle', 3), 2)).toBe('$vehicle')
    expect(pick(at('getSpeed'), 2)).toBe('getSpeed')
    expect(pick(at('120', 2), 2)).toBe('120')
  })

  it('double click on spaces or symbols selects that run', () => {
    expect(pick(at('    warn', 1), 2)).toBe('    ')
    expect(pick(at('($v'), 2)).toBe('(')
    expect(pick(at(');'), 2)).toBe(');')
    expect(pick(at(' > ', 1), 2)).toBe('>')
  })

  it('double click right after the last character of a line takes that word', () => {
    expect(pick(code.indexOf('\n'), 2)).toBe(');')
    expect(pick(code.length, 2)).toBe('}')
  })

  it('triple click: the line with its line break (the last line has none)', () => {
    expect(pick(at('warn'), 3)).toBe('    warn("fast");\n')
    expect(pick(0, 3)).toBe('const max_speed = getSpeed($vehicle);\n')
    expect(pick(code.length - 1, 3)).toBe('}')
  })

  it('four or more clicks: all the code', () => {
    expect(pick(at('120'), 4)).toBe(code)
    expect(pick(3, 7)).toBe(code)
  })

  it('single clicks and empty code are left to the editor', () => {
    expect(codeClickRange(code, 3, 1)).toBeNull()
    expect(codeClickRange('', 0, 2)).toBeNull()
    expect(codeClickRange('a\n\nb', 2, 2)).toEqual({ from: 2, to: 2 })
  })
})
