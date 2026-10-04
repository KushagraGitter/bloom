import { useMutation, useQueryClient } from '@tanstack/react-query';

import { IMAGE_KIND, PHOTO_KIND, inDiaryOrder, type BumpImage, type BumpPhoto, type ShrunkPhoto } from '@/lib/bumpPhotos';
import { readingKind, tallyKind } from '@/lib/data';
import { lastSevenDays } from '@/lib/progress';
import { CHECKINS, type Reading } from '@/lib/readings';
import { useSession } from '@/lib/session';
import { listItems, newId, removeItems, saveItem, useVaultQuery, vaultQueryKey } from '@/lib/vault/records';
import { useVault } from '@/lib/vault/VaultProvider';

type ReadingData = Omit<Reading, 'id' | 'pregnancy_id'>;

/**
 * Every weight, BP, sugar and sleep check-in. Kept under the readings key, so
 * logging one on Today refreshes the charts too.
 */
export function useCheckinHistory(pregnancyId: string | undefined) {
  return useVaultQuery(pregnancyId, ['readings', 'history'], async (store, pid): Promise<Reading[]> => {
    const lists = await Promise.all(CHECKINS.map((type) => listItems<ReadingData>(store, pid, readingKind(type))));
    return lists.flat().map((item) => ({ id: item.id, pregnancy_id: pid, ...item.data }));
  });
}

/** Kicks counted on each of the last seven local days, newest first. */
export function useKicksWeek(pregnancyId: string | undefined, day: string) {
  return useVaultQuery(pregnancyId, ['readings', 'kicks-week', day], async (store, pid) =>
    Promise.all(lastSevenDays(day).map(async (d) => (await store.list(pid, tallyKind('kicks', d))).length)),
  );
}

const photosKey = (pregnancyId: string | undefined) => vaultQueryKey(pregnancyId, 'bump-photos');

export type DiaryPhoto = BumpPhoto & { id: string };

/** The bump diary, oldest week first. Thumbnails only. */
export function useBumpPhotos(pregnancyId: string | undefined) {
  return useVaultQuery(pregnancyId, ['bump-photos'], async (store, pid): Promise<DiaryPhoto[]> =>
    inDiaryOrder(await listItems<BumpPhoto>(store, pid, PHOTO_KIND)).map((item) => ({ id: item.id, ...item.data })),
  );
}

/**
 * One photo at full size. Null while it is still on its way from the other
 * phone (the diary entry can arrive a moment before the picture).
 */
export function useBumpImage(pregnancyId: string | undefined, imageId: string | undefined) {
  return useVaultQuery(pregnancyId, ['bump-photos', 'image', imageId ?? 'none'], async (store) => {
    if (!imageId) return null;
    const record = await store.get(imageId);
    return record && !record.deleted ? (record.data as BumpImage).jpeg : null;
  });
}

export function useAddBumpPhoto(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  const { session } = useSession();
  return useMutation({
    mutationFn: async ({ photo, week, day }: { photo: ShrunkPhoto; week: number; day: string }) => {
      const id = newId();
      const imageId = newId();
      // The picture first, so the other phone never gets an entry whose picture was never saved.
      const image: BumpImage = { photoId: id, jpeg: photo.jpeg };
      await saveItem(vault, { id: imageId, pregnancyId: pregnancyId!, kind: IMAGE_KIND, data: image });
      const entry: BumpPhoto = {
        week,
        day,
        imageId,
        thumb: photo.thumb,
        width: photo.width,
        height: photo.height,
        by: session?.user.id ?? '',
      };
      await saveItem(vault, { id, pregnancyId: pregnancyId!, kind: PHOTO_KIND, data: entry });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: photosKey(pregnancyId) }),
  });
}

/** Deletes a photo from the diary and its picture, on both phones. */
export function useRemoveBumpPhoto(pregnancyId: string | undefined) {
  const queryClient = useQueryClient();
  const vault = useVault();
  return useMutation({
    mutationFn: (photo: Pick<DiaryPhoto, 'id' | 'imageId'>) => removeItems(vault, [photo.id, photo.imageId]),
    onSettled: () => queryClient.invalidateQueries({ queryKey: photosKey(pregnancyId) }),
  });
}
