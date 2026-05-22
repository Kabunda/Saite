// auth.js

// Конфигурация вашего приложения
const CONFIG = {
    YANDEX_CLIENT_ID: '290d912b03064db5a704dee57630b8d0', // Замените на ваш Client ID
    // URL для обмена кода на токен через вашу облачную функцию
    CLOUD_FUNCTION_URL: 'https://d5d6f50lp67cmro77v51.kocrdvxt.apigw.yandexcloud.net',//'https://functions.yandexcloud.net/d4ec0efi2s8u2vmsc6lu', // Замените на ваш URL
    // URL-адрес вашего сайта, куда Яндекс вернет пользователя после авторизации
    REDIRECT_URI: 'https://kabunda.github.io/Saite/Yauth/', // Замените на ваш Redirect URI
};

// Функция для запуска процесса авторизации (с использованием Implicit Flow)
function startYandexAuth() {
    // ВНИМАНИЕ: Этот метод (Implicit Flow) используется здесь ТОЛЬКО ДЛЯ ТЕСТИРОВАНИЯ.
    // В production-среде используйте Authorization Code Flow (см. функцию startYandexAuthSecure).
    const authUrl = `https://oauth.yandex.ru/authorize?response_type=token&client_id=${CONFIG.YANDEX_CLIENT_ID}&redirect_uri=${encodeURIComponent(CONFIG.REDIRECT_URI)}`;
    window.location.href = authUrl;
}

// Функция для запуска процесса авторизации (рекомендуется для production)
function startYandexAuthSecure() {
    const state = generateRandomString(16); // Генерируем параметр state для защиты от CSRF
    localStorage.setItem('yandex_oauth_state', state);
    
    const authUrl = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${CONFIG.YANDEX_CLIENT_ID}&redirect_uri=${encodeURIComponent(CONFIG.REDIRECT_URI)}&state=${state}`;
    window.location.href = authUrl;
}

// Функция для обмена кода подтверждения на токен доступа через облачную функцию
async function exchangeCodeForToken(code) {
    try {
        const response = await fetch(CONFIG.CLOUD_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code: code }),
        });

        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }

        const data = await response.json();
        console.log('Токен доступа получен:', data);
        // Сохраните токен в безопасном месте (например, в localStorage для тестирования)
        localStorage.setItem('yandex_access_token', data.access_token);
        // Обновите интерфейс
        document.getElementById('result').textContent = `Вход выполнен! Токен: ${data.access_token}`;
    } catch (error) {
        console.error('Ошибка при обмене кода на токен:', error);
        document.getElementById('result').textContent = `Ошибка: ${error.message}`;
    }
}

// Вспомогательная функция для генерации случайной строки (для параметра state)
function generateRandomString(length) {
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
}

// Функция для обработки ответа от Яндекса (вызывается на странице /callback)
function handleYandexCallback() {
    const urlParams = new URLSearchParams(window.location.hash.substring(1)); // Для Implicit Flow
    const accessToken = urlParams.get('access_token');
    const error = urlParams.get('error');

    if (accessToken) {
        console.log('Токен доступа получен:', accessToken);
        // Сохраните токен в безопасном месте (например, в localStorage для тестирования)
        localStorage.setItem('yandex_access_token', accessToken);
        // Обновите интерфейс
        document.getElementById('result').textContent = `Вход выполнен! Токен: ${accessToken}`;
    } else if (error) {
        console.error('Ошибка авторизации:', error);
        document.getElementById('result').textContent = `Ошибка авторизации: ${error}`;
    } else {
        // Для Authorization Code Flow проверяем наличие кода в параметрах запроса
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const storedState = localStorage.getItem('yandex_oauth_state');
        
        if (code) {
            if (state && state !== storedState) {
                console.error('Ошибка: Несовпадение параметра state. Возможна CSRF-атака.');
                document.getElementById('result').textContent = 'Ошибка безопасности: несовпадение state.';
                return;
            }
            // Обмениваем код на токен
            exchangeCodeForToken(code);
        } else {
            document.getElementById('result').textContent = 'Ошибка: Не удалось получить токен или код.';
        }
    }
}

// Навешиваем обработчик на кнопку
document.getElementById('yandex-auth-btn').addEventListener('click', startYandexAuthSecure); // Используем безопасный метод

// Если страница загружена как redirect_uri, обрабатываем ответ Яндекса
if (window.location.pathname === '/callback' || window.location.hash || window.location.search.includes('code=')) {
    handleYandexCallback();
}