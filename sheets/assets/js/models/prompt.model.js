/**
 * prompt.model.js — model untuk Prompt Builder & History.
 */

export class PromptRequestModel {
  constructor({
    templateId, provider, visualStyle = [],
    additionalRequirement = "", userInstruction = "", databaseContext = null,
  } = {}) {
    this.templateId = templateId;
    this.provider = provider;
    // visualStyle: array — pengguna bisa memilih lebih dari satu gaya visual sekaligus
    // (mis. "Modern" + "Dark Theme"), AI akan menggabungkan kombinasinya.
    this.visualStyle = Array.isArray(visualStyle) ? visualStyle : [visualStyle].filter(Boolean);
    this.additionalRequirement = additionalRequirement;
    this.userInstruction = userInstruction;
    this.databaseContext = databaseContext;
  }
}

export class HistoryEntryModel {
  constructor({
    id, date = new Date().toISOString(), spreadsheetName,
    templateId, provider, prompt, response = "", tokenEstimate = 0,
  } = {}) {
    this.id = id;
    this.date = date;
    this.spreadsheetName = spreadsheetName;
    this.templateId = templateId;
    this.provider = provider;
    this.prompt = prompt;
    this.response = response;
    this.tokenEstimate = tokenEstimate;
  }
}
