import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
const port = 3001; // or any port of your choice

// CORS middleware configuration
app.use(cors());

app.use(express.json());

app.post("/proxy/modelderivative/job", async (req, res) => {
  console.log("/proxy/modelderivative/job", req.headers.authorization);
  const token = req.headers.authorization; // Extract token from headers
  const jobRequestBody = req.body; // Type the request body

  console.log("--- Request body", jobRequestBody);

  try {
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
    }>(
      "https://developer.api.autodesk.com/modelderivative/v2/designdata/job",
      jobRequestBody,
      {
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res
      .status(error.response?.status || 500)
      .json(error.response?.data || { message: error.message });
  }
});

app.listen(port, () => {
  console.log(`Proxy server running on http://localhost:${port}`);
});
