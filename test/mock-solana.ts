export class Connection {
  async getTransaction() {
    return { confirmed: true };
  }
  async getBalance() {
    return 10000000;
  }
  async sendTransaction() {
    return "mock_solana_signature";
  }
}

export class PublicKey {
  constructor(public value: string) {}
  toBase58() { return this.value; }
}

export const Keypair = {
  generate() {
    return {
      publicKey: new PublicKey("mock_solana_pubkey"),
      secretKey: new Uint8Array(64)
    };
  },
  fromSecretKey() {
    return {
      publicKey: new PublicKey("mock_solana_pubkey")
    };
  }
};

export const SystemProgram = {
  transfer() {
    return {};
  }
};

export class Transaction {
  add() { return this; }
}
