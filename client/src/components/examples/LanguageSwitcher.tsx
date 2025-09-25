import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import type { Language } from "@shared/schema";

interface LanguageSwitcherProps {
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
}

function LanguageSwitcher({ currentLanguage, onLanguageChange }: LanguageSwitcherProps) {
  const toggleLanguage = () => {
    onLanguageChange(currentLanguage === "en" ? "jp" : "en");
  };

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      className="gap-2"
      onClick={toggleLanguage}
      data-testid="button-language-switcher"
    >
      <Globe className="h-4 w-4" />
      {currentLanguage.toUpperCase()}
    </Button>
  );
}

export default function LanguageSwitcherExample() {
  const [language, setLanguage] = useState<Language>("en");

  return (
    <div className="p-4">
      <LanguageSwitcher 
        currentLanguage={language} 
        onLanguageChange={(lang: Language) => {
          console.log(`Language changed to: ${lang}`);
          setLanguage(lang);
        }} 
      />
    </div>
  );
}
