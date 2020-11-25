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
	const [shortest = 9, longest = 13] = vscode.workspace.getConfiguration().get('timestamp-helper.activeLimit') || [];
	const timeFormat: string = vscode.workspace.getConfiguration().get('timestamp-helper.format') || 'YYYY-MM-DD HH:mm:ss';
	const pureNumberReg = new RegExp(`(\\D|^)(\\d{${shortest},${longest}})(\\D|$)`);
	const timeTransfer = new TimeTransfer();

	// subscribe hover
	const hover = vscode.languages.registerHoverProvider({scheme: '*', language: 'javascript'}, {
		provideHover(document, position, token) {
			// get word at the hover position: a word or a sentence
			const wordAtPosition = document.getText(document.getWordRangeAtPosition(position));
			const regMatch = wordAtPosition.match(pureNumberReg);
			if (regMatch) {
				const numMatch = regMatch[2];
				const result = new vscode.MarkdownString();
				const guessIsmillisecond = numMatch.length > 10;
				result.appendMarkdown(`Guess timestamp in ${guessIsmillisecond ? 'millisecond' : 'second'}:\n`);
				const day = guessIsmillisecond ? dayjs(+numMatch) : dayjs.unix(+numMatch);
				result.appendMarkdown(`\* Local: \`${day.format(timeFormat)}\`\n`);
				const dayInUTC = day.utc();
				result.appendMarkdown(`\* UTC: \`${dayInUTC.format(timeFormat)}\``);
				return {
					contents: [result]
				};
			}
		}
	});
	context.subscriptions.push(hover);

	// comand transfer
	const transferDisposable = vscode.commands.registerCommand('timestamp-helper.transfer', async () => {
		const inputValue = await vscode.window.showInputBox({
			prompt: 'please type your converter: ',
			placeHolder: 'For example: now'
		}) || '';
		const inputText = inputValue.trim();

		// get selections
		const textEditor = vscode.window.activeTextEditor;
		const selections = textEditor?.selections || [];
		if (selections.length && inputText) {
			selections.forEach(sel => {
				const selText = textEditor?.document?.getText(sel) || '';
				const result = timeTransfer.transfer(inputText, +selText || 0);
				if (result) {
					textEditor?.edit(editBuilder => {
						editBuilder.replace(sel, String(result));
					});
				} else {
					vscode.window.showInformationMessage(`"${inputText}" is wrongly transferred "${selText}" to ${result}`);
				}
			});
		}
	});

	context.subscriptions.push(transferDisposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}