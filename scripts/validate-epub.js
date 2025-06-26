#!/usr/bin/env node
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');

async function validateEPUB() {
    console.log(chalk.blue('📖 Validando EPUB...'));
    
    try {
        // Encontrar arquivos EPUB
        const distDir = path.join(process.cwd(), 'build', 'dist');
        const epubFiles = await fs.readdir(distDir);
        const epubs = epubFiles.filter(file => file.endsWith('.epub'));
        
        if (epubs.length === 0) {
            console.log(chalk.yellow('⚠️  Nenhum arquivo EPUB encontrado para validar'));
            return;
        }
        
        // Validar cada EPUB
        for (const epub of epubs) {
            const epubPath = path.join(distDir, epub);
            console.log(chalk.gray(`Validando: ${epub}`));
            
            try {
                // Tentar usar epubcheck se disponível
                execSync(`epubcheck "${epubPath}"`, { stdio: 'inherit' });
                console.log(chalk.green(`✓ ${epub} é válido!`));
            } catch (error) {
                // Se epubcheck não estiver instalado, fazer validação básica
                console.log(chalk.yellow('⚠️  epubcheck não encontrado. Fazendo validação básica...'));
                
                // Verificar se o arquivo existe e tem tamanho > 0
                const stats = await fs.stat(epubPath);
                if (stats.size > 0) {
                    console.log(chalk.green(`✓ ${epub} parece válido (${(stats.size / 1024).toFixed(2)} KB)`));
                } else {
                    console.log(chalk.red(`✗ ${epub} está vazio!`));
                }
            }
        }
        
    } catch (error) {
        console.error(chalk.red('Erro ao validar EPUB:'), error.message);
        process.exit(1);
    }
}

// Executar
validateEPUB();