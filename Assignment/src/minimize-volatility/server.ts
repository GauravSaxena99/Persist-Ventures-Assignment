import express from 'express'
import bodyParser from 'body-parser'
import fs from 'fs'
import path from 'path'
import bs58 from "bs58";
import { getRandomNumberInRange, parseTransactionResult, parseTransactionShyft } from '../utils/controllers';
import { BASE_AMOUNT, TOKEN_MINT ,TOKEN_SYMBOL} from '../config/minimizeVolatilityConfig';
// import { Keypair } from '@solana/web3.js';
import { sellToken } from '../swapper/sellToken';
import { buyToken } from '../swapper/buyToken';

const app = express();
const port = 4786;
// const primaryWallet = Keypair.fromSecretKey(bs58.decode(process.env.WALLET_PRIVATE_KEY || ''));

app.use(bodyParser.json());

app.get('/' , (req,res) => {
    res.send("Hey")
});

app.post('/webhook',   
    (req, res) => {

        const transactions = req.body;

        transactions.forEach( async (transaction) => {

            logTransaction(transaction , "nero-helius")
    
            // let parsedTransaction : any; 
            // let result;
    
            // if(transaction?.type == 'SWAP' && transaction?.description){
            //     result =  await parseTransactionDescription(transaction , TOKEN_SYMBOL); 
            // }else{
            //     parsedTransaction = await parseTransactionShyft(transaction?.signature);
            //     result = parseTransactionResult(parsedTransaction?.result);
            // }
    
            // if(result?.buyOrSell == 'BUY' && result?.tokenValue > BASE_AMOUNT){
            //     //sell 50-70% of BUY AMOUNT
            //     const randomPercentage = getRandomNumberInRange(50,70);
            //     const tokenToSell = (randomPercentage/100)*result.tokenValue ;
            //     console.log("SELL TOKEN" , tokenToSell)
            //     // await sellToken(primaryWallet,false,TOKEN_MINT,false,tokenToSell)
            // }
    
            // if(result?.buyOrSell == 'SELL' && result?.tokenValue > BASE_AMOUNT){
            //     //buy 50-70% of SELL AMOUNT
            //     const randomPercentage = getRandomNumberInRange(50,70);
            //     const response: any = await fetch(`https://price.jup.ag/v6/price?ids=SOL&vsToken=${TOKEN_MINT}`);
            //     const priceData = await response.json();
            //     const tokenToBuy = ((randomPercentage/100)*result.tokenValue)/priceData?.data?.SOL?.price ;
            //     console.log("BUY TOKEN" , tokenToBuy)
            //     // await buyToken(primaryWallet,TOKEN_MINT,tokenToBuy,false,false)
            // }
        })

     res.sendStatus(200);
});
   
app.listen(port, () => {
     console.log(`Server listening on port ${port}`);
});

const logTransaction = (transaction , name) => {
    const logFilePath = path.join(__dirname , `${name}.json`)
    let transactions = [];
    if(fs.existsSync(logFilePath)){
        const data = fs.readFileSync(logFilePath , 'utf8');
        transactions = JSON.parse(data);
    }
    transactions.push(transaction);
    fs.writeFileSync(logFilePath , JSON.stringify(transactions,null,2) ,'utf8')
}
