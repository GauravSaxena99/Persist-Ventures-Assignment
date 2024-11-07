import 'dotenv/config'
import { logger } from '../utils/logger';

export const createWebhook = async (tokenAddresses) => {
    try {
      const response = await fetch(
        `https://api.helius.xyz/v0/webhooks?api-key=${process.env.HELIUS_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
          "webhookURL": "https://p8gmdtms-3002.inc1.devtunnels.ms/webhook/",
          "transactionTypes": ["Any"],
          "accountAddresses": tokenAddresses,
          "webhookType": "enhanced", // "rawDevnet"
          "txnStatus": "success", // success/failed
       }),
        }
      );
      const data = await response.json() as any;
      logger.info('Webhook setup successfully ✅')
      return data.webhookID
    } catch (e) {
      console.error("error", e);
    }
};