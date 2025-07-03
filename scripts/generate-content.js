#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// Generate content with research integration
async function generateChapterContent(chapterTitle, topic, chapterIndex, research) {
  // Load research from YAML if not provided
  if (!research && require('fs').existsSync('context/research.yaml')) {
    const yaml = require('js-yaml');
    const fs = require('fs');
    try {
      research = yaml.load(fs.readFileSync('context/research.yaml', 'utf-8'));
    } catch (error) {
      console.log('⚠️  Could not load research data');
    }
  }
  
  // Select relevant research bullets for this chapter
  const bullets = research?.bullets || [];
  const primaryBullet = bullets[chapterIndex % bullets.length] || '';
  const secondaryBullet = bullets[(chapterIndex + 1) % bullets.length] || '';
  
  // Build research citations
  const researchCitations = (primaryBullet && secondaryBullet) ? `
## Research Insights

${primaryBullet ? `> "${primaryBullet}"` : ''}

${secondaryBullet && secondaryBullet !== primaryBullet ? `> "${secondaryBullet}"` : ''}
` : '';

  // Build source links section
  const sourceLinks = research?.links?.length > 0 ? `
## Sources & Further Reading

${research.links.map((link, i) => `${i + 1}. [Source ${i + 1}](${link})`).join('\n')}
` : '';
    
  const content = `# ${chapterTitle}

This chapter covers essential aspects of ${topic.title.toLowerCase()}.

## Introduction

${topic.description}

${research?.summary ? `According to recent research: "${research.summary}"` : ''}

## Key Concepts

When it comes to ${topic.keywords[0]}, it's important to understand...

[!TIP] Pro Tip
Start with the basics and gradually build your expertise in ${topic.niche}.

## Practical Application

Here's how you can apply these concepts:

1. **Step One**: Begin by understanding the fundamentals
2. **Step Two**: Practice with real-world examples
3. **Step Three**: Scale your efforts for maximum impact

[!KEY] Key Takeaway
The most important thing to remember about ${topic.title} is consistency and persistence.

## Summary

In this chapter, we've covered the essential elements of ${chapterTitle.toLowerCase()}. 
Remember to apply these principles consistently for best results.

${researchCitations}

${sourceLinks}

---

*Continue to the next chapter to deepen your understanding.*`;

  return content;
}

// Gerar estrutura completa do ebook
async function generateEbookContent(topic, config = {}) {
  console.log(`📚 Gerando conteúdo para: "${topic.title}"`);
  
  // Estrutura de capítulos baseada no tópico
  const chapterStructure = [
    {
      title: "Introduction",
      description: "Why this topic matters and what you'll learn"
    },
    {
      title: "Getting Started",
      description: "Essential foundations and prerequisites"
    },
    {
      title: "Core Strategies",
      description: "Proven methods and techniques"
    },
    {
      title: "Advanced Techniques",
      description: "Taking your skills to the next level"
    },
    {
      title: "Common Mistakes to Avoid",
      description: "Pitfalls and how to overcome them"
    },
    {
      title: "Case Studies",
      description: "Real-world examples and success stories"
    },
    {
      title: "Tools and Resources",
      description: "Essential tools for success"
    },
    {
      title: "Action Plan",
      description: "Your step-by-step roadmap"
    },
    {
      title: "Conclusion",
      description: "Next steps and final thoughts"
    }
  ];
  
  // Criar diretório do livro
  const safeTitle = topic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const bookDir = path.join('build', 'ebooks', safeTitle);
  const chaptersDir = path.join(bookDir, 'chapters');
  
  await fs.mkdir(chaptersDir, { recursive: true });
  
  // Gerar metadata
  const metadata = {
    title: topic.title,
    subtitle: `The Complete Guide to ${topic.keywords[0]}`,
    author: config.author || "Elite Publishing",
    description: topic.description,
    niche: topic.niche,
    keywords: topic.keywords,
    targetAudience: topic.targetAudience,
    language: "en",
    isbn: `978-${Date.now().toString().slice(-10)}`,
    publisher: "Elite Digital Publishing",
    year: new Date().getFullYear(),
    generatedAt: new Date().toISOString()
  };
  
  // Salvar metadata.yaml
  const metadataYaml = `title: "${metadata.title}"
subtitle: "${metadata.subtitle}"
author: "${metadata.author}"
language: "${metadata.language}"
isbn: "${metadata.isbn}"
publisher: "${metadata.publisher}"
year: ${metadata.year}

# PDF Configuration
pdf:
  preset: ultra-clean
  output: "final/${safeTitle}.pdf"

# Marketing
niche: "${metadata.niche}"
keywords: ${metadata.keywords.map(k => `\n  - "${k}"`).join('')}
targetAudience: "${metadata.targetAudience}"`;
  
  await fs.writeFile(path.join(bookDir, 'metadata.yaml'), metadataYaml);
  
  // Gerar capítulos
  console.log(`\n📝 Gerando ${chapterStructure.length} capítulos...`);
  
  let totalWordCount = 0;
  const chapters = [];
  
  for (let i = 0; i < chapterStructure.length; i++) {
    const chapter = chapterStructure[i];
    const chapterNum = String(i + 1).padStart(2, '0');
    const filename = `chapter-${chapterNum}-${chapter.title.toLowerCase().replace(/\s+/g, '-')}.md`;
    
    console.log(`   📄 Capítulo ${i + 1}: ${chapter.title}`);
    
    // Gerar conteúdo do capítulo
    const content = await generateChapterContent(chapter.title, topic, i, config.research);
    
    // Contar palavras (aproximado)
    const wordCount = content.split(/\s+/).length;
    totalWordCount += wordCount;
    
    // Adicionar frontmatter
    const chapterWithMeta = `---
chap: ${i + 1}
title: "${chapter.title}"
description: "${chapter.description}"
words: ${wordCount}
status: draft
---

${content}`;
    
    // Salvar capítulo
    await fs.writeFile(path.join(chaptersDir, filename), chapterWithMeta);
    
    chapters.push({
      number: i + 1,
      title: chapter.title,
      filename,
      wordCount
    });
  }
  
  // Atualizar metadata com contagem de palavras
  metadata.wordCount = totalWordCount;
  metadata.chapters = chapters.length;
  
  console.log(`\n✅ Conteúdo gerado com sucesso!`);
  console.log(`   📊 Total de palavras: ${totalWordCount.toLocaleString()}`);
  console.log(`   📁 Localização: ${bookDir}`);
  
  // Criar README para o ebook
  const readme = `# ${topic.title}

${topic.description}

## 📚 Sobre este Ebook

- **Autor**: ${metadata.author}
- **Páginas**: ~${Math.round(totalWordCount / 250)}
- **Capítulos**: ${chapters.length}
- **Nicho**: ${topic.niche}

## 📖 Conteúdo

${chapters.map(ch => `${ch.number}. ${ch.title} (${ch.wordCount} palavras)`).join('\n')}

## 🎯 Público-alvo

${topic.targetAudience}

## 🏷️ Palavras-chave

${topic.keywords.join(', ')}

---

*Gerado em: ${new Date().toLocaleString()}*`;
  
  await fs.writeFile(path.join(bookDir, 'README.md'), readme);
  
  return {
    bookDir,
    metadata,
    chapters,
    totalWordCount
  };
}

// Gerar sumário executivo
async function generateExecutiveSummary(topic) {
  const summary = `# Executive Summary: ${topic.title}

## Market Opportunity
- Estimated demand: ${topic.estimatedDemand} monthly searches
- Competition level: ${topic.competition}
- Revenue potential: ${topic.potential}

## Content Strategy
Focus on practical, actionable content that delivers immediate value.

## Monetization
- Primary: Direct sales at $5-$10
- Secondary: Upsells and related products
- Long-term: Build email list for future products`;
  
  return summary;
}

// Se executado diretamente
if (require.main === module) {
  // Teste com um tópico exemplo
  const testTopic = {
    title: "AI Writing Assistant Mastery",
    niche: "AI/Technology",
    description: "Master AI writing tools to 10x your content creation",
    keywords: ["ai writing", "chatgpt", "content creation", "productivity"],
    targetAudience: "Content creators and marketers",
    estimatedDemand: 8500
  };
  
  generateEbookContent(testTopic).catch(console.error);
}

module.exports = { generateEbookContent, generateChapterContent, generateExecutiveSummary };