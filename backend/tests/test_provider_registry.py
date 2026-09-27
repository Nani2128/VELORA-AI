from backend.app.providers.registry import provider_registry


def test_provider_registry_lookup():
    img_provider = provider_registry.get_image_provider("gemini-3.1-flash-image")
    assert img_provider is not None
    assert img_provider.name == "google_gemini_image"

    video_provider = provider_registry.get_video_provider("veo-3.1-lite-generate-preview")
    assert video_provider is not None
    assert video_provider.name == "google_veo_video"


def test_provider_registry_default_fallback():
    img_provider = provider_registry.get_image_provider("unknown-model")
    assert img_provider is not None
    assert img_provider.model_name == "gemini-3.1-flash-image"
