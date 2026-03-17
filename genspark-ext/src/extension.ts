import * as vscode from 'vscode';
import { ChatViewProvider } from './chat-view';
import { StorageManager } from './storage';

let chatProvider: ChatViewProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
    const storage = new StorageManager(context);
    chatProvider = new ChatViewProvider(context, storage);

    // Register webview provider
    const provider = vscode.window.registerWebviewViewProvider(
        'genspark-coder.chatView',
        chatProvider,
        { webviewOptions: { retainContextWhenHidden: true } }
    );
    context.subscriptions.push(provider);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('genspark-coder.openChat', () => {
            vscode.commands.executeCommand('genspark-coder.chatView.focus');
        }),

        vscode.commands.registerCommand('genspark-coder.newChat', () => {
            chatProvider?.newChat();
        }),

        vscode.commands.registerCommand('genspark-coder.showHistory', () => {
            chatProvider?.showHistory();
        }),

        vscode.commands.registerCommand('genspark-coder.configure', () => {
            chatProvider?.showSettings();
        }),

        vscode.commands.registerCommand('genspark-coder.explainCode', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const selection = editor.selection;
                const text = editor.document.getText(selection);
                const fileName = editor.document.fileName;
                const lang = editor.document.languageId;
                if (text) {
                    chatProvider?.sendCodeAction('explain', text, fileName, lang);
                    vscode.commands.executeCommand('genspark-coder.chatView.focus');
                }
            }
        }),

        vscode.commands.registerCommand('genspark-coder.fixCode', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const selection = editor.selection;
                const text = editor.document.getText(selection);
                const fileName = editor.document.fileName;
                const lang = editor.document.languageId;
                if (text) {
                    chatProvider?.sendCodeAction('fix', text, fileName, lang);
                    vscode.commands.executeCommand('genspark-coder.chatView.focus');
                }
            }
        }),

        vscode.commands.registerCommand('genspark-coder.improveCode', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const selection = editor.selection;
                const text = editor.document.getText(selection);
                const fileName = editor.document.fileName;
                const lang = editor.document.languageId;
                if (text) {
                    chatProvider?.sendCodeAction('improve', text, fileName, lang);
                    vscode.commands.executeCommand('genspark-coder.chatView.focus');
                }
            }
        }),

        vscode.commands.registerCommand('genspark-coder.generateTests', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const selection = editor.selection;
                const text = editor.document.getText(selection);
                const fileName = editor.document.fileName;
                const lang = editor.document.languageId;
                if (text) {
                    chatProvider?.sendCodeAction('tests', text, fileName, lang);
                    vscode.commands.executeCommand('genspark-coder.chatView.focus');
                }
            }
        }),

        vscode.commands.registerCommand('genspark-coder.addToChat', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const selection = editor.selection;
                const text = editor.document.getText(selection);
                const fileName = editor.document.fileName;
                const lang = editor.document.languageId;
                if (text) {
                    chatProvider?.addCodeToChat(text, fileName, lang);
                    vscode.commands.executeCommand('genspark-coder.chatView.focus');
                } else {
                    // No selection → add whole file
                    chatProvider?.addWholeFileToChat(editor.document);
                    vscode.commands.executeCommand('genspark-coder.chatView.focus');
                }
            }
        })
    );
}

export function deactivate() {
    chatProvider = undefined;
}
