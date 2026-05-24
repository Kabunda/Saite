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

        // Успех - сохраняем токен
        console.log('Токен доступа получен:', responseBody);
        const accessToken = responseBody.access_token; // Предполагается, что токен в поле access_token
        if (!accessToken) {
             throw new Error('Токен доступа не найден в ответе сервера.');
        }
        localStorage.setItem('yandex_access_token', accessToken);

        // Теперь получаем данные пользователя
        await fetchUserInfo(accessToken);

    } catch (error) {
        log('EXCHANGE_ERROR', { message: error.message, stack: error.stack });
        document.getElementById('result').textContent = `Ошибка обмена: ${error.message}. Подробности в консоли.`;
        // Очищаем возможный неполный токен при ошибке
        localStorage.removeItem('yandex_access_token');
    }
}

// Функция для получения информации о пользователе
async function fetchUserInfo(accessToken) {
    try {
        log('USER_INFO_FETCH', 'Запрос данных пользователя...');
        const response = await fetch('https://api-yandex-id.readthedocs.io/ru/latest/reference/get-docs-intro.html', { // Исправьте URL на реальный endpoint, например, 'https://login.yandex.ru/info'
            method: 'GET',
            headers: {
                'Authorization': `OAuth ${accessToken}`, // Важно: используется 'OAuth', а не 'Bearer'
            },
        });

        log('USER_INFO_RESPONSE', {
            status: response.status,
            statusText: response.statusText,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} при получении данных пользователя.`);
        }

        const userInfo = await response.json(); // Ожидаем JSON с данными пользователя
        log('USER_INFO_RECEIVED', userInfo);

        // Отображаем имя и аватарку
        displayUserInfo(userInfo);

    } catch (error) {
        log('USER_INFO_ERROR', { message: error.message, stack: error.stack });
        document.getElementById('result').textContent += ` Ошибка получения данных профиля: ${error.message}. Подробности в консоли.`;
         // В случае ошибки получения данных, всё равно показываем, что вход состоялся, но без профиля
         const tokenDisplay = localStorage.getItem('yandex_access_token') ? `Токен сохранён, но данные профиля недоступны.` : '';
         document.getElementById('result').textContent = `Вход выполнен частично. ${tokenDisplay}`;
         // Очищаем элементы профиля, если они были
         document.getElementById('avatar-container').innerHTML = '';
         document.getElementById('username-display').textContent = '';
    }
}

// Функция для отображения информации о пользователе
function displayUserInfo(userInfo) {
    const nameElement = document.getElementById('username-display');
    const avatarContainer = document.getElementById('avatar-container');
    const resultElement = document.getElementById('result'); // Обновляем элемент результата

    // Очищаем предыдущие сообщения об ошибке или успехе обмена
    resultElement.textContent = '';

    // Имя пользователя
    if (userInfo.real_name) {
        nameElement.textContent = userInfo.real_name;
    } else if (userInfo.display_name) {
        nameElement.textContent = userInfo.display_name; // fallback к display_name
    } else {
        nameElement.textContent = 'Пользователь Яндекса'; // fallback если имя недоступно
    }

    // Аватарка
    avatarContainer.innerHTML = ''; // Очищаем контейнер
    if (userInfo.default_avatar_id) {
        // Формируем URL аватара, как описано в документации Яндекс ID
        const avatarUrl = `https://avatars.yandex.net/get-yapic/${userInfo.default_avatar_id}/islands-200`;
        const img = document.createElement('img');
        img.src = avatarUrl;
        img.alt = 'Аватар';
        img.style.width = '50px'; // Установим размер
        img.style.height = '50px';
        img.style.borderRadius = '50%'; // Сделаем круглым
        img.onerror = () => { // Обработчик ошибки загрузки изображения
            console.warn('Не удалось загрузить аватар:', avatarUrl);
            img.style.display = 'none'; // Скрыть элемент, если аватарка не загрузилась
        };
        avatarContainer.appendChild(img);
    } else {
        // Если аватарка недоступна, можно добавить placeholder или ничего не делать
        console.info('Аватар недоступен у пользователя.');
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
        // Очищаем возможный старый токен при ошибке
        localStorage.removeItem('yandex_access_token');
        return;
    }

    if (code) {
        log('CALLBACK_CODE', code);
        const storedState = localStorage.getItem('yandex_oauth_state');
        if (state && state !== storedState) {
            log('CALLBACK_STATE_MISMATCH', { expected: storedState, received: state });
            document.getElementById('result').textContent = 'Ошибка безопасности: несовпадение state.';
            // Очищаем возможный старый токен при ошибке
            localStorage.removeItem('yandex_access_token');
            return;
        }
        // Обмениваем код на токен -> получаем данные -> отображаем
        exchangeCodeForToken(code);
        // Удаляем state после использования
        localStorage.removeItem('yandex_oauth_state');
        return;
    }

    // Если кода нет, но есть hash (Implicit Flow, на случай если переключили)
    // В Implicit Flow токен сразу в хэше, его нужно извлечь и использовать для получения данных
    if (window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const tokenType = hashParams.get('token_type'); // Проверим тип токена, если нужен
        if (accessToken) {
            log('CALLBACK_IMPLICIT', accessToken);
            localStorage.setItem('yandex_access_token', accessToken);
            // После сохранения токена, получаем и отображаем данные
            fetchUserInfo(accessToken).catch(error => {
                 log('IMPLICIT_USER_INFO_ERROR', { message: error.message, stack: error.stack });
                 document.getElementById('result').textContent = `Ошибка получения данных профиля после Implicit Flow: ${error.message}. Подробности в консоли.`;
                 // Очищаем возможный неполный токен при ошибке получения данных
                 localStorage.removeItem('yandex_access_token');
            });
            return;
        }
    }

    // Ничего не нашли
    log('CALLBACK_NO_CODE', 'Не удалось найти ни code, ни access_token в URL');
    document.getElementById('result').textContent = 'Ошибка: Не удалось получить токен или код.';
    // Очищаем возможный старый токен при ошибке
    localStorage.removeItem('yandex_access_token');
}

// Функция для проверки наличия токена и отображения профиля (например, при загрузке главной страницы)
function checkAndDisplayProfileOnLoad() {
    const token = localStorage.getItem('yandex_access_token');
    if (token) {
        console.log("Токен найден в localStorage, пытаемся получить данные профиля.");
        // Попробуем получить и отобразить данные профиля
        fetchUserInfo(token).catch(error => {
             log('LOAD_USER_INFO_ERROR', { message: error.message, stack: error.stack });
             // Не меняем результат на главной странице, просто логируем ошибку
             console.error("Ошибка получения профиля при загрузке:", error);
        });
    }
    // Если токена нет, ничего не делаем, оставляем кнопку входа видимой.
}


// Привязка кнопки
document.getElementById('yandex-auth-btn')?.addEventListener('click', startYandexAuthSecure);

// Автоматический запуск обработчика, если мы на callback-странице
if (window.location.pathname.includes('Yauth') || window.location.search.includes('code=')) {
    handleYandexCallback();
} else {
    // Если мы НЕ на callback-странице, проверим наличие токена и покажем профиль
    checkAndDisplayProfileOnLoad();
}