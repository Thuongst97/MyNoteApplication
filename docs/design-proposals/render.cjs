const { chromium } = require('playwright')
const { quadrants } = require('./data.cjs')
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const open = quadrants.reduce((n, q) => n + q.tasks.filter((t) => !t.done).length, 0)

/* ---------------- A · Ivory & Champagne ---------------- */
function A() {
  const accent = { do: '#A64B55', schedule: '#3D5A87', delegate: '#A7823E', eliminate: '#8A8279' }
  const card = (q) => `
  <section class="card">
    <div class="rule" style="background:linear-gradient(90deg, ${accent[q.id]} 0, ${accent[q.id]} 36px, #E9DFCF 36px)"></div>
    <header>
      <div class="numeral" style="color:${accent[q.id]}">${q.n}</div>
      <div class="ht">
        <h2>${q.title}</h2>
        <p>${q.hint}</p>
      </div>
      <div class="count">${String(q.tasks.filter((t) => !t.done).length).padStart(2, '0')}</div>
    </header>
    <ul>
      ${q.tasks.map((t) => `
      <li class="${t.done ? 'done' : ''}">
        <span class="check">${t.done ? '<svg viewBox="0 0 16 16"><path d="M4 8.5l2.5 2.5L12 5.5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}</span>
        <div class="tx"><div class="tt">${esc(t.t)}</div>${t.note ? `<div class="note">${esc(t.note)}</div>` : ''}</div>
        ${t.meta ? `<span class="meta ${t.state || ''}">${esc(t.meta)}</span>` : ''}
      </li>`).join('')}
      ${q.tasks.length === 0 ? '<li class="empty">Nothing here — beautifully empty.</li>' : ''}
    </ul>
    <button class="add">+&nbsp;&nbsp;Add a task</button>
  </section>`
  return `<!doctype html><html><head><style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:1280px;height:880px;background:#FBF8F2;font-family:Inter,sans-serif;color:#2B2621;padding:44px 56px}
  .top{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:30px}
  .eyebrow{font-size:11px;letter-spacing:.32em;color:#A7823E;font-weight:600;margin-bottom:10px}
  h1{font-family:Caladea,'Bitstream Charter',Georgia,serif;font-weight:400;font-size:46px;letter-spacing:-.01em;line-height:1}
  .sub{margin-top:10px;font-size:14px;color:#8A8074}
  .sub b{color:#2B2621;font-weight:500}
  .actions{display:flex;gap:10px}
  .pill{font-size:13px;color:#5C544B;padding:9px 16px;border-radius:999px;border:1px solid #E6DCCB;background:#FFFDF9}
  .pill.gold{background:#2B2621;color:#F3E6C9;border-color:#2B2621}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}
  .card{background:#FFFFFF;border:1px solid #EFE6D8;border-radius:22px;padding:22px 26px 18px;box-shadow:0 1px 0 rgba(255,255,255,.8) inset,0 18px 40px -24px rgba(80,60,30,.18);min-height:318px;display:flex;flex-direction:column;position:relative;overflow:hidden}
  .rule{position:absolute;left:26px;right:26px;top:0;height:2px;border-radius:2px}
  header{display:flex;align-items:center;gap:16px;margin:8px 0 14px}
  .numeral{font-family:Caladea,Georgia,serif;font-size:30px;width:34px;text-align:center}
  .ht{flex:1}
  h2{font-family:Caladea,Georgia,serif;font-weight:400;font-size:23px;letter-spacing:.005em}
  .ht p{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#A39886;margin-top:3px}
  .count{font-family:Caladea,Georgia,serif;font-size:22px;color:#C7B9A2}
  ul{list-style:none;flex:1}
  li{display:flex;align-items:center;gap:14px;padding:12px 2px;border-top:1px solid #F3EDE3}
  li:first-child{border-top:none}
  .check{width:18px;height:18px;border-radius:50%;border:1.5px solid #CDBB97;flex:none;display:flex;align-items:center;justify-content:center}
  li.done .check{background:#A7823E;border-color:#A7823E}
  li.done .tt{color:#B9AE9E;text-decoration:line-through;text-decoration-color:#D8CDB9}
  .tx{flex:1}
  .tt{font-size:15px;color:#2B2621}
  .note{font-size:12.5px;color:#A39886;margin-top:2px}
  .meta{font-size:12px;color:#8A8074;letter-spacing:.02em;white-space:nowrap}
  .meta.soon{color:#A7823E}
  .meta.overdue{color:#A64B55}
  .empty{color:#B9AE9E;font-family:Caladea,Georgia,serif;font-style:italic;font-size:15px;justify-content:center;padding-top:40px;border:none}
  .add{border:none;background:none;text-align:left;font:inherit;font-size:13px;color:#A39886;letter-spacing:.04em;padding:8px 2px 0}
  .axis{position:absolute;font-size:10px;letter-spacing:.34em;color:#C2B49C}
  </style></head><body>
  <div class="top">
    <div><div class="eyebrow">PRIORITIES</div><h1>Tasks</h1><div class="sub"><b>${open} open</b> · 1 overdue · Eisenhower matrix</div></div>
    <div class="actions"><span class="pill">Hide completed</span><span class="pill">Reminders</span><span class="pill gold">+ New task</span></div>
  </div>
  <div class="grid">${quadrants.map(card).join('')}</div>
  </body></html>`
}

/* ---------------- B · Midnight Onyx ---------------- */
function B() {
  const accent = { do: '#E07A7A', schedule: '#7FA6E0', delegate: '#D9B97A', eliminate: '#8E939C' }
  const card = (q) => `
  <section class="card">
    <div class="glow" style="background:radial-gradient(600px 160px at 0% 0%, ${accent[q.id]}22, transparent 60%)"></div>
    <header>
      <span class="dot" style="background:${accent[q.id]};box-shadow:0 0 0 4px ${accent[q.id]}22, 0 0 18px ${accent[q.id]}66"></span>
      <h2>${q.title}</h2>
      <span class="hint">${q.hint}</span>
      <span class="count">${q.tasks.filter((t) => !t.done).length}</span>
    </header>
    <ul>
      ${q.tasks.map((t) => `
      <li class="${t.done ? 'done' : ''}">
        <span class="check" style="${t.done ? `background:${accent[q.id]};border-color:${accent[q.id]}` : ''}">${t.done ? '<svg viewBox="0 0 16 16"><path d="M4 8.5l2.5 2.5L12 5.5" fill="none" stroke="#0E0F13" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}</span>
        <div class="tx"><div class="tt">${esc(t.t)}</div>${t.note ? `<div class="note">${esc(t.note)}</div>` : ''}</div>
        ${t.meta ? `<span class="meta ${t.state || ''}">${esc(t.meta)}</span>` : ''}
      </li>`).join('')}
      ${q.tasks.length === 0 ? '<li class="empty">Clear. Keep it that way.</li>' : ''}
    </ul>
    <button class="add">+ Add task</button>
  </section>`
  return `<!doctype html><html><head><style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:1280px;height:880px;font-family:Inter,sans-serif;color:#ECE7DD;padding:44px 56px;
    background:radial-gradient(900px 500px at 85% -10%, rgba(217,185,122,.10), transparent 60%), radial-gradient(800px 600px at -10% 110%, rgba(127,166,224,.08), transparent 60%), #0E0F13}
  .top{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:30px}
  .eyebrow{font-size:11px;letter-spacing:.32em;color:#D9B97A;font-weight:600;margin-bottom:12px}
  h1{font-family:'Inter Display',Inter;font-weight:600;font-size:44px;letter-spacing:-.025em;line-height:1;
     background:linear-gradient(180deg,#FFFFFF,#CFC6B6);-webkit-background-clip:text;color:transparent}
  .sub{margin-top:12px;font-size:14px;color:#8D8A85}
  .sub b{color:#ECE7DD;font-weight:500}.sub .od{color:#E07A7A}
  .actions{display:flex;gap:10px}
  .pill{font-size:13px;color:#BDB7AC;padding:9px 16px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)}
  .pill.gold{background:linear-gradient(180deg,#E6CC94,#C9A563);color:#1A1712;border:none;font-weight:600}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  .card{position:relative;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.07);border-radius:20px;padding:20px 22px 16px;min-height:322px;display:flex;flex-direction:column;box-shadow:0 30px 60px -30px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.05)}
  .glow{position:absolute;inset:0;pointer-events:none}
  header{position:relative;display:flex;align-items:center;gap:12px;margin-bottom:14px}
  .dot{width:8px;height:8px;border-radius:50%}
  h2{font-size:17px;font-weight:600;letter-spacing:-.01em}
  .hint{font-size:12.5px;color:#7E7B76;flex:1}
  .count{font-size:12px;color:#BDB7AC;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:2px 8px}
  ul{position:relative;list-style:none;flex:1;display:flex;flex-direction:column;gap:8px}
  li{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.05)}
  .check{width:18px;height:18px;border-radius:6px;border:1.5px solid rgba(255,255,255,.25);flex:none;display:flex;align-items:center;justify-content:center}
  li.done{background:transparent;border-color:transparent}
  li.done .tt{color:#6D6A65;text-decoration:line-through}
  .tx{flex:1}.tt{font-size:14.5px}.note{font-size:12.5px;color:#7E7B76;margin-top:2px}
  .meta{font-size:12px;color:#9C978E;white-space:nowrap}
  .meta.soon{color:#D9B97A}.meta.overdue{color:#E07A7A}
  .empty{background:none;border:1px dashed rgba(255,255,255,.08);color:#6D6A65;justify-content:center;padding:28px;font-size:13.5px}
  .add{position:relative;border:none;background:none;text-align:left;font:inherit;font-size:13px;color:#8D8A85;padding:12px 4px 0}
  </style></head><body>
  <div class="top">
    <div><div class="eyebrow">FOCUS</div><h1>Tasks</h1><div class="sub"><b>${open} open</b> · <span class="od">1 overdue</span> · Eisenhower matrix</div></div>
    <div class="actions"><span class="pill">Hide completed</span><span class="pill">Reminders</span><span class="pill gold">+ New task</span></div>
  </div>
  <div class="grid">${quadrants.map(card).join('')}</div>
  </body></html>`
}

/* ---------------- C · Gallery (editorial minimal) ---------------- */
function C() {
  const accent = { do: '#C2410C', schedule: '#1D4ED8', delegate: '#A16207', eliminate: '#6B7280' }
  const cell = (q, i) => `
  <section class="cell c${i}">
    <div class="num">${q.num}</div>
    <header>
      <h2><span class="bar" style="background:${accent[q.id]}"></span>${q.title}</h2>
      <p>${q.hint}</p>
    </header>
    <ul>
      ${q.tasks.map((t) => `
      <li class="${t.done ? 'done' : ''}">
        <span class="check">${t.done ? '<svg viewBox="0 0 16 16"><path d="M4 8.5l2.5 2.5L12 5.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}</span>
        <div class="tx"><span class="tt">${esc(t.t)}</span>${t.note ? `<span class="note">— ${esc(t.note)}</span>` : ''}</div>
        ${t.meta ? `<span class="meta ${t.state || ''}">${esc(t.meta)}</span>` : ''}
      </li>`).join('')}
      ${q.tasks.length === 0 ? '<li class="empty">No tasks</li>' : ''}
      <li class="add">New task</li>
    </ul>
  </section>`
  return `<!doctype html><html><head><style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:1280px;height:880px;background:#FFFFFF;font-family:Inter,sans-serif;color:#111111;padding:46px 64px}
  .top{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:26px}
  h1{font-family:'Inter Display',Inter;font-weight:700;font-size:52px;letter-spacing:-.04em;line-height:.95}
  .sub{margin-top:12px;font-size:14px;color:#6B6B6B;letter-spacing:-.005em}
  .sub b{color:#111;font-weight:600}
  .seg{display:flex;background:#F4F4F5;border-radius:10px;padding:3px;font-size:13px}
  .seg span{padding:6px 12px;border-radius:8px;color:#6B6B6B}.seg .on{background:#fff;color:#111;box-shadow:0 1px 2px rgba(0,0,0,.08)}
  .actions{display:flex;gap:12px;align-items:center}
  .btn{font-size:13px;font-weight:600;color:#fff;background:#111;border-radius:10px;padding:9px 14px}
  .matrix{position:relative;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;height:640px;border-top:1px solid #111;border-bottom:1px solid #E5E5E5}
  .matrix:before{content:'';position:absolute;left:50%;top:0;bottom:0;border-left:1px solid #E5E5E5}
  .matrix:after{content:'';position:absolute;top:50%;left:0;right:0;border-top:1px solid #E5E5E5}
  .labels{display:flex;justify-content:space-around;font-size:11px;font-weight:600;letter-spacing:.2em;color:#9A9A9A;margin-bottom:10px}
  .cell{position:relative;padding:26px 34px 20px;overflow:hidden}
  .num{position:absolute;right:28px;top:14px;font-family:'Inter Display',Inter;font-weight:200;font-size:64px;letter-spacing:-.04em;color:#F0F0F0}
  header{position:relative;margin-bottom:12px}
  h2{display:flex;align-items:center;gap:10px;font-size:20px;font-weight:650;letter-spacing:-.02em}
  .bar{width:3px;height:18px;border-radius:2px}
  header p{font-size:13px;color:#8A8A8A;margin:4px 0 0 13px}
  ul{position:relative;list-style:none;margin-left:13px}
  li{display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid #F2F2F2;font-size:14.5px}
  .check{width:17px;height:17px;border-radius:50%;border:1.5px solid #CFCFCF;flex:none;display:flex;align-items:center;justify-content:center}
  li.done .check{background:#111;border-color:#111}li.done .tt{color:#B5B5B5;text-decoration:line-through}
  .tx{flex:1}.note{color:#A3A3A3;margin-left:6px;font-size:13.5px}
  .meta{font-size:12.5px;color:#7A7A7A;font-variant-numeric:tabular-nums}
  .meta.soon{color:#A16207;font-weight:500}.meta.overdue{color:#C2410C;font-weight:600}
  .empty{color:#BDBDBD;border:none}
  .add{color:#9A9A9A;border:none;font-size:13.5px}
  .add:before{content:'+';margin-right:10px;color:#BDBDBD}
  .yl{position:absolute;left:24px;font-size:11px;font-weight:600;letter-spacing:.2em;color:#9A9A9A;writing-mode:vertical-rl;transform:rotate(180deg)}
  </style></head><body>
  <div class="top">
    <div><h1>Tasks</h1><div class="sub"><b>${open} open</b> · 1 overdue</div></div>
    <div class="actions"><div class="seg"><span class="on">Matrix</span><span>List</span></div><div class="seg"><span>Hide done</span></div><span class="btn">New task</span></div>
  </div>
  <div class="labels"><span>URGENT</span><span>NOT URGENT</span></div>
  <span class="yl" style="top:300px">IMPORTANT</span><span class="yl" style="top:610px">NOT IMPORTANT</span>
  <div class="matrix">${quadrants.map(cell).join('')}</div>
  </body></html>`
}

;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1280, height: 880 }, deviceScaleFactor: 2 })
  for (const [name, fn] of [['A-ivory-champagne', A], ['B-midnight-onyx', B], ['C-gallery-minimal', C]]) {
    await p.setContent(fn(), { waitUntil: 'load' })
    await p.evaluate(() => document.fonts.ready)
    await p.screenshot({ path: `${name}.png` })
  }
  await b.close()
})()
