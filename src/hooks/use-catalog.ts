import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getOrCreateOrigin,
  getOrCreateRoaster,
  listOrigins,
  listRoasters,
} from "@/lib/catalog-api";

const ORIGINS_KEY = ["origins"] as const;
const ROASTERS_KEY = ["roasters"] as const;

/** Global catalogs are small (<200 rows) and read by everyone. */
export function useOrigins() {
  return useQuery({
    queryKey: ORIGINS_KEY,
    queryFn: listOrigins,
    staleTime: 5 * 60_000,
  });
}

export function useRoasters() {
  return useQuery({
    queryKey: ROASTERS_KEY,
    queryFn: listRoasters,
    staleTime: 5 * 60_000,
  });
}

export function useGetOrCreateOrigin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: getOrCreateOrigin,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ORIGINS_KEY }),
  });
}

export function useGetOrCreateRoaster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: getOrCreateRoaster,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ROASTERS_KEY }),
  });
}
