import logging
from typing import Any, Dict, Optional, Tuple
from google import genai
from backend.app.core.config import settings

logger = logging.getLogger("velora.prompt_service")


class PromptService:
    def __init__(self):
        self._api_key = settings.GEMINI_API_KEY
        self.client = None
        if self._api_key:
            self.client = genai.Client(
                api_key=self._api_key,
                http_options={"headers": {"User-Agent": "aistudio-build"}}
            )

    async def prepare_prompt(
        self,
        raw_prompt: str,
        generation_type: str,
        settings_dict: Dict[str, Any],
        enhance: bool = False,
    ) -> Tuple[str, Optional[str]]:
        """Returns (prepared_prompt, enhanced_prompt). Never over-expands simple prompts."""
        if not enhance or not self.client:
            return raw_prompt, None

        try:
            sys_inst = (
                "You are an expert cinematic director and prompt engineer. "
                "Enhance the user's prompt by adding vivid lighting, composition, texture, and camera details. "
                "Preserve the core subject, intent, and action strictly. Keep it under 60 words. Output ONLY the enhanced prompt."
            )
            response = self.client.models.generate_content(
                model="gemini-3.8-flash",
                contents=f"Enhance this creative prompt for {generation_type}: {raw_prompt}",
                config={"system_instruction": sys_inst}
            )
            enhanced = response.text.strip() if response.text else raw_prompt
            return raw_prompt, enhanced
        except Exception as e:
            logger.warning(f"Prompt enhancement fallback: {e}")
            return raw_prompt, None


prompt_service = PromptService()
