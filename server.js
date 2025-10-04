// server.js

require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const os = require('os'); // Adicionado para getLocalIP

const ArcFaceService = require('./services/ArcFaceService');
const GoogleSheetsService = require('./services/GoogleSheetsService');
const VisionAPIService = require('./services/VisionAPIService');

const app = express();
const PORT = process.env.PORT || 3000; 

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configuração do multer para upload de imagens
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use JPEG ou PNG.'));
    }
  }
});

// Inicialização dos serviços
let faceService;
let dbService;
let visionService; 

async function initializeServices() {
  try {
    console.log('🚀 Inicializando Sistema de Cadastro Facial...\n');
    
    // Serviço de Banco de Dados
    dbService = new GoogleSheetsService();
    await dbService.initialize();
    console.log('✅ Google Sheets inicializado');
    
    // Serviço Google Cloud Vision
    visionService = new VisionAPIService();
    console.log('✅ Serviço Cloud Vision inicializado (Autenticação gcloud OK)');
    
    // Serviço de Reconhecimento Facial (Customizado)
   faceService = new ArcFaceService();;
    await faceService.initialize();
    console.log('✅ Serviço de reconhecimento facial inicializado');
    
    console.log('\n✨ Todos os serviços foram inicializados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inicializar serviços:', error);
    throw error; 
  }
}

// Rota para servir o index.html (mantida)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota de busca de CPF (ATUALIZADA a resposta para compatibilidade com a nova estrutura de dados do frontend)
app.post('/api/buscar-cpf', async (req, res) => {
    try {
        const { cpf } = req.body;
        if (!cpf) {
            return res.status(400).json({ success: false, message: 'CPF é obrigatório para busca.' });
        }

        console.log(`\n🔍 Buscando informações para CPF: ${cpf}`);
        
        // 1. Buscar dados no Google Sheets (Apps Script buscará na aba 'Alunos')
        const personData = await dbService.getPersonByCPF(cpf);

        if (!personData) {
            console.log('❌ CPF não encontrado no banco.');
            return res.json({ success: false, message: 'CPF não encontrado na lista de Alunos.', dadosPessoa: null });
        }
        
        // Retorna todos os dados para que o frontend os envie de volta no cadastro
        console.log(`✅ Pessoa encontrada: ${personData.nome}`);
        
        res.json({
            success: true,
            message: `Pessoa encontrada: ${personData.nome}`,
            // O frontend espera 'dadosPessoa' (antigo 'data' do Apps Script)
            dadosPessoa: personData
        });

    } catch (error) {
        console.error('❌ Erro ao buscar CPF:', error);
        res.status(500).json({ success: false, message: 'Erro ao processar busca: ' + error.message });
    }
});


// ROTA /api/cadastrar-face (ATUALIZADA: Envia todos os dados)
app.post('/api/cadastrar-face', upload.single('foto'), async (req, res) => {
  try {
    // RECEBE TODOS OS NOVOS DADOS DO FRONTEND
    const { id, cpf, nome, email, telefone } = req.body; 
    const foto = req.file; 
    
    if (!cpf || !nome || !foto) {
      return res.status(400).json({
        success: false,
        message: 'CPF, nome e foto são obrigatórios'
      });
    }
    
    console.log(`\n📸 Processando cadastro/atualização para: ${nome} (CPF: ${cpf})`);
    
    // 1. Detecção de Face com Cloud Vision API
    console.log('🤖 Detectando rosto com Google Cloud Vision API...');
    const faceBox = await visionService.detectFace(foto.buffer); 

    if (!faceBox) {
      return res.status(400).json({
        success: false,
        message: 'Não foi possível detectar uma face válida na imagem. Tente uma foto mais clara.'
      });
    }
    
    // 2. Extrair embedding da face usando as coordenadas da Vision API
    console.log('🤖 Analisando face na imagem (Gerando Embedding)...');
    const embedding = await faceService.extractFaceEmbedding(foto.buffer, faceBox); 
    
    if (!embedding) {
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao processar a face para embedding.'
      });
    }
    
    console.log(`✅ Face processada com sucesso! Embedding de ${embedding.length} dimensões`);
    
    // 3. Salvar no Google Sheets (Passando todos os campos extras)
    console.log('💾 Salvando dados no Google Sheets e atualizando status do Aluno...');
    
    // O retorno da função não será mais 'existePessoa', mas sim o ID do cadastro
    const personIdRetornado = await dbService.addPerson(
        cpf, 
        nome, 
        embedding, 
        foto.buffer,
        email, 
        telefone, 
        id // ID do aluno
    );
    
    // Assumimos que a ação é sempre 'cadastrada/atualizada' no novo fluxo
    const acao = 'cadastrada'; 
    console.log(`🎉 Face de ${nome} ${acao} com sucesso! ID: ${personIdRetornado}\n`);
    
    res.json({
      success: true,
      message: `Face de ${nome} foi ${acao} com sucesso!`,
      personId: personIdRetornado,
      acao: acao
    });
    
  } catch (error) {
    console.error('❌ Erro ao cadastrar face:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao processar cadastro: ' + error.message
    });
  }
});


// Tratamento de erros de middlewares (Multer, etc.)
app.use((error, req, res, next) => {
  console.error('❌ Erro no servidor:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Arquivo muito grande. Máximo 5MB.'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor'
  });
});

// Função utilitária para obter IP local (mantida)
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return 'IP_NAO_ENCONTRADO';
}

// Inicializar servidor
async function startServer() {
  // 1. Inicializa serviços (só acontece uma vez)
  await initializeServices();
  
  const HOST = '0.0.0.0';
  const localIP = getLocalIP();
  
   app.listen(PORT, HOST, () => {
    console.log(`\n🌟 ============================================`);
    console.log(`🚀 SISTEMA DE CADASTRO FACIAL INICIADO!`);
    console.log(`🌐 Acesso Local: http://localhost:${PORT}`);
    console.log(`📱 Acesso Rede: http://${localIP}:${PORT}`);
    console.log(`📊 Banco: Google Sheets`);
    console.log(`============================================\n`);
    
    console.log(`🧪 CPFs de teste:`);
    console.log(`   12345678901 - João Silva Santos`);
    console.log(`   98765432100 - Maria Oliveira Costa`);
    console.log(`   11122233344 - Pedro Santos Lima`);
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Parando servidor...');
  if (dbService && dbService.close) { // Adicionado check para garantir que existe
      dbService.close();
  }
  console.log('✨ Servidor finalizado com sucesso!');
  process.exit(0);
});

// ÚNICA CHAMADA: Inicia o servidor e trata erros de inicialização.
startServer().catch((error) => { 
  console.error('❌ Erro crítico ao iniciar servidor:', error.message);
  process.exit(1);
});