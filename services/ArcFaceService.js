// services/ArcFaceService.js
// Substitui o FaceRecognitionService.js para usar ArcFace

const axios = require('axios');

class ArcFaceService {
  constructor() {
    this.arcfaceUrl = process.env.ARCFACE_URL || 'http://localhost:5000';
    this.initialized = false;
    this.OUTPUT_SIZE = 512; // ArcFace usa 512D
    this.SIMILARITY_THRESHOLD = 0.4; // Threshold do ArcFace
  }
  
  async initialize() {
    try {
      console.log('Inicializando serviço ArcFace...');
      
      // Testar conexão com servidor ArcFace
      const response = await axios.get(`${this.arcfaceUrl}/health`, {
        timeout: 5000
      });
      
      if (response.data.status === 'online') {
        console.log('✅ Servidor ArcFace online');
        console.log(`   Modelo: ${response.data.model}`);
        console.log(`   Threshold: ${response.data.threshold}`);
        this.initialized = true;
        return true;
      } else {
        throw new Error('Servidor ArcFace retornou status inválido');
      }
      
    } catch (error) {
      console.error('❌ Erro ao conectar com ArcFace:', error.message);
      console.log('\n📋 Para iniciar o servidor ArcFace:');
      console.log('1. source venv_arcface/bin/activate');
      console.log('2. python arcface_server.py');
      throw error;
    }
  }
  
  /**
   * Extrai embedding usando ArcFace (substituindo o método antigo)
   * @param {Buffer} imageBuffer - Buffer da imagem
   * @param {Object} faceBox - Bounding box do Google Vision (não usado, ArcFace detecta sozinho)
   * @returns {Promise<number[]|null>} - Embedding de 512 dimensões
   */
  async extractFaceEmbedding(imageBuffer, faceBox) {
    try {
      if (!this.initialized) {
        throw new Error('Serviço ArcFace não inicializado');
      }
      
      // Converter imagem para base64
      const imageBase64 = imageBuffer.toString('base64');
      const imageDataUrl = `data:image/jpeg;base64,${imageBase64}`;
      
      console.log('🤖 Enviando imagem para ArcFace...');
      
      // Fazer requisição para ArcFace extrair embedding
      const response = await axios.post(`${this.arcfaceUrl}/extract-embedding`, {
        image: imageDataUrl
      }, {
        timeout: 10000 // 10 segundos
      });
      
      if (response.data.success && response.data.embedding) {
        const embedding = response.data.embedding;
        
        if (embedding.length !== this.OUTPUT_SIZE) {
          throw new Error(`Embedding inválido: esperado ${this.OUTPUT_SIZE}D, recebido ${embedding.length}D`);
        }
        
        console.log(`✅ Embedding extraído: ${embedding.length} dimensões`);
        return embedding;
        
      } else {
        console.error('❌ ArcFace não conseguiu extrair embedding');
        return null;
      }
      
    } catch (error) {
      console.error('❌ Erro ao extrair embedding com ArcFace:', error.message);
      return null;
    }
  }
  
  /**
   * Calcula similaridade entre dois embeddings (método cosseno)
   * @param {number[]} embedding1 
   * @param {number[]} embedding2 
   * @returns {number} Similaridade de 0 a 1
   */
  calculateSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
      return 0;
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }
  
  /**
   * Encontra melhor correspondência em banco de embeddings
   * @param {number[]} targetEmbedding 
   * @param {Array} embeddingsDatabase 
   * @returns {Object}
   */
  findBestMatch(targetEmbedding, embeddingsDatabase) {
    let bestSimilarity = 0;
    let bestMatch = null;

    for (const personEmbedding of embeddingsDatabase) {
      const similarity = this.calculateSimilarity(
        targetEmbedding, 
        personEmbedding.embedding
      );
      
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = personEmbedding;
      }
    }
    
    // ArcFace usa distância cosseno invertida
    // Quanto maior a similaridade cosseno, melhor o match
    const distance = 1 - bestSimilarity;
    const isMatch = distance < this.SIMILARITY_THRESHOLD;
    
    return {
      personId: bestMatch?.personId || -1,
      confidence: bestSimilarity,
      distance: distance,
      isMatch: isMatch
    };
  }
  
  isInitialized() {
    return this.initialized;
  }
  
  async testService() {
    try {
      console.log('🧪 Testando serviço ArcFace...');
      
      const response = await axios.get(`${this.arcfaceUrl}/health`);
      
      if (response.data.status === 'online') {
        console.log('✅ Teste passou! ArcFace funcionando.');
        return true;
      } else {
        console.log('❌ Teste falhou!');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Erro no teste:', error.message);
      return false;
    }
  }
}

module.exports = ArcFaceService;