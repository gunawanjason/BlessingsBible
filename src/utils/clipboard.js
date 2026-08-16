export const writeTextToClipboard = async (text) => {
  let clipboardError = null;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      clipboardError = error;
    }
  }

  if (typeof document !== "undefined" && document.body) {
    const activeElement = document.activeElement;
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    Object.assign(textArea.style, {
      position: "fixed",
      inset: "0 auto auto 0",
      opacity: "0",
      pointerEvents: "none",
    });

    document.body.appendChild(textArea);
    textArea.select();
    textArea.setSelectionRange(0, textArea.value.length);

    try {
      if (document.execCommand?.("copy")) return;
    } finally {
      textArea.remove();
      activeElement?.focus?.();
    }
  }

  throw clipboardError || new Error("Clipboard access is unavailable");
};
