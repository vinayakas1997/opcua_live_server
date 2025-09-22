import { useState } from "react";
import LanguageSwitcher from "../LanguageSwitcher";
import type { Language } from "@shared/schema";

export default function LanguageSwitcherExample() {
  const [language, setLanguage] = useState<Language>("en");

  return (
    <div className="p-4">
      <LanguageSwitcher 
        currentLanguage={language} 
        onLanguageChange={(lang) => {
          console.log(`Language changed to: ${lang}`);
          setLanguage(lang);
        }} 
      />
    </div>
  );
}