// auth.js

// Конфигурация вашего приложения
const CONFIG = {
    YANDEX_CLIENT_ID: '290d912b03064db5a704dee57630b8d0', // Замените на ваш Client ID
    // URL для обмена кода на токен через вашу облачную функцию
    CLOUD_FUNCTION_URL: 'https://d5d6f50lp67cmro77v51.kocrdvxt.apigw.yandexcloud.net',//'https://functions.yandexcloud.net/d4ec0efi2s8u2vmsc6lu', // Замените на ваш URL
    // URL-адрес вашего сайта, куда Яндекс вернет пользователя после авторизации
    REDIRECT_URI: 'https://kabunda.github.io/Saite/Yauth/', // Замените на ваш Redirect URI
};

// Безопасная авторизация (Authorization Code Flow)
function startYandexAuthSecure() {
    const state = generateRandomString(16);
    localStorage.setItem('yandex_oauth_state', state);
    const authUrl = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${CONFIG.YANDEX_CLIENT_ID}&redirect_uri=${encodeURIComponent(CONFIG.REDIRECT_URI)}&state=${state}`;
    window.location.href = authUrl;
}

// Упрощённая авторизация для теста (Implicit Flow) — используйте только если не работает Cloud Function
function startYandexAuthImplicit() {
    const authUrl = `https://oauth.yandex.ru/authorize?response_type=token&client_id=${CONFIG.YANDEX_CLIENT_ID}&redirect_uri=${encodeURIComponent(CONFIG.REDIRECT_URI)}`;
    window.location.href = authUrl;
}

// Обмен кода на токен через вашу Cloud Function
async function exchangeCodeForToken(code) {
    try {
        const response = await fetch(CONFIG.CLOUD_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
        });
        if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);
        const data = await response.json();
        console.log('Токен доступа получен:', data);
        localStorage.setItem('yandex_access_token', data.access_token);
        document.getElementById('result').textContent = `Вход выполнен! Токен: ${data.access_token}`;
    } catch (error) {
        console.error('Ошибка при обмене кода на токен:', error);
        document.getElementById('result').textContent = `Ошибка: ${error.message}`;
    }
}

// Генерация случайной строки для state
function generateRandomString(length) {
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
}

// Обработка возврата с Яндекса
function handleYandexCallback() {
    // 1. Проверяем Implicit Flow (параметры в hash)
    if (window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const error = hashParams.get('error');
        if (accessToken) {
            console.log('Токен доступа (Implicit):', accessToken);
            localStorage.setItem('yandex_access_token', accessToken);
            document.getElementById('result').textContent = `Вход выполнен! Токен: ${accessToken}`;
            return;
        }
        if (error) {
            console.error('Ошибка авторизации:', error);
            document.getElementById('result').textContent = `Ошибка авторизации: ${error}`;
            return;
        }
    }

    // 2. Проверяем Authorization Code Flow (параметры в query string)
    const queryParams = new URLSearchParams(window.location.search);
    const code = queryParams.get('code');
    const state = queryParams.get('state');
    const error = queryParams.get('error');

    if (error) {
        console.error('Ошибка авторизации:', error);
        document.getElementById('result').textContent = `Ошибка авторизации: ${error}`;
        return;
    }

    if (code) {
        const storedState = localStorage.getItem('yandex_oauth_state');
        if (state && state !== storedState) {
            console.error('Ошибка: Несовпадение state. Возможна CSRF-атака.');
            document.getElementById('result').textContent = 'Ошибка безопасности: несовпадение state.';
            return;
        }
        exchangeCodeForToken(code);
        return;
    }

    // Если ничего не найдено
    document.getElementById('result').textContent = 'Ошибка: Не удалось получить токен или код.';
}

// Навешиваем обработчик на кнопку (выберите нужный метод)
document.getElementById('yandex-auth-btn').addEventListener('click', startYandexAuthSecure); // Рекомендуемый

// Если страница загружена с параметрами авторизации, запускаем обработку
if (window.location.pathname === '/callback' || window.location.hash || window.location.search.includes('code=')) {
    handleYandexCallback();
}