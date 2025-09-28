const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, '..', 'data', 'face_recognition.db');
  }
  
  async initialize() {
    try {
      // Criar diretÃ³rio data se nÃ£o existir
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // Conectar ao banco
      this.db = new sqlite3.Database(this.dbPath);
      
      // Criar tabelas
      await this.createTables();
      
      console.log('âœ“ Banco de dados inicializado:', this.dbPath);
      return true;
      
    } catch (error) {
      console.error('Erro ao inicializar banco de dados:', error);
      throw error;
    }
  }
  
  async createTables() {
    return new Promise((resolve, reject) => {
      const createPersonsTable = `
        CREATE TABLE IF NOT EXISTS persons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cpf TEXT UNIQUE NOT NULL,
          nome TEXT NOT NULL,
          data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      const createEmbeddingsTable = `
        CREATE TABLE IF NOT EXISTS embeddings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          person_id INTEGER NOT NULL,
          embedding TEXT NOT NULL,
          FOREIGN KEY (person_id) REFERENCES persons (id) ON DELETE CASCADE
        )
      `;
      
      const createImagesTable = `
        CREATE TABLE IF NOT EXISTS images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          person_id INTEGER NOT NULL,
          image_data BLOB NOT NULL,
          mime_type TEXT DEFAULT 'image/jpeg',
          data_upload DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (person_id) REFERENCES persons (id) ON DELETE CASCADE
        )
      `;
      
      // Usar arrow functions para manter o contexto do this
      this.db.serialize(() => {
        this.db.run(createPersonsTable, (err) => {
          if (err) {
            console.error('Erro ao criar tabela persons:', err);
            return reject(err);
          }
        });
        
        this.db.run(createEmbeddingsTable, (err) => {
          if (err) {
            console.error('Erro ao criar tabela embeddings:', err);
            return reject(err);
          }
        });
        
        this.db.run(createImagesTable, (err) => {
          if (err) {
            console.error('Erro ao criar tabela images:', err);
            return reject(err);
          } else {
            console.log('âœ“ Tabelas do banco criadas com sucesso');
            resolve();
          }
        });
      });
    });
  }
  
  async addPerson(cpf, nome, embedding, imageBuffer) {
    return new Promise((resolve, reject) => {
      // Usar arrow functions para manter o contexto
      const db = this.db; // Salvar referÃªncia
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Inserir pessoa
        const insertPerson = `
          INSERT INTO persons (cpf, nome) 
          VALUES (?, ?)
        `;
        
        db.run(insertPerson, [cpf, nome], function(err) {
          if (err) {
            console.error('Erro ao inserir pessoa:', err);
            db.run('ROLLBACK');
            return reject(err);
          }
          
          const personId = this.lastID;
          console.log(`âœ“ Pessoa inserida com ID: ${personId}`);
          
          // Inserir embedding
          const insertEmbedding = `
            INSERT INTO embeddings (person_id, embedding) 
            VALUES (?, ?)
          `;
          
          db.run(insertEmbedding, [personId, JSON.stringify(embedding)], function(err) {
            if (err) {
              console.error('Erro ao inserir embedding:', err);
              db.run('ROLLBACK');
              return reject(err);
            }
            
            console.log('âœ“ Embedding inserido');
            
            // Inserir imagem
            const insertImage = `
              INSERT INTO images (person_id, image_data) 
              VALUES (?, ?)
            `;
            
            db.run(insertImage, [personId, imageBuffer], function(err) {
              if (err) {
                console.error('Erro ao inserir imagem:', err);
                db.run('ROLLBACK');
                return reject(err);
              }
              
              console.log('âœ“ Imagem inserida');
              
              db.run('COMMIT', (err) => {
                if (err) {
                  console.error('Erro no commit:', err);
                  reject(err);
                } else {
                  console.log(`âœ… Pessoa cadastrada com sucesso! ID: ${personId}`);
                  resolve(personId);
                }
              });
            });
          });
        });
      });
    });
  }
  
  async getAllPeople() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          p.id,
          p.cpf,
          p.nome,
          p.data_cadastro,
          e.embedding
        FROM persons p
        LEFT JOIN embeddings e ON p.id = e.person_id
        ORDER BY p.data_cadastro DESC
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) {
          console.error('Erro ao buscar pessoas:', err);
          reject(err);
        } else {
          const pessoas = rows.map(row => ({
            id: row.id,
            cpf: row.cpf,
            nome: row.nome,
            data_cadastro: row.data_cadastro,
            embedding: row.embedding ? JSON.parse(row.embedding) : null
          }));
          
          console.log(`âœ“ ${pessoas.length} pessoas encontradas no banco`);
          resolve(pessoas);
        }
      });
    });
  }
  
  async getPersonById(id) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          p.id,
          p.cpf,
          p.nome,
          p.data_cadastro,
          e.embedding
        FROM persons p
        LEFT JOIN embeddings e ON p.id = e.person_id
        WHERE p.id = ?
      `;
      
      this.db.get(query, [id], (err, row) => {
        if (err) {
          console.error('Erro ao buscar pessoa por ID:', err);
          reject(err);
        } else if (row) {
          resolve({
            id: row.id,
            cpf: row.cpf,
            nome: row.nome,
            data_cadastro: row.data_cadastro,
            embedding: row.embedding ? JSON.parse(row.embedding) : null
          });
        } else {
          resolve(null);
        }
      });
    });
  }
  
  async getPersonByCPF(cpf) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          p.id,
          p.cpf,
          p.nome,
          p.data_cadastro,
          e.embedding
        FROM persons p
        LEFT JOIN embeddings e ON p.id = e.person_id
        WHERE p.cpf = ?
      `;
      
      this.db.get(query, [cpf], (err, row) => {
        if (err) {
          console.error('Erro ao buscar pessoa por CPF:', err);
          reject(err);
        } else if (row) {
          resolve({
            id: row.id,
            cpf: row.cpf,
            nome: row.nome,
            data_cadastro: row.data_cadastro,
            embedding: row.embedding ? JSON.parse(row.embedding) : null
          });
        } else {
          resolve(null);
        }
      });
    });
  }
  
  async deletePerson(id) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM persons WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Erro ao deletar pessoa:', err);
          reject(err);
        } else {
          console.log(`âœ“ Pessoa ${id} deletada (${this.changes} registros afetados)`);
          resolve(this.changes > 0);
        }
      });
    });
  }
  
  async getPersonImage(personId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT image_data, mime_type 
        FROM images 
        WHERE person_id = ? 
        ORDER BY data_upload DESC 
        LIMIT 1
      `;
      
      this.db.get(query, [personId], (err, row) => {
        if (err) {
          console.error('Erro ao buscar imagem:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
  
  async testConnection() {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT 1 as test', [], (err, row) => {
        if (err) {
          console.error('Erro no teste de conexÃ£o:', err);
          reject(err);
        } else {
          console.log('âœ… ConexÃ£o com banco testada com sucesso');
          resolve(true);
        }
      });
    });
  }
  
  async getStats() {
    return new Promise((resolve, reject) => {
      const queries = [
        'SELECT COUNT(*) as total_persons FROM persons',
        'SELECT COUNT(*) as total_embeddings FROM embeddings',
        'SELECT COUNT(*) as total_images FROM images'
      ];
      
      let results = {};
      let completed = 0;
      
      queries.forEach((query, index) => {
        this.db.get(query, [], (err, row) => {
          if (err) {
            console.error(`Erro na consulta ${index}:`, err);
            return reject(err);
          }
          
          const key = Object.keys(row)[0];
          results[key] = row[key];
          completed++;
          
          if (completed === queries.length) {
            resolve(results);
          }
        });
      });
    });
  }
  
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Erro ao fechar banco:', err);
        } else {
          console.log('âœ“ ConexÃ£o com banco fechada');
        }
      });
    }
  }
}

module.exports = DatabaseService;