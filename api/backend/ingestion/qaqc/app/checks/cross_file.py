"""
QAQC cross-file checks.

Runs last in the pipeline after all per-file checks have completed.
Operates on context.data DataFrames already in memory — no DB queries.
All checks emit warnings only; none block ingestion.

Checks (in order):
  1. Plots with no traits      — GeoJSON features with no matching rows in traits.csv.
  2. Traits with no granule    — traits.csv (campaign, plot) pairs not present in plots.geojson.
  3. Trait count distribution  — samples with fewer non-blank traits than the bundle mode.
  4. Samples with no traits    — samples where every trait value is blank/null.
"""

from __future__ import annotations

import pandas as pd

from app.checks.types import CheckContext, CheckResult


def check(context: CheckContext) -> CheckResult:
    geojson   = context.data["plots"]
    df_traits = context.data["traits"]

    warnings = (
        _check_plots_with_no_traits(geojson, df_traits)
        + _check_traits_with_no_granule_coverage(geojson, df_traits)
        + _check_sample_trait_count_distribution(df_traits)
        + _check_samples_with_no_traits(df_traits)
    )

    row_count = len(df_traits)
    return CheckResult("cross_file", row_count, [], warnings)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _is_blank(val) -> bool:
    """Return True if val is null or an empty/whitespace-only string."""
    return pd.isna(val) or str(val).strip() == ""


def _w(message: str, column: str | None = None) -> dict:
    return {"file": "cross_file", "row": None, "column": column, "message": message}


# ── Check 1 ───────────────────────────────────────────────────────────────────

def _check_plots_with_no_traits(geojson: dict, df_traits: pd.DataFrame) -> list[dict]:
    """
    Warn for each GeoJSON feature whose (campaign_name, plot_name) has no
    corresponding rows in traits.csv.
    """
    if df_traits.empty:
        return []

    features = geojson.get("features", [])
    if not features:
        return []

    trait_pairs = set(
        zip(df_traits["campaign_name"], df_traits["plot_name"])
    )

    warnings = []
    for feature in features:
        props         = feature.get("properties") or {}
        campaign_name = props.get("campaign_name")
        plot_name     = props.get("plot_name")
        if campaign_name is None or plot_name is None:
            continue
        if (campaign_name, plot_name) not in trait_pairs:
            warnings.append(_w(
                f"plot '{plot_name}' (campaign '{campaign_name}') "
                f"has no trait measurements in traits.csv",
                column="plot_name",
            ))

    return warnings


# ── Check 2 ───────────────────────────────────────────────────────────────────

def _check_traits_with_no_granule_coverage(
    geojson: dict,
    df_traits: pd.DataFrame,
) -> list[dict]:
    """
    Warn for each unique (campaign_name, plot_name) in traits.csv that has
    no matching feature in plots.geojson.
    One warning per pair, not per trait row.
    """
    features = geojson.get("features", [])
    if not features:
        return []

    if df_traits.empty:
        return []

    geojson_pairs = set()
    for feature in features:
        props = feature.get("properties") or {}
        c     = props.get("campaign_name")
        p     = props.get("plot_name")
        if c is not None and p is not None:
            geojson_pairs.add((c, p))

    warnings = []
    seen     = set()
    for _, row in df_traits.iterrows():
        key = (row["campaign_name"], row["plot_name"])
        if key in seen:
            continue
        seen.add(key)
        if key not in geojson_pairs:
            warnings.append(_w(
                f"plot '{key[1]}' (campaign '{key[0]}') "
                f"appears in traits.csv but has no feature in plots.geojson",
                column="plot_name",
            ))

    return warnings


# ── Check 3 ───────────────────────────────────────────────────────────────────

def _check_sample_trait_count_distribution(df_traits: pd.DataFrame) -> list[dict]:
    """
    Group traits by (campaign_name, plot_name, collection_date, sample_name).
    Count non-blank trait values per group, compute the mode across all groups,
    and warn for each sample whose count is below the mode.
    """
    if df_traits.empty:
        return []

    group_cols = ["campaign_name", "plot_name", "collection_date", "sample_name"]

    counts = (
        df_traits
        .groupby(group_cols, sort=False)["trait"]
        .apply(lambda s: s.apply(lambda v: not _is_blank(v)).sum())
        .reset_index(name="trait_count")
    )

    if counts.empty:
        return []

    mode_val = int(counts["trait_count"].mode()[0])

    warnings = []
    for _, row in counts.iterrows():
        count = int(row["trait_count"])
        if count < mode_val:
            warnings.append(_w(
                f"sample '{row['sample_name']}' in plot '{row['plot_name']}' "
                f"(campaign '{row['campaign_name']}', date '{row['collection_date']}') "
                f"has {count} trait measurement(s); bundle mode is {mode_val}",
                column="trait",
            ))

    return warnings


# ── Check 4 ───────────────────────────────────────────────────────────────────

def _check_samples_with_no_traits(df_traits: pd.DataFrame) -> list[dict]:
    """
    Warn for each (campaign_name, plot_name, collection_date, sample_name) group
    where every trait value is blank/null.
    Appends a summary warning: "N of M samples in this bundle have no trait measurements."
    """
    if df_traits.empty:
        return []

    group_cols = ["campaign_name", "plot_name", "collection_date", "sample_name"]

    def all_blank(s: pd.Series) -> bool:
        return s.apply(_is_blank).all()

    no_trait_groups = (
        df_traits
        .groupby(group_cols, sort=False)["trait"]
        .apply(all_blank)
    )

    total_samples    = len(no_trait_groups)
    no_trait_samples = no_trait_groups[no_trait_groups].index

    if len(no_trait_samples) == 0:
        return []

    warnings = []
    for key in no_trait_samples:
        campaign_name, plot_name, collection_date, sample_name = key
        warnings.append(_w(
            f"sample '{sample_name}' in plot '{plot_name}' "
            f"(campaign '{campaign_name}', date '{collection_date}') "
            f"has no trait measurements",
            column="trait",
        ))

    warnings.append(_w(
        f"{len(no_trait_samples)} of {total_samples} sample(s) "
        f"in this bundle have no trait measurements",
        column="trait",
    ))

    return warnings
