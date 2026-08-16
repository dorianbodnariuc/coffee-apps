import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createBean,
  deleteBean,
  listBeans,
  updateBean,
} from "@/lib/beans-api";
import type { BeanInput } from "@/lib/bean-schema";
import type { Bean } from "@/types/bean";

/** Query key is user-scoped so signing out never leaks another user's cache. */
const key = (userId: string) => ["beans", userId] as const;

export function useBeans(userId: string | null) {
  return useQuery({
    queryKey: key(userId ?? "none"),
    queryFn: listBeans,
    enabled: !!userId,
  });
}

export function useCreateBean(userId: string) {
  const queryClient = useQueryClient();
  const queryKey = key(userId);

  return useMutation({
    mutationFn: createBean,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Bean[]>(queryKey);
      const temp: Bean = {
        ...input,
        id: `temp-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<Bean[]>(queryKey, (old) => [
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

export function useUpdateBean(userId: string) {
  const queryClient = useQueryClient();
  const queryKey = key(userId);

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BeanInput }) =>
      updateBean(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Bean[]>(queryKey);
      queryClient.setQueryData<Bean[]>(
        queryKey,
        (old) =>
          old?.map((bean) =>
            bean.id === id ? { ...bean, ...input } : bean,
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

export function useDeleteBean(userId: string) {
  const queryClient = useQueryClient();
  const queryKey = key(userId);

  return useMutation({
    mutationFn: deleteBean,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Bean[]>(queryKey);
      queryClient.setQueryData<Bean[]>(
        queryKey,
        (old) => old?.filter((bean) => bean.id !== id) ?? [],
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
