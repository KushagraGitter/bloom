import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUESTION_KIND, REPORT_KIND, inListOrder, type Question, type Report } from '@/lib/reports';
import { fileForScan, scanPrescription, scanReport, type PickedFile } from '@/lib/scan';
import { useSession } from '@/lib/session';
import { listItems, newId, removeItems, saveItem, useVaultQuery, vaultQueryKey } from '@/lib/vault/records';
import { useVault } from '@/lib/vault/VaultProvider';

const reportsKey = (pregnancyId: string | undefined) => vaultQueryKey(pregnancyId, 'reports');

export type SavedReport = { id: string; data: Report };
export type SavedQuestion = Question & { id: string };

/** Every saved report, newest first. */
export function useReports(pregnancyId: string | undefined) {
  return useVaultQuery(pregnancyId, ['reports', 'list'], async (store, pid): Promise<SavedReport[]> =>
    inListOrder((await listItems<Report>(store, pid, REPORT_KIND)).map((item) => ({ id: item.id, data: item.data }))),
  );
}

/** Questions for the next visit, in the order they were added. */
export function useQuestions(pregnancyId: string | undefined) {
  return useVaultQuery(pregnancyId, ['reports', 'questions'], async (store, pid): Promise<SavedQuestion[]> =>
    (await listItems<Question>(store, pid, QUESTION_KIND))
      .map((item) => ({ id: item.id, ...item.data }))
      .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id)),
  );
}

/**
 * Reads a picked file with the AI. Nothing is saved: the draft goes to the
 * review sheet, and only what is confirmed there is kept.
 */
export function useScanReport() {
  return useMutation({
    mutationFn: async (input: { pregnancyId: string; file: PickedFile; week: number | null }) =>
      scanReport({ pregnancyId: input.pregnancyId, week: input.week, file: await fileForScan(input.file) }),
  });
}

/** Reads a prescription with the AI. Nothing is saved until the medicines are checked and added. */
export function useScanPrescription() {
  return useMutation({
    mutationFn: async (input: { pregnancyId: string; file: PickedFile; week: number | null }) =>
      scanPrescription({ pregnancyId: input.pregnancyId, week: input.week, file: await fileForScan(input.file) }),
  });
}

export function useSaveReport(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  return useMutation({
    mutationFn: (report: Report) => saveItem(vault, { id: newId(), pregnancyId: pregnancyId!, kind: REPORT_KIND, data: report }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: reportsKey(pregnancyId) }),
  });
}

export function useAddQuestion(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  const { session } = useSession();
  return useMutation({
    mutationFn: (text: string) => {
      const question: Question = { text, at: new Date().toISOString(), by: session?.user.id ?? '' };
      return saveItem(vault, { id: newId(), pregnancyId: pregnancyId!, kind: QUESTION_KIND, data: question });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: reportsKey(pregnancyId) }),
  });
}

/** Removes a report or a question. */
export function useRemoveReportItem(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  return useMutation({
    mutationFn: (id: string) => removeItems(vault, [id]),
    onSettled: () => queryClient.invalidateQueries({ queryKey: reportsKey(pregnancyId) }),
  });
}
