import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BackButton, Button, Card, Chip, Screen, Text, TrashIcon } from '@/components';
import { VaultNotice } from '@/components/VaultNotice';
import { confirmRemove } from '@/lib/confirm';
import { useLocalToday, useMembers, useMembership } from '@/lib/data';
import {
  MOODS,
  NOTE_MAX,
  SYMPTOM_MAX,
  cleanSymptom,
  inListOrder,
  isBuiltIn,
  moodOf,
  symptomList,
  symptomsLine,
  whenLabel,
  type MoodKey,
} from '@/lib/mood';
import { useSession } from '@/lib/session';
import { useAddSymptom, useCustomSymptoms, useMoodEntries, useRemoveMood, useRemoveSymptom, useSaveMood } from '@/lib/useMood';
import { useVault } from '@/lib/vault/VaultProvider';
import { border, colors, fonts, radius, shadow } from '@/theme/tokens';

/** How many past entries the history shows. */
const HISTORY_SHOWN = 30;

export default function MoodScreen() {
  const { session } = useSession();
  const membership = useMembership();
  const pregnancyId = membership.data?.pregnancy.id;
  const today = useLocalToday();
  const vault = useVault();
  const entries = useMoodEntries(pregnancyId);
  const custom = useCustomSymptoms(pregnancyId);
  const members = useMembers(pregnancyId);
  const save = useSaveMood(pregnancyId);
  const removeEntry = useRemoveMood(pregnancyId);
  const addSymptom = useAddSymptom(pregnancyId);
  const removeSymptom = useRemoveSymptom(pregnancyId);

  const [mood, setMood] = useState<MoodKey | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  // The root layout only shows this screen once a pregnancy exists.
  if (!pregnancyId) return null;

  const ready = vault.state === 'ready';
  const customList = custom.data ?? [];
  const chips = symptomList(
    customList.map((c) => c.label),
    picked,
  );

  const changed = () => {
    setSaved(false);
    save.reset();
  };

  const toggle = (label: string) => {
    setPicked((p) => (p.includes(label) ? p.filter((l) => l !== label) : [...p, label]));
    changed();
  };

  const add = () => {
    const label = cleanSymptom(draft);
    if (!label) return;
    // Ticks the chip already on the list when it matches one, whatever its case.
    const existing = chips.find((c) => c.toLocaleLowerCase() === label.toLocaleLowerCase());
    if (!existing) addSymptom.mutate(label);
    const chip = existing ?? label;
    setPicked((p) => (p.includes(chip) ? p : [...p, chip]));
    setDraft('');
    changed();
  };

  const forget = (label: string) => {
    const ids = customList.filter((c) => c.label.toLocaleLowerCase() === label.toLocaleLowerCase()).map((c) => c.id);
    if (ids.length === 0) return;
    confirmRemove(`Take “${label}” off the list?`, 'Entries that already have it keep it.', () => removeSymptom.mutate(ids));
  };

  const submit = () => {
    if (!mood) return;
    save.mutate(
      { mood, symptoms: inListOrder(picked, chips), note },
      {
        onSuccess: () => {
          setSaved(true);
          setNote('');
        },
      },
    );
  };

  const nameOf = (userId: string) => {
    if (userId === session?.user.id) return null;
    return members.data?.find((m) => m.user_id === userId)?.name?.trim().split(' ')[0] ?? 'Partner';
  };

  const history = (entries.data ?? []).slice(0, HISTORY_SHOWN);
  const saveLabel = save.isPending ? 'Saving…' : saved ? 'Saved. Tap to save again' : mood ? 'Save today’s entry' : 'Pick a mood to save';

  return (
    <Screen keyboardAware>
      <BackButton label="Today" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />

      <View style={styles.header}>
        <Text muted style={styles.kicker}>
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
        </Text>
        <Text variant="screenTitle" accessibilityRole="header">
          How are you feeling?
        </Text>
      </View>

      <VaultNotice />

      <Card size="panel" elevation="lg" style={styles.moodCard}>
        <Text style={styles.overline} accessibilityRole="header">
          MOOD
        </Text>
        <View style={styles.moods} accessibilityRole="radiogroup" accessibilityLabel="Mood">
          {MOODS.map((m) => {
            const on = mood === m.key;
            return (
              <Pressable
                key={m.key}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={m.label}
                onPress={() => {
                  setMood(m.key);
                  changed();
                }}
                style={[styles.mood, on && styles.moodOn]}>
                <View style={[styles.face, { backgroundColor: m.tone }, on && styles.faceOn]}>
                  <Face mouth={m.mouth} />
                </View>
                <Text style={styles.moodLabel}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <View style={styles.section}>
        <Text variant="title" accessibilityRole="header">
          Symptoms today
        </Text>
        <View style={styles.chips}>
          {chips.map((label) => (
            <Chip
              key={label}
              label={label}
              mode="toggle"
              selected={picked.includes(label)}
              onPress={() => toggle(label)}
              onLongPress={isBuiltIn(label) ? undefined : () => forget(label)}
              accessibilityHint={isBuiltIn(label) ? undefined : 'Long press to take it off the list'}
            />
          ))}
        </View>
        <View style={styles.addRow}>
          <TextInput
            accessibilityLabel="Other symptom"
            value={draft}
            onChangeText={setDraft}
            placeholder="Something else?"
            placeholderTextColor={colors.inkMuted}
            maxLength={SYMPTOM_MAX}
            returnKeyType="done"
            onSubmitEditing={add}
            style={[styles.field, styles.addField]}
          />
          <Button label="Add" onPress={add} disabled={!cleanSymptom(draft)} />
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="title" accessibilityRole="header">
          Notes
        </Text>
        <TextInput
          accessibilityLabel="Notes"
          value={note}
          onChangeText={(t) => {
            setNote(t);
            changed();
          }}
          placeholder="Anything to remember or tell the doctor"
          placeholderTextColor={colors.inkMuted}
          multiline
          maxLength={NOTE_MAX}
          textAlignVertical="top"
          style={[styles.field, styles.note]}
        />
      </View>

      {save.isError && (
        <Text accessibilityRole="alert" style={styles.error}>
          Couldn&apos;t save. Try again.
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !mood || !ready || save.isPending }}
        disabled={!mood || !ready || save.isPending}
        onPress={submit}
        style={[styles.save, (!mood || !ready) && styles.saveIdle]}>
        <Text style={styles.saveText}>{saveLabel}</Text>
      </Pressable>

      <View style={styles.section}>
        <Text variant="title" accessibilityRole="header">
          History
        </Text>
        {entries.isSuccess && history.length === 0 && <Text muted>Saved entries show here, newest first.</Text>}
        {entries.isError && <Text muted>Couldn&apos;t load past entries.</Text>}
        {removeEntry.isError && (
          <Text accessibilityRole="alert" style={styles.error}>
            Couldn&apos;t remove that entry. Try again.
          </Text>
        )}
        {history.map((e) => {
          const m = moodOf(e.mood);
          const when = whenLabel(e, today);
          const who = nameOf(e.by);
          return (
            <View key={e.id} style={styles.entry}>
              <View style={[styles.dot, { backgroundColor: m?.tone ?? colors.surface }]} />
              <View style={styles.entryText}>
                <View style={styles.entryTop}>
                  <Text style={styles.entryMood}>{m?.label ?? 'Mood'}</Text>
                  <Text style={styles.entryWhen}>{when}</Text>
                </View>
                <Text style={styles.entrySymptoms}>{symptomsLine(e.symptoms)}</Text>
                {!!e.note && <Text muted style={styles.entryNote}>{e.note}</Text>}
                {who && <Text variant="caption">Logged by {who}</Text>}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove the entry from ${when}`}
                hitSlop={8}
                onPress={() => confirmRemove('Remove this entry?', 'It will be deleted from both phones.', () => removeEntry.mutate(e.id))}
                style={styles.remove}>
                <TrashIcon />
              </Pressable>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

function Face({ mouth }: { mouth: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={2.2} strokeLinecap="round">
      <Path d="M9 10h.01M15 10h.01" />
      <Path d={mouth} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2 },
  kicker: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  moodCard: { padding: 16, gap: 12 },
  overline: { fontFamily: fonts.bodyHeavy, fontSize: 13, letterSpacing: 1, color: colors.inkMuted },
  moods: { flexDirection: 'row', gap: 6 },
  mood: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: border.width,
    borderColor: 'transparent',
  },
  moodOn: { borderColor: border.color, backgroundColor: colors.ground },
  face: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: border.width,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceOn: { boxShadow: shadow.md },
  moodLabel: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.ink },
  section: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  field: {
    minHeight: 48,
    borderRadius: radius.field,
    borderWidth: border.width,
    borderColor: border.color,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  addField: { flex: 1 },
  note: { height: 88, paddingTop: 12, paddingBottom: 12 },
  error: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.purpleDark },
  save: {
    minHeight: 56,
    borderRadius: radius.card,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.purple,
    boxShadow: shadow.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  saveIdle: { opacity: 0.5 },
  saveText: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: colors.surface },
  entry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
  },
  dot: { width: 16, height: 16, marginTop: 3, borderRadius: 8, borderWidth: border.width, borderColor: border.color },
  entryText: { flex: 1, minWidth: 0, gap: 3 },
  entryTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  entryMood: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink },
  entryWhen: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted },
  entrySymptoms: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  entryNote: { fontSize: 13 },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
