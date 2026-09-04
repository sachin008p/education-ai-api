"""Application factory for the Education AI API."""

from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from .config import Config
from .routes import api_bp


def create_app(config_class=Config):
    """Create and configure a Flask application."""
    app = Flask(__name__)
    app.config.from_object(config_class)

    CORS(app)
    app.register_blueprint(api_bp, url_prefix="/api")

    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        """Return consistent JSON for Flask/Werkzeug HTTP errors."""
        return jsonify(error=error.description), error.code

    return app
