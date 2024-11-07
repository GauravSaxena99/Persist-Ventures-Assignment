import { Connection, Keypair } from "@solana/web3.js";
import { Wallet } from "@project-serum/anchor";
import "dotenv/config";
import { SOLANA_ADDRESS } from "../config/consts";
import {
  convertToInteger,
  getQuote,
  getSwapTransaction,
  finalizeTransaction,
} from "./swapperHelper";
import { logger } from "../utils/logger";

export const buyToken = async (
  primaryWallet: Keypair,
  addressOfTokenIn: string,
  amountOfTokenOut: number,
  waitForConfirmation: boolean,
  wantAmountOfTokenIn: boolean
): Promise<number | string> => {
  try {
    const connection = new Connection(process.env.RPC_URL, {
      wsEndpoint: process.env.RPC_WEBSOCKET_ENDPOINT,
    });

    const wallet = new Wallet(primaryWallet);
    logger.info(`Trying to buy token using ${amountOfTokenOut} SOL...🚀`);

    const decimals = 9; //decimal depends on inputMint address which is SOL address here
    const slippage = 100; // slippage is 1%

    const convertedAmountOfTokenOut = convertToInteger(
      amountOfTokenOut,
      decimals
    );

    const quoteResponse = await getQuote(
      SOLANA_ADDRESS,
      addressOfTokenIn,
      convertedAmountOfTokenOut,
      slippage
    );

    const amountOfTokenIn: number =
      quoteResponse.routePlan[quoteResponse.routePlan.length - 1].swapInfo
        .outAmount;

    const walletPublicKey = wallet.publicKey.toString();
    const swapTransaction = await getSwapTransaction(
      quoteResponse,
      walletPublicKey
    );

    const txid = await finalizeTransaction(swapTransaction, wallet, connection) as string;
  
    if(waitForConfirmation){
      logger.info("Waiting for confirmation... 🕒");
      const latestBlockhash = await connection.getLatestBlockhash()
      const confirmation = await connection.confirmTransaction(
        {
          signature: txid,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        'finalized' // Optional commitment level
      );
  
      if (confirmation.value.err) {
        throw new Error("Confrimtaion error")
      }
    }
    // if (waitForConfirmation) {
    //   let subscriptionId;
    //   try {
    //     const promise = new Promise<void>( (resolve, reject) => {
    //       subscriptionId = connection.onSignature(
    //         txid,
    //         (updatedTxInfo, context) => {
    //           if (updatedTxInfo.err) {
    //             console.error("Transaction failed:", updatedTxInfo.err);
    //             reject(new Error(`Transaction failed: ${updatedTxInfo.err}`));
    //           } else {
    //             console.log("Transaction confirmed ✅");
    //             resolve();
    //           }
    //         },
    //         "finalized"
    //       );
    //     });
    //     await promise;
    //   } catch (error) {
    //     console.error("Error during transaction confirmation:", error);
    //     return; 
    //   } finally {
    //     if (subscriptionId) {
    //       connection.removeSignatureListener(subscriptionId);
    //     }
    //   }
    // }
  
    // logger.info(`Bought ${amountOfTokenIn} ${TOKEN_SYMBOL} Token from ${amountOfTokenOut} SOL ✅`);
    logger.info(`Signature = https://solscan.io/tx/${txid}`)

    if (wantAmountOfTokenIn) {
      return amountOfTokenIn;
    } else {
      return txid;
    }
  } catch (error: any) {
    throw new Error(error.message);
  }
};
