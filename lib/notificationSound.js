/**
 * Utilitaire audio pour les alertes d'encaissement in-app.
 * Utilise l'API native standard Web Audio (AudioContext) sans dépendance à des fichiers audio externes.
 */

class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.storageKey = "kadmiel_notifications_muted";
  }

  // Initialisation à la demande (respect de la politique d'autoplay des navigateurs)
  getAudioContext() {
    if (typeof window === "undefined") return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  isMuted() {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(this.storageKey) === "true";
    } catch {
      return false;
    }
  }

  setMuted(muted) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(this.storageKey, muted ? "true" : "false");
    } catch {}
  }

  toggleMuted() {
    const next = !this.isMuted();
    this.setMuted(next);
    return next;
  }

  /**
   * Joue un carillon cristallin à deux accords harmoniques majeurs
   * pour célébrer un encaissement réussi (son doux, moderne et professionnel).
   */
  playCashChime() {
    if (this.isMuted()) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Note 1 : C6 (1046.50 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(1046.5, now);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(0.28, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.5);

      // Note 2 : E6 (1318.51 Hz) - tierce majeure décalée de 100ms
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1318.51, now + 0.1);
      gain2.gain.setValueAtTime(0.001, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.35, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.8);

      // Harmonique de brillance : G6 (1567.98 Hz)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = "triangle";
      osc3.frequency.setValueAtTime(1567.98, now + 0.18);
      gain3.gain.setValueAtTime(0.001, now + 0.18);
      gain3.gain.exponentialRampToValueAtTime(0.18, now + 0.2);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.18);
      osc3.stop(now + 0.95);
    } catch (err) {
      console.warn("[SoundManager] Erreur lecture carillon audio :", err);
    }
  }

  /**
   * Joue un son d'alerte doux pour les événements à vérifier (ex: référence manuelle SMS).
   */
  playAlertTone() {
    if (this.isMuted()) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(659.25, now); // E5
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (err) {
      console.warn("[SoundManager] Erreur lecture alerte audio :", err);
    }
  }
}

export const notificationSound = new SoundManager();
