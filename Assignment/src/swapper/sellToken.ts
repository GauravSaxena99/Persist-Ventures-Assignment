import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Wallet } from "@project-serum/anchor";
import bs58 from "bs58";
import { getBalanceOfToken, getTokenDecimals } from "../utils/utils";
import "dotenv/config";
import {
  convertToInteger,
  finalizeTransaction,
  getQuote,
  getSwapTransaction,
} from "./swapperHelper";
import { SOLANA_ADDRESS } from "../config/consts";
import { logger } from "../utils/logger";

export const sellToken = async (
  primaryWallet: Keypair,
  sellAll: boolean,
  addressOfTokenOut: string,
  waitForConfirmation: boolean,
  wantAmountOfSolIn: boolean,
  amountOfTokenToSell?: number,
): Promise<number | string> => {
  if (!sellAll && !amountOfTokenToSell) {
    throw new Error(
      "You need to specify AMOUNT_OF_TOKEN_TO_SELL if SELL_ALL is false"
    );
  }

  const connection = new Connection(process.env.RPC_URL);
  const wallet = new Wallet(primaryWallet);

  const publicKeyOfWalletToQuery = wallet.publicKey.toString();
  sellAll
    ? (amountOfTokenToSell = await getBalanceOfToken(
        publicKeyOfWalletToQuery,
        addressOfTokenOut
      ))
    : amountOfTokenToSell;

  if (!amountOfTokenToSell) {
    throw new Error("No tokens to sell");
  }

  logger.info(`Selling ${amountOfTokenToSell} Tokens 🚀`);

  try {
    const decimals = await getTokenDecimals(addressOfTokenOut);
    const slippage = 100; // slippage is 1%
    const convertedAmountOfTokenOut = convertToInteger(
      amountOfTokenToSell,
      decimals
    );

    const quoteResponse = await getQuote(
      addressOfTokenOut,
      SOLANA_ADDRESS,
      convertedAmountOfTokenOut,
      slippage
    );

    const amountOfSolIn: number =
    quoteResponse.routePlan[quoteResponse.routePlan.length - 1].swapInfo
      .outAmount;

    const walletPublicKey = wallet.publicKey.toString();

    const swapTransaction = await getSwapTransaction(
      quoteResponse,
      walletPublicKey
    );

    const txid = await finalizeTransaction(swapTransaction, wallet, connection);

    const latestBlockhash = await connection.getLatestBlockhash()

    if(waitForConfirmation){
      logger.info("Waiting for confirmation... 🕒");
      
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
    //   //wait
    //   let subscriptionId;
    //   try {
    //     subscriptionId = connection.onSignature(
    //       txid,
    //       (updatedTxInfo, context) => {
    //         if (updatedTxInfo.err) {
    //           console.error("Transaction failed:", updatedTxInfo.err);
    //         }
    //       },
    //       "finalized"
    //     );
    //   } finally {
    //     if (subscriptionId) {
    //       connection.removeSignatureListener(subscriptionId);
    //     }
    //   }
    // } 

    logger.info(`Sold ${amountOfTokenToSell} Token for ${amountOfSolIn} SOL ✅`);
    logger.info(`Signature = https://solscan.io/tx/${txid}`)

    if (wantAmountOfSolIn) {
      return amountOfSolIn;
    } else {
      return txid;
    }
  } catch (error: any) {
    throw new Error(error);
  }
};
