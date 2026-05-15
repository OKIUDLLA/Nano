(function () {
  'use strict';

  // ---------- Opening hours data ----------
  // Po–Pá 9:00–11:00, 13:00–17:00; So 8:00–17:00; Ne zavřeno
  const SCHEDULE = [
    { day: 'Pondělí',  short: 'Po', windows: [[9, 11], [13, 17]] },
    { day: 'Úterý',    short: 'Út', windows: [[9, 11], [13, 17]] },
    { day: 'Středa',   short: 'St', windows: [[9, 11], [13, 17]] },
    { day: 'Čtvrtek',  short: 'Čt', windows: [[9, 11], [13, 17]] },
    { day: 'Pátek',    short: 'Pá', windows: [[9, 11], [13, 17]] },
    { day: 'Sobota',   short: 'So', windows: [[8, 17]] },
    { day: 'Neděle',   short: 'Ne', windows: [] }
  ];

  function fmtTime(h) {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return hh + ':' + (mm < 10 ? '0' + mm : mm);
  }

  function describeWindows(windows) {
    if (!windows.length) return 'Zavřeno';
    return windows.map(w => fmtTime(w[0]) + '–' + fmtTime(w[1])).join(', ');
  }

  function isOpenNow(now) {
    // JS getDay() returns 0=Sun, 1=Mon… convert to 0=Mon … 6=Sun
    const jsDay = now.getDay();
    const idx = (jsDay + 6) % 7;
    const today = SCHEDULE[idx];
    const hourFraction = now.getHours() + now.getMinutes() / 60;
    return today.windows.some(w => hourFraction >= w[0] && hourFraction < w[1]);
  }

  function todayIndex(now) {
    return (now.getDay() + 6) % 7;
  }

  function renderHours(listEl, now) {
    const tIdx = todayIndex(now);
    const open = isOpenNow(now);
    SCHEDULE.forEach((d, i) => {
      const li = document.createElement('li');
      const isToday = i === tIdx;
      if (isToday) li.classList.add('today');
      if (!d.windows.length) li.classList.add('closed');

      const day = document.createElement('span');
      day.className = 'day';
      day.textContent = d.day + (isToday ? ' (dnes)' : '');

      const time = document.createElement('span');
      time.className = 'time';
      time.textContent = describeWindows(d.windows);

      if (isToday) {
        const pill = document.createElement('span');
        pill.className = 'open-pill ' + (open ? 'open' : 'closed');
        pill.textContent = open ? 'Otevřeno' : 'Zavřeno';
        day.appendChild(pill);
      }

      li.appendChild(day);
      li.appendChild(time);
      listEl.appendChild(li);
    });
  }

  // ---------- Init: render hours wherever requested ----------
  const now = new Date();
  ['hours', 'hours-full'].forEach(id => {
    const el = document.getElementById(id);
    if (el) renderHours(el, now);
  });

  // ---------- Footer year ----------
  const yEl = document.getElementById('year');
  if (yEl) yEl.textContent = new Date().getFullYear();

  // ---------- Mobile nav toggle ----------
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
})();
