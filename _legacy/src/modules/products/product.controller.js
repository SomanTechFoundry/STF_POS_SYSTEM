import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  createProduct,
  deleteProduct,
  listArchivedProducts,
  listProducts,
  restoreProduct,
  updateProduct
} from "./product.service.js";

const variantSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().min(2),
  unitType: z.enum(["ml", "g", "kg", "ltr", "pcs"]).default("pcs"),
  unitSize: z.coerce.number().positive().default(1),
  costPrice: z.coerce.number().nonnegative().default(0),
  salePrice: z.coerce.number().positive(),
  stockQty: z.coerce.number().int().nonnegative(),
  reorderLevel: z.coerce.number().int().nonnegative()
});

const productSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(2),
  variants: z.array(variantSchema).min(1)
});

const paramsSchema = z.object({
  productId: z.string().uuid()
});

export const listProductsController = asyncHandler(async (req, res) => {
  const data = await listProducts(req.user.businessId, req.locale);
  res.json({ success: true, data });
});

export const listArchivedProductsController = asyncHandler(async (req, res) => {
  const data = await listArchivedProducts(req.user.businessId, req.locale);
  res.json({ success: true, data });
});

export const createProductController = asyncHandler(async (req, res) => {
  const payload = productSchema.parse(req.body);
  const data = await createProduct(req.user.businessId, payload, req.locale);
  res.status(201).json({ success: true, data });
});

export const updateProductController = asyncHandler(async (req, res) => {
  const { productId } = paramsSchema.parse(req.params);
  const payload = productSchema.parse(req.body);
  const data = await updateProduct(req.user.businessId, productId, payload, req.locale);
  res.json({ success: true, data });
});

export const deleteProductController = asyncHandler(async (req, res) => {
  const { productId } = paramsSchema.parse(req.params);
  const data = await deleteProduct(req.user.businessId, productId);
  res.json({ success: true, data });
});

export const restoreProductController = asyncHandler(async (req, res) => {
  const { productId } = paramsSchema.parse(req.params);
  const data = await restoreProduct(req.user.businessId, productId);
  res.json({ success: true, data });
});
