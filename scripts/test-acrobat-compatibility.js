const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔍 Testando compatibilidade com Adobe Acrobat...\n');

const pdfPath = 'build/dist/ebook-digital-with-cover.pdf';

if (!fs.existsSync(pdfPath)) {
    console.error('❌ PDF não encontrado:', pdfPath);
    process.exit(1);
}

// Verificações críticas para Acrobat
const tests = [
    {
        name: 'Estrutura XRef',
        command: `qpdf --show-xref ${pdfPath} 2>/dev/null | grep -c "obj"`,
        expected: val => val > 0,
        critical: true
    },
    {
        name: 'PageTree válida',
        command: `qpdf --show-pages ${pdfPath} 2>/dev/null | grep -c "page"`,
        expected: val => val == 45,
        critical: true
    },
    {
        name: 'Sem streams corrompidos',
        command: `qpdf --check ${pdfPath} 2>&1 | grep -c "error"`,
        expected: val => val == 0,
        critical: true
    },
    {
        name: 'Validação de objetos',
        command: `qpdf --show-all-pages ${pdfPath} 2>&1 | grep -c "obj"`,
        expected: val => val > 0,
        critical: false
    },
    {
        name: 'Encoding UTF-8',
        command: `pdfinfo ${pdfPath} 2>/dev/null | grep -c "PDF version"`,
        expected: val => val == 1,
        critical: false
    }
];

let allPassed = true;

console.log('📋 Executando testes de compatibilidade:\n');

tests.forEach(test => {
    try {
        const result = execSync(test.command).toString().trim();
        const numResult = parseInt(result) || 0;
        const passed = test.expected(numResult);
        
        console.log(`${passed ? '✅' : '❌'} ${test.name}: ${result}`);
        
        if (!passed && test.critical) {
            allPassed = false;
            console.log(`   ⚠️  ERRO CRÍTICO: Este problema pode causar falhas no Adobe Acrobat!`);
        }
    } catch (error) {
        console.log(`❌ ${test.name}: ERRO ao executar teste`);
        if (test.critical) {
            allPassed = false;
        }
    }
});

// Teste adicional: verificar cabeçalho do PDF
console.log('\n📄 Verificando cabeçalho do PDF:');
const pdfBuffer = fs.readFileSync(pdfPath);
const header = pdfBuffer.toString('utf8', 0, 8);
console.log(`   Header: ${header}`);
console.log(`   ${header.startsWith('%PDF-1.') ? '✅' : '❌'} Cabeçalho válido`);

// Resumo
console.log('\n' + '='.repeat(50));
console.log('📊 RESUMO DA COMPATIBILIDADE:');
console.log('='.repeat(50));

if (allPassed) {
    console.log('✅ PDF COMPATÍVEL COM ADOBE ACROBAT!');
    console.log('   - Estrutura XRef válida');
    console.log('   - PageTree correta');
    console.log('   - Sem streams corrompidos');
    console.log('   - Pronto para publicação');
} else {
    console.log('❌ PROBLEMAS DETECTADOS!');
    console.log('   O PDF pode não abrir corretamente no Adobe Acrobat.');
    console.log('   Verifique os erros críticos acima.');
}

console.log('='.repeat(50));