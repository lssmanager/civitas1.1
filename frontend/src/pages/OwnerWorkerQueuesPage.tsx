import { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import { useOwnerApi, type WorkerHealthAggregate } from "../api/owner";

const cardClass = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";
const badgeClass = (tone: string) => `inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone === "critical" ? "bg-rose-100 text-rose-700" : tone === "warning" ? "bg-amber-100 text-amber-800" : tone === "success" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`;

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
    <div className="min-h-screen bg-slate-50">
      <Topbar />
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className={cardClass}>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Runtime</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Operational runtime console</h1>
          <p className="mt-2 text-sm text-slate-600">Consola técnica owner para worker heartbeat, Redis signal, colas, backlog, failed jobs y organizaciones bloqueadas.</p>
        </section>

        {error ? <section className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{error}</section> : null}

        <section className="grid gap-4 md:grid-cols-3">
          <article className={cardClass}><p className="text-sm text-slate-500">Worker</p><div className="mt-3">{data ? <span className={badgeClass(data.workerHealth.severity)}>{data.workerHealth.classification}</span> : <span className="text-sm text-slate-400">loading</span>}</div><p className="mt-3 text-sm text-slate-600">{data?.workerHealth.humanMessage || "Loading worker health..."}</p></article>
          <article className={cardClass}><p className="text-sm text-slate-500">Queue incidents</p><p className="mt-2 text-3xl font-semibold text-slate-950">{data?.queues.filter((queue) => queue.classification !== "alive").length ?? 0}</p><p className="mt-3 text-sm text-slate-600">Backlog and failed job signals across runtime queues.</p></article>
          <article className={cardClass}><p className="text-sm text-slate-500">Blocked organizations</p><p className="mt-2 text-3xl font-semibold text-slate-950">{data?.blockedOrganizations.length ?? 0}</p><p className="mt-3 text-sm text-slate-600">Organizations affected by worker, queue or sync blockers.</p></article>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className={cardClass}>
            <h2 className="text-lg font-semibold text-slate-950">Queues</h2>
            <div className="mt-4 space-y-3">
              {data?.queues.map((queue) => (
                <div key={queue.name} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3"><h3 className="font-medium text-slate-900">{queue.name}</h3><span className={badgeClass(queue.severity)}>{queue.classification}</span></div>
                  <p className="mt-2 text-sm text-slate-600">waiting {queue.waiting} · active {queue.active} · delayed {queue.delayed} · failed {queue.failed} · oldest {queue.oldestJobAgeSeconds}s</p>
                </div>
              ))}
            </div>
          </article>
          <article className={cardClass}>
            <h2 className="text-lg font-semibold text-slate-950">Blocked organizations</h2>
            <div className="mt-4 space-y-3">
              {data?.blockedOrganizations.length ? data.blockedOrganizations.map((item, index) => (
                <div key={String(item.logtoOrganizationId || index)} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3"><h3 className="font-medium text-slate-900">{String(item.name || item.logtoOrganizationId || "Unknown organization")}</h3><span className={badgeClass(item.severity)}>{String(item.blocker || item.status)}</span></div>
                  <p className="mt-2 text-sm text-slate-600">{String(item.humanMessage || "Operational blocker detected.")}</p>
                </div>
              )) : <p className="text-sm text-slate-500">No blocked organizations detected.</p>}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
};

export default OwnerWorkerQueuesPage;