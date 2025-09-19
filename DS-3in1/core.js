// core.js
// Импортируем функции для работы с Firebase (если используются)
// import { saveResult, getHighscores } from './firebase.js';

let currentGame = null;
let gameType = 'multiple';

// Заглушки для функций работы с Firebase (если не реализованы)
function saveResult(name, time, score, gameType) {
    console.log(`Сохранение результата: ${name}, ${time} сек, ${score}/20, ${gameType}`);
    // Реальная реализация будет обращаться к Firebase
    saveResultToLocalStorage(name, time, score, gameType);
}

function getHighscores(gameType) {
    console.log(`Загрузка рекордов для: ${gameType}`);
    // Реальная реализация будет обращаться к Firebase
    return getHighscoresFromLocalStorage(gameType);
}

// Локальное хранилище для демонстрации
function saveResultToLocalStorage(name, time, score, gameType) {
    const results = JSON.parse(localStorage.getItem(`highscores_${gameType}`) || '[]');
    results.push({ name, time, score, gameType, date: new Date().toISOString() });
    
    // Сортируем по времени (чем меньше, тем лучше) и оставляем топ-5
    results.sort((a, b) => a.time - b.time);
    const topResults = results.slice(0, 5);
    
    localStorage.setItem(`highscores_${gameType}`, JSON.stringify(topResults));
    return topResults;
}

function getHighscoresFromLocalStorage(gameType) {
    return Promise.resolve(JSON.parse(localStorage.getItem(`highscores_${gameType}`) || '[]'));
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Загрузка рекордов
    loadHighscores();
    
    // Настройка обработчиков событий
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('checkBtn').addEventListener('click', checkAnswer);
    document.getElementById('resetBtn').addEventListener('click', resetGame);
    
    // Обработка выбора игры
    const gameRadios = document.querySelectorAll('input[name="game"]');
    gameRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            gameType = this.value;
            updateGameInfo();
            loadHighscores();
        });
    });
    
    // Обновляем информацию о выбранной игре
    updateGameInfo();
    
    // Обработка нажатия Enter в поле имени
    document.getElementById('playerName').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            startGame();
        }
    });
});

function updateGameInfo() {
    const gameTitles = {
        'multiple': 'Умножение 1',
        'neighbors': 'Уровень 2', 
        'complit': 'Уровень 3'
    };
    
    const gameRules = {
        'multiple': 'Решите 20 примеров на умножение как можно быстрее. Числа от 2 до 9.',
        'neighbors': 'Правила для уровня 2...',
        'complit': 'Правила для уровня 3...'
    };
    
    document.getElementById('nazvanie').textContent = gameTitles[gameType];
    document.getElementById('rules').textContent = gameRules[gameType];
}

async function loadHighscores() {
    try {
        const highscores = await getHighscores(gameType);
        const listElement = document.getElementById('highscoreList');
        listElement.innerHTML = '';
        
        if (highscores.length === 0) {
            listElement.innerHTML = '<p>Рекордов пока нет</p>';
            return;
        }
        
        highscores.forEach((score, index) => {
            const item = document.createElement('div');
            item.className = 'highscore-item';
            item.innerHTML = `${index + 1}. ${score.name}: ${score.time.toFixed(2)} сек (${score.score}/20)`;
            listElement.appendChild(item);
        });
    } catch (error) {
        console.error('Ошибка загрузки рекордов:', error);
    }
}

function startGame() {
    const playerName = document.getElementById('playerName').value;
    if (!playerName.trim()) {
        alert('Пожалуйста, введите ваше имя');
        return;
    }
    
    // Инициализируем соответствующую игру
    switch(gameType) {
        case 'multiple':
            currentGame = multipleGame;
            break;
        case 'neighbors':
            // currentGame = neighborsGame;
            alert('Эта игра еще в разработке');
            return;
        case 'complit':
            // currentGame = complitGame;
            alert('Эта игра еще в разработке');
            return;
    }
    
    if (currentGame) {
        currentGame.init();
        showScreen('gameScreen');
        currentGame.start();
    }
}

function checkAnswer() {
    if (currentGame && typeof currentGame.checkAnswer === 'function') {
        currentGame.checkAnswer();
    }
}

function showEndScreen(totalTime, answersHistory) {
    showScreen('endScreen');
    document.getElementById('finalTime').textContent = totalTime.toFixed(2);
    
    // Показываем историю ответов
    const answersList = document.getElementById('answersList');
    answersList.innerHTML = '';
    
    answersHistory.forEach((answer, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="question">${answer.question} = </span>
            <span class="user-answer ${answer.isCorrect ? 'correct' : 'incorrect'}">${answer.userAnswer}</span>
            ${!answer.isCorrect ? `<span class="correct-answer">(${answer.correctAnswer})</span>` : ''}
        `;
        answersList.appendChild(li);
    });
}

function resetGame() {
    showScreen('startScreen');
    loadHighscores();
}

function showScreen(screenId) {
    // Скрываем все экраны
    document.querySelectorAll('main > section').forEach(screen => {
        screen.classList.add('hidden');
    });
    
    // Показываем нужный экран
    document.getElementById(screenId).classList.remove('hidden');
}

// Экспортируем функции для использования в других модулях
window.saveResult = saveResult;
window.showEndScreen = showEndScreen;