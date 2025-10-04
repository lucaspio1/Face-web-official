#!/usr/bin/env python3
"""
Servidor ArcFace para Reconhecimento Facial
Integrado com projeto existente (Google Vision + Google Sheets)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import cv2
import sqlite3
import base64
from datetime import datetime
import insightface
from insightface.app import FaceAnalysis

app = Flask(__name__)
CORS(app)

# Configurações
SIMILARITY_THRESHOLD = 0.4
DB_PATH = 'arcface_embeddings.db'

# Inicializar ArcFace
print("Inicializando ArcFace...")
face_app = FaceAnalysis(providers=['CPUExecutionProvider'])
face_app.prepare(ctx_id=0, det_size=(640, 640))
print("ArcFace pronto!")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS people (
            id TEXT PRIMARY KEY,
            cpf TEXT UNIQUE,
            nome TEXT,
            email TEXT,
            telefone TEXT,
            data_cadastro TEXT,
            embedding BLOB,
            foto_base64 TEXT
        )
    ''')
    conn.commit()
    conn.close()
    print("Banco de dados SQLite inicializado")

init_db()

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'online',
        'timestamp': datetime.now().isoformat(),
        'model': 'ArcFace',
        'threshold': SIMILARITY_THRESHOLD,
        'embedding_size': 512
    })

@app.route('/extract-embedding', methods=['POST'])
def extract_embedding():
    """Extrai embedding da imagem durante cadastro"""
    try:
        data = request.json
        image_base64 = data.get('image')
        
        if not image_base64:
            return jsonify({'success': False, 'error': 'Imagem nao fornecida'}), 400
        
        if 'base64,' in image_base64:
            image_base64 = image_base64.split('base64,')[1]
        
        img_data = base64.b64decode(image_base64)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({'success': False, 'error': 'Imagem invalida'}), 400
        
        faces = face_app.get(img)
        
        if len(faces) == 0:
            return jsonify({'success': False, 'error': 'Nenhum rosto detectado'}), 400
        
        face = faces[0]
        embedding = face.embedding.tolist()
        
        print(f"Embedding extraido: {len(embedding)} dimensoes")
        
        return jsonify({
            'success': True,
            'embedding': embedding,
            'embedding_size': len(embedding)
        })
    
    except Exception as e:
        print(f"Erro ao extrair embedding: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/recognize', methods=['POST'])
def recognize():
    """Reconhecer pessoa a partir de imagem"""
    try:
        data = request.json
        image_base64 = data.get('image')
        
        if not image_base64:
            return jsonify({'error': 'Imagem nao fornecida'}), 400
        
        if 'base64,' in image_base64:
            image_base64 = image_base64.split('base64,')[1]
        
        img_data = base64.b64decode(image_base64)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({'error': 'Imagem invalida'}), 400
        
        faces = face_app.get(img)
        
        if len(faces) == 0:
            return jsonify({'recognized': False, 'message': 'Nenhum rosto detectado'})
        
        face = faces[0]
        embedding = face.embedding
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('SELECT id, cpf, nome, email, telefone, embedding FROM people')
        people = c.fetchall()
        conn.close()
        
        if not people:
            return jsonify({'recognized': False, 'message': 'Nenhuma pessoa cadastrada'})
        
        best_match = None
        best_similarity = float('inf')
        
        for person in people:
            person_id, cpf, nome, email, telefone, embedding_blob = person
            stored_embedding = np.frombuffer(embedding_blob, dtype=np.float32)
            
            similarity = np.dot(embedding, stored_embedding) / (
                np.linalg.norm(embedding) * np.linalg.norm(stored_embedding)
            )
            distance = 1 - similarity
            
            if distance < best_similarity:
                best_similarity = distance
                best_match = {
                    'id': person_id,
                    'cpf': cpf,
                    'nome': nome,
                    'email': email,
                    'telefone': telefone,
                    'confidence': float(1 - distance)
                }
        
        if best_similarity < SIMILARITY_THRESHOLD:
            return jsonify({
                'recognized': True,
                'person': best_match,
                'confidence': best_match['confidence'],
                'distance': float(best_similarity)
            })
        else:
            return jsonify({
                'recognized': False,
                'message': 'Pessoa nao reconhecida',
                'best_distance': float(best_similarity)
            })
    
    except Exception as e:
        print(f"Erro no reconhecimento: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/add-person', methods=['POST'])
def add_person():
    """Adicionar pessoa ao banco ArcFace"""
    try:
        data = request.json
        
        person_id = data.get('id')
        cpf = data.get('cpf')
        nome = data.get('nome')
        email = data.get('email', '')
        telefone = data.get('telefone', '')
        embedding = data.get('embedding')
        data_cadastro = data.get('data_cadastro', datetime.now().isoformat())
        
        if not all([person_id, cpf, nome, embedding]):
            return jsonify({'success': False, 'error': 'Dados incompletos'}), 400
        
        embedding_array = np.array(embedding, dtype=np.float32)
        embedding_blob = embedding_array.tobytes()
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        try:
            c.execute('''
                INSERT OR REPLACE INTO people 
                (id, cpf, nome, email, telefone, data_cadastro, embedding, foto_base64)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (person_id, cpf, nome, email, telefone, data_cadastro, embedding_blob, ''))
            conn.commit()
            
            print(f"Pessoa {nome} adicionada ao ArcFace")
            
            return jsonify({'success': True, 'message': f'Pessoa {nome} adicionada'})
        
        except sqlite3.IntegrityError as e:
            return jsonify({'success': False, 'error': str(e)}), 400
        
        finally:
            conn.close()
    
    except Exception as e:
        print(f"Erro ao adicionar pessoa: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/sync-from-sheets', methods=['POST'])
def sync_from_sheets():
    """Sincronizar multiplas pessoas do Google Sheets"""
    try:
        data = request.json
        people = data.get('people', [])
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        c.execute('DELETE FROM people')
        
        inserted = 0
        for person in people:
            try:
                embedding = np.array(person['embedding'], dtype=np.float32)
                embedding_blob = embedding.tobytes()
                
                c.execute('''
                    INSERT INTO people (id, cpf, nome, email, telefone, data_cadastro, embedding, foto_base64)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    person['id'],
                    person['cpf'],
                    person['nome'],
                    person.get('email', ''),
                    person.get('telefone', ''),
                    person.get('data_cadastro', datetime.now().isoformat()),
                    embedding_blob,
                    ''
                ))
                inserted += 1
            except Exception as e:
                print(f"Erro ao inserir {person.get('nome')}: {e}")
        
        conn.commit()
        conn.close()
        
        print(f"{inserted} pessoas sincronizadas")
        
        return jsonify({'success': True, 'inserted': inserted, 'message': f'{inserted} pessoas sincronizadas'})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/people', methods=['GET'])
def get_people():
    """Listar todas as pessoas cadastradas"""
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('SELECT id, cpf, nome, email, telefone, data_cadastro FROM people')
        people = c.fetchall()
        conn.close()
        
        result = []
        for person in people:
            result.append({
                'id': person[0],
                'cpf': person[1],
                'nome': person[2],
                'email': person[3],
                'telefone': person[4],
                'data_cadastro': person[5]
            })
        
        return jsonify({'success': True, 'count': len(result), 'people': result})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("\n" + "="*60)
    print("SERVIDOR ARCFACE INICIANDO")
    print("="*60)
    print(f"URL: http://localhost:5000")
    print(f"Modelo: ArcFace (512D embeddings)")
    print(f"Threshold: {SIMILARITY_THRESHOLD}")
    print(f"Database: {DB_PATH}")
    print("="*60 + "\n")
    
    app.run(host='0.0.0.0', port=5000, debug=True)