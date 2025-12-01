import { playSFX } from './audio.js';
import { calculateBaseStats } from './utils.js';

export const rpgLogic = {
    recalcDerivedStats() { 
        if(!this.char) return; 
        if(!this.char.stats) this.char.stats = {pv:{current:0,max:0}, pf:{current:0,max:0}, pdf:{current:0,max:0}};
        const newStats = calculateBaseStats(this.char.class, this.char.level, this.char.attrs); 
        const c = this.char;
        const safeStat = (stat, key) => (stat && stat[key] !== undefined) ? stat[key] : 0;
        const diffPv = (safeStat(c.stats.pv, 'max')||newStats.pv) - safeStat(c.stats.pv, 'current'); 
        const diffPf = (safeStat(c.stats.pf, 'max')||newStats.pf) - safeStat(c.stats.pf, 'current'); 
        const diffPdf = (safeStat(c.stats.pdf, 'max')||newStats.pdf) - safeStat(c.stats.pdf, 'current');
        c.stats.pv.max = newStats.pv; c.stats.pv.current = Math.max(0, newStats.pv-diffPv); 
        c.stats.pf.max = newStats.pf; c.stats.pf.current = Math.max(0, newStats.pf-diffPf); 
        c.stats.pdf.max = newStats.pdf; c.stats.pdf.current = Math.max(0, newStats.pdf-diffPdf);
    },
    modAttr(key, val) { 
        const c = this.char; 
        if(!c.attrs) c.attrs = {for:0, agi:0, int:0, von:0, pod:0};
        if ((val > 0 && c.attrs[key] < 6) || (val < 0 && c.attrs[key] > -1)) { c.attrs[key] += val; this.recalcDerivedStats(); this.updateRadarChart(); } 
    },
    modStat(stat, val) { if(!this.char || !this.char.stats[stat]) return; const s = this.char.stats[stat]; s.current = Math.max(0, Math.min(s.max, s.current + val)); },
    
    addItem(cat) { const defs = { weapons: { name: 'Arma', dmg: '1d6', range: 'C' }, armor: { name: 'Traje', def: '1', pen: '0' }, gear: { name: 'Item', desc: '', qty: 1 }, social_people: { name: 'Nome', role: 'Relação' }, social_objects: { name: 'Objeto', desc: 'Detalhes' } }; if(cat.startsWith('social_')) this.char.inventory.social[cat.split('_')[1]].push({...defs[cat]}); else this.char.inventory[cat].push({...defs[cat]}); },
    deleteItem(cat, i, sub=null) { if(sub) this.char.inventory.social[sub].splice(i,1); else this.char.inventory[cat].splice(i,1); },
    addSkill() { this.char.skills.push({name:'Nova Perícia', level:1}); }, 
    deleteSkill(idx) { this.char.skills.splice(idx,1); }, 
    setSkillLevel(idx, l) { this.char.skills[idx].level = l; },
    addTechnique() { this.char.powers.techniques.push({name:'Técnica', desc:''}); }, 
    deleteTechnique(idx) { this.char.powers.techniques.splice(idx,1); },
    roll(s) { playSFX('click'); const arr = new Uint32Array(1); window.crypto.getRandomValues(arr); const n = (arr[0] % s) + 1; const m = parseInt(this.diceMod || 0); this.lastNatural = n; this.lastFaces = s; this.lastRoll = n + m; let formulaStr = `D${s}`; if (m !== 0) formulaStr += (m > 0 ? `+${m}` : `${m}`); this.diceLog.unshift({id: Date.now(), time: new Date().toLocaleTimeString(), formula: formulaStr, result: n+m, crit: n===s, fumble: n===1, reason: this.diceReason}); this.diceReason = ''; if (this.isMobile && this.diceLog.length > 10) this.diceLog.pop(); else if (!this.isMobile && this.diceLog.length > 100) this.diceLog.pop(); }
};