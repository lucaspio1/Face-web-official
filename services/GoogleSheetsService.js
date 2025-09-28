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
        throw new Error('Falha no teste de conexão: ' + response.message);
      }
      
    } catch (error) {
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
      const response = await fetch(this.appsScriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result;
      
    } catch (error) {
      console.error('Erro na requisição para Google Sheets:', error);
      throw error;
    }
  }
  
  async addPerson(cpf, nome, embedding, imageBuffer) {
    try {
      console.log(`📤 Enviando dados para Google Sheets...`);
      
      const imageBase64 = imageBuffer.toString('base64');
      console.log(`📷 Imagem convertida: ${(imageBase64.length / 1024).toFixed(1)} KB`);
      
      const response = await this.makeRequest({
        action: 'addPerson',
        cpf: cpf,
        nome: nome,
        embedding: embedding,
        imageBase64: imageBase64
      });
      
      if (response.success) {
        console.log(`✅ ${nome} adicionado ao Google Sheets (ID: ${response.data.personId})`);
        return response.data.personId;
      } else {
        throw new Error(response.message);
      }
      
    } catch (error) {
      console.error('❌ Erro ao adicionar pessoa no Google Sheets:', error);
      throw error;
    }
  }
  
  // ⭐ FUNÇÃO CORRIGIDA - Buscar pessoa por CPF
  async getPersonByCPF(cpf) {
    try {
      console.log(`🔍 Buscando CPF ${cpf} no Google Sheets...`);
      
      // Garantir que seja string e limpar formatação
      const cpfLimpo = String(cpf).replace(/\D/g, '');
      
      const response = await this.makeRequest({
        action: 'getPersonByCPF',
        cpf: cpfLimpo
      });
      
      console.log(`📋 Resposta do Apps Script:`, JSON.stringify(response, null, 2));
      
      // ✅ CORREÇÃO: Verificar se a resposta foi bem-sucedida e contém dados
      if (response.success && response.data) {
        // O Apps Script agora retorna um objeto único, não um array
        const pessoa = response.data;
        
        // Verificar se o objeto contém os dados básicos necessários
        if (pessoa && pessoa.nome) {
          console.log(`✅ CPF ${cpf} encontrado: ${pessoa.nome}`);
          return pessoa; // Retornar o objeto da pessoa
        }
      }
      
      console.log(`ℹ️ CPF ${cpf} não encontrado ou dados inválidos`);
      return null;
      
    } catch (error) {
      console.error('❌ Erro ao buscar CPF:', error);
      return null;
    }
  }
  
  async getAllPeople() {
    try {
      console.log('📥 Buscando todas as pessoas do Google Sheets...');
      
      const response = await this.makeRequest({
        action: 'getAllPeople'
      });
      
      if (response.success && Array.isArray(response.data)) {
        console.log(`✅ ${response.data.length} pessoas encontradas no Google Sheets`);
        return response.data;
      } else {
        console.warn('⚠️ Erro ao buscar pessoas ou dados inválidos:', response.message);
        return [];
      }
      
    } catch (error) {
      console.error('❌ Erro ao buscar pessoas:', error);
      return [];
    }
  }
  
  async getPersonById(id) {
    try {
      // Buscar todas e filtrar por ID
      const people = await this.getAllPeople();
      const person = people.find(p => p.id == id);
      return person || null;
    } catch (error) {
      console.error('❌ Erro ao buscar pessoa por ID:', error);
      return null;
    }
  }
  
  async deletePerson(id) {
    try {
      console.log(`🗑️ Deletando pessoa ID ${id}...`);
      
      // Implementar no Apps Script se necessário
      console.warn('⚠️ Função de deletar não implementada no Google Sheets');
      return false;
      
    } catch (error) {
      console.error('❌ Erro ao deletar pessoa:', error);
      return false;
    }
  }
  
  async getStats() {
    try {
      const response = await this.makeRequest({
        action: 'getStats'
      });
      
      if (response.success && response.data) {
        return response.data;
      } else {
        return {
          total_persons: 0,
          total_embeddings: 0,
          total_images: 0
        };
      }
      
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      return {
        total_persons: 0,
        total_embeddings: 0,
        total_images: 0
      };
    }
  }
  
  async testConnection() {
    try {
      console.log('🧪 Testando conexão com Google Sheets...');
      
      const response = await this.makeRequest({
        action: 'getStats'
      });
      
      if (response.success) {
        console.log('✅ Conexão com Google Sheets OK');
        console.log('📊 Estatísticas:', response.data);
        return true;
      } else {
        console.log('❌ Falha no teste:', response.message);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Erro no teste de conexão:', error);
      return false;
    }
  }
  
  close() {
    console.log('✅ Conexão com Google Sheets finalizada');
  }
}

module.exports = GoogleSheetsService;