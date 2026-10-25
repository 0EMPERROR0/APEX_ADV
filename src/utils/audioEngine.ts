/**
 * Real-time Web Audio Engine for A.P.E.X
 * Bridges microphone streams and agent speech playback to the visualizer orb.
 */

import { desktopBridge } from './desktopBridge';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private currentAudioSource: AudioBufferSourceNode | null = null;
  private isListeningMic: boolean = false;
  private isAgentSpeaking: boolean = false;
  private freqData: Uint8Array = new Uint8Array(64);
  private timeData: Uint8Array = new Uint8Array(64);
  private simulatedPhase: number = 0;
  private speechFormantPhase: number = 0;

  public init(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128; // 64 frequency bins for crisp performance
      this.analyser.smoothingTimeConstant = 0.8;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyser.frequencyBinCount);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch((e) => console.warn('AudioContext resume deferred:', e));
    }
    return this.ctx;
  }

  public async startMicrophone(noiseSuppression: boolean = true): Promise<boolean> {
    try {
      this.init();
      if (this.micStream) {
        this.stopMicrophone();
      }

      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: noiseSuppression,
          autoGainControl: true,
        },
      });

      if (!this.ctx || !this.analyser) return false;

      this.micSource = this.ctx.createMediaStreamSource(this.micStream);
      this.micSource.connect(this.analyser);
      // NOTE: We do not connect mic to destination to prevent audio feedback loop!
      this.isListeningMic = true;
      return true;
    } catch (err) {
      console.warn('Microphone permission denied or unavailable:', err);
      this.isListeningMic = false;
      return false;
    }
  }

  public stopMicrophone() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch (e) {
        // ignore
      }
      this.micSource = null;
    }
    this.isListeningMic = false;
  }

  public toggleMicrophone(noiseSuppression: boolean = true): Promise<boolean> {
    if (this.isListeningMic) {
      this.stopMicrophone();
      return Promise.resolve(false);
    } else {
      return this.startMicrophone(noiseSuppression);
    }
  }

  public getIsListening(): boolean {
    return this.isListeningMic;
  }

  public getIsSpeaking(): boolean {
    return this.isAgentSpeaking;
  }

  public setAgentSpeaking(speaking: boolean) {
    this.isAgentSpeaking = speaking;
  }

  /**
   * Plays base64 WAV audio through the AudioContext and routes it
   * into the analyser node so the orb reacts vigorously to the agent's voice.
   */
  public async playWavAudio(base64Audio: string, onEnded?: () => void): Promise<void> {
    try {
      const ctx = this.init();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      this.stopCurrentAudio();

      const binaryStr = atob(base64Audio);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      if (!this.analyser) {
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 128;
      }

      // Route source -> analyser -> destination
      source.connect(this.analyser);
      this.analyser.connect(ctx.destination);

      this.currentAudioSource = source;
      this.isAgentSpeaking = true;

      source.onended = () => {
        this.isAgentSpeaking = false;
        this.currentAudioSource = null;
        if (onEnded) onEnded();
      };

      source.start(0);
    } catch (err) {
      console.error('Failed to decode and play audio:', err);
      this.isAgentSpeaking = false;
      if (onEnded) onEnded();
    }
  }

  /**
   * Universal speech method with TTS and browser fallback.
   * Ensures the orb ALWAYS reacts when speaking.
   */
  public async speakText(
    text: string,
    voice: string = 'Kore',
    onEnded?: () => void
  ): Promise<boolean> {
    this.init();
    this.stopCurrentAudio();
    this.isAgentSpeaking = true;

    // 1. Try Python desktop bridge if on desktop, or Gemini TTS backend endpoint
    try {
      if (typeof window !== 'undefined' && (window as any).apexBridge) {
        const res = await desktopBridge.synthesizeSpeech(text, voice);
        if (res.audio) {
          await this.playWavAudio(res.audio, onEnded);
          return true;
        }
      } else {
        const response = await fetch('/api/agent/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.audio) {
            await this.playWavAudio(data.audio, onEnded);
            return true;
          }
        }
      }
    } catch (err) {
      console.warn('TTS unavailable, falling back to Web Speech API:', err);
    }

    // 2. Web Speech API fallback if server TTS is unavailable or quota limited
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const cleanText = text
        .replace(/```[\s\S]*?```/g, '')
        .replace(/[*_#`[\]()]/g, '')
        .slice(0, 350);

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;
      utterance.pitch = 0.95;

      utterance.onend = () => {
        this.isAgentSpeaking = false;
        if (onEnded) onEnded();
      };

      utterance.onerror = () => {
        this.isAgentSpeaking = false;
        if (onEnded) onEnded();
      };

      window.speechSynthesis.speak(utterance);
      return true;
    }

    // If no speech synthesis available at all
    setTimeout(() => {
      this.isAgentSpeaking = false;
      if (onEnded) onEnded();
    }, 2000);
    return false;
  }

  public stopCurrentAudio() {
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
        this.currentAudioSource.disconnect();
      } catch (e) {
        // ignore
      }
      this.currentAudioSource = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isAgentSpeaking = false;
  }

  /**
   * Reads current frequency metrics:
   * low: 0-1, mid: 0-1, high: 0-1, overall: 0-1, rawBins: Uint8Array
   * Guarantees strong, vibrant orb reaction when agent is speaking!
   */
  public getFrequencyMetrics(gain: number = 1.0, sensitivity: number = 1.0) {
    let hasLiveAudio = false;

    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.freqData as any);
      this.analyser.getByteTimeDomainData(this.timeData as any);

      let sum = 0;
      for (let i = 0; i < this.freqData.length; i++) {
        sum += this.freqData[i];
      }
      if (sum > 15) {
        hasLiveAudio = true;
      }
    }

    // When the agent is actively speaking, ensure strong dynamic vocal formants
    if (this.isAgentSpeaking) {
      this.speechFormantPhase += 0.16;
      // Syllabic modulation simulating speech vowel/consonant rhythm
      const syllable = (Math.sin(this.speechFormantPhase * 2.2) + Math.cos(this.speechFormantPhase * 4.1) * 0.5 + 1.5) * 0.35;
      const pitchMod = (Math.sin(this.speechFormantPhase * 5.8) + 1) * 0.5;

      let low = (0.28 + syllable * 0.45) * gain * sensitivity;
      let mid = (0.35 + syllable * 0.55 + pitchMod * 0.25) * gain * sensitivity;
      let high = (0.22 + pitchMod * 0.4) * gain * sensitivity;

      // If there is also real audio stream from AudioContext, merge and boost it
      if (hasLiveAudio) {
        const binCount = this.freqData.length;
        const lowCount = Math.floor(binCount * 0.25);
        const midCount = Math.floor(binCount * 0.6);

        let rLow = 0, rMid = 0, rHigh = 0;
        for (let i = 0; i < lowCount; i++) rLow += this.freqData[i];
        for (let i = lowCount; i < midCount; i++) rMid += this.freqData[i];
        for (let i = midCount; i < binCount; i++) rHigh += this.freqData[i];

        low = Math.max(low, (rLow / lowCount / 255) * 2.2 * gain * sensitivity);
        mid = Math.max(mid, (rMid / (midCount - lowCount) / 255) * 2.5 * gain * sensitivity);
        high = Math.max(high, (rHigh / (binCount - midCount) / 255) * 2.0 * gain * sensitivity);
      }

      const overall = (low * 0.35 + mid * 0.45 + high * 0.2);

      return {
        hasLiveAudio: true,
        low: Math.min(2.0, low),
        mid: Math.min(2.0, mid),
        high: Math.min(2.0, high),
        overall: Math.min(2.0, overall),
        rawBins: this.freqData,
      };
    }

    if (!hasLiveAudio) {
      // Natural harmonic breathing when idle
      this.simulatedPhase += 0.035;
      const breath = (Math.sin(this.simulatedPhase) + 1) * 0.5;
      const sub = (Math.sin(this.simulatedPhase * 1.6) + 1) * 0.5;

      const idleLow = 0.08 + sub * 0.12;
      const idleMid = 0.06 + breath * 0.1;
      const idleHigh = 0.04 + Math.sin(this.simulatedPhase * 2.3) * 0.05;
      const idleOverall = (idleLow + idleMid + idleHigh) / 3;

      return {
        hasLiveAudio: false,
        low: idleLow * sensitivity,
        mid: idleMid * sensitivity,
        high: idleHigh * sensitivity,
        overall: idleOverall * sensitivity,
        rawBins: this.freqData,
      };
    }

    // Process actual frequency bins from microphone
    const binCount = this.freqData.length;
    const lowCount = Math.floor(binCount * 0.2);
    const midCount = Math.floor(binCount * 0.5);

    let lowSum = 0;
    for (let i = 0; i < lowCount; i++) lowSum += this.freqData[i];

    let midSum = 0;
    for (let i = lowCount; i < midCount; i++) midSum += this.freqData[i];

    let highSum = 0;
    for (let i = midCount; i < binCount; i++) highSum += this.freqData[i];

    const lowAvg = (lowSum / lowCount / 255) * gain * sensitivity;
    const midAvg = (midSum / (midCount - lowCount) / 255) * gain * sensitivity;
    const highAvg = (highSum / (binCount - midCount) / 255) * gain * sensitivity;

    const overall = (lowAvg * 0.5 + midAvg * 0.35 + highAvg * 0.15);

    return {
      hasLiveAudio: true,
      low: Math.min(1.8, lowAvg),
      mid: Math.min(1.8, midAvg),
      high: Math.min(1.8, highAvg),
      overall: Math.min(1.8, overall),
      rawBins: this.freqData,
    };
  }
}

export const audioEngine = new AudioEngine();
