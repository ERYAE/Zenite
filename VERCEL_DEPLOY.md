# Configuração de Deploy no Vercel

## Variáveis de Ambiente Obrigatórias

No Vercel Dashboard → Settings → Environment Variables, adicione:

| Nome | Valor | Ambientes |
|------|-------|-----------|
| `VITE_SUPABASE_URL` | `https://pwjoakajtygmbpezcrix.supabase.co` | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_ULe02tKpa38keGvz8bEDIw_mJJaBK6j` | Production, Preview, Development |

**IMPORTANTE:** Marque as 3 checkboxes (Production, Preview, Development) para cada variável.

## Configuração do Projeto

O `vercel.json` já está configurado:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

## Troubleshooting

### Erro 126 - Command exited with 126
- **Causa:** Problema de permissões ou cache do Vercel
- **Solução:** 
  1. Vá em Deployments → ... (três pontos) → Redeploy
  2. Marque "Clear cache and redeploy"

### Erro "supabaseUrl is required"
- **Causa:** Variáveis de ambiente não configuradas ou não marcadas para o ambiente correto
- **Solução:** Verifique que as variáveis estão marcadas para Production/Preview/Development

### Build funciona local mas falha no Vercel
- Certifique-se que `package-lock.json` está commitado
- Limpe o cache do Vercel (Redeploy → Clear cache)
- Verifique os logs de build no Vercel para erros específicos
