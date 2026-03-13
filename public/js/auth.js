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

// Fetch autenticado — redireciona para login se 401
export async function apiFetch(url, options = {}) {
  try {
    const resp = await fetch(url, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
    });
    if (resp.status === 401) {
      limparSessao();
      alert('Sessão expirada. Faça login novamente.');
      location.reload();
      return null;
    }
    return resp;
  } catch (err) {
    console.error('Erro na requisição:', err);
    return null;
  }
}
