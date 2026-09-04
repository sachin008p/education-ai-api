"""Prompt template persistence and rendering."""

from app.database import get_collection


def get_prompt_template():
    """Fetch the configured prompt template from MongoDB."""
    document = get_collection("prompts").find_one({"_id": "Education_Prompt"})
    if not document or not isinstance(document.get("template"), str):
        return None
    return document["template"]


def render_prompt(template, user_input):
    """Replace the supported prompt placeholder with user input."""
    return template.replace("{{userInput}}", user_input)
