// import canvas from '@napi-rs/canvas';
import { JSDOM } from "jsdom";
// import canvas from "@napi-rs/canvas";
import canva from "canvas";
import { client, defineChatCommand, defineMenuCommand } from "strife.js";
import { resolve } from "path";
import { writeFile, mkdir } from "fs/promises";
import { extname } from "path";
import { ApplicationCommandType, ComponentType, MessageFlags, TextChannel } from "discord.js";
import { getFontForUser, getMessageMap, messageDB } from "../getconfig.js";
import { writeFileSync } from "fs";
let fetchedFonts: Record<string, string> = {
	"Helvetica": resolve("./fonts/Helvetica.otf"),
	"Comic Sans MS": resolve("./fonts/ComicSans.otf"),
	"Lucida Grande": resolve("./fonts/lucidagrande.ttf"),
};
async function fetchAndSaveFont(fontName: string): Promise<string> {
	const formattedName = fontName.replace(/\s+/g, "+");
	const cssUrl = `https://fonts.googleapis.com/css2?family=${formattedName}`;

	const cssRes = await fetch(cssUrl, {
		headers: {
			"User-Agent": "Mozilla/5.0",
		},
	}).catch(() => undefined);
	if (!cssRes) return ""
	if (!cssRes.ok) throw new Error(`Failed to fetch CSS for font ${fontName}`);
	const cssText = await cssRes.text();

	const fontUrlMatch = cssText.match(/src: url\(([^)]+)\)/);
	if (!fontUrlMatch) throw new Error(`No font URL found in CSS for ${fontName}`);
	const fontUrl = fontUrlMatch[1];
	if (!fontUrl) throw new Error("Font URL is undefined");
	const ext = extname(new URL(fontUrl).pathname) || ".font";

	const outDir = resolve("./fonts");
	const outPath = resolve(outDir, `${fontName}${ext}`);

	fetchedFonts[fontName] = outPath;
	console.log(resolve(outPath), { family: fontName });
	if (
		await mkdir(outDir, { recursive: true })
			.then(() => false)
			.catch(() => true)
	) {
		const existingPath = resolve(outDir, `font${ext}`);
		console.log("skipped", outDir);
		canva.registerFont(resolve(outPath), { family: fontName });

		return existingPath;
	}

	const fontRes = await fetch(fontUrl);
	if (!fontRes.ok) throw new Error(`Failed to fetch font file from ${fontUrl}`);
	const fontData = await fontRes.arrayBuffer();

	if (!fontUrl) throw new Error("Font URL is undefined");

	await mkdir(outDir, { recursive: true });
	await writeFile(outPath, Buffer.from(fontData));
	canva.registerFont(resolve(outPath), { family: fontName });

	return outPath;
}
fetchAndSaveFont("Linefont");
fetchAndSaveFont("Fira Code");
fetchAndSaveFont("Hammersmith One")

Object.entries(fetchedFonts).forEach(([name, path]) => {
	canva.registerFont(resolve(path), { family: name });
});

const scratchblocks = (await import("./scratchblocks/index.js")).default;
const xmlEscape = (unsafe: string): string => {
	const escapeMap: { [key: string]: string } = {
		"<": "&lt;",
		">": "&gt;",
		"&": "&amp;",
		"'": "&apos;",
		'"': "&quot;",
	};

	return unsafe.replace(/[<>&'"]/g, (c) => escapeMap[c] as any);
};

export const fonts = {
	Helvetica: { family: "Helvetica Neue, Helvetica" },
	ComicSans: { family: "Comic Sans MS" },
	LucidaGrande: { family: "Lucida Grande" },
	FiraCode: {
		family: "Fira Code",
	},
	LineFont: {
		family: "Linefont",
	},
	Hammersmith: {
		family: "Hammersmith One"
	}
} as const;

export async function scratchBlocksToImage(
	text: string,
	style: string,
	font: [keyof typeof fonts][0],
) {
	const window = new JSDOM(`<pre class='blocks'>${xmlEscape(text)}</pre>`);
style
	const scratchBlocksInstance = scratchblocks(window.window);
	scratchBlocksInstance.appendStyles();
	scratchBlocksInstance.renderMatching("pre.blocks", {
		style: "scratch" + style.replace("hc", "-high-contrast"),
		languages: ["en"],
	});
	const scratchBlocksDiv = window.window.document.querySelector("div.scratchblocks");
	if (!scratchBlocksDiv) throw "scratchBlocksDiv is null!";
	const svgElement = scratchBlocksDiv.getElementsByTagName("svg").item(0);
	if (!svgElement) throw "svgElement is null!";
	let newWidth = Math.ceil(Number(svgElement.getAttribute("width")) * 2);
	let newHeight = Math.ceil(Number(svgElement.getAttribute("height")) * 2);

	// if (newWidth > 4096) {
	// 	const divisor = newWidth / 4096;
	// 	newWidth = Math.ceil(newWidth / divisor);
	// 	newHeight = Math.ceil(newHeight / divisor);
	// }
	// if (newHeight > 4096) {
	// 	const divisor = newHeight / 4096;
	// 	newWidth = Math.ceil(newWidth / divisor);
	// 	newHeight = Math.ceil(newHeight / divisor);
	// }
	svgElement.setAttribute("width", String(newWidth));
	svgElement.setAttribute("height", String(newHeight));
	svgElement.setAttribute("viewbox", `0 0 ${newWidth} ${newHeight}`);
	const styleTag1 = svgElement.appendChild(window.window.document.createElement("style"));

	styleTag1.innerHTML = `.sb3-comment-label {
fill: black !important;
}
* {

}`;
	const styleTag2 = svgElement.appendChild(window.window.document.createElement("style"));
	styleTag2.innerHTML = scratchBlocksInstance.scratch2.stylee.cssContent;
	const styleTag3 = svgElement.appendChild(window.window.document.createElement("style"));
	styleTag3.innerHTML = scratchBlocksInstance.scratch3.stylee.cssContent.styles(
		fonts[font].family,
	);

	writeFileSync("debug.html", window.window.document.documentElement.outerHTML, "utf8");
	const svgData = scratchBlocksDiv.innerHTML;
	const uri = "data:image/svg+xml;base64," + Buffer.from(svgData, "utf8").toString("base64url");

	const image = await canva.loadImage(uri);
	const drawingCanvas = canva.createCanvas(image.width, image.height);
	const ctx = drawingCanvas.getContext("2d");

	ctx.drawImage(image, 0, 0, image.width, image.height);
	return drawingCanvas.toBuffer("image/png");
}

// defineEvent("messageCreate", async (m) => {
//     if (m.author.bot) return
//     const blocks = /block{(.*)}/ms.exec(m.content)
// if (!blocks?.[1]) return
// console.log(blocks)
//     m.reply({})
// })




defineChatCommand(
	{
		name: "blocks",
		description: "Generate an image of scratchblocks",
	},
	async (i) => {
		// i.reply({ files: [await scratchBlocksToImage(o.blocks, "3")] });
		const userSettings = await getFontForUser(i.user.id)
		const modal = {
			title: "Generate Scratchblocks Image",
			custom_id: "scratchblocks_modal",
			components: [
				{
					type: 1,
					components: [
						{
							type: 4,
							custom_id: "blocks_input",
							label: "Enter Scratchblocks",
							style: 2,
							required: true,
							placeholder: "Type your Scratchblocks code here...",
						},
					],
				},
				{
					type: 1,
					components: [
						{
							type: 4,
							custom_id: "blocks_style",
							label: "SB Style",
							style: 1,
							required: true,
							value: userSettings.defaultStyle,
							placeholder: " (sb2, sb3, sb3hc)",
							max_length: 5
						},
					],
				},
			],
		};

		await i.showModal(modal);
		const modalSubmit = await i
			.awaitModalSubmit({
				time: 1000 * 60 * 5,
			})
			.catch(() => undefined);
		if (!modalSubmit) return;
		const blocks = modalSubmit.components[0]?.components[0]?.value;
		const style = (modalSubmit.components[1]?.components[0]?.value ?? "sb3").slice(2);
		console.log(style)
		let font: keyof typeof fonts = userSettings.defaultFontSb3 as keyof typeof fonts
		if (style === "2") {
			font = userSettings.defaultFontSb2 as keyof typeof fonts

		}

		const fontOverride = (() => {
			const match = blocks?.match(/::\s*font ([\w \t]+)/)
			console.log(match)
			const font = Object.keys(fonts).find(f => f.toLowerCase() === match?.[1]?.toLowerCase().replaceAll(" ", ""))
			console.log(font)
			return font as keyof typeof fonts | undefined
		})()
		if (!blocks) return;
		const message = await modalSubmit.reply({
			files: [await scratchBlocksToImage(blocks.replace(/::\s*font ([\w \t]+)/, ""), style, fontOverride ?? font)],
		});
		messageDB.update(
			i.channelId,
			(map) => {
				map.set(message.id, blocks);
				return map;
			},
			false,
		);
	},
);

defineChatCommand(
	{
		name: "help",
		description: "How to use this bot",
	},
	(i) => {
		i.reply({
			ephemeral: true,
			content: `

## [Syntax Guide](https://www.en.scratch-wiki.info/wiki/Block_Plugin)

## How to Use Blocks 

Use code formatting like this:

\\\`\\\`\\\`sb
<your code here>  
\\\`\\\`\\\`

the \`sb\` part is required for the bot to recognize you want a scratch blocks embed

Or, just use the \`/blocks\` command! 
`,
		});
	},
);

defineMenuCommand(
	{
		access: true,
		name: "edit",
		type: ApplicationCommandType.Message,
	},
	async (interaction) => {
		const userSettings = await getFontForUser(interaction.user.id)
		const message = interaction.targetMessage;
		if (message.interaction?.user.id !== interaction.user.id)
			return interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "You can't edit this message!",
			});
		const messageMap = await getMessageMap(message.channelId);
		console.log(messageMap, message.id);
		const blocks = messageMap.get(message.id);
		console.log("blocks", blocks);
		await interaction.showModal({
			custom_id: "edit",
			title: "meow",
			components: [
				{
					type: ComponentType.ActionRow,
					components: [
						{
							custom_id: "blocks",
							type: ComponentType.TextInput,
							label: "Enter Scratchblocks",
							style: 2,
							required: true,
							placeholder: "Type your Scratchblocks code here...",
							value: blocks,
						},
					],
				},
			],
		});
		const modalSubmit = await interaction
			.awaitModalSubmit({
				time: 1000 * 60 * 5,
			})
			.catch(() => undefined);
		if (!modalSubmit) return;
		const newBlocks = modalSubmit.components[0]?.components[0]?.value;
		const style = (modalSubmit.components[1]?.components[0]?.value ?? "sb3").slice(2);
		console.log(style)
		let font: keyof typeof fonts = userSettings.defaultFontSb3 as keyof typeof fonts
		if (style === "2") {
			font = userSettings.defaultFontSb2 as keyof typeof fonts

		}

		const fontOverride = (() => {
			const match = blocks?.match(/::\s*font ([\w \t]+)/)
			console.log(match)
			const font = Object.keys(fonts).find(f => f.toLowerCase() === match?.[1]?.toLowerCase().replaceAll(" ", ""))
			console.log(font)
			return font as keyof typeof fonts | undefined
		})()
		if (!newBlocks) return modalSubmit.deferUpdate();
		await modalSubmit.deferUpdate();
		await message.edit({
			files: [await scratchBlocksToImage(newBlocks, "3", fontOverride ?? font)],
		});
		messageDB.update(
			message.channelId,
			(map) => {
				map.set(message.id, newBlocks);
				return map;
			},
			false,
		);
	},
);

defineMenuCommand(
	{
		access: true,
		name: "delete",
		type: ApplicationCommandType.Message,
	},
	async (interaction) => {
		const message = interaction.targetMessage;
		if (message.interaction?.user.id !== interaction.user.id)
			return interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "You can't delete this message!",
			});
		await message.delete();
		interaction.reply({
			flags: MessageFlags.Ephemeral,
			content: "Deleted",
		});
		messageDB.update(
			message.channelId,
			(map) => {
				map.delete(message.id);
				return map;
			},
			false,
		);
	},
);

try {
	((await client.channels.fetch("1370955405076987964")) as TextChannel).send({
		files: [
			await scratchBlocksToImage(
				`Reloaded :: operators`,
				"3",
				"LineFont",
			),
		],
	});
} catch (error) {
	console.error(error);
}
