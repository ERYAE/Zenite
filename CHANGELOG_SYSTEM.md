# 📋 SISTEMA DE CHANGELOG VERSIONADO

## 🎯 Como Funciona

O sistema de changelog agora usa **versionamento** para controlar quando mostrar atualizações aos usuários.

### Fluxo Automático:
1. Você incrementa o número em `changelog.version.js`
2. Cada usuário logado vê o modal **UMA VEZ** automaticamente
3. Badge "NEW" aparece no menu até o usuário visualizar
4. Após fechar o modal, fica marcado como visto para aquela conta
5. Sistema salva por `user.id` no localStorage

---

## 📝 Como Adicionar Nova Atualização

### Passo 1: Incrementar Versão
Edite `changelog.version.js`:
```javascript
export const CHANGELOG_VERSION = 3; // Era 2, agora é 3
```

### Passo 2: Adicionar Conteúdo
Edite `js/modules/changelog.js` e adicione no **TOPO** do array:
```javascript
export const CHANGELOG = [
    // ───────────────────────────────────────────────────────────────────
    // NOVA ATUALIZAÇÃO - Descrição Curta
    // ───────────────────────────────────────────────────────────────────
    {
        title: 'NOME DA ATUALIZAÇÃO',
        emoji: '🚀',
        isNew: true,
        sections: [
            {
                title: 'Categoria',
                icon: 'fa-sparkles',
                color: 'cyan',
                items: [
                    {
                        title: 'Feature Nome',
                        description: 'Descrição curta',
                        details: [
                            'Detalhe 1',
                            'Detalhe 2'
                        ]
                    }
                ]
            }
        ]
    },
    // ... updates anteriores
];
```

### Passo 3: Pronto!
- Modal abre automaticamente para todos os usuários logados
- Badge "NEW" aparece no menu
- Cada usuário vê apenas UMA VEZ

---

## 🔧 Arquivos do Sistema

| Arquivo | Função |
|---------|--------|
| `changelog.version.js` | Número da versão atual |
| `js/modules/changelog.js` | Conteúdo e lógica do changelog |
| `js/app.js` | Verificação e controle do modal |
| `index.html` | Modal e badge "NEW" |

---

## 💾 Armazenamento

### Por Usuário Logado:
```
localStorage: zenite_changelog_seen_<user.id> = "2"
```

### Guest/Não Logado (fallback):
```
localStorage: zenite_last_seen_update = "NOME_UPDATE"
```

---

## 🎨 Cores Disponíveis

Para `color` nas sections:
- `cyan` - Azul ciano (padrão)
- `purple` - Roxo
- `pink` - Rosa
- `green` - Verde
- `yellow` - Amarelo
- `red` - Vermelho

---

## ✅ Checklist para Nova Atualização

- [ ] Incrementar `CHANGELOG_VERSION` em `changelog.version.js`
- [ ] Adicionar novo update no TOPO de `CHANGELOG` em `js/modules/changelog.js`
- [ ] Definir `isNew: true` no novo update
- [ ] Testar localmente (limpar localStorage se necessário)
- [ ] Fazer commit e deploy

---

## 🧪 Como Testar

### Simular Novo Update:
1. Abra DevTools → Application → Local Storage
2. Delete a chave `zenite_changelog_seen_<seu_user_id>`
3. Recarregue a página
4. Modal deve abrir automaticamente

### Verificar Badge:
1. Feche o modal
2. Badge "NEW" deve desaparecer
3. Abra o menu de usuário
4. Badge não deve mais aparecer

---

## 📊 Exemplo Completo

```javascript
// changelog.version.js
export const CHANGELOG_VERSION = 3;

// js/modules/changelog.js
export const CHANGELOG = [
    {
        title: 'PERFORMANCE BOOST',
        emoji: '⚡',
        isNew: true,
        sections: [
            {
                title: 'Otimizações',
                icon: 'fa-bolt',
                color: 'yellow',
                items: [
                    {
                        title: 'Carregamento 50% Mais Rápido',
                        description: 'Sistema de lazy loading implementado',
                        details: [
                            'Componentes carregam sob demanda',
                            'Redução de 2MB no bundle inicial',
                            'Melhoria no First Contentful Paint'
                        ]
                    }
                ]
            }
        ]
    },
    // ... updates anteriores
];
```

---

## 🚨 Importante

1. **Sempre incremente a versão** quando adicionar novo conteúdo
2. **Adicione no TOPO** do array (ordem cronológica reversa)
3. **Não delete updates antigos** (histórico completo)
4. **Use `isNew: true`** apenas no update mais recente
5. **Teste antes de fazer deploy**

---

**Sistema implementado em:** 11 de Dezembro de 2025  
**Versão atual:** 2
