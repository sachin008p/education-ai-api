"""OpenAI client operations."""

import asyncio

from openai import AsyncOpenAI, OpenAI


def _response_text(response):
    """Extract text from a Responses API result."""
    text = getattr(response, "output_text", None)
    if text:
        return text
    return "".join(
        content.text
        for item in getattr(response, "output", [])
        for content in getattr(item, "content", [])
        if getattr(content, "type", None) == "output_text"
    )


def ask_openai(prompt, api_key, model):
    """Send one prompt through the synchronous OpenAI client."""
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    client = OpenAI(api_key=api_key)
    response = client.responses.create(model=model, input=prompt)
    return _response_text(response)


async def ask_openai_async(prompt, api_key, model, client=None):
    """Send one prompt through the asynchronous OpenAI client."""
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    owns_client = client is None
    client = client or AsyncOpenAI(api_key=api_key)
    try:
        response = await client.responses.create(model=model, input=prompt)
        return _response_text(response)
    finally:
        if owns_client:
            await client.close()


async def ask_openai_bulk(prompts, api_key, model):
    """Run OpenAI requests concurrently; gather preserves prompt order."""
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    client = AsyncOpenAI(api_key=api_key)
    try:
        tasks = [
            ask_openai_async(prompt, api_key, model, client=client)
            for prompt in prompts
        ]
        return await asyncio.gather(*tasks)
    finally:
        await client.close()
