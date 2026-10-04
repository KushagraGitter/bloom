import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  BackButton,
  BottomSheet,
  Button,
  Card,
  ChevronIcon,
  CrossIcon,
  PlusIcon,
  Screen,
  Text,
  TextField,
  WhenFields,
} from '@/components';
import { VaultNotice } from '@/components/VaultNotice';
import {
  PLACE_MAX,
  TITLE_MAX,
  addMonths,
  dayNumber,
  dayTitle,
  metaLine,
  monthAbbr,
  monthName,
  monthOf,
  monthTitle,
  monthWeeks,
  newAppointmentRow,
  onDay,
  upcoming,
  type Appointment,
} from '@/lib/appointments';
import { confirmRemove } from '@/lib/confirm';
import { useAddAppointment, useAppointments, useLocalToday, useMembership, useRemoveAppointment } from '@/lib/data';
import { makeStyles, useTheme } from '@/theme/theme';
import { accents, fonts, radius } from '@/theme/tokens';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Date tile colours from the design, handed out down the list. */
const TINTS = [accents.pink, accents.mint, accents.yellow, accents.lilac];

export default function AppointmentsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const membership = useMembership();
  const pregnancyId = membership.data?.pregnancy.id;
  const today = useLocalToday();
  const appointments = useAppointments(pregnancyId);
  const remove = useRemoveAppointment(pregnancyId);

  const [month, setMonth] = useState(() => monthOf(today));
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // A new key each time it opens gives the sheet empty fields, without them visibly clearing as it slides away.
  const [sheetKey, setSheetKey] = useState(0);
  const openAdd = () => {
    setSheetKey((k) => k + 1);
    setAdding(true);
  };

  // The root layout only shows this screen once a pregnancy exists.
  if (!pregnancyId) return null;

  const all = appointments.data ?? [];
  const booked = new Set(all.map((a) => a.appt_date));
  const shown = selected ? onDay(all, selected) : upcoming(all, today);
  const monthLabel = monthName(`${month}-01`);

  return (
    <Screen>
      <BackButton label="Today" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />

      <View style={styles.header}>
        <Text variant="screenTitle" accessibilityRole="header">
          Appointments
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Add appointment" onPress={openAdd} style={styles.addButton}>
          <PlusIcon color={accents.onAccent} />
        </Pressable>
      </View>

      <VaultNotice />

      <Card size="panel" elevation="lg" style={styles.calendar}>
        <View style={styles.monthBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            onPress={() => setMonth(addMonths(month, -1))}
            style={styles.navButton}>
            <ChevronIcon direction="left" />
          </Pressable>
          <Text variant="title" accessibilityRole="header">
            {monthTitle(month)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            onPress={() => setMonth(addMonths(month, 1))}
            style={styles.navButton}>
            <ChevronIcon direction="right" />
          </Pressable>
        </View>

        <View style={styles.grid}>
          {/* Each day below says its own date, so the letters over them add nothing for a screen reader. */}
          <View style={styles.week} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {WEEKDAYS.map((letter, i) => (
              <Text key={i} style={styles.weekday}>
                {letter}
              </Text>
            ))}
          </View>
          {monthWeeks(month).map((week, w) => (
            <View key={w} style={styles.week}>
              {week.map((cell, i) => {
                if (!cell) return <View key={i} style={styles.cell} />;
                const isSelected = selected === cell.day;
                const hasAppointment = booked.has(cell.day);
                return (
                  <Pressable
                    key={i}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${cell.n} ${monthLabel}${hasAppointment ? ', has appointment' : ''}`}
                    onPress={() => setSelected(isSelected ? null : cell.day)}
                    style={[
                      styles.cell,
                      styles.day,
                      cell.day === today && styles.dayToday,
                      hasAppointment && styles.dayBooked,
                      isSelected && styles.daySelected,
                    ]}>
                    <Text style={[styles.dayNumber, isSelected ? { color: colors.surface } : hasAppointment && { color: colors.onAccent }]}>{cell.n}</Text>
                    <View style={[styles.dot, hasAppointment && { backgroundColor: isSelected ? colors.yellow : colors.onAccent }]} />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </Card>

      <View style={styles.list}>
        <View style={styles.listHeader}>
          <Text variant="title" accessibilityRole="header">
            {selected ? dayTitle(selected) : 'Upcoming'}
          </Text>
          {selected && (
            <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={styles.allUpcoming}>
              <Text style={styles.allUpcomingText}>All upcoming</Text>
            </Pressable>
          )}
        </View>

        {appointments.isError && (
          <Text muted accessibilityRole="alert">
            Couldn&apos;t load your appointments. Check your connection and try again.
          </Text>
        )}

        {appointments.isSuccess && shown.length === 0 && (
          <Card dashed style={styles.empty}>
            <Text style={styles.emptyText}>Nothing booked.</Text>
            <Button label="+ Add appointment" onPress={openAdd} />
          </Card>
        )}

        {shown.map((appointment, i) => (
          <AppointmentRow
            key={appointment.id}
            appointment={appointment}
            tint={TINTS[i % TINTS.length]}
            onRemove={() =>
              confirmRemove(`Remove ${appointment.title}?`, 'It disappears for both of you.', () => remove.mutate(appointment.id))
            }
          />
        ))}

        {remove.isError && (
          <Text muted accessibilityRole="alert">
            Couldn&apos;t remove that. Check your connection and try again.
          </Text>
        )}
      </View>

      <AddSheet
        key={sheetKey}
        visible={adding}
        pregnancyId={pregnancyId}
        initialDate={selected ?? today}
        onClose={() => setAdding(false)}
        onSaved={(day) => {
          setMonth(monthOf(day));
          setSelected(day);
          setAdding(false);
        }}
      />
    </Screen>
  );
}

function AppointmentRow({ appointment, tint, onRemove }: { appointment: Appointment; tint: string; onRemove: () => void }) {
  const styles = useStyles();
  return (
    <Card style={styles.row}>
      <View style={[styles.tile, { backgroundColor: tint }]}>
        <Text style={styles.tileMonth}>{monthAbbr(appointment.appt_date)}</Text>
        <Text style={styles.tileDay}>{dayNumber(appointment.appt_date)}</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {appointment.title}
        </Text>
        <Text muted style={styles.rowMeta} numberOfLines={2}>
          {metaLine(appointment)}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${appointment.title}`} onPress={onRemove} style={styles.remove}>
        <CrossIcon />
      </Pressable>
    </Card>
  );
}

function AddSheet({
  visible,
  pregnancyId,
  initialDate,
  onClose,
  onSaved,
}: {
  visible: boolean;
  pregnancyId: string;
  initialDate: string;
  onClose: () => void;
  onSaved: (day: string) => void;
}) {
  const styles = useStyles();
  const add = useAddAppointment(pregnancyId);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState('');
  const [place, setPlace] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const parsed = newAppointmentRow({ title, date, time, place });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    add.mutate(parsed.row, { onSuccess: () => onSaved(parsed.row.appt_date) });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="New appointment">
      <View style={styles.fieldRow}>
        <TextField
          label="What's it for?"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Growth scan"
          maxLength={TITLE_MAX}
          returnKeyType="next"
        />
      </View>
      <WhenFields date={date} time={time} onDateChange={setDate} onTimeChange={setTime} />
      <View style={styles.fieldRow}>
        <TextField
          label="Doctor or clinic"
          value={place}
          onChangeText={setPlace}
          placeholder="Optional"
          maxLength={PLACE_MAX}
          returnKeyType="done"
          onSubmitEditing={save}
        />
      </View>
      {(error || add.isError) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error ?? 'Couldn’t save. Check your connection and try again.'}
        </Text>
      )}
      <View style={styles.buttons}>
        <Button label="Cancel" onPress={onClose} style={styles.half} />
        <Button label={add.isPending ? 'Saving…' : 'Save'} variant="dark" disabled={add.isPending} onPress={save} style={styles.half} />
      </View>
    </BottomSheet>
  );
}

const useStyles = makeStyles(({ colors, border, shadow }) => ({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.orange,
    boxShadow: shadow.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendar: { borderRadius: 26, padding: 16, gap: 12 },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { gap: 4 },
  week: { flexDirection: 'row', gap: 4 },
  weekday: { flex: 1, textAlign: 'center', fontFamily: fonts.bodyHeavy, fontSize: 11, color: colors.inkMuted },
  cell: { flex: 1, height: 44 },
  day: {
    gap: 2,
    borderRadius: 12,
    borderWidth: border.width,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayToday: { borderColor: border.color },
  dayBooked: { backgroundColor: colors.yellow },
  daySelected: { backgroundColor: colors.ink, borderColor: border.color },
  dayNumber: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.ink },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'transparent' },
  list: { gap: 10 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  allUpcoming: { minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' },
  allUpcomingText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.link },
  empty: { padding: 18, gap: 10, alignItems: 'flex-start' },
  emptyText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  tile: {
    width: 52,
    height: 56,
    borderRadius: 16,
    borderWidth: border.width,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileMonth: { fontFamily: fonts.bodyHeavy, fontSize: 11, color: colors.ink },
  tileDay: { fontFamily: fonts.display, fontSize: 22, lineHeight: 22, color: colors.ink },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  rowMeta: { fontSize: 13 },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fieldRow: { flexDirection: 'row' },
  error: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.purpleDark },
  buttons: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
}));
