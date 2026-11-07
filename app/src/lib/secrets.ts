// macOS Keychain access (see src-tauri/src/secrets.rs).
import { invoke } from "@tauri-apps/api/core";

export type SecretKey = "github_token" | "device_secret";

/** The Keychain couldn't be read or written (e.g. access was denied). Not the same as "no secret". */
export class KeychainError extends Error {}

const call = <T>(cmd: string, args: Record<string, unknown>) =>
  invoke<T>(cmd, args).catch((e) => {
    console.error(cmd, e);
    throw new KeychainError(String(e));
  });

export const getSecret = (key: SecretKey) => call<string | null>("secret_get", { key });
export const setSecret = (key: SecretKey, value: string) => call("secret_set", { key, value });
export const deleteSecret = (key: SecretKey) => call("secret_delete", { key });
