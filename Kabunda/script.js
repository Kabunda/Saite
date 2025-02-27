import { db, collection, addDoc, getDocs, query, orderBy, limit } from './firebase.js';

class Console {
	constructor() {
		this.elements = {
			highscoreN: document.getElementById('hsListNeibors'),
			highscoreM: document.getElementById('hsListMultipl'),
			highscoreC: document.getElementById('hsListComplit'),
			neiborsBtn: document.getElementById('neiborsBtn'),
            multiplBtn: document.getElementById('multiplBtn')
		};
		this.state = {
			buffer: [],
			isFlag: false
		};
		this.init();
	}

	init() {
		this.elements.neiborsBtn.addEventListener('click', () => this.load('neibors'));
        this.elements.multiplBtn.addEventListener('click', () => this.load('multipl'));
	}

	async load(game) {
		let name = '';
		this.state.isFlag = false;
		if (game == 'neibors') {
			name = 'records';
			this.state.isFlag = true;
		}
		if (game == 'multipl') {
			name = 'records_mult';
			this.state.isFlag = true;
		}

		if (this.state.isFlag == false) {
			console.log('Некорректный адрес базы');
			return;
		}

		try {
            const recordsRef = collection(db, name);
            const q = query(
                recordsRef, 
                orderBy("date", "desc"), 
                limit(15)
            );
            const snapshot = await getDocs(q);
            this.state.buffer = []; // Теперь храним массив
            snapshot.forEach(doc => {
                this.state.buffer.push(doc.data());
            });
            this.Display(game);
        } catch (error) {
            console.error("Ошибка загрузки рекорда:", error);
        }
	}

	Display(game) {
		let list;
		this.state.isFlag = false;
		if (game == 'neibors') {
			list = this.elements.highscoreN;
			this.state.isFlag = true;
		}
		if (game == 'multipl') {
			list = this.elements.highscoreM;
			this.state.isFlag = true;
		}

		if (this.state.isFlag == false) {
			console.log('Некорректный тип игры');
			return;
		}

      	list.innerHTML = "";

      	this.state.buffer.forEach((record) => {
	        const li = document.createElement('div');

	        // Создаем элементы безопасно
	        const nameDiv = document.createElement('div');
	        nameDiv.className = "hs_nam";
	        nameDiv.textContent = record.name; // textContent экранирует HTML

	        const levelDisplay = record.level ? record.level : "空";
	        const valueDiv = document.createElement('div');
	        valueDiv.className = "hs_val";
	        valueDiv.textContent = `${record.value} ${levelDisplay}`;

	        const dateDiv = document.createElement('div');
	        dateDiv.className = "hs_dat";
	        dateDiv.textContent = record.date;

	        li.append(nameDiv, valueDiv, dateDiv);
	        list.appendChild(li);
      	});
    }
}

new Console();