#!/usr/bin/env python3
"""
Atualiza a contagem de palavras no frontmatter dos capítulos
"""
import sys
from pathlib import Path

import frontmatter
from rich.console import Console
from rich.progress import track
from rich.table import Table

console = Console()

def count_words(text):
    """Conta palavras em um texto, excluindo Markdown syntax"""
    # Remove code blocks
    import re
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'`[^`]+`', '', text)

    # Remove links
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)

    # Remove imagens
    text = re.sub(r'!\[([^\]]*)\]\([^\)]+\)', '', text)

    # Remove headers markers
    text = re.sub(r'^#+\s+', '', text, flags=re.MULTILINE)

    # Remove emphasis markers
    text = re.sub(r'[*_]{1,2}([^*_]+)[*_]{1,2}', r'\1', text)

    # Count words
    words = text.split()
    return len(words)

def update_chapter_wordcount(filepath):
    """Atualiza contagem de palavras de um capítulo"""
    with open(filepath, 'r', encoding='utf-8') as f:
        post = frontmatter.load(f)

    # Contar palavras
    word_count = count_words(post.content)

    # Atualizar frontmatter
    post['words'] = word_count

    # Calcular porcentagem do target
    target = post.get('words_target', 2000)
    percentage = (word_count / target) * 100 if target > 0 else 0

    # Salvar arquivo
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(frontmatter.dumps(post))

    return {
        'file': filepath.name,
        'words': word_count,
        'target': target,
        'percentage': percentage,
        'status': post.get('status', 'draft')
    }

def main():
    """Função principal"""
    console.print("[bold blue]📊 Atualizando contagem de palavras...[/bold blue]\n")

    chapters_dir = Path("chapters")
    if not chapters_dir.exists():
        console.print("[red]Erro: Diretório 'chapters' não encontrado![/red]")
        sys.exit(1)

    # Processar todos os capítulos
    results = []
    chapter_files = sorted(chapters_dir.glob("*.md"))

    for filepath in track(chapter_files, description="Processando capítulos..."):
        result = update_chapter_wordcount(filepath)
        results.append(result)

    # Criar tabela de resultados
    table = Table(title="Contagem de Palavras por Capítulo")
    table.add_column("Capítulo", style="cyan")
    table.add_column("Palavras", justify="right", style="green")
    table.add_column("Target", justify="right")
    table.add_column("Progresso", justify="right")
    table.add_column("Status", style="yellow")

    total_words = 0
    total_target = 0

    for result in results:
        total_words += result['words']
        total_target += result['target']

        # Cor baseada na porcentagem
        if result['percentage'] >= 100:
            progress_color = "green"
        elif result['percentage'] >= 75:
            progress_color = "yellow"
        else:
            progress_color = "red"

        progress = f"[{progress_color}]{result['percentage']:.1f}%[/{progress_color}]"

        table.add_row(
            result['file'],
            str(result['words']),
            str(result['target']),
            progress,
            result['status']
        )

    # Adicionar totais
    table.add_section()
    total_percentage = (total_words / total_target) * 100 if total_target > 0 else 0
    table.add_row(
        "[bold]TOTAL[/bold]",
        f"[bold]{total_words}[/bold]",
        f"[bold]{total_target}[/bold]",
        f"[bold]{total_percentage:.1f}%[/bold]",
        ""
    )

    console.print(table)
    console.print(f"\n[green]✓ Contagem atualizada em {len(results)} capítulos![/green]")

if __name__ == "__main__":
    main()
