#!/usr/bin/env python3
"""
LandingPageBuilder: Create and deploy conversion-focused landing pages
"""
import logging
import os
from pathlib import Path
from typing import Dict, Optional

logger = logging.getLogger('LandingPageBuilder')


class LandingPageBuilder:
    """Generates and deploys landing pages"""

    def __init__(self, config):
        self.config = config
        self.api_key = os.getenv('HOSTING_API_KEY', '')

    def get_hero_image(self) -> Optional[str]:
        """Get hero image for landing page"""
        images_dir = Path(f"assets/images/{self.config.book_slug}")
        if not images_dir.exists():
            images_dir = Path("assets/images")

        # Look for specific hero image or use first available
        for pattern in ["*hero*", "*cover*", "*"]:
            for img in images_dir.glob(f"{pattern}.png"):
                return str(img)
        return None

    def generate_css(self) -> str:
        """Generate responsive CSS with optional brand colors"""
        primary_color = self.config.primary_palette[0] if self.config.primary_palette else "#1a1a1a"
        secondary_color = self.config.primary_palette[1] if len(self.config.primary_palette) > 1 else "#007bff"

        return f"""
        :root {{
            --primary: {primary_color};
            --secondary: {secondary_color};
            --text: #333;
            --bg: #fff;
            --bg-alt: #f8f9fa;
        }}
        
        [data-theme="dark"] {{
            --text: #f0f0f0;
            --bg: #1a1a1a;
            --bg-alt: #2a2a2a;
        }}
        
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        
        body {{
            font-family: Inter, system-ui, sans-serif;
            line-height: 1.6;
            color: var(--text);
            background: var(--bg);
        }}
        
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        }}
        
        .hero {{
            min-height: 90vh;
            display: grid;
            place-items: center;
            text-align: center;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            color: white;
        }}
        
        .hero h1 {{
            font-size: clamp(2rem, 5vw, 4rem);
            margin-bottom: 1rem;
        }}
        
        .cta {{
            display: inline-block;
            padding: 1rem 2rem;
            background: white;
            color: var(--primary);
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            transition: transform 0.2s;
        }}
        
        .cta:hover {{ transform: translateY(-2px); }}
        
        .benefits {{
            padding: 4rem 0;
            background: var(--bg-alt);
        }}
        
        .grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-top: 2rem;
        }}
        
        .card {{
            background: var(--bg);
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        
        .theme-toggle {{
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--bg-alt);
            border: 2px solid var(--primary);
            padding: 0.5rem 1rem;
            border-radius: 5px;
            cursor: pointer;
        }}
        
        @media (max-width: 768px) {{
            .hero h1 {{ font-size: 2rem; }}
            .grid {{ grid-template-columns: 1fr; }}
        }}
        """

    def create_page(self) -> Dict:
        """Create landing page structure"""
        hero_image = self.get_hero_image()

        page_data = {
            "title": f"{self.config.book_title} - by {self.config.author_name}",
            "slug": self.config.book_slug,
            "sections": [
                {
                    "type": "hero",
                    "content": {
                        "headline": self.config.book_title,
                        "subheadline": f"A transformative journey by {self.config.author_name}",
                        "cta_text": "Get Your Copy Now",
                        "cta_link": "#purchase",
                        "background_image": hero_image
                    }
                },
                {
                    "type": "benefits",
                    "content": {
                        "headline": "What You'll Discover",
                        "items": [
                            {
                                "title": "Transform Your Perspective",
                                "description": "Gain new insights that will change how you see the world"
                            },
                            {
                                "title": "Practical Wisdom",
                                "description": "Apply timeless principles to modern challenges"
                            },
                            {
                                "title": "Engaging Narrative",
                                "description": "Experience a story that captivates from first page to last"
                            }
                        ]
                    }
                },
                {
                    "type": "author",
                    "content": {
                        "headline": f"About {self.config.author_name}",
                        "bio": f"{self.config.author_name} is a visionary author dedicated to sharing transformative ideas through compelling narratives.",
                        "image": hero_image
                    }
                },
                {
                    "type": "cta",
                    "content": {
                        "headline": "Ready to Begin Your Journey?",
                        "primary_button": "Download EPUB",
                        "primary_link": f"/dist/{self.config.book_slug}.epub",
                        "secondary_button": "Get PDF Version",
                        "secondary_link": f"/dist/{self.config.book_slug}.pdf"
                    }
                }
            ],
            "styles": self.generate_css(),
            "scripts": """
            document.addEventListener('DOMContentLoaded', () => {
                const toggle = document.querySelector('.theme-toggle');
                const html = document.documentElement;
                
                toggle?.addEventListener('click', () => {
                    const currentTheme = html.getAttribute('data-theme');
                    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                    html.setAttribute('data-theme', newTheme);
                    localStorage.setItem('theme', newTheme);
                });
                
                // Load saved theme
                const savedTheme = localStorage.getItem('theme') || 'light';
                html.setAttribute('data-theme', savedTheme);
            });
            """
        }

        return page_data

    def generate_html(self, page_data: Dict) -> str:
        """Generate static HTML from page data"""
        sections_html = ""

        for section in page_data['sections']:
            if section['type'] == 'hero':
                content = section['content']
                sections_html += f"""
                <section class="hero">
                    <div class="container">
                        <h1>{content['headline']}</h1>
                        <p>{content['subheadline']}</p>
                        <a href="{content['cta_link']}" class="cta">{content['cta_text']}</a>
                    </div>
                </section>
                """
            elif section['type'] == 'benefits':
                content = section['content']
                items_html = ""
                for item in content['items']:
                    items_html += f"""
                    <div class="card">
                        <h3>{item['title']}</h3>
                        <p>{item['description']}</p>
                    </div>
                    """
                sections_html += f"""
                <section class="benefits">
                    <div class="container">
                        <h2>{content['headline']}</h2>
                        <div class="grid">{items_html}</div>
                    </div>
                </section>
                """

        return f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>{page_data['title']}</title>
            <style>{page_data['styles']}</style>
        </head>
        <body>
            <button class="theme-toggle">🌓</button>
            {sections_html}
            <script>{page_data['scripts']}</script>
        </body>
        </html>
        """

    def deploy(self, page_data: Dict) -> Optional[str]:
        """Deploy landing page to target domain"""
        if not self.config.target_domain:
            logger.warning("No target domain specified, skipping deployment")
            return None

        try:
            # Generate static HTML
            html_content = self.generate_html(page_data)

            # Save locally for reference
            output_path = Path(f"dist/{self.config.book_slug}-landing.html")
            output_path.write_text(html_content)
            logger.info(f"Landing page saved to: {output_path}")

            # If API key is available, deploy via API
            if self.api_key:
                # This would be the actual deployment API call
                # For now, we'll simulate it
                url = f"https://{self.config.target_domain}/{self.config.book_slug}"
                logger.info(f"Would deploy to: {url}")
                return url
            else:
                # Return local file URL
                return f"file://{output_path.absolute()}"

        except Exception as e:
            logger.error(f"Deployment failed: {e}")
            return None
