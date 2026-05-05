"""
Pixel output promotion lambda.

Routes:
  POST   /data_products/{product_key}/jobs/{job_id}/promote
    — Promotes staging output rows for a completed algorithm job to production.
    — Superadmins only.

  DELETE /data_products/{product_key}/jobs/{job_id}
    — Deletes staging rows for a job without promoting; marks job as "deleted".
    — Blocked if job is already promoted.
    — Superadmins only.

  GET    /data_products
    — Returns the registered product registry (keys + labels).
    — Admins only (used by the frontend to populate the algorithm dropdown).
"""

import logging

from app.auth import get_claims, require_superadmin, respond
from app.db import get_connection
from app.dynamo import get_parent_job, collect_child_job_ids, mark_promoted, mark_deleted
from app.promote import promote, delete_staging, PRODUCT_REGISTRY

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Parent job statuses that are eligible for promotion
PROMOTABLE_STATUSES = {"complete", "partial"}
# Statuses that allow deletion of staging rows
DELETABLE_STATUSES  = {"complete", "partial"}


def lambda_handler(event, context):
    path   = event.get("rawPath", "")
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    params = event.get("pathParameters") or {}

    # ── GET /data_products ────────────────────────────────────────────────────
    if method == "GET" and path.rstrip("/").endswith("/data_products"):
        try:
            claims = get_claims(event)
            require_superadmin(claims)
        except PermissionError as e:
            return respond(403, {"message": str(e)})
        except Exception:
            return respond(401, {"message": "Unauthorized"})

        products = [
            {"key": key, "label": cfg["label"]}
            for key, cfg in PRODUCT_REGISTRY.items()
        ]
        return respond(200, {"products": products})

    # ── POST /data_products/{product_key}/jobs/{job_id}/promote ───────────────
    if method == "POST":
        try:
            claims = get_claims(event)
            require_superadmin(claims)
        except PermissionError as e:
            return respond(403, {"message": str(e)})
        except Exception:
            return respond(401, {"message": "Unauthorized"})

        product_key = params.get("product_key")
        job_id      = params.get("job_id")

        if not product_key or not job_id:
            return respond(400, {"message": "Missing product_key or job_id in path"})

        if product_key not in PRODUCT_REGISTRY:
            return respond(400, {
                "message": f"Unknown product_key '{product_key}'",
                "registered": list(PRODUCT_REGISTRY.keys()),
            })

        # Validate job exists and is in a promotable state
        item = get_parent_job(job_id)
        if not item:
            return respond(404, {"message": f"Job '{job_id}' not found"})

        status = item.get("status", {}).get("S", "unknown")
        if status == "promoted":
            return respond(409, {"message": f"Job '{job_id}' has already been promoted"})
        if status not in PROMOTABLE_STATUSES:
            return respond(409, {
                "message": f"Job '{job_id}' has status '{status}' — "
                           f"must be one of {sorted(PROMOTABLE_STATUSES)} to promote"
            })

        # Collect child job IDs — these are the job_id values written into the staging table
        child_job_ids = collect_child_job_ids(job_id)
        if not child_job_ids:
            return respond(400, {"message": f"No child jobs found for job '{job_id}'"})

        logger.info("Promoting %d child jobs for job=%s product=%s",
                    len(child_job_ids), job_id, product_key)

        # Promote staging → production in a single transaction
        try:
            conn = get_connection()
            with conn:
                row_count = promote(conn, product_key, job_id, child_job_ids)
        except Exception as e:
            logger.exception("Promotion failed for job=%s product=%s", job_id, product_key)
            return respond(500, {"message": f"Promotion failed: {e}"})

        # Mark job as promoted in DynamoDB
        promoted_at = mark_promoted(job_id)

        logger.info("Promotion complete: job=%s product=%s rows=%d",
                    job_id, product_key, row_count)
        return respond(200, {
            "job_id":       job_id,
            "product_key":  product_key,
            "status":       "promoted",
            "promoted_at":  promoted_at,
            "pixel_count":  row_count,
        })

    # ── DELETE /data_products/{product_key}/jobs/{job_id} ─────────────────────
    if method == "DELETE":
        try:
            claims = get_claims(event)
            require_superadmin(claims)
        except PermissionError as e:
            return respond(403, {"message": str(e)})
        except Exception:
            return respond(401, {"message": "Unauthorized"})

        product_key = params.get("product_key")
        job_id      = params.get("job_id")

        if not product_key or not job_id:
            return respond(400, {"message": "Missing product_key or job_id in path"})

        if product_key not in PRODUCT_REGISTRY:
            return respond(400, {
                "message": f"Unknown product_key '{product_key}'",
                "registered": list(PRODUCT_REGISTRY.keys()),
            })

        item = get_parent_job(job_id)
        if not item:
            return respond(404, {"message": f"Job '{job_id}' not found"})

        status = item.get("status", {}).get("S", "unknown")
        if status == "promoted":
            return respond(409, {"message": f"Job '{job_id}' has already been promoted — cannot delete staging rows"})
        if status not in DELETABLE_STATUSES:
            return respond(409, {
                "message": f"Job '{job_id}' has status '{status}' — "
                           f"must be one of {sorted(DELETABLE_STATUSES)} to delete staging rows"
            })

        child_job_ids = collect_child_job_ids(job_id)
        if not child_job_ids:
            # No child jobs means nothing to delete from staging; still mark deleted
            logger.info("No child jobs for job=%s — marking deleted without DB delete", job_id)
            deleted_at = mark_deleted(job_id)
            return respond(200, {
                "job_id":      job_id,
                "product_key": product_key,
                "status":      "deleted",
                "deleted_at":  deleted_at,
                "rows_deleted": 0,
            })

        logger.info("Deleting staging rows for job=%s product=%s (%d child jobs)",
                    job_id, product_key, len(child_job_ids))

        try:
            conn = get_connection()
            with conn:
                rows_deleted = delete_staging(conn, product_key, job_id, child_job_ids)
        except Exception as e:
            logger.exception("Staging delete failed for job=%s product=%s", job_id, product_key)
            return respond(500, {"message": f"Staging delete failed: {e}"})

        deleted_at = mark_deleted(job_id)

        logger.info("Staging delete complete: job=%s rows=%d", job_id, rows_deleted)
        return respond(200, {
            "job_id":       job_id,
            "product_key":  product_key,
            "status":       "deleted",
            "deleted_at":   deleted_at,
            "rows_deleted": rows_deleted,
        })

    return respond(404, {"message": "Not found"})
