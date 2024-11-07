import requests

# Define the Solana RPC endpoint
RPC_URL = "https://api.mainnet-beta.solana.com"  # You can also try other public RPC endpoints

# Function to check the balance of a wallet
def check_balance(wallet_address):
    # Ensure the wallet address is a valid string (base58 format) and of correct length
    if not isinstance(wallet_address, str) or len(wallet_address) != 44:
        print(f"Invalid wallet address format: {wallet_address}")
        return None

    # Print the wallet address to check its value
    print(f"Checking balance for wallet address: {wallet_address}")

    # Prepare the request payload
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getBalance",
        "params": [wallet_address]  # Ensure wallet_address is valid string
    }

    # Make the API call
    try:
        response = requests.post(RPC_URL, json=payload)

        if response.status_code == 200:
            result = response.json()
            if 'result' in result:
                sol_balance = result['result']['value'] / 1e9  # Convert lamports to SOL
                return sol_balance
            else:
                print(f"Error in response: {result}")  # Log the full error message
        else:
            print(f"Error fetching balance: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"Error during API call: {e}")

    return None


# Test the balance checking function with a valid wallet address
def main():
    # Replace with an actual Solana wallet address (base58 encoded)
    wallet_address = "4k3F4dFiV2Ckwxu8C8DsyyfgYgqvFf9twwh9JomCv6eG"  # Replace with your actual wallet address

    # Check the current balance of the wallet
    sol_balance = check_balance(wallet_address)

    if sol_balance is not None:
        print(f"Wallet balance: {sol_balance} SOL")

        # Example logic to trigger actions based on balance (this is just an example)
        if sol_balance < 10:
            print("Warning: Insufficient SOL balance!")
        else:
            print("SOL balance is sufficient to perform trades.")
    else:
        print("Failed to retrieve balance.")


if __name__ == "__main__":
    main()
