import { useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet, Button, Card, Screen, Text } from '@/components';
import { VaultNotice } from '@/components/VaultNotice';
import { jpegUri, pickPhoto, shrinkPhoto, type PickedPhoto, type ShrunkPhoto } from '@/lib/bumpPhotos';
import { confirmRemove } from '@/lib/confirm';
import { useLocalToday, useMembership } from '@/lib/data';
import { gestationalAge } from '@/lib/pregnancy';
import { formatDate } from '@/lib/profile';
import { METRICS, TRIMESTERS, buildChart, journeyFill, kicksAverage, sleepAverage, weekOnDay, type Metric } from '@/lib/progress';
import {
  useAddBumpPhoto,
  useBumpImage,
  useBumpPhotos,
  useCheckinHistory,
  useKicksWeek,
  useRemoveBumpPhoto,
  type DiaryPhoto,
} from '@/lib/useProgress';
import { useVault } from '@/lib/vault/VaultProvider';
import { makeStyles, useTheme } from '@/theme/theme';
import { accents, fonts, radius, touchTarget } from '@/theme/tokens';

/** Weeks a photo can be filed under. */
const MAX_WEEK = 42;

/** Bar fills from the design: the latest week stands out. */
const BAR_TONES: Record<Metric, string> = { weight: accents.purple, bp: accents.orange, sugar: accents.yellow };

export default function ProgressScreen() {
  const styles = useStyles();
  const membership = useMembership();
  const pregnancy = membership.data?.pregnancy;
  const day = useLocalToday();

  // The root layout only shows the tabs once a pregnancy exists.
  if (!pregnancy) return null;

  const ga = gestationalAge(pregnancy.lmp_date, day);

  return (
    <Screen>
      <View style={styles.header}>
        <Text muted style={styles.kicker}>
          Week {ga.weeks} of 40
        </Text>
        <Text variant="screenTitle" accessibilityRole="header">
          Progress
        </Text>
      </View>

      <VaultNotice />

      <Journey totalDays={ga.totalDays} trimester={ga.trimester} />

      <WeeklyChart pregnancyId={pregnancy.id} lmpDate={pregnancy.lmp_date} units={pregnancy.units} />

      <BumpDiary pregnancyId={pregnancy.id} lmpDate={pregnancy.lmp_date} today={day} />

      <Averages pregnancyId={pregnancy.id} day={day} />
    </Screen>
  );
}

function Journey({ totalDays, trimester }: { totalDays: number; trimester: 1 | 2 | 3 }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const fill = journeyFill(totalDays);
  return (
    <Card size="panel" elevation="lg" style={styles.panel} accessible accessibilityLabel={`Journey: trimester ${trimester} of 3`}>
      <Text style={styles.overline}>JOURNEY</Text>
      <View style={styles.journey}>
        {TRIMESTERS.map((t, i) => (
          <View
            key={t.label}
            style={[
              styles.segment,
              { flex: t.weeks },
              i === 0 && styles.segmentFirst,
              i === TRIMESTERS.length - 1 && styles.segmentLast,
            ]}>
            <View
              testID={`journey-${i + 1}`}
              style={[styles.segmentFill, { width: `${Math.round(fill[i] * 100)}%`, backgroundColor: fill[i] >= 1 ? colors.mint : colors.yellow }]}
            />
          </View>
        ))}
      </View>
      <View style={styles.journeyLabels}>
        {TRIMESTERS.map((t, i) => (
          <Text key={t.label} style={[styles.journeyLabel, { flex: t.weeks }, i === TRIMESTERS.length - 1 && styles.right]}>
            {t.label}
            {i + 1 === trimester ? ' · you’re here' : ''}
          </Text>
        ))}
      </View>
    </Card>
  );
}

function WeeklyChart({ pregnancyId, lmpDate, units }: { pregnancyId: string; lmpDate: string; units: 'metric' | 'imperial' }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const history = useCheckinHistory(pregnancyId);
  const [metric, setMetric] = useState<Metric>('weight');
  const chart = buildChart(history.data ?? [], metric, lmpDate, units);
  const last = chart.bars.length - 1;

  return (
    <Card size="panel" style={styles.panel}>
      <View style={styles.chartHead}>
        <Text variant="title" accessibilityRole="header">
          {chart.title}
        </Text>
        <View style={styles.switcher} accessibilityRole="radiogroup">
          {METRICS.map((m) => {
            const on = m.key === metric;
            return (
              <Pressable
                key={m.key}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={m.label === 'BP' ? 'Blood pressure' : m.label}
                onPress={() => setMetric(m.key)}
                style={[styles.switch, on && styles.switchOn]}>
                <Text style={[styles.switchText, on && styles.switchTextOn]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {history.isSuccess && chart.bars.length === 0 && <Text muted>{chart.empty}</Text>}
      {history.isError && <Text muted>Couldn&apos;t load your check-ins.</Text>}

      {chart.bars.length > 0 && (
        <>
          <View
            style={styles.bars}
            accessible
            accessibilityLabel={chart.bars.map((b) => `Week ${b.week}: ${b.label}`).join(', ')}>
            {chart.bars.map((b, i) => (
              <View key={b.week} style={styles.barCol}>
                <Text style={styles.barValue}>{b.label}</Text>
                <View
                  testID={`bar-${b.week}`}
                  style={[styles.bar, { height: `${Math.round(b.height * 100)}%`, backgroundColor: i === last ? BAR_TONES[metric] : colors.line }]}
                />
              </View>
            ))}
          </View>
          <View style={styles.weekRow}>
            {chart.bars.map((b) => (
              <Text key={b.week} style={styles.weekLabel}>
                W{b.week}
              </Text>
            ))}
          </View>
          {chart.note && <Text style={styles.note}>{chart.note}</Text>}
        </>
      )}
    </Card>
  );
}

type Adding = { step: 'source' } | { step: 'preparing' } | { step: 'review'; photo: ShrunkPhoto; week: number } | { step: 'error'; message: string; settings?: boolean };

function BumpDiary({ pregnancyId, lmpDate, today }: { pregnancyId: string; lmpDate: string; today: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const vault = useVault();
  const photos = useBumpPhotos(pregnancyId);
  const add = useAddBumpPhoto(pregnancyId);
  const [adding, setAdding] = useState<Adding | null>(null);
  const [open, setOpen] = useState<DiaryPhoto | null>(null);
  const thisWeek = weekOnDay(lmpDate, today);

  /** The week a library photo was taken in, when its date is during the pregnancy; otherwise this week. */
  const weekFor = (picked: PickedPhoto) =>
    picked.takenOn && picked.takenOn >= lmpDate && picked.takenOn <= today ? weekOnDay(lmpDate, picked.takenOn) : thisWeek;

  const choose = async (source: 'camera' | 'library') => {
    setAdding({ step: 'preparing' });
    try {
      const picked = await pickPhoto(source);
      if (picked.status === 'cancelled') return setAdding(null);
      if (picked.status === 'denied') {
        return setAdding({
          step: 'error',
          message: source === 'camera' ? 'Bloom isn’t allowed to use the camera.' : 'Bloom isn’t allowed to see your photos.',
          settings: true,
        });
      }
      const photo = await shrinkPhoto(picked.photo);
      setAdding({ step: 'review', photo, week: weekFor(picked.photo) });
    } catch {
      setAdding({ step: 'error', message: 'That photo couldn’t be opened. Try another one.' });
    }
  };

  const close = () => {
    add.reset();
    setAdding(null);
  };

  const list = photos.data ?? [];

  return (
    <View style={styles.section}>
      <View style={styles.diaryHead}>
        <Text variant="title" accessibilityRole="header">
          Bump diary
        </Text>
        {vault.state === 'ready' && (
          <Pressable accessibilityRole="button" accessibilityLabel="Add a bump photo" onPress={() => setAdding({ step: 'source' })} style={styles.addPhoto}>
            <Text style={styles.addPhotoText}>+ Photo</Text>
          </Pressable>
        )}
      </View>
      {photos.isSuccess && list.length === 0 && <Text muted>Add a photo every few weeks and watch the bump grow. Photos stay locked on your phones.</Text>}
      {photos.isError && <Text muted>Couldn&apos;t load the photos.</Text>}
      <View style={styles.grid}>
        {list.map((p, i) => (
          <Pressable
            key={p.id}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Bump photo, week ${p.week}`}
            onPress={() => setOpen(p)}
            style={[styles.thumb, i === list.length - 1 && styles.thumbLatest]}>
            <Image source={{ uri: jpegUri(p.thumb) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <Text style={styles.thumbLabel}>W{p.week}</Text>
          </Pressable>
        ))}
      </View>

      <BottomSheet visible={adding?.step === 'source' || adding?.step === 'preparing' || adding?.step === 'error'} onClose={close} title="Add a bump photo">
        {adding?.step === 'preparing' ? (
          <View style={styles.preparing}>
            <ActivityIndicator color={colors.ink} />
            <Text muted>Getting the photo ready…</Text>
          </View>
        ) : adding?.step === 'error' ? (
          <>
            <Text accessibilityRole="alert" style={styles.error}>
              {adding.message}
            </Text>
            {adding.settings && <Button label="Open Settings" onPress={() => Linking.openSettings()} />}
            <Button label="Try again" variant="dark" onPress={() => setAdding({ step: 'source' })} />
          </>
        ) : (
          <>
            <Text muted>The photo is shrunk and locked with your household key before it leaves this phone.</Text>
            <Button label="Take a photo" variant="dark" onPress={() => choose('camera')} />
            <Button label="Choose from your photos" onPress={() => choose('library')} />
          </>
        )}
      </BottomSheet>

      <BottomSheet visible={adding?.step === 'review'} onClose={close} title="Add to the diary">
        {adding?.step === 'review' && (
          <>
            <Image
              accessibilityLabel="The new photo"
              source={{ uri: jpegUri(adding.photo.thumb) }}
              style={[styles.preview, { aspectRatio: adding.photo.width / adding.photo.height || 0.75 }]}
              resizeMode="contain"
            />
            <View style={styles.stepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="One week earlier"
                disabled={adding.week <= 0}
                onPress={() => setAdding({ ...adding, week: adding.week - 1 })}
                style={[styles.step, adding.week <= 0 && styles.disabled]}>
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text style={styles.stepWeek} accessibilityLiveRegion="polite">
                Week {adding.week}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="One week later"
                disabled={adding.week >= MAX_WEEK}
                onPress={() => setAdding({ ...adding, week: adding.week + 1 })}
                style={[styles.step, adding.week >= MAX_WEEK && styles.disabled]}>
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
            {add.isError && (
              <Text accessibilityRole="alert" style={styles.error}>
                Couldn&apos;t save the photo. Try again.
              </Text>
            )}
            <View style={styles.row}>
              <Button label="Cancel" onPress={close} style={styles.half} />
              <Button
                label={add.isPending ? 'Saving…' : 'Save'}
                variant="dark"
                disabled={add.isPending}
                onPress={() => add.mutate({ photo: adding.photo, week: adding.week, day: today }, { onSuccess: close })}
                style={styles.half}
              />
            </View>
          </>
        )}
      </BottomSheet>

      <PhotoViewer pregnancyId={pregnancyId} photo={open} onClose={() => setOpen(null)} />
    </View>
  );
}

function PhotoViewer({ pregnancyId, photo, onClose }: { pregnancyId: string; photo: DiaryPhoto | null; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const image = useBumpImage(pregnancyId, photo?.imageId);
  const remove = useRemoveBumpPhoto(pregnancyId);
  const close = () => {
    remove.reset();
    onClose();
  };
  const askRemove = () =>
    photo &&
    confirmRemove('Remove this photo?', 'It will be deleted from both phones.', () => remove.mutate(photo, { onSuccess: close }));

  return (
    <Modal visible={!!photo} animationType="fade" onRequestClose={close} statusBarTranslucent>
      <SafeAreaView style={styles.viewer}>
        <View style={styles.viewerImage}>
          {image.data ? (
            <Image accessibilityLabel={`Week ${photo?.week} bump photo, full size`} source={{ uri: jpegUri(image.data) }} style={StyleSheet.absoluteFill} resizeMode="contain" />
          ) : photo ? (
            <>
              <Image source={{ uri: jpegUri(photo.thumb) }} style={StyleSheet.absoluteFill} resizeMode="contain" blurRadius={image.isSuccess ? 0 : 2} />
              {image.isSuccess && <Text style={styles.viewerWait}>The full photo is still on its way from the other phone.</Text>}
            </>
          ) : null}
        </View>
        {photo && (
          <View style={styles.viewerBar}>
            <Text variant="title" color={colors.onPurple}>
              Week {photo.week}
            </Text>
            <Text color={colors.onPurple}>Added {formatDate(photo.day)}</Text>
            {remove.isError && (
              <Text accessibilityRole="alert" color={colors.pink}>
                Couldn&apos;t remove it. Try again.
              </Text>
            )}
            <View style={styles.row}>
              <Button label="Remove" onPress={askRemove} style={styles.half} />
              <Button label="Close" variant="dark" onPress={close} style={[styles.half, styles.onDark]} />
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function Averages({ pregnancyId, day }: { pregnancyId: string; day: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const kicks = useKicksWeek(pregnancyId, day);
  const history = useCheckinHistory(pregnancyId);
  const kickAvg = kicks.data ? kicksAverage(kicks.data) : null;
  const sleep = history.data ? sleepAverage(history.data, day) : null;
  return (
    <View style={styles.stats}>
      <Card tone={colors.mint} style={styles.stat}>
        <Text variant="label">Kicks · 7-day avg</Text>
        <Text variant="stat">{kickAvg === null ? '—' : `${kickAvg} / day`}</Text>
        {kickAvg === null && <Text variant="caption" color={colors.onAccent}>None counted this week</Text>}
      </Card>
      <Card tone={colors.pink} style={styles.stat}>
        <Text variant="label">Sleep · 7-day avg</Text>
        <Text variant="stat">{sleep ?? '—'}</Text>
        {sleep === null && <Text variant="caption" color={colors.onAccent}>None logged this week</Text>}
      </Card>
    </View>
  );
}

const useStyles = makeStyles(({ colors, border }) => ({
  header: { gap: 2 },
  kicker: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  panel: { padding: 18, gap: 12 },
  overline: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 1, color: colors.inkMuted },
  journey: { flexDirection: 'row', gap: 4, height: 26 },
  segment: {
    borderWidth: border.width,
    borderColor: border.color,
    borderRadius: 4,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  segmentFirst: { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
  segmentLast: { borderTopRightRadius: 10, borderBottomRightRadius: 10 },
  segmentFill: { height: '100%' },
  journeyLabels: { flexDirection: 'row' },
  journeyLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  right: { textAlign: 'right' },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  switcher: { flexDirection: 'row', gap: 4, padding: 3, borderWidth: border.width, borderColor: border.color, borderRadius: radius.pill },
  switch: { minHeight: 36, minWidth: touchTarget, paddingHorizontal: 12, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  switchOn: { backgroundColor: colors.ink },
  switchText: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.ink },
  switchTextOn: { color: colors.surface },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 150, paddingTop: 22, borderBottomWidth: border.width, borderColor: border.color },
  barCol: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  barValue: { fontFamily: fonts.bodyHeavy, fontSize: 10, color: colors.ink },
  bar: {
    width: '100%',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderWidth: border.width,
    borderBottomWidth: 0,
    borderColor: border.color,
  },
  weekRow: { flexDirection: 'row', gap: 8 },
  weekLabel: { flex: 1, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 11, color: colors.inkMuted },
  note: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkMuted },
  section: { gap: 10 },
  diaryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addPhoto: {
    minHeight: touchTarget,
    paddingHorizontal: 14,
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.orange,
    justifyContent: 'center',
  },
  addPhotoText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.onAccent },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumb: {
    width: '31%',
    flexGrow: 0,
    aspectRatio: 3 / 4,
    borderRadius: 18,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.line,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    padding: 8,
  },
  thumbLatest: { backgroundColor: colors.highlightWarm },
  thumbLabel: {
    fontFamily: fonts.bodyHeavy,
    fontSize: 12,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: border.width,
    borderColor: border.color,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  preparing: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  error: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.purpleDark },
  preview: { width: '100%', maxHeight: 320, borderRadius: radius.card, borderWidth: border.width, borderColor: border.color, backgroundColor: colors.surface },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  step: {
    width: 48,
    height: 48,
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontFamily: fonts.bodyHeavy, fontSize: 22, color: colors.ink },
  stepWeek: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, minWidth: 110, textAlign: 'center' },
  disabled: { opacity: 0.4 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  viewer: { flex: 1, backgroundColor: colors.photo },
  viewerImage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  viewerWait: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.onPurple, textAlign: 'center', backgroundColor: colors.photoScrim, padding: 12, borderRadius: radius.button, overflow: 'hidden' },
  viewerBar: { padding: 20, gap: 8 },
  onDark: { borderColor: colors.surface },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, borderRadius: radius.card, gap: 4 },
}));
