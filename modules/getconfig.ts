import { z } from "zod";
import { DBMap } from "../common/db/map.js";

const configSchema = z.object({
	channels: z.object({
		list: z.array(z.string()),
		isWhitelist: z.boolean(),
	}),
});

const configDB = await DBMap.create({
	name: "serverconfig",
	defaultV: {
		channels: {
			list: [],
			isWhitelist: false,
		},
	},
	schema: configSchema,
});

export const messageSchema = z.record(z.string(), z.string());

export const messageDB = await DBMap.create({
	name: "messages",
	defaultV: {},
	schema: messageSchema,
});

export const userSettingsSchema = z.object({
	defaultFontSb3: z.string(),
	defaultFontSb2: z.string(),
	defaultStyle: z.enum(["sb3", "sb2", "sb3hc"]),
});

export const userSettingsDB = await DBMap.create({
	name: "usersettings",
	defaultV: {
		defaultFontSb2: "LucidaGrande",
		defaultFontSb3: "Helvetica",
		defaultStyle: "sb3",
	},
	schema: userSettingsSchema,
});

export async function getMessageMap(channelId: string) {
	return messageDB.get(channelId);
}

export default async function getConfig(guildId: string) {
	return configDB.get(guildId);
}

export async function getFontForUser(userId: string) {
	return userSettingsDB.get(userId);
}
