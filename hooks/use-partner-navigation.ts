import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

type MaybeNumber = number | null | undefined;

/**
 * Shared helper for tables that need to jump to a member's partner row.
 */
export function usePartnerNavigation(options?: { autoClearMs?: number }) {
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>());
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const autoClearMs = options?.autoClearMs ?? 2200;

  const registerRow = useCallback(
    (memberId: MaybeNumber) => (element: HTMLTableRowElement | null) => {
      if (memberId == null) return;
      if (element) {
        rowRefs.current.set(memberId, element);
      } else {
        rowRefs.current.delete(memberId);
      }
    },
    [],
  );

  const focusPartner = useCallback(
    ({
      partnerId,
      partnerName,
    }: {
      partnerId: MaybeNumber;
      partnerName?: string;
    }) => {
      if (partnerId == null) {
        toast.info("No partner is linked for this member.");
        return;
      }

      const targetRow = rowRefs.current.get(partnerId);

      if (!targetRow) {
        toast.info(
          partnerName
            ? `${partnerName} is not present in the current report view.`
            : "Partner is not present in the current report view.",
        );
        return;
      }

      targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(partnerId);

      window.setTimeout(() => {
        setHighlightedId((current) =>
          current === partnerId ? null : current,
        );
      }, autoClearMs);
    },
    [autoClearMs],
  );

  return {
    registerRow,
    focusPartner,
    highlightedId,
  };
}
