# План интеграции Firebase Realtime Database

## Цель
Реализовать хранение результатов игры на внешнем сервисе Firebase Realtime Database с сохранением обратной совместимости с локальным хранилищем.

## Текущая архитектура
- Результаты сохраняются в `localStorage` через `StorageService.saveResult(result)`
- Таблица лидеров загружается из `localStorage` через `StorageService.getLeaderboard()`
- Есть флаги подключения (`mt_connected`) и сетевого режима (`mt_network_mode`), которые пока только управляют UI

## Новая архитектура
### Компоненты
1. **Firebase Configuration** (`src/scripts/services/firebase-config.js`) – конфигурационные данные Firebase.
2. **FirebaseService** (`src/scripts/services/firebase.js`) – класс для взаимодействия с Firebase Realtime Database.
3. **Обновлённый StorageService** – будет использовать FirebaseService при включённом сетевом режиме.
4. **UI обновления** – отображение статуса синхронизации, ошибок сети.

### Поток данных
```
Игра завершается → результат формируется → 
если сетевой режим включён → сохранить в Firebase и локально
иначе → сохранить только локально
```

### Структура данных в Firebase
```json
{
  "gameResults": {
    "-NuniqueId": {
      "playerName": "Игрок",
      "totalTimeSec": 45.2,
      "score": 120,
      "rounds": 5,
      "bestStreak": 3,
      "mistakes": 2,
      "finishedAt": 1745401234567,
      "syncedAt": 1745401234567,
      "deviceId": "abc123"
    }
  },
  "leaderboard": {
    "-NuniqueId": {
      "playerName": "Игрок",
      "totalTimeSec": 45.2,
      "score": 120,
      "rank": 1
    }
  }
}
```

## Шаги реализации

### 1. Настройка Firebase в проекте
- Создать файл `src/scripts/services/firebase-config.js` с конфигурацией.
- Добавить теги script для Firebase SDK в `index.html` (или использовать модули ES).
- Инициализировать Firebase в `firebase.js`.

### 2. Создание FirebaseService
Класс с методами:
- `init()` – инициализация Firebase.
- `saveResult(result)` – сохранение результата в `gameResults`.
- `getLeaderboard(limit)` – получение топ-N результатов, отсортированных по `totalTimeSec`.
- `subscribeToLeaderboard(callback)` – подписка на обновления таблицы лидеров в реальном времени.
- `isConnected()` – проверка наличия сети.

### 3. Модификация StorageService
Добавить:
- Статическое свойство `useNetwork` (определяется по флагу `mt_network_mode`).
- Метод `saveResult` будет вызывать `FirebaseService.saveResult` если `useNetwork` true, и всегда сохранять локально.
- Метод `getLeaderboard` будет пытаться загрузить из Firebase если `useNetwork` true, иначе из localStorage.

### 4. Обновление UI
- В `UIManager.updateMenuStatus()` отображать статус Firebase (подключён/нет).
- Добавить индикатор синхронизации при сохранении результата.
- Показывать ошибки сети, если синхронизация не удалась.

### 5. Обработка офлайн-режима
- При отсутствии сети сохранять результат в очередь (localStorage) и синхронизировать позже.
- При восстановлении соединения отправлять накопившиеся результаты.

### 6. Правила безопасности Firebase
Настроить правила базы данных для чтения/записи (например, разрешить запись без аутентификации для тестирования, но позже добавить аутентификацию).

## Файлы для создания/изменения
- `src/scripts/services/firebase-config.js` (новый)
- `src/scripts/services/firebase.js` (новый)
- `src/scripts/services/storage.js` (изменения)
- `src/scripts/ui/manager.js` (изменения)
- `index.html` (добавить скрипты Firebase)
- `src/scripts/main.js` (возможно, инициализация Firebase)

## Тестирование
1. Локальное сохранение (сетевой режим выключен) – должно работать как раньше.
2. Сетевое сохранение (режим включён) – результат появляется в Firebase.
3. Загрузка таблицы лидеров из Firebase.
4. Офлайн-сценарий: отключить интернет, сыграть, включить – синхронизация.

## Риски и миграция
- При первом включении сетевого режима можно синхронизировать существующие локальные результаты.
- Обеспечить обратную совместимость: если Firebase недоступен, fallback на localStorage.

## Временная оценка
~4-6 часов разработки и тестирования.

## Следующие шаги
После утверждения плана переключиться в режим Code для реализации.