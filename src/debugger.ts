import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { Socket } from 'net';
import { Logger } from './logger';
import { MayaConnection } from './mayaConnection';

export class Debugger {
  private static hostname: string;
  private static port: number;

  public static initialize(mayaHost: string, mayaPort: number): void {
    this.hostname = mayaHost;
    this.port = mayaPort;
  }

  public static startDebug(uri: vscode.Uri): Thenable<boolean> {
    const fileDirname = path.dirname(uri.fsPath);
    let configuration = {
      "name": "Maya Python Debugger : Remote Attach",
      "type": "python",
      "request": "attach",
      "port": this.port,
      "host": this.hostname,
      "pathMappings": [
        {
          "localRoot": `${fileDirname}`,
          "remoteRoot": `${fileDirname}`
        }
      ],
      "MayaDebugFile": `${uri.fsPath}`
    };

    return vscode.debug.startDebugging(undefined, configuration);
  }

  public static runDebugCode(code: string, isAttach: boolean = false, isDebugpy: boolean = false): void {
    const debugPath = isAttach ? path.join(os.tmpdir(), 'MayaPy_Python_attach.py') : path.join(os.tmpdir(), 'MayaPy_Python_debug.py');

    fs.writeFile(debugPath, code, (err) => {
      if (err) {
        Logger.error(`Failed to write code to temp file ${debugPath}`);
        return;
      }

      vscode.workspace.openTextDocument(debugPath).then(document => {
        vscode.window.showTextDocument(document).then(() => {
          Logger.info(`Running debug code from ${document.uri.fsPath}`);
          this.sendCodeToMaya(document.getText())
          vscode.commands.executeCommand("workbench.action.closeActiveEditor").then(() => {
            if (isAttach) {
              vscode.window.showInformationMessage(`Attempt to import the ${isDebugpy ? 'debugpy': 'ptvsd'} module in Maya, please wait for a while and try again`);
            }
            fs.unlinkSync(debugPath);
          });
        });
      });
    });
  }

  public static debugPythonFile(uri: vscode.Uri, isDebugpy: boolean): void {
    const fileDirname = path.dirname(uri.fsPath);
    const fileBasename = path.basename(uri.fsPath, ".py");

    const runCode = this.getRunCode(fileDirname, fileBasename);
    this.runDebugCode(runCode, false, isDebugpy);
  }

  private static getAttachCode(hostname: string, port: number, isDebugpy: boolean): string {
    if (isDebugpy) {
      // debugpy attach code
      const debugLibraryPath: string = path.join(path.dirname(__dirname), "libs", "debugpy")
      return `
import sys

debugpy_module = r"${debugLibraryPath}"
if debugpy_module not in sys.path:
    sys.path.insert(0, debugpy_module)
import debugpy
import os
import maya.cmds as cmds

maya_install_dir = os.environ.get('MAYA_LOCATION')
mayapy_path = os.path.join(maya_install_dir, 'bin', 'mayapy.exe')

debugpy.configure(python=mayapy_path)
debugpy.listen(("${hostname}", ${port}))
print("Enabling debugpy debugger attach on address: ${hostname}:${port}")
`;
    } else {
      // ptvsd attach code
      const debugLibraryPath: string = path.join(path.dirname(__dirname), "libs", "ptvsd")
      return `
import sys

ptvsd_module = r"${debugLibraryPath}"
if ptvsd_module not in sys.path:
    sys.path.insert(0, ptvsd_module)
import ptvsd
ptvsd.enable_attach(address=("${hostname}", ${port}))
print("Enabling ptvsd debugger attach on address: ${hostname}:${port}")
`;
    }
  }

  private static getRunCode(fileDirname: string, fileBasename: string): string {
    return `
import sys

current_directory = r"${fileDirname}"
if current_directory not in sys.path:
  sys.path.insert(0,current_directory)

if '${fileBasename}' not in globals():
	import ${fileBasename}
else:
  try:
    reload(${fileBasename})
  except NameError:
    from importlib import reload
    reload(${fileBasename})
`;
  }

  public static sendCodeToMaya(code: string): void {
    const socket = MayaConnection.ensureConnection('python')
    if (!socket.destroyed) {
      MayaConnection.sendPythonToMaya(code).then(() => {
        Logger.info(`Sent code to Maya.`);
      }).catch((error) => {
        Logger.error(`Failed to send code to Maya: ${error}`);
      });
    }
  }

  public static checkConnect(): Promise<boolean> {
    let options = {
      "host": this.hostname,
      "port": this.port
    };
    let socket = new Socket();

    return new Promise((resolve) => {
      socket.setTimeout(5000);
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(options, () => {
        socket.destroy();
        resolve(true);
      });
    });
  }

  
  public static connect(isDebugpy: boolean = false): void {
    const hostname: string = this.hostname;
    const port: number = this.port;

    const attachCode = this.getAttachCode(hostname, port, isDebugpy);
    this.runDebugCode(attachCode, true, isDebugpy);
  }
}