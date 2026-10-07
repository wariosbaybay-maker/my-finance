let balance = 0;
let transactions = [];
let goals = [];
let envelopes = [];
let reserves = [];
let categories = { expense: [], income: [] };
let currentCatTab = 'expense';

const DEFAULT_CATEGORIES = {
    expense: [
        { id: 'e1', name: 'Еда', icon: '🍔', color: '#e67e22' },
        { id: 'e2', name: 'Транспорт', icon: '🚌', color: '#3498db' },
        { id: 'e3', name: 'Развлечения', icon: '🎮', color: '#9b59b6' },
        { id: 'e4', name: 'Здоровье', icon: '💊', color: '#27ae60' },
        { id: 'e5', name: 'Сиги', icon: '🚬', color: '#7f8c8d' },
        { id: 'e6', name: 'Связь', icon: '📱', color: '#16a085' },
        { id: 'e7', name: 'Жильё', icon: '🏠', color: '#c0392b' },
        { id: 'e8', name: 'Одежда', icon: '👕', color: '#8e44ad' },
        { id: 'e9', name: 'Другое', icon: '📦', color: '#95a5a6' }
    ],
    income: [
        { id: 'i1', name: 'Зарплата', icon: '💼', color: '#27ae60' },
        { id: 'i2', name: 'Подработка', icon: '💻', color: '#3498db' },
        { id: 'i3', name: 'Подарок', icon: '🎁', color: '#e91e63' },
        { id: 'i4', name: 'Возврат долга', icon: '↩️', color: '#f39c12' },
        { id: 'i5', name: 'Другое', icon: '📦', color: '#95a5a6' }
    ]
};

const formatMoney = (n) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
const formatDate = (iso) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const formatPeriod = (from, to) => `${new Date(from).toLocaleDateString('ru-RU')} — ${new Date(to).toLocaleDateString('ru-RU')}`;
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// --- Сохранение ---
function saveData() {
    localStorage.setItem('financeData', JSON.stringify({ balance, transactions, goals, envelopes, reserves, categories, savedAt: new Date().toISOString() }));
    makeDailySnapshot();
}
function loadData() {
    const saved = localStorage.getItem('financeData');
    if (saved) {
        const data = JSON.parse(saved);
        balance = data.balance || 0;
        transactions = data.transactions || [];
        goals = data.goals || [];
        envelopes = data.envelopes || [];
        reserves = data.reserves || [];
        categories = data.categories || JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    } else {
        categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    }
    // Миграция: старые операции без категории → «Другое»
    transactions.forEach(tx => {
        if (!tx.categoryId) {
            const fallback = categories[tx.type] && categories[tx.type].find(c => c.name === 'Другое');
            tx.categoryId = fallback ? fallback.id : null;
        }
    });
}

function getCategoryById(type, id) {
    if (!categories[type]) return null;
    return categories[type].find(c => c.id === id) || null;
}

// --- Версионирование ---
const SNAPSHOT_KEY = 'financeSnapshots';
const MAX_SNAPSHOTS = 5;
const SNAPSHOT_INTERVAL_MS = 24 * 60 * 60 * 1000;

function makeDailySnapshot() {
    const snapshots = getSnapshots();
    const now = Date.now();
    const last = snapshots[snapshots.length - 1];
    if (last && now - new Date(last.date).getTime() < SNAPSHOT_INTERVAL_MS) return;
    const data = { balance, transactions, goals, envelopes, reserves, categories };
    snapshots.push({ date: new Date().toISOString(), data });
    while (snapshots.length > MAX_SNAPSHOTS) snapshots.shift();
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
}
function getSnapshots() {
    try { return JSON.parse(localStorage.getItem(SNAPSHOT_KEY)) || []; }
    catch { return []; }
}

window.showVersionHistory = () => {
    const list = document.getElementById('version-list');
    const snapshots = getSnapshots();
    if (snapshots.length === 0) {
        list.innerHTML = '<p class="empty-msg">Пока нет версий. Снимок создаётся при первом входе за день.</p>';
    } else {
        list.innerHTML = snapshots.slice().reverse().map((s, i) => {
            const realIdx = snapshots.length - 1 - i;
            const txCount = (s.data.transactions || []).length;
            return `
                <div class="version-item">
                    <div>
                        <div class="version-date">${new Date(s.date).toLocaleString('ru-RU')}</div>
                        <div class="version-meta">Баланс: ${formatMoney(s.data.balance || 0)} · Операций: ${txCount}</div>
                    </div>
                    <button class="version-restore" onclick="restoreSnapshot(${realIdx})">Восстановить</button>
                </div>
            `;
        }).join('');
    }
    document.getElementById('version-modal').style.display = 'flex';
};
window.closeVersionHistory = () => { document.getElementById('version-modal').style.display = 'none'; };
window.restoreSnapshot = (idx) => {
    const snapshots = getSnapshots();
    const snap = snapshots[idx];
    if (!snap) return;
    if (!confirm(`Восстановить данные от ${new Date(snap.date).toLocaleString('ru-RU')}?`)) return;
    balance = snap.data.balance || 0;
    transactions = snap.data.transactions || [];
    goals = snap.data.goals || [];
    envelopes = snap.data.envelopes || [];
    reserves = snap.data.reserves || [];
    if (snap.data.categories) categories = snap.data.categories;
    localStorage.setItem('financeData', JSON.stringify({ balance, transactions, goals, envelopes, reserves, categories, savedAt: new Date().toISOString() }));
    closeVersionHistory();
    render();
    alert('✅ Данные восстановлены');
};

// --- Бэкап ---
window.downloadBackup = () => {
    const data = { version: 2, exportedAt: new Date().toISOString(), balance, transactions, goals, envelopes, reserves, categories };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
};
window.uploadBackup = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!confirm('Загрузить данные из файла? Текущие данные будут заменены.')) return;
            balance = data.balance || 0;
            transactions = data.transactions || [];
            goals = data.goals || [];
            envelopes = data.envelopes || [];
            reserves = data.reserves || [];
            categories = data.categories || JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
            saveData(); render();
            alert('✅ Данные загружены');
        } catch (err) { alert('❌ Не удалось прочитать файл: ' + err.message); }
    };
    reader.readAsText(file);
    event.target.value = '';
};

const LAST_BACKUP_KEY = 'financeLastBackupReminder';
function checkBackupReminder() {
    const last = localStorage.getItem(LAST_BACKUP_KEY);
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;
    if (!last || now - parseInt(last) > week) {
        const hasData = transactions.length > 0 || goals.length > 0 || envelopes.length > 0 || reserves.length > 0;
        if (hasData) {
            setTimeout(() => {
                if (confirm('💾 Прошла неделя с последнего бэкапа. Скачать резервную копию?')) {
                    downloadBackup();
                    localStorage.setItem(LAST_BACKUP_KEY, now.toString());
                }
            }, 2000);
        }
    }
}

// --- Заполнение селектов категорий ---
function fillCategorySelects() {
    ['income', 'expense'].forEach(type => {
        const sel = document.getElementById(`${type}-category`);
        if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = categories[type].map(c =>
            `<option value="${c.id}">${c.icon} ${c.name}</option>`
        ).join('');
        if (prev && categories[type].find(c => c.id === prev)) sel.value = prev;
    });
}

// --- Управление категориями ---
window.showCategoriesManager = () => {
    renderCategoriesList();
    document.getElementById('categories-modal').style.display = 'flex';
};
window.closeCategoriesManager = () => {
    document.getElementById('categories-modal').style.display = 'none';
};
window.switchCatTab = (type) => {
    currentCatTab = type;
    document.getElementById('tab-expense').classList.toggle('active', type === 'expense');
    document.getElementById('tab-income').classList.toggle('active', type === 'income');
    document.getElementById('categories-list-expense').style.display = type === 'expense' ? 'flex' : 'none';
    document.getElementById('categories-list-income').style.display = type === 'income' ? 'flex' : 'none';
};

function renderCategoriesList() {
    ['expense', 'income'].forEach(type => {
        const list = document.getElementById(`categories-list-${type}`);
        list.innerHTML = categories[type].map(c => `
            <div class="category-item">
                <span class="category-icon">${c.icon}</span>
                <span class="category-name">${c.name}</span>
                <span class="category-color-dot" style="background:${c.color}"></span>
                <button class="cat-remove" onclick="removeCategory('${type}','${c.id}')" title="Удалить">×</button>
            </div>
        `).join('');
    });
}

window.addCategoryFromForm = () => {
    const icon = document.getElementById('cat-new-icon').value.trim() || '📦';
    const name = document.getElementById('cat-new-name').value.trim();
    const color = document.getElementById('cat-new-color').value;
    if (!name) { alert('Введи название'); return; }
    categories[currentCatTab].push({ id: generateId(), name, icon, color });
    document.getElementById('cat-new-icon').value = '';
    document.getElementById('cat-new-name').value = '';
    saveData();
    renderCategoriesList();
    fillCategorySelects();
};

window.removeCategory = (type, id) => {
    const cat = categories[type].find(c => c.id === id);
    if (!cat) return;
    const used = transactions.filter(tx => tx.categoryId === id).length;
    const msg = used > 0
        ? `Удалить категорию «${cat.name}»? Она используется в ${used} операциях — они перейдут в «Другое».`
        : `Удалить категорию «${cat.name}»?`;
    if (!confirm(msg)) return;

    categories[type] = categories[type].filter(c => c.id !== id);
    // Переназначаем операции на «Другое»
    const fallback = categories[type].find(c => c.name === 'Другое') || categories[type][0];
    if (fallback) {
        transactions.forEach(tx => {
            if (tx.categoryId === id) tx.categoryId = fallback.id;
        });
    }
    saveData();
    renderCategoriesList();
    fillCategorySelects();
    render();
};

// --- Рендер ---
function render() {
    const inEnv = envelopes.reduce((s, e) => s + e.limit, 0);
    const inGoals = goals.reduce((s, g) => s + g.saved, 0);
    const inRes = reserves.reduce((s, r) => s + (r.limit - r.spent), 0);
    document.getElementById('total-balance').textContent = formatMoney(balance);
    document.getElementById('in-envelopes').textContent = `В конвертах: ${formatMoney(inEnv)}`;
    document.getElementById('in-goals').textContent = `В целях: ${formatMoney(inGoals)}`;
    document.getElementById('in-reserves').textContent = `В резервах: ${formatMoney(inRes)}`;
    renderReserves();
    renderGoals();
    renderEnvelopes();
    renderTransactions();
}

function renderReserves() {
    const container = document.getElementById('reserves-list');
    if (reserves.length === 0) {
        container.innerHTML = '<p class="empty-msg">Пока нет обязательных резервов</p>';
        return;
    }
    const now = new Date();
    container.innerHTML = reserves.map(r => {
        const remaining = r.limit - r.spent;
        const progress = r.limit > 0 ? Math.min((r.spent / r.limit) * 100, 100) : 0;
        const over = r.spent > r.limit;
        const remClass = remaining > 0 ? 'positive' : (remaining < 0 ? 'negative' : 'zero');
        const expired = new Date(r.dateTo) < now;

        let warnBlock = '';
        if (expired) {
            warnBlock = `<div class="reserve-warn">⚠️ Период резерва истёк.</div>`;
        } else if (over) {
            warnBlock = `<div class="reserve-warn">⚠️ Ты превысил сумму резерва!</div>`;
        } else {
            warnBlock = `<div class="reserve-ok">✅ Осталось ${formatMoney(remaining)}</div>`;
        }

        return `
            <div class="reserve ${expired ? 'expired' : ''}">
                <div class="reserve-header">
                    <span class="reserve-name">🔒 ${r.name} ${expired ? '<small style="color:#e74c3c">(истёк)</small>' : ''}</span>
                    <span class="reserve-remaining ${remClass}">${formatMoney(remaining)}</span>
                </div>
                <div class="reserve-period">Период: ${formatPeriod(r.dateFrom, r.dateTo)}</div>
                <div class="reserve-stats">
                    <span>Зарезервировано: <strong>${formatMoney(r.limit)}</strong></span>
                    <span>Потрачено: <strong>${formatMoney(r.spent)}</strong></span>
                </div>
                <div class="progress-bar-bg"><div class="progress-bar-fill ${over ? 'over' : ''}" style="width: ${progress}%"></div></div>
                ${warnBlock}
                <div class="reserve-actions">
                    <button class="btn-spend-reserve" onclick="spendFromReserve('${r.id}')">💸 Потратить</button>
                    <button class="btn-refill-reserve" onclick="refillReserve('${r.id}')">➕ Пополнить</button>
                    <button class="btn-edit-reserve" onclick="editReserve('${r.id}')">✏️ Изменить</button>
                    <button class="btn-close-reserve" onclick="closeReserve('${r.id}')">✖ Закрыть</button>
                </div>
            </div>
        `;
    }).join('');
}

window.spendFromReserve = (id) => {
    const r = reserves.find(x => x.id === id);
    if (!r) return;
    const remaining = r.limit - r.spent;
    const amountStr = prompt(`Сколько потратили из «${r.name}»?\nДоступно: ${formatMoney(remaining)}`);
    if (amountStr === null) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;
    const desc = prompt('На что потратили?', 'Покупка') || 'Покупка';
    const fallback = categories.expense.find(c => c.name === 'Другое') || categories.expense[0];

    r.spent += amount;
    transactions.push({
        id: generateId(), type: 'expense', amount,
        desc: `${r.name}: ${desc}`, date: new Date().toISOString(),
        categoryId: fallback ? fallback.id : null
    });
    saveData(); render();
};

window.refillReserve = (id) => {
    const r = reserves.find(x => x.id === id);
    if (!r) return;
    const amountStr = prompt(`Сколько добавить в «${r.name}»?\nСвободно: ${formatMoney(balance)}`);
    if (amountStr === null) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;
    if (amount > balance) { alert('Недостаточно свободных денег!'); return; }
    balance -= amount; r.limit += amount;
    transactions.push({ id: generateId(), type: 'transfer', amount, desc: `Пополнение резерва «${r.name}»`, date: new Date().toISOString() });
    saveData(); render();
};

window.editReserve = (id) => {
    const r = reserves.find(x => x.id === id);
    if (!r) return;
    const newName = prompt('Название:', r.name);
    if (newName === null) return;
    const newLimitStr = prompt('Новая сумма резерва:', r.limit);
    if (newLimitStr === null) return;
    const newLimit = parseFloat(newLimitStr);
    if (isNaN(newLimit) || newLimit <= 0) return;
    const newFrom = prompt('Дата начала (ГГГГ-ММ-ДД):', r.dateFrom);
    if (newFrom === null) return;
    const newTo = prompt('Дата конца (ГГГГ-ММ-ДД):', r.dateTo);
    if (newTo === null) return;
    const diff = newLimit - r.limit;
    if (diff > 0) {
        if (diff > balance) { alert(`Недостаточно денег! Нужно ещё ${formatMoney(diff - balance)}`); return; }
        balance -= diff;
        transactions.push({ id: generateId(), type: 'transfer', amount: diff, desc: `Увеличение резерва «${newName}»`, date: new Date().toISOString() });
    } else if (diff < 0) {
        balance += Math.abs(diff);
        transactions.push({ id: generateId(), type: 'transfer', amount: Math.abs(diff), desc: `Уменьшение резерва «${newName}»`, date: new Date().toISOString() });
    }
    r.name = newName; r.limit = newLimit; r.dateFrom = newFrom; r.dateTo = newTo;
    saveData(); render();
};

window.closeReserve = (id) => {
    const r = reserves.find(x => x.id === id);
    if (!r) return;
    const remaining = r.limit - r.spent;
    if (!confirm(`Закрыть резерв «${r.name}»?\nОстаток ${formatMoney(remaining)} вернётся на баланс.`)) return;
    balance += remaining;
    transactions.push({ id: generateId(), type: 'transfer', amount: remaining, desc: `Закрытие резерва «${r.name}»`, date: new Date().toISOString() });
    reserves = reserves.filter(x => x.id !== id);
    saveData(); render();
};

function renderGoals() {
    const container = document.getElementById('goals-list');
    if (goals.length === 0) {
        container.innerHTML = '<p class="empty-msg">Пока нет целей</p>';
        return;
    }
    container.innerHTML = goals.map(g => {
        const remaining = g.target - g.saved;
        const progress = Math.min((g.saved / g.target) * 100, 100);
        const done = g.saved >= g.target;
        return `
            <div class="goal">
                <div class="goal-header">
                    <span class="goal-name">🎯 ${g.name}</span>
                    <span class="goal-sum">${formatMoney(g.saved)} / ${formatMoney(g.target)}</span>
                </div>
                <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${progress}%"></div></div>
                <div class="goal-stats">${done ? '✅ Цель достигнута!' : `Осталось накопить: <strong>${formatMoney(remaining)}</strong>`}</div>
                <div class="goal-actions">
                    <input type="number" id="dep-${g.id}" placeholder="Сумма" min="1" step="0.01">
                    <button class="btn-deposit" onclick="depositToGoal('${g.id}')">Отложить</button>
                    <button class="btn-close" onclick="closeGoal('${g.id}')">Забрать всё</button>
                </div>
            </div>
        `;
    }).join('');
}

window.depositToGoal = (id) => {
    const g = goals.find(x => x.id === id);
    if (!g) return;
    const input = document.getElementById(`dep-${id}`);
    const amount = parseFloat(input.value);
    if (isNaN(amount) || amount <= 0) { alert('Введи сумму'); return; }
    if (amount > balance) { alert(`Недостаточно свободных денег! Свободно: ${formatMoney(balance)}`); return; }
    balance -= amount; g.saved += amount;
    transactions.push({ id: generateId(), type: 'transfer', amount, desc: `В цель «${g.name}»`, date: new Date().toISOString() });
    input.value = ''; saveData(); render();
};

window.closeGoal = (id) => {
    const g = goals.find(x => x.id === id);
    if (!g) return;
    if (!confirm(`Забрать ${formatMoney(g.saved)} из цели «${g.name}» и удалить цель?`)) return;
    balance += g.saved;
    transactions.push({ id: generateId(), type: 'transfer', amount: g.saved, desc: `Возврат из цели «${g.name}»`, date: new Date().toISOString() });
    goals = goals.filter(x => x.id !== id);
    saveData(); render();
};

function renderEnvelopes() {
    const container = document.getElementById('envelopes-list');
    if (envelopes.length === 0) {
        container.innerHTML = '<p class="empty-msg">Пока нет конвертов</p>';
        return;
    }
    const now = new Date();
    container.innerHTML = envelopes.map(env => {
        const remaining = env.limit - env.spent;
        const progress = env.limit > 0 ? Math.min((env.spent / env.limit) * 100, 100) : 0;
        const over = env.spent > env.limit;
        const remClass = remaining > 0 ? 'positive' : (remaining < 0 ? 'negative' : 'zero');
        const expired = new Date(env.dateTo) < now;
        return `
            <div class="envelope ${expired ? 'expired' : ''}">
                <div class="envelope-header">
                    <span class="envelope-name">📁 ${env.name} ${expired ? '<small style="color:#e74c3c">(период истёк)</small>' : ''}</span>
                    <span class="envelope-remaining ${remClass}">${formatMoney(remaining)}</span>
                </div>
                <div class="envelope-period">Период: ${formatPeriod(env.dateFrom, env.dateTo)}</div>
                <div class="envelope-stats">
                    <span>Выделено: <strong>${formatMoney(env.limit)}</strong></span>
                    <span>Потрачено: <strong>${formatMoney(env.spent)}</strong></span>
                </div>
                <div class="progress-bar-bg"><div class="progress-bar-fill ${over ? 'over' : ''}" style="width: ${progress}%"></div></div>
                <div class="envelope-actions">
                    <button class="btn-spend" onclick="spendFromEnvelope('${env.id}')">💸 Потратить</button>
                    <button class="btn-refill" onclick="refillEnvelope('${env.id}')">➕ Пополнить</button>
                    <button class="btn-edit" onclick="editEnvelope('${env.id}')">✏️ Изменить</button>
                    <button class="btn-close" onclick="closeEnvelope('${env.id}')">✖ Закрыть</button>
                </div>
            </div>
        `;
    }).join('');
}

window.spendFromEnvelope = (id) => {
    const env = envelopes.find(x => x.id === id);
    if (!env) return;
    const remaining = env.limit - env.spent;
    const amountStr = prompt(`Сколько потратили из «${env.name}»?\nДоступно: ${formatMoney(remaining)}`);
    if (amountStr === null) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;
    const desc = prompt('На что потратили?', 'Покупка') || 'Покупка';
    const fallback = categories.expense.find(c => c.name === 'Другое') || categories.expense[0];
    env.spent += amount;
    transactions.push({
        id: generateId(), type: 'expense', amount,
        desc: `${env.name}: ${desc}`, date: new Date().toISOString(),
        categoryId: fallback ? fallback.id : null
    });
    saveData(); render();
};

window.refillEnvelope = (id) => {
    const env = envelopes.find(x => x.id === id);
    if (!env) return;
    const amountStr = prompt(`Сколько добавить в «${env.name}»?\nСвободно: ${formatMoney(balance)}`);
    if (amountStr === null) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;
    if (amount > balance) { alert('Недостаточно свободных денег!'); return; }
    balance -= amount; env.limit += amount;
    transactions.push({ id: generateId(), type: 'transfer', amount, desc: `Пополнение «${env.name}»`, date: new Date().toISOString() });
    saveData(); render();
};

window.editEnvelope = (id) => {
    const env = envelopes.find(x => x.id === id);
    if (!env) return;
    const newName = prompt('Название:', env.name);
    if (newName === null) return;
    const newLimitStr = prompt('Новая сумма на период:', env.limit);
    if (newLimitStr === null) return;
    const newLimit = parseFloat(newLimitStr);
    if (isNaN(newLimit) || newLimit <= 0) return;
    const newFrom = prompt('Дата начала (ГГГГ-ММ-ДД):', env.dateFrom);
    if (newFrom === null) return;
    const newTo = prompt('Дата конца (ГГГГ-ММ-ДД):', env.dateTo);
    if (newTo === null) return;
    const diff = newLimit - env.limit;
    if (diff > 0) {
        if (diff > balance) { alert(`Недостаточно денег! Нужно ещё ${formatMoney(diff - balance)}`); return; }
        balance -= diff;
        transactions.push({ id: generateId(), type: 'transfer', amount: diff, desc: `Увеличение «${newName}»`, date: new Date().toISOString() });
    } else if (diff < 0) {
        balance += Math.abs(diff);
        transactions.push({ id: generateId(), type: 'transfer', amount: Math.abs(diff), desc: `Уменьшение «${newName}»`, date: new Date().toISOString() });
    }
    env.name = newName; env.limit = newLimit; env.dateFrom = newFrom; env.dateTo = newTo;
    saveData(); render();
};

window.closeEnvelope = (id) => {
    const env = envelopes.find(x => x.id === id);
    if (!env) return;
    const remaining = env.limit - env.spent;
    if (!confirm(`Закрыть «${env.name}»?\nОстаток ${formatMoney(remaining)} вернётся на баланс.`)) return;
    balance += remaining;
    transactions.push({ id: generateId(), type: 'transfer', amount: remaining, desc: `Закрытие «${env.name}»`, date: new Date().toISOString() });
    envelopes = envelopes.filter(x => x.id !== id);
    saveData(); render();
};

function renderTransactions() {
    const container = document.getElementById('transactions-list');
    if (transactions.length === 0) {
        container.innerHTML = '<p class="empty-msg">Пока нет операций</p>';
        return;
    }
    const sorted = [...transactions].reverse();
    container.innerHTML = sorted.map(tx => {
        const sign = tx.type === 'income' ? '+' : (tx.type === 'expense' ? '-' : '');
        const cat = tx.categoryId ? getCategoryById(tx.type, tx.categoryId) : null;
        const catTag = cat ? `<span class="tx-category-tag" style="background:${cat.color}">${cat.icon} ${cat.name}</span>` : '';
        return `
            <div class="transaction-item ${tx.type}">
                <div class="tx-info">
                    <span class="tx-desc">${catTag}${tx.desc}</span>
                    <span class="tx-date">${formatDate(tx.date)}</span>
                </div>
                <div class="tx-right">
                    <span class="tx-amount ${tx.type}">${sign}${formatMoney(tx.amount)}</span>
                    <button class="delete-btn" onclick="deleteTransaction('${tx.id}')">×</button>
                </div>
            </div>
        `;
    }).join('');
}

window.deleteTransaction = (id) => {
    const idx = transactions.findIndex(t => t.id === id);
    if (idx === -1) return;
    if (!confirm('Удалить операцию из истории? Баланс не изменится.')) return;
    transactions.splice(idx, 1);
    saveData(); render();
};

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    fillCategorySelects();
    render();
    checkBackupReminder();

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    document.getElementById('env-date-from').value = firstDay;
    document.getElementById('env-date-to').value = lastDay;
    document.getElementById('reserve-date-from').value = firstDay;
    document.getElementById('reserve-date-to').value = lastDay;

    document.getElementById('income-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('income-amount').value);
        const desc = document.getElementById('income-desc').value.trim();
        const categoryId = document.getElementById('income-category').value;
        if (isNaN(amount) || amount <= 0 || !desc) return;
        balance += amount;
        transactions.push({ id: generateId(), type: 'income', amount, desc, date: new Date().toISOString(), categoryId });
        saveData(); render(); e.target.reset();
        fillCategorySelects();
    });

    document.getElementById('expense-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('expense-amount').value);
        const desc = document.getElementById('expense-desc').value.trim();
        const categoryId = document.getElementById('expense-category').value;
        if (isNaN(amount) || amount <= 0 || !desc) return;
        if (amount > balance) { alert(`Недостаточно денег! Свободно: ${formatMoney(balance)}`); return; }
        balance -= amount;
        transactions.push({ id: generateId(), type: 'expense', amount, desc, date: new Date().toISOString(), categoryId });
        saveData(); render(); e.target.reset();
        fillCategorySelects();
    });

    document.getElementById('reserve-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('reserve-name').value.trim();
        const limit = parseFloat(document.getElementById('reserve-amount').value);
        const dateFrom = document.getElementById('reserve-date-from').value;
        const dateTo = document.getElementById('reserve-date-to').value;
        if (!name || isNaN(limit) || limit <= 0) return;
        if (!dateFrom || !dateTo) { alert('Укажи период'); return; }
        if (new Date(dateTo) < new Date(dateFrom)) { alert('Дата конца раньше начала'); return; }
        if (limit > balance) { alert(`Недостаточно денег! Свободно: ${formatMoney(balance)}`); return; }
        balance -= limit;
        reserves.push({ id: generateId(), name, limit, spent: 0, dateFrom, dateTo });
        transactions.push({ id: generateId(), type: 'transfer', amount: limit, desc: `Создан резерв «${name}»`, date: new Date().toISOString() });
        saveData(); render(); e.target.reset();
        document.getElementById('reserve-date-from').value = firstDay;
        document.getElementById('reserve-date-to').value = lastDay;
    });

    document.getElementById('goal-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('goal-name').value.trim();
        const target = parseFloat(document.getElementById('goal-target').value);
        if (!name || isNaN(target) || target <= 0) return;
        goals.push({ id: generateId(), name, target, saved: 0 });
        saveData(); render(); e.target.reset();
    });

    document.getElementById('envelope-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('env-name').value.trim();
        const limit = parseFloat(document.getElementById('env-limit').value);
        const dateFrom = document.getElementById('env-date-from').value;
        const dateTo = document.getElementById('env-date-to').value;
        if (!name || isNaN(limit) || limit <= 0) return;
        if (!dateFrom || !dateTo) { alert('Укажи период'); return; }
        if (new Date(dateTo) < new Date(dateFrom)) { alert('Дата конца раньше начала'); return; }
        if (limit > balance) { alert(`Недостаточно денег! Свободно: ${formatMoney(balance)}`); return; }
        balance -= limit;
        envelopes.push({ id: generateId(), name, limit, spent: 0, dateFrom, dateTo });
        transactions.push({ id: generateId(), type: 'transfer', amount: limit, desc: `Создан конверт «${name}»`, date: new Date().toISOString() });
        saveData(); render(); e.target.reset();
        document.getElementById('env-date-from').value = firstDay;
        document.getElementById('env-date-to').value = lastDay;
    });
});
// ===== ЭТАП 3: ГРАФИКИ И АНАЛИТИКА =====
let currentPeriod = 'all';
let pieChart = null, barChart = null, lineChart = null;

window.setPeriod = (period) => {
    currentPeriod = period;
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.period === period);
    });
    updateAnalytics();
};

function getPeriodStart() {
    const now = new Date();
    switch (currentPeriod) {
        case 'month': return new Date(now.getFullYear(), now.getMonth(), 1);
        case 'quarter': return new Date(now.getFullYear(), now.getMonth() - 2, 1);
        case 'year': return new Date(now.getFullYear(), 0, 1);
        case 'all': return new Date(0);
    }
}

function filterTxByPeriod() {
    const start = getPeriodStart();
    return transactions.filter(tx => new Date(tx.date) >= start);
}

function updateAnalytics() {
    const tx = filterTxByPeriod();
    const expenseTx = tx.filter(t => t.type === 'expense');
    const incomeTx = tx.filter(t => t.type === 'income');

    // Стат-карточки
    const totalIncome = incomeTx.reduce((s, t) => s + t.amount, 0);
    const totalExpense = expenseTx.reduce((s, t) => s + t.amount, 0);

    // Средний расход в день (за период)
    const start = getPeriodStart();
    const end = new Date();
    const daysCount = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)));
    const avgDay = totalExpense / daysCount;

    // Прогноз до конца текущего месяца
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthExpense = transactions
        .filter(t => t.type === 'expense' && new Date(t.date) >= monthStart)
        .reduce((s, t) => s + t.amount, 0);
    const forecast = dayOfMonth > 0 ? (monthExpense / dayOfMonth) * daysInMonth : 0;

    document.getElementById('stat-avg-day').textContent = formatMoney(avgDay);
    document.getElementById('stat-forecast').textContent = formatMoney(forecast);
    document.getElementById('stat-income').textContent = formatMoney(totalIncome);
    document.getElementById('stat-expense').textContent = formatMoney(totalExpense);

    renderPieChart(expenseTx);
    renderBarChart();
    renderLineChart();
    renderTopExpenses(expenseTx);
}

function renderPieChart(expenseTx) {
    const byCategory = {};
    expenseTx.forEach(t => {
        const cat = t.categoryId ? getCategoryById('expense', t.categoryId) : null;
        const name = cat ? `${cat.icon} ${cat.name}` : 'Без категории';
        const color = cat ? cat.color : '#95a5a6';
        if (!byCategory[name]) byCategory[name] = { sum: 0, color };
        byCategory[name].sum += t.amount;
    });

    const labels = Object.keys(byCategory);
    const data = labels.map(l => byCategory[l].sum);
    const colors = labels.map(l => byCategory[l].color);

    const canvas = document.getElementById('pie-chart');
    const emptyEl = document.getElementById('pie-empty');

    if (pieChart) { pieChart.destroy(); pieChart = null; }

    if (labels.length === 0) {
        canvas.style.display = 'none';
        emptyEl.style.display = 'block';
        return;
    }
    canvas.style.display = 'block';
    emptyEl.style.display = 'none';

    pieChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: 'white' }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { font: { size: 12 }, padding: 10 } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const percent = ((ctx.parsed / total) * 100).toFixed(1);
                            return `${ctx.label}: ${formatMoney(ctx.parsed)} (${percent}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderBarChart() {
    // Последние 6 месяцев
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
            label: d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
            start: new Date(d.getFullYear(), d.getMonth(), 1),
            end: new Date(d.getFullYear(), d.getMonth() + 1, 1)
        });
    }

    const incomes = months.map(m =>
        transactions.filter(t => t.type === 'income' && new Date(t.date) >= m.start && new Date(t.date) < m.end)
            .reduce((s, t) => s + t.amount, 0)
    );
    const expenses = months.map(m =>
        transactions.filter(t => t.type === 'expense' && new Date(t.date) >= m.start && new Date(t.date) < m.end)
            .reduce((s, t) => s + t.amount, 0)
    );

    if (barChart) barChart.destroy();
    barChart = new Chart(document.getElementById('bar-chart'), {
        type: 'bar',
        data: {
            labels: months.map(m => m.label),
            datasets: [
                { label: 'Доход', data: incomes, backgroundColor: '#27ae60' },
                { label: 'Расход', data: expenses, backgroundColor: '#e74c3c' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatMoney(ctx.parsed.y)}` } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: (v) => formatMoney(v) } }
            }
        }
    });
}

function renderLineChart() {
    // Динамика баланса: идём от старых операций к новым
    const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    const start = getPeriodStart();

    let runningBalance = 0;
    // Считаем баланс на начало периода
    sorted.forEach(tx => {
        if (new Date(tx.date) < start) {
            if (tx.type === 'income') runningBalance += tx.amount;
            else if (tx.type === 'expense') runningBalance -= tx.amount;
            else if (tx.type === 'transfer') runningBalance -= tx.amount;
        }
    });

    const labels = [];
    const values = [];
    let current = runningBalance;

    // Группируем по дням
    const byDay = {};
    sorted.filter(tx => new Date(tx.date) >= start).forEach(tx => {
        const day = new Date(tx.date).toISOString().split('T')[0];
        if (!byDay[day]) byDay[day] = 0;
        if (tx.type === 'income') byDay[day] += tx.amount;
        else if (tx.type === 'expense') byDay[day] -= tx.amount;
        else if (tx.type === 'transfer') byDay[day] -= tx.amount;
    });

    Object.keys(byDay).sort().forEach(day => {
        current += byDay[day];
        labels.push(new Date(day).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }));
        values.push(current);
    });

    if (lineChart) lineChart.destroy();
    lineChart = new Chart(document.getElementById('line-chart'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Баланс',
                data: values,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52,152,219,0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => formatMoney(ctx.parsed.y) } }
            },
            scales: {
                y: { beginAtZero: false, ticks: { callback: (v) => formatMoney(v) } }
            }
        }
    });
}

function renderTopExpenses(expenseTx) {
    const container = document.getElementById('top-expenses');
    const top = [...expenseTx].sort((a, b) => b.amount - a.amount).slice(0, 5);
    if (top.length === 0) {
        container.innerHTML = '<p class="chart-empty">Нет трат за период</p>';
        return;
    }
    container.innerHTML = top.map(t => {
        const cat = t.categoryId ? getCategoryById('expense', t.categoryId) : null;
        const catTag = cat ? `<span class="tx-category-tag" style="background:${cat.color}">${cat.icon} ${cat.name}</span>` : '';
        return `
            <div class="top-item">
                <div class="top-item-info">
                    <span class="top-item-desc">${catTag}${t.desc}</span>
                    <span class="top-item-date">${formatDate(t.date)}</span>
                </div>
                <span class="top-item-amount">${formatMoney(t.amount)}</span>
            </div>
        `;
    }).join('');
}

// Переопределяем render(), чтобы аналитика обновлялась при любом изменении
const _originalRender = render;
render = function() {
    _originalRender();
    if (document.getElementById('stat-avg-day')) {
        updateAnalytics();
    }
};
// ===== ЭТАП 4: БЮДЖЕТ, РЕГУЛЯРНЫЕ, ДОЛГИ =====

// === БЮДЖЕТ НА МЕСЯЦ ===
function getBudget() {
    const saved = localStorage.getItem('financeBudget');
    return saved ? parseFloat(saved) : 0;
}
function saveBudget(amount) {
    if (amount > 0) localStorage.setItem('financeBudget', amount.toString());
    else localStorage.removeItem('financeBudget');
}

function renderBudget() {
    const container = document.getElementById('budget-status');
    if (!container) return;
    const budget = getBudget();
    const input = document.getElementById('budget-amount');
    if (input) input.value = budget > 0 ? budget : '';

    if (budget <= 0) {
        container.innerHTML = '<p class="empty-msg" style="padding:15px;">Лимит не задан. Введи сумму сверху, чтобы контролировать расходы за месяц.</p>';
        return;
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const spent = transactions
        .filter(t => t.type === 'expense' && new Date(t.date) >= monthStart)
        .reduce((s, t) => s + t.amount, 0);

    const remaining = budget - spent;
    const percent = Math.min((spent / budget) * 100, 100);
    const over = spent > budget;
    const warn = !over && percent >= 80;

    const stateClass = over ? 'over' : (warn ? 'warn' : 'ok');

    let warnBlock = '';
    if (over) {
        warnBlock = `<div class="budget-warning">⚠️ Ты превысил бюджет на ${formatMoney(spent - budget)}!</div>`;
    } else if (warn) {
        warnBlock = `<div class="budget-warning">⚠️ Ты использовал ${percent.toFixed(0)}% бюджета. Осталось ${formatMoney(remaining)}.</div>`;
    }

    container.innerHTML = `
        <div class="budget-header">
            <span class="budget-title">Лимит: ${formatMoney(budget)}</span>
            <span class="budget-numbers ${stateClass}">${formatMoney(spent)} / ${formatMoney(budget)}</span>
        </div>
        <div class="budget-progress-bg">
            <div class="budget-progress-fill ${over ? 'over' : (warn ? 'warn' : '')}" style="width: ${percent}%"></div>
        </div>
        <div class="budget-info">
            ${over
                ? `Перерасход: <strong>${formatMoney(spent - budget)}</strong>`
                : `Осталось до конца месяца: <strong>${formatMoney(remaining)}</strong>`}
        </div>
        ${warnBlock}
    `;
}

// === РЕГУЛЯРНЫЕ ПЛАТЕЖИ ===
function getRecurrings() {
    try { return JSON.parse(localStorage.getItem('financeRecurrings')) || []; }
    catch { return []; }
}
function saveRecurrings(list) {
    localStorage.setItem('financeRecurrings', JSON.stringify(list));
}
function getRecurringStatus() {
    // { id: 'YYYY-MM' } — когда последний раз отмечали оплату
    try { return JSON.parse(localStorage.getItem('financeRecurringStatus')) || {}; }
    catch { return {}; }
}
function saveRecurringStatus(s) {
    localStorage.setItem('financeRecurringStatus', JSON.stringify(s));
}

function renderRecurrings() {
    const container = document.getElementById('recurring-list');
    if (!container) return;
    const list = getRecurrings();
    if (list.length === 0) {
        container.innerHTML = '<p class="empty-msg">Пока нет регулярных платежей</p>';
        return;
    }
    const status = getRecurringStatus();
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const today = now.getDate();

    container.innerHTML = list.map(r => {
        const paid = status[r.id] === currentMonthKey;
        const daySoon = !paid && r.day <= today + 3 && r.day >= today;
        const overdue = !paid && r.day < today;

        let hint = '';
        if (paid) hint = '✅ Оплачено в этом месяце';
        else if (overdue) hint = `⚠️ Просрочено (день ${r.day})`;
        else if (daySoon) hint = `⏰ Скоро (день ${r.day})`;
        else hint = `📅 День ${r.day} каждого месяца`;

        return `
            <div class="recurring-item ${paid ? 'paid' : ''}">
                <div class="recurring-info">
                    <span class="recurring-name">${r.type === 'income' ? '💵' : '💸'} ${r.name}</span>
                    <span class="recurring-meta">${hint}</span>
                </div>
                <span class="recurring-amount ${r.type}">${r.type === 'income' ? '+' : '-'}${formatMoney(r.amount)}</span>
                <div class="recurring-actions">
                    ${paid
                        ? `<button class="btn-unpaid" onclick="unmarkRecurring('${r.id}')">Отменить</button>`
                        : `<button class="btn-mark-paid" onclick="markRecurringPaid('${r.id}')">✓ Отметить</button>`}
                    <button class="delete-btn" onclick="deleteRecurring('${r.id}')" title="Удалить">×</button>
                </div>
            </div>
        `;
    }).join('');
}

window.markRecurringPaid = (id) => {
    const list = getRecurrings();
    const r = list.find(x => x.id === id);
    if (!r) return;
    const status = getRecurringStatus();
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (r.type === 'expense') {
        if (r.amount > balance) { alert(`Недостаточно денег! Свободно: ${formatMoney(balance)}`); return; }
        balance -= r.amount;
    } else {
        balance += r.amount;
    }
    transactions.push({
        id: generateId(), type: r.type, amount: r.amount,
        desc: `${r.name} (регулярный)`, date: new Date().toISOString(),
        categoryId: null
    });
    status[r.id] = monthKey;
    saveRecurringStatus(status);
    saveData(); render();
};

window.unmarkRecurring = (id) => {
    const list = getRecurrings();
    const r = list.find(x => x.id === id);
    if (!r) return;
    if (!confirm(`Отменить отметку «${r.name}»? Операция вернётся обратно.`)) return;

    const status = getRecurringStatus();
    if (!status[r.id]) return;

    // Откатываем баланс
    if (r.type === 'expense') balance += r.amount;
    else balance -= r.amount;

    // Удаляем последнюю операцию с этим описанием
    const idx = [...transactions].reverse().findIndex(t =>
        t.desc === `${r.name} (регулярный)` && t.amount === r.amount
    );
    if (idx !== -1) {
        transactions.splice(transactions.length - 1 - idx, 1);
    }
    delete status[r.id];
    saveRecurringStatus(status);
    saveData(); render();
};

window.deleteRecurring = (id) => {
    if (!confirm('Удалить регулярный платёж?')) return;
    saveRecurrings(getRecurrings().filter(x => x.id !== id));
    const status = getRecurringStatus();
    delete status[id];
    saveRecurringStatus(status);
    renderRecurrings();
};

// === ДОЛГИ ===
function getDebts() {
    try { return JSON.parse(localStorage.getItem('financeDebts')) || []; }
    catch { return []; }
}
function saveDebts(list) {
    localStorage.setItem('financeDebts', JSON.stringify(list));
}

function renderDebts() {
    const container = document.getElementById('debts-list');
    if (!container) return;
    const list = getDebts();
    if (list.length === 0) {
        container.innerHTML = '<p class="empty-msg">Пока нет долгов</p>';
        return;
    }
    container.innerHTML = list.map(d => `
        <div class="debt-item ${d.direction}">
            <div class="debt-info">
                <span class="debt-person">${d.direction === 'iOwe' ? '→ ' : '← '}${d.person}</span>
                <span class="debt-desc">${d.desc || (d.direction === 'iOwe' ? 'Я должен' : 'Мне должны')} · ${formatDate(d.date)}</span>
            </div>
            <span class="debt-amount ${d.direction}">${formatMoney(d.amount)}</span>
            <div class="debt-actions">
                <button class="btn-close-debt" onclick="closeDebt('${d.id}')">Закрыть</button>
                <button class="delete-btn" onclick="deleteDebt('${d.id}')" title="Удалить">×</button>
            </div>
        </div>
    `).join('');
}

window.closeDebt = (id) => {
    const list = getDebts();
    const d = list.find(x => x.id === id);
    if (!d) return;
    const msg = d.direction === 'iOwe'
        ? `Закрыть долг «${d.person}»? С баланса спишется ${formatMoney(d.amount)}.`
        : `Получить долг от «${d.person}»? На баланс зачислится ${formatMoney(d.amount)}.`;
    if (!confirm(msg)) return;

    if (d.direction === 'iOwe') {
        if (d.amount > balance) { alert(`Недостаточно денег! Свободно: ${formatMoney(balance)}`); return; }
        balance -= d.amount;
        transactions.push({
            id: generateId(), type: 'expense', amount: d.amount,
            desc: `Возврат долга: ${d.person}`, date: new Date().toISOString(),
            categoryId: null
        });
    } else {
        balance += d.amount;
        transactions.push({
            id: generateId(), type: 'income', amount: d.amount,
            desc: `Возврат долга от: ${d.person}`, date: new Date().toISOString(),
            categoryId: null
        });
    }
    saveDebts(list.filter(x => x.id !== id));
    saveData(); render();
};

window.deleteDebt = (id) => {
    if (!confirm('Удалить долг без создания операции?')) return;
    saveDebts(getDebts().filter(x => x.id !== id));
    renderDebts();
};

// === ОБНОВЛЕНИЕ РЕНДЕРА ===
const _renderBeforeStage4 = render;
render = function() {
    _renderBeforeStage4();
    if (document.getElementById('budget-status')) {
        renderBudget();
        renderRecurrings();
        renderDebts();
    }
};

// === ИНИЦИАЛИЗАЦИЯ ФОРМ ЭТАПА 4 ===
document.addEventListener('DOMContentLoaded', () => {
    // Бюджет
    const budgetForm = document.getElementById('budget-form');
    if (budgetForm) {
        budgetForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const amount = parseFloat(document.getElementById('budget-amount').value);
            if (isNaN(amount) || amount <= 0) { alert('Введи сумму'); return; }
            saveBudget(amount);
            renderBudget();
        });
        document.getElementById('budget-clear-btn').addEventListener('click', () => {
            if (!confirm('Убрать лимит бюджета?')) return;
            saveBudget(0);
            renderBudget();
        });
    }

    // Регулярные
    const recForm = document.getElementById('recurring-form');
    if (recForm) {
        recForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('rec-name').value.trim();
            const amount = parseFloat(document.getElementById('rec-amount').value);
            const type = document.getElementById('rec-type').value;
            const day = parseInt(document.getElementById('rec-day').value);
            if (!name || isNaN(amount) || amount <= 0) return;
            const list = getRecurrings();
            list.push({ id: generateId(), name, amount, type, day });
            saveRecurrings(list);
            renderRecurrings();
            e.target.reset();
        });
    }

    // Долги
    const debtForm = document.getElementById('debt-form');
    if (debtForm) {
        debtForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const direction = document.getElementById('debt-direction').value;
            const person = document.getElementById('debt-person').value.trim();
            const amount = parseFloat(document.getElementById('debt-amount').value);
            const desc = document.getElementById('debt-desc').value.trim();
            if (!person || isNaN(amount) || amount <= 0) return;
            const list = getDebts();
            list.push({ id: generateId(), direction, person, amount, desc, date: new Date().toISOString() });
            saveDebts(list);
            renderDebts();
            e.target.reset();
        });
    }

    // Первый рендер
    renderBudget();
    renderRecurrings();
    renderDebts();
});
// ===== ЭТАП 5: УЛУЧШЕНИЯ ЦЕЛЕЙ =====

const GOAL_PRIORITY_LABEL = {
    high: { text: '🔥 Важная', cls: 'high' },
    normal: { text: '⭐ Обычная', cls: 'normal' },
    dream: { text: '💭 Мечта', cls: 'dream' }
};

// Сколько осталось дней до дедлайна
function daysUntil(dateStr) {
    if (!dateStr) return null;
    const now = new Date(); now.setHours(0,0,0,0);
    const target = new Date(dateStr); target.setHours(0,0,0,0);
    return Math.ceil((target - now) / (24 * 60 * 60 * 1000));
}

// Прогноз: когда достигну цель при текущем темпе
function forecastGoalDate(g) {
    // Используем дату создания цели и текущий накопленный процент
    if (!g.createdAt || g.saved <= 0) return null;
    const daysPassed = Math.max(1, (Date.now() - new Date(g.createdAt).getTime()) / (24 * 60 * 60 * 1000));
    const ratePerDay = g.saved / daysPassed;
    if (ratePerDay <= 0) return null;
    const daysLeft = (g.target - g.saved) / ratePerDay;
    if (!isFinite(daysLeft) || daysLeft <= 0) return null;
    const forecastDate = new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000);
    return forecastDate;
}

function renderGoalsImproved() {
    const container = document.getElementById('goals-list');
    if (!container) return;

    // Сортировка: high > normal > dream, внутри — по дате создания
    const priorityOrder = { high: 0, normal: 1, dream: 2 };
    const active = goals.filter(g => g.saved < g.target);
    const achieved = goals.filter(g => g.saved >= g.target);

    active.sort((a, b) => {
        const pa = priorityOrder[a.priority || 'normal'] ?? 1;
        const pb = priorityOrder[b.priority || 'normal'] ?? 1;
        if (pa !== pb) return pa - pb;
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    });

    if (active.length === 0) {
        container.innerHTML = '<p class="empty-msg">Нет активных целей</p>';
    } else {
        container.innerHTML = active.map(g => {
            const remaining = g.target - g.saved;
            const progress = Math.min((g.saved / g.target) * 100, 100);
            const prio = GOAL_PRIORITY_LABEL[g.priority || 'normal'];
            const icon = g.icon || '🎯';

            // Дедлайн
            let deadlineInfo = '';
            if (g.deadline) {
                const days = daysUntil(g.deadline);
                const monthlyNeed = days > 0 ? (remaining / (days / 30)) : remaining;
                if (days < 0) {
                    deadlineInfo = `<div class="goal-deadline-info">Дедлайн: <span class="overdue">просрочен на ${Math.abs(days)} дн.</span></div>`;
                } else if (days === 0) {
                    deadlineInfo = `<div class="goal-deadline-info">Дедлайн: <span class="warn">сегодня!</span></div>`;
                } else {
                    const cls = days < 30 ? 'warn' : 'ok';
                    deadlineInfo = `<div class="goal-deadline-info">До дедлайна: <span class="${cls}">${days} дн.</span> · нужно откладывать <strong>${formatMoney(monthlyNeed)}/мес</strong></div>`;
                }
            }

            // Прогноз
            let forecastInfo = '';
            const fd = forecastGoalDate(g);
            if (fd && g.deadline) {
                const fdDays = daysUntil(fd.toISOString().split('T')[0]);
                const dlDays = daysUntil(g.deadline);
                if (fdDays !== null && dlDays !== null) {
                    if (fdDays <= dlDays) {
                        forecastInfo = `<div class="goal-stats">📈 При текущем темпе достигнешь <strong>${fd.toLocaleDateString('ru-RU')}</strong> — успеваешь!</div>`;
                    } else {
                        forecastInfo = `<div class="goal-stats">📉 При текущем темпе достигнешь <strong>${fd.toLocaleDateString('ru-RU')}</strong> — можешь не успеть</div>`;
                    }
                }
            } else if (fd) {
                forecastInfo = `<div class="goal-stats">📈 При текущем темпе достигнешь <strong>${fd.toLocaleDateString('ru-RU')}</strong></div>`;
            }

            return `
                <div class="goal priority-${g.priority || 'normal'}">
                    <span class="goal-priority-badge ${prio.cls}">${prio.text}</span>
                    <div class="goal-header">
                        <span class="goal-name"><span class="goal-icon">${icon}</span>${g.name}</span>
                        <span class="goal-sum">${formatMoney(g.saved)} / ${formatMoney(g.target)}</span>
                    </div>
                    <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${progress}%"></div></div>
                    <div class="goal-stats">Осталось накопить: <strong>${formatMoney(remaining)}</strong></div>
                    ${deadlineInfo}
                    ${forecastInfo}
                    <div class="goal-actions">
                        <input type="number" id="dep-${g.id}" placeholder="Сумма" min="1" step="0.01">
                        <button class="btn-deposit" onclick="depositToGoal('${g.id}')">Отложить</button>
                        <button class="btn-edit-goal" onclick="editGoal('${g.id}')">✏️</button>
                        <button class="btn-achieve" onclick="markAchieved('${g.id}')">✅ Достигнуто</button>
                        <button class="btn-close" onclick="closeGoal('${g.id}')">Забрать</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Достигнутые
    const achContainer = document.getElementById('achieved-list');
    if (achContainer) {
        if (achieved.length === 0) {
            achContainer.innerHTML = '<p class="empty-msg">Пока ничего не достигнуто</p>';
        } else {
            achContainer.innerHTML = achieved.map(g => `
                <div class="achieved-item">
                    <div class="achieved-info">
                        <span class="achieved-icon">${g.icon || '🎯'}</span>
                        <div>
                            <div class="achieved-name">${g.name}</div>
                            <div class="achieved-meta">${g.achievedAt ? 'Достигнуто ' + new Date(g.achievedAt).toLocaleDateString('ru-RU') : ''}</div>
                        </div>
                    </div>
                    <span class="achieved-sum">${formatMoney(g.saved)}</span>
                    <button class="btn-close" onclick="closeGoal('${g.id}')" style="padding:8px 12px;font-size:0.8rem;">Забрать</button>
                </div>
            `).join('');
        }
    }
}

window.editGoal = (id) => {
    const g = goals.find(x => x.id === id);
    if (!g) return;
    const newIcon = prompt('Иконка (эмодзи):', g.icon || '🎯');
    if (newIcon === null) return;
    const newName = prompt('Название:', g.name);
    if (newName === null) return;
    const newTarget = prompt('Нужная сумма:', g.target);
    if (newTarget === null) return;
    const newDeadline = prompt('Дедлайн (ГГГГ-ММ-ДД, пусто = убрать):', g.deadline || '');
    if (newDeadline === null) return;
    const newPriority = prompt('Приоритет (high / normal / dream):', g.priority || 'normal');
    if (newPriority === null) return;

    const targetNum = parseFloat(newTarget);
    if (isNaN(targetNum) || targetNum <= 0) { alert('Неверная сумма'); return; }

    g.icon = newIcon || '🎯';
    g.name = newName || g.name;
    g.target = targetNum;
    g.deadline = newDeadline || null;
    g.priority = ['high', 'normal', 'dream'].includes(newPriority) ? newPriority : 'normal';
    saveData(); render();
};

window.markAchieved = (id) => {
    const g = goals.find(x => x.id === id);
    if (!g) return;
    if (g.saved < g.target) {
        if (!confirm(`Цель не накоплена полностью (${formatMoney(g.saved)} из ${formatMoney(g.target)}). Отметить как достигнутую?`)) return;
    }
    g.achievedAt = new Date().toISOString();
    saveData(); render();
    alert(`🎉 Поздравляю с достижением цели «${g.name}»!`);
};

// Обновляем render, чтобы использовал улучшенную отрисовку целей
const _renderBeforeStage5 = render;
render = function() {
    _renderBeforeStage5();
    if (document.getElementById('goals-list')) {
        renderGoalsImproved();
    }
};

// Обновляем создание цели (добавляем иконку, дедлайн, приоритет)
document.addEventListener('DOMContentLoaded', () => {
    const goalForm = document.getElementById('goal-form');
    if (!goalForm) return;

    // Удаляем старый обработчик, заменяя форму
    const newForm = goalForm.cloneNode(true);
    goalForm.parentNode.replaceChild(newForm, goalForm);

    newForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const icon = document.getElementById('goal-icon').value.trim() || '🎯';
        const name = document.getElementById('goal-name').value.trim();
        const target = parseFloat(document.getElementById('goal-target').value);
        const deadline = document.getElementById('goal-deadline').value || null;
        const priority = document.getElementById('goal-priority').value || 'normal';
        if (!name || isNaN(target) || target <= 0) return;
        goals.push({
            id: generateId(), name, target, saved: 0,
            icon, deadline, priority,
            createdAt: new Date().toISOString()
        });
        saveData(); render();
        newForm.reset();
        document.getElementById('goal-icon').value = '';
    });
});
// ===== ЭТАП 6: УЛУЧШЕНИЯ КОНВЕРТОВ И РЕЗЕРВОВ =====

// === ШАБЛОНЫ ===
function getTemplates() {
    try { return JSON.parse(localStorage.getItem('financeTemplates')) || []; }
    catch { return []; }
}
function saveTemplates(list) {
    localStorage.setItem('financeTemplates', JSON.stringify(list));
}

function renderTemplates() {
    const block = document.getElementById('templates-block');
    const list = document.getElementById('templates-list');
    if (!block || !list) return;
    const tpls = getTemplates();
    if (tpls.length === 0) { block.style.display = 'none'; return; }
    block.style.display = 'block';
    list.innerHTML = tpls.map((t, i) => `
        <div class="template-chip" onclick="createFromTemplate(${i})">
            ⚡ ${t.name} · ${formatMoney(t.limit)}
            <span class="chip-del" onclick="event.stopPropagation();deleteTemplate(${i})">×</span>
        </div>
    `).join('');
}

window.createFromTemplate = (idx) => {
    const tpls = getTemplates();
    const t = tpls[idx];
    if (!t) return;
    if (t.limit > balance) { alert(`Недостаточно денег! Нужно ${formatMoney(t.limit)}, свободно ${formatMoney(balance)}`); return; }
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    balance -= t.limit;
    envelopes.push({
        id: generateId(), name: t.name, limit: t.limit, spent: 0,
        dateFrom: firstDay, dateTo: lastDay, autoRenew: false
    });
    transactions.push({
        id: generateId(), type: 'transfer', amount: t.limit,
        desc: `Создан конверт «${t.name}» (из шаблона)`,
        date: new Date().toISOString()
    });
    saveData(); render();
};

window.deleteTemplate = (idx) => {
    if (!confirm('Удалить шаблон?')) return;
    const tpls = getTemplates();
    tpls.splice(idx, 1);
    saveTemplates(tpls);
    renderTemplates();
};

// === ПЕРЕБРОС МЕЖДУ КОНВЕРТАМИ ===
window.transferBetweenEnvelopes = (fromId) => {
    const from = envelopes.find(x => x.id === fromId);
    if (!from) return;
    const otherEnvs = envelopes.filter(x => x.id !== fromId);
    if (otherEnvs.length === 0) { alert('Нет других конвертов'); return; }

    const list = otherEnvs.map((e, i) => `${i + 1}. ${e.name} (${formatMoney(e.limit - e.spent)} свободно)`).join('\n');
    const choice = prompt(`Куда перебросить из «${from.name}»?\nДоступно: ${formatMoney(from.limit - from.spent)}\n\n${list}\n\nВведи номер:`);
    if (choice === null) return;
    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= otherEnvs.length) return;
    const to = otherEnvs[idx];

    const amountStr = prompt(`Сколько перебросить в «${to.name}»?`, '500');
    if (amountStr === null) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;
    if (amount > (from.limit - from.spent)) { alert('Недостаточно в конверте-источнике'); return; }

    from.limit -= amount;
    to.limit += amount;
    transactions.push({
        id: generateId(), type: 'transfer', amount,
        desc: `Переброс: ${from.name} → ${to.name}`,
        date: new Date().toISOString()
    });
    saveData(); render();
};

// === АВТОПРОДЛЕНИЕ ===
function checkAutoRenew() {
    const now = new Date();
    let changed = false;
    envelopes.forEach(env => {
        if (env.autoRenew && new Date(env.dateTo) < now) {
            // Продлеваем на такой же период вперёд
            const duration = new Date(env.dateTo) - new Date(env.dateFrom);
            const newFrom = new Date(env.dateTo);
            const newTo = new Date(newFrom.getTime() + duration);
            env.dateFrom = newFrom.toISOString().split('T')[0];
            env.dateTo = newTo.toISOString().split('T')[0];
            env.spent = 0;
            changed = true;
        }
    });
    if (changed) saveData();
}

// === ОПОВЕЩЕНИЯ О ЛИМИТЕ ===
function getEnvelopeLimitBlock(env) {
    const remaining = env.limit - env.spent;
    const percent = env.limit > 0 ? (env.spent / env.limit) * 100 : 0;
    if (percent >= 100) {
        return `<div class="limit-over">🚨 Конверт исчерпан! Потрачено ${formatMoney(env.spent)} из ${formatMoney(env.limit)}</div>`;
    }
    if (percent >= 80) {
        return `<div class="limit-warn">⚠️ Использовано ${percent.toFixed(0)}%. Осталось ${formatMoney(remaining)}</div>`;
    }
    return '';
}

// === ПЕРЕОПРЕДЕЛЯЕМ РЕНДЕР КОНВЕРТОВ ===
function renderEnvelopesImproved() {
    const container = document.getElementById('envelopes-list');
    if (!container) return;
    if (envelopes.length === 0) {
        container.innerHTML = '<p class="empty-msg">Пока нет конвертов</p>';
        return;
    }
    const now = new Date();
    container.innerHTML = envelopes.map(env => {
        const remaining = env.limit - env.spent;
        const progress = env.limit > 0 ? Math.min((env.spent / env.limit) * 100, 100) : 0;
        const over = env.spent > env.limit;
        const remClass = remaining > 0 ? 'positive' : (remaining < 0 ? 'negative' : 'zero');
        const expired = new Date(env.dateTo) < now;
        const limitBlock = getEnvelopeLimitBlock(env);
        const autoBadge = env.autoRenew ? '<span class="auto-renew-badge">🔄 авто</span>' : '';

        return `
            <div class="envelope ${expired ? 'expired' : ''}">
                <div class="envelope-header">
                    <span class="envelope-name">📁 ${env.name}${autoBadge} ${expired ? '<small style="color:#e74c3c">(период истёк)</small>' : ''}</span>
                    <span class="envelope-remaining ${remClass}">${formatMoney(remaining)}</span>
                </div>
                <div class="envelope-period">Период: ${formatPeriod(env.dateFrom, env.dateTo)}</div>
                <div class="envelope-stats">
                    <span>Выделено: <strong>${formatMoney(env.limit)}</strong></span>
                    <span>Потрачено: <strong>${formatMoney(env.spent)}</strong></span>
                </div>
                <div class="progress-bar-bg"><div class="progress-bar-fill ${over ? 'over' : ''}" style="width: ${progress}%"></div></div>
                ${limitBlock}
                <div class="envelope-actions">
                    <button class="btn-spend" onclick="spendFromEnvelope('${env.id}')">💸 Потратить</button>
                    <button class="btn-refill" onclick="refillEnvelope('${env.id}')">➕ Пополнить</button>
                    <button class="btn-transfer-env" onclick="transferBetweenEnvelopes('${env.id}')">↔️ Переброс</button>
                    <button class="btn-edit" onclick="editEnvelope('${env.id}')">✏️ Изменить</button>
                    <button class="btn-close" onclick="closeEnvelope('${env.id}')">✖ Закрыть</button>
                </div>
            </div>
        `;
    }).join('');
}

// Аналогично для резервов
function renderReservesImproved() {
    const container = document.getElementById('reserves-list');
    if (!container) return;
    if (reserves.length === 0) {
        container.innerHTML = '<p class="empty-msg">Пока нет обязательных резервов</p>';
        return;
    }
    const now = new Date();
    container.innerHTML = reserves.map(r => {
        const remaining = r.limit - r.spent;
        const progress = r.limit > 0 ? Math.min((r.spent / r.limit) * 100, 100) : 0;
        const over = r.spent > r.limit;
        const remClass = remaining > 0 ? 'positive' : (remaining < 0 ? 'negative' : 'zero');
        const expired = new Date(r.dateTo) < now;
        const percent = r.limit > 0 ? (r.spent / r.limit) * 100 : 0;

        let warnBlock = '';
        if (expired) {
            warnBlock = `<div class="reserve-warn">⚠️ Период резерва истёк.</div>`;
        } else if (over) {
            warnBlock = `<div class="limit-over">🚨 Резерв исчерпан!</div>`;
        } else if (percent >= 80) {
            warnBlock = `<div class="limit-warn">⚠️ Использовано ${percent.toFixed(0)}%. Осталось ${formatMoney(remaining)}</div>`;
        } else {
            warnBlock = `<div class="reserve-ok">✅ Осталось ${formatMoney(remaining)}</div>`;
        }

        return `
            <div class="reserve ${expired ? 'expired' : ''}">
                <div class="reserve-header">
                    <span class="reserve-name">🔒 ${r.name} ${expired ? '<small style="color:#e74c3c">(истёк)</small>' : ''}</span>
                    <span class="reserve-remaining ${remClass}">${formatMoney(remaining)}</span>
                </div>
                <div class="reserve-period">Период: ${formatPeriod(r.dateFrom, r.dateTo)}</div>
                <div class="reserve-stats">
                    <span>Зарезервировано: <strong>${formatMoney(r.limit)}</strong></span>
                    <span>Потрачено: <strong>${formatMoney(r.spent)}</strong></span>
                </div>
                <div class="progress-bar-bg"><div class="progress-bar-fill ${over ? 'over' : ''}" style="width: ${progress}%"></div></div>
                ${warnBlock}
                <div class="reserve-actions">
                    <button class="btn-spend-reserve" onclick="spendFromReserve('${r.id}')">💸 Потратить</button>
                    <button class="btn-refill-reserve" onclick="refillReserve('${r.id}')">➕ Пополнить</button>
                    <button class="btn-edit-reserve" onclick="editReserve('${r.id}')">✏️ Изменить</button>
                    <button class="btn-close-reserve" onclick="closeReserve('${r.id}')">✖ Закрыть</button>
                </div>
            </div>
        `;
    }).join('');
}

// === ПОДМЕНА РЕНДЕРА ===
const _renderBeforeStage6 = render;
render = function() {
    _renderBeforeStage6();
    if (document.getElementById('envelopes-list')) {
        checkAutoRenew();
        renderEnvelopesImproved();
        renderReservesImproved();
        renderTemplates();
    }
};

// === СОХРАНЕНИЕ ШАБЛОНА ПРИ СОЗДАНИИ КОНВЕРТА ===
// Перехватываем submit формы конверта, чтобы добавить логику
document.addEventListener('DOMContentLoaded', () => {
    const envForm = document.getElementById('envelope-form');
    if (!envForm) return;

    const newForm = envForm.cloneNode(true);
    envForm.parentNode.replaceChild(newForm, envForm);

    newForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('env-name').value.trim();
        const limit = parseFloat(document.getElementById('env-limit').value);
        const dateFrom = document.getElementById('env-date-from').value;
        const dateTo = document.getElementById('env-date-to').value;
        const autoRenew = document.getElementById('env-autorenew').checked;
        const saveAsTemplate = document.getElementById('env-save-template').checked;

        if (!name || isNaN(limit) || limit <= 0) return;
        if (!dateFrom || !dateTo) { alert('Укажи период'); return; }
        if (new Date(dateTo) < new Date(dateFrom)) { alert('Дата конца раньше начала'); return; }
        if (limit > balance) { alert(`Недостаточно денег! Свободно: ${formatMoney(balance)}`); return; }

        balance -= limit;
        envelopes.push({
            id: generateId(), name, limit, spent: 0,
            dateFrom, dateTo, autoRenew
        });
        transactions.push({
            id: generateId(), type: 'transfer', amount: limit,
            desc: `Создан конверт «${name}»`, date: new Date().toISOString()
        });

        if (saveAsTemplate) {
            const tpls = getTemplates();
            if (!tpls.find(t => t.name === name && t.limit === limit)) {
                tpls.push({ name, limit });
                saveTemplates(tpls);
            }
        }

        saveData(); render();
        newForm.reset();
        const now = new Date();
        document.getElementById('env-date-from').value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        document.getElementById('env-date-to').value = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    });
});
