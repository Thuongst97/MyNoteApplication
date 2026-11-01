const { chromium } = require('playwright')
const quads = [
  { id: 'do', title: 'Do first', hint: 'Important & urgent', color: '#DC2626', tasks: [
    { t: 'check app', note: 'dfasdasdasd' }, { t: 'sda' }, { t: 'ădawwsdas' }, { t: 'ád', done: true } ] },
  { id: 'schedule', title: 'Schedule', hint: 'Important, not urgent', color: '#2563EB', tasks: [] },
  { id: 'delegate', title: 'Delegate', hint: 'Urgent, not important', color: '#B7791F', tasks: [] },
  { id: 'eliminate', title: 'Eliminate', hint: 'Neither — let it go', color: '#6B7280', tasks: [] },
]
const card = (q) => `
<section class="card">
  <header>
    <span class="dot" style="background:${q.color};box-shadow:0 0 0 3px ${q.color}26"></span>
    <h2>${q.title}</h2><span class="hint">${q.hint}</span>
    <span class="count">${q.tasks.filter((t) => !t.done).length}</span>
  </header>
  <ul>
    ${q.tasks.map((t) => `<li class="${t.done ? 'done' : ''}">
      <span class="check" style="${t.done ? `background:${q.color};border-color:${q.color}` : ''}">${t.done ? '<svg viewBox="0 0 16 16"><path d="M4 8.5l2.5 2.5L12 5.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}</span>
      <div class="tx"><div class="tt">${t.t}</div>${t.note ? `<div class="note">${t.note}</div>` : ''}</div></li>`).join('')}
    ${q.tasks.length === 0 ? '<li class="empty">Clear. Keep it that way.</li>' : ''}
  </ul>
  <div class="add">+&nbsp; Add task</div>
</section>`
const html = `<!doctype html><html><head><style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:1240px;height:900px;background:#F7F5F0;font-family:Inter,sans-serif;color:#111827;padding:26px 30px;-webkit-font-smoothing:antialiased}
.top{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:26px}
.eyebrow{font-size:11px;letter-spacing:.3em;font-weight:700;color:#8A6416;margin-bottom:10px}
h1{font-family:'Inter Display',Inter;font-weight:700;font-size:42px;letter-spacing:-.03em;line-height:1;color:#111827}
.sub{margin-top:12px;font-size:13.5px;color:#6B7280}.sub b{color:#111827;font-weight:600}
.actions{display:flex;gap:10px}
.pill{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:500;color:#374151;padding:9px 15px;border-radius:12px;border:1px solid #D1D5DB;background:#FFFFFF;box-shadow:0 1px 2px rgba(17,24,39,.06)}
.pill svg{width:15px;height:15px}
.gold{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;color:#1F1606;padding:9px 16px;border-radius:12px;background:linear-gradient(180deg,#E2B85A,#C08A2E);border:1px solid #A9761F;box-shadow:0 1px 2px rgba(17,24,39,.12),inset 0 1px 0 rgba(255,255,255,.35)}
.grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:18px;height:706px}
.card{background:#FFFFFF;border:1px solid #E5E1D8;border-radius:18px;padding:18px 20px 14px;display:flex;flex-direction:column;box-shadow:0 1px 2px rgba(17,24,39,.05),0 4px 14px -6px rgba(17,24,39,.08)}
header{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.dot{width:9px;height:9px;border-radius:50%}
h2{font-size:17px;font-weight:650;letter-spacing:-.01em;color:#111827}
.hint{font-size:12.5px;color:#6B7280;flex:1}
.count{font-size:12px;font-weight:600;color:#374151;background:#F3F4F6;border:1px solid #E5E7EB;border-radius:8px;padding:2px 9px}
ul{list-style:none;flex:1;display:flex;flex-direction:column;gap:8px}
li{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:12px;background:#FFFFFF;border:1px solid #E5E7EB}
.check{width:18px;height:18px;border-radius:5px;border:1.5px solid #9CA3AF;background:#fff;flex:none;display:flex;align-items:center;justify-content:center}
li.done{border-color:transparent;background:transparent}
li.done .tt{color:#9CA3AF;text-decoration:line-through}
.tx{flex:1}.tt{font-size:14.5px;font-weight:500;color:#111827}.note{font-size:12.5px;color:#6B7280;margin-top:2px}
.empty{justify-content:center;padding:26px;background:#FAFAF9;border:1px solid #E5E7EB;color:#6B7280;font-size:13.5px}
.add{font-size:13px;font-weight:500;color:#6B7280;padding:10px 2px 0}
</style></head><body>
<div class="top">
  <div><div class="eyebrow">FOCUS</div><h1>Tasks</h1><div class="sub"><b>3 open</b> · Eisenhower matrix</div></div>
  <div class="actions">
    <span class="pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.7 5.1A10 10 0 0 1 12 5c7 0 10 7 10 7a13 13 0 0 1-1.7 2.7M6.6 6.6A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.4-1.6M2 2l20 20M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>Hide completed</span>
    <span class="pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 7h-9M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>Reminders</span>
    <span class="gold">+&nbsp; New task</span>
  </div>
</div>
<div class="grid">${quads.map(card).join('')}</div>
</body></html>`
;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 2 })
  await p.setContent(html, { waitUntil: 'load' })
  await p.evaluate(() => document.fonts.ready)
  await p.screenshot({ path: 'B-onyx-light-refined.png' })
  await b.close()
})()
