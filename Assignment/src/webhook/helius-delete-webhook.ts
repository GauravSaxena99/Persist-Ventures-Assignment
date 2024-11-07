import 'dotenv/config';
import { logger } from '../utils/logger';

export const deleteWebhook = async (id: string) => {
  try {
    const response = await fetch(
      `https://api.helius.xyz/v0/webhooks/${id}?api-key=${process.env.HELIUS_API_KEY}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if(response.status == 200){
        logger.info("Webhook deleted successfully ✅")
    }

  } catch (e) {
    console.error("Error:", e);
  }
};

