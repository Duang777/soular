import { OAuthAccount } from "./OAuthAccount";
import { ZhihuPortrait } from "./ZhihuPortrait";

export function AccountPanel() {
  return (
    <aside className="account-panel" aria-label="账号与画像">
      <OAuthAccount />
      <ZhihuPortrait embedded />
    </aside>
  );
}
