import { 
    getSolanaBalance, 
    readExclusiveTokenHolders, 
    getBalanceOfToken, 
    getTokenDecimals, 
    delay, 
    getTokenPrice
} from "../utils/utils";
import 'dotenv/config';
import { buyToken } from "../swapper/buyToken";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { ExclusiveHolderDetails, SolBalanceObject } from "../types/types";
import OpenTrades from "../models/opentrades";
import { logger } from "../utils/logger";
import mongoose from "mongoose";
import ExclusiveHolders from "../models/exclusiveholders";
import { SolanaBalanceListener } from "../utils/SolanaBalanceListener";
import { MIN_SOL_DIFFERENCE_TO_UPDATE } from "../config/profitConfig";

// Define constants
const userWalletPublicKey = process.env.WALLET_PUBLIC_KEY || 'YOUR_PUBLIC_KEY';
const primaryWallet = Keypair.fromSecretKey(bs58.decode(process.env.WALLET_PRIVATE_KEY || ''));


// Connect to MongoDB
mongoose
.connect('mongodb://127.0.0.1:27017/market-maker-bot')
.then( () => logger.info("Mongo Connected"))
.catch( err => logger.error("Mongo Error" , err))

// Fetch exclusive holder details
async function fetchExclusiveHolderDetails(): Promise<ExclusiveHolderDetails> {
    const exclusiveHolders = await readExclusiveTokenHolders();

    if (exclusiveHolders.length === 0) {
        logger.info("No Exclusive Holder");
        await delay(1000);
        return {};
    }

    const exclusiveHolderDetails: ExclusiveHolderDetails = exclusiveHolders.reduce((acc, holder) => {
        acc[holder.walletAddress] = {
            sol: holder.solBalance,
            tokenAddress : holder.tokenAddress
        };
        return acc;
    }, {} as ExclusiveHolderDetails);

    return exclusiveHolderDetails;
}

// Process wallet balances
async function processWallet(walletAddresses: string[], exclusiveHolderDetails: ExclusiveHolderDetails, currentBalances : SolBalanceObject): Promise<void> {
    
    for (const wallet of walletAddresses) {
        const currentBalance = currentBalances[wallet].sol;
        const previousBalance = exclusiveHolderDetails[wallet].sol;
        const balanceDifference = currentBalance - previousBalance;

        if (currentBalance < previousBalance) {
            logger.info(`SOL deducted from wallet ${wallet}: ${balanceDifference.toFixed(4)} SOL ⬇️`);
            await ExclusiveHolders.updateOne(
                { walletAddress: wallet },
                { $set: { solBalance: currentBalance } }
            );
            continue;
        }

        if (Math.floor(balanceDifference) < MIN_SOL_DIFFERENCE_TO_UPDATE) {
            logger.info(`Wallet ${wallet} balance change (${balanceDifference.toFixed(4)} SOL) doesn't meet the minimum threshold of 5 SOL ⚠️`);
            await ExclusiveHolders.updateOne(
                { walletAddress: wallet },
                { $set: { solBalance: currentBalance } }
            );
            continue;
        }

        logger.info(`SOL added to wallet ${wallet}: ${balanceDifference.toFixed(4)} SOL ✅`);

        const randomPercentage = Math.floor(Math.random() * 11) + 50;
        const solanaToBuy = Math.floor((randomPercentage/100) * currentBalance);
        const userSolanaBalance = await getSolanaBalance(userWalletPublicKey);

        // if (userSolanaBalance < solanaToBuy) {
        //     logger.warn(`User doesn't have enough SOL balance. Required: ${solanaToBuy}, Available: ${userSolanaBalance} ❌`);
        //     continue;
        // }

        try {
            const decimals = await getTokenDecimals(exclusiveHolderDetails[wallet].tokenAddress);
            const tokenPrice = await getTokenPrice(exclusiveHolderDetails[wallet].tokenAddress);

            logger.info(`Attempting to purchase token with ${solanaToBuy} SOL 🚀`);
            const tokenToSell = (await buyToken(primaryWallet, exclusiveHolderDetails[wallet].tokenAddress, solanaToBuy, false, true) as number) / 10 ** decimals;
            
            const initialTokenBalance = await getBalanceOfToken(wallet, exclusiveHolderDetails[wallet].tokenAddress);

            await OpenTrades.create({
                walletAddress: wallet,
                solBalance: currentBalance,
                tokenBalance: initialTokenBalance,
                tokenAddress: exclusiveHolderDetails[wallet].tokenAddress,
                openTradeType: 'SELL',
                tokenAmount: tokenToSell,
                solAmount: solanaToBuy,
                tokenDecimal : decimals,
                tokenPrice : tokenPrice,
                timeStamp: new Date().getTime()
            }).then(() => {
                logger.info(`Open Trade created for wallet ${wallet}`);
            }).catch((err) => {
                logger.error("Error in creating open trade", { message: err.message, stack: err.stack });
            });

            await ExclusiveHolders.updateOne(
                { walletAddress: wallet },
                { $set: { openTrade: true, solBalance: currentBalance } }
            ).then(() => {
                logger.info(`Updated ExclusiveHolder for ${wallet}: openTrade set to true, solBalance updated to ${currentBalance} ✅`);
            }).catch((err) => {
                logger.error(`Error updating ExclusiveHolder for ${wallet}`, { message: err.message, stack: err.stack });
            });

        } catch (err) {
            logger.error("Error in token purchase", { message: err.message, stack: err.stack });
            await ExclusiveHolders.updateOne(
                { walletAddress: wallet },
                { $set: { solBalance: currentBalance } }
            ).catch((updateErr) => {
                logger.error(`Error updating solBalance for ${wallet} after failed purchase`, { message: updateErr.message, stack: updateErr.stack });
            });
        }
    }
}

// Monitor wallets for SOL balance changes
export async function monitorWalletsForSolanaPurchase(): Promise<void> {

    const listener = new SolanaBalanceListener(process.env.RPC_URL || '');
    const monitoredWallets = new Set<string>();

    async function handleBalanceChange(walletAddress: string, newBalance: number) {
        const exclusiveHolderDetails = await fetchExclusiveHolderDetails();
        if (exclusiveHolderDetails[walletAddress]) {
            const currentBalances = { [walletAddress]: { sol: newBalance } };
            await processWallet([walletAddress], exclusiveHolderDetails, currentBalances);
        }
    }

    listener.on('balanceChanged', handleBalanceChange);
    
    while (true) {
        try {
            const exclusiveHolderDetails = await fetchExclusiveHolderDetails();

            if (Object.keys(exclusiveHolderDetails).length === 0) {
                continue;
            }

            logger.info('Checking if Exclusive holder SOL balance updated....');

            for (const [walletAddress] of Object.entries(exclusiveHolderDetails)) {
                if (!monitoredWallets.has(walletAddress)) {
                    listener.addHolder(walletAddress);
                    monitoredWallets.add(walletAddress);
                    logger.info(`Added listener for wallet: ${walletAddress}`);
                }
            }

            const exclusiveHolderWallets: string[] = Object.keys(exclusiveHolderDetails);

            for (const walletAddress of monitoredWallets) {
                if (!(exclusiveHolderWallets.includes(walletAddress))) {
                    listener.removeHolder(walletAddress);
                    monitoredWallets.delete(walletAddress);
                    logger.info(`Removed listener for wallet: ${walletAddress}`);
                }
            }

            if (global.gc) {
                global.gc();
            }

            await delay(1000);
        } catch (err) {
            logger.error("An error occurred:", { message: err.message, stack: err.stack });
            await delay(2000) ;
        }
    }
}

process.on('SIGINT', () => {
    logger.info('Gracefully shutting down...');
    process.exit(0);
});

monitorWalletsForSolanaPurchase().catch(console.error);
