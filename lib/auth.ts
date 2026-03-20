import { storageLocalSet } from "./browser-api";

export const VSCODE_CLIENT_ID = "Iv1.b507a08c87ecfe98";

export async function requestDeviceCode() {
  const response = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: { "Accept": "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: VSCODE_CLIENT_ID, scope: "read:user" }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error_description || data.error);
  if (!data.user_code || !data.verification_uri) throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
  return data;
}

export async function pollForGitHubToken(deviceCode: string, interval: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const poll = setInterval(async () => {
      const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: VSCODE_CLIENT_ID,
          device_code: deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      });
      const data = await response.json();
      if (data.access_token) {
        clearInterval(poll);
        resolve(data.access_token);
      } else if (data.error === "access_denied") {
        clearInterval(poll);
        reject(new Error("AUTH_DENIED"));
      }
    }, interval * 1000);
  });
}

export async function getCopilotToken(
  githubToken: string,
  vsCodeVersion: string
): Promise<{ token: string; expiresAt: number }> {
  const response = await fetch("https://api.github.com/copilot_internal/v2/token", {
    headers: {
      Authorization: `token ${githubToken}`,
      "editor-version": `vscode/${vsCodeVersion}`,
      "editor-plugin-version": "copilot-chat/0.22.4",
      "Copilot-Integration-Id": "vscode-chat",
      "user-agent": "GitHubCopilotChat/0.22.4",
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    const err = new Error("COPILOT_TOKEN_FAILED") as Error & { statusCode: number };
    err.statusCode = response.status;
    throw err;
  }
  const data = await response.json();
  return { token: data.token, expiresAt: data.expires_at * 1000 };
}

export async function getLatestVSCodeVersion(): Promise<string> {
  try {
    const res = await fetch("https://api.github.com/repos/microsoft/vscode/releases/latest");
    const data = await res.json();
    return data.tag_name;
  } catch {
    return "1.96.0";
  }
}

export async function checkGitHubLogin(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.cookies.get(
      { url: "https://github.com", name: "user_session" },
      (cookie) => {
        resolve(!!cookie?.value);
      }
    );
  });
}

export async function openDeviceAuthTab(userCode: string, verificationUri: string): Promise<void> {
  await storageLocalSet({ pendingDeviceCode: userCode });
  const url = `${verificationUri}?user_code=${encodeURIComponent(userCode)}`;
  chrome.tabs.create({ url });
}
