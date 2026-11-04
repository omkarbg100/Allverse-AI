#!/usr/bin/env python3
"""Patch ECS application task definitions and roll out the five app services.

The script:
  1. Renders deploy/aws/app-env.json.
  2. Reads each service's current task definition from ECS.
  3. Merges the production service-discovery environment and secrets.
  4. Registers a new revision only when something changed.
  5. Updates the ECS service and forces a new deployment (so a refreshed
     :latest application image is picked up, matching the previous workflow).

Environment:
  AWS_REGION, ECS_CLUSTER
  AUTH_ECS_SERVICE, CHAT_ECS_SERVICE, BILLING_ECS_SERVICE,
  GATEWAY_ECS_SERVICE, AGENT_ECS_SERVICE
  OLLAMA_MODEL, AGENT_S3_BUCKET, AGENT_TASK_ROLE_ARN
  SECRET_LITELLM_MASTER_KEY, SECRET_GROQ_API_KEY, SECRET_TAVILY_API_KEY
  DRY_RUN=true|false (default false)
  WAIT_FOR_STABLE=true|false (default true)
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from taskdef_diff import normalize  # noqa: E402

REGISTER_STRIP_KEYS = {
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


def env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if value is None:
        sys.exit(f"deploy_app_services.py: missing environment variable {name}")
    return value


def run(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        check=check,
        text=True,
        encoding="utf-8",
        capture_output=True,
    )


def render_config() -> dict:
    namespace = os.environ.get("CLOUDMAP_NAMESPACE", "allverse.local")
    defaults = {
        "MONGODB_URI": f"mongodb://mongodb.{namespace}:27017/allverse_ai",
        "REDIS_URL": f"redis://redis.{namespace}:6379",
        "QDRANT_URL": f"http://qdrant.{namespace}:6333",
        "LITELLM_URL": f"http://litellm.{namespace}:4000",
        "OLLAMA_HOST": f"http://ollama.{namespace}:11434",
        "OLLAMA_MODEL": "llama3.2:3b",
        "AGENT_S3_BUCKET": "",
        "AGENT_TASK_ROLE_ARN": "",
    }
    for key, value in defaults.items():
        os.environ.setdefault(key, value)

    result = run(
        [sys.executable, str(SCRIPT_DIR / "render.py"), str(SCRIPT_DIR / "app-env.json")]
    )
    return json.loads(result.stdout)


def describe_task_definition(task_definition: str) -> dict:
    result = run(
        [
            "aws",
            "ecs",
            "describe-task-definition",
            "--task-definition",
            task_definition,
            "--query",
            "taskDefinition",
            "--output",
            "json",
            "--region",
            env("AWS_REGION"),
        ]
    )
    return json.loads(result.stdout)


def service_task_definition(cluster: str, service: str) -> str | None:
    result = run(
        [
            "aws",
            "ecs",
            "describe-services",
            "--cluster",
            cluster,
            "--services",
            service,
            "--query",
            "services[0].taskDefinition",
            "--output",
            "text",
            "--region",
            env("AWS_REGION"),
        ],
        check=False,
    )
    if result.returncode != 0:
        return None
    value = result.stdout.strip()
    if not value or value == "None":
        return None
    return value


def strip_for_register(document: dict) -> dict:
    return {
        key: value
        for key, value in document.items()
        if key not in REGISTER_STRIP_KEYS
    }


def register_task_definition(document: dict) -> str:
    payload = strip_for_register(document)
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False, encoding="utf-8"
    ) as handle:
        json.dump(payload, handle, indent=2)
        path = handle.name
    try:
        result = run(
            [
                "aws",
                "ecs",
                "register-task-definition",
                "--cli-input-json",
                f"file://{path}",
                "--query",
                "taskDefinition.taskDefinitionArn",
                "--output",
                "text",
                "--region",
                env("AWS_REGION"),
            ]
        )
        return result.stdout.strip()
    finally:
        Path(path).unlink(missing_ok=True)


def merge_container(container: dict, config: dict) -> None:
    skip_if_empty = set(config.get("skipIfEmpty", []))
    remove_environment = set(config.get("removeEnvironment", []))

    desired_environment = {
        item["name"]: item.get("value", "")
        for item in container.get("environment", [])
    }
    for key in remove_environment:
        desired_environment.pop(key, None)
    for key, value in config.get("environment", {}).items():
        if value == "" and key in skip_if_empty:
            continue
        desired_environment[key] = value
    if desired_environment:
        container["environment"] = [
            {"name": key, "value": value}
            for key, value in sorted(desired_environment.items())
        ]

    desired_secrets = {
        item["name"]: item["valueFrom"] for item in container.get("secrets", [])
    }
    for key, value in config.get("secrets", {}).items():
        if not value:
            print(f"    skipping empty secret {key}", file=sys.stderr)
            continue
        desired_secrets[key] = value
    if desired_secrets:
        container["secrets"] = [
            {"name": key, "valueFrom": value}
            for key, value in sorted(desired_secrets.items())
        ]


def patch_task_definition(document: dict, config: dict) -> dict:
    containers = document.get("containerDefinitions", [])
    if not containers:
        raise RuntimeError("task definition has no containerDefinitions")

    container = next(
        (
            item
            for item in containers
            if item.get("name") == config.get("container")
        ),
        containers[0],
    )
    merge_container(container, config)

    task_role = config.get("taskRoleArn", "")
    if task_role:
        document["taskRoleArn"] = task_role

    return document


def main() -> None:
    region = env("AWS_REGION")
    cluster = env("ECS_CLUSTER")
    dry_run = env("DRY_RUN", "false").lower() == "true"
    wait_for_stable = env("WAIT_FOR_STABLE", "true").lower() == "true"

    config = render_config()
    updated: list[str] = []
    rolled_out: list[str] = []
    missing: list[str] = []

    for name, service_config in config["services"].items():
        service = service_config["service"]
        print(f"\n== {name}: {service}")

        if not service:
            print("  skipping: service name is empty", file=sys.stderr)
            missing.append(name)
            continue

        task_definition = service_task_definition(cluster, service)
        if not task_definition:
            print(f"  skipping: ECS service {service} not found", file=sys.stderr)
            missing.append(service)
            continue

        current = describe_task_definition(task_definition)
        desired = patch_task_definition(json.loads(json.dumps(current)), service_config)

        if normalize(current) == normalize(desired):
            print("  task definition unchanged")
            new_task_definition = task_definition
        else:
            changed_container = next(
                (
                    item
                    for item in desired.get("containerDefinitions", [])
                    if item.get("name") == service_config.get("container")
                ),
                desired.get("containerDefinitions", [None])[0],
            )
            environment = {
                item["name"]: item.get("value", "")
                for item in (changed_container or {}).get("environment", [])
            }
            print(
                "  registering revision with "
                f"{len(environment)} environment variables"
            )
            if dry_run:
                new_task_definition = task_definition
            else:
                new_task_definition = register_task_definition(desired)
                updated.append(service)

        if dry_run:
            print("  dry run: would update service and force a new deployment")
            continue

        run(
            [
                "aws",
                "ecs",
                "update-service",
                "--cluster",
                cluster,
                "--service",
                service,
                "--task-definition",
                new_task_definition,
                "--force-new-deployment",
                "--region",
                region,
            ]
        )
        rolled_out.append(service)
        print(f"  updated to {new_task_definition}")

    if rolled_out:
        print(f"\nRolled out: {', '.join(rolled_out)}")
        if wait_for_stable:
            print("Waiting for services to stabilize...")
            run(
                [
                    "aws",
                    "ecs",
                    "wait",
                    "services-stable",
                    "--cluster",
                    cluster,
                    "--services",
                    *rolled_out,
                    "--region",
                    region,
                ]
            )
            print("All application services are stable.")
    else:
        print("\nNo application services were updated.")

    if updated:
        print(f"Registered new revisions for: {', '.join(updated)}")

    if missing:
        sys.exit(
            "deploy_app_services.py: ECS services not found: "
            + ", ".join(missing)
        )


if __name__ == "__main__":
    main()
