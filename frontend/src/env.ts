const required = (value: string | undefined, fallback: string) => value && value.length > 0 ? value : fallback;

export const APP_ENV = {
  logto: {
    endpoint: required(import.meta.env.VITE_LOGTO_ENDPOINT, "http://localhost:3001"),
    appId: required(import.meta.env.VITE_LOGTO_APP_ID, "<YOUR_LOGTO_APP_ID>"),
  },
  api: {
    baseUrl: required(import.meta.env.VITE_API_BASE_URL, "http://localhost:3000"),
    resourceIndicator: required(import.meta.env.VITE_API_RESOURCE_INDICATOR, "https://api.documind.com"),
  },
  app: {
    redirectUri: required(import.meta.env.VITE_APP_REDIRECT_URI, "http://localhost:5173/callback"),
    signOutRedirectUri: required(import.meta.env.VITE_APP_SIGNOUT_REDIRECT_URI, "http://localhost:5173/"),
  },
} as const;
