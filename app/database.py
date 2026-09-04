"""MongoDB connection and collection helpers."""

import logging

from flask import current_app
from pymongo import MongoClient

logger = logging.getLogger(__name__)
_client = None


def get_client():
    """Return a lazily-created MongoClient for the current application."""
    global _client
    if _client is None:
        _client = MongoClient(current_app.config["MONGO_URI"], serverSelectionTimeoutMS=5000)
    return _client


def get_database():
    """Return the configured database after checking MongoDB connectivity."""
    client = get_client()
    client.admin.command("ping")
    return client[current_app.config["MONGO_DB_NAME"]]


def get_collection(name):
    """Return a collection from the configured database."""
    return get_database()[name]
