"""Environment-backed application configuration."""

import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    """Runtime settings loaded from environment variables."""

    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "education_ai")
    PROMPT_ID = "Education_Prompt"
