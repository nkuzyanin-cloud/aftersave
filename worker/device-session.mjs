
const DEVICE_LIFETIME = 30 * 24 * 60 * 60 * 1000;
const tokenPattern = /^[a-f0-9]{64}$/;

export async function requestJson(request, limit) {
  if (Number(request.headers.get('content-length')) > limit ||
      !request.headers.get('content-type')?.startsWith('application/json') || !request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let length = 0;
  let input = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        return null;
      }
      input += decoder.decode(value, { stream: true });
    }
    return JSON.parse(input + decoder.decode());
  } catch { return null; }
}

const hex = buffer => [...new Uint8Array(buffer)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const digest = async (token,env) => hex(await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(env.AFTERSAVE_PASSWORD + ':aftersave-device:' + token)));

export async function rememberDevice(env) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const now = Date.now();
  const database = env.STEAM_ACTIVITY;
  await database.batch([
    database.prepare('DELETE FROM saved_devices WHERE expires_at <= ?1').bind(now),
    database.prepare('INSERT INTO saved_devices(account,digest,expires_at) VALUES (?1,?2,?3)')
      .bind(env.STEAM_ID, await digest(token,env), now+DEVICE_LIFETIME)
  ]);
  return token;
}

export async function renewDevice(env, token) {
  if (typeof token !== 'string' || !tokenPattern.test(token)) return false;
  const now = Date.now();
  const result = await env.STEAM_ACTIVITY.prepare(
    'UPDATE saved_devices SET expires_at=?1 WHERE account=?2 AND digest=?3 AND expires_at>?4'
  ).bind(now+DEVICE_LIFETIME,env.STEAM_ID,await digest(token,env),now).run();
  return result.meta.changes === 1;
}

export async function forgetDevice(env, token) {
  if (typeof token !== 'string' || !tokenPattern.test(token)) return;
  await env.STEAM_ACTIVITY.prepare('DELETE FROM saved_devices WHERE account=?1 AND digest=?2')
    .bind(env.STEAM_ID,await digest(token,env)).run();
}
