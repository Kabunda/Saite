import { DOM_IDS, CSS_CLASSES } from '../utils/constants.js';
import { formatTime, createElement, addAriaAttributes } from '../utils/helpers.js';
import { StorageService } from '../services/storage.js';

/**
 * Менеджер пользовательского интерфейса
 */
export class UIManager {
  constructor() {
    this.elements = {};
    this.initElements();
  }

  /**
   * Инициализирует ссылки на DOM-элементы
   */
  initElements() {
    // Основные экраны
    this.elements.menuScreen = document.getElementById(DOM_IDS.menuScreen);
    this.elements.gameScreen = document.getElementById(DOM_IDS.gameScreen);
    this.elements.resultScreen = document.getElementById(DOM_IDS.resultScreen);

    // Кнопки меню
    this.elements.startBtn = document.getElementById(DOM_IDS.startBtn);
    this.elements.connectBtn = document.getElementById(DOM_IDS.connectBtn);
    this.elements.renameBtn = document.getElementById(DOM_IDS.renameBtn);
    this.elements.networkBtn = document.getElementById(DOM_IDS.networkBtn);
    this.elements.backBtn = document.getElementById(DOM_IDS.backBtn);
    this.elements.pauseBtn = document.getElementById(DOM_IDS.pauseBtn);
    this.elements.playAgainBtn = document.getElementById(DOM_IDS.playAgainBtn);
    this.elements.toMenuBtn = document.getElementById(DOM_IDS.toMenuBtn);

    // Настройки
    this.elements.soundToggle = document.getElementById(DOM_IDS.soundToggle);
    this.elements.vibrationToggle = document.getElementById(DOM_IDS.vibrationToggle);

    // Информационные элементы
    this.elements.playerInfo = document.getElementById(DOM_IDS.playerInfo);
    this.elements.connectStatus = document.getElementById(DOM_IDS.connectStatus);
    this.elements.networkStatus = document.getElementById(DOM_IDS.networkStatus);
    this.elements.leaderboardBody = document.getElementById(DOM_IDS.leaderboardBody);

    // Элементы игры
    this.elements.progressTrack = document.getElementById(DOM_IDS.progressTrack);
    this.elements.timer = document.getElementById(DOM_IDS.timer);
    this.elements.questionText = document.getElementById(DOM_IDS.questionText);
    this.elements.answerText = document.getElementById(DOM_IDS.answerText);
    this.elements.feedback = document.getElementById(DOM_IDS.feedback);
    this.elements.keypad = document.getElementById(DOM_IDS.keypad);
    this.elements.streak = document.getElementById(DOM_IDS.streak);
    this.elements.resultSummary = document.getElementById(DOM_IDS.resultSummary);
    this.elements.answersList = document.getElementById(DOM_IDS.answersList);
    
    // Сетевые элементы
    this.elements.networkProgress = document.getElementById(DOM_IDS.networkProgress);
    this.elements.participantsList = document.getElementById(DOM_IDS.participantsList);
  }

  /**
   * Показывает экран
   * @param {string} screen - идентификатор экрана (menu, game, result)
   */
  showScreen(screen) {
    // Скрываем все экраны
    this.elements.menuScreen.classList.add(CSS_CLASSES.hidden);
    this.elements.gameScreen.classList.add(CSS_CLASSES.hidden);
    this.elements.resultScreen.classList.add(CSS_CLASSES.hidden);

    // Показываем нужный экран
    switch (screen) {
      case 'menu':
        this.elements.menuScreen.classList.remove(CSS_CLASSES.hidden);
        break;
      case 'game':
        this.elements.gameScreen.classList.remove(CSS_CLASSES.hidden);
        break;
      case 'result':
        this.elements.resultScreen.classList.remove(CSS_CLASSES.hidden);
        break;
    }
  }

  /**
   * Обновляет статус в меню
   */
  updateMenuStatus() {
    const playerName = StorageService.getPlayerName();
    const isConnected = StorageService.isConnected();
    const isNetworkMode = StorageService.isNetworkMode();

    this.elements.playerInfo.textContent = `Игрок: ${playerName}`;
    this.elements.connectStatus.textContent = isConnected
      ? "Подключение: активно"
      : "Подключение: отключено";
    this.elements.networkStatus.textContent = isNetworkMode
      ? "Сетевой режим: включен"
      : "Сетевой режим: выключен";
  }

  /**
   * Отображает таблицу лидеров
   */
  async renderLeaderboard() {
    const tbody = this.elements.leaderboardBody;
    
    // Показываем индикатор загрузки, если есть сетевой режим
    if (StorageService.isNetworkMode() && StorageService.isConnected()) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4">Загрузка таблицы лидеров...</td>
        </tr>
      `;
    }

    try {
      const items = await StorageService.getLeaderboard();

      if (!items.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4">Пока нет результатов.</td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = "";
      items.forEach((item, index) => {
        const row = createElement('tr', {}, '');
        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${item.playerName}</td>
          <td>${item.totalTimeSec.toFixed(1)} сек</td>
          <td>${item.score}/${item.rounds}</td>
        `;
        tbody.appendChild(row);
      });
    } catch (error) {
      console.error('Ошибка загрузки таблицы лидеров:', error);
      tbody.innerHTML = `
        <tr>
          <td colspan="4">Не удалось загрузить таблицу лидеров.</td>
        </tr>
      `;
    }
  }

  /**
   * Инициализирует трек прогресса
   * @param {number} totalQuestions - общее количество вопросов
   * @returns {Array} массив ячеек прогресса
   */
  initProgressTrack(totalQuestions) {
    this.elements.progressTrack.innerHTML = "";
    const cells = [];

    for (let i = 0; i < totalQuestions; i += 1) {
      const cell = createElement('div', { className: 'progress-cell' });
      addAriaAttributes(cell, {
        'aria-label': `Вопрос ${i + 1}, не отвечен`,
        'role': 'progressbar',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': '0'
      });
      this.elements.progressTrack.appendChild(cell);
      cells.push(cell);
    }

    return cells;
  }

  /**
   * Обновляет ячейку прогресса
   * @param {Array} cells - массив ячеек
   * @param {number} index - индекс ячейки
   * @param {boolean} isCorrect - правильный ли ответ
   */
  updateProgressCell(cells, index, isCorrect) {
    const cell = cells[index];
    if (!cell) return;

    cell.classList.remove(CSS_CLASSES.progressOk, CSS_CLASSES.progressBad);
    cell.classList.add(isCorrect ? CSS_CLASSES.progressOk : CSS_CLASSES.progressBad);
    
    const status = isCorrect ? 'правильно' : 'неправильно';
    addAriaAttributes(cell, {
      'aria-label': `Вопрос ${index + 1}, ${status}`,
      'aria-valuenow': isCorrect ? '100' : '0'
    });
  }

  /**
   * Обновляет таймер
   * @param {number} totalSec - общее время в секундах
   */
  updateTimer(totalSec) {
    this.elements.timer.textContent = `Время: ${formatTime(totalSec)}`;
    addAriaAttributes(this.elements.timer, {
      'aria-live': 'polite',
      'aria-label': `Прошло времени: ${formatTime(totalSec)}`
    });
  }

  /**
   * Обновляет вопрос
   * @param {string} questionText - текст вопроса
   */
  updateQuestion(questionText) {
    this.elements.questionText.textContent = questionText;
    addAriaAttributes(this.elements.questionText, {
      'aria-live': 'polite'
    });
  }

  /**
   * Обновляет ответ
   * @param {string} answer - текущий ответ
   */
  updateAnswer(answer) {
    this.elements.answerText.textContent = answer.length ? answer : "_";
    addAriaAttributes(this.elements.answerText, {
      'aria-live': 'polite'
    });
  }

  /**
   * Показывает обратную связь
   * @param {string} text - текст обратной связи
   * @param {boolean} isCorrect - правильный ли ответ
   */
  showFeedback(text, isCorrect) {
    const feedback = this.elements.feedback;
    feedback.textContent = text;
    feedback.classList.remove(CSS_CLASSES.ok, CSS_CLASSES.bad);
    feedback.classList.add(isCorrect ? CSS_CLASSES.ok : CSS_CLASSES.bad);
    
    // Добавляем анимацию
    feedback.classList.remove('answer-correct', 'answer-incorrect');
    setTimeout(() => {
      feedback.classList.add(isCorrect ? 'answer-correct' : 'answer-incorrect');
    }, 10);
    
    addAriaAttributes(feedback, {
      'aria-live': 'assertive',
      'aria-label': text
    });
  }

  /**
   * Сбрасывает обратную связь
   */
  resetFeedback() {
    const feedback = this.elements.feedback;
    feedback.textContent = "";
    feedback.classList.remove(CSS_CLASSES.ok, CSS_CLASSES.bad);
  }

  /**
   * Обновляет серию правильных ответов
   * @param {number} streak - текущая серия
   */
  updateStreak(streak) {
    this.elements.streak.textContent = `Серия: ${streak}`;
  }

  /**
   * Обновляет состояние паузы
   * @param {boolean} isPaused - находится ли игра на паузе
   */
  updatePauseState(isPaused) {
    this.elements.pauseBtn.textContent = isPaused ? "Продолжить" : "Пауза";
    this.elements.keypad.classList.toggle(CSS_CLASSES.paused, isPaused);
    
    const status = isPaused ? 'игра на паузе' : 'игра активна';
    addAriaAttributes(this.elements.gameScreen, {
      'aria-label': status
    });
  }

  /**
   * Показывает результаты игры
   * @param {Object} result - результат игры
   * @param {Array} answersLog - история ответов
   */
  showResults(result, answersLog) {
    const { playerName, score, rounds, totalTimeSec, bestStreak, mistakes } = result;
    
    this.elements.resultSummary.textContent =
      `${playerName}, результат: ${score}/${rounds}. ` +
      `Время: ${totalTimeSec.toFixed(1)} сек. ` +
      `Лучшая серия: ${bestStreak}. Ошибок: ${mistakes}.`;

    // Отображаем историю ответов
    this.elements.answersList.innerHTML = "";
    answersLog.forEach((item, index) => {
      const li = createElement('li', {
        className: item.isCorrect ? CSS_CLASSES.answerOk : CSS_CLASSES.answerBad
      }, '');
      
      const status = item.isCorrect ? "Верно" : "Неверно";
      li.textContent =
        `${index + 1}) ${item.a} × ${item.b} = ${item.playerAnswer} ` +
        `(${status}, правильно: ${item.correctAnswer})`;
      
      this.elements.answersList.appendChild(li);
    });
  }

  /**
   * Инициализирует настройки UI
   */
  initSettings() {
    this.elements.soundToggle.checked = StorageService.isSoundEnabled();
    this.elements.vibrationToggle.checked = StorageService.isVibrationEnabled();
  }

  /**
   * Анимирует нажатие клавиши
   * @param {HTMLElement} keyElement - элемент клавиши
   */
  animateKeyPress(keyElement) {
    if (!keyElement) return;
    
    keyElement.classList.add('key-pressed');
    setTimeout(() => {
      keyElement.classList.remove('key-pressed');
    }, 200);
  }

  /**
   * Анимирует изменение счета
   * @param {HTMLElement} element - элемент счета
   */
  animateScoreChange(element) {
    if (!element) return;
    
    element.classList.add('score-change');
    setTimeout(() => {
      element.classList.remove('score-change');
    }, 600);
  }

  /**
   * Добавляет ARIA-атрибуты для улучшения доступности
   */
  enhanceAccessibility() {
    // Добавляем ARIA-атрибуты для основных элементов
    addAriaAttributes(this.elements.menuScreen, {
      'aria-label': 'Главное меню тренажера умножения'
    });
    
    addAriaAttributes(this.elements.gameScreen, {
      'aria-label': 'Экран игры'
    });
    
    addAriaAttributes(this.elements.resultScreen, {
      'aria-label': 'Экран результатов'
    });

    // Кнопки
    const buttons = [
      { element: this.elements.startBtn, label: 'Начать игру' },
      { element: this.elements.connectBtn, label: 'Подключить' },
      { element: this.elements.renameBtn, label: 'Сменить имя игрока' },
      { element: this.elements.networkBtn, label: 'Переключить сетевой режим' },
      { element: this.elements.pauseBtn, label: 'Пауза или продолжить игру' },
      { element: this.elements.backBtn, label: 'Вернуться в меню' },
      { element: this.elements.playAgainBtn, label: 'Играть снова' },
      { element: this.elements.toMenuBtn, label: 'Вернуться в главное меню' }
    ];

    buttons.forEach(({ element, label }) => {
      if (element) {
        addAriaAttributes(element, {
          'aria-label': label,
          'role': 'button'
        });
      }
    });

    // Клавиши клавиатуры
    const keys = this.elements.keypad.querySelectorAll('.key');
    keys.forEach(key => {
      const keyText = key.textContent || key.dataset.key;
      addAriaAttributes(key, {
        'aria-label': `Клавиша ${keyText}`,
        'role': 'button'
      });
    });
  }

  /**
   * Показывает прогресс участников сетевой игры
   */
  showNetworkProgress() {
    if (this.elements.networkProgress) {
      this.elements.networkProgress.classList.remove(CSS_CLASSES.hidden);
    }
  }

  /**
   * Скрывает прогресс участников сетевой игры
   */
  hideNetworkProgress() {
    if (this.elements.networkProgress) {
      this.elements.networkProgress.classList.add(CSS_CLASSES.hidden);
    }
  }

  /**
   * Обновляет отображение прогресса участников
   * @param {Object} participants - объект участников
   */
  updateNetworkProgress(participants) {
    if (!this.elements.participantsList) return;

    // Очищаем список
    this.elements.participantsList.innerHTML = '';

    // Сортируем участников по прогрессу (убывание)
    const sortedParticipants = Object.values(participants).sort((a, b) => {
      if (a.finished && !b.finished) return -1;
      if (!a.finished && b.finished) return 1;
      return (b.progress || 0) - (a.progress || 0);
    });

    // Ограничиваем количество участников (макс. 5)
    const limitedParticipants = sortedParticipants.slice(0, 5);

    // Создаем элементы для каждого участника
    limitedParticipants.forEach(participant => {
      const participantEl = document.createElement('div');
      participantEl.className = 'participant-item';
      
      const nameEl = document.createElement('span');
      nameEl.className = 'participant-name';
      nameEl.textContent = participant.name || 'Участник';
      
      const progressContainer = document.createElement('div');
      progressContainer.className = 'participant-progress';
      
      const progressBar = document.createElement('div');
      progressBar.className = 'progress-bar';
      
      const progressFill = document.createElement('div');
      progressFill.className = 'progress-fill';
      progressFill.style.width = `${participant.progress || 0}%`;
      
      progressBar.appendChild(progressFill);
      progressContainer.appendChild(progressBar);
      
      const scoreEl = document.createElement('span');
      scoreEl.className = 'participant-score';
      scoreEl.textContent = participant.score || 0;
      
      const statusEl = document.createElement('span');
      statusEl.className = `participant-status ${participant.finished ? 'finished' : ''}`;
      statusEl.textContent = participant.finished ? 'Завершил' : 'В игре';
      
      participantEl.appendChild(nameEl);
      participantEl.appendChild(progressContainer);
      participantEl.appendChild(scoreEl);
      participantEl.appendChild(statusEl);
      
      this.elements.participantsList.appendChild(participantEl);
    });

    // Если участников нет, показываем сообщение
    if (limitedParticipants.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'participant-item';
      emptyMsg.textContent = 'Нет других участников';
      this.elements.participantsList.appendChild(emptyMsg);
    }
  }

  /**
   * Показывает результаты сетевой игры
   * @param {Object} session - данные сессии
   */
  showNetworkResults(session) {
    // TODO: реализовать отображение результатов сетевой игры
    console.log('Результаты сетевой игры:', session);
  }
}