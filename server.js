require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const FaceRecognitionService = require('./services/FaceRecognitionService');
const GoogleSheetsService = require('./services/GoogleSheetsService');

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

async function initializeServices() {
  try {
    console.log('🚀 Inicializando Sistema de Cadastro Facial...\n');
    
    dbService = new GoogleSheetsService();
    await dbService.initialize();
    console.log('✅ Google Sheets inicializado');
    
    faceService = new FaceRecognitionService();
    await faceService.initialize();
    console.log('✅ Serviço de reconhecimento facial inicializado');
    
    console.log('\n✨ Todos os serviços foram inicializados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inicializar serviços:', error);
    process.exit(1);
  }
}

// Rotas

// Página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Buscar dados por CPF
app.post('/api/buscar-cpf', async (req, res) => {
  try {
    const { cpf } = req.body;
    
    if (!cpf || cpf.length !== 11) {
      return res.status(400).json({
        success: false,
        message: 'CPF deve ter 11 dígitos'
      });
    }
    
    console.log(`🔍 Buscando dados para CPF: ${cpf}`);
    
    // 1. Primeiro verificar se já existe no Google Sheets
    const pessoaCadastrada = await dbService.getPersonByCPF(cpf);
    
    if (pessoaCadastrada) {
      console.log(`✅ CPF ${cpf} encontrado no sistema: ${pessoaCadastrada.nome}`);
      
      return res.json({
        success: true,
        dados: {
          nome: pessoaCadastrada.nome,
          cpf: pessoaCadastrada.cpf,
          email: pessoaCadastrada.email || '',
          telefone: '', // Não temos no Google Sheets
          endereco: '', // Não temos no Google Sheets
          data_cadastro: pessoaCadastrada.data_cadastro,
          origem: 'sistema', // Indica que veio do nosso sistema
          ja_tem_face: true // Indica que já tem face cadastrada
        },
        message: 'Pessoa encontrada no sistema'
      });
    }
    
    // 2. Se não existe, buscar na simulação (dados externos)
    console.log(`⏳ CPF ${cpf} não encontrado no sistema, buscando dados externos...`);
    
    const dadosSimulados = await simularBuscaCPF(cpf);
    
    if (!dadosSimulados) {
      return res.status(404).json({
        success: false,
        message: 'CPF não encontrado'
      });
    }
    
    console.log(`✅ Dados externos encontrados para: ${dadosSimulados.nome}`);
    
    res.json({
      success: true,
      dados: {
        ...dadosSimulados,
        origem: 'externo', // Indica que veio de fonte externa
        ja_tem_face: false // Indica que ainda não tem face
      },
      message: 'Dados encontrados'
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar CPF:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Cadastrar face - SEMPRE permite, atualiza se já existe
app.post('/api/cadastrar-face', upload.single('foto'), async (req, res) => {
  try {
    const { cpf, nome } = req.body;
    const foto = req.file;
    
    if (!cpf || !nome || !foto) {
      return res.status(400).json({
        success: false,
        message: 'CPF, nome e foto são obrigatórios'
      });
    }
    
    console.log(`\n📸 Processando cadastro/atualização para: ${nome} (CPF: ${cpf})`);
    console.log(`📊 Tamanho da foto: ${(foto.size / 1024).toFixed(1)} KB`);
    
    // Verificar se já existe (para logs, mas NÃO bloquear)
    const existePessoa = await dbService.getPersonByCPF(cpf);
    
    if (existePessoa) {
      console.log(`⏳ Pessoa já existe: ${existePessoa.nome} - ATUALIZANDO face...`);
    } else {
      console.log(`⏳ Nova pessoa - CADASTRANDO...`);
    }
    
    // Extrair embedding da face
    console.log('🤖 Analisando face na imagem...');
    const embedding = await faceService.extractFaceEmbedding(foto.buffer);
    
    if (!embedding) {
      return res.status(400).json({
        success: false,
        message: 'Não foi possível detectar uma face na imagem. Tente com melhor iluminação e posição frontal.'
      });
    }
    
    console.log(`✅ Face processada com sucesso! Embedding de ${embedding.length} dimensões`);
    
    // Salvar no Google Sheets (sempre adiciona nova linha - histórico)
    console.log('💾 Salvando dados no Google Sheets...');
    const personId = await dbService.addPerson(cpf, nome, embedding, foto.buffer);
    
    const acao = existePessoa ? 'atualizada' : 'cadastrada';
    console.log(`🎉 Face de ${nome} ${acao} com sucesso! ID: ${personId}\n`);
    
    res.json({
      success: true,
      message: `Face de ${nome} foi ${acao} com sucesso!`,
      personId: personId,
      acao: acao // 'cadastrada' ou 'atualizada'
    });
    
  } catch (error) {
    console.error('❌ Erro ao cadastrar face:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao processar cadastro: ' + error.message
    });
  }
});

// Função para obter IP local
function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
      if (net.family === familyV4Value && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Tratamento de erros
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

// Inicializar servidor
async function startServer() {
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
  if (dbService) {
    dbService.close();
  }
  console.log('✨ Servidor finalizado com sucesso!');
  process.exit(0);
});

startServer().catch((error) => {
  console.error('❌ Erro crítico ao iniciar servidor:', error);
  process.exit(1);
});