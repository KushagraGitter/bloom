import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { fitWithin } from '@/lib/bumpPhotos';
import type { ScanDraft } from '@/lib/reports';
import { supabase } from '@/lib/supabase';

/**
 * Getting a report, a prescription or a photo of a meal to the AI: pick a
 * photo or PDF, shrink a photo on the phone, and send it to the `scan` Edge
 * Function, which passes it to Claude and returns what it read. The file is
 * not uploaded anywhere else or kept.
 */

/** Claude reads images up to about this long edge; bigger only costs more. */
export const SCAN_EDGE = 1568;
const QUALITY = 0.8;
/** The function accepts about 10 MB. */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export type ScanSource = 'camera' | 'library' | 'pdf';

export type PickedFile = {
  name: string;
  uri: string;
  mediaType: 'image' | 'application/pdf';
  width: number;
  height: number;
};

export type PickFileResult = { status: 'picked'; file: PickedFile } | { status: 'cancelled' } | { status: 'denied' } | { status: 'too_large' };

export async function pickScanFile(source: ScanSource): Promise<PickFileResult> {
  if (source === 'pdf') {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return { status: 'cancelled' };
    if ((asset.size ?? 0) > MAX_PDF_BYTES) return { status: 'too_large' };
    return { status: 'picked', file: { name: asset.name, uri: asset.uri, mediaType: 'application/pdf', width: 0, height: 0 } };
  }
  const permission =
    source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { status: 'cancelled' };
  return {
    status: 'picked',
    file: {
      name: asset.fileName ?? (source === 'camera' ? 'Photo' : 'Photo from library'),
      uri: asset.uri,
      mediaType: 'image',
      width: asset.width,
      height: asset.height,
    },
  };
}

/** The file as the function wants it: a JPEG no bigger than Claude reads, or the PDF as it is. */
export async function fileForScan(file: PickedFile): Promise<{ mediaType: 'image/jpeg' | 'application/pdf'; data: string }> {
  if (file.mediaType === 'application/pdf') {
    const data = await new File(file.uri).base64();
    if (data.length > (MAX_PDF_BYTES * 4) / 3 + 4) throw new ScanFailure('too_large');
    return { mediaType: 'application/pdf', data };
  }
  const context = ImageManipulator.manipulate(file.uri).resize(fitWithin(file.width, file.height, SCAN_EDGE));
  try {
    const image = await context.renderAsync();
    try {
      const saved = await image.saveAsync({ base64: true, compress: QUALITY, format: SaveFormat.JPEG });
      if (!saved.base64) throw new ScanFailure('unreadable');
      return { mediaType: 'image/jpeg', data: saved.base64 };
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}

/** What to say when a file couldn't be picked. */
export const PICK_PROBLEM = {
  denied: 'Bloom needs permission to use the camera or photos. You can allow it in your phone’s Settings.',
  too_large: 'That PDF is over 10 MB. Try a photo of each page instead.',
} as const;

export type ScanFailureCode =
  | 'too_large'
  | 'daily_limit'
  | 'not_set_up'
  | 'unreadable'
  | 'not_member'
  | 'offline'
  | 'failed';

export class ScanFailure extends Error {
  constructor(public code: ScanFailureCode) {
    super(code);
    this.name = 'ScanFailure';
  }
}

/** What the sheet says for each failure. Every one offers "fill it in by hand". */
export const FAILURE_TEXT: Record<ScanFailureCode, string> = {
  too_large: 'That file is too big to read. Try a photo of each page, or a PDF under 10 MB.',
  daily_limit: 'You’ve used today’s AI scans. Fill this one in by hand, or scan it tomorrow.',
  not_set_up: 'AI reading isn’t switched on for Bloom yet. You can fill this one in by hand.',
  unreadable: 'The AI couldn’t read this one. Try a clearer photo, or fill it in by hand.',
  not_member: 'Couldn’t check your household. Close Bloom, open it again and try once more.',
  offline: 'Couldn’t reach the AI. Check your connection and try again.',
  failed: 'Something went wrong reading it. Try again, or fill it in by hand.',
};

const FROM_SERVER: Record<string, ScanFailureCode> = {
  too_large: 'too_large',
  daily_limit: 'daily_limit',
  not_configured: 'not_set_up',
  unreadable: 'unreadable',
  not_member: 'not_member',
  ai_failed: 'failed',
  bad_request: 'failed',
};

export type ScanInput = {
  pregnancyId: string;
  file: { mediaType: string; data: string };
  week: number | null;
};

/** Sends the file to the `scan` function and returns the AI's draft, unchecked. */
async function scan<T>(kind: 'report' | 'meal' | 'rx', input: ScanInput): Promise<T> {
  const { data, error } = await supabase.functions.invoke('scan', {
    body: { kind, pregnancyId: input.pregnancyId, file: input.file, week: input.week },
  });
  if (error) throw new ScanFailure(await failureOf(error));
  const draft = (data as { draft?: T } | null)?.draft;
  if (!draft) throw new ScanFailure('failed');
  return draft;
}

export const scanReport = (input: ScanInput) => scan<ScanDraft>('report', input);
export const scanMeal = (input: ScanInput) => scan<MealScanDraft>('meal', input);
export const scanPrescription = (input: ScanInput) => scan<RxScanDraft>('rx', input);

/** What the function sends back for a meal (see supabase/functions/scan/handler.ts). */
export type MealScanDraft = {
  items: {
    name: string;
    portion: string;
    kcal: number | null;
    protein_g: number | null;
    iron_mg: number | null;
    calcium_mg: number | null;
    folate_mcg: number | null;
    fibre_g: number | null;
  }[];
  confidence: 'high' | 'medium' | 'low';
  unreadable_lines: string[];
};

/** What the function sends back for a prescription. */
export type RxScanDraft = {
  doctor: string;
  date: string;
  meds: {
    name: string;
    strength: string;
    dose: string;
    frequency: string;
    time_of_day: 'morning' | 'afternoon' | 'evening';
    duration_days: number | null;
    instructions: string;
  }[];
  unreadable_lines: string[];
};

async function failureOf(error: { name?: string; context?: unknown }): Promise<ScanFailureCode> {
  const response = error.context as { status?: number; json?: () => Promise<unknown> } | undefined;
  if (error.name !== 'FunctionsHttpError' || !response || typeof response.status !== 'number') return 'offline';
  // A function that was never deployed answers 404 with Supabase's own body.
  if (response.status === 404) return 'not_set_up';
  // Supabase turned away the sign-in token before the function ran.
  if (response.status === 401) return 'not_member';
  try {
    const body = (await response.json?.()) as { error?: string } | undefined;
    return FROM_SERVER[body?.error ?? ''] ?? 'failed';
  } catch {
    return 'failed';
  }
}
