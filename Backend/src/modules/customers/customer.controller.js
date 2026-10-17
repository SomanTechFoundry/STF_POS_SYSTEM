import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { createCustomer, deleteCustomer, listCustomers, updateCustomer } from "./customer.service.js";

const optionalString = z.string().trim().optional().default("");

const customerSchema = z.object({
  name: z.string().trim().min(2),
  address: optionalString,
  mobile: optionalString.refine((value) => value === "" || (value.length >= 5 && value.length <= 15), {
    message: "Mobile number must be 5 to 15 characters"
  }),
  email: optionalString.refine((value) => value === "" || z.string().email().safeParse(value).success, {
    message: "Invalid email address"
  })
});

const paramsSchema = z.object({
  customerId: z.string().uuid()
});

export const listCustomersController = asyncHandler(async (req, res) => {
  const data = await listCustomers(req.user.businessId, req.locale);
  res.json({ success: true, data });
});

export const createCustomerController = asyncHandler(async (req, res) => {
  const payload = customerSchema.parse(req.body);
  const data = await createCustomer(req.user.businessId, payload, req.locale);
  res.status(201).json({ success: true, data });
});

export const updateCustomerController = asyncHandler(async (req, res) => {
  const { customerId } = paramsSchema.parse(req.params);
  const payload = customerSchema.parse(req.body);
  const data = await updateCustomer(req.user.businessId, customerId, payload, req.locale);
  res.json({ success: true, data });
});

export const deleteCustomerController = asyncHandler(async (req, res) => {
  const { customerId } = paramsSchema.parse(req.params);
  const data = await deleteCustomer(req.user.businessId, customerId);
  res.json({ success: true, data });
});
