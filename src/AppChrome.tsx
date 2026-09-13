import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AccountPanel } from "./AccountPanel";
import { BrandMark } from "./BrandMark";

export function AppChrome({
  backLink,
  center,
  trailing,
  hidden = false,
  showAccount = true,
}: {
  backLink?: { to: string; label: string };
  center?: string;
  trailing?: ReactNode;
  hidden?: boolean;
  showAccount?: boolean;
}) {
  if (hidden) return null;

  return (
    <header className="app-chrome">
      <div className="app-chrome__start">
        <BrandMark className="brand-lockup--chrome" />
        {backLink ? (
          <Link to={backLink.to} className="app-chrome__back">
            {backLink.label}
          </Link>
        ) : null}
      </div>
      {center ? (
        <p className="app-chrome__center" title={center}>{center}</p>
      ) : null}
      <div className="app-chrome__end">
        {trailing}
        {showAccount ? <AccountPanel /> : null}
      </div>
    </header>
  );
}
