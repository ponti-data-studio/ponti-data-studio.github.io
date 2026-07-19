import { getStorage } from "../storage/storage.factory.js";
import { HistoryEntryModel } from "../models/prompt.model.js";
import { uid } from "../utils/format.util.js";

const HISTORY_KEY = "history.entries";

export const historyService = {
  async getAll() {
    const data = await getStorage().get(HISTORY_KEY);
    return data || [];
  },

  async add({ spreadsheetName, templateId, provider, prompt, response, tokenEstimate }) {
    const entries = await this.getAll();
    const entry = new HistoryEntryModel({
      id: uid("hist"),
      spreadsheetName, templateId, provider, prompt, response, tokenEstimate,
    });
    entries.unshift(entry);
    await getStorage().set(HISTORY_KEY, entries.slice(0, 200));
    return entry;
  },

  async remove(id) {
    const entries = await this.getAll();
    const filtered = entries.filter((e) => e.id !== id);
    await getStorage().set(HISTORY_KEY, filtered);
  },

  async clear() {
    await getStorage().set(HISTORY_KEY, []);
  },
};
