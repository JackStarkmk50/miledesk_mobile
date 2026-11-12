import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export type Account = {
  id: string;
  email: string;
  display_name: string;
  workspace: string;
  service_status: string;
};
export type Delivery = {
  id: string;
  customer: string;
  phone: string;
  address: string;
  landmark: string;
  status:
    | "Address check"
    | "Ready to assign"
    | "Assigned"
    | "Picked up"
    | "On the way"
    | "Delivered"
    | "Failed";
  version: number;
  created_at: string;
  failure_reason: string;
  location_latitude: number | null;
  location_longitude: number | null;
  location_accuracy_m: number | null;
  has_proof?: boolean;
};
export type TrackingDelivery = {
  id: string;
  customer: string;
  address: string;
  landmark: string;
  status: string;
  version: number;
  workspace: string;
  location_latitude: number | null;
  location_longitude: number | null;
  location_accuracy_m: number | null;
};
const key = "miledesk-partner-session";
const customerKey = "miledesk-customer-link";
const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
let browserToken: string | null = null;
export class NetworkError extends Error {}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function configured() {
  return !!base && /^https?:\/\//.test(base);
}
export async function readToken() {
  return Platform.OS === "web" ? browserToken : SecureStore.getItemAsync(key);
}
export async function saveToken(token: string | null) {
  if (Platform.OS === "web") {
    browserToken = token;
    return;
  }
  if (token) await SecureStore.setItemAsync(key, token);
  else await SecureStore.deleteItemAsync(key);
}
let browserCustomerToken: string | null = null;
export async function readCustomerToken() {
  return Platform.OS === "web"
    ? browserCustomerToken
    : SecureStore.getItemAsync(customerKey);
}
export async function saveCustomerToken(token: string | null) {
  if (Platform.OS === "web") {
    browserCustomerToken = token;
    return;
  }
  if (token) await SecureStore.setItemAsync(customerKey, token);
  else await SecureStore.deleteItemAsync(customerKey);
}
export async function request<T>(
  path: string,
  method = "GET",
  token?: string,
  body?: object,
): Promise<T> {
  if (!configured())
    throw new Error("Set EXPO_PUBLIC_API_URL to the MileDesk server address.");
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new NetworkError(
      "Cannot reach MileDesk. Check your connection and server address.",
    );
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      result.error || "Request failed. Try again.",
      response.status,
    );
  return result as T;
}

export async function uploadProof(id: string, token: string, uri: string) {
  if (!configured())
    throw new Error("Set EXPO_PUBLIC_API_URL to the MileDesk server address.");
  const form = new FormData();
  if (Platform.OS === "web")
    form.append("photo", await (await fetch(uri)).blob(), "delivery.jpg");
  else
    form.append("photo", {
      uri,
      name: "delivery.jpg",
      type: "image/jpeg",
    } as unknown as Blob);
  let response: Response;
  try {
    response = await fetch(`${base}/api/mobile/deliveries/${id}/proof`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch {
    throw new NetworkError(
      "Cannot reach MileDesk. Check your connection and try the photo again.",
    );
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(result.error || "Photo upload failed.", response.status);
}
