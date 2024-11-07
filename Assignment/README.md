# Market Maker Bot

## Overview

The goal of this Market Maker bot is fourfold:

1. **Add Volume**  
   The market maker should place large buy orders that contribute to showing good volume on the decentralized exchange (DEX).

2. **Minimize Volatility**  
   If a buy order causes a significant spike in the chart (e.g., a 50% increase), the market maker will automatically execute a large sell order to minimize such giant spikes, ensuring the market remains stable.

3. **Offer Strategic Selling**  
   Market makers are often employed by teams to help manage their tokens. Sometimes, these teams wish to sell some of their tokens for profit without negatively impacting the chart. The best way to achieve this is by selling during upswings. This approach does not hurt the upward momentum but instead controls the speed of the rise, keeping the chart looking "bullish." Rapid increases can make a chart appear unstable.

4. **Create Profit**  
   The market maker should strategically trade, using predictive analysis to gain advantages by buying and selling at optimal times.

## Environment Configuration

Ensure you configure your environment variables in an `.env` file before running the scripts. Below is an example configuration:

```ini
HELIUS_API_KEY=your_helius_api_key
SHYFT_API_KEY=your_shyft_api_key
RPC_URL=your_rpc_url
WALLET_PRIVATE_KEY=your_wallet_private_key
WALLET_PUBLIC_KEY=your_wallet_public_key
RPC_WEBSOCKET_ENDPOINT=your_rpc_websocket_endpoint
```

# Volume Script Configuration

Before running the volume script, ensure the following configuration parameters are set:

```javascript
export const DISTRIBUTION_AMOUNT = 0.01;
export const DISTRIBUTION_NUM = 3;
export const TOKEN_MINT = "9hjZ8UTNrNWt3YUTHVpvzdQjNbp64NbKSDsbLqKR6BZc";
export const ADDITIONAL_FEE = 0.005;
export const BUY_AMOUNT = 0.01;
export const BUY_UPPER_AMOUNT = 0.002;
export const BUY_LOWER_AMOUNT = 0.001;
export const BUY_INTERVAL_MAX = 4000;
export const BUY_INTERVAL_MIN = 2000;
export const IS_RANDOM = true;
export const TOTAL_TRANSACTION = 20;
```

## How to Run the Script

This script is designed to automate the distribution of SOL to multiple wallets and execute endless buy and sell swap transactions simultaneously on the Raydium platform. It leverages Solana's blockchain technology to perform these operations efficiently.

### Features

- **Automated SOL Distribution:** Distributes SOL to new wallets.
- **Endless Buy and Sell Swaps:** Performs simultaneous buy and sell transactions.
- **Configurable Parameters:** Allows customization of buy amounts, intervals, distribution settings, and more.

### Usage

1. **Clone the repository:**

   ```sh
   git clone https://github.com/your-repository.git
   ```

2. **Install dependencies:**

```sh
npm install
```
3. **Configure the environment variables:**

Rename the .env.copy file to .env and fill in the required details.

4. **Run the script:**

You can run the script using either yarn or npm:

```sh
yarn volume
```

or

```sh
npm run volume
```

This will start the bot, executing the configured volume distribution and buy/sell transactions as per the parameters you set.


# Profit Script Configuration

Before running the profit scripts, ensure the following configuration parameters are set:

```javascript
export const MIN_TOKEN_AMOUNT = 1000 
export const MIN_SOL_BALANCE = 10
export const MIN_SOL_BALANCE_EXCLUSIVE = 5 
export const MIN_TOKEN_AMOUNT_EXCLUSIVE = 500 
export const AUTO_SELL = true
export const ENABLE_AUTO_SELL_PROFIT = true;  
export const ENABLE_AUTO_SELL_LOSS = true; 
export const AUTO_SELL_PROFIT_PERCENTAGE = 10; 
export const AUTO_SELL_LOSS_PERCENTAGE = 20;    
export const PRICE_CHECK_INTERVAL = 5000; 
export const OPEN_TRADE_EXPIRATION_TIME = 3600000 
export const MIN_SOL_DIFFERENCE_TO_UPDATE = 5; 
export const MIN_SOL_DIFFERENCE_TO_SELL = 1;
export const MIN_TOKEN_DIFFERENCE_TO_SELL_USDC = 100; 
export const TOKEN_DETAILS = {
    'r/snoofi' : "7M9KJcPNC65ShLDmJmTNhVFcuY95Y1VMeYngKgt67D1t" ,
    'vibes' :    "Ed1yisBEAo8UXToSswvVFgzyJKpF48HEdq5kvz2zpump" ,
    'SOLEX' :    "3ceMC8r66WzTFGunkUckoKAbYMXWfzXsgWwmXSYY4x6L"
}
```

### Features

- **Automated Profit Management:** Monitors and manages trades for optimal profit.
- **SOL Balance Tracking:** Keeps track of SOL balance changes for exclusive token holders.
- **Token Purchase Monitoring:** Monitors token purchases and manages open trades.
- **Auto-Sell Functionality:** Automatically sells tokens based on profit or loss percentages.
- **Configurable Parameters:** Allows customization of various thresholds and settings.
- **Multi-Token Support:** Can handle multiple tokens simultaneously.

## How to Run the Script

The profit script consists of three main components located in the profit folder:

**Server:** Handles incoming transactions and manages the overall process.

**Monitor SOL Balances:** Monitors SOL balance changes for exclusive holders.

**Monitor Token Purchase:** Tracks token purchases and manages open trades.

To run these scripts, use the following commands:

```sh
npm run profit
npm run monitor-solbalance
npm run monitor-opentrade
```

Or if you're using Yarn:

```sh
yarn profit
yarn monitor-solbalance
yarn monitor-opentrade
```


