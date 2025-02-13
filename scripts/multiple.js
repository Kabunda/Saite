document.addEventListener('DOMContentLoaded', () => {
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

    let state = {
        secsec: 0,
        seconds: 0,
        minutes: 0,
        intervalId: null
    };

    // Инициализация событий
    elements.welcomBtn.addEventListener('click', multiple);
    elements.nextBtn.addEventListener('click', multiple);
    elements.controlBtn.addEventListener('click', checkAnswer);
    elements.answerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') TapEnter();
    });

    function multiple() {
        // Сброс состояния
        elements.welcomBtn.hidden = true;
        elements.nextBtn.hidden = true;
        elements.controlBtn.hidden = false;
        elements.outputAnswer.hidden = true;
        
        // Генерация нового примера
        const bj = elements.vehicle1.checked;
        const m1735 = elements.vehicle2.checked;
        const r20 = elements.vehicle3.checked;

        const fm = 4 + getRandomInt(r20 ? 20 : 6); // Исправлен диапазон
        let numbers = [5, 8, 11, 17, 35];
        
        if (bj) numbers.push(2.5);
        if (m1735) numbers.push(17, 35);
        
        const lm = numbers[Math.floor(Math.random() * numbers.length)];
        
        elements.outputMultiple.textContent = `${fm} × ${lm} =`;
        elements.outputAnswer.textContent = (fm * lm).toFixed(2);
        elements.answerInput.value = "";
        elements.answerInput.focus();
        
        // Запуск таймера
        resetTimer();
    }

    function checkAnswer() {
        elements.nextBtn.hidden = false;
        elements.controlBtn.hidden = true;
        clearInterval(state.intervalId);
        
        const userAnswer = parseFloat(elements.answerInput.value);
        const correctAnswer = parseFloat(elements.outputAnswer.textContent);
        
        elements.outputAnswer.hidden = false;
        elements.outputAnswer.style.color = 
            Math.abs(userAnswer - correctAnswer) < 0.01 ? "green" : "red";
    }

    function resetTimer() {
        clearInterval(state.intervalId);
        state.secsec = state.seconds = state.minutes = 0;
        elements.timer.textContent = '00:00:0';
        state.intervalId = setInterval(updateTime, 100);
    }

    function updateTime() {
        state.secsec++;
        if (state.secsec === 10) {
            state.seconds++;
            state.secsec = 0;
        }
        if (state.seconds === 60) {
            state.minutes++;
            state.seconds = 0;
        }
        elements.timer.textContent = 
            `${String(state.minutes).padStart(2, '0')}:` +
            `${String(state.seconds).padStart(2, '0')}:` +
            `${String(state.secsec).padStart(1, '0')}`;
    }

    function TapEnter() {
        if (elements.controlBtn.hidden) return;
        checkAnswer();
    }

    function getRandomInt(max) {
        return Math.floor(Math.random() * max) + 1;
    }
});