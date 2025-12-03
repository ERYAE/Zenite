/**
 * ZENITE OS - Sistema de Áudio
 * Sons sutis estilo Sistema Operacional (macOS/Windows)
 * Evita sons "arcade" - foco em UX profissional
 */

let audioCtx = null;
let isSfxEnabled = true;

// Inicializa contexto de áudio (deve ser chamado após interação do usuário)
export const initAudio = () => {
    if (audioCtx) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    } catch (e) {
        console.warn("AudioContext bloqueado ou não suportado");
    }
};

export const setSfxEnabled = (enabled) => {
    isSfxEnabled = enabled;
    if (audioCtx) {
        if (enabled && audioCtx.state === 'suspended') audioCtx.resume();
        if (!enabled && audioCtx.state === 'running') audioCtx.suspend();
    }
};

/**
 * Som de clique suave - estilo tecla de teclado premium
 * Inspirado em: macOS keyboard feedback, mechanical keyboard "thock"
 */
const playClick = () => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    
    // Oscilador principal - frequência média-baixa
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.03);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, t);
    filter.Q.setValueAtTime(1, t);
    
    // Envelope rápido - 30ms total
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(t);
    osc.stop(t + 0.04);
};

/**
 * Som de salvamento - confirmação suave
 * Inspirado em: som de "done" do macOS, notificação Windows
 */
const playSave = () => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    
    // Acorde simples: duas notas em sequência rápida
    const playNote = (freq, delay, duration) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + delay);
        
        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(0.06, t + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + duration);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(t + delay);
        osc.stop(t + delay + duration);
    };
    
    // Duas notas: C5 (523Hz) -> E5 (659Hz) - intervalo de terça maior (alegre)
    playNote(523, 0, 0.12);
    playNote(659, 0.06, 0.15);
};

/**
 * Som de sucesso - confirmação positiva
 * Tom mais completo que o save, para ações importantes
 */
const playSuccess = () => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    
    const playChord = (freq, delay, duration) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + delay);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, t + delay);
        
        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(0.05, t + delay + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + duration);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(t + delay);
        osc.stop(t + delay + duration);
    };
    
    // Tríade maior ascendente: C -> E -> G
    playChord(523, 0, 0.15);
    playChord(659, 0.05, 0.15);
    playChord(784, 0.1, 0.2);
};

/**
 * Som de erro/alerta - feedback de problema
 * Dois tons descendentes sutis
 */
const playError = () => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    
    const playTone = (freq, delay, duration) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + delay);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.8, t + delay + duration);
        
        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(0.08, t + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + duration);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(t + delay);
        osc.stop(t + delay + duration);
    };
    
    // Duas notas descendentes: E4 -> C4 (terça menor, tom "triste")
    playTone(330, 0, 0.1);
    playTone(262, 0.08, 0.12);
};

/**
 * Som de descarte/cancelar - feedback de ação negativa
 */
const playDiscard = () => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    
    // Tom mais grave e curto
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(t);
    osc.stop(t + 0.12);
};

/**
 * Som de hover - feedback muito sutil (quase imperceptível)
 */
const playHover = () => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    
    // Volume muito baixo - apenas sensação tátil
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.015, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(t);
    osc.stop(t + 0.025);
};

/**
 * Som de rolagem de dados - especial para o RPG
 * Mais "divertido" mas ainda sutil
 */
const playDice = () => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    
    // Cria um som de "clack" como dado batendo na mesa
    const noise = audioCtx.createBufferSource();
    const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.05, audioCtx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    
    // Ruído branco filtrado
    for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseData.length * 0.1));
    }
    
    noise.buffer = noiseBuffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, t);
    filter.Q.setValueAtTime(2, t);
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    
    noise.start(t);
};

/**
 * Função principal de reprodução de SFX
 * @param {string} type - Tipo do som: 'click', 'save', 'success', 'error', 'discard', 'hover', 'dice'
 */
export const playSFX = (type) => {
    if (!audioCtx) initAudio();
    if (!isSfxEnabled || !audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    try {
        switch (type) {
            case 'click':
                playClick();
                break;
            case 'save':
                playSave();
                break;
            case 'success':
                playSuccess();
                break;
            case 'error':
                playError();
                break;
            case 'discard':
                playDiscard();
                break;
            case 'hover':
                playHover();
                break;
            case 'dice':
                playDice();
                break;
            default:
                playClick();
        }
    } catch (e) {
        // Silently fail to avoid console spam
    }
};
