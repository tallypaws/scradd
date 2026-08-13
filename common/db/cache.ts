// CACHING!! FINALLY!!!!!!!!!

import { m, TimedMap } from "@thetally/toolbox";


const cache = new TimedMap(m(2).toMs());
function debugLog(...args: any[]) {
	console.log("cache: ", ...args);
}

export async function setupInvalidationPubSub() {
	return;
}

export function setCache<T>(keys: string[], value: T) {
	debugLog("cache set:", keys);

	cache.set(keys.join(":"), value);
}

export function getCache<T>(keys: string[]): T | undefined {
	const v = cache.get(keys.join(":")) as T;
	debugLog(`cache ${!!v ? "hit" : "miss"}`, keys);
	return v;
}

export function invalidateCache(keys: string[]) {
	debugLog("cache invalidate", keys);
	cache.delete(keys.join(":"));
}



// literally only for types beacsue its annoying otherwise
export class CacheHelper<T> {
	protected name: string;

	constructor(datatype: string, name: string) {
		this.name = `${datatype}:${name}`;
		debugLog("cache helper", this.name, "created");
	}

	set(keys: string[], value: T) {
		setCache([this.name, ...keys], value);
	}

	get(keys: string[]): T | undefined {
		return getCache([this.name, ...keys]);
	}

	invalidate(keys: string[]) {
		invalidateCache([this.name, ...keys]);
	}
}
