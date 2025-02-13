// Кешируем все DOM-элементы
const elements = {
    timer: document.getElementById('timer'),
    welcomBtn: document.getElementById('welcomBtn'),
    nextBtn: document.getElementById('nextBtn'),
    controlBtn: document.getElementById('controlBtn'),
    outputMultiple: document.getElementById('output_multiple'),
    outputAnswer: document.getElementById('output_multiple_otvet'),
    answerInput: document.getElementById('ans'),
    vehicle1: document.getElementById('vehicle1'),
    vehicle2: document.getElementById('vehicle2'),
    vehicle3: document.getElementById('vehicle3')
};

// Состояние приложения
let state = {
    secsec: 0,
    seconds: 0,
    minutes: 0,
    intervalId: null,
    baseNumbers: [5, 8, 11, 17, 35]
};

// Константы
const TIMER_INTERVAL = 10;

// Оптимизированная функция инициализации
function multiple() {
    // Обновляем состояние интерфейса
    elements.welcomBtn.hidden = true;
    elements.nextBtn.hidden = true;
    elements.controlBtn.hidden = false;
    
    // Сбрасываем таймер
    resetTimer();
    
    // Получаем значения чекбоксов
    const [bj, m1735, r20] = [
        elements.vehicle1.checked,
        elements.vehicle2.checked,
        elements.vehicle3.checked
    ];
    
    // Генерируем задание
    const { question, answer } = generateProblem(bj, m1735, r20);
    
    // Обновляем интерфейс
    elements.outputMultiple.textContent = ` ${question} =`;
    elements.outputAnswer.hidden = true;
    elements.outputAnswer.textContent = answer;
    elements.answerInput.value = "";
    elements.answerInput.focus();
}

// Вынесенная логика генерации задачи
function generateProblem(bj, m1735, r20) {
    const fm = 4 + getRandomInt(r20 ? 16 : 6);
    let numbers = [...state.baseNumbers];
    let count = numbers.length;

    if (bj) {
        numbers.push(2.5);
        count++;
    }
    if (m1735) {
        numbers.push(17, 35);
        count += 2;
    }

    const lm = numbers[getRandomInt(count) - 1];
    return {
        question: `${fm} × ${lm}`,
        answer: fm * lm
    };
}

// Оптимизированная функция проверки
function sow() {
    elements.nextBtn.hidden = false;
    elements.controlBtn.hidden = true;
    clearInterval(state.intervalId);
    
    const userAnswer = Number(elements.answerInput.value);
    const correctAnswer = Number(elements.outputAnswer.textContent);
    
    elements.outputAnswer.hidden = false;
    elements.outputAnswer.style.color = userAnswer === correctAnswer ? "green" : "red";
}

// Улучшенный таймер
function resetTimer() {
    state.secsec = state.seconds = state.minutes = 0;
    elements.timer.textContent = '00:00:00';
    state.intervalId = setInterval(updateTime, TIMER_INTERVAL);
}

function updateTime() {
    state.secsec++;
    
    if (state.secsec === 100) {
        state.seconds++;
        state.secsec = 0;
    }
    if (state.seconds === 60) {
        state.minutes++;
        state.seconds = 0;
    }
    
    elements.timer.textContent = 
        `${state.minutes.toString().padStart(2, '0')}:` +
        `${state.seconds.toString().padStart(2, '0')}:` +
        `${state.secsec.toString().padStart(2, '0')}`;
}

// Вспомогательные функции
function TapEnter() {
    elements.nextBtn.hidden ? sow() : multiple();
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max) + 1;
}