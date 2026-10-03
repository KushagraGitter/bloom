// qrcode's pure encoder, imported directly so no bundler picks its Node
// (file and canvas) entry point. Only what QrCode.tsx uses.
declare module 'qrcode/lib/core/qrcode' {
  export function create(
    text: string,
    options?: { errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' },
  ): { modules: { size: number; get(row: number, col: number): number } };
}
