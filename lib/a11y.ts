/**
 * Announces a message to screen readers using the live region
 * @param message - The message to announce
 * @param priority - 'polite' for non-urgent, 'assertive' for urgent
 */
export function announce(
  message: string,
  priority: "polite" | "assertive" = "polite",
) {
  if (typeof window === "undefined") return;

  const announcer = document.getElementById("live-announcer");
  if (!announcer) return;

  announcer.setAttribute("aria-live", priority);
  announcer.textContent = message;

  // Clear after announcement to allow repeated messages
  setTimeout(() => {
    announcer.textContent = "";
  }, 1000);
}

/**
 * Focus management utilities for accessibility
 */
export const focusUtils = {
  /**
   * Traps focus within an element (for modals/dialogs)
   */
  trapFocus(element: HTMLElement) {
    const focusableElements = element.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    element.addEventListener("keydown", handleKeyDown);
    firstElement?.focus();

    return () => {
      element.removeEventListener("keydown", handleKeyDown);
    };
  },

  /**
   * Returns focus to a previously focused element
   */
  returnFocus(element: HTMLElement | null) {
    if (element && typeof element.focus === "function") {
      element.focus();
    }
  },
};
