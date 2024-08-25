"use client";

import { useState, useEffect, useRef } from "react";
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
          "Access-Control-Allow-Origin": "*",
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
  return `bucket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Function to handle bucket creation and file upload
const handleBucketAndUpload = async (token: string, file: File) => {
  const bucketKey = generateUniqueBucketKey();

  try {
    // Check if bucket exists or create it
    try {
      await axios.post(
        `https://developer.api.autodesk.com/oss/v2/buckets`,
        {
          bucketKey: bucketKey,
          policyKey: "transient",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
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
      file,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": file.type || "application/octet-stream",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );

    return {
      bucketKey,
      objectId: uploadResponse.data.objectId,
    };
  } catch (error) {
    console.error(
      "Error in bucket creation or file upload:",
      error.response ? error.response.data : error
    );
    throw new Error("Failed to create bucket or upload file");
  }
};

// Function to request translation
const translateDWGFile = async (token: string, urn: string) => {
  try {
    const base64Urn = Buffer.from(urn).toString("base64");

    const jobPayload = {
      input: {
        urn: base64Urn,
      },
      output: {
        formats: [
          {
            type: "svf",
            views: ["2d", "3d"],
          },
        ],
      },
    };

    const response = await axios.post<{
      result: string;
      urn: string;
      acceptedJobs: {
        output: {
          formats: [
            {
              type: string;
              views: string[];
            }
          ];
        };
      };
    }>("http://localhost:3001/proxy/modelderivative/job", jobPayload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });

    return response.data.acceptedJobs;
  } catch (error) {
    console.error(
      "Error translating DWG file:",
      error.response ? error.response.data : error
    );
    throw new Error("Failed to translate DWG file");
  }
};

// Function to check translation status
const checkTranslationStatus = async (token: string, jobId: string) => {
  console.log("Checking translation status for jobId:", jobId);
  try {
    const response = await axios.get(
      `https://developer.api.autodesk.com/modelderivative/v2/designdata/job/${jobId}/manifest`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Access-Control-Allow-Origin": "*",
        },
      }
    );

    console.log("Translation Status:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Error checking translation status:",
      error.response ? error.response.data : error
    );
    throw new Error("Failed to check translation status");
  }
};

// Function to encode URN to Base64
const encodeURN = (urn: string) => {
  return Buffer.from(urn).toString("base64");
};

// Function to extract URN from objectId
const extractURN = (objectId: string) => {
  return objectId.split(":")[1];
};

// Forge Viewer component
const ForgeViewer = ({
  urn,
  accessToken,
}: {
  urn: string;
  accessToken: string;
}) => {
  const viewerContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewerContainer.current && urn) {
      const options = {
        env: "AutodeskProduction",
        accessToken: accessToken,
      };

      Autodesk.Viewing.Initializer(options, function onInitialized() {
        const viewer = new Autodesk.Viewing.GuiViewer3D(
          viewerContainer.current
        );
        viewer.start();
        const documentId = "urn:" + urn;

        Autodesk.Viewing.Document.load(
          documentId,
          function (doc) {
            const viewables = doc.getRoot().getDefaultGeometry();
            viewer.loadDocumentNode(doc, viewables);
          },
          function (error) {
            console.error("Failed to load document", error);
          }
        );
      });
    }
  }, [urn, accessToken]);

  return (
    <div ref={viewerContainer} style={{ width: "100%", height: "100vh" }} />
  );
};

// Main component
export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [urn, setUrn] = useState<string | null>(null);
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

  // Handle file upload and processing
  const handleFileUpload = async (file: File) => {
    if (token) {
      try {
        const { objectId } = await handleBucketAndUpload(token, file);
        const jobId = await translateDWGFile(token, objectId);
        console.log("--- jobId:", jobId);

        // Poll for translation status
        let status;
        do {
          status = await checkTranslationStatus(token, jobId);
          if (status.progress === "complete") break;
          await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds before checking again
        } while (status.progress !== "complete");

        const translatedURN = extractURN(objectId);
        setUrn(translatedURN);
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
      {urn && <ForgeViewer urn={urn} accessToken={token} />}
      <input
        type="file"
        onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
      />
    </main>
  );
}
