module.exports = {
  quadrants: [
    { id: 'do', n: 'I', num: '01', title: 'Do first', hint: 'Important & urgent', tasks: [
      { t: 'Release app v1.2', meta: 'Today · 17:00', state: 'soon' },
      { t: 'Check crash reports', note: 'Android 14 · Pixel 8' },
      { t: 'Reply to App Store review', meta: 'Overdue · 2h', state: 'overdue' },
      { t: 'Sign vendor contract', done: true },
    ] },
    { id: 'schedule', n: 'II', num: '02', title: 'Schedule', hint: 'Important, not urgent', tasks: [
      { t: 'Plan Q3 roadmap', meta: 'Thu · 09:00', note: 'Goals & milestones' },
      { t: 'IELTS writing practice', meta: 'Sat · 08:30' },
    ] },
    { id: 'delegate', n: 'III', num: '03', title: 'Delegate', hint: 'Urgent, not important', tasks: [
      { t: 'Book flights to Singapore', meta: 'Tomorrow' },
    ] },
    { id: 'eliminate', n: 'IV', num: '04', title: 'Eliminate', hint: 'Neither — let it go', tasks: [] },
  ],
}
