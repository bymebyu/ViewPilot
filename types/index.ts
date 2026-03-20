export interface StoredAuth {
  githubToken: string;
  copilotToken: string;
  copilotTokenExpiry: number;
  vsCodeVersion: string;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export type MessageRole = "user" | "assistant" | "system";
