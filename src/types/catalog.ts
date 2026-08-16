/** Global origin catalog entry (D-029). Read-only for the app. */
export type Origin = {
  id: string;
  name: string;
  /** Country the origin belongs to (for grouping/sorting). */
  country: string | null;
  /** Specific region within the country (may be null for a country row). */
  region: string | null;
  createdAt: string;
};

/** Global roaster catalog entry (D-029). */
export type Roaster = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  /**
   * Paid fields (D-030/D-031): present in the schema but rendered only when
   * `subscribed` is true. Unused in the UI until the directory ships.
   */
  address: string | null;
  phone: string | null;
  website: string | null;
  beanLink: string | null;
  subscribed: boolean;
  subscribedUntil: string | null;
  createdAt: string;
};
