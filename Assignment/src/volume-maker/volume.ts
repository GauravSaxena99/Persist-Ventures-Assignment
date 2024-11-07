import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import base58 from "bs58";
import "dotenv/config";
import { buy, distributeSol, sell } from "../utils/volumeUtils";
import { delay, getSolanaBalance } from "../utils/utils";
import {
  ADDITIONAL_FEE,
  BUY_AMOUNT,
  BUY_INTERVAL_MAX,
  BUY_INTERVAL_MIN,
  BUY_LOWER_AMOUNT,
  BUY_UPPER_AMOUNT,
  DISTRIBUTION_NUM,
  IS_RANDOM,
  TOKEN_MINT,
  TOTAL_TRANSACTION,
} from "../config/volumeConfig";

const main = async () => {
  const mainKp = Keypair.fromSecretKey(
    base58.decode(process.env.WALLET_PRIVATE_KEY)
  );
  const solBalance =
    (await getSolanaBalance(mainKp.publicKey.toString())) / LAMPORTS_PER_SOL;
  const baseMint = new PublicKey(TOKEN_MINT);

  console.log(`Volume bot is running`);
  console.log(`Wallet address: ${mainKp.publicKey.toBase58()}`);
  console.log(`Pool token mint: ${baseMint.toBase58()}`);
  console.log(`Wallet SOL balance: ${solBalance.toFixed(3)}SOL`);
  console.log(`Distribute SOL to ${DISTRIBUTION_NUM} wallets`);

  if (TOTAL_TRANSACTION % 2 !== 0) {
    throw new Error("Total transactions must be even for balanced buy/sell.");
  }

  let data:
    | {
        kp: Keypair;
        buyAmount: number;
      }[]
    | null = null;

  if (solBalance < (BUY_LOWER_AMOUNT + ADDITIONAL_FEE) * DISTRIBUTION_NUM) {
    console.log("Sol balance is not enough for distribution");
  }

  data = (await distributeSol(mainKp, DISTRIBUTION_NUM)) as any;

  if (data === null) {
    console.log("Distribution failed");
    return;
  }

  const buyPriority = [];
  const sellPriority = [];

  data.map(({ kp }) => {
    buyPriority.push({ kp });
  });

  if (buyPriority.length === 0 || TOTAL_TRANSACTION <= 0) {
    throw new Error(
      "Invalid input: buyPriority cannot be empty and totalTransactions must be positive."
    );
  }

  let buyCount = 0;
  let sellCount = 0;
  const maxTransactions = TOTAL_TRANSACTION / 2;

  console.log("Transaction will start after 30 Seconds");
  await delay(30000);

  for (let i = 0; i < TOTAL_TRANSACTION; i++) {
    // buy part
    const BUY_INTERVAL = Math.round(
      Math.random() * (BUY_INTERVAL_MAX - BUY_INTERVAL_MIN) + BUY_INTERVAL_MIN
    );

    let buyAmount: number;
    if (IS_RANDOM)
      buyAmount = Number(
        (
          Math.random() * (BUY_UPPER_AMOUNT - BUY_LOWER_AMOUNT) +
          BUY_LOWER_AMOUNT
        ).toFixed(6)
      );
    else buyAmount = BUY_AMOUNT;

    const buyProbability =
      buyPriority.length == 0
        ? 0
        : buyPriority.length / (buyPriority.length + sellPriority.length);
    const buyDecision = Math.random() < buyProbability;

    if (buyDecision) {
      // Buy transaction
      if (buyCount < maxTransactions) {
        const wallet = buyPriority.pop();
        sellPriority.push(wallet);

        const solBalance =
          (await getSolanaBalance(wallet.kp.publicKey.toString())) /
          LAMPORTS_PER_SOL;
        if (solBalance < ADDITIONAL_FEE) {
          console.log("Balance is not enough: ", solBalance, "SOL");
          return;
        }

        // try buying until success
        let k = 0;
        while (true) {
          if (k > 10) {
            console.log("Error in buy transaction");
            return;
          }
          const result = await buy(wallet.kp, baseMint.toBase58(), buyAmount);
          if (result) {
            break;
          } else {
            k++;
            console.log("Buy failed, try again");
            await delay(2000);
          }
        }
        buyCount++;
      } else {
        console.warn(
          "Buy limit reached, performing random sell (if possible)."
        );
        // Handle exhausted buy priority (optional: random sell)
        // try selling until success
        const wallet = sellPriority.shift();
        buyPriority.unshift(wallet);

        let j = 0;
        while (true) {
          if (j > 10) {
            console.log("Error in sell transaction");
            return;
          }
          const result = await sell(wallet.kp, baseMint);
          if (result) {
            break;
          } else {
            j++;
            console.log("Sell failed, try again");
            await delay(2000);
          }
        }
        sellCount++;
      }
    } else {
      if (sellCount < maxTransactions) {
        const wallet = sellPriority.shift();
        buyPriority.unshift(wallet);

        let j = 0;
        while (true) {
          if (j > 10) {
            console.log("Error in sell transaction");
            return;
          }
          const result = await sell(wallet.kp, baseMint);
          if (result) {
            break;
          } else {
            j++;
            console.log("Sell failed, try again");
            await delay(2000);
          }
        }
        sellCount++;
      } else {
        console.warn("Sell limit reached, no further transactions.");
        // Handle exhausted sell priority (optional: ignore sell)
        break; // Exit loop if both buy and sell limits reached
      }
    }
    console.log("Time delay = " , (5000 + DISTRIBUTION_NUM * BUY_INTERVAL)/1000 )
    await delay(5000 + DISTRIBUTION_NUM * BUY_INTERVAL);
  }
};

main();
