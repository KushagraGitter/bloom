import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/**
 * Bump photos are health data, so they never go to Supabase Storage as files.
 * Each photo is shrunk on the phone and kept as two vault records, sealed
 * like everything else before it syncs: a small one with the thumbnail and
 * the week (the diary grid reads only these), and the full picture in its own
 * record, read when she opens it.
 */

export const PHOTO_KIND = 'bump-photo';
export const IMAGE_KIND = 'bump-image';

/** Long edge of the kept photo, in pixels. About 150–300 KB as a JPEG. */
export const PHOTO_EDGE = 1280;
/** Long edge of the grid thumbnail. About 15–30 KB. */
export const THUMB_EDGE = 360;
const QUALITY = 0.6;

/** The diary entry. `thumb` is base64 JPEG. */
export type BumpPhoto = {
  week: number;
  /** The local day it was added, YYYY-MM-DD. */
  day: string;
  imageId: string;
  thumb: string;
  width: number;
  height: number;
  by: string;
};

/** The full picture, base64 JPEG. */
export type BumpImage = { photoId: string; jpeg: string };

export type PickedPhoto = { uri: string; width: number; height: number; takenOn: string | null };

export type PickResult = { status: 'picked'; photo: PickedPhoto } | { status: 'cancelled' } | { status: 'denied' };

export const jpegUri = (base64: string) => `data:image/jpeg;base64,${base64}`;

/** "2026:10:03 14:22:11" (EXIF) → "2026-10-03", or null. */
export function exifDay(exif: Record<string, unknown> | null | undefined): string | null {
  const raw = exif?.DateTimeOriginal ?? exif?.DateTime;
  if (typeof raw !== 'string') return null;
  const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(raw);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Opens the camera or the photo library. Asks for permission first. */
export async function pickPhoto(source: 'camera' | 'library'): Promise<PickResult> {
  const permission =
    source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: true };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { status: 'cancelled' };
  return {
    status: 'picked',
    photo: { uri: asset.uri, width: asset.width, height: asset.height, takenOn: source === 'library' ? exifDay(asset.exif) : null },
  };
}

/** Which side to scale so the long edge is at most `edge` (never enlarges). */
export function fitWithin(width: number, height: number, edge: number): { width: number } | { height: number } {
  if (height > width) return { height: Math.min(edge, height || edge) };
  return { width: Math.min(edge, width || edge) };
}

async function render(uri: string, width: number, height: number, edge: number) {
  const context = ImageManipulator.manipulate(uri).resize(fitWithin(width, height, edge));
  try {
    const image = await context.renderAsync();
    try {
      const saved = await image.saveAsync({ base64: true, compress: QUALITY, format: SaveFormat.JPEG });
      if (!saved.base64) throw new Error('The photo couldn’t be read.');
      return { base64: saved.base64, width: saved.width, height: saved.height };
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}

/** Shrinks a picked photo into the kept picture and its thumbnail. */
export async function shrinkPhoto(photo: PickedPhoto) {
  const full = await render(photo.uri, photo.width, photo.height, PHOTO_EDGE);
  const thumb = await render(photo.uri, photo.width, photo.height, THUMB_EDGE);
  return { jpeg: full.base64, thumb: thumb.base64, width: full.width, height: full.height };
}

export type ShrunkPhoto = Awaited<ReturnType<typeof shrinkPhoto>>;

/** The diary in week order, oldest first; two photos in one week keep the order they were added. */
export function inDiaryOrder<T extends { data: BumpPhoto; updatedAt: string; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.data.week - b.data.week || a.data.day.localeCompare(b.data.day) || a.id.localeCompare(b.id));
}
