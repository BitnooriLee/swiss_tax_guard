import type { Route } from "./+types/dashboard.layout";

import { LogOut, Settings, ShieldCheck } from "lucide-react";
import { Link, Outlet } from "react-router";

import { Avatar, AvatarFallback, AvatarImage } from "~/core/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/core/components/ui/dropdown-menu";
import { getSessionUser } from "~/core/lib/guards.server";
import makeServerClient from "~/core/lib/supa-client.server";

type NavUser = {
  name: string;
  email: string;
  avatarUrl: string;
};

export async function loader({ request }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);
  const sessionUser = await getSessionUser(client);
  const navUser: NavUser | null = sessionUser
    ? {
        name: String(sessionUser.user_metadata?.name ?? "").trim() || "Account",
        email: sessionUser.email ?? "",
        avatarUrl: String(sessionUser.user_metadata?.avatar_url ?? ""),
      }
    : null;
  return { navUser };
}

function TopNav({ user }: { user: NavUser | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#E5E7EB] bg-white/95 backdrop-blur-sm dark:border-border dark:bg-background/95">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-6">
        {/* Left: Swiss brand */}
        <Link
          to="/dashboard/tax"
          viewTransition
          className="flex items-center gap-2.5 rounded-md outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white"
            aria-hidden
          >
            <ShieldCheck className="size-[1.05rem]" strokeWidth={2.5} />
          </span>
          <span className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
            Swiss Tax Guard
          </span>
        </Link>

        {/* Right: User profile dropdown */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none ring-offset-background transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Open user menu"
              >
                <Avatar className="size-7 rounded-md">
                  <AvatarImage src={user.avatarUrl || undefined} />
                  <AvatarFallback className="rounded-md bg-slate-200 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {user.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden font-medium text-slate-800 dark:text-slate-200 sm:block">
                  {user.name}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="grid font-normal leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/account/edit" viewTransition>
                  <Settings className="size-4" />
                  Settings &amp; Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/logout" viewTransition>
                  <LogOut className="size-4" />
                  Log out
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}

export default function DashboardLayout({ loaderData }: Route.ComponentProps) {
  const { navUser } = loaderData;
  return (
    <div className="min-h-screen bg-[#F8F9FB] dark:bg-background">
      <TopNav user={navUser} />
      <main className="mx-auto w-full max-w-[1600px] px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
