import { getSurrealDB } from "./index.js";

export class QueryBuilder<T> {
  private filters: string[] = [];
  private params: Record<string, any> = {};
  private _limit: number = 30;
  private _offset: number = 0;
  private _sortBy?: string;
  private _sortDir: "asc" | "desc" = "desc";

  constructor(
    private namespace: string,
    private parse: (row: any) => T,
  ) {}

  where(
    field: string,
    operator: "=" | "!=" | "<" | "<=" | ">" | ">=" | "LIKE",
    value: any,
  ) {
    const key = `param_${this.filters.length}`;
    this.filters.push(`${field} ${operator} $${key}`);
    this.params[key] = value;
    return this;
  }

  sortBy(field: string, dir: "asc" | "desc" = "desc") {
    this._sortBy = field;
    this._sortDir = dir;
    return this;
  }

  limit(n: number) {
    this._limit = n;
    return this;
  }

  offset(n: number) {
    this._offset = n;
    return this;
  }

  async exec(): Promise<T[]> {
    const where = this.filters.length
      ? `WHERE ${this.filters.join(" AND ")}`
      : "";
    const sort = this._sortBy
      ? `ORDER BY ${this._sortBy} ${this._sortDir}`
      : "";
    const sql = `SELECT * FROM ${this.namespace} ${where} ${sort} LIMIT ${this._limit} START ${this._offset}`;
    const [result] = await getSurrealDB().query(sql, this.params);
    return (result as any[]).map((r: any) => this.parse(r));
  }
}