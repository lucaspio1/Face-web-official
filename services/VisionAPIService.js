// VisionAPIService.js

const { ImageAnnotatorClient } = require('@google-cloud/vision');

// Opcional: tenta ler o Project ID em dev local
// Dentro do Cloud Run/VM/GKE não precisa, o SDK descobre sozinho
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;

class VisionAPIService {
  constructor() {
    // Se PROJECT_ID existir, passa; senão deixa o SDK resolver sozinho
    this.client = new ImageAnnotatorClient(
      PROJECT_ID ? { projectId: PROJECT_ID } : {}
    );

    if (!PROJECT_ID) {
      console.warn('⚠️ GCLOUD_PROJECT não definido. No Cloud Run isso é normal.');
    }
  }
  
  async detectFace(imageBuffer) {
    console.log('🤖 Chamando Google Cloud Vision API para detecção de face...');
    
    // Converte imagem para Base64
    const imageBase64 = imageBuffer.toString('base64');

    const request = {
      image: { content: imageBase64 },
      features: [{ type: 'FACE_DETECTION' }],
    };

    try {
      const [result] = await this.client.annotateImage(request);
      const faces = result.faceAnnotations;

      if (!faces || faces.length === 0) {
        console.log('❌ Nenhuma face detectada pela Vision API.');
        return null;
      }

      const face = faces[0];
      const boundingPoly = face.boundingPoly.vertices;

      const boundingBox = {
        x: boundingPoly[0].x,
        y: boundingPoly[0].y,
        width: boundingPoly[2].x - boundingPoly[0].x,
        height: boundingPoly[2].y - boundingPoly[0].y,
      };

      console.log('✅ Face detectada. Bounding Box:', boundingBox);
      return boundingBox;
    } catch (error) {
      console.error('Erro na Vision API:', error.message || error);
      throw new Error('Falha na detecção facial externa.');
    }
  }
}

module.exports = VisionAPIService;
