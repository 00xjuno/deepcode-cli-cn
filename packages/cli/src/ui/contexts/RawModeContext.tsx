import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import type { DropdownMenuItem } from "../components/DropdownMenu";

export enum RawMode {
  None = "普通模式",
  Lite = "精简模式",
  Raw = "原始回滚模式",
}
export const RAW_COMMAND_MODELS: DropdownMenuItem[] = [
  {
    label: "精简模式",
    key: RawMode.Lite,
    description: "折叠思维链推理内容。",
  },
  {
    label: "普通模式",
    key: RawMode.None,
    description: "显示完整思维链推理内容。",
  },
  {
    label: "原始回滚模式",
    key: RawMode.Raw,
    description: "显示回滚模式，方便终端复制。",
  },
] as const;

type RawModeContextValue = {
  mode: RawMode;
  setMode: React.Dispatch<React.SetStateAction<RawMode>>;
  // The mode that was active right before the most recent mode transition.
  previousMode: RawMode;
};

const RawModeContext = createContext<RawModeContextValue>({
  mode: RawMode.Lite,
  setMode: () => {},
  previousMode: RawMode.Lite,
});

export function useRawModeContext() {
  const context = useContext(RawModeContext);
  if (!context) {
    throw new Error("useRawModeContext must be used within a RawModeProvider");
  }
  return context;
}

export const RawModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, _setMode] = useState<RawMode>(RawMode.Lite);
  const previousModeRef = useRef<RawMode>(RawMode.Lite);

  const setMode = useCallback<React.Dispatch<React.SetStateAction<RawMode>>>((next) => {
    _setMode((current) => {
      const resolved = typeof next === "function" ? (next as (prev: RawMode) => RawMode)(current) : next;
      if (resolved !== current) {
        previousModeRef.current = current;
      }
      return resolved;
    });
  }, []);

  return (
    <RawModeContext.Provider value={{ mode, setMode, previousMode: previousModeRef.current }}>
      {children}
    </RawModeContext.Provider>
  );
};
