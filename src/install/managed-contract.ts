import {
  GONKAGATE_BASE_URL,
  ZEROCLAW_PROVIDER_KEY,
} from "../constants/gateway.js";
import type { ManagedConfigField } from "./contracts.js";

const MANAGED_FIELD_DATA = [
  {
    configKey: "default_provider",
    propPath: "default-provider",
    description: `Set the active ZeroClaw provider to ${ZEROCLAW_PROVIDER_KEY}.`,
  },
  {
    configKey: "api_key",
    propPath: "api-key",
    description: "Persist the GonkaGate API key via ZeroClaw-managed storage.",
  },
  {
    configKey: "default_model",
    propPath: "default-model",
    description: "Persist the selected live GonkaGate model id.",
  },
] as const satisfies readonly ManagedConfigField[];

export const MANAGED_CONFIG_FIELDS: readonly ManagedConfigField[] =
  Object.freeze(MANAGED_FIELD_DATA.map((field) => ({ ...field })));

export const MANAGED_CONTRACT_SUMMARY = Object.freeze({
  baseUrl: GONKAGATE_BASE_URL,
  providerKey: ZEROCLAW_PROVIDER_KEY,
});
