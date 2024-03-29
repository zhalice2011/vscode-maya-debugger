import * as vscode from 'vscode';
import { Logger } from './logger';
import { MayaConnection } from './mayaConnection';
import { Debugger } from './debugger';

const net = require('net');

export function activate(context: vscode.ExtensionContext) {
  let outputPanel = vscode.window.createOutputChannel('mayadebugger');
  Logger.registerOutputPanel(outputPanel);
  Logger.info(`Activate Maya Debugger!`);

  const mayaConnectionHost: string = 'localhost';
  const mayaConnectionPort: number = 7001;
  const config = vscode.workspace.getConfiguration('mayadebugger');
  const mayaDebuggerHost: string = config.get("hostname") || 'localhost';
  const mayaDebuggerPort: number = config.get("port") || 5678;

  MayaConnection.initialize(mayaConnectionHost, mayaConnectionPort);
  Debugger.initialize(mayaDebuggerHost, mayaDebuggerPort);

  // Initialize the status bar item for Maya connection
  let mayaportStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  MayaConnection.initializeStatusBarItem(mayaportStatusBar);

  // Register commands
  const ptvsdCommand = vscode.commands.registerCommand('mayadebugger.debugpyFileForMaya2021AndBelow', async () => {
    const mayaSocket = net.createConnection(mayaConnectionPort, mayaConnectionHost).on("error", (e) => {
			mayaSocket.destroy()
			Logger.error(`
			Unable to connect to port localhost on Host 7001 in Maya
			Please run the mel command in the maya script editor:
			commandPort -name "${mayaConnectionHost}:${mayaConnectionPort}" -sourceType "mel" -echoOutput;
			`)
		}).on("connect", async (e) => {
			mayaSocket.destroy()
      const uri = vscode.window.activeTextEditor?.document.uri;
      if (!uri) return;

      let activeDebugSession = vscode.debug.activeDebugSession
      if (activeDebugSession) {
        Debugger.debugPythonFile(uri, false);
      } else {
        const isConnected = await Debugger.checkConnect();
        if (isConnected) {
          await Debugger.startDebug(uri);
          Debugger.debugPythonFile(uri, false);
        } else {
          Debugger.connect(false);
        }
      }
		}).on("data", (e) => {
			mayaSocket.destroy()
		}).on("timeout", (e) => {
			mayaSocket.destroy()
		});
  });

  const debugpyCommand = vscode.commands.registerCommand('mayadebugger.debugpyFileForMaya2022AndAbove', async () => {
    const mayaSocket = net.createConnection(mayaConnectionPort, mayaConnectionHost).on("error", (e) => {
			mayaSocket.destroy()
			Logger.error(`
			Unable to connect to port localhost on Host 7001 in Maya
			Please run the mel command in the maya script editor:
			commandPort -name "${mayaConnectionHost}:${mayaConnectionPort}" -sourceType "mel";
			`)
		}).on("connect", async (e) => {
			mayaSocket.destroy()
      const uri = vscode.window.activeTextEditor?.document.uri;
      if (!uri) return;

      const isConnected = await Debugger.checkConnect();
      if (isConnected) {
        let activeDebugSession = vscode.debug.activeDebugSession
        if (!activeDebugSession) {
          vscode.window.showInformationMessage('Please launch the VS Code debugger (F5) to attach to the running process')
          return;
        }
        Debugger.debugPythonFile(uri, true);
      } else {
        Debugger.connect(true);
      }
		}).on("data", (e) => {
			mayaSocket.destroy()
		}).on("timeout", (e) => {
			mayaSocket.destroy()
		});
  });

  context.subscriptions.push(ptvsdCommand);
  context.subscriptions.push(debugpyCommand);
  context.subscriptions.push(mayaportStatusBar);
}