import { z } from "zod";
import { usageActions, usageSections } from "./admin-usage";
const event = z
  .object({
    id: z.uuid(),
    action: z.enum(
      Object.keys(usageActions) as [
        keyof typeof usageActions,
        ...(keyof typeof usageActions)[],
      ],
    ),
    section: z.enum(usageSections),
    product: z
      .enum([
        "pro_month",
        "pro_year",
        "premium_month",
        "premium_year",
        "extra50",
        "extra150",
      ])
      .optional(),
  })
  .strict();
export const usageInput = z
  .object({ events: z.array(event).min(1).max(20) })
  .strict();
