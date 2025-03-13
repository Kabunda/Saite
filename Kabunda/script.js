import { db, collection, getDocs, query, orderBy, limit } from './firebase.js';

// Константы для типов игр
const GAME_TYPES = {
  NEIGHBORS: 'neighbors',
  MULTIPLY: 'multiply',
  COMPLIMENTS: 'compliments',
  NONAMEGAME: 'nonamegame'
};

class Console {
  constructor() {
    this.elements = {
      lists: {
        [GAME_TYPES.NEIGHBORS]: document.getElementById('hsListNeibors'),
        [GAME_TYPES.MULTIPLY]: document.getElementById('hsListMultipl'),
        [GAME_TYPES.COMPLIMENTS]: document.getElementById('hsListComplit'),
		[GAME_TYPES.NONAMEGAME]: document.getElementById('hsListNoName')
      },
      buttons: {
        [GAME_TYPES.NEIGHBORS]: document.getElementById('neiborsBtn'),
        [GAME_TYPES.MULTIPLY]: document.getElementById('multiplBtn'),
        [GAME_TYPES.COMPLIMENTS]: document.getElementById('complitBtn'),
		[GAME_TYPES.NONAMEGAME]: document.getElementById('nonameBtn')
      }
    };
    
    this.collections = {
		[GAME_TYPES.NEIGHBORS]: 'records_neighbors',
		[GAME_TYPES.MULTIPLY]: 'records_mult',
		[GAME_TYPES.COMPLIMENTS]: 'records_complit',
		[GAME_TYPES.NONAMEGAME]: 'records'
    };

    this.state = {
      buffer: []
    };
    
    this.init();
  }

  init() {
    // Назначаем обработчики кнопок
    Object.entries(this.elements.buttons).forEach(([gameType, button]) => {
      button.addEventListener('click', () => this.load(gameType));
    });
    
    // Автозагрузка всех разделов
    Object.keys(GAME_TYPES).forEach(gameKey => {
        const gameType = GAME_TYPES[gameKey];
        if (this.collections[gameType]) {
            this.load(gameType);
        }
    });
  }

  async load(gameType) {
    try {
      const collectionName = this.collections[gameType];
      if (!collectionName) throw new Error('Неизвестный тип игры');
      
      const recordsRef = collection(db, collectionName);
      const q = query(recordsRef, orderBy("date", "desc"), limit(15));
      const snapshot = await getDocs(q);
      
      this.state.buffer = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date()
      }));
      
      this.display(gameType);
    } catch (error) {
      console.error(`Ошибка загрузки ${gameType}:`, error);
      this.elements.lists[gameType].innerHTML = `<div class="error">${error.message}</div>`;
    }
  }

  display(gameType) {
    const list = this.elements.lists[gameType];
    if (!list) return;

    list.innerHTML = this.state.buffer.map(record => `
      <div class="record">
        <div class="record-header">
          <span class="name">${record.name}</span>
          <span class="date">${this.formatDate(record.date)}</span>
        </div>
        <div class="record-body">
          <span class="value">${record.value || 0}</span>
          ${record.level ? `<span class="level">Уровень: ${record.level}</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  formatDate(date) {
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

new Console();