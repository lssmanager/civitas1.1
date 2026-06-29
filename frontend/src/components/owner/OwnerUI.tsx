import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLogto } from "@logto/react";
import { APP_ENV } from "../../env";
import { appRoutes } from "../../navigation/routes";

type Tone = "info" | "success" | "warning" | "critical" | "neutral";

const toneClasses: Record<Tone, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  critical: "border-rose-200 bg-rose-50 text-rose-800",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
};

const badgeToneClasses: Record<Tone, string> = {
  info: "bg-blue-100 text-blue-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-800",
  critical: "bg-rose-100 text-rose-700",
  neutral: "bg-slate-100 text-slate-700",
};

const ownerNavItems = [
  { label: "Overview", path: appRoutes.owner.path, match: (pathname: string) => pathname === appRoutes.owner.path },
  { label: "Create", path: appRoutes.ownerOrganizations.path, match: (pathname: string) => pathname.startsWith(appRoutes.ownerOrganizations.path) },
  { label: "Runtime", path: appRoutes.ownerWorkerQueues.path, match: (pathname: string) => pathname.startsWith(appRoutes.ownerWorkerQueues.path) },
];

export const ownerToneFromSeverity = (severity?: string): Tone => {
  if (severity === "critical" || severity === "error") return "critical";
  if (severity === "warning") return "warning";
  if (severity === "success" || severity === "ok" || severity === "healthy") return "success";
  if (severity === "info") return "info";
  return "neutral";
};

export const OwnerBadge = ({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) => (
  <span className={`owner-badge ${badgeToneClasses[tone]}`}>{children}</span>
);

export const OwnerShell = ({ children, organizationId }: { children: ReactNode; organizationId?: string }) => {
  const { signOut } = useLogto();
  const location = useLocation();

  return (
    <div className="owner-shell" data-owner-shell="true">
      <header className="owner-topbar">
        <div className="owner-topbar-inner">
          <div className="flex min-w-0 items-center gap-6">
            <Link to={appRoutes.owner.path} className="shrink-0 text-xl font-semibold text-slate-950">Civitas 1.1</Link>
            <nav className="owner-primary-nav" aria-label="Owner primary navigation" data-owner-nav="true">
              {ownerNavItems.map((item) => {
                const active = item.match(location.pathname);
                return <Link key={item.path} to={item.path} className={`owner-nav-link ${active ? "owner-nav-link-active" : ""}`}>{item.label}</Link>;
              })}
            </nav>
            {organizationId ? <OwnerBadge>{organizationId}</OwnerBadge> : null}
          </div>
          <button onClick={() => signOut(APP_ENV.app.signOutRedirectUri)} className="owner-secondary-button">Sign out</button>
        </div>
      </header>
      <main className="owner-main">{children}</main>
    </div>
  );
};

export const PageHeader = ({ eyebrow, title, description, actions }: { eyebrow: string; title: ReactNode; description?: ReactNode; actions?: ReactNode }) => (
  <SectionCard className="owner-page-header">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="owner-eyebrow">{eyebrow}</p>
        <h1 className="owner-page-title">{title}</h1>
        {description ? <p className="owner-page-description">{description}</p> : null}
      </div>
      {actions ? <ActionBar>{actions}</ActionBar> : null}
    </div>
  </SectionCard>
);

export const SectionCard = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <section className={`owner-card ${className}`} data-owner-card="true">{children}</section>
);

export const MetricCard = ({ label, value, detail, children }: { label: string; value?: ReactNode; detail?: ReactNode; children?: ReactNode }) => (
  <SectionCard>
    <p className="owner-metric-label">{label}</p>
    {value !== undefined ? <p className="owner-metric-value">{value}</p> : null}
    {children ? <div className="mt-3">{children}</div> : null}
    {detail ? <p className="owner-muted mt-3">{detail}</p> : null}
  </SectionCard>
);

export const StatusBanner = ({ children, tone = "info" }: { children: ReactNode; tone?: Tone }) => (
  <section className={`owner-banner ${toneClasses[tone]}`}>{children}</section>
);

export const ActionBar = ({ children }: { children: ReactNode }) => <div className="owner-action-bar">{children}</div>;
export const EmptyState = ({ message }: { message: ReactNode }) => <div className="owner-state owner-empty-state">{message}</div>;
export const LoadingState = ({ message = "Loading..." }: { message?: ReactNode }) => <div className="owner-state owner-loading-state">{message}</div>;
export const ErrorState = ({ message }: { message: ReactNode }) => <StatusBanner tone="critical">{message}</StatusBanner>;

export const fieldClassName = "owner-field";
export const labelClassName = "owner-label";
export const secondaryButtonClassName = "owner-secondary-button";
export const primaryButtonClassName = "owner-primary-button";
