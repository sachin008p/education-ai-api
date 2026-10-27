# Education AI API

A ready-to-run Flask REST API using MongoDB, PyMongo, and the official asynchronous OpenAI client for concurrent bulk requests.

## Requirements

- Python 3.11+
- MongoDB running locally or a reachable MongoDB URI
- An OpenAI API key

## Installation (Windows)

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Install MongoDB Community Edition and start the MongoDB service. The default URI is `mongodb://localhost:27017/`.

Copy `.env.example` to `.env`, then set `OPENAI_API_KEY` to your key. Never commit `.env`.

Seed the prompt template and start the API:

```powershell
python seed.py
python run.py
```

The server runs at `http://127.0.0.1:5000`. You can open this address directly in your browser to access the full interactive Web UI dashboard.

## API

### POST /api/ask

Headers: `Content-Type: application/json`

Request:

```json
{"userInput":"How much should I score in each subject to pass CA final?"}
```

Success (`200`):

```json
{"response":"AI response here"}
```

### POST /api/ask-bulk

Request:

```json
{"userInputs":["How can I improve my Java skills?","Explain SQL joins","What is REST API?"]}
```

Success (`200`):

```json
{"responses":["Answer for Java...","Answer for SQL...","Answer for REST API..."]}
```

The bulk service creates one prompt per input and passes concurrent coroutines to `asyncio.gather`. `gather` returns values in task-list order, so the response order always matches the input order even when network requests finish out of order. Each completed pair is stored in `education_ai.history`.

## Postman

1. Start `python run.py`.
2. Create a `POST` request to `http://127.0.0.1:5000/api/ask`.
3. Choose Body → raw → JSON and send the single-input request above.
4. Create a second `POST` request to `http://127.0.0.1:5000/api/ask-bulk` and send the bulk request above.
5. Confirm the response is JSON and that its order matches the request.

Example errors:

```json
{"error":"userInput is required"}
```

```json
{"error":"userInputs must not be empty"}
```

Malformed or non-JSON requests return `400`. A missing prompt returns `404`; MongoDB failures return `503`; OpenAI failures return `502`; an unconfigured key returns `503`.

## MongoDB data

The database is `education_ai`, with collections `prompts` and `history`. `seed.py` inserts `Education_Prompt` only when it does not already exist, so the prompt remains dynamically editable in MongoDB.
