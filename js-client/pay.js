import StellarSdk from "stellar-sdk";
import { CONTRACT_ID, XLM_TOKEN, ADMIN_SECRET, SOROBAN_RPC_URL } from "./config.js";

const { Keypair, Networks, TransactionBuilder, BASE_FEE } = StellarSdk;

async function payRoyalty() {
  // Connect to Soroban RPC
  const server = new Server(SOROBAN_RPC_URL);

  const keypair = Keypair.fromSecret(ADMIN_SECRET);

  // Fetch account details
  const account = await server.getAccount(keypair.publicKey());

  // Build transaction (simplified for Soroban invokeHostFunction)
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation({
      type: "invokeHostFunction",
      function: "pay",
      parameters: [
        XLM_TOKEN, // token address
        keypair.publicKey(), // payer
        "100000000", // amount (10 XLM)
      ],
      source: keypair.publicKey(),
    })
    .setTimeout(30)
    .build();

  tx.sign(keypair);

  // Send transaction
  const prepared = await server.prepareTransaction(tx);
  const response = await server.sendTransaction(prepared);

  console.log("Transaction Hash:", response.hash);
}

payRoyalty();
