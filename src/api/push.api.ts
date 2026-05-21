import { api } from "./axios";

export async function subscribePush(subscription: PushSubscriptionJSON) {
  await api.post("/push/subscribe", {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
  });
}

export async function unsubscribePush(endpoint: string) {
  await api.delete("/push/subscribe", { data: { endpoint } });
}
