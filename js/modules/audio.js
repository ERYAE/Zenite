/**
 * ZENITE AUDIO ENGINE v2.0
 * Sistema de som procedural para UI satisfatória
 * 
 * Sons projetados para serem agradáveis e não intrusivos.
 * O usuário vai QUERER deixar ativado!
 */

let audioCtx = null;
let isSfxEnabled = true;
let masterGain = null;

export const initAudio = () => {
    if (audioCtx) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        
        // Master gain para controle de volume global
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.6; // Volume master (60%)
        masterGain.connect(audioCtx.destination);
    } catch (e) {
        console.warn("[AUDIO] AudioContext não suportado");
    }
};

export const setSfxEnabled = (enabled) => {
    isSfxEnabled = enabled;
    if (audioCtx) {
        if (enabled && audioCtx.state === 'suspended') audioCtx.resume();
        if (!enabled && audioCtx.state === 'running') audioCtx.suspend();
    }
};

// ═══════════════════════════════════════════════════════════════
// SONS INDIVIDUAIS - Cada um otimizado para ser satisfatório
// ═══════════════════════════════════════════════════════════════

/**
 * Som de clique - Estilo "glass tap" premium
 * Inspirado em teclados mecânicos de alta qualidade
 */
const playClick = (isHacker) => {
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;
    
    // Camada 1: Attack percussivo (o "tap")
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    const filter1 = audioCtx.createBiquadFilter();
    
    if (!isHacker) {
        // Som cristalino e suave
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
        // Som glitchy retro
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
    
    // Camada 2: Corpo do som (o "thock")
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

/**
 * Som de sucesso - Acorde ascendente gratificante
 * Dois tons harmônicos que criam sensação de "conquista"
 */
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
    
    // Acorde C-E-G ascendente (sensação positiva)
    playNote(523.25, 0, 0.2);      // C5
    playNote(659.25, 0.08, 0.25);  // E5
    playNote(783.99, 0.16, 0.3);   // G5
};

/**
 * Som de erro - Suave mas informativo
 * Não irritante, apenas indicativo
 */
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

/**
 * Som de dado rolando - Múltiplos "ticks" simulando o rolar
 */
const playDiceRoll = () => {
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;
    
    const rollCount = 6 + Math.floor(Math.random() * 4); // 6-9 ticks
    
    for (let i = 0; i < rollCount; i++) {
        const delay = i * 0.04 + Math.random() * 0.02;
        const freq = 800 + Math.random() * 400;
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + delay);
        osc.frequency.exponentialRampToValueAtTime(200, t + delay + 0.02);
        
        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(0.06 - (i * 0.005), t + delay + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.03);
        
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + delay);
        osc.stop(t + delay + 0.05);
    }
    
    // Som final do dado parando (mais forte)
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

/**
 * Som de crítico - Épico e memorável!
 */
const playCritical = () => {
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;
    
    // Fanfarra ascendente
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    
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

/**
 * Som de fumble - Tom descendente triste
 */
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

/**
 * Som de notificação - Ping suave e agradável
 */
const playNotification = () => {
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1174.66, t + 0.1); // D6
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.01);
    gain.gain.setValueAtTime(0.08, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.3);
};

/**
 * Som de salvar - Confirmação suave
 */
const playSave = () => {
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.linearRampToValueAtTime(800, t + 0.1);
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
};

// ═══════════════════════════════════════════════════════════════
// INTERFACE PÚBLICA
// ═══════════════════════════════════════════════════════════════

export const playSFX = (type) => {
    if (!audioCtx) initAudio();
    if (!isSfxEnabled || !audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
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
        }
    } catch (e) {
        // Silently fail
    }
};