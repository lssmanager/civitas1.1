import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Topbar from "../components/Topbar";
import { useOwnerApi, type OwnerOrganization, type WorkerHealthAggregate } from "../api/owner";
import { appRoutes } from "../navigation/routes";

const cardClass = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";
const badgeClass = (tone: string) => `inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone === "critical" ? "bg-rose-100 text-rose-700" : tone === "warning" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`;

const OwnerOperationalHomePage = () => {
  const ownerApi = useOwnerApi();
  const [organizations, setOrganizations] = useState<OwnerOrganization[]>([]);
  const [runtime, setRuntime] = useState<WorkerHealthAggregate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [orgResponse, runtimeResponse] = await Promise.all([
          ownerApi.getOrganizations(),
          ownerApi.getWorkerQueuesObservability(),
        ]);
        if (cancelled) return;
        setOrganizations(orgResponse.organizations || []);
        setRuntime(runtimeResponse);
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Failed to load owner operational overview.");
      } finally {
        if (!cancelled) setLoading(false);
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
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Owner overview</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Global owner summary</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">Resumen ejecutivo del estado global: organizaciones, señales críticas y accesos profundos a vistas especializadas. El detalle técnico vive en Runtime y la creación vive en Create.</p>
            </div>
          </div>
        </section>

        {error ? <section className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{error}</section> : null}

        <section className="grid gap-4 md:grid-cols-3">
          <article className={cardClass}>
            <p className="text-sm text-slate-500">Organizations</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{loading ? "..." : organizations.length}</p>
          </article>
          <article className={cardClass}>
            <p className="text-sm text-slate-500">Runtime status</p>
            <div className="mt-3">{runtime ? <span className={badgeClass(runtime.workerHealth.severity)}>{runtime.workerHealth.classification}</span> : <span className="text-sm text-slate-400">loading</span>}</div>
            <p className="mt-3 text-sm text-slate-600">{runtime?.workerHealth.humanMessage || "Runtime status not loaded yet."}</p>
          </article>
          <article className={cardClass}>
            <p className="text-sm text-slate-500">Blocked organizations</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{runtime?.blockedOrganizations.length ?? 0}</p>
            <Link to={appRoutes.ownerWorkerQueues.path} className="mt-3 inline-flex text-sm font-medium text-blue-700 hover:text-blue-900">View operational issues</Link>
          </article>
        </section>

        <section className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Organizations</h2>
              <p className="mt-1 text-sm text-slate-600">Resumen de organizaciones canónicas disponibles para revisión owner.</p>
            </div>
          </div>
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium">Logto org id</th>
                  <th className="px-4 py-3 font-medium">Profile signal</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {organizations.map((organization) => {
                  const profile = (organization.profile || {}) as Record<string, unknown>;
                  const orgId = organization.logtoOrganizationId || "";
                  const profileSignal = Object.keys(profile).length > 0 ? "profile present" : "needs review";
                  return (
                    <tr key={orgId || organization.name || Math.random()}>
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">{organization.name || "Unnamed organization"}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{orgId || "-"}</td>
                      <td className="px-4 py-4"><span className={badgeClass(profileSignal === "profile present" ? "success" : "warning")}>{profileSignal}</span></td>
                      <td className="px-4 py-4">
                        {orgId ? <Link to={`/owner/organizations/${encodeURIComponent(orgId)}`} className="font-medium text-blue-700 hover:text-blue-900">Open organization</Link> : <span className="text-slate-400">Unavailable</span>}
                      </td>
                    </tr>
                  );
                })}
                {!loading && organizations.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No organizations found.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};

export default OwnerOperationalHomePage;