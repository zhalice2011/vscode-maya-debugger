import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { Socket } from 'net';
import { Logger } from './logger';

export class MayaConnection {
  private static _socket: Socket | undefined;
  private static _host: string | undefined;
  private static _port: string | undefined;
  private static _statusBarItem: vscode.StatusBarItem | undefined;

  public static initialize(mayaHost: string, mayaPort: number): void {
    this._host = mayaHost;
    this._port = mayaPort.toString();
  }

  public static initializeStatusBarItem(statusBarItem: vscode.StatusBarItem) {
    this._statusBarItem = statusBarItem;
  }

  public static updateStatusBarItem(langID?: string): void {
    if (!this._statusBarItem) {
      return;
    }

    if (langID === 'python' || langID === 'mel') {
      if (this._socket && !this._socket.destroyed) {
        const text = `Maya Port : ${this._port}`;
        this._statusBarItem.text = text;
        this._statusBarItem.show();
      }
    } else {
      this._statusBarItem.hide();
    }
  }

  public static ensureConnection(type: string): Socket {
    if (this._socket && !this._socket.destroyed) {
      Logger.info(`Already active : Port ${this._port} on Host ${this._host} for ${type}`);
      this.updateStatusBarItem(type);
      return this._socket;
    }

    const socket = new Socket();
    socket.connect({ port: parseInt(this._port), host: this._host }, () => {
      Logger.info(`Connected : Port ${this._port} on Host ${this._host} for ${type}`);
      this.updateStatusBarItem(type);
    });

    socket.on('error', (error) => {
      const errorMsg = `Unable to connect using port ${this._port} on Host ${this._host}\nPlease run the below mel command in Maya's script editor\n\ncommandPort -n "${this._host}:${this._port}" -stp "mel" -echoOutput;\n\nError Message : ${error.message}`;
      Logger.error(errorMsg);
    });

    socket.on('data', (data: Buffer) => {
      Logger.response(this.cleanResponse(data));
    });

    socket.on('end', () => {
      Logger.info(`Disconnected from server. ${type} | Port ${this._port} on Host ${this._host}`);
      this.updateStatusBarItem(type);
    });

    this._socket = socket;
    return socket;
  }

  private static cleanResponse(data: Buffer): string {
    let dataString = data.toString();
    if (dataString.startsWith("Error")) {
      dataString = dataString.replace(/MayaCode.py", line (?<name>\d+)/, (...match) => {
        let newLineno = match[0].replace(match[1], (+match[1] - 1).toString());
        return newLineno;
      });
    }
    return dataString;
  }

  public static sendPythonToMaya(code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const newCode = "# -*- coding: utf-8 -*-\n" + code;
      const nativePath = path.join(os.tmpdir(), "MayaCode.py");
      const posixPath = nativePath.replace(/\\/g, "/");
      const cmd = `python("exec(open('${posixPath}').read())")`;

      fs.writeFile(nativePath, newCode, (err) => {
        if (err) {
          Logger.error(`Failed to write Python code to temp file ${posixPath}`);
          reject(err);
        } else {
          this.sendCode(cmd).then(resolve).catch(reject);
        }
      });
    });
  }

  public static sendCode(code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this._socket || this._socket.destroyed) {
        reject(new Error('No active connection to Maya.'));
        return;
      }
      this._socket.write(code + '\n', 'utf8', (error) => {
        if (error) {
          reject(error);
        } else {
          Logger.info(`Code sent to Maya: ${code}`);
          resolve();
        }
      });
    });
  }

  public static handleSocketErrors(socket: Socket): void {
    socket.on('error', (error) => {
      Logger.error(`Socket error: ${error.message}`);
    });

    socket.on('close', (hadError) => {
      if (hadError) {
        Logger.error('Socket closed due to a transmission error.');
      } else {
        Logger.info('Socket closed.');
      }
    });
  }
}