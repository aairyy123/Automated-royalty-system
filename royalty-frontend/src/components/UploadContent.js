import React, { useState } from "react";
import { uploadToIPFS } from "../ipfs";

export default function UploadContent({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cid, setCid] = useState("");

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a file");
      return;
    }

    try {
      setLoading(true);
      const ipfsCid = await uploadToIPFS(file);
      setCid(ipfsCid);
      onUploaded(ipfsCid); // pass CID upward
    } catch (e) {
      alert("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: "1px solid #ccc", padding: "1rem" }}>
      <h3>Upload Content to IPFS</h3>

      <input
        type="file"
        onChange={(e) => setFile(e.target.files[0])}
      />

      <br /><br />

      <button onClick={handleUpload} disabled={loading}>
        {loading ? "Uploading..." : "Upload to IPFS"}
      </button>

      {cid && (
        <p>
          CID: <code>{cid}</code>
        </p>
      )}
    </div>
  );
}
