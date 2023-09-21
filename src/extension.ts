// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import TimeTransfer from './transfer/time-transfer';
import dayjs = require('dayjs');
// import dayjs from 'dayjs';
import utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

export function activate(context: vscode.ExtensionContext) {
	// get configuration
	const config = vscode.workspace.getConfiguration().get('timestamp-helper-plus.activeLimit');
	const [shortest = 9, longest = 13] = Array.isArray(config) ? config : [];
	let timeFormat: string = vscode.workspace.getConfiguration().get('timestamp-helper-plus.format') || 'YYYY-MM-DD HH:mm:ss';
	let tsUnits: string = vscode.workspace.getConfiguration().get('timestamp-helper-plus.ts-units') || 'second';
	let timeZones: Array<string> = vscode.workspace.getConfiguration().get('timestamp-helper-plus.time-zones') ?? [];
	const pureNumberReg = new RegExp(`^(\\d{${shortest},${longest}})$`);
	const timeTransfer = new TimeTransfer();

	// listen on configuration change
	vscode.workspace.onDidChangeConfiguration((e) => {
		const timeFormatHasChanged = e.affectsConfiguration('timestamp-helper-plus.format');
		if (timeFormatHasChanged) {
			timeFormat = vscode.workspace.getConfiguration().get('timestamp-helper-plus.format') || 'YYYY-MM-DD HH:mm:ss';
		}
		const tsUnitsHasChanged = e.affectsConfiguration('timestamp-helper-plus.ts-units');
		if (tsUnitsHasChanged) {
			tsUnits = vscode.workspace.getConfiguration().get('timestamp-helper-plus.ts-units') || 'second';
		}
		const timeZonesHasChanged = e.affectsConfiguration('timestamp-helper-plus.time-zones');
		if (timeZonesHasChanged) {
			timeZones = vscode.workspace.getConfiguration().get('timestamp-helper-plus.time-zones') ?? [];
		}
	});

	// subscribe hover
	const hover = vscode.languages.registerHoverProvider({ scheme: '*', language: '*' }, {
		provideHover(document, position, token) {
			// get word at the hover position: a word or a sentence
			const wordAtPosition = document.getText(document.getWordRangeAtPosition(position));
			const regMatch = wordAtPosition.match(pureNumberReg);
			if (regMatch) {
				const result = new vscode.MarkdownString();
				const numMatch = regMatch[1];
				const guessIsmillisecond = numMatch.length > 10;
				// result.appendMarkdown(`Guess timestamp in ${guessIsmillisecond ? 'milliseconds' : 'seconds'}:\n`);
				// 循环获取时区列表及对应的时间差
				const day = guessIsmillisecond ? dayjs(+numMatch) : dayjs.unix(+numMatch);
				const utcTime = day.utc(); // 获取UTC时间
				for (let i = 0; i < timeZones.length; i++) {
					const { name, seconds } = parseTimeString(timeZones[i]);
					const diffTime = utcTime.add(seconds, 'second'); // 根据时间差添加秒数
					let splitor = name ? ": " : ""
					result.appendMarkdown(`\* ${name}${splitor}\`${diffTime.format(timeFormat)}\`\n`);
				}
				return {
					contents: [result]
				};
			}
		}
	});
	context.subscriptions.push(hover);

	// comand transfer
	const transferDisposable = vscode.commands.registerCommand('timestamp-helper-plus.transfer', async () => {
		const inputValue = await vscode.window.showInputBox({
			prompt: 'please type your converter: ',
			placeHolder: 'For example: now'
		}) || '';
		const inputText = inputValue.trim();

		// get selections
		const textEditor = vscode.window.activeTextEditor;
		const selections = textEditor?.selections || [];
		try {
			const replaceTexts = selections.map(sel => {
				const selText = textEditor?.document?.getText(sel) || '';
				const result = timeTransfer.transfer(inputText, +selText || 0, tsUnits);
				if (result) {
					return String(result);
				} else {
					vscode.window.showInformationMessage(`"${inputText}" wrongly transferred "${selText}" to ${result}`);
					return selText;
				}
			});

			// text replace should be done in one editting, for single editting generates a new activeTextEditor.
			textEditor?.edit(editBuilder => {
				selections.map((sel, index) => editBuilder.replace(sel, replaceTexts[index]));
			});
		} catch (e: unknown) {
			vscode.window.showErrorMessage(`oops! there seemed to be some bad things. Error message: ${(e as Error).message}`);
		}
	});

	context.subscriptions.push(transferDisposable);
}

function parseTimeString(timeStr: string): { name: string, seconds: number } {
	let name: string = ""
	let seconds: number = 0
	const parts = timeStr.split(':');
	if (parts.length == 0 || parts.length > 2) {
		return { name, seconds };
	}
	if (parts.length == 1) {
		if (!isNaN(Number(parts[0]))) {
			seconds = parseInt(parts[0], 10);
		} else {
			name = parts[0];
		}
		return { name, seconds };
	}
	if (parts[0].length == 0 && parts[1].length == 0) {
		return { name, seconds };
	}
	name = parts[0];
	seconds = parseInt(parts[1], 10);
	return { name, seconds };
}

// this method is called when your extension is deactivated
export function deactivate() { }
