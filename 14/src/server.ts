import express from "express";
import { config } from "./config.js";
import { handleSearchItem } from "./tools/searchItem/index.js";
import { handleLocateCities } from "./tools/locateCities.js";

const app = express();
app.use(express.json());

app.post("/search-item", async (req, res) => {
  try {
    const params = req.body?.params;
    console.error(req.body)
    const result = await handleSearchItem(params);
    res.json(result);
  } catch (e) {
    const err = e as Error;
    res.json({ output: `Internal error: ${err.message}` });
  }
});

app.post("/locate-cities", async (req, res) => {
  try {
    const params = req.body.params as string;
    const result = await handleLocateCities(params);
    res.json(result);
  } catch (e) {
    const err = e as Error;
    res.json({ output: `Internal error: ${err.message}` });
  }
});

app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
});
