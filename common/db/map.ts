import { CacheHelper } from "./cache.js";
import {
  Awaitable,
  getSurrealDB,
  TallyTransaction
} from "./index.js";
import { QueryBuilder } from "./query.js";
import { LiveMessage, RecordId, Table } from "surrealdb";
import z from "zod";

export class DBMap<T extends z.ZodTypeAny, D = z.infer<T> | null> {
  protected name: string;
  protected schema: T;
  defaultV: D extends null ? D : z.infer<T>;
  private cache: CacheHelper<z.infer<T>>;

  private constructor(
    name: string,
    schema: T,
    defaultV: D extends null ? D : z.infer<T>
  ) {
    this.name = name;
    this.schema = schema;
    this.defaultV = defaultV;
    this.cache = new CacheHelper("map", name);
    this.live((msg) => {
      switch (msg.action) {
        case "CREATE":
        case "UPDATE":
          this.cache.set(
            [msg.recordId.toString().split(":")[1]!],
            msg.value.value as any
          );
          break;
        case "DELETE":
          this.cache.invalidate([
            msg.recordId.toString().split(":")[1] as string
          ]);
          break;
      }
    });
  }

  static async create<T extends z.ZodTypeAny, D = z.infer<T> | null>(options: {
    name: string;
    schema: T;
    defaultV: D extends null ? D : z.infer<T>;

    indexes?: string[];
  }): Promise<DBMap<T, D>> {
    const instance = new this(options.name, options.schema, options.defaultV);
    await getSurrealDB().query(
      `DEFINE TABLE IF NOT EXISTS ${instance.name} SCHEMALESS;`
    );

    for (const field of options.indexes ?? []) {
      const indexName = `idx_${instance.name}_${field.replace(/\W+/g, "_")}`;
      try {
        await getSurrealDB().query(
          `DEFINE INDEX ${indexName} ON ${instance.name} FIELDS ${field}`
        );
      } catch (e) {
        if (
          (e instanceof Error ? e.message : String(e)) !==
          `The index '${indexName}' already exists`
        )
          console.warn(
            `[DBMap] Failed to define index:`,
            e instanceof Error ? e.message : String(e)
          );
      }
    }

    return instance;
  }

  async get(
    key: string,
    transaction?: TallyTransaction
  ): Promise<D extends null ? z.infer<T> | null : z.infer<T>> {
    if (transaction) {
      const res = await transaction.select<{ value: z.infer<T> }>(
        new RecordId(this.name, key)
      );
      if (!res || !res.value) return this.defaultV as any;
      return this.schema.parse(res.value);
    }
    const cached = this.cache.get([key]);
    if (cached) return cached;
    const res = await getSurrealDB().select<{ value: z.infer<T> }>(
      new RecordId(this.name, key)
    );
    if (!res || !res.value) {
      return this.defaultV as any;
    }
    return this.schema.parse(res.value);
  }

  async set(key: string, data: z.infer<T>, transaction?: TallyTransaction) {
    if (transaction) {
      transaction.onCommit(() => {
        this.cache.invalidate([key]);
      });
      await transaction
        .upsert(new RecordId(this.name, key))
        .content({ value: data });
      return;
    }
    this.cache.set([key], data);
    await getSurrealDB()
      .upsert(new RecordId(this.name, key))
      .content({ value: data });
  }

  async delete(key: string, transaction?: TallyTransaction) {
    if (transaction) {
      transaction.onCommit(() => {
        this.cache.invalidate([key]);
      });
      await transaction.delete(new RecordId(this.name, key));
      return;
    }
    this.cache.invalidate([key]);
    await getSurrealDB().delete(new RecordId(this.name, key));
  }
  async allKeys(transaction?: TallyTransaction): Promise<string[]> {
    if (transaction) {
      const sql = `SELECT id FROM ${this.name}`;
      const rows = await transaction.query(sql);
      return (rows[0] as { id: RecordId }[]).map(({ id }) => {
        return id.id.toString();
      });
    }
    const sql = `SELECT id FROM ${this.name}`;
    const rows = await getSurrealDB().query(sql);
    return (rows[0] as { id: RecordId }[]).map(({ id }) => {
      return id.id.toString();
    });
  }

  query() {
    return new QueryBuilder<z.infer<T>>(this.name, (row) =>
      this.schema.parse(row.value)
    );
  }

  async live(callback?: (message: LiveMessage) => Awaitable<void>) {
    const sub = await getSurrealDB().live<z.infer<T>>(new Table(this.name));

    if (callback) {
      (async () => {
        try {
          for await (const update of sub) {
            console.log("Update:", update.action, update.value);
            await callback(update);
          }
        } catch (err) {
          console.error("Live subscription error:", err);
        }
      })();
    }

    return sub;
  }



  async subscribeKey(
    key: string,
    onUpdate: (value: z.infer<T> | null) => Awaitable<void>
  ): Promise<() => void> {
    let lastPayload: string | undefined;
    const deliver = async (value: z.infer<T> | null) => {
      const payload = JSON.stringify(value ?? null);
      if (payload === lastPayload) return;
      lastPayload = payload;
      await onUpdate(value);
    };

    const cleanups: Array<() => void> = [];

   

    const sub = await this.live(async (msg) => {
      const recordKey = msg.recordId!.toString().split(":")[1];
      if (recordKey !== key) return;
      if (msg.action === "DELETE") {
        await deliver(null);
        return;
      }
      const value = msg.value as unknown as { value: z.infer<T> };
      await deliver(value.value ?? null);
    });
    cleanups.push(() => {
      void sub.kill?.().catch(() => {});
    });

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }
}
