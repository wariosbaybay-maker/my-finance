// --- Состояние ---
let balance = 0;
let transactions = [];
let goals = [];

// --- Утилиты ---
const formatMoney = (n) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(n);
const formatDate = (iso) => new Date(iso).toLocaleDateString('ru-RU');
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// --- Сохранение / Загрузка ---
function saveData() {
    localStorage.setItem('financeData', JSON.stringify({ balance, transactions, goals }));
}
function loadData() {
    const saved = localStorage.getItem('financeData');
    if (saved) {
        const data = JSON.parse(saved);
        balance = data.balance || 0;
        transactions = data.transactions || [];
        goals = data.goals || [];
    }
}

// --- Рендеринг ---
function render() {
    document.getElementById('total-balance').textContent = formatMoney(balance);
    renderTransactions();
    renderGoals();
}

function renderTransactions() {
    const container = document.getElementById('transactions-list');
    if (transactions.length === 0) {
        container.innerHTML = '<p style="color:#999; text-align:center; padding:20px;">Пока нет операций</p>';
        return;
    }
    // Показываем сначала новые
    const sorted = [...transactions].reverse();
    container.innerHTML = sorted.map(tx => `
        <div class="transaction-item ${tx.type}">
            <div>
                <span>${tx.desc}</span>
                <span class="tx-date">${formatDate(tx.date)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <strong>${tx.type === 'income' ? '+' : '-'}${formatMoney(tx.amount)}</strong>
                <button class="delete-btn" onclick="deleteTransaction('${tx.id}')">×</button>
            </div>
        </div>
    `).join('');
}

function renderGoals() {
    const container = document.getElementById('goals-list');
    if (goals.length === 0) {
        container.innerHTML = '<p style="color:#999; text-align:center; padding:20px;">Нет активных целей</p>';
        return;
    }
    container.innerHTML = goals.map(goal => {
        const progress = Math.min((goal.saved / goal.target) * 100, 100);
        const remaining = goal.target - goal.saved;
        return `
            <div class="goal-item">
                <div class="goal-header">
                    <span>${goal.name}</span>
                    <span>${formatMoney(goal.saved)} / ${formatMoney(goal.target)}</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${progress}%"></div>
                </div>
                <small style="color:#666;">Осталось накопить: ${formatMoney(Math.max(remaining, 0))}</small>
                <div class="goal-actions">
                    <input type="number" id="add-to-goal-${goal.id}" placeholder="Сумма" min="1" step="0.01">
                    <button onclick="addToGoal('${goal.id}')">Отложить</button>
                    <button class="delete-btn" style="background:#e74c3c; color:white; border-radius:4px;" onclick="deleteGoal('${goal.id}')">Удалить</button>
                </div>
            </div>
        `;
    }).join('');
}

// --- Логика операций ---
function addTransaction(type, amount, desc) {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    if (type === 'income') {
        balance += numAmount;
    } else {
        // Если расход больше баланса, не даем уйти в минус (по желанию)
        if (numAmount > balance) {
            alert('Недостаточно средств на балансе!');
            return;
        }
        balance -= numAmount;
    }

    transactions.push({
        id: generateId(),
        type,
        amount: numAmount,
        desc,
        date: new Date().toISOString()
    });

    saveData();
    render();
}

window.deleteTransaction = (id) => {
    const txIndex = transactions.findIndex(t => t.id === id);
    if (txIndex === -1) return;
    const tx = transactions[txIndex];
    // Откатываем баланс
    if (tx.type === 'income') balance -= tx.amount;
    else balance += tx.amount;

    transactions.splice(txIndex, 1);
    saveData();
    render();
};

// --- Логика целей ---
window.addToGoal = (goalId) => {
    const input = document.getElementById(`add-to-goal-${goalId}`);
    const amount = parseFloat(input.value);
    if (isNaN(amount) || amount <= 0) return;
    if (amount > balance) {
        alert('Недостаточно свободных средств на балансе!');
        return;
    }

    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    // Списываем с баланса и добавляем в цель
    balance -= amount;
    goal.saved += amount;

    // Записываем как расход
    transactions.push({
        id: generateId(),
        type: 'expense',
        amount: amount,
        desc: `Отложено на: ${goal.name}`,
        date: new Date().toISOString()
    });

    input.value = '';
    saveData();
    render();
};

window.deleteGoal = (goalId) => {
    if (!confirm('Удалить цель? Накопленные деньги вернутся на баланс.')) return;
    const idx = goals.findIndex(g => g.id === goalId);
    if (idx === -1) return;
    const goal = goals[idx];
    // Возвращаем деньги на баланс
    balance += goal.saved;
    goals.splice(idx, 1);
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
        addTransaction('income', amount, desc);
        e.target.reset();
    });

    document.getElementById('expense-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = document.getElementById('expense-amount').value;
        const desc = document.getElementById('expense-desc').value;
        addTransaction('expense', amount, desc);
        e.target.reset();
    });

    document.getElementById('goal-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('goal-name').value;
        const target = parseFloat(document.getElementById('goal-target').value);
        if (name && !isNaN(target) && target > 0) {
            goals.push({
                id: generateId(),
                name,
                target,
                saved: 0
            });
            saveData();
            render();
            e.target.reset();
        }
    });
});
