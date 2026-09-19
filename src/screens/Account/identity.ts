import type { LinkedProvider } from "animu-api";
import { maskEmail, maskHandle, maskIdentifier } from "@/utils/mask";

export interface ProviderDisplay {
  /** The real detail line, shown while revealed. */
  value: string;
  /** The same line with the personal half masked. */
  masked: string;
}

/**
 * Identity line for a linked provider. Discord shows its `@handle` (or the
 * numeric id); Google/Apple show `name · email`. Each variant carries a
 * masked twin so the row protects the personal half by default.
 */
export function providerDisplay(provider: LinkedProvider): ProviderDisplay | null {
  const handle = provider.providerUsername;

  if (provider.provider === "discord") {
    if (handle) return { value: `@${handle}`, masked: maskHandle(handle) };
    if (provider.providerUserId) {
      return {
        value: provider.providerUserId,
        masked: maskIdentifier(provider.providerUserId),
      };
    }
    return null;
  }

  const parts: string[] = [];
  const maskedParts: string[] = [];
  if (provider.providerName) {
    parts.push(provider.providerName);
    maskedParts.push(provider.providerName);
  }
  if (provider.providerEmail) {
    parts.push(provider.providerEmail);
    maskedParts.push(maskEmail(provider.providerEmail));
  }
  if (parts.length > 0) {
    return { value: parts.join(" · "), masked: maskedParts.join(" · ") };
  }
  if (handle) return { value: `@${handle}`, masked: maskHandle(handle) };
  if (provider.providerUserId) {
    return {
      value: provider.providerUserId,
      masked: maskIdentifier(provider.providerUserId),
    };
  }
  return null;
}
