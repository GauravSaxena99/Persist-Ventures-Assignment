// Import necessary modules and dependencies
import express from 'express'
import { parseTransactionHeliusSwap, parseTransactionHeliusTransfer, parseTransactionResult, parseTransactionShyft } from '../utils/controllers';
import { calculateTokenAmountForUSDC, checkExclusiveTokenHolder, getTokenDecimals, getTokenPrice } from '../utils/utils';
import { MIN_TOKEN_AMOUNT, MIN_SOL_BALANCE, TOKEN_DETAILS } from '../config/profitConfig';
import mongoose from 'mongoose';
import SplitTokenHolders from '../models/splittokenholders';
import OpenTrades from '../models/opentrades';
import ExclusiveHolders from '../models/exclusiveholders';
import { buyToken } from '../swapper/buyToken';
import { Keypair } from '@solana/web3.js';
import bs58 from "bs58";
import { logger, transactionLogger } from '../utils/logger';
import bodyParser from 'body-parser'
import { createWebhook } from '../webhook/helius-create-webhook';
import { deleteWebhook } from '../webhook/helius-delete-webhook';

// Initialize Express app and set port
const app = express()
const port = 3002;

// Create primary wallet from private key
const primaryWallet = Keypair.fromSecretKey(bs58.decode(process.env.WALLET_PRIVATE_KEY || ''));
// Initialize webhook ID
let webhookID ;

// Configure middleware
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));

// Function to create transaction listener
async function createTransactionListener(){
    const tokenAddresses : string[] = Object.values(TOKEN_DETAILS)
    webhookID = await createWebhook(tokenAddresses)
}

// Call the function to create transaction listener
createTransactionListener()

// Connect to MongoDB
mongoose
    .connect('mongodb://127.0.0.1:27017/market-maker-bot')
    .then(() => logger.info("Mongo Connected"))
    .catch(err => logger.error("Mongo Error", err))

// Webhook endpoint to handle incoming transactions
app.post('/webhook', (req, res) => {

    const transactions = req.body;

    transactions.forEach(async (transaction) => {
        // Handle TRANSFER transactions
        if (transaction?.type == "TRANSFER" && transaction?.description) {
            const result = await parseTransactionHeliusTransfer(transaction);
            const tokenAddress = TOKEN_DETAILS[result.tokenSymbol];

            const tokenMininumTransferAmount = await calculateTokenAmountForUSDC(tokenAddress, MIN_TOKEN_AMOUNT)

            if (result.tokenTransferred > tokenMininumTransferAmount) {

                const exclusiveHolder = await checkExclusiveTokenHolder(tokenAddress, result?.toAccount);

                if (exclusiveHolder) {
                    // Log split token transfer
                    transactionLogger.info("Split Token 🖖")
                    transactionLogger.info(`Transferred Token = ${result.tokenTransferred}`)
                    transactionLogger.info(`Transaction https://solscan.io/tx/${transaction.signature}`)
                    transactionLogger.info(`Sell Token ✅`)

                    //sell token here
                    //call a function to sell the token
                    
                    // Create SplitTokenHolder record
                    await SplitTokenHolders.create({
                        walletAddress: result.toAccount,
                        tokenAddress: tokenAddress,
                        tokenTransferred: result.tokenTransferred,
                        signature: `https://solscan.io/tx/${transaction.signature}`,
                    })

                }
            }
        }

        // Handle SWAP transactions
        if (transaction?.type == "SWAP" && transaction?.description) {
            const result = await parseTransactionHeliusSwap(transaction);

            if (result && result?.buyOrSell == 'BUY') {
                const exclusiveHolder = await checkExclusiveTokenHolder(result.tokenAddress, result?.feePayer);

                if (exclusiveHolder && exclusiveHolder?.solBalance > MIN_SOL_BALANCE) {
                    // Log transaction details
                    transactionLogger.info(`Transaction https://solscan.io/tx/${transaction.signature}`)
                    transactionLogger.info(`Token Purchased = ${result.tokenValue}`)
                    transactionLogger.info(`Sol Balance = ${exclusiveHolder.solBalance}`)
                    
                    // Calculate amount to buy and execute buy
                    const randomPercentage = Math.floor(Math.random() * 11) + 50 ;
                    const solanaToBuy = Math.floor((randomPercentage/100) * exclusiveHolder.solBalance);
                    const decimals = await getTokenDecimals(result.tokenAddress);
                    
                    const tokenPrice = await getTokenPrice(result.tokenAddress);

                    const tokenToSell = (await buyToken(primaryWallet, result.tokenAddress, solanaToBuy, false, true) as number) / 10 ** decimals;
                                        
                    // Create OpenTrade record
                    await OpenTrades.create({
                        walletAddress: result.feePayer,
                        solBalance: exclusiveHolder.solBalance,
                        tokenBalance: exclusiveHolder.tokenBalance,
                        tokenAddress: exclusiveHolder.tokenMintAddress,
                        openTradeType: 'SELL',
                        tokenAmount: tokenToSell,
                        solAmount: solanaToBuy,
                        tokenDecimal : decimals,
                        tokenPrice : tokenPrice,
                        timeStamp: new Date().getTime(),
                    })

                    // Update ExclusiveHolder status
                    await ExclusiveHolders.updateOne({ walletAddress: result.feePayer }, { $set: { openTrade: true } })
                }
            }
        }

        // Handle UNKNOWN transactions (parsed using Shyft)
        if (transaction?.type == "UNKNOWN" && transaction?.description) {
            const parsedTransaction = await parseTransactionShyft(transaction?.signature);
            const result = parseTransactionResult(parsedTransaction?.result);

            if (result && result?.buyOrSell == 'BUY') {
                const exclusiveHolder = await checkExclusiveTokenHolder(result.tokenAddress, result?.feePayer);

                if (exclusiveHolder && exclusiveHolder.solBalance > MIN_SOL_BALANCE && result.buyOrSell == 'BUY') {
                    // Log transaction details
                    transactionLogger.info(`Transaction https://solscan.io/tx/${transaction.signature}`)
                    transactionLogger.info(`Token Purchased = ${result.tokenValue}`)
                    transactionLogger.info(`Sol Balance = ${exclusiveHolder.solBalance}`)

                    // Calculate amount to buy and execute buy
                    const randomPercentage = Math.floor(Math.random() * 11) + 50 ;
                    const solanaToBuy = Math.floor((randomPercentage/100) * exclusiveHolder.solBalance);
                    const decimals = await getTokenDecimals(result.tokenAddress);

                    const tokenPrice = await getTokenPrice(result.tokenAddress);

                    const tokenToSell = (await buyToken(primaryWallet, result.tokenAddress, solanaToBuy, false, true) as number) / 10 ** decimals;

                    // Create OpenTrade record
                    await OpenTrades.create({
                        walletAddress: result.feePayer,
                        solBalance: exclusiveHolder.solBalance,
                        tokenBalance: exclusiveHolder.tokenBalance,
                        tokenAddress: exclusiveHolder.tokenMintAddress,
                        openTradeType: 'SELL',
                        tokenAmount: tokenToSell,
                        solAmount: solanaToBuy,
                        tokenDecimal : decimals,
                        tokenPrice : tokenPrice,
                        timeStamp: new Date().getTime()
                    })

                    // Update ExclusiveHolder status
                    await ExclusiveHolders.updateOne({ walletAddress: result.feePayer }, { $set: { openTrade: true } })
                }
            }
        }

        logger.info("Monitoring Transactions...")
    })

    res.sendStatus(200);
})

// Start the server
app.listen(port, () => {
    logger.info(`Server listening on port ${port}`);
});

// Handle SIGINT event to delete webhook and exit
process.on( 'SIGINT' , async () => {
    try {
        await deleteWebhook(webhookID);
      } catch (error) {
        logger.error('Failed to delete webhook:', {error});
      } finally {
        process.exit(0);
      }
})