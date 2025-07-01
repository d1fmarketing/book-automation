#!/usr/bin/env python3
"""
Converte PDF em imagens para verificação visual
"""

import os
import sys
from pathlib import Path
from pdf2image import convert_from_path

def pdf_to_images():
    # Caminhos
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    pdf_path = project_root / "build" / "dist" / "the-tiny-test-book.pdf"
    output_dir = project_root / "build" / "screenshots"
    
    # Verificar se o PDF existe
    if not pdf_path.exists():
        print(f"❌ PDF não encontrado: {pdf_path}")
        return False
    
    # Criar diretório de saída
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Limpar imagens antigas
    for img in output_dir.glob("page-*.png"):
        img.unlink()
    
    print(f"🖼️  Convertendo PDF em imagens...")
    print(f"📄 PDF: {pdf_path}")
    
    try:
        # Converter PDF em imagens
        images = convert_from_path(pdf_path, dpi=150)
        
        print(f"📑 Total de páginas: {len(images)}")
        
        # Salvar cada página
        for i, image in enumerate(images, 1):
            output_path = output_dir / f"page-{i:02d}.png"
            image.save(output_path, "PNG")
            print(f"✓ Página {i}/{len(images)} salva: {output_path.name}")
        
        print(f"\n✅ Conversão concluída!")
        print(f"📁 Imagens salvas em: {output_dir}")
        return True
        
    except Exception as e:
        print(f"❌ Erro ao converter PDF: {e}")
        return False

if __name__ == "__main__":
    success = pdf_to_images()
    sys.exit(0 if success else 1)