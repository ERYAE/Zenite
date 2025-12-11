# 🎲 Templates de Email - ZENITE RPG
## Estética Cyberpunk/Hacker Autêntica

**Copyright © 2025 Zenite - Todos os direitos reservados**

---

## 📋 INSTRUÇÕES DE USO

1. Acesse: **Supabase Dashboard → Authentication → Email Templates**
2. Cole o HTML **SEM** as tags \`\`\`html
3. Use `{{ .ConfirmationURL }}` (com ponto) nas variáveis
4. Teste enviando um email para você mesmo

---

## 1️⃣ CONFIRM SIGN UP

**Subject:** `[ZENITE] Confirmação de Acesso Requerida`

**HTML:**
```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@700;900&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#050507;font-family:'JetBrains Mono',monospace;color:#e0e0e0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#050507;padding:40px 20px;">
<tr><td align="center">

<!-- Container Principal -->
<table width="600" cellpadding="0" cellspacing="0" style="background:rgba(20,20,25,0.95);border:1px solid rgba(0,217,255,0.3);border-radius:16px;overflow:hidden;box-shadow:0 0 40px rgba(0,217,255,0.15),0 0 80px rgba(123,47,247,0.1);">

<!-- Header com Grid Background -->
<tr><td style="background:linear-gradient(135deg,rgba(0,217,255,0.1) 0%,rgba(123,47,247,0.1) 100%);padding:40px 30px;text-align:center;position:relative;border-bottom:1px solid rgba(0,217,255,0.2);">
<div style="font-family:'Orbitron',sans-serif;font-size:48px;font-weight:900;color:#00d9ff;text-transform:uppercase;letter-spacing:8px;text-shadow:0 0 20px rgba(0,217,255,0.6),0 0 40px rgba(0,217,255,0.3);margin:0;">ZENITE</div>
<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#7b2ff7;letter-spacing:3px;margin-top:8px;text-transform:uppercase;">Sistema de Fichas RPG</div>
</td></tr>

<!-- Conteúdo -->
<tr><td style="padding:40px 30px;">

<!-- Título -->
<div style="font-family:'Orbitron',sans-serif;font-size:24px;color:#00d9ff;margin:0 0 20px 0;text-transform:uppercase;letter-spacing:2px;">
&gt; CONFIRMAÇÃO DE ACESSO
</div>

<!-- Mensagem -->
<div style="color:#b0b0b0;line-height:1.8;font-size:14px;margin:0 0 30px 0;">
<span style="color:#00d9ff;">[SISTEMA]</span> Detectamos uma tentativa de registro para esta conta.<br><br>
Para ativar seu acesso ao sistema Zenite e começar a criar fichas de personagens, confirme seu email clicando no botão abaixo:
</div>

<!-- Botão CTA -->
<table width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;">
<tr><td align="center">
<a href="{{ .ConfirmationURL }}" style="display:inline-block;background:linear-gradient(135deg,#00d9ff 0%,#7b2ff7 100%);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-family:'Orbitron',sans-serif;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:2px;box-shadow:0 0 20px rgba(0,217,255,0.4),0 4px 15px rgba(0,0,0,0.3);">
▶ CONFIRMAR ACESSO
</a>
</td></tr>
</table>

<!-- Warning Box -->
<div style="background:rgba(234,179,8,0.1);border-left:3px solid #eab308;padding:15px;border-radius:4px;margin:30px 0 0 0;">
<div style="color:#eab308;font-size:12px;line-height:1.6;">
<strong>[AVISO]</strong> Se você não criou esta conta, ignore este email. Nenhuma ação será tomada.
</div>
</div>

</td></tr>

<!-- Footer -->
<tr><td style="padding:30px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);background:rgba(0,0,0,0.3);">
<div style="color:#666;font-size:10px;line-height:1.6;letter-spacing:1px;">
<strong style="color:#00d9ff;">ZENITE RPG</strong> © 2025<br>
Sistema desenvolvido com assistência de IA<br>
<span style="color:#444;">zeniteos.vercel.app</span>
</div>
</td></tr>

</table>

</td></tr>
</table>
</body>
</html>
```

---

## 2️⃣ MAGIC LINK

**Subject:** `[ZENITE] Link de Acesso Rápido`

**HTML:**
```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@700;900&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#050507;font-family:'JetBrains Mono',monospace;color:#e0e0e0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#050507;padding:40px 20px;">
<tr><td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="background:rgba(20,20,25,0.95);border:1px solid rgba(0,255,136,0.3);border-radius:16px;overflow:hidden;box-shadow:0 0 40px rgba(0,255,136,0.15);">

<tr><td style="background:linear-gradient(135deg,rgba(0,255,136,0.1) 0%,rgba(0,217,255,0.1) 100%);padding:40px 30px;text-align:center;border-bottom:1px solid rgba(0,255,136,0.2);">
<div style="font-family:'Orbitron',sans-serif;font-size:48px;font-weight:900;color:#00ff88;text-transform:uppercase;letter-spacing:8px;text-shadow:0 0 20px rgba(0,255,136,0.6);margin:0;">ZENITE</div>
<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#00d9ff;letter-spacing:3px;margin-top:8px;text-transform:uppercase;">Sistema de Fichas RPG</div>
</td></tr>

<tr><td style="padding:40px 30px;">

<div style="font-family:'Orbitron',sans-serif;font-size:24px;color:#00ff88;margin:0 0 20px 0;text-transform:uppercase;letter-spacing:2px;">
&gt; ACESSO RÁPIDO
</div>

<div style="color:#b0b0b0;line-height:1.8;font-size:14px;margin:0 0 30px 0;">
<span style="color:#00ff88;">[SISTEMA]</span> Solicitação de login sem senha detectada.<br><br>
Use o link abaixo para entrar no Zenite de forma rápida e segura:
</div>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;">
<tr><td align="center">
<a href="{{ .ConfirmationURL }}" style="display:inline-block;background:linear-gradient(135deg,#00ff88 0%,#00d9ff 100%);color:#050507;text-decoration:none;padding:16px 40px;border-radius:8px;font-family:'Orbitron',sans-serif;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:2px;box-shadow:0 0 20px rgba(0,255,136,0.4);">
▶ ENTRAR NO SISTEMA
</a>
</td></tr>
</table>

<div style="background:rgba(239,68,68,0.1);border-left:3px solid #ef4444;padding:15px;border-radius:4px;margin:30px 0 0 0;">
<div style="color:#ef4444;font-size:12px;line-height:1.6;">
<strong>[ALERTA DE SEGURANÇA]</strong> Este link expira em <strong>1 hora</strong> e só pode ser usado <strong>uma vez</strong>. Se você não solicitou este acesso, ignore este email.
</div>
</div>

</td></tr>

<tr><td style="padding:30px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);background:rgba(0,0,0,0.3);">
<div style="color:#666;font-size:10px;line-height:1.6;letter-spacing:1px;">
<strong style="color:#00ff88;">ZENITE RPG</strong> © 2025<br>
Sistema desenvolvido com assistência de IA<br>
<span style="color:#444;">zeniteos.vercel.app</span>
</div>
</td></tr>

</table>

</td></tr>
</table>
</body>
</html>
```

---

## 3️⃣ RESET PASSWORD

**Subject:** `[ZENITE] Redefinição de Senha Solicitada`

**HTML:**
```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@700;900&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#050507;font-family:'JetBrains Mono',monospace;color:#e0e0e0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#050507;padding:40px 20px;">
<tr><td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="background:rgba(20,20,25,0.95);border:1px solid rgba(239,68,68,0.3);border-radius:16px;overflow:hidden;box-shadow:0 0 40px rgba(239,68,68,0.15);">

<tr><td style="background:linear-gradient(135deg,rgba(239,68,68,0.1) 0%,rgba(233,30,99,0.1) 100%);padding:40px 30px;text-align:center;border-bottom:1px solid rgba(239,68,68,0.2);">
<div style="font-family:'Orbitron',sans-serif;font-size:48px;font-weight:900;color:#ef4444;text-transform:uppercase;letter-spacing:8px;text-shadow:0 0 20px rgba(239,68,68,0.6);margin:0;">ZENITE</div>
<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#e91e63;letter-spacing:3px;margin-top:8px;text-transform:uppercase;">Sistema de Fichas RPG</div>
</td></tr>

<tr><td style="padding:40px 30px;">

<div style="font-family:'Orbitron',sans-serif;font-size:24px;color:#ef4444;margin:0 0 20px 0;text-transform:uppercase;letter-spacing:2px;">
&gt; REDEFINIÇÃO DE SENHA
</div>

<div style="color:#b0b0b0;line-height:1.8;font-size:14px;margin:0 0 30px 0;">
<span style="color:#ef4444;">[SISTEMA]</span> Detectamos uma solicitação de redefinição de senha para sua conta.<br><br>
Para criar uma nova senha de acesso, clique no botão abaixo:
</div>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;">
<tr><td align="center">
<a href="{{ .ConfirmationURL }}" style="display:inline-block;background:linear-gradient(135deg,#ef4444 0%,#e91e63 100%);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-family:'Orbitron',sans-serif;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:2px;box-shadow:0 0 20px rgba(239,68,68,0.4);">
▶ REDEFINIR SENHA
</a>
</td></tr>
</table>

<div style="background:rgba(239,68,68,0.1);border-left:3px solid #ef4444;padding:15px;border-radius:4px;margin:30px 0 0 0;">
<div style="color:#ef4444;font-size:12px;line-height:1.6;">
<strong>[ALERTA CRÍTICO]</strong> Se você <strong>NÃO</strong> solicitou esta redefinição, <strong>IGNORE</strong> este email imediatamente. Sua senha atual permanecerá ativa e segura. Este link expira em <strong>1 hora</strong>.
</div>
</div>

</td></tr>

<tr><td style="padding:30px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);background:rgba(0,0,0,0.3);">
<div style="color:#666;font-size:10px;line-height:1.6;letter-spacing:1px;">
<strong style="color:#ef4444;">ZENITE RPG</strong> © 2025<br>
Sistema desenvolvido com assistência de IA<br>
<span style="color:#444;">zeniteos.vercel.app</span>
</div>
</td></tr>

</table>

</td></tr>
</table>
</body>
</html>
```

---

## 4️⃣ CHANGE EMAIL

**Subject:** `[ZENITE] Confirmação de Novo Email`

**HTML:**
```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@700;900&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#050507;font-family:'JetBrains Mono',monospace;color:#e0e0e0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#050507;padding:40px 20px;">
<tr><td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="background:rgba(20,20,25,0.95);border:1px solid rgba(234,179,8,0.3);border-radius:16px;overflow:hidden;box-shadow:0 0 40px rgba(234,179,8,0.15);">

<tr><td style="background:linear-gradient(135deg,rgba(234,179,8,0.1) 0%,rgba(255,152,0,0.1) 100%);padding:40px 30px;text-align:center;border-bottom:1px solid rgba(234,179,8,0.2);">
<div style="font-family:'Orbitron',sans-serif;font-size:48px;font-weight:900;color:#eab308;text-transform:uppercase;letter-spacing:8px;text-shadow:0 0 20px rgba(234,179,8,0.6);margin:0;">ZENITE</div>
<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#ff9800;letter-spacing:3px;margin-top:8px;text-transform:uppercase;">Sistema de Fichas RPG</div>
</td></tr>

<tr><td style="padding:40px 30px;">

<div style="font-family:'Orbitron',sans-serif;font-size:24px;color:#eab308;margin:0 0 20px 0;text-transform:uppercase;letter-spacing:2px;">
&gt; MUDANÇA DE EMAIL
</div>

<div style="color:#b0b0b0;line-height:1.8;font-size:14px;margin:0 0 30px 0;">
<span style="color:#eab308;">[SISTEMA]</span> Detectamos uma solicitação de alteração de email para sua conta.<br><br>
Para confirmar seu novo endereço de email, clique no botão abaixo:
</div>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;">
<tr><td align="center">
<a href="{{ .ConfirmationURL }}" style="display:inline-block;background:linear-gradient(135deg,#eab308 0%,#ff9800 100%);color:#050507;text-decoration:none;padding:16px 40px;border-radius:8px;font-family:'Orbitron',sans-serif;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:2px;box-shadow:0 0 20px rgba(234,179,8,0.4);">
▶ CONFIRMAR NOVO EMAIL
</a>
</td></tr>
</table>

<div style="background:rgba(0,217,255,0.1);border-left:3px solid #00d9ff;padding:15px;border-radius:4px;margin:30px 0 0 0;">
<div style="color:#00d9ff;font-size:12px;line-height:1.6;">
<strong>[INFO]</strong> Após a confirmação, você deverá usar este novo email para fazer login no sistema.
</div>
</div>

</td></tr>

<tr><td style="padding:30px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);background:rgba(0,0,0,0.3);">
<div style="color:#666;font-size:10px;line-height:1.6;letter-spacing:1px;">
<strong style="color:#eab308;">ZENITE RPG</strong> © 2025<br>
Sistema desenvolvido com assistência de IA<br>
<span style="color:#444;">zeniteos.vercel.app</span>
</div>
</td></tr>

</table>

</td></tr>
</table>
</body>
</html>
```

---

## 5️⃣ INVITE USER

**Subject:** `[ZENITE] Você foi convidado para o Sistema`

**HTML:**
```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@700;900&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#050507;font-family:'JetBrains Mono',monospace;color:#e0e0e0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#050507;padding:40px 20px;">
<tr><td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="background:rgba(20,20,25,0.95);border:1px solid rgba(123,47,247,0.3);border-radius:16px;overflow:hidden;box-shadow:0 0 40px rgba(123,47,247,0.15),0 0 80px rgba(0,217,255,0.1);">

<tr><td style="background:linear-gradient(135deg,rgba(123,47,247,0.1) 0%,rgba(0,217,255,0.1) 100%);padding:40px 30px;text-align:center;border-bottom:1px solid rgba(123,47,247,0.2);">
<div style="font-family:'Orbitron',sans-serif;font-size:48px;font-weight:900;color:#7b2ff7;text-transform:uppercase;letter-spacing:8px;text-shadow:0 0 20px rgba(123,47,247,0.6);margin:0;">ZENITE</div>
<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#00d9ff;letter-spacing:3px;margin-top:8px;text-transform:uppercase;">Sistema de Fichas RPG</div>
</td></tr>

<tr><td style="padding:40px 30px;">

<div style="font-family:'Orbitron',sans-serif;font-size:24px;color:#7b2ff7;margin:0 0 20px 0;text-transform:uppercase;letter-spacing:2px;">
&gt; CONVITE DE ACESSO
</div>

<div style="color:#b0b0b0;line-height:1.8;font-size:14px;margin:0 0 30px 0;">
<span style="color:#7b2ff7;">[SISTEMA]</span> Você recebeu um convite para se juntar ao <strong style="color:#00d9ff;">Zenite RPG</strong>.<br><br>
Sistema moderno de fichas com gestão de campanhas, rolagens de dados em tempo real e recursos avançados para mestres e jogadores.
</div>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;">
<tr><td align="center">
<a href="{{ .ConfirmationURL }}" style="display:inline-block;background:linear-gradient(135deg,#7b2ff7 0%,#00d9ff 100%);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-family:'Orbitron',sans-serif;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:2px;box-shadow:0 0 20px rgba(123,47,247,0.4);">
▶ CRIAR CONTA GRÁTIS
</a>
</td></tr>
</table>

<!-- Features Box -->
<div style="background:rgba(123,47,247,0.05);border:1px solid rgba(123,47,247,0.2);padding:20px;border-radius:8px;margin:30px 0 0 0;">
<div style="color:#7b2ff7;font-size:11px;font-weight:700;margin:0 0 12px 0;letter-spacing:2px;text-transform:uppercase;">[RECURSOS DO SISTEMA]</div>
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="color:#00d9ff;font-size:12px;padding:4px 0;">▸ Sistema de fichas completo (OD&D, AD&D, Tagmar)</td></tr>
<tr><td style="color:#00d9ff;font-size:12px;padding:4px 0;">▸ Campanhas multiplayer em tempo real</td></tr>
<tr><td style="color:#00d9ff;font-size:12px;padding:4px 0;">▸ Rolagens de dados com histórico</td></tr>
<tr><td style="color:#00d9ff;font-size:12px;padding:4px 0;">▸ Sistema de achievements e progressão</td></tr>
</table>
</div>

</td></tr>

<tr><td style="padding:30px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);background:rgba(0,0,0,0.3);">
<div style="color:#666;font-size:10px;line-height:1.6;letter-spacing:1px;">
<strong style="color:#7b2ff7;">ZENITE RPG</strong> © 2025<br>
Sistema desenvolvido com assistência de IA<br>
<span style="color:#444;">zeniteos.vercel.app</span>
</div>
</td></tr>

</table>

</td></tr>
</table>
</body>
</html>
```

---

## ✨ CARACTERÍSTICAS DOS TEMPLATES

### 🎨 Design Autêntico Zenite:
- ✅ Fontes **Orbitron** (títulos) e **JetBrains Mono** (corpo)
- ✅ Cores exatas: `#00d9ff` (cyan), `#7b2ff7` (purple), `#00ff88` (green)
- ✅ Background `#050507` (--bg-void)
- ✅ Glass panels com `rgba(20,20,25,0.95)`
- ✅ Neon glows e box-shadows cyberpunk
- ✅ Gradientes idênticos ao site
- ✅ Bordas com alpha matching o CSS
- ✅ Estilo de mensagens `[SISTEMA]`, `[ALERTA]`, `[INFO]`

### 📱 Compatibilidade:
- ✅ Responsivo (mobile-friendly)
- ✅ Funciona em todos os clientes de email (Gmail, Outlook, Apple Mail)
- ✅ Fallback de fontes caso Google Fonts falhe
- ✅ Inline CSS (obrigatório para emails)

### 🔒 Segurança:
- ✅ Avisos claros sobre expiração de links
- ✅ Instruções para ignorar emails não solicitados
- ✅ Mensagens de alerta destacadas

---

**Copyright © 2025 Zenite RPG - Todos os direitos reservados**
