import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createBrewLog,
  deleteBrewLog,
  listBrewLogs,
  updateBrewLog,
} from "@/lib/brew-log-api";
import type { BrewLogInput } from "@/lib/brew-log-schema";
import { deriveBrewRatio } from "@/lib/ratio";
import type { BrewLog } from "@/types/brew-log";

/** Query key is user-scoped so signing out never leaks another user's cache. */
const key = (userId: string) => ["brew-logs", userId] as const;

export function useBrewLogs(userId: string | null) {
  return useQuery({
    queryKey: key(userId ?? "none"),
    queryFn: listBrewLogs,
    enabled: !!userId,
  });
}

export function useCreateBrewLog(userId: string) {
  const queryClient = useQueryClient();
  const queryKey = key(userId);

  return useMutation({
    mutationFn: createBrewLog,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<BrewLog[]>(queryKey);
      const temp: BrewLog = {
        ...input,
        id: `temp-${Date.now()}`,
        ratio: deriveBrewRatio(input),
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<BrewLog[]>(queryKey, (old) => [
        temp,
        ...(old ?? []),
      ]);
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous)
        queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useUpdateBrewLog(userId: string) {
  const queryClient = useQueryClient();
  const queryKey = key(userId);

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BrewLogInput }) =>
      updateBrewLog(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<BrewLog[]>(queryKey);
      queryClient.setQueryData<BrewLog[]>(
        queryKey,
        (old) =>
          old?.map((log) =>
            log.id === id
              ? { ...log, ...input, ratio: deriveBrewRatio(input) }
              : log,
          ) ?? [],
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous)
        queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useDeleteBrewLog(userId: string) {
  const queryClient = useQueryClient();
  const queryKey = key(userId);

  return useMutation({
    mutationFn: deleteBrewLog,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<BrewLog[]>(queryKey);
      queryClient.setQueryData<BrewLog[]>(
        queryKey,
        (old) => old?.filter((log) => log.id !== id) ?? [],
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous)
        queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
