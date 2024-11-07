import express from 'express'
import bodyParser from 'body-parser'
import { getRandomNumberInRange, logTransaction, parseTransactionResult, parseTransactionHeliusSwap, parseTransactionShyft, readTransaction } from '../utils/controllers';
import { BASE_AMOUNT, SMALL_AMOUNT, TIME_INTERVAL, TOKEN_MINT , TOKEN_SYMBOL} from '../config/strategicSellingConfig';
import { Keypair } from '@solana/web3.js';
import bs58 from "bs58";
import { sellToken } from '../swapper/sellToken';
import mongoose from "mongoose"





const app = express();
const port = 3001;
let totalBuy = 0;
let totalSell = 0;

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));

app.get('/', (req, res) => {
    res.send("Hey")
})

app.post('/webhook', async (req, res) => {

    const transactions = req.body;

    // transactions.forEach( async (transaction) => {

    //     let parsedTransaction : any; 
    //     let result;

    //     if(transaction?.type == 'SWAP' && transaction?.description){
    //         result =  await parseTransactionHeliusSwap(transaction , TOKEN_SYMBOL); 
    //     }else{
    //         parsedTransaction = await parseTransactionShyft(transaction?.signature);
    //         result = parseTransactionResult(parsedTransaction?.result);
    //     }

    //     result?.buyOrSell == 'BUY' ? (totalBuy += result?.tokenValue) : (totalSell += result?.tokenValue) ;

    //     if(result?.buyOrSell == 'BUY' && result?.tokenValue > BASE_AMOUNT){
    //         //sell 50-70% of BUY AMOUNT
    //         const randomPercentage = getRandomNumberInRange(50,70);
    //         const tokenToSell = (randomPercentage/100)*result.tokenValue ;
    //         // await sellToken(primaryWallet,false,TOKEN_MINT,false,tokenToSell)
    //     }

    //     if( (totalBuy-totalSell) > BASE_AMOUNT ){
    //         const randomPercentage = getRandomNumberInRange(50,70);
    //         const tokenToSell = (randomPercentage/100)*BASE_AMOUNT ;
    //         // await sellToken(primaryWallet,false,TOKEN_MINT,false,tokenToSell);
    //     }

    //     console.log("total buy" , totalBuy);
    //     console.log("total sell" , totalSell);
    //     console.log("\n")
    // })

res.sendStatus(200);

});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});


