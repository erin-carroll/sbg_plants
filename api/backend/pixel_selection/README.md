# pixel_selection Lambda

Receives a set of pixel ID ranges and an algorithm name, looks up which
pixels exist in the database, and submits one AWS Batch job per
(campaign, sensor, granule) group to the appropriate algorithm queue.

## Request format

```
POST /run_algorithm
Authorization: Bearer <superadmin JWT>

{
  "algorithm":    "isofit",
  "pixel_ranges": {
    "campaign_name|sensor_name": [[start_id, end_id], ...]
  }
}
```

`algorithm` defaults to `"isofit"` if omitted. The single `/run_algorithm`
endpoint handles all registered algorithms — the algorithm is determined
entirely by the `"algorithm"` field in the request body.

## How it works

1. Validates auth (superadmin required) and the request body.
2. Queries `vswir_plants.extracted_spectra_view` using `BETWEEN` clauses
   to resolve which pixels exist and which granule each belongs to.
3. Groups pixels by `(campaign_name, sensor_name, granule_id)`.
4. Writes a **parent job record** to DynamoDB with `job_type = "<algorithm>_parent"`.
5. Chunks each group by `BATCH_SIZE` (default 20) and submits one AWS
   Batch job per chunk, passing the child `JOB_ID` as an environment variable.
6. Writes a **child job record** to DynamoDB per chunk with `parent_job_id`
   pointing back to the parent.

## The `parent_job_type` key — critical

The `parent_job_type` string (e.g. `"isofit_parent"`) written into DynamoDB
by this Lambda is the single value that ties the whole system together:

- `GET /data_product_jobs?job_type=isofit_parent` — how job history lists
  jobs for a specific algorithm
- The frontend `algorithmConfig.js` `jobType` field must **exactly match**
  this string or job history will return nothing

The `job_status` Lambda is fully generic — it aggregates child jobs by
`parent_job_id` GSI and derives the parent status automatically. It does
not need to know about specific algorithms.

## Staging table and child job IDs

The Batch worker writes output rows to the staging table using the child
`JOB_ID` (not the parent). The staging table schema is:

```sql
CREATE TABLE vswir_plants_staging.output_pixel_<product> (
    pixel_id    INTEGER   NOT NULL,
    job_id      VARCHAR   NOT NULL,  -- child job ID written by the worker
    <result_col> FLOAT4[] NOT NULL,
    PRIMARY KEY (pixel_id, job_id)
);
```

The promotion and delete operations in the promotion Lambda scope their
`DELETE`/`SELECT` to `WHERE job_id = ANY(<child_job_ids>)` — using child
job IDs collected from DynamoDB, not the parent job ID. This is why the
staging table has a `job_id` column.

## Algorithm registry

Algorithms are registered in `ALGORITHM_REGISTRY` at the top of
`app/main.py`. Each entry maps an algorithm name to:

| Key | Description |
|---|---|
| `job_queue` | AWS Batch job queue name (from env var) |
| `job_definition` | AWS Batch job definition name (from env var) |
| `parent_job_type` | DynamoDB `job_type` for the parent record — must match frontend `jobType` |
| `child_job_type` | DynamoDB `job_type` for child (per-chunk) records |

Current registry:

```python
ALGORITHM_REGISTRY = {
    "isofit": {
        "job_queue":       os.environ["BATCH_JOB_QUEUE"],
        "job_definition":  os.environ["BATCH_JOB_DEFINITION"],
        "parent_job_type": "isofit_parent",
        "child_job_type":  "inversion",
    },
}
```

---

## Adding a new algorithm

Follow these steps in order.

### 1. Database — staging and production tables

Add to `schema/staging_tables.sql`:

```sql
CREATE TABLE vswir_plants_staging.output_pixel_<product> (
    pixel_id     INTEGER  NOT NULL,
    job_id       VARCHAR  NOT NULL,   -- child job ID from the Batch worker
    <result_col> FLOAT4[] NOT NULL,
    PRIMARY KEY (pixel_id, job_id)
);
```

Add to `schema/tables.sql` (production):

```sql
CREATE TABLE vswir_plants.output_pixel_<product> (
    pixel_id     INTEGER PRIMARY KEY REFERENCES vswir_plants.pixel(pixel_id),
    <result_col> FLOAT4[] NOT NULL
);
```

Add views in `schema/views_v2.sql` and `schema/staging_views.sql`
following the pattern of `reflectance_view`.

Add grants in `schema/grant.sql` for the algorithm's DB user:

```sql
GRANT USAGE ON SCHEMA vswir_plants         TO <user>;
GRANT USAGE ON SCHEMA vswir_plants_staging TO <user>;
GRANT INSERT, UPDATE, SELECT        ON vswir_plants.output_pixel_<product>         TO <user>;
GRANT INSERT, UPDATE, SELECT, DELETE ON vswir_plants_staging.output_pixel_<product> TO <user>;
```

`DELETE` on the staging table is required — the promotion Lambda deletes
staging rows during both promote and delete operations.

### 2. Batch worker (ECR image)

Write the worker container. It receives these environment variables from
the pixel selection Lambda:

| Variable | Description |
|---|---|
| `JOB_ID` | Child job ID — write this into the staging table `job_id` column |
| `PIXEL_IDS` | Comma-separated pixel IDs to process |
| `CAMPAIGN_NAME` | Campaign name |
| `SENSOR_NAME` | Sensor name |

Push the image to ECR.

### 3. Algorithm registry — `app/main.py` (this file)

Add an entry to `ALGORITHM_REGISTRY`:

```python
ALGORITHM_REGISTRY = {
    "isofit": { ... },  # existing — do not change
    "<product>": {
        "job_queue":       os.environ["<PRODUCT>_BATCH_JOB_QUEUE"],
        "job_definition":  os.environ["<PRODUCT>_BATCH_JOB_DEFINITION"],
        "parent_job_type": "<product>_parent",
        "child_job_type":  "<product>_worker",
    },
}
```

### 4. Terraform — `terraform_deployment/modules/isofit_pipeline/main_batch.tf`

- Add a Batch compute environment, job queue, and job definition for the
  new worker following the isofit pattern
- Add the new env vars to the pixel_selection Lambda:

```hcl
<PRODUCT>_BATCH_JOB_QUEUE      = aws_batch_job_queue.<product>_worker.name
<PRODUCT>_BATCH_JOB_DEFINITION = aws_batch_job_definition.<product>_worker.name
```

- No new API Gateway route needed — `POST /run_algorithm` is already generic.
  Just add the new env vars to the pixel_selection Lambda:

### 5. Promotion Lambda — `api/backend/pixel_output/promotion/app/promote.py`

Add an entry to `PRODUCT_REGISTRY`:

```python
PRODUCT_REGISTRY = {
    "isofit": { ... },  # existing — do not change
    "<product>": {
        "label":           "<Human readable name>",
        "staging":         "vswir_plants_staging.output_pixel_<product>",
        "production":      "vswir_plants.output_pixel_<product>",
        "columns":         ["pixel_id", "<result_col>"],
        "array_cols":      {"<result_col>"},
        "conflict_update": ["<result_col>"],
    },
}
```

Redeploy the promotion Lambda after this change.

### 6. Frontend — `api/frontend/react-app/src/config/algorithmConfig.js`

Add an entry to `ALGORITHM_REGISTRY`:

```js
"<product>": {
  label:                  "<Human readable name>",
  description:            "One-line description shown in the UI.",
  apiEndpoint:            "/run_algorithm",   // generic — algorithm is in the request body
  jobType:                "<product>_parent",  // must match parent_job_type above
  productKey:             "<product>",          // must match promotion PRODUCT_REGISTRY key
  downloadView:           "<product>_view",
  downloadSpectralColumn: "<result_col>",
}
```

The `jobType` value **must exactly match** `parent_job_type` set in step 3.
The `productKey` value **must exactly match** the key in `PRODUCT_REGISTRY` in step 5.

No other frontend changes are needed — job submission, history, status
polling, promote, delete, and download are all algorithm-agnostic.

### 7. Redeploy

Redeploy in this order:

1. Apply Terraform (new Batch resources + API Gateway route + Lambda env vars)
2. Push and update the pixel_selection Lambda
3. Push and update the promotion Lambda

---

## Environment variables (pixel_selection Lambda)

| Variable | Description |
|---|---|
| `BATCH_JOB_QUEUE` | isofit Batch job queue name |
| `BATCH_JOB_DEFINITION` | isofit Batch job definition name |
| `DYNAMODB_TABLE` | DynamoDB table name for job records |
| `DB_SECRET_ARN` | Secrets Manager ARN for DB credentials |
| `BATCH_SIZE` | Pixels per Batch job (default: 20) |
| `AWS_REGION` | AWS region (default: us-west-2) |

New algorithms add `<PRODUCT>_BATCH_JOB_QUEUE` and
`<PRODUCT>_BATCH_JOB_DEFINITION` alongside the existing vars.
