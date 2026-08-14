import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth-context";
import { listSavedTermIds, saveTerm, unsaveTerm } from "@/lib/glossary-api";

/** Query key is user-scoped so signing out never leaks another user's cache. */
const key = (userId: string) => ["saved-terms", userId] as const;

/**
 * The set of term ids the signed-in user has saved (T17). Disabled when signed
 * out; RLS scopes the rows, so the result is always the caller's own.
 */
export function useSavedTermIds() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  return useQuery({
    queryKey: key(userId ?? "none"),
    queryFn: async () => new Set(await listSavedTermIds()),
    enabled: !!userId,
  });
}

/**
 * Optimistic save/unsave toggle (T17). Flips the cached id set immediately and
 * rolls back on error; invalidates on settle so the server wins.
 */
export function useToggleSaveTerm() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const queryKey = key(userId ?? "none");

  return useMutation({
    mutationFn: ({ termId, saved }: { termId: string; saved: boolean }) =>
      saved ? unsaveTerm(termId) : saveTerm(termId),
    onMutate: async ({ termId, saved }) => {
      if (!userId) return;
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Set<string>>(queryKey);
      queryClient.setQueryData<Set<string>>(queryKey, (old) => {
        const next = new Set(old ?? []);
        if (saved) next.delete(termId);
        else next.add(termId);
        return next;
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (userId && context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      if (userId) queryClient.invalidateQueries({ queryKey });
    },
  });
}
