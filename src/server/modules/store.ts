import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const COLLECTIONS_FILE = path.join(DATA_DIR, 'collections.json');

export class Store {
  static async init() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      for (const file of [HISTORY_FILE, COLLECTIONS_FILE]) {
        try {
          await fs.access(file);
        } catch {
          await fs.writeFile(file, JSON.stringify([]));
        }
      }
    } catch (error) {
      console.error('Failed to initialize store:', error);
    }
  }

  static async getHistory() {
    const data = await fs.readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  }

  static async addToHistory(item: any) {
    const history = await this.getHistory();
    history.unshift({ ...item, timestamp: Date.now() });
    await fs.writeFile(HISTORY_FILE, JSON.stringify(history.slice(0, 100)));
  }

  static async getCollections() {
    const data = await fs.readFile(COLLECTIONS_FILE, 'utf-8');
    return JSON.parse(data);
  }

  static async saveCollection(collection: any) {
    const collections = await this.getCollections();
    const index = collections.findIndex((c: any) => c.name === collection.name);
    if (index >= 0) {
      collections[index] = collection;
    } else {
      collections.push(collection);
    }
    await fs.writeFile(COLLECTIONS_FILE, JSON.stringify(collections));
  }
}
