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

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares de segurança
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware de logging básico
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

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
    name: 'NosTX API',
    description: 'MVP - Plataforma de Postagens Simultâneas em X e Nostr',
    version: '1.0.0',
    endpoints: {
      auth: {
        'GET /auth/twitter/login': 'Inicia autenticação com Twitter',
        'GET /auth/twitter/callback': 'Callback do Twitter OAuth',
        'POST /auth/nostr/login': 'Autenticação com Nostr',
        'POST /auth/nostr/add': 'Adiciona Nostr a usuário existente',
        'GET /auth/nostr/generate-key': 'Gera nova chave Nostr'
      },
      posts: {
        'POST /posts': 'Cria e publica post simultaneamente',
        'GET /posts/:postId': 'Busca post por ID',
        'GET /posts/:postId/logs': 'Busca logs de publicação'
      },
      health: {
        'GET /health': 'Health check da API'
      }
    },
    authentication: 'Bearer token (JWT) no header Authorization'
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
  console.log(`🚀 NosTX API rodando na porta ${PORT}`);
  console.log(`📖 Documentação disponível em http://localhost:${PORT}`);
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