import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, MetricCard, OwnerBadge, OwnerShell, PageHeader, SectionCard, ownerToneFromSeverity } from "../components/owner/OwnerUI";
import { useOwnerApi, type OwnerOrganization, type WorkerHealthAggregate } from "../api/owner";
import { appRoutes } from "../navigation/routes";

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
    <OwnerShell>
        <PageHeader
          eyebrow="Owner overview"
          title="Global owner summary"
          description="Resumen ejecutivo del estado global: organizaciones, señales críticas y accesos profundos a vistas especializadas. El detalle técnico vive en Runtime y la creación vive en Create."
        />

        {error ? <ErrorState message={error} /> : null}

        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Organizations" value={loading ? "..." : organizations.length} />
          <MetricCard label="Runtime status" detail={runtime?.workerHealth.humanMessage || "Runtime status not loaded yet."}>
            {runtime ? <OwnerBadge tone={ownerToneFromSeverity(runtime.workerHealth.severity)}>{runtime.workerHealth.classification}</OwnerBadge> : <span className="text-sm text-slate-400">loading</span>}
          </MetricCard>
          <MetricCard label="Blocked organizations" value={runtime?.blockedOrganizations.length ?? 0}>
            <Link to={appRoutes.ownerWorkerQueues.path} className="inline-flex text-sm font-medium text-blue-700 hover:text-blue-900">View operational issues</Link>
          </MetricCard>
        </section>

        <SectionCard>
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
                      <td className="px-4 py-4"><OwnerBadge tone={profileSignal === "profile present" ? "success" : "warning"}>{profileSignal}</OwnerBadge></td>
                      <td className="px-4 py-4">
                        {orgId ? <Link to={`/owner/organizations/${encodeURIComponent(orgId)}`} className="font-medium text-blue-700 hover:text-blue-900">Open organization</Link> : <span className="text-slate-400">Unavailable</span>}
                      </td>
                    </tr>
                  );
                })}
                {!loading && organizations.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-4"><EmptyState message="No organizations found." /></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionCard>
    </OwnerShell>
  );
};

export default OwnerOperationalHomePage;