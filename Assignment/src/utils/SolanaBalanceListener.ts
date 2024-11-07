import { Connection, PublicKey } from '@solana/web3.js';
import { EventEmitter } from 'events';

// Listener for SOL balance changes
export class SolanaBalanceListener extends EventEmitter {

    private connection: Connection;
    private subscriptions: { [address: string]: number } = {};

    constructor(private rpcUrl: string) {
        super();
        this.connection = new Connection(rpcUrl, 'confirmed');
    }

    public addHolder(walletAddress: string) {
        this.subscribeToWallet(walletAddress);
    }

    public removeHolder(walletAddress: string) {
        this.unsubscribeFromWallet(walletAddress);
    }

    private subscribeToWallet(walletAddress: string) {
        if (this.subscriptions[walletAddress]) {
            return;
        }

        const publicKey = new PublicKey(walletAddress);

        const subscriptionId = this.connection.onAccountChange(
            publicKey,
            (accountInfo) => {
                const newBalance = accountInfo.lamports / 1e9;
                this.emit('balanceChanged', walletAddress , newBalance);
            },
            'confirmed'
        );

        this.subscriptions[walletAddress] = subscriptionId;
    }

    private unsubscribeFromWallet(walletAddress: string) {
        if (this.subscriptions[walletAddress]) {
            this.connection.removeAccountChangeListener(this.subscriptions[walletAddress]);
            delete this.subscriptions[walletAddress];
        }
    }

    public stop() {
        for (const walletAddress in this.subscriptions) {
            this.unsubscribeFromWallet(walletAddress);
        }
    }
}