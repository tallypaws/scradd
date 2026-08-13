import { getSurrealDB } from "./index.js";
import { RecordId, SurrealTransaction } from "surrealdb";
import z from "zod";

const singletonKey = "__singleton__";

export class DBSingleton<T extends z.ZodTypeAny, D = z.infer<T> | null> {
  protected name: string;
  protected schema: T;
  defaultV: D extends null ? D : z.infer<T>;

  constructor(options: {
    name: string;
    schema: T;
    defaultV: D extends null ? D : z.infer<T>;
  }) {
    this.name = options.name;
    this.schema = options.schema;
    this.defaultV = options.defaultV;
  }

  async get(
    transaction?: SurrealTransaction,
  ): Promise<D extends null ? z.infer<T> | null : z.infer<T>> {
    if (transaction) {
      const res = await transaction.select<{ value: z.infer<T> }>(
        new RecordId(singletonKey, this.name),
      );
      if (!res || !res.value) return this.defaultV as any;
      return this.schema.parse(res.value);
    }

    const res = await getSurrealDB().select<{ value: z.infer<T> }>(
      new RecordId(singletonKey, this.name),
    );
    if (!res || !res.value) return this.defaultV as any;
    return this.schema.parse(res.value);
  }

  async set(data: z.infer<T>, transaction?: SurrealTransaction) {
    if (transaction) {
      await transaction
        .upsert(new RecordId(singletonKey, this.name))
        .content({ value: data });
      return;
    }

    await getSurrealDB()
      .upsert(new RecordId(singletonKey, this.name))
      .content({ value: data });
  }

  async delete(transaction?: SurrealTransaction) {
    if (transaction) {
      await transaction.delete(new RecordId(singletonKey, this.name));
      return;
    }
    await getSurrealDB().delete(new RecordId(singletonKey, this.name));
  }
}
