// 「道途」前端 · 修真客户端
// 数据流: API /api/me, /api/cultivate, /api/history, /api/scrolls, /api/stats
// 每个 cultivation_type 内嵌 修为 + 最小时长 (与 GDD 对应)

const CULTIVATION_CONFIG = {
  meditation_focus: { label: '悟道',   xi_per_min: 0.025, default_min: 20, min_min: 20 },
  meditation_short: { label: '打坐',   xi_per_min: 0.04,  default_min: 5,  min_min: 5 },
  body_forge:       { label: '锻体',   xi_per_min: 0.01,  default_min: 30, min_min: 30 },
  body_labor:       { label: '搬砖',   xi_per_min: 0.005, default_min: 30, min_min: 30 },
  breath_qi:        { label: '行气',   xi_per_min: 0.02,  default_min: 5,  min_min: 5 },
  sleep_rest:       { label: '静修',   xi_per_min: 0.0036, default_min: 420, min_min: 360, max_min: 600 },
  expedition:       { label: '历练',   xi_per_min: 0.0042, default_min: 120, min_min: 120 },
};

const ICON_MAP = {
  meditation_focus: '禅', meditation_short: '坐', body_forge: '体',
  body_labor: '劳', breath_qi: '气', sleep_rest: '静', expedition: '历',
};

// 每个浏览器一个 device_id (localStorage 持久化)
function getDeviceId() {
  let id = localStorage.getItem('dao_tu_device_id');
  if (!id) {
    id = 'd_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem('dao_tu_device_id', id);
  }
  return id;
}

async function api(path, opts = {}) {
  opts.headers = opts.headers || {};
  opts.headers['X-Device-Id'] = getDeviceId();
  if (opts.body) opts.headers['Content-Type'] = 'application/json';
  const r = await fetch(path, opts);
  return await r.json();
}

function toast(msg, duration = 2000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', duration);
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 16).replace('T', ' ');
  const now = new Date();
  const diff = now - d;
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff/60_000)} 分钟前`;
  if (d.toDateString() === now.toDateString()) return `今日 ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
  if (now - d < 86400_000 * 7) {
    const w = ['日','一','二','三','四','五','六'][d.getDay()];
    return `周${w} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// --- Data flow ---
async function loadMe() {
  const data = await api('/api/me');
  if (!data.user) return;
  const u = data.user;
  document.getElementById('daoName').textContent = u.dao_name;
  document.getElementById('realmName').textContent = u.realm.realm_name;
  document.getElementById('realmSub').textContent = u.realm.description;
  document.getElementById('currentXiu').textContent = u.total_xiuwei.toFixed(1);
  if (data.next_realm) {
    document.getElementById('nextXiu').textContent = data.next_realm.required_xiuwei.toFixed(1);
    document.getElementById('progressNext').textContent =
      `距离${data.next_realm.realm_name} ${(data.next_realm.required_xiuwei - u.total_xiuwei).toFixed(1)} 修为`;
  } else {
    document.getElementById('nextXiu').textContent = '—';
    document.getElementById('progressNext').textContent = '已至渡劫,飞升在即';
  }
  setTimeout(() => {
    document.getElementById('progressFill').style.width = Math.min(100, data.progress_pct) + '%';
    document.getElementById('progressPct').textContent = data.progress_pct + '%';
  }, 80);
}

async function loadStats() {
  const data = await api('/api/stats');
  document.getElementById('statTotal').textContent = (data.total_xiuwei || 0).toFixed(1);
  document.getElementById('statLogs').textContent = data.total_logs || 0;
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date(Date.now() - 6*86400_000).toISOString().slice(0, 10);
  const todayXi = (data.by_day || []).filter(d => d.d >= today).reduce((s,d) => s+d.xi, 0);
  const weekXi = (data.by_day || []).filter(d => d.d >= weekStart).reduce((s,d) => s+d.xi, 0);
  document.getElementById('statToday').textContent = todayXi.toFixed(1);
  document.getElementById('statWeek').textContent = weekXi.toFixed(1);
  renderChart(data.by_day || []);
}

function renderChart(byDay) {
  const svg = document.getElementById('chart');
  const axis = document.getElementById('chartAxis');
  svg.innerHTML = '';
  axis.innerHTML = '';
  // 7 天范围
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
    const rec = byDay.find(b => b.d === d);
    days.push({ d, xi: rec ? rec.xi : 0 });
  }
  const max = Math.max(...days.map(d => d.xi), 1);
  const W = 320, H = 100;
  const points = days.map((d, i) => {
    const x = (i / 6) * (W - 20) + 10;
    const y = H - 12 - (d.xi / max) * (H - 30);
    return { x, y };
  });
  const pathD = 'M ' + points.map(p => `${p.x},${p.y}`).join(' L ');
  const areaD = pathD + ` L ${points[6].x},${H-2} L ${points[0].x},${H-2} Z`;
  svg.innerHTML = `
    <defs>
      <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#c9a961" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#c9a961" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${areaD}" fill="url(#areaGrad)"/>
    <path d="${pathD}" fill="none" stroke="#c9a961" stroke-width="2"/>
    ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#c9a961"/>`).join('')}
  `;
  const labels = ['一','二','三','四','五','六','日'];
  axis.innerHTML = days.map((d, i) => `<span>${labels[(new Date(d.d).getDay()+6)%7]}</span>`).join('');
}

async function loadHistory() {
  const data = await api('/api/history');
  const list = document.getElementById('histList');
  if (!data.logs || data.logs.length === 0) {
    list.innerHTML = '<li class="empty">尚无修炼,今日是否精进?</li>';
    return;
  }
  list.innerHTML = data.logs.map(l => `
    <li class="hist-item">
      <div class="hist-icon">${ICON_MAP[l.cultivation_type] || '修'}</div>
      <div class="hist-text">
        <div class="hist-title">${CULTIVATION_CONFIG[l.cultivation_type]?.label || l.cultivation_type}</div>
        <div class="hist-meta">${l.duration_min} 分钟 · ${fmtTime(l.completed_at)}${l.user_note ? ' · ' + l.user_note : ''}</div>
      </div>
      <div class="hist-xi">+${l.xiuwei_gained.toFixed(2)}</div>
    </li>
  `).join('');
}

async function loadScrolls() {
  const data = await api('/api/scrolls');
  const list = document.getElementById('scrollList');
  if (!data.scrolls || data.scrolls.length === 0) {
    list.innerHTML = '<li class="scroll-empty">尚未解锁功法,精进可期。</li>';
    return;
  }
  list.innerHTML = data.scrolls.map(s => `
    <li class="scroll-item">
      <span class="scroll-icon">📜</span>
      <div class="scroll-text">
        <div class="scroll-name">${s.scroll_code}</div>
        <div class="scroll-meta">${fmtTime(s.unlocked_at)} 解锁</div>
      </div>
    </li>
  `).join('');
}

async function loadAll() {
  await Promise.all([loadMe(), loadStats(), loadHistory(), loadScrolls()]);
}

// --- Modal: cultivation submit ---
let currentCultType = null;
function openCultModal(type) {
  currentCultType = type;
  const cfg = CULTIVATION_CONFIG[type];
  document.getElementById('modalTitle').textContent = cfg.label + '修炼';
  document.getElementById('modalSub').textContent = `本次修炼时长 (分钟),最少 ${cfg.min_min} 分钟`;
  const input = document.getElementById('durationInput');
  input.value = cfg.default_min;
  input.min = cfg.min_min;
  if (cfg.max_min) input.max = cfg.max_min;
  document.getElementById('noteInput').value = '';
  const xi = cfg.xi_per_min * cfg.default_min;
  document.getElementById('modalMeta').textContent = `完成后预计 +${xi.toFixed(2)} 修为`;
  input.oninput = () => {
    const dur = parseInt(input.value) || 0;
    const xi2 = cfg.xi_per_min * dur;
    document.getElementById('modalMeta').textContent =
      dur < cfg.min_min ? `至少需 ${cfg.min_min} 分钟` : `完成后预计 +${xi2.toFixed(2)} 修为`;
  };
  document.getElementById('modalMask').style.display = 'flex';
  setTimeout(() => input.focus(), 100);
}

document.getElementById('modalCancel').onclick = () => {
  document.getElementById('modalMask').style.display = 'none';
  currentCultType = null;
};

document.getElementById('modalSubmit').onclick = async () => {
  if (!currentCultType) return;
  const cfg = CULTIVATION_CONFIG[currentCultType];
  const dur = parseInt(document.getElementById('durationInput').value);
  if (!dur || dur < cfg.min_min) {
    toast(`修炼时长须 ≥ ${cfg.min_min} 分钟`);
    return;
  }
  const xi = cfg.xi_per_min * dur;
  const now = Date.now();
  const started = new Date(now - dur * 60_000).toISOString();
  const completed = new Date(now).toISOString();
  const note = document.getElementById('noteInput').value.trim();
  const btn = document.getElementById('modalSubmit');
  btn.disabled = true;
  btn.textContent = '提交中...';
  const r = await api('/api/cultivate', {
    method: 'POST',
    body: JSON.stringify({
      cultivation_type: currentCultType,
      duration_min: dur,
      xiuwei_gained: xi,
      started_at: started,
      completed_at: completed,
      user_note: note,
    })
  });
  btn.disabled = false;
  btn.textContent = '完成修炼';
  document.getElementById('modalMask').style.display = 'none';
  if (r.error) { toast(r.error); return; }
  toast(`+${xi.toFixed(2)} 修为`);
  if (r.breakthrough) {
    setTimeout(() => showCeremony(r.breakthrough), 800);
  }
  currentCultType = null;
  await loadAll();
};

// --- Modal: rename ---
document.getElementById('renameBtn').onclick = () => {
  document.getElementById('nameInput').value = document.getElementById('daoName').textContent;
  document.getElementById('nameMask').style.display = 'flex';
};
document.getElementById('nameCancel').onclick = () => document.getElementById('nameMask').style.display = 'none';
document.getElementById('nameSubmit').onclick = async () => {
  const v = document.getElementById('nameInput').value.trim();
  if (!v) { toast('道号不能为空'); return; }
  const r = await api('/api/rename', { method: 'POST', body: JSON.stringify({ dao_name: v }) });
  if (r.error) { toast(r.error); return; }
  document.getElementById('nameMask').style.display = 'none';
  toast('道号已设置');
  await loadMe();
};

// --- Ceremony (突破仪式) ---
let currentBreakthroughRealm = null;
async function showCeremony(realm) {
  currentBreakthroughRealm = realm.realm_code;
  document.getElementById('ceremonySeal').textContent = realm.realm_name.charAt(0);
  document.getElementById('ceremonyRealm').textContent = realm.realm_name;
  document.getElementById('ceremonyMsg').textContent = realm.description;
  document.getElementById('ceremonySkill').textContent = realm.unlocked_skill ? `已得 ${realm.unlocked_skill}` : '';
  const statusEl = document.getElementById('ceremonyVideoStatus');
  statusEl.style.display = 'none';
  document.getElementById('ceremonyVideoBtn').textContent = '🎬 分享突破时刻(30 秒视频)';
  document.getElementById('ceremonyMask').style.display = 'flex';
  await loadScrolls();
}
document.getElementById('ceremonyContinue').onclick = () => {
  document.getElementById('ceremonyMask').style.display = 'none';
};

// 突破时刻视频按钮
document.getElementById('ceremonyVideoBtn').onclick = async () => {
  if (!currentBreakthroughRealm) return;
  const btn = document.getElementById('ceremonyVideoBtn');
  const statusEl = document.getElementById('ceremonyVideoStatus');
  statusEl.style.display = 'block';
  btn.disabled = true;
  btn.textContent = '查询中...';
  // 先查询状态
  const r1 = await api('/api/ceremony_status', {
    method: 'POST', body: JSON.stringify({ realm_code: currentBreakthroughRealm })
  });
  if (r1.ready) {
    statusEl.innerHTML = `✅ 视频已生成 (${r1.size_mb} MB),<a href="${r1.video_url}" download style="color:#e5c878;text-decoration:underline;">点这里下载</a>`;
    btn.textContent = '已就绪,再次下载';
    btn.disabled = false;
    return;
  }
  // 没就绪 → 触发生成
  btn.textContent = '生成中...';
  const r2 = await api('/api/ceremony_video', {
    method: 'POST', body: JSON.stringify({ realm_code: currentBreakthroughRealm })
  });
  statusEl.textContent = r2.message || '视频生成中,约 3-5 分钟';
  btn.textContent = '🔄 刷新状态';
  btn.disabled = false;
  // 自动轮询 (10 次,每 30 秒,共 5 分钟)
  let pollCount = 0;
  const pollTimer = setInterval(async () => {
    pollCount++;
    if (pollCount > 20) { clearInterval(pollTimer); btn.textContent = '已可重新查询'; return; }
    const r = await api('/api/ceremony_status', {
      method: 'POST', body: JSON.stringify({ realm_code: currentBreakthroughRealm })
    });
    if (r.ready) {
      clearInterval(pollTimer);
      statusEl.innerHTML = `✅ 视频已生成 (${r.size_mb} MB),<a href="${r.video_url}" download style="color:#e5c878;text-decoration:underline;">点这里下载</a>`;
      btn.textContent = '再次下载';
    } else {
      btn.textContent = `🔄 刷新状态(${pollCount * 30}s)`;
    }
  }, 30000);
};

// --- Cultivation buttons ---
document.querySelectorAll('.cult-btn').forEach(b => {
  b.addEventListener('click', () => openCultModal(b.dataset.type));
});

// --- Init ---
loadAll();
setInterval(loadStats, 60_000);  // 每分钟刷新
window.addEventListener('focus', loadAll);
