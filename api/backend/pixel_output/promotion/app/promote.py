"""
Pixel output promotion — moves algorithm results from staging to production.

PRODUCT_REGISTRY is the single place to register a new algorithm's output tables.
Adding a new data product requires only a new entry here; the promotion logic,
lambda handler, API route, and frontend are all algorithm-agnostic.

Each entry defines:
  label       — human-readable name returned by GET /data_products
  staging     — fully-qualified staging table (vswir_plants_staging.*)
  production  — fully-qualified production table (vswir_plants.*)
  columns     — ordered list of columns to copy (must match both tables)
  array_cols  — subset of columns that are Postgres arrays (FLOAT4[] etc.),
                used to format values correctly for execute_values
  conflict_update — columns to SET on conflict (excludes pixel_id PK)
"""

import logging
import psycopg2.extras

logger = logging.getLogger(__name__)

# ── Registry ──────────────────────────────────────────────────────────────────
#
# To add a new algorithm:
#   1. Create its staging table in schema/staging_tables.sql
#   2. Ensure the Batch worker writes to the staging table
#   3. Add one entry below — nothing else changes
#
PRODUCT_REGISTRY: dict[str, dict] = {
    "isofit": {
        "label":          "ISOFIT Reflectance",
        "staging":        "vswir_plants_staging.output_pixel_rfl",
        "production":     "vswir_plants.output_pixel_rfl",
        "columns":        ["pixel_id", "reflectance"],
        "array_cols":     {"reflectance"},
        "conflict_update": ["reflectance"],
    },
    # Future example — uncomment and fill when fractional cover is implemented:
    # "fractional_cover": {
    #     "label":          "Fractional Cover",
    #     "staging":        "vswir_plants_staging.output_pixel_data_products",
    #     "production":     "vswir_plants.output_pixel_data_products",
    #     "columns":        ["pixel_id", "fc_class", "fc_percentage",
    #                        "canopy_water_content", "uncertainty_cwc"],
    #     "array_cols":     set(),
    #     "conflict_update": ["fc_class", "fc_percentage",
    #                         "canopy_water_content", "uncertainty_cwc"],
    # },
}


def promote(conn, product_key: str, job_id: str, child_job_ids: list[str]) -> int:
    """
    Promote staging rows for the given child_job_ids to production for a
    single registered product. Runs inside a single transaction — caller holds
    the connection context manager (with conn:).

    Returns the number of rows promoted.
    """
    cfg = PRODUCT_REGISTRY.get(product_key)
    if not cfg:
        raise ValueError(f"Unknown product_key '{product_key}'. "
                         f"Registered keys: {list(PRODUCT_REGISTRY)}")

    return _promote_product(conn, cfg, job_id, child_job_ids)


def delete_staging(conn, product_key: str, job_id: str, child_job_ids: list[str]) -> int:
    """
    Delete staging rows for the given child_job_ids without promoting.
    Used by the DELETE endpoint to discard a job's output from staging.

    Returns the number of rows deleted.
    """
    cfg = PRODUCT_REGISTRY.get(product_key)
    if not cfg:
        raise ValueError(f"Unknown product_key '{product_key}'. "
                         f"Registered keys: {list(PRODUCT_REGISTRY)}")

    staging = cfg["staging"]
    with conn.cursor() as cur:
        cur.execute(
            f"DELETE FROM {staging} WHERE job_id = ANY(%s)",
            (child_job_ids,)
        )
        count = cur.rowcount

    logger.info("Deleted %d staging rows for job=%s product=%s", count, job_id, product_key)
    return count


def _promote_product(conn, cfg: dict, job_id: str, child_job_ids: list[str]) -> int:
    staging    = cfg["staging"]
    production = cfg["production"]
    columns    = cfg["columns"]
    array_cols = cfg["array_cols"]
    conflict_cols = cfg["conflict_update"]

    # production columns exclude job_id (job_id is staging-only)
    prod_columns = [c for c in columns if c != "job_id"]
    cols_sql      = ", ".join(prod_columns)
    update_sql    = ", ".join(f"{c} = EXCLUDED.{c}" for c in conflict_cols)

    with conn.cursor() as cur:
        # 1. Read from staging scoped to these child jobs
        cur.execute(
            f"SELECT {cols_sql} FROM {staging} WHERE job_id = ANY(%s)",
            (child_job_ids,)
        )
        rows = cur.fetchall()

    if not rows:
        logger.info("No staging rows found for job=%s %s — nothing to promote", job_id, staging)
        return 0

    logger.info("Promoting %d rows from %s → %s (job=%s)", len(rows), staging, production, job_id)

    # 2. Format array columns as Python lists (psycopg2 needs list, not memoryview)
    formatted = []
    col_indices = {c: i for i, c in enumerate(prod_columns)}
    for row in rows:
        row = list(row)
        for col in array_cols:
            idx = col_indices.get(col)
            if idx is not None and row[idx] is not None:
                row[idx] = list(row[idx])
        formatted.append(tuple(row))

    # 3. Upsert into production (idempotent — safe to retry)
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(
            cur,
            f"""
            INSERT INTO {production} ({cols_sql})
            VALUES %s
            ON CONFLICT (pixel_id) DO UPDATE SET {update_sql}
            """,
            formatted,
        )

        # 4. Remove from staging scoped to these child jobs
        cur.execute(
            f"DELETE FROM {staging} WHERE job_id = ANY(%s)",
            (child_job_ids,)
        )

    logger.info("Promoted %d rows for %s (job=%s)", len(formatted), production, job_id)
    return len(formatted)
