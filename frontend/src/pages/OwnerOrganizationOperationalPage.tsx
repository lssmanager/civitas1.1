import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ErrorState, MetricCard, OwnerBadge, OwnerShell, PageHeader, ownerToneFromSeverity } from "../components/owner/OwnerUI";
import { useOwnerApi } from "../api/owner";
import type { ConsolidatedOperationalResponse, OperationalBlock } from "../contracts/operational";

const actionLabel: Record<string, string> = { retry: "Retry", verify_provider: "Verify provider", open_organization: "Open organization", wait_first_wordpress_login: "Wait first WordPress login", manual_retry_required: "Manual retry required", human_action_required: "Human action required", none: "No action" };

function BlockCard({ title, block }: { title: string; block: OperationalBlock }) {
  return (
    <article className="owner-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">{block.humanMessage || block.status}</h3>
        </div>
        <OwnerBadge tone={ownerToneFromSeverity(block.severity)}>{block.severity}</OwnerBadge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <OwnerBadge tone={ownerToneFromSeverity(block.status === "ok" || block.status === "healthy" ? "success" : block.severity)}>{block.status}</OwnerBadge>
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
    <OwnerShell organizationId={organizationId}>
      <PageHeader eyebrow="Operational state" title={state?.organization.name || organizationId} description="Vista técnica de la organización derivada del backbone operacional consolidado. Runtime conserva el detalle operativo separado del resumen owner." />
      {error ? <ErrorState message={error} /> : null}
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Summary" detail={state?.summary.humanMessage || "Loading operational summary..."}><OwnerBadge tone={ownerToneFromSeverity(state?.summary.severity || "info")}>{state?.summary.status || (loading ? "loading" : "unknown")}</OwnerBadge></MetricCard>
        <MetricCard label="Dominant source" value={state?.summary.dominantSource || "-"} />
        <MetricCard label="Next action" value={state ? (actionLabel[String(state.summary.nextAction)] || String(state.summary.nextAction)) : "-"} />
        <MetricCard label="Polling" value={state?.polling.shouldPoll ? `${state.polling.intervalSeconds}s` : "stopped"} detail={state?.polling.reason || "-"} />
      </section>
      {state ? <section className="grid gap-4 lg:grid-cols-2"><BlockCard title="Canonical / Logto" block={state.canonical} /><BlockCard title="FluentCRM" block={state.fluentcrm} /><BlockCard title="WordPress" block={state.wordpress} /><BlockCard title="Worker" block={state.worker} /><BlockCard title="Live verification" block={state.liveVerification} /><BlockCard title="Contact progress" block={state.contactProgress} /></section> : null}
    </OwnerShell>
  );
};

export default OwnerOrganizationOperationalPage;
