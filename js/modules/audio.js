/**
 * ZENITE AUDIO ENGINE v3.1 - PERFORMANCE & STABILITY
 * ═══════════════════════════════════════════════════════════════════════════════
 * - AudioContext singleton with resume/suspend guards
 * - Cached noise buffers to reduce main-thread churn (less crackle)
 * - Reverb impulse cached once
 * - Procedural SFX with subtle variations
 */

let audioCtx = null;
let isSfxEnabled = true;
let masterGain = null;
let reverbNode = null;
let compressor = null;
let cachedNoiseBuffers = {};
let cachedImpulse = null;

const VOLUME_CONFIG = {
    click: 0.4,
    success: 0.5,
    error: 0.4,
    dice: 0.6,
    critical: 0.7,
    fumble: 0.5,
    notification: 0.35,
    save: 0.4,
    levelup: 0.6,
    hover: 0.15,
    whoosh: 0.3,
    coin: 0.4,
    magic: 0.5,
    combat: 0.55,
    ambient: 0.2
};

const createNoiseBuffer = (duration = 0.3) => {
    if (!audioCtx) return null;
    const length = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
};

const getNoiseBuffer = (key = 'default', duration = 0.3) => {
    if (!cachedNoiseBuffers[key]) {
        cachedNoiseBuffers[key] = createNoiseBuffer(duration);
    }
    return cachedNoiseBuffers[key];
};

const createReverbImpulse = (duration = 1.5, decay = 2) => {
    if (!audioCtx) return null;
    const length = audioCtx.sampleRate * duration;
    const impulse = audioCtx.createBuffer(2, length, audioCtx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
    }
    return impulse;
};

export const initAudio = () => {
    if (audioCtx) {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {
                console.warn('[AUDIO] Não foi possível resumir AudioContext');
            });
        }
        return;
    }

    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();

        // Compressor para suavizar picos
        compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.knee.value = 30;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;
        compressor.connect(audioCtx.destination);

        // Master gain
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.7;
        masterGain.connect(compressor);

        // Reverb cache
        cachedImpulse = createReverbImpulse(1.2, 2.5);
        reverbNode = audioCtx.createConvolver();
        reverbNode.buffer = cachedImpulse;
        const reverbGain = audioCtx.createGain();
        reverbGain.gain.value = 0.15;
        reverbNode.connect(reverbGain);
        reverbGain.connect(masterGain);

        // Pré-aquece com um buffer silencioso para evitar crackle inicial
        const silent = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
        const warmup = audioCtx.createBufferSource();
        warmup.buffer = silent;
        warmup.connect(masterGain);
        warmup.start();
    } catch (e) {
        console.warn('[AUDIO] AudioContext não suportado', e);
    }
};

export const setSfxEnabled = (enabled) => {
    isSfxEnabled = enabled;
    if (audioCtx) {
        if (enabled && audioCtx.state === 'suspended') audioCtx.resume();
        if (!enabled && audioCtx.state === 'running') audioCtx.suspend();
    }
};

export const setMasterVolume = (volume) => {
    if (masterGain) {
        masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
};

// ═══════════════════════════════════════════════════════════════
// SONS INDIVIDUAIS
// ═══════════════════════════════════════════════════════════════

const playClick = (isHacker) => {
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;

    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    const filter1 = audioCtx.createBiquadFilter();

    if (!isHacker) {
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(2200, t);
        osc1.frequency.exponentialRampToValueAtTime(400, t + 0.03);
        filter1.type = 'bandpass';
        filter1.frequency.setValueAtTime(1500, t);
        filter1.Q.value = 2;
        gain1.gain.setValueAtTime(0, t);
        gain1.gain.linearRampToValueAtTime(0.15, t + 0.002);
        gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    } else {
        osc1.type = 'square';
        osc1.frequency.setValueAtTime(120, t);
        osc1.frequency.linearRampToValueAtTime(80, t + 0.08);
        filter1.type = 'highpass';
        filter1.frequency.setValueAtTime(800, t);
        gain1.gain.setValueAtTime(0.12, t);
        gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    }

    osc1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(t);
    osc1.stop(t + 0.1);

    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(isHacker ? 60 : 180, t);
    osc2.frequency.exponentialRampToValueAtTime(40, t + 0.06);
    gain2.gain.setValueAtTime(0, t);
    gain2.gain.linearRampToValueAtTime(isHacker ? 0.08 : 0.1, t + 0.003);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(t);
    osc2.stop(t + 0.08);
};

const playSuccess = () => {
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;
    const playNote = (freq, delay, duration) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + delay);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, t + delay);
        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(0.12, t + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + duration);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        osc.start(t + delay);
        osc.stop(t + delay + duration);
    };
    playNote(523.25, 0, 0.2);
    playNote(659.25, 0.08, 0.25);
    playNote(783.99, 0.16, 0.3);
};

const playError = () => {
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.15);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.25);
};

const playDiceRoll = () => {
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;
    const rollCount = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < rollCount; i++) {
        const delay = i * 0.04 + Math.random() * 0.02;
        const freq = 800 + Math.random() * 400;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + delay);
        osc.frequency.exponentialRampToValueAtTime(200, t + delay + 0.02);
        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(0.06 - i * 0.005, t + delay + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.03);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + delay);
        osc.stop(t + delay + 0.05);
    }
    setTimeout(() => {
        if (!audioCtx || !masterGain) return;
        const t2 = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, t2);
        osc.frequency.exponentialRampToValueAtTime(150, t2 + 0.05);
        gain.gain.setValueAtTime(0.12, t2);
        gain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.08);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t2);
        osc.stop(t2 + 0.1);
    }, rollCount * 40 + 50);
};

const playCritical = () => {
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + i * 0.06);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, t);
        gain.gain.setValueAtTime(0, t + i * 0.06);
        gain.gain.linearRampToValueAtTime(0.15, t + i * 0.06 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.3);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        osc.start(t + i * 0.06);
        osc.stop(t + i * 0.06 + 0.35);
    });
};

const playFumble = () => {
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.4);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.6);
};

const playNotification = () => {
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1174.66, t + 0.1);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.01);
    gain.gain.setValueAtTime(0.08, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.3);
};

const playSave = () => {
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.linearRampToValueAtTime(900, t + 0.12);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.25);
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1200, t + 0.05);
    gain2.gain.setValueAtTime(0, t + 0.05);
    gain2.gain.linearRampToValueAtTime(0.04, t + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(t + 0.05);
    osc2.stop(t + 0.25);
};

const playLevelUp = () => {
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;
    const notes = [
        { freq: 261.63, delay: 0, dur: 0.4 },
        { freq: 329.63, delay: 0.08, dur: 0.35 },
        { freq: 392, delay: 0.16, dur: 0.3 },
        { freq: 523.25, delay: 0.24, dur: 0.5 },
        { freq: 659.25, delay: 0.32, dur: 0.45 },
        { freq: 783.99, delay: 0.4, dur: 0.6 },
        { freq: 1046.5, delay: 0.48, dur: 0.8 }
    ];
    notes.forEach(({ freq, delay, dur }) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + delay);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(4000, t + delay);
        filter.Q.value = 1;
        const volume = delay < 0.3 ? 0.12 : 0.18;
        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(volume, t + delay + 0.015);
        gain.gain.setValueAtTime(volume * 0.9, t + delay + dur * 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        if (reverbNode) gain.connect(reverbNode);
        osc.start(t + delay);
        osc.stop(t + delay + dur + 0.1);
    });
    for (let i = 0; i < 5; i++) {
        const sparkle = audioCtx.createOscillator();
        const sparkleGain = audioCtx.createGain();
        sparkle.type = 'sine';
        sparkle.frequency.setValueAtTime(2000 + Math.random() * 1000, t + 0.5 + i * 0.05);
        sparkleGain.gain.setValueAtTime(0.03, t + 0.5 + i * 0.05);
        sparkleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7 + i * 0.05);
        sparkle.connect(sparkleGain);
        sparkleGain.connect(masterGain);
        sparkle.start(t + 0.5 + i * 0.05);
        sparkle.stop(t + 0.8 + i * 0.05);
    }
};

const playHover = () => {
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800 + Math.random() * 200, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.02, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.04);
};

const playWhoosh = () => {
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;
    const noiseBuffer = getNoiseBuffer('whoosh', 0.3);
    if (!noiseBuffer) return;
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.exponentialRampToValueAtTime(2000, t + 0.1);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.2);
    filter.Q.value = 2;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start(t);
    noise.stop(t + 0.3);
};

const playCoin = () => {
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;
    const freqs = [1400, 1800, 2200];
    freqs.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + i * 0.02);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.8, t + i * 0.02 + 0.1);
        gain.gain.setValueAtTime(0, t + i * 0.02);
        gain.gain.linearRampToValueAtTime(0.08 - i * 0.02, t + i * 0.02 + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.02 + 0.15);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + i * 0.02);
        osc.stop(t + i * 0.02 + 0.2);
    });
};

const playMagic = () => {
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;
    for (let i = 0; i < 4; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        const baseFreq = 400 + i * 200;
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(baseFreq, t + i * 0.03);
        osc.frequency.linearRampToValueAtTime(baseFreq * 1.5, t + i * 0.03 + 0.2);
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(baseFreq * 2, t + i * 0.03);
        filter.Q.value = 3;
        gain.gain.setValueAtTime(0, t + i * 0.03);
        gain.gain.linearRampToValueAtTime(0.06, t + i * 0.03 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.03 + 0.3);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        if (reverbNode) gain.connect(reverbNode);
        osc.start(t + i * 0.03);
        osc.stop(t + i * 0.03 + 0.35);
    }
};

const playCombat = () => {
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;
    const impact = audioCtx.createOscillator();
    const impactGain = audioCtx.createGain();
    impact.type = 'sine';
    impact.frequency.setValueAtTime(150, t);
    impact.frequency.exponentialRampToValueAtTime(50, t + 0.1);
    impactGain.gain.setValueAtTime(0.2, t);
    impactGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    impact.connect(impactGain);
    impactGain.connect(masterGain);
    impact.start(t);
    impact.stop(t + 0.2);

    const crack = audioCtx.createOscillator();
    const crackGain = audioCtx.createGain();
    crack.type = 'sawtooth';
    crack.frequency.setValueAtTime(800, t);
    crack.frequency.exponentialRampToValueAtTime(200, t + 0.03);
    crackGain.gain.setValueAtTime(0.1, t);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    crack.connect(crackGain);
    crackGain.connect(masterGain);
    crack.start(t);
    crack.stop(t + 0.08);
};

const playToggle = () => {
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.setValueAtTime(1000, t + 0.03);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.005);
    gain.gain.setValueAtTime(0.08, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.1);
};

// ═══════════════════════════════════════════════════════════════
// INTERFACE PÚBLICA
// ═══════════════════════════════════════════════════════════════

export const playSFX = (type) => {
    if (!audioCtx) initAudio();
    if (!isSfxEnabled || !audioCtx) return;

    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
        if (audioCtx.state === 'suspended') return;
    }

    const isHacker = document.body.classList.contains('theme-hacker');

    try {
        switch (type) {
            case 'click':
                playClick(isHacker);
                break;
            case 'success':
                playSuccess();
                break;
            case 'error':
            case 'discard':
                playError();
                break;
            case 'dice':
                playDiceRoll();
                break;
            case 'critical':
                playCritical();
                break;
            case 'fumble':
                playFumble();
                break;
            case 'notification':
                playNotification();
                break;
            case 'save':
                playSave();
                break;
            case 'levelup':
                playLevelUp();
                break;
            case 'hover':
                playHover();
                break;
            case 'whoosh':
                playWhoosh();
                break;
            case 'coin':
                playCoin();
                break;
            case 'magic':
                playMagic();
                break;
            case 'combat':
                playCombat();
                break;
            case 'toggle':
                playToggle();
                break;
        }
    } catch (e) {
        // Silently ignore audio failures to avoid crashes
    }
};