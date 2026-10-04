import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { MAX_PDF_BYTES, SCAN_EDGE, ScanFailure, fileForScan, pickScanFile, scanReport } from '@/lib/scan';
import { supabase } from '@/lib/supabase';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ SaveFormat: { JPEG: 'jpeg' }, ImageManipulator: { manipulate: jest.fn() } }));
jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));

const picker = jest.mocked(ImagePicker);
const documents = jest.mocked(DocumentPicker);
const invoke = jest.mocked(supabase.functions.invoke);

beforeEach(() => jest.clearAllMocks());

describe('pickScanFile', () => {
  it('takes a photo with the camera after asking', async () => {
    picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///c.jpg', width: 3000, height: 4000, fileName: null }] } as never);
    expect(await pickScanFile('camera')).toEqual({
      status: 'picked',
      file: { name: 'Photo', uri: 'file:///c.jpg', mediaType: 'image', width: 3000, height: 4000 },
    });
    expect(picker.requestCameraPermissionsAsync).toHaveBeenCalled();
  });

  it('says when permission is refused, and does not open the library', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValueOnce({ granted: false } as never);
    expect(await pickScanFile('library')).toEqual({ status: 'denied' });
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('keeps the library photo’s file name', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'u', width: 1, height: 2, fileName: 'IMG_1.HEIC' }] } as never);
    expect(await pickScanFile('library')).toMatchObject({ status: 'picked', file: { name: 'IMG_1.HEIC' } });
  });

  it('picks a PDF, refusing one that is too big', async () => {
    documents.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [{ name: 'cbc.pdf', uri: 'file:///cbc.pdf', size: 2000 }] } as never);
    expect(await pickScanFile('pdf')).toEqual({
      status: 'picked',
      file: { name: 'cbc.pdf', uri: 'file:///cbc.pdf', mediaType: 'application/pdf', width: 0, height: 0 },
    });
    expect(documents.getDocumentAsync).toHaveBeenCalledWith(expect.objectContaining({ type: 'application/pdf' }));
    documents.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [{ name: 'big.pdf', uri: 'u', size: MAX_PDF_BYTES + 1 }] } as never);
    expect(await pickScanFile('pdf')).toEqual({ status: 'too_large' });
    documents.getDocumentAsync.mockResolvedValueOnce({ canceled: true, assets: null } as never);
    expect(await pickScanFile('pdf')).toEqual({ status: 'cancelled' });
  });
});

describe('fileForScan', () => {
  it('shrinks a photo to a JPEG Claude can read', async () => {
    const resize = jest.fn();
    const saveAsync = jest.fn(async () => ({ base64: 'SlBFRw==' }));
    const context = { resize, renderAsync: async () => ({ saveAsync, release: jest.fn() }), release: jest.fn() };
    resize.mockReturnValue(context);
    jest.mocked(ImageManipulator.manipulate).mockReturnValue(context as never);
    const out = await fileForScan({ name: 'p', uri: 'file:///p.jpg', mediaType: 'image', width: 3000, height: 4000 });
    expect(out).toEqual({ mediaType: 'image/jpeg', data: 'SlBFRw==' });
    expect(resize).toHaveBeenCalledWith({ height: SCAN_EDGE });
    expect(saveAsync).toHaveBeenCalledWith(expect.objectContaining({ base64: true, format: 'jpeg' }));
    expect(context.release).toHaveBeenCalled();
  });

  it('reads a PDF as it is', async () => {
    jest.mocked(File).mockImplementation(() => ({ base64: async () => 'JVBERi0=' }) as never);
    expect(await fileForScan({ name: 'r.pdf', uri: 'file:///r.pdf', mediaType: 'application/pdf', width: 0, height: 0 })).toEqual({
      mediaType: 'application/pdf',
      data: 'JVBERi0=',
    });
    expect(File).toHaveBeenCalledWith('file:///r.pdf');
  });
});

describe('scanReport', () => {
  const input = { pregnancyId: 'p1', file: { mediaType: 'image/jpeg', data: 'SlBFRw==' }, week: 24 };
  const httpError = (status: number, body: unknown) => ({
    name: 'FunctionsHttpError',
    context: { status, json: async () => body },
  });
  const failure = async () => {
    try {
      await scanReport(input);
    } catch (e) {
      return (e as ScanFailure).code;
    }
    throw new Error('did not fail');
  };

  it('sends the file to the scan function and returns the draft', async () => {
    invoke.mockResolvedValueOnce({ data: { draft: { title: 'CBC' } }, error: null } as never);
    expect(await scanReport(input)).toEqual({ title: 'CBC' });
    expect(invoke).toHaveBeenCalledWith('scan', {
      body: { kind: 'report', pregnancyId: 'p1', file: { mediaType: 'image/jpeg', data: 'SlBFRw==' }, week: 24 },
    });
  });

  it.each([
    [httpError(429, { error: 'daily_limit' }), 'daily_limit'],
    [httpError(503, { error: 'not_configured' }), 'not_set_up'],
    [httpError(404, { message: 'Function not found' }), 'not_set_up'],
    [httpError(422, { error: 'unreadable' }), 'unreadable'],
    [httpError(413, { error: 'too_large' }), 'too_large'],
    [httpError(403, { error: 'not_member' }), 'not_member'],
    [httpError(401, { msg: 'Invalid JWT' }), 'not_member'],
    [httpError(502, { error: 'ai_failed' }), 'failed'],
    [{ name: 'FunctionsHttpError', context: { status: 500, json: async () => Promise.reject(new Error('html')) } }, 'failed'],
    [{ name: 'FunctionsFetchError', context: new TypeError('Network request failed') }, 'offline'],
  ])('turns %j into %s', async (error, code) => {
    invoke.mockResolvedValueOnce({ data: null, error } as never);
    expect(await failure()).toBe(code);
  });

  it('treats an answer without a draft as a failure', async () => {
    invoke.mockResolvedValueOnce({ data: {}, error: null } as never);
    expect(await failure()).toBe('failed');
  });
});
