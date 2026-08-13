import { CacheHelper } from "./cache.js";
import { getSurrealDB, TallyTransaction } from "./index.js";
import { QueryBuilder } from "./query.js";
import { RecordId } from "surrealdb";
import z from "zod";

type FixedLengthTuple<
  N extends number,
  T = string,
  R extends unknown[] = []
> = R["length"] extends N ? R : FixedLengthTuple<N, T, [...R, T]>;

export class DBNestedMapX<
  N extends number,
  T extends z.ZodTypeAny,
  D = z.infer<T> | null
> {
  defaultV: D extends null ? D : z.infer<T>;

  private cache: CacheHelper<z.infer<T>>;

  private constructor(
    public namespace: string,
    public schema: T,
    defaultV: D extends null ? D : z.infer<T>,
    private depth: N
  ) {
    void depth;
    this.defaultV = defaultV;
    this.cache = new CacheHelper("nested", namespace);
  }

  static async create<
    N extends number,
    T extends z.ZodTypeAny,
    D = z.infer<T> | null
  >(options: {
    namespace: string;
    schema: T;
    defaultV: D extends null ? D : z.infer<T>;
    depth: N;
  }): Promise<DBNestedMapX<N, T, D>> {
    const instance = new DBNestedMapX(
      options.namespace,
      options.schema,
      options.defaultV,
      options.depth
    );
    await instance.ensureIndexes();
    return instance;
  }

  private async ensureIndexes() {
    const indexName = `idx_${this.namespace}_keys`;

    const keyFields = Array.from(
      { length: this.depth - 1 },
      (_, i) => `key${i + 1}`
    );

    if (keyFields.length === 0) {
      return;
    }

    const defineSql = `DEFINE INDEX ${indexName} ON ${
      this.namespace
    } FIELDS ${keyFields.join(", ")}`;

    try {
      await getSurrealDB().query(defineSql);
    } catch (e) {
      if (
        (e instanceof Error ? e.message : String(e)) !==
        `The index '${indexName}' already exists`
      )
        console.warn(
          `[DBNestedMapX] Failed to define index:`,
          e instanceof Error ? e.message : String(e)
        );
    }
  }

  private makeId(keys: FixedLengthTuple<N>): RecordId {
    return new RecordId(this.namespace, (keys as string[]).join(":"));
  }

  private buildMetaKeys(keys: FixedLengthTuple<N>): Record<string, string> {
    const meta: Record<string, string> = {};
    (keys as string[]).forEach((key, i) => {
      meta[`key${i + 1}`] = key;
    });
    return meta;
  }

  async get(
    keys: FixedLengthTuple<N>,
    transaction?: TallyTransaction
  ): Promise<D extends null ? z.infer<T> | null : z.infer<T>> {
    if (!transaction) {
      const cached = this.cache.get(keys);
      if (cached) {
        return cached;
      }
    }
    const rec = await (transaction ?? getSurrealDB()).select<{
      value: z.infer<T>;
    }>(this.makeId(keys));
    if (!rec) return this.defaultV;
    return this.schema.parse(rec.value);
  }

  async set(
    keys: FixedLengthTuple<N>,
    data: z.infer<T>,
    transaction?: TallyTransaction
  ) {
    await this.schema.parseAsync(data);
    if (!transaction) {
      this.cache.set(keys, data);
    } else {
      transaction.onCommit(() => {
        this.cache.invalidate(keys);
      });
    }
    const meta = this.buildMetaKeys(keys);
    const recordId = this.makeId(keys);
    await (transaction ?? getSurrealDB())
      .upsert(recordId)
      .content({ value: data, ...meta });
  }

  async delete(keys: FixedLengthTuple<N>, transaction?: TallyTransaction) {
    if (transaction) {
      transaction.onCommit(() => {
        this.cache.invalidate(keys);
      });
    } else {
      this.cache.invalidate(keys);
    }

    const recordId = this.makeId(keys);
    await (transaction ?? getSurrealDB()).delete(recordId);
  }

  async find(
    keys: FixedLengthTuple<N> & string[],
    { raw, transaction }: { raw: true; transaction?: TallyTransaction }
  ): Promise<{ value: z.infer<T>; [keyString: `key${number}`]: string }[]>;
  async find(
    keys: FixedLengthTuple<N> & string[],
    { raw, transaction }: { raw: false; transaction?: TallyTransaction }
  ): Promise<z.infer<T>[]>;
  async find(
    keys: FixedLengthTuple<N> & string[],
    { raw, transaction }: { raw?: boolean; transaction?: TallyTransaction }
  ): Promise<
    z.infer<T>[] | { value: z.infer<T>; [keyString: `key${number}`]: string }[]
  >;
  async find(keys: FixedLengthTuple<N> & string[]): Promise<z.infer<T>[]>;
  async find(
    keys: FixedLengthTuple<N> & string[],
    options:
      | { raw?: boolean; transaction?: TallyTransaction }
      | undefined = undefined
  ): Promise<any[]> {
    const { raw = false, transaction } = options || {};
    const filters: string[] = [];
    const params: Record<string, string> = {};

    keys.forEach((val, i) => {
      if (val !== "*") {
        const keyName = `key${i + 1}`;
        filters.push(`${keyName} = $${keyName}`);
        params[keyName] = val;
      }
    });

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const sql = `SELECT * FROM ${this.namespace} ${whereClause}`;

    const rows = await (transaction ?? getSurrealDB()).query(sql, params);
    return (rows[0] as any[]).map((r: any) => (raw ? r : r.value));
  }

  async findSortedPaginated({
    keys,
    sortBy,
    direction,
    limit,
    offset,
    raw,
    transaction
  }: {
    keys: FixedLengthTuple<N> & string[];
    sortBy: `value.${string}`;
    direction?: "asc" | "desc";
    limit?: number;
    offset?: number;
    raw: true;
    transaction?: TallyTransaction;
  }): Promise<
    { value: z.infer<T>; [keyString: `key${number}`]: string; rank: number }[]
  >;
  async findSortedPaginated({
    keys,
    sortBy,
    direction,
    limit,
    offset,
    raw,
    transaction
  }: {
    keys: FixedLengthTuple<N> & string[];
    sortBy: `value.${string}`;
    direction?: "asc" | "desc";
    limit?: number;
    offset?: number;
    raw: false;
    transaction?: TallyTransaction;
  }): Promise<(z.infer<T> & { rank: number })[]>;
  async findSortedPaginated({
    keys,
    sortBy,
    direction,
    limit,
    offset,
    raw,
    transaction
  }: {
    keys: FixedLengthTuple<N> & string[];
    sortBy: `value.${string}`;
    direction?: "asc" | "desc";
    limit?: number;
    offset?: number;
    raw?: undefined;
    transaction?: TallyTransaction;
  }): Promise<(z.infer<T> & { rank: number })[]>;
  async findSortedPaginated({
    keys,
    sortBy,
    direction = "desc",
    limit = 30,
    offset = 0,
    raw = false,
    transaction
  }: {
    keys: FixedLengthTuple<N> & string[];
    sortBy: `value.${string}`;
    direction?: "asc" | "desc";
    limit?: number;
    offset?: number;
    raw?: boolean;
    transaction?: TallyTransaction;
  }): Promise<
    | (z.infer<T> & { rank: number })[]
    | { value: z.infer<T>; [keyString: `key${number}`]: string; rank: number }[]
  > {
    const filters: string[] = [];
    const params: Record<string, any> = {};

    keys.forEach((val, i) => {
      if (val !== "*") {
        const key = `key${i + 1}`;
        filters.push(`${key} = $${key}`);
        params[key] = val;
      }
    });

    const whereClause =
      filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const sql = `
      SELECT * FROM ${this.namespace}
      ${whereClause}
      ORDER BY ${sortBy} ${direction}
      LIMIT ${limit} START ${offset}
    `;

    const [results] = await (transaction ?? getSurrealDB()).query(sql, params);

    return (results as any[]).map((row: any, i: number) =>
      raw
        ? { ...row, rank: offset + i + 1 }
        : { ...row.value, rank: offset + i + 1 }
    );
  }

  query() {
    return new QueryBuilder<z.infer<T>>(this.namespace, (row) =>
      this.schema.parse(row.value)
    );
  }
}

// const nestedMap = await DBNestedMapX.create(
//   "nested_map_test",
//   z.object({ hello: z.string() }),
//   { hello: "world" },
//   5, // 5 keys deep
// );

// await nestedMap.set(["a", "b", "c", "d", "e"], { hello: "nested world" });

// const value = await nestedMap.get(["a", "b", "c", "d", "e"]);
// console.log(value);

// const found = await nestedMap.find(["a", "*", "*", "*", "*"]);
// console.log(found);

// const raw = await nestedMap.find(["a", "*", "*", "d", "*"], { raw: true });
// console.log(raw); // [{ value: { hello: 'nested world' }, key1: 'a', key2: 'b', key3: 'c', key4: 'd', key5: 'e' }]

// const sorted = await nestedMap.findSortedPaginated({
//   keys: ["a", "*", "*", "*", "*"],
//   sortBy: "value.hello",
//   direction: "asc",
//   limit: 10,
//   offset: 0,
// });
// console.log(sorted); // [{ hello: 'nested world', rank: 1 }]
