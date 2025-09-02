import Surreal, { RecordId } from "surrealdb";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

const db = new Surreal();

async function connectDB() {
	while (true) {
		try {
			await db.connect(process.env.SURREAL_URI ?? "ws://192.168.0.7:8000/rpc", {
				namespace: "blocks",
				database: "blocks",
				auth: { username: "root", password: "root" },
			});
			console.log("Connected to DB");
			break;
		} catch (error: any) {
			// console.error("Failed to connect to DB", error.message);
			console.log("Waiting for DB...");
			await new Promise((resolve) => setTimeout(resolve, 2500));
		}
	}
}

await connectDB();

await connectDB();
async function writeJSON(tb: string, id: string, data: any) {
  console.log("writing", tb, "/", id)
  const dir = path.join(process.cwd(), "./devdata");
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${tb}/${id}.json`);
  await fs.mkdir(path.join(dir, `${tb}`), { recursive: true });

  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function deleteJSON(tb: string, id: string) {
  const dir = path.join(process.cwd(), "devdata");
  const filePath = path.join(dir, `${tb}/${id}.json`);
  try {
    await fs.unlink(filePath);
  } catch (e) {}
}

async function set<T>(tb: string, id: string, data: T) {
  const record = { d: { data: data } };
  await db.upsert(new RecordId(tb, id), record);
  if (process.env.NODE_ENV === "development") {
    await writeJSON(tb, id, record);
  }
}

async function get(tb: string, id: string) {
  const record: any = await db.select(new RecordId(tb, id));
  return record?.d?.data;
}

async function del(tb: string, id: string): Promise<void> {
  await db.delete(new RecordId(tb, id));
  if (process.env.NODE_ENV === "development") {
    await deleteJSON(tb, id);
  }
}

let constructed: string[] = [];

export class DB<SchemaT extends z.ZodTypeAny> {
  private name: string;
  private lock: Promise<void> = Promise.resolve(); // Lock to prevent concurrent access
  defaultV: z.infer<SchemaT>;
  schema: SchemaT;
  constructor(name: string, defaultValue: z.infer<SchemaT>, schema: SchemaT) {
    if (constructed.includes(name)) {
      throw new RangeError(
        `Cannot create a second database for ${name}, they will have conflicting data`
      );
    }
    constructed.push(name);
    this.defaultV = defaultValue;
    this.name = name;
    this.schema = schema;
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.lock.then(fn);
    this.lock = result.catch(() => {}).then(() => {});
    return result;
  }

  async getData(id: string): Promise<z.infer<SchemaT>> {
    const mergeRecursive = (target: any, source: any): any => {
      const result = { ...target };
      
      // Handle Maps specially
      if (source instanceof Map) {
        return new Map([...(target instanceof Map ? target : []), ...source]);
      }
      
      for (const key in source) {
        if (key in result) continue;
        
        if (source[key] instanceof Map) {
          // Handle Map objects
          result[key] = new Map([...(result[key] instanceof Map ? result[key] : []), ...source[key]]);
        } else if (Array.isArray(source[key])) {
          result[key] = [...source[key]];
        } else if (typeof source[key] === "object" && source[key] !== null) {
          result[key] = mergeRecursive({}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
      return result;
    };

    const fetched = (await get(this.name, id)) as z.infer<SchemaT>;
    
    // Handle serialized Maps in the fetched data
    const processSerializedMaps = (data: any): any => {
      if (!data || typeof data !== 'object') return data;
      
      // Check if it's a serialized Map (implement your serialization format)
      if (data.__isMap && Array.isArray(data.entries)) {
        return new Map(data.entries);
      }
      
      // Process arrays
      if (Array.isArray(data)) {
        return data.map(item => processSerializedMaps(item));
      }
      
      // Process objects
      const result = { ...data };
      for (const key in result) {
        result[key] = processSerializedMaps(result[key]);
      }
      return result;
    };
    
    const processed = processSerializedMaps(fetched);
    
    const d =
      typeof processed === "object" && !Array.isArray(processed) && processed !== null
        ? (mergeRecursive(processed, this.defaultV) as z.infer<SchemaT>)
        : processed;
    
    return d ?? this.defaultV;
  }

  /**
   * @deprecated use DB.update instead.
   */
  async setData(id: string, data: z.infer<SchemaT>, validate: boolean) {
    if (validate) {
      const result = await this.schema.safeParseAsync(data);
      if (!result.success) {
        return { success: false, reason: result.error.errors };
      }
    }
    
    const serializeMaps = (input: any): any => {
      if (input instanceof Map) {
        return {
          __isMap: true,
          entries: Array.from(input.entries())
        };
      }
      
      if (Array.isArray(input)) {
        return input.map(item => serializeMaps(item));
      }
      
      if (input && typeof input === 'object' && input !== null) {
        const result: Record<string, any> = {};
        for (const key in input) {
          result[key] = serializeMaps(input[key]);
        }
        return result;
      }
      
      return input;
    };
    
    const serialized = serializeMaps(data);
    await set(this.name, id, serialized);
    return { success: true };
  }

  async update(
    id: string,
    updater: (
      current: z.infer<SchemaT>
    ) => z.infer<SchemaT> | Promise<z.infer<SchemaT>>,
    validate: boolean
  ): Promise<void> {
    return this.withLock(async () => {
      const current = await this.getData(id);
      const updated = await updater(current);
      if (validate) {
        const result = await this.schema.safeParseAsync(updated);
        if (!result.success) {
          throw new Error("Validation failed for the updated data.");
        }
      }
      await this.setData(id, updated, validate);
    });
  }

  deleteData(id: string) {
    del(this.name, id);
  }
}
export class Store<dataT extends z.ZodTypeAny> {
  private name: string;
  private lock: Promise<void> = Promise.resolve();
  defaultV: dataT;

  constructor(name: string, defaultValue: dataT) {
    if (constructed.includes(name)) {
      throw new RangeError(
        `Cannot create a second database for ${name}, they will have conflicting data`
      );
    }
    constructed.push(name);
    this.defaultV = defaultValue;
    this.name = name;
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.lock.then(fn);
    this.lock = result.catch(() => {}).then(() => {});
    return result;
  }

  async getData(): Promise<dataT> {
    const mergeRecursive = (target: any, source: any): any => {
      const result = { ...target };

      for (const key in source) {
        if (
          typeof source[key] === "object" &&
          !Array.isArray(source[key]) &&
          source[key] !== null
        ) {
          result[key] = mergeRecursive(result[key] || {}, source[key]);
        } else if (!(key in result)) {
          result[key] = source[key];
        }
      }

      return result;
    };

    const d = mergeRecursive(
      await get("store", this.name),
      this.defaultV
    ) as dataT;
    return d ?? this.defaultV;
  }
  /**
   * @deprecated use Store.update instead.
   */
  async setData(data: dataT) {
    await set("store", this.name, data);
  }

  async update(
    updater: (current: dataT) => dataT | Promise<dataT>
  ): Promise<void> {
    return this.withLock(async () => {
      const current = await this.getData();
      const updated = await updater(current);
      await this.setData(updated);
    });
  }
}

export const modulesEnabled = new DB(
  "modules-enabled",
  [],
  z.array(z.string())
);
