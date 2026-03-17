import * as vscode from 'vscode';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { StorageManager, Conversation, Message, AppConfig } from './storage';
import { getWebviewContent } from './webview-content';

export const GENSPARK_MODELS = [
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', group: 'Claude', contextWindow: 200000 },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', group: 'Claude', contextWindow: 200000 },
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', group: 'Claude', contextWindow: 200000 },
    { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', group: 'Claude', contextWindow: 200000 },
    { id: 'claude-4-5-haiku', name: 'Claude Haiku 4.5', group: 'Claude', contextWindow: 200000 },
    { id: 'gpt-5-pro', name: 'GPT-5 Pro', group: 'GPT', contextWindow: 128000 },
    { id: 'gpt-5.2-pro', name: 'GPT-5.2 Pro', group: 'GPT', contextWindow: 128000 },
    { id: 'gpt-5.2', name: 'GPT-5.2', group: 'GPT', contextWindow: 128000 },
    { id: 'gpt-5.1-low', name: 'GPT-5.1 Low', group: 'GPT', contextWindow: 128000 },
    { id: 'o3-pro', name: 'O3 Pro', group: 'GPT', contextWindow: 128000 },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', group: 'Gemini', contextWindow: 1000000 },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', group: 'Gemini', contextWindow: 1000000 },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', group: 'Gemini', contextWindow: 1000000 },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', group: 'Gemini', contextWindow: 1000000 },
    { id: 'grok-4-0709', name: 'Grok 4', group: 'Grok', contextWindow: 128000 },
    { id: 'deep-seek-r1', name: 'DeepSeek R1', group: 'DeepSeek', contextWindow: 65536 },
];

// =====================================================================
// SYSTEM PROMPT — injected when user attaches files
// Forces AI to use SEARCH/REPLACE format for code edits
// =====================================================================
const EDIT_SYSTEM_PROMPT = `You are an expert coding assistant integrated into a code editor (like Cursor or GitHub Copilot).

When the user asks you to edit, fix, improve, or modify code from an attached file, you MUST use this SEARCH/REPLACE format for every change:

<<<<<<< SEARCH
[exact lines from the original file to be replaced — copy verbatim, including indentation]
=======
[new replacement lines]
>>>>>>> REPLACE

Rules:
1. SEARCH block must contain EXACT lines from the original file (copy-paste, do not paraphrase)
2. Each SEARCH/REPLACE block handles ONE logical change
3. Use MULTIPLE blocks for multiple changes in different locations
4. Keep SEARCH blocks SHORT (3-15 lines) — enough context to be unique in the file
5. For NEW code to INSERT (not replace), use a short unique anchor line in SEARCH and add new code in REPLACE
6. Always specify the filename before the block like: **Editing \`filename.ext\`:**
7. If user asks a question (not an edit request), answer normally WITHOUT using SEARCH/REPLACE blocks

Example:
**Editing \`index.html\`:**
<<<<<<< SEARCH
<title>Old Title</title>
=======
<title>New Title</title>
>>>>>>> REPLACE

<<<<<<< SEARCH
</head>
=======
  <meta name="description" content="My page">
</head>
>>>>>>> REPLACE`;

// ---- Pending edit state ----
interface PendingEdit {
    filePath: string;
    originalContent: string;
    newContent: string;
    originalUri: vscode.Uri;
}

// ---- SEARCH/REPLACE block parsed from AI response ----
export interface SRBlock {
    fileName?: string;   // which file this block targets (parsed from "**Editing `x`:**")
    search: string;      // exact text to find
    replace: string;     // replacement text
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _currentConversation?: Conversation;
    private _isStreaming = false;
    private _pendingEdits = new Map<string, PendingEdit>();
    // filePath → content BEFORE any SR edits this session (for diff)
    private _srOriginals = new Map<string, string>();

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly storage: StorageManager
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };
        webviewView.webview.html = getWebviewContent(
            webviewView.webview,
            this.context.extensionUri,
            GENSPARK_MODELS,
            this.storage.getConfig()
        );
        webviewView.webview.onDidReceiveMessage(async (msg) => {
            await this._handleMessage(msg);
        });
        setTimeout(() => this._sendInitialState(), 500);
    }

    private async _handleMessage(msg: any) {
        switch (msg.type) {
            case 'sendMessage':
                await this._sendMessage(msg.text, msg.model, msg.attachedFiles);
                break;
            case 'newChat': this.newChat(); break;
            case 'loadConversation': this._loadConversation(msg.id); break;
            case 'deleteConversation': this._deleteConversation(msg.id); break;
            case 'clearAllHistory':
                this.storage.clearAllConversations();
                this._currentConversation = undefined;
                this._postMessage({ type: 'historyCleared' });
                break;
            case 'getHistory': this._sendHistory(); break;
            case 'saveConfig':
                this.storage.saveConfig(msg.config);
                this._postMessage({ type: 'configSaved', config: this.storage.getConfig() });
                vscode.window.showInformationMessage('Genspark: Settings saved!');
                break;
            case 'getConfig':
                this._postMessage({ type: 'configLoaded', config: this.storage.getConfig() });
                break;
            case 'addFile': await this._handleAddFile(); break;
            case 'readCurrentFile': await this._readCurrentFile(); break;
            case 'readFileByPath': await this._readFileByPath(msg.path); break;
            case 'searchWorkspaceFiles': await this._searchWorkspaceFiles(msg.query); break;
            case 'getWorkspaceTree': await this._getWorkspaceTree(); break;
            case 'stopGeneration': this._isStreaming = false; break;
            case 'copyCode': vscode.env.clipboard.writeText(msg.code); break;
            case 'insertCode': await this._insertCodeToEditor(msg.code); break;
            // ---- EDIT FLOW (whole-file replace) ----
            case 'applyEdit': await this._applyEdit(msg.code, msg.filePath); break;
            case 'acceptEdit': await this._acceptEdit(msg.filePath); break;
            case 'rejectEdit': await this._rejectEdit(msg.filePath); break;
            // ---- SEARCH/REPLACE FLOW ----
            case 'applySRBlock': await this._applySRBlock(msg.block, msg.filePath); break;
            case 'applySRAll': await this._applySRAll(msg.blocks, msg.filePath); break;
            case 'acceptSREdit': await this._acceptEdit(msg.filePath); break;
            case 'rejectSREdit': await this._rejectEdit(msg.filePath); break;
            case 'openSettings':
                vscode.commands.executeCommand('workbench.action.openSettings', 'genspark-coder');
                break;
            case 'testConnection': await this._testConnection(msg.apiUrl, msg.apiKey); break;
        }
    }

    // =====================================================================
    // SEARCH/REPLACE APPLY
    // =====================================================================

    /**
     * Apply one SEARCH/REPLACE block to a file.
     * Finds exact `search` text in file, replaces with `replace`.
     */
    private async _applySRBlock(block: SRBlock, filePath?: string) {
        const targetUri = await this._resolveTargetUri(filePath, block.fileName);
        if (!targetUri) return;

        try {
            const bytes = await vscode.workspace.fs.readFile(targetUri);
            const content = Buffer.from(bytes).toString('utf8');

            // Backup original before first SR edit in this session
            if (!this._srOriginals.has(targetUri.fsPath)) {
                this._srOriginals.set(targetUri.fsPath, content);
            }

            const search = block.search;
            const replace = block.replace;

            // Exact match first
            if (!content.includes(search)) {
                // Try normalized match (trim trailing spaces per line)
                const normContent = this._normalizeLines(content);
                const normSearch = this._normalizeLines(search);
                if (!normContent.includes(normSearch)) {
                    this._postMessage({
                        type: 'srBlockError',
                        error: `Could not find the SEARCH text in ${path.basename(targetUri.fsPath)}.\nThe file may have changed.`,
                        block,
                    });
                    return;
                }
                // Apply with normalized matching
                const newContent = this._replaceNormalized(content, normSearch, replace);
                await this._writeSRResult(targetUri, content, newContent);
            } else {
                const newContent = content.replace(search, replace);
                await this._writeSRResult(targetUri, content, newContent);
            }
        } catch (e: any) {
            this._postMessage({ type: 'srBlockError', error: e.message, block });
        }
    }

    /** Apply ALL SR blocks from one AI response to a file */
    private async _applySRAll(blocks: SRBlock[], filePath?: string) {
        if (!blocks || blocks.length === 0) return;

        // Group blocks by file
        const byFile = new Map<string | undefined, SRBlock[]>();
        for (const b of blocks) {
            const key = b.fileName || filePath || '__active__';
            if (!byFile.has(key)) byFile.set(key, []);
            byFile.get(key)!.push(b);
        }

        for (const [fp, fileBlocks] of byFile) {
            const targetUri = await this._resolveTargetUri(fp === '__active__' ? undefined : fp);
            if (!targetUri) continue;

            try {
                const bytes = await vscode.workspace.fs.readFile(targetUri);
                let content = Buffer.from(bytes).toString('utf8');

                if (!this._srOriginals.has(targetUri.fsPath)) {
                    this._srOriginals.set(targetUri.fsPath, content);
                }

                let applied = 0;
                let failed: SRBlock[] = [];

                for (const block of fileBlocks) {
                    if (content.includes(block.search)) {
                        content = content.replace(block.search, block.replace);
                        applied++;
                    } else {
                        const normContent = this._normalizeLines(content);
                        const normSearch = this._normalizeLines(block.search);
                        if (normContent.includes(normSearch)) {
                            content = this._replaceNormalized(content, normSearch, block.replace);
                            applied++;
                        } else {
                            failed.push(block);
                        }
                    }
                }

                await this._writeSRResult(targetUri, this._srOriginals.get(targetUri.fsPath)!, content);

                this._postMessage({
                    type: 'srAllResult',
                    filePath: targetUri.fsPath,
                    fileName: path.basename(targetUri.fsPath),
                    applied,
                    failed: failed.length,
                    failedBlocks: failed,
                });

            } catch (e: any) {
                this._postMessage({ type: 'srBlockError', error: e.message, block: null });
            }
        }
    }

    private async _writeSRResult(targetUri: vscode.Uri, originalContent: string, newContent: string) {
        // Save pending edit for Accept/Reject
        this._pendingEdits.set(targetUri.fsPath, {
            filePath: targetUri.fsPath,
            originalContent: this._srOriginals.get(targetUri.fsPath) || originalContent,
            newContent,
            originalUri: targetUri,
        });

        await vscode.workspace.fs.writeFile(targetUri, Buffer.from(newContent, 'utf8'));

        // Open diff
        const original = this._pendingEdits.get(targetUri.fsPath)!.originalContent;
        const tmpUri = vscode.Uri.joinPath(
            this.context.globalStorageUri,
            `diff_original_${Date.now()}.tmp`
        );
        await vscode.workspace.fs.writeFile(tmpUri, Buffer.from(original, 'utf8'));
        const fileName = path.basename(targetUri.fsPath);
        await vscode.commands.executeCommand(
            'vscode.diff',
            tmpUri,
            targetUri,
            `⟵ Original  |  ${fileName} (AI edit) ⟶`,
            { preview: true }
        );

        this._postMessage({
            type: 'editApplied',
            filePath: targetUri.fsPath,
            fileName,
        });
    }

    private _normalizeLines(text: string): string {
        return text.split('\n').map(l => l.trimEnd()).join('\n');
    }

    private _replaceNormalized(content: string, normSearch: string, replace: string): string {
        // Find the original lines that correspond to normSearch
        const contentLines = content.split('\n');
        const searchLines = normSearch.split('\n');
        const n = searchLines.length;

        for (let i = 0; i <= contentLines.length - n; i++) {
            const chunk = contentLines.slice(i, i + n).map(l => l.trimEnd()).join('\n');
            if (chunk === normSearch) {
                const before = contentLines.slice(0, i).join('\n');
                const after = contentLines.slice(i + n).join('\n');
                const parts = [before, replace, after].filter((x, idx) => {
                    if (idx === 0 && before === '') return false;
                    if (idx === 2 && after === '') return false;
                    return true;
                });
                if (before === '' && after === '') return replace;
                if (before === '') return replace + '\n' + after;
                if (after === '') return before + '\n' + replace;
                return before + '\n' + replace + '\n' + after;
            }
        }
        return content; // no match, return unchanged
    }

    private async _resolveTargetUri(filePath?: string, blockFileName?: string): Promise<vscode.Uri | undefined> {
        // 1. Explicit path provided
        if (filePath && filePath !== '__active__') {
            return vscode.Uri.file(filePath);
        }

        // 2. Block specifies filename → search workspace
        if (blockFileName) {
            const found = await vscode.workspace.findFiles(`**/${blockFileName}`, '**/node_modules/**', 1);
            if (found.length > 0) return found[0];
        }

        // 3. Active editor
        const editor = vscode.window.activeTextEditor;
        if (editor) return editor.document.uri;

        this._postMessage({ type: 'editError', error: 'No target file. Please open or attach a file first.' });
        return undefined;
    }

    // =====================================================================
    // WHOLE-FILE EDIT (from "Apply to File" button on plain code blocks)
    // =====================================================================
    private async _applyEdit(newCode: string, filePath?: string) {
        const targetUri = await this._resolveTargetUri(filePath);
        if (!targetUri) return;

        try {
            const originalBytes = await vscode.workspace.fs.readFile(targetUri);
            const originalContent = Buffer.from(originalBytes).toString('utf8');

            this._pendingEdits.set(targetUri.fsPath, {
                filePath: targetUri.fsPath,
                originalContent,
                newContent: newCode,
                originalUri: targetUri,
            });

            await vscode.workspace.fs.writeFile(targetUri, Buffer.from(newCode, 'utf8'));

            const tmpUri = vscode.Uri.joinPath(
                this.context.globalStorageUri,
                `diff_original_${Date.now()}.tmp`
            );
            await vscode.workspace.fs.writeFile(tmpUri, Buffer.from(originalContent, 'utf8'));

            const fileName = path.basename(targetUri.fsPath);
            await vscode.commands.executeCommand(
                'vscode.diff',
                tmpUri,
                targetUri,
                `⟵ Original  |  ${fileName} (AI edit) ⟶`,
                { preview: true }
            );

            this._postMessage({ type: 'editApplied', filePath: targetUri.fsPath, fileName });

        } catch (e: any) {
            this._postMessage({ type: 'editError', error: e.message || String(e) });
            vscode.window.showErrorMessage(`Genspark apply edit failed: ${e.message}`);
        }
    }

    private async _acceptEdit(filePath: string) {
        this._pendingEdits.delete(filePath);
        this._srOriginals.delete(filePath);
        await this._closeDiffTabsForFile(filePath);
        this._cleanTmpDiffFiles();

        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        await vscode.window.showTextDocument(doc);

        this._postMessage({ type: 'editAccepted', filePath, fileName: path.basename(filePath) });
        vscode.window.showInformationMessage(`✅ Genspark: Changes accepted in ${path.basename(filePath)}`);
    }

    private async _rejectEdit(filePath: string) {
        const pending = this._pendingEdits.get(filePath);
        if (!pending) return;

        try {
            await vscode.workspace.fs.writeFile(
                pending.originalUri,
                Buffer.from(pending.originalContent, 'utf8')
            );
            this._pendingEdits.delete(filePath);
            this._srOriginals.delete(filePath);
            await this._closeDiffTabsForFile(filePath);
            this._cleanTmpDiffFiles();

            const doc = await vscode.workspace.openTextDocument(pending.originalUri);
            await vscode.window.showTextDocument(doc);

            this._postMessage({ type: 'editRejected', filePath, fileName: path.basename(filePath) });
            vscode.window.showInformationMessage(`↩️ Genspark: Changes reverted in ${path.basename(filePath)}`);
        } catch (e: any) {
            vscode.window.showErrorMessage(`Genspark revert failed: ${e.message}`);
        }
    }

    private async _closeDiffTabsForFile(filePath: string) {
        const fileName = path.basename(filePath);
        for (const group of vscode.window.tabGroups.all) {
            for (const tab of group.tabs) {
                if (tab.label && tab.label.includes(fileName) && tab.label.includes('AI edit')) {
                    await vscode.window.tabGroups.close(tab);
                }
            }
        }
    }

    private async _cleanTmpDiffFiles() {
        try {
            const dir = this.context.globalStorageUri;
            const entries = await vscode.workspace.fs.readDirectory(dir);
            for (const [name] of entries) {
                if (name.startsWith('diff_original_') && name.endsWith('.tmp')) {
                    await vscode.workspace.fs.delete(
                        vscode.Uri.joinPath(dir, name), { useTrash: false }
                    );
                }
            }
        } catch {}
    }

    // =====================================================================
    // SEND MESSAGE — inject system prompt when files attached
    // =====================================================================
    private async _sendMessage(text: string, modelId: string, attachedFiles?: any[]) {
        if (this._isStreaming) {
            vscode.window.showWarningMessage('Please wait for the current response to finish.');
            return;
        }

        const config = this.storage.getConfig();

        if (!this._currentConversation) {
            this._currentConversation = {
                id: this.storage.generateId(),
                title: text.slice(0, 60) || 'New Chat',
                messages: [],
                model: modelId,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
        }

        // Build user content — embed files
        let userContent = text;
        if (attachedFiles && attachedFiles.length > 0) {
            for (const f of attachedFiles) {
                userContent += `\n\n**File: ${f.name}**\n\`\`\`${f.lang || ''}\n${f.content}\n\`\`\``;
            }
        }

        const userMsg: Message = {
            id: this.storage.generateId(),
            role: 'user',
            content: userContent,
            timestamp: Date.now(),
        };

        this._currentConversation.messages.push(userMsg);
        this._currentConversation.updatedAt = Date.now();
        this._currentConversation.model = modelId;

        if (this._currentConversation.messages.length === 1) {
            this._currentConversation.title = text.slice(0, 60) || 'New Chat';
        }

        this._postMessage({ type: 'messageAdded', message: userMsg });

        // Build API messages — inject system prompt when files are attached
        const hasFiles = attachedFiles && attachedFiles.length > 0;
        const apiMessages: any[] = [];

        if (hasFiles) {
            apiMessages.push({ role: 'system', content: EDIT_SYSTEM_PROMPT });
        }

        // Add conversation history (skip old system messages to avoid duplication)
        for (const m of this._currentConversation.messages) {
            if (m.role !== 'system') {
                apiMessages.push({ role: m.role, content: m.content });
            }
        }

        try {
            this._isStreaming = true;
            const assistantMsgId = this.storage.generateId();
            this._postMessage({ type: 'streamStart', messageId: assistantMsgId });
            let fullContent = '';

            if (config.streamResponse) {
                await this._streamCompletion(config, apiMessages, modelId, assistantMsgId, (chunk) => {
                    fullContent += chunk;
                    this._postMessage({ type: 'streamChunk', messageId: assistantMsgId, chunk });
                });
            } else {
                fullContent = await this._fetchCompletion(config, apiMessages, modelId);
                this._postMessage({ type: 'streamChunk', messageId: assistantMsgId, chunk: fullContent });
            }

            const assistantMsg: Message = {
                id: assistantMsgId,
                role: 'assistant',
                content: fullContent,
                timestamp: Date.now(),
                model: modelId,
            };

            this._currentConversation.messages.push(assistantMsg);
            this._currentConversation.updatedAt = Date.now();
            this.storage.saveConversation(this._currentConversation);
            this.storage.setCurrentConversationId(this._currentConversation.id);

            this._postMessage({ type: 'streamEnd', messageId: assistantMsgId, message: assistantMsg });

        } catch (err: any) {
            this._isStreaming = false;
            const errMsg = err.message || String(err);
            this._postMessage({ type: 'streamError', error: errMsg });
            vscode.window.showErrorMessage(`Genspark API Error: ${errMsg}`);
        } finally {
            this._isStreaming = false;
        }
    }

    // =====================================================================
    // HTTP helpers
    // =====================================================================
    private _streamCompletion(
        config: AppConfig, messages: any[], model: string,
        messageId: string, onChunk: (chunk: string) => void
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const body = JSON.stringify({ model, messages, stream: true, max_tokens: config.maxTokens, temperature: config.temperature });
            const url = new URL(`${config.apiUrl}/v1/chat/completions`);
            const isHttps = url.protocol === 'https:';
            const reqLib = isHttps ? https : http;
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}`, 'Content-Length': Buffer.byteLength(body) },
            };
            const req = reqLib.request(options, (res) => {
                if (res.statusCode !== 200) {
                    let errBody = '';
                    res.on('data', (d) => errBody += d.toString());
                    res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${errBody}`)));
                    return;
                }
                let buffer = '';
                res.on('data', (chunk: Buffer) => {
                    if (!this._isStreaming) { req.destroy(); resolve(); return; }
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || !trimmed.startsWith('data: ')) continue;
                        const data = trimmed.slice(6);
                        if (data === '[DONE]') continue;
                        try { const parsed = JSON.parse(data); const delta = parsed.choices?.[0]?.delta?.content; if (delta) onChunk(delta); } catch {}
                    }
                });
                res.on('end', () => resolve());
                res.on('error', reject);
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }

    private _fetchCompletion(config: AppConfig, messages: any[], model: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const body = JSON.stringify({ model, messages, stream: false, max_tokens: config.maxTokens, temperature: config.temperature });
            const url = new URL(`${config.apiUrl}/v1/chat/completions`);
            const isHttps = url.protocol === 'https:';
            const reqLib = isHttps ? https : http;
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}`, 'Content-Length': Buffer.byteLength(body) },
            };
            const req = reqLib.request(options, (res) => {
                let data = '';
                res.on('data', (chunk: Buffer) => data += chunk.toString());
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.error) reject(new Error(parsed.error.message));
                        else resolve(parsed.choices?.[0]?.message?.content || '');
                    } catch (e) { reject(new Error(`Parse error: ${data.slice(0, 200)}`)); }
                });
                res.on('error', reject);
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }

    private async _testConnection(apiUrl: string, apiKey: string) {
        try {
            await this._fetchCompletion({ ...this.storage.getConfig(), apiUrl, apiKey }, [{ role: 'user', content: 'ping' }], 'claude-sonnet-4-6');
            this._postMessage({ type: 'connectionOk' });
        } catch (err: any) {
            this._postMessage({ type: 'connectionFail', error: err.message || String(err) });
        }
    }

    // =====================================================================
    // CONVERSATION & STATE
    // =====================================================================
    private _sendInitialState() {
        const config = this.storage.getConfig();
        this._postMessage({ type: 'configLoaded', config });
        this._postMessage({ type: 'modelsLoaded', models: GENSPARK_MODELS });
        const lastId = this.storage.getCurrentConversationId();
        if (lastId) {
            const conv = this.storage.getConversation(lastId);
            if (conv) { this._currentConversation = conv; this._postMessage({ type: 'conversationLoaded', conversation: conv }); }
        }
    }

    private _loadConversation(id: string) {
        const conv = this.storage.getConversation(id);
        if (conv) {
            this._currentConversation = conv;
            this.storage.setCurrentConversationId(id);
            this._postMessage({ type: 'conversationLoaded', conversation: conv });
        }
    }

    private _deleteConversation(id: string) {
        this.storage.deleteConversation(id);
        if (this._currentConversation?.id === id) this._currentConversation = undefined;
        this._sendHistory();
        this._postMessage({ type: 'conversationDeleted', id });
    }

    private _sendHistory() {
        this._postMessage({ type: 'historyLoaded', conversations: this.storage.getAllConversations() });
    }

    // =====================================================================
    // FILE OPERATIONS
    // =====================================================================
    private async _handleAddFile() {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: true, openLabel: 'Add to Chat',
            filters: {
                'Code Files': ['ts','js','tsx','jsx','py','go','java','c','cpp','cs','rb','php','swift','kt','rs','html','css','json','md','yaml','yml','sh','sql'],
                'All Files': ['*']
            }
        });
        if (!uris || uris.length === 0) return;
        await this._readAndAttachUris(uris);
    }

    private async _readCurrentFile() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { this._postMessage({ type: 'error', message: 'No active editor' }); return; }
        const doc = editor.document;
        this._postMessage({
            type: 'filesAttached',
            files: [{ name: path.basename(doc.fileName), content: doc.getText().slice(0, 50000), lang: path.extname(doc.fileName).slice(1), path: doc.fileName }]
        });
    }

    private async _readFileByPath(filePath: string) {
        try {
            const uri = vscode.Uri.file(filePath);
            const content = await vscode.workspace.fs.readFile(uri);
            const text = Buffer.from(content).toString('utf8');
            this._postMessage({
                type: 'filesAttached',
                files: [{ name: path.basename(filePath), content: text.slice(0, 50000), lang: path.extname(filePath).slice(1), path: filePath }]
            });
        } catch (e: any) { this._postMessage({ type: 'error', message: `Cannot read: ${e.message}` }); }
    }

    private async _searchWorkspaceFiles(query: string) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) { this._postMessage({ type: 'workspaceFiles', files: [] }); return; }
        try {
            const q = query.trim();
            const uris = await vscode.workspace.findFiles(q ? `**/*${q}*` : '**/*', '{**/node_modules/**,**/.git/**,**/dist/**,**/out/**}', 50);
            const files = uris.map(uri => {
                const wsFolder = vscode.workspace.getWorkspaceFolder(uri);
                const relPath = wsFolder ? path.relative(wsFolder.uri.fsPath, uri.fsPath) : path.basename(uri.fsPath);
                return { name: path.basename(uri.fsPath), path: uri.fsPath, relPath, ext: path.extname(uri.fsPath).slice(1) };
            });
            files.sort((a, b) => {
                const aq = a.name.toLowerCase().indexOf(q.toLowerCase());
                const bq = b.name.toLowerCase().indexOf(q.toLowerCase());
                if (aq === 0 && bq !== 0) return -1;
                if (bq === 0 && aq !== 0) return 1;
                return a.relPath.localeCompare(b.relPath);
            });
            this._postMessage({ type: 'workspaceFiles', files: files.slice(0, 30) });
        } catch { this._postMessage({ type: 'workspaceFiles', files: [] }); }
    }

    private async _getWorkspaceTree() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) { this._postMessage({ type: 'workspaceTree', folders: [] }); return; }
        const SKIP = new Set(['node_modules','.git','dist','out','__pycache__','.venv','.next','build','coverage']);
        const folders = [];
        for (const wsFolder of workspaceFolders) {
            try {
                const children = await vscode.workspace.fs.readDirectory(wsFolder.uri);
                const items = [];
                for (const [name, fileType] of children) {
                    if (SKIP.has(name) || name.startsWith('.')) continue;
                    const childUri = vscode.Uri.joinPath(wsFolder.uri, name);
                    if (fileType === vscode.FileType.Directory) {
                        let subItems: any[] = [];
                        try {
                            const sub = await vscode.workspace.fs.readDirectory(childUri);
                            subItems = sub.filter(([n,t]) => !SKIP.has(n) && !n.startsWith('.') && t === vscode.FileType.File).slice(0,20).map(([n]) => ({ name:n, path:path.join(childUri.fsPath,n), ext:path.extname(n).slice(1), isDir:false }));
                        } catch {}
                        items.push({ name, path: childUri.fsPath, isDir: true, children: subItems });
                    } else {
                        items.push({ name, path: childUri.fsPath, ext: path.extname(name).slice(1), isDir: false });
                    }
                }
                folders.push({ name: wsFolder.name, path: wsFolder.uri.fsPath, items });
            } catch {}
        }
        this._postMessage({ type: 'workspaceTree', folders });
    }

    private async _readAndAttachUris(uris: vscode.Uri[]) {
        const files = [];
        for (const uri of uris) {
            try {
                const content = await vscode.workspace.fs.readFile(uri);
                files.push({ name: path.basename(uri.fsPath), content: Buffer.from(content).toString('utf8').slice(0,50000), lang: path.extname(uri.fsPath).slice(1), path: uri.fsPath });
            } catch { vscode.window.showErrorMessage(`Cannot read: ${uri.fsPath}`); }
        }
        if (files.length > 0) this._postMessage({ type: 'filesAttached', files });
    }

    private async _insertCodeToEditor(code: string) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            const doc = await vscode.workspace.openTextDocument({ content: code });
            await vscode.window.showTextDocument(doc);
            return;
        }
        editor.edit(b => { if (editor.selection.isEmpty) b.insert(editor.selection.active, code); else b.replace(editor.selection, code); });
    }

    // --- Public methods ---
    newChat() {
        this._currentConversation = undefined;
        this.storage.setCurrentConversationId(undefined);
        this._postMessage({ type: 'newChat' });
    }
    showHistory() { this._sendHistory(); this._postMessage({ type: 'showHistory' }); }
    showSettings() { this._postMessage({ type: 'showSettings', config: this.storage.getConfig() }); }

    sendCodeAction(action: 'explain'|'fix'|'improve'|'tests', code: string, fileName: string, lang: string) {
        const prompts = {
            explain: `Please explain this code from \`${fileName}\`:\n\n\`\`\`${lang}\n${code}\n\`\`\``,
            fix: `Please fix any bugs in this code from \`${fileName}\`:\n\n\`\`\`${lang}\n${code}\n\`\`\``,
            improve: `Please improve this code from \`${fileName}\`:\n\n\`\`\`${lang}\n${code}\n\`\`\``,
            tests: `Please generate unit tests for this code from \`${fileName}\`:\n\n\`\`\`${lang}\n${code}\n\`\`\``,
        };
        this._postMessage({ type: 'prefillMessage', text: prompts[action] });
    }

    addCodeToChat(code: string, fileName: string, lang: string) {
        this._postMessage({ type: 'filesAttached', files: [{ name: path.basename(fileName), content: code, lang, path: fileName }] });
    }

    addWholeFileToChat(doc: vscode.TextDocument) {
        this._postMessage({ type: 'filesAttached', files: [{ name: path.basename(doc.fileName), content: doc.getText().slice(0,50000), lang: path.extname(doc.fileName).slice(1), path: doc.fileName }] });
    }

    private _postMessage(msg: any) { this._view?.webview.postMessage(msg); }
}
