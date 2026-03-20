export default defineContentScript({
  matches: ["https://github.com/login/device*"],
  async main() {
    const url = window.location.href;

    // [1단계] select_account 페이지: Continue 버튼 자동 클릭 후 종료
    if (url.includes("/select_account")) {
      const tryClick = () => {
        const btn = document.querySelector<HTMLInputElement>(
          'input[type="submit"][value="Continue"]'
        );
        if (btn) { btn.click(); return true; }
        return false;
      };
      let n = 0;
      const t = setInterval(() => { if (tryClick() || n++ > 30) clearInterval(t); }, 100);
      return;
    }

    // [2단계] 실제 코드 입력 페이지: pendingDeviceCode 읽어서 입력
    const result = await new Promise<Record<string, any>>((resolve) => {
      chrome.storage.local.get("pendingDeviceCode", (r) => resolve(r ?? {}));
    });
    const userCode: string | undefined = result.pendingDeviceCode;
    if (!userCode) return;

    const tryFill = () => {
      // GitHub의 실제 구조: class="js-user-code-field", 각 1글자씩 8개 input
      const codeInputs = document.querySelectorAll<HTMLInputElement>(".js-user-code-field");
      if (codeInputs.length > 0) {
        const chars = userCode.replace(/-/g, ""); // "ABCD1234"
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        codeInputs.forEach((input, i) => {
          if (!chars[i]) return;
          if (nativeSetter) nativeSetter.call(input, chars[i]);
          else input.value = chars[i];
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
        });
        try { chrome.storage.local.remove("pendingDeviceCode", () => {}); } catch {}
        // 폼 제출 (500ms 딜레이로 GitHub 유효성 검사 완료 대기)
        const form = codeInputs[0].closest("form");
        const submit =
          form?.querySelector<HTMLButtonElement>('button[type="submit"]') ??
          form?.querySelector<HTMLInputElement>('input[type="submit"]');
        if (submit) setTimeout(() => (submit as HTMLElement).click(), 500);
        return true;
      }

      // fallback: 단일 input (미래 GitHub UI 변경 대비)
      const single = document.querySelector<HTMLInputElement>(
        'input[name="user-code"], input[autocomplete="one-time-code"]'
      );
      if (single) {
        single.value = userCode;
        single.dispatchEvent(new Event("input", { bubbles: true }));
        try { chrome.storage.local.remove("pendingDeviceCode", () => {}); } catch {}
        const form = single.closest("form");
        const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
        if (submit) setTimeout(() => submit.click(), 300);
        return true;
      }

      return false;
    };

    let n = 0;
    const t = setInterval(() => { if (tryFill() || n++ > 30) clearInterval(t); }, 100);
  },
});
