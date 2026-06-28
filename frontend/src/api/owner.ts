import { useMemo } from "react";
import { useApi } from "./base";

export type OwnerAuthorization = {
  logtoUserId: string;
  internalUserId: string;
  authorizedBy: "logto_global_role_and_scope";
  requiredScope: "owner:read";
  requiredWriteScope: "owner:write";
  canReadOwner: boolean;
  canWriteOwner: boolean;
  globalRoles: string[];
  scopes: string[];
};

export type OwnerMeResponse = {
  owner: OwnerAuthorization;
};

export type OwnerOrganization = {
  logtoOrganizationId: string | null;
  name: string | null;
  logtoOrganization?: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
};

export type CreateOwnerOrganizationInput = {
  name: string;
  description?: string;
  customData?: Record<string, unknown>;
};

export const useOwnerApi = () => {
  const { fetchWithToken } = useApi();

  return useMemo(
    () => ({
      getOwnerMe: async (): Promise<OwnerMeResponse> => fetchWithToken("/owner/me"),
      getOrganizations: async (): Promise<{ organizations: OwnerOrganization[] }> =>
        fetchWithToken("/owner/organizations"),
      createOrganization: async (
        data: CreateOwnerOrganizationInput,
      ): Promise<{ data: { id: string; name?: string; description?: string | null } }> =>
        fetchWithToken("/owner/organizations", {
          method: "POST",
          body: JSON.stringify(data),
        }),
    }),
    [fetchWithToken],
  );
};
