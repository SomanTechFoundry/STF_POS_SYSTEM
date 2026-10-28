-- Required for gen_random_uuid() on Neon / Postgres
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_name" VARCHAR(120) NOT NULL,
    "business_profile_id" VARCHAR(40) NOT NULL DEFAULT 'fertilizer',
    "full_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" VARCHAR(30) NOT NULL DEFAULT 'owner',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signup_request" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_name" VARCHAR(120) NOT NULL,
    "business_profile_id" VARCHAR(40) NOT NULL DEFAULT 'fertilizer',
    "full_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "approval_token" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ(6),
    "approved_by_email" VARCHAR(120),

    CONSTRAINT "signup_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_template" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_key" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(240) NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "print_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_setting" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "print_template_key" VARCHAR(60) NOT NULL DEFAULT 'classic_invoice',
    "bill_profile" JSONB NOT NULL DEFAULT '{}',
    "bill_profile_i18n" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "sku" VARCHAR(60) NOT NULL,
    "unit_type" VARCHAR(12) NOT NULL DEFAULT 'pcs',
    "unit_size" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "cost_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sale_price" DECIMAL(12,2) NOT NULL,
    "stock_qty" INTEGER NOT NULL DEFAULT 0,
    "reorder_level" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_location" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stock" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "address" VARCHAR(200) NOT NULL DEFAULT '',
    "mobile" VARCHAR(20) NOT NULL DEFAULT '',
    "email" VARCHAR(120) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "bill_no" BIGSERIAL NOT NULL,
    "order_type" VARCHAR(20) NOT NULL DEFAULT 'retail',
    "customer_id" UUID,
    "payment_mode" VARCHAR(20) NOT NULL,
    "gross_total" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_total" DECIMAL(12,2) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "wholesale_tin_no" VARCHAR(120) NOT NULL DEFAULT '',
    "wholesale_fl_pl_sl_no" VARCHAR(120) NOT NULL DEFAULT '',
    "source_location_code" VARCHAR(40) NOT NULL DEFAULT 'main_store',
    "created_by" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sale_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_variant_id" UUID NOT NULL,
    "qty" INTEGER NOT NULL,
    "selling_price" DECIMAL(12,2) NOT NULL,
    "selling_price_total" DECIMAL(12,2) NOT NULL,
    "cost_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cost_price_total" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "sale_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "purchase_no" BIGSERIAL NOT NULL,
    "supplier_name" VARCHAR(120) NOT NULL DEFAULT '',
    "payment_mode" VARCHAR(20) NOT NULL,
    "gross_total" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_total" DECIMAL(12,2) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "receive_location_code" VARCHAR(40) NOT NULL DEFAULT 'godown',
    "created_by" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchase_order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_variant_id" UUID NOT NULL,
    "qty" INTEGER NOT NULL,
    "cost_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cost_price_total" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_translation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" UUID NOT NULL,
    "field_name" VARCHAR(40) NOT NULL,
    "locale" VARCHAR(20) NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE INDEX "idx_app_user_business_id" ON "app_user"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "signup_request_email_key" ON "signup_request"("email");

-- CreateIndex
CREATE UNIQUE INDEX "signup_request_approval_token_key" ON "signup_request"("approval_token");

-- CreateIndex
CREATE INDEX "idx_signup_status" ON "signup_request"("status");

-- CreateIndex
CREATE UNIQUE INDEX "print_template_template_key_key" ON "print_template"("template_key");

-- CreateIndex
CREATE UNIQUE INDEX "business_setting_business_id_key" ON "business_setting"("business_id");

-- CreateIndex
CREATE INDEX "idx_product_business" ON "product"("business_id");

-- CreateIndex
CREATE INDEX "idx_variant_product_id" ON "product_variant"("product_id");

-- CreateIndex
CREATE INDEX "idx_variant_business" ON "product_variant"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_business_id_sku_key" ON "product_variant"("business_id", "sku");

-- CreateIndex
CREATE INDEX "idx_inventory_location_business" ON "inventory_location"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_location_business_id_code_key" ON "inventory_location"("business_id", "code");

-- CreateIndex
CREATE INDEX "idx_inventory_stock_variant" ON "inventory_stock"("variant_id");

-- CreateIndex
CREATE INDEX "idx_inventory_stock_location" ON "inventory_stock"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stock_variant_id_location_id_key" ON "inventory_stock"("variant_id", "location_id");

-- CreateIndex
CREATE INDEX "idx_customer_business" ON "customer"("business_id");

-- CreateIndex
CREATE INDEX "idx_sale_business_date" ON "sale"("business_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_sale_customer_id" ON "sale"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "sale_business_id_bill_no_key" ON "sale"("business_id", "bill_no");

-- CreateIndex
CREATE INDEX "idx_sale_item_sale_id" ON "sale_item"("sale_id");

-- CreateIndex
CREATE INDEX "idx_sale_item_variant_id" ON "sale_item"("product_variant_id");

-- CreateIndex
CREATE INDEX "idx_purchase_order_business_date" ON "purchase_order"("business_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_business_id_purchase_no_key" ON "purchase_order"("business_id", "purchase_no");

-- CreateIndex
CREATE INDEX "idx_purchase_order_item_order_id" ON "purchase_order_item"("purchase_order_id");

-- CreateIndex
CREATE INDEX "idx_entity_translation_lookup" ON "entity_translation"("business_id", "entity_type", "locale");

-- CreateIndex
CREATE INDEX "idx_entity_translation_entity" ON "entity_translation"("entity_type", "entity_id", "field_name");

-- CreateIndex
CREATE UNIQUE INDEX "entity_translation_business_id_entity_type_entity_id_field__key" ON "entity_translation"("business_id", "entity_type", "entity_id", "field_name", "locale");

-- AddForeignKey
ALTER TABLE "business_setting" ADD CONSTRAINT "business_setting_print_template_key_fkey" FOREIGN KEY ("print_template_key") REFERENCES "print_template"("template_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale" ADD CONSTRAINT "sale_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

