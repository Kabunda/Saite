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

// Инициализация приложения
function init() {
    elements.welcomBtn.addEventListener('click', multiple);
    elements.nextBtn.addEventListener('click', multiple);
    elements.controlBtn.addEventListener('click', sow);
    elements.answerInput.addEventListener('change', TapEnter);
}

function multiple() {
    elements.welcomBtn.hidden = true;
    elements.nextBtn.hidden = true;
    elements.controlBtn.hidden = false;
    
    resetTimer();
    
    const bj = elements.vehicle1.checked;
    const m1735 = elements.vehicle2.checked;
    const r20 = elements.vehicle3.checked;

    const fm = 4 + getRandomInt(r20 ? 16 : 6);
    let numbers = [5, 8, 11, 17, 35];
    
    if (bj) numbers.push(2.5);
    if (m1735) numbers.push(17, 35);
    
    const lm = numbers[Math.floor(Math.random() * numbers.length)];
    
    elements.outputMultiple.textContent = `${fm} × ${lm} =`;
    elements.outputAnswer.textContent = fm * lm;
    elements.outputAnswer.hidden = true;
    elements.answerInput.value = "";
    elements.answerInput.focus();
}

function sow() {
    elements.nextBtn.hidden = false;
    elements.controlBtn.hidden = true;
    clearInterval(state.intervalId);
    
    elements.outputAnswer.hidden = false;
    const isCorrect = Number(elements.answerInput.value) === Number(elements.outputAnswer.textContent);
    elements.outputAnswer.style.color = isCorrect ? "green" : "red";
}

function resetTimer() {
    state.secsec = state.seconds = state.minutes = 0;
    elements.timer.textContent = '00:00:00';
    state.intervalId = setInterval(updateTime, 10);
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
        `${String(state.minutes).padStart(2, '0')}:` +
        `${String(state.seconds).padStart(2, '0')}:` +
        `${String(state.secsec).padStart(2, '0')}`;
}

function TapEnter() {
    if (elements.nextBtn.hidden) sow();
    else multiple();
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max) + 1;
}

// Запуск приложения
init();