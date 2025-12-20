import { useState } from "react";

export default function PayerDashboard({ account }) {
  const [nftId, setNftId] = useState("");
  const [amount, setAmount] = useState("");

  const pay = async () => {
    await fetch("http://localhost:4000/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payer: account,
        nftId,
        amount,
      }),
    });
    alert("Royalty paid");
  };

  return (
    <>
      <h2>Payer Dashboard</h2>
      <input placeholder="NFT ID" onChange={e => setNftId(e.target.value)} />
      <input placeholder="Amount XLM" onChange={e => setAmount(e.target.value)} />
      <button onClick={pay}>Pay Royalty</button>
    </>
  );
}
