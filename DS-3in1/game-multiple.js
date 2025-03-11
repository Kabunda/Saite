import { GameCore } from './core.js';

export class MultGame {
    constructor(core) {
        this.core = core;
    }

    init() {
        this.core.elements.gameContent.innerHTML = `
            <div class="problem" id="mult-problem"></div>
            <input type="number" class="number-input" id="mult-answer">`;
        this.problemElement = document.getElementById('mult-problem');
        this.answerInput = document.getElementById('mult-answer');
        this.core.elements.checkBtn.onclick = () => this.checkAnswer();
        this.core.elements.nazvanie.textContent = "Умножение";
        this.core.elements.rules.textContent = "Введите результат умножения двух чисел, за каждый последующий правильный ответ начисляется больше очков.";
    }

    generateProblem() {
        const mnogitel = [5, 8, 11, 17, 17, 17, 17, 35, 35, 35];
        const a = mnogitel[this.core.getRandom(0, 9)];
        const b = this.core.getRandom(3, 20);
        this.currentProblem = a * b;
        this.problemElement.textContent = `${a} × ${b}`;
        this.answerInput.value = '';
    }

    checkAnswer() {
        const userInput = parseInt(this.answerInput.value);
        if (isNaN(userInput)) {
            this.core.showResult('Некорректный ввод', 'wrong');
            return;
        };
        const isCorrect = parseInt(this.answerInput.value) === this.currentProblem;
        const points = this.currentProblem;
        const message = this.problemElement.textContent + ' = ' + this.currentProblem;
        this.core.handleAnswer(isCorrect, points, message);
    }

    destroy() {
        this.core.elements.gameContent.innerHTML = '';
        this.core.elements.checkBtn.onclick = null;
    }
}