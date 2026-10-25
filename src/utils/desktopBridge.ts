/**
 * A.P.E.X Desktop Bridge Connector
 * Connects React frontend to PySide6 Qt WebChannel when running inside the native Windows desktop app,
 * and falls back to HTTP endpoints when running in the browser.
 */

import './qwebchannel.js';

declare global {
  interface Window {
    qt?: {
      webChannelTransport: any;
    };
    QWebChannel?: any;
    apexBridge?: any;
  }
}

class DesktopBridgeManager {
  private bridge: any = null;
  private isDesktop: boolean = false;
  private isInitialized: boolean = false;
  private initPromise: Promise<boolean> | null = null;

  public async init(): Promise<boolean> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<boolean>((resolve) => {
      // Check if Qt WebEngine transport is present
      if (typeof window !== 'undefined' && window.qt && window.qt.webChannelTransport) {
        try {
          new window.QWebChannel(window.qt.webChannelTransport, (channel: any) => {
            this.bridge = channel.objects.apexBridge;
            window.apexBridge = this.bridge;
            this.isDesktop = true;
            this.isInitialized = true;
            console.log('[A.P.E.X Desktop] Connected to PySide6 Native Bridge.');
            resolve(true);
          });
          return;
        } catch (e) {
          console.warn('[A.P.E.X Desktop] Failed to connect to Qt WebChannel:', e);
        }
      }

      this.isDesktop = false;
      this.isInitialized = true;
      resolve(false);
    });

    return this.initPromise;
  }

  public isDesktopApp(): boolean {
    return this.isDesktop && Boolean(this.bridge);
  }

  public getBridge(): any {
    return this.bridge;
  }

  /**
   * Sends prompt & messages through Python bridge if on desktop, or HTTP fallback if in browser.
   */
  public async sendMessage(
    messages: any[],
    systemInstruction: string = '',
    temperature: number = 0.7
  ): Promise<{ text?: string; error?: string }> {
    await this.init();

    if (this.isDesktopApp()) {
      return new Promise((resolve) => {
        let resolved = false;

        const onResponse = (responseJson: string) => {
          if (resolved) return;
          resolved = true;
          this.bridge.responseReceived.disconnect(onResponse);
          this.bridge.errorOccurred.disconnect(onError);
          try {
            const data = JSON.parse(responseJson);
            resolve({ text: data.text });
          } catch (e) {
            resolve({ text: responseJson });
          }
        };

        const onError = (errMsg: string) => {
          if (resolved) return;
          resolved = true;
          this.bridge.responseReceived.disconnect(onResponse);
          this.bridge.errorOccurred.disconnect(onError);
          resolve({ error: errMsg });
        };

        this.bridge.responseReceived.connect(onResponse);
        this.bridge.errorOccurred.connect(onError);

        const payload = JSON.stringify({
          messages,
          systemInstruction,
          temperature,
        });

        this.bridge.sendMessage(payload);
      });
    }

    // Browser HTTP Fallback
    const response = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, systemInstruction, temperature }),
    });
    return response.json();
  }

  /**
   * Synthesizes speech through Python desktop service or HTTP fallback.
   */
  public async synthesizeSpeech(
    text: string,
    voice: string = 'Kore'
  ): Promise<{ audio?: string; error?: string }> {
    await this.init();

    if (this.isDesktopApp()) {
      return new Promise((resolve) => {
        let resolved = false;

        const onAudioReady = (audioBase64: string) => {
          if (resolved) return;
          resolved = true;
          this.bridge.audioPlaybackReady.disconnect(onAudioReady);
          this.bridge.errorOccurred.disconnect(onError);
          resolve({ audio: audioBase64 });
        };

        const onError = (errMsg: string) => {
          if (resolved) return;
          resolved = true;
          this.bridge.audioPlaybackReady.disconnect(onAudioReady);
          this.bridge.errorOccurred.disconnect(onError);
          resolve({ error: errMsg });
        };

        this.bridge.audioPlaybackReady.connect(onAudioReady);
        this.bridge.errorOccurred.connect(onError);

        this.bridge.synthesizeSpeech(text, voice);
      });
    }

    // Browser HTTP Fallback
    const response = await fetch('/api/agent/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });
    return response.json();
  }

  public startVoiceSession() {
    if (this.isDesktopApp()) {
      this.bridge.startVoiceSession();
    }
  }

  public stopVoiceSession() {
    if (this.isDesktopApp()) {
      this.bridge.stopVoiceSession();
    }
  }

  public emergencyStop() {
    if (this.isDesktopApp()) {
      this.bridge.emergencyStop();
    }
  }

  public onStateChanged(callback: (state: string) => void) {
    this.init().then(() => {
      if (this.isDesktopApp() && this.bridge.stateChanged) {
        this.bridge.stateChanged.connect(callback);
      }
    });
  }
}

export const desktopBridge = new DesktopBridgeManager();
