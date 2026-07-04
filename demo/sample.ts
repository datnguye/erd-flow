import type { ErdPayload } from "../src/types/erd";

// A small jaffle-shop-shaped ERD used by the demo page and the e2e suite. The
// `orders` table is intentionally wide (> the collapse threshold) so the demo
// can exercise the column-collapse toggle and the `collapseColumns` prop.
export const SAMPLE: ErdPayload = {
  metadata: { dbt_project_name: "jaffle_shop" },
  nodes: [
    {
      id: "model.jaffle_shop.customers",
      name: "customers",
      resource_type: "model",
      schema_name: "analytics",
      columns: [
        { name: "customer_id", data_type: "int", is_primary_key: true },
        { name: "first_name", data_type: "text" },
        { name: "last_name", data_type: "text" },
      ],
    },
    {
      id: "model.jaffle_shop.orders",
      name: "orders",
      resource_type: "model",
      schema_name: "analytics",
      columns: [
        { name: "order_id", data_type: "int", is_primary_key: true },
        { name: "customer_id", data_type: "int", is_foreign_key: true },
        { name: "order_date", data_type: "date" },
        { name: "status", data_type: "text" },
        { name: "amount", data_type: "numeric" },
        { name: "tax_paid", data_type: "numeric" },
        { name: "credit_card_amount", data_type: "numeric" },
        { name: "coupon_amount", data_type: "numeric" },
        { name: "bank_transfer_amount", data_type: "numeric" },
      ],
    },
    {
      id: "model.jaffle_shop.order_items",
      name: "order_items",
      resource_type: "model",
      schema_name: "analytics",
      columns: [
        { name: "order_item_id", data_type: "int", is_primary_key: true },
        { name: "order_id", data_type: "int", is_foreign_key: true },
        { name: "product_id", data_type: "int", is_foreign_key: true },
      ],
    },
    {
      id: "seed.jaffle_shop.products",
      name: "products",
      resource_type: "seed",
      schema_name: "raw",
      columns: [
        { name: "product_id", data_type: "int", is_primary_key: true },
        { name: "product_name", data_type: "text" },
      ],
    },
    {
      id: "source.jaffle_shop.raw_customers",
      name: "raw_customers",
      resource_type: "source",
      schema_name: "raw",
      columns: [{ name: "id", data_type: "int", is_primary_key: true }],
    },
  ],
  edges: [
    {
      id: "e0",
      from_id: "model.jaffle_shop.orders",
      to_id: "model.jaffle_shop.customers",
      from_columns: ["customer_id"],
      to_columns: ["customer_id"],
      relationship_type: "fk",
      cardinality: "n1",
    },
    {
      id: "e1",
      from_id: "model.jaffle_shop.order_items",
      to_id: "model.jaffle_shop.orders",
      from_columns: ["order_id"],
      to_columns: ["order_id"],
      relationship_type: "fk",
      cardinality: "n1",
    },
    {
      id: "e2",
      from_id: "model.jaffle_shop.order_items",
      to_id: "seed.jaffle_shop.products",
      from_columns: ["product_id"],
      to_columns: ["product_id"],
      relationship_type: "fk",
      cardinality: "n1",
    },
  ],
};
