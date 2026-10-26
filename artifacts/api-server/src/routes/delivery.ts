import { Router, type IRouter } from "express";
import { SearchNpBranchesQueryParams, SearchNpCitiesQueryParams } from "@workspace/api-zod";
import { NpUnavailableError, searchBranches, searchCities } from "../lib/novaposhta";

const router: IRouter = Router();

const npFailed = (res: import("express").Response, err: unknown) => {
  if (err instanceof NpUnavailableError) {
    res.status(502).json({ error: "Не вдалося зв'язатися з Новою Поштою. Спробуйте ще раз за хвилину." });
    return;
  }
  throw err;
};

router.get("/delivery/np/cities", async (req, res) => {
  const parsed = SearchNpCitiesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Вкажіть назву міста" });
    return;
  }
  try {
    res.json(await searchCities(parsed.data.q));
  } catch (err) {
    npFailed(res, err);
  }
});

router.get("/delivery/np/branches", async (req, res) => {
  const parsed = SearchNpBranchesQueryParams.safeParse(req.query);
  if (!parsed.success || !/^[0-9a-f-]{36}$/i.test(parsed.data.cityRef)) {
    res.status(400).json({ error: "Спершу оберіть місто" });
    return;
  }
  try {
    res.json({ items: await searchBranches(parsed.data.cityRef, parsed.data.q ?? "") });
  } catch (err) {
    npFailed(res, err);
  }
});

export default router;
