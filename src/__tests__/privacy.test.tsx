import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import PrivacyScreen from '@/app/privacy';
import { PRIVACY_POLICY, PRIVACY_POLICY_URL } from '@/lib/privacyPolicy';

jest.mock('expo-router', () => ({ router: { canGoBack: () => false, back: jest.fn(), replace: jest.fn() } }));

describe('privacy screen', () => {
  it('shows every section of the policy and links to the web copy', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await render(<PrivacyScreen />);
    for (const s of PRIVACY_POLICY.sections) expect(screen.getByText(s.heading)).toBeTruthy();
    expect(screen.queryByText(/\{contact\}/)).toBeNull();
    await fireEvent.press(screen.getByText('Read this on the web'));
    expect(open).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
  });
});
