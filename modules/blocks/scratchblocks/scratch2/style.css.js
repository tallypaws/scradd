// Processed by Rollup

const common = `
.sb2-label {
 font-family: Lucida Grande, Verdana, Arial, DejaVu Sans, sans-serif;
  font-weight: bold;
  fill: #fff;
  font-size: 10px;
  word-spacing: +1px;
}

.sb2-literal-number,
.sb2-literal-string,
.sb2-literal-number-dropdown,
.sb2-literal-dropdown {
  font-weight: normal;
  font-size: 9px;
  word-spacing: 0;
}

.sb2-diff {
  fill: none;
  stroke: #000;
}
.sb2-diff-ins {
  stroke-width: 2px;
}
.sb2-diff-del {
  stroke-width: 3px;
}
`

// These override colors defined per style
const commonOverride = `
/* Note: comment colors are different from Scratch. */

.sb2-comment {
  fill: #ffffa5;
  stroke: #d0d1d2;
  stroke-width: 1;
}
.sb2-comment-line {
  fill: #ffff80;
}
/* specificity */
.sb2-comment-label, .sb2-label.sb2-comment-label {
  font-family: Helvetica, Arial, DejaVu Sans, sans-serif;
  font-weight: bold;
  fill: #5c5d5f;
  word-spacing: 0;
  font-size: 12px;
}`

const createRule = (category, name, style) => `
svg${name} .sb2-${category} {
  fill: ${style[category + "Primary"]};
  stroke: ${style[category + "Tertiary"]};
}
svg${name} .sb2-${category}-alt {
  fill: ${style[category + "Secondary"]};
}
svg${name} .sb2-${category}-dark {
  fill: ${style[category + "Tertiary"]};
}
`

const create = (name, style) => `
${createRule("motion", name, style)}
${createRule("looks", name, style)}
${createRule("sound", name, style)}
${createRule("control", name, style)}
${createRule("events", name, style)}
${createRule("sensing", name, style)}
${createRule("operators", name, style)}
${createRule("variables", name, style)}
${createRule("list", name, style)}
${createRule("custom", name, style)}
${createRule("extension", name, style)}
${createRule("obsolete", name, style)}
${createRule("grey", name, style)}

svg${name} .sb2-label {
  fill: ${style.label};
}

svg${name} .sb2-input-color {
  stroke: ${style.inputColorStroke};
}

svg${name} .sb2-input-number,
svg${name} .sb2-input-string {
  fill: ${style.inputFill};
}
svg${name} .sb2-literal-number,
svg${name} .sb2-literal-string {
  fill: ${style.literal};
}

svg${name} .sb2-custom-arg {
  fill: ${style.customPrimary};
  stroke: ${style.customTertiary};
}
`

const originalStyle = {
  label: "#fff",
  inputColorStroke: "#fff",
  inputFill: "#fff",
  /* Blockly color: text */
  literal: "#575e75",

  motionPrimary: "#4a6cd4",
  motionSecondary: "#4a6cd4",
  motionTertiary: "#4a6cd4",

  looksPrimary: "#8a55d7",
  looksSecondary: "#8a55d7",
  looksTertiary: "#8a55d7",

  soundPrimary: "#bb42c3",
  soundSecondary: "#bb42c3",
  soundTertiary: "#bb42c3",

  controlPrimary: "#e1a91a",
  controlSecondary: "#e1a91a",
  controlTertiary: "#e1a91a",

  eventsPrimary: "#c88330",
  eventsSecondary: "#c88330",
  eventsTertiary: "#c88330",

  sensingPrimary: "#2ca5e2",
  sensingSecondary: "#2ca5e2",
  sensingTertiary: "#2ca5e2",

  operatorsPrimary: "#5cb712",
  operatorsSecondary: "#5cb712",
  operatorsTertiary: "#5cb712",

  variablesPrimary: "#ee7d16",
  variablesSecondary: "#ee7d16",
  variablesTertiary: "#ee7d16",

  listPrimary: "#cc5b22",
  listSecondary: "#cc5b22",
  listTertiary: "#cc5b22",

  customPrimary: "#632d99",
  customSecondary: "#632d99",
  customTertiary: "#632d99",

  extensionPrimary: "#0e9a6c",
  extensionSecondary: "#0e9a6c",
  extensionTertiary: "#0e9a6c",

  /**
   * Custom color types. Not defined by Scratch.
   */
  obsoletePrimary: "#d42828",
  obsoleteSecondary: "#d42828",
  obsoleteTertiary: "#d42828",

  /* From early prototype colors */
  greyPrimary: "#969696",
  greySecondary: "#969696",
  greyTertiary: "#969696",
}

const highContrastStyle = {
  label: "#000",
  inputColorStroke: "#fff",
  inputFill: "#fff",
  literal: "#000",

  motionPrimary: "#80b5ff",
  motionSecondary: "#b3d2ff",
  motionTertiary: "#3373cc",

  looksPrimary: "#ccb3ff",
  looksSecondary: "#ddccff",
  looksTertiary: "#774dcb",

  soundPrimary: "#e19de1",
  soundSecondary: "#ffb3ff",
  soundTertiary: "#bd42bd",

  controlPrimary: "#ffbe4c",
  controlSecondary: "#ffda99",
  controlTertiary: "#cf8b17",

  eventsPrimary: "#ffd966",
  eventsSecondary: "#ffecb3",
  eventsTertiary: "#cc9900",

  sensingPrimary: "#85c4e0",
  sensingSecondary: "#aed8ea",
  sensingTertiary: "#2e8eb8",

  operatorsPrimary: "#7ece7e",
  operatorsSecondary: "#b5e3b5",
  operatorsTertiary: "#389438",

  variablesPrimary: "#ffa54c",
  variablesSecondary: "#ffcc99",
  variablesTertiary: "#db6e00",

  listPrimary: "#ff9966",
  listSecondary: "#ffcab0",
  listTertiary: "#e64d00",

  customPrimary: "#ff99aa",
  customSecondary: "#ffccd5",
  customTertiary: "#e64d00",

  extensionPrimary: "#13ecaf",
  extensionSecondary: "#75f0cd",
  extensionTertiary: "#0b8e69",

  /* Manually picked to be readable on black text */
  obsoletePrimary: "#fc6666",
  obsoleteSecondary: "#fcb0b0",
  obsoleteTertiary: "#d32121",

  greyPrimary: "#bfbfbf",
  greySecondary: "#b2b2b2",
  /* Changed to be AAA against #000000, was AA */
  greyTertiary: "#959595",
}

export default common +
  create("", originalStyle) +
  create(".scratchblocks-style-scratch3-high-contrast", highContrastStyle) +
  commonOverride
