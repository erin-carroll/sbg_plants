import os
import logging
import boto3
from datetime import datetime, timezone

logger   = logging.getLogger(__name__)
dynamodb = boto3.client("dynamodb", region_name=os.environ.get("AWS_REGION", "us-west-2"))
JOB_TABLE = os.environ["DYNAMODB_TABLE"]


def get_parent_job(job_id: str) -> dict | None:
    """Fetch a parent job record by job_id. Returns None if not found."""
    resp = dynamodb.get_item(
        TableName=JOB_TABLE,
        Key={"job_id": {"S": job_id}},
    )
    return resp.get("Item")


def collect_child_job_ids(parent_job_id: str) -> list[str]:
    """
    Page through all child job records for a parent job using the
    parent_job_id-index GSI and return their job_ids.

    These child job IDs are the values written into the staging table's
    job_id column by the Batch worker, so they are the correct scope key
    for DELETE and SELECT operations on staging rows.
    """
    paginator = dynamodb.get_paginator("query")
    child_job_ids = []

    for page in paginator.paginate(
        TableName=JOB_TABLE,
        IndexName="parent_job_id-index",
        KeyConditionExpression="parent_job_id = :p",
        ExpressionAttributeValues={":p": {"S": parent_job_id}},
    ):
        for item in page.get("Items", []):
            jid = item.get("job_id", {}).get("S")
            if jid:
                child_job_ids.append(jid)

    return child_job_ids


def mark_promoted(job_id: str) -> str:
    """Mark the parent job as promoted and record the timestamp."""
    promoted_at = datetime.now(timezone.utc).isoformat()
    dynamodb.update_item(
        TableName=JOB_TABLE,
        Key={"job_id": {"S": job_id}},
        UpdateExpression="SET #s = :s, promoted_at = :t",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":s": {"S": "promoted"},
            ":t": {"S": promoted_at},
        },
    )
    logger.info("Marked job_id=%s as promoted", job_id)
    return promoted_at


def mark_deleted(job_id: str) -> str:
    """Mark the parent job staging rows as deleted and record the timestamp."""
    deleted_at = datetime.now(timezone.utc).isoformat()
    dynamodb.update_item(
        TableName=JOB_TABLE,
        Key={"job_id": {"S": job_id}},
        UpdateExpression="SET #s = :s, deleted_at = :t",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":s": {"S": "deleted"},
            ":t": {"S": deleted_at},
        },
    )
    logger.info("Marked job_id=%s as deleted", job_id)
    return deleted_at
