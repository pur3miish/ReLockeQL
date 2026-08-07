import http from "http";

import { RelockeQL } from "../dist/relockeql.js";

const server = http.createServer((req, res) => {
  let body = "";

  // Set headers early, before any other operations
  res.writeHead(200, { "Content-Type": "application/json" });

  req.on("data", (chunk) => {
    body += chunk.toString(); // Convert the chunk to a string and append it to the body
  });

  req.on("end", async () => {
    try {
      const { query, variables, operationName } = JSON.parse(body);

      const data = await RelockeQL(
        {
          query,
          operationName,
          variables
        },
        {
          contracts: {
            vaulta: ["eosio.token", "eosio", "core.vaulta"],
            jungle: ["eosio.token", "eosio"]
          },
          chains: {
            pungle: "https://jungle.relocke.io",
            jungle: "https://jungle.relocke.io"
          }
        }
      );

      // Send the response body after all processing
      res.end(JSON.stringify(data));
    } catch {
      // If there is an error, handle it properly (e.g., send a 500 response)
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Error processing request");
    }
  });

  req.on("error", () => {
    // Handle request errors (e.g., JSON parsing errors, network errors)
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Invalid request");
  });
});

const PORT = 3002;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
