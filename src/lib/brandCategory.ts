/** Brands are either training institutes (students, courses, fees) or service businesses (agency clients). */
export const BRAND_CATEGORIES = ["TRAINING", "SERVICE"] as const;
export type BrandCategory = (typeof BRAND_CATEGORIES)[number];

export const BRAND_CATEGORY_LABELS: Record<BrandCategory, string> = {
  TRAINING: "Training based",
  SERVICE: "Service based",
};

export function isBrandCategory(value: unknown): value is BrandCategory {
  return value === "TRAINING" || value === "SERVICE";
}

/** Brands created before categories existed are all academic, so they count as training. */
export function brandCategoryOf(brand: { businessCategory?: string | null } | null | undefined): BrandCategory {
  return isBrandCategory(brand?.businessCategory) ? brand!.businessCategory as BrandCategory : "TRAINING";
}
