// auth.js — gerencia token JWT localmente
const CHAVE = 'ocorrencias_token';
const CHAVE_U = 'ocorrencias_usuario';

export function salvarSessao(token, usuario) {
  localStorage.setItem(CHAVE, token);
  localStorage.setItem(CHAVE_U, JSON.stringify(usuario));
}

export function limparSessao() {
  localStorage.removeItem(CHAVE);
  localStorage.removeItem(CHAVE_U);
}

export function getToken() {
  return localStorage.getItem(CHAVE);
}

export function getUsuario() {
  const u = localStorage.getItem(CHAVE_U);
  return u ? JSON.parse(u) : null;
}

export function temSessao() {
  return !!localStorage.getItem(CHAVE);
}

// Retorna headers com Authorization para fetch
export function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + getToken(),
  };
}

// Decodifica o payload JWT sem verificar assinatura (só leitura local)
function _payloadJWT(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

// Retorna quantos ms faltam para o token expirar (negativo se já expirou)
export function _msParaExpirar() {
  const token = getToken();
  if (!token) return -1;
  const p = _payloadJWT(token);
  if (!p || !p.exp) return -1;
  return p.exp * 1000 - Date.now();
}

// Renova o token silenciosamente se ele expira em menos de 7 dias.
// Chama um callback opcional com o novo token para atualizar o WebSocket.
export async function tentarRenovarToken(onRenovado) {
  const ms = _msParaExpirar();
  // Só renova se o token ainda for válido mas estiver perto do vencimento (< 7 dias)
  if (ms < 0 || ms > 7 * 24 * 60 * 60 * 1000) return;
  try {
    const resp = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!resp.ok) return;
    const { token } = await resp.json();
    const usuario = getUsuario();
    salvarSessao(token, usuario);
    if (onRenovado) onRenovado(token);
  } catch { /* falha silenciosa — token antigo ainda serve */ }
}

// Fetch autenticado — mostra toast e redireciona suavemente em caso de 401
export async function apiFetch(url, options = {}) {
  try {
    const resp = await fetch(url, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
    });
    if (resp.status === 401) {
      limparSessao();
      // Evita alert() brusco — deixa o app tratar via evento
      window.dispatchEvent(new CustomEvent('sessao-expirada'));
      return null;
    }
    return resp;
  } catch (err) {
    console.error('Erro na requisição:', err);
    return null;
  }
}
