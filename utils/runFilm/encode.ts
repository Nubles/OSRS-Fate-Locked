/**
 * Turns frames drawn on a canvas into a video file on the player's device.
 * MP4 (H.264) through the browser's own video encoder where it has one,
 * else WebM; with no encoder at all, the canvas is recorded in real time.
 * Nothing is uploaded. Browser only; loaded with the Run Film.
 */

export const FILM_FPS = 24;

export interface FilmFile {
  blob: Blob;
  /** "mp4" or "webm". */
  ext: string;
  mime: string;
}

export interface EncodeOptions {
  canvas: HTMLCanvasElement;
  frames: number;
  /** Draws frame `i` on the canvas. */
  draw: (i: number) => void;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export class FilmCancelled extends Error {
  constructor() { super('Film cancelled.'); this.name = 'FilmCancelled'; }
}

const checkAbort = (signal?: AbortSignal) => { if (signal?.aborted) throw new FilmCancelled(); };

const encodeWithWebCodecs = async (o: EncodeOptions): Promise<FilmFile | null> => {
  if (typeof window === 'undefined' || !('VideoEncoder' in window)) return null;
  const mb = await import('mediabunny');
  const { width, height } = o.canvas;
  const formats = [
    { format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), ext: 'mp4', mime: 'video/mp4' },
    { format: new mb.WebMOutputFormat(), ext: 'webm', mime: 'video/webm' },
  ];
  for (const f of formats) {
    const codec = await mb.getFirstEncodableVideoCodec(f.format.getSupportedVideoCodecs(), { width, height });
    if (!codec) continue;
    const target = new mb.BufferTarget();
    const output = new mb.Output({ format: f.format, target });
    const source = new mb.CanvasSource(o.canvas, { codec, bitrate: mb.QUALITY_HIGH, keyFrameInterval: 2 });
    output.addVideoTrack(source, { frameRate: FILM_FPS });
    await output.start();
    try {
      for (let i = 0; i < o.frames; i += 1) {
        checkAbort(o.signal);
        o.draw(i);
        await source.add(i / FILM_FPS, 1 / FILM_FPS);
        o.onProgress?.(i + 1, o.frames);
      }
      await output.finalize();
    } catch (err) {
      await output.cancel().catch(() => undefined);
      throw err;
    }
    if (!target.buffer) return null;
    return { blob: new Blob([target.buffer], { type: f.mime }), ext: f.ext, mime: f.mime };
  }
  return null;
};

const pickRecorderType = (): { mime: string; ext: string } | null => {
  if (typeof MediaRecorder === 'undefined') return null;
  const options = [
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
  ];
  return options.find(t => MediaRecorder.isTypeSupported(t.mime)) ?? null;
};

/** Plays the frames in real time into a MediaRecorder. Slower, but works without WebCodecs. */
const recordInRealTime = (o: EncodeOptions): Promise<FilmFile> => new Promise((resolve, reject) => {
  const type = pickRecorderType();
  const capture = (o.canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }).captureStream;
  if (!type || !capture) { reject(new Error('This browser cannot make videos. Try a recent Chrome, Edge, Firefox or Safari.')); return; }
  const stream = capture.call(o.canvas, FILM_FPS);
  const recorder = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: 4_000_000 });
  const parts: Blob[] = [];
  recorder.ondataavailable = e => { if (e.data.size) parts.push(e.data); };
  recorder.onstop = () => {
    stream.getTracks().forEach(t => t.stop());
    if (o.signal?.aborted) { reject(new FilmCancelled()); return; }
    const mime = type.mime.split(';')[0];
    resolve({ blob: new Blob(parts, { type: mime }), ext: type.ext, mime });
  };
  let i = 0;
  o.draw(0);
  recorder.start();
  const timer = window.setInterval(() => {
    if (o.signal?.aborted || i >= o.frames) {
      window.clearInterval(timer);
      recorder.stop();
      return;
    }
    o.draw(i);
    i += 1;
    o.onProgress?.(i, o.frames);
  }, 1000 / FILM_FPS);
});

export const encodeFilm = async (o: EncodeOptions): Promise<FilmFile> => {
  const file = await encodeWithWebCodecs(o);
  if (file) return file;
  checkAbort(o.signal);
  return recordInRealTime(o);
};
