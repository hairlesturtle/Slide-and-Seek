// 0) Helpers
const delay = ms => new Promise(r => setTimeout(r, ms));
let rootHandle = null;

function getLocalDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function getLocalTimestamp(date = new Date()) {
  return date.getTime(); // numeric for sorting
}
function formatTimestamp(date = new Date()) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${mm}:${dd}:${yyyy} - ${hh}:${min}:${ss}`;
}

// Read PNG from clipboard
async function grabClipboardPng() {
  const items = await navigator.clipboard.read();
  for (const item of items) {
    if (item.types.includes('image/png')) {
      return await item.getType('image/png');
    }
  }
  throw new Error('No PNG in clipboard');
}

// 1) Save PNG
async function savePng(blob) {
  if (!rootHandle) {
    rootHandle = await window.showDirectoryPicker();
  }
  const now = new Date();
  const day = getLocalDate(now);
  const dir = await rootHandle.getDirectoryHandle(day, { create: true });
  const stamp = formatTimestamp(now).replace(/[: /]/g, '-');
  const fh = await dir.getFileHandle(`${stamp}.png`, { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
  return { timestamp: now.getTime(), display: formatTimestamp(now) };
}

// 2) Inject thumbnail + timestamp
function dropThumbnail(blob, info) {
  const url = URL.createObjectURL(blob);
  const wrapper = document.createElement('div');
  wrapper.className = 'thumb-wrapper';
  wrapper.dataset.ts = info.timestamp;

  const img = document.createElement('img');
  img.src = url;
  img.alt = info.display;
  wrapper.appendChild(img);

  const caption = document.createElement('div');
  caption.className = 'thumb-timestamp';
  caption.textContent = info.display;
  wrapper.appendChild(caption);

  document.getElementById('thumbGrid').prepend(wrapper);
}

// 3) Toast
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// 4a) Capture
document.getElementById('btnCapture').addEventListener('click', () => {
  toast('Run snip, then Ctrl+V or click Paste');
  window.location.href = 'ms-screenclip:';
});

// 4b) Paste
document.getElementById('btnPaste').addEventListener('click', async () => {
  toast('Reading clipboard…');
  try {
    const blob = await grabClipboardPng();
    const info = await savePng(blob);
    dropThumbnail(blob, info);
    toast('✔ Screenshot saved');
    applyFilter();
  } catch (e) {
    toast(e.message || '✖ Paste failed');
  }
});

// 4c) Handle Ctrl+V
document.addEventListener('paste', async e => {
  e.preventDefault();
  let blob = null;
  for (const item of e.clipboardData.items) {
    if (item.kind === 'file') {
      blob = item.getAsFile();
      break;
    }
  }
  if (!blob) return toast('No image in paste');
  try {
    const info = await savePng(blob);
    dropThumbnail(blob, info);
    toast('✔ Screenshot saved');
    applyFilter();
  } catch {
    toast('✖ Save failed');
  }
});

// 5) Theme toggle
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
themeToggle.addEventListener('click', () => {
  const isDark = document.documentElement.classList.toggle('dark');
  themeIcon.textContent = isDark ? '☀️' : '🌙';
});

// 6) Lightbox
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
document.getElementById('thumbGrid').addEventListener('click', e => {
  if (e.target.tagName === 'IMG') {
    lightboxImg.src = e.target.src;
    lightbox.classList.add('show');
  }
});
lightbox.addEventListener('click', () => {
  lightbox.classList.remove('show');
});

// 7) Calendar & Filters (unchanged)
let currentYear, currentMonth, selectedDate = null;
const monthLabelEl = document.getElementById('monthLabel');
const calendarGridEl = document.getElementById('calendarGrid');
const offsetDate = days => {
  const d = new Date(); d.setDate(d.getDate() + days);
  return getLocalDate(d);
};
let currentFilter = 'all';

function initCalendar() {
  const t = new Date();
  currentYear = t.getFullYear();
  currentMonth = t.getMonth();
  renderCalendar();
}

function renderCalendar() {
  monthLabelEl.textContent = new Date(currentYear, currentMonth)
    .toLocaleString('default',{month:'long',year:'numeric'});
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth+1, 0).getDate();
  calendarGridEl.innerHTML = '';
  for (let i = 0; i < firstDay; i++) {
    calendarGridEl.appendChild(document.createElement('div'));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const btn = document.createElement('button');
    btn.textContent = d;
    const ds = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    btn.dataset.date = ds;
    if (ds === getLocalDate()) btn.classList.add('today');
    if (ds === selectedDate) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      selectedDate = ds;
      document.getElementById('currentFilter').textContent = ds;
      applyFilter(); renderCalendar();
    });
    calendarGridEl.appendChild(btn);
  }
}

document.getElementById('btnPrevMonth').addEventListener('click', () => {
  currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
});
document.getElementById('btnNextMonth').addEventListener('click', () => {
  currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
});
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedDate = null;
    currentFilter = btn.dataset.filter;
    document.getElementById('currentFilter').textContent = btn.textContent;
    applyFilter(); renderCalendar();
  });
});

function applyFilter() {
  document.querySelectorAll('.thumb-wrapper').forEach(w => {
    const img = w.querySelector('img');
    const d = img.dataset.date;
    let show = true;
    if (selectedDate) {
      show = (d === selectedDate);
    } else {
      switch (currentFilter) {
        case 'today': show = (d === getLocalDate()); break;
        case 'yesterday': show = (d === offsetDate(-1)); break;
        case 'last7': show = ((new Date() - new Date(d))/86400000 < 7); break;
        case 'last30': show = ((new Date() - new Date(d))/86400000 < 30); break;
        case 'thisMonth': show = d.startsWith(getLocalDate().slice(0,7)); break;
        case 'lastMonth': {
          const [y,m] = getLocalDate().split('-').map(Number);
          const mm = m===1?12:m-1, yy = m===1?y-1:y;
          show = d.startsWith(`${yy}-${String(mm).padStart(2,'0')}`);
        } break;
        default: show = true;
      }
    }
    w.style.display = show ? '' : 'none';
  });
}

// 8) Sort latest ↕︎
document.getElementById('btnSort').addEventListener('click', () => {
  const grid = document.getElementById('thumbGrid');
  const wrappers = Array.from(grid.children);
  wrappers.sort((a,b) => Number(b.dataset.ts) - Number(a.dataset.ts));
  wrappers.forEach(w => grid.appendChild(w));
});

initCalendar();
applyFilter();
