/**
 * prompt.model.js — model untuk Prompt Builder & History.
 */

export class PromptRequestModel {
  constructor({
    templateId, provider, programmingStyle = "clean-architecture",
    additionalRequirement = "", userInstruction = "", databaseContext = null,
  } = {}) {
    this.templateId = templateId;
    this.provider = provider;
    this.programmingStyle = programmingStyle;
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
