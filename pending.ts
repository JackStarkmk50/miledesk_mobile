import { Platform } from "react-native";
import { Delivery } from "./api";

export type PendingUpdate = {
  deliveryId: string;
  baseVersion: number;
  baseStatus: Delivery["status"];
  status: Delivery["status"];
  reason: string;
};

function key(accountId: string) {
  return `miledesk-pending-${accountId}`;
}

async function read(keyName: string) {
  if (Platform.OS === "web")
    return globalThis.localStorage?.getItem(keyName) ?? null;
  const store = await import("expo-sqlite/kv-store");
  return store.default.getItemAsync(keyName);
}

async function write(keyName: string, value: string) {
  if (Platform.OS === "web") globalThis.localStorage?.setItem(keyName, value);
  else {
    const store = await import("expo-sqlite/kv-store");
    await store.default.setItemAsync(keyName, value);
  }
}

export async function readPending(accountId: string): Promise<PendingUpdate[]> {
  const stored = await read(key(accountId));
  if (!stored) return [];
  try {
    const items: unknown = JSON.parse(stored);
    return Array.isArray(items) ? (items as PendingUpdate[]) : [];
  } catch {
    return [];
  }
}

export async function savePending(accountId: string, items: PendingUpdate[]) {
  await write(key(accountId), JSON.stringify(items));
}
