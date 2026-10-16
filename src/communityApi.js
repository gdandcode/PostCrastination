export async function communityRequest(user, path, options = {}) {
  if (!user?.getIdToken) throw new Error('Sign in with a real account to use Community.');
  const token = await user.getIdToken();
  const response = await fetch(path, {
    ...options,
    signal: options.signal || AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {const error=new Error(data.error || 'Community could not connect. Start the backend and try again.');error.status=response.status;throw error;}
  return data;
}
export async function syncCommunityUser(user, changes) {
  return communityRequest(user, '/api/me', changes ? { method: 'PATCH', body: JSON.stringify(changes) } : { method: 'POST' });
}
