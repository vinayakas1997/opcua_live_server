import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Language } from "@shared/schema";

interface LanguageSwitcherProps {
  currentLanguage: Language;
  onLanguageChange: (language: Language) => void;
}

const translations = {
  en: {
    english: "English",
    japanese: "Japanese",
  },
  jp: {
    english: "英語",
    japanese: "日本語",
  },
};

export default function LanguageSwitcher({
  currentLanguage,
  onLanguageChange,
}: LanguageSwitcherProps) {
  const t = translations[currentLanguage];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2"
          data-testid="button-language-switcher"
        >
          <Globe className="h-4 w-4" />
          {currentLanguage.toUpperCase()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => onLanguageChange("en")}
          data-testid="option-language-en"
        >
          {t.english}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onLanguageChange("jp")}
          data-testid="option-language-jp"
        >
          {t.japanese}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}