const EMAIL = (import.meta.env.WXT_DASHBOARD_EMAIL as string | undefined) ?? "";
const PASSWORD = (import.meta.env.WXT_DASHBOARD_PASSWORD as string | undefined) ?? "";
const KEY = "dealguard:dashboard-session";

/**
 * Local gate for the dashboard page. The values are compiled into the build, so this keeps casual
 * users out of the page and is not a security boundary. Fails closed when either value is unset.
 */
export const loginConfigured = Boolean(EMAIL && PASSWORD);

export function tryLogin(email: string, password: string): boolean {
  if (!loginConfigured) return false;
  const ok = email.trim().toLowerCase() === EMAIL.toLowerCase() && password === PASSWORD;
  if (ok) sessionStorage.setItem(KEY, "1");
  return ok;
}
export const isLoggedIn = () => loginConfigured && sessionStorage.getItem(KEY) === "1";
export const logout = () => sessionStorage.removeItem(KEY);
