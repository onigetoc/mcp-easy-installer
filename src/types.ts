export interface InstallResult {
  status?: string; // e.g. "success", "already_installed", "error"
  message: string;
  serverName?: string;
  [key: string]: any;
}