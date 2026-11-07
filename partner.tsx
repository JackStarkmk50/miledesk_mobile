import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import {
  Account,
  ApiError,
  Delivery,
  NetworkError,
  readToken,
  request,
  saveToken,
} from "./api";
import { PendingUpdate, readPending, savePending } from "./pending";
import { color } from "./theme";
const next: Partial<
  Record<Delivery["status"], { label: string; status: Delivery["status"] }>
> = {
  Assigned: { label: "Confirm pickup", status: "Picked up" },
  "Picked up": { label: "Start delivery", status: "On the way" },
  "On the way": { label: "Confirm delivered", status: "Delivered" },
};
function Action({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        secondary && styles.secondary,
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      <Text style={[styles.actionText, secondary && styles.secondaryText]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function PartnerApp() {
  const [token, setToken] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"Home" | "Deliveries" | "Account">("Home");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [issue, setIssue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<PendingUpdate[]>([]);
  const order = deliveries.find((item) => item.id === selected);
  const active = deliveries.filter(
    (item) => !["Delivered", "Failed"].includes(item.status),
  );

  const refresh = useCallback(async (current: string) => {
    const [session, queue] = await Promise.all([
      request<{ account: Account }>("/api/mobile/session", "GET", current),
      request<{ deliveries: Delivery[] }>(
        "/api/mobile/deliveries",
        "GET",
        current,
      ),
    ]);
    const waiting = await readPending(session.account.id);
    const remaining: PendingUpdate[] = [];
    let conflict = false;
    for (const update of waiting) {
      const currentDelivery = queue.deliveries.find(
        (item) => item.id === update.deliveryId,
      );
      if (
        currentDelivery?.version === update.baseVersion + 1 &&
        currentDelivery.status === update.status
      )
        continue;
      if (
        currentDelivery?.version !== update.baseVersion ||
        currentDelivery.status !== update.baseStatus
      ) {
        remaining.push(update);
        conflict = true;
        continue;
      }
      try {
        const result = await request<{ delivery: Delivery }>(
          `/api/mobile/deliveries/${update.deliveryId}`,
          "PATCH",
          current,
          {
            version: update.baseVersion,
            status: update.status,
            reason: update.reason,
          },
        );
        queue.deliveries = queue.deliveries.map((item) =>
          item.id === update.deliveryId ? result.delivery : item,
        );
      } catch (error) {
        remaining.push(update);
        if (!(error instanceof NetworkError)) conflict = true;
      }
    }
    await savePending(session.account.id, remaining);
    setPending(remaining);
    setAccount(session.account);
    setDeliveries(queue.deliveries);
    if (conflict)
      setMessage(
        "A pending update needs review. Ask your dispatcher to check this stop.",
      );
    else if (waiting.length && !remaining.length)
      setMessage("Pending updates synced with MileDesk.");
  }, []);
  useEffect(() => {
    let active = true;
    readToken()
      .then(async (stored) => {
        if (!stored) return;
        try {
          if (active) setToken(stored);
          await refresh(stored);
          if (active) {
            setToken(stored);
          }
        } catch (error) {
          if (error instanceof ApiError && error.status === 401)
            await saveToken(null);
          if (active) {
            if (error instanceof ApiError && error.status === 401)
              setToken(null);
            setMessage((error as Error).message);
          }
        }
      })
      .catch((error) => {
        if (active) setMessage((error as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);
  async function signIn() {
    setBusy(true);
    setMessage("");
    try {
      const result = await request<{ token: string }>(
        "/api/mobile/session",
        "POST",
        undefined,
        { email: email.trim(), password },
      );
      await saveToken(result.token);
      setToken(result.token);
      await refresh(result.token);
      setPassword("");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    if (token)
      await request("/api/mobile/session", "DELETE", token).catch(() => null);
    await saveToken(null);
    setToken(null);
    setAccount(null);
    setDeliveries([]);
    setPending([]);
    setSelected(null);
    setMessage("Signed out.");
  }
  async function reload() {
    if (!token) return;
    setRefreshing(true);
    setMessage("");
    try {
      await refresh(token);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setRefreshing(false);
    }
  }
  async function update(status: Delivery["status"]) {
    if (
      !token ||
      !order ||
      !account ||
      pending.some((item) => item.deliveryId === order.id)
    )
      return;
    setBusy(true);
    setMessage("");
    const update: PendingUpdate = {
      deliveryId: order.id,
      baseVersion: order.version,
      baseStatus: order.status,
      status,
      reason: status === "Failed" ? reason.trim() : "",
    };
    try {
      const waiting = [...pending, update];
      await savePending(account.id, waiting);
      setPending(waiting);
      const result = await request<{ delivery: Delivery }>(
        `/api/mobile/deliveries/${order.id}`,
        "PATCH",
        token,
        {
          version: update.baseVersion,
          status: update.status,
          reason: update.reason,
        },
      );
      setDeliveries((items) =>
        items.map((item) => (item.id === order.id ? result.delivery : item)),
      );
      await savePending(account.id, pending);
      setPending(pending);
      setIssue(false);
      setReason("");
      setMessage(
        status === "Failed"
          ? "Issue sent to the dispatcher."
          : `Marked ${status.toLowerCase()}.`,
      );
    } catch (error) {
      if (error instanceof NetworkError)
        setMessage(
          "Connection lost. This update is pending; tap Retry sync when online.",
        );
      else {
        await savePending(account.id, pending);
        setPending(pending);
        await refresh(token).catch(() => null);
        setMessage((error as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }
  function discardPending(deliveryId: string) {
    if (!account) return;
    const discard = async () => {
      const remaining = pending.filter(
        (item) => item.deliveryId !== deliveryId,
      );
      try {
        await savePending(account.id, remaining);
        setPending(remaining);
        setMessage(
          "Pending update discarded. Refresh this stop before changing its status.",
        );
      } catch (error) {
        setMessage((error as Error).message);
      }
    };
    if (Platform.OS === "web") {
      if (globalThis.confirm("Discard this unconfirmed update?"))
        void discard();
    } else
      Alert.alert(
        "Discard pending update?",
        "This status change may not have reached MileDesk. Check with your dispatcher first.",
        [
          { text: "Keep update", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => void discard(),
          },
        ],
      );
  }
  async function openMaps() {
    if (!order) return;
    try {
      await Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`,
      );
    } catch {
      setMessage("Maps could not open. Use the address shown here.");
    }
  }
  async function callCustomer() {
    if (!order) return;
    try {
      await Linking.openURL(`tel:${order.phone.replace(/[^+\d]/g, "")}`);
    } catch {
      setMessage("Calling is unavailable on this device.");
    }
  }
  function card(item: Delivery) {
    return (
      <Pressable
        key={item.id}
        accessibilityRole="button"
        accessibilityLabel={`Open delivery for ${item.customer}`}
        onPress={() => {
          setSelected(item.id);
          setIssue(false);
          setMessage("");
        }}
        style={({ pressed }) => [styles.card, pressed && styles.dimmed]}
      >
        <View style={styles.row}>
          <Text style={styles.id}>{item.id.slice(0, 8)}</Text>
          <Text
            style={[styles.status, item.status === "Failed" && styles.failed]}
          >
            {item.status}
          </Text>
        </View>
        <Text style={styles.cardTitle}>{item.customer}</Text>
        <Text style={styles.body}>{item.address}</Text>
        {pending.some((update) => update.deliveryId === item.id) && (
          <Text style={styles.status}>Pending sync</Text>
        )}
        <Text style={styles.noteText}>
          {item.landmark || "No entrance note"}
        </Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.screen}>
      <ExpoStatusBar style="dark" />
      <View style={{ height: StatusBar.currentHeight ?? 42 }} />
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image
            source={require("./assets/miledesk-mark.png")}
            style={styles.mark}
            accessibilityLabel="MileDesk"
          />
          <Text style={styles.brand}>MileDesk Partner</Text>
        </View>
        <Text style={styles.city}>Salem</Text>
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={color.green} />
          <Text style={styles.body}>Opening MileDesk…</Text>
        </View>
      ) : !token ? (
        <ScrollView contentContainerStyle={styles.auth}>
          <Text style={styles.title}>Your deliveries, in one place.</Text>
          <Text style={styles.body}>
            Sign in with the driver account your workspace owner invited.
          </Text>
          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              accessibilityLabel="Email"
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              accessibilityLabel="Password"
            />
            <Action
              label={busy ? "Signing in…" : "Sign in"}
              disabled={busy || !email.trim() || !password}
              onPress={signIn}
            />
          </View>
          {!!message && (
            <Text accessibilityLiveRegion="polite" style={styles.message}>
              {message}
            </Text>
          )}
        </ScrollView>
      ) : (
        <>
          <ScrollView
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={reload}
                tintColor={color.green}
              />
            }
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {!!pending.length && (
              <View style={styles.banner}>
                <Text style={styles.bannerTitle}>
                  {pending.length} update{pending.length === 1 ? "" : "s"}{" "}
                  pending
                </Text>
                <Text style={styles.body}>
                  MileDesk has not confirmed these changes. Retry when
                  connected.
                </Text>
                <Action
                  label="Retry sync"
                  secondary
                  disabled={refreshing}
                  onPress={reload}
                />
              </View>
            )}
            {!account && (
              <View style={styles.banner}>
                <Text style={styles.body}>
                  Connect to load your assigned stops.
                </Text>
                <Action
                  label="Retry connection"
                  secondary
                  disabled={refreshing}
                  onPress={reload}
                />
              </View>
            )}
            {order ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setSelected(null);
                    setIssue(false);
                  }}
                >
                  <Text style={styles.link}>Back to stops</Text>
                </Pressable>
                <View style={styles.titleGroup}>
                  <Text style={styles.title}>{order.customer}</Text>
                  <Text style={styles.body}>
                    Delivery {order.id.slice(0, 8)}
                  </Text>
                </View>
                <View style={styles.banner}>
                  <Text style={styles.bannerLabel}>Current status</Text>
                  <Text style={styles.bannerTitle}>{order.status}</Text>
                  {pending.some((update) => update.deliveryId === order.id) && (
                    <Text style={styles.body}>
                      Status update pending. MileDesk has not confirmed it.
                    </Text>
                  )}
                  {pending.some((update) => update.deliveryId === order.id) && (
                    <Action
                      label="Discard pending update"
                      secondary
                      onPress={() => discardPending(order.id)}
                    />
                  )}
                  {order.status === "Failed" && (
                    <Text style={styles.body}>{order.failure_reason}</Text>
                  )}
                </View>
                <View style={styles.section}>
                  <Text style={styles.heading}>Find the entrance</Text>
                  <Text style={styles.address}>{order.address}</Text>
                  <View style={styles.note}>
                    <Text style={styles.label}>Landmark or access note</Text>
                    <Text style={styles.body}>
                      {order.landmark ||
                        "No note provided. Confirm the entrance before travel."}
                    </Text>
                  </View>
                  <View style={styles.actionRow}>
                    <Action label="Open Maps" secondary onPress={openMaps} />
                    <Action
                      label="Call customer"
                      secondary
                      onPress={callCustomer}
                    />
                  </View>
                </View>
                {next[order.status] && (
                  <View style={styles.section}>
                    <Text style={styles.heading}>Next step</Text>
                    <Action
                      label={next[order.status]!.label}
                      disabled={
                        busy ||
                        pending.some((update) => update.deliveryId === order.id)
                      }
                      onPress={() => update(next[order.status]!.status)}
                    />
                    <Action
                      label="Report a delivery issue"
                      secondary
                      disabled={
                        busy ||
                        pending.some((update) => update.deliveryId === order.id)
                      }
                      onPress={() => setIssue(true)}
                    />
                    {issue && (
                      <View style={styles.issue}>
                        <Text style={styles.label}>What happened?</Text>
                        <TextInput
                          style={[styles.input, styles.reason]}
                          value={reason}
                          onChangeText={setReason}
                          multiline
                          placeholder="Explain the issue for the dispatcher"
                          accessibilityLabel="Delivery issue reason"
                        />
                        <Action
                          label="Send issue"
                          disabled={busy || reason.trim().length < 5}
                          onPress={() => update("Failed")}
                        />
                        <Action
                          label="Cancel"
                          secondary
                          onPress={() => setIssue(false)}
                        />
                      </View>
                    )}
                  </View>
                )}
              </>
            ) : tab === "Account" ? (
              <>
                <Text style={styles.title}>Your account</Text>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {account?.display_name || account?.email}
                  </Text>
                  <Text style={styles.body}>{account?.workspace}</Text>
                  <Text style={styles.body}>{account?.email}</Text>
                </View>
                <Text style={styles.caption}>
                  Stops load while you are online. Updates made during a
                  connection loss stay pending until MileDesk confirms them.
                </Text>
                <Action label="Sign out" secondary onPress={signOut} />
              </>
            ) : (
              <>
                <View style={styles.titleGroup}>
                  <Text style={styles.title}>
                    {tab === "Home" ? "Your next stops." : "Your deliveries"}
                  </Text>
                  <Text style={styles.body}>{account?.workspace}</Text>
                </View>
                <View style={styles.banner}>
                  <Text style={styles.bannerLabel}>Assigned to you</Text>
                  <Text style={styles.bannerTitle}>
                    {active.length} active{" "}
                    {active.length === 1 ? "stop" : "stops"}
                  </Text>
                  <Text style={styles.body}>
                    Pull down to check for new assignments.
                  </Text>
                </View>
                {(tab === "Home" ? active : deliveries).length ? (
                  (tab === "Home" ? active : deliveries).map(card)
                ) : (
                  <View style={styles.empty}>
                    <Text style={styles.heading}>No stops here yet</Text>
                    <Text style={styles.body}>
                      Your dispatcher will assign deliveries to your account.
                    </Text>
                  </View>
                )}
              </>
            )}
            {!!message && (
              <Text accessibilityLiveRegion="polite" style={styles.message}>
                {message}
              </Text>
            )}
          </ScrollView>
          <View style={styles.tabs}>
            {(["Home", "Deliveries", "Account"] as const).map((item) => (
              <Pressable
                key={item}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === item && !selected }}
                onPress={() => {
                  setTab(item);
                  setSelected(null);
                  setIssue(false);
                  setMessage("");
                }}
                style={[
                  styles.tab,
                  tab === item && !selected && styles.activeTab,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === item && !selected && styles.activeTabText,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  header: {
    minHeight: 68,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: color.line,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: {
    width: 32,
    height: 32,
  },
  brand: { color: color.ink, fontSize: 18, fontWeight: "700" },
  city: { color: color.muted, fontSize: 13 },
  content: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    padding: 24,
    paddingBottom: 48,
    gap: 18,
  },
  auth: {
    flexGrow: 1,
    justifyContent: "center",
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    padding: 28,
    gap: 18,
  },
  form: { gap: 12, marginTop: 20 },
  titleGroup: { gap: 5, marginTop: 10 },
  title: {
    color: color.ink,
    fontSize: 32,
    lineHeight: 39,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  heading: { color: color.ink, fontSize: 20, fontWeight: "700" },
  cardTitle: { color: color.ink, fontSize: 19, fontWeight: "700" },
  body: { color: color.muted, fontSize: 15, lineHeight: 23 },
  caption: { color: color.muted, fontSize: 13, lineHeight: 20 },
  label: { color: color.ink, fontSize: 14, fontWeight: "700" },
  id: { color: color.muted, fontSize: 12 },
  status: { color: color.green, fontSize: 13, fontWeight: "700" },
  failed: { color: color.danger },
  banner: {
    backgroundColor: color.sage,
    padding: 24,
    borderRadius: 18,
    gap: 8,
  },
  bannerLabel: { color: color.green, fontSize: 13, fontWeight: "700" },
  bannerTitle: { color: color.ink, fontSize: 25, fontWeight: "700" },
  card: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: 16,
    padding: 18,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  noteText: { color: color.ink, fontSize: 14 },
  link: {
    color: color.green,
    fontSize: 15,
    fontWeight: "700",
    paddingVertical: 8,
  },
  section: {
    paddingVertical: 16,
    gap: 16,
    borderBottomWidth: 1,
    borderColor: color.line,
  },
  address: {
    color: color.ink,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "600",
  },
  note: { backgroundColor: color.sand, borderRadius: 12, padding: 18, gap: 7 },
  actionRow: { flexDirection: "row", gap: 10 },
  action: {
    backgroundColor: color.green,
    minHeight: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    justifyContent: "center",
    alignItems: "center",
    flexGrow: 1,
  },
  secondary: { backgroundColor: color.sage },
  actionText: {
    color: color.surface,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  secondaryText: { color: color.ink },
  dimmed: { opacity: 0.55 },
  issue: { gap: 12, marginTop: 8 },
  input: {
    minHeight: 52,
    borderColor: color.line,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: color.surface,
    color: color.ink,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  reason: { minHeight: 100, paddingVertical: 14, textAlignVertical: "top" },
  message: {
    color: color.ink,
    backgroundColor: color.sage,
    padding: 16,
    borderRadius: 10,
    fontSize: 14,
    lineHeight: 21,
  },
  empty: {
    padding: 24,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: 16,
    gap: 8,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderColor: color.line,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 22,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  activeTab: { backgroundColor: color.sage },
  tabText: { color: color.muted, fontSize: 14 },
  activeTabText: { color: color.ink, fontWeight: "700" },
});
