import pytest
from pydantic import ValidationError
from backend.app.schemas.generation import GenerationCreateRequest, GenerationSettingsSchema


def test_generation_schema_valid():
    req = GenerationCreateRequest(
        type="TEXT_TO_IMAGE",
        prompt="A cinematic futuristic city",
        settings=GenerationSettingsSchema(aspect_ratio="16:9")
    )
    assert req.prompt == "A cinematic futuristic city"
    assert req.settings.aspect_ratio == "16:9"


def test_generation_schema_invalid_empty_prompt():
    with pytest.raises(ValidationError):
        GenerationCreateRequest(
            type="TEXT_TO_IMAGE",
            prompt="",
        )
