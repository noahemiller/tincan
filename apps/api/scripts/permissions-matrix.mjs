import assert from 'node:assert/strict';

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';
const PASSWORD = 'password123';

function uid(prefix) {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 100000)}`;
}

async function request(path, init = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {})
    }
  });

  const text = await response.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { status: response.status, body };
}

async function registerUser(namePrefix) {
  const email = `${uid(namePrefix)}@example.com`;
  const handle = uid(namePrefix).slice(0, 24);

  const result = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: PASSWORD,
      name: `${namePrefix} User`,
      handle
    })
  });

  assert.equal(result.status, 200, `register failed: ${JSON.stringify(result.body)}`);

  return {
    user: result.body.user,
    accessToken: result.body.accessToken ?? result.body.token,
    refreshToken: result.body.refreshToken ?? ''
  };
}

async function login(email) {
  const result = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: PASSWORD })
  });

  assert.equal(result.status, 200, `login failed: ${JSON.stringify(result.body)}`);

  return {
    user: result.body.user,
    accessToken: result.body.accessToken ?? result.body.token,
    refreshToken: result.body.refreshToken ?? ''
  };
}

function auth(session) {
  return { authorization: `Bearer ${session.accessToken}` };
}

async function runAuthMatrix() {
  const user = await registerUser('auth');
  const loggedIn = await login(user.user.email);

  const refreshed = await request('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: loggedIn.refreshToken })
  });
  assert.equal(refreshed.status, 200, `refresh should succeed: ${JSON.stringify(refreshed.body)}`);

  const refreshedToken = refreshed.body.refreshToken;

  const oldRefresh = await request('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: loggedIn.refreshToken })
  });
  assert.equal(oldRefresh.status, 401, `old refresh token should be invalid: ${JSON.stringify(oldRefresh.body)}`);

  const logout = await request('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: refreshedToken })
  });
  assert.equal(logout.status, 200, `logout should succeed: ${JSON.stringify(logout.body)}`);

  const refreshAfterLogout = await request('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: refreshedToken })
  });
  assert.equal(refreshAfterLogout.status, 401, 'refresh token should be invalid after logout');

  const login2 = await login(user.user.email);
  const logoutAll = await request('/api/auth/logout-all', {
    method: 'POST',
    headers: auth(login2),
    body: JSON.stringify({})
  });
  assert.equal(logoutAll.status, 200, 'logout-all should succeed');

  const refreshAfterLogoutAll = await request('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: login2.refreshToken })
  });
  assert.equal(refreshAfterLogoutAll.status, 401, 'refresh token should be invalid after logout-all');

  return {
    authRotatingRefresh: 'pass',
    authLogoutRevocation: 'pass'
  };
}

async function runRoleMatrix() {
  const owner = await registerUser('owner');

  const serverCreate = await request('/api/servers', {
    method: 'POST',
    headers: auth(owner),
    body: JSON.stringify({ name: `Server-${uid('r')}` })
  });
  assert.equal(serverCreate.status, 201, `owner server create failed: ${JSON.stringify(serverCreate.body)}`);

  const serverId = serverCreate.body.server.id;

  const memberInviteCreate = await request(`/api/servers/${serverId}/invites`, {
    method: 'POST',
    headers: auth(owner),
    body: JSON.stringify({ roleToGrant: 'member', maxUses: 10, expiresInHours: 24 })
  });
  assert.equal(memberInviteCreate.status, 201, 'owner should create member invite');
  const memberInviteCode = memberInviteCreate.body.invite.code;

  const adminInviteCreate = await request(`/api/servers/${serverId}/invites`, {
    method: 'POST',
    headers: auth(owner),
    body: JSON.stringify({ roleToGrant: 'admin', maxUses: 10, expiresInHours: 24 })
  });
  assert.equal(adminInviteCreate.status, 201, 'owner should create admin invite');
  const adminInviteCode = adminInviteCreate.body.invite.code;

  const member = await registerUser('member');

  const acceptMemberInvite = await request(`/api/invites/${memberInviteCode}/accept`, {
    method: 'POST',
    headers: auth(member),
    body: JSON.stringify({})
  });
  assert.equal(acceptMemberInvite.status, 200, 'member should accept invite');

  const memberCreateChannelBefore = await request(`/api/servers/${serverId}/channels`, {
    method: 'POST',
    headers: auth(member),
    body: JSON.stringify({ name: `member-before-${uid('c')}` })
  });
  assert.equal(memberCreateChannelBefore.status, 403, 'member should not create channel before promotion');

  const memberCreateCommandBefore = await request(`/api/servers/${serverId}/commands`, {
    method: 'POST',
    headers: auth(member),
    body: JSON.stringify({ command: 'hi', responseText: 'hello' })
  });
  assert.equal(memberCreateCommandBefore.status, 403, 'member should not create server commands before promotion');

  const memberCreatePublicCollectionBefore = await request('/api/library/collections', {
    method: 'POST',
    headers: auth(member),
    body: JSON.stringify({ serverId, name: `public-${uid('col')}`, visibility: 'public' })
  });
  assert.equal(memberCreatePublicCollectionBefore.status, 403, 'member should not create public collection before promotion');

  const ownerPromoteMember = await request(`/api/servers/${serverId}/members/${member.user.id}/role`, {
    method: 'PUT',
    headers: auth(owner),
    body: JSON.stringify({ role: 'admin' })
  });
  assert.equal(ownerPromoteMember.status, 200, 'owner should promote member to admin');

  const memberCreateChannelAfter = await request(`/api/servers/${serverId}/channels`, {
    method: 'POST',
    headers: auth(member),
    body: JSON.stringify({ name: `member-after-${uid('c')}` })
  });
  assert.equal(memberCreateChannelAfter.status, 201, 'admin should create channel');

  const memberCreateCommandAfter = await request(`/api/servers/${serverId}/commands`, {
    method: 'POST',
    headers: auth(member),
    body: JSON.stringify({ command: 'ping', responseText: 'pong' })
  });
  assert.equal(memberCreateCommandAfter.status, 201, 'admin should create server commands');

  const memberCreatePublicCollectionAfter = await request('/api/library/collections', {
    method: 'POST',
    headers: auth(member),
    body: JSON.stringify({ serverId, name: `public-${uid('col')}`, visibility: 'public' })
  });
  assert.equal(memberCreatePublicCollectionAfter.status, 201, 'admin should create public collection');

  const memberCreateInviteAfter = await request(`/api/servers/${serverId}/invites`, {
    method: 'POST',
    headers: auth(member),
    body: JSON.stringify({ roleToGrant: 'member' })
  });
  assert.equal(memberCreateInviteAfter.status, 201, 'admin should create invite');

  const outsider = await registerUser('outsider');

  const outsiderCreateInvite = await request(`/api/servers/${serverId}/invites`, {
    method: 'POST',
    headers: auth(outsider),
    body: JSON.stringify({ roleToGrant: 'member' })
  });
  assert.equal(outsiderCreateInvite.status, 403, 'outsider should not create invites');

  const adminByInvite = await registerUser('adminjoin');
  const acceptAdminInvite = await request(`/api/invites/${adminInviteCode}/accept`, {
    method: 'POST',
    headers: auth(adminByInvite),
    body: JSON.stringify({})
  });
  assert.equal(acceptAdminInvite.status, 200, 'admin invite should be accepted');

  const ownerDemoteAdminViaInvite = await request(`/api/servers/${serverId}/members/${adminByInvite.user.id}/role`, {
    method: 'PUT',
    headers: auth(owner),
    body: JSON.stringify({ role: 'member' })
  });
  assert.equal(ownerDemoteAdminViaInvite.status, 200, 'owner should demote admin');

  const adminAfterDemoteCreateInvite = await request(`/api/servers/${serverId}/invites`, {
    method: 'POST',
    headers: auth(adminByInvite),
    body: JSON.stringify({ roleToGrant: 'member' })
  });
  assert.equal(adminAfterDemoteCreateInvite.status, 403, 'demoted admin should lose admin capabilities');

  return {
    inviteFlow: 'pass',
    memberRestrictions: 'pass',
    adminCapabilities: 'pass',
    ownerRoleManagement: 'pass'
  };
}

async function main() {
  const health = await request('/api/health');

  if (health.status !== 200) {
    throw new Error(`API not healthy at ${BASE_URL}: ${JSON.stringify(health.body)}`);
  }

  const authResults = await runAuthMatrix();
  const roleResults = await runRoleMatrix();

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl: BASE_URL,
        ...authResults,
        ...roleResults
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
