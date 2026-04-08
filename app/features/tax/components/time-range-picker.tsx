import { Link, useSearchParams } from "react-router";

const DAY_OPTIONS = [
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
] as const;

type Props = {
  selectedDays: 7 | 30 | 90;
};

export default function TimeRangePicker({ selectedDays }: Props) {
  const [searchParams] = useSearchParams();

  return (
    <nav
      className="inline-flex items-center rounded-full border border-border bg-muted/50 p-1"
      aria-label="Asset history time range"
    >
      {DAY_OPTIONS.map((option) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("days", String(option.value));
        const isActive = option.value === selectedDays;

        return (
          <Link
            key={option.value}
            to={`?${nextParams.toString()}`}
            preventScrollReset
            className={[
              "rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150",
              isActive
                ? "bg-emerald-500 text-white shadow-sm"
                : "text-muted-foreground hover:bg-background hover:text-foreground",
            ].join(" ")}
            aria-current={isActive ? "page" : undefined}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
