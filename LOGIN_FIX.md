# 🔐 FIX: Não Consigo Logar

## Solução Rápida: Use Modo Offline

1. **Abra:** http://localhost:4173
2. **Na tela de login, clique em:** "MODO OFFLINE (Sem Sincronização)"
3. **Pronto!** Você pode testar todos os modais sem login

## Ou: Crie uma Conta de Teste

1. Abra http://localhost:4173
2. Clique em "Criar Conta"
3. Use um email de teste: `teste@teste.com`
4. Senha: `teste123456`
5. Username: `teste123`

## Se Ainda Não Funcionar:

### Limpe o LocalStorage:
1. Pressione F12 (Console)
2. Vá em "Application" → "Local Storage"
3. Clique com botão direito → "Clear"
4. Recarregue a página (Ctrl+F5)

### Ou via Console:
```javascript
localStorage.clear();
sessionStorage.clear();
location.reload();
```
