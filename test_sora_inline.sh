#!/bin/bash

echo "🧪 Testing Sora (gpt-image-1) with current environment..."
echo "=" 
echo ""

# Check if API key is set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ ERROR: OPENAI_API_KEY not set!"
    echo "Run: export OPENAI_API_KEY='sk-...your-key...'"
    exit 1
fi

echo "✅ OPENAI_API_KEY is set"
echo "✅ IMAGE_PROVIDER = ${IMAGE_PROVIDER:-not set (will use ideogram)}"
echo ""
echo "Running inline Python test..."
echo "-" 
echo ""

python3 - <<'PYTHON_SCRIPT'
from openai import OpenAI, APIError
import os, json, sys

# Show which provider is active
provider = os.getenv("IMAGE_PROVIDER", "ideogram")
print(f"Provider: {provider}")

if provider != "openai":
    print("⚠️  WARNING: IMAGE_PROVIDER is not 'openai'")
    print("   Run: export IMAGE_PROVIDER=openai")
    sys.exit(1)

client = OpenAI()

print("\nTest 1: Simple image")
print("-" * 40)

try:
    rsp = client.images.generate(
        model="gpt-image-1",
        prompt="A red apple on white background",
        size="1024x1024",
        quality="medium",  # Sora uses: low, medium, high, auto
        n=1,
    )
    print("✅ Success!")
    if rsp.data and len(rsp.data) > 0 and rsp.data[0].url:
        print(f"URL: {rsp.data[0].url[:80]}...")
    else:
        print("(No URL in response)")
    
except APIError as e:
    print(f"❌ API error: {e}")
    if hasattr(e, "response") and e.response:
        print("Details:", json.dumps(e.response.json(), indent=2))
    sys.exit(1)

print("\nTest 2: With headline text")
print("-" * 40)

try:
    rsp = client.images.generate(
        model="gpt-image-1",
        prompt='HEADLINE TEXT: "INVEST NOW" | bold, centered, white on dark. Futuristic space station.',
        size="1024x1024",
        quality="high",  # Use high quality for text
        n=1,
    )
    print("✅ Success with text overlay!")
    if rsp.data and len(rsp.data) > 0 and rsp.data[0].url:
        print(f"URL: {rsp.data[0].url[:80]}...")
    else:
        print("(No URL in response)")
    
except APIError as e:
    print(f"❌ API error: {e}")
    if hasattr(e, "response") and e.response:
        print("Details:", json.dumps(e.response.json(), indent=2))

print("\n" + "=" * 60)
print("✅ Sora (gpt-image-1) is working!")
print("\nYou can now run:")
print("  python scripts/generate-images.py")
print("  make pdf")
PYTHON_SCRIPT