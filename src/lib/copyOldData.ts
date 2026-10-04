import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { doseId, pregnancyDetails, pregnancyDetailsId, PREGNANCY_KIND, readingKind, tallyKind, useMembership } from '@/lib/data';
import { localToday } from '@/lib/pregnancy';
import type { CheckinType, ReadingType } from '@/lib/readings';
import { supabase } from '@/lib/supabase';
import { writeRecord, type LocalStore } from '@/lib/vault/localStore';
import { stableId } from '@/lib/vault/records';
import { vaultKey } from '@/lib/vault/useVaultSync';
import { useVault } from '@/lib/vault/VaultProvider';

/**
 * One-time copy of what was saved before health data moved into the vault:
 * readings, medicines, doses, appointments and the pregnancy details are read
 * from the old readable tables and saved as vault records. The old tables are
 * left as they are; emptying them is a separate, later step.
 *
 * Copying is safe to repeat and to run on both phones: each record keeps its
 * old id (doses and the details get the same fixed id on either phone) and is
 * dated when it was originally saved, so anything edited since in the vault
 * is newer and wins, and a record this phone already has is left alone.
 */

type Row = Record<string, unknown>;

export type OldTables = {
  pregnancy: Row | null;
  readings: Row[];
  medications: Row[];
  doses: Row[];
  appointments: Row[];
};

/** Marks the household as copied. It syncs, so the other phone doesn't copy again. */
export const COPIED_KIND = 'meta.copied';
export const copiedMarkerId = (pregnancyId: string) => stableId('copied-old-tables', pregnancyId);

const PAGE = 1000;

async function fetchAll(table: string, columns: string, pregnancyId: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq('pregnancy_id', pregnancyId)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function fetchOldTables(pregnancyId: string): Promise<OldTables> {
  const { data: pregnancy, error } = await supabase.from('pregnancies').select('*').eq('id', pregnancyId).maybeSingle();
  if (error) throw error;
  const [readings, medications, doses, appointments] = await Promise.all([
    fetchAll('readings', 'id, type, value_num, value_num2, value_text, taken_at, logged_by', pregnancyId),
    fetchAll('medications', 'id, name, dose, time_of_day, start_date, end_date, created_at', pregnancyId),
    fetchAll('med_doses', 'id, medication_id, day, taken_at, logged_by', pregnancyId),
    fetchAll('appointments', 'id, title, appt_date, appt_time, place, created_at', pregnancyId),
  ]);
  return { pregnancy: pregnancy as Row | null, readings, medications, doses, appointments };
}

const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));

/** Saves the old rows into the store as vault records. Resolves to how many were added. */
export async function copyOldData(store: LocalStore, pregnancyId: string, old: OldTables, now = new Date()): Promise<number> {
  let added = 0;
  /** A timestamp as ISO, or now if the row has none. */
  const iso = (value: unknown) => {
    const time = typeof value === 'string' ? Date.parse(value) : NaN;
    return new Date(Number.isNaN(time) ? now.getTime() : time).toISOString();
  };
  const add = async (id: string, kind: string, data: unknown, savedAt: string) => {
    if (await store.get(id)) return;
    await writeRecord(store, { id, pregnancyId, kind, data }, new Date(savedAt));
    added++;
  };

  if (old.pregnancy) {
    const savedAt = iso(old.pregnancy.updated_at ?? old.pregnancy.created_at);
    await add(pregnancyDetailsId(pregnancyId), PREGNANCY_KIND, pregnancyDetails(old.pregnancy), savedAt);
  }
  for (const r of old.readings) {
    const type = r.type as ReadingType;
    const takenAt = iso(r.taken_at);
    const kind = type === 'kicks' || type === 'water' ? tallyKind(type, localToday(new Date(takenAt))) : readingKind(type as CheckinType);
    const data = {
      type,
      value_num: num(r.value_num),
      value_num2: num(r.value_num2),
      value_text: (r.value_text as string | null) ?? null,
      taken_at: takenAt,
      logged_by: r.logged_by,
    };
    await add(String(r.id), kind, data, takenAt);
  }
  for (const m of old.medications) {
    const createdAt = iso(m.created_at);
    const data = {
      name: m.name,
      dose: m.dose ?? null,
      time_of_day: m.time_of_day,
      start_date: m.start_date,
      end_date: m.end_date ?? null,
      created_at: createdAt,
    };
    await add(String(m.id), 'medication', data, createdAt);
  }
  for (const d of old.doses) {
    const takenAt = iso(d.taken_at);
    const data = { medication_id: d.medication_id, day: d.day, taken_at: takenAt, logged_by: d.logged_by ?? null };
    await add(doseId(String(d.medication_id), String(d.day)), 'dose', data, takenAt);
  }
  for (const a of old.appointments) {
    const time = a.appt_time ? String(a.appt_time).slice(0, 5) : null;
    const data = { title: a.title, appt_date: a.appt_date, appt_time: time, place: a.place ?? null };
    await add(String(a.id), 'appointment', data, iso(a.created_at));
  }

  await writeRecord(store, { id: copiedMarkerId(pregnancyId), pregnancyId, kind: COPIED_KIND, data: { at: now.toISOString() } }, now);
  return added;
}

/**
 * Runs the copy once this phone has the key and has finished its first sync
 * (so it knows whether the other phone already did it). Mount once, inside
 * the vault provider.
 */
export function useCopyOldData(): void {
  const vault = useVault();
  const membership = useMembership();
  const queryClient = useQueryClient();
  const pregnancyId = membership.data?.pregnancy.id;
  const store = vault.state === 'ready' ? vault.store : null;
  const lastSynced = vault.sync?.lastSyncedAt?.getTime() ?? null;
  const requestSync = vault.sync?.requestSync;
  const started = useRef<string | null>(null);

  useEffect(() => {
    if (!store || !pregnancyId || lastSynced === null || started.current === pregnancyId) return;
    started.current = pregnancyId;
    (async () => {
      if (await store.get(copiedMarkerId(pregnancyId))) return;
      const added = await copyOldData(store, pregnancyId, await fetchOldTables(pregnancyId));
      void requestSync?.();
      if (added > 0) await queryClient.invalidateQueries({ queryKey: vaultKey(pregnancyId) });
    })().catch(() => {
      // Try again after the next sync.
      started.current = null;
    });
  }, [store, pregnancyId, lastSynced, requestSync, queryClient]);
}
