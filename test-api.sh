#!/bin/bash

echo "🧪 Testando a API NosTX..."
echo ""

# Aguarda o servidor iniciar
sleep 3

# 1. Health check
echo "1️⃣ Testando health check..."
curl -s http://localhost:3000/health | jq '.'
echo ""

# 2. Gerar chave Nostr
echo "2️⃣ Gerando chave Nostr..."
KEYS=$(curl -s http://localhost:3000/auth/nostr/generate-key)
echo $KEYS | jq '.'
PRIVATE_KEY=$(echo $KEYS | jq -r '.privateKey')
echo ""

# 3. Login com Nostr
echo "3️⃣ Fazendo login com Nostr..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/nostr/login \
  -H "Content-Type: application/json" \
  -d "{\"privateKey\":\"$PRIVATE_KEY\"}")
echo $LOGIN_RESPONSE | jq '.'
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
USER_ID=$(echo $LOGIN_RESPONSE | jq -r '.userId')
echo ""

# 4. Publicar post
echo "4️⃣ Publicando post..."
POST_RESPONSE=$(curl -s -X POST http://localhost:3000/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"🎉 Primeiro post usando a API NosTX! Publicando simultaneamente no Nostr! #NosTX #MVP"}')
echo $POST_RESPONSE | jq '.'
POST_ID=$(echo $POST_RESPONSE | jq -r '.postId')
echo ""

# 5. Buscar post
echo "5️⃣ Buscando post criado..."
curl -s http://localhost:3000/posts/$POST_ID \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# 6. Buscar logs
echo "6️⃣ Buscando logs de publicação..."
curl -s http://localhost:3000/posts/$POST_ID/logs \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

echo "✅ Teste concluído!"
echo ""
echo "📝 Informações do teste:"
echo "   User ID: $USER_ID"
echo "   Post ID: $POST_ID"
echo "   Private Key: $PRIVATE_KEY"
echo ""
echo "🔗 Acesse http://localhost:3000 para ver a documentação completa" 