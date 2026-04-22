import { StorageService } from './storage.js';
import { SOUND_SETTINGS, VIBRATION_PATTERNS } from '../utils/constants.js';

/**
 * Сервис для работы со звуком и вибрацией
 */
export class AudioService {
  constructor() {
    this.audioContext = null;
    this.initAudioContext();
  }

  /**
   * Инициализирует AudioContext
   */
  initAudioContext() {
    if (this.audioContext) return;
    
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        console.warn('Web Audio API не поддерживается');
        return;
      }
      
      this.audioContext = new Ctx();
      
      // Восстанавливаем контекст если он был приостановлен
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(console.error);
      }
    } catch (error) {
      console.error('Ошибка инициализации AudioContext:', error);
    }
  }

  /**
   * Воспроизводит тон
   * @param {number} freq - частота в Гц
   * @param {number} durationSec - длительность в секундах
   */
  playTone(freq, durationSec) {
    if (!StorageService.isSoundEnabled()) return;
    if (!this.audioContext || this.audioContext.state !== 'running') {
      this.initAudioContext();
      if (!this.audioContext) return;
    }

    try {
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      oscillator.type = "sine";
      oscillator.frequency.value = freq;
      gain.gain.value = 0.07;
      
      oscillator.connect(gain);
      gain.connect(this.audioContext.destination);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + durationSec);
      
      // Освобождаем ресурсы
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    } catch (error) {
      console.error('Ошибка воспроизведения звука:', error);
    }
  }

  /**
   * Воспроизводит звук правильного ответа
   */
  playCorrectSound() {
    const { freq, duration } = SOUND_SETTINGS.correct;
    this.playTone(freq, duration);
  }

  /**
   * Воспроизводит звук неправильного ответа
   */
  playIncorrectSound() {
    const { freq, duration } = SOUND_SETTINGS.incorrect;
    this.playTone(freq, duration);
  }

  /**
   * Включает вибрацию
   * @param {Array} pattern - паттерн вибрации
   */
  vibrate(pattern) {
    if (!StorageService.isVibrationEnabled()) return;
    if (!("vibrate" in navigator)) return;
    
    try {
      navigator.vibrate(pattern);
    } catch (error) {
      console.error('Ошибка вибрации:', error);
    }
  }

  /**
   * Вибрация при нажатии клавиши
   */
  vibrateKeyPress() {
    this.vibrate(VIBRATION_PATTERNS.keyPress);
  }

  /**
   * Вибрация при правильном ответе
   */
  vibrateCorrect() {
    this.vibrate(VIBRATION_PATTERNS.correct);
  }

  /**
   * Вибрация при неправильном ответе
   */
  vibrateIncorrect() {
    this.vibrate(VIBRATION_PATTERNS.incorrect);
  }

  /**
   * Приостанавливает AudioContext для экономии ресурсов
   */
  suspend() {
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend().catch(console.error);
    }
  }

  /**
   * Возобновляет AudioContext
   */
  resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(console.error);
    }
  }

  /**
   * Закрывает AudioContext (освобождает ресурсы)
   */
  close() {
    if (this.audioContext) {
      this.audioContext.close().catch(console.error);
      this.audioContext = null;
    }
  }
}

// Создаем глобальный экземпляр для использования во всем приложении
export const audioService = new AudioService();