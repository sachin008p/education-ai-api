"""Application factory for the Education AI API."""

import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from .config import Config
from .routes import api_bp


def create_app(config_class=Config):
    """Create and configure a Flask application."""
    frontend_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "frontend")
    )
    app = Flask(__name__, static_folder=frontend_dir, static_url_path="")
    app.config.from_object(config_class)

    CORS(app)
    app.register_blueprint(api_bp, url_prefix="/api")

    @app.route("/")
    def index():
        """Serve the frontend single-page application."""
        return send_from_directory(frontend_dir, "index.html")

    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        """Return consistent JSON for Flask/Werkzeug HTTP errors."""
        return jsonify(error=error.description), error.code

    return app

