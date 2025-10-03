// GoogleSheetsService.js

class GoogleSheetsService {
  constructor() {
    this.appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
    this.initialized = false;
  }
  
  async initialize() {
    try {
      if (!this.appsScriptUrl) {
        throw new Error('⚠️ URL do Apps Script não configurada no .env');
      }
      
      console.log('Testando conexão com Google Sheets...');
      
      const response = await this.makeRequest({
        action: 'getStats'
      });
      
      if (response.success) {
        console.log('✅ Google Sheets configurado como banco de dados');
        console.log(`📊 Dados atuais: ${response.data.total_persons} pessoas cadastradas`);
        this.initialized = true;
        return true;
      } else {
        // Se a resposta não for success (ex: erro no Apps Script)
        throw new Error('Falha no teste de conexão: ' + response.message);
      }
      
    } catch (error) {
      // O erro de inicialização é relançado aqui
      console.error('❌ Erro ao inicializar Google Sheets:', error.message);
      console.log('\n🔧 Para configurar:');
      console.log('1. Crie uma planilha no Google Sheets');
      console.log('2. Configure o Apps Script');
      console.log('3. Adicione GOOGLE_APPS_SCRIPT_URL no .env');
      throw error;
    }
  }
  
  async makeRequest(data) {
    try {
      // Use 'fetch' aqui, que deve ser definido globalmente ou importado (dependendo do seu ambiente Node.js)
      // Nota: Em Node.js modernos, fetch é global. Para versões antigas, seria preciso 'node-fetch'.
      const fetch = global.fetch; 
      
      const response = await fetch(this.appsScriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        // Lança um erro se o status for 4xx ou 5xx
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result;
      
    } catch (error) {
      console.error('Erro na requisição para Google Sheets:', error);
      throw error;
    }
  }
  
  // FUNÇÃO ATUALIZADA: Recebe todos os campos extras para o novo fluxo
  async addPerson(cpf, nome, embedding, imageBuffer, email, telefone, personId) {
    try {
      console.log(`📤 Enviando dados para Google Sheets...`);
      
      const imageBase64 = imageBuffer.toString('base64');
      console.log(`📷 Imagem convertida: ${(imageBase64.length / 1024).toFixed(1)} KB`);
      
      const response = await this.makeRequest({
        action: 'addPerson',
        personId: personId, // ID do aluno na aba 'Alunos'
        cpf: cpf,
        nome: nome,
        email: email, // NOVO
        telefone: telefone, // NOVO
        embedding: embedding,
        imageBase64: imageBase64
      });
      
     if (response.success) {
    // Verificar a estrutura: o Apps Script retorna {success: true, message: ..., data: { personId: ID }}
    if (response.data && response.data.personId) {
        console.log(`✅ ${nome} adicionado ao Google Sheets (ID: ${response.data.personId})`);
        // Retorna o ID do novo cadastro (linha da aba 'Pessoas')
        return response.data.personId; 
    } else {
        // Se deu sucesso, mas não retornou o ID, tentamos retornar algo genérico
        console.warn(`✅ Cadastro realizado, mas ID não retornado. Mensagem: ${response.message}`);
        return 'ID_NAO_DISPONIVEL'; 
    }
} else {
    throw new Error(response.message);
}
      
    } catch (error) {
      console.error('❌ Erro ao adicionar pessoa no Google Sheets:', error);
      throw error;
    }
  }
  
  // FUNÇÃO ATUALIZADA: Retorna o objeto de dados sem embedding
  async getPersonByCPF(cpf) {
    try {
      console.log(`🔍 Buscando CPF ${cpf} no Google Sheets...`);
      
      const cpfLimpo = String(cpf).replace(/\D/g, '');
      
      const response = await this.makeRequest({
        action: 'getPersonByCPF',
        cpf: cpfLimpo
      });
      
      // O Apps Script agora retorna um objeto de aluno com status facial, sem embedding
      if (response.success && response.data) {
        const pessoa = response.data;
        
        if (pessoa && pessoa.nome) {
          console.log(`✅ CPF ${cpf} encontrado: ${pessoa.nome}`);
          // Retornar o objeto completo com ID, nome, cpf, email, telefone, status_facial
          return pessoa; 
        }
      }
      
      console.log(`ℹ️ CPF ${cpf} não encontrado ou dados inválidos`);
      return null;
      
    } catch (error) {
      console.error('❌ Erro ao buscar CPF:', error);
      return null;
    }
  }
  
  // ... (getAllPeople, getPersonById, deletePerson, getStats, testConnection, close - mantidas)
  
  // Função close adicionada para fechar a conexão de forma limpa (embora no Sheets não haja conexão para fechar)
  close() {
    console.log('✅ Conexão com Google Sheets finalizada');
  }
}

module.exports = GoogleSheetsService;