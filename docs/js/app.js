// 「道途」静态版 · 数据存储在浏览器 localStorage
// 这是一个 100% 客户端版本,GitHub Pages 可直接托管
// 数据契约:localStorage key = 'dao_tu_state_v1'

const CULTIVATION_CONFIG = {
  meditation_focus: { label: '悟道', xi_per_min: 0.025, default_min: 20, min_min: 20 },
  meditation_short: { label: '打坐', xi_per_min: 0.04,  default_min: 5,  min_min: 5 },
  body_forge:       { label: '锻体', xi_per_min: 0.01,  default_min: 30, min_min: 30 },
  body_labor:       { label: '搬砖', xi_per_min: 0.005, default_min: 30, min_min: 30 },
  breath_qi:        { label: '行气', xi_per_min: 0.02,  default_min: 5,  min_min: 5 },
  sleep_rest:       { label: '静修', xi_per_min: 0.0036, default_min: 420, min_min: 360, max_min: 600 },
  expedition:       { label: '历练', xi_per_min: 0.0042, default_min: 120, min_min: 120 },
};

const ICON_MAP = {
  meditation_focus: '禅', meditation_short: '坐', body_forge: '体',
  body_labor: '劳', breath_qi: '气', sleep_rest: '静', expedition: '历',
};

// 静态版境界配置(不再从 server 拉)
const REALM_CONFIG = {
  refining:    { name: '炼气期', code: 'refining',    order: 1, xiu: 0,    color: '#8b9d83', desc: '吐纳天地灵气,初窥道途', skill: null },
  foundation:  { name: '筑基',   code: 'foundation',  order: 2, xiu: 50,   color: '#c9a961', desc: '稳固根基,修道之始',    skill: '《太清静心诀》' },
  golden_core: { name: '金丹',   code: 'golden_core', order: 3, xiu: 200,  color: '#d8a847', desc: '凝聚金丹,神识初成',    skill: '《九转还丹诀》' },
  nascent_soul:{ name: '元婴',   code: 'nascent_soul',order: 4, xiu: 600,  color: '#9a7fcf', desc: '阴神出窍,神游太虚',    skill: '《阴阳元婴功》' },
  divine_spirit:{name: '化神',   code: 'divine_spirit',order: 5, xiu: 1500, color: '#5fa5b5', desc: '炼神返虚,通达神明',    skill: '《通天神化诀》' },
  tribulation: { name: '渡劫',   code: 'tribulation', order: 6, xiu: 3000, color: '#c14a4a', desc: '渡过天劫,飞升在即',    skill: '《九霄雷音真经》' },
};

// ---- localStorage 数据层 ----
const STORAGE_KEY = 'dao_tu_state_v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    if (!s.user) return defaultState();
    return s;
  } catch (e) {
    return defaultState();
  }
}

function defaultState() {
  return {
    user: {
      dao_name: '道友',
      current_realm: 'refining',
      total_xiuwei: 0,
      realm_entered_at: null,
      created_at: new Date().toISOString(),
    },
    logs: [],
    scrolls: [],
    realm_history: [],
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// state 是全局的
let state = loadState();

function getDeviceId() { return state.user.dao_name + '_' + (state.user.created_at || '0'); }

// ---- 修为 / 境界管理 ----
function checkRealmProgression() {
  if (state.user.current_realm === 'tribulation') return null;
  const curOrder = REALM_CONFIG[state.user.current_realm].order;
  const next = Object.values(REALM_CONFIG).find(r => r.order === curOrder + 1);
  if (!next) return null;
  if (state.user.total_xiuwei >= next.xiu) {
    const from = state.user.current_realm;
    state.user.current_realm = next.code;
    state.user.realm_entered_at = new Date().toISOString();
    state.realm_history.push({
      from_realm: from, to_realm: next.code,
      total_xiuwei_at_switch: state.user.total_xiuwei,
      switched_at: new Date().toISOString(),
    });
    if (next.skill && !state.scrolls.find(s => s.scroll_code === next.skill)) {
      state.scrolls.push({ scroll_code: next.skill, unlocked_at: new Date().toISOString() });
    }
    return next;
  }
  return null;
}

function recordCultivation(cult_type, dur_min, note) {
  const cfg = CULTIVATION_CONFIG[cult_type];
  const xi = cfg.xi_per_min * dur_min;
  const now = Date.now();
  const log = {
    id: state.logs.length + 1,
    cultivation_type: cult_type,
    duration_min: dur_min,
    xiuwei_gained: parseFloat(xi.toFixed(3)),
    started_at: new Date(now - dur_min * 60_000).toISOString(),
    completed_at: new Date(now).toISOString(),
    user_note: note || '',
  };
  state.logs.unshift(log);  // 最新在前
  state.logs = state.logs.slice(0, 500);  // 限 500 条
  state.user.total_xiuwei = parseFloat((state.user.total_xiuwei + xi).toFixed(3));
  const breakthrough = checkRealmProgression();
  saveState();
  return { log, breakthrough,
    user: state.user,
    next: nextRealm(state.user.current_realm) };
}

function nextRealm(curCode) {
  const cur = REALM_CONFIG[curCode];
  return Object.values(REALM_CONFIG).find(r => r.order === cur.order + 1) || null;
}

// ---- UI helpers ----
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

// ---- 视图渲染 ----
function renderMe() {
  const u = state.user;
  document.getElementById('daoName').textContent = u.dao_name;
  const realm = REALM_CONFIG[u.current_realm];
  document.getElementById('realmName').textContent = realm.name;
  document.getElementById('realmSub').textContent = realm.desc;
  document.getElementById('currentXiu').textContent = u.total_xiuwei.toFixed(1);
  const next = nextRealm(u.current_realm);
  if (next) {
    document.getElementById('nextXiu').textContent = next.xiu.toFixed(1);
    const remain = (next.xiu - u.total_xiuwei).toFixed(1);
    document.getElementById('progressNext').textContent = `距离${next.name} ${remain} 修为`;
    const pct = Math.min(100, Math.max(0, (u.total_xiuwei / next.xiu) * 100));
    setTimeout(() => {
      document.getElementById('progressFill').style.width = pct + '%';
      document.getElementById('progressPct').textContent = pct.toFixed(0) + '%';
    }, 80);
  } else {
    document.getElementById('nextXiu').textContent = '—';
    document.getElementById('progressNext').textContent = '已至渡劫,飞升在即';
    document.getElementById('progressFill').style.width = '100%';
    document.getElementById('progressPct').textContent = '100%';
  }
}

function renderStats() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekStart = new Date(now.getTime() - 6 * 86400_000).toISOString().slice(0, 10);
  const todayXi = state.logs.filter(l => l.completed_at.slice(0, 10) >= today)
                            .reduce((s, l) => s + l.xiuwei_gained, 0);
  const weekXi = state.logs.filter(l => l.completed_at.slice(0, 10) >= weekStart)
                           .reduce((s, l) => s + l.xiuwei_gained, 0);
  document.getElementById('statToday').textContent = todayXi.toFixed(1);
  document.getElementById('statWeek').textContent = weekXi.toFixed(1);
  document.getElementById('statTotal').textContent = state.user.total_xiuwei.toFixed(1);
  document.getElementById('statLogs').textContent = state.logs.length;
  // 7 日折线
  renderChart();
}

function renderChart() {
  const svg = document.getElementById('chart');
  const axis = document.getElementById('chartAxis');
  svg.innerHTML = '';
  axis.innerHTML = '';
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
    const xi = state.logs.filter(l => l.completed_at.slice(0, 10) === d)
                          .reduce((s, l) => s + l.xiuwei_gained, 0);
    days.push({ d, xi });
  }
  const max = Math.max(...days.map(d => d.xi), 1);
  const W = 320, H = 100;
  const points = days.map((_, i) => {
    const x = (i / 6) * (W - 20) + 10;
    const y = H - 12 - (days[i].xi / max) * (H - 30);
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
  axis.innerHTML = days.map((d, i) =>
    `<span>${labels[(new Date(d.d).getDay()+6)%7]}</span>`
  ).join('');
}

function renderHistory() {
  const list = document.getElementById('histList');
  if (state.logs.length === 0) {
    list.innerHTML = '<li class="empty">尚无修炼,今日是否精进?</li>';
    return;
  }
  list.innerHTML = state.logs.slice(0, 50).map(l => `
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

function renderScrolls() {
  const list = document.getElementById('scrollList');
  if (state.scrolls.length === 0) {
    list.innerHTML = '<li class="scroll-empty">尚未解锁功法,精进可期。</li>';
    return;
  }
  list.innerHTML = state.scrolls.map(s => `
    <li class="scroll-item">
      <span class="scroll-icon">📜</span>
      <div class="scroll-text">
        <div class="scroll-name">${s.scroll_code}</div>
        <div class="scroll-meta">${fmtTime(s.unlocked_at)} 解锁</div>
      </div>
    </li>
  `).join('');
}

function renderAll() {
  renderMe();
  renderStats();
  renderHistory();
  renderScrolls();
}

// ---- Modal 与弹层 ----
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

document.getElementById('modalSubmit').onclick = () => {
  if (!currentCultType) return;
  const cfg = CULTIVATION_CONFIG[currentCultType];
  const dur = parseInt(document.getElementById('durationInput').value);
  if (!dur || dur < cfg.min_min) {
    toast(`修炼时长须 ≥ ${cfg.min_min} 分钟`);
    return;
  }
  const note = document.getElementById('noteInput').value.trim();
  const result = recordCultivation(currentCultType, dur, note);
  document.getElementById('modalMask').style.display = 'none';
  toast(`+${result.log.xiuwei_gained.toFixed(2)} 修为`);
  if (result.breakthrough) {
    setTimeout(() => showCeremony(result.breakthrough), 600);
  }
  currentCultType = null;
  renderAll();
};

document.getElementById('renameBtn').onclick = () => {
  document.getElementById('nameInput').value = state.user.dao_name;
  document.getElementById('nameMask').style.display = 'flex';
};
document.getElementById('nameCancel').onclick = () => document.getElementById('nameMask').style.display = 'none';
document.getElementById('nameSubmit').onclick = () => {
  const v = document.getElementById('nameInput').value.trim();
  if (!v) { toast('道号不能为空'); return; }
  state.user.dao_name = v;
  saveState();
  document.getElementById('nameMask').style.display = 'none';
  toast('道号已设置');
  renderMe();
};

// ---- 仪式弹层 ----
function showCeremony(realm) {
  document.getElementById('ceremonySeal').textContent = realm.name.charAt(0);
  document.getElementById('ceremonyRealm').textContent = realm.name;
  document.getElementById('ceremonyMsg').textContent = realm.desc;
  document.getElementById('ceremonySkill').textContent = realm.skill ? `已得 ${realm.skill}` : '';
  document.getElementById('ceremonyMask').style.display = 'flex';
  renderScrolls();
}
document.getElementById('ceremonyContinue').onclick = () => {
  document.getElementById('ceremonyMask').style.display = 'none';
};

// ---- 设置/导出/重置 ----
document.getElementById('resetBtn')?.addEventListener('click', () => {
  if (confirm('重置全部数据?(包括修为和历史)\n这不可撤销!')) {
    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    saveState();
    renderAll();
    toast('数据已重置');
  }
});

document.getElementById('exportBtn')?.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dao_tu_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('已导出备份');
});

// ---- 修炼按钮 ----
document.querySelectorAll('.cult-btn').forEach(b => {
  b.addEventListener('click', () => openCultModal(b.dataset.type));
});

// ---- 启动 ----
renderAll();
