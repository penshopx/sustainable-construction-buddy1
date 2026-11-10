#!/usr/bin/env python3
"""Stage every repository migration for disposable local Supabase CI only."""
from pathlib import Path
import sys


def prepare(destination: Path) -> None:
    source = Path(__file__).resolve().parents[1] / "supabase"
    target = destination / "supabase"
    target.mkdir(parents=True, exist_ok=False)
    # Do not copy linked-project metadata or the production project identifier.
    (target / "config.toml").write_text('project_id = "aspekindo-ci"\n')
    migrations = target / "migrations"
    migrations.mkdir()
    grouped: dict[str, list[Path]] = {}
    for migration in sorted((source / "migrations").glob("*.sql")):
        grouped.setdefault(migration.name.split("_", 1)[0], []).append(migration)
    for version, files in grouped.items():
        # Legacy migrations share a timestamp. Supabase's migration ledger has
        # a unique version key, so concatenate those files in filename order
        # in this disposable copy only; never rename deployed migrations.
        (migrations / f"{version}_ci.sql").write_text(
            "\n".join(f"-- Source: {file.name}\n{file.read_text()}\n" for file in files)
        )
    # PostgreSQL cannot use a newly added enum label until its transaction
    # commits. A legacy migration both adds and uses super_admin. Supabase CLI
    # applies each file transactionally, so commit the same idempotent addition
    # immediately before that original file in this disposable copy only.
    # Keep every original migration byte-for-byte intact and its ledger version.
    prerequisite = "20260827051515"
    if prerequisite in grouped:
        raise ValueError("CI enum prerequisite timestamp collides with a repository migration")
    (migrations / f"{prerequisite}_ci_enum_prerequisite.sql").write_text(
        "-- Disposable CI only: commit enum label before legacy migration uses it.\n"
        "ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';\n"
    )


if __name__ == "__main__":
    prepare(Path(sys.argv[1]))
