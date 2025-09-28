class GoogleSheetsService {
  constructor() {
    this.appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
    this.initialized = false;
  }
  
  async initialize() {
    try {
      if (!this.appsScriptUrl) {
        throw new Error('âš ï¸ URL do Apps Script nÃ£o configurada no .env');
      }
      
      console.log('Testando conexÃ£o com Google Sheets...');
      
      const response = await this.makeRequest({
        action: 'getStats'
      });
      
      if (response.success) {
        console.log('âœ“ Google Sheets configurado como banco de dados');
        console.log(`ðŸ“Š Dados atuais: ${response.data.total_persons} pessoas cadastradas`);
        this.initialized = true;
        return true;
      } else {
        throw new Error('Falha no teste de conexÃ£o: ' + response.message);
      }
      
    } catch (error) {
      console.error('âŒ Erro ao inicializar Google Sheets:', error.message);
      console.log('\nðŸ”§ Para configurar:');
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
      console.error('Erro na requisiÃ§Ã£o para Google Sheets:', error);
      throw error;
    }
  }
  
  async addPerson(cpf, nome, embedding, imageBuffer) {
    try {
      console.log(`ðŸ“¤ Enviando dados para Google Sheets...`);
      
      const imageBase64 = imageBuffer.toString('base64');
      console.log(`ðŸ“· Imagem convertida: ${(imageBase64.length / 1024).toFixed(1)} KB`);
      
      const response = await this.makeRequest({
        action: 'addPerson',
        cpf: cpf,
        nome: nome,
        embedding: embedding,
        imageBase64: imageBase64
      });
      
      if (response.success) {
        console.log(`âœ… ${nome} adicionado ao Google Sheets (ID: ${response.data.personId})`);
        return response.data.personId;
      } else {
        throw new Error(response.message);
      }
      
    } catch (error) {
      console.error('âŒ Erro ao adicionar pessoa no Google Sheets:', error);
      throw error;
    }
  }
  
 async getPersonByCPF(cpf) {
  try {
    console.log(`ðŸ” Buscando CPF ${cpf} no Google Sheets...`);
    
    const response = await this.makeRequest({
      action: 'getPersonByCPF',
      cpf: String(cpf) // â† Garantir que seja string
    });
    
    console.log(`ðŸ“‹ Resposta do Apps Script:`, JSON.stringify(response, null, 2));
    
    // --- ALTERAÃ‡ÃƒO AQUI ---
    // 1. Verificar se a resposta foi bem-sucedida e se 'data' Ã© um array nÃ£o vazio.
    if (response.success && Array.isArray(response.data) && response.data.length > 0) {
      const pessoa = response.data[0]; // Pegar o primeiro elemento do array
      
      // 2. Verificar se o objeto contÃ©m os dados bÃ¡sicos necessÃ¡rios (como 'nome')
      if (pessoa && pessoa.nome) {
        console.log(`âœ“ CPF ${cpf} encontrado: ${pessoa.nome}`);
        return pessoa; // Retornar o objeto da pessoa
      }
    }
    
    console.log(`â„¹ï¸ CPF ${cpf} nÃ£o encontrado ou dados invÃ¡lidos`);
    return null;
    
  } catch (error) {
    console.error('âŒ Erro ao buscar CPF:', error);
    return null;
  }
}
  
  async getAllPeople() {
    try {
      console.log('ðŸ“¥ Buscando todas as pessoas do Google Sheets...');
      
      const response = await this.makeRequest({
        action: 'getAllPeople'
      });
      
      if (response.success && Array.isArray(response.data)) {
        console.log(`âœ“ ${response.data.length} pessoas encontradas no Google Sheets`);
        return response.data;
      } else {
        console.warn('âš ï¸ Erro ao buscar pessoas ou dados invÃ¡lidos:', response.message);
        return [];
      }
      
    } catch (error) {
      console.error('âŒ Erro ao buscar pessoas:', error);
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
      console.error('âŒ Erro ao buscar pessoa por ID:', error);
      return null;
    }
  }
  
  async deletePerson(id) {
    try {
      console.log(`ðŸ—‘ï¸ Deletando pessoa ID ${id}...`);
      
      // Implementar no Apps Script se necessÃ¡rio
      console.warn('âš ï¸ FunÃ§Ã£o de deletar nÃ£o implementada no Google Sheets');
      return false;
      
    } catch (error) {
      console.error('âŒ Erro ao deletar pessoa:', error);
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
      console.error('âŒ Erro ao obter estatÃ­sticas:', error);
      return {
        total_persons: 0,
        total_embeddings: 0,
        total_images: 0
      };
    }
  }
  
  async testConnection() {
    try {
      console.log('ðŸ§ª Testando conexÃ£o com Google Sheets...');
      
      const response = await this.makeRequest({
        action: 'getStats'
      });
      
      if (response.success) {
        console.log('âœ… ConexÃ£o com Google Sheets OK');
        console.log('ðŸ“Š EstatÃ­sticas:', response.data);
        return true;
      } else {
        console.log('âŒ Falha no teste:', response.message);
        return false;
      }
      
    } catch (error) {
      console.error('âŒ Erro no teste de conexÃ£o:', error);
      return false;
    }
  }
  
  close() {
    console.log('âœ“ ConexÃ£o com Google Sheets finalizada');
  }
}

module.exports = GoogleSheetsService;