"""
ImagePromptAgent ▸ Gera prompts Ideogram-3.0 ONLY. Sem GPT.

Regras extraídas da doc oficial:
• Campos suportados: style, lighting, camera, color:<hex>, negative_prompt
• Qualidade: TURBO | DEFAULT | QUALITY (use QUALITY se não houver override)
• Resoluções válidas: 1024x1024, 2048x2048, 1024x1792, 1792x1024
"""

from dataclasses import dataclass
import re
from typing import Optional

BRAND_COLORS = ["#1A237E", "#45B3E7", "#863DFF"]

@dataclass
class ImagePromptAgent:
    default_style: str = "vivid, ultra-detail"
    default_quality: str = "QUALITY"
    default_resolution: str = "1024x1024"

    def sanitize(self, text: str) -> str:
        """Remove double spaces, trailing dots"""
        return re.sub(r"\s{2,}", " ", text.strip()).rstrip(".")

    def inject_brand_colors(self, desc: str) -> str:
        """Inject brand colors if 'brand' is mentioned"""
        if "brand" in desc.lower():
            palette = " ".join([f"color:{c}" for c in BRAND_COLORS])
            return f"{desc}. {palette}"
        return desc

    def build_prompt(self, raw_desc: str, res: Optional[str] = None) -> dict:
        """Build complete prompt dict for Ideogram API"""
        res = res or self.default_resolution
        desc = self.sanitize(raw_desc)
        desc = self.inject_brand_colors(desc)
        
        # Add default style if not present
        if "vivid" not in desc.lower() and "ultra" not in desc.lower():
            desc = f"{desc}. {self.default_style}"
            
        return {
            "prompt": desc,
            "resolution": res,
            "rendering_speed": self.default_quality
        }


if __name__ == "__main__":
    # Test the agent
    agent = ImagePromptAgent()
    test_cases = [
        "brand neon phoenix logo",
        "mystical forest with glowing mushrooms",
        "futuristic cityscape at sunset"
    ]
    
    for test in test_cases:
        result = agent.build_prompt(test)
        print(f"\nInput: {test}")
        print(f"Output: {result}")