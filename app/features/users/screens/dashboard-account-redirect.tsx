import type { Route } from "./+types/dashboard-account-redirect";

import { redirect } from "react-router";

/**
 * Legacy URL: OAuth callback used to send users to `/dashboard/account`, which had no
 * matching child route (empty Outlet). Permanent redirect to the account editor.
 */
export function loader(_args: Route.LoaderArgs) {
  return redirect("/account/edit");
}

export default function DashboardAccountRedirect() {
  return null;
}
