export interface AudioMixerRecorder {
  start: (userStream: MediaStream, aiAudioContext: AudioContext, aiAudioNode?: AudioNode) => void;
  attachAiNode: (node: AudioNode) => void;
  stop: () => Promise<Blob>;
  isRecording: () => boolean;
  getMimeType: () => string;
}

export class ConversationAudioRecorder implements AudioMixerRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private mixedStreamDestination: MediaStreamAudioDestinationNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private selectedMimeType = '';
  private stopPromise: Promise<Blob> | null = null;
  private recordingError: Error | null = null;

  public start(userStream: MediaStream, context: AudioContext, aiAudioNode?: AudioNode): void {
    if (typeof MediaRecorder === 'undefined') throw new Error('This browser does not support call recording.');
    if (this.isRecording()) throw new Error('A recording is already active.');
    this.recordedChunks = [];
    this.recordingError = null;
    this.stopPromise = null;
    try {
      this.mixedStreamDestination = context.createMediaStreamDestination();
      this.micSource = context.createMediaStreamSource(userStream);
      this.micSource.connect(this.mixedStreamDestination);
      if (aiAudioNode) this.attachAiNode(aiAudioNode);
      const supportedType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
        .find((type) => MediaRecorder.isTypeSupported(type));
      this.mediaRecorder = new MediaRecorder(this.mixedStreamDestination.stream,
        supportedType ? { mimeType: supportedType, audioBitsPerSecond: 128000 } : undefined);
      this.selectedMimeType = this.mediaRecorder.mimeType;
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size) this.recordedChunks.push(event.data);
      };
      this.mediaRecorder.onerror = () => { this.recordingError = new Error('The browser failed to capture the recording.'); };
      this.mediaRecorder.start(250);
    } catch (error) { this.cleanup(); throw error; }
  }
  public attachAiNode(node: AudioNode) {
    if (this.mixedStreamDestination) node.connect(this.mixedStreamDestination);
  }
  public getMixedDestination() { return this.mixedStreamDestination; }
  public isRecording() { return this.mediaRecorder !== null; }
  public getMimeType() { return this.selectedMimeType; }
  public stop(): Promise<Blob> {
    if (this.stopPromise) return this.stopPromise;
    this.stopPromise = new Promise((resolve, reject) => {
      const complete = () => {
        const blob = new Blob(this.recordedChunks, { type: this.selectedMimeType });
        const error = this.recordingError;
        this.cleanup();
        if (error) reject(error); else resolve(blob);
      };
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') { complete(); return; }
      // Final dataavailable is delivered before stop; do not construct the blob earlier.
      const timeout = setTimeout(() => {
        this.recordingError = new Error('Recording finalization timed out.');
        complete();
      }, 5000);
      this.mediaRecorder.onstop = () => { clearTimeout(timeout); complete(); };
      try { this.mediaRecorder.stop(); }
      catch (error) { clearTimeout(timeout); this.cleanup(); reject(error); }
    });
    return this.stopPromise;
  }
  private cleanup() {
    this.micSource?.disconnect();
    this.micSource = null;
    this.mixedStreamDestination?.stream.getTracks().forEach((track) => track.stop());
    this.mixedStreamDestination = null;
    this.mediaRecorder = null;
  }
}

export function downloadAudioBlob(blob: Blob, filename = 'salespilot-call-recording.webm'): void {
  const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : blob.type.includes('wav') ? 'wav' : 'webm';
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.style.display = 'none';
  anchor.href = url;
  anchor.download = filename.replace(/\.(webm|ogg|wav|m4a)$/i, `.${extension}`);
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => { anchor.remove(); URL.revokeObjectURL(url); }, 100);
}
