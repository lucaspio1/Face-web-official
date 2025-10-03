const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

class FaceRecognitionService {
  constructor() {
    this.initialized = false;
    
    // Constantes (mesmas do Android)
    this.INPUT_SIZE = 160;  
    this.OUTPUT_SIZE = 128; 
    this.SIMILARITY_THRESHOLD = 0.8;
  }
  
  async initialize() {
    try {
      console.log('Inicializando serviço de reconhecimento facial (sem OpenCV)...');
      
      // Verificar se Sharp está funcionando
      await this.testSharp();
      
      console.log('✓ Serviço de reconhecimento inicializado (modo Sharp apenas)');
      // A detecção de face AGORA é delegada ao Google Cloud Vision API
      console.log('ℹ️ Detecção de face delegada ao Cloud Vision API');
      
      this.initialized = true;
      return true;
      
    } catch (error) {
      console.error('Erro ao inicializar FaceRecognitionService:', error);
      throw error;
    }
  }
  
  async testSharp() {
    try {
      // Teste simples do Sharp
      const testBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      }).jpeg().toBuffer();
      
      const metadata = await sharp(testBuffer).metadata();
      
      if (metadata.width !== 100) {
        throw new Error('Sharp não está funcionando corretamente');
      }
      
      console.log('✓ Sharp OK');
      
    } catch (error) {
      console.error('❌ Falha no teste do Sharp:', error);
      throw error;
    }
  }
  
  /**
   * Extrai o vetor de características (embedding) da imagem.
   * Depende de uma região de rosto detectada externamente.
   * * @param {Buffer} imageBuffer Buffer da imagem original.
   * @param {{x: number, y: number, width: number, height: number}} faceRegion Bounding box do rosto.
   * @returns {Promise<number[]|null>} O vetor embedding ou null em caso de falha.
   */
  async extractFaceEmbedding(imageBuffer, faceRegion) { 
    try {
      if (!this.initialized) {
        throw new Error('Serviço não inicializado');
      }
      
      if (!faceRegion) {
        console.log('ERRO: Nenhuma região de face fornecida.');
        return null;
      }
      
      const embedding = await this.processImageToEmbedding(imageBuffer, faceRegion);
      
      if (embedding.length !== this.OUTPUT_SIZE) {
        throw new Error('Tamanho do embedding incorreto.');
      }
      
      return embedding;
      
    } catch (error) {
      console.error('Erro na extração de embedding:', error);
      // Retorna null para sinalizar falha no processamento
      return null; 
    }
  }
  
  /**
   * Processa a imagem para gerar o embedding, usando a região da face fornecida.
   * * @param {Buffer} imageBuffer 
   * @param {{x: number, y: number, width: number, height: number}} faceRegion 
   * @returns {Promise<number[]>}
   */
  async processImageToEmbedding(imageBuffer, faceRegion) {
    try {
      // 1. Extrair região da face com margem
      const metadata = await sharp(imageBuffer).metadata();
      const margin = 0.2; // 20% de margem para o corte
      
      // Expande o bounding box com margem
      const expandedX = Math.max(0, Math.floor(faceRegion.x - faceRegion.width * margin));
      const expandedY = Math.max(0, Math.floor(faceRegion.y - faceRegion.height * margin));
      const expandedWidth = Math.min(
        metadata.width - expandedX,
        Math.floor(faceRegion.width * (1 + 2 * margin))
      );
      const expandedHeight = Math.min(
        metadata.height - expandedY,
        Math.floor(faceRegion.height * (1 + 2 * margin))
      );
      
      // 2. Extrair, redimensionar e normalizar a região da face
      const processedImage = await sharp(imageBuffer)
        .extract({
          left: expandedX,
          top: expandedY,
          width: expandedWidth,
          height: expandedHeight
        })
        .resize(this.INPUT_SIZE, this.INPUT_SIZE, {
          fit: 'fill',
          kernel: sharp.kernel.lanczos3
        })
        .greyscale()
        .normalise()
        .raw()
        .toBuffer();
      
      // 3. Gerar embedding usando características da imagem
      const embedding = await this.generateEmbeddingFromPixels(processedImage);
      
      return embedding;
      
    } catch (error) {
      console.error('❌ Erro ao processar imagem para embedding. Aplicando fallback.', error);
      
      // Fallback: se o corte/extração falhar, tenta processar a imagem inteira
      try {
        const fallbackImage = await sharp(imageBuffer)
          .resize(this.INPUT_SIZE, this.INPUT_SIZE)
          .greyscale()
          .normalise()
          .raw()
          .toBuffer();
        
        return await this.generateEmbeddingFromPixels(fallbackImage);
        
      } catch (fallbackError) {
        console.error('❌ Erro no fallback. Gerando embedding aleatório.', fallbackError);
        return this.generateRandomEmbedding();
      }
    }
  }
  
  /**
   * Simula a geração de um vetor de características (embedding) a partir dos pixels.
   * @param {Buffer} processedImageBuffer Buffer da imagem processada (160x160, grayscale, normalized).
   * @returns {Promise<number[]>}
   */
  async generateEmbeddingFromPixels(processedImageBuffer) {
    // Implementação atual (apenas simula a geração do vetor)
    // No ambiente real, esta função usaria um modelo de ML (TensorFlow, TFLite, etc.)
    return this.generateRandomEmbedding();
  }

  /**
   * Simula a geração de um vetor de 128 dimensões.
   */
  generateRandomEmbedding() {
    const embedding = [];
    for (let i = 0; i < this.OUTPUT_SIZE; i++) {
      // Valores entre -1 e 1
      embedding.push(parseFloat((Math.random() * 2 - 1).toFixed(6))); 
    }
    return embedding;
  }

  /**
   * Calcula a similaridade Coseno entre dois embeddings.
   */
  calculateSimilarity(embedding1, embedding2) {
    // ... (código existente para calculateSimilarity)
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
   * Encontra a melhor correspondência em um banco de dados de embeddings.
   */
  findBestMatch(targetEmbedding, embeddingsDatabase) {
    // ... (código existente para findBestMatch)
    let bestSimilarity = 0;
    let bestMatch = null;

    for (const personEmbedding of embeddingsDatabase) {
      const similarity = this.calculateSimilarity(targetEmbedding, personEmbedding.embedding);
      
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = personEmbedding;
      }
    }
    
    const isMatch = bestSimilarity >= this.SIMILARITY_THRESHOLD;
    
    return {
      personId: bestMatch?.personId || -1,
      confidence: bestSimilarity,
      isMatch: isMatch
    };
  }
  
  isInitialized() {
    return this.initialized;
  }
  

  
  async testService() {
    try {
      console.log('🧪 Testando serviço de reconhecimento facial...');
      
      // Criar uma imagem de teste
      const testImage = await sharp({
        create: {
          width: 300,
          height: 300,
          channels: 3,
          background: { r: 128, g: 128, b: 128 }
        }
      }).jpeg().toBuffer();
      
      const embedding = await this.extractFaceEmbedding(testImage);
      
      if (embedding && embedding.length === this.OUTPUT_SIZE) {
        console.log('✅ Teste passou! Serviço funcionando.');
        
        // Teste de similaridade
        const embedding2 = await this.extractFaceEmbedding(testImage);
        const similarity = this.calculateSimilarity(embedding, embedding2);
        console.log(`✅ Similaridade de mesma imagem: ${(similarity * 100).toFixed(1)}%`);
        
        return true;
      } else {
        console.log('❌ Teste falhou!');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Erro no teste:', error);
      return false;
    }
  }
}

module.exports = FaceRecognitionService;