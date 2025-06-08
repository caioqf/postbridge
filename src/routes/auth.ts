import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import database from '../database';
import twitterService from '../services/twitter';
import nostrService from '../services/nostr';
import { generateToken, authenticateToken, AuthRequest } from '../middleware/auth';
import { encrypt } from '../utils/crypto';
import { User, NostrAuthRequest } from '../types';

const router = Router();

// Armazena temporariamente os tokens OAuth do Twitter
const tempTwitterTokens = new Map<string, { oauthToken: string; oauthTokenSecret: string }>();

// Inicia autenticação com Twitter
router.get('/twitter/login', async (req: Request, res: Response) => {
  try {
    console.log('🔍 Iniciando autenticação Twitter...');
    console.log('📋 Configurações:', {
      hasConsumerKey: !!process.env.TWITTER_CONSUMER_KEY,
      hasConsumerSecret: !!process.env.TWITTER_CONSUMER_SECRET,
      callbackUrl: process.env.TWITTER_CALLBACK_URL,
      isConfigured: twitterService.isTwitterConfigured()
    });

    if (!twitterService.isTwitterConfigured()) {
      console.log('❌ Twitter não configurado');
      return res.status(400).json({ 
        error: 'Twitter API credentials not configured',
        details: 'Check TWITTER_CONSUMER_KEY and TWITTER_CONSUMER_SECRET in .env'
      });
    }

    const { url, oauthToken, oauthTokenSecret } = await twitterService.getAuthUrl();
    
    // Armazena temporariamente os tokens usando oauth_token como chave
    tempTwitterTokens.set(oauthToken, { oauthToken, oauthTokenSecret });
    
    // Remove após 10 minutos
    setTimeout(() => {
      tempTwitterTokens.delete(oauthToken);
    }, 10 * 60 * 1000);

    console.log('✅ URL de autorização gerada:', url);
    console.log('🔑 OAuth token armazenado:', oauthToken);

    res.json({
      authUrl: url,
      sessionId: oauthToken // Retorna o oauth_token como sessionId para referência
    });
  } catch (error: any) {
    console.error('❌ Erro na autenticação Twitter:', {
      message: error.message,
      code: error.code,
      data: error.data,
      stack: error.stack
    });
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.data : undefined
    });
  }
});

// Callback do Twitter OAuth
router.get('/twitter/callback', async (req: Request, res: Response) => {
  try {
    console.log('🔄 Callback Twitter recebido:', req.query);
    
    const { oauth_token, oauth_verifier } = req.query;
    
    if (!oauth_token || !oauth_verifier) {
      console.log('❌ Parâmetros OAuth ausentes:', { oauth_token, oauth_verifier });
      return res.status(400).json({ error: 'Missing OAuth parameters' });
    }

    // Busca os tokens temporários usando oauth_token
    const tempTokens = tempTwitterTokens.get(oauth_token as string);
    
    if (!tempTokens) {
      console.log('❌ Sessão não encontrada para oauth_token:', oauth_token);
      console.log('🗂️ Tokens disponíveis:', Array.from(tempTwitterTokens.keys()));
      return res.status(400).json({ 
        error: 'Invalid or expired session',
        details: `OAuth token ${oauth_token} not found in temporary storage`
      });
    }

    console.log('✅ Tokens temporários encontrados, trocando por access tokens...');

    // Troca por tokens de acesso
    const { accessToken, accessSecret } = await twitterService.getAccessTokens(
      tempTokens.oauthToken,
      tempTokens.oauthTokenSecret,
      oauth_verifier as string
    );

    console.log('✅ Access tokens obtidos com sucesso');

    // Cria ou atualiza usuário
    const userId = randomUUID();
    const user: User = {
      id: userId,
      createdAt: new Date(),
      twitterAccessToken: encrypt(accessToken),
      twitterAccessSecret: encrypt(accessSecret)
    };

    await database.createUser(user);
    console.log('✅ Usuário criado:', userId);

    // Limpa tokens temporários
    tempTwitterTokens.delete(oauth_token as string);

    // Gera JWT
    const token = generateToken(userId);

    res.json({
      success: true,
      token,
      userId,
      message: 'Twitter authentication successful! You can now use this token to make authenticated requests.'
    });
  } catch (error: any) {
    console.error('❌ Erro no callback Twitter:', {
      message: error.message,
      code: error.code,
      data: error.data,
      stack: error.stack
    });
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.data : undefined
    });
  }
});

// Autenticação com Nostr
router.post('/nostr/login', async (req: Request, res: Response) => {
  try {
    const { privateKey }: NostrAuthRequest = req.body;

    if (!privateKey) {
      return res.status(400).json({ error: 'Private key is required' });
    }

    // Valida a chave privada
    if (!nostrService.isValidPrivateKey(privateKey)) {
      return res.status(400).json({ error: 'Invalid private key' });
    }

    // Cria usuário
    const userId = randomUUID();
    const user: User = {
      id: userId,
      createdAt: new Date(),
      nostrPrivateKey: encrypt(privateKey)
    };

    await database.createUser(user);

    // Gera JWT
    const token = generateToken(userId);

    res.json({
      success: true,
      token,
      userId,
      publicKey: nostrService.getPublicKey(privateKey)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Adiciona autenticação Nostr a usuário existente
router.post('/nostr/add', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { privateKey }: NostrAuthRequest = req.body;
    const userId = req.userId!;

    if (!privateKey) {
      return res.status(400).json({ error: 'Private key is required' });
    }

    // Valida a chave privada
    if (!nostrService.isValidPrivateKey(privateKey)) {
      return res.status(400).json({ error: 'Invalid private key' });
    }

    // Atualiza usuário
    await database.updateUserNostrKey(userId, encrypt(privateKey));

    res.json({
      success: true,
      publicKey: nostrService.getPublicKey(privateKey)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Gera nova chave privada Nostr
router.get('/nostr/generate-key', (req: Request, res: Response) => {
  try {
    const privateKey = nostrService.generatePrivateKey();
    const publicKey = nostrService.getPublicKey(privateKey);

    res.json({
      privateKey,
      publicKey
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router; 