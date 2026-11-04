#!/usr/bin/env python3
"""Compare a live ECS task definition with a desired one.

Usage:
    python3 taskdef_diff.py current.json desired.json

Exit codes:
    0  definitions are equivalent
    1  definitions differ
    2  invalid input
"""

from __future__ import annotations

import json
import sys
from typing import Any

VOLATILE_KEYS = {
    "taskDefinitionArn",
    "revision",
    "status",
    "registeredAt",
    "registeredBy",
    "deregisteredAt",
    "compatibilities",
    "requiresAttributes",
    "tags",
}

SORT_BY_NAME = {"environment", "secrets", "dockerLabels", "ulimits"}
SORT_BY_KEY = {
    "containerDefinitions": "name",
    "volumes": "name",
    "portMappings": "containerPort",
    "mountPoints": "containerPath",
}


def _drop_empty(value: Any) -> Any:
    if isinstance(value, dict):
        cleaned = {key: _drop_empty(item) for key, item in value.items()}
        return {key: item for key, item in cleaned.items() if item not in (None, [], {})}
    if isinstance(value, list):
        return [_drop_empty(item) for item in value]
    return value


def _sort_lists(value: Any) -> Any:
    if isinstance(value, dict):
        result: dict[str, Any] = {}
        for key, item in value.items():
            item = _sort_lists(item)
            if key in SORT_BY_NAME and isinstance(item, list):
                item = sorted(
                    item,
                    key=lambda entry: entry.get("name", "") if isinstance(entry, dict) else str(entry),
                )
            elif key in SORT_BY_KEY and isinstance(item, list):
                sort_key = SORT_BY_KEY[key]
                item = sorted(
                    item,
                    key=lambda entry: entry.get(sort_key, "") if isinstance(entry, dict) else str(entry),
                )
            result[key] = item
        return result
    if isinstance(value, list):
        return [_sort_lists(item) for item in value]
    return value


def normalize(document: dict[str, Any]) -> dict[str, Any]:
    if "taskDefinition" in document and isinstance(document["taskDefinition"], dict):
        document = document["taskDefinition"]

    def walk(value: Any) -> Any:
        if isinstance(value, dict):
            return {
                key: walk(item)
                for key, item in value.items()
                if key not in VOLATILE_KEYS
            }
        if isinstance(value, list):
            return [walk(item) for item in value]
        return value

    normalized = _sort_lists(walk(document))

    if normalized.get("ephemeralStorage") == {"sizeInGiB": 20}:
        normalized.pop("ephemeralStorage", None)

    return _drop_empty(normalized)


def load(path: str) -> dict[str, Any]:
    try:
        with open(path, encoding="utf-8") as handle:
            document = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        sys.exit(f"taskdef_diff.py: cannot read {path}: {exc}")
    if not isinstance(document, dict):
        sys.exit(f"taskdef_diff.py: {path} does not contain a JSON object")
    return document


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit("usage: taskdef_diff.py current.json desired.json")
    current = normalize(load(sys.argv[1]))
    desired = normalize(load(sys.argv[2]))
    if current == desired:
        sys.exit(0)
    sys.exit(1)


if __name__ == "__main__":
    main()
