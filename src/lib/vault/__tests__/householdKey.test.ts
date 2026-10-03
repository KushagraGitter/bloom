import { newHouseholdKey, seal } from '@/lib/vault/crypto';
import { keyFitsHousehold, resolveHouseholdKey } from '@/lib/vault/householdKey';
import { fakeServer } from '@/lib/vault/testHelpers';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)),
}));

function setup(stored: ReturnType<typeof newHouseholdKey> | null, records: number) {
  const saveKey = jest.fn(async () => {});
  return {
    saveKey,
    args: { loadKey: async () => stored, saveKey, countRecords: jest.fn(async () => records) },
  };
}

describe('resolveHouseholdKey', () => {
  it('uses the key already on this phone', async () => {
    const key = newHouseholdKey();
    const { args, saveKey } = setup(key, 5);
    expect(await resolveHouseholdKey({ role: 'partner', ...args })).toEqual({ status: 'ready', key, created: false });
    expect(args.countRecords).not.toHaveBeenCalled();
    expect(saveKey).not.toHaveBeenCalled();
  });

  it("makes and keeps a key on her phone when the household hasn't saved anything yet", async () => {
    const { args, saveKey } = setup(null, 0);
    const result = await resolveHouseholdKey({ role: 'owner', ...args });
    expect(result).toMatchObject({ status: 'ready', created: true });
    expect(saveKey).toHaveBeenCalledWith(result.status === 'ready' ? result.key : null);
  });

  it('asks her new phone for the key once records exist, rather than starting a second one', async () => {
    const { args, saveKey } = setup(null, 3);
    expect(await resolveHouseholdKey({ role: 'owner', ...args })).toEqual({ status: 'needs-key' });
    expect(saveKey).not.toHaveBeenCalled();
  });

  it('never makes a key on the partner’s phone', async () => {
    const { args, saveKey } = setup(null, 0);
    expect(await resolveHouseholdKey({ role: 'partner', ...args })).toEqual({ status: 'needs-key' });
    expect(saveKey).not.toHaveBeenCalled();
  });

  it('fails rather than guessing when it cannot check the server', async () => {
    const { args } = setup(null, 0);
    args.countRecords.mockRejectedValueOnce(new Error('Network request failed'));
    await expect(resolveHouseholdKey({ role: 'owner', ...args })).rejects.toThrow('Network');
  });
});

describe('keyFitsHousehold', () => {
  const P = 'p1';

  async function serverWithRecord(key: ReturnType<typeof newHouseholdKey>) {
    const server = fakeServer();
    const sealed = seal(key, { pregnancyId: P, id: 'r1' }, { kind: 'reading', data: {}, deleted: false, updatedAt: '2026-10-04T10:00:00.000Z' });
    await server.remote.push([{ id: 'r1', pregnancy_id: P, key_version: key.version, client_updated_at: '2026-10-04T10:00:00Z', ...sealed }]);
    return server;
  }

  it('takes any key while nothing is saved yet', async () => {
    expect(await keyFitsHousehold(newHouseholdKey(), P, fakeServer().remote)).toBe(true);
  });

  it('takes the key the household saved with', async () => {
    const key = newHouseholdKey();
    expect(await keyFitsHousehold(key, P, (await serverWithRecord(key)).remote)).toBe(true);
  });

  it("refuses another household's key, or an older version of this one", async () => {
    const key = newHouseholdKey(2);
    const { remote } = await serverWithRecord(key);
    expect(await keyFitsHousehold(newHouseholdKey(2), P, remote)).toBe(false);
    expect(await keyFitsHousehold({ ...key, version: 1 }, P, remote)).toBe(false);
  });
});
