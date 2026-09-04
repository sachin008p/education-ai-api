"""Request validation helpers."""


def validate_single_payload(payload):
    if not isinstance(payload, dict):
        return "Request body must be a JSON object"
    value = payload.get("userInput")
    if value is None:
        return "userInput is required"
    if not isinstance(value, str):
        return "userInput must be a string"
    if not value.strip():
        return "userInput must not be empty"
    return None


def validate_bulk_payload(payload):
    if not isinstance(payload, dict):
        return "Request body must be a JSON object"
    values = payload.get("userInputs")
    if values is None:
        return "userInputs is required"
    if not isinstance(values, list):
        return "userInputs must be an array"
    if not values:
        return "userInputs must not be empty"
    if any(not isinstance(value, str) for value in values):
        return "Every userInputs item must be a string"
    if any(not value.strip() for value in values):
        return "Every userInputs item must not be empty"
    return None
