/**
 * Minimal navigation for SwissTax Guard: auth, theme, locale. No marketing links.
 */
import type { ReactElement } from "react";
import {
  HomeIcon,
  LogOutIcon,
  MenuIcon,
  ShieldCheck,
  UserRoundIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import LangSwitcher from "./lang-switcher";
import ThemeSwitcher from "./theme-switcher";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Separator } from "./ui/separator";
import {
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTrigger,
} from "./ui/sheet";

function UserMenu({
  name,
  email,
  avatarUrl,
  closeOnNavigate = false,
}: {
  name: string;
  email?: string;
  avatarUrl?: string | null;
  /** When the menu is rendered inside the mobile `Sheet`, close the sheet after navigation. */
  closeOnNavigate?: boolean;
}) {
  const wrap = (node: ReactElement) =>
    closeOnNavigate ? <SheetClose asChild>{node}</SheetClose> : node;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="size-8 cursor-pointer rounded-lg">
          <AvatarImage src={avatarUrl ?? undefined} />
          <AvatarFallback>{name.slice(0, 2)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">{name}</span>
          <span className="truncate text-xs">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          {wrap(
            <Link to="/dashboard/tax" viewTransition>
              <HomeIcon className="size-4" />
              Dashboard
            </Link>,
          )}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          {wrap(
            <Link to="/account/edit" viewTransition>
              <UserRoundIcon className="size-4" />
              Profile &amp; settings
            </Link>,
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          {wrap(
            <Link to="/logout" viewTransition>
              <LogOutIcon className="size-4" />
              Log out
            </Link>,
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AuthButtons({ closeOnNavigate = false }: { closeOnNavigate?: boolean }) {
  const wrap = (node: ReactElement) =>
    closeOnNavigate ? <SheetClose asChild>{node}</SheetClose> : node;

  return (
    <>
      <Button variant="ghost" asChild>
        {wrap(<Link to="/login" viewTransition>Sign in</Link>)}
      </Button>
      <Button variant="default" asChild>
        {wrap(<Link to="/join" viewTransition>Sign up</Link>)}
      </Button>
    </>
  );
}

export function NavigationBar({
  name,
  email,
  avatarUrl,
  loading,
}: {
  name?: string;
  email?: string;
  avatarUrl?: string | null;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const homeTo = name ? "/dashboard/tax" : "/";

  return (
    <nav
      className={
        "mx-auto flex h-16 w-full items-center justify-between border-b px-5 shadow-xs backdrop-blur-lg transition-opacity md:px-10"
      }
    >
      <div className="mx-auto flex h-full w-full max-w-screen-2xl items-center justify-between py-3">
        <Link
          to={homeTo}
          viewTransition
          className="flex items-center gap-2.5 rounded-md outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          >
            <ShieldCheck className="size-[1.35rem]" strokeWidth={2.25} />
          </span>
          <h1 className="text-lg font-extrabold tracking-tight">
            {t("home.title")}
          </h1>
        </Link>

        <div className="hidden h-full items-center gap-5 md:flex">
          <ThemeSwitcher />
          <LangSwitcher />
          <Separator orientation="vertical" />
          {loading ? (
            <div className="flex items-center">
              <div className="bg-muted-foreground/20 size-8 animate-pulse rounded-lg" />
            </div>
          ) : name ? (
            <UserMenu name={name} email={email} avatarUrl={avatarUrl} />
          ) : (
            <AuthButtons />
          )}
        </div>

        <SheetTrigger className="size-6 md:hidden">
          <MenuIcon />
        </SheetTrigger>
        <SheetContent>
          <SheetHeader className="sr-only">Menu</SheetHeader>
          {loading ? (
            <div className="flex items-center">
              <div className="bg-muted-foreground h-4 w-24 animate-pulse rounded-full" />
            </div>
          ) : (
            <SheetFooter className="flex-col gap-4 sm:flex-col">
              <div className="flex w-full justify-between gap-2">
                <ThemeSwitcher />
                <LangSwitcher />
              </div>
              {name ? (
                <div className="flex w-full flex-col gap-3">
                  <UserMenu
                    name={name}
                    email={email}
                    avatarUrl={avatarUrl}
                    closeOnNavigate
                  />
                </div>
              ) : (
                <div className="grid w-full grid-cols-2 gap-2">
                  <AuthButtons closeOnNavigate />
                </div>
              )}
            </SheetFooter>
          )}
        </SheetContent>
      </div>
    </nav>
  );
}
