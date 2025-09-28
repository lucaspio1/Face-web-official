// debug-cpf.js - Debug específico para busca de CPF
require('dotenv').config();

async function debugCPFSearch() {
  try {
    console.log('🔍 Debugando busca de CPF...\n');
    
    const testCPF = '12345678901';
    
    // 1. Testar Apps Script diretamente
    console.log('1️⃣ Testando Apps Script diretamente...');
    
    const directResponse = await fetch(process.env.GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getPersonByCPF',
        cpf: testCPF
      })
    });
    
    const directResult = await directResponse.json();
    console.log('📋 Resposta direta do Apps Script:');
    console.log('   Status HTTP:', directResponse.status);
    console.log('   Success:', directResult.success);
    console.log('   Message:', directResult.message);
    console.log('   Data:', JSON.stringify(directResult.data, null, 4));
    console.log('   Timestamp:', directResult.timestamp);
    
    // 2. Testar getAllPeople
    console.log('\n2️⃣ Testando getAllPeople...');
    
    const allPeopleResponse = await fetch(process.env.GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getAllPeople'
      })
    });
    
    const allPeopleResult = await allPeopleResponse.json();
    console.log('📋 Todas as pessoas:');
    console.log('   Success:', allPeopleResult.success);
    console.log('   Total pessoas:', allPeopleResult.data ? allPeopleResult.data.length : 0);
    
    if (allPeopleResult.data && allPeopleResult.data.length > 0) {
      console.log('   Primeira pessoa:');
      console.log(JSON.stringify(allPeopleResult.data[0], null, 4));
      
      if (allPeopleResult.data.length > 1) {
        console.log('   Segunda pessoa:');
        console.log(JSON.stringify(allPeopleResult.data[1], null, 4));
      }
    }
    
    // 3. Testar GoogleSheetsService
    console.log('\n3️⃣ Testando via GoogleSheetsService...');
    
    const GoogleSheetsService = require('./services/GoogleSheetsService');
    const dbService = new GoogleSheetsService();
    await dbService.initialize();
    
    const serviceResult = await dbService.getPersonByCPF(testCPF);
    console.log('📋 Resultado do GoogleSheetsService:');
    console.log('   Tipo:', typeof serviceResult);
    console.log('   É null:', serviceResult === null);
    console.log('   Valor:', JSON.stringify(serviceResult, null, 4));
    
    // 4. Testar busca na simulação local
    console.log('\n4️⃣ Testando simulação local...');
    
    async function simularBuscaCPF(cpf) {
      const dadosSimulados = {
        '12345678901': {
          nome: 'João Silva Santos',
          cpf: '12345678901',
          email: 'joao.silva@email.com',
          telefone: '(11) 99999-9999',
          endereco: 'Rua das Flores, 123 - São Paulo/SP'
        },
        '98765432100': {
          nome: 'Maria Oliveira Costa',
          cpf: '98765432100',
          email: 'maria.oliveira@email.com',
          telefone: '(11) 88888-8888',
          endereco: 'Av. Paulista, 456 - São Paulo/SP'
        }
      };
      
      return dadosSimulados[cpf] || null;
    }
    
    const simulationResult = await simularBuscaCPF(testCPF);
    console.log('📋 Resultado da simulação:');
    console.log(JSON.stringify(simulationResult, null, 4));
    
    // 5. Comparar resultados
    console.log('\n5️⃣ Comparação de resultados:');
    console.log('   Apps Script encontrou pessoa:', !!directResult.data);
    console.log('   GoogleSheetsService encontrou pessoa:', !!serviceResult);
    console.log('   Simulação encontrou pessoa:', !!simulationResult);
    
    console.log('\n📊 Análise:');
    if (!directResult.data) {
      console.log('❌ Apps Script não retornou dados - problema na planilha ou código');
    }
    if (!serviceResult) {
      console.log('❌ GoogleSheetsService não encontrou - problema na validação');
    }
    if (simulationResult) {
      console.log('✅ Simulação funciona - problema não é no código local');
    }
    
  } catch (error) {
    console.error('❌ Erro no debug:', error);
    console.error('📋 Stack:', error.stack);
  }
}

// Executar debug
if (require.main === module) {
  debugCPFSearch().then(() => {
    console.log('\n✅ Debug finalizado!');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Erro crítico:', error);
    process.exit(1);
  });
}

module.exports = { debugCPFSearch };