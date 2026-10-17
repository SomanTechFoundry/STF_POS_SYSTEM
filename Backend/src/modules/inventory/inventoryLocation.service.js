import { ApiError } from "../../utils/ApiError.js";

export const INVENTORY_LOCATION_CODES = {
  MAIN_STORE: "main_store",
  GODOWN: "godown"
};

const DEFAULT_LOCATIONS = [
  { code: INVENTORY_LOCATION_CODES.MAIN_STORE, name: "Main Store" },
  { code: INVENTORY_LOCATION_CODES.GODOWN, name: "Godown" }
];

export async function ensureBusinessLocations(db, businessId) {
  for (const location of DEFAULT_LOCATIONS) {
    await db.query(
      `INSERT INTO inventory_location (business_id, code, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (business_id, code) DO NOTHING`,
      [businessId, location.code, location.name]
    );
  }
}

export async function getLocationMap(db, businessId) {
  await ensureBusinessLocations(db, businessId);
  const result = await db.query(
    `SELECT id, code, name
     FROM inventory_location
     WHERE business_id = $1`,
    [businessId]
  );

  const byCode = new Map();
  result.rows.forEach((row) => {
    byCode.set(row.code, row);
  });
  return byCode;
}

export async function getLocationByCode(db, businessId, code) {
  const byCode = await getLocationMap(db, businessId);
  const location = byCode.get(code);
  if (!location) {
    throw new ApiError(400, `Invalid location: ${code}`);
  }
  return location;
}

