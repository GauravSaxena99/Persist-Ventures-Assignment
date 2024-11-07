import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { Data } from "../types/types";
import {
  ADDITIONAL_FEE,
  BUY_UPPER_AMOUNT,
  DISTRIBUTION_AMOUNT,
} from "../config/volumeConfig";
import "dotenv/config";
import base58 from "bs58";
import fs from "fs";
import { buyToken } from "../swapper/buyToken";
import { delay, getSolanaBalance } from "./utils";
import { sellToken } from "../swapper/sellToken";

// Function to distribute SOL among wallets
export const distributeSol = async (
  mainKp: Keypair,
  distritbutionNum: number
) => {
  const solanaConnection = new Connection(process.env.RPC_URL, {
    wsEndpoint: process.env.RPC_WEBSOCKET_ENDPOINT,
  });

  const data: Data[] = [];
  const wallets = [];

  try {
    const sendSolTx: TransactionInstruction[] = [];
    sendSolTx.push(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 250_000 })
    );

    for (let i = 0; i < distritbutionNum; i++) {
      let solAmount = DISTRIBUTION_AMOUNT;
      if (DISTRIBUTION_AMOUNT < ADDITIONAL_FEE + BUY_UPPER_AMOUNT)
        solAmount = ADDITIONAL_FEE + BUY_UPPER_AMOUNT;

      const wallet = Keypair.generate();
      wallets.push({ kp: wallet, buyAmount: solAmount });

      sendSolTx.push(
        SystemProgram.transfer({
          fromPubkey: mainKp.publicKey,
          toPubkey: wallet.publicKey,
          lamports: solAmount * LAMPORTS_PER_SOL,
        })
      );
    }

    let index = 0;
    while (true) {
      try {
        if (index > 3) {
          console.log("Error in distribution");
          return null;
        }
        const latestBlockhash = await solanaConnection.getLatestBlockhash();
        const messageV0 = new TransactionMessage({
          payerKey: mainKp.publicKey,
          recentBlockhash: latestBlockhash.blockhash,
          instructions: sendSolTx,
        }).compileToV0Message();
        const transaction = new VersionedTransaction(messageV0);
        transaction.sign([mainKp]);
        const signature = await solanaConnection.sendRawTransaction(
          transaction.serialize(),
          { skipPreflight: true }
        );
        const confirmation = await solanaConnection.confirmTransaction({
          signature,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          blockhash: latestBlockhash.blockhash,
        });
        if (confirmation.value.err) {
          console.log("Confrimtaion error");
          return "";
        } else {
          console.log(
            `Success in distributing SOL : https://solscan.io/tx/${signature}`
          );
        }
        break;
      } catch (error) {
        index++;
      }
    }

    wallets.map((wallet) => {
      data.push({
        privateKey: base58.encode(wallet.kp.secretKey),
        pubkey: wallet.kp.publicKey.toBase58(),
        solBalance: wallet.buyAmount + ADDITIONAL_FEE,
        tokenBuyTx: null,
        tokenSellTx: null,
      });
    });
    try {
      saveDataToFile(data);
    } catch (error) {}
    console.log("Success in transferring sol");
    return wallets;
  } catch (error) {
    console.log(`Failed to transfer SOL`);
    return null;
  }
};

// Function to buy token
export const buy = async (
  newWallet: Keypair,
  tokenAddress: string,
  buyAmount: number,
) => {
  let solBalance: number = 0;
  try {
    solBalance = await getSolanaBalance(newWallet.publicKey.toString());
  } catch (error) {
    console.log("Error getting balance of wallet");
    return null;
  }
  if (solBalance == 0) {
    console.log(`No SOL in ${newWallet.publicKey.toString()}`)
    return null;
  }

  try {
    const tokenBuyTx = (await buyToken(
      newWallet,
      tokenAddress,
      buyAmount,
      true,
      false
    )) as string;

    editJson({
      tokenBuyTx,
      pubkey: newWallet.publicKey.toBase58(),
      solBalance: solBalance / 10 ** 9 - buyAmount,
    });
    return tokenBuyTx;
  } catch (error) {
    return null;
  }
};

// Function to sell token
export const sell = async (wallet: Keypair ,baseMint: PublicKey) => {
  try {
    const data: Data[] = readJson();
    if (data.length == 0) {
      await delay(1000);
      return null;
    }

    try {
      const tokenSellTx = await sellToken(wallet,true,baseMint.toString(),false,true);
      const solBalance = await getSolanaBalance(wallet.publicKey.toString());

      editJson({
        pubkey: wallet.publicKey.toBase58(),
        tokenSellTx,
        solBalance,
      });
      return tokenSellTx;
    } catch (error) {
      return null;
    }
  } catch (error) {
    return null;
  }
};

// Function to save data to file
export const saveDataToFile = (
    newData: Data[],
    filePath: string = "data.json"
  ) => {
    try {
      let existingData: Data[] = [];
  
      // Check if the file exists
      if (fs.existsSync(filePath)) {
        // If the file exists, read its content
        const fileContent = fs.readFileSync(filePath, "utf-8");
        existingData = JSON.parse(fileContent);
      }
  
      // Add the new data to the existing array
      existingData.push(...newData);
  
      // Write the updated data back to the file
      fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
    } catch (error) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`File ${filePath} deleted and create new file.`);
        }
        fs.writeFileSync(filePath, JSON.stringify(newData, null, 2));
        console.log("File is saved successfully.");
      } catch (error) {
        console.log("Error saving data to JSON file:", error);
      }
    }
  };

// Function to edit JSON file content
export function editJson(newData: any, filename: string = "data.json"): void {
  if (!newData.pubkey) {
    console.log("Pubkey is not provided as an argument");
    return;
  }

  const wallets = readJson(filename);
  const index = wallets.findIndex((wallet) => wallet.pubkey === newData.pubkey);

  if (index !== -1) {
    if (newData.tokenBuyTx) {
      if (!wallets[index].tokenBuyTx) {
        wallets[index].tokenBuyTx = [];
      }
      wallets[index].tokenBuyTx.push(newData.tokenBuyTx);
    }

    if (newData.tokenSellTx) {
      if (!wallets[index].tokenSellTx) {
        wallets[index].tokenSellTx = [];
      }
      wallets[index].tokenSellTx.push(newData.tokenSellTx);
    }

    if (newData.solBalance !== undefined) {
      wallets[index].solBalance = newData.solBalance;
    }

    writeJson(wallets, filename);
  } else {
    console.error(`Pubkey ${newData.pubkey} does not exist.`);
  }
}

// Function to read JSON file
export function readJson(filename: string = "data.json"): Data[] {
  if (!fs.existsSync(filename)) {
    // If the file does not exist, create an empty array
    fs.writeFileSync(filename, "[]", "utf-8");
  }
  const data = fs.readFileSync(filename, "utf-8");
  return JSON.parse(data) as Data[];
}

// Function to write JSON file
export function writeJson(data: Data[], filename: string = "data.json"): void {
  fs.writeFileSync(filename, JSON.stringify(data, null, 4), "utf-8");
}
