// ===== СИНХРОНИЗАЦИЯ С FIREBASE (Email/Password) =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore, doc, getDoc, setDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signOut, onAuthStateChanged, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDRbkK-T8QxBpwWcfvND58QiAVBYeEWJoE",
    authDomain: "my-finance-3f065.firebaseapp.com",
    projectId: "my-finance-3f065",
    storageBucket: "my-finance-3f065.firebasestorage.app",
    messagingSenderId: "517650439338",
    appId: "1:517650439338:web:29738dc83a73979faf84d3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUser = null;
let isCloudSyncing = false;
let pushTimer = null;
let unsubscribeSnapshot = null;

console.log('🔥 Firebase: инициализация...');

// ---- UI ----
function setAuthStatus(text, cls = '') {
    const el = document.getElementById('auth-status');
    if (!el) return;
    el.textContent = text;
    el.className = 'auth-status ' + cls;
}
function showLoggedIn(email) {
    const lOut = document.getElementById('auth-logged-out');
    const lIn  = document.getElementById('auth-logged-in');
    const eEl  = document.getElementById('auth-user-email');
    if (lOut) lOut.style.display = 'none';
    if (lIn)  lIn.style.display = 'flex';
    if (eEl)  eEl.textContent = email;
}
function showLoggedOut() {
    const lOut = document.getElementById('auth-logged-out');
    const lIn  = document.getElementById('auth-logged-in');
    if (lOut) lOut.style.display = 'grid';
    if (lIn)  lIn.style.display = 'none';
    const em = document.getElementById('auth-email');
    const pw = document.getElementById('auth-password');
    if (em) em.value = '';
    if (pw) pw.value = '';
}

// ---- Публичные функции ----
window.authLogin = async () => {
    const email = document.getElementById('auth-email').value.trim();
    const pass  = document.getElementById('auth-password').value;
    if (!email || !pass) { setAuthStatus('Введи email и пароль', 'error'); return; }
    try {
        setAuthStatus('Вход...', 'info');
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) {
        setAuthStatus('Ошибка входа: ' + translateError(e.code), 'error');
    }
};

window.authRegister = async () => {
    const email = document.getElementById('auth-email').value.trim();
    const pass  = document.getElementById('auth-password').value;
    if (!email || !pass) { setAuthStatus('Введи email и пароль', 'error'); return; }
    if (pass.length < 6) { setAuthStatus('Пароль минимум 6 символов', 'error'); return; }
    try {
        setAuthStatus('Создаю аккаунт...', 'info');
        await createUserWithEmailAndPassword(auth, email, pass);
    } catch (e) {
        setAuthStatus('Ошибка регистрации: ' + translateError(e.code), 'error');
    }
};

window.authLogout = async () => {
    if (!confirm('Выйти из аккаунта? Данные останутся на сервере.')) return;
    await signOut(auth);
};

window.authResetPassword = async () => {
    const email = document.getElementById('auth-email').value.trim();
    if (!email) { setAuthStatus('Введи email, чтобы сбросить пароль', 'error'); return; }
    try {
        await sendPasswordResetEmail(auth, email);
        setAuthStatus('Письмо для сброса пароля отправлено на ' + email, 'ok');
    } catch (e) {
        setAuthStatus('Ошибка: ' + translateError(e.code), 'error');
    }
};

function translateError(code) {
    const map = {
        'auth/invalid-email': 'неверный формат email',
        'auth/user-not-found': 'пользователь не найден — зарегистрируйся',
        'auth/wrong-password': 'неверный пароль',
        'auth/invalid-credential': 'неверный email или пароль',
        'auth/email-already-in-use': 'этот email уже занят — войди или сбрось пароль',
        'auth/weak-password': 'пароль слишком простой',
        'auth/network-request-failed': 'нет соединения с интернетом',
        'auth/too-many-requests': 'слишком много попыток — подожди немного',
        'auth/operation-not-allowed': 'в Firebase не включён вход через Email/Password',
        'permission-denied': 'нет доступа к Firestore — проверь правила'
    };
    return map[code] || code;
}

// ---- Подписка на состояние входа ----
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log('🔥 Firebase: вошёл как', user.email);
        setAuthStatus('✅ Синхронизация включена', 'ok');
        showLoggedIn(user.email);

        await loadFromCloud(user.uid);

        if (unsubscribeSnapshot) unsubscribeSnapshot();
        unsubscribeSnapshot = onSnapshot(doc(db, "users", user.uid), (snap) => {
            if (!snap.exists()) return;
            if (isCloudSyncing) return;
            const cloud = snap.data();
            const cloudUpdatedAt = cloud.updatedAt || '';
            const localUpdatedAt = localStorage.getItem('financeLastSync') || '';
            if (cloudUpdatedAt > localUpdatedAt) {
                console.log('🔥 Firebase: пришли новые данные');
                applyCloudData(cloud);
            }
        });
    } else {
        currentUser = null;
        console.log('🔥 Firebase: вышел');
        setAuthStatus('⚠️ Данные хранятся только в этом браузере', 'info');
        showLoggedOut();
        if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
    }
});

async function loadFromCloud(uid) {
    try {
        const snap = await getDoc(doc(db, "users", uid));
        if (!snap.exists()) {
            console.log('🔥 Firebase: облако пустое, заливаю локальные данные');
            await pushToCloud();
            return;
        }
        const cloud = snap.data();
        const localUpdatedAt = localStorage.getItem('financeLastSync') || '';

        if (!localUpdatedAt || (cloud.updatedAt && cloud.updatedAt > localUpdatedAt)) {
            const hasLocalData = localStorage.getItem('financeData');
            if (!hasLocalData) {
                applyCloudData(cloud);
            } else {
                const useCloud = confirm(
                    '🔥 Найдены данные в облаке.\n\n' +
                    'ОК — загрузить из облака (перезапишет локальные).\n' +
                    'Отмена — оставить локальные и залить их в облако.'
                );
                if (useCloud) applyCloudData(cloud);
                else await pushToCloud();
            }
        }
    } catch (e) {
        console.error('🔥 Firebase: ошибка загрузки', e);
        setAuthStatus('Ошибка загрузки из облака: ' + (e.code || e.message), 'error');
    }
}

function applyCloudData(cloud) {
    isCloudSyncing = true;
    try {
        if (typeof balance !== 'undefined') balance = cloud.balance ?? balance;
        if (typeof transactions !== 'undefined') transactions = cloud.transactions || [];
        if (typeof goals !== 'undefined') goals = cloud.goals || [];
        if (typeof envelopes !== 'undefined') envelopes = cloud.envelopes || [];
        if (typeof reserves !== 'undefined') reserves = cloud.reserves || [];
        if (typeof categories !== 'undefined' && cloud.categories) categories = cloud.categories;

        const payload = { balance, transactions, goals, envelopes, reserves, categories };
        localStorage.setItem('financeData', JSON.stringify(payload));
        localStorage.setItem('financeLastSync', cloud.updatedAt || new Date().toISOString());

        if (typeof render === 'function') render();
        if (typeof fillCategorySelects === 'function') fillCategorySelects();
        console.log('🔥 Firebase: данные из облака применены');
    } finally {
        setTimeout(() => { isCloudSyncing = false; }, 500);
    }
}

async function pushToCloud() {
    if (!currentUser || isCloudSyncing) return;
    try {
        const payload = {
            balance, transactions, goals, envelopes, reserves, categories,
            updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, "users", currentUser.uid), payload);
        localStorage.setItem('financeLastSync', payload.updatedAt);
        console.log('🔥 Firebase: отправлено в облако');
    } catch (e) {
        console.error('🔥 Firebase: ошибка отправки', e);
        setAuthStatus('Ошибка сохранения в облако: ' + (e.code || e.message), 'error');
    }
}

// Перехватываем localStorage.setItem, чтобы ловить все сохранения
const _originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function(key, value) {
    _originalSetItem(key, value);
    if (key === 'financeData' && currentUser && !isCloudSyncing) {
        clearTimeout(pushTimer);
        pushTimer = setTimeout(pushToCloud, 800);
    }
};

window.firebasePush = pushToCloud;
window.firebaseStatus = () => currentUser ? `вошёл как ${currentUser.email}` : 'не вошёл';
