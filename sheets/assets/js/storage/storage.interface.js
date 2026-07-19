/**
 * storage.interface.js
 * -----------------------------------------------------------------------
 * Kontrak (interface) storage driver. Setiap driver (local, remote/cloud
 * di v2+, multi-tenant di v4) WAJIB mengimplementasikan method di bawah
 * ini sehingga Business Layer tidak pernah tahu / peduli driver apa yang
 * sedang dipakai (Dependency Inversion).
 * -----------------------------------------------------------------------
 */

export class StorageInterface {
  // eslint-disable-next-line no-unused-vars
  async get(key) { throw new Error("Not implemented"); }
  // eslint-disable-next-line no-unused-vars
  async set(key, value) { throw new Error("Not implemented"); }
  // eslint-disable-next-line no-unused-vars
  async remove(key) { throw new Error("Not implemented"); }
  // eslint-disable-next-line no-unused-vars
  async list(prefix) { throw new Error("Not implemented"); }
  async clearAll() { throw new Error("Not implemented"); }
}
