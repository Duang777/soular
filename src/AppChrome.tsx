import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AccountPanel } from "./AccountPanel";
import { BrandMark } from "./BrandMark";

export function AppChrome({
  backLink,
  trailing,
  hidden = false,
}: {
  backLink?: { to: string; label: string };
  trailing?: ReactNode;
  hidden?: boolean;
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
      <div className="app-chrome__end">
        {trailing}
        <AccountPanel />
      </div>
    </header>
  );
}
