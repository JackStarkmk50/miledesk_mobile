import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Account, Delivery, readToken, request, saveToken } from "./api";

const color = {
  paper: "#F5F6F0",
  surface: "#FFFFFF",
  ink: "#203D30",
  muted: "#65756B",
  green: "#285B43",
  sage: "#E6EEDF",
  line: "#DDE4D9",
  sand: "#F3E8D6",
  danger: "#963F30",
};
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
    setAccount(session.account);
    setDeliveries(queue.deliveries);
  }, []);
  useEffect(() => {
    let active = true;
    readToken()
      .then(async (stored) => {
        if (!stored) return;
        try {
          const [session, queue] = await Promise.all([
            request<{ account: Account }>("/api/mobile/session", "GET", stored),
            request<{ deliveries: Delivery[] }>(
              "/api/mobile/deliveries",
              "GET",
              stored,
            ),
          ]);
          if (active) {
            setToken(stored);
            setAccount(session.account);
            setDeliveries(queue.deliveries);
          }
        } catch (error) {
          if ((error as Error).message === "Sign in required.")
            await saveToken(null);
          if (active) setMessage((error as Error).message);
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
  }, []);
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
      await refresh(result.token);
      setToken(result.token);
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
    if (!token || !order) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await request<{ delivery: Delivery }>(
        `/api/mobile/deliveries/${order.id}`,
        "PATCH",
        token,
        {
          version: order.version,
          status,
          reason: status === "Failed" ? reason.trim() : "",
        },
      );
      setDeliveries((items) =>
        items.map((item) => (item.id === order.id ? result.delivery : item)),
      );
      setIssue(false);
      setReason("");
      setMessage(
        status === "Failed"
          ? "Issue sent to the dispatcher."
          : `Marked ${status.toLowerCase()}.`,
      );
    } catch (error) {
      await refresh(token).catch(() => null);
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
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
          <View style={styles.mark}>
            <Text style={styles.markText}>m</Text>
          </View>
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
                      disabled={busy}
                      onPress={() => update(next[order.status]!.status)}
                    />
                    <Action
                      label="Report a delivery issue"
                      secondary
                      disabled={busy}
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
                  Stops load while you are online. Status changes need a
                  connection and confirmation from MileDesk.
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
    borderRadius: 9,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
  },
  markText: { color: color.surface, fontSize: 24, fontWeight: "700" },
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
