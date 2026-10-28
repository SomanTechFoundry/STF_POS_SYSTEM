import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { listEntityTranslations, listUsers, listBusinesses, updateEntityTranslation, updateUserAccess } from "./user.service.js";

const updateUserSchema = z.object({
  role: z.enum(["admin", "owner", "viewer"]).optional(),
  isActive: z.boolean().optional()
}).refine((value) => value.role !== undefined || value.isActive !== undefined, {
  message: "Provide role or isActive"
});

const listTranslationsSchema = z.object({
  businessId: z.string().uuid().optional(),
  entityType: z.enum(["product", "customer"]).default("product"),
  locale: z.string().min(2).default("ta-IN"),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(5)
});

const updateTranslationSchema = z.object({
  businessId: z.string().uuid().optional(),
  entityType: z.enum(["product", "customer"]),
  entityId: z.string().uuid(),
  fieldName: z.string().min(1),
  locale: z.string().min(2),
  value: z.string().optional().default("")
});

export const listUsersController = asyncHandler(async (_req, res) => {
  const data = await listUsers();
  res.json({ success: true, data });
});

export const listBusinessesController = asyncHandler(async (_req, res) => {
  const data = await listBusinesses();
  res.json({ success: true, data });
});

export const updateUserController = asyncHandler(async (req, res) => {
  const payload = updateUserSchema.parse(req.body);
  const data = await updateUserAccess(req.params.userId, payload, req.user);
  res.json({ success: true, data });
});

export const listTranslationsController = asyncHandler(async (req, res) => {
  const payload = listTranslationsSchema.parse(req.query);
  const data = await listEntityTranslations({
    businessId: payload.businessId || req.user.businessId,
    entityType: payload.entityType,
    locale: payload.locale,
    search: payload.search || "",
    page: payload.page,
    pageSize: payload.pageSize
  });
  res.json({ success: true, data });
});

export const updateTranslationController = asyncHandler(async (req, res) => {
  const payload = updateTranslationSchema.parse(req.body);
  const data = await updateEntityTranslation({
    businessId: payload.businessId || req.user.businessId,
    entityType: payload.entityType,
    entityId: payload.entityId,
    fieldName: payload.fieldName,
    locale: payload.locale,
    value: payload.value || ""
  });
  res.json({ success: true, data });
});
