import { ExclusiveHolder, GetTokenAccountsParams, IOpenTrade } from "../types/types";
import fs from "fs";
import path from "path";
import "dotenv/config";
import { SolBalanceObject } from "../types/types";
import { AccountInfo, Connection, ParsedAccountData, PublicKey } from "@solana/web3.js";
import { SOLANA_TOKENPROGRAM_ID } from "../config/consts";
import ExclusiveHolders from '../models/exclusiveholders'
import OpenTrades from "../models/opentrades";
import { logger } from "./logger";
import NotExclusiveHolders from "../models/notexclusiveholders";
import { MIN_SOL_BALANCE_EXCLUSIVE, MIN_TOKEN_AMOUNT_EXCLUSIVE  } from "../config/profitConfig";

// Initialize Helius API key
const apiKey = process.env.HELIUS_API_KEY;

// Function to get token accounts
export async function getTokenAccounts(tokenMintAddress: string) {
  let allOwners = new Set();
  let cursor;

  const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;

  while (true) {
    let params: GetTokenAccountsParams = {
      limit: 1000,
      mint: tokenMintAddress,
    };

    if (cursor != undefined) {
      params.cursor = cursor;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccounts",
        params: params,
      }),
    });

    const data = (await response.json()) as any;

    if (!data.result || data.result.token_accounts.length === 0) {
      break;
    }

    data.result.token_accounts.forEach((
      account) => {
      allOwners.add(account.owner);
    });

    cursor = data.result.cursor;
  }

  fs.writeFileSync(
    "./files/tokenHolders.json",
    JSON.stringify(Array.from(allOwners), null, 2)
  );
}

// Function to get exclusive token holders
export async function getExclusiveTokenHolders(tokenMintAddress: string) {
  const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  await getTokenAccounts(tokenMintAddress);
  try {
    const allOwnersData = JSON.parse(
      fs.readFileSync("./files/tokenHolders.json", "utf8")
    );
    const exclusiveHolders: string[] = [];
    const now = new Date().getTime();

    let i = 0;
    const batchSize = 50;
    console.log("allOwnersData.length", allOwnersData.length);

    do {
      console.log("i", i);
      const slicedAllOwnersData = allOwnersData.slice(
        i,
        Math.min(allOwnersData.length , i + batchSize)
      );
      await Promise.all(
        slicedAllOwnersData.map(async (holder) => {
          const ownerResponse = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "getTokenAccountsByOwner",
              id: 1,
              params: [
                holder,
                {
                  programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                },
                {
                  encoding: "jsonParsed",
                },
              ],
            }),
          });

          const ownerData = (await ownerResponse.json()) as any;
          if (ownerData.result) {
            const ownerTokenAccounts = ownerData.result.value;
            if (
              ownerTokenAccounts.length === 1 &&
              ownerTokenAccounts[0].account.data.parsed.info.mint.toLowerCase() ===
              tokenMintAddress.toLowerCase()
            ) {
              exclusiveHolders.push(holder);
            }
          }
        })
      );
      i += batchSize;
    } while (i < allOwnersData.length);
    fs.writeFileSync(
      "./files/exclusiveHolders.json",
      JSON.stringify(exclusiveHolders, null, 2)
    );
    console.log("Exclusive token holders saved to file.");
  } catch (error) {
    console.error("Error reading owner data from file:", error);
  }
}

// Function to check exclusive token holders
export async function checkExclusiveTokenHolders(tokenMintAddress: string, tokenAddresses: string[]) {
  const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  try {
    const newExclusiveHolders: string[] = [];
    let i = 0;
    const batchSize = 50;
    do {
      const slicedAllOwnersData = tokenAddresses.slice(
        i,
        Math.min(tokenAddresses.length, i + batchSize)
      );
      await Promise.all(
        slicedAllOwnersData.map(async (holder) => {
          const ownerResponse = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "getTokenAccountsByOwner",
              id: 1,
              params: [
                holder,
                {
                  programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                },
                {
                  encoding: "jsonParsed",
                },
              ],
            }),
          });

          const ownerData = (await ownerResponse.json()) as any;
          if (ownerData.result) {
            const ownerTokenAccounts = ownerData.result.value;
            if (
              ownerTokenAccounts.length === 1 &&
              ownerTokenAccounts[0].account.data.parsed.info.mint.toLowerCase() ===
              tokenMintAddress.toLowerCase()
            ) {
              newExclusiveHolders.push(holder);
            }
          }
        })
      );
      i += batchSize;
    } while (i < tokenAddresses.length);

    const pathFile = path.join(__dirname, "..", "./files/exclusiveHolders.json");
    if (fs.existsSync(pathFile)) {
      try {
        const data = fs.readFileSync(pathFile, 'utf8');
        let jsonData;
        if (data.trim() === '') {
          jsonData = [];
        } else {
          jsonData = JSON.parse(data);
        }
        newExclusiveHolders.forEach( holder => {
          jsonData.push(holder);
        });        
        const updatedData = JSON.stringify(jsonData, null, 2);
        fs.writeFileSync(pathFile, updatedData, 'utf8');
        console.log('Exclusive Token Holder file has been updated');
      } catch (err) {
        console.error('Error reading or writing the Exclusive Token Holder File:', err);
      }
    } else {
      try {
        const exclusiveHolderData = JSON.stringify(newExclusiveHolders, null, 2);
        fs.writeFileSync(pathFile, exclusiveHolderData, 'utf8');
        console.log('Exclusive Token Holder file has been updated');
      } catch (err) {
        console.error('Error writing the Exclusive Token Holder File:', err);
      }
    }
  } catch (error) {
    console.error("Error updating Exclusive Token Holder File:", error);
  }

}

// Function to get SOL balance
export async function getSolanaBalance(walletAddress: string): Promise<number> {
  const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;

  for (let attempts = 0; attempts < 5; attempts++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "getBalance",
          id: 1,
          params: [walletAddress],
        }),
      });

      const data = (await response.json()) as any;
      if (data.result) {
        return (data.result.value / 1e9) ;
      } else if (data.error && data.error.code === -32429) {
        console.error("Exceeded limit for RPC, retrying in 1 second...");
        await delay(1000);
      } else {
        console.error("Error fetching balance:", data.error);
        break;
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
      break;
    }
  }

  return 0;
}

// Function to get multiple SOL balances
export async function getMultipleAccountsSolanaBalance(
  walletAddresses: string[]
): Promise<SolBalanceObject> {

  const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  const solBalances: { [key: string]: { sol: number } } = {};
  const slicedWalletAddress = [];

  for (let i = 0; i < walletAddresses.length; i += 100) {
    slicedWalletAddress.push(walletAddresses.slice(i, Math.min(walletAddresses.length, i + 100)));
  }

  const connection = new Connection(url, 'confirmed');

  try {
    await Promise.all(slicedWalletAddress.map(async (walletAddresses) => {
      const walletPubkeys = walletAddresses.map((walletAddress) => new PublicKey(walletAddress))
      const accounts = await connection.getMultipleAccountsInfo(walletPubkeys)
      accounts.forEach((account, index) => {
        if (account !== null) {
          const lamports = account.lamports;
          const sol = lamports / 1e9;
          solBalances[walletAddresses[index]] = { sol: sol }
        } else {
          solBalances[walletAddresses[index]] = { sol: 0 }
        }
      });
    }))
    delay(1000)
  } catch (err) {
    console.log("ERROR FETHING SOLANA BALANCES", err)
  }

  return solBalances;
}

// Function to read exclusive token holders
export async function readExclusiveTokenHolders(): Promise<ExclusiveHolder[]> {
  try {
    const walletAddressArray = await ExclusiveHolders.find(
      { openTrade: false },
      'walletAddress solBalance tokenAddress'
    ).lean();

    return walletAddressArray;
  } catch (err) {
    console.error("An error occurred while retrieving wallet addresses:", err);
    return []; 
  }
}

export function readTokenHolders(): string[] {
  const filePath = path.join(__dirname, "..", "./files/tokenHolders.json");

  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, "utf8");
    if (data.trim() === "") {
      return [];
    }
    return JSON.parse(data);
  }

  return [];
}

// Function to read open trades
export  async function readOpenTrades(): Promise<IOpenTrade[]> {
  try {
    const openTradesArray = await OpenTrades.find({}).lean();

    return openTradesArray;
  } catch (err) {
    console.error("An error occurred while retrieving open trades:", err);
    return []; 
  }
}

// Function to get token decimals
export async function getTokenDecimals(tokenAddress: string) {
  const connection = new Connection(process.env.RPC_URL)
  let mint = await connection.getParsedAccountInfo(
    new PublicKey(tokenAddress)
  );

  if (!mint || !mint.value || mint.value.data instanceof Buffer) {
    throw new Error("Could not find mint");
  }

  const decimals = mint.value.data.parsed.info.decimals;
  return decimals
}

// Function to delay
export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Gets amount of tokens in wallet for given addressToken
 * @param {string} addressOfToken
 * @returns {Promise<number> || Promise<boolean>} amountOfToken
 */
export const getBalanceOfToken = async (
  publicKeyOfWalletToQuery: string,
  addressOfToken: string,
): Promise<number> => {
  try {
    if (!publicKeyOfWalletToQuery) {
      throw new Error("No wallet to query");
    }
    const accounts = await getParsedProgramAccounts(
      publicKeyOfWalletToQuery,
    );

    const relevantAccount = accounts.find((account) => {
      const parsedAccountInfo = account.account.data;
      if (parsedAccountInfo instanceof Buffer) {
        console.log("parsedAccountInfo is a buffer");
        return false; // Skip this account
      }
      const mintAddress = parsedAccountInfo["parsed"]["info"]["mint"];
      if (mintAddress === addressOfToken) {
        return true; // This account is relevant
      }
      return false; // Skip this account
    });
    if (!relevantAccount) {
      return 0;
    }
    if (relevantAccount.account.data instanceof Buffer) {
      throw new Error("relevantAccount is a buffer");
    }

    const tokenBalance =
      relevantAccount.account.data["parsed"]["info"]["tokenAmount"]["uiAmount"];

    return tokenBalance;
  } catch (error: any) {
    throw new Error(error);
  }
};

// Function to get parsed program accounts
export async function getParsedProgramAccounts(
  wallet: string,
): Promise<
  {
    pubkey: PublicKey;
    account: AccountInfo<ParsedAccountData | Buffer>;
  }[]
> {

  const connection = new Connection(process.env.RPC_URL)
  const filters = [
    {
      dataSize: 165, // size of account (bytes)
    },
    {
      memcmp: {
        offset: 32, // location of our query in the account (bytes)
        bytes: wallet, // our search criteria, a base58 encoded string
      },
    },
  ];
  const TOKEN_PROGRAM_ID = new PublicKey(SOLANA_TOKENPROGRAM_ID);
  const accounts = await connection.getParsedProgramAccounts(
    TOKEN_PROGRAM_ID,
    { filters: filters }
  );
  return accounts;
}

// Function to check exclusive token holder
export async function checkExclusiveTokenHolder(tokenMintAddress: string, walletAddress: string)  {

  const existingNotExclusiveHolder = await NotExclusiveHolders.findOne({ walletAddress });
  if (existingNotExclusiveHolder) {
    return null;  
  }

  const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}` ;
  
  try {
      const ownerResponse = await fetch( url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "getTokenAccountsByOwner",
              id: 1,
              params: [
                walletAddress,
                {
                  programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                },
                {
                  encoding: "jsonParsed",
                },
              ],
            }),
      });

      const ownerData = (await ownerResponse.json()) as any;

            if (ownerData.result) {
            const ownerTokenAccounts = ownerData.result.value;
            if (
              ownerTokenAccounts.length === 1 &&
              ownerTokenAccounts[0].account.data.parsed.info.mint.toLowerCase() ===
              tokenMintAddress.toLowerCase()
            ) {
                logger.info("Exclusive Holder Found")
                const solBalance:number = await getSolanaBalance(walletAddress) ;
                const tokenBalance: number = ownerTokenAccounts[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount
                const minTokenBalance = await calculateTokenAmountForUSDC(tokenMintAddress,MIN_TOKEN_AMOUNT_EXCLUSIVE)
                
                if(solBalance > MIN_SOL_BALANCE_EXCLUSIVE && tokenBalance > minTokenBalance){
                  
                  await ExclusiveHolders.create({
                     walletAddress: walletAddress,
                     tokenAddress: tokenMintAddress,
                     solBalance: solBalance,
                     tokenBalance: tokenBalance,
                     openTrade: false,
                   }).then( () => {
                     logger.info('Exclusive holder added successfully')
                   }).catch( (err) => {
                     logger.error('Error adding Exclusive holder:',{ message: err.message, stack: err.stack });
                   })
       
                return {
                  walletAddress,
                  tokenMintAddress,
                  solBalance,
                  tokenBalance
                }
              }else{
                
              }

            }else{

              await NotExclusiveHolders.create({
                walletAddress: walletAddress,
                tokenAddress: tokenMintAddress,
              }).catch( (err) => {
                logger.error('Error adding Not Exclusive holder:',{ message: err.message, stack: err.stack });
              })
            }
          }
   

    } catch (error) {
      logger.error("Error checking for exclusive holder = ", { message: error , stack: error.stack });
    }

  return null
}

// Function to calculate token amount for USDC
export async function calculateTokenAmountForUSDC(tokenAddress: string, amountInUSDC: number): Promise<number> {
  const response = await fetch(`https://price.jup.ag/v6/price?ids=${tokenAddress}`);
  const data = await response.json();
  
  const tokenPrice = data?.data[tokenAddress]?.price;
  const tokenAmount = Math.floor((1 / tokenPrice) * amountInUSDC);
  
  return tokenAmount;
}

// Function to get token price
export async function getTokenPrice(tokenAddress: string): Promise<number> {
  const response = await fetch(`https://price.jup.ag/v6/price?ids=${tokenAddress}`);
  const data = await response.json();
  return data?.data[tokenAddress]?.price || 0;
}