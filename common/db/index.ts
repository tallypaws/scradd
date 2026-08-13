import { Surreal, SurrealTransaction, createRemoteEngines } from "surrealdb";
import { createNodeEngines } from "@surrealdb/node";
import WebSocket from "ws";

const surrealDb = new Surreal({
	engines: {
		...createRemoteEngines(),
		...createNodeEngines(),
	},
	//@ts-ignore
	websocketImpl: WebSocket,
});

async function connectSurrealDB({
	url,
	namespace,
	database,
	username = "root",
	password = "root",
}: {
	url: string;
	namespace: string;
	database: string;
	username: string;
	password: string;
}) {
	await surrealDb.connect(url, {
		namespace: namespace,
		database: database,
	});
	console.log("[Surreal] connected");
	await surrealDb.signin({
		username: username,
		password: password,
	});
	console.log("[Surreal] authenticated");
	await surrealDb.ready;
	console.log("[Surreal] ready");
	return surrealDb;
}

type ConnectDBSOptions = {
	surreal: Parameters<typeof connectSurrealDB>[0];

	// FUCK YOUUUUU
	// redis?: {
	//   url?: string | undefined;
	//   username?: string | undefined;
	//   password?: string | undefined;
	// };
};

export async function connectDBS(options: ConnectDBSOptions) {
	await Promise.all([connectSurrealDB(options.surreal)]);
}

export function getSurrealDB() {
	if (!surrealDb.isConnected) {
		throw new Error("Database is not connected");
	}
	return surrealDb;
}

export type Awaitable<T> = Promise<T> | T;

export type TallyTransaction = SurrealTransaction & {
	onCommit: (callback: () => Awaitable<void>) => void;
};

export async function transaction(): Promise<TallyTransaction> {
	const callbacks: (() => Awaitable<void>)[] = [];
	const dbTransaction = (await getSurrealDB().beginTransaction()) as TallyTransaction;

	dbTransaction.onCommit = (callback) => {
		callbacks.push(callback);
	};

	const originalCommit = dbTransaction.commit.bind(dbTransaction);

	dbTransaction.commit = async () => {
		await originalCommit();
		await Promise.all(callbacks.map((c) => c()));
	};

	return dbTransaction;
}
export * from "./singleton.js";
export * from "./map.js";
export * from "./nested.js";
export * from "./query.js";
