// Sound, all synthesized with WebAudio — no audio files, no network. A
// low bass loop for the streets, an engine hum that follows the car, a
// two-tone siren when the police are close, and one-shot effects.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let muted = false;
  let sirenOn = false;
  let sirenOsc = null;
  let sirenGain = null;
  let beat = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  function noise(dur, vol, low) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = low || 1200;
    const gain = ctx.createGain();
    gain.gain.value = vol || 0.3;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  // A slow sun-soaked bass line: A minor, one note a beat, plus a soft hat tick.
  const BASS = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4];
  function startMusic() {
    if (!ctx || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted) return;
      beat = (beat + 1) % 8;
      tone(BASS[beat], 0.5, 'triangle', 0.16);
      if (beat % 2 === 0) tone(880, 0.05, 'square', 0.03);
    }, 320);
  }

  return {
    unlock() { if (ensure()) { ctx.resume(); startMusic(); } },
    setEngine(speed, driving) {
      if (!ctx) return;
      engineGain.gain.value = muted ? 0 : driving ? 0.05 + Math.min(0.09, Math.abs(speed) / 6000) : 0;
      engineOsc.frequency.value = 50 + Math.abs(speed) / 6;
    },
    setSiren(on) {
      if (!ctx) return;
      sirenOn = on;
      sirenGain.gain.value = muted || !on ? 0 : 0.045;
      if (on) sirenOsc.frequency.setValueAtTime(sirenOsc.frequency.value > 750 ? 660 : 880, ctx.currentTime);
    },
    gunshot() { noise(0.12, 0.4, 900); },
    pickup() { tone(660, 0.1, 'sine', 0.2); tone(990, 0.14, 'sine', 0.2); },
    crash() { noise(0.25, 0.35, 500); },
    mission() { tone(523, 0.12, 'triangle', 0.22); tone(659, 0.12, 'triangle', 0.22); tone(784, 0.3, 'triangle', 0.24); },
    fail() { tone(220, 0.4, 'sawtooth', 0.15, 110); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.35;
      return muted;
    },
    get muted() { return muted; },
  };
}
