# Ocorrências — EE Professora Malba Thereza Ferraz Campaner

Sistema de Registro de Ocorrências com **notificações em tempo real**, **chat entre usuários**, **autenticação com senha** e **banco de dados persistente**.

**Protocolo 179 · CONVIVA SP · SEDUC SP**

---

## Tecnologias

- **Backend:** Node.js + Express + WebSocket
- **Banco:** SQLite (arquivo local, sem servidor separado)
- **Autenticação:** bcrypt + JWT (expira em 8h — um turno escolar)
- **Frontend:** HTML5 + CSS3 + JavaScript puro (sem frameworks)

---

## Primeiro uso (local ou servidor)

```bash
# 1. Instalar dependências
npm install

# 2. Criar os usuários no banco com senha padrão
npm run seed

# 3. Iniciar o servidor
npm start
```

Acesse: **http://localhost:3000**

**Senha padrão de todos os usuários: `Malba@2025`**
Cada usuário deve trocar sua senha no primeiro acesso (botão 🔑 Senha no topo).

---

## Deploy no Railway

1. Suba o projeto no GitHub
2. Acesse https://railway.app → New Project → Deploy from GitHub
3. Selecione o repositório
4. Adicione a variável de ambiente:
   - `JWT_SECRET` → uma senha longa e aleatória (ex: `malba2025xPq9#mR`)
5. Após o deploy, abra o terminal do Railway e rode:
   ```
   npm run seed
   ```

---

## Variáveis de ambiente

| Variável | Descrição | Padrão |
|---|---|---|
| `PORT` | Porta do servidor | 3000 |
| `JWT_SECRET` | Chave secreta JWT | valor fixo (mude em produção!) |

---

## Estrutura

```
/
├── server/
│   ├── index.js    ← Servidor Express + WebSocket + rotas
│   ├── db.js       ← Banco SQLite (tabelas + queries)
│   └── seed.js     ← Cria usuários iniciais
├── public/
│   ├── index.html  ← SPA
│   ├── css/app.css
│   ├── js/
│   │   ├── app.js   ← Lógica principal
│   │   ├── auth.js  ← Gerencia JWT no navegador
│   │   ├── ws.js    ← Cliente WebSocket
│   │   ├── notif.js ← Notificações pop-up
│   │   └── chat.js  ← Chat por ocorrência
│   └── assets/
│       ├── logo_sp.png
│       └── turmas.json
└── package.json
```

---

## Funcionalidades de segurança

- Senhas armazenadas com **bcrypt** (hash irreversível)
- **JWT** com expiração de 8h — o sistema desloga automaticamente
- Todas as rotas da API exigem autenticação
- Ações de gestão (complementar, editar) verificam perfil no servidor
- Diretor pode **resetar senha** e **ativar/desativar** usuários

---

**EE Professora Malba Thereza Ferraz Campaner**
Unidade Regional de Ensino de São José dos Campos · SEDUC SP
