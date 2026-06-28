import { useLogto } from "@logto/react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { APP_ENV } from "../env";
import { appRoutes } from "../navigation/routes";

type TopbarProps = {
  organizationId?: string;
  showBackButton?: boolean;
};

const navLinkClass = (active: boolean) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;

const Topbar = ({ organizationId, showBackButton }: TopbarProps) => {
  const { signOut } = useLogto();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-xl font-semibold text-slate-900">
            Civitas
          </Link>
          <nav className="hidden items-center gap-2 md:flex">
            <Link to="/" className={navLinkClass(location.pathname === "/")}>
              Home
            </Link>
            <Link
              to={appRoutes.ownerOrganizations.path}
              className={navLinkClass(location.pathname.startsWith(appRoutes.ownerOrganizations.path))}
            >
              Create organization
            </Link>
          </nav>
          {organizationId && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Organization:</span>
              <span className="font-medium text-slate-700">{organizationId}</span>
              {showBackButton && (
                <button
                  onClick={() => navigate("/")}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Back to owner home"
                  title="Back to owner home"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {organizationId && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              Active organization
            </span>
          )}
          <button
            onClick={() => signOut(APP_ENV.app.signOutRedirectUri)}
            className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default Topbar;
