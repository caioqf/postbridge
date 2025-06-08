import { 
  generatePrivateKey, 
  getPublicKey, 
  finishEvent, 
  SimplePool,
  Event as NostrEvent,
  EventTemplate
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

  // Gera uma nova chave privada (para novos usuários)
  generatePrivateKey(): string {
    return generatePrivateKey();
  }

  // Obtém a chave pública a partir da privada
  getPublicKey(privateKey: string): string {
    return getPublicKey(privateKey);
  }

  // Valida se uma chave privada é válida
  isValidPrivateKey(privateKey: string): boolean {
    try {
      getPublicKey(privateKey);
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
      const signedEvent = finishEvent(event, privateKey);

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
      const publicKey = getPublicKey(privateKey);
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