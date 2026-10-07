// ===== СИНХРОНИЗАЦИЯ С FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore, doc, getDoc, setDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getAuth, signInAnonymously, onAuthStateChanged
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
let isCloudSyncing = false;   // защита от петли
let pushTimer = null;

console.log('🔥 Firebase: инициализация...');

signInAnonymously(auth).then(() => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) return;
        currentUser = user;
        console.log('🔥 Firebase: вошёл как', user.uid);

        // Сохраним uid, чтобы на другом устройстве можно было войти тем же юзером
        const knownUid = localStorage.getItem('financeFirebaseUid');
        if (!knownUid) {
            localStorage.setItem('financeFirebaseUid', user.uid);
        }

        // Загружаем данные из облака
        await loadFromCloud(user.uid);

        // Подписываемся на изменения с другого устройства
        onSnapshot(doc(db, "users", user.uid), (snap) => {
            if (!snap.exists()) return;
            if (isCloudSyncing) return;
            const cloud = snap.data();
            const cloudUpdatedAt = cloud.updatedAt || '';
            const localUpdatedAt = localStorage.getItem('financeLastSync') || '';
            if (cloudUpdatedAt > localUpdatedAt) {
                console.log('🔥 Firebase: пришли новые данные с другого устройства');
                applyCloudData(cloud);
            }
        });
    });
}).catch(err => {
    console.error('🔥 Firebase: ошибка входа', err);
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

        // Если в облаке нет отметки или локально данных нет — берём из облака
        if (!localUpdatedAt || (cloud.updatedAt && cloud.updatedAt > localUpdatedAt)) {
            const hasLocalData = localStorage.getItem('financeData');
            if (!hasLocalData) {
                console.log('🔥 Firebase: беру данные из облака');
                applyCloudData(cloud);
            } else {
                const useCloud = confirm(
                    '🔥 Найдены данные в облаке.\n\n' +
                    'ОК — загрузить данные из облака (перезапишет локальные).\n' +
                    'Отмена — оставить локальные и залить их в облако.'
                );
                if (useCloud) {
                    applyCloudData(cloud);
                } else {
                    await pushToCloud();
                }
            }
        }
    } catch (e) {
        console.error('🔥 Firebase: ошибка загрузки', e);
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

        // Сохраняем локально без синхронизации
        const payload = { balance, transactions, goals, envelopes, reserves, categories };
        localStorage.setItem('financeData', JSON.stringify(payload));
        localStorage.setItem('financeLastSync', cloud.updatedAt || new Date().toISOString());

        // Перерисовываем
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
        console.log('🔥 Firebase: данные отправлены в облако');
    } catch (e) {
        console.error('🔥 Firebase: ошибка отправки', e);
    }
}

// Перехватываем localStorage.setItem, чтобы ловить все сохранения
const _originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function(key, value) {
    _originalSetItem(key, value);
    if (key === 'financeData' && currentUser && !isCloudSyncing) {
        clearTimeout(pushTimer);
        pushTimer = setTimeout(pushToCloud, 800);  // дебаунс 800 мс
    }
};

// Экспорт в window, чтобы можно было вручную вызвать
window.firebasePush = pushToCloud;
window.firebaseStatus = () => currentUser ? `вошёл как ${currentUser.uid}` : 'не вошёл';
