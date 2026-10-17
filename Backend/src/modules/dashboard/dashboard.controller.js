import { asyncHandler } from "../../utils/asyncHandler.js";
import { getSummary } from "./dashboard.service.js";
import { z } from "zod";

const dateField = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
);

const summaryQuerySchema = z.object({
  fromDate: dateField,
  toDate: dateField
});

export const summaryController = asyncHandler(async (req, res) => {
  const query = summaryQuerySchema.parse(req.query);
  const data = await getSummary(req.user.businessId, { ...query, locale: req.locale });
  res.json({ success: true, data });
});
