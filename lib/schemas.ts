import { z } from "zod";

const places = z.array(z.string().trim().toUpperCase().min(2).max(3)).min(1);

export const WatchlistInput = z.object({
  label: z.string().min(1).max(80),
  origins: places,
  destinations: places,
  monthsAhead: z.number().int().min(1).max(6).default(3),
  detailDates: z.number().int().min(0).max(10).default(3),
  active: z.boolean().default(true),
  days: z.array(z.number().int().min(0).max(6)).min(1).default([0, 1, 2, 3, 4, 5, 6]),
});
