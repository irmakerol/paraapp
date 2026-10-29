import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Classic vario sound: beeps that get higher and faster as the climb gets stronger, and a low
 * continuous-ish tone in strong sink. The tones are tiny WAV files generated on first use.
 */
const RATE = 16_000;
const CLIMB_START = 0.2;
const SINK_ALARM = -2.5;
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

export class VarioAudio {
  private climbPlayers: { level: number; player: AudioPlayer }[] = [];
  private sinkPlayer: AudioPlayer | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private climb: number | null = null;
  private running = false;

  async start() {
    if (this.running) return;
    this.running = true;
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'mixWithOthers',
    }).catch(() => undefined);
    if (!this.climbPlayers.length) {
      await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => undefined);
      for (const level of LEVELS) {
        const uri = `${DIR}climb-${level}.wav`;
        await FileSystem.writeAsStringAsync(uri, wav(freqFor(level), 140), {
          encoding: FileSystem.EncodingType.Base64,
        });
        this.climbPlayers.push({ level, player: createAudioPlayer({ uri }) });
      }
      const sinkUri = `${DIR}sink.wav`;
      await FileSystem.writeAsStringAsync(sinkUri, wav(320, 500, 0.5), {
        encoding: FileSystem.EncodingType.Base64,
      });
      this.sinkPlayer = createAudioPlayer({ uri: sinkUri });
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
    if (climb !== null && climb >= CLIMB_START) {
      let best = this.climbPlayers[0];
      for (const p of this.climbPlayers) if (p.level <= climb) best = p;
      this.play(best?.player);
      // Faster beeps in stronger lift: ~2/s at 0.5 m/s, ~6/s at 4 m/s.
      next = Math.max(160, 600 - climb * 110);
    } else if (climb !== null && climb <= SINK_ALARM) {
      this.play(this.sinkPlayer);
      next = 600;
    }
    this.timer = setTimeout(this.tick, next);
  };
}
