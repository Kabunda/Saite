import { GameCore } from './core.js';

export class ComplitGame {
    constructor(core) {
        this.core = core;
        this.nominals = [10, 100, 200, 300, 25, 50, 75];
        this.hardElem = [10,   1,   2,   2, 48, 48, 48];
        this.koef = 1;
    }

    init() {
        this.core.elements.gameContent.innerHTML = `
            <div class="problem" id="complit-problem"></div>
            <div class="answers-container">
                <input type="number" class="number-input" id="complit-stavka">
                <input type="number" class="number-input" id="complit-viplata">
            </div>
        `;
        this.problemElement = document.getElementById('complit-problem');
        this.stavkaInput = document.getElementById('complit-stavka');
        this.viplataInput = document.getElementById('complit-viplata');
        this.core.elements.checkBtn.onclick = () => this.checkAnswer();
        this.core.elements.nazvanie.textContent = "Комплиты";
        this.core.elements.rules.textContent = "Указан номер и номинал комплита, необходимо определить ставку на комплит и выплату.";
    }

    generateProblem() {
        const idNom = this.core.getRandom(0, 6);
        this.koef = this.hardElem[idNom];
        const nominal = this.nominals[idNom];
        const number = this.core.getRandom(0, 36);
        this.currentProblem = this.calculateComplit(number, nominal);
        this.problemElement.textContent = `${number} по ${nominal}`;
        this.stavkaInput.value = '';
        this.viplataInput.value = '';
        // Установите порядок табуляции
        this.stavkaInput.tabIndex = 1;
        this.viplataInput.tabIndex = 2;
    }

    checkAnswer() {
        const stavka = parseInt(this.stavkaInput.value);
        const viplata = parseInt(this.viplataInput.value);
        if (isNaN(stavka) || isNaN(viplata)) {
            this.core.showResult('Некорректный ввод', 'wrong');
            return;
        };
        const isCorrect = 
            parseInt(stavka) === this.currentProblem.stavka &&
            parseInt(viplata) === this.currentProblem.viplata;
        const points = this.currentProblem.stavka
            * 5
            * this.koef
            * [...`${Math.abs(this.currentProblem.viplata)}`].reduce((a, c) => a + +c, 0);
        const message = isCorrect ? 'Верно!' :
            this.problemElement.textContent
            + ' с ' + this.currentProblem.stavka
            + ' в ' + this.currentProblem.viplata;
        const answer = stavka + '-' + viplata;
        this.core.handleAnswer(isCorrect, points, message, answer);
    }

    calculateComplit(number, nominal) {
        let stavka;
        let viplata;
        if (number >= 4 && number <= 33) {
            viplata = (number - 5) % 3 === 0 ? 392 : 294;
            stavka = (number - 5) % 3 === 0 ? 40 : 30;
        } else {
            const r1 = {
                0: 235,
                1: 297,
                2: 396,
                3: 297,
                34: 198,
                35: 264,
                36: 198
            };
            const r2 = {
                0: 17,
                1: 27,
                2: 36,
                3: 27,
                34: 18,
                35: 24,
                36: 18
            };
            viplata = r1[number];
            stavka = r2[number];
        };
        return {
            stavka: stavka * nominal, 
            viplata: viplata * nominal
        };

    }

    destroy() {
        this.core.elements.gameContent.innerHTML = '';
        this.core.elements.checkBtn.onclick = null;
    }
}