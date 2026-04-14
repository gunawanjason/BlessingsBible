import { useContext, useMemo } from "react";
import VerseContext from "./VerseContext";

export function VerseProvider({ children, value }) {
  const ref = value?.currentChapterVersesRef;
  const memoValue = useMemo(() => value, [ref]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <VerseContext.Provider value={memoValue}>{children}</VerseContext.Provider>
  );
}

export function useVerseData() {
  return useContext(VerseContext);
}
