import { useEffect, useState } from "react";
import { EmptyState, ErrorState, MetricCard, OwnerBadge, OwnerShell, PageHeader, SectionCard, ownerToneFromSeverity } from "../components/owner/OwnerUI";
import { useOwnerApi, type WorkerHealthAggregate } from "../api/owner";

const OwnerWorkerQueuesPage = () => {
  const ownerApi = useOwnerApi();
  const [data, setData] = useState<WorkerHealthAggregate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setError(null);
      try {
        const response = await ownerApi.getWorkerQueuesObservability();
        if (!cancelled) setData(response);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Failed to load worker and queues runtime.");
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [ownerApi]);

  return (
    <OwnerShell>
      <PageHeader eyebrow="Runtime" title="Operational runtime console" description="Consola técnica owner para worker heartbeat, Redis signal, colas, backlog, failed jobs y organizaciones bloqueadas." />
      {error ? <ErrorState message={error} /> : null}
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Worker" detail={data?.workerHealth.humanMessage || "Loading worker health..."}>{data ? <OwnerBadge tone={ownerToneFromSeverity(data.workerHealth.severity)}>{data.workerHealth.classification}</OwnerBadge> : <span className="text-sm text-slate-400">loading</span>}</MetricCard>
        <MetricCard label="Queue incidents" value={data?.queues.filter((queue) => queue.classification !== "alive").length ?? 0} detail="Backlog and failed job signals across runtime queues." />
        <MetricCard label="Blocked organizations" value={data?.blockedOrganizations.length ?? 0} detail="Organizations affected by worker, queue or sync blockers." />
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <SectionCard>
          <h2 className="text-lg font-semibold text-slate-950">Queues</h2>
          <div className="mt-4 space-y-3">
            {data?.queues.map((queue) => <div key={queue.name} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-medium text-slate-900">{queue.name}</h3><OwnerBadge tone={ownerToneFromSeverity(queue.severity)}>{queue.classification}</OwnerBadge></div><p className="mt-2 text-sm text-slate-600">waiting {queue.waiting} · active {queue.active} · delayed {queue.delayed} · failed {queue.failed} · oldest {queue.oldestJobAgeSeconds}s</p></div>)}
            {data && data.queues.length === 0 ? <EmptyState message="No queues reported by runtime." /> : null}
          </div>
        </SectionCard>
        <SectionCard>
          <h2 className="text-lg font-semibold text-slate-950">Blocked organizations</h2>
          <div className="mt-4 space-y-3">
            {data?.blockedOrganizations.length ? data.blockedOrganizations.map((item, index) => <div key={String(item.logtoOrganizationId || index)} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-medium text-slate-900">{String(item.name || item.logtoOrganizationId || "Unknown organization")}</h3><OwnerBadge tone={ownerToneFromSeverity(String(item.severity))}>{String(item.blocker || item.status)}</OwnerBadge></div><p className="mt-2 text-sm text-slate-600">{String(item.humanMessage || "Operational blocker detected.")}</p></div>) : <EmptyState message="No blocked organizations detected." />}
          </div>
        </SectionCard>
      </section>
    </OwnerShell>
  );
};

export default OwnerWorkerQueuesPage;
