import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator } from 'expo-image-manipulator';

import { exifDay, fitWithin, inDiaryOrder, pickPhoto, shrinkPhoto } from '@/lib/bumpPhotos';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: { manipulate: jest.fn() },
}));

const picker = jest.mocked(ImagePicker);
const manipulate = jest.mocked(ImageManipulator.manipulate);

beforeEach(() => jest.clearAllMocks());

describe('exifDay', () => {
  it('reads the day a photo was taken', () => {
    expect(exifDay({ DateTimeOriginal: '2026:09:12 18:01:44' })).toBe('2026-09-12');
    expect(exifDay({ DateTime: '2026:09:13 08:00:00' })).toBe('2026-09-13');
    expect(exifDay({ DateTimeOriginal: 'yesterday' })).toBeNull();
    expect(exifDay(null)).toBeNull();
  });
});

describe('fitWithin', () => {
  it('scales the long side down to the edge and never up', () => {
    expect(fitWithin(4032, 3024, 1280)).toEqual({ width: 1280 });
    expect(fitWithin(3024, 4032, 1280)).toEqual({ height: 1280 });
    expect(fitWithin(800, 600, 1280)).toEqual({ width: 800 });
    expect(fitWithin(0, 0, 1280)).toEqual({ width: 1280 });
  });
});

describe('pickPhoto', () => {
  const granted = { granted: true } as never;

  it('says so when permission is refused, without opening anything', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as never);
    expect(await pickPhoto('camera')).toEqual({ status: 'denied' });
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('returns nothing when she backs out', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue(granted);
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
    expect(await pickPhoto('library')).toEqual({ status: 'cancelled' });
  });

  it('keeps the day a library photo was taken', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue(granted);
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///a.jpg', width: 3024, height: 4032, exif: { DateTimeOriginal: '2026:09:12 18:01:44' } } as never],
    });
    expect(await pickPhoto('library')).toEqual({
      status: 'picked',
      photo: { uri: 'file:///a.jpg', width: 3024, height: 4032, takenOn: '2026-09-12' },
    });
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ['images'], exif: true }));
  });

  it('takes a camera photo as of now', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue(granted);
    picker.launchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///b.jpg', width: 4032, height: 3024, exif: { DateTimeOriginal: '2020:01:01 00:00:00' } } as never],
    });
    expect(await pickPhoto('camera')).toEqual({ status: 'picked', photo: { uri: 'file:///b.jpg', width: 4032, height: 3024, takenOn: null } });
  });
});

describe('shrinkPhoto', () => {
  it('makes a kept picture and a thumbnail as JPEG, and frees the native images', async () => {
    const released: string[] = [];
    manipulate.mockImplementation(() => {
      let size: { width?: number; height?: number } = {};
      const context = {
        resize: (s: typeof size) => {
          size = s;
          return context;
        },
        renderAsync: async () => ({
          saveAsync: async (options: { base64: boolean; compress: number; format: string }) => ({
            uri: 'file:///out.jpg',
            width: Math.round(((size.height ?? 0) * 3) / 4),
            height: size.height ?? 0,
            base64: `${options.format}-${options.compress}-${size.height}`,
          }),
          release: () => released.push('image'),
        }),
        release: () => released.push('context'),
      };
      return context as never;
    });

    expect(await shrinkPhoto({ uri: 'file:///a.jpg', width: 3024, height: 4032, takenOn: null })).toEqual({
      jpeg: 'jpeg-0.6-1280',
      thumb: 'jpeg-0.6-360',
      width: 960,
      height: 1280,
    });
    expect(manipulate).toHaveBeenCalledWith('file:///a.jpg');
    expect(released).toEqual(['image', 'context', 'image', 'context']);
  });

  it('fails when the picture comes back without its data', async () => {
    const release = jest.fn();
    manipulate.mockImplementation(() => {
      const context = {
        resize: () => context,
        renderAsync: async () => ({ saveAsync: async () => ({ uri: 'x', width: 1, height: 1 }), release }),
        release,
      };
      return context as never;
    });
    await expect(shrinkPhoto({ uri: 'file:///a.jpg', width: 10, height: 10, takenOn: null })).rejects.toThrow('couldn’t be read');
    expect(release).toHaveBeenCalledTimes(2);
  });
});

describe('inDiaryOrder', () => {
  it('sorts by week, then by day added', () => {
    const item = (id: string, week: number, day: string) => ({ id, updatedAt: '', data: { week, day } as never });
    const sorted = inDiaryOrder([item('c', 24, '2026-10-03'), item('a', 12, '2026-10-03'), item('b', 24, '2026-10-01')]);
    expect(sorted.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});
