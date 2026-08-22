import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SAMPLE_RATE = 44100;
const OUTPUT_DIR = join(process.env.USERPROFILE || '', 'Downloads', 'flipz-sfx');

mkdirSync(OUTPUT_DIR, { recursive: true });

// ── WAV encoder ──────────────────────────────────────────────────────────
function encodeWav(samples, sampleRate = SAMPLE_RATE) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return buffer;
}

// ── Helpers ──────────────────────────────────────────────────────────────
const sine = (t, freq) => Math.sin(2 * Math.PI * freq * t);
const saw = (t, freq) => 2 * ((t * freq) % 1) - 1;
const noise = () => Math.random() * 2 - 1;
const lerp = (a, b, t) => a + (b - a) * t;
const env = (t, attack, decay, sustain, release, duration) => {
  if (t < attack) return t / attack;
  if (t < attack + decay) return 1 - (1 - sustain) * ((t - attack) / decay);
  if (t < duration - release) return sustain;
  if (t < duration) return sustain * (1 - (t - (duration - release)) / release);
  return 0;
};

// ── SFX Generators ───────────────────────────────────────────────────────

function cardFlip(duration = 0.45) {
  const len = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    // Rising whoosh with filtered noise
    const freq = lerp(200, 2000, t / duration);
    const e = env(t, 0.02, 0.1, 0.4, 0.15, duration);
    const n = noise() * 0.3;
    const s = sine(t, freq) * 0.4;
    // Add a bright "reveal" chime at the end
    const chimeT = Math.max(0, t - duration * 0.6) / (duration * 0.4);
    const chime = sine(t, 1200) * 0.3 * Math.pow(Math.max(0, 1 - chimeT), 2) * (chimeT > 0 ? 1 : 0);
    samples[i] = (n + s) * e * 0.6 + chime;
  }
  return samples;
}

function legendaryReveal(duration = 1.8) {
  const len = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    // Epic ascending chord
    const e = env(t, 0.05, 0.3, 0.6, 0.8, duration);
    // Major chord notes ascending
    const note1 = sine(t, lerp(400, 600, Math.min(t / 0.5, 1))) * 0.25;
    const note2 = sine(t, lerp(500, 750, Math.min(t / 0.6, 1))) * 0.2 * Math.min(t / 0.15, 1);
    const note3 = sine(t, lerp(600, 900, Math.min(t / 0.7, 1))) * 0.15 * Math.min(Math.max(0, t - 0.1) / 0.15, 1);
    // Sparkle / shimmer
    const shimmer = sine(t, 2400 + sine(t, 5) * 200) * 0.08 * Math.min(Math.max(0, t - 0.2) / 0.3, 1);
    // Sub bass impact
    const bass = sine(t, 80) * 0.2 * Math.max(0, 1 - t / 0.3);
    // Crash / bright noise
    const crash = noise() * 0.1 * Math.max(0, 1 - t / 0.4);
    samples[i] = (note1 + note2 + note3 + shimmer + bass + crash) * e;
  }
  return samples;
}

function packTap(duration = 0.15) {
  const len = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    // Short percussive impact
    const e = Math.pow(Math.max(0, 1 - t / duration), 3);
    const body = sine(t, lerp(300, 80, t / duration)) * 0.5;
    const click = noise() * 0.4 * Math.max(0, 1 - t / 0.02);
    samples[i] = (body + click) * e * 0.7;
  }
  return samples;
}

function packTear(duration = 0.6) {
  const len = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    // Tearing / ripping noise
    const e = env(t, 0.01, 0.1, 0.5, 0.3, duration);
    // Filtered crackling noise
    const n = noise();
    const crackle = n * (0.5 + 0.5 * sine(t, lerp(100, 400, t / duration)));
    // Subtle bass thud at the start
    const thud = sine(t, 60) * 0.3 * Math.max(0, 1 - t / 0.1);
    // Rising brightness
    const bright = noise() * 0.15 * sine(t, lerp(2000, 5000, t / duration)) * Math.min(t / 0.1, 1);
    samples[i] = (crackle * 0.4 + thud + bright) * e;
  }
  return samples;
}

function collectSuccess(duration = 0.5) {
  const len = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    // Two-note "coin collect" ding — C5 then E5
    const note1Dur = 0.2;
    const e1 = t < note1Dur ? Math.pow(1 - t / note1Dur, 1.5) : 0;
    const e2 = t > 0.1 ? Math.pow(Math.max(0, 1 - (t - 0.1) / (duration - 0.1)), 1.5) : 0;
    const s1 = sine(t, 523.25) * e1 * 0.4; // C5
    const s2 = sine(t, 659.25) * e2 * 0.45; // E5
    // Gentle harmonics
    const h1 = sine(t, 1046.5) * e1 * 0.1;
    const h2 = sine(t, 1318.5) * e2 * 0.1;
    samples[i] = (s1 + s2 + h1 + h2) * 0.7;
  }
  return samples;
}

function cardSwipe(duration = 0.25) {
  const len = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    // Quick swoosh — filtered noise sweep
    const e = env(t, 0.02, 0.05, 0.3, 0.1, duration);
    const freq = lerp(800, 3000, t / duration);
    const n = noise() * 0.3;
    const s = sine(t, freq) * 0.15;
    // Subtle whistle
    const whistle = sine(t, lerp(1500, 4000, t / duration)) * 0.05 * Math.sin(Math.PI * t / duration);
    samples[i] = (n + s + whistle) * e * 0.5;
  }
  return samples;
}

function streakLost(duration = 0.8) {
  const len = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    // Sad descending minor third — E4 → C4
    const e = env(t, 0.03, 0.15, 0.4, 0.4, duration);
    const freq = lerp(329.63, 261.63, Math.pow(t / duration, 0.7)); // E4 → C4
    const s = sine(t, freq) * 0.4;
    // Detuned second oscillator for "sad" feel
    const s2 = sine(t, freq * 1.005) * 0.2;
    // Low rumble
    const rumble = sine(t, 80) * 0.1 * Math.max(0, 1 - t / 0.3);
    samples[i] = (s + s2 + rumble) * e * 0.6;
  }
  return samples;
}

function navClick(duration = 0.08) {
  const len = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    // Very short pop/tick
    const e = Math.pow(Math.max(0, 1 - t / duration), 4);
    const click = sine(t, 1800) * 0.3 + sine(t, 2400) * 0.15;
    const transient = noise() * 0.2 * Math.max(0, 1 - t / 0.01);
    samples[i] = (click + transient) * e * 0.5;
  }
  return samples;
}

function errorBuzz(duration = 0.35) {
  const len = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    // Buzzy error — two quick pulses
    const e = env(t, 0.01, 0.05, 0.6, 0.15, duration);
    // Double pulse
    const pulse = (Math.sin(Math.PI * t * 12) > 0 ? 1 : 0.3);
    const s = saw(t, 180) * 0.2 + sine(t, 220) * 0.25;
    samples[i] = s * e * pulse * 0.5;
  }
  return samples;
}

function catMeow(duration = 0.5) {
  const len = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const e = env(t, 0.05, 0.1, 0.5, 0.2, duration);
    // Meow: frequency rises then falls
    const phase = t / duration;
    const freq = phase < 0.4
      ? lerp(600, 1100, phase / 0.4)
      : lerp(1100, 700, (phase - 0.4) / 0.6);
    const s = sine(t, freq) * 0.35;
    // Add harmonics for nasal quality
    const h1 = sine(t, freq * 2) * 0.12;
    const h2 = sine(t, freq * 3) * 0.06;
    // Vibrato
    const vib = sine(t, 6) * 15;
    const vibS = sine(t, freq + vib) * 0.1;
    // Slight breathiness
    const breath = noise() * 0.04 * e;
    samples[i] = (s + h1 + h2 + vibS + breath) * e * 0.6;
  }
  return samples;
}

// ── Generate all files ───────────────────────────────────────────────────
const sfxList = [
  { name: 'card-flip',        fn: cardFlip },
  { name: 'legendary-reveal', fn: legendaryReveal },
  { name: 'pack-tap',         fn: packTap },
  { name: 'pack-tear',        fn: packTear },
  { name: 'collect-success',  fn: collectSuccess },
  { name: 'card-swipe',       fn: cardSwipe },
  { name: 'streak-lost',      fn: streakLost },
  { name: 'nav-click',        fn: navClick },
  { name: 'error',            fn: errorBuzz },
  { name: 'cat-meow',         fn: catMeow },
];

console.log(`\n🔊 Generating SFX in: ${OUTPUT_DIR}\n`);

for (const { name, fn } of sfxList) {
  const samples = fn();
  const wav = encodeWav(samples);
  const path = join(OUTPUT_DIR, `${name}.wav`);
  writeFileSync(path, wav);
  const kb = (wav.length / 1024).toFixed(1);
  console.log(`  ✅  ${name}.wav  (${kb} KB, ${(samples.length / SAMPLE_RATE).toFixed(2)}s)`);
}

console.log(`\n🎉 Done! ${sfxList.length} SFX files generated.\n`);
