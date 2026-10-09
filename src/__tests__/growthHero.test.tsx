import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { FruitParade, sizeSentence, weeksAway } from '@/components/FruitParade';
import { LifeSizeSheet } from '@/components/LifeSizeSheet';
import { Postcard } from '@/components/Postcard';
import { POSTCARDS } from '@/content/postcards';
import { usePostcardSeen } from '@/lib/postcards';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});

describe('The fruit parade', () => {
  it('opens on this week, with its size, and shows any other week when tapped', async () => {
    const onLifeSize = jest.fn();
    await render(<FruitParade weeks={24} onLifeSize={onLifeSize} />);
    expect(screen.getByText('WEEK 24 · THIS WEEK')).toBeTruthy();
    expect(screen.getByText('An ear of corn')).toBeTruthy();
    expect(screen.getByText('Baby is about 30 cm long and 600 g')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Week 28, an aubergine' }));
    expect(screen.getByText('WEEK 28 · IN 4 WEEKS')).toBeTruthy();
    expect(screen.getByText('Baby will be about 38 cm long and 1.0 kg')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'See an aubergine at life size' }));
    expect(onLifeSize).toHaveBeenCalledWith(28);
  });

  it('marks this week and lists every week from 4 to 41', async () => {
    await render(<FruitParade weeks={24} onLifeSize={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Week 24, an ear of corn, this week' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Week 4, a poppy seed' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Week 41, a watermelon' })).toBeTruthy();
  });

  it('waits for week 4 before showing sizes', async () => {
    await render(<FruitParade weeks={2} onLifeSize={jest.fn()} />);
    expect(screen.getByText('Your fruit parade starts in week 4.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /life size/ })).toBeNull();
  });

  it('words the size for the week picked, and for twins', () => {
    expect(weeksAway(23, 24)).toBe('1 week ago');
    expect(sizeSentence(12, 24, 2)).toBe('Each baby was about 5.4 cm long and 14 g');
    expect(sizeSentence(5, 5)).toBe('Baby is about 2 mm long and weighs under 1 g');
  });
});

describe('The life-size sheet', () => {
  it('compares the length and weight', async () => {
    await render(<LifeSizeSheet week={24} onClose={jest.fn()} />);
    expect(screen.getByText('Life size · week 24')).toBeTruthy();
    expect(screen.getByText('30 cm, head to heel')).toBeTruthy();
    expect(screen.getByText('About as heavy as a bag of pasta')).toBeTruthy();
  });
});

describe('The postcard', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    usePostcardSeen.setState({ week: null });
  });

  it('turns over to the baby’s note and back, and counts as read the first time', async () => {
    const onRead = jest.fn();
    await render(<Postcard week={24} postmark="6 OCT" fresh onRead={onRead} />);
    await act(async () => {});
    const front = screen.getByRole('button', { name: 'Postcard from your baby, week 24, new' });
    expect(screen.getByText('Week 24')).toBeTruthy();
    expect(screen.getByText('NEW')).toBeTruthy();

    await fireEvent.press(front);
    expect(screen.getByText(POSTCARDS[24])).toBeTruthy();
    expect(screen.getByText('To: both of you')).toBeTruthy();
    expect(screen.getByText('From your baby')).toBeTruthy();
    expect(onRead).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('button', { name: `Postcard, week 24: ${POSTCARDS[24]}` }));
    expect(screen.getByText('Week 24')).toBeTruthy();
    expect(onRead).toHaveBeenCalledTimes(1);
  });

  it('remembers on this phone which week was read, so the sticker goes', async () => {
    await usePostcardSeen.getState().load();
    expect(usePostcardSeen.getState().week).toBe(0);
    await usePostcardSeen.getState().markSeen(24);
    usePostcardSeen.setState({ week: null });
    await usePostcardSeen.getState().load();
    expect(usePostcardSeen.getState().week).toBe(24);
  });
});
