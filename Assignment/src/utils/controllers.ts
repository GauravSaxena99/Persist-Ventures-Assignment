import path from "path";
import fs from 'fs';
import 'dotenv/config'
import { logger } from "./logger";
import { TOKEN_DETAILS } from "../config/profitConfig";

// Function to convert timestamp to readable format
export const convertTimestampToReadableFormat = (timestamp) => {
  const date = new Date(timestamp);

  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  };

  return date.toLocaleString('en-US', options as any);
};

// Function to parse transaction using Shyft API
export const parseTransactionShyft = async (txSig) => {
  const url = `https://api.shyft.to/sol/v1/transaction/parsed?network=mainnet-beta&txn_signature=${txSig}`;
  const myHeaders = new Headers();
  myHeaders.append("x-api-key", process.env.SHYFT_API_KEY);

  var requestOptions = {
    method: 'GET',
    headers: myHeaders,
    redirect: 'follow'
  };

  try {
    const response = await fetch(url, requestOptions as any);
    const result = await response.json();
    return result;
  } catch (error) {
    logger.error('Error Parsing transaction Shyft :- ', error);
  }
}

// Function to parse shyft transaction result
export const parseTransactionResult = (transaction) => {

  if (transaction?.type?.includes('SWAP')) {
    const action = transaction?.actions[0] || [];
    let signature = transaction?.signatures[0]
    let buyOrSell: string;
    let tokenValue: number;
    let symbol: string;
    let feePayer: string = transaction?.fee_payer

    const allTokenAddresses = Object.values(TOKEN_DETAILS)
    let tokenAddress : string ;

    if(allTokenAddresses.includes(action?.info?.tokens_swapped?.in?.token_address) && !allTokenAddresses.includes(action?.info?.tokens_swapped?.out?.token_address)){
      tokenAddress = action?.info?.tokens_swapped?.in?.token_address
    }else if(!allTokenAddresses.includes(action?.info?.tokens_swapped?.in?.token_address) && allTokenAddresses.includes(action?.info?.tokens_swapped?.out?.token_address)){
      tokenAddress = action?.info?.tokens_swapped?.out?.token_address
    }else{
      return null
    }

    if (action?.info?.tokens_swapped?.in?.token_address == tokenAddress) {
      buyOrSell = 'SELL',
      symbol = (action?.info?.tokens_swapped?.in?.symbol)
      tokenValue = (action?.info?.tokens_swapped?.in?.amount);
    }

    if (action?.info?.tokens_swapped?.out?.token_address == tokenAddress) {
      buyOrSell = 'BUY',
      symbol = (action?.info?.tokens_swapped?.out?.symbol)
      tokenValue = (action?.info?.tokens_swapped?.out?.amount);
    }

    if (buyOrSell == 'SELL' || buyOrSell == 'BUY') {
      return { buyOrSell, tokenValue, signature, symbol, feePayer , tokenAddress}
    }

  } 

  return null
}

// Function to parse helius swap transaction
export async function parseTransactionHeliusSwap(transaction) {

  const allTokenSymbols: string[] = Object.keys(TOKEN_DETAILS);
  const description = transaction?.description;
  const match = description.split(' ')
  if (match) {
    const amountSold = parseFloat(match[2]);
    const tokenSold = match[3];
    const amountBought = parseFloat(match[5]);
    const tokenBought = match[6];

    let tokenSymbol : string ;

    if(allTokenSymbols.includes(tokenSold) && !allTokenSymbols.includes(tokenBought)){
      tokenSymbol = tokenSold
    }else if(!allTokenSymbols.includes(tokenSold) && allTokenSymbols.includes(tokenBought)){
      tokenSymbol = tokenBought
    }else{
      return null
    }

    if (tokenSold == tokenBought) {
      return null
    }

    if (tokenSold != tokenSymbol && tokenBought != tokenSymbol) {
      return null
    }

    let tokenAddress = TOKEN_DETAILS[tokenSymbol]
    let buyOrSell;
    let tokenValue;
    let signature = transaction?.signature;
    let feePayer = transaction?.feePayer;

    if (tokenSymbol === tokenSold) {
      buyOrSell = 'SELL';
      tokenValue = amountSold;
    } else if (tokenSymbol === tokenBought) {
      buyOrSell = 'BUY';
      tokenValue = amountBought;
    } else {
      buyOrSell = 'unknown';
    }

    return {
      feePayer,
      tokenAddress,
      tokenSymbol,
      signature,
      tokenValue,
      buyOrSell,
    };
  }
  return null;
}
// Function to parse helius transfer transaction
export async function parseTransactionHeliusTransfer(transaction) {
  const description = transaction?.description;
  const parts = description.split(' ');
  if(parts){
    const fromAccount = parts[0];
    const tokenTransferred = parseFloat(parts[1]);
    const tokenSymbol = parts[3];
    let toAccount = parts[4];
  
    toAccount = toAccount.endsWith('.') ? toAccount.slice(0, -1) : toAccount;
  
    return {
      fromAccount,
      tokenTransferred,
      tokenSymbol,
      toAccount
    };
  }
  return null;
}

// Function to get random number in range
export function getRandomNumberInRange(min, max) {
  if (min > max) {
    throw new Error("Minimum value must be less than or equal to the maximum value.");
  }

  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Function to log transaction
export const logTransaction = (transaction, name) => {
  const logFilePath = path.join(__dirname, `${name}.json`)
  let transactions = [];

  if (fs.existsSync(logFilePath)) {
    const data = fs.readFileSync(logFilePath, 'utf8');
    transactions = JSON.parse(data);
  }

  transactions.push(transaction);
  fs.writeFileSync(logFilePath, JSON.stringify(transactions, null, 2), 'utf8')
}

// Function to read transaction
export const readTransaction = (name) => {

  const logFilePath = path.join(__dirname, `${name}.json`);
  let transactions = [];
  let transaction;

  if (fs.existsSync(logFilePath)) {
    const data = fs.readFileSync(logFilePath, 'utf8');
    transactions = JSON.parse(data);
    transaction = transactions.shift();
    fs.writeFileSync(logFilePath, JSON.stringify(transactions, null, 2), 'utf8')

    return transaction;
  }

  return []
}