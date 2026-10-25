import type { ProductConfig } from '../types';
import { ConversationAudioRecorder } from './audioRecorder';

export interface LiveClientCallbacks {
  onStatusChange: (status: 'Connecting' | 'Listening' | 'Speaking' | 'Ended' | 'Error', errorMsg?: string) => void;
  onUserMessage: (text: string, isFinal: boolean) => void;
  onAiMessage: (text: string, isFinal: boolean) => void;
  onAudioLevel: (level: number) => void;
}

export class GeminiVoiceManager {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private isMuted = false;
  private nextPlayTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private isLiveConnected = false;
  private speechRecognition: any = null;
  private recognitionRunning = false;
  private recognitionTimer: ReturnType<typeof setTimeout> | null = null;
  private activeMode: 'live-ws' | 'conversational-turn' = 'live-ws';
  private conversationHistory: Array<{ sender: 'ai' | 'customer'; text: string }> = [];
  private ended = false;
  private stopPromise: Promise<Blob | null> | null = null;
  private abort = new AbortController();
  private turnQueue: Promise<void> = Promise.resolve();
  private pendingTurns = 0;
  private playing = false;
  private turnComplete = true;
  private cancelConnect: (() => void) | null = null;
  private userTranscript = '';
  private aiTranscript = '';

  constructor(private callbacks: LiveClientCallbacks, private productConfig: ProductConfig,
    private recorder: ConversationAudioRecorder) {}

  public setProductConfig(config: ProductConfig) { this.productConfig = config; }
  public getAnalyserNode() { return this.analyser; }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    this.micStream?.getAudioTracks().forEach((track) => { track.enabled = !muted; });
    if (muted) {
      this.pauseRecognition();
      this.callbacks.onAudioLevel(0);
      if (this.isLiveConnected) this.ws?.send(JSON.stringify({ type: 'audio_end' }));
    } else this.resumeRecognition();
  }

  public async startSession(recordingConsent = false): Promise<void> {
    if (!recordingConsent) throw new Error('Recording consent is required before starting a call.');
    this.callbacks.onStatusChange('Connecting');
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: true, noiseSuppression: true, autoGainControl: true,
      } });
      if (this.ended) {
        this.micStream.getTracks().forEach((track) => track.stop());
        this.micStream = null;
        return;
      }
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });
      await Promise.all([this.inputAudioCtx.resume(), this.outputAudioCtx.resume()]);
      if (this.ended) return;
      this.analyser = this.inputAudioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.micSource = this.inputAudioCtx.createMediaStreamSource(this.micStream);
      this.micSource.connect(this.analyser);
      this.recorder.start(this.micStream, this.outputAudioCtx);
      try {
        await this.connectLive();
      } catch (error) {
        if (this.ended) throw error;
        // Close and detach the failed socket: a late ready event must not enable two modes.
        this.closeSocket();
        this.activeMode = 'conversational-turn';
        this.callbacks.onStatusChange('Connecting', 'Live streaming is unavailable. Trying turn-based voice.');
      }
      if (this.ended) return;
      this.setupMicCapture();
      if (this.activeMode === 'conversational-turn') {
        this.initSpeechRecognition();
        const greeting = this.productConfig.greetingMessage;
        this.conversationHistory.push({ sender: 'ai', text: greeting });
        this.callbacks.onAiMessage(greeting, true);
        await this.speak(greeting);
        if (!this.ended) {
          this.callbacks.onStatusChange('Listening');
          this.resumeRecognition();
        }
      }
    } catch (error: any) {
      if (this.ended) return;
      await this.endSession();
      this.callbacks.onStatusChange('Error', error.message || 'Could not start voice call.');
      throw error;
    }
  }

  private connectLive(): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}/live`);
      this.ws = socket;
      let ready = false;
      const timeout = setTimeout(() => reject(new Error('Live connection timed out.')), 20000);
      this.cancelConnect = () => { clearTimeout(timeout); reject(new Error('Call ended.')); };
      const fail = (message: string) => {
        clearTimeout(timeout);
        if (!ready) reject(new Error(message));
        else if (!this.ended) {
          this.isLiveConnected = false;
          this.stopAudio();
          this.flushTranscripts();
          this.callbacks.onStatusChange('Error', message);
        }
      };
      socket.onopen = () => socket.send(JSON.stringify({ type: 'start', productConfig: this.productConfig }));
      socket.onmessage = (event) => {
        if (this.ended) return;
        let message: any;
        try { message = JSON.parse(event.data); } catch { fail('Invalid response from voice server.'); return; }
        switch (message.type) {
          case 'ready':
            ready = true;
            this.cancelConnect = null;
            clearTimeout(timeout);
            this.isLiveConnected = true;
            this.activeMode = 'live-ws';
            this.callbacks.onStatusChange('Listening');
            resolve();
            break;
          case 'audio':
            this.flushUserTranscript();
            this.turnComplete = false;
            this.callbacks.onStatusChange('Speaking');
            this.playPcmChunk(message.audio);
            break;
          case 'user_text':
            this.userTranscript += message.text;
            if (message.isFinal) this.flushUserTranscript();
            else this.callbacks.onUserMessage(this.userTranscript, false);
            break;
          case 'user_interim':
            this.callbacks.onUserMessage(this.userTranscript + message.text, false);
            break;
          case 'ai_text':
            this.flushUserTranscript();
            this.aiTranscript += message.text;
            if (message.isFinal) this.flushAiTranscript();
            else this.callbacks.onAiMessage(this.aiTranscript, false);
            break;
          case 'interrupted':
            this.stopAudio();
            this.flushAiTranscript();
            this.callbacks.onStatusChange('Listening');
            break;
          case 'turn_complete':
            this.turnComplete = true;
            this.flushTranscripts();
            if (!this.sources.size) this.callbacks.onStatusChange('Listening');
            break;
          case 'error': case 'closed': fail(message.error || 'Live voice connection closed.'); break;
        }
      };
      socket.onerror = () => fail('Voice server connection failed.');
      socket.onclose = () => fail('Voice connection ended. End the call to save it, then retry.');
    });
  }

  private flushUserTranscript() {
    if (this.userTranscript.trim()) this.callbacks.onUserMessage(this.userTranscript.trim(), true);
    this.userTranscript = '';
  }
  private flushAiTranscript() {
    if (this.aiTranscript.trim()) this.callbacks.onAiMessage(this.aiTranscript.trim(), true);
    this.aiTranscript = '';
  }
  private flushTranscripts() { this.flushUserTranscript(); this.flushAiTranscript(); }

  private setupMicCapture() {
    if (!this.inputAudioCtx || !this.micSource) return;
    this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);
    this.micSource.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioCtx.destination);
    this.scriptProcessor.onaudioprocess = (event) => {
      if (this.ended || this.isMuted) return;
      const input = event.inputBuffer.getChannelData(0);
      const rms = Math.sqrt(input.reduce((sum, value) => sum + value * value, 0) / input.length);
      this.callbacks.onAudioLevel(Math.min(1, rms * 5));
      if (this.isLiveConnected && this.ws?.readyState === WebSocket.OPEN) {
        const pcm = new DataView(new ArrayBuffer(input.length * 2));
        for (let i = 0; i < input.length; i++) {
          const sample = Math.max(-1, Math.min(1, input[i]));
          pcm.setInt16(i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
        }
        this.ws.send(JSON.stringify({ type: 'audio', audio: this.encode(pcm.buffer) }));
      }
    };
  }

  private initSpeechRecognition() {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) throw new Error('Live voice is unavailable and this browser has no speech recognition. Try Chrome or restore the Live service.');
    this.speechRecognition = new Recognition();
    this.speechRecognition.continuous = true;
    this.speechRecognition.interimResults = true;
    const languages: Record<string, string> = { English: 'en-US', Hindi: 'hi-IN', Telugu: 'te-IN' };
    this.speechRecognition.lang = languages[this.productConfig.preferredLanguage] || this.productConfig.preferredLanguage || 'en-US';
    this.speechRecognition.onresult = (event: any) => {
      if (!this.canRecognize()) return;
      let final = '', interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      if (interim) this.callbacks.onUserMessage(interim, false);
      if (final.trim()) void this.sendTextMessage(final.trim());
    };
    this.speechRecognition.onend = () => {
      this.recognitionRunning = false;
      this.resumeRecognition();
    };
    this.speechRecognition.onerror = (event: any) => {
      if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(event.error)) {
        this.isMuted = true;
        this.callbacks.onStatusChange('Error', `Speech recognition failed: ${event.error}. End the call and check microphone permissions.`);
      } else if (!['aborted', 'no-speech'].includes(event.error) && !this.ended) {
        this.callbacks.onStatusChange('Listening', `Speech recognition: ${event.error}. You can retry or type your question.`);
      }
    };
  }
  private canRecognize() {
    return !this.ended && !this.isMuted && !this.playing && this.pendingTurns === 0 && this.activeMode === 'conversational-turn';
  }
  private pauseRecognition() {
    if (this.recognitionTimer) clearTimeout(this.recognitionTimer);
    this.recognitionTimer = null;
    try { this.speechRecognition?.abort(); } catch {}
  }
  private resumeRecognition() {
    if (!this.canRecognize() || !this.speechRecognition || this.recognitionRunning || this.recognitionTimer) return;
    this.recognitionTimer = setTimeout(() => {
      this.recognitionTimer = null;
      if (!this.canRecognize() || this.recognitionRunning) return;
      try { this.speechRecognition.start(); this.recognitionRunning = true; }
      catch { this.callbacks.onStatusChange('Listening', 'Speech recognition could not restart. Try typing or restart the call.'); }
    }, 200);
  }

  public async sendTextMessage(text: string): Promise<void> {
    text = text.trim();
    if (!text || this.ended) return;
    if (this.activeMode === 'live-ws' && !this.isLiveConnected) {
      this.callbacks.onStatusChange('Error', 'The live connection is unavailable. End the call and retry.');
      return;
    }
    this.callbacks.onUserMessage(text, true);
    if (this.isLiveConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'text', text }));
      return;
    }
    if (this.activeMode !== 'conversational-turn') return;
    this.pendingTurns++;
    this.pauseRecognition();
    this.turnQueue = this.turnQueue.then(async () => {
      if (this.ended) return;
      this.callbacks.onStatusChange('Connecting');
      this.conversationHistory.push({ sender: 'customer', text });
      try {
        const response = await fetch('/api/gemini/chat-turn', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: this.abort.signal,
          body: JSON.stringify({ messages: this.conversationHistory, userMessage: text, productConfig: this.productConfig }),
        });
        const data = await response.json();
        if (!response.ok || typeof data.reply !== 'string' || !data.reply.trim()) {
          throw new Error(data.error || 'AI returned no answer.');
        }
        if (this.ended) return;
        this.conversationHistory.push({ sender: 'ai', text: data.reply });
        this.callbacks.onAiMessage(data.reply, true);
        await this.speak(data.reply);
      } catch (error: any) {
        if (!this.ended) this.callbacks.onStatusChange('Listening', error.message || 'AI response failed. Please retry.');
      } finally {
        this.pendingTurns--;
        if (!this.ended) {
          this.callbacks.onStatusChange('Listening');
          this.resumeRecognition();
        }
      }
    });
    return this.turnQueue;
  }

  private async speak(text: string) {
    if (this.ended) return;
    this.playing = true;
    this.pauseRecognition(); // Never transcribe our own TTS as another customer question.
    this.callbacks.onStatusChange('Speaking');
    try {
      const response = await fetch('/api/gemini/tts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: this.abort.signal,
        body: JSON.stringify({ text, voiceName: this.productConfig.voiceName }),
      });
      const data = await response.json();
      if (!response.ok || !data.audioBase64) throw new Error(data.error || 'Voice synthesis returned no audio.');
      if (this.ended || !this.outputAudioCtx) return;
      const bytes = this.decode(data.audioBase64);
      const mimeType = data.mimeType || '';
      const buffer = /pcm|l16/i.test(mimeType)
        ? this.pcmBuffer(bytes, Number(mimeType.match(/rate=(\d+)/)?.[1]) || 24000)
        : await this.outputAudioCtx.decodeAudioData(bytes);
      await this.schedule(buffer, false);
    } finally { this.playing = false; }
  }
  private pcmBuffer(bytes: ArrayBuffer, rate = 24000) {
    const samples = new DataView(bytes);
    const buffer = this.outputAudioCtx!.createBuffer(1, Math.floor(bytes.byteLength / 2), rate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = samples.getInt16(i * 2, true) / 32768;
    return buffer;
  }
  private playPcmChunk(base64: string) {
    if (!this.outputAudioCtx || this.ended) return;
    void this.schedule(this.pcmBuffer(this.decode(base64)), true);
  }
  private schedule(buffer: AudioBuffer, queue: boolean): Promise<void> {
    if (!this.outputAudioCtx || this.ended) return Promise.resolve();
    const context = this.outputAudioCtx;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    this.recorder.attachAiNode(source);
    this.sources.add(source);
    const at = queue ? Math.max(this.nextPlayTime, context.currentTime) : context.currentTime;
    this.nextPlayTime = at + buffer.duration;
    return new Promise((resolve) => {
      source.onended = () => {
        this.sources.delete(source);
        source.disconnect();
        if (!this.ended && this.activeMode === 'live-ws' && this.turnComplete && !this.sources.size) {
          this.callbacks.onStatusChange('Listening');
        }
        resolve();
      };
      source.start(at);
    });
  }
  private stopAudio() {
    for (const source of this.sources) { try { source.stop(); } catch {} }
    this.sources.clear();
    this.nextPlayTime = this.outputAudioCtx?.currentTime || 0;
  }
  private closeSocket() {
    this.isLiveConnected = false;
    if (this.ws) {
      this.ws.onopen = this.ws.onmessage = this.ws.onclose = this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
  }
  public endSession(): Promise<Blob | null> {
    if (this.stopPromise) return this.stopPromise;
    this.ended = true;
    this.abort.abort();
    this.cancelConnect?.();
    this.cancelConnect = null;
    this.pauseRecognition();
    this.speechRecognition = null;
    this.closeSocket();
    this.stopAudio();
    this.flushTranscripts();
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;
    if (this.scriptProcessor) { this.scriptProcessor.onaudioprocess = null; this.scriptProcessor.disconnect(); }
    this.micSource?.disconnect();
    this.analyser?.disconnect();
    this.callbacks.onAudioLevel(0);
    this.callbacks.onStatusChange('Ended');
    this.stopPromise = (async () => {
      try { return this.recorder.isRecording() ? await this.recorder.stop() : null; }
      finally {
        await Promise.allSettled([this.inputAudioCtx?.close(), this.outputAudioCtx?.close()].filter(Boolean));
        this.inputAudioCtx = this.outputAudioCtx = null;
      }
    })();
    return this.stopPromise;
  }
  private encode(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const value of bytes) binary += String.fromCharCode(value);
    return window.btoa(binary);
  }
  private decode(base64: string) {
    const binary = window.atob(base64);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer;
  }
}
