import { Keypair } from "@solana/web3.js";
import { SMALL_AMOUNT , TOKEN_SYMBOL , TOKEN_MINT, TIME_INTERVAL} from "../config/strategicSellingConfig";
import bs58 from "bs58";
import 'dotenv/config'
import { sellToken } from "../swapper/sellToken";

const primaryWallet = Keypair.fromSecretKey(bs58.decode(process.env.WALLET_PRIVATE_KEY || ''));

const timelySell = ( async () => {

    // await sellToken(primaryWallet,false,TOKEN_MINT,false,SMALL_AMOUNT);

    setInterval( async () => {
    //    await sellToken(primaryWallet,false,TOKEN_MINT,false,SMALL_AMOUNT);
    }, TIME_INTERVAL )
})

timelySell()