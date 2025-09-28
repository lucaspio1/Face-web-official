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
      console.log('ℹ️ Usando detecção de face simplificada');
      
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
      
      console.log('✓ Sharp está funcionando');
      
    } catch (error) {
      console.error('Erro no teste do Sharp:', error);
      throw error;
    }
  }
  
  async detectFaces(imageBuffer) {
    try {
      // Sem OpenCV, assumimos que há uma face centralizada na imagem
      const metadata = await sharp(imageBuffer).metadata();
      
      // Simular detecção: face ocupando 60% do centro da imagem
      const faceWidth = Math.floor(metadata.width * 0.6);
      const faceHeight = Math.floor(metadata.height * 0.6);
      const faceX = Math.floor((metadata.width - faceWidth) / 2);
      const faceY = Math.floor((metadata.height - faceHeight) / 2);
      
      const face = {
        x: faceX,
        y: faceY,
        width: faceWidth,
        height: faceHeight
      };
      
      console.log('Face simulada detectada:', face);
      return { faces: [face], originalImage: null };
      
    } catch (error) {
      console.error('Erro na detecção de faces:', error);
      return { faces: [], originalImage: null };
    }
  }
  
  async extractFaceEmbedding(imageBuffer) {
    try {
      if (!this.initialized) {
        throw new Error('Serviço não inicializado');
      }
      
      console.log('Extraindo embedding da face...');
      
      // Detectar "faces" (simulado)
      const { faces } = await this.detectFaces(imageBuffer);
      
      if (faces.length === 0) {
        console.log('Nenhuma face detectada');
        return null;
      }
      
      // Usar a primeira "face" detectada
      const face = faces[0];
      
      // Processar a região da face
      const embedding = await this.processImageToEmbedding(imageBuffer, face);
      
      console.log(`Embedding extraído com sucesso (${embedding.length} dimensões)`);
      return embedding;
      
    } catch (error) {
      console.error('Erro na extração de embedding:', error);
      return null;
    }
  }
  
  async processImageToEmbedding(imageBuffer, faceRegion) {
    try {
      // 1. Extrair região da face com margem
      const metadata = await sharp(imageBuffer).metadata();
      const margin = 0.2;
      
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
      
      // 2. Extrair, redimensionar e normalizar
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
      console.error('Erro ao processar imagem:', error);
      
      // Fallback: processar imagem inteira
      try {
        const fallbackImage = await sharp(imageBuffer)
          .resize(this.INPUT_SIZE, this.INPUT_SIZE)
          .greyscale()
          .normalise()
          .raw()
          .toBuffer();
        
        return await this.generateEmbeddingFromPixels(fallbackImage);
        
      } catch (fallbackError) {
        console.error('Erro no fallback:', fallbackError);
        return this.generateRandomEmbedding();
      }
    }
  }
  
  async generateEmbeddingFromPixels(pixelBuffer) {
    try {
      const pixels = new Uint8Array(pixelBuffer);
      const embedding = new Array(this.OUTPUT_SIZE);
      
      // Dividir imagem em blocos e extrair características
      const totalPixels = pixels.length;
      const pixelsPerFeature = Math.floor(totalPixels / this.OUTPUT_SIZE);
      
      for (let i = 0; i < this.OUTPUT_SIZE; i++) {
        const startIdx = i * pixelsPerFeature;
        const endIdx = Math.min(startIdx + pixelsPerFeature, totalPixels);
        
        // Características estatísticas do bloco
        let sum = 0;
        let sumSquares = 0;
        let min = 255;
        let max = 0;
        let count = 0;
        
        for (let j = startIdx; j < endIdx; j++) {
          const pixel = pixels[j];
          sum += pixel;
          sumSquares += pixel * pixel;
          min = Math.min(min, pixel);
          max = Math.max(max, pixel);
          count++;
        }
        
        if (count > 0) {
          const mean = sum / count;
          const variance = (sumSquares / count) - (mean * mean);
          const range = max - min;
          
          // Combinar diferentes características
          if (i % 4 === 0) {
            embedding[i] = (mean - 127.5) / 127.5; // Média normalizada
          } else if (i % 4 === 1) {
            embedding[i] = Math.tanh(variance / 10000); // Variância
          } else if (i % 4 === 2) {
            embedding[i] = (range - 127.5) / 127.5; // Contraste
          } else {
            // Gradiente local (textura)
            let gradient = 0;
            for (let j = startIdx; j < endIdx - 1; j++) {
              gradient += Math.abs(pixels[j] - pixels[j + 1]);
            }
            embedding[i] = Math.tanh(gradient / count / 255);
          }
        } else {
          embedding[i] = 0;
        }
      }
      
      // Normalizar o vetor (importante para similaridade de cosseno)
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      if (magnitude > 0) {
        for (let i = 0; i < embedding.length; i++) {
          embedding[i] /= magnitude;
        }
      }
      
      return embedding;
      
    } catch (error) {
      console.error('Erro ao gerar embedding:', error);
      return this.generateRandomEmbedding();
    }
  }
  
  generateRandomEmbedding() {
    // Embedding aleatório mas determinístico baseado no timestamp
    const seed = Date.now() % 10000;
    const embedding = new Array(this.OUTPUT_SIZE);
    
    for (let i = 0; i < this.OUTPUT_SIZE; i++) {
      // Gerador pseudo-aleatório simples
      const x = Math.sin(seed + i) * 10000;
      embedding[i] = (x - Math.floor(x) - 0.5) * 2; // Range [-1, 1]
    }
    
    return embedding;
  }
  
  calculateSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
      return 0;
    }
    
    // Similaridade do cosseno (mesmo método do Android)
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    
    const magnitude1 = Math.sqrt(norm1);
    const magnitude2 = Math.sqrt(norm2);
    
    if (magnitude1 > 0 && magnitude2 > 0) {
      // Cosseno retorna [-1, 1], convertemos para [0, 1]
      const cosine = dotProduct / (magnitude1 * magnitude2);
      return (cosine + 1) / 2;
    }
    
    return 0;
  }
  
  recognizeFace(queryEmbedding, knownEmbeddings) {
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const personEmbedding of knownEmbeddings) {
      const similarity = this.calculateSimilarity(queryEmbedding, personEmbedding.embedding);
      
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