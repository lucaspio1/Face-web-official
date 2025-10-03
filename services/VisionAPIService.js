// VisionAPIService.js

const { ImageAnnotatorClient } = require('@google-cloud/vision');

// Tenta ler o ID do projeto do .env ou de outras variáveis padrão
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GCLOUD_PROJECT;

class VisionAPIService {
  constructor() {
    // O Cliente AGORA usa o ID do seu projeto para cotas
    this.client = new ImageAnnotatorClient({
        // O cliente usará GOOGLE_APPLICATION_CREDENTIALS para a chave,
        // e este projectId para definir o projeto de cotas.
        projectId: PROJECT_ID, 
    });
    
    if (!PROJECT_ID) {
        console.warn('⚠️ GCLOUD_PROJECT ID não definido. A Cloud Vision API pode falhar.');
    }
  }
  
  async detectFace(imageBuffer) {
    // ... (restante do código: console.log, imageBase64, request)
    console.log('🤖 Chamando Google Cloud Vision API para detecção de face...');
    
    // Converte o buffer da imagem para Base64, que a API da Vision aceita
    const imageBase64 = imageBuffer.toString('base64');

    const request = {
      image: {
        content: imageBase64,
      },
      features: [
        {
          type: 'FACE_DETECTION',
        },
      ],
    };

    try {
      const [result] = await this.client.annotateImage(request);
      
      const faces = result.faceAnnotations;
      
      if (!faces || faces.length === 0) {
        console.log('❌ Nenhuma face detectada pela Vision API.');
        return null;
      }
      
      // Retorna a primeira face detectada
      const face = faces[0];
      
      // Converte o Poly-box retornado pela API em um formato simples (Bounding Box)
      const boundingPoly = face.boundingPoly.vertices;
      
      const boundingBox = {
        x: boundingPoly[0].x,
        y: boundingPoly[0].y,
        width: boundingPoly[2].x - boundingPoly[0].x,
        height: boundingPoly[2].y - boundingPoly[0].y,
      };

      console.log('✅ Face detectada pela Vision API. Bounding Box:', boundingBox);
      return boundingBox;
      
    } catch (error) {
      console.error('Erro na chamada à Vision API:', error);
      throw new Error('Falha na detecção facial externa.');
    }
  }
}

module.exports = VisionAPIService;