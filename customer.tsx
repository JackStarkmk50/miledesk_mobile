import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import {
  TrackingDelivery,
  readCustomerToken,
  request,
  saveCustomerToken,
} from "./api";

const color = {
  paper: "#F5F6F0",
  surface: "#FFFFFF",
  ink: "#203D30",
  muted: "#65756B",
  green: "#285B43",
  sage: "#E6EEDF",
  line: "#DDE4D9",
  sand: "#F3E8D6",
};
const stages = ["Assigned", "Picked up", "On the way", "Delivered"];
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
function extractToken(value: string) {
  return (
    value.trim().match(/(?:^|\/track\/)([a-f0-9]{64})(?:[/?#]|$)/)?.[1] ?? null
  );
}
function heading(status: string) {
  if (status === "Delivered") return "Delivered.";
  if (status === "Failed") return "Delivery needs attention.";
  if (status === "Address check") return "Address needs a check.";
  if (status === "Ready to assign")
    return "The shop is preparing your delivery.";
  if (status === "Assigned") return "A driver has been assigned.";
  return "Your delivery is moving.";
}

export default function CustomerApp() {
  const [token, setToken] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<TrackingDelivery | null>(null);
  const [link, setLink] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [tab, setTab] = useState<"Home" | "Address" | "About">("Home");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  function show(item: TrackingDelivery) {
    setDelivery(item);
    setAddress(item.address);
    setLandmark(item.landmark);
  }
  useEffect(() => {
    let active = true;
    readCustomerToken()
      .then(async (stored) => {
        if (!stored) return;
        try {
          const result = await request<{ delivery: TrackingDelivery }>(
            `/api/track/${stored}`,
          );
          if (active) {
            setToken(stored);
            setDelivery(result.delivery);
            setAddress(result.delivery.address);
            setLandmark(result.delivery.landmark);
          }
        } catch (error) {
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
  async function openLink() {
    const found = extractToken(link);
    if (!found) {
      setMessage("Paste a valid MileDesk tracking link.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await request<{ delivery: TrackingDelivery }>(
        `/api/track/${found}`,
      );
      await saveCustomerToken(found);
      setToken(found);
      show(result.delivery);
      setLink("");
      setTab("Home");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    if (!token) return;
    setRefreshing(true);
    setMessage("");
    try {
      const result = await request<{ delivery: TrackingDelivery }>(
        `/api/track/${token}`,
      );
      show(result.delivery);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setRefreshing(false);
    }
  }
  async function saveAddress() {
    if (!token || !delivery) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await request<{ delivery: TrackingDelivery }>(
        `/api/track/${token}`,
        "PATCH",
        undefined,
        {
          version: delivery.version,
          address: address.trim(),
          landmark: landmark.trim(),
        },
      );
      show(result.delivery);
      setMessage("Address sent to the dispatcher for review.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function forget() {
    await saveCustomerToken(null);
    setToken(null);
    setDelivery(null);
    setLink("");
    setMessage("Tracking link removed from this device.");
  }
  const editable =
    delivery &&
    ["Address check", "Ready to assign", "Assigned"].includes(delivery.status);
  return (
    <View style={styles.screen}>
      <ExpoStatusBar style="dark" />
      <View style={{ height: StatusBar.currentHeight ?? 42 }} />
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.mark}>
            <Text style={styles.markText}>m</Text>
          </View>
          <Text style={styles.brand}>MileDesk</Text>
        </View>
        <Text style={styles.city}>Salem</Text>
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={color.green} />
          <Text style={styles.body}>Opening delivery…</Text>
        </View>
      ) : (
        <>
          <ScrollView
            refreshControl={
              token ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={refresh}
                  tintColor={color.green}
                />
              ) : undefined
            }
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {!delivery ? (
              <>
                <Text style={styles.title}>Your delivery, clearly.</Text>
                <Text style={styles.body}>
                  Paste the private tracking link the shop shared with you.
                </Text>
                <View style={styles.form}>
                  <Text style={styles.label}>Tracking link</Text>
                  <TextInput
                    style={styles.input}
                    value={link}
                    onChangeText={setLink}
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel="Tracking link"
                    placeholder="https://.../track/..."
                  />
                  <Action
                    label={busy ? "Opening…" : "Open delivery"}
                    disabled={busy || !link.trim()}
                    onPress={openLink}
                  />
                </View>
                <View style={styles.note}>
                  <Text style={styles.label}>Waiting for a link?</Text>
                  <Text style={styles.body}>
                    Ask the shop that accepted your order. You do not need an
                    account to open a tracking link.
                  </Text>
                </View>
              </>
            ) : tab === "About" ? (
              <>
                <Text style={styles.title}>About this link</Text>
                <Text style={styles.body}>
                  Only someone with this private link can open this delivery. It
                  expires after 30 days or when the shop replaces it.
                </Text>
                <Text style={styles.body}>
                  Live location, arrival estimates, ordering, and payments are
                  not available here.
                </Text>
                <Action
                  label="Remove link from this device"
                  secondary
                  onPress={forget}
                />
              </>
            ) : tab === "Address" ? (
              <>
                <Text style={styles.title}>Help us find your door.</Text>
                <Text style={styles.body}>
                  Your correction goes to the dispatcher before the driver picks
                  up this delivery.
                </Text>
                {editable ? (
                  <View style={styles.form}>
                    <Text style={styles.label}>Street address</Text>
                    <TextInput
                      style={[styles.input, styles.multiline]}
                      value={address}
                      onChangeText={setAddress}
                      multiline
                      accessibilityLabel="Street address"
                    />
                    <Text style={styles.label}>Landmark or entrance note</Text>
                    <TextInput
                      style={[styles.input, styles.multiline]}
                      value={landmark}
                      onChangeText={setLandmark}
                      multiline
                      accessibilityLabel="Landmark or entrance note"
                    />
                    <Action
                      label={busy ? "Sending…" : "Send address correction"}
                      disabled={busy || address.trim().length < 5}
                      onPress={saveAddress}
                    />
                  </View>
                ) : (
                  <View style={styles.note}>
                    <Text style={styles.label}>Address changes are closed</Text>
                    <Text style={styles.body}>
                      Contact {delivery.workspace} to change the destination
                      now.
                    </Text>
                    <Text style={styles.address}>{delivery.address}</Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.title}>{heading(delivery.status)}</Text>
                <Text style={styles.body}>
                  {delivery.workspace}, delivery {delivery.id.slice(0, 8)}
                </Text>
                <View style={styles.banner}>
                  <Text style={styles.bannerLabel}>Current status</Text>
                  <Text style={styles.bannerTitle}>{delivery.status}</Text>
                  <Text style={styles.body}>
                    {delivery.status === "Address check"
                      ? "The dispatcher is checking your location details."
                      : delivery.status === "Failed"
                        ? "Contact the shop to arrange the next step."
                        : "A live arrival estimate is not available."}
                  </Text>
                </View>
                <View style={styles.section}>
                  <Text style={styles.heading}>Delivery progress</Text>
                  {stages.map((stage, index) => (
                    <View key={stage} style={styles.step}>
                      <View
                        style={[
                          styles.stepMark,
                          stages.indexOf(delivery.status) >= index &&
                            styles.stepDone,
                        ]}
                      >
                        <Text style={styles.stepNumber}>{index + 1}</Text>
                      </View>
                      <Text style={styles.body}>{stage}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.section}>
                  <Text style={styles.heading}>Destination</Text>
                  <Text style={styles.address}>{delivery.address}</Text>
                  <View style={styles.note}>
                    <Text style={styles.label}>Landmark or entrance</Text>
                    <Text style={styles.body}>
                      {delivery.landmark || "No entrance note yet."}
                    </Text>
                  </View>
                  {editable && (
                    <Action
                      label="Check address"
                      secondary
                      onPress={() => setTab("Address")}
                    />
                  )}
                </View>
              </>
            )}
            {!!message && (
              <Text accessibilityLiveRegion="polite" style={styles.message}>
                {message}
              </Text>
            )}
          </ScrollView>
          {delivery && (
            <View style={styles.tabs}>
              {(["Home", "Address", "About"] as const).map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === item }}
                  onPress={() => {
                    setTab(item);
                    setMessage("");
                  }}
                  style={[styles.tab, tab === item && styles.activeTab]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      tab === item && styles.activeTabText,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
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
  brand: { color: color.ink, fontSize: 20, fontWeight: "700" },
  city: { color: color.muted, fontSize: 13 },
  content: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    padding: 24,
    paddingBottom: 48,
    gap: 18,
  },
  title: {
    color: color.ink,
    fontSize: 32,
    lineHeight: 39,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  heading: { color: color.ink, fontSize: 20, fontWeight: "700" },
  body: { color: color.muted, fontSize: 15, lineHeight: 23 },
  address: {
    color: color.ink,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "600",
  },
  label: { color: color.ink, fontSize: 14, fontWeight: "700" },
  form: { gap: 12, marginVertical: 16 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: 12,
    backgroundColor: color.surface,
    paddingHorizontal: 16,
    color: color.ink,
    fontSize: 16,
  },
  multiline: { minHeight: 90, paddingVertical: 14, textAlignVertical: "top" },
  note: { backgroundColor: color.sand, borderRadius: 12, padding: 18, gap: 7 },
  banner: {
    backgroundColor: color.sage,
    borderRadius: 18,
    padding: 24,
    gap: 8,
  },
  bannerLabel: { color: color.green, fontSize: 13, fontWeight: "700" },
  bannerTitle: { color: color.ink, fontSize: 25, fontWeight: "700" },
  section: {
    gap: 15,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: color.line,
  },
  step: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: color.line,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDone: { backgroundColor: color.green },
  stepNumber: { color: color.surface, fontSize: 13, fontWeight: "700" },
  action: {
    minHeight: 52,
    backgroundColor: color.green,
    borderRadius: 12,
    padding: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  secondary: { backgroundColor: color.sage },
  actionText: { color: color.surface, fontSize: 15, fontWeight: "700" },
  secondaryText: { color: color.ink },
  dimmed: { opacity: 0.55 },
  message: {
    color: color.ink,
    backgroundColor: color.sage,
    padding: 16,
    borderRadius: 10,
    lineHeight: 21,
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
