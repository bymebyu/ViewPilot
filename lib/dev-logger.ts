export const DEV_MODE = false;

const logs: string[] = [];
let startTime = 0;

export const devLogger = {
  reset(label = "") {
    // 기존 로그를 지우지 않고 구분선만 추가 — 연속 작업의 로그가 모두 보임
    startTime = Date.now();
    if (label) logs.push(`\n=== ${label} [${new Date().toISOString()}] ===`);
  },
  log(msg: string) {
    if (!DEV_MODE) return;
    const ms = Date.now() - startTime;
    const entry = `[${ms}ms] ${msg}`;
    logs.push(entry);
    console.log("[DevLog]", entry);
  },
  get(): string {
    return logs.join("\n");
  },
};
