"""Seed the default MongoDB prompt template."""

from app.database import get_collection
from app import create_app

PROMPT = {
    "_id": "Education_Prompt",
    "template": "You are an expert in education domain. Answer the following: {{userInput}}",
}


if __name__ == "__main__":
    with create_app().app_context():
        collection = get_collection("prompts")
        collection.update_one({"_id": PROMPT["_id"]}, {"$setOnInsert": PROMPT}, upsert=True)
        print("Education_Prompt is ready in the prompts collection.")
