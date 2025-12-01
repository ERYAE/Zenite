import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export const CONSTANTS = {
    MAX_AGENTS: 30,
    SAVE_INTERVAL: 180000, 
    TOAST_DURATION: 3000,
    // Suas chaves (em produção, use variáveis de ambiente)
    SUPABASE_URL: 'https://pwjoakajtygmbpezcrix.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3am9ha2FqdHlnbWJwZXpjcml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNTA4OTQsImV4cCI6MjA3OTcyNjg5NH0.92HNNPCaKccRLIV6HbP1CBFI7jL5ktt24Qh1tr-Md5E'
};

export const supabase = typeof window.supabase !== 'undefined' 
    ? window.supabase.createClient(CONSTANTS.SUPABASE_URL, CONSTANTS.SUPABASE_KEY)
    : createClient(CONSTANTS.SUPABASE_URL, CONSTANTS.SUPABASE_KEY);