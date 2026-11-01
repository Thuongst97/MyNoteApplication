// Verifies that a built PremiumNote.exe carries the app icon (not Electron's).
// Usage: node scripts/verify-win-icon.cjs <path-to-exe> [more exes...]
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { NtExecutable, NtExecutableResource, Resource, Data } = require('resedit')

const sha = (b) => crypto.createHash('sha256').update(Buffer.from(b)).digest('hex').slice(0, 16)
const ico = Data.IconFile.from(fs.readFileSync(path.join(__dirname, '..', 'resources', 'icon.ico')))
const expected = ico.icons.map((i) => sha(i.data.bin ?? i.data.generate()))

let failed = false
for (const exe of process.argv.slice(2)) {
  const res = NtExecutableResource.from(NtExecutable.from(fs.readFileSync(exe)))
  const groups = Resource.IconGroupEntry.fromEntries(res.entries)
  const icons = res.entries.filter((e) => e.type === 3)
  const main = groups.find((g) => g.id === 1) ?? groups[0]
  const actual = main ? main.icons.map((i) => sha(icons.find((e) => e.id === i.iconID)?.bin ?? new ArrayBuffer(0))) : []
  const ok = groups.length === 1 && actual.length === expected.length && actual.every((h, i) => h === expected[i])
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${exe}: ${groups.length} icon group(s), ${actual.length} frame(s) [${main?.icons.map((i) => (i.width || 256) + 'px').join(' ')}]`)
  if (!ok) {
    failed = true
    console.log('  expected', expected.join(' '))
    console.log('  actual  ', actual.join(' '))
  }
}
process.exit(failed ? 1 : 0)
