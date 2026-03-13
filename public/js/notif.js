// notif.js — gerencia notificações pop-up na tela

const GL = { urgencia:'URGÊNCIA/EMERGÊNCIA', grave:'Grave', media:'Média', leve:'Leve', administrativa:'Administrativa' };

let container = null;

function getContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'notif-popup';
    document.body.appendChild(container);
  }
  return container;
}

// Mostra notificação pop-up de nova ocorrência
// onChat(occId) → callback chamado ao clicar em "Abrir Chat"
export function mostrarNotifOcorrencia(occ, usuarioAtual, onChat) {
  const perfisGestao = ['poc','coordenador','vice','diretor'];
  if (!perfisGestao.includes(usuarioAtual.perfil)) return;

  // Não notifica quem registrou (comparação flexível de tipo)
  if (occ.registradoPorId == usuarioAtual.id) return;
  if (occ.registradoPorNome === usuarioAtual.nome) return;

  const c = getContainer();
  const card = document.createElement('div');
  card.className = 'notif-card';
  card.id = `notif-${occ.id}`;

  const nomes = occ.alunos && occ.alunos.length
    ? occ.alunos.map(a => a.nome).join(', ')
    : '—';

  card.innerHTML = `
    <div class="notif-header">
      <span>🔔 Nova Ocorrência Registrada</span>
      <button onclick="this.closest('.notif-card').remove()" title="Fechar">✕</button>
    </div>
    <div class="notif-body">
      <div class="notif-tipo">Art. ${occ.numero} — ${occ.tipo}</div>
      <div class="notif-info">
        <strong>${GL[occ.gravidade] || occ.gravidade}</strong>
        &nbsp;·&nbsp; ${occ.turma}
        &nbsp;·&nbsp; ${occ.data} às ${occ.hora}<br>
        Aluno(s): ${nomes}<br>
        Registrado por: <strong>${occ.registradoPorNome}</strong>
      </div>
      <div class="notif-acoes">
        <button class="bn mg" id="btnChat-${occ.id}">💬 Abrir Chat</button>
        <button class="bn" onclick="this.closest('.notif-card').remove()">Dispensar</button>
      </div>
    </div>`;

  c.appendChild(card);

  // Toca som se disponível
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(); osc.stop(ctx.currentTime + 0.4);
  } catch {}

  // Notificação do sistema operacional
  if (Notification && Notification.permission === 'granted') {
    new Notification('Nova Ocorrência — Malba Thereza', {
      body: `Art. ${occ.numero} · ${GL[occ.gravidade]} · ${occ.turma}\nPor: ${occ.registradoPorNome}`,
      icon: '/icons/icon-192.png',
    });
  }

  card.querySelector(`#btnChat-${occ.id}`).addEventListener('click', () => {
    card.remove();
    if (onChat) onChat(occ.id);
  });

  // Auto-remove após 30s
  setTimeout(() => { if (card.parentNode) card.remove(); }, 30000);
}

// Solicita permissão de notificação do SO
export function pedirPermissaoNotif() {
  if (Notification && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}
