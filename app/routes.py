"""HTTP routes for the Education AI API."""

import asyncio
from datetime import datetime, timezone
import logging

from bson import ObjectId
from bson.errors import InvalidId
from flask import Blueprint, current_app, jsonify, request
from openai import OpenAIError
from pymongo.errors import PyMongoError

from .database import get_collection, get_database
from .services.openai_service import ask_openai, ask_openai_bulk
from .services.prompt_service import get_prompt_template, render_prompt
from .utils.validators import validate_bulk_payload, validate_single_payload

api_bp = Blueprint("api", __name__)
logger = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _json_body():
    if not request.is_json:
        return None, (jsonify(error="Request must contain JSON"), 400)
    payload = request.get_json(silent=True)
    if payload is None:
        return None, (jsonify(error="Invalid JSON body"), 400)
    return payload, None


def _history_document(user_input, final_prompt, response, entry_type="single"):
    return {
        "userInput": user_input,
        "finalPrompt": final_prompt,
        "response": response,
        "type": entry_type,
        "createdAt": datetime.now(timezone.utc),
    }


def _serialize_doc(doc):
    """Convert a MongoDB document to a JSON-serialisable dict."""
    doc["_id"] = str(doc["_id"])
    if doc.get("createdAt"):
        doc["createdAt"] = doc["createdAt"].isoformat()
    doc.pop("finalPrompt", None)
    return doc


# ── Health ────────────────────────────────────────────────────────────────────

@api_bp.get("/health")
def health():
    """Return API + MongoDB liveness status."""
    try:
        get_database()          # runs admin ping internally
        return jsonify(
            status="ok",
            model=current_app.config["OPENAI_MODEL"],
            timestamp=datetime.now(timezone.utc).isoformat(),
        ), 200
    except PyMongoError:
        return jsonify(status="error", detail="MongoDB unreachable"), 503


# ── Stats ─────────────────────────────────────────────────────────────────────

@api_bp.get("/stats")
def stats():
    """Return aggregate counts from the history collection."""
    try:
        col = get_collection("history")
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        total         = col.count_documents({})
        today_count   = col.count_documents({"createdAt": {"$gte": today_start}})
        single_count  = col.count_documents({"type": "single"})
        bulk_count    = col.count_documents({"type": "bulk"})
        return jsonify(
            total=total,
            today=today_count,
            single=single_count,
            bulk=bulk_count,
            model=current_app.config["OPENAI_MODEL"],
        ), 200
    except PyMongoError:
        logger.exception("Stats query failed")
        return jsonify(error="MongoDB service failure"), 503


# ── History ───────────────────────────────────────────────────────────────────

@api_bp.get("/history")
def get_history():
    """Return paginated history with optional search and type filter."""
    try:
        page   = max(1, int(request.args.get("page", 1)))
        limit  = min(50, max(1, int(request.args.get("limit", 20))))
        search = request.args.get("search", "").strip()
        type_f = request.args.get("type", "").strip()
    except (ValueError, TypeError):
        return jsonify(error="Invalid query parameters"), 400

    query = {}
    if search:
        query["userInput"] = {"$regex": search, "$options": "i"}
    if type_f in ("single", "bulk"):
        query["type"] = type_f

    try:
        col   = get_collection("history")
        total = col.count_documents(query)
        docs  = list(
            col.find(query)
               .sort("createdAt", -1)
               .skip((page - 1) * limit)
               .limit(limit)
        )
        return jsonify(
            history=[_serialize_doc(d) for d in docs],
            total=total,
            page=page,
            limit=limit,
            pages=max(1, -(-total // limit)),   # ceiling division
        ), 200
    except PyMongoError:
        logger.exception("History query failed")
        return jsonify(error="MongoDB service failure"), 503


@api_bp.delete("/history/<doc_id>")
def delete_history(doc_id):
    """Delete a single history document by ObjectId."""
    try:
        oid = ObjectId(doc_id)
    except (InvalidId, Exception):
        return jsonify(error="Invalid id format"), 400
    try:
        result = get_collection("history").delete_one({"_id": oid})
        if result.deleted_count == 0:
            return jsonify(error="Record not found"), 404
        return jsonify(deleted=True), 200
    except PyMongoError:
        logger.exception("Delete history failed")
        return jsonify(error="MongoDB service failure"), 503


# ── Prompt ────────────────────────────────────────────────────────────────────

@api_bp.get("/prompt")
def get_prompt():
    """Return the current prompt template."""
    try:
        template = get_prompt_template()
        if template is None:
            return jsonify(error="Prompt template not found"), 404
        return jsonify(template=template), 200
    except PyMongoError:
        return jsonify(error="MongoDB service failure"), 503


@api_bp.put("/prompt")
def update_prompt():
    """Replace the prompt template (must contain {{userInput}})."""
    payload, error = _json_body()
    if error:
        return error
    template = payload.get("template", "").strip()
    if not template:
        return jsonify(error="template is required"), 400
    if "{{userInput}}" not in template:
        return jsonify(error="template must contain the {{userInput}} placeholder"), 400
    try:
        get_collection("prompts").update_one(
            {"_id": "Education_Prompt"},
            {"$set": {"template": template}},
            upsert=True,
        )
        return jsonify(updated=True), 200
    except PyMongoError:
        logger.exception("Prompt update failed")
        return jsonify(error="MongoDB service failure"), 503


# ── Ask (single) ──────────────────────────────────────────────────────────────

@api_bp.post("/ask")
def ask():
    payload, error = _json_body()
    if error:
        return error
    validation_error = validate_single_payload(payload)
    if validation_error:
        return jsonify(error=validation_error), 400

    try:
        template = get_prompt_template()
        if template is None:
            return jsonify(error="Prompt template not found"), 404
        user_input   = payload["userInput"]
        final_prompt = render_prompt(template, user_input)
        response     = ask_openai(
            final_prompt, current_app.config["OPENAI_API_KEY"], current_app.config["OPENAI_MODEL"]
        )
        get_collection("history").insert_one(
            _history_document(user_input, final_prompt, response, entry_type="single")
        )
        return jsonify(response=response), 200
    except RuntimeError as exc:
        return jsonify(error=str(exc)), 503
    except OpenAIError:
        logger.exception("OpenAI request failed")
        return jsonify(error="OpenAI service failure"), 502
    except PyMongoError:
        logger.exception("MongoDB request failed")
        return jsonify(error="MongoDB service failure"), 503
    except Exception:
        logger.exception("Unexpected error processing /api/ask")
        return jsonify(error="Internal server error"), 500


# ── Ask Bulk ──────────────────────────────────────────────────────────────────

@api_bp.post("/ask-bulk")
def ask_bulk():
    payload, error = _json_body()
    if error:
        return error
    validation_error = validate_bulk_payload(payload)
    if validation_error:
        return jsonify(error=validation_error), 400

    try:
        template = get_prompt_template()
        if template is None:
            return jsonify(error="Prompt template not found"), 404
        user_inputs   = payload["userInputs"]
        final_prompts = [render_prompt(template, v) for v in user_inputs]
        responses     = asyncio.run(
            ask_openai_bulk(
                final_prompts,
                current_app.config["OPENAI_API_KEY"],
                current_app.config["OPENAI_MODEL"],
            )
        )
        documents = [
            _history_document(ui, fp, r, entry_type="bulk")
            for ui, fp, r in zip(user_inputs, final_prompts, responses)
        ]
        get_collection("history").insert_many(documents)
        return jsonify(responses=responses), 200
    except RuntimeError as exc:
        return jsonify(error=str(exc)), 503
    except OpenAIError:
        logger.exception("Bulk OpenAI request failed")
        return jsonify(error="OpenAI service failure"), 502
    except PyMongoError:
        logger.exception("MongoDB request failed")
        return jsonify(error="MongoDB service failure"), 503
    except Exception:
        logger.exception("Unexpected error processing /api/ask-bulk")
        return jsonify(error="Internal server error"), 500
