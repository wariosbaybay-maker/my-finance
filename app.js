// --- Состояние ---
let balance = 0;            // свободные деньги (не в конвертах)
let transactions = [];      // история
let envelopes = [];         // конверты (бюджеты)

// --- Утилиты ---
const formatMoney = (n) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
const formatDate = (iso) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// --- Сохранение / Загрузка ---
function saveData() {
    localStorage.setItem('financeData', JSON.stringify({ balance, transactions, envelopes }));
}
function loadData() {
    const saved = localStorage.getItem('financeData');
    if (saved) {
        const data = JSON.parse(saved);
        balance = data.balance || 0;
        transactions = data.transactions || [];
        envelopes = data.envelopes || [];
    }
}

// --- Рендеринг ---
function render() {
    const totalInEnv = envelopes.reduce((s, e) => s + e.limit, 0);
    document.getElementById('total-balance').textContent = formatMoney(balance);
    document.getElementById('in-envelopes').textContent = `В конвертах: ${formatMoney(totalInEnv)}`;
    renderEnvelopes();
    renderTransactions();
}

function renderEnvelopes() {
    const container = document.getElementById('envelopes-list');
    if (envelopes.length === 0) {
        container.innerHTML = '<p class="empty-msg">Пока нет конвертов. Создай первый выше.</p>';
        return;
    }
    container.innerHTML = envelopes.map(env => {
        const remaining = env.limit - env.spent;
        const progress = env.limit > 0 ? Math.min((env.spent / env.limit) * 100, 100) : 0;
        const over = env.spent > env.limit;
        const remClass = remaining > 0 ? 'positive' : (remaining < 0 ? 'negative' : 'zero');
        return `
            <div class="envelope">
                <div class="envelope-header">
                    <span class="envelope-name">📁 ${env.name}</span>
                    <span class="envelope-remaining ${remClass}">${formatMoney(remaining)}</span>
                </div>
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

// --- Операции с балансом ---
function addTransaction(type, amount, desc) {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return false;

    if (type === 'income') {
        balance += num;
    } else if (type === 'expense') {
        if (num > balance) { alert('Недостаточно свободных денег!'); return false; }
        balance -= num;
    }

    transactions.push({ id: generateId(), type, amount: num, desc, date: new Date().toISOString() });
    saveData();
    render();
    return true;
}

window.deleteTransaction = (id) => {
    const idx = transactions.findIndex(t => t.id === id);
    if (idx === -1) return;
    if (!confirm('Удалить операцию? Баланс будет скорректирован.')) return;
    const tx = transactions[idx];
    if (tx.type === 'income') balance -= tx.amount;
    else if (tx.type === 'expense') balance += tx.amount;
    transactions.splice(idx, 1);
    saveData();
    render();
};

// --- Операции с конвертами ---
window.spendFromEnvelope = (envId) => {
    const env = envelopes.find(e => e.id === envId);
    if (!env) return;
    const amountStr = prompt(`Сколько потратили из «${env.name}»?\nДоступно: ${formatMoney(env.limit - env.spent)}`);
    if (amountStr === null) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;

    const desc = prompt('На что потратили?', 'Покупка') || 'Покупка';

    env.spent += amount;
    transactions.push({
        id: generateId(),
        type: 'expense',
        amount,
        desc: `${env.name}: ${desc}`,
        date: new Date().toISOString(),
        envelopeId: env.id
    });
    saveData();
    render();
};

window.refillEnvelope = (envId) => {
    const env = envelopes.find(e => e.id === envId);
    if (!env) return;
    const amountStr = prompt(`Сколько добавить в «${env.name}»?\nСвободно: ${formatMoney(balance)}`);
    if (amountStr === null) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;
    if (amount > balance) { alert('Недостаточно свободных денег!'); return; }

    balance -= amount;
    env.limit += amount;
    transactions.push({
        id: generateId(),
        type: 'transfer',
        amount,
        desc: `Пополнение конверта «${env.name}»`,
        date: new Date().toISOString(),
        envelopeId: env.id
    });
    saveData();
    render();
};

window.editEnvelope = (envId) => {
    const env = envelopes.find(e => e.id === envId);
    if (!env) return;
    const newName = prompt('Новое название:', env.name);
    if (newName === null) return;
    const newLimitStr = prompt('Новый лимит (выделенная сумма):', env.limit);
    if (newLimitStr === null) return;
    const newLimit = parseFloat(newLimitStr);
    if (isNaN(newLimit) || newLimit <= 0) return;

    const diff = newLimit - env.limit;
    if (diff > 0) {
        // увеличиваем лимит — нужно списать с баланса
        if (diff > balance) { alert(`Недостаточно свободных денег! Нужно ещё ${formatMoney(diff - balance)}`); return; }
        balance -= diff;
        transactions.push({
            id: generateId(),
            type: 'transfer',
            amount: diff,
            desc: `Увеличение лимита «${newName}»`,
            date: new Date().toISOString(),
            envelopeId: env.id
        });
    } else if (diff < 0) {
        // уменьшаем лимит — вернуть на баланс
        balance += Math.abs(diff);
        transactions.push({
            id: generateId(),
            type: 'transfer',
            amount: Math.abs(diff),
            desc: `Уменьшение лимита «${newName}»`,
            date: new Date().toISOString(),
            envelopeId: env.id
        });
    }

    env.name = newName;
    env.limit = newLimit;
    saveData();
    render();
};

window.closeEnvelope = (envId) => {
    const env = envelopes.find(e => e.id === envId);
    if (!env) return;
    const remaining = env.limit - env.spent;
    if (!confirm(`Закрыть конверт «${env.name}»?\nОстаток ${formatMoney(remaining)} вернётся на баланс.`)) return;

    balance += remaining;
    transactions.push({
        id: generateId(),
        type: 'transfer',
        amount: remaining,
        desc: `Закрытие конверта «${env.name}»`,
        date: new Date().toISOString()
    });
    envelopes = envelopes.filter(e => e.id !== envId);
    saveData();
    render();
};

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    render();

    document.getElementById('income-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = document.getElementById('income-amount').value;
        const desc = document.getElementById('income-desc').value;
        if (addTransaction('income', amount, desc)) e.target.reset();
    });

    document.getElementById('envelope-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('env-name').value.trim();
        const limit = parseFloat(document.getElementById('env-limit').value);
        if (!name || isNaN(limit) || limit <= 0) return;
        if (limit > balance) { alert(`Недостаточно свободных денег! У тебя ${formatMoney(balance)}`); return; }

        balance -= limit;
        envelopes.push({
            id: generateId(),
            name,
            limit,
            spent: 0
        });
        transactions.push({
            id: generateId(),
            type: 'transfer',
            amount: limit,
            desc: `Создан конверт «${name}»`,
            date: new Date().toISOString()
        });
        saveData();
        render();
        e.target.reset();
    });
});
