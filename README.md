# PostBridge - MVP Plataforma de Postagens Simultâneas

API REST em Node.js/TypeScript que permite agendar e publicar simultaneamente o mesmo conteúdo no X (antigo Twitter) e na rede Nostr.

## 🚀 Funcionalidades

- ✅ Autenticação OAuth 1.0a com Twitter/X
- ✅ Autenticação com chaves privadas Nostr
- ✅ Publicação simultânea em ambas as plataformas
- ✅ Logs detalhados de publicação
- ✅ Armazenamento seguro de credenciais (criptografadas)
- ✅ API REST documentada
- ✅ Validações de conteúdo e mídia

## 📋 Pré-requisitos

- Node.js 18+ 
- NPM ou Yarn
- Credenciais da API do Twitter (Consumer Key e Secret)

## 🛠️ Instalação

1. **Clone o repositório:**
```bash
git clone <repository-url>
cd postbridge
```

2. **Instale as dependências:**
```bash
npm install
```

3. **Configure as variáveis de ambiente:**
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=seu-jwt-secret-super-seguro-aqui
TWITTER_CONSUMER_KEY=sua-twitter-consumer-key
TWITTER_CONSUMER_SECRET=seu-twitter-consumer-secret
TWITTER_CALLBACK_URL=http://localhost:3000/auth/twitter/callback
DATABASE_PATH=./database.sqlite
ENCRYPTION_KEY=sua-chave-de-criptografia-32-chars
```

4. **Compile o TypeScript:**
```bash
npm run build
```

5. **Inicie a aplicação:**
```bash
# Desenvolvimento (com hot reload)
npm run dev

# Produção
npm start
```

## 📖 Uso da API

### Autenticação

#### Twitter/X
```bash
# 1. Inicia o fluxo OAuth
GET /auth/twitter/login

# 2. Usuário é redirecionado para autorizar
# 3. Callback automático retorna token JWT
GET /auth/twitter/callback?oauth_token=...&oauth_verifier=...
```

#### Nostr
```bash
# Login com chave privada existente
POST /auth/nostr/login
{
  "privateKey": "sua-chave-privada-hex"
}

# Gerar nova chave privada
GET /auth/nostr/generate-key

# Adicionar Nostr a usuário existente (requer autenticação)
POST /auth/nostr/add
Authorization: Bearer <jwt-token>
{
  "privateKey": "sua-chave-privada-hex"
}
```

### Publicação

```bash
# Criar e publicar post simultaneamente
POST /posts
Authorization: Bearer <jwt-token>
{
  "content": "Meu primeiro post simultâneo! #postbridge",
  "mediaUrls": ["https://exemplo.com/imagem.jpg"] // opcional
}

# Buscar post por ID
GET /posts/:postId
Authorization: Bearer <jwt-token>

# Buscar logs de publicação
GET /posts/:postId/logs
Authorization: Bearer <jwt-token>
```

### Health Check

```bash
GET /health
```

## 🔧 Estrutura do Projeto

```
src/
├── database/          # Configuração SQLite
├── middleware/        # Middlewares (auth JWT)
├── routes/           # Rotas da API
├── services/         # Lógica de negócio
│   ├── twitter.ts    # Integração Twitter API
│   ├── nostr.ts      # Integração Nostr
│   └── publisher.ts  # Orquestração de publicações
├── types/            # Tipos TypeScript
├── utils/            # Utilitários (crypto)
└── index.ts          # Arquivo principal
```

## 🔐 Segurança

- **Criptografia**: Tokens e chaves privadas são criptografados antes do armazenamento
- **JWT**: Autenticação via tokens JWT com expiração
- **HTTPS**: Use HTTPS em produção
- **Helmet**: Headers de segurança configurados
- **CORS**: Configurado para controle de acesso

## 🧪 Testando a API

### Exemplo completo de uso:

1. **Gere uma chave Nostr:**
```bash
curl http://localhost:3000/auth/nostr/generate-key
```

2. **Faça login com Nostr:**
```bash
curl -X POST http://localhost:3000/auth/nostr/login \
  -H "Content-Type: application/json" \
  -d '{"privateKey":"sua-chave-privada-aqui"}'
```

3. **Publique um post:**
```bash
curl -X POST http://localhost:3000/posts \
  -H "Authorization: Bearer seu-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"content":"Olá mundo! Publicando simultaneamente no X e Nostr!"}'
```

## 📝 Limitações do MVP

- Suporte apenas a texto (mídias em versão futura)
- Uma conta por plataforma por usuário
- Sem agendamento (publicação imediata)
- Sem interface gráfica (apenas API)

## 🔮 Próximos Passos

- [ ] Suporte a mídias (imagens, vídeos)
- [ ] Agendamento de posts
- [ ] Interface web
- [ ] Múltiplas contas por plataforma
- [ ] Integração com outras redes sociais
- [ ] Migração para processamento descentralizado

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

MIT License - veja o arquivo LICENSE para detalhes.

## 🆘 Suporte

Para dúvidas ou problemas:
1. Verifique os logs da aplicação
2. Consulte a documentação da API em `http://localhost:3000`
3. Abra uma issue no repositório

---

**Nota**: Este é um MVP focado em funcionalidade. Para produção, considere implementar testes automatizados, monitoramento, backup do banco de dados e outras práticas de DevOps. 