// js/sound.js

class SoundManager {
  constructor() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.enabled = true;
  }

  playTone(frequency, type, duration, startTime = 0) {
    if (!this.enabled) return;
    
    // Resume context if suspended (browser policy)
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, this.audioCtx.currentTime + startTime);
    
    gainNode.gain.setValueAtTime(0.1, this.audioCtx.currentTime + startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + startTime + duration);

    osc.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    osc.start(this.audioCtx.currentTime + startTime);
    osc.stop(this.audioCtx.currentTime + startTime + duration);
  }

  playMoveSound() {
    // Short "thock" sound
    this.playTone(200, 'sine', 0.1);
  }

  playCaptureSound() {
    // Slightly more aggressive sound
    this.playTone(150, 'square', 0.1);
  }

  playKingSound() {
    // Power-up sound (ascending arpeggio)
    this.playTone(400, 'sine', 0.1, 0);
    this.playTone(600, 'sine', 0.1, 0.1);
    this.playTone(800, 'sine', 0.2, 0.2);
  }

  playWinSound() {
    // Victory fanfare
    const now = 0;
    this.playTone(523.25, 'triangle', 0.2, 0); // C5
    this.playTone(659.25, 'triangle', 0.2, 0.2); // E5
    this.playTone(783.99, 'triangle', 0.2, 0.4); // G5
    this.playTone(1046.50, 'triangle', 0.6, 0.6); // C6
  }
}

export const soundManager = new SoundManager();
