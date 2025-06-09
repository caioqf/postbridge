import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import database from '../database';
import twitterService from '../services/twitter';
import nostrService from '../services/nostr';
import { generateToken, authenticateToken, AuthRequest } from '../middleware/auth';
import { encrypt, decrypt } from '../utils/crypto';
import { User, NostrAuthRequest } from '../types';
import bcrypt from 'bcrypt';

const router = Router();

// Armazena temporariamente os tokens OAuth do Twitter
const tempTwitterTokens = new Map<string, { oauthToken: string; oauthTokenSecret: string; userId?: string }>();

// Registro no PostBridge
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Verifica se usuário já existe
    const existingUser = await database.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Cria usuário
    const userId = randomUUID();
    const user: User = {
      id: userId,
      email,
      name: name || email.split('@')[0],
      password: hashedPassword,
      createdAt: new Date()
    };

    await database.createUser(user);

    // Gera JWT
    const token = generateToken(userId);

    res.json({
      success: true,
      token,
      userId,
      user: {
        id: userId,
        email,
        name: user.name
      },
      message: 'Account created successfully! You can now connect your social platforms.'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Login no PostBridge
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Busca usuário
    const user = await database.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verifica senha
    const isValidPassword = await bcrypt.compare(password, user.password!);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Gera JWT
    const token = generateToken(user.id);

    res.json({
      success: true,
      token,
      userId: user.id,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        connectedPlatforms: {
          x: !!(user.twitterAccessToken && user.twitterAccessSecret),
          nostr: !!user.nostrPrivateKey
        }
      },
      message: 'Login successful!'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Conectar Nostr à conta existente
router.post('/connect/nostr', authenticateToken, async (req: AuthRequest, res: Response) => {
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
      publicKey: nostrService.getPublicKey(privateKey),
      message: 'Nostr account connected successfully!'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Conectar X à conta existente
router.post('/connect/x', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    if (!twitterService.isTwitterConfigured()) {
      return res.status(400).json({ 
        error: 'X API credentials not configured',
        details: 'Check TWITTER_CONSUMER_KEY and TWITTER_CONSUMER_SECRET in .env'
      });
    }

    const { url, oauthToken, oauthTokenSecret } = await twitterService.getAuthUrl();
    
    // Armazena temporariamente os tokens com referência ao userId
    tempTwitterTokens.set(oauthToken, { 
      oauthToken, 
      oauthTokenSecret,
      userId
    });
    
    // Remove após 10 minutos
    setTimeout(() => {
      tempTwitterTokens.delete(oauthToken);
    }, 10 * 60 * 1000);

    res.json({
      authUrl: url,
      sessionId: oauthToken,
      message: 'Complete the X authorization to connect your account'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Callback do X OAuth (atualiza usuário existente)
router.get('/x/callback', async (req: Request, res: Response) => {
  try {
    console.log('🔄 Callback X recebido:', req.query);
    
    const { oauth_token, oauth_verifier } = req.query;
    
    if (!oauth_token || !oauth_verifier) {
      console.log('❌ Parâmetros OAuth ausentes:', { oauth_token, oauth_verifier });
      return res.status(400).json({ error: 'Missing OAuth parameters' });
    }

    // Busca os tokens temporários usando oauth_token
    const tempTokens = tempTwitterTokens.get(oauth_token as string);
    
    if (!tempTokens) {
      console.log('❌ Sessão não encontrada para oauth_token:', oauth_token);
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

    // Atualiza usuário existente
    if (tempTokens.userId) {
      await database.updateUserTwitterTokens(
        tempTokens.userId,
        encrypt(accessToken),
        encrypt(accessSecret)
      );
      console.log('✅ X conectado ao usuário existente:', tempTokens.userId);
    }

    // Limpa tokens temporários
    tempTwitterTokens.delete(oauth_token as string);

    res.json({
      success: true,
      message: 'X account connected successfully! You can now close this window.',
      connectedPlatform: 'x'
    });
  } catch (error: any) {
    console.error('❌ Erro no callback X:', error);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.data : undefined
    });
  }
});

// Status das conexões do usuário
router.get('/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const user = await database.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let nostrPublicKey = null;
    if (user.nostrPrivateKey) {
      try {
        const decryptedPrivateKey = decrypt(user.nostrPrivateKey);
        nostrPublicKey = nostrService.getPublicKey(decryptedPrivateKey);
      } catch (error) {
        console.error('Error decrypting Nostr key:', error);
      }
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      connectedPlatforms: {
        x: !!(user.twitterAccessToken && user.twitterAccessSecret),
        nostr: !!user.nostrPrivateKey
      },
      nostrPublicKey
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