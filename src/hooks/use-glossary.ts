import { useQuery } from "@tanstack/react-query";

import { listGlossaryTerms } from "@/lib/glossary-api";
import { isSupabaseConfigured } from "@/lib/supabase";

export function useGlossaryTerms() {
  return useQuery({
    queryKey: ["glossary-terms"],
    queryFn: listGlossaryTerms,
    enabled: isSupabaseConfigured,
    staleTime: 10 * 60_000,
  });
}
