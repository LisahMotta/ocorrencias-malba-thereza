# Ocorrências — EE Professora Malba Thereza Ferraz Campaner

Sistema de Registro de Ocorrências Escolares com notificações em tempo real e chat entre usuários.
**Protocolo 179 · CONVIVA SP · SEDUC SP**

---

## Tecnologias

- **Backend:** Node.js + Express + WebSocket (ws)
- **Frontend:** HTML5 + CSS3 + JavaScript ES Modules (sem frameworks)
- **Comunicação em tempo real:** WebSocket nativo
- **Banco de dados:** Em memória (desenvolvimento) → substituir por PostgreSQL/SQLite em produção

---

## Instalação local

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar em desenvolvimento (com auto-reload)
npm run dev

# 3. Iniciar em produção
npm start
```

Acesse: **http://localhost:3000**

---

## Deploy em produção

### Opção 1 — VPS / Servidor próprio (recomendado para SEDUC)

```bash
# Instalar Node.js 18+ no servidor
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clonar / enviar os arquivos para o servidor
# Instalar PM2 para manter o processo rodando
npm install -g pm2

# Iniciar com PM2
pm2 start server/index.js --name "ocorrencias-malba"
pm2 save
pm2 startup
```

### Opção 2 — Railway.app (gratuito para projetos pequenos)

1. Crie uma conta em https://railway.app
2. Conecte seu repositório GitHub
3. O Railway detecta automaticamente o Node.js e faz o deploy
4. Configure a variável de ambiente `PORT` (o Railway define automaticamente)

### Opção 3 — Render.com

1. Crie uma conta em https://render.com
2. New Web Service → conecte o repositório
3. Build Command: `npm install`
4. Start Command: `npm start`

---

## Banco de dados em produção

O estado atual é **em memória** — os dados são perdidos ao reiniciar o servidor.

Para persistência real, adicione PostgreSQL ou SQLite:

```bash
# SQLite (mais simples, sem servidor separado)
npm install better-sqlite3

# PostgreSQL
npm install pg
```

Edite `server/index.js` e substitua o objeto `state` pelas queries de banco.

---

## Variáveis de ambiente

Crie um arquivo `.env` na raiz:

```
PORT=3000
NODE_ENV=production
```

---

## Estrutura do projeto

```
/
├── server/
│   └── index.js          ← Servidor Express + WebSocket
├── public/
│   ├── index.html         ← SPA principal
│   ├── css/
│   │   └── app.css        ← Estilos
│   ├── js/
│   │   ├── app.js         ← Lógica principal
│   │   ├── ws.js          ← Cliente WebSocket
│   │   ├── notif.js       ← Notificações pop-up
│   │   └── chat.js        ← Componente de chat
│   └── assets/
│       ├── logo_sp.png    ← Logo SP Governo do Estado
│       └── turmas.json    ← Dados das turmas e alunos
├── package.json
└── README.md
```

---

## Funcionalidades

### Notificações em tempo real
- Quando um professor registra uma ocorrência, **todos os gestores logados** recebem uma notificação pop-up imediatamente
- A notificação inclui: tipo (Art.), gravidade, turma, aluno(s) e nome do professor
- Suporte a notificações do sistema operacional (requer permissão do navegador)
- Som de alerta ao receber notificação

### Chat por ocorrência
- Cada ocorrência tem seu próprio canal de chat
- **Apenas P.O.C., Coordenador, Vice-Diretor e Diretor** podem enviar mensagens
- Professores podem **visualizar** as orientações recebidas
- Badge de mensagens não lidas nos cards
- Histórico de mensagens sincronizado entre todos os usuários conectados

### Permissões por perfil
| Funcionalidade | Professor | P.O.C. | Coordenador | Vice | Diretor |
|---|---|---|---|---|---|
| Registrar (Bloco II) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Registrar (Bloco I) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Enviar mensagem no chat | ❌ | ✅ | ✅ | ✅ | ✅ |
| Ver chat | ✅ | ✅ | ✅ | ✅ | ✅ |
| Receber notificação | ❌ | ✅ | ✅ | ✅ | ✅ |
| Complementar ocorrência | ❌ | ✅ | ✅ | ✅ | ✅ |
| Gerar documento PDF | ❌ | ✅ | ✅ | ✅ | ✅ |
| Relatórios | ❌ | ❌ | ✅ | ✅ | ✅ |
| Gestão de usuários | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Próximos passos sugeridos

- [ ] Autenticação com senha real (bcrypt + JWT ou sessão)
- [ ] Banco de dados persistente (PostgreSQL / SQLite)
- [ ] Integração com LDAP/AD da SEDUC para login
- [ ] Exportação de relatórios em XLSX/PDF
- [ ] Envio de e-mail/WhatsApp ao registrar ocorrência urgente
- [ ] Histórico de edições de cada ocorrência (auditoria)
- [ ] Upload de fotos/evidências vinculadas à ocorrência

---

**EE Professora Malba Thereza Ferraz Campaner**  
Unidade Regional de Ensino de São José dos Campos · SEDUC SP
