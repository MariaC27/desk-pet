// macOS Keychain access (see src-tauri/src/secrets.rs).
import { invoke } from "@tauri-apps/api/core";

export type SecretKey = "github_token" | "device_secret";

export const getSecret = (key: SecretKey) => invoke<string | null>("secret_get", { key });
export const setSecret = (key: SecretKey, value: string) => invoke("secret_set", { key, value });
export const deleteSecret = (key: SecretKey) => invoke("secret_delete", { key });
