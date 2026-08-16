import type { BeanInput } from "@/lib/bean-schema";

/** Persisted cellar bean shape. */
export type Bean = BeanInput & {
  id: string;
  createdAt: string;
};
