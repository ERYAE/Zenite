import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente baseado no mode
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    server: {
      port: 3000,
      open: true
    },
    build: {
      outDir: 'dist',
    },
    // Define variáveis que serão substituídas no build
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY)
    }
  };
});
