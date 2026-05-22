// auth.js

// Конфигурация вашего приложения
const CONFIG = {
    YANDEX_CLIENT_ID: '290d912b03064db5a704dee57630b8d0', // Замените на ваш Client ID
    // URL для обмена кода на токен через вашу облачную функцию
    CLOUD_FUNCTION_URL: 'https://d5d6f50lp67cmro77v51.kocrdvxt.apigw.yandexcloud.net/token', // Замените на ваш URL
    // URL-адрес вашего сайта, куда Яндекс вернет пользователя после авторизации
    REDIRECT_URI: 'https://kabunda.github.io/Saite/Yauth/', // Замените на ваш Redirect URI
};

// Вспомогательная функция логирования с меткой времени
function log(step, details) {
    console.log(`[${new Date().toISOString()}] [${step}]`, details);
}

// Безопасная авторизация (Authorization Code Flow)
function startYandexAuthSecure() {
    const state = generateRandomString(16);
    localStorage.setItem('yandex_oauth_state', state);
    const authUrl = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${CONFIG.YANDEX_CLIENT_ID}&redirect_uri=${encodeURIComponent(CONFIG.REDIRECT_URI)}&state=${state}`;
    log('AUTH_START', 'Redirecting to Yandex OAuth');
    window.location.href = authUrl;
}

// Обмен кода на токен с подробным логированием
async function exchangeCodeForToken(code) {
    log('EXCHANGE_START', { code: code.substring(0, 6) + '...', url: CONFIG.CLOUD_FUNCTION_URL });

    try {
        const response = await fetch(CONFIG.CLOUD_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code }),
        });

        log('EXCHANGE_RESPONSE', {
            status: response.status,
            statusText: response.statusText,
            headers: [...response.headers.entries()],
        });

        // Попытаемся прочитать тело ответа в любом случае
        let responseBody;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            responseBody = await response.json();
        } else {
            responseBody = await response.text();
        }
        log('EXCHANGE_BODY', responseBody);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${JSON.stringify(responseBody)}`);
        }

        // Успех
        console.log('Токен доступа получен:', responseBody);
        localStorage.setItem('yandex_access_token', responseBody.access_token);
        document.getElementById('result').textContent = `Вход выполнен! Токен: ${responseBody.access_token}`;
    } catch (error) {
        log('EXCHANGE_ERROR', { message: error.message, stack: error.stack });
        document.getElementById('result').textContent = `Ошибка обмена: ${error.message}. Подробности в консоли.`;
    }
}

// Генерация случайной строки
function generateRandomString(length) {
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
}

// Обработка возврата с Яндекса
function handleYandexCallback() {
    log('CALLBACK', { url: window.location.href, hash: window.location.hash, search: window.location.search });

    // Сначала проверяем Authorization Code Flow (query-параметры)
    const queryParams = new URLSearchParams(window.location.search);
    const code = queryParams.get('code');
    const state = queryParams.get('state');
    const error = queryParams.get('error');

    if (error) {
        log('CALLBACK_ERROR', error);
        document.getElementById('result').textContent = `Ошибка авторизации: ${error}`;
        return;
    }

    if (code) {
        log('CALLBACK_CODE', code);
        const storedState = localStorage.getItem('yandex_oauth_state');
        if (state && state !== storedState) {
            log('CALLBACK_STATE_MISMATCH', { expected: storedState, received: state });
            document.getElementById('result').textContent = 'Ошибка безопасности: несовпадение state.';
            return;
        }
        // Обмениваем код
        exchangeCodeForToken(code);
        return;
    }

    // Если кода нет, но есть hash (Implicit Flow, на случай если переключили)
    if (window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        if (accessToken) {
            log('CALLBACK_IMPLICIT', accessToken);
            localStorage.setItem('yandex_access_token', accessToken);
            document.getElementById('result').textContent = `Вход выполнен! Токен: ${accessToken}`;
            return;
        }
    }

    // Ничего не нашли
    log('CALLBACK_NO_CODE', 'Не удалось найти ни code, ни access_token в URL');
    document.getElementById('result').textContent = 'Ошибка: Не удалось получить токен или код.';
}

// Привязка кнопки
document.getElementById('yandex-auth-btn').addEventListener('click', startYandexAuthSecure);

// Автоматический запуск обработчика, если мы на callback-странице
if (window.location.pathname.includes('Yauth') || window.location.search.includes('code=')) {
    handleYandexCallback();
}