import axios from "axios";

export async function uploadToIPFS(file) {
  const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await axios.post(url, formData, {
      maxBodyLength: "Infinity",
      headers: {
        "Content-Type": `multipart/form-data;`,
        pinata_api_key: process.env.REACT_APP_PINATA_API_KEY,
        pinata_secret_api_key: process.env.REACT_APP_PINATA_API_SECRET,
      },
    });

    return res.data.IpfsHash; // CID
  } catch (err) {
    console.error("Pinata upload failed:", err);
    throw err;
  }
}
