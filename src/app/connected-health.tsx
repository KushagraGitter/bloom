import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';

import { BackButton, Button, Card, Screen, Text, Toggle } from '@/components';
import { METRICS, type HealthMetric, type MetricInfo } from '@/lib/health/metrics';
import { useHealthSettings } from '@/lib/health/settings';
import { healthSource } from '@/lib/health/source';
import type { SourceStatus } from '@/lib/health/source.types';
import { makeStyles } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';

const HEALTH_CONNECT_STORE = 'market://details?id=com.google.android.apps.healthdata';
const HEALTH_CONNECT_WEB = 'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const NOT_READY: Record<Exclude<SourceStatus, 'ready'>, string> = {
  'needs-build': `Connecting ${healthSource.name} needs the installed Bloom app. Expo Go can't read health data.`,
  'needs-app': 'Health Connect isn’t on this phone yet. Get it from Google Play, then come back here.',
  'needs-update': 'Health Connect needs an update from Google Play first.',
  unsupported: Platform.OS === 'web' ? 'Health data connects in the phone app, not on the web.' : 'This phone can’t share health data with Bloom.',
};

/**
 * Connected health: which metrics Bloom may read from Apple Health or Health
 * Connect on this phone. Bloom only reads, and only what she switches on.
 */
export default function ConnectedHealthScreen() {
  const { metrics, load } = useHealthSettings();
  const [status, setStatus] = useState<SourceStatus | null>(null);
  // Null when the phone won't say (iPhone).
  const [granted, setGranted] = useState<HealthMetric[] | null>(null);

  useEffect(() => {
    if (metrics === null) load();
  }, [metrics, load]);

  useEffect(() => {
    let live = true;
    (async () => {
      const s = await healthSource.status();
      if (!live) return;
      setStatus(s);
      if (s === 'ready') {
        const g = await healthSource.granted().catch(() => null);
        if (live) setGranted(g);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    <Screen>
      <BackButton label="Profile" onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} />
      <Text variant="screenTitle" accessibilityRole="header">
        Connected health
      </Text>
      <Text muted>
        Bloom can read the health data you choose from {healthSource.name}, like sleep from your watch or band. It only reads and never
        changes anything there. Turn on what you&apos;d like to see; the numbers come to Today and Progress in the next update, locked
        with your household key like everything else.
      </Text>

      {status === null || metrics === null ? (
        <Text muted>Checking this phone…</Text>
      ) : status !== 'ready' ? (
        <NotReady status={status} />
      ) : (
        <Connect metrics={metrics} granted={granted} onGranted={setGranted} />
      )}
    </Screen>
  );
}

function NotReady({ status }: { status: Exclude<SourceStatus, 'ready'> }) {
  const styles = useStyles();
  const openStore = () => Linking.openURL(HEALTH_CONNECT_STORE).catch(() => Linking.openURL(HEALTH_CONNECT_WEB));
  return (
    <Card size="card" style={styles.card}>
      <Text>{NOT_READY[status]}</Text>
      {(status === 'needs-app' || status === 'needs-update') && (
        <Button label={status === 'needs-app' ? 'Get Health Connect' : 'Update Health Connect'} variant="dark" onPress={openStore} />
      )}
    </Card>
  );
}

function Connect({
  metrics,
  granted,
  onGranted,
}: {
  metrics: HealthMetric[];
  granted: HealthMetric[] | null;
  onGranted: (g: HealthMetric[] | null) => void;
}) {
  const styles = useStyles();
  const { setMetric, disconnect } = useHealthSettings();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const isOn = (id: HealthMetric) => metrics.includes(id) && (granted === null || granted.includes(id));

  const change = async (id: HealthMetric, on: boolean) => {
    setProblem(null);
    setBusy(true);
    try {
      if (on) {
        const allowed = await healthSource.request([id]);
        onGranted(allowed);
        if (allowed !== null && !allowed.includes(id)) {
          setProblem(`${healthSource.name} didn’t allow that. You can change it in ${healthSource.name} any time.`);
          return;
        }
      }
      await setMetric(id, on);
    } catch {
      setProblem(`Couldn’t reach ${healthSource.name}. Try again.`);
    } finally {
      setBusy(false);
    }
  };

  const core = METRICS.filter((m) => !m.optional);
  const extra = METRICS.filter((m) => m.optional);

  return (
    <>
      <MetricGroup title="FROM YOUR WATCH OR BAND" items={core} isOn={isOn} busy={busy} onChange={change} />
      <MetricGroup title="IF YOUR SCALE, METER OR CUFF SYNCS" items={extra} isOn={isOn} busy={busy} onChange={change} />
      {problem && <Text style={styles.problem}>{problem}</Text>}

      {healthSource.asksForHistory && <HistoryRow />}

      <CheckConnection metrics={METRICS.map((m) => m.id).filter(isOn)} />

      <Card size="card" style={styles.card}>
        <Text variant="label">Changing access</Text>
        <Text variant="caption">
          {healthSource.openSettings
            ? 'Health Connect decides what Bloom can read. You can take access away there at any time.'
            : 'To change what Bloom can read, open the Health app, tap your picture, then Apps, then Bloom.'}
        </Text>
        {healthSource.openSettings && <Button label="Open Health Connect" onPress={healthSource.openSettings} />}
        {metrics.length > 0 && <Button label="Stop reading on this phone" onPress={() => disconnect()} />}
      </Card>
    </>
  );
}

function MetricGroup({
  title,
  items,
  isOn,
  busy,
  onChange,
}: {
  title: string;
  items: MetricInfo[];
  isOn: (id: HealthMetric) => boolean;
  busy: boolean;
  onChange: (id: HealthMetric, on: boolean) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.groupBox}>
        {items.map((m, i) => (
          <View key={m.id} style={[styles.row, i > 0 && styles.rowDivider]}>
            <View style={styles.flex}>
              <Text style={styles.rowLabel}>{m.label}</Text>
              <Text variant="caption">{m.hint}</Text>
            </View>
            <Toggle label={m.label} value={isOn(m.id)} disabled={busy} onValueChange={(on) => onChange(m.id, on)} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Health Connect only gives the 30 days before she connected unless she allows older data too. */
function HistoryRow() {
  const styles = useStyles();
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    healthSource
      .hasHistory?.()
      .then(setOn)
      .catch(() => setOn(false));
  }, []);

  const change = async (next: boolean) => {
    if (!next) return healthSource.openSettings?.();
    setBusy(true);
    try {
      await healthSource.request([], true);
      setOn((await healthSource.hasHistory?.()) ?? false);
    } catch {
      setOn(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.groupBox}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.rowLabel}>Older data</Text>
          <Text variant="caption">Read back to the start of your pregnancy, not just the last 30 days</Text>
        </View>
        <Toggle label="Older data" value={!!on} disabled={on === null || busy} onValueChange={change} />
      </View>
    </View>
  );
}

/** Counts what the phone holds for the last week, so she can see the connection works. Nothing is saved. */
function CheckConnection({ metrics }: { metrics: HealthMetric[] }) {
  const styles = useStyles();
  const [counts, setCounts] = useState<{ id: HealthMetric; count: number | null }[] | null>(null);
  const [busy, setBusy] = useState(false);

  if (!metrics.length) return null;

  const check = async () => {
    setBusy(true);
    const since = new Date(Date.now() - WEEK_MS);
    const results = await Promise.all(
      metrics.map(async (id) => ({ id, count: await healthSource.countSince(id, since).catch(() => null) })),
    );
    setCounts(results);
    setBusy(false);
  };

  const label = (id: HealthMetric) => METRICS.find((m) => m.id === id)?.label ?? id;
  const anyEmpty = counts?.some((c) => !c.count);

  return (
    <Card size="card" style={styles.card}>
      <Text variant="label">Check the connection</Text>
      <Text variant="caption">Counts what {healthSource.name} has from the last 7 days. Bloom doesn&apos;t keep any of it yet.</Text>
      {counts && (
        <View style={styles.counts}>
          {counts.map((c) => (
            <Text key={c.id}>
              {label(c.id)}:{' '}
              {c.count === null ? 'couldn’t read' : c.count === 0 ? 'nothing yet' : `${c.count} ${c.count === 1 ? 'entry' : 'entries'}`}
            </Text>
          ))}
        </View>
      )}
      {anyEmpty && !healthSource.openSettings && (
        <Text variant="caption">
          If something shows nothing, check that your watch or band app shares it with Apple Health, and that Bloom is allowed to read it.
        </Text>
      )}
      <Button label={busy ? 'Checking…' : 'Check now'} variant="dark" disabled={busy} onPress={check} />
    </Card>
  );
}

const useStyles = makeStyles(({ colors, border }) => ({
  card: { gap: 12 },
  counts: { gap: 4 },
  group: { gap: 8 },
  groupTitle: { marginHorizontal: 4, fontFamily: fonts.bodyHeavy, fontSize: 13, letterSpacing: 1, color: colors.inkMuted },
  groupBox: {
    backgroundColor: colors.surface,
    borderWidth: border.width,
    borderColor: border.color,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  rowDivider: { borderTopWidth: 2, borderTopColor: colors.line },
  rowLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  flex: { flex: 1, gap: 2 },
  problem: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.purpleDark },
}));
