import React, { useState } from "react";
import {
  isConnected,
  requestAccess,
  getAddress,
} from "@stellar/freighter-api";

const WalletConnect = ({ setAccount }) => {
  const [address, setAddress] = useState("");

  const connectWallet = async () => {
    try {
      const connected = await isConnected();
      if (!connected) {
        alert("Freighter wallet not installed");
        return;
      }

      // Ask permission
      await requestAccess();

      const addrObj = await getAddress();
      const walletAddress = addrObj?.address;

      if (!walletAddress) {
        alert("Wallet address not found");
        return;
      }

      setAddress(walletAddress);
      setAccount(walletAddress);

      alert("Wallet connected:\n" + walletAddress);
    } catch (err) {
      console.error(err);
      alert("Failed to connect wallet");
    }
  };

  return (
    <div>
      {address ? (
        <p><strong>Connected:</strong> {address}</p>
      ) : (
        <button onClick={connectWallet}>
          Connect Freighter Wallet
        </button>
      )}
    </div>
  );
};

export default WalletConnect;
