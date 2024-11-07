import os
import time
import requests

# Solana RPC URL (mainnet or testnet)
RPC_URL = os.getenv("RPC_URL", "https://api.mainnet-beta.solana.com")  # Solana RPC URL

def check_balance(wallet_address):
    """
    Check the balance of a Solana wallet by interacting with the RPC API.
    """
    # Ensure the wallet address is a valid string (base58 format)
    if not isinstance(wallet_address, str) or len(wallet_address) == 0:
        print("Invalid wallet address format.")
        return None

    # Log the wallet address being used for debugging
    print(f"Checking balance for wallet address: {wallet_address}")

    # Prepare the request payload
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getBalance",
        "params": [wallet_address]  # Use the wallet address directly
    }

    # Make the request to the Solana RPC API
    response = requests.post(RPC_URL, json=payload)

    # Check the response status
    if response.status_code == 200:
        result = response.json()
        print(f"Response from API: {result}")  # Debugging output
        if 'result' in result:
            sol_balance = result['result']['value'] / 1e9  # Convert lamports to SOL
            return sol_balance
        else:
            print(f"Error in response: {result}")
    else:
        print(f"Error fetching balance: {response.status_code} - {response.text}")

    return None


def monitor_balance(wallet_address):
    """
    Monitor the balance of a wallet address and print changes.
    """
    last_balance = check_balance(wallet_address)
    if last_balance is not None:
        print(f"Initial balance for {wallet_address}: {last_balance} SOL")
    
    while True:
        current_balance = check_balance(wallet_address)
        if current_balance != last_balance:
            print(f"Balance change detected for {wallet_address}: {current_balance} SOL")
            last_balance = current_balance
        time.sleep(5)


if __name__ == "__main__":
    # Replace with a **valid Solana wallet address** (test with a known public address)
    wallet_address = "8cLhMka6R5gXXdVg9HFoea2QXT8eqDgP4QQHXr9r1Vgh"  # Example address
    monitor_balance(wallet_address)
