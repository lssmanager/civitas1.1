import { LogtoProvider, LogtoConfig, useLogto, UserScope, ReservedResource } from "@logto/react";
import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "./Landing";
import Callback from "../Callback";
import OrganizationPage from "../OrganizationPage";
import OwnerOrganizationsPage from "../OwnerOrganizationsPage";
import OwnerOperationalHomePage from "../OwnerOperationalHomePage";
import OwnerOrganizationOperationalPage from "../OwnerOrganizationOperationalPage";
import OwnerWorkerQueuesPage from "../OwnerWorkerQueuesPage";
import { APP_ENV } from "../../env";
import { appRoutes } from "../../navigation/routes";

const config: LogtoConfig = {
  endpoint: APP_ENV.logto.endpoint,
  appId: APP_ENV.logto.appId,
  scopes: [UserScope.Roles, UserScope.Organizations, UserScope.OrganizationRoles, "read:documents", "create:documents", "create:organization", "owner:read", "owner:write"],
  resources: [ReservedResource.Organization, APP_ENV.api.resourceIndicator],
};

function App() {
  return (
    <LogtoProvider config={config}>
      <div className="min-h-screen bg-slate-50 text-slate-950">
        <Routes>
          <Route path="/callback" element={<Callback />} />
          <Route path="/*" element={<AppContent />} />
        </Routes>
      </div>
    </LogtoProvider>
  );
}

function AppContent() {
  const { isAuthenticated } = useLogto();
  if (!isAuthenticated) return <Landing />;
  return (
    <Routes>
      <Route path="/" element={<Navigate to={appRoutes.owner.path} replace />} />
      <Route path={appRoutes.owner.path} element={<OwnerOperationalHomePage />} />
      <Route path={appRoutes.ownerOrganizations.path} element={<OwnerOrganizationsPage />} />
      <Route path={appRoutes.ownerOrganizationState.path} element={<OwnerOrganizationOperationalPage />} />
      <Route path={appRoutes.ownerWorkerQueues.path} element={<OwnerWorkerQueuesPage />} />
      <Route path="/:orgId" element={<OrganizationPage />} />
    </Routes>
  );
}

export default App;