import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet, Button, Card, Chip, CrossIcon, Screen, Text, TextField, TimeField } from '@/components';
import { VaultGate } from '@/components/VaultGate';
import { confirmRemove } from '@/lib/confirm';
import { useLocalTime, useLocalToday, useMembers, useMembership } from '@/lib/data';
import {
  AMOUNTS,
  CRAVING_MAX,
  FOOD_MAX,
  NOTE_MAX,
  NUTRIENTS,
  SLOTS,
  amountsLine,
  barsFor,
  dayHeading,
  goalsInput,
  hasNutrients,
  loggedBy,
  mealsOn,
  newCraving,
  newGoals,
  newMealData,
  slotLabel,
  suggestSlot,
  tileTime,
  type AmountKey,
  type Bar,
  type Craving,
  type Goals,
  type Meal,
  type NutrientKey,
  type Slot,
} from '@/lib/meals';
import { useSession } from '@/lib/session';
import { useAddCraving, useAddMeal, useCravings, useGoals, useMeals, useRemoveItem, useSaveGoals } from '@/lib/useMeals';
import { useVault } from '@/lib/vault/VaultProvider';
import { border, colors, fonts, radius } from '@/theme/tokens';

/** Slot colours from the design, for the time tile and the chosen chip. */
const SLOT_TONE: Record<Slot, string> = { breakfast: colors.yellow, snack: colors.pink, lunch: colors.mint, dinner: colors.lilac };

const BAR_TONE: Record<NutrientKey, string> = {
  protein: colors.purple,
  iron: colors.orange,
  calcium: colors.yellow,
  folate: colors.mint,
  fibre: colors.pink,
};

export default function MealsScreen() {
  const { session } = useSession();
  const membership = useMembership();
  const pregnancyId = membership.data?.pregnancy.id;
  const members = useMembers(pregnancyId);
  const vault = useVault();
  const day = useLocalToday();
  const now = useLocalTime();
  const meals = useMeals(pregnancyId);
  const cravings = useCravings(pregnancyId);
  const goals = useGoals(pregnancyId);
  const remove = useRemoveItem(pregnancyId);
  const [addOpen, setAddOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  // A new key each time a sheet opens gives it fresh fields, without them
  // visibly clearing as it slides away.
  const [sheetKey, setSheetKey] = useState(0);
  const open = (sheet: 'add' | 'goals') => {
    setSheetKey((k) => k + 1);
    if (sheet === 'add') setAddOpen(true);
    else setGoalsOpen(true);
  };

  const today = useMemo(() => mealsOn(meals.data ?? [], day), [meals.data, day]);

  // The root layout only shows the tabs once a pregnancy exists.
  if (!pregnancyId) return null;

  const loaded = meals.isSuccess && cravings.isSuccess && goals.isSuccess;
  const next = suggestSlot(today, now);

  return (
    <Screen keyboardAware>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text muted style={styles.kicker}>
            {dayHeading(day)}
          </Text>
          <Text variant="screenTitle" accessibilityRole="header">
            Meals
          </Text>
        </View>
        {vault.state === 'ready' && (
          <Pressable accessibilityRole="button" onPress={() => open('add')} style={styles.typeIn}>
            <Text style={styles.typeInText}>+ Type it in</Text>
          </Pressable>
        )}
      </View>

      <VaultGate what="meals">
        {(meals.isError || cravings.isError || goals.isError) && (
          <Text muted accessibilityRole="alert">
            Couldn&apos;t load your meals. Close Bloom and open it again.
          </Text>
        )}

        {loaded && (
          <NutrientsCard
            bars={barsFor(today, goals.data.goals)}
            hasData={hasNutrients(today)}
            custom={goals.data.custom}
            onEdit={() => open('goals')}
          />
        )}

        {loaded && (
          <View style={styles.logged}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Logged
            </Text>
            {today.length === 0 && <Text muted>Nothing logged yet today.</Text>}
            {today.map((meal) => (
              <MealRow
                key={meal.id}
                meal={meal}
                who={loggedBy(meal, session?.user.id, members.data)}
                onRemove={() => confirmRemove(`Remove ${meal.food}?`, 'It disappears for both of you.', () => remove.mutate(meal.id))}
              />
            ))}
            <Pressable accessibilityRole="button" onPress={() => open('add')} style={styles.addSlot}>
              <Text style={styles.addSlotText}>+ {slotLabel(next)}</Text>
            </Pressable>
            {remove.isError && (
              <Text muted accessibilityRole="alert">
                Couldn&apos;t remove that. Try again.
              </Text>
            )}
          </View>
        )}

        {loaded && <CravingsCard pregnancyId={pregnancyId} cravings={cravings.data} onRemove={(id) => remove.mutate(id)} />}
      </VaultGate>

      <AddMealSheet
        key={`add-${sheetKey}`}
        visible={addOpen}
        pregnancyId={pregnancyId}
        day={day}
        startSlot={next}
        startTime={now}
        by={session?.user.id ?? null}
        onClose={() => setAddOpen(false)}
      />
      {goals.isSuccess && (
        <GoalsSheet
          key={`goals-${sheetKey}`}
          visible={goalsOpen}
          pregnancyId={pregnancyId}
          goals={goals.data.goals}
          onClose={() => setGoalsOpen(false)}
        />
      )}
    </Screen>
  );
}

function NutrientsCard({ bars, hasData, custom, onEdit }: { bars: Bar[]; hasData: boolean; custom: boolean; onEdit: () => void }) {
  return (
    <Card size="panel" style={styles.nutrients}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle} accessibilityRole="header">
          Nutrients today
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change daily goals"
          onPress={onEdit}
          hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}>
          <Text style={styles.goalsLink}>{custom ? 'Your goals' : 'Typical goals'} · Change</Text>
        </Pressable>
      </View>
      {bars.map((bar) => (
        <View
          key={bar.key}
          style={styles.barRow}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`${bar.name}, ${bar.label}`}
          accessibilityValue={{ min: 0, max: 100, now: bar.percent }}>
          <View style={styles.barText}>
            <Text style={styles.barName}>{bar.name}</Text>
            <Text muted style={styles.barLabel}>
              {bar.label}
            </Text>
          </View>
          <View style={styles.track}>
            {bar.percent > 0 && (
              <View testID={`fill-${bar.key}`} style={[styles.fill, { width: `${bar.percent}%`, backgroundColor: BAR_TONE[bar.key] }]} />
            )}
          </View>
        </View>
      ))}
      {!hasData && <Text variant="caption">Add nutrients when you log a meal and they add up here.</Text>}
    </Card>
  );
}

function MealRow({ meal, who, onRemove }: { meal: Meal; who: string | null; onRemove: () => void }) {
  const numbers = amountsLine(meal.amounts);
  return (
    <View style={styles.mealCard}>
      <View testID={`tile-${meal.id}`} style={[styles.tile, { backgroundColor: SLOT_TONE[meal.slot] }]}>
        <Text style={styles.tileText}>{tileTime(meal.time)}</Text>
      </View>
      <View style={styles.mealText}>
        <Text style={styles.slotName}>{slotLabel(meal.slot).toUpperCase()}</Text>
        <Text style={styles.food}>{meal.food}</Text>
        {meal.note && (
          <Text muted style={styles.note}>
            {meal.note}
          </Text>
        )}
        {numbers !== '' && (
          <Text muted style={styles.note}>
            {numbers}
          </Text>
        )}
        {who && <Text variant="caption">{who} logged this</Text>}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${meal.food}`} onPress={onRemove} style={styles.remove}>
        <CrossIcon />
      </Pressable>
    </View>
  );
}

function CravingsCard({
  pregnancyId,
  cravings,
  onRemove,
}: {
  pregnancyId: string;
  cravings: Craving[];
  onRemove: (id: string) => void;
}) {
  const add = useAddCraving(pregnancyId);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const parsed = newCraving(
      draft,
      cravings.map((c) => c.text),
    );
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    if (parsed.text === null) {
      setDraft('');
      return;
    }
    add.mutate(parsed.text, { onSuccess: () => setDraft('') });
  };

  return (
    <Card tone={colors.mint} size="card" style={styles.cravings}>
      <Text style={styles.cravingsLabel} accessibilityRole="header">
        CRAVINGS &amp; AVERSIONS
      </Text>
      {cravings.length > 0 && (
        <View style={styles.chips}>
          {cravings.map((c) => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${c.text}`}
              onPress={() => onRemove(c.id)}
              hitSlop={{ top: 5, bottom: 5 }}
              style={styles.craving}>
              <Text style={styles.cravingText}>{c.text}</Text>
              <CrossIcon size={12} color={colors.ink} />
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.cravingForm}>
        <TextInput
          accessibilityLabel="New craving"
          placeholder="Craving mango again?"
          placeholderTextColor={colors.inkMuted}
          value={draft}
          onChangeText={setDraft}
          maxLength={CRAVING_MAX}
          returnKeyType="done"
          onSubmitEditing={submit}
          style={styles.cravingInput}
        />
        <Button label="Add" variant="dark" disabled={add.isPending} onPress={submit} />
      </View>
      {(error || add.isError) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error ?? 'Couldn’t save that. Try again.'}
        </Text>
      )}
    </Card>
  );
}

function AddMealSheet({
  visible,
  pregnancyId,
  day,
  startSlot,
  startTime,
  by,
  onClose,
}: {
  visible: boolean;
  pregnancyId: string;
  day: string;
  startSlot: Slot;
  startTime: string;
  by: string | null;
  onClose: () => void;
}) {
  const add = useAddMeal(pregnancyId);
  const [slot, setSlot] = useState<Slot>(startSlot);
  const [food, setFood] = useState('');
  const [time, setTime] = useState(startTime);
  const [note, setNote] = useState('');
  const [amounts, setAmounts] = useState<Partial<Record<AmountKey, string>>>({});
  const [showAmounts, setShowAmounts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const parsed = newMealData({ slot, food, time, note, amounts }, day, by);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    add.mutate(parsed.data, { onSuccess: onClose });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add a meal">
      <View style={styles.chips} accessibilityRole="radiogroup">
        {SLOTS.map((s) => (
          <Chip key={s.key} label={s.label} selected={slot === s.key} selectedTone={SLOT_TONE[s.key]} onPress={() => setSlot(s.key)} />
        ))}
      </View>
      <View style={styles.fieldRow}>
        <TextField
          label="What was eaten?"
          value={food}
          onChangeText={setFood}
          placeholder="e.g. Paneer paratha with curd"
          maxLength={FOOD_MAX}
          returnKeyType="next"
        />
      </View>
      <TimeField value={time} onChange={setTime} startAt={startTime} />
      <View style={styles.fieldRow}>
        <TextField label="Notes" value={note} onChangeText={setNote} placeholder="Sides, drinks" maxLength={NOTE_MAX} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showAmounts }}
        onPress={() => setShowAmounts(!showAmounts)}
        style={styles.disclosure}>
        <Text style={styles.disclosureText}>{showAmounts ? '− Hide nutrients' : '+ Add nutrients (optional)'}</Text>
      </Pressable>
      {showAmounts &&
        pairs(AMOUNTS).map((row) => (
          <View key={row[0].key} style={styles.fieldRow}>
            {row.map(({ key, name, unit }) => (
              <TextField
                key={key}
                label={`${name} (${unit})`}
                value={amounts[key] ?? ''}
                onChangeText={(text) => setAmounts((a) => ({ ...a, [key]: text }))}
                keyboardType="decimal-pad"
                maxLength={8}
              />
            ))}
          </View>
        ))}
      {(error || add.isError) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error ?? 'Couldn’t save. Try again.'}
        </Text>
      )}
      <View style={styles.buttons}>
        <Button label="Cancel" onPress={onClose} style={styles.half} />
        <Button label={add.isPending ? 'Saving…' : 'Save meal'} variant="dark" disabled={add.isPending} onPress={save} style={styles.half} />
      </View>
    </BottomSheet>
  );
}

function GoalsSheet({
  visible,
  pregnancyId,
  goals,
  onClose,
}: {
  visible: boolean;
  pregnancyId: string;
  goals: Goals;
  onClose: () => void;
}) {
  const save = useSaveGoals(pregnancyId);
  const [fields, setFields] = useState(() => goalsInput(goals));
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const parsed = newGoals(fields);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    save.mutate(parsed.goals, { onSuccess: onClose });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Daily goals">
      <Text muted>
        Use the numbers your doctor gave you. Until you enter them, the goals are common starting targets, not medical advice. Both of
        you see the same goals.
      </Text>
      {pairs(NUTRIENTS).map((row) => (
        <View key={row[0].key} style={styles.fieldRow}>
          {row.map(({ key, name, unit }) => (
            <TextField
              key={key}
              label={`${name} (${unit})`}
              value={fields[key]}
              onChangeText={(text) => setFields((f) => ({ ...f, [key]: text }))}
              keyboardType="decimal-pad"
              maxLength={8}
            />
          ))}
        </View>
      ))}
      {(error || save.isError) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error ?? 'Couldn’t save. Try again.'}
        </Text>
      )}
      <View style={styles.buttons}>
        <Button label="Cancel" onPress={onClose} style={styles.half} />
        <Button label={save.isPending ? 'Saving…' : 'Save goals'} variant="dark" disabled={save.isPending} onPress={submit} style={styles.half} />
      </View>
    </BottomSheet>
  );
}

/** [a, b, c, d, e] as [[a, b], [c, d], [e]], for two fields to a row. */
function pairs<T>(items: T[]): T[][] {
  return Array.from({ length: Math.ceil(items.length / 2) }, (_, i) => items.slice(i * 2, i * 2 + 2));
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerText: { gap: 2, flexShrink: 1 },
  kicker: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  typeIn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeInText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.ink },
  nutrients: { borderRadius: 26, padding: 18, gap: 14 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8 },
  cardTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  goalsLink: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.purpleDark },
  barRow: { gap: 6 },
  barText: { flexDirection: 'row', justifyContent: 'space-between' },
  barName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  barLabel: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  track: {
    height: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.line,
    borderWidth: border.width,
    borderColor: border.color,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRightWidth: border.width, borderRightColor: border.color },
  logged: { gap: 12 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  mealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.card,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
  },
  tile: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: border.width,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  mealText: { flex: 1, minWidth: 0, gap: 2 },
  slotName: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 0.72, color: colors.inkMuted },
  food: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  note: { fontSize: 13 },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  addSlot: {
    minHeight: 56,
    borderRadius: radius.card,
    borderWidth: border.width,
    borderStyle: 'dashed',
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSlotText: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink },
  cravings: { padding: 16, gap: 10 },
  cravingsLabel: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 0.96, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  craving: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
  },
  cravingText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  cravingForm: { flexDirection: 'row', gap: 8 },
  cravingInput: {
    flex: 1,
    height: 48,
    borderRadius: radius.field,
    borderWidth: border.width,
    borderColor: border.color,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  fieldRow: { flexDirection: 'row', gap: 10 },
  disclosure: { minHeight: 44, justifyContent: 'center' },
  disclosureText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.purpleDark },
  error: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.purpleDark },
  buttons: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
});
