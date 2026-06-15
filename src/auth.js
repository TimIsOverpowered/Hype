const AUTH_KEY = 'feathers-authentication';
const API_BASE = 'https://api.hype.lol';

export async function login(token) {
  const accessToken = typeof token === 'string' ? token : (token?.accessToken || '');
  localStorage.setItem(AUTH_KEY, JSON.stringify({ accessToken }));
  const user = await getUser();
  return { user };
}

export async function logout() {
  localStorage.removeItem(AUTH_KEY);
}

export function getToken() {
  try {
    const auth = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
    return auth.accessToken || '';
  } catch { return ''; }
}

export async function getUser() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/v1/user/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

const client = {
  authenticate: login,
  logout,
  get: async (key) => {
    if (key === 'authentication') return { accessToken: getToken() };
    throw new Error(`Unknown service: ${key}`);
  }
};
export default client;
