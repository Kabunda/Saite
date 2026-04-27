// Управление звуковыми эффектами
import { SOUND_FREQUENCIES } from '../utils/constants.js';
import { getSettingsManager } from '../settings/settingsManager.js';

export class SoundManager {
    constructor() {
        this.audioContext = null;
        this.isEnabled = true;
        this.isInitialized = false;
        this.sounds = new Map();
        
        this.init();
    }
    
    /**
     * Инициализирует аудиоконтекст
     */
    async init() {
        // Проверяем настройки звука
        try {
            const settings = await getSettingsManager();
            this.isEnabled = settings.get('sound');
            
            // Слушаем изменения настроек
            settings.addListener('sound', (newValue) => {
                this.isEnabled = newValue;
                console.log(`SoundManager: звук ${newValue ? 'включен' : 'выключен'}`);
            });
        } catch (error) {
            console.warn('SoundManager: не удалось загрузить настройки, используем значение по умолчанию', error);
        }
        
        // Пытаемся создать аудиоконтекст
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                this.audioContext = new AudioContextClass();
                
                // Разблокируем аудиоконтекст при первом взаимодействии пользователя
                this.setupUnlock();
                
                this.isInitialized = true;
                console.log('SoundManager: аудиоконтекст инициализирован');
            } else {
                console.warn('SoundManager: Web Audio API не поддерживается');
            }
        } catch (error) {
            console.error('SoundManager: ошибка инициализации аудиоконтекста:', error);
        }
    }
    
    /**
     * Настраивает разблокировку аудиоконтекста при взаимодействии пользователя
     */
    setupUnlock() {
        const unlock = () => {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume().then(() => {
                    console.log('SoundManager: аудиоконтекст разблокирован');
                    document.removeEventListener('click', unlock);
                    document.removeEventListener('keydown', unlock);
                    document.removeEventListener('touchstart', unlock);
                });
            }
        };
        
        document.addEventListener('click', unlock, { once: true });
        document.addEventListener('keydown', unlock, { once: true });
        document.addEventListener('touchstart', unlock, { once: true });
    }
    
    /**
     * Воспроизводит тон заданной частоты и длительности
     * @param {number} frequency - частота в Гц
     * @param {number} duration - длительность в миллисекундах
     * @param {string} type - тип осциллятора: 'sine', 'square', 'sawtooth', 'triangle'
     */
    playTone(frequency, duration = 200, type = 'sine') {
        if (!this.isEnabled || !this.audioContext) {
            return;
        }
        
        // Возобновляем аудиоконтекст, если он приостановлен
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.type = type;
            oscillator.frequency.value = frequency;
            
            // Настраиваем огибающую для плавного звучания
            const now = this.audioContext.currentTime;
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration / 1000);
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.start(now);
            oscillator.stop(now + duration / 1000);
            
            // Очищаем ресурсы после завершения
            oscillator.onended = () => {
                oscillator.disconnect();
                gainNode.disconnect();
            };
        } catch (error) {
            console.error('SoundManager: ошибка воспроизведения тона:', error);
        }
    }
    
    /**
     * Воспроизводит звук правильного ответа
     */
    playCorrect() {
        this.playTone(SOUND_FREQUENCIES.CORRECT, 300, 'sine');
    }
    
    /**
     * Воспроизводит звук неправильного ответа
     */
    playIncorrect() {
        this.playTone(SOUND_FREQUENCIES.INCORRECT, 400, 'sawtooth');
    }
    
    /**
     * Воспроизводит звук клика/нажатия
     */
    playClick() {
        this.playTone(SOUND_FREQUENCIES.CLICK, 100, 'square');
    }
    
    /**
     * Воспроизводит звук перехода
     */
    playTransition() {
        this.playTone(523.25, 150, 'sine'); // До 5 октавы
    }
    
    /**
     * Воспроизводит звук завершения игры
     */
    playCompletion() {
        if (!this.isEnabled || !this.audioContext) {
            return;
        }
        
        // Проигрываем последовательность тонов
        const notes = [523.25, 659.25, 783.99, 1046.50]; // До, Ми, Соль, До
        const noteDuration = 200;
        
        notes.forEach((frequency, index) => {
            setTimeout(() => {
                this.playTone(frequency, noteDuration, 'sine');
            }, index * noteDuration);
        });
    }
    
    /**
     * Включает или выключает звук
     * @param {boolean} enabled 
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        
        if (!enabled && this.audioContext) {
            // При выключении звука останавливаем все осцилляторы
            this.audioContext.suspend();
        } else if (enabled && this.audioContext) {
            this.audioContext.resume();
        }
    }
    
    /**
     * Переключает состояние звука
     * @returns {boolean} новое состояние
     */
    toggle() {
        const newState = !this.isEnabled;
        this.setEnabled(newState);
        return newState;
    }
    
    /**
     * Проверяет, доступен ли звук
     * @returns {boolean}
     */
    isAvailable() {
        return this.isInitialized && this.audioContext !== null;
    }
    
    /**
     * Получает текущее состояние звука
     * @returns {boolean}
     */
    getStatus() {
        return {
            enabled: this.isEnabled,
            available: this.isAvailable(),
            contextState: this.audioContext ? this.audioContext.state : 'unavailable'
        };
    }
}

// Создаем и экспортируем глобальный экземпляр
let soundManagerInstance = null;

/**
 * Получает или создает экземпляр SoundManager
 * @returns {Promise<SoundManager>}
 */
export async function getSoundManager() {
    if (!soundManagerInstance) {
        soundManagerInstance = new SoundManager();
        // Ждем инициализации
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return soundManagerInstance;
}

/**
 * Воспроизводит звук правильного ответа
 * @returns {Promise<void>}
 */
export async function playCorrectSound() {
    const manager = await getSoundManager();
    manager.playCorrect();
}

/**
 * Воспроизводит звук неправильного ответа
 * @returns {Promise<void>}
 */
export async function playIncorrectSound() {
    const manager = await getSoundManager();
    manager.playIncorrect();
}

/**
 * Воспроизводит звук клика
 * @returns {Promise<void>}
 */
export async function playClickSound() {
    const manager = await getSoundManager();
    manager.playClick();
}

/**
 * Включает или выключает звук
 * @param {boolean} enabled 
 * @returns {Promise<void>}
 */
export async function setSoundEnabled(enabled) {
    const manager = await getSoundManager();
    manager.setEnabled(enabled);
}