import React, { useState } from "react";
import UploadContent from "./UploadContent";

export default function CreatorDashboard({ account }) {
    const [cid, setCid] = useState("");
  const registerNFT = async () => {
    await fetch("http://localhost:4000/register-nft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nftId: 1,
        creator: account,
        percent: 10,
      }),
    });
    alert("NFT registered");
  };

  return (
    <>
      <h2>Creator Dashboard</h2>
      <button onClick={registerNFT}>Register NFT</button>
       <div>
      <h2>Creator Dashboard</h2>
      <p>Wallet: {account}</p>

      <UploadContent onUploaded={setCid} />

      {cid && (
        <div style={{ marginTop: "1rem" }}>
          <p>Next step: Register this CID on-chain</p>
          <code>{cid}</code>
        </div>
      )}
    </div>
    </>
    
  );
}
