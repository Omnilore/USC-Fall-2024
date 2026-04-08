import { useEffect, useState } from "react";
import { supabase } from "@/app/supabase";

export const useEntries = (selectedTable: string | null) => {
  const [entries, setEntries] = useState<Record<string, any>[]>([]);

  useEffect(() => {
    if (!selectedTable) return;

    const fetchEntries = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const response = await fetch(`/api/data?table=${selectedTable}`, {
          method: "GET",
          credentials: "include",
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        });
        const data = await response.json();
        setEntries(data || []);
      } catch (error) {
        console.error(
          `Failed to fetch data for table ${selectedTable}:`,
          error,
        );
      }
    };

    fetchEntries();
  }, [selectedTable]);

  return entries;
};
