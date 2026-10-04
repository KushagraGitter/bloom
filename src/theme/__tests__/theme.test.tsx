import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Appearance, Pressable } from 'react-native';

import { Card, Text } from '@/components';
import { APPEARANCE_KEY, ThemeProvider, useAppearance, useTheme } from '@/theme/theme';
import { accents, palettes } from '@/theme/tokens';

let mockSystem: 'light' | 'dark' | null = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockSystem,
}));

function Probe() {
  const { scheme, colors } = useTheme();
  const { appearance, setAppearance } = useAppearance();
  return (
    <>
      <Text testID="scheme">{`${scheme} ${appearance} ${colors.ground}`}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Go dark" onPress={() => setAppearance('dark')} />
    </>
  );
}

const show = async (ui: React.ReactElement) => {
  await render(<ThemeProvider>{ui}</ThemeProvider>);
};

beforeEach(async () => {
  mockSystem = 'light';
  await AsyncStorage.clear();
  jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
});

describe('ThemeProvider', () => {
  it('follows the phone when nothing is saved', async () => {
    mockSystem = 'dark';
    await show(<Probe />);
    expect(await screen.findByText(`dark system ${palettes.dark.ground}`)).toBeTruthy();
    expect(Appearance.setColorScheme).toHaveBeenCalledWith('unspecified');
  });

  it('uses the saved choice over the phone setting', async () => {
    mockSystem = 'dark';
    await AsyncStorage.setItem(APPEARANCE_KEY, 'light');
    await show(<Probe />);
    expect(await screen.findByText(`light light ${palettes.light.ground}`)).toBeTruthy();
    expect(Appearance.setColorScheme).toHaveBeenCalledWith('light');
  });

  it('saves a new choice on the phone and switches at once', async () => {
    await show(<Probe />);
    await screen.findByText(`light system ${palettes.light.ground}`);
    await fireEvent.press(screen.getByLabelText('Go dark'));
    expect(screen.getByText(`dark dark ${palettes.dark.ground}`)).toBeTruthy();
    expect(await AsyncStorage.getItem(APPEARANCE_KEY)).toBe('dark');
    expect(Appearance.setColorScheme).toHaveBeenLastCalledWith('dark');
  });

  it('ignores a saved value it does not know', async () => {
    mockSystem = 'dark';
    await AsyncStorage.setItem(APPEARANCE_KEY, 'sepia');
    await show(<Probe />);
    expect(await screen.findByText(`dark system ${palettes.dark.ground}`)).toBeTruthy();
  });
});

describe('dark mode', () => {
  beforeEach(() => {
    mockSystem = 'dark';
  });

  it('draws text and cards in the dark palette', async () => {
    await show(
      <Card testID="card">
        <Text>Folic acid</Text>
      </Card>,
    );
    expect(await screen.findByText('Folic acid')).toHaveStyle({ color: palettes.dark.ink });
    expect(screen.getByTestId('card')).toHaveStyle({ backgroundColor: palettes.dark.surface, borderColor: palettes.dark.outline });
  });

  it('keeps dark ink on an accent card, with a chalk outline around it', async () => {
    await show(
      <Card testID="card" tone={accents.yellow}>
        <Text>Week 24</Text>
        <Text muted>Size of corn</Text>
      </Card>,
    );
    expect(await screen.findByText('Week 24')).toHaveStyle({ color: accents.onAccent });
    expect(screen.getByText('Size of corn')).toHaveStyle({ color: accents.onAccentMuted });
    expect(screen.getByTestId('card')).toHaveStyle({ borderColor: palettes.dark.outline });
  });
});

describe('colours', () => {
  it('come from the theme, so no screen or component hard-codes one', () => {
    const fs: {
      readdirSync(path: string): string[];
      readFileSync(path: string, encoding: 'utf8'): string;
      statSync(path: string): { isDirectory(): boolean };
    } = jest.requireActual('fs');
    const join = (...parts: string[]) => parts.join('/');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of fs.readdirSync(dir)) {
        const path = join(dir, name);
        if (fs.statSync(path).isDirectory()) {
          if (name !== '__tests__' && name !== 'theme') walk(path);
        } else if (/\.tsx?$/.test(name)) {
          const text = fs.readFileSync(path, 'utf8');
          if (/['"`]#[0-9A-Fa-f]{3,8}['"`]|rgba?\(/.test(text)) offenders.push(path);
        }
      }
    };
    const src = expect.getState().testPath!.replace(/\/theme\/__tests__\/[^/]+$/, '');
    walk(src);
    expect(src.endsWith('/src')).toBe(true);
    expect(offenders).toEqual([]);
  });

  it('every text pairing in the dark palette is readable', () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const d = palettes.dark;
    for (const [fg, bg] of [
      [d.ink, d.ground],
      [d.ink, d.surface],
      [d.inkMuted, d.surface],
      [d.link, d.surface],
      [d.purpleDark, d.surface],
      [d.ink, d.highlight],
      [d.surface, d.ink],
      [accents.onAccent, accents.yellow],
      [accents.onAccent, accents.orange],
    ]) {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
