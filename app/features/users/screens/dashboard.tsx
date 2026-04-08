import type { Route } from "./+types/dashboard";

import { redirect } from "react-router";

/**
 * `/dashboard` hub removed for STG: send users straight to the tax workspace.
 */
export function loader(_args: Route.LoaderArgs) {
  return redirect("/dashboard/tax");
}

export default function Dashboard() {
  return null;
}
