#!/usr/bin/env python3
"""Render an ECS task definition template.

Placeholders:
  __NAME__      -> JSON quoted value of environment variable NAME
  __RAW_NAME__  -> raw (unquoted) value of environment variable NAME

Templates must therefore use unquoted placeholders, for example:

    "image": __IMAGE_REDIS__

Run:
    python3 deploy/aws/render.py deploy/aws/taskdefs/redis.json
"""

from __future__ import annotations

import json
import os
import re
import sys

RAW_TOKEN = re.compile(r"__RAW_([A-Z0-9_]+)__")
PLAIN_TOKEN = re.compile(r"__([A-Z0-9_]+)__")


def _missing(name: str, raw: bool) -> None:
    kind = "raw" if raw else "quoted"
    sys.exit(f"render.py: missing {kind} environment variable: {name}")


def render(text: str) -> dict:
    def raw_replace(match: re.Match[str]) -> str:
        name = match.group(1)
        if name not in os.environ:
            _missing(name, True)
        return os.environ[name]

    text = RAW_TOKEN.sub(raw_replace, text)

    def plain_replace(match: re.Match[str]) -> str:
        name = match.group(1)
        if name not in os.environ:
            _missing(name, False)
        return json.dumps(os.environ[name])

    text = PLAIN_TOKEN.sub(plain_replace, text)

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        sys.exit(f"render.py: rendered template is not valid JSON: {exc}")


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("usage: render.py <template.json>")
    with open(sys.argv[1], encoding="utf-8") as handle:
        document = render(handle.read())
    json.dump(document, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
