// apps/web/context/RegionContext.tsx
"use client";

import React, { createContext, useContext, useState } from "react";

// Интерфейс для данных региона (настройте под поля вашего API)
interface Region {
  id: number;
  name: string;
  name_in: string; // "в Санкт-Петербурге", "в Ангарске" и т.д.
  slug: string;
}

interface RegionContextType {
  currentRegion: Region;
  setCurrentRegion: (region: Region) => void;
  allRegions: Region[];
}

const RegionContext = createContext<RegionContextType | null>(null);

export function RegionProvider({ 
  children, 
  initialRegions 
}: { 
  children: React.ReactNode; 
  initialRegions: Region[] 
}) {
  // Инициализируем первым регионом из списка или значением по умолчанию
  const defaultRegion = initialRegions[0] || {
    id: 1,
    name: "Санкт-Петербург",
    name_in: "Санкт-Петербурге",
    slug: "sankt-peterburg"
  };

  const [currentRegion, setCurrentRegion] = useState<Region>(defaultRegion);

  return (
    <RegionContext.Provider value={{ currentRegion, setCurrentRegion, allRegions: initialRegions }}>
      {children}
    </RegionContext.Provider>
  );
}

// Хук для использования данных в компонентах (шапке, футере и т.д.)
export const useRegion = () => {
  const context = useContext(RegionContext);
  if (!context) {
    throw new Error("useRegion must be used within a RegionProvider");
  }
  return context;
};