import { calculateTokenAmountForUSDC, delay, getBalanceOfToken, getSolanaBalance, getTokenPrice, readOpenTrades } from "../utils/utils";
import { sellToken } from "../swapper/sellToken";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import FinishTrades from "../models/finishtrades";
import OpenTrades from "../models/opentrades";
import { IOpenTrade } from "../types/types";
import { logger } from "../utils/logger";
import mongoose from "mongoose";
import 'dotenv/config';
import { TokenBalanceListener } from "../utils/TokenBalanceListener";
import { AUTO_SELL_LOSS_PERCENTAGE, AUTO_SELL_PROFIT_PERCENTAGE, ENABLE_AUTO_SELL_LOSS, ENABLE_AUTO_SELL_PROFIT, MIN_SOL_DIFFERENCE_TO_SELL, MIN_SOL_DIFFERENCE_TO_UPDATE, MIN_TOKEN_DIFFERENCE_TO_SELL_USDC, OPEN_TRADE_EXPIRATION_TIME, PRICE_CHECK_INTERVAL } from "../config/profitConfig";

// Define TokenMonitor type
type TokenMonitor = {
    initialPrice: number;
    trades: Set<string>; // Set of wallet addresses trading this token
    cleanup: () => void;
};

// Create primary wallet from private key
const primaryWallet = Keypair.fromSecretKey(bs58.decode(process.env.WALLET_PRIVATE_KEY || ''));

// Connect to MongoDB
mongoose
.connect('mongodb://127.0.0.1:27017/market-maker-bot')
.then( () => logger.info("Mongo Connected"))
.catch( err => logger.error("Mongo Error" , err))

// Process trade with new balances
async function processTrade(trade : IOpenTrade , newTokenBalance : number , newSolBalance : number) {
    const tokenDifference = newTokenBalance - trade.tokenBalance;
    const solDifference = newSolBalance - trade.solBalance;

    const minTokenDifferenceToSell = await calculateTokenAmountForUSDC(trade.tokenAddress, MIN_TOKEN_DIFFERENCE_TO_SELL_USDC);

    // Check if token difference is less than minimum token difference to sell
    if (tokenDifference < -minTokenDifferenceToSell) {
        // Check if sol difference is greater than minimum sol difference to sell
        if (solDifference > MIN_SOL_DIFFERENCE_TO_SELL) { // 1 sol difference to sell
            logger.info(`Token sold by ${trade.walletAddress}. Selling remaining tokens.`);
            await sellAndRecordTrade(trade, `Token sold by ${trade.walletAddress}`);
        } else {
            await sellAndRecordTrade(trade, `Token transferred by ${trade.walletAddress}`);
            logger.info(`Token transferred by ${trade.walletAddress}. Selling remaining tokens.`);
        }
        return;
    }

    // Check if sol difference is greater than minimum sol difference to update
    if (solDifference > MIN_SOL_DIFFERENCE_TO_UPDATE && tokenDifference === 0) {
        logger.info(`More SOL added to ${trade.walletAddress}. Updating balance and waiting for token purchase.`);
        await OpenTrades.findOneAndUpdate(
            { walletAddress: trade.walletAddress },
            { $set: { solBalance: newSolBalance } },
            { new: true }
        );
        return;
    }

    // Check if sol difference is less than minimum sol difference to sell
    if (solDifference < MIN_SOL_DIFFERENCE_TO_SELL && tokenDifference === 0) {
        logger.info(`SOL transferred out from ${trade.walletAddress} or Another token bought`);
        await sellAndRecordTrade(trade, 'SOL transferred out or Another token bought');
        return;
    }

    // Check if token difference is greater than minimum token difference to sell
    if (tokenDifference > minTokenDifferenceToSell) {
        // Check if sol difference is less than negative trade sol amount
        if (solDifference < -trade.solAmount) {
            logger.info(`Token purchased by ${trade.walletAddress}. No more SOL for additional purchases. Selling token.`);
            await sellAndRecordTrade(trade, 'Token purchased, no additional SOL');
        } else {
            logger.info(`Token purchased by ${trade.walletAddress}. Waiting for potential additional purchases.`);
            // Update the trade with new balances
            await OpenTrades.findOneAndUpdate(
                { walletAddress: trade.walletAddress },
                { 
                    $set: { 
                        tokenBalance: newTokenBalance,
                        solBalance: newSolBalance,
                    }
                },
                { new: true }
            );
        }
        return;
    }

    // Log unexpected balance change
    logger.info(`Unexpected balance change for ${trade.walletAddress}. No action taken.`);

    // Update open trade with new balances
    await OpenTrades.findOneAndUpdate(
        { walletAddress: trade.walletAddress },
        { 
            $set: { 
                tokenBalance: newTokenBalance,
                solBalance: newSolBalance,
            }
        },
        { new: true }
    ).then( () => logger.info("Open Trade Updated"))
}

// Sell token and record trade
async function sellAndRecordTrade(trade : IOpenTrade, description : string) {
    try {
        const amountOfSolIn = (await sellToken(primaryWallet, false , trade.tokenAddress , false , true , trade.tokenAmount) as number) / LAMPORTS_PER_SOL;

        await FinishTrades.create({
            walletAddress: trade.walletAddress,
            initialAmount: trade.solAmount,
            finalAmount: amountOfSolIn,
            profitOrLoss: amountOfSolIn > trade.solAmount ? 'Profit' : 'Loss',
            openTrade: trade,
            description
        });

        await OpenTrades.deleteOne({ walletAddress: trade.walletAddress });
        logger.info('Open Trade file has been updated');
    } catch (err) {
        logger.error("Error in selling token or updating database:", { message: err.message, stack: err.stack } );
    }
}

// Monitor wallets for token purchase
async function monitorWalletsForTokenPurchase() {

    // Create listener for token and sol balance changes
    const listener = new TokenBalanceListener(process.env.RPC_URL || '');
    const monitoredWallets = new Set<string>();
    const tokenMonitors = new Map<string, TokenMonitor>();
    const pendingBalanceChanges = new Map<string, { newTokenBalance?: number, newSolBalance?: number }>();
    const tradeTimeouts = new Map<string, NodeJS.Timeout>();

    // Handle token balance change
    async function handleTokenBalanceChange(walletAddress: string , newTokenBalance: number) {
        let pending = pendingBalanceChanges.get(walletAddress) || {};
        pending.newTokenBalance = newTokenBalance;
        pendingBalanceChanges.set(walletAddress, pending);
    
        if (pending.newSolBalance !== undefined) {
            await processTradeWithNewBalances(walletAddress);
        }
    }
    
    // Handle sol balance change
    async function handleSolBalanceChange(walletAddress: string, newSolanaBalance: number) {
        let pending = pendingBalanceChanges.get(walletAddress) || {};
        pending.newSolBalance = newSolanaBalance;
        pendingBalanceChanges.set(walletAddress, pending);
    
        if (pending.newTokenBalance !== undefined) {
            await processTradeWithNewBalances(walletAddress);
        }
    }
    
    // Process trade with new balances
    async function processTradeWithNewBalances(walletAddress: string) {
        const pending = pendingBalanceChanges.get(walletAddress);
        if (!pending || pending.newTokenBalance === undefined || pending.newSolBalance === undefined) {
            return;
        }

        const openTrade = await OpenTrades.findOne({ walletAddress });  
        
        if (openTrade) {
            await processTrade(openTrade,pending.newTokenBalance,pending.newSolBalance);
        }
    
        pendingBalanceChanges.delete(walletAddress);
    }

    //for auto-sell at config profit or loss
    function monitorTokenPrice(tokenAddress: string, initialPrice: number) {
        const intervalId = setInterval(async () => {
            const currentPrice = await getTokenPrice(tokenAddress);
            const percentChange = ((currentPrice - initialPrice) / initialPrice) * 100;

            if ((ENABLE_AUTO_SELL_PROFIT && percentChange >= AUTO_SELL_PROFIT_PERCENTAGE) ||
                (ENABLE_AUTO_SELL_LOSS && percentChange <= -AUTO_SELL_LOSS_PERCENTAGE)) {
                const monitor = tokenMonitors.get(tokenAddress);
                if (monitor) {
                    // Iterate through all trades for this token
                    for (const walletAddress of monitor.trades) {
                        const trade = await OpenTrades.findOne({ walletAddress, tokenAddress });
                        if (trade) {
                            if (percentChange >= AUTO_SELL_PROFIT_PERCENTAGE) {
                                logger.info(`Auto-selling due to ${percentChange.toFixed(2)}% profit for ${walletAddress}`);
                                await sellAndRecordTrade(trade, `Auto-sold at ${percentChange.toFixed(2)}% profit`);
                            } else {
                                logger.info(`Auto-selling due to ${Math.abs(percentChange).toFixed(2)}% loss for ${walletAddress}`);
                                await sellAndRecordTrade(trade, `Auto-sold at ${Math.abs(percentChange).toFixed(2)}% loss`);
                            }
                        }
                    }
                }
                clearInterval(intervalId);
                tokenMonitors.delete(tokenAddress);
            }
        }, PRICE_CHECK_INTERVAL);

        return () => {
            logger.info(`Cleaning up token price monitoring for ${tokenAddress}`);
            clearInterval(intervalId);
        };
    }

    // Setup trade timeout
    async function setupTradeTimeout(trade: IOpenTrade) {
        const timeLeft = trade.timeStamp + OPEN_TRADE_EXPIRATION_TIME - Date.now();
        if (timeLeft > 0) {
            const timeout = setTimeout(async () => {
                logger.info(`Trade for ${trade.walletAddress} has expired. Selling token.`);
                await sellAndRecordTrade(trade, 'Trade time expired');
                tradeTimeouts.delete(trade.walletAddress);
            }, timeLeft);
            tradeTimeouts.set(trade.walletAddress, timeout);
        } else {
            logger.info(`Trade for ${trade.walletAddress} has already expired. Selling token.`);
            await sellAndRecordTrade(trade, 'Trade time expired');
        }
    }

    listener.on('tokenBalanceChanged', handleTokenBalanceChange);
    listener.on('solBalanceChanged', handleSolBalanceChange);

    // Main loop to monitor token purchases
    while (true) {
        try {
            const openTrades = await readOpenTrades();

            if (openTrades.length === 0) {
                logger.info("No Open Trades");
                await delay(1000);
                continue;
            }

            logger.info('Checking if any Token Purchases in Open Trade....');

            // Add listeners for new open trades
            for (const trade of openTrades) {
                if (!monitoredWallets.has(trade.walletAddress)) {
                    listener.addHolder(trade.walletAddress,trade.tokenAddress,trade.tokenDecimal);
                    monitoredWallets.add(trade.walletAddress);
                    logger.info(`Added listener for wallet: ${trade.walletAddress}`);


                    if (!tradeTimeouts.has(trade.walletAddress)) {
                        await setupTradeTimeout(trade);
                    }

                    let monitor = tokenMonitors.get(trade.tokenAddress);
                    if (!monitor) {
                        const cleanup = monitorTokenPrice(trade.tokenAddress, trade.tokenPrice);
                        monitor = {
                            initialPrice: trade.tokenPrice,
                            trades: new Set([trade.walletAddress]),
                            cleanup
                        };
                        tokenMonitors.set(trade.tokenAddress, monitor);
                    } else {
                        monitor.trades.add(trade.walletAddress);
                    }
                }
            }

            const openTradesWallets: string[] = openTrades.map(trade => trade.walletAddress);

            // Remove listeners for closed trades
            for (const walletAddress of monitoredWallets) {
                if (!(openTradesWallets.includes(walletAddress))) {
                    listener.removeHolder(walletAddress);
                    monitoredWallets.delete(walletAddress);
                    logger.info(`Removed listener for wallet: ${walletAddress}`);

                    const timeout = tradeTimeouts.get(walletAddress);
                    if (timeout) {
                        clearTimeout(timeout);
                        tradeTimeouts.delete(walletAddress);
                    }

                    for (const monitor of tokenMonitors.values()) {
                        monitor.trades.delete(walletAddress);
                    }
                    
                    // Clean up empty token monitors
                    for (const [tokenAddress, monitor] of tokenMonitors.entries()) {
                        if (monitor.trades.size === 0) {
                            monitor.cleanup();
                            tokenMonitors.delete(tokenAddress);
                        }
                    }
                }
            }

            // Run garbage collection
            if (global.gc) {
                global.gc();
            }

            await delay(1000);
        } catch (error) {
            logger.error("An error occurred in monitorTokenPurchase file:", { message: error.message, stack: error.stack });
            await delay(5000);
        }
    }
}

process.on('SIGINT', () => {
    logger.info('Gracefully shutting down...');
    process.exit(0);
});

monitorWalletsForTokenPurchase().catch(console.error);
