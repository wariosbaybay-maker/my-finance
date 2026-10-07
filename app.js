let balance = 0;
let transactions = [];
let goals = [];
let envelopes = [];
let reserves = [];

const formatMoney = (n) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
const formatDate = (iso) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const formatPeriod = (from, to) => `${new Date(from).toLocaleDateString('ru-RU')} — ${new Date(to).toLocaleDateString('ru-RU')}`;
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

function saveData() {
    localStorage.setItem('financeData', JSON.stringify({ balance, transactions, goals, envelopes, reserves }));
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
    }
}

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
            warnBlock = `<div class="reserve-warn">⚠️ Период резерва истёк. Закрой его, чтобы вернуть остаток на баланс.</div>`;
        } else if (over) {
            warnBlock = `<div class="reserve-warn">⚠️ Ты превысил сумму резерва! Потрачено ${formatMoney(r.spent)} из ${formatMoney(r.limit)}</div>`;
        } else {
            warnBlock = `<div class="reserve-ok">✅ В резерве осталось ${formatMoney(remaining)}</div>`;
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
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill ${over ? 'over' : ''}" style="width: ${progress}%"></div>
                </div>
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

    r.spent += amount;
    transactions.push({
        id: generateId(), type: 'expense', amount,
        desc: `${r.name}: ${desc}`, date: new Date().toISOString()
    });
    saveData();
    render();
};

window.refillReserve = (id) => {
    const r = reserves.find(x => x.id === id);
    if (!r) return;
    const amountStr = prompt(`Сколько добавить в «${r.name}»?\nСвободно: ${formatMoney(balance)}`);
    if (amountStr === null) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;
    if (amount > balance) { alert('Недостаточно свободных денег!'); return; }

    balance -= amount;
    r.limit += amount;
    transactions.push({
        id: generateId(), type: 'transfer', amount,
        desc: `Пополнение резерва «${r.name}»`, date: new Date().toISOString()
    });
    saveData();
    render();
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
        transactions.push({
            id: generateId(), type: 'transfer', amount: diff,
            desc: `Увеличение резерва «${newName}»`, date: new Date().toISOString()
        });
    } else if (diff < 0) {
        balance += Math.abs(diff);
        transactions.push({
            id: generateId(), type: 'transfer', amount: Math.abs(diff),
            desc: `Уменьшение резерва «${newName}»`, date: new Date().toISOString()
        });
    }

    r.name = newName;
    r.limit = newLimit;
    r.dateFrom = newFrom;
    r.dateTo = newTo;
    saveData();
    render();
};

window.closeReserve = (id) => {
    const r = reserves.find(x => x.id === id);
    if (!r) return;
    const remaining = r.limit - r.spent;
    if (!confirm(`Закрыть резерв «${r.name}»?\nОстаток ${formatMoney(remaining)} вернётся на баланс.`)) return;

    balance += remaining;
    transactions.push({
        id: generateId(), type: 'transfer', amount: remaining,
        desc: `Закрытие резерва «${r.name}»`, date: new Date().toISOString()
    });
    reserves = reserves.filter(x => x.id !== id);
    saveData();
    render();
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
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill ${over ? 'over' : ''}" style="width: ${progress}%"></div>
                </div>
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

function renderTransactions() {
    const container = document.getElementById('transactions-list');
    if (transactions.length === 0) {
        container.innerHTML = '<p class="empty-msg">Пока нет операций</p>';
        return;
    }
    const sorted = [...transactions].reverse();
    container.innerHTML = sorted.map(tx => {
        const sign = tx.type === 'income' ? '+' : (tx.type === 'expense' ? '-' : '');
