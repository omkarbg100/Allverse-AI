"""
Helpers for turning LLM output into JSON.

Small local models often wrap JSON in markdown fences, add prose, emit literal
newlines inside strings, or truncate a response. These helpers extract the JSON
object, apply safe repairs, and retry once with a corrective prompt.
"""

import json
import logging
import re

logger = logging.getLogger(__name__)

_FENCE_RE = re.compile(r"^```[a-zA-Z0-9_-]*\s*|\s*```$", re.MULTILINE)


def _strip_fences(text: str) -> str:
    return _FENCE_RE.sub("", text.strip()).strip()


def _extract_object(text: str) -> str:
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        return text[start : end + 1]
    return text


def _repair(text: str) -> str:
    text = (
        text.replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2018", "'")
        .replace("\u2019", "'")
    )
    return re.sub(r",\s*([}\]])", r"\1", text)


def parse_json_response(raw) -> dict:
    """Parse an LLM response into a JSON object, raising ValueError if impossible."""
    if not isinstance(raw, str):
        raw = str(raw)

    text = _strip_fences(raw)
    if not text:
        raise ValueError("The model returned an empty response.")

    candidates = []
    for candidate in (
        text,
        _extract_object(text),
        _repair(text),
        _repair(_extract_object(text)),
    ):
        if candidate and candidate not in candidates:
            candidates.append(candidate)

    last_error = None
    for candidate in candidates:
        for strict in (True, False):
            try:
                data = json.loads(candidate, strict=strict)
            except (json.JSONDecodeError, TypeError) as exc:
                last_error = exc
                continue

            if isinstance(data, dict):
                return data
            if isinstance(data, list) and data and isinstance(data[0], dict):
                return data[0]

    raise ValueError(f"Could not parse JSON from model response: {last_error}")


async def invoke_json(llm, prompt: str, schema_hint: str) -> dict:
    """Invoke the model and parse its JSON response, retrying once if malformed."""
    response = await llm.ainvoke(prompt)

    try:
        return parse_json_response(response.content)
    except ValueError as first_error:
        logger.warning("Invalid JSON from model, retrying once: %s", first_error)

        repair_prompt = f"""Your previous response was not valid JSON.

Return ONLY a corrected JSON object with this structure:

{schema_hint}

Rules:
- Return one complete JSON object.
- Escape quotes and newlines inside strings.
- Do not use markdown fences or add explanations.

Previous response:

{str(response.content)[:8000]}
"""
        repaired = await llm.ainvoke(repair_prompt)
        return parse_json_response(repaired.content)
