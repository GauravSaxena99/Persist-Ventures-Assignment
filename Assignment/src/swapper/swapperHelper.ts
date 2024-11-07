import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import fetch from "cross-fetch";
import { Route, SwapResponse } from "../types/types";
import { Wallet } from "@project-serum/anchor";
import { EXECUTE_SWAP } from "../config/swapperConfig";
import { logger } from "../utils/logger";


export const getQuote = async (
  addressOfTokenOut: string,
  addressOfTokenIn: string,
  convertedAmountOfTokenOut: number,
  slippage: number
) => {
  slippage *= 100;
  const url = `https://quote-api.jup.ag/v6/quote?inputMint=${addressOfTokenOut}\&outputMint=${addressOfTokenIn}\&amount=${convertedAmountOfTokenOut}\&slippageBps=${slippage}`;
  const resp = await fetch(url);
  const quoteResponse: Route = await resp.json();
  return quoteResponse;
};

export const getSwapTransaction = async (
  quoteResponse: Route,
  walletPublicKey: string,
): Promise<string> => {
  try {
    const swapStartTime = new Date().getTime()
    let body: any;
    body = {
      quoteResponse,
      userPublicKey: walletPublicKey,
      wrapAndUnwrapSol: true,
      restrictIntermediateTokens: false,
      prioritizationFeeLamports: 250000,
    };
    const resp = await fetch("https://quote-api.jup.ag/v6/swap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const swapResponse: SwapResponse = await resp.json();
    return swapResponse.swapTransaction;
  } catch (error: any) {
    throw new Error(error);
  }
};

export const convertToInteger = (amount: number, decimals: number) => {
  return Math.floor(amount * 10 ** decimals);
};

export const finalizeTransaction = async (
  swapTransaction: string,
  wallet: Wallet,
  connection: Connection
): Promise<string> => {
  try {
    // deserialize the transactioncl
    const swapTransactionBuf = Buffer.from(swapTransaction, "base64");

    let transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    if(EXECUTE_SWAP){
      // sign the transaction
      transaction.sign([wallet.payer]);
      const rawTransaction = transaction.serialize();
      const txid = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        // preflightCommitment: "confirmed",
      });

      return txid;
    }else{
      logger.info("Simulating Transaction 🚀")
      await connection.simulateTransaction(transaction)
      logger.info("Simulated Transaction ✅")
    }
 
  } catch (error: any) {
    logger.error("Error finalizing transaction" , error)
  }
};
