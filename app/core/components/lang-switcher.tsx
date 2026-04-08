/**
 * Language Switcher Component
 *
 * Dropdown to switch UI language. Persists via `/api/settings/locale`.
 * Locales: English (default), German, French, Korean.
 */
import { useTranslation } from "react-i18next";
import { useFetcher } from "react-router";

import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const LOCALES = [
  { code: "en", flag: "🇬🇧", labelKey: "navigation.en" as const },
  { code: "de", flag: "🇩🇪", labelKey: "navigation.de" as const },
  { code: "fr", flag: "🇫🇷", labelKey: "navigation.fr" as const },
  { code: "ko", flag: "🇰🇷", labelKey: "navigation.kr" as const },
];

export default function LangSwitcher() {
  const { t, i18n } = useTranslation();
  const fetcher = useFetcher();

  const handleLocaleChange = async (locale: string) => {
    i18n.changeLanguage(locale);
    await fetcher.submit(null, {
      method: "POST",
      action: "/api/settings/locale?locale=" + locale,
    });
  };

  const current =
    LOCALES.find((l) => i18n.language.startsWith(l.code)) ?? LOCALES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        className="cursor-pointer"
        data-testid="lang-switcher"
      >
        <Button variant="ghost" size="icon" className="text-lg">
          {current.flag}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {LOCALES.map(({ code, flag, labelKey }) => (
          <DropdownMenuItem key={code} onClick={() => handleLocaleChange(code)}>
            {flag} {t(labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
