import type { RecordingFailure, VoiceRecorder } from '../../application/ports';
import type { VoiceRecording } from '../../domain/chat';
import { err, ok, type Result } from '../../domain/result';

// MP4/AAC first: it plays on every phone, while WebM does not play on older iPhones (ADR 0015).
const PREFERRED_TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];

interface Session {
  readonly recorder: MediaRecorder;
  readonly stream: MediaStream;
  readonly chunks: Blob[];
  readonly startedAt: number;
  readonly finished: Promise<number>;
  readonly limit: ReturnType<typeof setTimeout>;
}

export function browserVoiceRecorder(maxMs: number): VoiceRecorder {
  let current: Session | null = null;

  function release(session: Session): void {
    clearTimeout(session.limit);
    session.stream.getTracks().forEach((track) => track.stop());
    if (current === session) current = null;
  }

  return {
    async start(): Promise<Result<void, RecordingFailure>> {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return err('unsupported');
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        return err('denied');
      }
      const mimeType = PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      const finished = new Promise<number>((resolve) => recorder.addEventListener('stop', () => resolve(performance.now())));
      const limit = setTimeout(() => recorder.state !== 'inactive' && recorder.stop(), maxMs);
      recorder.start();
      current = { recorder, stream, chunks, startedAt: performance.now(), finished, limit };
      return ok(undefined);
    },

    async stop(): Promise<VoiceRecording | null> {
      const session = current;
      if (!session) return null;
      if (session.recorder.state !== 'inactive') session.recorder.stop();
      const endedAt = await session.finished;
      release(session);
      const mime = (session.recorder.mimeType || 'audio/webm').split(';')[0];
      if (session.chunks.length === 0) return null;
      return {
        blob: new Blob(session.chunks, { type: mime }),
        mime,
        durationMs: Math.min(endedAt - session.startedAt, maxMs),
      };
    },

    cancel(): void {
      const session = current;
      if (!session) return;
      if (session.recorder.state !== 'inactive') session.recorder.stop();
      release(session);
    },
  };
}
