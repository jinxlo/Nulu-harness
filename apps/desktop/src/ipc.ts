/** Typed preload operations exposed only by the Electron shell. */

import type { DesktopPluginRecord } from './project-manager.ts'
import type { DesktopLocale } from './locale.ts'
import type { DesktopBackendState } from './backend-controller.ts'

/** IPC channel names kept private to the desktop application bundle. */
export const DESKTOP_IPC = {
  localeGet: 'nulu-desktop:locale-get',
  pluginsList: 'nulu-desktop:plugins-list',
  pluginsAdd: 'nulu-desktop:plugins-add',
  pluginsRemove: 'nulu-desktop:plugins-remove',
  pluginsUpdate: 'nulu-desktop:plugins-update',
  pluginsToggle: 'nulu-desktop:plugins-toggle',
  pluginsDisableAll: 'nulu-desktop:plugins-disable-all',
  backendStatus: 'nulu-desktop:backend-status',
  backendRetry: 'nulu-desktop:backend-retry',
  applicationRestart: 'nulu-desktop:application-restart',
  configurationReset: 'nulu-desktop:configuration-reset',
  backendState: 'nulu-desktop:backend-state',
  updatesCheck: 'nulu-desktop:updates-check',
  updatesInstall: 'nulu-desktop:updates-install',
  updatesState: 'nulu-desktop:updates-state',
} as const

/** Desktop release update state rendered by desktop-owned UI. */
export interface DesktopUpdateState {
  readonly phase: 'idle' | 'checking' | 'available' | 'installing' | 'ready' | 'error'
  readonly version?: string
  readonly message?: string
}

/** Narrow bridge exposed through context isolation. */
export interface DshDesktopApi {
  readonly protocolVersion: 1
  locale(): Promise<DesktopLocale>
  readonly plugins: {
    list(): Promise<readonly DesktopPluginRecord[]>
    add(spec: string): Promise<void>
    remove(name: string): Promise<void>
    update(name: string, version: string): Promise<void>
    toggle(name: string, enabled: boolean): Promise<void>
    disableAll(): Promise<void>
  }
  readonly backend: {
    status(): Promise<DesktopBackendState>
    retry(): Promise<void>
    subscribe(listener: (state: DesktopBackendState) => void): () => void
  }
  readonly updates: {
    check(): Promise<DesktopUpdateState>
    install(): Promise<void>
    subscribe(listener: (state: DesktopUpdateState) => void): () => void
  }
}

/** Startup-page controls, unavailable to backend-provided application documents. */
export interface DshDesktopStartupApi extends Pick<DshDesktopApi, 'protocolVersion' | 'locale'> {
  readonly backend: Omit<DshDesktopApi['backend'], 'retry'>
  disablePlugins(): Promise<void>
  restart(): Promise<void>
  resetConfiguration(): Promise<void>
}
