import { useLogto } from "@logto/react";
import { useMemo } from "react";
import { APP_ENV } from "../env";

const API_BASE_URL = APP_ENV.api.baseUrl;
const API_RESOURCE_INDICATOR = APP_ENV.api.resourceIndicator;

export type ApiError = {
  message: string;
  status?: number;
};

export class ApiRequestError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

const buildApiErrorMessage = async (response: Response) => {
  if (response.status === 401) return "Access token rejected by API";
  if (response.status === 403) return "Owner role required";

  const fallbackMessage = `API request failed: ${response.status} ${response.statusText}`.trim();

  try {
    const data = await response.json();
    if (typeof data?.message === "string" && data.message.length > 0) {
      return data.message;
    }
    if (typeof data?.error === "string" && data.error.length > 0) {
      return data.error;
    }
  } catch {
    // Ignore non-JSON error bodies and use the HTTP fallback message.
  }

  return fallbackMessage;
};

const joinApiUrl = (endpoint: string) => `${API_BASE_URL.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;

export const useApi = () => {
  const { getAccessToken, getOrganizationToken } = useLogto();

  const fetchWithToken = useMemo(
    () => async (endpoint: string, options: RequestInit = {}, organizationId?: string) => {
      try {
        let token: string | undefined;

        if (organizationId) {
          token = await getOrganizationToken(organizationId);
        } else {
          token = await getAccessToken(API_RESOURCE_INDICATOR);
        }

        if (!token) {
          throw new ApiRequestError(
            organizationId ? "User is not a member of the organization" : "Failed to get access token for API resource"
          );
        }

        const response = await fetch(joinApiUrl(endpoint), {
          ...options,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...options.headers,
          },
        });

        if (!response.ok) {
          throw new ApiRequestError(await buildApiErrorMessage(response), response.status);
        }

        return await response.json();
      } catch (error) {
        if (error instanceof ApiRequestError) {
          throw error;
        }
        throw new ApiRequestError(error instanceof Error ? error.message : String(error));
      }
    },
    [getAccessToken, getOrganizationToken]
  );

  const ownerApiFetch = useMemo(
    () => async (endpoint: string, options: RequestInit = {}) => {
      try {
        const token = await getAccessToken(API_RESOURCE_INDICATOR);
        if (!token) throw new ApiRequestError("Failed to get access token for owner API resource");

        const response = await fetch(joinApiUrl(endpoint), {
          ...options,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...options.headers,
          },
        });

        if (!response.ok) {
          throw new ApiRequestError(await buildApiErrorMessage(response), response.status);
        }

        return await response.json();
      } catch (error) {
        if (error instanceof ApiRequestError) throw error;
        throw new ApiRequestError(error instanceof Error ? error.message : String(error));
      }
    },
    [getAccessToken]
  );

  return { fetchWithToken, ownerApiFetch };
};
