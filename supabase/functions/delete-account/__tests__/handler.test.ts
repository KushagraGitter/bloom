/** @jest-environment node */
import { CONFIRM, handleDeleteAccount, type DeleteDeps } from '../handler';

const deps = (over: Partial<DeleteDeps> = {}): DeleteDeps => ({
  authorized: true,
  currentUserId: jest.fn(async () => 'user-1'),
  deleteUser: jest.fn(async () => {}),
  log: jest.fn(),
  ...over,
});

const post = (body: unknown) =>
  new Request('https://x/functions/v1/delete-account', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });

describe('handleDeleteAccount', () => {
  it('deletes the signed-in user', async () => {
    const d = deps();
    const res = await handleDeleteAccount(post({ confirm: CONFIRM }), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(d.deleteUser).toHaveBeenCalledWith('user-1');
  });

  it('only deletes whoever the session belongs to, whatever the body says', async () => {
    const d = deps();
    await handleDeleteAccount(post({ confirm: CONFIRM, userId: 'someone-else' }), d);
    expect(d.deleteUser).toHaveBeenCalledWith('user-1');
  });

  it('needs the confirmation', async () => {
    for (const body of [{}, { confirm: true }, { confirm: 'yes' }, 'not json']) {
      const d = deps();
      expect((await handleDeleteAccount(post(body), d)).status).toBe(400);
      expect(d.deleteUser).not.toHaveBeenCalled();
    }
  });

  it('refuses without a valid session', async () => {
    const none = deps({ authorized: false });
    expect((await handleDeleteAccount(post({ confirm: CONFIRM }), none)).status).toBe(401);
    const expired = deps({ currentUserId: jest.fn(async () => null) });
    expect((await handleDeleteAccount(post({ confirm: CONFIRM }), expired)).status).toBe(401);
    expect(none.deleteUser).not.toHaveBeenCalled();
    expect(expired.deleteUser).not.toHaveBeenCalled();
  });

  it('only takes POST, and answers the browser preflight', async () => {
    const d = deps();
    expect((await handleDeleteAccount(new Request('https://x', { method: 'GET' }), d)).status).toBe(405);
    expect((await handleDeleteAccount(new Request('https://x', { method: 'OPTIONS' }), d)).status).toBe(200);
    expect(d.deleteUser).not.toHaveBeenCalled();
  });

  it('logs and reports a failure without saying why', async () => {
    const d = deps({ deleteUser: jest.fn(async () => Promise.reject(new Error('db down'))) });
    const res = await handleDeleteAccount(post({ confirm: CONFIRM }), d);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'failed' });
    expect(d.log).toHaveBeenCalledWith(expect.stringContaining('db down'));
  });
});
