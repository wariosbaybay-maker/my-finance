// --- Состояние ---
let balance = 0;
let transactions = [];
let goals = [];
let envelopes = [];

// --- Утилиты ---
const formatMoney = (n) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
const formatDate = (iso) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const formatPeriod = (from, to) => `${new Date(from).toLocaleDateString('ru-RU')} — ${new Date(to).toLocaleDateString('ru-RU')}`;
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// --- Сохранение / Загрузка ---
function saveData() {
    localStorage.setItem('financeData', JSON.stringify({ balance, transactions, goals, envelopes }));
}
function loadData() {
    const saved = localStorage.getItem('financeData');
    if (saved) {
        const data = JSON.parse(saved);
        balance = data.balance || 0;
        transactions = data.transactions || [];
        goals = data.goals || [];
        envelopes = data.envelopes || [];
    }
}

// --- Рендер ---
function render() {
    const inEnv = envelopes.reduce((s, e) => s + e.limit, 0);
    const inGoals = goals.reduce((s, g) => s + g.saved, 0);
    document.getElementById('total-balance').textContent = formatMoney(balance);
    document.getElementById('in-envelopes').textContent = `В конвертах: ${formatMoney(inEnv)}`;
    document.getElementById('in-goals').textContent = `В целях: ${formatMoney(inGoals)}`;
    renderGoals();
    renderEnvelopes();
    renderTransactions();
}

// --- ЦЕЛИ ---
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
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${progress}%"></div>
                </div>
                <div class="goal-stats">
                    ${done ? '✅ Цель достигнута!' : `Осталось накопить: <strong>${formatMoney(remaining)}</strong>`}
                </div>
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

    balance -= amount;
    g.saved += amount;
    transactions.push({
        id: generateId(), type: 'transfer', amount,
        desc: `В цель «${g.name}»`, date: new Date().toISOString()
    });
    input.value = '';
    saveData();
    render();
};

window.closeGoal = (id) => {
    const g = goals.find(x => x.id === id);
    if (!g) return;
    if (!confirm(`Забрать ${formatMoney(g.saved)} из цели «${g.name}» и удалить цель?`)) return;
    balance += g.saved;
    transactions.push({
        id: generateId(), type: 'transfer', amount: g.saved,
        desc: `Возврат из цели «${g.name}»`, date: new Date().toISOString()
    });
    goals = goals.filter(x => x.id !== id);
    saveData();
    render();
};

// --- КОНВЕРТЫ ---
function renderEnvelopes() {
    const container = document.getElementById('envelopes-list');
    if (envelopes.length === 0) {
        container.innerHTML = '<p class="empty-msg">Пока нет конвертов</p>';
        return;
    }
    const now = new Date();
    container.innerHTML = envelopes.map(env => {
        const minKeep = env.minKeep || 0;
        const minReason = env.minReason || '';
        const remaining = env.limit - env.spent;
        const progress = env.limit > 0 ? Math.min((env.spent / env.limit) * 100, 100) : 0;
        const over = env.spent > env.limit;
        const remClass = remaining > 0 ? 'positive' : (remaining < 0 ? 'negative' : 'zero');
        const expired = new Date(env.dateTo) < now;

        // Плашка обязательного остатка
        let minChip = '';
        if (minKeep > 0) {
            minChip = `
                <div class="envelope-min-chip">
                    🔒 Обязательный остаток: <span class="chip-amount">${formatMoney(minKeep)}</span>
                    ${minReason ? `— ${minReason}` : ''}
                </div>
            `;
        }

        let minBlock = '';
        if (minKeep > 0) {
            if (remaining >= minKeep) {
                minBlock = `<div class="envelope-min-ok">✅ Обязательный остаток ${formatMoney(minKeep)} сохранён</div>`;
            } else {
                minBlock = `<div class="envelope-min-warn">⚠️ Ты ниже обязательного остатка! Нужно оставить минимум ${formatMoney(minKeep)}, а сейчас ${formatMoney(remaining)}</div>`;
            }
        }

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
                ${minChip}
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill ${over ? 'over' : ''}" style="width: ${progress}%"></div>
                </div>
                ${minBlock}
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

    env.spent += amount;
    transactions.push({
        id: generateId(), type: 'expense', amount,
        desc: `${env.name}: ${desc}`, date: new Date().toISOString()
    });
    saveData();
    render();
};

window.refillEnvelope = (id) => {
    const env = envelopes.find(x => x.id === id);
    if (!env) return;
    const amountStr = prompt(`Сколько добавить в «${env.name}»?\nСвободно: ${formatMoney(balance)}`);
    if (amountStr === null) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;
    if (amount > balance) { alert('Недостаточно свободных денег!'); return; }

    balance -= amount;
    env.limit += amount;
    transactions.push({
        id: generateId(), type: 'transfer', amount,
        desc: `Пополнение «${env.name}»`, date: new Date().toISOString()
    });
    saveData();
    render();
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
    const newMinStr = prompt('Обязательный остаток (сумма):', env.minKeep || 0);
    if (newMinStr === null) return;
    const newMin = parseFloat(newMinStr) || 0;
    const newMinReason = prompt('Причина обязательного остатка:', env.minReason || '');
    if (newMinReason === null) return;

    const diff = newLimit - env.limit;
    if (diff > 0) {
        if (diff > balance) { alert(`Недостаточно денег! Нужно ещё ${formatMoney(diff - balance)}`); return; }
        balance -= diff;
        transactions.push({
            id: generateId(), type: 'transfer', amount: diff,
            desc: `Увеличение «${newName}»`, date: new Date().toISOString()
        });
    } else if (diff < 0) {
        balance += Math.abs(diff);
        transactions.push({
            id: generateId(), type: 'transfer', amount: Math.abs(diff),
            desc: `Уменьшение «${newName}»`, date: new Date().toISOString()
        });
    }

    env.name = newName;
    env.limit = newLimit;
    env.dateFrom = newFrom;
    env.dateTo = newTo;
    env.minKeep = newMin;
    env.minReason = newMinReason.trim();
    saveData();
    render();
};

window.closeEnvelope = (id) => {
    const env = envelopes.find(x => x.id === id);
    if (!env) return;
    const remaining = env.limit - env.spent;
    if (!confirm(`Закрыть «${env.name}»?\nОстаток ${formatMoney(remaining)} вернётся на баланс.`)) return;

    balance += remaining;
    transactions.push({
        id: generateId(), type: 'transfer', amount: remaining,
        desc: `Закрытие «${env.name}»`, date: new Date().toISOString()
    });
    envelopes = envelopes.filter(x => x.id !== id);
    saveData();
    render();
};

// --- ИСТОРИЯ ---
function renderTransactions() {
    const container = document.getElementById('transactions-list');
    if (transactions.length === 0) {
        container.innerHTML = '<p class="empty-msg">Пока нет операций</p>';
        return;
    }
    const sorted = [...transactions].reverse();
    container.innerHTML = sorted.map(tx => {
        const sign = tx.type === 'income' ? '+' : (tx.type === 'expense' ? '-' : '');
        return `
            <div class="transaction-item ${tx.type}">
                <div class="tx-info">
                    <span class="tx-desc">${tx.desc}</span>
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
    if (!confirm('Удалить операцию из истории? Баланс не изменится (это только запись).')) return;
    transactions.splice(idx, 1);
    saveData();
    render();
};

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    render();

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    document.getElementById('env-date-from').value = firstDay;
    document.getElementById('env-date-to').value = lastDay;

    // Доход
    document.getElementById('income-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('income-amount').value);
        const desc = document.getElementById('income-desc').value.trim();
        if (isNaN(amount) || amount <= 0 || !desc) return;
        balance += amount;
        transactions.push({ id: generateId(), type: 'income', amount, desc, date: new Date().toISOString() });
        saveData(); render();
        e.target.reset();
    });

    // Расход
    document.getElementById('expense-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('expense-amount').value);
        const desc = document.getElementById('expense-desc').value.trim();
        if (isNaN(amount) || amount <= 0 || !desc) return;
        if (amount > balance) { alert(`Недостаточно денег! Свободно: ${formatMoney(balance)}`); return; }
        balance -= amount;
        transactions.push({ id: generateId(), type: 'expense', amount, desc, date: new Date().toISOString() });
        saveData(); render();
        e.target.reset();
    });

    // Цель
    document.getElementById('goal-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('goal-name').value.trim();
        const target = parseFloat(document.getElementById('goal-target').value);
        if (!name || isNaN(target) || target <= 0) return;
        goals.push({ id: generateId(), name, target, saved: 0 });
        saveData(); render();
        e.target.reset();
    });

    // Конверт
    document.getElementById('envelope-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('env-name').value.trim();
        const limit = parseFloat(document.getElementById('env-limit').value);
        const dateFrom = document.getElementById('env-date-from').value;
        const dateTo = document.getElementById('env-date-to').value;
        const minKeep = parseFloat(document.getElementById('env-min-amount').value) || 0;
        const minReason = document.getElementById('env-min-reason').value.trim();

        if (!name || isNaN(limit) || limit <= 0) return;
        if (!dateFrom || !dateTo) { alert('Укажи период'); return; }
        if (new Date(dateTo) < new Date(dateFrom)) { alert('Дата конца раньше начала'); return; }
        if (limit > balance) { alert(`Недостаточно денег! Свободно: ${formatMoney(balance)}`); return; }
        if (minKeep > limit) { alert('Обязательный остаток не может быть больше выделенной суммы'); return; }

        balance -= limit;
        envelopes.push({
            id: generateId(),
            name, limit, spent: 0,
            dateFrom, dateTo, minKeep, minReason
        });
        transactions.push({
            id: generateId(), type: 'transfer', amount: limit,
            desc: `Создан конверт «${name}»`, date: new Date().toISOString()
        });
        saveData(); render();
        e.target.reset();
        document.getElementById('env-date-from').value = firstDay;
        document.getElementById('env-date-to').value = lastDay;
        document.getElementById('env-min-amount').value = 0;
    });
});
