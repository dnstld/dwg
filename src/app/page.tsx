"use client";

import { useState, useEffect } from "react";
import axios from "axios";

// Function to get Forge token
const getForgeToken = async () => {
  const clientId = process.env.NEXT_PUBLIC_FORGE_CLIENT_ID!;
  const clientSecret = process.env.NEXT_PUBLIC_FORGE_CLIENT_SECRET!;

  if (!clientId || !clientSecret) {
    throw new Error("Client ID or Client Secret is missing");
  }

  try {
    const response = await axios.post(
      "https://developer.api.autodesk.com/authentication/v2/token",
      new URLSearchParams({
        grant_type: "client_credentials",
        scope:
          "data:read data:write data:create bucket:read bucket:create bucket:delete",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        },
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error(
      "Error fetching Forge token:",
      error.response ? error.response.data : error
    );
    throw new Error("Failed to fetch Forge token");
  }
};

// Function to generate a unique bucket key
const generateUniqueBucketKey = () => {
  // You can customize this function to generate a more appropriate unique key
  return `bucket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Function to handle bucket creation and file upload
const handleBucketAndUpload = async (token: string, file: File) => {
  const bucketKey = generateUniqueBucketKey(); // Generate a unique bucket key

  try {
    // Check if bucket exists or create it
    try {
      await axios.post(
        `https://developer.api.autodesk.com/oss/v2/buckets`,
        {
          bucketKey: bucketKey,
          policyKey: "transient", // or 'persistent'
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("Bucket created successfully.");
    } catch (error) {
      if (error.response && error.response.status === 409) {
        console.log("Bucket already exists.");
      } else {
        console.error(
          "Error creating bucket:",
          error.response ? error.response.data : error
        );
        throw error;
      }
    }

    // Upload file
    const uploadResponse = await axios.put(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${file.name}`,
      file, // Directly send the file content here
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": file.type || "application/octet-stream", // Use file type if available
        },
      }
    );

    // uploadResponseExample = {
    //   "bucketKey": "bucket-000000000000-mu5quhmaq",
    //   "contentType": "application/octet-stream",
    //   "location": "https://developer.api.autodesk.com/oss/v2/buckets/bucket-000000000000-mu5quhmaq/objects/EQT1-REGU-E05-400-R1D-1.dwg",
    //   "objectId": "urn:adsk.objects:os.object:bucket-000000000000-mu5quhmaq/EQT1-REGU-E05-400-R1D-1.dwg",
    //   "objectKey": "EQT1-REGU-E05-400-R1D-1.dwg",
    //   "sha1": "000000000000000000000",
    //   "size": 133991
    // }

    console.log("Upload Response:", uploadResponse.data);
  } catch (error) {
    console.error(
      "Error in bucket creation or file upload:",
      error.response ? error.response.data : error
    );
    throw new Error("Failed to create bucket or upload file");
  }
};

// Component to fetch token and handle bucket operations
export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const fetchedToken = await getForgeToken();
        setToken(fetchedToken);
      } catch (err: any) {
        setError(err.message);
      }
    };
    fetchToken();
  }, []);

  // Example usage with a file upload
  const handleFileUpload = async (file: File) => {
    if (token) {
      try {
        await handleBucketAndUpload(token, file);
        console.log("File uploaded successfully.");
      } catch (err: any) {
        setError(err.message);
      }
    } else {
      setError("Token not available");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <p>Autodesk Forge Integration</p>
      {token && <p>Token: {token}</p>}
      {error && <p>Error: {error}</p>}
      {/* Add file input for testing */}
      <input
        type="file"
        onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
      />
    </main>
  );
}
