#!/usr/bin/env python3
"""
Sora (gpt-image-1) Setup Verification Script
Checks if your OpenAI account has access to the Sora model
"""

import os
import sys
from openai import OpenAI, APIError
from rich.console import Console

console = Console()

def check_api_key():
    """Verify API key is set"""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        console.print("[red]❌ OPENAI_API_KEY not set[/red]")
        console.print("Run: export OPENAI_API_KEY='your-key-here'")
        return False
    
    if api_key.startswith("sk-proj-"):
        console.print("[green]✅ API key format looks correct (project key)[/green]")
    elif api_key.startswith("sk-"):
        console.print("[green]✅ API key format looks correct[/green]")
    else:
        console.print("[yellow]⚠️  Unusual API key format[/yellow]")
    
    return True

def check_sora_access():
    """Test if account has Sora access"""
    client = OpenAI()
    
    console.print("\n[bold]Testing Sora (gpt-image-1) access...[/bold]")
    
    try:
        # Test with minimal parameters
        response = client.images.generate(
            model="gpt-image-1",
            prompt="A simple red circle",
            size="1024x1024",
            n=1
        )
        
        console.print("[green]✅ SUCCESS! Your account has Sora access![/green]")
        if response.data and len(response.data) > 0 and response.data[0].url:
            console.print(f"Image URL: {response.data[0].url[:80]}...")
        return True
        
    except APIError as e:
        if "invalid_api_key" in str(e):
            console.print("[red]❌ Invalid API key[/red]")
            console.print("Please check your key at: https://platform.openai.com/api-keys")
        elif "model_not_found" in str(e):
            console.print("[red]❌ Sora (gpt-image-1) not available on your account[/red]")
            console.print("\nTo enable Sora:")
            console.print("1. Go to https://platform.openai.com/settings/organization/limits")
            console.print("2. Look for 'Image generation (gpt-image-1)' toggle")
            console.print("3. Enable it if available (requires Tier 1+)")
        else:
            console.print(f"[red]❌ API Error: {e}[/red]")
        return False

def main():
    console.print("[bold blue]Sora Setup Verification[/bold blue]\n")
    
    # Check environment
    provider = os.getenv("IMAGE_PROVIDER", "ideogram")
    if provider != "openai":
        console.print(f"[yellow]⚠️  IMAGE_PROVIDER is '{provider}', not 'openai'[/yellow]")
        console.print("Run: export IMAGE_PROVIDER=openai")
        console.print()
    
    # Check API key
    if not check_api_key():
        sys.exit(1)
    
    # Test Sora access
    if check_sora_access():
        console.print("\n[bold green]✅ Everything is set up correctly![/bold green]")
        console.print("\nYou can now run:")
        console.print("  python scripts/generate-images.py")
        console.print("  make pdf")
    else:
        console.print("\n[bold red]❌ Setup incomplete[/bold red]")
        sys.exit(1)

if __name__ == "__main__":
    main()