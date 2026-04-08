import type { Route } from "./+types/dashboard.layout";

import { Outlet } from "react-router";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/core/components/ui/sidebar";
import { getSessionUser } from "~/core/lib/guards.server";
import makeServerClient from "~/core/lib/supa-client.server";

import DashboardSidebar from "../components/dashboard-sidebar";

export async function loader({ request }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);
  const sessionUser = await getSessionUser(client);
  /** Plain strings only — avoids RR hydration JSON issues with full Supabase `User`. */
  const sidebarUser = sessionUser
    ? {
        name:
          String(sessionUser.user_metadata?.name ?? "").trim() || "Account",
        email: sessionUser.email ?? "",
        avatarUrl: String(sessionUser.user_metadata?.avatar_url ?? ""),
      }
    : null;
  return { sidebarUser };
}

export default function DashboardLayout({ loaderData }: Route.ComponentProps) {
  const { sidebarUser } = loaderData;
  return (
    <SidebarProvider>
      <DashboardSidebar
        user={{
          name: sidebarUser?.name ?? "",
          avatarUrl: sidebarUser?.avatarUrl ?? "",
          email: sidebarUser?.email ?? "",
        }}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
          </div>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
