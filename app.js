'use strict';

/* ═══════════════════════════════════════════ CONSTANTS */
const CATS = {
  food:      { label: 'Food',      icon: '🍽️' },
  transport: { label: 'Transport', icon: '🚗' },
  bills:     { label: 'Bills',     icon: '💡' },
  shopping:  { label: 'Shopping',  icon: '🛍️' },
  health:    { label: 'Health',    icon: '💊' },
  other:     { label: 'Other',     icon: '✨' },
};
const DEFAULT_SPLITS = { food:0.25, transport:0.15, bills:0.20, shopping:0.20, health:0.10, other:0.10 };
const SK = {
  balance:   'alhaya_balance',
  income:    'alhaya_income',
  incomeVar: 'alhaya_income_variable',
  rate:      'alhaya_rate',
  expenses:  'alhaya_expenses',
  recurring: 'alhaya_recurring',
  goal:      'alhaya_goal',
  adjustments:'alhaya_adjustments',
  settings:  'alhaya_settings',
  recProc:   'alhaya_recurring_processed',
};

/* ═══════════════════════════════════════════ STATE HELPERS */
const ls = {
  get: (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch { return def; } },
  set: (k, v)  => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const getBalance    = () => ls.get(SK.balance, 0);
const setBalance    = v  => ls.set(SK.balance, +v);
const getIncome     = () => ls.get(SK.income, 0);
const setIncome     = v  => ls.set(SK.income, +v);
const getRate       = () => ls.get(SK.rate, 89500);
const setRate       = v  => ls.set(SK.rate, +v);
const getExpenses   = () => ls.get(SK.expenses, []);
const setExpenses   = v  => ls.set(SK.expenses, v);
const getRecurring  = () => ls.get(SK.recurring, []);
const setRecurring  = v  => ls.set(SK.recurring, v);
const getGoal       = () => ls.get(SK.goal, null);
const setGoal       = v  => ls.set(SK.goal, v);
const getAdjustments= () => ls.get(SK.adjustments, []);
const setAdjustments= v  => ls.set(SK.adjustments, v);
const getIncomeVar  = () => ls.get(SK.incomeVar, []);
const setIncomeVar  = v  => ls.set(SK.incomeVar, v);
const getSettings   = () => ls.get(SK.settings, { onboarded:false, notifPermission:'default', lastMonthTransition:null, lastRateUpdate:null });
const setSettings   = v  => ls.set(SK.settings, v);
const getRecProc    = () => ls.get(SK.recProc, []);
const setRecProc    = v  => ls.set(SK.recProc, v);

/* ═══════════════════════════════════════════ UTILITY FUNCTIONS */
function formatAmount(amount, currency) {
  if (currency === 'LBP') {
    return 'ل.ل ' + Math.round(Math.abs(amount)).toLocaleString('en-US');
  }
  return '$' + Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

function formatUSD(amount) { return formatAmount(amount, 'USD'); }

function toUSD(amount, currency) {
  if (currency === 'USD') return amount;
  return amount / getRate();
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,6);
}

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function isToday(ts) {
  const d = new Date(ts), t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}

function isYesterday(ts) {
  const d = new Date(ts);
  const y = new Date(); y.setDate(y.getDate() - 1);
  return d.getDate() === y.getDate() && d.getMonth() === y.getMonth() && d.getFullYear() === y.getFullYear();
}

function isSameMonth(ts, year, month) {
  const d = new Date(ts);
  return d.getFullYear() === year && d.getMonth() === month;
}

function isLastDayOfMonth() {
  const now = new Date();
  return now.getDate() === getDaysInMonth(now.getFullYear(), now.getMonth());
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true });
}

function formatDateLabel(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

function getSpendableBudget() {
  const income = getIncome();
  const goal = getGoal();
  const goalTarget = goal ? (goal.target || 0) : 0;
  const recurringTotal = getRecurring().reduce((s, r) => s + toUSD(r.amount, r.currency), 0);
  return Math.max(0, income - goalTarget - recurringTotal);
}

function getCategoryLimit(cat) {
  const goal = getGoal();
  if (goal && goal.categoryLimits && goal.categoryLimits[cat] != null) {
    return goal.categoryLimits[cat];
  }
  return getSpendableBudget() * DEFAULT_SPLITS[cat];
}

function getMonthlySpend(year, month) {
  const now = new Date();
  const y = year !== undefined ? year : now.getFullYear();
  const m = month !== undefined ? month : now.getMonth();
  const expenses = getExpenses();
  return expenses
    .filter(e => isSameMonth(e.timestamp, y, m))
    .reduce((s, e) => s + toUSD(e.amount, e.currency), 0);
}

function getCategorySpend(cat, year, month) {
  const now = new Date();
  const y = year !== undefined ? year : now.getFullYear();
  const m = month !== undefined ? month : now.getMonth();
  return getExpenses()
    .filter(e => e.category === cat && isSameMonth(e.timestamp, y, m))
    .reduce((s, e) => s + toUSD(e.amount, e.currency), 0);
}

function getTodaySpend() {
  return getExpenses()
    .filter(e => isToday(e.timestamp))
    .reduce((s, e) => s + toUSD(e.amount, e.currency), 0);
}

function getDailyLimit() {
  const now = new Date();
  const todayDay = now.getDate();
  const daysInMonth = getDaysInMonth(now.getFullYear(), now.getMonth());
  const daysRemaining = daysInMonth - todayDay + 1;
  const income = getIncome();
  const goal = getGoal();
  const goalTarget = goal ? (goal.target || 0) : 0;
  const futureRecurring = getRecurring().reduce((s, r) => {
    return r.dayOfMonth > todayDay ? s + toUSD(r.amount, r.currency) : s;
  }, 0);
  if (daysRemaining <= 0) return 0;
  return Math.max(0, (income - goalTarget - futureRecurring) / daysRemaining);
}

function getActualSavings() {
  const now = new Date();
  const spent = getMonthlySpend(now.getFullYear(), now.getMonth());
  return getIncome() - spent;
}

/* ═══════════════════════════════════════════ MONTH TRANSITION */
function processMonthTransition() {
  const settings = getSettings();
  const currentKey = getMonthKey();
  if (settings.lastMonthTransition === currentKey) return false;

  const income = getIncome();
  setBalance(getBalance() + income);
  settings.lastMonthTransition = currentKey;
  setSettings(settings);

  const banner = document.getElementById('month-banner');
  const bannerText = document.getElementById('month-banner-text');
  const monthName = new Date().toLocaleString('en-US', { month: 'long' });
  bannerText.textContent = `🎉 ${monthName} started — ${formatUSD(income)} credited`;
  banner.classList.remove('hidden');

  notifyNewMonth(income);
  return true;
}

/* ═══════════════════════════════════════════ RECURRING PROCESSING */
function processRecurring() {
  const now = new Date();
  const todayDay = now.getDate();
  const monthKey = getMonthKey();
  const recurring = getRecurring();
  const processed = getRecProc();
  const expenses = getExpenses();
  let changed = false;

  for (const rec of recurring) {
    if (rec.dayOfMonth > todayDay) continue;
    const alreadyDone = processed.some(p => p.id === rec.id && p.month === monthKey);
    if (alreadyDone) continue;

    const ts = new Date(now.getFullYear(), now.getMonth(), rec.dayOfMonth, 8, 0, 0).getTime();
    const entry = {
      id: generateId(),
      amount: rec.amount,
      currency: rec.currency,
      category: rec.category,
      note: rec.name,
      date: new Date(ts).toISOString().split('T')[0],
      timestamp: ts,
      isRecurring: true,
      recurringId: rec.id,
    };
    expenses.push(entry);
    setBalance(getBalance() - toUSD(rec.amount, rec.currency));
    processed.push({ id: rec.id, month: monthKey });

    const dayBefore = new Date(now.getFullYear(), now.getMonth(), rec.dayOfMonth - 1);
    const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dayBefore.getTime() === today0.getTime()) {
      notifyRecurringTomorrow(rec);
    }

    changed = true;
  }

  if (changed) {
    setExpenses(expenses);
    setRecProc(processed);
  }
}

/* ═══════════════════════════════════════════ MONTH-END NOTIFICATION */
function checkMonthEnd() {
  if (isLastDayOfMonth()) {
    const goal = getGoal();
    if (goal) {
      const saved = getActualSavings();
      const settings = getSettings();
      const key = 'monthend_' + getMonthKey();
      if (!settings[key]) {
        if (saved >= goal.target) {
          sendNotification(`Savings goal met! 🎉`, `You saved ${formatUSD(saved)} this month toward "${goal.name}". Target was ${formatUSD(goal.target)}.`);
        } else {
          sendNotification(`Month ending`, `You saved ${formatUSD(Math.max(0,saved))} this month toward "${goal.name}". Target was ${formatUSD(goal.target)}.`);
        }
        settings[key] = true;
        setSettings(settings);
      }
    }
  }
}

/* ═══════════════════════════════════════════ TAB NAVIGATION */
let activeTab = 'add';

function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  const content = document.getElementById(`tab-${tab}`);
  const nav = document.getElementById(`nav-${tab}`);
  if (content) content.classList.add('active');
  if (nav) nav.classList.add('active');
  activeTab = tab;

  if (tab === 'timeline') renderTimeline();
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'plan') renderPlan();
  if (tab === 'settings') renderSettings();
}

/* ═══════════════════════════════════════════ LBP INPUT STATE */
let lbpDigits = '';
let addCurrency = 'USD';
let selectedCat = '';
let pendingDelete = null;

function getLBPAmount() { return parseInt(lbpDigits || '0') * 1000; }
function getAddAmount() {
  if (addCurrency === 'LBP') return getLBPAmount();
  return parseFloat(document.getElementById('amount-input').value.replace(/[^0-9.]/g,'')) || 0;
}

function updateLBPDisplay(numberId) {
  const amount = getLBPAmount();
  const el = document.getElementById(numberId);
  if (el) el.textContent = amount === 0 ? '0' : amount.toLocaleString('en-US');
}

function updateAddButton() {
  const amount = getAddAmount();
  const btn = document.getElementById('btn-add-expense');
  btn.disabled = !(amount > 0 && selectedCat);
}

/* ═══════════════════════════════════════════ RENDER: ADD TAB */
function renderAddCategoryStatus() {
  const statusCard = document.getElementById('category-budget-status');
  const bar = document.getElementById('category-budget-bar');
  const label = document.getElementById('category-budget-label');
  const pct = document.getElementById('cat-status-pct');
  const lbl = document.getElementById('cat-status-label');
  if (!selectedCat) { statusCard.classList.add('hidden'); return; }
  const limit = getCategoryLimit(selectedCat);
  const spent = getCategorySpend(selectedCat);
  const ratio = limit > 0 ? Math.min(spent / limit, 1.2) : 0;
  const pctNum = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  statusCard.classList.remove('hidden');
  lbl.textContent = CATS[selectedCat] ? CATS[selectedCat].icon + ' ' + CATS[selectedCat].label : selectedCat;
  pct.textContent = `${pctNum}%`;
  pct.style.color = pctNum >= 100 ? 'var(--danger)' : pctNum >= 90 ? 'var(--warning)' : 'var(--accent)';
  bar.style.width = `${Math.min(ratio * 100, 100)}%`;
  bar.className = 'progress-bar-fill';
  if (pctNum >= 100) bar.classList.add('red');
  else if (pctNum >= 90) bar.classList.add('warn');
  label.textContent = `${formatUSD(spent)} spent of ${formatUSD(limit)} limit`;
  label.style.color = pctNum >= 100 ? 'var(--danger)' : pctNum >= 90 ? 'var(--warning)' : 'var(--text-sec)';
}

/* ═══════════════════════════════════════════ RENDER: TIMELINE */
function getAllTimelineItems() {
  const items = [];
  getExpenses().forEach(e => items.push({ ...e, _type: 'expense' }));
  getIncomeVar().forEach(e => items.push({ ...e, _type: 'income' }));
  getAdjustments().forEach(e => items.push({ ...e, _type: 'adjustment' }));
  return items.sort((a, b) => b.timestamp - a.timestamp);
}

function renderTimeline() {
  const list = document.getElementById('timeline-list');
  const empty = document.getElementById('timeline-empty');
  const searchVal = (document.getElementById('search-input').value || '').toLowerCase();
  const activeFilter = document.querySelector('.filter-chip.active')?.dataset.filter || 'all';

  let items = getAllTimelineItems();

  if (searchVal) {
    items = items.filter(e => (e.note || '').toLowerCase().includes(searchVal) || (e.category || '').toLowerCase().includes(searchVal));
  }
  if (activeFilter !== 'all') {
    if (activeFilter === 'recurring') {
      items = items.filter(e => e.isRecurring);
    } else {
      items = items.filter(e => e.category === activeFilter || e._type === activeFilter);
    }
  }

  if (!items.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const groups = [];
  let curGroup = null;
  for (const item of items) {
    let label;
    if (isToday(item.timestamp)) label = 'Today';
    else if (isYesterday(item.timestamp)) label = 'Yesterday';
    else label = formatDateLabel(item.timestamp);
    if (!curGroup || curGroup.label !== label) {
      curGroup = { label, items: [] };
      groups.push(curGroup);
    }
    curGroup.items.push(item);
  }

  list.innerHTML = groups.map(g => `
    <div class="tl-group-label">${g.label}</div>
    ${g.items.map(item => renderTimelineItem(item)).join('')}
  `).join('');

  list.querySelectorAll('.tl-item-wrap').forEach(wrap => {
    attachSwipeToDelete(wrap);
    wrap.querySelector('.tl-item').addEventListener('click', e => {
      if (e.target.closest('.tl-delete-bg')) return;
      openEditModal(wrap.dataset.id);
    });
  });
}

function renderTimelineItem(item) {
  let icon, catName, amountStr, amountClass;
  if (item._type === 'income') {
    icon = '💚'; catName = 'Income'; amountClass = 'income';
    amountStr = '+' + formatAmount(item.amount, item.currency || 'USD');
  } else if (item._type === 'adjustment') {
    icon = '⚖️'; catName = 'Adjustment'; amountClass = 'adjustment';
    const sign = item.sign >= 0 ? '+' : '-';
    amountStr = sign + formatUSD(Math.abs(item.amount));
  } else {
    const cat = CATS[item.category] || { icon: '●', label: item.category };
    icon = cat.icon; catName = cat.label; amountClass = 'expense';
    amountStr = formatAmount(item.amount, item.currency);
  }
  const recurBadge = item.isRecurring ? '<span class="tl-recurring-badge">🔁</span>' : '';
  const noteHtml = item.note ? `<span class="tl-note-text">${escHtml(item.note)}</span>` : '';
  const catKey = item._type === 'income' ? 'income' : item._type === 'adjustment' ? 'adjustment' : (item.category || 'other');
  return `
    <div class="tl-item-wrap" data-id="${item.id}">
      <div class="tl-delete-bg">Delete</div>
      <div class="tl-item">
        <div class="tl-item-inner">
          <div class="tl-cat-icon" data-cat="${catKey}">${icon}</div>
          <div class="tl-meta">
            <div class="tl-cat-name">${escHtml(catName)}${recurBadge}</div>
            ${noteHtml}
          </div>
          <div class="tl-amounts">
            <span class="tl-amount ${amountClass}">${amountStr}</span>
            <span class="tl-time">${formatTime(item.timestamp)}</span>
          </div>
        </div>
      </div>
    </div>`;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ═══════════════════════════════════════════ SWIPE TO DELETE */
function attachSwipeToDelete(wrap) {
  const item = wrap.querySelector('.tl-item');
  let startX, startY, swiping = false, revealed = false;
  let longPressTimer;

  wrap.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    swiping = false;
    longPressTimer = setTimeout(() => {
      openEditModal(wrap.dataset.id);
    }, 600);
  }, { passive: true });

  wrap.addEventListener('touchmove', e => {
    clearTimeout(longPressTimer);
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!swiping && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) swiping = true;
    if (!swiping) return;
    if (dx < 0) {
      e.preventDefault();
      const offset = Math.max(dx, -82);
      item.style.transition = 'none';
      item.style.transform = `translateX(${offset}px)`;
    }
  }, { passive: false });

  wrap.addEventListener('touchend', e => {
    clearTimeout(longPressTimer);
    if (!swiping) return;
    item.style.transition = '';
    const dx = e.changedTouches[0].clientX - startX;
    if (dx < -60) {
      item.style.transform = 'translateX(-82px)';
      revealed = true;
      wrap.querySelector('.tl-delete-bg').onclick = () => commitDelete(wrap.dataset.id, wrap);
    } else {
      item.style.transform = '';
      revealed = false;
    }
    swiping = false;
  }, { passive: true });
}

function commitDelete(id, wrap) {
  const allItems = getAllTimelineItems();
  const item = allItems.find(e => e.id === id);
  if (!item) return;

  deleteItemFromStorage(id, item._type);
  if (item._type === 'expense') {
    setBalance(getBalance() + toUSD(item.amount, item.currency));
  } else if (item._type === 'income') {
    setBalance(getBalance() - toUSD(item.amount, item.currency || 'USD'));
  } else if (item._type === 'adjustment') {
    setBalance(getBalance() - (item.amount * item.sign));
  }

  if (pendingDelete) {
    clearTimeout(pendingDelete.timeout);
    pendingDelete = null;
  }

  wrap.style.maxHeight = wrap.offsetHeight + 'px';
  wrap.style.overflow = 'hidden';
  wrap.style.transition = 'max-height 0.3s ease, opacity 0.3s ease';
  requestAnimationFrame(() => {
    wrap.style.maxHeight = '0';
    wrap.style.opacity = '0';
  });

  const timeout = setTimeout(() => { pendingDelete = null; }, 4000);
  pendingDelete = { item, timeout, wrap };

  showUndoToast('Expense deleted', () => {
    clearTimeout(pendingDelete.timeout);
    restoreDeletedItem(pendingDelete.item);
    pendingDelete = null;
    renderTimeline();
  }, 4000);

  setTimeout(() => renderTimeline(), 320);
}

function deleteItemFromStorage(id, type) {
  if (type === 'expense') setExpenses(getExpenses().filter(e => e.id !== id));
  else if (type === 'income') setIncomeVar(getIncomeVar().filter(e => e.id !== id));
  else if (type === 'adjustment') setAdjustments(getAdjustments().filter(e => e.id !== id));
}

function restoreDeletedItem(item) {
  const amountUSD = item._type === 'expense' ? toUSD(item.amount, item.currency) :
                    item._type === 'income'   ? toUSD(item.amount, item.currency || 'USD') :
                    (item.amount * item.sign);
  if (item._type === 'expense') {
    const arr = getExpenses(); arr.push(item); setExpenses(arr);
    setBalance(getBalance() - amountUSD);
  } else if (item._type === 'income') {
    const arr = getIncomeVar(); arr.push(item); setIncomeVar(arr);
    setBalance(getBalance() + amountUSD);
  } else if (item._type === 'adjustment') {
    const arr = getAdjustments(); arr.push(item); setAdjustments(arr);
    setBalance(getBalance() + amountUSD);
  }
}

/* ═══════════════════════════════════════════ RENDER: DASHBOARD */
function renderDashboard() {
  const balance = getBalance();
  const income = getIncome();
  const heroEl = document.getElementById('hero-balance');
  heroEl.textContent = formatUSD(balance);
  heroEl.className = 'balance-hero-amount';
  if (income > 0) {
    if (balance >= income * 0.2) heroEl.classList.add('healthy');
    else heroEl.classList.add('low');
  }

  const todaySpend = getTodaySpend();
  const dailyLimit = getDailyLimit();
  document.getElementById('daily-spent-label').textContent = formatUSD(todaySpend);
  document.getElementById('daily-limit-label').textContent = formatUSD(dailyLimit);
  const dailyFill = document.getElementById('daily-progress-fill');
  const dailyRatio = dailyLimit > 0 ? Math.min(todaySpend / dailyLimit, 1) : 0;
  dailyFill.style.width = `${dailyRatio * 100}%`;
  dailyFill.className = 'progress-bar-fill';
  if (todaySpend > dailyLimit && dailyLimit > 0) dailyFill.classList.add('red');
  else if (dailyRatio > 0.8) dailyFill.classList.add('warn');

  const now = new Date();
  document.getElementById('monthly-total-label').textContent = formatUSD(getMonthlySpend());

  const goal = getGoal();
  const actualSavings = getActualSavings();
  const savFill = document.getElementById('savings-progress-fill');
  if (goal) {
    document.getElementById('savings-actual-label').textContent = formatUSD(Math.max(0, actualSavings));
    document.getElementById('savings-target-label').textContent = formatUSD(goal.target);
    const ratio = goal.target > 0 ? Math.min(Math.max(actualSavings,0) / goal.target, 1) : 0;
    savFill.style.width = `${ratio * 100}%`;
  } else {
    document.getElementById('savings-actual-label').textContent = formatUSD(Math.max(0,actualSavings));
    document.getElementById('savings-target-label').textContent = '—';
    savFill.style.width = '0%';
  }

  renderCategoryBars();
  renderLastMonth();
  renderInsights();
}

function renderCategoryBars() {
  const container = document.getElementById('category-bars');
  const html = Object.entries(CATS).map(([cat, info]) => {
    const limit = getCategoryLimit(cat);
    const spent = getCategorySpend(cat);
    const ratio = limit > 0 ? Math.min(spent / limit, 1) : 0;
    const pct = Math.round(ratio * 100);
    let fillClass = '';
    if (pct >= 100) fillClass = 'danger';
    else if (pct >= 90) fillClass = 'warning';
    return `
      <div class="cat-bar-row">
        <span class="cat-bar-icon">${info.icon}</span>
        <span class="cat-bar-label">${info.label}</span>
        <div class="cat-bar-track">
          <div class="cat-bar-fill ${fillClass}" style="width:${ratio*100}%"></div>
        </div>
        <span class="cat-bar-pct">${pct}%</span>
      </div>`;
  }).join('');
  container.innerHTML = html;
}

function renderLastMonth() {
  const now = new Date();
  let lmYear = now.getFullYear(), lmMonth = now.getMonth() - 1;
  if (lmMonth < 0) { lmMonth = 11; lmYear--; }
  const spent = getMonthlySpend(lmYear, lmMonth);
  const income = getIncome();
  const net = income - spent;
  document.getElementById('last-month-spent').textContent = formatUSD(spent);
  document.getElementById('last-month-income').textContent = formatUSD(income);
  const netEl = document.getElementById('last-month-net');
  netEl.textContent = (net >= 0 ? '+' : '') + formatUSD(net);
  netEl.style.color = net >= 0 ? 'var(--accent)' : 'var(--danger)';

  let topCat = '—', topSpend = 0;
  for (const cat of Object.keys(CATS)) {
    const s = getCategorySpend(cat, lmYear, lmMonth);
    if (s > topSpend) { topSpend = s; topCat = CATS[cat].icon + ' ' + CATS[cat].label; }
  }
  document.getElementById('last-month-top-cat').textContent = topCat;
}

function renderInsights() {
  const now = new Date();
  const expenses = getExpenses().filter(e => isSameMonth(e.timestamp, now.getFullYear(), now.getMonth()));

  let topCat = '—', topCatSpend = 0;
  for (const cat of Object.keys(CATS)) {
    const s = getCategorySpend(cat);
    if (s > topCatSpend) { topCatSpend = s; topCat = CATS[cat].icon + ' ' + CATS[cat].label; }
  }
  document.getElementById('insight-top-cat-val').textContent = topCat || '—';

  let weekendSpend = 0, weekdaySpend = 0;
  for (const e of expenses) {
    const day = new Date(e.timestamp).getDay();
    const usd = toUSD(e.amount, e.currency);
    if (day === 0 || day === 6) weekendSpend += usd;
    else weekdaySpend += usd;
  }
  const totalSpend = weekendSpend + weekdaySpend;
  const wePct = totalSpend > 0 ? Math.round((weekendSpend / totalSpend) * 100) : 0;
  document.getElementById('insight-weekend-val').textContent = `${wePct}% of total`;

  const weekStart = new Date(); weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0,0,0,0);
  const weekExpenses = expenses.filter(e => e.timestamp >= weekStart.getTime());
  const byDay = {};
  for (const e of weekExpenses) {
    const d = new Date(e.timestamp).toDateString();
    byDay[d] = (byDay[d] || 0) + toUSD(e.amount, e.currency);
  }
  let bigDay = '—', bigDayAmt = 0;
  for (const [d, amt] of Object.entries(byDay)) {
    if (amt > bigDayAmt) { bigDayAmt = amt; bigDay = new Date(d).toLocaleDateString('en-US', { weekday:'short' }); }
  }
  document.getElementById('insight-expensive-day-val').textContent = bigDay === '—' ? '—' : `${bigDay} · ${formatUSD(bigDayAmt)}`;

  const goal = getGoal();
  if (goal) {
    const saved = getActualSavings();
    const onTrack = saved >= goal.target * (now.getDate() / getDaysInMonth(now.getFullYear(), now.getMonth()));
    document.getElementById('insight-savings-track-val').textContent = onTrack ? '✅ On track' : '⚠️ Behind';
    document.getElementById('insight-savings-track-val').style.color = onTrack ? 'var(--accent)' : 'var(--warning)';
  } else {
    document.getElementById('insight-savings-track-val').textContent = 'No goal set';
  }
}

/* ═══════════════════════════════════════════ RENDER: PLAN */
function renderPlan() {
  const goal = getGoal();
  const goalEmpty = document.getElementById('goal-empty-state');
  const goalActive = document.getElementById('goal-active-state');

  if (goal) {
    goalEmpty.classList.add('hidden');
    goalActive.classList.remove('hidden');
    document.getElementById('goal-name-display').textContent = goal.name;
    document.getElementById('goal-target-display').textContent = formatUSD(goal.target);
    document.getElementById('spendable-display').textContent = formatUSD(getSpendableBudget());
    const limitsEl = document.getElementById('category-limits-display');
    limitsEl.innerHTML = Object.entries(CATS).map(([cat, info]) => {
      const limit = getCategoryLimit(cat);
      return `<div class="cat-limit-row">
        <div class="cat-limit-left"><span>${info.icon}</span><span>${info.label}</span></div>
        <span>${formatUSD(limit)}</span>
      </div>`;
    }).join('');
  } else {
    goalEmpty.classList.remove('hidden');
    goalActive.classList.add('hidden');
  }

  renderRecurringList();
}

function renderRecurringList() {
  const list = document.getElementById('recurring-list');
  const empty = document.getElementById('recurring-empty');
  const recurring = getRecurring();
  if (!recurring.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  list.innerHTML = recurring.map(r => {
    const now = new Date();
    let nextDay = r.dayOfMonth;
    let nextMonth = now.getMonth(), nextYear = now.getFullYear();
    if (nextDay < now.getDate()) { nextMonth++; if (nextMonth > 11) { nextMonth = 0; nextYear++; } }
    const nextDate = new Date(nextYear, nextMonth, nextDay);
    const nextStr = nextDate.toLocaleDateString('en-US', { month:'short', day:'numeric' });
    const cat = CATS[r.category] || { icon:'●', label:r.category };
    return `<div class="recurring-item" data-rec-id="${r.id}">
      <div class="rec-item-main">
        <div class="rec-item-name">${cat.icon} ${escHtml(r.name)}</div>
        <div class="rec-item-detail">${cat.label} · Next: ${nextStr}</div>
      </div>
      <div class="rec-item-right">
        <div class="rec-item-amount">${formatAmount(r.amount, r.currency)}</div>
        <div class="rec-item-day">day ${r.dayOfMonth}</div>
      </div>
      <button class="btn-rec-edit" data-rec-id="${r.id}">Edit</button>
    </div>`;
  }).join('');

  list.querySelectorAll('.btn-rec-edit').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openRecurringModal(btn.dataset.recId);
    });
  });
}

/* ═══════════════════════════════════════════ RENDER: SETTINGS */
function renderSettings() {
  document.getElementById('setting-balance-val').textContent = formatUSD(getBalance());
  document.getElementById('setting-income-val').textContent = formatUSD(getIncome());
  const rate = getRate();
  document.getElementById('setting-rate-val').textContent = `${rate.toLocaleString('en-US')} LBP`;
  const settings = getSettings();
  const rateUpdated = document.getElementById('setting-rate-updated');
  rateUpdated.textContent = settings.lastRateUpdate ? `Last updated: ${new Date(settings.lastRateUpdate).toLocaleDateString()}` : 'Last updated: —';
}

/* ═══════════════════════════════════════════ ADD EXPENSE HANDLER */
function handleAddExpense() {
  const amount = getAddAmount();
  if (!amount || amount <= 0 || !selectedCat) return;
  const note = document.getElementById('note-input').value.trim();
  const now = Date.now();
  const entry = {
    id: generateId(),
    amount,
    currency: addCurrency,
    category: selectedCat,
    note,
    date: new Date().toISOString().split('T')[0],
    timestamp: now,
    isRecurring: false,
  };
  const expenses = getExpenses();
  expenses.push(entry);
  setExpenses(expenses);
  setBalance(getBalance() - toUSD(amount, addCurrency));

  checkCategoryWarning(selectedCat);

  if (navigator.vibrate) navigator.vibrate(10);
  const btn = document.getElementById('btn-add-expense');
  btn.classList.add('flash');
  setTimeout(() => btn.classList.remove('flash'), 500);

  resetAddForm();
  showToast(`Added ${formatAmount(amount, addCurrency)} to ${CATS[selectedCat]?.label || selectedCat}`);
}

function resetAddForm() {
  document.getElementById('amount-input').value = '';
  lbpDigits = '';
  updateLBPDisplay('lbp-number');
  selectedCat = '';
  document.querySelectorAll('#category-grid .cat-chip').forEach(c => c.classList.remove('selected'));
  document.getElementById('note-input').value = '';
  document.getElementById('category-budget-status').classList.add('hidden');
  updateAddButton();
}

function checkCategoryWarning(cat) {
  const limit = getCategoryLimit(cat);
  const spent = getCategorySpend(cat);
  const pct = limit > 0 ? (spent / limit) * 100 : 0;
  if (pct >= 100) {
    sendNotification('Budget exceeded', `${CATS[cat]?.label} is over budget (${Math.round(pct)}%)`);
  } else if (pct >= 90) {
    sendNotification('Budget warning', `${CATS[cat]?.label} is at ${Math.round(pct)}% of budget`);
  }
}

/* ═══════════════════════════════════════════ MODAL: INCOME */
function openIncomeModal() {
  document.getElementById('income-amount-input').value = '';
  document.getElementById('income-note-input').value = '';
  openModal('income-modal');
  setTimeout(() => document.getElementById('income-amount-input').focus(), 300);
}

function handleSaveIncome() {
  const amount = parseFloat(document.getElementById('income-amount-input').value) || 0;
  if (!amount || amount <= 0) return;
  const note = document.getElementById('income-note-input').value.trim();
  const now = Date.now();
  const entry = { id: generateId(), amount, currency: 'USD', note, timestamp: now, date: new Date().toISOString().split('T')[0] };
  const arr = getIncomeVar(); arr.push(entry); setIncomeVar(arr);
  setBalance(getBalance() + amount);
  closeModal('income-modal');
  showToast(`+ ${formatUSD(amount)} income added`);
  if (activeTab === 'timeline') renderTimeline();
}

/* ═══════════════════════════════════════════ MODAL: EDIT EXPENSE */
let editingId = null;
let editCurrency = 'USD';
let editLBPDigits = '';
let editSelectedCat = '';

function openEditModal(id) {
  const allItems = getAllTimelineItems();
  const item = allItems.find(e => e.id === id);
  if (!item || item._type !== 'expense') return;
  editingId = id;
  editCurrency = item.currency || 'USD';
  editSelectedCat = item.category || '';
  editLBPDigits = '';

  const usdArea = document.getElementById('edit-usd-area');
  const lbpArea = document.getElementById('edit-lbp-area');
  document.getElementById('edit-btn-usd').classList.toggle('active', editCurrency === 'USD');
  document.getElementById('edit-btn-lbp').classList.toggle('active', editCurrency === 'LBP');

  if (editCurrency === 'LBP') {
    usdArea.classList.add('hidden');
    lbpArea.classList.remove('hidden');
    editLBPDigits = String(Math.round(item.amount / 1000));
    document.getElementById('edit-lbp-number').textContent = item.amount.toLocaleString('en-US');
  } else {
    usdArea.classList.remove('hidden');
    lbpArea.classList.add('hidden');
    document.getElementById('edit-amount-input').value = item.amount.toFixed(2);
  }

  document.querySelectorAll('#edit-category-grid .cat-chip').forEach(c => {
    c.classList.toggle('selected', c.dataset.cat === editSelectedCat);
  });
  document.getElementById('edit-note-input').value = item.note || '';
  openModal('edit-modal');
}

function handleSaveEdit() {
  if (!editingId) return;
  let amount;
  if (editCurrency === 'LBP') {
    amount = parseInt(editLBPDigits || '0') * 1000;
  } else {
    amount = parseFloat(document.getElementById('edit-amount-input').value) || 0;
  }
  if (!amount || amount <= 0 || !editSelectedCat) return;

  const expenses = getExpenses();
  const idx = expenses.findIndex(e => e.id === editingId);
  if (idx === -1) return;

  const old = expenses[idx];
  const oldUSD = toUSD(old.amount, old.currency);
  const newUSD = toUSD(amount, editCurrency);
  setBalance(getBalance() + oldUSD - newUSD);

  expenses[idx] = { ...old, amount, currency: editCurrency, category: editSelectedCat, note: document.getElementById('edit-note-input').value.trim() };
  setExpenses(expenses);
  closeModal('edit-modal');
  renderTimeline();
}

/* ═══════════════════════════════════════════ MODAL: ADJUST BALANCE */
let adjustSign = 1;

function openAdjustModal() {
  document.getElementById('adjust-amount-input').value = '';
  document.getElementById('adjust-note-input').value = '';
  adjustSign = 1;
  document.getElementById('btn-adjust-plus').classList.add('active');
  document.getElementById('btn-adjust-minus').classList.remove('active');
  openModal('adjust-modal');
  setTimeout(() => document.getElementById('adjust-amount-input').focus(), 300);
}

function handleSaveAdjust() {
  const amount = parseFloat(document.getElementById('adjust-amount-input').value) || 0;
  if (!amount || amount <= 0) return;
  const note = document.getElementById('adjust-note-input').value.trim();
  const delta = amount * adjustSign;
  const entry = { id: generateId(), amount, sign: adjustSign, note, timestamp: Date.now() };
  const arr = getAdjustments(); arr.push(entry); setAdjustments(arr);
  setBalance(getBalance() + delta);
  closeModal('adjust-modal');
  renderDashboard();
  showToast(`Balance ${adjustSign > 0 ? 'increased' : 'decreased'} by ${formatUSD(amount)}`);
}

/* ═══════════════════════════════════════════ MODAL: RECURRING */
let editingRecId = null;
let recCurrency = 'USD';

function openRecurringModal(recId = null) {
  editingRecId = recId;
  recCurrency = 'USD';
  document.getElementById('recurring-modal-title').textContent = recId ? 'Edit Recurring' : 'Add Recurring Expense';
  document.getElementById('rec-btn-usd').classList.add('active');
  document.getElementById('rec-btn-lbp').classList.remove('active');
  document.getElementById('rec-amount-sym').textContent = '$';

  if (recId) {
    const rec = getRecurring().find(r => r.id === recId);
    if (!rec) return;
    recCurrency = rec.currency;
    document.getElementById('rec-name-input').value = rec.name;
    document.getElementById('rec-amount-input').value = rec.amount;
    document.getElementById('rec-category-select').value = rec.category;
    document.getElementById('rec-day-input').value = rec.dayOfMonth;
    document.getElementById('rec-btn-usd').classList.toggle('active', recCurrency === 'USD');
    document.getElementById('rec-btn-lbp').classList.toggle('active', recCurrency === 'LBP');
    document.getElementById('rec-amount-sym').textContent = recCurrency === 'USD' ? '$' : 'ل.ل';
  } else {
    document.getElementById('rec-name-input').value = '';
    document.getElementById('rec-amount-input').value = '';
    document.getElementById('rec-category-select').value = 'food';
    document.getElementById('rec-day-input').value = '';
  }
  openModal('recurring-modal');
}

function handleSaveRecurring() {
  const name = document.getElementById('rec-name-input').value.trim();
  const amount = parseFloat(document.getElementById('rec-amount-input').value) || 0;
  const category = document.getElementById('rec-category-select').value;
  const dayOfMonth = parseInt(document.getElementById('rec-day-input').value);
  if (!name || !amount || !dayOfMonth || dayOfMonth < 1 || dayOfMonth > 28) {
    showToast('Please fill all fields (day must be 1–28)');
    return;
  }
  const recurring = getRecurring();
  if (editingRecId) {
    const idx = recurring.findIndex(r => r.id === editingRecId);
    if (idx !== -1) recurring[idx] = { ...recurring[idx], name, amount, currency: recCurrency, category, dayOfMonth };
  } else {
    recurring.push({ id: generateId(), name, amount, currency: recCurrency, category, dayOfMonth });
  }
  setRecurring(recurring);
  closeModal('recurring-modal');
  renderPlan();
  showToast(editingRecId ? 'Recurring updated' : 'Recurring expense added');
}

/* ═══════════════════════════════════════════ MODAL: GOAL */
let goalModalEditing = false;

function openGoalModal() {
  goalModalEditing = !!getGoal();
  document.getElementById('goal-modal-title').textContent = goalModalEditing ? 'Edit Savings Goal' : 'Set Savings Goal';
  const goal = getGoal();
  if (goal) {
    document.getElementById('goal-name-input').value = goal.name || '';
    document.getElementById('goal-target-input').value = goal.target || '';
  } else {
    document.getElementById('goal-name-input').value = '';
    document.getElementById('goal-target-input').value = '';
  }
  updateGoalModal();
  openModal('goal-modal');
}

function updateGoalModal() {
  const target = parseFloat(document.getElementById('goal-target-input').value) || 0;
  const recurringTotal = getRecurring().reduce((s, r) => s + toUSD(r.amount, r.currency), 0);
  const spendable = Math.max(0, getIncome() - target - recurringTotal);
  document.getElementById('goal-spendable-preview').textContent = `Spendable budget: ${formatUSD(spendable)}`;

  const goal = getGoal();
  const cats = ['food','transport','bills','shopping','health','other'];
  const defaults = cats.reduce((acc, cat) => {
    acc[cat] = goal?.categoryLimits?.[cat] ?? spendable * DEFAULT_SPLITS[cat];
    return acc;
  }, {});

  cats.forEach(cat => {
    const inp = document.getElementById(`goal-${cat}-input`);
    if (inp && (inp.dataset.userSet !== 'true')) {
      inp.value = defaults[cat].toFixed(2);
    }
  });

  validateGoalAllocations(spendable);
}

function validateGoalAllocations(spendable) {
  const cats = ['food','transport','bills','shopping','health','other'];
  const total = cats.reduce((s, cat) => {
    return s + (parseFloat(document.getElementById(`goal-${cat}-input`)?.value) || 0);
  }, 0);
  const diff = total - spendable;
  const error = document.getElementById('goal-alloc-error');
  const saveBtn = document.getElementById('btn-goal-save');
  const totalEl = document.getElementById('goal-alloc-total');
  totalEl.textContent = formatUSD(total);
  if (Math.abs(diff) < 0.02) {
    error.classList.add('hidden');
    error.textContent = '';
    saveBtn.disabled = false;
  } else {
    const msg = diff > 0 ? `$${diff.toFixed(2)} over` : `$${Math.abs(diff).toFixed(2)} unallocated`;
    error.textContent = msg;
    error.classList.remove('hidden');
    saveBtn.disabled = true;
  }
}

function handleSaveGoal() {
  const name = document.getElementById('goal-name-input').value.trim();
  const target = parseFloat(document.getElementById('goal-target-input').value) || 0;
  if (!name || !target) { showToast('Please fill goal name and target'); return; }
  const cats = ['food','transport','bills','shopping','health','other'];
  const categoryLimits = {};
  cats.forEach(cat => {
    categoryLimits[cat] = parseFloat(document.getElementById(`goal-${cat}-input`)?.value) || 0;
  });
  setGoal({ name, target, categoryLimits });
  closeModal('goal-modal');
  renderPlan();
  showToast('Savings goal saved');
}

function deleteGoal() {
  openConfirmModal('Delete Goal', `Delete the goal "${getGoal()?.name}"? Category budgets will reset to defaults.`, () => {
    setGoal(null);
    renderPlan();
    showToast('Goal deleted');
  });
}

/* ═══════════════════════════════════════════ MODAL: SETTINGS EDIT */
let settingsEditAction = '';

function openSettingsEditModal(action) {
  settingsEditAction = action;
  const titleMap = { 'edit-balance':'Edit Balance', 'edit-income':'Edit Monthly Income', 'edit-rate':'Edit Exchange Rate' };
  const prefixMap = { 'edit-balance':'$', 'edit-income':'$', 'edit-rate':'ل.ل' };
  const valMap = {
    'edit-balance': getBalance().toFixed(2),
    'edit-income': getIncome().toFixed(2),
    'edit-rate': getRate(),
  };
  document.getElementById('settings-edit-title').textContent = titleMap[action] || 'Edit';
  document.getElementById('settings-edit-prefix').textContent = prefixMap[action] || '$';
  const inp = document.getElementById('settings-edit-input');
  inp.value = valMap[action] || '';
  inp.inputMode = action === 'edit-rate' ? 'numeric' : 'decimal';
  openModal('settings-edit-modal');
  setTimeout(() => inp.focus(), 300);
}

function handleSaveSettingsEdit() {
  const val = parseFloat(document.getElementById('settings-edit-input').value) || 0;
  if (settingsEditAction === 'edit-balance') {
    const diff = val - getBalance();
    setBalance(val);
    if (diff !== 0) {
      const arr = getAdjustments();
      arr.push({ id:generateId(), amount:Math.abs(diff), sign:diff > 0 ? 1 : -1, note:'Manual balance correction', timestamp:Date.now() });
      setAdjustments(arr);
    }
    showToast(`Balance set to ${formatUSD(val)}`);
  } else if (settingsEditAction === 'edit-income') {
    setIncome(val);
    showToast(`Monthly income updated to ${formatUSD(val)}`);
  } else if (settingsEditAction === 'edit-rate') {
    if (val <= 0) return;
    setRate(val);
    const s = getSettings(); s.lastRateUpdate = Date.now(); setSettings(s);
    showToast(`Rate updated: 1 USD = ${val.toLocaleString()} LBP`);
  }
  closeModal('settings-edit-modal');
  renderSettings();
}

/* ═══════════════════════════════════════════ MODAL: CONFIRM */
let confirmCallback = null;

function openConfirmModal(title, message, onConfirm) {
  confirmCallback = onConfirm;
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  openModal('confirm-modal');
}

/* ═══════════════════════════════════════════ MODAL HELPERS */
function openModal(id) {
  document.getElementById('modal-backdrop').classList.remove('hidden');
  document.getElementById(id).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  document.getElementById('modal-backdrop').classList.add('hidden');
  document.body.style.overflow = '';
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  document.getElementById('modal-backdrop').classList.add('hidden');
  document.body.style.overflow = '';
}

/* ═══════════════════════════════════════════ TOASTS */
function showToast(message, duration = 2500) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 250);
  }, duration);
}

function showUndoToast(message, onUndo, duration = 4000) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.position = 'relative';
  el.style.overflow = 'hidden';
  el.innerHTML = `<span>${escHtml(message)}</span><button class="toast-undo-btn">Undo</button>`;
  const bar = document.createElement('div');
  bar.className = 'toast-timer-bar';
  bar.style.animationDuration = duration + 'ms';
  el.appendChild(bar);

  el.querySelector('.toast-undo-btn').addEventListener('click', () => {
    onUndo();
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 250);
  });

  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 250);
  }, duration);
}

/* ═══════════════════════════════════════════ EXPORT / IMPORT */
function exportCSV() {
  const rows = [['Date','Time','Type','Category','Amount','Currency','Note']];
  getAllTimelineItems().forEach(e => {
    rows.push([
      new Date(e.timestamp).toLocaleDateString('en-US'),
      formatTime(e.timestamp),
      e._type,
      e.category || '',
      e.amount,
      e.currency || 'USD',
      e.note || '',
    ]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadFile('alhaya-export.csv', csv, 'text/csv');
}

function exportJSON() {
  const data = {};
  Object.values(SK).forEach(k => {
    const v = localStorage.getItem(k);
    if (v !== null) data[k] = JSON.parse(v);
  });
  downloadFile('alhaya-backup.json', JSON.stringify(data, null, 2), 'application/json');
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
      showToast('Backup restored. Reloading…');
      setTimeout(() => location.reload(), 1500);
    } catch {
      showToast('Invalid backup file');
    }
  };
  reader.readAsText(file);
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════ NOTIFICATIONS */
function sendNotification(title, body) {
  if (Notification.permission !== 'granted') return;
  try { new Notification(title, { body, icon: 'icon.jpeg' }); } catch {}
}

function notifyNewMonth(income) {
  sendNotification('New month started 🎉', `${formatUSD(income)} has been credited to your balance`);
}

function notifyRecurringTomorrow(rec) {
  sendNotification(`${rec.name} hits tomorrow`, `${formatAmount(rec.amount, rec.currency)} will be deducted from your balance`);
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'default') return;
  const result = await Notification.requestPermission();
  const s = getSettings(); s.notifPermission = result; setSettings(s);
}

/* ═══════════════════════════════════════════ SERVICE WORKER */
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./service-worker.js').then(reg => {
    reg.update();
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          document.getElementById('update-banner').classList.remove('hidden');
        }
      });
    });
  });
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) { refreshing = true; location.reload(); }
  });
}

/* ═══════════════════════════════════════════ WELCOME FLOW */
let welcomeStep = 1;

function showWelcomeModal() {
  document.getElementById('welcome-overlay').classList.remove('hidden');
}

function goWelcomeStep(n) {
  document.querySelectorAll('.welcome-step').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.step-dot').forEach(d => d.classList.toggle('active', parseInt(d.dataset.step) === n));
  document.getElementById(`welcome-step-${n}`).classList.add('active');
  welcomeStep = n;
}

function finishWelcome() {
  const balance = parseFloat(document.getElementById('welcome-balance-input').value) || 0;
  const income  = parseFloat(document.getElementById('welcome-income-input').value) || 0;
  const rate    = parseFloat(document.getElementById('welcome-rate-input').value) || 89500;
  setBalance(balance);
  setIncome(income);
  setRate(rate);
  const settings = getSettings();
  settings.onboarded = true;
  settings.lastMonthTransition = getMonthKey();
  settings.lastRateUpdate = Date.now();
  setSettings(settings);
  document.getElementById('welcome-overlay').classList.add('hidden');
  showApp();
  setTimeout(requestNotificationPermission, 5000);
}

/* ═══════════════════════════════════════════ SHOW APP */
function showApp() {
  document.getElementById('app').classList.remove('hidden');
  processMonthTransition();
  processRecurring();
  checkMonthEnd();
  switchTab('add');
}

/* ═══════════════════════════════════════════ EVENT WIRING */
function wireEvents() {
  /* Nav */
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  /* Month banner */
  document.getElementById('btn-month-banner-dismiss').addEventListener('click', () => {
    document.getElementById('month-banner').classList.add('hidden');
  });

  /* SW update */
  document.getElementById('btn-sw-refresh').addEventListener('click', () => {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg?.waiting) reg.waiting.postMessage({ type:'SKIP_WAITING' });
    });
  });

  /* ADD TAB — currency toggle */
  document.getElementById('btn-usd').addEventListener('click', () => {
    addCurrency = 'USD';
    document.getElementById('btn-usd').classList.add('active');
    document.getElementById('btn-lbp').classList.remove('active');
    document.getElementById('usd-mode-area').classList.remove('hidden');
    document.getElementById('lbp-mode-area').classList.add('hidden');
    updateAddButton();
  });
  document.getElementById('btn-lbp').addEventListener('click', () => {
    addCurrency = 'LBP';
    document.getElementById('btn-lbp').classList.add('active');
    document.getElementById('btn-usd').classList.remove('active');
    document.getElementById('lbp-mode-area').classList.remove('hidden');
    document.getElementById('usd-mode-area').classList.add('hidden');
    document.getElementById('lbp-capture').focus();
    updateAddButton();
  });

  /* USD amount input */
  document.getElementById('amount-input').addEventListener('input', updateAddButton);

  /* LBP display tap → focus capture */
  document.getElementById('lbp-display-wrap').addEventListener('click', () => {
    document.getElementById('lbp-capture').focus();
  });

  /* LBP capture keydown (desktop) */
  document.getElementById('lbp-capture').addEventListener('keydown', e => {
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      if (lbpDigits.length < 9) { lbpDigits += e.key; updateLBPDisplay('lbp-number'); updateAddButton(); }
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      lbpDigits = lbpDigits.slice(0,-1);
      updateLBPDisplay('lbp-number');
      updateAddButton();
    }
  });

  /* LBP capture input (mobile) */
  document.getElementById('lbp-capture').addEventListener('input', e => {
    const val = e.target.value.replace(/\D/g,'');
    e.target.value = '';
    if (val) {
      for (const ch of val) {
        if (lbpDigits.length < 9) lbpDigits += ch;
      }
      updateLBPDisplay('lbp-number');
      updateAddButton();
    }
  });

  /* Quick amount buttons */
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const qa = parseInt(btn.dataset.amount);
      if (addCurrency === 'LBP') {
        const cur = parseInt(lbpDigits || '0');
        lbpDigits = String(cur + qa);
        updateLBPDisplay('lbp-number');
      } else {
        const inp = document.getElementById('amount-input');
        const cur = parseFloat(inp.value) || 0;
        inp.value = (cur + qa).toFixed(2);
      }
      updateAddButton();
    });
  });

  /* Category chips */
  document.querySelectorAll('#category-grid .cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#category-grid .cat-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      selectedCat = chip.dataset.cat;
      renderAddCategoryStatus();
      updateAddButton();
    });
  });

  /* Add expense */
  document.getElementById('btn-add-expense').addEventListener('click', handleAddExpense);

  /* Income entry */
  document.getElementById('btn-income-entry').addEventListener('click', openIncomeModal);
  document.getElementById('btn-income-save').addEventListener('click', handleSaveIncome);
  document.getElementById('btn-income-cancel').addEventListener('click', () => closeModal('income-modal'));

  /* Timeline search & filter */
  document.getElementById('search-input').addEventListener('input', renderTimeline);
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderTimeline();
    });
  });

  /* Dashboard hero tap → adjust */
  document.getElementById('hero-balance').addEventListener('click', openAdjustModal);
  document.getElementById('btn-adjust-save').addEventListener('click', handleSaveAdjust);
  document.getElementById('btn-adjust-cancel').addEventListener('click', () => closeModal('adjust-modal'));
  document.getElementById('btn-adjust-plus').addEventListener('click', () => {
    adjustSign = 1;
    document.getElementById('btn-adjust-plus').classList.add('active');
    document.getElementById('btn-adjust-minus').classList.remove('active');
  });
  document.getElementById('btn-adjust-minus').addEventListener('click', () => {
    adjustSign = -1;
    document.getElementById('btn-adjust-minus').classList.add('active');
    document.getElementById('btn-adjust-plus').classList.remove('active');
  });

  /* Last month collapsible */
  document.getElementById('last-month-toggle').addEventListener('click', () => {
    const content = document.getElementById('last-month-content');
    const arrow = document.getElementById('last-month-arrow');
    content.classList.toggle('hidden');
    arrow.classList.toggle('open');
  });

  /* Plan tab */
  document.getElementById('btn-set-goal').addEventListener('click', openGoalModal);
  document.getElementById('btn-edit-goal').addEventListener('click', openGoalModal);
  document.getElementById('btn-delete-goal').addEventListener('click', deleteGoal);
  document.getElementById('btn-add-recurring').addEventListener('click', () => openRecurringModal());

  /* Goal modal */
  document.getElementById('goal-target-input').addEventListener('input', () => {
    document.querySelectorAll('.goal-cat-input').forEach(i => i.dataset.userSet = 'false');
    updateGoalModal();
  });
  document.querySelectorAll('.goal-cat-input').forEach(inp => {
    inp.addEventListener('input', () => {
      inp.dataset.userSet = 'true';
      const target = parseFloat(document.getElementById('goal-target-input').value) || 0;
      const recTotal = getRecurring().reduce((s,r) => s + toUSD(r.amount, r.currency), 0);
      validateGoalAllocations(Math.max(0, getIncome() - target - recTotal));
    });
  });
  document.getElementById('btn-goal-save').addEventListener('click', handleSaveGoal);
  document.getElementById('btn-goal-cancel').addEventListener('click', () => closeModal('goal-modal'));

  /* Recurring modal */
  document.getElementById('btn-rec-save').addEventListener('click', handleSaveRecurring);
  document.getElementById('btn-rec-cancel').addEventListener('click', () => closeModal('recurring-modal'));
  document.getElementById('rec-btn-usd').addEventListener('click', () => {
    recCurrency = 'USD';
    document.getElementById('rec-btn-usd').classList.add('active');
    document.getElementById('rec-btn-lbp').classList.remove('active');
    document.getElementById('rec-amount-sym').textContent = '$';
  });
  document.getElementById('rec-btn-lbp').addEventListener('click', () => {
    recCurrency = 'LBP';
    document.getElementById('rec-btn-lbp').classList.add('active');
    document.getElementById('rec-btn-usd').classList.remove('active');
    document.getElementById('rec-amount-sym').textContent = 'ل.ل';
  });

  /* Edit expense modal */
  document.getElementById('btn-edit-save').addEventListener('click', handleSaveEdit);
  document.getElementById('btn-edit-cancel').addEventListener('click', () => closeModal('edit-modal'));
  document.getElementById('edit-btn-usd').addEventListener('click', () => {
    editCurrency = 'USD';
    editLBPDigits = '';
    document.getElementById('edit-btn-usd').classList.add('active');
    document.getElementById('edit-btn-lbp').classList.remove('active');
    document.getElementById('edit-usd-area').classList.remove('hidden');
    document.getElementById('edit-lbp-area').classList.add('hidden');
  });
  document.getElementById('edit-btn-lbp').addEventListener('click', () => {
    editCurrency = 'LBP';
    document.getElementById('edit-btn-lbp').classList.add('active');
    document.getElementById('edit-btn-usd').classList.remove('active');
    document.getElementById('edit-lbp-area').classList.remove('hidden');
    document.getElementById('edit-usd-area').classList.add('hidden');
    document.getElementById('edit-lbp-capture').focus();
  });
  document.getElementById('edit-lbp-display-wrap').addEventListener('click', () => {
    document.getElementById('edit-lbp-capture').focus();
  });
  document.getElementById('edit-lbp-capture').addEventListener('keydown', e => {
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      if (editLBPDigits.length < 9) { editLBPDigits += e.key; document.getElementById('edit-lbp-number').textContent = (parseInt(editLBPDigits)*1000).toLocaleString('en-US'); }
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      editLBPDigits = editLBPDigits.slice(0,-1);
      document.getElementById('edit-lbp-number').textContent = (parseInt(editLBPDigits||'0')*1000).toLocaleString('en-US');
    }
  });
  document.getElementById('edit-lbp-capture').addEventListener('input', e => {
    const val = e.target.value.replace(/\D/g,'');
    e.target.value = '';
    if (val && editLBPDigits.length < 9) {
      editLBPDigits += val[val.length - 1];
      document.getElementById('edit-lbp-number').textContent = (parseInt(editLBPDigits)*1000).toLocaleString('en-US');
    }
  });
  document.querySelectorAll('#edit-category-grid .cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#edit-category-grid .cat-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      editSelectedCat = chip.dataset.cat;
    });
  });

  /* Settings */
  document.querySelectorAll('.btn-settings-edit').forEach(btn => {
    btn.addEventListener('click', () => openSettingsEditModal(btn.dataset.action));
  });
  document.getElementById('btn-settings-edit-save').addEventListener('click', handleSaveSettingsEdit);
  document.getElementById('btn-settings-edit-cancel').addEventListener('click', () => closeModal('settings-edit-modal'));
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
  document.getElementById('btn-export-json').addEventListener('click', exportJSON);
  document.getElementById('btn-import-json').addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', e => {
    if (e.target.files[0]) importJSON(e.target.files[0]);
    e.target.value = '';
  });

  /* Confirm modal */
  document.getElementById('btn-confirm-yes').addEventListener('click', () => {
    if (confirmCallback) { confirmCallback(); confirmCallback = null; }
    closeModal('confirm-modal');
  });
  document.getElementById('btn-confirm-no').addEventListener('click', () => closeModal('confirm-modal'));

  /* Backdrop click */
  document.getElementById('modal-backdrop').addEventListener('click', closeAllModals);

  /* Welcome */
  document.getElementById('btn-welcome-next-1').addEventListener('click', () => {
    const v = parseFloat(document.getElementById('welcome-balance-input').value);
    if (isNaN(v)) { document.getElementById('welcome-balance-input').focus(); return; }
    goWelcomeStep(2);
    setTimeout(() => document.getElementById('welcome-income-input').focus(), 200);
  });
  document.getElementById('btn-welcome-next-2').addEventListener('click', () => {
    const v = parseFloat(document.getElementById('welcome-income-input').value);
    if (isNaN(v)) { document.getElementById('welcome-income-input').focus(); return; }
    goWelcomeStep(3);
    setTimeout(() => document.getElementById('welcome-rate-input').focus(), 200);
  });
  document.getElementById('btn-welcome-finish').addEventListener('click', finishWelcome);

  document.getElementById('welcome-rate-input').addEventListener('input', e => {
    const v = parseFloat(e.target.value) || 0;
    document.getElementById('welcome-rate-preview').textContent = v.toLocaleString('en-US');
  });

  /* Allow pressing Enter on welcome inputs */
  document.getElementById('welcome-balance-input').addEventListener('keydown', e => e.key === 'Enter' && document.getElementById('btn-welcome-next-1').click());
  document.getElementById('welcome-income-input').addEventListener('keydown', e => e.key === 'Enter' && document.getElementById('btn-welcome-next-2').click());
  document.getElementById('welcome-rate-input').addEventListener('keydown', e => e.key === 'Enter' && document.getElementById('btn-welcome-finish').click());
}

/* ═══════════════════════════════════════════ BOOT */
const bootStart = Date.now();

function hideLanding() {
  const el = document.getElementById('loading-screen');
  el.classList.add('fade-out');
  setTimeout(() => { el.style.display = 'none'; }, 400);
  const settings = getSettings();
  if (!settings.onboarded) {
    showWelcomeModal();
  } else {
    showApp();
    setTimeout(requestNotificationPermission, 5000);
  }
}

window.addEventListener('load', () => {
  const elapsed = Date.now() - bootStart;
  const delay = Math.max(0, 1200 - elapsed);
  setTimeout(hideLanding, delay);
});

registerSW();
wireEvents();
