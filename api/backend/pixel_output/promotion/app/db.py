import os
import json
import logging
import boto3
import psycopg2

logger = logging.getLogger(__name__)

_conn = None


def get_connection():
    """Return a module-level singleton psycopg2 connection, reconnecting if closed."""
    global _conn
    if _conn is None or _conn.closed:
        secret_arn = os.environ["ISOFIT_DB_SECRET_ARN"]
        region     = os.environ.get("AWS_REGION", "us-west-2")

        secrets = boto3.client("secretsmanager", region_name=region)
        creds   = json.loads(secrets.get_secret_value(SecretId=secret_arn)["SecretString"])

        _conn = psycopg2.connect(
            host=creds["host"],
            port=5432,
            dbname=creds.get("dbname", "vswirplants"),
            user=creds["username"],
            password=creds["password"],
            connect_timeout=10,
        )
        _conn.autocommit = False
        logger.info("DB connection established")

    return _conn
