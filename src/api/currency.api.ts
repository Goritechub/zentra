import { api } from "./axios";
import type { FxRates } from "@/lib/currency";

export async function getRates(): Promise<FxRates> {
  const response = await api.get<FxRates>("/currency/rates");
  return response.data;
}
