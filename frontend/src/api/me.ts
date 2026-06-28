import { APP_ENV } from "../env";

export type MeResponse = {
  auth: {
    sub: string | null;
    organizationId: string | null;
    scopes: string[];
    roles: string[];
    globalRoles: string[];
    organizationRoles: string[];
    owner: {
      canReadOwner: boolean;
      canWriteOwner: boolean;
    };
  };
};

export async function getMe(accessToken: string): Promise<MeResponse> {
  const response = await fetch(`${APP_ENV.api.baseUrl}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load /me (${response.status})`);
  }

  return response.json();
}
