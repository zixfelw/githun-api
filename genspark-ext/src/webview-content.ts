import * as vscode from 'vscode';
import { AppConfig } from './storage';

export function getWebviewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    models: any[],
    config: AppConfig
): string {
    const defaultModel = config.defaultModel || 'claude-sonnet-4-6';
    const modelsJson = JSON.stringify(models);
    const modelOptions = buildModelOptions(models);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Genspark Coder</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  color: var(--vscode-foreground);
  background: var(--vscode-sideBar-background);
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* ---- HEADER ---- */
.header {
  padding: 6px 10px;
  background: var(--vscode-titleBar-activeBackground);
  border-bottom: 1px solid var(--vscode-panel-border);
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: bold;
  font-size: 12px;
  flex-shrink: 0;
}
.header-right { margin-left: auto; display: flex; gap: 2px; }
.hbtn {
  background: none; border: none;
  color: var(--vscode-foreground);
  cursor: pointer; padding: 3px 6px;
  border-radius: 3px; font-size: 12px; opacity: 0.7;
}
.hbtn:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground); }
.hbtn.active { opacity: 1; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
.mbadge {
  font-size: 10px; padding: 1px 6px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  border-radius: 8px; cursor: pointer;
}

/* ---- PAGES ---- */
.page { display: none; flex-direction: column; flex: 1; min-height: 0; }
.page.active { display: flex; }

/* ---- CHAT PAGE ---- */
#messages {
  flex: 1; overflow-y: auto;
  padding: 10px; display: flex;
  flex-direction: column; gap: 10px; min-height: 0;
}
#messages::-webkit-scrollbar { width: 4px; }
#messages::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background); border-radius: 2px; }

.welcome {
  text-align: center; padding: 20px 12px;
  color: var(--vscode-descriptionForeground);
  font-size: 12px; line-height: 1.6;
}
.welcome h3 { font-size: 15px; margin-bottom: 8px; color: var(--vscode-foreground); }
.shortcuts { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; text-align: left; }
.sc {
  padding: 5px 8px;
  background: var(--vscode-input-background);
  border-radius: 4px; font-size: 11px; cursor: pointer;
  border: 1px solid transparent;
}
.sc:hover { border-color: var(--vscode-focusBorder); }

.msg { max-width: 100%; animation: fi .18s ease; }
@keyframes fi { from{opacity:0;transform:translateY(3px)} to{opacity:1;transform:none} }
.msg.user .bbl {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  padding: 7px 11px; border-radius: 10px 10px 3px 10px;
  margin-left: 15%; word-wrap: break-word; white-space: pre-wrap;
}
.msg.assistant .bbl {
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-panel-border);
  padding: 9px 11px; border-radius: 3px 10px 10px 10px;
  word-wrap: break-word; line-height: 1.55;
}
.msg.error .bbl {
  background: rgba(244,71,71,0.1);
  border: 1px solid var(--vscode-errorForeground, #f44747);
  padding: 7px 11px; border-radius: 6px;
  color: var(--vscode-errorForeground, #f44747);
}
.rlabel { font-size: 10px; opacity: 0.55; margin-bottom: 3px; padding: 0 3px; }
.msg.user .rlabel { text-align: right; }

pre {
  background: var(--vscode-textCodeBlock-background);
  padding: 9px 10px; border-radius: 5px;
  overflow-x: auto; margin: 5px 0;
  font-family: var(--vscode-editor-font-family);
  font-size: 11.5px;
  border: 1px solid var(--vscode-panel-border);
  white-space: pre;
}
code { font-family: var(--vscode-editor-font-family); font-size: 11.5px; }
.icode {
  background: var(--vscode-textCodeBlock-background);
  padding: 1px 4px; border-radius: 3px;
  font-family: var(--vscode-editor-font-family); font-size: 11.5px;
}
.cblock { margin: 6px 0; }
.chdr {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--vscode-sideBar-background);
  border: 1px solid var(--vscode-panel-border);
  border-bottom: none; border-radius: 5px 5px 0 0;
  padding: 3px 8px; font-size: 10px;
}
.clang { font-weight: 700; color: var(--vscode-button-background, #0078d4); }
.cbtns { display: flex; gap: 3px; }
.cbtn {
  font-size: 10px; padding: 1px 7px;
  background: rgba(255,255,255,0.1);
  color: var(--vscode-button-secondaryForeground, #ccc);
  border: none; border-radius: 3px; cursor: pointer;
}
.cbtn:hover { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
.cbtn.apply-btn {
  background: rgba(78,201,176,0.15);
  color: #4ec9b0;
  border: 1px solid rgba(78,201,176,0.4);
}
.cbtn.apply-btn:hover { background: #4ec9b0; color: #1e1e1e; border-color: #4ec9b0; }
.cblock pre { margin: 0; border-radius: 0 0 5px 5px; border-top: none; }

/* ---- PENDING EDIT BANNER ---- */
.edit-banner {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 8px;
  background: rgba(78,201,176,0.1);
  border: 1px solid rgba(78,201,176,0.5);
  border-radius: 5px;
  font-size: 11px;
  margin: 4px 0;
  flex-wrap: wrap;
}
.edit-banner-file {
  font-weight: 700; color: #4ec9b0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  max-width: 160px;
}
.edit-banner-btns { display: flex; gap: 4px; margin-left: auto; }
.ebtn {
  font-size: 11px; padding: 2px 10px;
  border: none; border-radius: 4px; cursor: pointer; font-weight: 600;
}
.ebtn.accept {
  background: #4ec9b0; color: #1e1e1e;
}
.ebtn.accept:hover { background: #3db99f; }
.ebtn.reject {
  background: rgba(244,71,71,0.15);
  color: var(--vscode-errorForeground, #f44747);
  border: 1px solid rgba(244,71,71,0.4);
}
.ebtn.reject:hover { background: var(--vscode-errorForeground, #f44747); color: #fff; }
#editBanners { display: flex; flex-direction: column; gap: 3px; padding: 0 10px; flex-shrink: 0; }

/* ---- SEARCH/REPLACE BLOCKS ---- */
.sr-group {
  border: 1px solid rgba(78,201,176,0.35);
  border-radius: 6px;
  margin: 8px 0;
  overflow: hidden;
  background: rgba(78,201,176,0.04);
}
.sr-group-hdr {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 9px;
  background: rgba(78,201,176,0.12);
  font-size: 11px; font-weight: 700;
  border-bottom: 1px solid rgba(78,201,176,0.25);
}
.sr-fname { color: #4ec9b0; flex: 1; }
.sr-apply-all {
  font-size: 10px; padding: 2px 9px;
  background: #4ec9b0; color: #1e1e1e;
  border: none; border-radius: 3px; cursor: pointer; font-weight: 700;
}
.sr-apply-all:hover { background: #3db99f; }
.sr-block {
  border-bottom: 1px solid rgba(78,201,176,0.15);
  padding: 7px 9px;
}
.sr-block:last-child { border-bottom: none; }
.sr-block-hdr {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; margin-bottom: 5px;
}
.sr-num {
  background: rgba(78,201,176,0.2); color: #4ec9b0;
  border-radius: 3px; padding: 0 5px; font-weight: 700; font-size: 10px;
}
.sr-block-btns { margin-left: auto; display: flex; gap: 3px; }
.sr-btn {
  font-size: 10px; padding: 1px 8px;
  border: 1px solid rgba(78,201,176,0.4); border-radius: 3px;
  background: rgba(78,201,176,0.1); color: #4ec9b0;
  cursor: pointer;
}
.sr-btn:hover { background: #4ec9b0; color: #1e1e1e; }
.sr-section { margin: 3px 0; }
.sr-section-lbl {
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .4px; padding: 1px 5px; border-radius: 2px;
  margin-bottom: 2px; display: inline-block;
}
.sr-section-lbl.search { background: rgba(244,71,71,0.15); color: #f44747; }
.sr-section-lbl.replace { background: rgba(78,201,176,0.15); color: #4ec9b0; }
.sr-code {
  background: var(--vscode-textCodeBlock-background);
  border-radius: 4px; padding: 5px 8px;
  font-family: var(--vscode-editor-font-family);
  font-size: 11px; white-space: pre; overflow-x: auto;
  border: 1px solid var(--vscode-panel-border);
  max-height: 120px; overflow-y: auto;
}
.sr-code.search { border-color: rgba(244,71,71,0.3); }
.sr-code.replace { border-color: rgba(78,201,176,0.3); }

.mc h1 { font-size: 15px; font-weight: 700; margin: 10px 0 5px; }
.mc h2 { font-size: 14px; font-weight: 700; margin: 9px 0 4px; }
.mc h3 { font-size: 13px; font-weight: 600; margin: 8px 0 4px; }
.mc p { margin: 4px 0; }
.mc ul, .mc ol { padding-left: 18px; margin: 4px 0; }
.mc li { margin: 2px 0; }
.mc strong { font-weight: 700; }
.mc em { font-style: italic; }
.mc a { color: var(--vscode-button-background, #0078d4); }
.mc blockquote { border-left: 3px solid var(--vscode-button-background, #0078d4); padding-left: 8px; color: var(--vscode-descriptionForeground); margin: 5px 0; }
.mc hr { border: none; border-top: 1px solid var(--vscode-panel-border); margin: 8px 0; }
.mc table { border-collapse: collapse; width: 100%; margin: 6px 0; font-size: 11.5px; }
.mc th, .mc td { border: 1px solid var(--vscode-panel-border); padding: 3px 7px; }
.mc th { background: var(--vscode-input-background); font-weight: 700; }

.typing {
  display: none; padding: 6px 10px;
  color: var(--vscode-descriptionForeground);
  font-size: 11px; align-items: center; gap: 5px;
  flex-shrink: 0;
}
.typing.show { display: flex; }
.dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; animation: bn 1.2s infinite; }
.dot:nth-child(2) { animation-delay: .2s; }
.dot:nth-child(3) { animation-delay: .4s; }
@keyframes bn { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }

#filesBar {
  display: none; flex-wrap: wrap; gap: 3px;
  padding: 4px 8px;
  border-top: 1px solid var(--vscode-panel-border);
  flex-shrink: 0;
}
.fchip {
  display: flex; align-items: center; gap: 3px;
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px; padding: 2px 6px; font-size: 10px;
  max-width: 160px;
}
.fchip-n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.fchip-x { cursor: pointer; opacity: 0.6; font-size: 11px; flex-shrink: 0; }
.fchip-x:hover { opacity: 1; color: var(--vscode-errorForeground, #f44747); }

/* ---- @-MENTION DROPDOWN ---- */
#atDropdown {
  display: none;
  position: absolute;
  bottom: 100%;
  left: 8px; right: 8px;
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-focusBorder);
  border-radius: 6px;
  z-index: 1000;
  max-height: 220px;
  overflow-y: auto;
  box-shadow: 0 -4px 12px rgba(0,0,0,0.3);
}
#atDropdown.show { display: block; }
.at-hdr {
  padding: 4px 8px; font-size: 10px;
  color: var(--vscode-descriptionForeground);
  border-bottom: 1px solid var(--vscode-panel-border);
  background: var(--vscode-sideBar-background);
  border-radius: 6px 6px 0 0;
  display: flex; justify-content: space-between; align-items: center;
}
.at-item {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 8px; cursor: pointer;
  font-size: 11px; border-radius: 0;
}
.at-item:hover, .at-item.sel { background: var(--vscode-list-hoverBackground); }
.at-item.sel { background: rgba(0,120,212,0.15); }
.at-icon { font-size: 12px; flex-shrink: 0; }
.at-name { font-weight: 500; flex-shrink: 0; }
.at-path { color: var(--vscode-descriptionForeground); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.at-empty { padding: 10px 8px; font-size: 11px; color: var(--vscode-descriptionForeground); text-align: center; }

/* ---- INPUT AREA ---- */
.iarea {
  padding: 7px 8px;
  border-top: 1px solid var(--vscode-panel-border);
  flex-shrink: 0;
  position: relative;
}
.mrow {
  display: flex; align-items: center; gap: 5px;
  margin-bottom: 5px;
}
.mlbl { font-size: 10px; color: var(--vscode-descriptionForeground); flex-shrink: 0; }
#modelSel {
  flex: 1; min-width: 0;
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border);
  color: var(--vscode-input-foreground);
  padding: 3px 5px; border-radius: 4px; font-size: 11px;
  cursor: pointer; outline: none;
}
#modelSel:focus { border-color: var(--vscode-focusBorder); }
.irow { display: flex; gap: 5px; align-items: flex-end; }
#input {
  flex: 1;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  border-radius: 6px;
  padding: 7px 9px;
  resize: none;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  min-height: 36px;
  max-height: 120px;
  outline: none;
  line-height: 1.4;
}
#input:focus { border-color: var(--vscode-focusBorder); }
.isbx { display: flex; flex-direction: column; gap: 3px; flex-shrink: 0; }
.isb {
  background: none; border: none;
  color: var(--vscode-descriptionForeground);
  cursor: pointer; padding: 2px; border-radius: 3px;
  font-size: 14px; opacity: 0.7;
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
}
.isb:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground); }
#sendBtn {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none; border-radius: 5px;
  width: 34px; height: 34px;
  cursor: pointer; font-size: 15px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
#sendBtn:hover { background: var(--vscode-button-hoverBackground); }
#sendBtn:disabled { opacity: 0.4; cursor: not-allowed; }
.ihint { font-size: 10px; color: var(--vscode-descriptionForeground); text-align: right; margin-top: 3px; opacity: 0.5; }

/* ---- HISTORY PAGE ---- */
.phdr {
  display: flex; align-items: center; gap: 7px;
  padding: 6px 10px;
  background: var(--vscode-titleBar-activeBackground);
  border-bottom: 1px solid var(--vscode-panel-border);
  font-weight: 700; font-size: 12px; flex-shrink: 0;
}
.bbk {
  background: none; border: none;
  color: var(--vscode-foreground);
  cursor: pointer; padding: 2px 5px; border-radius: 3px;
  font-size: 14px; opacity: 0.7;
}
.bbk:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground); }
#hSearch {
  margin: 5px 8px; display: block; width: calc(100% - 16px);
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border);
  color: var(--vscode-input-foreground);
  padding: 4px 7px; border-radius: 4px; font-size: 11px; outline: none;
}
#hSearch:focus { border-color: var(--vscode-focusBorder); }
#hList {
  flex: 1; overflow-y: auto; padding: 3px 8px;
  display: flex; flex-direction: column; gap: 3px; min-height: 0;
}
.hitem {
  display: flex; align-items: center; gap: 7px;
  padding: 7px 9px; border-radius: 5px;
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-panel-border); cursor: pointer;
}
.hitem:hover { border-color: var(--vscode-focusBorder); }
.hitem.active { border-color: var(--vscode-button-background, #0078d4); background: rgba(0,120,212,0.08); }
.hcnt { flex: 1; min-width: 0; }
.htitle { font-size: 12px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hmeta { font-size: 10px; color: var(--vscode-descriptionForeground); margin-top: 1px; }
.hdel {
  background: none; border: none;
  color: var(--vscode-descriptionForeground);
  cursor: pointer; padding: 2px; border-radius: 3px;
  font-size: 12px; opacity: 0; flex-shrink: 0;
}
.hitem:hover .hdel { opacity: 0.65; }
.hdel:hover { opacity: 1 !important; color: var(--vscode-errorForeground, #f44747); }
#hEmpty { text-align: center; padding: 24px; color: var(--vscode-descriptionForeground); font-size: 12px; }
.hftr { padding: 6px 8px; border-top: 1px solid var(--vscode-panel-border); flex-shrink: 0; }
.bclr {
  width: 100%; background: none;
  border: 1px solid var(--vscode-errorForeground, #f44747);
  color: var(--vscode-errorForeground, #f44747);
  padding: 4px; border-radius: 4px; cursor: pointer; font-size: 11px;
}
.bclr:hover { background: var(--vscode-errorForeground, #f44747); color: #fff; }

/* ---- WORKSPACE FILES PAGE ---- */
#wsSearch {
  margin: 6px 8px; display: block; width: calc(100% - 16px);
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border);
  color: var(--vscode-input-foreground);
  padding: 4px 7px; border-radius: 4px; font-size: 11px; outline: none;
}
#wsSearch:focus { border-color: var(--vscode-focusBorder); }
#wsTree {
  flex: 1; overflow-y: auto; padding: 3px 8px; min-height: 0;
}
.ws-folder {
  margin-bottom: 8px;
}
.ws-folder-hdr {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 700;
  color: var(--vscode-button-background, #0078d4);
  padding: 3px 4px; cursor: pointer;
  border-radius: 3px;
}
.ws-folder-hdr:hover { background: var(--vscode-list-hoverBackground); }
.ws-folder-body { padding-left: 8px; }
.ws-dir {
  margin: 1px 0;
}
.ws-dir-hdr {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; padding: 2px 4px; cursor: pointer;
  border-radius: 3px; color: var(--vscode-foreground);
}
.ws-dir-hdr:hover { background: var(--vscode-list-hoverBackground); }
.ws-dir-body { padding-left: 14px; display: none; }
.ws-dir.open > .ws-dir-body { display: block; }
.ws-file {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; padding: 2px 4px; cursor: pointer;
  border-radius: 3px; color: var(--vscode-foreground);
}
.ws-file:hover { background: var(--vscode-list-hoverBackground); }
.ws-file-icon { font-size: 11px; flex-shrink: 0; }
.ws-file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-add-btn {
  opacity: 0; font-size: 10px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none; border-radius: 3px; padding: 1px 5px; cursor: pointer;
  flex-shrink: 0;
}
.ws-file:hover .ws-add-btn { opacity: 1; }
#wsEmpty { text-align: center; padding: 24px; color: var(--vscode-descriptionForeground); font-size: 12px; }

/* ---- SETTINGS PAGE ---- */
#sScroll { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.sg { display: flex; flex-direction: column; gap: 6px; }
.sgt {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px;
  color: var(--vscode-button-background, #0078d4);
  padding-bottom: 3px; border-bottom: 1px solid var(--vscode-panel-border);
}
.sr { display: flex; flex-direction: column; gap: 3px; }
.sl { font-size: 12px; }
.sh { font-size: 10px; color: var(--vscode-descriptionForeground); }
.si {
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border);
  color: var(--vscode-input-foreground);
  padding: 5px 7px; border-radius: 4px; font-size: 12px;
  outline: none; width: 100%; font-family: inherit;
}
.si:focus { border-color: var(--vscode-focusBorder); }
.si[type=range] { padding: 0; height: 18px; cursor: pointer; }
.stgl { display: flex; align-items: center; gap: 7px; cursor: pointer; font-size: 12px; }
.sw { position: relative; width: 32px; height: 17px; flex-shrink: 0; }
.sw input { display: none; }
.sws { position: absolute; inset: 0; background: var(--vscode-panel-border); border-radius: 9px; transition: background .2s; cursor: pointer; }
.sws::before { content:''; position: absolute; width: 13px; height: 13px; left: 2px; top: 2px; background: #fff; border-radius: 50%; transition: transform .2s; }
.sw input:checked + .sws { background: var(--vscode-button-background); }
.sw input:checked + .sws::before { transform: translateX(15px); }
.bsv {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px;
}
.bsv:hover { background: var(--vscode-button-hoverBackground); }
.bsv.sec {
  background: var(--vscode-input-background);
  color: var(--vscode-foreground);
  border: 1px solid var(--vscode-panel-border);
}
.bsv.sec:hover { background: var(--vscode-list-hoverBackground); }
.rv { font-size: 11px; color: var(--vscode-descriptionForeground); min-width: 26px; text-align: right; }

/* ---- TOAST ---- */
#toasts { position: fixed; bottom: 70px; right: 6px; z-index: 9999; display: flex; flex-direction: column; gap: 3px; pointer-events: none; }
.toast {
  background: var(--vscode-notifications-background, #252526);
  border: 1px solid var(--vscode-panel-border);
  color: var(--vscode-foreground);
  padding: 5px 10px; border-radius: 4px; font-size: 11px;
  animation: tsi .18s ease; max-width: 200px;
}
.toast.ok { border-color: #4ec9b0; color: #4ec9b0; }
.toast.er { border-color: var(--vscode-errorForeground, #f44747); color: var(--vscode-errorForeground, #f44747); }
@keyframes tsi { from{opacity:0;transform:translateX(14px)} to{opacity:1;transform:none} }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  ✨ Genspark Coder
  <span class="mbadge" id="mbadge">${defaultModel}</span>
  <div class="header-right">
    <button class="hbtn" id="btnFiles" title="Workspace Files">🗂️</button>
    <button class="hbtn" id="btnHist" title="History">🕐</button>
    <button class="hbtn" id="btnNew" title="New Chat">➕</button>
    <button class="hbtn" id="btnCfg" title="Settings">⚙️</button>
  </div>
</div>

<!-- ========== CHAT PAGE ========== -->
<div class="page active" id="page-chat">
  <div id="messages">
    <div class="welcome" id="wlc">
      <h3>✨ Genspark Coder</h3>
      <p>AI coding assistant · Claude · GPT · Gemini · Grok</p>
      <p style="font-size:10px;margin-top:6px;opacity:.7">Gõ <strong>@</strong> để đính kèm file từ workspace</p>
      <div class="shortcuts">
        <div class="sc" id="sc0">📖 Explain current file</div>
        <div class="sc" id="sc1">📎 Add current file to chat</div>
        <div class="sc" id="sc2">🐛 Debug help</div>
        <div class="sc" id="sc3">🧪 Generate unit tests</div>
      </div>
    </div>
  </div>

  <div class="typing" id="typing">
    <div class="dot"></div><div class="dot"></div><div class="dot"></div>
    <span>Thinking...</span>
  </div>

  <!-- Pending edit banners (Accept / Reject per file) -->
  <div id="editBanners"></div>

  <div id="filesBar"></div>

  <div class="iarea">
    <!-- @-mention dropdown (appears above input) -->
    <div id="atDropdown">
      <div class="at-hdr">
        <span>📁 Workspace Files</span>
        <span id="atHint" style="font-size:9px">↑↓ chọn · Enter đính kèm · Esc đóng</span>
      </div>
      <div id="atList"></div>
    </div>

    <div class="mrow">
      <span class="mlbl">Model:</span>
      <select id="modelSel">${modelOptions}</select>
    </div>
    <div class="irow">
      <textarea id="input" rows="1" placeholder="Ask anything... (@ to attach file, Enter to send)"></textarea>
      <div class="isbx">
        <button class="isb" id="btnAttach" title="Attach file (dialog)">📎</button>
        <button class="isb" id="btnCurFile" title="Add currently open file">📄</button>
      </div>
      <button id="sendBtn" title="Send">➤</button>
    </div>
    <div class="ihint">Enter · send &nbsp;|&nbsp; Shift+Enter · newline &nbsp;|&nbsp; @ · attach file</div>
  </div>
</div>

<!-- ========== WORKSPACE FILES PAGE ========== -->
<div class="page" id="page-files">
  <div class="phdr">
    <button class="bbk" id="fBack">←</button>
    🗂️ Workspace Files
    <button class="hbtn" id="btnRefreshTree" title="Refresh" style="margin-left:auto;font-size:11px">↺</button>
  </div>
  <input id="wsSearch" placeholder="Search files... (Enter to search)">
  <div id="wsTree"><div id="wsEmpty">📂 Loading workspace...</div></div>
</div>

<!-- ========== HISTORY PAGE ========== -->
<div class="page" id="page-history">
  <div class="phdr">
    <button class="bbk" id="hBack">←</button>
    💬 Chat History
  </div>
  <input id="hSearch" placeholder="Search conversations...">
  <div id="hList"><div id="hEmpty">📭 No conversations yet</div></div>
  <div class="hftr">
    <button class="bclr" id="btnClrAll">🗑️ Clear All History</button>
  </div>
</div>

<!-- ========== SETTINGS PAGE ========== -->
<div class="page" id="page-settings">
  <div class="phdr">
    <button class="bbk" id="sBack">←</button>
    ⚙️ Settings
  </div>
  <div id="sScroll">
    <div class="sg">
      <div class="sgt">🔌 API Connection</div>
      <div class="sr">
        <label class="sl">API URL</label>
        <div class="sh">Genspark API endpoint</div>
        <input class="si" id="sUrl" type="text" placeholder="https://genspark-beta.up.railway.app">
      </div>
      <div class="sr">
        <label class="sl">API Key</label>
        <input class="si" id="sKey" type="password" placeholder="Your API key">
      </div>
    </div>
    <div class="sg">
      <div class="sgt">🤖 Model</div>
      <div class="sr">
        <label class="sl">Default Model</label>
        <select class="si" id="sMdl">${modelOptions}</select>
      </div>
    </div>
    <div class="sg">
      <div class="sgt">🎛️ Generation</div>
      <div class="sr">
        <label class="sl">Max Tokens</label>
        <input class="si" id="sTokens" type="number" min="256" max="100000" step="256">
      </div>
      <div class="sr">
        <label class="sl" style="display:flex;justify-content:space-between">
          Temperature <span id="sTempV" class="rv">0.7</span>
        </label>
        <div class="sh">0 = focused · 2 = creative</div>
        <input class="si" id="sTemp" type="range" min="0" max="2" step="0.1">
      </div>
      <div class="sr">
        <label class="stgl">
          <span class="sw"><input type="checkbox" id="sStream" checked><span class="sws"></span></span>
          Stream responses
        </label>
      </div>
    </div>
    <div class="sg">
      <div style="display:flex;gap:7px">
        <button class="bsv" id="btnSaveCfg" style="flex:1">💾 Save Settings</button>
        <button class="bsv sec" id="btnTest">🔌 Test</button>
      </div>
    </div>
    <div class="sg">
      <div class="sgt">ℹ️ About</div>
      <div style="font-size:11px;color:var(--vscode-descriptionForeground);line-height:1.7">
        <strong>Genspark Coder v2.8</strong><br>
        VSCode / Antigravity Extension<br>
        Claude · GPT · Gemini · Grok<br>
        <span style="color:#4ec9b0">✅ Streaming · History · File reading · @ mention · Edit + Diff</span>
      </div>
    </div>
  </div>
</div>

<div id="toasts"></div>

<script>
// ==========================================================
// Genspark Coder v2.8
// NEW: SEARCH/REPLACE format - AI knows WHERE to edit
// ==========================================================
const vscode = acquireVsCodeApi();
const MODELS = ${modelsJson};
let curModel = '${defaultModel}';
let curConvId = null;
let sending = false;
let allConvs = [];
let files = [];
let sBuf = '';
let sMsgId = null;

// @-mention state
let atMode = false;        // currently in @-mention mode?
let atQuery = '';          // text after @
let atItems = [];          // current dropdown items
let atSelIdx = 0;          // selected index

// ---- Helpers ----
function mname(id) {
  var m = MODELS.find(function(x) { return x.id === id; });
  return m ? m.name : id;
}

function toast(msg, type) {
  var c = document.getElementById('toasts');
  var d = document.createElement('div');
  d.className = 'toast' + (type === 'ok' ? ' ok' : type === 'er' ? ' er' : '');
  d.textContent = msg;
  c.appendChild(d);
  setTimeout(function() { try { c.removeChild(d); } catch(e){} }, 2200);
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escA(s) {
  return String(s).replace(/\\\\/g,'\\\\\\\\').replace(/"/g,'&quot;');
}

function fileIcon(ext) {
  var icons = {
    'ts':'🔷','tsx':'🔷','js':'🟨','jsx':'🟨','py':'🐍',
    'html':'🌐','css':'🎨','json':'📋','md':'📝','go':'🐹',
    'java':'☕','c':'⚙️','cpp':'⚙️','cs':'🔵','php':'🐘',
    'rb':'💎','rs':'🦀','kt':'🟣','swift':'🍎',
    'sh':'🖥️','sql':'🗄️','yaml':'📄','yml':'📄','txt':'📄',
  };
  return icons[ext] || '📄';
}

// ---- Page routing ----
function showPage(id) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.hbtn').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('page-' + id).classList.add('active');
  if (id === 'history') vscode.postMessage({ type: 'getHistory' });
  if (id === 'files') loadWorkspaceTree();
  // highlight active header btn
  var btnMap = { history: 'btnHist', files: 'btnFiles', settings: 'btnCfg' };
  if (btnMap[id]) document.getElementById(btnMap[id]).classList.add('active');
}

// ---- Header buttons ----
document.getElementById('btnFiles').addEventListener('click', function() { showPage('files'); });
document.getElementById('btnHist').addEventListener('click', function() { showPage('history'); });
document.getElementById('btnNew').addEventListener('click', function() { doNewChat(); });
document.getElementById('btnCfg').addEventListener('click', function() {
  vscode.postMessage({ type: 'getConfig' });
  showPage('settings');
});

// ---- Back buttons ----
document.getElementById('fBack').addEventListener('click', function() { showPage('chat'); });
document.getElementById('hBack').addEventListener('click', function() { showPage('chat'); });
document.getElementById('sBack').addEventListener('click', function() { showPage('chat'); });

// ---- Shortcut buttons ----
function bindShortcuts() {
  var s0 = document.getElementById('sc0');
  var s1 = document.getElementById('sc1');
  var s2 = document.getElementById('sc2');
  var s3 = document.getElementById('sc3');
  if (s0) s0.addEventListener('click', function() { setInput('Explain the current file to me'); doSend(); });
  if (s1) s1.addEventListener('click', function() { vscode.postMessage({ type: 'readCurrentFile' }); });
  if (s2) s2.addEventListener('click', function() { setInput('Help me debug this code'); doSend(); });
  if (s3) s3.addEventListener('click', function() { setInput('Generate unit tests for my code'); doSend(); });
}
bindShortcuts();

// ---- Model select ----
var modelSel = document.getElementById('modelSel');
modelSel.value = curModel;
modelSel.addEventListener('change', function() {
  curModel = this.value;
  document.getElementById('mbadge').textContent = mname(curModel);
  var sm = document.getElementById('sMdl');
  if (sm) sm.value = curModel;
});

// ---- Textarea + Send button ----
var inputEl = document.getElementById('input');
var sendBtn = document.getElementById('sendBtn');
var atDropdown = document.getElementById('atDropdown');
var atList = document.getElementById('atList');

function resizeInput() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
}

// ========================
// @-MENTION LOGIC
// ========================
function getAtPosition() {
  // Find the last '@' in input that is either at start or after space
  var val = inputEl.value;
  var pos = inputEl.selectionStart;
  var sub = val.slice(0, pos);
  var atIdx = sub.lastIndexOf('@');
  if (atIdx === -1) return null;
  // Check nothing between @ and cursor except non-space chars
  var after = sub.slice(atIdx + 1);
  if (/\\s/.test(after)) return null; // space after @, cancel
  return { atIdx, query: after };
}

function openAtDropdown(query) {
  atMode = true;
  atQuery = query;
  atSelIdx = 0;
  atDropdown.classList.add('show');
  atList.innerHTML = '<div class="at-empty">🔍 Searching...</div>';
  vscode.postMessage({ type: 'searchWorkspaceFiles', query: query });
}

function closeAtDropdown() {
  atMode = false;
  atDropdown.classList.remove('show');
  atItems = [];
  atSelIdx = 0;
}

function renderAtItems(items) {
  atItems = items;
  atSelIdx = 0;
  if (items.length === 0) {
    atList.innerHTML = '<div class="at-empty">📭 No files found</div>';
    return;
  }
  atList.innerHTML = '';
  items.forEach(function(f, i) {
    var d = document.createElement('div');
    d.className = 'at-item' + (i === 0 ? ' sel' : '');
    d.innerHTML = '<span class="at-icon">' + fileIcon(f.ext) + '</span>' +
      '<span class="at-name">' + esc(f.name) + '</span>' +
      '<span class="at-path">' + esc(f.relPath || f.path) + '</span>';
    d.addEventListener('mousedown', function(e) {
      e.preventDefault(); // prevent blur
      selectAtItem(i);
    });
    atList.appendChild(d);
  });
}

function updateAtSelection() {
  var items = atList.querySelectorAll('.at-item');
  items.forEach(function(it, i) {
    it.classList.toggle('sel', i === atSelIdx);
  });
  // scroll into view
  if (items[atSelIdx]) items[atSelIdx].scrollIntoView({ block: 'nearest' });
}

function selectAtItem(idx) {
  var f = atItems[idx];
  if (!f) return;
  // Replace @query in input with nothing (remove @query)
  var val = inputEl.value;
  var pos = inputEl.selectionStart;
  var sub = val.slice(0, pos);
  var atIdx = sub.lastIndexOf('@');
  var newVal = val.slice(0, atIdx) + val.slice(pos);
  inputEl.value = newVal;
  // Move cursor
  var newPos = atIdx;
  inputEl.setSelectionRange(newPos, newPos);
  resizeInput();
  closeAtDropdown();
  // Request file content
  vscode.postMessage({ type: 'readFileByPath', path: f.path });
  inputEl.focus();
}

inputEl.addEventListener('input', function() {
  resizeInput();
  var info = getAtPosition();
  if (info !== null) {
    openAtDropdown(info.query);
  } else {
    if (atMode) closeAtDropdown();
  }
});

inputEl.addEventListener('keydown', function(e) {
  // Handle @-mention navigation
  if (atMode && atItems.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      atSelIdx = Math.min(atSelIdx + 1, atItems.length - 1);
      updateAtSelection();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      atSelIdx = Math.max(atSelIdx - 1, 0);
      updateAtSelection();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      selectAtItem(atSelIdx);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAtDropdown();
      return;
    }
  }

  // Normal send
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    e.stopPropagation();
    doSend();
  }
});

inputEl.addEventListener('blur', function() {
  // Delay so mousedown on dropdown item can fire first
  setTimeout(function() { closeAtDropdown(); }, 150);
});

sendBtn.addEventListener('click', function(e) {
  e.preventDefault();
  e.stopPropagation();
  doSend();
});

document.getElementById('btnAttach').addEventListener('click', function() {
  vscode.postMessage({ type: 'addFile' });
});
document.getElementById('btnCurFile').addEventListener('click', function() {
  vscode.postMessage({ type: 'readCurrentFile' });
});

function setInput(txt) {
  inputEl.value = txt;
  resizeInput();
  inputEl.focus();
}

function doSend() {
  if (sending) return;
  var txt = inputEl.value.trim();
  if (!txt && files.length === 0) return;
  setSending(true);
  inputEl.value = '';
  inputEl.style.height = 'auto';
  vscode.postMessage({ type: 'sendMessage', text: txt, model: curModel, attachedFiles: files.slice() });
  files = [];
  renderFilesBar();
  setTimeout(function() { if (sending) setSending(false); }, 120000);
}

function setSending(on) {
  sending = on;
  sendBtn.disabled = on;
  document.getElementById('typing').classList.toggle('show', on);
}

// ---- Messages area ----
function scrollBot() {
  var el = document.getElementById('messages');
  el.scrollTop = el.scrollHeight;
}

function hideWelcome() {
  var w = document.getElementById('wlc');
  if (w) w.remove();
}

function addMsg(m) {
  hideWelcome();
  var msgs = document.getElementById('messages');
  var d = document.createElement('div');
  d.className = 'msg ' + m.role;
  d.id = 'msg-' + m.id;
  var t = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  var mtag = m.model ? ' <span style="font-size:9px;opacity:.7">[' + esc(mname(m.model)) + ']</span>' : '';
  var label = m.role === 'user' ? 'You' : ('✨ Genspark' + mtag);
  d.innerHTML = '<div class="rlabel">' + label + ' <span style="font-size:9px;opacity:.4">' + t + '</span></div>' +
    '<div class="bbl mc">' + renderMd(m.content) + '</div>';
  if (m.role === 'assistant') {
    addMsgActions(d);
    // Parse SR blocks from history messages too
    var srBlocks = parseSRBlocks(m.content);
    if (srBlocks.length > 0) {
      var bbl = d.querySelector('.bbl');
      if (bbl) renderSRBlocks(srBlocks, bbl, files.slice());
    }
  }
  msgs.appendChild(d);
  scrollBot();
}

function addMsgActions(d) {
  var act = document.createElement('div');
  act.style.cssText = 'display:none;gap:4px;margin-top:4px;padding-top:4px;border-top:1px solid var(--vscode-panel-border)';
  act.className = 'macts';
  var cp = document.createElement('button');
  cp.className = 'cbtn'; cp.textContent = '📋 Copy';
  cp.addEventListener('click', function() {
    var b = d.querySelector('.bbl');
    if (b) { vscode.postMessage({ type: 'copyCode', code: b.innerText }); toast('Copied!', 'ok'); }
  });
  act.appendChild(cp);
  d.appendChild(act);
  d.addEventListener('mouseenter', function() { act.style.display = 'flex'; });
  d.addEventListener('mouseleave', function() { act.style.display = 'none'; });
}

function startStream(id) {
  hideWelcome();
  var msgs = document.getElementById('messages');
  var d = document.createElement('div');
  d.className = 'msg assistant';
  d.id = 'msg-' + id;
  d.innerHTML = '<div class="rlabel">✨ Genspark <span style="font-size:9px;opacity:.5">[' + esc(mname(curModel)) + ']</span></div>' +
    '<div class="bbl mc" id="sb-' + id + '"><span style="opacity:.5">...</span></div>';
  msgs.appendChild(d);
  scrollBot();
}

function updateStream(id, content) {
  var el = document.getElementById('sb-' + id);
  if (el) { el.innerHTML = renderMd(content); scrollBot(); }
}

function endStream(id, m) {
  var el = document.getElementById('sb-' + id);
  if (el) { el.removeAttribute('id'); el.innerHTML = renderMd(m.content); }
  var d = document.getElementById('msg-' + id);
  if (d && !d.querySelector('.macts')) addMsgActions(d);
  // Parse and render SR blocks after stream ends
  var srBlocks = parseSRBlocks(m.content);
  if (srBlocks.length > 0 && d) {
    var bbl = d.querySelector('.bbl');
    if (bbl) renderSRBlocks(srBlocks, bbl, files.slice());
  }
  scrollBot();
}

// ---- Markdown renderer ----
function renderMd(text) {
  if (!text) return '';
  var s = esc(text);
  var codeBlocks = [];

  s = s.replace(/\`\`\`(\\w*)\\n?([\\s\\S]*?)\`\`\`/g, function(_, lang, code) {
    var l = lang || 'code';
    var idx = codeBlocks.length;
    codeBlocks.push(code.trim());
    return '__CB_' + idx + '_' + l + '__';
  });

  s = s.replace(/\`([^\`\\n]+)\`/g, '<span class="icode">$1</span>');
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  s = s.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  s = s.replace(/\\*\\*\\*(.+?)\\*\\*\\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
  s = s.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
  s = s.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  s = s.replace(/^---$/gm, '<hr>');
  s = s.replace(/^[\\*\\-\\+] (.+)$/gm, '<li>$1</li>');
  s = s.replace(/(<li>[\\s\\S]*?<\\/li>)\\n?(?=<li>|$)/g, '$1');
  s = s.replace(/(<li>.*<\\/li>\\n?)+/g, '<ul>$&</ul>');
  s = s.replace(/^\\d+\\. (.+)$/gm, '<li>$1</li>');
  s = s.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2">$1</a>');
  s = s.replace(/\\n\\n+/g, '</p><p>');
  s = s.replace(/\\n/g, '<br>');
  s = '<p>' + s + '</p>';

  s = s.replace(/__CB_(\\d+)_(\\w+)__/g, function(_, idx, lang) {
    var code = codeBlocks[parseInt(idx)];
    return '<div class="cblock" data-code="' + escA(code) + '" data-lang="' + lang + '">' +
      '<div class="chdr"><span class="clang">' + lang + '</span>' +
      '<div class="cbtns">' +
      '<button class="cbtn cp-btn">📋 Copy</button>' +
      '<button class="cbtn ins-btn">⬇ Insert</button>' +
      '<button class="cbtn apply-btn">✏️ Apply to File</button>' +
      '</div></div>' +
      '<pre><code>' + code + '</code></pre></div>';
  });

  return s;
}

document.getElementById('messages').addEventListener('click', function(e) {
  var btn = e.target;
  if (!btn || btn.tagName !== 'BUTTON') return;
  var block = btn.closest('.cblock');
  if (!block) return;
  var code = block.dataset.code;
  if (btn.classList.contains('cp-btn')) {
    vscode.postMessage({ type: 'copyCode', code: code });
    var orig = btn.textContent;
    btn.textContent = '✅ Copied';
    setTimeout(function() { btn.textContent = orig; }, 1400);
  } else if (btn.classList.contains('ins-btn')) {
    vscode.postMessage({ type: 'insertCode', code: code });
    toast('Inserted!', 'ok');
  } else if (btn.classList.contains('apply-btn')) {
    // Pick target file from attached files or active editor
    doApplyToFile(code);
  }
});

// ========================
// SEARCH/REPLACE PARSER + RENDERER
// ========================
// Parse SEARCH/REPLACE blocks from AI response text.
// Format used by AI:
//   **Editing filename.ext:**   (optional filename hint)
//   <<<<<<< SEARCH
//   ...exact text to find...
//   =======
//   ...replacement text...
//   >>>>>>> REPLACE
function parseSRBlocks(text) {
  var results = [];
  // Use new RegExp to avoid backtick conflicts inside template literal
  var pattern = new RegExp('<<<<<<< SEARCH\\n([\\s\\S]*?)\\n?=======\\n([\\s\\S]*?)\\n?>>>>>>> REPLACE', 'g');
  var filePattern = new RegExp('\\*\\*[Ee]diting[\\s\\u0060 ]+([^\\u0060*\\n]+)[\\u0060*]*\\s*:\\*\\*', 'g');
  var fileMatches = [];
  var fm;
  while ((fm = filePattern.exec(text)) !== null) {
    fileMatches.push({ idx: fm.index, name: fm[1].trim() });
  }
  var match;
  while ((match = pattern.exec(text)) !== null) {
    var search = match[1];
    var replace = match[2];
    var fileName = null;
    for (var i = fileMatches.length - 1; i >= 0; i--) {
      if (fileMatches[i].idx < match.index) {
        fileName = fileMatches[i].name;
        break;
      }
    }
    results.push({ search: search, replace: replace, fileName: fileName });
  }
  return results;
}

/** Render SEARCH/REPLACE blocks as interactive UI cards within a message */
function renderSRBlocks(blocks, msgEl, attachedFilePaths) {
  if (!blocks || blocks.length === 0) return;

  // Group by fileName
  var groups = {};
  var groupOrder = [];
  blocks.forEach(function(b, i) {
    var key = b.fileName || '__active__';
    if (!groups[key]) { groups[key] = []; groupOrder.push(key); }
    groups[key].push({ block: b, idx: i });
  });

  groupOrder.forEach(function(key) {
    var group = groups[key];
    var displayName = key === '__active__' ? (attachedFilePaths.length > 0 ? attachedFilePaths[0].name : 'active file') : key;
    var filePath = key === '__active__'
      ? (attachedFilePaths.length === 1 ? attachedFilePaths[0].path : null)
      : (attachedFilePaths.find(function(f) { return f.name === key; }) || {}).path || null;

    var grpEl = document.createElement('div');
    grpEl.className = 'sr-group';

    // Header
    var hdr = document.createElement('div');
    hdr.className = 'sr-group-hdr';
    hdr.innerHTML = '<span>✏️</span><span class="sr-fname">📄 ' + esc(displayName) + '</span>';
    var applyAllBtn = document.createElement('button');
    applyAllBtn.className = 'sr-apply-all';
    applyAllBtn.textContent = '✅ Apply All (' + group.length + ')';
    applyAllBtn.addEventListener('click', function() {
      var allBlocks = group.map(function(g) { return g.block; });
      vscode.postMessage({ type: 'applySRAll', blocks: allBlocks, filePath: filePath });
      applyAllBtn.textContent = '⏳ Applying...';
      applyAllBtn.disabled = true;
    });
    hdr.appendChild(applyAllBtn);
    grpEl.appendChild(hdr);

    // Individual blocks
    group.forEach(function(g, localIdx) {
      var b = g.block;
      var blockEl = document.createElement('div');
      blockEl.className = 'sr-block';

      var bHdr = document.createElement('div');
      bHdr.className = 'sr-block-hdr';
      bHdr.innerHTML = '<span class="sr-num">#' + (localIdx + 1) + '</span>' +
        '<span style="font-size:10px;color:var(--vscode-descriptionForeground)">Change ' + (localIdx+1) + ' of ' + group.length + '</span>';
      var btns = document.createElement('div');
      btns.className = 'sr-block-btns';
      var applyBtn = document.createElement('button');
      applyBtn.className = 'sr-btn';
      applyBtn.textContent = '✏️ Apply';
      applyBtn.addEventListener('click', function() {
        vscode.postMessage({ type: 'applySRBlock', block: b, filePath: filePath });
        applyBtn.textContent = '⏳';
        applyBtn.disabled = true;
        setTimeout(function() { applyBtn.textContent = '✅ Applied'; }, 1200);
      });
      btns.appendChild(applyBtn);
      bHdr.appendChild(btns);
      blockEl.appendChild(bHdr);

      // SEARCH section
      var searchSec = document.createElement('div');
      searchSec.className = 'sr-section';
      searchSec.innerHTML = '<span class="sr-section-lbl search">🔍 FIND</span>';
      var searchCode = document.createElement('pre');
      searchCode.className = 'sr-code search';
      searchCode.textContent = b.search;
      searchSec.appendChild(searchCode);
      blockEl.appendChild(searchSec);

      // REPLACE section
      var replaceSec = document.createElement('div');
      replaceSec.className = 'sr-section';
      replaceSec.innerHTML = '<span class="sr-section-lbl replace">✏️ REPLACE WITH</span>';
      var replaceCode = document.createElement('pre');
      replaceCode.className = 'sr-code replace';
      replaceCode.textContent = b.replace;
      replaceSec.appendChild(replaceCode);
      blockEl.appendChild(replaceSec);

      grpEl.appendChild(blockEl);
    });

    msgEl.appendChild(grpEl);
  });
}

// ---- Files bar ----
var pendingEditFiles = {}; // filePath → true

function doApplyToFile(code) {
  // If we have attached files, let user pick which one
  if (files.length > 0) {
    if (files.length === 1) {
      vscode.postMessage({ type: 'applyEdit', code: code, filePath: files[0].path });
      toast('✏️ Applying to ' + files[0].name + '...', '');
    } else {
      // Show quick-pick style dropdown (reuse atDropdown as a one-off)
      showFilePicker(files, function(f) {
        vscode.postMessage({ type: 'applyEdit', code: code, filePath: f.path });
        toast('✏️ Applying to ' + f.name + '...', '');
      });
    }
  } else {
    // No attached files → apply to active editor (extension will handle)
    vscode.postMessage({ type: 'applyEdit', code: code });
    toast('✏️ Applying to active editor...', '');
  }
}

function showFilePicker(fileList, onPick) {
  // Reuse atDropdown for file picking
  atItems = fileList.map(function(f) { return { name: f.name, path: f.path, relPath: f.path, ext: f.lang || f.ext || '' }; });
  atSelIdx = 0;
  atDropdown.classList.add('show');
  atList.innerHTML = '';
  fileList.forEach(function(f, i) {
    var d = document.createElement('div');
    d.className = 'at-item' + (i === 0 ? ' sel' : '');
    d.innerHTML = '<span class="at-icon">' + fileIcon(f.lang || '') + '</span>' +
      '<span class="at-name">' + esc(f.name) + '</span>' +
      '<span class="at-path">Apply here</span>';
    d.addEventListener('mousedown', function(ev) {
      ev.preventDefault();
      closeAtDropdown();
      onPick(f);
    });
    atList.appendChild(d);
  });
  // One-time Esc handler
  var cleanup = function(ev) {
    if (ev.key === 'Escape') { closeAtDropdown(); document.removeEventListener('keydown', cleanup); }
  };
  document.addEventListener('keydown', cleanup);
}

function showEditBanner(filePath, fileName) {
  pendingEditFiles[filePath] = true;
  var bar = document.getElementById('editBanners');
  // Avoid duplicates
  if (document.getElementById('ebanner-' + btoa(filePath).replace(/=/g,'').slice(0,12))) return;
  var id = 'ebanner-' + btoa(filePath).replace(/=/g,'').slice(0,12);
  var d = document.createElement('div');
  d.className = 'edit-banner';
  d.id = id;
  d.innerHTML =
    '<span>✏️ Pending edit:</span>' +
    '<span class="edit-banner-file" title="' + esc(filePath) + '">' + esc(fileName) + '</span>' +
    '<div class="edit-banner-btns">' +
      '<button class="ebtn accept" data-path="' + esc(filePath) + '">✅ Accept</button>' +
      '<button class="ebtn reject" data-path="' + esc(filePath) + '">✕ Reject</button>' +
    '</div>';
  d.querySelector('.ebtn.accept').addEventListener('click', function() {
    vscode.postMessage({ type: 'acceptEdit', filePath: filePath });
  });
  d.querySelector('.ebtn.reject').addEventListener('click', function() {
    vscode.postMessage({ type: 'rejectEdit', filePath: filePath });
  });
  bar.appendChild(d);
}

function removeEditBanner(filePath) {
  delete pendingEditFiles[filePath];
  var id = 'ebanner-' + btoa(filePath).replace(/=/g,'').slice(0,12);
  var el = document.getElementById(id);
  if (el) el.remove();
}

// ---- Files bar ----
function renderFilesBar() {
  var bar = document.getElementById('filesBar');
  if (files.length === 0) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  bar.innerHTML = '';
  files.forEach(function(f, i) {
    var chip = document.createElement('div');
    chip.className = 'fchip';
    chip.innerHTML = '<span>' + fileIcon(f.lang || f.ext || '') + '</span>' +
      '<span class="fchip-n" title="' + esc(f.name) + '">' + esc(f.name) + '</span>';
    var x = document.createElement('span');
    x.className = 'fchip-x'; x.textContent = '✕';
    x.addEventListener('click', function() { files.splice(i, 1); renderFilesBar(); });
    chip.appendChild(x);
    bar.appendChild(chip);
  });
}

// ---- New chat ----
function doNewChat() {
  curConvId = null;
  sending = false;
  files = [];
  renderFilesBar();
  sBuf = '';
  closeAtDropdown();
  var msgs = document.getElementById('messages');
  msgs.innerHTML = '';
  var w = document.createElement('div');
  w.className = 'welcome'; w.id = 'wlc';
  w.innerHTML = '<h3>✨ Genspark Coder</h3><p>AI coding assistant · Claude · GPT · Gemini · Grok</p>' +
    '<p style="font-size:10px;margin-top:6px;opacity:.7">Gõ <strong>@</strong> để đính kèm file từ workspace</p>' +
    '<div class="shortcuts">' +
    '<div class="sc" id="sc0">📖 Explain current file</div>' +
    '<div class="sc" id="sc1">📎 Add current file to chat</div>' +
    '<div class="sc" id="sc2">🐛 Debug help</div>' +
    '<div class="sc" id="sc3">🧪 Generate unit tests</div>' +
    '</div>';
  msgs.appendChild(w);
  bindShortcuts();
  setSending(false);
  showPage('chat');
  vscode.postMessage({ type: 'newChat' });
}

// ========================
// WORKSPACE FILE BROWSER
// ========================
var wsTreeData = null;

function loadWorkspaceTree() {
  document.getElementById('wsTree').innerHTML = '<div id="wsEmpty">📂 Loading...</div>';
  vscode.postMessage({ type: 'getWorkspaceTree' });
}

document.getElementById('btnRefreshTree').addEventListener('click', function() {
  loadWorkspaceTree();
});

document.getElementById('wsSearch').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    var q = this.value.trim();
    searchWsFiles(q);
  }
});
document.getElementById('wsSearch').addEventListener('input', function() {
  var q = this.value.trim();
  if (q.length === 0 && wsTreeData) {
    renderWorkspaceTree(wsTreeData);
  }
});

function searchWsFiles(q) {
  document.getElementById('wsTree').innerHTML = '<div id="wsEmpty">🔍 Searching...</div>';
  vscode.postMessage({ type: 'searchWorkspaceFiles', query: q });
}

function renderWorkspaceTree(folders) {
  wsTreeData = folders;
  var tree = document.getElementById('wsTree');
  if (!folders || folders.length === 0) {
    tree.innerHTML = '<div id="wsEmpty">📂 No workspace open</div>';
    return;
  }
  tree.innerHTML = '';
  folders.forEach(function(folder) {
    var fd = document.createElement('div');
    fd.className = 'ws-folder';

    var hdr = document.createElement('div');
    hdr.className = 'ws-folder-hdr';
    hdr.innerHTML = '📁 ' + esc(folder.name);
    fd.appendChild(hdr);

    var body = document.createElement('div');
    body.className = 'ws-folder-body';

    folder.items.forEach(function(item) {
      if (item.isDir) {
        var dir = document.createElement('div');
        dir.className = 'ws-dir';

        var dHdr = document.createElement('div');
        dHdr.className = 'ws-dir-hdr';
        dHdr.innerHTML = '<span style="font-size:11px">▶</span> 📂 ' + esc(item.name);
        dHdr.addEventListener('click', function() {
          dir.classList.toggle('open');
          var arrow = dHdr.querySelector('span');
          if (arrow) arrow.textContent = dir.classList.contains('open') ? '▼' : '▶';
        });
        dir.appendChild(dHdr);

        if (item.children && item.children.length > 0) {
          var dBody = document.createElement('div');
          dBody.className = 'ws-dir-body';
          item.children.forEach(function(child) {
            dBody.appendChild(makeWsFileEl(child));
          });
          dir.appendChild(dBody);
        }
        body.appendChild(dir);
      } else {
        body.appendChild(makeWsFileEl(item));
      }
    });

    fd.appendChild(body);
    tree.appendChild(fd);
  });
}

function renderWsSearchResults(files) {
  var tree = document.getElementById('wsTree');
  if (!files || files.length === 0) {
    tree.innerHTML = '<div id="wsEmpty">📭 No files found</div>';
    return;
  }
  tree.innerHTML = '';
  var list = document.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:1px;';
  files.forEach(function(f) {
    list.appendChild(makeWsFileEl(f));
  });
  tree.appendChild(list);
}

function makeWsFileEl(f) {
  var el = document.createElement('div');
  el.className = 'ws-file';
  el.innerHTML = '<span class="ws-file-icon">' + fileIcon(f.ext || '') + '</span>' +
    '<span class="ws-file-name" title="' + esc(f.path) + '">' + esc(f.name) + '</span>';
  var btn = document.createElement('button');
  btn.className = 'ws-add-btn';
  btn.textContent = '+ Chat';
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    vscode.postMessage({ type: 'readFileByPath', path: f.path });
    showPage('chat');
    toast('📄 ' + f.name + ' added', 'ok');
  });
  el.appendChild(btn);
  return el;
}

// ---- History ----
document.getElementById('hSearch').addEventListener('input', function() {
  var q = this.value.toLowerCase();
  var f = allConvs.filter(function(c) {
    return (c.title||'').toLowerCase().indexOf(q) >= 0 ||
      c.messages.some(function(m) { return m.content.toLowerCase().indexOf(q) >= 0; });
  });
  renderHistList(f);
});

document.getElementById('btnClrAll').addEventListener('click', function() {
  if (confirm('Delete ALL chat history? This cannot be undone.')) {
    vscode.postMessage({ type: 'clearAllHistory' });
  }
});

function renderHistList(convs) {
  var list = document.getElementById('hList');
  if (!convs || convs.length === 0) {
    list.innerHTML = '<div id="hEmpty">📭 No conversations yet</div>';
    return;
  }
  list.innerHTML = '';
  convs.forEach(function(c) {
    var dt = new Date(c.updatedAt);
    var ds = dt.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
             dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    var item = document.createElement('div');
    item.className = 'hitem' + (c.id === curConvId ? ' active' : '');
    item.innerHTML = '<div class="hcnt"><div class="htitle">' + esc(c.title || 'Untitled') + '</div>' +
      '<div class="hmeta">' + ds + ' · ' + c.messages.length + ' msgs</div></div>';
    var del = document.createElement('button');
    del.className = 'hdel'; del.textContent = '🗑️';
    del.addEventListener('click', function(e) {
      e.stopPropagation();
      vscode.postMessage({ type: 'deleteConversation', id: c.id });
    });
    item.appendChild(del);
    item.addEventListener('click', function() {
      vscode.postMessage({ type: 'loadConversation', id: c.id });
      showPage('chat');
    });
    list.appendChild(item);
  });
}

// ---- Settings ----
document.getElementById('sTemp').addEventListener('input', function() {
  document.getElementById('sTempV').textContent = this.value;
});

document.getElementById('btnSaveCfg').addEventListener('click', function() {
  var cfg = {
    apiUrl: document.getElementById('sUrl').value.trim(),
    apiKey: document.getElementById('sKey').value.trim(),
    defaultModel: document.getElementById('sMdl').value,
    maxTokens: parseInt(document.getElementById('sTokens').value) || 8192,
    temperature: parseFloat(document.getElementById('sTemp').value) || 0.7,
    streamResponse: document.getElementById('sStream').checked,
  };
  vscode.postMessage({ type: 'saveConfig', config: cfg });
  curModel = cfg.defaultModel;
  modelSel.value = curModel;
  document.getElementById('mbadge').textContent = mname(curModel);
  toast('Settings saved!', 'ok');
  showPage('chat');
});

document.getElementById('btnTest').addEventListener('click', function() {
  var url = document.getElementById('sUrl').value.trim();
  var key = document.getElementById('sKey').value.trim();
  if (!url) { toast('Enter API URL first', 'er'); return; }
  toast('Testing...', '');
  vscode.postMessage({ type: 'testConnection', apiUrl: url, apiKey: key });
});

function loadCfgUI(cfg) {
  if (!cfg) return;
  document.getElementById('sUrl').value = cfg.apiUrl || '';
  document.getElementById('sKey').value = cfg.apiKey || '';
  var sm = document.getElementById('sMdl');
  if (sm && cfg.defaultModel) sm.value = cfg.defaultModel;
  document.getElementById('sTokens').value = cfg.maxTokens || 8192;
  var st = document.getElementById('sTemp');
  st.value = cfg.temperature != null ? cfg.temperature : 0.7;
  document.getElementById('sTempV').textContent = st.value;
  document.getElementById('sStream').checked = cfg.streamResponse !== false;
  if (cfg.defaultModel) {
    curModel = cfg.defaultModel;
    modelSel.value = curModel;
    document.getElementById('mbadge').textContent = mname(curModel);
  }
}

// ---- Message handler from extension ----
window.addEventListener('message', function(event) {
  var m = event.data;
  switch (m.type) {

    case 'configLoaded':
    case 'configSaved':
      loadCfgUI(m.config);
      break;

    case 'conversationLoaded': {
      var cv = m.conversation;
      curConvId = cv.id;
      if (cv.model) {
        curModel = cv.model;
        modelSel.value = curModel;
        document.getElementById('mbadge').textContent = mname(curModel);
      }
      var ml = document.getElementById('messages');
      ml.innerHTML = '';
      cv.messages.forEach(function(msg) { addMsg(msg); });
      setSending(false);
      break;
    }

    case 'newChat':
      doNewChat();
      break;

    case 'messageAdded':
      addMsg(m.message);
      break;

    case 'streamStart':
      sMsgId = m.messageId;
      sBuf = '';
      setSending(true);
      startStream(m.messageId);
      break;

    case 'streamChunk':
      sBuf += m.chunk;
      updateStream(m.messageId, sBuf);
      break;

    case 'streamEnd':
      setSending(false);
      endStream(m.messageId, m.message);
      sBuf = '';
      break;

    case 'streamError':
      setSending(false);
      if (sMsgId) {
        var el = document.getElementById('sb-' + sMsgId);
        if (el) el.innerHTML = '<span style="color:var(--vscode-errorForeground,#f44747)">❌ ' + esc(m.error) + '</span>';
      }
      toast('Error: ' + m.error, 'er');
      sBuf = '';
      break;

    case 'historyLoaded':
      allConvs = m.conversations || [];
      renderHistList(allConvs);
      break;

    case 'showHistory':
      showPage('history');
      break;

    case 'showSettings':
      if (m.config) loadCfgUI(m.config);
      showPage('settings');
      break;

    case 'filesAttached':
      files = files.concat(m.files || []);
      renderFilesBar();
      showPage('chat');
      toast((m.files||[]).length + ' file(s) attached', 'ok');
      break;

    case 'workspaceFiles': {
      // Could be from @-mention search OR workspace panel search
      var wsSrch = document.getElementById('wsSearch');
      var isWsPanel = document.getElementById('page-files').classList.contains('active');
      if (atMode) {
        // @-mention dropdown
        renderAtItems(m.files || []);
      } else if (isWsPanel) {
        // workspace panel search result
        renderWsSearchResults(m.files || []);
      }
      break;
    }

    case 'workspaceTree':
      renderWorkspaceTree(m.folders || []);
      break;

    case 'prefillMessage':
      setInput(m.text);
      break;

    case 'conversationDeleted':
      if (curConvId === m.id) curConvId = null;
      vscode.postMessage({ type: 'getHistory' });
      break;

    case 'historyCleared':
      allConvs = [];
      renderHistList([]);
      toast('History cleared', 'ok');
      break;

    case 'connectionOk':
      toast('✅ API connected!', 'ok');
      break;

    case 'connectionFail':
      toast('❌ ' + m.error, 'er');
      break;

    case 'editApplied':
      showEditBanner(m.filePath, m.fileName);
      toast('✏️ ' + m.fileName + ' – Review diff then Accept/Reject', 'ok');
      break;

    case 'editAccepted':
      removeEditBanner(m.filePath);
      toast('✅ ' + m.fileName + ' accepted', 'ok');
      break;

    case 'editRejected':
      removeEditBanner(m.filePath);
      toast('↩️ ' + m.fileName + ' reverted', '');
      break;

    case 'editError':
      toast('❌ Apply failed: ' + m.error, 'er');
      break;

    case 'srAllResult':
      showEditBanner(m.filePath, m.fileName);
      if (m.failed > 0) {
        toast('⚠️ ' + m.applied + ' applied, ' + m.failed + ' failed – check diff', 'er');
      } else {
        toast('✅ ' + m.applied + ' change(s) applied to ' + m.fileName, 'ok');
      }
      break;

    case 'srBlockError':
      toast('❌ ' + (m.error || 'Search text not found in file'), 'er');
      break;

    case 'error':
      toast(m.message || 'Error', 'er');
      break;
  }
});

// ---- Init ----
vscode.postMessage({ type: 'getConfig' });
</script>
</body>
</html>`;
}

function buildModelOptions(models: any[]): string {
    const groups: Record<string, any[]> = {};
    for (const m of models) {
        if (!groups[m.group]) groups[m.group] = [];
        groups[m.group].push(m);
    }
    return Object.entries(groups).map(([g, items]) =>
        `<optgroup label="${g}">${items.map(m =>
            `<option value="${m.id}">${m.name}</option>`
        ).join('')}</optgroup>`
    ).join('');
}
