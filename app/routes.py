"""HTTP routes for the Education AI API."""

import asyncio
from datetime import datetime, timezone
import logging

from flask import Blueprint, current_app, jsonify, request
from openai import OpenAIError
from pymongo.errors import PyMongoError

from .database import get_collection
from .services.openai_service import ask_openai, ask_openai_bulk
from .services.prompt_service import get_prompt_template, render_prompt
from .utils.validators import validate_bulk_payload, validate_single_payload

api_bp = Blueprint("api", __name__)
logger = logging.getLogger(__name__)


def _json_body():
    if not request.is_json:
        return None, (jsonify(error="Request must contain JSON"), 400)
    payload = request.get_json(silent=True)
    if payload is None:
        return None, (jsonify(error="Invalid JSON body"), 400)
    return payload, None


def _history_document(user_input, final_prompt, response):
    return {
        "userInput": user_input,
        "finalPrompt": final_prompt,
        "response": response,
        "createdAt": datetime.now(timezone.utc),
    }


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
        user_input = payload["userInput"]
        final_prompt = render_prompt(template, user_input)
        response = ask_openai(
            final_prompt, current_app.config["OPENAI_API_KEY"], current_app.config["OPENAI_MODEL"]
        )
        get_collection("history").insert_one(
            _history_document(user_input, final_prompt, response)
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
        user_inputs = payload["userInputs"]
        final_prompts = [render_prompt(template, value) for value in user_inputs]
        responses = asyncio.run(
            ask_openai_bulk(
                final_prompts,
                current_app.config["OPENAI_API_KEY"],
                current_app.config["OPENAI_MODEL"],
            )
        )
        documents = [
            _history_document(user_input, final_prompt, response)
            for user_input, final_prompt, response in zip(user_inputs, final_prompts, responses)
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
