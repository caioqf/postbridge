// Carrega variáveis de ambiente PRIMEIRO
import dotenv from 'dotenv';
dotenv.config();

// Polyfill para WebSocket no Node.js (necessário para nostr-tools)
import WebSocket from 'ws';
(global as any).WebSocket = WebSocket;

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

// Importa as rotas
import authRoutes from './routes/auth';
import postRoutes from './routes/posts';
import xService from './services/x';

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares de segurança
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rotas
app.use('/auth', authRoutes);
app.use('/posts', postRoutes);

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Rota raiz com documentação básica
app.get('/', (req, res) => {
  res.json({
    name: 'PostBridge API',
    version: '1.0.0',
    description: 'Plataforma de Postagens Simultâneas em X e Nostr',
    endpoints: {
      health: 'GET /health',
      auth: {
        postbridge: {
          register: 'POST /auth/register',
          login: 'POST /auth/login',
          status: 'GET /auth/status'
        },
        connect: {
          x: 'POST /auth/connect/x',
          nostr: 'POST /auth/connect/nostr'
        },
        disconnect: {
          x: 'POST /auth/disconnect/x',
          nostr: 'POST /auth/disconnect/nostr'
        }
      },
      posts: {
        create: 'POST /posts',
        getById: 'GET /posts/:id',
        getLogs: 'GET /posts/:id/logs'
      }
    },
    flow: {
      '1': 'Register/Login to PostBridge',
      '2': 'Connect your social platforms (X and/or Nostr)',
      '3': 'Publish simultaneously to connected platforms'
    },
    documentation: 'Consulte o README e a collection do Postman para mais detalhes'
  });
});

// Middleware de tratamento de erros
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`🚀 PostBridge API rodando na porta ${PORT}`);
  console.log(`📖 Documentação: http://localhost:${PORT}/`);
  console.log(`🔐 X OAuth: ${xService.isXConfigured() ? '✅ Configurado' : '❌ Não configurado'}`);
  console.log(`🏥 Health check em http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
}); 