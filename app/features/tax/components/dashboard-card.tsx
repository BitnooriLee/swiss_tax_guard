import type { ComponentPropsWithoutRef } from "react";

import { cn } from "~/core/lib/utils";

type DashboardCardProps = ComponentPropsWithoutRef<"section">;
type DashboardCardHeaderProps = ComponentPropsWithoutRef<"div">;
type DashboardCardTitleProps = ComponentPropsWithoutRef<"h2">;
type DashboardCardDescriptionProps = ComponentPropsWithoutRef<"p">;
type DashboardCardBodyProps = ComponentPropsWithoutRef<"div">;

export function DashboardCard({ className, ...props }: DashboardCardProps) {
  return (
    <section
      className={cn("rounded-xl border border-border bg-card p-6 shadow-sm", className)}
      {...props}
    />
  );
}

export function DashboardCardHeader({ className, ...props }: DashboardCardHeaderProps) {
  return <div className={cn("min-h-[52px] space-y-1", className)} {...props} />;
}

export function DashboardCardTitle({ className, ...props }: DashboardCardTitleProps) {
  return <h2 className={cn("text-lg font-semibold tracking-tight", className)} {...props} />;
}

export function DashboardCardDescription({
  className,
  ...props
}: DashboardCardDescriptionProps) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function DashboardCardBody({ className, ...props }: DashboardCardBodyProps) {
  return <div className={cn("mt-5", className)} {...props} />;
}
