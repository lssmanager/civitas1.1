import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Topbar from "../components/Topbar";
import { useOwnerApi } from "../api/owner";
import type { ConsolidatedOperationalResponse, OperationalBlock } from "../contracts/operational";

const cardClass = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";
const badgeClass = (tone: string) => `inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone === "critical" ? "bg-rose-100 text-rose-700" : tone === "warning" ? "bg-amber-100 text-amber-800" : tone === "success" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`;
const actionLabel: Record<string, string> = { retry: "Retry", verify_provider: "Verify provider", open_organization: "Open organization", wait_first_wordpress_login: "Wait first WordPress login", manual_retry_required: "Manual retry required", human_action_required: "Human action required", none: "No action" };

function BlockCard({ title, block }: { title: string; block: OperationalBlock }) {
  return (
    <article className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">{block.humanMessage || block.status}</h3>
        </div>
        <span className={badgeClass(block.severity)}>{block.severity}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className={badgeClass(block.status === "ok" || block.status === "healthy" ? "success" : block.severity)}>{block.status}</span>
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{block.freshness.source}</span>
      </div>
      <dl className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <div><dt className="font-medium text-slate-900">Provider code</dt><dd className="mt-1 break-all">{block.providerCode || "-"}</dd></div>
        <div><dt className="font-medium text-slate-900">Provider status</dt><dd className="mt-1 break-all">{String(block.providerStatus || "-")}</dd></div>
        <div><dt className="font-medium text-slate-900">Checked at</dt><dd className="mt-1">{block.freshness.checkedAt || "-"}</dd></div>
        <div><dt className="font-medium text-slate-900">Next action</dt><dd className="mt-1">{actionLabel[String(block.nextAction)] || String(block.nextAction)}</dd></div>
      </dl>
    </article>
  );
}

const OwnerOrganizationOperationalPage = () => {
  const { organizationId = "" } = useParams();
  const ownerApi = useOwnerApi();
  const [state, setState] = useState<ConsolidatedOperationalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    const load = async () => {
      setError(null);
      try {
        const response = await ownerApi.getOrganizationOperationalState(organizationId);
        if (cancelled) return;
        setState(response);
        const interval = response.polling?.shouldPoll ? Math.max(Number(response.polling.intervalSeconds || 3), 1) * 1000 : 0;
        clearTimer();
        if (interval) timerRef.current = setTimeout(() => void load(), interval);
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Failed to load operational state.");
        clearTimer();
        if (state?.polling?.shouldPoll) timerRef.current = setTimeout(() => void load(), Math.max(Number(state.polling.intervalSeconds || 3), 1) * 1000);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    setLoading(true);
    void load();
    return () => { cancelled = true; clearTimer(); };
  }, [organizationId, ownerApi]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar organizationId={organizationId} />
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className={cardClass}>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Operational state</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{state?.organization.name || organizationId}</h1>
          <p className="mt-2 text-sm text-slate-600">Vista limpia de la organización derivada del backbone operacional consolidado. El resumen owner ya no depende de logs legacy.</p>
        </section>

        {error ? <section className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{error}</section> : null}

        <section className="grid gap-4 md:grid-cols-4">
          <article className={cardClass}><p className="text-sm text-slate-500">Summary</p><div className="mt-3"><span className={badgeClass(state?.summary.severity || "info")}>{state?.summary.status || (loading ? "loading" : "unknown")}</span></div><p className="mt-3 text-sm text-slate-600">{state?.summary.humanMessage || "Loading operational summary..."}</p></article>
          <article className={cardClass}><p className="text-sm text-slate-500">Dominant source</p><p className="mt-2 text-lg font-semibold text-slate-950">{state?.summary.dominantSource || "-"}</p></article>
          <article className={cardClass}><p className="text-sm text-slate-500">Next action</p><p className="mt-2 text-lg font-semibold text-slate-950">{state ? (actionLabel[String(state.summary.nextAction)] || String(state.summary.nextAction)) : "-"}</p></article>
          <article className={cardClass}><p className="text-sm text-slate-500">Polling</p><p className="mt-2 text-lg font-semibold text-slate-950">{state?.polling.shouldPoll ? `${state.polling.intervalSeconds}s` : "stopped"}</p><p className="mt-1 text-xs text-slate-500">{state?.polling.reason || "-"}</p></article>
        </section>

        {state ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <BlockCard title="Canonical / Logto" block={state.canonical} />
            <BlockCard title="FluentCRM" block={state.fluentcrm} />
            <BlockCard title="WordPress" block={state.wordpress} />
            <BlockCard title="Worker" block={state.worker} />
            <BlockCard title="Live verification" block={state.liveVerification} />
            <BlockCard title="Contact progress" block={state.contactProgress} />
          </section>
        ) : null}
      </main>
    </div>
  );
};

export default OwnerOrganizationOperationalPage;