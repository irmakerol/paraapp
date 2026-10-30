import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Classic vario sound: beeps that get higher and faster as the climb gets stronger, and a low
 * continuous-ish tone in strong sink. The tones are tiny WAV files generated on first use.
 */
const RATE = 16_000;
const LEVELS = [0.2, 0.5, 1, 1.5, 2, 3, 4, 5];
const DIR = `${FileSystem.cacheDirectory ?? ''}vario/`;

const freqFor = (climb: number) => 600 + Math.min(climb, 6) * 130;

function wav(freq: number, ms: number, volume = 0.6): string {
  const samples = Math.round((RATE * ms) / 1000);
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) bytes[offset + i] = s.charCodeAt(i);
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples * 2, true);
  const fade = Math.round(RATE * 0.005);
  for (let i = 0; i < samples; i++) {
    const env = Math.min(1, i / fade, (samples - i) / fade);
    const v = Math.sin((2 * Math.PI * freq * i) / RATE) * volume * env;
    view.setInt16(44 + i * 2, Math.round(v * 32_767), true);
  }
  return base64(bytes);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += B64[(n >> 18) & 63];
    out += B64[(n >> 12) & 63];
    out += b === undefined ? '=' : B64[(n >> 6) & 63];
    out += c === undefined ? '=' : B64[n & 63];
  }
  return out;
}

export interface VarioTones {
  climbStart: number;
  sinkAlarm: number;
  /** 0–1 */
  volume: number;
}

export class VarioAudio {
  private climbPlayers: { level: number; player: AudioPlayer }[] = [];
  private sinkPlayer: AudioPlayer | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private climb: number | null = null;
  private running = false;
  private tones: VarioTones = { climbStart: 0.2, sinkAlarm: -2.5, volume: 0.6 };
  private builtVolume: number | null = null;

  /** New thresholds apply at once; a new volume rebuilds the tones on the next start. */
  configure(tones: VarioTones) {
    const rebuild = tones.volume !== this.tones.volume;
    this.tones = tones;
    if (rebuild && this.running) {
      this.stop();
      void this.start();
    }
  }

  /** A short sample: rising climb tones, then the sink tone, so the pilot hears the settings. */
  async demo() {
    const wasRunning = this.running;
    const saved = this.climb;
    await this.start();
    for (const climb of [0.5, 1, 2, 3, 4, this.tones.sinkAlarm - 0.5]) {
      this.climb = climb;
      await new Promise((resolve) => setTimeout(resolve, 1_200));
    }
    this.climb = saved;
    if (!wasRunning) this.stop();
  }

  private release() {
    for (const p of this.climbPlayers) p.player.remove();
    this.sinkPlayer?.remove();
    this.climbPlayers = [];
    this.sinkPlayer = null;
    this.builtVolume = null;
  }

  async start() {
    if (this.running) return;
    this.running = true;
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'mixWithOthers',
    }).catch(() => undefined);
    if (!this.climbPlayers.length || this.builtVolume !== this.tones.volume) {
      this.release();
      const volume = this.tones.volume;
      const tag = Math.round(volume * 100);
      await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => undefined);
      for (const level of LEVELS) {
        const uri = `${DIR}climb-${level}-${tag}.wav`;
        await FileSystem.writeAsStringAsync(uri, wav(freqFor(level), 140, volume), {
          encoding: FileSystem.EncodingType.Base64,
        });
        this.climbPlayers.push({ level, player: createAudioPlayer({ uri }) });
      }
      const sinkUri = `${DIR}sink-${tag}.wav`;
      await FileSystem.writeAsStringAsync(sinkUri, wav(320, 500, volume * 0.85), {
        encoding: FileSystem.EncodingType.Base64,
      });
      this.sinkPlayer = createAudioPlayer({ uri: sinkUri });
      this.builtVolume = volume;
    }
    this.tick();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  update(climb: number | null) {
    this.climb = climb;
  }

  private play(player: AudioPlayer | null | undefined) {
    if (!player) return;
    try {
      void player.seekTo(0);
      player.play();
    } catch {
      // A missed beep is harmless.
    }
  }

  private tick = () => {
    if (!this.running) return;
    const climb = this.climb;
    let next = 250;
    if (climb !== null && climb >= this.tones.climbStart && climb > 0) {
      let best = this.climbPlayers[0];
      // Below the first tone level (a 0–0.1 m/s threshold) the lowest tone plays.
      for (const p of this.climbPlayers) if (p.level <= climb) best = p;
      this.play(best?.player);
      // Faster beeps in stronger lift: ~2/s at 0.5 m/s, ~6/s at 4 m/s.
      next = Math.max(160, 600 - climb * 110);
    } else if (climb !== null && climb <= this.tones.sinkAlarm) {
      this.play(this.sinkPlayer);
      next = 600;
    }
    this.timer = setTimeout(this.tick, next);
  };
}
