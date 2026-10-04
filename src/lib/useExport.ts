import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useMutation } from '@tanstack/react-query';

import type { Pregnancy } from '@/lib/data';
import { exportFile, exportName, summaryHtml } from '@/lib/exportData';
import { gestationalAge, localToday } from '@/lib/pregnancy';
import { readyStore } from '@/lib/vault/records';
import { useVault } from '@/lib/vault/VaultProvider';

export type ExportFormat = 'pdf' | 'json';

/** Raised when the phone has no share sheet to hand the file to. */
export class NoShareSheetError extends Error {}

/**
 * Makes the PDF summary or the full JSON copy from this phone's records and
 * opens the share sheet with it. Nothing leaves the phone unless she sends it.
 */
export function useExportData(pregnancy: Pregnancy | undefined, name: string) {
  const vault = useVault();
  return useMutation({
    mutationFn: async (format: ExportFormat) => {
      if (!pregnancy) throw new Error('No pregnancy yet');
      if (!(await Sharing.isAvailableAsync())) throw new NoShareSheetError();
      const records = await readyStore(vault).listAll(pregnancy.id);
      const today = localToday();

      if (format === 'json') {
        const file = new File(Paths.cache, `${exportName(today)}.json`);
        file.create({ overwrite: true });
        file.write(JSON.stringify(exportFile(pregnancy, records), null, 2));
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Your Bloom data' });
        return;
      }

      const week = pregnancy.lmp_date ? gestationalAge(pregnancy.lmp_date, today).weeks : null;
      const { uri } = await Print.printToFileAsync({ html: summaryHtml({ name, pregnancy, week, records, today }) });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Your Bloom summary' });
    },
  });
}
