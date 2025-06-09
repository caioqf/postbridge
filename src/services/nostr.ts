import { 
  generatePrivateKey, 
  getPublicKey, 
  finishEvent, 
  SimplePool,
  Event as NostrEvent,
  EventTemplate,
  nip19
} from 'nostr-tools';

class NostrService {
  private pool: SimplePool;
  private relays: string[];

  constructor() {
    this.pool = new SimplePool();
    // Relays populares para o MVP
    this.relays = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.snort.social',
      'wss://relay.nostr.band'
    ];
  }

  // Normaliza a chave privada (converte nsec para hex se necessário)
  private normalizePrivateKey(privateKey: string): string {
    // Se já está em formato hex (64 caracteres), retorna como está
    if (/^[0-9a-fA-F]{64}$/.test(privateKey)) {
      return privateKey;
    }

    // Se está no formato nsec, converte para hex
    if (privateKey.startsWith('nsec1')) {
      try {
        const decoded = nip19.decode(privateKey);
        if (decoded.type === 'nsec') {
          return decoded.data;
        }
      } catch (error) {
        throw new Error('Invalid nsec format');
      }
    }

    throw new Error('Invalid private key format. Use hex (64 chars) or nsec format');
  }

  // Gera uma nova chave privada (para novos usuários)
  generatePrivateKey(): string {
    return generatePrivateKey();
  }

  // Obtém a chave pública a partir da privada
  getPublicKey(privateKey: string): string {
    const normalizedKey = this.normalizePrivateKey(privateKey);
    return getPublicKey(normalizedKey);
  }

  // Valida se uma chave privada é válida
  isValidPrivateKey(privateKey: string): boolean {
    try {
      const normalizedKey = this.normalizePrivateKey(privateKey);
      getPublicKey(normalizedKey);
      return true;
    } catch {
      return false;
    }
  }

  // Publica uma nota no Nostr
  async publishNote(
    privateKey: string,
    content: string,
    mediaUrls?: string[]
  ): Promise<{ success: boolean; eventId?: string; error?: string }> {
    try {
      const normalizedKey = this.normalizePrivateKey(privateKey);
      
      // Cria o evento
      const event: EventTemplate = {
        kind: 1, // Text note
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: content,
      };

      // Se há mídias, adiciona como tags (padrão NIP-94)
      if (mediaUrls && mediaUrls.length > 0) {
        mediaUrls.forEach(url => {
          event.tags.push(['r', url]);
        });
      }

      // Assina o evento
      const signedEvent = finishEvent(event, normalizedKey);

      // Publica nos relays
      const publishPromises = this.relays.map(relay => 
        this.pool.publish([relay], signedEvent)
      );

      await Promise.allSettled(publishPromises);

      return {
        success: true,
        eventId: signedEvent.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to publish note',
      };
    }
  }

  // Verifica se uma chave privada pode publicar (teste básico)
  async verifyPrivateKey(privateKey: string): Promise<boolean> {
    try {
      const normalizedKey = this.normalizePrivateKey(privateKey);
      const publicKey = getPublicKey(normalizedKey);
      return publicKey.length === 64; // Hex string de 32 bytes
    } catch {
      return false;
    }
  }

  // Fecha as conexões
  close(): void {
    this.pool.close(this.relays);
  }
}

export default new NostrService(); 