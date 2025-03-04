import { GameCore } from './core.js';

export class NeighborsGame {
    constructor(core) {
        this.core = core;
        this.wheel = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
    }

    init() {
        this.core.elements.gameContent.innerHTML = `
            <div class="problem" id="neighbors-problem"></div>
            <div class="answers-container">
                ${Array.from({length: 4}, (_, i) => `
                    <input type="number" class="number-input" id="neighbors-answer${i}">`).join('')}
            </div>`;
        this.problemElement = document.getElementById('neighbors-problem');
        this.answerInputs = Array.from(document.querySelectorAll('#neighbors-answer0, #neighbors-answer1, #neighbors-answer2, #neighbors-answer3'));
        this.core.elements.checkBtn.onclick = () => this.checkAnswer();
        this.core.elements.nazvanie.textContent = "Соседи";
        this.core.elements.rules.textContent = "Введите соседей числа в любом порядке. Очков будет больше, если ввести их по часовой стрелке.";
    }

    generateProblem() {
        const num = this.core.getRandom(0, 36);
        const index = this.wheel.indexOf(num);
        this.currentProblem = [-2, -1, 1, 2].map(i => 
            this.wheel[(index + i + this.wheel.length) % this.wheel.length]
        );
        this.problemElement.textContent = num;
        this.answerInputs.forEach(input => input.value = '');
    }

    checkAnswer() {
        const userAnswers = this.answerInputs.map(input => {
            const value = parseInt(input.value);
            return isNaN(value) ? null : value;
        });
        
        // Нормализация и проверка уникальности значений
        const uniqueAnswers = [...new Set(userAnswers)];
        if (uniqueAnswers.length !== 4 || uniqueAnswers.some(a => a === null)) {
            this.core.showResult('Некорректный ввод', 'wrong');
            return;
        }
    
        // Правильное сравнение через множества
        const correctSet = new Set(this.currentProblem);
        const isCorrect = userAnswers.every(num => correctSet.has(num));
        
        // Проверка порядка только если все ответы правильные
        const isOrderCorrect = isCorrect && 
            this.answerInputs.every((input, i) => 
                parseInt(input.value) === this.currentProblem[i]
            );
            
        const points = isOrderCorrect ? 200 : (isCorrect ? 100 : 0);
        this.core.handleAnswer(isCorrect, points);
    }

    destroy() {
        this.core.elements.gameContent.innerHTML = '';
        this.core.elements.checkBtn.onclick = null;
    }
}