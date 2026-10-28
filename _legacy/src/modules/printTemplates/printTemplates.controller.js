import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  getCurrentPrintTemplate,
  listPrintTemplates,
  setCurrentPrintTemplate
} from "./printTemplates.service.js";

const updateCurrentSchema = z.object({
  templateKey: z.string().min(2),
  billProfile: z.record(z.string()).optional()
});

export const listPrintTemplatesController = asyncHandler(async (_req, res) => {
  const data = await listPrintTemplates();
  res.json({ success: true, data });
});

export const getCurrentPrintTemplateController = asyncHandler(async (req, res) => {
  const data = await getCurrentPrintTemplate(req.user.businessId, req.locale);
  res.json({ success: true, data });
});

export const setCurrentPrintTemplateController = asyncHandler(async (req, res) => {
  const payload = updateCurrentSchema.parse(req.body);
  const data = await setCurrentPrintTemplate(req.user.businessId, req.locale, payload.templateKey, payload.billProfile);
  res.json({ success: true, data });
});
