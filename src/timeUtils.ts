export class TimeUtils {
  public static getTime(): string {
    return new Date()
      .toISOString()
      .replace(/T/, ' ')
      .replace(/\..+/, '')
      .split(' ')[1];
  }
}