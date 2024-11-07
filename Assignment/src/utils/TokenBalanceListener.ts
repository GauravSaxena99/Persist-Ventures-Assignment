import { Connection, PublicKey } from '@solana/web3.js';
import { EventEmitter } from 'events';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Listener for token balance changes & sol balance
export class TokenBalanceListener extends EventEmitter {
    private connection: Connection;
    private subscriptions: { [address: string]: { solBalanceSubscriptionId: number, tokenBalanceSubscriptionId: number } } = {};
    private tokenDecimals: { [tokenAddress: string]: number } = {};

    constructor(private rpcUrl: string) {
        super();
        this.connection = new Connection(rpcUrl, 'confirmed');
    }

    public addHolder(walletAddress: string, tokenAddress: string, decimals: number) {
        this.tokenDecimals[tokenAddress] = decimals;
        this.subscribeToWallet(walletAddress, tokenAddress);
    }

    public removeHolder(walletAddress: string) {
        this.unsubscribeFromWallet(walletAddress);
    }

    private subscribeToWallet(walletAddress: string, tokenAddress: string) {
        if (this.subscriptions[walletAddress]) {
            return;
        }

        const filters = [
            {
                memcmp: {
                    offset: 32,
                    bytes: walletAddress,
                },
            },
            {
                dataSize: 165,
            },
        ];

        const tokenBalanceSubscriptionId = this.connection.onProgramAccountChange(
            TOKEN_PROGRAM_ID,
            (accountInfo) => {
                const data = accountInfo.accountInfo.data;
                const mint = new PublicKey(data.slice(0, 32));
                const decimals = this.tokenDecimals[tokenAddress];
                if (mint.toBase58() === tokenAddress) {
                    const amountBuffer = data.slice(64, 72);
                    const newTokenBalance = Number(amountBuffer.readBigUInt64LE(0)) / 10 ** decimals;
                    this.emit('tokenBalanceChanged', walletAddress, newTokenBalance);
                }
            },
            'confirmed',
            filters
        );

        const publicKey = new PublicKey(walletAddress);

        const solBalanceSubscriptionId = this.connection.onAccountChange(
            publicKey,
            (accountInfo) => {
                const newSolanaBalance = accountInfo.lamports / 1e9;
                this.emit('solBalanceChanged', walletAddress , newSolanaBalance);
            },
            'confirmed'
        );

       this.subscriptions[walletAddress] = { solBalanceSubscriptionId, tokenBalanceSubscriptionId }
    }

    private unsubscribeFromWallet(walletAddress: string) {
        if (this.subscriptions[walletAddress]) {
            this.connection.removeProgramAccountChangeListener(this.subscriptions[walletAddress].solBalanceSubscriptionId);
            this.connection.removeProgramAccountChangeListener(this.subscriptions[walletAddress].tokenBalanceSubscriptionId);
            delete this.subscriptions[walletAddress];
        }
    }

    public stop() {
        for (const walletAddress in this.subscriptions) {
            this.unsubscribeFromWallet(walletAddress);
        }
    }
}