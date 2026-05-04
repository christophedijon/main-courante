import React, { createContext, useContext, useState } from "react";

export type SaisieType = "ssi" | "securite_personnes";

export type Pick = { id: string; label: string };

type DraftType = {
  type: SaisieType | null;
  etablissement: Pick | null;
  espace: Pick | null;
  zone: Pick | null;
  niveau: Pick | null;
  motifs: Pick[];
  commentaire: string;
};

const initialDraft: DraftType = {
  type: null,
  etablissement: null,
  espace: null,
  zone: null,
  niveau: null,
  motifs: [],
  commentaire: "",
};

type SaisieContextType = {
  draft: DraftType;
  setField: (field: keyof DraftType, value: any) => void;
  reset: () => void;
  startType: (type: SaisieType) => void;
  pendingMedias: File[];
  addPendingMedia: (file: File) => void;
  removePendingMedia: (index: number) => void;
  clearPendingMedias: () => void;
};

const SaisieContext = createContext<SaisieContextType | undefined>(undefined);

export function SaisieProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<DraftType>(initialDraft);
  const [pendingMedias, setPendingMedias] = useState<File[]>([]);

  const setField = (field: keyof DraftType, value: any) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const reset = () => {
    setDraft(initialDraft);
    setPendingMedias([]);
  };

  const startType = (type: SaisieType) => {
    setDraft({ ...initialDraft, type });
    setPendingMedias([]);
  };

  const addPendingMedia = (file: File) => {
    setPendingMedias((prev) => [...prev, file]);
  };

  const removePendingMedia = (index: number) => {
    setPendingMedias((prev) => prev.filter((_, i) => i !== index));
  };

  const clearPendingMedias = () => setPendingMedias([]);

  return (
    <SaisieContext.Provider
      value={{
        draft,
        setField,
        reset,
        startType,
        pendingMedias,
        addPendingMedia,
        removePendingMedia,
        clearPendingMedias,
      }}
    >
      {children}
    </SaisieContext.Provider>
  );
}

export function useSaisie() {
  const context = useContext(SaisieContext);
  if (!context) throw new Error("useSaisie must be used inside SaisieProvider");
  return context;
}
