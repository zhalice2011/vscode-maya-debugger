import * as vscode from 'vscode';
import { TimeUtils } from './timeUtils';

export class Logger {
  private static _outputPanel: vscode.OutputChannel | undefined;

  public static registerOutputPanel(outputPanel: vscode.OutputChannel) {
    this._outputPanel = outputPanel;
  }

  public static info(log: string) {
    this.typeLog(log, 'INFO');
  }

  public static error(log: string) {
    this.typeLog(log, 'ERROR');
    vscode.window.showErrorMessage(log);
  }

  public static success(log: string) {
    this.typeLog(log, 'SUCCESS');
  }

  public static response(log: string) {
    this.typeLog(log, 'RESPONSE');
  }

  private static typeLog(log: string, type: string) {
    if (!this._outputPanel) {
      return;
    }
    const time = TimeUtils.getTime();
    this._outputPanel.appendLine(`[${time}][${type}] ${log}`);
  }
}